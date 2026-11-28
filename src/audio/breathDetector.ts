export interface BreathStartResult {
  ok: boolean
  reason?: string
}

const BREATH_LOW_HZ = 1200
const BREATH_HIGH_HZ = 5600
const HUM_MAX_HZ = 450
const NOISE_FLOOR = 0.055
const GUST_THRESHOLD = 0.36
const GUST_COOLDOWN_MS = 550

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value >= 1) return 1
  return value
}

/**
 * Pure FFT magnitude analyzer for human breath-to-wind detection.
 * Inspects turbulent blowing air (1200 Hz – 5600 Hz) while rejecting
 * low-frequency room hum / steady speech fundamentals (< 450 Hz) and
 * narrow tonal whistles.
 */
export function computeBreathEnergy(freqData: Uint8Array, sampleRate: number): number {
  if (!freqData || freqData.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return 0
  }

  const nyquist = sampleRate / 2
  const binHz = nyquist / freqData.length
  if (binHz <= 0) return 0

  const breathStart = Math.max(0, Math.floor(BREATH_LOW_HZ / binHz))
  const breathEnd = Math.min(freqData.length - 1, Math.ceil(BREATH_HIGH_HZ / binHz))
  if (breathStart > breathEnd) return 0

  const humEnd = Math.min(freqData.length - 1, Math.floor(HUM_MAX_HZ / binHz))

  let humSum = 0
  const humCount = humEnd + 1
  for (let i = 0; i <= humEnd; i += 1) {
    humSum += freqData[i]
  }
  const humMean = humCount > 0 ? humSum / (humCount * 255) : 0

  let breathSum = 0
  const breathCount = breathEnd - breathStart + 1
  for (let i = breathStart; i <= breathEnd; i += 1) {
    breathSum += freqData[i]
  }
  const breathMeanByte = breathCount > 0 ? breathSum / breathCount : 0
  const breathMean = breathMeanByte / 255

  const gatedBreath = Math.max(0, (breathMean - NOISE_FLOOR) / (1 - NOISE_FLOOR))
  if (gatedBreath <= 0) return 0

  // Broadband coverage check so narrow whistles do not masquerade as turbulent breath.
  const activeThreshold = Math.max(22, breathMeanByte * 0.35)
  let activeBins = 0
  for (let i = breathStart; i <= breathEnd; i += 1) {
    if (freqData[i] >= activeThreshold) {
      activeBins += 1
    }
  }
  const coverage = breathCount > 0 ? activeBins / breathCount : 0
  const spreadWeight = clamp01((coverage - 0.08) / 0.32)
  if (spreadWeight <= 0) return 0

  // Spectral broadband ratio against low-frequency room hum / bass rumble.
  const spectralRatio = breathMean / (humMean + 0.08)
  const ratioWeight = clamp01((spectralRatio - 0.28) / (0.95 - 0.28))
  if (ratioWeight <= 0) return 0

  const combined = gatedBreath * ratioWeight * spreadWeight
  return clamp01(Math.pow(combined, 0.85) * 1.12)
}

function resolveAudioContextCtor(): typeof AudioContext | null {
  if (typeof AudioContext !== 'undefined') return AudioContext
  if (typeof window !== 'undefined') {
    const win = window as unknown as { webkitAudioContext?: typeof AudioContext }
    return win.webkitAudioContext ?? null
  }
  return null
}

function describeMicError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name?: unknown }).name ?? '')
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return '未获得麦克风权限，请在浏览器地址栏允许访问麦克风'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '未检测到可用的麦克风设备'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '麦克风正被其他应用占用，请稍后再试'
    }
  }
  return '无法启动麦克风呼气监听，请检查设备权限'
}

export class BreathDetector {
  private isActive = false
  private startToken = 0
  private stream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private freqBuffer: Uint8Array<ArrayBuffer> | null = null
  private rafId: number | null = null
  private smoothedStrength = 0
  private lastGustAt = 0

  get active(): boolean {
    return this.isActive
  }

  async start(onBreath: (strength: number, gust: boolean) => void): Promise<BreathStartResult> {
    this.stop()
    const token = ++this.startToken

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, reason: '当前浏览器环境不支持麦克风采集' }
    }

    const AudioCtx = resolveAudioContextCtor()
    if (!AudioCtx) {
      return { ok: false, reason: '当前浏览器不支持 Web Audio 频谱分析' }
    }

    let mediaStream: MediaStream
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    } catch (err) {
      return { ok: false, reason: describeMicError(err) }
    }

    if (token !== this.startToken) {
      mediaStream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      return { ok: false, reason: '麦克风监听已取消' }
    }

    let ctx: AudioContext | null = null
    try {
      ctx = new AudioCtx()
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {})
      }

      if (token !== this.startToken) {
        mediaStream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {
            /* ignore */
          }
        })
        void ctx.close().catch(() => {})
        return { ok: false, reason: '麦克风监听已取消' }
      }

      const source = ctx.createMediaStreamSource(mediaStream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)

      this.stream = mediaStream
      this.audioCtx = ctx
      this.sourceNode = source
      this.analyser = analyser
      this.freqBuffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
      this.smoothedStrength = 0
      this.lastGustAt = 0
      this.isActive = true

      const tick = () => {
        if (!this.isActive || !this.analyser || !this.freqBuffer || !this.audioCtx) return

        this.analyser.getByteFrequencyData(this.freqBuffer)
        const instant = computeBreathEnergy(this.freqBuffer, this.audioCtx.sampleRate)
        const alpha = instant > this.smoothedStrength ? 0.36 : 0.18
        this.smoothedStrength += (instant - this.smoothedStrength) * alpha
        if (this.smoothedStrength < 0.004) {
          this.smoothedStrength = 0
        }

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        let gust = false
        if (this.smoothedStrength >= GUST_THRESHOLD && now - this.lastGustAt >= GUST_COOLDOWN_MS) {
          gust = true
          this.lastGustAt = now
        }

        try {
          onBreath(this.smoothedStrength, gust)
        } catch {
          /* ignore consumer callback error */
        }

        if (this.isActive && typeof requestAnimationFrame === 'function') {
          this.rafId = requestAnimationFrame(tick)
        }
      }

      if (typeof requestAnimationFrame === 'function') {
        this.rafId = requestAnimationFrame(tick)
      }

      return { ok: true }
    } catch (err) {
      mediaStream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      if (ctx) {
        void ctx.close().catch(() => {})
      }
      this.stop()
      return { ok: false, reason: describeMicError(err) }
    }
  }

  stop(): void {
    this.startToken += 1
    this.isActive = false

    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId)
      }
      this.rafId = null
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {
        /* ignore */
      }
      this.sourceNode = null
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect()
      } catch {
        /* ignore */
      }
      this.analyser = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      this.stream = null
    }

    if (this.audioCtx) {
      const ctx = this.audioCtx
      this.audioCtx = null
      void ctx.close().catch(() => {})
    }

    this.freqBuffer = null
    this.smoothedStrength = 0
    this.lastGustAt = 0
  }
}
