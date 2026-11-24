import { getSettings, subscribeSettings, type VisionSettings } from '../services/settings'
import type { AmbientKind } from '../types/vision'

interface Layer {
  gain: GainNode
  sources: AudioScheduledSourceNode[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function makeNoise(ctx: AudioContext, seconds = 4) {  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
  }
  return buffer
}

interface Station {
  root: number
  scale: number[]
  bpm: number
  pad: OscillatorType
  cutoff: number
}

const MUSIC_LEVEL = 0.26

const MINOR_PENTA = [0, 3, 5, 7, 10]
const MAJOR_PENTA = [0, 2, 4, 7, 9]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]

function stationOf(root: number, scale: number[], bpm: number, pad: OscillatorType, cutoff: number): Station {
  return { root, scale, bpm, pad, cutoff }
}

const STATIONS: Record<string, Station> = {
  北京: stationOf(146.83, MINOR_PENTA, 76, 'triangle', 1800),
  哈尔滨: stationOf(110, MINOR_PENTA, 64, 'sine', 1400),
  三亚: stationOf(174.61, MAJOR_PENTA, 92, 'triangle', 2600),
  青岛: stationOf(196, MAJOR_PENTA, 84, 'sine', 2300),
  大理: stationOf(130.81, MAJOR_PENTA, 70, 'triangle', 2100),
  武汉: stationOf(164.81, MINOR_PENTA, 80, 'triangle', 1700),
  拉萨: stationOf(164.81, MAJOR_PENTA, 62, 'sine', 2800),
  上海: stationOf(123.47, MINOR_PENTA, 88, 'sawtooth', 1500),
  成都: stationOf(174.61, MAJOR_PENTA, 74, 'triangle', 2000),
  西安: stationOf(146.83, DORIAN, 68, 'triangle', 1600),
  杭州: stationOf(110, MINOR_PENTA, 72, 'sine', 1900),
  南京: stationOf(130.81, MINOR_PENTA, 66, 'sine', 1700),
  悉尼: stationOf(196.0, MAJOR_PENTA, 94, 'triangle', 2700),
  夏威夷: stationOf(174.61, MAJOR_PENTA, 86, 'sine', 2500),
  雷克雅未克: stationOf(146.83, DORIAN, 58, 'sine', 2900),
  开普敦: stationOf(164.81, MAJOR_PENTA, 88, 'triangle', 2400),
  京都: stationOf(138.59, MINOR_PENTA, 64, 'sine', 2000),
  巴黎: stationOf(146.83, DORIAN, 78, 'triangle', 1950),
}

const DEFAULT_STATION = stationOf(146.83, MINOR_PENTA, 72, 'triangle', 1900)

function stationFor(city: string) {
  return STATIONS[city.trim()] ?? DEFAULT_STATION
}

/**
 * 程序化环境声合成器：五种地表音景 + 现场录音回放。
 * 只有在用户手势后调用 ensure() 才会创建 AudioContext。
 */
export class AmbientMixer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambienceBus: GainNode | null = null
  private voiceBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private noise: AudioBuffer | null = null

  private kind: AmbientKind = 'none'
  private volume = 0.65
  private masterVolume = 1
  private ambienceVolume = 1
  private voiceVolume = 1
  private sfxVolume = 1
  private muted = false
  private active = true
  private layers: Layer[] = []
  private accentTimer: number | null = null

  private voiceSource: AudioBufferSourceNode | null = null
  private voiceStopTimer: number | null = null
  private voiceCache = new Map<string, AudioBuffer>()

  private musicBus: GainNode | null = null
  private musicTimer: number | null = null
  private musicStation: Station | null = null
  private musicCity: string | null = null
  private musicStep = 0
  private musicNext = 0

  private disposed = false
  private settingsUnsubscribe: (() => void) | null = null

  revive() {
    this.disposed = false
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0
  }

  private masterTarget() {
    return this.muted || !this.active ? 0.0001 : 0.85 * this.masterVolume
  }

  private applyMaster(smoothing = 0.3) {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.masterTarget(), this.now(), smoothing)
    }
    if (this.ambienceBus && this.ctx) {
      this.ambienceBus.gain.setTargetAtTime(this.active ? this.volume * 0.62 * this.ambienceVolume : 0.0001, this.now(), 0.35)
    }
  }

  async ensure() {
    if (this.disposed) return
    if (!this.settingsUnsubscribe) {
      this.applySettings(getSettings())
      this.settingsUnsubscribe = subscribeSettings(() => this.applySettings(getSettings()))
    }
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtor) return
      const ctx = new AudioCtor()
      this.ctx = ctx
      this.noise = makeNoise(ctx)

      const master = ctx.createGain()
      master.gain.value = 0.0001
      master.connect(ctx.destination)
      this.master = master

      const ambience = ctx.createGain()
      ambience.gain.value = 0.0001
      ambience.connect(master)
      this.ambienceBus = ambience

      const voice = ctx.createGain()
      voice.gain.value = 0.9 * this.voiceVolume
      voice.connect(master)
      this.voiceBus = voice

      const sfx = ctx.createGain()
      sfx.gain.value = 0.9 * this.sfxVolume
      sfx.connect(master)
      this.sfxBus = sfx

      const music = ctx.createGain()
      music.gain.value = 0.0001
      music.connect(master)
      this.musicBus = music
      if (this.musicStation) this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * this.ambienceVolume, ctx.currentTime, 0.6)

      this.rebuildLayers()
    }

    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume()
      } catch {
        /* 下一次手势再恢复 */
      }
    }
    this.applyMaster(0.5)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __mixer?: AmbientMixer }).__mixer = this
    }
  }

  setKind(kind: AmbientKind) {
    if (this.kind === kind) return
    this.kind = kind
    if (this.ctx) this.rebuildLayers()
  }

  setVolume(volume: number) {
    this.volume = clamp(volume, 0, 1)
    if (this.ambienceBus && this.ctx) {
      this.ambienceBus.gain.setTargetAtTime(this.active ? this.volume * 0.62 * this.ambienceVolume : 0.0001, this.now(), 0.2)
    }
  }

  setMasterVolume(value: number) {
    this.masterVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    this.applyMaster(0.25)
  }

  setAmbienceVolume(value: number) {
    this.ambienceVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    this.applyMaster(0.25)
  }

  private applySettings(settings: VisionSettings) {
    this.setMasterVolume(settings.masterVolume)
    this.setAmbienceVolume(settings.ambienceVolume)
    this.setVoiceVolume(settings.voiceVolume)
    this.setSfxVolume(settings.sfxVolume)
  }

  setVoiceVolume(value: number) {
    this.voiceVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    this.applyVoice()
  }

  setSfxVolume(value: number) {
    this.sfxVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    this.applySfx()
  }

  private applyVoice() {
    if (this.voiceBus && this.ctx) {
      this.voiceBus.gain.setTargetAtTime(0.9 * this.voiceVolume, this.now(), 0.2)
    }
  }

  private applySfx() {
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(0.9 * this.sfxVolume, this.now(), 0.2)
    }
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return
    this.muted = muted
    this.applyMaster(0.25)
  }

  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    this.applyMaster(0.6)
    if (!active) {
      this.stopVoice()
      this.clearAccent()
    }
  }

  private noiseSource() {
    if (!this.ctx || !this.noise) return null
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    source.loopStart = Math.random() * 1.5
    source.start(0, Math.random() * 1.5)
    return source
  }

  private track(gain: GainNode, sources: AudioScheduledSourceNode[]) {
    this.layers.push({ gain, sources })
  }

  private layerGain(target: number, attack = 1.2) {
    if (!this.ctx || !this.ambienceBus) return null
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    gain.gain.setTargetAtTime(target, this.ctx.currentTime, attack)
    gain.connect(this.ambienceBus)
    return gain
  }

  private lfo(target: AudioParam, frequency: number, depth: number, type: OscillatorType = 'sine') {
    if (!this.ctx) return null
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = frequency
    const amount = this.ctx.createGain()
    amount.gain.value = depth
    osc.connect(amount)
    amount.connect(target)
    osc.start()
    return osc
  }

  private buildWind(level: number) {
    if (!this.ctx) return
    const source = this.noiseSource()
    if (!source) return
    const highpass = this.ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 110
    const lowpass = this.ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 620
    lowpass.Q.value = 0.7
    const gain = this.layerGain(0.5 * level, 1.6)
    if (!gain) return

    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(gain)

    const gust = this.lfo(gain.gain, 0.075, 0.18 * level)
    const sweep = this.lfo(lowpass.frequency, 0.043, 240)
    this.track(gain, [source, ...(gust ? [gust] : []), ...(sweep ? [sweep] : [])])
  }

  private buildRain() {
    if (!this.ctx) return
    const source = this.noiseSource()
    if (!source) return
    const highpass = this.ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 880
    const lowpass = this.ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 5400
    const gain = this.layerGain(0.42, 1.4)
    if (!gain) return
    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(gain)
    const drift = this.lfo(gain.gain, 0.11, 0.07)
    this.track(gain, [source, ...(drift ? [drift] : [])])

    const body = this.noiseSource()
    if (body) {
      const bodyLow = this.ctx.createBiquadFilter()
      bodyLow.type = 'lowpass'
      bodyLow.frequency.value = 180
      const bodyGain = this.layerGain(0.16, 1.8)
      if (bodyGain) {
        body.connect(bodyLow)
        bodyLow.connect(bodyGain)
        this.track(bodyGain, [body])
      }
    }
    this.scheduleDroplets()
  }

  private buildOcean() {
    if (!this.ctx) return
    const surf = this.noiseSource()
    if (surf) {
      const lowpass = this.ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 780
      const gain = this.layerGain(0.52, 1.8)
      if (gain) {
        surf.connect(lowpass)
        lowpass.connect(gain)
        const swell = this.lfo(gain.gain, 0.07, 0.3)
        this.track(gain, [surf, ...(swell ? [swell] : [])])
      }
    }

    const spray = this.noiseSource()
    if (spray) {
      const highpass = this.ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 1700
      const ceiling = this.ctx.createBiquadFilter()
      ceiling.type = 'lowpass'
      ceiling.frequency.value = 6500
      const gain = this.layerGain(0.09, 2.2)
      if (gain) {
        spray.connect(highpass)
        highpass.connect(ceiling)
        ceiling.connect(gain)
        const swell = this.lfo(gain.gain, 0.052, 0.1, 'triangle')
        this.track(gain, [spray, ...(swell ? [swell] : [])])
      }
    }

    const deep = this.noiseSource()
    if (deep) {
      const lowpass = this.ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 120
      const gain = this.layerGain(0.22, 2.4)
      if (gain) {
        deep.connect(lowpass)
        lowpass.connect(gain)
        this.track(gain, [deep])
      }
    }
  }

  private buildCicada() {
    if (!this.ctx) return
    const source = this.noiseSource()
    if (!source) return
    const band = this.ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 3600
    band.Q.value = 7
    const gain = this.layerGain(0.075, 2)
    if (!gain) return
    source.connect(band)
    band.connect(gain)
    const tremolo = this.lfo(gain.gain, 23, 0.06, 'triangle')
    const swell = this.lfo(gain.gain, 0.09, 0.03)
    this.track(gain, [source, ...(tremolo ? [tremolo] : []), ...(swell ? [swell] : [])])
    this.scheduleCrickets('cicada')
  }

  private buildNight() {
    if (!this.ctx) return
    const source = this.noiseSource()
    if (!source) return
    const lowpass = this.ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 360
    const gain = this.layerGain(0.24, 2.4)
    if (!gain) return
    source.connect(lowpass)
    lowpass.connect(gain)
    const breeze = this.lfo(gain.gain, 0.045, 0.08)
    this.track(gain, [source, ...(breeze ? [breeze] : [])])
    this.scheduleCrickets('night')
  }

  private buildLibrary() {
    if (!this.ctx) return
    const room = this.noiseSource()
    if (room) {
      const lowpass = this.ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 260
      const gain = this.layerGain(0.22, 1.8)
      if (gain) {
        room.connect(lowpass)
        lowpass.connect(gain)
        const breathe = this.lfo(gain.gain, 0.05, 0.04)
        this.track(gain, [room, ...(breathe ? [breathe] : [])])
      }
    }
    this.scheduleLibraryAccents()
  }

  private buildSnow() {
    if (!this.ctx) return
    const air = this.noiseSource()
    if (air) {
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 180
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 880
      const gain = this.layerGain(0.32, 1.8)
      if (gain) {
        air.connect(hp)
        hp.connect(lp)
        lp.connect(gain)
        const drift = this.lfo(gain.gain, 0.06, 0.1)
        this.track(gain, [air, ...(drift ? [drift] : [])])
      }
    }
    const frost = this.noiseSource()
    if (frost) {
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 3400
      const gain = this.layerGain(0.065, 2.2)
      if (gain) {
        frost.connect(hp)
        hp.connect(gain)
        const shimmer = this.lfo(gain.gain, 0.12, 0.025)
        this.track(gain, [frost, ...(shimmer ? [shimmer] : [])])
      }
    }
    this.scheduleSnowAccents()
  }

  private buildCity() {
    if (!this.ctx) return
    const hum = this.noiseSource()
    if (hum) {
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 85
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 520
      const gain = this.layerGain(0.36, 1.6)
      if (gain) {
        hum.connect(hp)
        hp.connect(lp)
        lp.connect(gain)
        const traffic = this.lfo(gain.gain, 0.085, 0.12)
        const sweep = this.lfo(lp.frequency, 0.055, 190)
        this.track(gain, [hum, ...(traffic ? [traffic] : []), ...(sweep ? [sweep] : [])])
      }
    }
    const street = this.noiseSource()
    if (street) {
      const bp = this.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1150
      bp.Q.value = 0.85
      const gain = this.layerGain(0.09, 2.0)
      if (gain) {
        street.connect(bp)
        bp.connect(gain)
        const pass = this.lfo(gain.gain, 0.14, 0.05)
        this.track(gain, [street, ...(pass ? [pass] : [])])
      }
    }
    this.scheduleCityAccents()
  }

  private scheduleLibraryAccents() {
    if (this.kind !== 'library') return
    const delay = 1400 + Math.random() * 2400
    this.accentTimer = window.setTimeout(() => {
      this.accentTimer = null
      if (this.disposed || this.kind !== 'library') return
      const ctx = this.ctx
      const bus = this.ambienceBus
      if (ctx && bus && this.noise && ctx.state === 'running') {
        const now = ctx.currentTime + 0.02
        if (Math.random() < 0.65) {
          // 轻柔翻书沙沙声
          const src = ctx.createBufferSource()
          src.buffer = this.noise
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.setValueAtTime(1600, now)
          bp.frequency.exponentialRampToValueAtTime(3200, now + 0.07)
          bp.frequency.exponentialRampToValueAtTime(1100, now + 0.22)
          bp.Q.value = 1.6
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, now)
          g.gain.exponentialRampToValueAtTime(0.16 + Math.random() * 0.08, now + 0.05)
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
          const pan = ctx.createStereoPanner()
          pan.pan.value = Math.random() * 1.4 - 0.7
          src.connect(bp)
          bp.connect(g)
          g.connect(pan)
          pan.connect(bus)
          src.start(now, Math.random() * 1.2, 0.28)
          window.setTimeout(() => pan.disconnect(), 420)
        } else {
          // 远处轻柔脚步两步
          const pan = ctx.createStereoPanner()
          pan.pan.value = Math.random() * 1.4 - 0.7
          pan.connect(bus)
          for (let step = 0; step < 2; step += 1) {
            const at = now + step * 0.48
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(115, at)
            osc.frequency.exponentialRampToValueAtTime(62, at + 0.09)
            const g = ctx.createGain()
            g.gain.setValueAtTime(0.0001, at)
            g.gain.exponentialRampToValueAtTime(0.055, at + 0.012)
            g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
            osc.connect(g)
            g.connect(pan)
            osc.start(at)
            osc.stop(at + 0.13)
          }
          window.setTimeout(() => pan.disconnect(), 900)
        }
      }
      this.scheduleLibraryAccents()
    }, delay)
  }

  private scheduleSnowAccents() {
    if (this.kind !== 'snow') return
    const delay = 1800 + Math.random() * 2600
    this.accentTimer = window.setTimeout(() => {
      this.accentTimer = null
      if (this.disposed || this.kind !== 'snow') return
      const ctx = this.ctx
      const bus = this.ambienceBus
      if (ctx && bus && this.noise && ctx.state === 'running') {
        const now = ctx.currentTime + 0.02
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.setValueAtTime(2400 + Math.random() * 1200, now)
        bp.Q.value = 1.9
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(0.09, now + 0.04)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
        const pan = ctx.createStereoPanner()
        pan.pan.value = Math.random() * 1.4 - 0.7
        src.connect(bp)
        bp.connect(g)
        g.connect(pan)
        pan.connect(bus)
        src.start(now, Math.random() * 1.5, 0.24)
        window.setTimeout(() => pan.disconnect(), 360)
      }
      this.scheduleSnowAccents()
    }, delay)
  }

  private scheduleCityAccents() {
    if (this.kind !== 'city') return
    const delay = 2600 + Math.random() * 3400
    this.accentTimer = window.setTimeout(() => {
      this.accentTimer = null
      if (this.disposed || this.kind !== 'city') return
      const ctx = this.ctx
      const bus = this.ambienceBus
      if (ctx && bus && ctx.state === 'running') {
        const now = ctx.currentTime + 0.02
        const pan = ctx.createStereoPanner()
        pan.pan.value = Math.random() * 1.4 - 0.7
        pan.connect(bus)
        // 远处江轮或有轨电车的温柔泛音
        const base = Math.random() < 0.5 ? 220 : 293.66
        ;[base, base * 1.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = freq
          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 680
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, now)
          g.gain.exponentialRampToValueAtTime(idx === 0 ? 0.026 : 0.012, now + 0.35)
          g.gain.exponentialRampToValueAtTime(0.0001, now + 1.9)
          osc.connect(lp)
          lp.connect(g)
          g.connect(pan)
          osc.start(now)
          osc.stop(now + 2.0)
        })
        window.setTimeout(() => pan.disconnect(), 2200)
      }
      this.scheduleCityAccents()
    }, delay)
  }

  playInteractionSfx(kind: 'lamp' | 'star' | 'ripple' | 'snow' | 'shutter' | 'horn') {
    if (!this.ctx || !this.sfxBus || this.muted || !this.active) return
    if (this.ctx.state !== 'running') return
    const ctx = this.ctx
    const bus = this.sfxBus
    const now = ctx.currentTime + 0.01

    if (kind === 'shutter') {
      if (this.noise) {
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 1800
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(0.28, now + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)
        src.connect(hp)
        hp.connect(g)
        g.connect(bus)
        src.start(now, Math.random(), 0.09)
      }
      const click = ctx.createOscillator()
      click.type = 'triangle'
      click.frequency.setValueAtTime(920, now + 0.04)
      click.frequency.exponentialRampToValueAtTime(420, now + 0.11)
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0.0001, now + 0.04)
      cg.gain.exponentialRampToValueAtTime(0.11, now + 0.048)
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      click.connect(cg)
      cg.connect(bus)
      click.start(now + 0.04)
      click.stop(now + 0.13)
      return
    }

    if (kind === 'horn') {
      ;[146.83, 220].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = freq
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 540
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(idx === 0 ? 0.09 : 0.045, now + 0.18)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.35)
        osc.connect(lp)
        lp.connect(g)
        g.connect(bus)
        osc.start(now)
        osc.stop(now + 1.45)
      })
      return
    }

    const notes: Record<'lamp' | 'star' | 'ripple' | 'snow', number[]> = {
      lamp: [523.25, 659.25],
      star: [783.99, 1046.5, 1318.5],
      ripple: [392.0, 587.33],
      snow: [880.0, 1174.66],
    }
    notes[kind].forEach((freq, i) => {
      const at = now + i * 0.075
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, at)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.075 / (i + 1), at + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.65)
      osc.connect(g)
      g.connect(bus)
      osc.start(at)
      osc.stop(at + 0.7)
    })
  }

  private rebuildLayers() {
    if (!this.ctx) return
    this.clearAccent()
    const now = this.ctx.currentTime
    this.layers.forEach((layer) => {
      layer.gain.gain.cancelScheduledValues(now)
      layer.gain.gain.setTargetAtTime(0.0001, now, 0.18)
      layer.sources.forEach((source) => {
        try {
          source.stop(now + 0.9)
        } catch {
          /* already stopped */
        }
      })
    })
    this.layers = []

    switch (this.kind) {
      case 'wind':
        this.buildWind(1)
        break
      case 'rain':
        this.buildRain()
        break
      case 'ocean':
        this.buildOcean()
        break
      case 'cicada':
        this.buildCicada()
        break
      case 'night':
        this.buildNight()
        break
      case 'library':
        this.buildLibrary()
        break
      case 'snow':
        this.buildSnow()
        break
      case 'city':
        this.buildCity()
        break
      default:
        break
    }
    this.applyMaster(0.5)
  }

  private clearAccent() {
    if (this.accentTimer !== null) {
      window.clearTimeout(this.accentTimer)
      this.accentTimer = null
    }
  }

  private scheduleDroplets() {
    if (this.kind !== 'rain') return
    const delay = 260 + Math.random() * 620
    this.accentTimer = window.setTimeout(() => {
      this.accentTimer = null
      if (this.disposed || this.kind !== 'rain') return
      const ctx = this.ctx
      const bus = this.ambienceBus
      if (ctx && bus && ctx.state === 'running') {
        const count = 1 + Math.floor(Math.random() * 2)
        for (let i = 0; i < count; i += 1) {
          this.droplet(ctx, bus, ctx.currentTime + i * 0.045)
        }
      }
      this.scheduleDroplets()
    }, delay)
  }

  private droplet(ctx: AudioContext, bus: GainNode, at: number) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const freq = 1400 + Math.random() * 2600
    osc.frequency.setValueAtTime(freq, at)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + 0.07)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.018 + Math.random() * 0.03, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    osc.connect(gain)
    gain.connect(pan)
    pan.connect(bus)
    osc.start(at)
    osc.stop(at + 0.12)
  }

  private scheduleCrickets(kind: 'cicada' | 'night') {
    if (this.kind !== kind) return
    const delay = kind === 'night' ? 1400 + Math.random() * 2600 : 900 + Math.random() * 1900
    this.accentTimer = window.setTimeout(() => {
      this.accentTimer = null
      if (this.disposed || this.kind !== kind) return
      const ctx = this.ctx
      const bus = this.ambienceBus
      if (ctx && bus && ctx.state === 'running') {
        const pan = ctx.createStereoPanner()
        pan.pan.value = Math.random() * 1.6 - 0.8
        pan.connect(bus)
        const pulses = kind === 'night' ? 3 : 4
        const base = 4200 + Math.random() * 900
        for (let i = 0; i < pulses; i += 1) {
          const at = ctx.currentTime + i * 0.055
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(base, at)
          osc.frequency.exponentialRampToValueAtTime(base * 1.06, at + 0.03)
          const gain = ctx.createGain()
          const level = kind === 'night' ? 0.014 : 0.008
          gain.gain.setValueAtTime(0.0001, at)
          gain.gain.exponentialRampToValueAtTime(level, at + 0.008)
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.042)
          osc.connect(gain)
          gain.connect(pan)
          osc.start(at)
          osc.stop(at + 0.06)
        }
        window.setTimeout(() => pan.disconnect(), pulses * 60 + 200)
      }
      this.scheduleCrickets(kind)
    }, delay)
  }

  playHeartbeat(): number {
    const bpm = 62 + Math.floor(Math.random() * 17)
    if (!this.ctx || !this.sfxBus || this.muted || !this.active) return bpm
    if (this.ctx.state !== 'running') return bpm
    const ctx = this.ctx
    const bus = this.sfxBus
    const start = ctx.currentTime + 0.02
    const thump = (at: number, freq: number, level: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, at)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.58, at + 0.2)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(level, at + 0.014)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34)
      osc.connect(gain)
      gain.connect(bus)
      osc.start(at)
      osc.stop(at + 0.36)
    }

    const lubFreq = 50 + Math.random() * 10
    const dubFreq = 43 + Math.random() * 8
    const dubDelay = 0.24 + Math.random() * 0.06
    thump(start, lubFreq, 0.4)
    thump(start + dubDelay, dubFreq, 0.24)

    // Layer 2 soft random pentatonic harmonic overtones
    const scale = [587.33, 659.25, 739.99, 880, 987.77, 1174.66]
    const idxA = Math.floor(Math.random() * scale.length)
    const idxB = (idxA + 1 + Math.floor(Math.random() * (scale.length - 1))) % scale.length
    ;[scale[idxA], scale[idxB]].forEach((freq, i) => {
      const at = start + (i === 0 ? 0.02 : dubDelay)
      const tone = ctx.createOscillator()
      tone.type = 'sine'
      tone.frequency.setValueAtTime(freq, at)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.035 : 0.024, at + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6)
      tone.connect(gain)
      gain.connect(bus)
      tone.start(at)
      tone.stop(at + 1.65)
    })

    return bpm
  }

  async playVoice(dataUrl: string) {
    if (this.disposed) return false
    await this.ensure()
    const ctx = this.ctx
    const bus = this.voiceBus
    if (!ctx || !bus || this.disposed) return false

    try {
      let buffer = this.voiceCache.get(dataUrl)
      if (!buffer) {
        const response = await fetch(dataUrl)
        const raw = await response.arrayBuffer()
        buffer = await ctx.decodeAudioData(raw)
        this.voiceCache.set(dataUrl, buffer)
        if (this.voiceCache.size > 2) {
          const oldest = this.voiceCache.keys().next().value
          if (oldest) this.voiceCache.delete(oldest)
        }
      }
      this.stopVoice()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(bus)
      source.start()
      this.voiceSource = source
      if (this.voiceStopTimer !== null) window.clearTimeout(this.voiceStopTimer)
      this.voiceStopTimer = window.setTimeout(() => {
        this.voiceSource = null
        this.voiceStopTimer = null
      }, buffer.duration * 1000 + 200)
      return true
    } catch {
      return false
    }
  }

  stopVoice() {
    if (this.voiceSource) {
      try {
        this.voiceSource.stop()
      } catch {
        /* already stopped */
      }
      this.voiceSource = null
    }
    if (this.voiceStopTimer !== null) {
      window.clearTimeout(this.voiceStopTimer)
      this.voiceStopTimer = null
    }
  }

  /** 供开发期自检：电台配乐当前是否在跑、推进到第几拍 */
  stationState() {
    return {
      city: this.musicCity,
      running: this.musicTimer !== null,
      step: this.musicStep,
      context: this.ctx?.state ?? 'none',
      gain: this.musicBus?.gain.value ?? 0,
    }
  }

  startStation(city: string) {
    this.musicStation = stationFor(city)
    this.musicCity = city.trim() || null
    this.musicStep = 0
    void this.ensure().then(() => {
      if (!this.ctx || !this.musicBus || !this.musicStation) return
      this.musicNext = this.ctx.currentTime + 0.12
      this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * this.ambienceVolume, this.ctx.currentTime, 0.9)
      this.tuneIn()
      if (this.musicTimer === null) {
        this.musicTimer = window.setInterval(() => this.pumpMusic(), 220)
      }
    })
  }

  stopStation() {
    this.musicStation = null
    this.musicCity = null
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4)
    }
  }

  /** 调台时的一小段带通噪声，像收音机刚对准频率 */
  private tuneIn() {
    const ctx = this.ctx
    const bus = this.musicBus
    if (!ctx || !bus || !this.noise) return
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 5.5
    const at = ctx.currentTime
    filter.frequency.setValueAtTime(520, at)
    filter.frequency.exponentialRampToValueAtTime(2200, at + 0.42)
    filter.frequency.exponentialRampToValueAtTime(760, at + 0.9)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.14)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.05)
    source.connect(filter).connect(gain).connect(bus)
    source.start(at)
    source.stop(at + 1.15)
  }

  private pumpMusic() {
    const ctx = this.ctx
    if (!ctx || !this.musicBus || !this.musicStation) return
    if (ctx.state !== 'running') return
    const station = this.musicStation
    const stepDur = 60 / station.bpm / 2
    let guard = 0
    while (this.musicNext < ctx.currentTime + 0.7 && guard < 24) {
      guard += 1
      if (this.musicStep % 8 === 0) this.playPad(this.musicNext, stepDur * 8, station)
      if (this.musicStep % 2 === 0 && Math.random() < 0.42) this.playPluck(this.musicNext, station)
      this.musicStep += 1
      this.musicNext += stepDur
    }
  }

  private playPad(at: number, duration: number, station: Station) {
    const ctx = this.ctx
    const bus = this.musicBus
    if (!ctx || !bus) return
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = station.cutoff
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(0.2, at + Math.min(1.6, duration * 0.35))
    gain.gain.linearRampToValueAtTime(0.0001, at + duration + 0.6)
    filter.connect(gain).connect(bus)
    for (const [ratio, level] of [[1, 1], [1.5, 0.55], [2, 0.34]] as const) {
      const osc = ctx.createOscillator()
      osc.type = station.pad
      osc.frequency.value = station.root * ratio
      osc.detune.value = (Math.random() - 0.5) * 9
      const mix = ctx.createGain()
      mix.gain.value = level
      osc.connect(mix).connect(filter)
      osc.start(at)
      osc.stop(at + duration + 0.8)
    }
  }

  private playPluck(at: number, station: Station) {
    const ctx = this.ctx
    const bus = this.musicBus
    if (!ctx || !bus) return
    const degree = station.scale[Math.floor(Math.random() * station.scale.length)]
    const octave = Math.random() < 0.32 ? 2 : 1
    const freq = station.root * Math.pow(2, (degree + 12 * (octave - 1)) / 12)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.19, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.1)
    gain.connect(bus)
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + 2.2)
    const shimmer = ctx.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = freq * 2
    const shimmerGain = ctx.createGain()
    shimmerGain.gain.setValueAtTime(0.0001, at)
    shimmerGain.gain.exponentialRampToValueAtTime(0.045, at + 0.03)
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.3)
    shimmer.connect(shimmerGain).connect(bus)
    shimmer.start(at)
    shimmer.stop(at + 1.4)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.settingsUnsubscribe?.()
    this.settingsUnsubscribe = null
    this.clearAccent()
    this.stopVoice()
    this.stopStation()
    const ctx = this.ctx
    const master = this.master
    if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15)
    }
    this.layers.forEach((layer) => {
      layer.sources.forEach((source) => {
        try {
          source.stop(this.now() + 0.4)
        } catch {
          /* already stopped */
        }
      })
    })
    this.layers = []
    if (ctx) {
      window.setTimeout(() => {
        void ctx.close().catch(() => undefined)
      }, 700)
    }
    this.ctx = null
    this.master = null
    this.ambienceBus = null
    this.voiceBus = null
    this.sfxBus = null
    this.musicBus = null
    this.noise = null
    this.voiceCache.clear()
  }
}