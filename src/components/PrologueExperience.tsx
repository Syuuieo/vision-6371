import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ROAM_MUSIC_CYCLE,
  getRoamTrackMeta,
  resolveTrackForHour,
  type RoamMusicPreference,
} from '../audio/roamMusic'
import type { Soundscape } from '../audio/soundscape'
import { type VoiceMode, useVoiceState, voicePlayer } from '../audio/voicePlayer'
import {
  DESCENT_CAPTIONS,
  EASTER_EGGS,
  INTRO_CALL_BEATS,
  QUOTES,
  STEPS,
} from '../data/narrative'
import { WORLD_DISCOVERIES, type WorldDiscoveryId } from '../data/prologueWorldMeta'
import type {
  HoverTargetInfo,
  PlayerTelemetry,
  PrologueScene,
} from '../scenes/PrologueScene'

let prologueScenePromise: Promise<typeof import('../scenes/PrologueScene')> | null = null
function loadPrologueSceneModule() {
  if (!prologueScenePromise) {
    prologueScenePromise = import('../scenes/PrologueScene')
  }
  return prologueScenePromise
}
import { saveAlbumEntry } from '../services/albumStorage'
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
import { CompassBar } from './CompassBar'
import { FieldJournalModal } from './FieldJournalModal'
import { IntroRitual } from './IntroRitual'
import { ActInteractivePanels } from './prologue/ActInteractivePanels'
import { EndingSequenceOverlay } from './prologue/EndingSequenceOverlay'
import { NarrativeModals } from './prologue/NarrativeModals'
import { NeuralVisorOverlay, type VisorPulse } from './prologue/NeuralVisorOverlay'
import { StoryPremiseModal } from './prologue/StoryPremiseModal'
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
const DISCOVERIES_KEY = 'vision6371_discoveries_v1'
const ROAM_MUSIC_KEY = 'vision6371_roam_music_v1'
const PREMISE_SEEN_KEY = 'vision6371_premise_seen_v1'
/** 已通过阿里云百炼 Qwen-TTS（Serena / Ethan / Kai）合成全部新版情感台词，开启序章语音自动播放 */
const PROLOGUE_VOICE_AUTOPLAY = true

function hasSeenPremise(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PREMISE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markPremiseSeen() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREMISE_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

function loadRoamMusicPref(): RoamMusicPreference {
  if (typeof window === 'undefined') return 'auto'
  try {
    const val = window.localStorage.getItem(ROAM_MUSIC_KEY)
    if (val && ROAM_MUSIC_CYCLE.includes(val as RoamMusicPreference)) {
      return val as RoamMusicPreference
    }
  } catch {
    /* ignore */
  }
  return 'auto'
}

function persistRoamMusicPref(pref: RoamMusicPreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ROAM_MUSIC_KEY, pref)
  } catch {
    /* ignore */
  }
}
const VALID_DISCOVERY_IDS: readonly WorldDiscoveryId[] = WORLD_DISCOVERIES.map((d) => d.id)
const MEADOW_QUICK_NOTES = [
  '替你在风起的高崖上，把整片谷地的草浪拍了下来。',
  '这里的日光和风声都很慢，我替你多看了一会儿。',
  '把这段二十四小时之外的天色，写进今天的风里。',
] as const

function loadDiscoveries(): WorldDiscoveryId[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DISCOVERIES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is WorldDiscoveryId =>
      VALID_DISCOVERY_IDS.includes(id as WorldDiscoveryId),
    )
  } catch {
    return []
  }
}

function persistDiscoveries(ids: readonly WorldDiscoveryId[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISCOVERIES_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

function formatClockHour(hour: number): string {
  const norm = ((hour % 24) + 24) % 24
  let h = Math.floor(norm)
  let m = Math.round((norm - h) * 60)
  if (m >= 60) {
    m = 0
    h = (h + 1) % 24
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
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
  flower: '轻触会摇曳的野花',
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
  const [sceneRequested, setSceneRequested] = useState(false)
  const [sceneMounted, setSceneMounted] = useState(false)
  const [premiseMode, setPremiseMode] = useState<'browse' | 'first_entry' | null>(null)
  const [visorPulse, setVisorPulse] = useState<VisorPulse | null>(null)
  const visorTimerRef = useRef<number | null>(null)
  const pendingResumeActRef = useRef<ActId | null>(null)
  const jumpToActRef = useRef<(target: ActId) => void>(() => {})
  const activeRef = useRef(active)
  const stageRef = useRef<SkyStage>(0)
  const [contextLost, setContextLost] = useState(false)
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
  const [descentStage, setDescentStage] = useState<0 | 1 | 2>(0)
  const [coreBursting, setCoreBursting] = useState(false)
  const truthProceededRef = useRef(false)
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
  const [telemetry, setTelemetry] = useState<PlayerTelemetry | null>(null)
  const [discoveriesFound, setDiscoveriesFound] = useState<WorldDiscoveryId[]>(() => loadDiscoveries())
  const [freeRoam, setFreeRoam] = useState(false)
  const [customHour, setCustomHour] = useState(16.5)
  const [musicPref, setMusicPref] = useState<RoamMusicPreference>(() => loadRoamMusicPref())
  const [meadowShot, setMeadowShot] = useState<{ image: string; placeName: string; hour: number } | null>(null)
  const [meadowNote, setMeadowNote] = useState('')
  const [meadowSaved, setMeadowSaved] = useState(false)
  const telemetryRef = useRef<PlayerTelemetry | null>(telemetry)
  const discoveriesRef = useRef<WorldDiscoveryId[]>(discoveriesFound)
  const freeRoamRef = useRef(freeRoam)
  const meadowShotRef = useRef(meadowShot)
  const telemetryHandlerRef = useRef<(t: PlayerTelemetry) => void>(() => {})

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

  const triggerVisorPulse = useCallback(
    (kind: 'boot' | 'scan' | 'core', title: string, subtitle: string, hint?: string) => {
      if (visorTimerRef.current) {
        window.clearTimeout(visorTimerRef.current)
        visorTimerRef.current = null
      }
      const id = fxIdRef.current++
      setVisorPulse({ id, kind, title, subtitle, hint })
      sound.playVisorBoot(kind)
      visorTimerRef.current = window.setTimeout(() => {
        setVisorPulse((prev) => (prev?.id === id ? null : prev))
        visorTimerRef.current = null
      }, 2600)
    },
    [sound],
  )

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
    telemetryRef.current = telemetry
    discoveriesRef.current = discoveriesFound
    freeRoamRef.current = freeRoam
    meadowShotRef.current = meadowShot
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
    telemetry,
    discoveriesFound,
    freeRoam,
    meadowShot,
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
    activeRef.current = active
  }, [active])

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  useEffect(() => {
    if (!sceneRequested) return
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let observer: ResizeObserver | null = null
    let scene: PrologueScene | null = null

    void loadPrologueSceneModule().then(({ PrologueScene: SceneCtor }) => {
      if (cancelled) return
      scene = new SceneCtor()
      sceneRef.current = scene
      scene.setQuality(getSettings().quality)
      scene.setCalmMotion(getSettings().reducedMotion || prefersReducedMotion())
      scene.setPaused(!activeRef.current)
      scene.mount(host, {
        onPick: (id) => pickHandlerRef.current(id),
        onDescentEvent: (event) => descentHandlerRef.current(event),
        onLakeRipple: () => lakeHandlerRef.current(),
        onHoverTarget: (info) => setHover(info),
        onZoomChange: (nextZoom) => setZoom(nextZoom),
        onSkimChange: (amount) => sound.setGrassSkim(amount),
        onPlaceChange: (nextPlace) => setPlace(nextPlace),
        onTelemetry: (nextTelemetry) => telemetryHandlerRef.current(nextTelemetry),
        onBoundary: () => boundaryHandlerRef.current?.(),
        onContextLost: (lost) => setContextLost(lost),
      })
      scene.setDiscoveredIds(discoveriesRef.current)
      scene.setActiveTask(phaseRef.current === 'incoming_call' ? null : 'flower')
      scene.setRoamEnabled(phaseRef.current === 'incoming_call' || phaseRef.current === 'explore')
      scene.setStage(stageRef.current)
      if (pendingResumeActRef.current !== null) {
        const targetAct = pendingResumeActRef.current
        pendingResumeActRef.current = null
        jumpToActRef.current(targetAct)
      } else if (
        phaseRef.current === 'ritual' ||
        phaseRef.current === 'incoming_call' ||
        phaseRef.current === 'intro_call'
      ) {
        scene.focusTarget('home', 3.4)
      }
      setSceneMounted(true)
      observer = new ResizeObserver(() => scene?.resize())
      observer.observe(host)
    })

    return () => {
      cancelled = true
      observer?.disconnect()
      scene?.dispose()
      sceneRef.current = null
    }
  }, [sound, sceneRequested])

  useEffect(() => {
    sceneRef.current?.setPaused(!active)
  }, [active, sceneRequested])

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
    telemetryHandlerRef.current = (next) => {
      setTelemetry(next)
      sound.setRoamMusicMotion(next.speedNorm, Boolean(next.seatedBenchId))
      if (next.nearbyDiscovery && !discoveriesRef.current.includes(next.nearbyDiscovery)) {
        const nextList = [...discoveriesRef.current, next.nearbyDiscovery]
        discoveriesRef.current = nextList
        persistDiscoveries(nextList)
        setDiscoveriesFound(nextList)
        sceneRef.current?.setDiscoveredIds(nextList)
        const meta = WORLD_DISCOVERIES.find((d) => d.id === next.nearbyDiscovery)
        sound.playChime([523.25, 659.25, 783.99], 0.055, 2.2)
        if (meta) {
          showToast(`发现新地标 · ${meta.name}（${nextList.length}/${WORLD_DISCOVERIES.length}）`, 3400)
        }
      }
    }
  }, [showToast, sound])

  useEffect(() => {
    sceneRef.current?.setDiscoveredIds(discoveriesFound)
  }, [discoveriesFound])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || freeRoam) return
    scene.setStage(stage)
    scene.setClock(clockHour)
  }, [stage, clockHour, freeRoam])

  const effectiveMusicHour = freeRoam ? customHour : clockHour
  const activeMusicTrack = getRoamTrackMeta(
    musicPref === 'auto' || musicPref === 'off' ? resolveTrackForHour(effectiveMusicHour) : musicPref,
  )

  useEffect(() => {
    sound.setRoamMusicPreference(musicPref)
  }, [musicPref, sound])

  useEffect(() => {
    sound.setRoamMusicHour(effectiveMusicHour)
  }, [effectiveMusicHour, sound])

  useEffect(() => {
    const presence = freeRoam ? 1.0 : linger ? 0.85 : 0.62
    sound.setRoamMusicPresence(presence, freeRoam ? 0.9 : 1.3)
  }, [freeRoam, linger, sound])

  useEffect(() => {
    sound.setRoamMusicDucked(Boolean(voiceState.playingId || quote || lore))
  }, [lore, quote, sound, voiceState.playingId])

  useEffect(() => {
    sceneRef.current?.setActiveTask(activeTask)
  }, [activeTask, sceneRequested])

  useEffect(() => {
    const enabled =
      active &&
      (phase === 'explore' || phase === 'incoming_call') &&
      !lore &&
      !finalizing &&
      !meadowShot
    sceneRef.current?.setRoamEnabled(enabled)
  }, [active, phase, lore, finalizing, meadowShot, sceneRequested])

  useEffect(() => {
    if (!active || phase !== 'incoming_call') return
    sound.playCommsIncoming()
    const timer = window.setInterval(() => {
      sound.playCommsIncoming()
    }, 4200)
    return () => {
      window.clearInterval(timer)
    }
  }, [active, phase, sound])

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
    sceneRef.current?.emitSkyCall(discoveriesRef.current)
    sound.skyCall()
    triggerVisorPulse('scan', '超感声波追踪已激活', 'NEURAL SCAN · RESONANCE LOCK')
  }, [active, sound, triggerRuinPulse, triggerVisorPulse])

  const toggleFreeRoam = useCallback(() => {
    const next = !freeRoam
    freeRoamRef.current = next
    setFreeRoam(next)
    if (next) {
      lingerRef.current = null
      setLinger(null)
      setPanel('none')
      panelRef.current = 'none'
      setActiveTask(null)
      setCustomHour(clockHour)
      void sound.unlock()
      sound.playChime([523.25, 659.25], 0.04, 1.8)
      showToast('自由漫游已开启 · 可切换 24h 天色与踏勘 5 处新地标，按 P 随时留影', 3200)
    } else {
      sceneRef.current?.setStage(stage)
      sceneRef.current?.setClock(clockHour)
      showToast('已切回章节叙事模式', 2000)
    }
  }, [clockHour, freeRoam, showToast, sound, stage])

  const handleHourScrub = useCallback((nextHour: number) => {
    setCustomHour(nextHour)
    sceneRef.current?.setClockHour(nextHour)
  }, [])

  const cycleRoamMusic = useCallback(() => {
    void sound.unlock()
    const idx = ROAM_MUSIC_CYCLE.indexOf(musicPref)
    const next = ROAM_MUSIC_CYCLE[(idx + 1) % ROAM_MUSIC_CYCLE.length]
    setMusicPref(next)
    persistRoamMusicPref(next)
    sound.setRoamMusicPreference(next)
    if (next === 'off') {
      showToast('草原轻音乐已暂停 · 仅保留风声与自然环境音', 2200)
    } else if (next === 'auto') {
      const autoTrack = getRoamTrackMeta(resolveTrackForHour(freeRoam ? customHour : clockHour))
      showToast('轻音乐 · 随天色流转（当前：《' + autoTrack.title + '》）', 2600)
    } else {
      const track = getRoamTrackMeta(next)
      showToast('轻音乐 · 《' + track.title + '》' + track.subtitle, 2600)
    }
  }, [clockHour, customHour, freeRoam, musicPref, showToast, sound])

  const handleBenchToggle = useCallback(() => {
    const cur = telemetryRef.current
    if (!cur) return
    if (cur.seatedBenchId) {
      sceneRef.current?.standFromBench()
      showToast('起身继续漫步', 1600)
    } else if (cur.nearbyBench) {
      sceneRef.current?.sitOnBench(cur.nearbyBench.id)
      sound.playChime([587.33, 783.99], 0.035, 1.6)
      showToast(`在「${cur.nearbyBench.name}」坐下观景 · 按 E 或 WASD 起身`, 2600)
    }
  }, [showToast, sound])

  const openMeadowCapture = useCallback(() => {
    if (!active || phaseRef.current !== 'explore' || quoteRef.current || loreRef.current || finalizingRef.current) return
    const dataUrl = sceneRef.current?.captureSnapshot()
    if (!dataUrl) {
      showToast('当前画面尚未就绪，稍后再拍', 1800)
      return
    }
    const activeHour = freeRoam ? customHour : clockHour
    setMeadowShot({ image: dataUrl, placeName: place, hour: activeHour })
    setMeadowNote('')
    setMeadowSaved(false)
    sound.playChime([659.25, 880], 0.04, 1.5)
  }, [active, clockHour, customHour, freeRoam, place, showToast, sound])

  const confirmSaveMeadowShot = useCallback(() => {
    if (!meadowShot) return
    const isNight = meadowShot.hour >= 19.5 || meadowShot.hour < 5.5
    saveAlbumEntry({
      id: `meadow-${Date.now()}`,
      sceneId: 'meadow',
      sceneTitle: `${meadowShot.placeName} · ${formatClockHour(meadowShot.hour)}`,
      city: '大草原',
      mood: isNight ? 'night' : 'dusk',
      image: meadowShot.image,
      note: meadowNote.trim() || `在${meadowShot.placeName}替你定格了一阵地面上的风。`,
      interactions: discoveriesRef.current.length,
      createdAt: Date.now(),
      promiseQuote: epilogueNote ?? undefined,
    })
    setMeadowSaved(true)
    sound.playChime([523.25, 659.25, 783.99], 0.045, 2.0)
    showToast('已收入「第 04 章 · 风信纪念册」', 2600)
  }, [epilogueNote, meadowNote, meadowShot, showToast, sound])

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
    sceneRef.current?.emitSkyCall(discoveriesRef.current)
    triggerVisorPulse(
      'boot',
      '超感程序已启动',
      'NEURAL VISOR ONLINE · SUNSET-06',
      '声波指引已锁定草坡野花 · 可调焦或直接轻触花瓣',
    )
    showToast('ACT I · 已佩戴传感脑机 · 触碰并看清这朵逆风野花', 2800)
  }, [showToast, sound, triggerVisorPulse])

  const answerIncomingCall = useCallback(() => {
    if (phaseRef.current !== 'incoming_call') return
    sound.playCommsConnect()
    phaseRef.current = 'intro_call'
    introBeatRef.current = 0
    setPhase('intro_call')
    setIntroBeat(0)
  }, [sound])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (phaseRef.current === 'incoming_call' && event.code === 'Enter') {
        event.preventDefault()
        answerIncomingCall()
        return
      }
      if (phaseRef.current === 'intro_call' && (event.code === 'Space' || event.code === 'Enter')) {
        event.preventDefault()
        advanceIntroBeat()
        return
      }
      if (event.code === 'Escape' && meadowShotRef.current) {
        event.preventDefault()
        setMeadowShot(null)
        return
      }
      if (event.code === 'KeyJ' && active && phaseRef.current === 'explore' && !finalizingRef.current) {
        event.preventDefault()
        setJournalOpen((current) => !current)
        return
      }
      if (
        event.code === 'KeyE' &&
        active &&
        phaseRef.current === 'explore' &&
        !quoteRef.current &&
        !loreRef.current &&
        !finalizingRef.current &&
        !meadowShotRef.current
      ) {
        event.preventDefault()
        handleBenchToggle()
        return
      }
      if (
        event.code === 'KeyM' &&
        active &&
        phaseRef.current === 'explore' &&
        !finalizingRef.current &&
        !meadowShotRef.current
      ) {
        event.preventDefault()
        cycleRoamMusic()
        return
      }
      if (
        event.code === 'KeyP' &&
        active &&
        phaseRef.current === 'explore' &&
        !quoteRef.current &&
        !loreRef.current &&
        !finalizingRef.current &&
        !meadowShotRef.current
      ) {
        event.preventDefault()
        openMeadowCapture()
        return
      }
      if (event.code !== 'Space') return
      if (!active || phaseRef.current !== 'explore' || quoteRef.current || loreRef.current || finalizingRef.current || meadowShotRef.current) return
      event.preventDefault()
      triggerSkyCall()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, advanceIntroBeat, answerIncomingCall, cycleRoamMusic, handleBenchToggle, openMeadowCapture, triggerSkyCall])

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

  const enterGrassland = useCallback(async () => {
    if (opening) return
    setPremiseMode(null)
    setOpening(true)
    setSceneRequested(true)
    sceneRef.current?.setStage(0)
    sceneRef.current?.focusTarget('home', 3.4)
    if (PROLOGUE_VOICE_AUTOPLAY) {
      void voicePlayer.preload('intro-0')
      void voicePlayer.preload('intro-1')
    }
    try {
      await sound.unlock()
      if (PROLOGUE_VOICE_AUTOPLAY) await voicePlayer.unlock()
      sound.enterGrassland()
    } catch {
      /* visuals continue even if audio is blocked */
    }
    later(() => {
      phaseRef.current = 'incoming_call'
      setPhase('incoming_call')
      setOpening(false)
      sceneRef.current?.setActiveTask(null)
      sceneRef.current?.setRoamEnabled(true)
      showToast('随身终端收到加密呼入 · 来自 SUNSET-06 林微', 3200)
    }, 2450)
  }, [later, opening, showToast, sound])

  const begin = () => {
    if (opening) return
    if (!hasSeenPremise()) {
      setPremiseMode('first_entry')
      return
    }
    void enterGrassland()
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
    setFreeRoam(false)
    freeRoamRef.current = false
    setMeadowShot(null)
    setQuote(null)
    quoteRef.current = null
    setPanel('none')
    panelRef.current = 'none'
    setLore(null)
    loreRef.current = null
    setAttenuating(false)
    truthProceededRef.current = false
    setDescentStage(0)
    setCoreBursting(false)
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
    setPremiseMode(null)
    setVisorPulse(null)
    if (visorTimerRef.current) {
      window.clearTimeout(visorTimerRef.current)
      visorTimerRef.current = null
    }
    sceneRef.current?.resetToSurface()
    sound.resetAtmosphere()
    sound.stopRain()
    setAct(1)
    actRef.current = 1
    setActiveTask('flower')
    pendingResumeActRef.current = null
    setContextLost(false)
    setSceneMounted(false)
    setSceneRequested(false)
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
    sceneRef.current?.emitSkyCall(discoveriesRef.current)
    triggerVisorPulse(
      'boot',
      '超感程序已启动',
      'NEURAL VISOR ONLINE · SUNSET-06',
      '声波指引已锁定草坡野花 · 可调焦或直接轻触花瓣',
    )
    showToast('ACT I · 已佩戴传感脑机 · 触碰并看清这朵逆风野花', 2800)
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
    setDescentStage(0)
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
    voicePlayer.stop()
    sceneRef.current?.stopRain()
    sceneRef.current?.setRoamEnabled(false)
    sceneRef.current?.triggerDescent()
    sound.descentStart()
  }, [sound])

  const proceedFromTruthToDescent = useCallback(() => {
    if (truthProceededRef.current) return
    truthProceededRef.current = true
    setAttenuating(false)
    finalizingRef.current = false
    setFinalizing(false)
    startDescent()
  }, [startDescent])

  const triggerFinalTruthPlunge = () => {
    if (finalizingRef.current) return
    truthProceededRef.current = false
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
    triggerVisorPulse('core', '地心信标过载 · 坐标锁定', '6,371.4 KM · SUNSET-06 OVERRIDE')
    later(() => setSignal(0.05), 1400)
    later(() => proceedFromTruthToDescent(), 16500)
  }

  const respondCoreHeartbeat = () => {
    if (phaseRef.current !== 'core_pulse' || coreBursting) return
    setCoreBursting(true)
    sceneRef.current?.triggerCoreBurst()
    sound.playCoreResonance()
    if (typeof window !== 'undefined') {
      spawnRipple(window.innerWidth * 0.5, window.innerHeight * 0.66, '#f2c28b')
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
      setCoreBursting(false)
    }, 1550)
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
      if (loreRef.current || freeRoamRef.current) {
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
    if (finalizingRef.current) return
    if (phaseRef.current !== 'explore') return
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
      sceneRef.current?.touchHeroFlower()
      if (currentAct === 1) {
        activateFlower()
      } else {
        sceneRef.current?.focusTarget('flower', 2.2)
        sound.playChime([659.25, 880], 0.045, 2.0)
        showToast('指尖轻触花茎，露水与花瓣在阳光里摇晃了两下', 2200)
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
      const depthProgress = Math.max(0, Math.min(1, (event.progress - 0.19) / 0.81))
      setDepthKm(Number((6371.4 * Math.pow(depthProgress, 1.18)).toFixed(1)))
      setSignal(Math.max(0.03, 0.34 - event.progress * 0.28))
      return
    }
    if (event.type === 'breach') {
      setDescentStage(0)
      setFlash(true)
      later(() => setFlash(false), 1400)
      return
    }
    if (event.type === 'mantle') {
      setDescentStage(1)
      return
    }
    if (event.type === 'core') {
      setDescentStage(2)
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
      }, 1450)
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
    truthProceededRef.current = false
    setDescentStage(0)
    setCoreBursting(false)
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
      triggerFinalTruthPlunge()
    }
  }

  const highestSeenAct = journey.actsSeen.length > 0 ? Math.max(...journey.actsSeen) : 0
  const resumeAct: ActId | null = highestSeenAct >= 1 ? (Math.min(7, highestSeenAct) as ActId) : null
  const resumeLabel = resumeAct
    ? highestSeenAct >= 8
      ? `直达第 ${STEPS[resumeAct - 1].index} 幕 · ${STEPS[resumeAct - 1].title}`
      : `继续第 ${STEPS[resumeAct - 1].index} 幕 · ${STEPS[resumeAct - 1].title}`
    : null

  useEffect(() => {
    jumpToActRef.current = jumpToAct
  })

  const resumeFromCover = async () => {
    if (opening || !resumeAct) return
    try {
      await sound.unlock()
      await voicePlayer.unlock()
    } catch {
      /* visuals continue even if audio is blocked */
    }
    if (!sceneRef.current) {
      pendingResumeActRef.current = resumeAct
      setSceneRequested(true)
      return
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
    setFreeRoam(false)
    freeRoamRef.current = false
    setMeadowShot(null)
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
  const currentDescentCaption = DESCENT_CAPTIONS[descentStage] ?? DESCENT_CAPTIONS[0]
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
    if (!PROLOGUE_VOICE_AUTOPLAY || !active || phase !== 'explore') return
    const preloadMap: Record<number, string[]> = {
      1: ['quote-flower'],
      2: ['quote-wind'],
      3: ['quote-dandelion'],
      4: ['quote-ruin'],
      5: ['quote-rain'],
      6: ['quote-fireflies', 'quote-stars'],
      7: ['quote-stars', 'truth'],
    }
    const targets = preloadMap[act]
    targets?.forEach((id) => void voicePlayer.preload(id))
  }, [active, phase, act])

  useEffect(() => {
    if (!PROLOGUE_VOICE_AUTOPLAY || !active || phase !== 'intro_call') return
    void voicePlayer.play(`intro-${introBeat}`, introBeat === 0 ? 'clear' : 'headset')
    if (introBeat + 1 < INTRO_CALL_BEATS.length) {
      void voicePlayer.preload(`intro-${introBeat + 1}`)
    }
  }, [active, phase, introBeat])

  useEffect(() => {
    if (!PROLOGUE_VOICE_AUTOPLAY || !active || phase !== 'explore' || !quoteKey) return
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
    if (!PROLOGUE_VOICE_AUTOPLAY || !active || !loreId) return
    void voicePlayer.play(`egg-${loreId}`, loreId === 'tablet' ? 'clear' : 'headset')
  }, [active, loreId])

  useEffect(() => {
    if (!active || !attenuating) return
    if (!PROLOGUE_VOICE_AUTOPLAY) {
      later(() => proceedFromTruthToDescent(), 5200)
      return
    }
    void voicePlayer
      .play('truth', 'clear', () => {
        later(() => proceedFromTruthToDescent(), 900)
      })
      .then((ok) => {
        if (!ok) later(() => proceedFromTruthToDescent(), 6200)
      })
  }, [active, attenuating, later, proceedFromTruthToDescent])

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

      {contextLost && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[#060c1a]/82 px-5 backdrop-blur-md">
          <div className="cinema-surface max-w-[360px] rounded-[24px] p-6 text-center">
            <div className="font-mono text-[10px] tracking-[0.2em] text-signal/80">WEBGL CONTEXT</div>
            <h2 className="mt-2 font-serif text-[17px] font-normal text-[#fff8ee]">
              图形渲染已暂停（设备内存释放）
            </h2>
            <p className="mt-2 font-serif text-[12px] leading-[1.75] text-white/62">
              设备临时回收了草原 3D 画布，可点击下方按钮恢复画面。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-4"
            >
              重新加载画面
            </button>
          </div>
        </div>
      )}

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
          sceneMounted={sceneMounted}
          onPreloadScene={() => {
            void loadPrologueSceneModule()
          }}
          onEnter={begin}
          onNavigate={onNavigate}
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

      {phase === 'incoming_call' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[40] flex justify-center px-4 pb-[max(1.35rem,env(safe-area-inset-bottom))] sm:pb-7">
          <div className="cinema-surface pointer-events-auto animate-fade-up flex w-full max-w-[560px] flex-col gap-3 rounded-[26px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.18em] text-signal">
                <span className="h-2 w-2 rounded-full bg-signal animate-[blinkDot_1.1s_ease-in-out_infinite]" />
                <span>INCOMING ENCRYPTED LINK · SUNSET-06 · 06:38</span>
              </div>
              <div className="mt-1 font-serif text-[15px] text-[#fff8ee]">
                随身终端收到「林微」的加密呼叫
              </div>
              <p className="mt-0.5 font-serif text-[12px] text-white/62">
                可自由环顾清晨草原，准备好了随时接通频段。
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={exitToRitual}
                className="btn-ghost !px-3.5 !py-2 !text-[12px]"
              >
                回封面
              </button>
              <button
                type="button"
                onClick={answerIncomingCall}
                className="btn-primary !inline-flex !items-center !gap-2 !px-4 !py-2 !text-[12.5px]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                  <path
                    d="M7.5 16.5a6.4 6.4 0 0 1 0-9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 19.4a10.5 10.5 0 0 1 0-14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span>接通加密频段</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <StoryPremiseModal
        open={premiseMode !== null}
        mode={premiseMode ?? 'browse'}
        onClose={() => setPremiseMode(null)}
        onEnter={() => {
          markPremiseSeen()
          void enterGrassland()
        }}
        onSkipAndEnter={() => {
          markPremiseSeen()
          void enterGrassland()
        }}
      />

      <NeuralVisorOverlay pulse={visorPulse} />

      <FieldJournalModal
        open={phase === 'explore' && journalOpen}
        cluesFound={cluesFound}
        eggsFound={eggsFound}
        discoveriesFound={discoveriesFound}
        memories={memories}
        act={act}
        onClose={() => setJournalOpen(false)}
      />

      {phase === 'explore' && !finalizing && !attenuating && !quote && !lore && telemetry && (
        <CompassBar
          yaw={telemetry.yaw}
          x={telemetry.x}
          z={telemetry.z}
          discoveriesFound={discoveriesFound}
        />
      )}

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
            const climaxAct = item.act >= 7
            const tooltip =
              item.act === 7
                ? `第 ${item.index} 幕 · ${item.title}（地核真相）`
                : item.act === 8
                  ? `第 ${item.index} 幕 · ${item.title}（6371km 终局）`
                  : `第 ${item.index} 幕 · ${item.title}`
            return (
              <button
                key={item.act}
                type="button"
                onClick={() => handleActRow(item.act)}
                title={tooltip}
                aria-label={`跳到第 ${item.index} 幕：${item.title}`}
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-serif text-[11px] transition ${
                  activeAct
                    ? 'bg-signal text-[#170f07] font-medium shadow-[0_0_12px_rgba(242,194,139,0.7)]'
                    : doneAct
                      ? 'bg-signal/18 text-signal hover:bg-signal/30'
                      : climaxAct
                        ? 'text-signal/85 hover:bg-signal/18 hover:text-signal'
                        : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.index}
              </button>
            )
          })}
          {act < 7 && (
            <button
              type="button"
              onClick={() => handleActRow(7)}
              title="直达第 VII 幕 · 揭晓 6,371.4km 地核真相"
              className="rounded-full border border-signal/35 bg-signal/12 px-2 py-0.5 font-serif text-[10.5px] text-signal transition hover:border-signal/70 hover:bg-signal/22"
            >
              ✦ 地核高潮
            </button>
          )}
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
          <span className="mx-0.5 h-3.5 w-px bg-white/15" />
          <button
            type="button"
            onClick={toggleFreeRoam}
            aria-pressed={freeRoam}
            title="切换无倒计时自由漫游与 24h 天色"
            className={`flex h-6 items-center gap-1 rounded-full px-2 font-serif text-[11px] transition ${
              freeRoam
                ? 'bg-signal text-[#170f07] font-medium shadow-[0_0_12px_rgba(242,194,139,0.65)]'
                : 'text-white/76 hover:bg-white/10 hover:text-signal'
            }`}
          >
            <span>自由漫游</span>
          </button>
          <button
            type="button"
            onClick={cycleRoamMusic}
            aria-label="切换草原轻音乐（快捷键 M）"
            title={
              musicPref === 'off'
                ? '开启草原轻音乐 (M)'
                : '轻音乐：' +
                  (musicPref === 'auto' ? '随天色 · ' : '') +
                  activeMusicTrack.title +
                  '（点击切换 / 关闭 · M）'
            }
            className={
              'flex h-6 items-center gap-1 rounded-full px-2 font-serif text-[11px] transition ' +
              (musicPref === 'off'
                ? 'text-white/45 hover:bg-white/10 hover:text-white/80'
                : 'text-signal/90 hover:bg-white/10 hover:text-signal')
            }
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 18V5l11-2v13"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="6.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="17.5" cy="16.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span className="hidden lg:inline">
              {musicPref === 'off' ? '静谧' : activeMusicTrack.title}
            </span>
          </button>
          <button
            type="button"
            onClick={openMeadowCapture}
            aria-label="定格草原留影（快捷键 P）"
            title="定格草原留影 · 收入纪念册 (P)"
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-signal"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
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

      {freeRoam && phase === 'explore' && !finalizing && !attenuating && !quote && !lore && (
        <div className="cinema-surface-soft pointer-events-auto fixed right-4 top-[118px] z-30 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1">
            {[
              { label: '晨', h: 6.4 },
              { label: '昼', h: 12.5 },
              { label: '暮', h: 18.2 },
              { label: '夜', h: 22.5 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleHourScrub(preset.h)}
                className={`rounded-full px-1.5 py-0.5 font-serif text-[10.5px] transition ${
                  Math.abs(customHour - preset.h) < 1.1
                    ? 'bg-signal/25 text-signal'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={0.1}
            value={customHour}
            onChange={(e) => handleHourScrub(Number(e.target.value))}
            aria-label="调节草原 24 小时天色"
            className="h-1 w-24 cursor-pointer accent-[#f2c28b] sm:w-28"
          />
          <span className="w-10 text-right font-mono text-[10.5px] text-signal">
            {formatClockHour(customHour)}
          </span>
          <span className="h-3.5 w-px bg-white/15" />
          <button
            type="button"
            onClick={cycleRoamMusic}
            title="点击切换轻音乐：随天色 / 晨风白键 / 白桦风铃 / 星湖夜曲 / 静谧 (M)"
            className={
              'flex items-center gap-1 rounded-full px-2 py-0.5 font-serif text-[10.5px] transition ' +
              (musicPref === 'off'
                ? 'text-white/45 hover:text-white/80'
                : 'bg-signal/15 text-signal hover:bg-signal/25')
            }
          >
            <span>{musicPref === 'off' ? '♪ 静谧' : '♪ ' + activeMusicTrack.title}</span>
            {musicPref === 'auto' && <span className="text-[9.5px] text-white/55">自动</span>}
          </button>
        </div>
      )}

      {phase === 'explore' &&
        !quote &&
        !lore &&
        !finalizing &&
        !attenuating &&
        !meadowShot &&
        (telemetry?.seatedBenchId || telemetry?.nearbyBench) && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[122px] z-30 flex justify-center px-3 sm:bottom-[92px]">
            <button
              type="button"
              onClick={handleBenchToggle}
              className="cinema-surface pointer-events-auto flex items-center gap-2 rounded-full border-signal/40 px-4 py-1.5 font-serif text-[12px] text-[#fff8ee] transition hover:border-signal/75 hover:bg-signal/15 active:scale-95"
            >
              <span className="cinema-kbd">E</span>
              <span>
                {telemetry.seatedBenchId
                  ? '站起继续漫步（也可直接按 WASD）'
                  : `坐下观景 · ${telemetry.nearbyBench?.name}`}
              </span>
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
                : '拖拽环顾 · WASD / 点击漫步 · 按住 Shift 迎风滑步 · 空格心光 · E 长椅 · M 轻乐 · P 留影 · J 手账'}
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
                onClick={openMeadowCapture}
                aria-label="随手拍收入纪念册（快捷键 P）"
                className="hidden items-center gap-1.5 rounded-full border border-white/16 bg-white/[0.04] px-3 py-1.5 font-serif text-[12px] text-white/85 transition hover:border-signal/55 hover:text-signal active:scale-95 sm:flex"
              >
                <span>随手拍</span>
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
                  aria-label={`跳到第 ${item.index} 幕：${item.title}`}
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-serif text-[11px] transition ${
                    activeAct
                      ? 'bg-signal text-[#170f07] font-medium'
                      : item.act >= 7
                        ? 'text-signal/85'
                        : 'text-white/60'
                  }`}
                >
                  {item.index}
                </button>
              )
            })}
            <span className="mx-0.5 h-3.5 w-px bg-white/15" />
            <button
              type="button"
              onClick={toggleFreeRoam}
              aria-pressed={freeRoam}
              className={`rounded-full px-2 py-0.5 font-serif text-[10.5px] transition ${
                freeRoam ? 'bg-signal text-[#170f07] font-medium' : 'text-white/75'
              }`}
            >
              漫游
            </button>
            <button
              type="button"
              onClick={cycleRoamMusic}
              aria-label="切换草原轻音乐"
              className={
                'rounded-full px-2 py-0.5 font-serif text-[10.5px] transition ' +
                (musicPref === 'off' ? 'text-white/45' : 'text-signal')
              }
            >
              {musicPref === 'off' ? '静谧' : '♪轻乐'}
            </button>
            <button
              type="button"
              onClick={openMeadowCapture}
              aria-label="草原随手拍"
              className="rounded-full px-2 py-0.5 font-serif text-[10.5px] text-white/75"
            >
              留影
            </button>
          </div>
        </div>
      )}

      {phase === 'explore' && (
        <ActInteractivePanels
          panel={panel}
          quoteOpen={Boolean(quote)}
          focusProgress={focusProgress}
          tuning={tuning}
          inZone={inZone}
          windHint={windHint}
          blowCharge={blowCharge}
          ruinPulses={ruinPulses}
          rainCatches={rainCatches}
          rainTarget={RAIN_TARGET_COUNT}
          fireflyCount={fireflyCount}
          fireflyTarget={FIREFLY_TARGET_COUNT}
          constellationCount={constellationCount}
          constellationHint={constellationHint}
          onDismiss={dismissPanel}
          onUpdateFocus={updateFocus}
          onStartFocusHold={startFocusHold}
          onStopFocusHold={stopFocusHold}
          onChangeTuning={changeTuning}
          onAutoAlign={autoAlign}
          onStartBlowHold={startBlowHold}
          onReleaseBlowHold={releaseBlowHold}
          onTriggerRuinPulse={triggerRuinPulse}
          onCatchRainDrop={catchRainDrop}
          onWakeFirefly={wakeFirefly}
          onAutoConnect={autoConnect}
        />
      )}

      <NarrativeModals
        phase={phase}
        quote={quote}
        quoteCollapsed={quoteCollapsed}
        selectedChoice={selectedChoice}
        activeQuoteVoiceId={PROLOGUE_VOICE_AUTOPLAY ? activeQuoteVoiceId : null}
        activeQuoteVoiceMode={activeQuoteVoiceMode}
        voiceState={voiceState}
        lore={lore}
        attenuating={attenuating}
        calmMotion={calmMotion}
        showVoiceControl={PROLOGUE_VOICE_AUTOPLAY}
        meadowShot={meadowShot}
        meadowNote={meadowNote}
        meadowSaved={meadowSaved}
        meadowQuickNotes={MEADOW_QUICK_NOTES}
        formatClockHour={formatClockHour}
        onToggleQuoteCollapse={() => setQuoteCollapsed((v) => !v)}
        onPickChoice={pickDialogueChoice}
        onContinueQuote={continueQuote}
        onProceedDescent={proceedFromTruthToDescent}
        onCloseLore={() => {
          voicePlayer.stop()
          setLore(null)
        }}
        onCloseMeadowShot={() => setMeadowShot(null)}
        onMeadowNoteChange={setMeadowNote}
        onConfirmSaveMeadowShot={confirmSaveMeadowShot}
        onGoDiorama={() => {
          setMeadowShot(null)
          onNavigate('diorama')
        }}
      />

      {flash && <div className="breach-flash" />}

      <EndingSequenceOverlay
        phase={phase}
        introBeat={introBeat}
        introBeatsTotal={INTRO_CALL_BEATS.length}
        currentIntroBeat={currentIntroBeat}
        currentDescentCaption={currentDescentCaption}
        depthKm={depthKm}
        signal={signal}
        voiceState={voiceState}
        epilogueNote={epilogueNote}
        wishNote={wishNote}
        memories={memories}
        exportingRoll={exportingRoll}
        showVoiceControl={PROLOGUE_VOICE_AUTOPLAY}
        coreBursting={coreBursting}
        flashSafe={flashSafe}
        onAdvanceIntro={advanceIntroBeat}
        onSkipIntro={skipIntroToExplore}
        onExitToRitual={exitToRitual}
        onRespondCoreHeartbeat={respondCoreHeartbeat}
        onNavigate={onNavigate}
        onExportRoll={() => void handleExportRoll()}
        onRestart={restart}
      />
    </div>
  )
}
