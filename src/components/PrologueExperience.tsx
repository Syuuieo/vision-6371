import { useCallback, useEffect, useRef, useState } from 'react'
import type { Soundscape } from '../audio/soundscape'
import { type VoiceMode, useVoiceState, voicePlayer } from '../audio/voicePlayer'
import {
  DESCENT_CAPTIONS,
  EASTER_EGGS,
  FINAL_CAPTION,
  FINAL_LINES,
  INTRO_CALL_BEATS,
  QUOTES,
  STEPS,
  TRUTH,
} from '../data/narrative'
import { PrologueScene, type HoverTargetInfo } from '../scenes/PrologueScene'
import { LandscapeHint, TouchControls } from './TouchControls'
import { getSettings, isCoarsePointer, prefersReducedMotion, subscribeSettings, updateSettings, type QualityTier } from '../services/settings'
import {
  dailyEcho,
  markActSeen,
  markEggFound,
  markEchoRead,
  todayKey,
  useJourney,
} from '../services/journey'
import type {
  ActId,
  CollectionId,
  DescentEvent,
  DialogueChoice,
  EasterEggMeta,
  EggId,
  ModuleId,
  PanelKind,
  Phase,
  PickId,
  PrologueQuote,
  QuoteKey,
  SensorReadings,
  SkyStage,
} from '../types/sensor'
import { exportMemoryFilmstrip, type MemoryFrame } from '../utils/memoryStripExport'
import type { StoryRelayState } from '../utils/storyRelay'
import { CalibrationDial } from './CalibrationDial'
import { FieldJournalModal } from './FieldJournalModal'
import { IntroRitual } from './IntroRitual'
import { SensorHud } from './SensorHud'

interface PrologueExperienceProps {
  sound: Soundscape
  active: boolean
  onNavigate: (module: ModuleId) => void
  relay?: StoryRelayState
  onRelayUpdate?: (patch: Partial<StoryRelayState>) => void
  onPhaseChange?: (phase: Phase) => void
  onListenEcho?: (code: string) => void
  flashSafe?: boolean
  onToggleFlashSafe?: () => void
  exitSignal?: number
}

interface TapRipple {
  id: number
  x: number
  y: number
  color: string
}

interface DropColumn {
  id: number
  left: string
  dur: string
  delay: string
  nonce: number
}

const TUNE_TARGET = 0.71
const TUNE_WINDOW = 0.055
const LINGER_SECONDS = 15
const RAIN_TARGET_COUNT = 5
const FIREFLY_TARGET_COUNT = 6
const VALID_EGG_IDS: EggId[] = ['bottle', 'tablet', 'meteor']

const ACTIVE_TASK_BY_ACT: Record<ActId, CollectionId | null> = {
  1: 'flower',
  2: 'wind',
  3: 'wind',
  4: 'wind',
  5: 'wind',
  6: 'stars',
  7: 'stars',
  8: null,
}

const PICK_LABELS: Record<PickId, string> = {
  flower: '逆风的野花',
  wind: '草原的风声',
  stars: '暮色星辰',
  lake: '微光湖面',
  star1: '暮色星辰',
  star2: '暮色星辰',
  star3: '暮色星辰',
  bottle: '湖畔漂流瓶',
  tablet: '风化石碑',
  meteor: '夜空流星',
}

const INITIAL_DROPS: DropColumn[] = [
  { id: 0, left: '14%', dur: '3.6s', delay: '-0.8s', nonce: 0 },
  { id: 1, left: '28%', dur: '4.1s', delay: '-2.2s', nonce: 0 },
  { id: 2, left: '43%', dur: '3.3s', delay: '-1.5s', nonce: 0 },
  { id: 3, left: '58%', dur: '4.4s', delay: '-0.3s', nonce: 0 },
  { id: 4, left: '72%', dur: '3.8s', delay: '-2.9s', nonce: 0 },
  { id: 5, left: '86%', dur: '4.2s', delay: '-1.8s', nonce: 0 },
]

export function PrologueExperience({
  sound,
  active,
  onNavigate,
  relay,
  onRelayUpdate,
  onPhaseChange,
  onListenEcho,
  flashSafe,
  onToggleFlashSafe,
  exitSignal = 0,
}: PrologueExperienceProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PrologueScene | null>(null)
  const [quality, setQuality] = useState<QualityTier>(() => getSettings().quality)
  const [calmMotion, setCalmMotion] = useState(() => getSettings().reducedMotion || prefersReducedMotion())
  const journey = useJourney()
  const voiceState = useVoiceState()
  const [echo] = useState(() => dailyEcho())
  const [coarsePointer] = useState(() => isCoarsePointer())
  const [landscapeHintSeen, setLandscapeHintSeen] = useState(() => getSettings().landscapeHintSeen)
  const [place, setPlace] = useState('晨雾草甸')

  const [phase, setPhase] = useState<Phase>('ritual')
  const [opening, setOpening] = useState(false)
  const [introBeat, setIntroBeat] = useState(0)
  const [act, setAct] = useState<ActId>(1)
  const [stage, setStage] = useState<SkyStage>(0)
  const [activeTask, setActiveTask] = useState<CollectionId | null>('flower')
  const [quote, setQuote] = useState<{ key: QuoteKey; data: PrologueQuote } | null>(null)
  const [linger, setLinger] = useState<{ key: QuoteKey; left: number } | null>(null)
  const [quoteCollapsed, setQuoteCollapsed] = useState(false)
  const [panel, setPanel] = useState<PanelKind>('none')

  // Act I focus pull
  const [focusProgress, setFocusProgress] = useState(0.14)
  const [focusSnap, setFocusSnap] = useState(false)

  // Act II tuning
  const [tuning, setTuning] = useState(0.16)
  const [tuned, setTuned] = useState(false)
  const [lakeRipples, setLakeRipples] = useState(0)
  const [windHint, setWindHint] = useState(false)

  // Act III dandelion hold
  const [blowCharge, setBlowCharge] = useState(0)

  // Act IV stone arch resonance
  const [ruinPulses, setRuinPulses] = useState(0)

  // Act V interactive falling raindrops
  const [rainCatches, setRainCatches] = useState(0)
  const [dropColumns, setDropColumns] = useState<DropColumn[]>(INITIAL_DROPS)

  // Act VI interactive fireflies
  const [fireflyCount, setFireflyCount] = useState(0)
  const [fireflySparks, setFireflySparks] = useState<TapRipple[]>([])

  // Act VII constellation
  const [constellationCount, setConstellationCount] = useState(0)
  const [constellationHint, setConstellationHint] = useState(false)

  // Shared HUD / effects / reveal
  const [attenuating, setAttenuating] = useState(false)
  const [flash, setFlash] = useState(false)
  const [depthKm, setDepthKm] = useState(0)
  const [depthRevealed, setDepthRevealed] = useState(false)
  const [pressureAlert, setPressureAlert] = useState(false)
  const [signal, setSignal] = useState(0.96)
  const [scent, setScent] = useState(0.08)
  const [toast, setToast] = useState<string | null>(null)
  const [hint, setHint] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [eggsFound, setEggsFound] = useState<EggId[]>(() =>
    journey.eggsFound.filter((id): id is EggId => VALID_EGG_IDS.includes(id as EggId)),
  )
  const [cluesFound, setCluesFound] = useState<string[]>(() => relay?.cluesFound ?? [])
  const [lore, setLore] = useState<EasterEggMeta | null>(null)
  const [hover, setHover] = useState<HoverTargetInfo | null>(null)
  const [zoom, setZoom] = useState(1)
  const [memories, setMemories] = useState<MemoryFrame[]>(() => relay?.memories ?? [])
  const [exportingRoll, setExportingRoll] = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<DialogueChoice | null>(null)
  const [epilogueNote, setEpilogueNote] = useState<string | null>(() => relay?.promise ?? null)
  const [wishNote, setWishNote] = useState<string | null>(() => relay?.wish ?? null)
  const [tapRipples, setTapRipples] = useState<TapRipple[]>([])

  const phaseRef = useRef<Phase>(phase)
  const introBeatRef = useRef(introBeat)
  const actRef = useRef<ActId>(act)
  const panelRef = useRef<PanelKind>(panel)
  const quoteRef = useRef(quote)
  const lingerRef = useRef(linger)
  const tunedRef = useRef(tuned)
  const eggsRef = useRef<EggId[]>(eggsFound)
  const cluesRef = useRef<string[]>(cluesFound)
  const loreRef = useRef<EasterEggMeta | null>(lore)
  const tuningRef = useRef(tuning)
  const focusRef = useRef(focusProgress)
  const lakeRipplesRef = useRef(lakeRipples)
  const ruinPulsesRef = useRef(ruinPulses)
  const rainCatchesRef = useRef(rainCatches)
  const fireflyCountRef = useRef(fireflyCount)
  const constellationCountRef = useRef(constellationCount)
  const blowChargeRef = useRef(0)
  const blowDoneRef = useRef(false)
  const syncingRef = useRef(false)
  const finalizingRef = useRef(false)
  const lastSplashRef = useRef(0)
  const fxIdRef = useRef(1)

  const timersRef = useRef<number[]>([])
  const toastTimerRef = useRef<number | null>(null)
  const tuneAnimRef = useRef<number | null>(null)
  const blowAnimRef = useRef<number | null>(null)
  const focusAnimRef = useRef<number | null>(null)

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== id)
      fn()
    }, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const showToast = useCallback((message: string, ms = 2400) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms)
  }, [])

  const spawnRipple = useCallback(
    (x: number, y: number, color = '#f2c28b') => {
      const id = fxIdRef.current++
      setTapRipples((prev) => [...prev.slice(-8), { id, x, y, color }])
      later(() => {
        setTapRipples((prev) => prev.filter((item) => item.id !== id))
      }, 900)
    },
    [later],
  )

  const spawnFireflySpark = useCallback(
    (x: number, y: number) => {
      const id = fxIdRef.current++
      setFireflySparks((prev) => [...prev.slice(-10), { id, x, y, color: '#ffe2bd' }])
      later(() => {
        setFireflySparks((prev) => prev.filter((item) => item.id !== id))
      }, 1650)
    },
    [later],
  )

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    if (tuneAnimRef.current !== null) cancelAnimationFrame(tuneAnimRef.current)
    tuneAnimRef.current = null
    if (blowAnimRef.current !== null) cancelAnimationFrame(blowAnimRef.current)
    blowAnimRef.current = null
    if (focusAnimRef.current !== null) cancelAnimationFrame(focusAnimRef.current)
    focusAnimRef.current = null
  }, [])

  const prevExitSignalRef = useRef(exitSignal)

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [onPhaseChange, phase])

  useEffect(() => {
    phaseRef.current = phase
    introBeatRef.current = introBeat
    actRef.current = act
    panelRef.current = panel
    quoteRef.current = quote
    lingerRef.current = linger
    tunedRef.current = tuned
    eggsRef.current = eggsFound
    cluesRef.current = cluesFound
    loreRef.current = lore
    tuningRef.current = tuning
    focusRef.current = focusProgress
    lakeRipplesRef.current = lakeRipples
    ruinPulsesRef.current = ruinPulses
    rainCatchesRef.current = rainCatches
    fireflyCountRef.current = fireflyCount
    constellationCountRef.current = constellationCount
  }, [
    phase,
    introBeat,
    act,
    panel,
    quote,
    linger,
    tuned,
    eggsFound,
    cluesFound,
    lore,
    tuning,
    focusProgress,
    lakeRipples,
    ruinPulses,
    rainCatches,
    fireflyCount,
    constellationCount,
  ])

  useEffect(() => {
    return () => {
      clearTimers()
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [clearTimers])

  const pickHandlerRef = useRef<(id: PickId) => void>(() => {})
  const descentHandlerRef = useRef<(event: DescentEvent) => void>(() => {})
  const lakeHandlerRef = useRef<() => void>(() => {})
  const boundaryHandlerRef = useRef<() => void>(() => {})

  const captureMemory = useCallback(
    (actLabel: string, title: string) => {
      const dataUrl = sceneRef.current?.captureSnapshot()
      if (!dataUrl) return
      setMemories((prev) => {
        const next = [...prev.filter((item) => item.act !== actLabel), { act: actLabel, title, dataUrl }].slice(-6)
        onRelayUpdate?.({ memories: next })
        return next
      })
    },
    [onRelayUpdate],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new PrologueScene()
    sceneRef.current = scene
    scene.setQuality(getSettings().quality)
    scene.setCalmMotion(getSettings().reducedMotion || prefersReducedMotion())
    scene.mount(host, {
      onPick: (id) => pickHandlerRef.current(id),
      onDescentEvent: (event) => descentHandlerRef.current(event),
      onLakeRipple: () => lakeHandlerRef.current(),
      onHoverTarget: (info) => setHover(info),
      onZoomChange: (nextZoom) => setZoom(nextZoom),
      onSkimChange: (amount) => sound.setGrassSkim(amount),
      onPlaceChange: (nextPlace) => setPlace(nextPlace),
      onBoundary: () => boundaryHandlerRef.current?.(),
    })
    scene.setActiveTask('flower')
    scene.setRoamEnabled(false)
    const observer = new ResizeObserver(() => scene.resize())
    observer.observe(host)
    return () => {
      observer.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
  }, [sound])

  useEffect(() => {
    sceneRef.current?.setPaused(!active)
  }, [active])

  useEffect(
    () =>
      subscribeSettings(() => {
        setQuality(getSettings().quality)
        setCalmMotion(getSettings().reducedMotion || prefersReducedMotion())
      }),
    [],
  )

  useEffect(() => {
    sceneRef.current?.setQuality(quality)
  }, [quality])

  useEffect(() => {
    sceneRef.current?.setCalmMotion(calmMotion)
  }, [calmMotion])

  const clockLabel = (STEPS[act - 1] ?? STEPS[0]).timeLabel
  const clockHour = Number(clockLabel.slice(0, 2)) + Number(clockLabel.slice(3, 5)) / 60

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setStage(stage)
    scene.setClock(clockHour)
  }, [stage, clockHour])

  useEffect(() => {
    sceneRef.current?.setActiveTask(activeTask)
  }, [activeTask])

  useEffect(() => {
    const enabled = active && phase === 'explore' && !lore && !finalizing
    sceneRef.current?.setRoamEnabled(enabled)
  }, [active, phase, lore, finalizing])

  const handleMoveAxis = useCallback((x: number, y: number) => {
    sceneRef.current?.setMoveAxis(x, y)
  }, [])

  const handleLookAxis = useCallback((x: number, y: number) => {
    sceneRef.current?.setLookAxis(x, y)
  }, [])

  const openQuote = useCallback(
    (key: QuoteKey) => {
      const nextQuote = QUOTES[key]
      setSelectedChoice(null)
      setQuoteCollapsed(false)
      setQuote({ key, data: nextQuote })
      if (nextQuote.clue) {
        const label = nextQuote.clue.label
        if (!cluesRef.current.includes(label)) {
          const nextClues = [...cluesRef.current, label]
          cluesRef.current = nextClues
          setCluesFound(nextClues)
          onRelayUpdate?.({ cluesFound: nextClues })
          showToast(`发现异样线索 · ${label}`, 2400)
        }
      }
    },
    [onRelayUpdate, showToast],
  )

  const activateFlower = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    setPanel('none')
    panelRef.current = 'none'
    setFocusProgress(1)
    setFocusSnap(true)
    later(() => setFocusSnap(false), 680)
    setScent(1)
    sound.playChime([659.25, 830.61, 987.77], 0.1, 3.4)
    sceneRef.current?.collectFlower()
    sceneRef.current?.focusTarget('flower', 2.0)
    showToast('焦距吻合 · 花香与晨露同时传入耳机')
    setHint(false)
    later(() => {
      syncingRef.current = false
      setScent(1)
      captureMemory('ACT I', '晨雾逆风野花')
      openQuote('flower')
    }, 1650)
  }, [captureMemory, later, openQuote, showToast, sound])

  const triggerRuinPulse = useCallback(
    (x?: number, y?: number) => {
      if (actRef.current !== 4 || panelRef.current !== 'ruin' || syncingRef.current) return
      if (ruinPulsesRef.current >= 3) return
      const next = ruinPulsesRef.current + 1
      ruinPulsesRef.current = next
      setRuinPulses(next)
      sceneRef.current?.pulseSanctuaryRune(next)
      sound.skyCall()
      const cx = x ?? (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 400)
      const cy = y ?? (typeof window !== 'undefined' ? window.innerHeight * 0.48 : 300)
      spawnRipple(cx, cy, '#f2c28b')

      if (next < 3) {
        showToast(`石拱共振 (${next}/3) · 继续发出心光`, 1500)
        return
      }
      syncingRef.current = true
      sound.playChime([523.25, 659.25, 880, 1046.5], 0.1, 3.6)
      showToast('石拱碑纹亮起 · 山谷送回远古回声', 2200)
      later(() => {
        syncingRef.current = false
        setPanel('none')
        panelRef.current = 'none'
        captureMemory('ACT IV', '石拱心光回声')
        openQuote('ruin')
      }, 1650)
    },
    [captureMemory, later, openQuote, showToast, sound, spawnRipple],
  )

  const triggerSkyCall = useCallback(() => {
    if (!active || phaseRef.current !== 'explore' || quoteRef.current || loreRef.current || finalizingRef.current) return
    if (actRef.current === 4 && panelRef.current === 'ruin') {
      triggerRuinPulse()
      return
    }
    sceneRef.current?.emitSkyCall()
    sound.skyCall()
  }, [active, sound, triggerRuinPulse])

  const advanceIntroBeat = useCallback(() => {
    if (phaseRef.current !== 'intro_call') return
    if (introBeatRef.current < INTRO_CALL_BEATS.length - 1) {
      const next = introBeatRef.current + 1
      introBeatRef.current = next
      setIntroBeat(next)
      sound.playChime([587.33, 783.99], 0.045, 2.0)
      return
    }
    phaseRef.current = 'explore'
    setPhase('explore')
    setAct(1)
    actRef.current = 1
    setActiveTask('flower')
    setPanel('focus')
    panelRef.current = 'focus'
    setFocusProgress(0.14)
    focusRef.current = 0.14
    sceneRef.current?.focusTarget('flower', 2.4)
    sound.playChime([523.25, 659.25], 0.06, 2.5)
    showToast('ACT I · 拖动对焦环，替她拨开清晨大雾', 2600)
  }, [showToast, sound])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (phaseRef.current === 'intro_call' && (event.code === 'Space' || event.code === 'Enter')) {
        event.preventDefault()
        advanceIntroBeat()
        return
      }
      if (event.code === 'KeyJ' && active && phaseRef.current === 'explore' && !finalizingRef.current) {
        event.preventDefault()
        setJournalOpen((current) => !current)
        return
      }
      if (event.code !== 'Space') return
      if (!active || phaseRef.current !== 'explore' || quoteRef.current || loreRef.current || finalizingRef.current) return
      event.preventDefault()
      triggerSkyCall()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, advanceIntroBeat, triggerSkyCall])

  useEffect(() => {
    if (panel !== 'wind') return
    const timer = window.setTimeout(() => setWindHint(true), 9000)
    return () => window.clearTimeout(timer)
  }, [panel])

  useEffect(() => {
    if (panel !== 'constellation') return
    const timer = window.setTimeout(() => setConstellationHint(true), 12000)
    return () => window.clearTimeout(timer)
  }, [panel])

  const begin = async () => {
    if (opening) return
    setOpening(true)
    sceneRef.current?.setStage(0)
    sceneRef.current?.focusTarget('home', 3.4)
    void voicePlayer.preload('intro-0')
    void voicePlayer.preload('intro-1')
    try {
      await sound.unlock()
      await voicePlayer.unlock()
      sound.enterGrassland()
    } catch {
      /* visuals continue even if audio is blocked */
    }
    later(() => {
      phaseRef.current = 'intro_call'
      introBeatRef.current = 0
      setPhase('intro_call')
      setIntroBeat(0)
      setOpening(false)
    }, 2450)
  }

  // Act I focus controls
  const updateFocus = (next: number) => {
    const clamped = Math.max(0.05, Math.min(1, next))
    focusRef.current = clamped
    setFocusProgress(clamped)
    if (clamped >= 0.985 && actRef.current === 1 && panelRef.current === 'focus') {
      if (focusAnimRef.current !== null) {
        cancelAnimationFrame(focusAnimRef.current)
        focusAnimRef.current = null
      }
      activateFlower()
    }
  }

  const startFocusHold = () => {
    if (actRef.current !== 1 || panelRef.current !== 'focus' || syncingRef.current) return
    if (focusAnimRef.current !== null) cancelAnimationFrame(focusAnimRef.current)
    const startVal = focusRef.current
    const start = performance.now()
    const duration = Math.max(450, (1 - startVal) * 1450)
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      const val = startVal + (1 - startVal) * (1 - Math.pow(1 - k, 2))
      focusRef.current = val
      setFocusProgress(val)
      if (val >= 0.995) {
        focusAnimRef.current = null
        activateFlower()
      } else {
        focusAnimRef.current = requestAnimationFrame(step)
      }
    }
    focusAnimRef.current = requestAnimationFrame(step)
  }

  const stopFocusHold = () => {
    if (focusAnimRef.current !== null) {
      cancelAnimationFrame(focusAnimRef.current)
      focusAnimRef.current = null
    }
  }

  const dismissPanel = () => {
    stopFocusHold()
    if (blowAnimRef.current !== null) {
      cancelAnimationFrame(blowAnimRef.current)
      blowAnimRef.current = null
    }
    if (panelRef.current === 'rain') {
      sceneRef.current?.stopRain()
      sound.stopRain()
    }
    setPanel('none')
    panelRef.current = 'none'
    showToast('已收起 · 可自由漫步或点右下角按钮继续', 2000)
  }

  const exitToRitual = useCallback(() => {
    clearTimers()
    voicePlayer.stop()
    setQuote(null)
    quoteRef.current = null
    setPanel('none')
    panelRef.current = 'none'
    setLore(null)
    loreRef.current = null
    setAttenuating(false)
    setFlash(false)
    setFocusSnap(false)
    setPressureAlert(false)
    setDepthRevealed(false)
    setDepthKm(0)
    setSignal(0.96)
    setFocusProgress(0.14)
    focusRef.current = 0.14
    setRainCatches(0)
    rainCatchesRef.current = 0
    setRuinPulses(0)
    ruinPulsesRef.current = 0
    setConstellationCount(0)
    constellationCountRef.current = 0
    setConstellationHint(false)
    setWindHint(false)
    setHint(false)
    setTuned(false)
    tunedRef.current = false
    setTuning(0.16)
    tuningRef.current = 0.16
    setScent(0.08)
    syncingRef.current = false
    finalizingRef.current = false
    setFinalizing(false)
    setHover(null)
    setZoom(1)
    setLakeRipples(0)
    lakeRipplesRef.current = 0
    setBlowCharge(0)
    blowChargeRef.current = 0
    blowDoneRef.current = false
    setFireflyCount(0)
    fireflyCountRef.current = 0
    setSelectedChoice(null)
    setToast(null)
    setOpening(false)
    sceneRef.current?.resetToSurface()
    sound.resetAtmosphere()
    sound.stopRain()
    setAct(1)
    actRef.current = 1
    setActiveTask('flower')
    setStage(0)
    phaseRef.current = 'ritual'
    setPhase('ritual')
  }, [clearTimers, sound])

  useEffect(() => {
    if (exitSignal !== prevExitSignalRef.current) {
      prevExitSignalRef.current = exitSignal
      exitToRitual()
    }
  }, [exitSignal, exitToRitual])

  const skipIntroToExplore = () => {
    voicePlayer.stop()
    phaseRef.current = 'explore'
    setPhase('explore')
    setAct(1)
    actRef.current = 1
    setActiveTask('flower')
    setPanel('focus')
    panelRef.current = 'focus'
    setFocusProgress(0.14)
    focusRef.current = 0.14
    sceneRef.current?.focusTarget('flower', 2.4)
    sound.playChime([523.25, 659.25], 0.06, 2.5)
    showToast('ACT I · 拖动对焦环，替她拨开清晨大雾', 2600)
  }

  const pickDialogueChoice = (choice: DialogueChoice) => {
    setSelectedChoice(choice)
    if (choice.epilogueNote) {
      setEpilogueNote(choice.epilogueNote)
      onRelayUpdate?.({ promise: choice.epilogueNote })
    }
    if (choice.wishNote) {
      setWishNote(choice.wishNote)
      onRelayUpdate?.({ wish: choice.wishNote })
    }
    sound.playChime([659.25, 880], 0.04, 1.8)
  }

  const openWindPanel = useCallback(() => {
    if (actRef.current !== 2 || panelRef.current === 'wind') return
    setPanel('wind')
    panelRef.current = 'wind'
    setWindHint(false)
    sceneRef.current?.focusTarget('lake', 2.4)
    sceneRef.current?.setTuning(tuningRef.current)
    sound.setTuning(tuningRef.current)
  }, [sound])

  const registerLakeRipple = useCallback(() => {
    if (actRef.current !== 2 || panelRef.current !== 'none' || quoteRef.current || finalizingRef.current) return
    const next = Math.min(2, lakeRipplesRef.current + 1)
    if (next === lakeRipplesRef.current) return
    lakeRipplesRef.current = next
    setLakeRipples(next)
    if (next < 2) {
      showToast(`水波传到了耳机里 (${next}/2) · 再轻划一下湖面`, 1800)
    } else {
      sound.playChime([523.25, 659.25], 0.06, 2.4)
      showToast('水声接通了 · 现在校准草原风声', 1900)
      later(() => {
        openWindPanel()
      }, 900)
    }
  }, [later, openWindPanel, showToast, sound])

  const handleLakeHover = () => {
    if (phaseRef.current !== 'explore') return
    const now = performance.now()
    if (now - lastSplashRef.current < 320) return
    lastSplashRef.current = now
    sound.waterSplash(0.45)
    registerLakeRipple()
  }

  const changeTuning = (next: number) => {
    setTuning(next)
    tuningRef.current = next
    sceneRef.current?.setTuning(next)
    sound.setTuning(next)
  }

  const autoAlign = () => {
    if (tuneAnimRef.current !== null) cancelAnimationFrame(tuneAnimRef.current)
    const from = tuningRef.current
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1450)
      const eased = 1 - Math.pow(1 - k, 3)
      changeTuning(from + (TUNE_TARGET + 0.005 - from) * eased)
      if (k < 1) {
        tuneAnimRef.current = requestAnimationFrame(step)
      } else {
        tuneAnimRef.current = null
      }
    }
    tuneAnimRef.current = requestAnimationFrame(step)
  }

  const triggerDandelionBlow = (strength = 1) => {
    if (actRef.current !== 3 || panelRef.current !== 'dandelion' || blowDoneRef.current) return
    blowDoneRef.current = true
    if (blowAnimRef.current !== null) {
      cancelAnimationFrame(blowAnimRef.current)
      blowAnimRef.current = null
    }
    setBlowCharge(100)
    setPanel('none')
    panelRef.current = 'none'
    sceneRef.current?.blowDandelion(strength)
    sound.playChime([523.25, 659.25, 783.99, 987.77], 0.1, 3.6)
    showToast('风铃轻晃，漫山蒲公英顺风飞向湖谷', 2200)
    later(() => {
      captureMemory('ACT III', '孤树风铃与蒲公英')
      openQuote('dandelion')
    }, 1750)
  }

  const startBlowHold = () => {
    if (actRef.current !== 3 || panelRef.current !== 'dandelion' || blowDoneRef.current) return
    if (blowAnimRef.current !== null) cancelAnimationFrame(blowAnimRef.current)
    const start = performance.now()
    const step = (now: number) => {
      const pct = Math.min(100, ((now - start) / 1050) * 100)
      blowChargeRef.current = pct
      setBlowCharge(pct)
      if (pct >= 100) {
        blowAnimRef.current = null
        triggerDandelionBlow(1.15)
      } else {
        blowAnimRef.current = requestAnimationFrame(step)
      }
    }
    blowAnimRef.current = requestAnimationFrame(step)
  }

  const releaseBlowHold = () => {
    if (blowAnimRef.current !== null) {
      cancelAnimationFrame(blowAnimRef.current)
      blowAnimRef.current = null
    }
    if (actRef.current !== 3 || panelRef.current !== 'dandelion' || blowDoneRef.current) return
    triggerDandelionBlow(Math.max(0.75, blowChargeRef.current / 100))
  }

  const catchRainDrop = (columnId?: number, clientX?: number, clientY?: number) => {
    if (actRef.current !== 5 || panelRef.current !== 'rain' || finalizingRef.current) return
    if (rainCatchesRef.current >= RAIN_TARGET_COUNT) return
    const next = rainCatchesRef.current + 1
    rainCatchesRef.current = next
    setRainCatches(next)
    sound.waterSplash(0.75)

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      spawnRipple(clientX, clientY, '#b9d2ff')
    }
    if (typeof columnId === 'number') {
      setDropColumns((prev) =>
        prev.map((col) =>
          col.id === columnId
            ? { ...col, nonce: col.nonce + 1, delay: '0s' }
            : col,
        ),
      )
    }

    if (next < RAIN_TARGET_COUNT) {
      showToast(`接住了第 ${next}/${RAIN_TARGET_COUNT} 滴晚雨`, 1100)
      return
    }
    setPanel('none')
    panelRef.current = 'none'
    captureMemory('ACT V', '黄昏晚雨')
    sceneRef.current?.stopRain()
    sound.stopRain()
    sound.playChime([392, 523.25, 659.25, 783.99], 0.08, 3.8)
    setStage(2)
    setSignal(0.89)
    showToast('云层散开，湖岸落进蓝紫色暮色', 2400)
    later(() => {
      openQuote('rain')
    }, 1850)
  }

  const wakeFirefly = (clientX?: number, clientY?: number) => {
    if (actRef.current !== 6 || panelRef.current !== 'fireflies' || finalizingRef.current) return
    if (fireflyCountRef.current >= FIREFLY_TARGET_COUNT) return
    const next = fireflyCountRef.current + 1
    fireflyCountRef.current = next
    setFireflyCount(next)

    const sx = clientX ?? (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 400)
    const sy = clientY ?? (typeof window !== 'undefined' ? window.innerHeight * 0.55 : 320)
    spawnFireflySpark(sx, sy)

    sceneRef.current?.setFireflyLevel(Math.ceil(next / 2))
    const scale = [587.33, 659.25, 783.99, 880, 987.77, 1174.66]
    sound.playChime([scale[next - 1], scale[next - 1] * 1.5], 0.075, 2.8)

    if (next < FIREFLY_TARGET_COUNT) {
      showToast(`木船旁亮起了流萤 (${next}/${FIREFLY_TARGET_COUNT})`, 1200)
      return
    }
    setPanel('none')
    panelRef.current = 'none'
    showToast('流萤绕着岸边木船起伏呼吸', 2200)
    later(() => {
      captureMemory('ACT VI', '轻舟暮色流萤')
      openQuote('fireflies')
    }, 1650)
  }

  const openLore = (id: EggId) => {
    const meta = EASTER_EGGS[id]
    if (!eggsRef.current.includes(id)) {
      const next = [...eggsRef.current, id]
      eggsRef.current = next
      setEggsFound(next)
      markEggFound(id)
      if (id === 'meteor') sound.meteorChime()
      else sound.playChime([523.25, 783.99, 1046.5], 0.07, 3.2)
      showToast(`彩蛋发现 ${next.length}/3 · ${meta.title}`, 2200)
    }
    setLore(meta)
  }

  const registerStar = (id: PickId) => {
    if (actRef.current !== 7 || panelRef.current !== 'constellation' || finalizingRef.current) return
    if (id !== 'star1' && id !== 'star2' && id !== 'star3') return
    const next = Math.min(3, constellationCountRef.current + 1)
    if (next === constellationCountRef.current) return
    constellationCountRef.current = next
    setConstellationCount(next)
    sound.constellationNote(next - 1)
    if (next >= 3) {
      completeConstellation()
    } else {
      showToast(`第 ${next} 颗星亮了 · 还差 ${3 - next} 颗`, 1500)
    }
  }

  const completeConstellation = () => {
    if (finalizingRef.current) return
    finalizingRef.current = true
    setPanel('none')
    panelRef.current = 'none'
    setConstellationHint(false)
    captureMemory('ACT VII', '专属星河')
    sound.playChime([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.14, 4.6)
    showToast('星座连成了 · 她开口说出了真相', 2100)
    later(() => {
      finalizingRef.current = false
      openQuote('stars')
    }, 1450)
  }

  const autoConnect = () => {
    if (actRef.current !== 7 || panelRef.current !== 'constellation' || finalizingRef.current) return
    sceneRef.current?.autoCompleteConstellation()
    constellationCountRef.current = 3
    setConstellationCount(3)
    completeConstellation()
  }

  const startDescent = useCallback(() => {
    if (phaseRef.current !== 'explore') return
    phaseRef.current = 'descending'
    setPhase('descending')
    setAct(8)
    actRef.current = 8
    setActiveTask(null)
    setSignal(0.04)
    setDepthKm(0)
    setDepthRevealed(true)
    setQuote(null)
    quoteRef.current = null
    setPanel('none')
    panelRef.current = 'none'
    setLore(null)
    setHint(false)
    setWindHint(false)
    setConstellationHint(false)
    setAttenuating(false)
    sceneRef.current?.stopRain()
    sceneRef.current?.setRoamEnabled(false)
    sceneRef.current?.triggerDescent()
    sound.descentStart()
  }, [sound])

  const triggerFinalTruthPlunge = () => {
    if (finalizingRef.current) return
    finalizingRef.current = true
    setFinalizing(true)
    setAct(8)
    actRef.current = 8
    setActiveTask(null)
    setQuote(null)
    quoteRef.current = null
    setPanel('none')
    panelRef.current = 'none'
    setToast(null)
    setAttenuating(true)
    setDepthRevealed(true)
    setDepthKm(6371.4)
    setSignal(0.08)
    sound.staticBurst()
    later(() => setSignal(0.05), 1400)
    later(() => {
      setAttenuating(false)
      finalizingRef.current = false
      setFinalizing(false)
      startDescent()
    }, 4400)
  }

  const respondCoreHeartbeat = () => {
    if (phaseRef.current !== 'core_pulse') return
    sound.playChime([196, 261.63, 392, 523.25, 659.25], 0.12, 4.5)
    sound.pressureThud()
    if (typeof window !== 'undefined') {
      spawnRipple(window.innerWidth * 0.5, window.innerHeight * 0.72, '#f2c28b')
    }
    onRelayUpdate?.({
      completedPrologue: true,
      memories,
      cluesFound,
      promise: epilogueNote,
      wish: wishNote,
    })
    later(() => {
      phaseRef.current = 'epilogue'
      setPhase('epilogue')
    }, 850)
  }

  const advanceFromQuote = (key: QuoteKey) => {
    lingerRef.current = null
    setLinger(null)
    setSelectedChoice(null)

    if (key === 'flower') {
      setAct(2)
      actRef.current = 2
      setActiveTask('wind')
      setLakeRipples(0)
      lakeRipplesRef.current = 0
      sceneRef.current?.focusTarget('lake', 2.6)
      setPanel('none')
      setScent(1)
      sound.playChime([392, 493.88, 587.33], 0.05, 3)
      showToast('ACT II · 轻划或点击湖面 2 次，传去水声', 2600)
    } else if (key === 'wind') {
      setAct(3)
      actRef.current = 3
      setActiveTask('wind')
      blowDoneRef.current = false
      blowChargeRef.current = 0
      setBlowCharge(0)
      setScent(1)
      sceneRef.current?.focusTarget('tree', 2.5)
      setPanel('dandelion')
      panelRef.current = 'dandelion'
      showToast('ACT III · 孤树之下，聚风吹散漫山蒲公英', 2400)
    } else if (key === 'dandelion') {
      setAct(4)
      actRef.current = 4
      setActiveTask('wind')
      setRuinPulses(0)
      ruinPulsesRef.current = 0
      setScent(1)
      sceneRef.current?.focusTarget('ruin', 2.5)
      setPanel('ruin')
      panelRef.current = 'ruin'
      showToast('ACT IV · 轻敲古石拱前的心光共鸣环 (3 次)', 2400)
    } else if (key === 'ruin') {
      setAct(5)
      actRef.current = 5
      setPanel('rain')
      panelRef.current = 'rain'
      setRainCatches(0)
      rainCatchesRef.current = 0
      setActiveTask('wind')
      setScent(1)
      sceneRef.current?.focusTarget('shore', 2.2)
      sceneRef.current?.startRain()
      sound.startRain()
      setSignal(0.94)
      showToast('ACT V · 点击空中飘落的 5 滴晚雨，替她接住雨声', 2600)
    } else if (key === 'rain') {
      setAct(6)
      actRef.current = 6
      setFireflyCount(0)
      fireflyCountRef.current = 0
      setActiveTask('stars')
      setScent(1)
      setStage(2)
      setSignal(0.91)
      sceneRef.current?.focusTarget('boat', 2.6)
      setPanel('fireflies')
      panelRef.current = 'fireflies'
      showToast('ACT VI · 轻点暮色湖畔，为轻舟引来 6 簇流萤', 2600)
    } else if (key === 'fireflies') {
      setAct(7)
      actRef.current = 7
      setPanel('none')
      panelRef.current = 'none'
      setActiveTask('stars')
      setScent(1)
      sceneRef.current?.focusTarget('sky', 2.8)
      setStage(2)
      setSignal(0.86)
      showToast('ACT VII · 仰望夜空，把最亮的三颗星连在一起', 2200)
      later(() => {
        sceneRef.current?.setConstellationActive(true)
        setPanel('constellation')
        panelRef.current = 'constellation'
        setConstellationCount(0)
        constellationCountRef.current = 0
        setConstellationHint(false)
        sound.playChime([261.63, 392, 523.25], 0.06, 4)
      }, 2100)
    } else if (key === 'stars') {
      triggerFinalTruthPlunge()
    }
  }

  const continueQuote = () => {
    const current = quoteRef.current
    if (!current) return
    voicePlayer.stop()
    setQuote(null)
    quoteRef.current = null
    setQuoteCollapsed(false)
    setSelectedChoice(null)

    // 终幕是玩家主动选择的俯冲，不该再插入等待
    if (current.key === 'stars') {
      advanceFromQuote(current.key)
      return
    }
    setPanel('none')
    panelRef.current = 'none'
    setActiveTask(null)
    const key = current.key
    const start = { key, left: LINGER_SECONDS }
    lingerRef.current = start
    setLinger(start)

    const tick = (left: number) => {
      if (lingerRef.current?.key !== key) return
      // 读彩蛋时不推进，避免把人从文字里拽走
      if (loreRef.current) {
        later(() => tick(left), 1000)
        return
      }
      if (left <= 0) {
        advanceFromQuote(key)
        return
      }
      const next = { key, left }
      lingerRef.current = next
      setLinger(next)
      later(() => tick(left - 1), 1000)
    }
    later(() => tick(LINGER_SECONDS - 1), 1000)
  }

  useEffect(() => {
    if (phase !== 'explore' || panel !== 'wind' || tuned) return
    if (Math.abs(tuning - TUNE_TARGET) > TUNE_WINDOW) return
    const timer = window.setTimeout(() => {
      setTuned(true)
      tunedRef.current = true
      setPanel('none')
      panelRef.current = 'none'
      setStage(1)
      setSignal(0.99)
      setWindHint(false)
      sceneRef.current?.lockWind()
      sound.lockWind()
      setPressureAlert(true)
      sound.pressureThud()
      later(() => setPressureAlert(false), 1650)
      showToast('风声频段已锁定 · 隐约闪过一丝金属低鸣', 2800)
      later(() => {
        openQuote('wind')
      }, 2100)
    }, 720)
    return () => window.clearTimeout(timer)
  }, [tuning, panel, phase, tuned, later, openQuote, showToast, sound])

  const handlePick = (id: PickId) => {
    if (phaseRef.current !== 'explore' || finalizingRef.current) return
    if (id === 'lake') {
      sound.waterSplash(1)
      if (actRef.current === 2 && panelRef.current === 'none') {
        registerLakeRipple()
      } else if (actRef.current === 2) {
        showToast('湖水接住了风 · 继续校准风声', 1600)
      }
      return
    }
    if (id === 'bottle' || id === 'tablet' || id === 'meteor') {
      openLore(id)
      return
    }
    if (id === 'star1' || id === 'star2' || id === 'star3') {
      registerStar(id)
      return
    }
    if (quoteRef.current || syncingRef.current) return

    const currentAct = actRef.current
    if (id === 'flower') {
      if (currentAct === 1) {
        activateFlower()
      } else {
        sceneRef.current?.focusTarget('flower', 2.2)
        showToast('清晨那朵逆风的野花，已存入记忆胶片', 2000)
      }
      return
    }
    if (id === 'wind') {
      if (currentAct === 2) {
        openWindPanel()
      } else if (currentAct < 2) {
        sceneRef.current?.focusTarget('wind', 2.2)
        showToast('先替她对准清晨那朵野花吧', 2000)
      }
      return
    }
    if (id === 'stars') {
      sceneRef.current?.focusTarget('sky', 2.4)
      showToast(currentAct === 7 ? '点击夜空中最亮的三颗星' : '等夜色落定，我们再仰望星座', 2200)
    }
  }

  const handleDescent = (event: DescentEvent) => {
    if (event.type === 'tick') {
      const depthProgress = Math.max(0, Math.min(1, (event.progress - 0.27) / 0.73))
      setDepthKm(Number((6371.4 * Math.pow(depthProgress, 1.2)).toFixed(1)))
      setSignal(Math.max(0.03, 0.34 - event.progress * 0.28))
      return
    }
    if (event.type === 'breach') {
      setFlash(true)
      later(() => setFlash(false), 1400)
      return
    }
    if (event.type === 'arrive') {
      setDepthKm(6371.4)
      setDepthRevealed(true)
      setSignal(0.24)
      sound.arrive()
      later(() => {
        phaseRef.current = 'core_pulse'
        setPhase('core_pulse')
      }, 1250)
    }
  }

  useEffect(() => {
    pickHandlerRef.current = handlePick
    descentHandlerRef.current = handleDescent
    lakeHandlerRef.current = handleLakeHover
    boundaryHandlerRef.current = () => showToast('前面起雾了，今天的草原就走到这里', 2600)
    sceneRef.current?.setFocusRing(
      phase === 'explore' && act === 1 && panel === 'focus' && !quote ? focusProgress : null,
    )
    if (phase !== 'ritual') markActSeen(act)
  })

  const resetTransient = () => {
    clearTimers()
    voicePlayer.stop()
    setQuote(null)
    quoteRef.current = null
    setLinger(null)
    lingerRef.current = null
    setQuoteCollapsed(false)
    setPanel('none')
    panelRef.current = 'none'
    setLore(null)
    loreRef.current = null
    setAttenuating(false)
    setFlash(false)
    setFocusSnap(false)
    setPressureAlert(false)
    setDepthRevealed(false)
    setDepthKm(0)
    setSignal(0.96)
    setFocusProgress(0.14)
    focusRef.current = 0.14
    setRainCatches(0)
    rainCatchesRef.current = 0
    setRuinPulses(0)
    ruinPulsesRef.current = 0
    setConstellationCount(0)
    constellationCountRef.current = 0
    setConstellationHint(false)
    setWindHint(false)
    setHint(false)
    setTuned(false)
    tunedRef.current = false
    setTuning(0.16)
    tuningRef.current = 0.16
    setScent(0.08)
    syncingRef.current = false
    finalizingRef.current = false
    setFinalizing(false)
    setHover(null)
    setZoom(1)
    setLakeRipples(0)
    lakeRipplesRef.current = 0
    setBlowCharge(0)
    blowChargeRef.current = 0
    blowDoneRef.current = false
    setFireflyCount(0)
    fireflyCountRef.current = 0
    setSelectedChoice(null)
    phaseRef.current = 'explore'
    setPhase('explore')
    setOpening(false)
  }

  const handleExportRoll = async () => {
    if (!memories.length || exportingRoll) return
    setExportingRoll(true)
    try {
      await exportMemoryFilmstrip(memories)
      showToast('记忆胶片已冲洗并开始下载', 2200)
    } finally {
      setExportingRoll(false)
    }
  }

  const jumpToAct = (target: ActId) => {
    resetTransient()
    sceneRef.current?.resetToSurface()
    sound.resetAtmosphere()
    sound.stopRain()
    setAct(target)
    actRef.current = target
    const task = ACTIVE_TASK_BY_ACT[target]
    setActiveTask(task)
    setTuning(0.16)
    tuningRef.current = 0.16
    setStage(target <= 2 ? 0 : target <= 5 ? 1 : 2)
    setScent(target === 1 ? 0.08 : 1)
    setToast(`第 ${STEPS[target - 1].index} 幕 · ${STEPS[target - 1].title}`)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400)

    if (target === 1) {
      sceneRef.current?.setStage(0, true)
      sceneRef.current?.focusTarget('flower', 0.02)
      sceneRef.current?.setRoamEnabled(true)
      sound.enterGrassland()
      setPanel('focus')
      panelRef.current = 'focus'
    } else if (target === 2) {
      sceneRef.current?.setStage(0, true)
      sceneRef.current?.setTuning(0.16)
      sceneRef.current?.focusTarget('lake', 0.02)
      sceneRef.current?.setRoamEnabled(true)
      sound.enterGrassland()
      setScent(1)
    } else if (target === 3) {
      sceneRef.current?.setStage(1, true)
      sceneRef.current?.setTuning(0.715)
      sceneRef.current?.lockWind()
      sceneRef.current?.focusTarget('tree', 0.02)
      sceneRef.current?.setRoamEnabled(true)
      sound.enterGrassland()
      sound.lockWind()
      setTuned(true)
      tunedRef.current = true
      setTuning(0.715)
      tuningRef.current = 0.715
      setScent(1)
      setSignal(0.97)
      setPanel('dandelion')
      panelRef.current = 'dandelion'
    } else if (target === 4) {
      sceneRef.current?.setStage(1, true)
      sceneRef.current?.lockWind()
      sceneRef.current?.focusTarget('ruin', 0.02)
      sceneRef.current?.setRoamEnabled(true)
      sound.enterGrassland()
      sound.lockWind()
      setTuned(true)
      tunedRef.current = true
      setScent(1)
      setSignal(0.95)
      setPanel('ruin')
      panelRef.current = 'ruin'
    } else if (target === 5) {
      sceneRef.current?.setStage(1, true)
      sceneRef.current?.lockWind()
      sceneRef.current?.focusTarget('shore', 0.02)
      sceneRef.current?.setRoamEnabled(true)
      sceneRef.current?.startRain()
      sound.enterGrassland()
      sound.lockWind()
      sound.startRain()
      setTuned(true)
      tunedRef.current = true
      setScent(1)
      setSignal(0.93)
      setPanel('rain')
      panelRef.current = 'rain'
    } else if (target === 6) {
      sceneRef.current?.setStage(2, true)
      sceneRef.current?.focusTarget('boat', 0.02)
      sceneRef.current?.setRoamEnabled(true)
      sound.enterGrassland()
      setTuned(true)
      tunedRef.current = true
      setScent(1)
      setSignal(0.9)
      setPanel('fireflies')
      panelRef.current = 'fireflies'
    } else if (target === 7) {
      sceneRef.current?.setStage(2, true)
      sceneRef.current?.focusTarget('sky', 0.02)
      sceneRef.current?.setConstellationActive(true)
      sceneRef.current?.setRoamEnabled(true)
      sound.enterGrassland()
      setTuned(true)
      tunedRef.current = true
      setScent(1)
      setSignal(0.86)
      setPanel('constellation')
      panelRef.current = 'constellation'
      sound.playChime([261.63, 392, 523.25], 0.06, 4)
    } else {
      sceneRef.current?.setStage(2, true)
      sound.enterGrassland()
      setTuned(true)
      tunedRef.current = true
      setScent(1)
      setDepthRevealed(true)
      startDescent()
    }
  }

  const highestSeenAct = journey.actsSeen.length > 0 ? Math.max(...journey.actsSeen) : 0
  const resumeAct: ActId | null = highestSeenAct >= 1 ? (Math.min(7, highestSeenAct) as ActId) : null
  const resumeLabel = resumeAct
    ? highestSeenAct >= 8
      ? `直达第 ${STEPS[resumeAct - 1].index} 幕 · ${STEPS[resumeAct - 1].title}`
      : `继续第 ${STEPS[resumeAct - 1].index} 幕 · ${STEPS[resumeAct - 1].title}`
    : null

  const resumeFromCover = async () => {
    if (opening || !resumeAct) return
    try {
      await sound.unlock()
      await voicePlayer.unlock()
    } catch {
      /* visuals continue even if audio is blocked */
    }
    jumpToAct(resumeAct)
  }

  const restart = () => {
    clearTimers()
    setEggsFound([])
    eggsRef.current = []
    setMemories([])
    setEpilogueNote(null)
    setWishNote(null)
    setHover(null)
    setZoom(1)
    resetTransient()
    sceneRef.current?.resetToSurface()
    sceneRef.current?.setStage(0, true)
    sceneRef.current?.focusTarget('flower', 0.02)
    sceneRef.current?.setRoamEnabled(true)
    sceneRef.current?.setActiveTask('flower')
    sound.resetAtmosphere()
    sound.enterGrassland()
    setAct(1)
    actRef.current = 1
    setActiveTask('flower')
    setStage(0)
    setPanel('focus')
    panelRef.current = 'focus'
    setFocusProgress(0.14)
    focusRef.current = 0.14
    setSignal(0.96)
    showToast('重新连接 · 清晨仍在等她', 2400)
  }

  const handleActRow = (target: ActId) => {
    if (phaseRef.current !== 'explore' && phaseRef.current !== 'epilogue' && phaseRef.current !== 'core_pulse') return
    if (phaseRef.current === 'explore' && target === actRef.current) {
      const s = STEPS[target - 1]
      sceneRef.current?.focusTarget(s.focus, 2.2)
      if (target === 1) setPanel('focus')
      if (target === 2 && lakeRipplesRef.current >= 2) setPanel('wind')
      if (target === 3) setPanel('dandelion')
      if (target === 4) setPanel('ruin')
      if (target === 5) setPanel('rain')
      if (target === 6) setPanel('fireflies')
      if (target === 7) setPanel('constellation')
      return
    }
    jumpToAct(target)
  }

  const inZone = Math.abs(tuning - TUNE_TARGET) <= TUNE_WINDOW
  const step = STEPS[act - 1] ?? STEPS[0]
  const readings: SensorReadings = {
    light: phase === 'descending' ? 0.02 : stage === 0 ? 0.44 : stage === 1 ? 0.78 : 0.2,
    wind: tuned ? 0.94 : panel === 'wind' ? 0.3 + tuning * 0.55 : 0.24,
    scent,
    sound: tuned ? 0.97 : panel === 'wind' ? 0.2 + (1 - Math.min(1, Math.abs(tuning - TUNE_TARGET) / 0.4)) * 0.6 : 0.3,
  }

  const triggerCurrentActAction = () => {
    if (act === 1) {
      setPanel('focus')
      sceneRef.current?.focusTarget('flower', 2.0)
    } else if (act === 2) {
      openWindPanel()
    } else if (act === 8) {
      jumpToAct(8)
    } else {
      handleActRow(act)
    }
  }

  const currentActButtonLabel: Record<ActId, string> = {
    1: '转动对焦环',
    2: '校准风声',
    3: '去孤树吹蒲公英',
    4: '唤醒石拱回声',
    5: '伸手接晚雨',
    6: '湖畔唤流萤',
    7: '仰望连星',
    8: '直抵地心深处',
  }

  const morningBlurPx =
    phase === 'explore' && act === 1 && panel === 'focus'
      ? Math.max(0, Number((Math.pow(1 - focusProgress, 1.35) * 4.2).toFixed(2)))
      : 0

  const currentIntroBeat = INTRO_CALL_BEATS[introBeat] ?? INTRO_CALL_BEATS[0]
  const currentDescentCaption =
    [...DESCENT_CAPTIONS].reverse().find((item) => depthKm >= item.thresholdKm) ?? DESCENT_CAPTIONS[0]
  const descentLayerIndex = Math.max(
    0,
    DESCENT_CAPTIONS.findIndex((item) => item.layer === currentDescentCaption.layer),
  )
  const quoteKey = quote?.key ?? null
  const quoteChoices = quote?.data.choices
  const choiceId = selectedChoice?.id ?? null
  const loreId = lore?.id ?? null
  const activeQuoteVoiceId = quoteKey ? (choiceId ? `choice-${choiceId}` : `quote-${quoteKey}`) : null
  const activeQuoteVoiceMode: VoiceMode = quoteKey === 'stars' ? 'deep' : 'headset'

  useEffect(() => {
    if (!active) voicePlayer.stop()
  }, [active])

  useEffect(() => () => voicePlayer.stop(), [])

  useEffect(() => {
    if (!active || phase !== 'intro_call') return
    void voicePlayer.play(`intro-${introBeat}`, introBeat === 0 ? 'clear' : 'headset')
    if (introBeat + 1 < INTRO_CALL_BEATS.length) {
      void voicePlayer.preload(`intro-${introBeat + 1}`)
    }
  }, [active, phase, introBeat])

  useEffect(() => {
    if (!active || phase !== 'explore' || !quoteKey) return
    const mode: VoiceMode = quoteKey === 'stars' ? 'deep' : 'headset'
    if (choiceId) {
      void voicePlayer.play(`choice-${choiceId}`, mode)
      return
    }
    void voicePlayer.play(`quote-${quoteKey}`, mode)
    quoteChoices?.forEach((c) => {
      void voicePlayer.preload(`choice-${c.id}`)
    })
  }, [active, phase, quoteKey, choiceId, quoteChoices])

  useEffect(() => {
    if (!active || !loreId) return
    void voicePlayer.play(`egg-${loreId}`, loreId === 'tablet' ? 'clear' : 'headset')
  }, [active, loreId])

  useEffect(() => {
    if (!active || !attenuating) return
    void voicePlayer.play('truth', 'clear')
    void voicePlayer.preload('descent-0')
  }, [active, attenuating])

  useEffect(() => {
    if (!active || phase !== 'descending') return
    void voicePlayer.play(`descent-${descentLayerIndex}`, 'deep')
    if (descentLayerIndex + 1 < DESCENT_CAPTIONS.length) {
      void voicePlayer.preload(`descent-${descentLayerIndex + 1}`)
    }
  }, [active, phase, descentLayerIndex])

  useEffect(() => {
    if (!active || phase !== 'epilogue') return
    void voicePlayer.play('epilogue-final', 'clear')
  }, [active, phase])

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        active ? 'opacity-100' : 'pointer-events-none invisible opacity-0'
      }`}
      onPointerDown={() => hint && setHint(false)}
    >
      <div
        ref={hostRef}
        className="absolute inset-0 transition-[filter,transform] duration-200 ease-out"
        style={{
          filter: morningBlurPx > 0.1 ? `blur(${morningBlurPx}px)` : undefined,
          transform: morningBlurPx > 0.1 ? `scale(${1 + (1 - focusProgress) * 0.035})` : undefined,
        }}
      />
      <div className="vignette-overlay" />

      {focusSnap && (
        <div
          className="pointer-events-none fixed inset-0 z-20"
          style={{
            background: 'radial-gradient(circle at 50% 48%, rgba(255, 240, 206, 0.38), transparent 65%)',
            animation: 'visionFlash 0.7s ease-out both',
          }}
        />
      )}

      {/* Expanding ripple & spark bursts from interactive taps */}
      {tapRipples.map((item) => (
        <div
          key={item.id}
          className="ripple-burst pointer-events-none fixed z-[37] h-16 w-16 rounded-full border-2"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            borderColor: item.color,
            boxShadow: `0 0 22px ${item.color}`,
          }}
        />
      ))}

      {fireflySparks.map((spark) => (
        <div
          key={spark.id}
          className="spark-firefly pointer-events-none fixed z-[37] flex h-6 w-6 items-center justify-center"
          style={{ left: `${spark.x}px`, top: `${spark.y}px` }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full bg-[#ffe8be]"
            style={{ boxShadow: '0 0 18px 6px rgba(242,194,139,0.9)' }}
          />
        </div>
      ))}

      {/* Act V interactive falling raindrops across live screen */}
      {phase === 'explore' && panel === 'rain' && !quote && (
        <div className="pointer-events-none fixed inset-0 z-[32] overflow-hidden">
          {dropColumns.map((drop) => (
            <button
              key={`${drop.id}-${drop.nonce}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                catchRainDrop(drop.id, event.clientX, event.clientY)
              }}
              aria-label="点住这滴晚雨"
              className="rain-drop-target pointer-events-auto absolute top-0 flex h-14 w-12 -translate-x-1/2 items-center justify-center rounded-full focus:outline-none"
              style={{
                left: drop.left,
                animationDelay: drop.delay,
                ['--rain-dur' as string]: drop.dur,
              }}
            >
              <span
                className="flex h-7 w-4 items-end justify-center rounded-full border border-[#d6ecff]/70 bg-gradient-to-b from-white/55 via-[#b8dcff]/35 to-[#82c0ff]/75 shadow-[0_0_16px_rgba(185,220,255,0.65)] transition hover:scale-125"
                style={{ borderRadius: '50% 50% 50% 50% / 64% 64% 36% 36%' }}
              >
                <span className="mb-1 h-1.5 w-1.5 rounded-full bg-white/85" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Act VI fullscreen click/tap dusk lake to herd fireflies */}
      {phase === 'explore' && panel === 'fireflies' && !quote && (
        <div
          className="fixed inset-0 z-[32] cursor-crosshair"
          onClick={(event) => wakeFirefly(event.clientX, event.clientY)}
          aria-label="轻点暮色湖畔唤醒流萤"
        />
      )}

      {phase === 'explore' && hover && !quote && !lore && !attenuating && (
        <div
          className="pointer-events-none fixed z-[39] hidden -translate-x-1/2 -translate-y-1/2 sm:block"
          style={{ left: `${hover.x}px`, top: `${hover.y}px` }}
          aria-hidden="true"
        >
          <div className="relative h-11 w-11">
            <span className="absolute left-0 top-0 h-2.5 w-2.5 rounded-tl-sm border-l-[1.5px] border-t-[1.5px] border-signal/85 shadow-[0_0_8px_rgba(242,194,139,0.5)]" />
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-tr-sm border-r-[1.5px] border-t-[1.5px] border-signal/85 shadow-[0_0_8px_rgba(242,194,139,0.5)]" />
            <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-bl-sm border-b-[1.5px] border-l-[1.5px] border-signal/85 shadow-[0_0_8px_rgba(242,194,139,0.5)]" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-br-sm border-b-[1.5px] border-r-[1.5px] border-signal/85 shadow-[0_0_8px_rgba(242,194,139,0.5)]" />
            <span className="cinema-gem absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
          </div>
          <div className="cinema-surface-soft hud-ink-soft mt-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-signal/35 px-3 py-1 font-serif text-[11.5px] tracking-[0.04em] text-[#fff8ee]">
            <span className="text-signal">{PICK_LABELS[hover.id]}</span>
            <span className="text-white/40">·</span>
            <span className="text-white/75">{hover.distance.toFixed(1)} m</span>
          </div>
        </div>
      )}

      {phase === 'explore' && Math.abs(zoom - 1) > 0.05 && (
        <div className="pointer-events-none fixed left-1/2 top-[112px] z-30 -translate-x-1/2 sm:top-[80px]">
          <div className="rounded-full border border-white/14 bg-[#0d172e]/70 px-3.5 py-1 font-serif text-[11px] tracking-[0.08em] text-signal backdrop-blur-md">
            光学变焦 {zoom.toFixed(1)}x
          </div>
        </div>
      )}

      {phase === 'ritual' && (
        <IntroRitual
          opening={opening}
          onEnter={begin}
          resumeLabel={resumeLabel}
          onResume={resumeAct ? resumeFromCover : undefined}
          echo={echo}
          echoRead={journey.echoReadDay === echo?.day}
          flashSafe={flashSafe}
          onToggleFlashSafe={onToggleFlashSafe}
          onListenEcho={(code) => {
            markEchoRead(echo?.day ?? todayKey())
            onListenEcho?.(code)
          }}
        />
      )}

      {/* Beat-by-beat cinema opening headset subtitles */}
      {phase === 'intro_call' && (
        <div
          className="fixed inset-x-0 bottom-0 z-[42] flex cursor-pointer flex-col items-center px-4 pb-[max(1.4rem,env(safe-area-inset-bottom))] sm:pb-8"
          onClick={advanceIntroBeat}
        >
          <div
            key={introBeat}
            className="cinema-caption cinema-surface w-full max-w-[660px] rounded-[26px] px-6 py-5 sm:px-8 sm:py-6"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-serif text-[12px] tracking-[0.08em] text-signal">
                <span className="h-2 w-2 rounded-full bg-signal animate-[blinkDot_1.8s_ease-in-out_infinite]" />
                <span>{currentIntroBeat.speaker}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void voicePlayer.unlock()
                    void voicePlayer.toggle(`intro-${introBeat}`, introBeat === 0 ? 'clear' : 'headset')
                  }}
                  aria-label="播音或重听开场语音"
                  className="flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/[0.08] px-2.5 py-0.5 font-serif text-[11px] text-signal transition hover:border-signal/60 hover:bg-signal/[0.15]"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-signal ${
                      voiceState.playingId === `intro-${introBeat}` || voiceState.loadingId === `intro-${introBeat}`
                        ? 'animate-[blinkDot_1.2s_ease-in-out_infinite]'
                        : 'opacity-55'
                    }`}
                  />
                  <span>
                    {voiceState.playingId === `intro-${introBeat}`
                      ? '播音中 · 暂停'
                      : voiceState.loadingId === `intro-${introBeat}`
                        ? '载入中'
                        : '重听语音'}
                  </span>
                </button>
                <span className="font-mono text-[10.5px] text-white/45">
                  {currentIntroBeat.timeLabel} · {introBeat + 1}/{INTRO_CALL_BEATS.length}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    skipIntroToExplore()
                  }}
                  className="rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-0.5 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
                >
                  跳过 ›
                </button>
              </div>
            </div>
            <p className="mt-3 font-serif text-[16px] font-light leading-[1.85] tracking-[0.04em] text-[#fff8ee] sm:text-[18px]">
              {currentIntroBeat.text}
            </p>
            {currentIntroBeat.sub && (
              <p className="mt-2 font-serif text-[12.5px] leading-[1.7] text-white/58">
                {currentIntroBeat.sub}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {INTRO_CALL_BEATS.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === introBeat ? 'w-5 bg-signal' : idx < introBeat ? 'w-1.5 bg-signal/50' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    exitToRitual()
                  }}
                  className="font-serif text-[11.5px] text-white/50 transition hover:text-white/85"
                >
                  回到封面
                </button>
                <span className="font-serif text-[12px] tracking-[0.08em] text-signal/90">
                  {introBeat < INTRO_CALL_BEATS.length - 1 ? '轻点继续 ›' : '戴好眼镜 · 看清这片晨雾 ›'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <FieldJournalModal
        open={phase === 'explore' && journalOpen}
        cluesFound={cluesFound}
        eggsFound={eggsFound}
        memories={memories}
        act={act}
        onClose={() => setJournalOpen(false)}
      />

      {(phase === 'explore' || phase === 'descending' || phase === 'core_pulse') && (
        <SensorHud
          readings={readings}
          act={act}
          place={place}
          depthKm={depthKm}
          depthRevealed={depthRevealed}
          pressureAlert={pressureAlert}
          signal={signal}
          phase={phase}
          tuned={tuned}
          eggsFound={eggsFound}
          cluesFound={cluesFound}
          onOpenJournal={phase === 'explore' ? () => setJournalOpen(true) : undefined}
        />
      )}

      {phase === 'explore' && !finalizing && !attenuating && (
        <div className="cinema-surface-soft pointer-events-auto fixed right-4 top-[78px] z-30 hidden items-center gap-1 rounded-full px-2 py-1.5 sm:flex">
          {STEPS.map((item) => {
            const activeAct = item.act === act
            const doneAct = item.act < act
            return (
              <button
                key={item.act}
                type="button"
                onClick={() => handleActRow(item.act)}
                title={`第 ${item.index} 幕 · ${item.title}`}
                aria-label={`跳到第 ${item.index} 幕：${item.title}`}
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-serif text-[11px] transition ${
                  activeAct
                    ? 'bg-signal text-[#170f07] font-medium shadow-[0_0_12px_rgba(242,194,139,0.7)]'
                    : doneAct
                      ? 'bg-signal/18 text-signal hover:bg-signal/30'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.index}
              </button>
            )
          })}
          <span className="mx-0.5 h-3.5 w-px bg-white/15" />
          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            aria-label="打开观测手账（快捷键 J）"
            title="观测手账 (J)"
            className="flex h-6 items-center gap-1 rounded-full px-2 font-serif text-[11px] text-white/78 transition hover:bg-white/10 hover:text-signal"
          >
            <span className="cinema-gem h-1.5 w-1.5 bg-signal/80" />
            <span>手账</span>
          </button>
          <button
            type="button"
            onClick={() => sceneRef.current?.focusTarget('home', 2.2)}
            aria-label="重新环视草原"
            title="重新环视"
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-signal"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12a8 8 0 1 1 2.3 5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M4 18v-5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-[112px] z-40 w-max max-w-[90vw] -translate-x-1/2 sm:top-[82px]">
          <div className="animate-fade-in cinema-surface flex items-center gap-2 rounded-full border-signal/35 px-4 py-2">
            <span className="cinema-gem h-1.5 w-1.5 shrink-0 bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]" />
            <span className="font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">{toast}</span>
          </div>
        </div>
      )}

      {coarsePointer && active && phase === 'explore' && !lore && !finalizing && !attenuating && panel === 'none' && (!quote || quoteCollapsed) && (
        <TouchControls visible onMove={handleMoveAxis} onLook={handleLookAxis} />
      )}

      {coarsePointer && active && phase === 'explore' && !landscapeHintSeen && (
        <LandscapeHint
          onDismiss={() => {
            setLandscapeHintSeen(true)
            updateSettings({ landscapeHintSeen: true })
          }}
        />
      )}

      {/* Default explore bar */}
      {phase === 'explore' && linger && !quote && !lore && !finalizing && !attenuating && (
        <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-center sm:bottom-7">
          <div className="cinema-surface pointer-events-auto flex w-full max-w-[760px] items-center justify-between gap-2.5 rounded-[22px] border-signal/30 px-3.5 py-2.5 sm:gap-5 sm:rounded-[28px] sm:px-7 sm:py-5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center sm:h-14 sm:w-14">
                <svg viewBox="0 0 24 24" className="absolute h-10 w-10 -rotate-90 sm:h-14 sm:w-14" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.8" />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="#f2c28b"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 9}
                    strokeDashoffset={2 * Math.PI * 9 * (1 - linger.left / LINGER_SECONDS)}
                  />
                </svg>
                <span className="font-mono text-[13.5px] leading-none text-signal sm:text-[18px]">{linger.left}</span>
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-[13.5px] tracking-[0.04em] text-[#fff8ee] sm:text-[18px] sm:tracking-[0.05em]">
                  这一段留给你，随便走走看看
                </p>
                <p className="mt-0.5 truncate font-serif text-[11px] tracking-[0.03em] text-white/60 sm:mt-1 sm:text-[12.5px]">
                  倒计时走完自动前往下一幕 · 读彩蛋时会暂停
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => advanceFromQuote(linger.key)}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-signal/50 bg-signal/15 px-3.5 py-1.5 font-serif text-[12.5px] tracking-[0.04em] text-[#fff8ee] transition hover:border-signal/80 hover:bg-signal/25 active:scale-95 sm:gap-2 sm:px-6 sm:py-3 sm:text-[14px]"
            >
              <span>{QUOTES[linger.key].nextLabel ?? '继续旅程'}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {phase === 'explore' && !linger && panel === 'none' && !quote && !lore && !finalizing && !attenuating && (
        <div className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-2 sm:bottom-6">
          {hint && (
            <div className="animate-fade-in cinema-surface-soft hud-ink-soft rounded-full px-3.5 py-1 font-serif text-[11.5px] text-white/82">
              {coarsePointer
                ? '左摇杆漫步 · 右摇杆环顾 · 点击光点读她的细语'
                : '拖拽环顾 · WASD / 点击漫步 · 按住 Shift 迎风滑步 · 空格心光 · J 手账'}
            </div>
          )}

          <div className="cinema-surface pointer-events-auto flex w-full max-w-[780px] flex-wrap items-center justify-between gap-2.5 rounded-3xl px-4 py-2.5 sm:flex-nowrap sm:rounded-full sm:py-2 sm:pl-5 sm:pr-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="cinema-gem h-2 w-2 shrink-0 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
              <p className="truncate font-serif text-[13px] tracking-[0.04em] text-[#fff8ee]/92 sm:text-[13.5px]">
                {act === 2
                  ? `轻划湖面传去水声 (${lakeRipples}/2)，或直接校准风声`
                  : step.hint}
              </p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={triggerSkyCall}
                aria-label="发出心光呼唤（快捷键 空格）"
                className="flex items-center gap-1.5 rounded-full border border-signal/35 bg-signal/10 px-3 py-1.5 font-serif text-[12px] text-[#fff8ee] transition hover:border-signal/65 hover:bg-signal/20 active:scale-95"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                <span>心光呼唤</span>
              </button>
              <button
                type="button"
                onClick={triggerCurrentActAction}
                className="rounded-full bg-signal px-4 py-1.5 font-serif text-[12.5px] font-medium tracking-[0.04em] text-[#170f07] shadow-[0_6px_18px_-6px_rgba(242,194,139,0.75)] transition hover:brightness-105 active:scale-95"
              >
                {currentActButtonLabel[act]}
              </button>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/12 bg-[#0d172e]/62 px-2 py-1 backdrop-blur-md sm:hidden">
            {STEPS.map((item) => {
              const activeAct = item.act === act
              return (
                <button
                  key={item.act}
                  type="button"
                  onClick={() => handleActRow(item.act)}
                  aria-label={`跳到第 ${item.index} 幕`}
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-serif text-[11px] transition ${
                    activeAct ? 'bg-signal text-[#170f07] font-medium' : 'text-white/60'
                  }`}
                >
                  {item.index}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Act I Optical Focus Pull */}
      {phase === 'explore' && panel === 'focus' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[540px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 I 幕 · 06:40 · 晨雾对焦</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-light tracking-[0.08em] text-[#fff8ee]">
              替她看清第一朵花
            </h2>
            <p className="mx-auto mt-2 max-w-[25rem] font-serif text-[13px] font-light leading-[1.85] text-white/70">
              镜片上还蒙着草原清晨的露雾。拖动下方对焦滑轨，或长按光学环直到视野清晰。
            </p>

            <div className="mt-4 flex items-center gap-3 px-2">
              <span className="font-mono text-[10px] tracking-[0.1em] text-white/50">FOG</span>
              <div className="relative flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#a88762] to-[#fff0d4] transition-[width] duration-75"
                    style={{ width: `${Math.round(focusProgress * 100)}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={focusProgress}
                  onChange={(event) => updateFocus(Number(event.target.value))}
                  aria-label="传感眼镜光学焦距"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              <span className="w-10 text-right font-mono text-[11px] text-signal">
                {Math.round(focusProgress * 100)}%
              </span>
            </div>

            <button
              type="button"
              onPointerDown={startFocusHold}
              onPointerUp={stopFocusHold}
              onPointerLeave={stopFocusHold}
              onPointerCancel={stopFocusHold}
              className="btn-primary mt-5 select-none"
            >
              按住光学对焦环 · 散开晨雾
            </button>
          </div>
        </div>
      )}

      {/* Act II Lake & Wind Resonance */}
      {phase === 'explore' && panel === 'wind' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
          <div className="cinema-surface pointer-events-auto animate-fade-up no-scrollbar relative max-h-[calc(100dvh-5rem)] w-full max-w-[720px] overflow-y-auto rounded-[26px] p-4 sm:max-h-none sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="-mb-10 -mt-4 scale-[0.78] rounded-full bg-[#091122]/75 p-1 sm:m-0 sm:scale-100">
                <CalibrationDial value={tuning} inZone={inZone} onChange={changeTuning} />
              </div>
              <div className="flex-1 pb-2 text-center sm:pb-0 sm:text-left">
                <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 II 幕 · 09:30 · 湖畔风声</div>
                <h2 className="mt-1.5 font-serif text-[22px] font-light tracking-[0.08em] text-[#fff8ee]">湖畔的风声</h2>
                <p className="mt-2 font-serif text-[13px] font-light leading-[1.9] tracking-[0.04em] text-white/70">
                  水声先落了下来。现在转动刻度环，对准金色共振带，让草原的长风穿过耳机。
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 font-serif text-[12px] sm:justify-start">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${inZone ? 'bg-signal animate-[blinkDot_1s_ease-in-out_infinite]' : 'bg-white/30'}`}
                  />
                  <span className={inZone ? 'text-signal' : 'text-white/55'}>
                    {inZone ? '已进入共振区间 · 保持 0.7 秒' : '正在杂音中寻找风声…'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
                  <button type="button" className="btn-ghost" onClick={autoAlign}>
                    自动对齐
                  </button>
                  {windHint && (
                    <span className="font-serif text-[11.5px] text-signal/75 animate-[blinkSoft_2s_ease-in-out_infinite]">
                      卡住了？点一下自动对齐
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Act III Lone Tree & Dandelion Swell */}
      {phase === 'explore' && panel === 'dandelion' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 III 幕 · 13:15 · 孤树山坡</div>
            <h2 className="mt-1.5 font-serif text-[23px] font-light tracking-[0.1em] text-[#fff8ee]">孤树下的蒲公英</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-light leading-[1.9] tracking-[0.04em] text-white/70">
              树梢木风铃还在轻轻作响。按住（或轻点）按钮汇聚午后暖风，把白色绒毛送向湖谷。
            </p>
            <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffd9a3] to-[#fff5d6] transition-[width] duration-75"
                style={{ width: `${blowCharge}%` }}
              />
            </div>
            <button
              type="button"
              className="btn-primary mt-5 select-none"
              onPointerDown={startBlowHold}
              onPointerUp={releaseBlowHold}
              onPointerLeave={releaseBlowHold}
              onPointerCancel={releaseBlowHold}
            >
              长按聚风 · 吹散蒲公英
            </button>
            <p className="mt-3 font-serif text-[12px] text-white/55">
              {blowCharge > 0 ? `正在凝聚午后暖风 ${Math.round(blowCharge)}%` : '松开即会顺风飘起'}
            </p>
          </div>
        </div>
      )}

      {/* Act IV Stone Archway Breathing Resonance */}
      {phase === 'explore' && panel === 'ruin' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 IV 幕 · 15:50 · 山腰石拱</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-light tracking-[0.1em] text-[#fff8ee]">唤醒古老石拱</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-light leading-[1.85] text-white/70">
              石拱正中央的刻石微弱发亮。轻点下方呼吸共鸣环三次（或按空格键），听山谷替她应答。
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    index < ruinPulses
                      ? 'bg-signal shadow-[0_0_12px_rgba(242,194,139,0.95)]'
                      : 'border border-white/25 bg-white/[0.04]'
                  }`}
                />
              ))}
              <span className="ml-1 font-mono text-[11px] text-signal">{ruinPulses}/3</span>
            </div>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={(event) => triggerRuinPulse(event.clientX, event.clientY)}
                className="relative flex h-20 w-20 items-center justify-center rounded-full border border-signal/60 bg-signal/15 font-serif text-[13px] text-[#fff8ee] shadow-[0_0_28px_rgba(242,194,139,0.35)] transition hover:scale-105 active:scale-95"
              >
                <span className="breathe-ring pointer-events-none absolute -inset-3 rounded-full border border-signal/45" />
                <span>呼唤</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Act V Interactive Raindrop Catch */}
      {phase === 'explore' && panel === 'rain' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 V 幕 · 18:10 · 黄昏晚雨</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-light tracking-[0.1em] text-[#fff8ee]">点住空中飘落的雨滴</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-light leading-[1.85] text-white/70">
              点击画面上缓缓落下的光亮雨点，把四年后的第一场雨传进她的耳机里。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              {Array.from({ length: RAIN_TARGET_COUNT }, (_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    index < rainCatches
                      ? 'bg-[#b9d2ff] shadow-[0_0_12px_rgba(185,210,255,0.9)]'
                      : 'border border-white/20 bg-white/[0.03]'
                  }`}
                />
              ))}
              <span className="ml-2 font-mono text-[11px] tracking-[0.14em] text-white/65">
                {rainCatches}/{RAIN_TARGET_COUNT}
              </span>
            </div>
            <button
              type="button"
              className="btn-ghost mt-4"
              onClick={(event) => catchRainDrop(undefined, event.clientX, event.clientY)}
            >
              直接伸手接住一滴
            </button>
          </div>
        </div>
      )}

      {/* Act VI Interactive Fireflies around the Rowboat */}
      {phase === 'explore' && panel === 'fireflies' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 VI 幕 · 19:45 · 轻舟守夜</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-light tracking-[0.1em] text-[#fff8ee]">轻点暮色，唤来流萤</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-light leading-[1.85] text-white/70">
              轻点上方湖畔木船周围的任意角落，每一处触碰都会升起一簇流萤。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: FIREFLY_TARGET_COUNT }, (_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    index < fireflyCount
                      ? 'bg-signal shadow-[0_0_12px_rgba(242,194,139,0.9)]'
                      : 'border border-white/20 bg-white/[0.03]'
                  }`}
                />
              ))}
              <span className="ml-2 font-mono text-[10.5px] tracking-[0.16em] text-white/60">
                {fireflyCount}/{FIREFLY_TARGET_COUNT}
              </span>
            </div>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={(event) => wakeFirefly(event.clientX, event.clientY - 120)}
            >
              在船畔唤醒一簇流萤 ({fireflyCount}/{FIREFLY_TARGET_COUNT})
            </button>
          </div>
        </div>
      )}

      {/* Act VII Star Constellation */}
      {phase === 'explore' && panel === 'constellation' && !quote && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[540px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={dismissPanel}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 VII 幕 · 22:30 · 专属星河</div>
            <h2 className="mt-1.5 font-serif text-[23px] font-light tracking-[0.1em] text-[#fff8ee]">亲手连起夜空三颗星</h2>
            <p className="mx-auto mt-2 max-w-[25rem] font-serif text-[13px] font-light leading-[1.9] tracking-[0.04em] text-white/70">
              夜空中亮着三颗最温柔的星。依次点亮它们，在信号熄灭前连起属于你们的星座。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] transition-all duration-500 ${
                    index < constellationCount
                      ? 'border-signal/60 bg-signal/20 text-signal shadow-[0_0_14px_rgba(242,194,139,0.45)]'
                      : 'border-white/20 text-white/55'
                  }`}
                >
                  {index + 1}
                </span>
              ))}
              <span className="ml-1 font-mono text-[11px] tracking-[0.14em] text-white/60">{constellationCount}/3</span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" className="btn-ghost" onClick={autoConnect}>
                帮我连上这三颗星
              </button>
              {constellationHint && (
                <span className="font-serif text-[11.5px] text-signal/80 animate-[blinkSoft_2s_ease-in-out_infinite]">
                  找不到星点？点左键交给它
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Literary Quote + Clues + Dialogue Choice Card */}
      {quote && phase !== 'descending' && phase !== 'core_pulse' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[36] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6">
          <div
            className={`cinema-surface pointer-events-auto animate-fade-up no-scrollbar relative w-full max-w-[660px] overflow-y-auto rounded-[26px] p-5 sm:p-7 ${
              quoteCollapsed ? '' : 'max-h-[45dvh]'
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 w-px"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(242,194,139,0.65), transparent)' }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-serif text-[12px] tracking-[0.1em] text-signal/85">{quote.data.eyebrow}</span>
              <span className="flex items-center gap-2">
                {activeQuoteVoiceId && (
                  <button
                    type="button"
                    onClick={() => {
                      void voicePlayer.unlock()
                      void voicePlayer.toggle(activeQuoteVoiceId, activeQuoteVoiceMode)
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/[0.08] px-2.5 py-1 font-serif text-[11.5px] text-signal/95 transition hover:border-signal/60 hover:bg-signal/[0.16]"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-signal ${
                        voiceState.playingId === activeQuoteVoiceId || voiceState.loadingId === activeQuoteVoiceId
                          ? 'animate-[blinkDot_1.2s_ease-in-out_infinite]'
                          : 'opacity-60'
                      }`}
                    />
                    <span>
                      {voiceState.playingId === activeQuoteVoiceId
                        ? '林微 · 播音中'
                        : voiceState.loadingId === activeQuoteVoiceId
                          ? '载入语音…'
                          : '林微的声音 · 重听'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQuoteCollapsed((v) => !v)}
                  aria-expanded={!quoteCollapsed}
                  className="flex items-center gap-1 rounded-full border border-white/16 px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-[#fff8ee]"
                >
                  <span>{quoteCollapsed ? '展开对话' : '看风景'}</span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={quoteCollapsed ? '' : 'rotate-180'}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </span>
            </div>

            {!quoteCollapsed && (
              <>

            {quote.data.clue && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1 font-serif text-[11.5px] text-[#ffd4c4]">
                <span className="cinema-gem h-1.5 w-1.5 bg-ember" />
                {quote.data.clue.label}
              </div>
            )}

            <div className="mt-3.5 space-y-1.5">
              {quote.data.lines.map((line, index) => (
                <p
                  key={line}
                  className="quote-line font-serif text-[15.5px] font-light leading-[1.9] tracking-[0.05em] text-[#fff8ee] sm:text-[17px]"
                  style={{ animationDelay: `${0.1 + index * 0.14}s` }}
                >
                  {line}
                </p>
              ))}
            </div>

            {quote.data.choices && quote.data.choices.length > 0 && !selectedChoice && (
              <div className="mt-5 border-t border-white/10 pt-4">
                {quote.data.question && (
                  <p className="mb-3 font-serif text-[13.5px] tracking-[0.05em] text-signal/90">
                    {quote.data.question}
                  </p>
                )}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {quote.data.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => pickDialogueChoice(choice)}
                      className="rounded-2xl border border-signal/28 bg-signal/[0.06] px-4 py-3 text-left font-serif text-[13px] leading-[1.65] tracking-[0.04em] text-[#fff8ee]/92 transition hover:border-signal/65 hover:bg-signal/[0.14]"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedChoice && (
              <div className="mt-4 border-l-2 border-signal/60 pl-4">
                <div className="font-serif text-[12px] tracking-[0.06em] text-signal/85">
                  你回应：{selectedChoice.label}
                </div>
                <div className="mt-2 space-y-1">
                  {selectedChoice.reply.map((line, index) => (
                    <p
                      key={line}
                      className="quote-line font-serif text-[15px] font-light leading-[1.85] tracking-[0.05em] text-[#fff2dc]"
                      style={{ animationDelay: `${0.06 + index * 0.14}s` }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {(!quote.data.choices?.length || selectedChoice) && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[10px] tracking-[0.14em] text-white/48">{quote.data.signature}</span>
                <button type="button" className="btn-primary !px-5 !py-2.5 !text-[11px]" onClick={continueQuote}>
                  {quote.data.nextLabel ?? '继续'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden Easter Eggs */}
      {lore && (
        <div className="fixed inset-0 z-[38] flex items-center justify-center bg-[#030712]/48 px-4 backdrop-blur-sm">
          <div className="cinema-surface animate-fade-up relative w-full max-w-[520px] overflow-hidden rounded-[26px] p-6 text-center sm:p-8">
            <div
              className="mx-auto mb-4 flex h-10 w-10 rotate-45 items-center justify-center rounded-[8px] border"
              style={{ borderColor: `${lore.accent}60`, background: `${lore.accent}14` }}
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: lore.accent, boxShadow: `0 0 14px ${lore.accent}` }}
              />
            </div>
            <div className="hud-label !text-[9px]">{lore.kicker}</div>
            <h3 className="mt-2 font-serif text-[22px] font-light tracking-[0.08em] text-white/92">{lore.title}</h3>
            <div className="mt-4 space-y-1.5">
              {lore.lines.map((line, index) => (
                <p
                  key={line}
                  className="quote-line font-serif text-[14.5px] font-light leading-[1.95] tracking-[0.05em] text-white/70"
                  style={{ animationDelay: `${index * 0.14}s` }}
                >
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-4 font-mono text-[10px] tracking-[0.18em] text-white/38">{lore.signature}</div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  void voicePlayer.unlock()
                  void voicePlayer.toggle(`egg-${lore.id}`, lore.id === 'tablet' ? 'clear' : 'headset')
                }}
              >
                {voiceState.playingId === `egg-${lore.id}` ? '暂停语音' : '重听回声'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  voicePlayer.stop()
                  setLore(null)
                }}
              >
                收好这段回声
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chromatic Depth Unsealed Overlay */}
      {attenuating && (
        <div className="pointer-events-none fixed inset-0 z-[45]">
          <div className="attenuation-overlay" />
          <div className="chromatic-stress relative flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="glitch-text font-mono text-[10px] tracking-[0.28em] text-[#ffb18a] sm:text-[11.5px]">
              {TRUTH.tag} <span className="mx-2 text-white/25">//</span> DEPTH UNSEALED
            </div>
            <div className="hud-value mt-4 flex items-baseline gap-2 text-[#ffd0bd]">
              <span className="text-[clamp(54px,10vw,104px)] font-light leading-none text-glow-ember">{TRUTH.depth}</span>
              <span className="text-[11px] tracking-[0.24em] text-white/45">{TRUTH.unit}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.34em] text-[#ff8f70]">{TRUTH.subtitle}</div>
            <div className="mt-6 space-y-1.5">
              {TRUTH.lines.map((line, index) => (
                <p
                  key={line}
                  className="quote-line font-serif text-[15px] font-light leading-[1.9] tracking-[0.08em] text-white/80"
                  style={{ animationDelay: `${0.1 + index * 0.16}s` }}
                >
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="rounded-full border border-[#ff795a]/35 bg-[#ff5a3c]/[0.08] px-3 py-1 font-mono text-[9.5px] tracking-[0.16em] text-[#ffad96]">
                {TRUTH.warning}
              </span>
              <span className="font-mono text-[9.5px] tracking-[0.2em] text-white/38">{TRUTH.vessel}</span>
            </div>
          </div>
        </div>
      )}

      {/* Act VIII Core Descent with Layered Narrative Captions */}
      {phase === 'descending' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center px-4 pb-[max(1.4rem,env(safe-area-inset-bottom))]">
          <div
            key={currentDescentCaption.layer}
            className="cinema-caption mb-4 max-w-[34rem] rounded-full border border-ember/25 bg-[#120b0d]/68 px-5 py-2 text-center backdrop-blur-md"
          >
            <div className="font-mono text-[9.5px] tracking-[0.24em] text-ember">{currentDescentCaption.layer}</div>
            <p className="mt-0.5 font-serif text-[13px] tracking-[0.04em] text-[#ffe8d6]">
              {currentDescentCaption.line}
            </p>
          </div>
          <div className="hud-value flex items-baseline gap-2 text-[#ffd9b8] text-glow-ember">
            <span className="text-[clamp(40px,7vw,64px)] font-light leading-none">
              {depthKm.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-[11px] tracking-[0.24em] text-white/45">KM</span>
          </div>
          <div className="mt-2 h-[2px] w-48 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember/50 via-ember to-[#ffe4c2] transition-[width] duration-200"
              style={{ width: `${Math.min(100, (depthKm / 6371.4) * 100)}%` }}
            />
          </div>
          <div className="mt-2 font-mono text-[9.5px] tracking-[0.22em] text-[#ffad96]/80">
            EARTH CORE · SIGNAL {(signal * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {flash && <div className="breach-flash" />}

      {/* Act VIII Core Beat: Facing PBR Sunset-06 Vessel */}
      {phase === 'core_pulse' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[44] flex flex-col items-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
          <div className="cinema-caption flex flex-col items-center">
            <p className="max-w-[30rem] font-serif text-[14.5px] leading-[1.85] tracking-[0.05em] text-[#fff0dc]/90">
              6,371.4 公里深处，落日六号的琥珀色信标仍在铁镍海里一下一下闪亮。
            </p>
            <button
              type="button"
              onClick={respondCoreHeartbeat}
              className="btn-primary pointer-events-auto relative mt-5"
            >
              <span className="breathe-ring pointer-events-none absolute -inset-2 rounded-full border border-signal/55" />
              <span className="h-2 w-2 rounded-full bg-[#170f07]" />
              <span>回应她的心跳</span>
            </button>
          </div>
        </div>
      )}

      {/* Epilogue & Cross-Chapter Relay Handoff */}
      {phase === 'epilogue' && (
        <div className="pointer-events-none fixed inset-0 z-[46] flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-t from-[#091122] via-[#091122]/80 to-transparent" />
          <div className="ending-rise no-scrollbar relative mx-auto max-h-dvh w-full max-w-[780px] overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-20 text-center">
            <button
              type="button"
              onClick={() => {
                void voicePlayer.unlock()
                void voicePlayer.toggle('epilogue-final', 'clear')
              }}
              className="pointer-events-auto mx-auto mb-4 flex w-max items-center gap-2 rounded-full border border-signal/35 bg-signal/10 px-3.5 py-1.5 font-serif text-[11.5px] tracking-[0.08em] text-signal transition hover:border-signal/65 hover:bg-signal/18"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full bg-signal ${
                  voiceState.playingId === 'epilogue-final'
                    ? 'animate-[blinkDot_1.2s_ease-in-out_infinite]'
                    : 'animate-[blinkDot_2s_ease-in-out_infinite]'
                }`}
              />
              <span>
                {voiceState.playingId === 'epilogue-final'
                  ? '地心深处 · 落日六号正在回应 · 暂停'
                  : '地心深处 · 落日六号仍在回应 · 重听'}
              </span>
            </button>
            <div className="hud-value text-[clamp(48px,8.5vw,92px)] font-light leading-none tracking-[0.04em] text-[#fff8ee]">
              {TRUTH.depth}
              <span className="ml-2 font-mono text-[12px] tracking-[0.22em] text-white/55">{TRUTH.unit}</span>
            </div>
            <div className="mt-1 font-mono text-[10.5px] tracking-[0.26em] text-ember">{TRUTH.subtitle}</div>
            <div className="mt-4 space-y-1">
              {FINAL_LINES.map((line) => (
                <p key={line} className="font-serif text-[15px] font-light leading-[2] tracking-[0.08em] text-white/88 sm:text-[17px]">
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-3 font-serif text-[12px] tracking-[0.08em] text-white/60">{FINAL_CAPTION}</p>
            {(epilogueNote || wishNote) && (
              <div className="mx-auto mt-3 max-w-[32rem] space-y-1">
                {epilogueNote && (
                  <p className="font-serif text-[14px] italic tracking-[0.05em] text-signal">{epilogueNote}</p>
                )}
                {wishNote && (
                  <p className="font-serif text-[12.5px] tracking-[0.04em] text-white/68">石拱心愿：{wishNote}</p>
                )}
              </div>
            )}

            {memories.length > 0 && (
              <div className="cinema-surface-soft pointer-events-auto mx-auto mt-5 flex max-w-[540px] flex-col items-center gap-2.5 rounded-2xl p-3">
                <div className="flex w-full items-center justify-between px-1 font-serif text-[12px] text-signal">
                  <span>落日六号 · 草原一日胶片实拍</span>
                  <span className="text-white/60">{memories.length} 帧可带往第 03 章</span>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
                  {memories.map((frame) => (
                    <div
                      key={frame.act}
                      className="overflow-hidden rounded-lg border border-white/12 bg-black/40"
                      title={`${frame.act} · ${frame.title}`}
                    >
                      <img
                        src={frame.dataUrl}
                        alt={frame.title}
                        className="aspect-video w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pointer-events-auto mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button type="button" className="btn-primary" onClick={() => onNavigate('post')}>
                带着记忆胶片，去第 03 章寄回视野
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('radio')}>
                前往 02 · 为她点亮城市电台
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {memories.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleExportRoll}
                  disabled={exportingRoll}
                >
                  {exportingRoll ? '胶片冲洗中…' : `下载胶片 (${memories.length} 帧)`}
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={restart}>
                重新开始今天
              </button>
              <button type="button" className="btn-ghost" onClick={exitToRitual}>
                回到封面
              </button>
            </div>
            <p className="mt-5 font-mono text-[10px] tracking-[0.16em] text-white/45">
              灵感致敬 · 刘慈欣《带上她的眼睛》 · 故事台词均为原创
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
