/**
 * 序章开放草原轻音乐生成引擎（纯 Web Audio 合成，零外部音频资源依赖）。
 *
 * - 提供三套风格迥异的 8 小节和声套曲：
 *   1. `breeze`   《晨风白键》— 温暖毛毡钢琴 + 柔和弦乐长音（F大调 / D小调 add9）
 *   2. `kalimba`  《白桦风铃》— 清澈拇指琴与竖琴泛音（G大调 / D Lydian）
 *   3. `nocturne` 《星湖夜曲》— 柔音电钢与夜色大提琴衬底（Eb大调 / C小调 9）
 * - 支持 `auto` 随 24 小时天色在乐句边界自然切曲、移动迎风微光装饰音、坐椅静思放缓节奏，
 *   以及林微语音播报时的自动平滑闪避（Voice Ducking）。
 */

export type RoamMusicSuiteId = 'breeze' | 'kalimba' | 'nocturne'
export type RoamMusicPreference = 'auto' | RoamMusicSuiteId | 'off'

export interface RoamMusicTrackMeta {
  id: RoamMusicSuiteId
  title: string
  subtitle: string
  tempoMs: number
}

export const ROAM_MUSIC_TRACKS: readonly RoamMusicTrackMeta[] = [
  {
    id: 'breeze',
    title: '晨风白键',
    subtitle: '毛毡钢琴 · 晨雾与微风',
    tempoMs: 410,
  },
  {
    id: 'kalimba',
    title: '白桦风铃',
    subtitle: '拇指琴与竖琴 · 午后林荫',
    tempoMs: 375,
  },
  {
    id: 'nocturne',
    title: '星湖夜曲',
    subtitle: '柔音电钢 · 暮色与银河',
    tempoMs: 465,
  },
] as const

export const ROAM_MUSIC_CYCLE: readonly RoamMusicPreference[] = [
  'auto',
  'breeze',
  'kalimba',
  'nocturne',
  'off',
] as const

export function resolveTrackForHour(hour: number): RoamMusicSuiteId {
  const h = ((hour % 24) + 24) % 24
  if (h >= 5 && h < 11.5) return 'breeze'
  if (h >= 11.5 && h < 17.5) return 'kalimba'
  return 'nocturne'
}

export function getRoamTrackMeta(id: RoamMusicSuiteId): RoamMusicTrackMeta {
  return ROAM_MUSIC_TRACKS.find((item) => item.id === id) ?? ROAM_MUSIC_TRACKS[0]
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

interface ChordBar {
  /** 低音与左手分解和弦 MIDI 音高（4 个音） */
  arp: readonly [number, number, number, number]
  /** 缓入衬底长音 MIDI 音高（3 个音） */
  pad: readonly [number, number, number]
  /** 匹配此小节的右手抒情音阶池 */
  melodyPool: readonly number[]
}

const SUITE_PROGRESSIONS: Record<RoamMusicSuiteId, readonly ChordBar[]> = {
  // 《晨风白键》 Fmaj9 -> Cadd9/E -> Dm9 -> Bbmaj7 -> Gm9 -> C11 -> Am7 -> Dm9
  breeze: [
    { arp: [41, 48, 55, 57], pad: [53, 60, 64], melodyPool: [65, 67, 69, 72, 74, 76] },
    { arp: [40, 48, 55, 62], pad: [52, 60, 62], melodyPool: [67, 69, 72, 74, 76, 79] },
    { arp: [38, 45, 52, 53], pad: [50, 57, 64], melodyPool: [65, 67, 69, 72, 74, 76] },
    { arp: [46, 53, 57, 62], pad: [46, 57, 62], melodyPool: [65, 69, 70, 72, 74, 77] },
    { arp: [43, 50, 57, 58], pad: [50, 55, 62], melodyPool: [65, 67, 69, 70, 74, 77] },
    { arp: [36, 48, 55, 58], pad: [48, 55, 62], melodyPool: [65, 67, 69, 72, 74, 76] },
    { arp: [45, 52, 55, 60], pad: [52, 57, 64], melodyPool: [67, 69, 72, 74, 76, 79] },
    { arp: [38, 45, 52, 57], pad: [50, 57, 60], melodyPool: [64, 65, 69, 72, 74, 76] },
  ],
  // 《白桦风铃》 Gmaj9 -> A6/G -> F#m7 -> Bm9 -> Em9 -> A9sus4 -> Dmaj9 -> Dsus2
  kalimba: [
    { arp: [43, 50, 57, 59], pad: [55, 62, 66], melodyPool: [67, 69, 71, 74, 76, 78] },
    { arp: [43, 52, 57, 61], pad: [55, 61, 64], melodyPool: [69, 71, 73, 76, 78, 81] },
    { arp: [42, 49, 52, 57], pad: [54, 61, 64], melodyPool: [66, 69, 71, 73, 76, 78] },
    { arp: [47, 54, 61, 62], pad: [54, 59, 66], melodyPool: [69, 71, 73, 74, 78, 81] },
    { arp: [40, 47, 54, 55], pad: [52, 59, 66], melodyPool: [67, 69, 71, 74, 76, 79] },
    { arp: [45, 52, 55, 59], pad: [52, 57, 62], melodyPool: [67, 69, 71, 74, 76, 79] },
    { arp: [38, 45, 52, 54], pad: [50, 57, 61], melodyPool: [66, 69, 71, 73, 74, 78] },
    { arp: [38, 45, 52, 57], pad: [50, 57, 64], melodyPool: [66, 69, 71, 74, 76, 81] },
  ],
  // 《星湖夜曲》 Cm9 -> Abmaj9 -> Ebmaj9 -> Bb6/9 -> Fm9 -> Eb/G -> Abmaj7#11 -> Gsus4
  nocturne: [
    { arp: [36, 43, 50, 51], pad: [48, 55, 62], melodyPool: [63, 65, 67, 70, 72, 74] },
    { arp: [44, 51, 58, 60], pad: [51, 56, 63], melodyPool: [63, 67, 68, 70, 72, 75] },
    { arp: [39, 46, 53, 55], pad: [51, 58, 62], melodyPool: [65, 67, 70, 72, 74, 77] },
    { arp: [46, 53, 55, 60], pad: [46, 55, 62], melodyPool: [62, 65, 67, 70, 72, 74] },
    { arp: [41, 48, 55, 56], pad: [48, 53, 60], melodyPool: [63, 65, 67, 68, 72, 75] },
    { arp: [43, 51, 58, 62], pad: [51, 55, 62], melodyPool: [65, 67, 70, 72, 74, 75] },
    { arp: [44, 51, 55, 62], pad: [48, 55, 63], melodyPool: [63, 67, 70, 72, 74, 79] },
    { arp: [43, 50, 53, 60], pad: [47, 55, 62], melodyPool: [62, 65, 67, 70, 72, 74] },
  ],
}

// 两组左手分解形态与三组右手留白抒情节奏（null 代表呼吸休止）
const ARP_PATTERNS: readonly (readonly (number | null)[])[] = [
  [0, 1, 2, 3, 2, 1, 3, null],
  [0, 2, 3, 1, 2, null, 3, 2],
]

const MELODY_CONTOURS: readonly (readonly (number | null)[])[] = [
  [2, null, 4, 3, null, 1, null, null],
  [3, null, 5, null, 4, 2, 1, null],
  [1, 2, null, 4, null, 3, null, 2],
]

export class RoamMusicEngine {
  private ctx: AudioContext | null = null
  private musicGain: GainNode | null = null
  private musicReverbSend: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private running = false
  private timer: number | null = null
  private stepIndex = 0
  private barIndex = 0
  private phraseCycle = 0

  private preference: RoamMusicPreference = 'auto'
  private activeSuite: RoamMusicSuiteId = 'breeze'
  private pendingSuite: RoamMusicSuiteId = 'breeze'
  private hour = 9.5

  private basePresence = 0.72
  private volumeScale = 1
  private duckFactor = 1
  private speedNorm = 0
  private seated = false

  attach(ctx: AudioContext, outputBus: GainNode, reverbSend: GainNode, noiseBuffer: AudioBuffer | null) {
    this.ctx = ctx
    this.noiseBuffer = noiseBuffer

    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.connect(outputBus)

    const revSend = ctx.createGain()
    revSend.gain.value = 0.58
    gain.connect(revSend)
    revSend.connect(reverbSend)

    this.musicGain = gain
    this.musicReverbSend = revSend
    this.applyGain(0.4)
  }

  setVolumeScale(scale: number, smoothing = 0.25) {
    this.volumeScale = clamp(scale, 0, 1)
    this.applyGain(smoothing)
  }

  setPreference(pref: RoamMusicPreference) {
    this.preference = pref
    if (pref === 'off') {
      this.stop()
      return
    }
    const target = pref === 'auto' ? resolveTrackForHour(this.hour) : pref
    this.pendingSuite = target
    if (!this.running) {
      this.activeSuite = target
    } else if (pref !== 'auto' && this.activeSuite !== target) {
      // 用户手动切曲时立即在下个节拍平滑切入，不需等完整小节
      this.activeSuite = target
      this.barIndex = 0
      this.stepIndex = 0
    }
    this.applyGain(0.6)
  }

  getPreference(): RoamMusicPreference {
    return this.preference
  }

  getActiveSuite(): RoamMusicSuiteId {
    return this.activeSuite
  }

  setTimeHour(hour: number) {
    this.hour = ((hour % 24) + 24) % 24
    if (this.preference === 'auto') {
      this.pendingSuite = resolveTrackForHour(this.hour)
    }
  }

  /** 控制自由漫游 / 剧情探索中的存在感（0..1） */
  setPresence(level: number, smoothing = 1.1) {
    this.basePresence = clamp(level, 0, 1)
    this.applyGain(smoothing)
  }

  /** 语音播报或对话卡开启时平滑闪避（ducked = true 时压低至 24%） */
  setDucked(ducked: boolean) {
    this.duckFactor = ducked ? 0.24 : 1
    this.applyGain(ducked ? 0.32 : 1.15)
  }

  setMotionContext(speedNorm: number, seated: boolean) {
    this.speedNorm = clamp(speedNorm, 0, 1)
    this.seated = seated
  }

  start() {
    if (this.preference === 'off' || !this.ctx || !this.musicGain) return
    const target = this.preference === 'auto' ? resolveTrackForHour(this.hour) : this.preference
    this.activeSuite = target
    this.pendingSuite = target

    if (this.running) {
      this.applyGain(0.9)
      return
    }
    this.running = true
    this.stepIndex = 0
    this.barIndex = 0
    this.applyGain(1.2)
    this.scheduleNext(260)
  }

  stop(fadeSeconds = 0.7) {
    this.running = false
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fadeSeconds)
    }
  }

  dispose() {
    this.stop(0.1)
    this.musicReverbSend?.disconnect()
    this.musicReverbSend = null
    this.musicGain?.disconnect()
    this.musicGain = null
    this.ctx = null
    this.noiseBuffer = null
  }

  private applyGain(smoothing: number) {
    if (!this.ctx || !this.musicGain) return
    const activeGain =
      !this.running || this.preference === 'off'
        ? 0.0001
        : Math.max(0.0001, this.basePresence * this.duckFactor * this.volumeScale * 0.92)
    this.musicGain.gain.setTargetAtTime(activeGain, this.ctx.currentTime, smoothing)
  }

  private scheduleNext(delayMs: number) {
    if (!this.running) return
    this.timer = window.setTimeout(() => {
      this.timer = null
      if (!this.running || !this.ctx) return
      this.playStep()
      const meta = getRoamTrackMeta(this.activeSuite)
      const relaxFactor = this.seated ? 1.09 : 1 - this.speedNorm * 0.05
      const rubato = (Math.random() - 0.5) * 26
      this.scheduleNext(Math.max(260, meta.tempoMs * relaxFactor + rubato))
    }, delayMs)
  }

  private playStep() {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return

    const stepInBar = this.stepIndex % 8
    if (stepInBar === 0 && this.pendingSuite !== this.activeSuite) {
      this.activeSuite = this.pendingSuite
      this.barIndex = 0
    }

    const progression = SUITE_PROGRESSIONS[this.activeSuite]
    const bar = progression[this.barIndex % progression.length]
    const t = ctx.currentTime + 0.025

    // 1. 小节起始：温和铺底和弦长音（每小节呼吸式交叉淡入）
    if (stepInBar === 0) {
      const padLevel = this.seated ? 0.044 : 0.032
      this.playWarmPadChord(bar.pad, padLevel, this.seated ? 4.4 : 3.7, t)
    }

    // 2. 左手分解伴奏
    const arpPattern = ARP_PATTERNS[(this.barIndex + this.phraseCycle) % ARP_PATTERNS.length]
    const arpSlot = arpPattern[stepInBar]
    if (arpSlot !== null) {
      const midi = bar.arp[arpSlot]
      const vel = stepInBar === 0 ? 0.76 : 0.44 + Math.random() * 0.14
      this.triggerVoice(midi, vel * 0.095, stepInBar === 0 ? 2.6 : 1.7, t, -0.22 + arpSlot * 0.1)
    }

    // 3. 右手抒情主旋律（第 4、8 小节尾拍留白呼吸）
    const isBreathingTail = this.barIndex % 4 === 3 && stepInBar >= 5
    if (!isBreathingTail) {
      const contour = MELODY_CONTOURS[(this.barIndex + this.phraseCycle) % MELODY_CONTOURS.length]
      const noteIdx = contour[stepInBar]
      if (noteIdx !== null) {
        const idx = clamp(noteIdx + (this.phraseCycle % 2 === 1 && stepInBar === 2 ? 1 : 0), 0, bar.melodyPool.length - 1)
        const melodyMidi = bar.melodyPool[idx]
        const vel = stepInBar === 0 ? 0.84 : 0.56 + Math.random() * 0.18
        const pan = clamp(((melodyMidi - 66) / 20) * 0.36, -0.25, 0.38)
        this.triggerVoice(melodyMidi, vel * 0.115, 2.5, t + 0.01, pan)

        // 迎风滑步时偶发高八度风铃泛音点缀
        if (this.speedNorm > 0.38 && stepInBar === 2 && Math.random() < 0.55) {
          this.playSparkleHarmonic(melodyMidi + 12, 0.036 * this.speedNorm, t + 0.09)
        }
      }
    }

    this.stepIndex += 1
    if (this.stepIndex % 8 === 0) {
      this.barIndex += 1
      if (this.barIndex % progression.length === 0) {
        this.phraseCycle += 1
      }
    }
  }

  private triggerVoice(midi: number, level: number, duration: number, startAt: number, pan: number) {
    if (this.activeSuite === 'kalimba') {
      this.playKalimbaHarp(midi, level, duration, startAt, pan)
    } else if (this.activeSuite === 'nocturne') {
      this.playNocturneEp(midi, level, duration * 1.15, startAt, pan)
    } else {
      this.playFeltPiano(midi, level, duration, startAt, pan)
    }
  }

  /** 温暖毛毡钢琴：基音 + 柔化二三次泛音 + 力度随动低通包络 + 极轻琴槌毛毡瞬态 */
  private playFeltPiano(midi: number, level: number, duration: number, t: number, pan: number) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const freq = midiToFreq(midi)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    const bright = clamp(freq * 2.4 + level * 7500 + this.speedNorm * 420, 640, 2900)
    filter.frequency.setValueAtTime(bright, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 1.45), t + duration * 0.85)
    filter.Q.value = 0.55

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level, t + 0.024)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * 0.42), t + 0.42)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    const panner = ctx.createStereoPanner()
    panner.pan.value = clamp(pan, -0.5, 0.5)

    const f1 = ctx.createOscillator()
    f1.type = 'sine'
    f1.frequency.value = freq

    const f2 = ctx.createOscillator()
    f2.type = 'triangle'
    f2.frequency.value = freq * 2.0014
    const g2 = ctx.createGain()
    g2.gain.value = 0.17

    const f3 = ctx.createOscillator()
    f3.type = 'sine'
    f3.frequency.value = freq * 3.003
    const g3 = ctx.createGain()
    g3.gain.value = 0.042

    f1.connect(filter)
    f2.connect(g2).connect(filter)
    f3.connect(g3).connect(filter)
    filter.connect(env).connect(panner)

    panner.connect(this.musicGain)

    // 极轻毛毡击弦气声
    if (this.noiseBuffer && level > 0.05) {
      const thump = ctx.createBufferSource()
      thump.buffer = this.noiseBuffer
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = clamp(freq * 1.2, 260, 1200)
      bp.Q.value = 1.4
      const tg = ctx.createGain()
      tg.gain.setValueAtTime(0.0001, t)
      tg.gain.exponentialRampToValueAtTime(level * 0.18, t + 0.008)
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.036)
      thump.connect(bp).connect(tg).connect(panner)
      thump.start(t, Math.random() * 1.5, 0.045)
    }

    f1.start(t)
    f2.start(t)
    f3.start(t)
    const stopAt = t + duration + 0.08
    f1.stop(stopAt)
    f2.stop(stopAt)
    f3.stop(stopAt)
  }

  /** 清澈拇指琴 / 竖琴：木质基音 + 快速衰减金属风铃非谐泛音 */
  private playKalimbaHarp(midi: number, level: number, duration: number, t: number, pan: number) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const freq = midiToFreq(midi)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level * 0.95, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.92)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(3600, freq * 4.2)

    const panner = ctx.createStereoPanner()
    panner.pan.value = clamp(pan * 1.15, -0.55, 0.55)

    const body = ctx.createOscillator()
    body.type = 'sine'
    body.frequency.value = freq

    const tine = ctx.createOscillator()
    tine.type = 'sine'
    tine.frequency.value = freq * 2.756
    const tineEnv = ctx.createGain()
    tineEnv.gain.setValueAtTime(0.0001, t)
    tineEnv.gain.exponentialRampToValueAtTime(level * 0.24, t + 0.006)
    tineEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)

    const octave = ctx.createOscillator()
    octave.type = 'triangle'
    octave.frequency.value = freq * 2
    const octGain = ctx.createGain()
    octGain.gain.value = 0.11

    body.connect(env)
    octave.connect(octGain).connect(env)
    tine.connect(tineEnv).connect(filter)
    env.connect(filter).connect(panner)

    panner.connect(this.musicGain)

    body.start(t)
    octave.start(t)
    tine.start(t)
    const stopAt = t + duration + 0.08
    body.stop(stopAt)
    octave.stop(stopAt)
    tine.stop(t + 0.32)
  }

  /** 夜色柔音电钢（Rhodes 质感 + 细腻颤音） */
  private playNocturneEp(midi: number, level: number, duration: number, t: number, pan: number) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const freq = midiToFreq(midi)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(Math.min(1850, freq * 2.8), t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 1.35), t + duration)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level * 0.9, t + 0.036)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    const trem = ctx.createGain()
    trem.gain.value = 0.9
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 3.8
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.09
    lfo.connect(lfoDepth).connect(trem.gain)

    const panner = ctx.createStereoPanner()
    panner.pan.value = clamp(pan, -0.45, 0.45)

    const o1 = ctx.createOscillator()
    o1.type = 'sine'
    o1.frequency.value = freq

    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = freq * 2
    const g2 = ctx.createGain()
    g2.gain.value = 0.12

    o1.connect(filter)
    o2.connect(g2).connect(filter)
    filter.connect(trem).connect(env).connect(panner)

    panner.connect(this.musicGain)

    o1.start(t)
    o2.start(t)
    lfo.start(t)
    const stopAt = t + duration + 0.1
    o1.stop(stopAt)
    o2.stop(stopAt)
    lfo.stop(stopAt)
  }

  /** 每小节轻柔呼吸弦乐 / 玻璃长音垫底 */
  private playWarmPadChord(midis: readonly number[], level: number, duration: number, t: number) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = this.activeSuite === 'nocturne' ? 620 : 780
    filter.Q.value = 0.5

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(level, t + 1.15)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    filter.connect(env)
    env.connect(this.musicGain)

    const perVoice = 1 / Math.max(1, midis.length)
    for (const midi of midis) {
      const freq = midiToFreq(midi)
      for (const detune of [-4.5, 4.5]) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        osc.detune.value = detune
        const vg = ctx.createGain()
        vg.gain.value = perVoice * 0.48
        osc.connect(vg).connect(filter)
        osc.start(t)
        osc.stop(t + duration + 0.12)
      }
    }
  }

  /** 迎风滑步偶发高音泛音点缀 */
  private playSparkleHarmonic(midi: number, level: number, t: number) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = midiToFreq(midi)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level, t + 0.03)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
    const pan = ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 0.7
    osc.connect(env).connect(pan)
    pan.connect(this.musicGain)
    osc.start(t)
    osc.stop(t + 1.9)
  }
}
