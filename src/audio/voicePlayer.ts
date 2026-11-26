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
  悉尼: 'sydney',
  夏威夷: 'hawaii',
  雷克雅未克: 'reykjavik',
  开普敦: 'capetown',
  京都: 'kyoto',
  巴黎: 'paris',
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

function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const preferred = voices.find((v) =>
    /Xiaoxiao|Xiaoyi|Yaoyao|Tingting|Mei-Jia|Google 普通话|Microsoft.*Chinese/i.test(v.name),
  )
  if (preferred) return preferred
  return voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ?? null
}

class VoicePlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private activeSource: AudioBufferSourceNode | null = null
  private activeUtterance: SpeechSynthesisUtterance | null = null
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
    if (muted && this.activeUtterance && isSpeechSupported()) {
      this.activeUtterance = null
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
      this.setSnapshot(null, null)
    }
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

  private playHeadsetChime() {
    if (this.muted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.gainNode) return
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined)
    }
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16)
      env.gain.setValueAtTime(0.0001, now)
      env.gain.exponentialRampToValueAtTime(0.08, now + 0.03)
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      osc.connect(env)
      env.connect(this.gainNode)
      osc.start(now)
      osc.stop(now + 0.24)
    } catch {
      /* ignore */
    }
  }

  private stopSourceOnly() {
    if (this.activeUtterance) {
      this.activeUtterance = null
      if (isSpeechSupported()) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          /* ignore */
        }
      }
    }
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

  async play(id: string, mode: VoiceMode = 'headset', onEnded?: () => void): Promise<boolean> {
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
        onEnded?.()
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

  async speakWhisper(id: string, text: string): Promise<boolean> {
    const cleanText = text.replace(/^[“"]|[”"]$/g, '').trim()
    if (!id || !cleanText) return false
    const seq = ++this.playSeq
    this.stopSourceOnly()
    this.playHeadsetChime()

    if (!isSpeechSupported()) {
      if (seq === this.playSeq) this.setSnapshot(null, null)
      return false
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.92
      utterance.pitch = 1.06
      utterance.volume = this.muted ? 0 : clamp(this.masterVolume * this.voiceVolume * 0.9, 0, 1)
      const zhVoice = pickChineseVoice()
      if (zhVoice) utterance.voice = zhVoice
      utterance.onend = () => {
        if (seq === this.playSeq) {
          this.activeUtterance = null
          this.setSnapshot(null, null)
        }
      }
      utterance.onerror = () => {
        if (seq === this.playSeq) {
          this.activeUtterance = null
          this.setSnapshot(null, null)
        }
      }
      this.activeUtterance = utterance
      this.setSnapshot(id, null)
      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      if (seq === this.playSeq) {
        this.activeUtterance = null
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

  async toggleWhisper(
    id: string,
    text: string,
    mp3Id?: string | null,
    mode: VoiceMode = 'headset',
  ): Promise<boolean> {
    if (mp3Id) return this.toggle(mp3Id, mode)
    if (this.snapshot.playingId === id) {
      this.stop()
      return false
    }
    return this.speakWhisper(id, text)
  }
}

export const voicePlayer = new VoicePlayer()

export function useVoiceState(): VoiceSnapshot {
  return useSyncExternalStore(voicePlayer.subscribe, voicePlayer.getSnapshot, voicePlayer.getSnapshot)
}
