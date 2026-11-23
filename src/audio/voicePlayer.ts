import { useSyncExternalStore } from 'react'
import { getSettings, subscribeSettings } from '../services/settings'

export type VoiceMode = 'clear' | 'headset' | 'deep'

export interface VoiceSnapshot {
  playingId: string | null
  loadingId: string | null
}

export const CITY_VOICE_SLUGS: Record<string, string> = {
  北京: 'beijing',
  上海: 'shanghai',
  广州: 'guangzhou',
  深圳: 'shenzhen',
  成都: 'chengdu',
  杭州: 'hangzhou',
  南京: 'nanjing',
  西安: 'xian',
  武汉: 'wuhan',
  青岛: 'qingdao',
  大理: 'dali',
  哈尔滨: 'harbin',
  三亚: 'sanya',
  拉萨: 'lhasa',
}

export function getCityVoiceId(city: string): string | null {
  const clean = city.trim()
  if (!clean) return null
  const exact = CITY_VOICE_SLUGS[clean]
  if (exact) return `city-${exact}`
  for (const [name, slug] of Object.entries(CITY_VOICE_SLUGS)) {
    if (clean.includes(name)) return `city-${slug}`
  }
  return null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function voiceUrl(id: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}voice/${encodeURIComponent(id)}.mp3`
}

class VoicePlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private activeSource: AudioBufferSourceNode | null = null
  private rawCache = new Map<string, Promise<ArrayBuffer | null>>()
  private bufferCache = new Map<string, AudioBuffer>()
  private listeners = new Set<() => void>()
  private settingsUnsubscribe: (() => void) | null = null

  private snapshot: VoiceSnapshot = { playingId: null, loadingId: null }
  private playSeq = 0
  private muted = false
  private currentMode: VoiceMode = 'headset'
  private masterVolume = 1
  private voiceVolume = 1

  constructor() {
    if (typeof window !== 'undefined') {
      const initial = getSettings()
      this.masterVolume = initial.masterVolume
      this.voiceVolume = initial.voiceVolume
    }
  }

  private setSnapshot(playingId: string | null, loadingId: string | null) {
    if (this.snapshot.playingId === playingId && this.snapshot.loadingId === loadingId) return
    this.snapshot = { playingId, loadingId }
    this.listeners.forEach((listener) => listener())
  }

  getSnapshot = (): VoiceSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private targetGain(): number {
    const modeGain = this.currentMode === 'clear' ? 0.92 : this.currentMode === 'headset' ? 0.88 : 0.82
    return this.muted ? 0.0001 : clamp(this.masterVolume * this.voiceVolume * modeGain, 0.0001, 1.3)
  }

  private applyGain(smoothing = 0.08) {
    if (!this.ctx || !this.gainNode) return
    this.gainNode.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, smoothing)
  }

  private syncSettings() {
    const s = getSettings()
    this.masterVolume = Number.isFinite(s.masterVolume) ? clamp(s.masterVolume, 0, 1) : 1
    this.voiceVolume = Number.isFinite(s.voiceVolume) ? clamp(s.voiceVolume, 0, 1) : 1
    this.applyGain(0.12)
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.settingsUnsubscribe) {
      this.syncSettings()
      this.settingsUnsubscribe = subscribeSettings(() => this.syncSettings())
    }
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtor) return null
      const ctx = new AudioCtor()
      const gain = ctx.createGain()
      gain.gain.value = this.targetGain()
      gain.connect(ctx.destination)
      this.ctx = ctx
      this.gainNode = gain
    }
    return this.ctx
  }

  async unlock() {
    const ctx = this.ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        /* browser may wait for a direct gesture */
      }
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.applyGain(0.08)
  }

  preload(id: string): Promise<ArrayBuffer | null> {
    if (typeof window === 'undefined' || !id) return Promise.resolve(null)
    const cached = this.rawCache.get(id)
    if (cached) return cached

    const task = fetch(voiceUrl(id))
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null)
      .then((buf) => {
        if (!buf) this.rawCache.delete(id)
        return buf
      })
    this.rawCache.set(id, task)
    return task
  }

  private async loadDecodedBuffer(id: string, ctx: AudioContext): Promise<AudioBuffer | null> {
    const ready = this.bufferCache.get(id)
    if (ready) return ready

    const raw = await this.preload(id)
    if (!raw) return null
    try {
      const decoded = await ctx.decodeAudioData(raw.slice(0))
      this.bufferCache.set(id, decoded)
      return decoded
    } catch {
      return null
    }
  }

  private stopSourceOnly() {
    if (this.activeSource) {
      const src = this.activeSource
      this.activeSource = null
      src.onended = null
      try {
        src.stop()
      } catch {
        /* already ended */
      }
      try {
        src.disconnect()
      } catch {
        /* ignore */
      }
    }
  }

  stop() {
    this.playSeq += 1
    this.stopSourceOnly()
    this.setSnapshot(null, null)
  }

  async play(id: string, mode: VoiceMode = 'headset'): Promise<boolean> {
    if (!id) return false
    const seq = ++this.playSeq
    this.stopSourceOnly()
    this.currentMode = mode
    this.setSnapshot(null, id)

    const ctx = this.ensureContext()
    if (!ctx || !this.gainNode) {
      if (seq === this.playSeq) this.setSnapshot(null, null)
      return false
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        /* keep trying to decode; playback starts cleanly once unlocked */
      }
    }

    const buffer = await this.loadDecodedBuffer(id, ctx)
    if (seq !== this.playSeq || !buffer || !this.gainNode) {
      if (seq === this.playSeq) this.setSnapshot(null, null)
      return false
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    let tail: AudioNode = source
    if (mode === 'clear') {
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 90
      tail.connect(hp)
      tail = hp
    } else if (mode === 'headset') {
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 210
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 6200
      const peak = ctx.createBiquadFilter()
      peak.type = 'peaking'
      peak.frequency.value = 2400
      peak.Q.value = 1.1
      peak.gain.value = 2.5
      tail.connect(hp)
      hp.connect(lp)
      lp.connect(peak)
      tail = peak
    } else {
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 280
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 4400
      const peak = ctx.createBiquadFilter()
      peak.type = 'peaking'
      peak.frequency.value = 2100
      peak.Q.value = 1.2
      peak.gain.value = 3.0
      tail.connect(hp)
      hp.connect(lp)
      lp.connect(peak)
      tail = peak
    }

    tail.connect(this.gainNode)
    this.applyGain(0.04)

    source.onended = () => {
      if (seq === this.playSeq) {
        this.activeSource = null
        this.setSnapshot(null, null)
      }
    }

    this.activeSource = source
    this.setSnapshot(id, null)
    try {
      source.start(0)
      return true
    } catch {
      if (seq === this.playSeq) {
        this.activeSource = null
        this.setSnapshot(null, null)
      }
      return false
    }
  }

  async toggle(id: string, mode: VoiceMode = 'headset'): Promise<boolean> {
    if (this.snapshot.playingId === id || this.snapshot.loadingId === id) {
      this.stop()
      return false
    }
    return this.play(id, mode)
  }
}

export const voicePlayer = new VoicePlayer()

export function useVoiceState(): VoiceSnapshot {
  return useSyncExternalStore(voicePlayer.subscribe, voicePlayer.getSnapshot, voicePlayer.getSnapshot)
}
