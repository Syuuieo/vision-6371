const TUNE_TARGET = 0.71

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function makeNoiseBuffer(ctx: AudioContext, seconds = 4, brown = true) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.4
      } else {
        data[i] = white
      }
    }
  }
  return buffer
}

function makeImpulse(ctx: AudioContext) {
  const seconds = 3.4
  const length = Math.floor(ctx.sampleRate * seconds)
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const decay = Math.pow(1 - i / length, 2.6)
      data[i] = (Math.random() * 2 - 1) * decay
    }
  }
  return impulse
}

export class Soundscape {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: GainNode | null = null
  private sfx: GainNode | null = null
  private reverbSend: GainNode | null = null
  private skimSource: AudioBufferSourceNode | null = null
  private skimGain: GainNode | null = null
  private skimFilter: BiquadFilterNode | null = null
  private skimAmount = 0
  private noise: AudioBuffer | null = null

  private windGain: GainNode | null = null
  private windFilterL: BiquadFilterNode | null = null
  private windFilterR: BiquadFilterNode | null = null
  private staticGain: GainNode | null = null
  private pulseGain: GainNode | null = null
  private rumbleGain: GainNode | null = null
  private rainGain: GainNode | null = null
  private organGain: GainNode | null = null
  private organFilter: BiquadFilterNode | null = null

  private muted = false
  private active = true
  private masterVolume = 1
  private ambienceVolume = 1
  private sfxVolume = 1
  private unlocked = false
  private heartbeatTimer: number | null = null
  private bgmMode: 'off' | 'meadow' | 'descent' | 'core' = 'off'
  private lastBgmMode: 'meadow' | 'descent' | 'core' | null = null
  private bgmTimer: number | null = null
  private bgmStep = 0
  private pendingTimers: number[] = []
  private tuning = 0.5

  get isUnlocked() {
    return this.unlocked
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0
  }

  private later(fn: () => void, ms: number) {
    const timer = window.setTimeout(() => {
      this.pendingTimers = this.pendingTimers.filter((t) => t !== timer)
      fn()
    }, ms)
    this.pendingTimers.push(timer)
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtor) return
      const ctx = new AudioCtor()
      this.ctx = ctx
      this.noise = makeNoiseBuffer(ctx)

      const master = ctx.createGain()
      master.gain.value = 0.0001
      master.connect(ctx.destination)
      this.master = master

      const ambient = ctx.createGain()
      ambient.gain.value = this.active ? 0.95 * this.ambienceVolume : 0.0001
      ambient.connect(master)
      this.ambient = ambient

      const sfx = ctx.createGain()
      sfx.gain.value = 0.9 * this.sfxVolume
      sfx.connect(master)
      this.sfx = sfx

      const reverb = ctx.createConvolver()
      reverb.buffer = makeImpulse(ctx)
      const reverbSend = ctx.createGain()
      reverbSend.gain.value = 0.42
      reverbSend.connect(reverb)
      reverb.connect(master)
      this.reverbSend = reverbSend

      this.buildSkim(ctx, ambient)
      this.buildWind(ctx, ambient)
      this.buildRumble(ctx, ambient)
      this.buildPulse(ctx, ambient)
      this.buildRain(ctx, ambient)
      this.buildOrgan(ctx, ambient)
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* resumed later by the next gesture */
      }
    }

    this.unlocked = true
    const target = this.muted ? 0.0001 : 0.62 * this.masterVolume
    this.master?.gain.setTargetAtTime(target, this.now(), 0.6)
  }

  private buildWind(ctx: AudioContext, ambient: GainNode) {
    if (!this.noise) return
    const windGain = ctx.createGain()
    windGain.gain.value = 0.0001
    windGain.connect(ambient)
    this.windGain = windGain

    const filterL = ctx.createBiquadFilter()
    filterL.type = 'bandpass'
    filterL.frequency.value = 480
    filterL.Q.value = 0.8
    const filterR = ctx.createBiquadFilter()
    filterR.type = 'bandpass'
    filterR.frequency.value = 620
    filterR.Q.value = 1.1
    this.windFilterL = filterL
    this.windFilterR = filterR

    const panL = ctx.createStereoPanner()
    panL.pan.value = -0.55
    const panR = ctx.createStereoPanner()
    panR.pan.value = 0.55

    const sourceL = ctx.createBufferSource()
    sourceL.buffer = this.noise
    sourceL.loop = true
    const sourceR = ctx.createBufferSource()
    sourceR.buffer = this.noise
    sourceR.loop = true

    sourceL.connect(filterL).connect(panL).connect(windGain)
    sourceR.connect(filterR).connect(panR).connect(windGain)
    sourceL.start(0)
    sourceR.start(0.7)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.065
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 150
    lfo.connect(lfoGain)
    lfoGain.connect(filterL.frequency)
    lfoGain.connect(filterR.frequency)
    lfo.start()

    const staticSource = ctx.createBufferSource()
    staticSource.buffer = this.noise
    staticSource.loop = true
    const staticFilter = ctx.createBiquadFilter()
    staticFilter.type = 'highpass'
    staticFilter.frequency.value = 1200
    const staticCeiling = ctx.createBiquadFilter()
    staticCeiling.type = 'lowpass'
    staticCeiling.frequency.value = 3400
    const staticGain = ctx.createGain()
    staticGain.gain.value = 0.0001
    staticSource.connect(staticFilter).connect(staticCeiling).connect(staticGain).connect(ambient)
    staticSource.start(1.1)
    this.staticGain = staticGain
  }

  private buildPulse(ctx: AudioContext, ambient: GainNode) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 36
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    const mod = ctx.createGain()
    mod.gain.value = 0.6
    const tremolo = ctx.createOscillator()
    tremolo.frequency.value = 0.23
    const tremoloGain = ctx.createGain()
    tremoloGain.gain.value = 0.25
    tremolo.connect(tremoloGain)
    tremoloGain.connect(mod.gain)
    osc.connect(mod).connect(gain).connect(ambient)
    osc.start()
    tremolo.start()
    this.pulseGain = gain
  }

  private buildRain(ctx: AudioContext, ambient: GainNode) {
    if (!this.noise) return
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 900
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 5400
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    const mod = ctx.createGain()
    mod.gain.value = 0.8
    source.connect(highpass).connect(lowpass).connect(mod).connect(gain).connect(ambient)
    source.start(1.6)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.09
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain)
    lfoGain.connect(mod.gain)
    lfo.start()
    this.rainGain = gain
  }

  startRain() {
    if (!this.ctx) return
    this.rainGain?.gain.setTargetAtTime(0.14, this.now(), 1.8)
  }

  stopRain() {
    if (!this.ctx) return
    this.rainGain?.gain.setTargetAtTime(0.0001, this.now(), 2.2)
  }

  waterSplash(strength = 1) {
    if (!this.ctx || !this.noise || !this.sfx || !this.reverbSend) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 820 + Math.random() * 1100
    filter.Q.value = 0.85
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16 * strength, t + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 0.9 - 0.45
    source.connect(filter).connect(gain).connect(panner)
    panner.connect(this.sfx)
    panner.connect(this.reverbSend)
    source.start(t)
    source.stop(t + 0.6)

    const plop = ctx.createOscillator()
    plop.type = 'sine'
    plop.frequency.setValueAtTime(420 + Math.random() * 120, t)
    plop.frequency.exponentialRampToValueAtTime(120, t + 0.18)
    const plopGain = ctx.createGain()
    plopGain.gain.setValueAtTime(0.0001, t)
    plopGain.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.01)
    plopGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
    plop.connect(plopGain)
    plopGain.connect(this.sfx)
    plopGain.connect(this.reverbSend)
    plop.start(t)
    plop.stop(t + 0.3)
  }

  constellationNote(index: number) {
    const notes = [392, 523.25, 659.25]
    const note = notes[Math.max(0, Math.min(notes.length - 1, index))]
    this.playChime([note, note * 2.003], 0.07, 2.4)
  }

  meteorChime() {
    this.playChime([783.99, 1046.5, 1318.51, 1567.98], 0.06, 3.2)
  }

  pressureThud() {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 0.02
    this.thump(t, 62, 0.16)
    this.thump(t + 0.2, 48, 0.11)
  }

  private buildRumble(ctx: AudioContext, ambient: GainNode) {
    if (!this.noise) return
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 110
    lowpass.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    source.connect(lowpass).connect(gain).connect(ambient)
    source.start(2.2)
    this.rumbleGain = gain
  }

  private buildOrgan(ctx: AudioContext, ambient: GainNode) {
    const organFilter = ctx.createBiquadFilter()
    organFilter.type = 'lowpass'
    organFilter.frequency.value = 480
    organFilter.Q.value = 0.7

    const organGain = ctx.createGain()
    organGain.gain.value = 0.0001

    organFilter.connect(organGain)
    organGain.connect(ambient)
    if (this.reverbSend) organGain.connect(this.reverbSend)

    const voices: [OscillatorType, number, number][] = [
      ['triangle', 110, 0.5],
      ['sawtooth', 164.81, 0.25],
      ['triangle', 220.4, 0.45],
    ]
    for (const [type, freq, weight] of voices) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const trim = ctx.createGain()
      trim.gain.value = weight
      osc.connect(trim).connect(organFilter)
      osc.start()
    }

    this.organFilter = organFilter
    this.organGain = organGain
  }

  private playPianoNote(freq: number, level: number, duration = 1.1) {
    if (!this.ctx || !this.ambient || !this.reverbSend || this.muted || !this.active) return
    const ctx = this.ctx
    const attack = ctx.currentTime + 0.015

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, attack)
    gain.gain.exponentialRampToValueAtTime(level, attack + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, attack + duration)

    const tone = ctx.createOscillator()
    tone.type = 'sine'
    tone.frequency.value = freq

    const overtone = ctx.createOscillator()
    overtone.type = 'triangle'
    overtone.frequency.value = freq * 2.002
    const overtoneGain = ctx.createGain()
    overtoneGain.gain.value = 0.16

    tone.connect(gain)
    overtone.connect(overtoneGain).connect(gain)
    gain.connect(this.ambient)
    gain.connect(this.reverbSend)

    tone.start(attack)
    overtone.start(attack)
    tone.stop(attack + duration + 0.08)
    overtone.stop(attack + duration + 0.08)
  }

  startBgm(mode: 'meadow' | 'descent' | 'core') {
    this.lastBgmMode = mode
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
    this.bgmMode = mode
    this.bgmStep = 0
    if (!this.ctx) return

    const t = this.now()
    if (mode === 'meadow') {
      this.organFilter?.frequency.setTargetAtTime(460, t, 0.8)
      this.organGain?.gain.setTargetAtTime(0.045, t, 1.1)
    } else if (mode === 'descent') {
      this.organFilter?.frequency.setTargetAtTime(1350, t, 0.9)
      this.organGain?.gain.setTargetAtTime(0.19, t, 0.8)
    } else {
      this.organFilter?.frequency.setTargetAtTime(520, t, 1.0)
      this.organGain?.gain.setTargetAtTime(0.08, t, 1.2)
    }

    const pattern = [
      440, 659.25, 440, 659.25,
      349.23, 523.25, 349.23, 523.25,
      392, 587.33, 392, 587.33,
      329.63, 493.88, 329.63, 493.88,
    ]
    const intervalMs = mode === 'descent' ? 280 : mode === 'meadow' ? 560 : 780

    const tick = () => {
      if (!this.ctx || !this.active || this.bgmMode !== mode) return
      const freq = pattern[this.bgmStep % pattern.length]
      this.bgmStep += 1
      if (mode === 'descent') {
        this.playPianoNote(freq, 0.055, 0.95)
        this.playPianoNote(freq * 2, 0.02, 0.8)
      } else if (mode === 'meadow') {
        this.playPianoNote(freq, 0.036, 1.1)
      } else {
        this.playPianoNote(freq, 0.042, 1.35)
      }
    }

    tick()
    this.bgmTimer = window.setInterval(tick, intervalMs)
  }

  stopBgm() {
    this.bgmMode = 'off'
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
    if (this.ctx) {
      this.organGain?.gain.setTargetAtTime(0.0001, this.now(), 0.5)
    }
  }

  skyCall() {
    if (!this.ctx) return
    const scale = [587.33, 659.25, 739.99, 880, 987.77, 1174.66]
    const start = Math.floor(Math.random() * 4)
    this.playChime(scale.slice(start, start + 3), 0.09, 3.8)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0.0001 : 0.62 * this.masterVolume, this.now(), 0.25)
    }
  }

  setMasterVolume(value: number) {
    this.masterVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.62 * this.masterVolume, this.now(), 0.25)
    }
  }

  setAmbienceVolume(value: number) {
    this.ambienceVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    if (this.ambient && this.ctx) {
      this.ambient.gain.setTargetAtTime(this.active ? 0.95 * this.ambienceVolume : 0.0001, this.now(), 0.25)
    }
  }

  setSfxVolume(value: number) {
    this.sfxVolume = Number.isFinite(value) ? clamp(value, 0, 1) : 1
    if (this.sfx && this.ctx) {
      this.sfx.gain.setTargetAtTime(0.9 * this.sfxVolume, this.now(), 0.25)
    }
  }

  setActive(active: boolean) {
    this.active = active
    if (this.ambient && this.ctx) {
      this.ambient.gain.setTargetAtTime(active ? 0.95 * this.ambienceVolume : 0.0001, this.now(), 0.8)
    }
    if (!active) {
      this.stopHeartbeat()
      this.stopBgm()
    } else if (this.unlocked && this.lastBgmMode && this.bgmMode === 'off') {
      this.startBgm(this.lastBgmMode)
    }
  }

  enterGrassland() {
    if (!this.ctx) return
    const t = this.now()
    this.windGain?.gain.setTargetAtTime(0.42, t, 1.6)
    this.staticGain?.gain.setTargetAtTime(0.09, t, 1.2)
    this.windFilterL?.frequency.setTargetAtTime(420, t, 1.4)
    this.windFilterR?.frequency.setTargetAtTime(540, t, 1.4)
    this.playChime([329.63, 493.88, 659.25], 0.07, 4.2)
    this.startBgm('meadow')
  }

  setTuning(value: number) {
    this.tuning = clamp(value, 0, 1)
    if (!this.ctx) return
    const t = this.now()
    const closeness = clamp(1 - Math.abs(this.tuning - TUNE_TARGET) / 0.3, 0, 1)
    this.staticGain?.gain.setTargetAtTime(0.09 * (1 - closeness * 0.92), t, 0.1)
    this.windFilterL?.frequency.setTargetAtTime(320 + 980 * this.tuning, t, 0.09)
    this.windFilterR?.frequency.setTargetAtTime(380 + 1180 * this.tuning, t, 0.09)
    this.windGain?.gain.setTargetAtTime(0.38 + 0.18 * closeness, t, 0.18)
  }

  lockWind() {
    if (!this.ctx) return
    const t = this.now()
    this.staticGain?.gain.setTargetAtTime(0.0001, t, 0.55)
    this.windFilterL?.frequency.setTargetAtTime(1280, t, 0.7)
    this.windFilterR?.frequency.setTargetAtTime(1520, t, 0.7)
    this.windFilterL?.Q.setTargetAtTime(1.6, t, 0.6)
    this.windFilterR?.Q.setTargetAtTime(1.8, t, 0.6)
    this.windGain?.gain.setTargetAtTime(0.64, t, 0.9)
    this.playChime([523.25, 659.25, 783.99, 1046.5], 0.1, 3.6)
  }

  playChime(freqs: number[] = [523.25, 659.25, 783.99], level = 0.12, duration = 3.4) {
    if (!this.ctx || !this.sfx || !this.reverbSend) return
    const ctx = this.ctx
    const sfx = this.sfx
    const reverbSend = this.reverbSend
    const t0 = ctx.currentTime + 0.03
    freqs.forEach((freq, index) => {
      const attack = t0 + index * 0.07
      const gain = ctx.createGain()
      const peak = level / (1 + index * 0.55)
      gain.gain.setValueAtTime(0.0001, attack)
      gain.gain.exponentialRampToValueAtTime(peak, attack + 0.07)
      gain.gain.exponentialRampToValueAtTime(0.0001, attack + duration)

      const tone = ctx.createOscillator()
      tone.type = 'sine'
      tone.frequency.value = freq

      const shimmer = ctx.createOscillator()
      shimmer.type = 'triangle'
      shimmer.frequency.value = freq * 2.006
      const shimmerGain = ctx.createGain()
      shimmerGain.gain.value = 0.22 * clamp(760 / freq, 0.22, 1)

      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = Math.min(3000, freq * 3)

      tone.connect(gain)
      shimmer.connect(shimmerGain).connect(gain)
      gain.connect(lowpass)
      lowpass.connect(sfx)
      lowpass.connect(reverbSend)
      tone.start(attack)
      shimmer.start(attack)
      tone.stop(attack + duration + 0.1)
      shimmer.stop(attack + duration + 0.1)
    })
  }

  staticBurst() {
    if (!this.ctx || !this.noise || !this.sfx || !this.reverbSend) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 900
    const ceiling = ctx.createBiquadFilter()
    ceiling.type = 'lowpass'
    ceiling.frequency.value = 3200
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5)
    source.connect(highpass).connect(ceiling).connect(gain)
    gain.connect(this.sfx)
    gain.connect(this.reverbSend)
    source.start(t)
    source.stop(t + 1.6)
  }

  private thump(when: number, freq: number, level: number) {
    if (!this.ctx || !this.ambient || !this.reverbSend) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, when)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, when + 0.26)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(level, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.34)
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 240
    osc.connect(gain).connect(lowpass)
    lowpass.connect(this.ambient)
    lowpass.connect(this.reverbSend)
    osc.start(when)
    osc.stop(when + 0.4)
  }

  startHeartbeat() {
    if (!this.ctx || this.heartbeatTimer !== null) return
    const beat = () => {
      if (!this.ctx) return
      const t = this.ctx.currentTime
      this.thump(t, 58, 0.2)
      this.thump(t + 0.27, 46, 0.13)
    }
    beat()
    this.heartbeatTimer = window.setInterval(beat, 1500)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  descentStart() {
    if (!this.ctx) return
    const t = this.now()
    this.rumbleGain?.gain.setTargetAtTime(0.58, t, 1.1)
    this.rumbleGain?.gain.setTargetAtTime(0.16, t + 3.2, 2.4)
    this.rumbleGain?.gain.setTargetAtTime(0.0001, t + 8.4, 1.2)
    this.pulseGain?.gain.setTargetAtTime(0.16, t, 2.2)
    this.windGain?.gain.setTargetAtTime(0.0001, t, 0.5)
    this.staticGain?.gain.setTargetAtTime(0.0001, t, 0.4)
    this.playChime([196, 261.63, 329.63, 392], 0.07, 5.2)
    this.startBgm('descent')
    this.later(() => this.startHeartbeat(), 3600)
    this.later(() => this.staticBurst(), 2200)
  }

  arrive() {
    if (!this.ctx) return
    this.pulseGain?.gain.setTargetAtTime(0.1, this.now(), 2)
    this.playChime([130.81, 164.81, 196, 261.63], 0.08, 6.5)
    this.startBgm('core')
  }

  resetAtmosphere() {
    if (!this.ctx) return
    const t = this.now()
    this.rumbleGain?.gain.setTargetAtTime(0.0001, t, 0.6)
    this.pulseGain?.gain.setTargetAtTime(0.0001, t, 0.6)
    this.staticGain?.gain.setTargetAtTime(0.0001, t, 0.6)
    this.windGain?.gain.setTargetAtTime(0.0001, t, 0.6)
    this.rainGain?.gain.setTargetAtTime(0.0001, t, 0.8)
    this.stopHeartbeat()
    this.stopBgm()
    this.lastBgmMode = null
  }

  /** Paul Kellet 七阶粉红噪声：比白噪声更接近草叶摩擦的频谱 */
  private makePinkBuffer(ctx: AudioContext, seconds = 3) {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
    return buffer
  }

  private buildSkim(ctx: AudioContext, bus: GainNode) {
    const source = ctx.createBufferSource()
    source.buffer = this.makePinkBuffer(ctx)
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2600
    filter.Q.value = 0.9
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 1500
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    source.connect(filter).connect(highpass).connect(gain).connect(bus)
    source.start()
    this.skimSource = source
    this.skimGain = gain
    this.skimFilter = filter
    this.applySkim(0.3)
  }

  /** 0 = 完全静止，1 = 正在草尖上划过 */
  setGrassSkim(amount: number) {
    this.skimAmount = clamp(amount, 0, 1)
    this.applySkim(0.25)
  }

  private applySkim(smoothing: number) {
    if (!this.skimGain || !this.ctx) return
    const target = this.muted || !this.active ? 0.0001 : Math.max(0.0001, this.skimAmount * 0.12)
    this.skimGain.gain.setTargetAtTime(target, this.now(), smoothing)
    if (this.skimFilter) {
      this.skimFilter.frequency.setTargetAtTime(2100 + this.skimAmount * 1500, this.now(), smoothing)
    }
  }

  dispose() {
    try {
      this.skimSource?.stop()
    } catch {
      /* already stopped */
    }
    this.skimSource = null
    this.skimGain = null
    this.skimFilter = null
    this.stopHeartbeat()
    this.stopBgm()
    this.pendingTimers.forEach((timer) => window.clearTimeout(timer))
    this.pendingTimers = []
    if (this.ctx) {
      const ctx = this.ctx
      this.ctx = null
      void ctx.close().catch(() => undefined)
    }
    this.master = null
    this.ambient = null
    this.sfx = null
    this.reverbSend = null
    this.windGain = null
    this.staticGain = null
    this.pulseGain = null
    this.rumbleGain = null
    this.rainGain = null
    this.organGain = null
    this.organFilter = null
    this.lastBgmMode = null
    this.unlocked = false
  }
}
