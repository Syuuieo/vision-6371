import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import { BreathDetector } from '../audio/breathDetector'
import type { Soundscape } from '../audio/soundscape'
import {
  DIORAMA_SCENES,
  DioramaWorld,
  buildEncounterSnapshot,
  type DioramaCameraMode,
  type DioramaFilter,
  type DioramaInteractEvent,
  type DioramaMood,
  type DioramaProgressSnapshot,
  type DioramaWeather,
  type DioramaZoomPreset,
} from '../scenes/DioramaWorld'
import { CURATED_DIORAMA_SCENES } from '../scenes/diorama/types'
import {
  deleteAlbumEntry,
  loadAlbum,
  loadAlbumAsync,
  loadDioramaStamps,
  markDioramaStamp,
  saveAlbumEntry,
  subscribeAlbum,
  updateAlbumNote,
  type AlbumEntry,
  type DioramaSceneId,
} from '../services/albumStorage'
import { exportAlbumCardPng } from '../utils/albumExport'
import type { StoryRelayState } from '../utils/storyRelay'
import { WindChimeHarp, type ChimeTimbre } from './prologue/WindChimeHarp'
import { WorldEchoDrawer } from './WorldEchoDrawer'

interface DioramaExperienceProps {
  muted: boolean
  flashSafe?: boolean
  relay: StoryRelayState
  onRecordCity?: (city: string) => void
  onSendToPost?: (entry: AlbumEntry) => void
  onGoPrologue?: () => void
  sound?: Soundscape
  initialSceneId?: DioramaSceneId | null
  autoWalkMode?: boolean
  diveNonce?: number
  cinemaHidden?: boolean
  onToggleCinemaHidden?: () => void
  immersive?: boolean
  radioCode?: string | null
  worldTitle?: string
  albumPreview?: boolean
  initialAlbumOpen?: boolean
  onExitWorld?: () => void
}

const QUICK_NOTES = [
  '替不能再来地面的人，把这一刻的奇境灯火存进纪念册。',
  '北半球正降温时，我在南半球替你收下了 28°C 的海豚与白帆。',
  '今晚的流星与极光很亮，走过这里时想起草原上那句约定。',
  '风声、翻书声和波光都很轻，留作下一次重逢时的凭据。',
]

const MOOD_OPTIONS: { id: DioramaMood; label: string }[] = [
  { id: 'dawn', label: '晨曦' },
  { id: 'dusk', label: '暮色' },
  { id: 'night', label: '星夜' },
]

const ZOOM_OPTIONS: { id: DioramaZoomPreset; label: string }[] = [
  { id: 'wide', label: '全景' },
  { id: 'standard', label: '标准' },
  { id: 'macro', label: '特写' },
]

const FILTER_OPTIONS: { id: DioramaFilter; label: string }[] = [
  { id: 'none', label: '原色' },
  { id: 'warm', label: '暖金' },
  { id: 'cinema', label: '青暮' },
]

function moodBadgeLabel(mood: AlbumEntry['mood']) {
  return mood === 'dawn' ? '晨曦' : mood === 'night' ? '星夜' : '黄昏'
}

function formatStamp(ts: number) {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}.${day} ${hh}:${mm}`
}

function defaultHourForScene(sceneId: DioramaSceneId) {
  return DIORAMA_SCENES.find((scene) => scene.id === sceneId)?.defaultHour ?? (sceneId === 'core' ? 21.5 : 18.1)
}

function moodForHour(hour: number): DioramaMood {
  return hour < 9.5 ? 'dawn' : hour >= 19.6 ? 'night' : 'dusk'
}

export function DioramaExperience({
  muted,
  flashSafe = false,
  relay,
  onRecordCity,
  onSendToPost,
  onGoPrologue,
  sound,
  initialSceneId = null,
  diveNonce,
  cinemaHidden,
  onToggleCinemaHidden,
  immersive = false,
  radioCode = null,
  worldTitle,
  albumPreview = false,
  initialAlbumOpen = false,
  onExitWorld,
}: DioramaExperienceProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneSwitcherRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<DioramaWorld | null>(null)
  const [mixer] = useState(() => new AmbientMixer())

  const [sceneId, setSceneId] = useState<DioramaSceneId>(() => initialSceneId ?? 'agra')
  const [mood, setMood] = useState<DioramaMood>(() => moodForHour(defaultHourForScene(initialSceneId ?? 'agra')))
  const [timeHour, setTimeHour] = useState(() => defaultHourForScene(initialSceneId ?? 'agra'))
  const [weather, setWeather] = useState<DioramaWeather>('clear')
  const [riding, setRiding] = useState(false)
  const [rideAvailable, setRideAvailable] = useState(false)
  const [vantageLabel, setVantageLabel] = useState<string | null>(null)
  const [autoOrbit, setAutoOrbit] = useState(true)
  const [walkMode, setWalkMode] = useState(true)
  const [flightMode, setFlightMode] = useState(false)
  const [worldMenuOpen, setWorldMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [harpOpen, setHarpOpen] = useState(false)
  const [breathOn, setBreathOn] = useState(false)
  const [breathLevel, setBreathLevel] = useState(0)
  const [micUnavailable, setMicUnavailable] = useState(false)
  const [manualWindHeld, setManualWindHeld] = useState(false)
  const [localCinemaHidden, setLocalCinemaHidden] = useState(false)
  const [handledDiveNonce, setHandledDiveNonce] = useState(diveNonce ?? 0)
  const [soundOn, setSoundOn] = useState(!albumPreview)
  const [viewfinder, setViewfinder] = useState(false)
  const [zoomPreset, setZoomPreset] = useState<DioramaZoomPreset>('standard')
  const [filmFilter, setFilmFilter] = useState<DioramaFilter>('none')
  const [shutterFlash, setShutterFlash] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [interactCount, setInteractCount] = useState(0)
  const [progress, setProgress] = useState<DioramaProgressSnapshot>(() =>
    buildEncounterSnapshot(initialSceneId ?? 'agra', new Set()),
  )
  const [flowPaused, setFlowPaused] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  )
  const [stamps, setStamps] = useState<DioramaSceneId[]>(() => loadDioramaStamps())
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const guideAutoHideRef = useRef<number | null>(null)
  const breathRef = useRef<BreathDetector | null>(null)
  const manualWindTimerRef = useRef<number | null>(null)
  const lastGustChimeRef = useRef(0)
  const fallbackAudioRef = useRef<AudioContext | null>(null)

  const [album, setAlbum] = useState<AlbumEntry[]>(() => loadAlbum())
  const [albumOpen, setAlbumOpen] = useState(initialAlbumOpen)
  const [albumCategory, setAlbumCategory] = useState<'all' | 'diorama' | 'meadow' | 'postcard'>('all')
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)

  // Synchronize prop-driven dive transitions cleanly during render (zero setState-in-effect)
  if (diveNonce !== undefined && diveNonce !== handledDiveNonce) {
    setHandledDiveNonce(diveNonce)
    const targetScene = initialSceneId ?? sceneId
    if (initialSceneId) {
      setSceneId(initialSceneId)
      setInteractCount(0)
      setProgress(buildEncounterSnapshot(initialSceneId, new Set()))
    }
    const hour = defaultHourForScene(targetScene)
    setMood(moodForHour(hour))
    setTimeHour(hour)
    setRiding(false)
    setFlightMode(false)
    setWalkMode(true)
  }

  const isCinemaHidden = cinemaHidden ?? localCinemaHidden

  const soundOnRef = useRef(soundOn)
  const mutedRef = useRef(muted)
  const flashSafeRef = useRef(flashSafe)
  const sceneIdRef = useRef(sceneId)
  const stampsRef = useRef(stamps)
  const walkModeRef = useRef(walkMode)
  const flightModeRef = useRef(flightMode)
  const soundPropRef = useRef(sound)
  const activeMeta = useMemo(
    () => DIORAMA_SCENES.find((s) => s.id === sceneId) ?? DIORAMA_SCENES[0],
    [sceneId],
  )
  const activeMetaRef = useRef(activeMeta)

  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    mutedRef.current = muted
    mixer.setMuted(muted)
  }, [mixer, muted])

  useEffect(() => {
    flashSafeRef.current = flashSafe
  }, [flashSafe])

  useEffect(() => {
    sceneIdRef.current = sceneId
  }, [sceneId])

  useEffect(() => {
    const container = sceneSwitcherRef.current
    const active = container?.querySelector<HTMLElement>('[data-scene-active="true"]')
    if (!container || !active) return
    const left = active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2
    container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [sceneId])

  useEffect(() => {
    stampsRef.current = stamps
  }, [stamps])

  useEffect(() => {
    walkModeRef.current = walkMode
  }, [walkMode])

  useEffect(() => {
    flightModeRef.current = flightMode
  }, [flightMode])

  useEffect(() => {
    soundPropRef.current = sound
  }, [sound])

  useEffect(() => {
    activeMetaRef.current = activeMeta
  }, [activeMeta])

  const showToast = useCallback((msg: string, ms = 2600) => {
    setToast(msg)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms)
  }, [])

  const closeAlbum = () => {
    setAlbumOpen(false)
    if (albumPreview) onExitWorld?.()
  }

  const playFallbackChimeNote = useCallback((freq: number, timbre: ChimeTimbre) => {
    if (mutedRef.current || !Number.isFinite(freq) || freq <= 0) return
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    if (!fallbackAudioRef.current) {
      fallbackAudioRef.current = new AudioCtor()
    }
    const ctx = fallbackAudioRef.current
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const now = ctx.currentTime + 0.008
    const isPiano = timbre === 'piano'
    const dur = isPiano ? 1.5 : 2.2
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(isPiano ? 0.11 : 0.095, now + 0.015)
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)

    const over = ctx.createOscillator()
    over.type = 'triangle'
    over.frequency.setValueAtTime(freq * (isPiano ? 2.001 : 2.004), now)
    const overGain = ctx.createGain()
    overGain.gain.value = isPiano ? 0.16 : 0.22

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = Math.min(3400, freq * 3.4)

    osc.connect(env)
    over.connect(overGain).connect(env)
    env.connect(lp).connect(ctx.destination)
    osc.start(now)
    over.start(now)
    osc.stop(now + dur + 0.06)
    over.stop(now + dur + 0.06)
  }, [])

  const handlePlayHarpNote = useCallback(
    (noteIndex: number, freq: number, colorHex: string, timbre: ChimeTimbre) => {
      worldRef.current?.triggerNoteSpectacle(noteIndex, colorHex)
      if (mutedRef.current) return
      const sharedSound = soundPropRef.current
      if (sharedSound) {
        if (!sharedSound.isUnlocked) {
          void sharedSound.unlock().then(() => {
            sharedSound.playChimeNote(freq, timbre)
          })
        } else {
          sharedSound.playChimeNote(freq, timbre)
        }
      } else {
        playFallbackChimeNote(freq, timbre)
      }
    },
    [playFallbackChimeNote],
  )

  const triggerWindGustChime = useCallback(() => {
    if (mutedRef.current || !soundOnRef.current) return
    const now = performance.now()
    if (now - lastGustChimeRef.current < 480) return
    lastGustChimeRef.current = now
    const sharedSound = soundPropRef.current
    if (sharedSound) {
      if (sharedSound.isUnlocked) {
        sharedSound.playChime([587.33, 880], 0.04, 1.9)
      } else {
        void sharedSound.unlock().then(() => sharedSound.playChime([587.33, 880], 0.04, 1.9))
      }
    } else {
      void mixer.ensure()
      mixer.playInteractionSfx('snow')
    }
  }, [mixer])

  const stopManualWind = useCallback(() => {
    if (manualWindTimerRef.current !== null) {
      window.clearInterval(manualWindTimerRef.current)
      manualWindTimerRef.current = null
    }
    setManualWindHeld(false)
    setBreathLevel(0)
  }, [])

  const startManualWind = useCallback(() => {
    stopManualWind()
    setManualWindHeld(true)
    setBreathLevel(0.86)
    worldRef.current?.applyWindGust(0.88)
    triggerWindGustChime()
    manualWindTimerRef.current = window.setInterval(() => {
      const pulse = 0.76 + Math.random() * 0.22
      setBreathLevel(pulse)
      worldRef.current?.applyWindGust(pulse)
    }, 95)
  }, [stopManualWind, triggerWindGustChime])

  const handleToggleBreath = async () => {
    if (breathOn) {
      breathRef.current?.stop()
      setBreathOn(false)
      setBreathLevel(0)
      showToast('已关闭吹气生风', 1800)
      return
    }
    if (!breathRef.current) {
      breathRef.current = new BreathDetector()
    }
    const res = await breathRef.current.start((strength, gust) => {
      setBreathLevel(strength)
      worldRef.current?.applyWindGust(strength)
      if (gust) {
        triggerWindGustChime()
      }
    })
    if (!res.ok) {
      setMicUnavailable(true)
      setBreathOn(false)
      setBreathLevel(0)
      showToast('未检测到可用麦克风 · 已切换为「按住起风」体验', 3200)
      return
    }
    setMicUnavailable(false)
    setBreathOn(true)
    showToast('麦克风聆听中 · 轻吹一口气唤起奇境微风', 2800)
  }

  const handleToggleCinema = () => {
    if (onToggleCinemaHidden) {
      onToggleCinemaHidden()
    } else {
      setLocalCinemaHidden((v) => !v)
    }
  }

  // 初始化沉浸式奇境引擎
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const world = new DioramaWorld(
      host,
      sceneIdRef.current,
      (event: DioramaInteractEvent) => {
        setInteractCount(event.count)
        setToast(event.label)
        if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = window.setTimeout(
          () => setToast(null),
          event.awakened ? 4200 : 2400,
        )
        if (soundOnRef.current && !mutedRef.current) {
          void mixer.ensure()
          mixer.playInteractionSfx(event.sfx)
        }
        try {
          navigator.vibrate?.(event.awakened ? [20, 30, 30] : 16)
        } catch {
          /* ignore */
        }
      },
      (snap) => {
        setProgress(snap)
        if (snap.awakened) {
          const nextStamps = markDioramaStamp(snap.sceneId)
          setStamps(nextStamps)
          if (guideAutoHideRef.current !== null) window.clearTimeout(guideAutoHideRef.current)
          guideAutoHideRef.current = window.setTimeout(() => setGuideOpen(false), 1800)
        }
      },
      (lost) => setContextLost(lost),
      {
        bloomEnabled: !flashSafeRef.current,
        onModeChange: (mode: DioramaCameraMode) => {
          setWalkMode(mode !== 'orbit')
          setFlightMode(mode === 'flight')
          if (mode === 'flight') {
            showToast(
              `已御风起飞「${activeMetaRef.current.short}」· WASD 飞行 · Space/R 攀升 · Q 下降 · F 降落`,
              3200,
            )
          } else if (mode === 'walk' && flightModeRef.current) {
            showToast(`已降落至「${activeMetaRef.current.short}」漫步视角`, 2200)
          }
        },
        onRideChange: (isRiding: boolean) => {
          setRiding(isRiding)
          if (isRiding) {
            showToast('已登上黄浦江游轮二层船头甲板 · 拖拽 360° 环顾 · WASD 下船', 3000)
          }
        },
      },
    )
    worldRef.current = world
    if (import.meta.env.DEV) {
      ;(window as unknown as { __diorama?: DioramaWorld }).__diorama = world
    }
    return () => {
      world.dispose()
      worldRef.current = null
      breathRef.current?.stop()
      if (manualWindTimerRef.current !== null) window.clearInterval(manualWindTimerRef.current)
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      if (guideAutoHideRef.current !== null) window.clearTimeout(guideAutoHideRef.current)
      void fallbackAudioRef.current?.close()
      fallbackAudioRef.current = null
    }
  }, [mixer, showToast])

  useEffect(() => {
    mixer.revive()
    return () => mixer.dispose()
  }, [mixer])

  useEffect(() => {
    let alive = true
    const sync = () => {
      void loadAlbumAsync().then((loaded) => {
        if (alive) setAlbum(loaded)
      })
    }
    sync()
    const unsub = subscribeAlbum(sync)
    return () => {
      alive = false
      unsub()
    }
  }, [])

  // 切换立体场景时同步环境声与城市八音盒旋律
  useEffect(() => {
    const world = worldRef.current
    world?.loadScene(sceneId, stampsRef.current.includes(sceneId))
    setVantageLabel(world?.getVantageLabel() ?? null)
    setRideAvailable(Boolean(world?.hasRideAnchor()))
    if (!albumPreview) onRecordCity?.(activeMeta.city)
    mixer.setKind(activeMeta.ambience)
    mixer.setVolume(0.5)
    mixer.setActive(soundOn)
    if (soundOn && !muted) {
      void mixer.ensure()
      mixer.startStation(activeMeta.city)
    } else {
      mixer.stopStation()
    }
  }, [activeMeta.ambience, activeMeta.city, albumPreview, mixer, muted, onRecordCity, sceneId, soundOn])

  useEffect(() => {
    worldRef.current?.setAutoOrbit(autoOrbit)
  }, [autoOrbit])

  useEffect(() => {
    worldRef.current?.setZoomPreset(zoomPreset)
  }, [zoomPreset])

  useEffect(() => {
    worldRef.current?.setBloomEnabled(!flashSafe)
    worldRef.current?.setFlashSafe(flashSafe)
  }, [flashSafe])

  useEffect(() => {
    worldRef.current?.setWeather(weather)
  }, [weather])

  useEffect(() => {
    worldRef.current?.setInputPaused(Boolean(pendingShot || albumOpen || harpOpen))
  }, [albumOpen, harpOpen, pendingShot])

  useEffect(() => {
    worldRef.current?.setFlowPaused(flowPaused)
  }, [flowPaused])

  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    if (flightMode) {
      world.setFlightMode(true)
    } else if (walkMode) {
      if (world.isFlightMode()) {
        world.setFlightMode(false)
      } else {
        world.setWalkMode(true)
      }
    } else {
      world.setWalkMode(false)
    }
  }, [walkMode, flightMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pendingShot || albumOpen || harpOpen) return
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return
      }
      if (event.code === 'KeyN' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        const next = !walkModeRef.current
        setFlightMode(false)
        setWalkMode(next)
        setToast(
          next
            ? `已走进「${activeMeta.short}」场景漫步 · 拖拽 360° 环顾 · WASD 漫步 · F 飞行 · N 回到观景`
            : `已回到「${activeMeta.short}」观景视角`,
        )
        if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = window.setTimeout(() => setToast(null), next ? 2800 : 2000)
      } else if (event.code === 'Escape' && (flightModeRef.current || walkModeRef.current)) {
        if (flightModeRef.current) {
          setFlightMode(false)
        } else {
          setWalkMode(false)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeMeta.short, albumOpen, harpOpen, pendingShot])

  const handleToggleWalkMode = () => {
    const next = !walkMode
    setFlightMode(false)
    setWalkMode(next)
    showToast(
      next
        ? `已走进「${activeMeta.short}」场景漫步 · 拖拽 360° 环顾 · WASD 漫步 · F 飞行 · N 回到观景`
        : `已回到「${activeMeta.short}」观景视角`,
      next ? 2800 : 2000,
    )
  }

  const handleToggleFlightMode = () => {
    if (flightMode) {
      setFlightMode(false)
      showToast(`已降落至「${activeMeta.short}」漫步视角`, 2200)
      return
    }
    setWalkMode(true)
    setFlightMode(true)
    showToast(
      `已御风起飞「${activeMeta.short}」· WASD 飞行 · Space/R 攀升 · Q 下降 · F 降落`,
      3200,
    )
  }

  const handleTriggerEncounter = (goalId: string) => {
    if (soundOn && !muted) void mixer.ensure()
    worldRef.current?.triggerEncounterById(goalId)
  }

  const switchScene = (nextId: DioramaSceneId) => {
    if (guideAutoHideRef.current !== null) {
      window.clearTimeout(guideAutoHideRef.current)
      guideAutoHideRef.current = null
    }
    setSceneId(nextId)
    const hour = defaultHourForScene(nextId)
    setMood(moodForHour(hour))
    setTimeHour(hour)
    setRiding(false)
    setFlightMode(false)
    setWalkMode(true)
    setInteractCount(0)
    setProgress(buildEncounterSnapshot(nextId, new Set()))
  }

  const handleGuideNextGoal = () => {
    const msg = worldRef.current?.focusNextEncounter()
    if (msg) showToast(msg, 3400)
  }

  const handleReplayFinale = () => {
    worldRef.current?.replayFinale()
    if (soundOn && !muted) {
      void mixer.ensure()
      mixer.playInteractionSfx('celebrate')
    }
    showToast(`重放 · ${activeMeta.stampTitle}`, 3000)
  }

  const handleAwakenAll = () => {
    if (soundOn && !muted) void mixer.ensure()
    worldRef.current?.awakenAll()
  }

  const takePhoto = () => {
    const dataUrl = worldRef.current?.captureFrame(filmFilter)
    if (!dataUrl) {
      showToast('画面正在渲染，请稍后再按快门')
      return
    }
    if (soundOn && !muted) {
      void mixer.ensure()
      mixer.playInteractionSfx('shutter')
    }
    try {
      navigator.vibrate?.([18, 28, 12])
    } catch {
      /* ignore */
    }
    if (!flashSafe) {
      setShutterFlash(true)
      window.setTimeout(() => setShutterFlash(false), 260)
    }
    setPendingShot(dataUrl)
    setDraftNote('')
    setViewfinder(false)
  }

  const saveShotAndMaybeSend = (goToPost: boolean) => {
    if (!pendingShot) return
    const isAwakened = progress.awakened || stamps.includes(activeMeta.id)
    const entry: AlbumEntry = {
      id: `alb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sceneId: activeMeta.id,
      sceneTitle: activeMeta.title,
      city: activeMeta.city,
      mood,
      image: pendingShot,
      note: draftNote.trim() || activeMeta.loreNote,
      interactions: interactCount,
      createdAt: Date.now(),
      promiseQuote: relay.promise || relay.wish,
      awakened: isAwakened,
      stampTitle: isAwakened ? activeMeta.stampTitle : undefined,
    }
    const next = saveAlbumEntry(entry)
    setAlbum(next)
    setPendingShot(null)
    setDraftNote('')
    if (goToPost && onSendToPost) {
      onSendToPost(entry)
      return
    }
    showToast(`已收录进纪念册（共 ${next.length} 帧）`)
  }

  const handleSaveEdit = (id: string) => {
    const next = updateAlbumNote(id, editingNote.trim() || '留给此刻的温柔记忆。')
    setAlbum(next)
    setEditingId(null)
    setEditingNote('')
    showToast('留言已更新')
  }

  const handleDelete = (id: string) => {
    const next = deleteAlbumEntry(id)
    setAlbum(next)
    showToast('已从纪念册移除')
  }

  const handleExport = async (entry: AlbumEntry) => {
    if (exportingId) return
    setExportingId(entry.id)
    try {
      await exportAlbumCardPng(entry)
      showToast('高清纪念页已保存')
    } catch {
      showToast('导出失败，请重试')
    } finally {
      setExportingId(null)
    }
  }

  const filteredAlbum = useMemo(() => {
    if (albumCategory === 'meadow') return album.filter((e) => e.sceneId === 'meadow')
    if (albumCategory === 'postcard') return album.filter((e) => e.sceneId === 'postcard')
    if (albumCategory === 'diorama') {
      return album.filter((e) => e.sceneId !== 'meadow' && e.sceneId !== 'postcard')
    }
    return album
  }, [album, albumCategory])

  const stampUnlockedHere = progress.awakened || stamps.includes(activeMeta.id)

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c1324] select-none">
      {/* 全屏沉浸奇境 3D 场景 */}
      <div
        ref={hostRef}
        className={`absolute inset-0 transition-[filter] duration-300 ${
          filmFilter === 'warm'
            ? '[filter:sepia(0.14)_saturate(1.12)]'
            : filmFilter === 'cinema'
              ? '[filter:contrast(1.06)_saturate(0.92)_hue-rotate(-6deg)]'
              : ''
        }`}
      />

      {/* 快门闪光（遵守闪烁抑制设置） */}
      {shutterFlash && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-white/55 transition-opacity duration-200" />
      )}

      {/* 取景框覆盖层 */}
      {viewfinder && !pendingShot && !albumOpen && !isCinemaHidden && (
        <div className="pointer-events-none fixed inset-x-5 top-6 bottom-16 z-20 sm:inset-14">
          <span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-signal/80" />
          <span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-signal/80" />
          <span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-signal/80" />
          <span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-signal/80" />
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20">
            <div className="border-b border-r border-white/50" />
            <div className="border-b border-r border-white/50" />
            <div className="border-b border-white/50" />
            <div className="border-b border-r border-white/50" />
            <div className="border-b border-r border-white/50" />
            <div className="border-b border-white/50" />
          </div>
          <div className="hud-ink absolute left-3 top-3 font-mono text-[10.5px] tracking-[0.2em] text-signal">
            REC · 35MM · {activeMeta.city} · {moodBadgeLabel(mood)}
          </div>
        </div>
      )}

      {/* 左上角无框编辑部浮层 + 可收起奇境唤醒面板 */}
      {!immersive && (
      <aside
        className={`pointer-events-none fixed left-4 top-[112px] z-20 max-w-[320px] transition-opacity duration-500 sm:left-6 sm:top-[78px] sm:max-w-[335px] ${
          isCinemaHidden ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="hud-ink flex flex-col gap-0.5 sm:gap-1">
          <div className="flex items-center gap-2">
            <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_12px_rgba(242,194,139,0.9)]" />
            <span className="font-mono text-[10px] tracking-[0.16em] text-signal/90 sm:text-[10.5px]">
              风信奇境馆 · {DIORAMA_SCENES.length} 座可漫步的 3D 世界 · {activeMeta.region}
            </span>
          </div>
          <h1 className="font-serif text-[18px] font-normal tracking-[0.06em] text-[#fff8ee] sm:text-[23px]">
            {activeMeta.title}
          </h1>
          <p className="hidden font-serif text-[11.5px] leading-[1.6] text-white/75 sm:block">
            {activeMeta.tempDusk} · {activeMeta.interactHint}
          </p>
        </div>

        {/* 折叠状态：单行小胶囊不遮挡场景；展开状态：完整 3 步指引与收起按钮 */}
        {!guideOpen ? (
          <div
            className={`mt-2 flex flex-wrap items-center gap-1.5 ${
              isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="cinema-surface-soft flex items-center gap-1.5 rounded-full px-3 py-1 font-serif text-[11px] text-signal transition hover:border-signal/60"
            >
              <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
              <span>
                {stampUnlockedHere
                  ? `${activeMeta.stampTitle} · 已点亮`
                  : `奇遇指引 · ${progress.discovered}/${progress.total}`}
              </span>
              <span className="text-white/50">▾</span>
            </button>
            {progress.awakened ? (
              <button
                type="button"
                onClick={handleReplayFinale}
                className="cinema-surface-soft rounded-full border-signal/45 px-2.5 py-1 font-serif text-[11px] text-[#fff8ee] transition hover:border-signal hover:text-signal"
              >
                再现奇观
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAwakenAll}
                className="cinema-surface-soft rounded-full border-signal/45 px-2.5 py-1 font-serif text-[11px] text-signal transition hover:border-signal hover:bg-signal/16"
              >
                ✨ 唤醒奇观
              </button>
            )}
          </div>
        ) : (
          <div
            className={`cinema-surface-soft mt-2.5 rounded-2xl px-3.5 py-2.5 ${
              isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-[11.5px] tracking-[0.06em] text-signal">
                  奇遇探索 · {progress.discovered}/{progress.total}
                </span>
                {stampUnlockedHere && (
                  <span className="rounded-full bg-signal/20 px-2 py-0.5 font-serif text-[10px] text-signal">
                    {activeMeta.stampTitle}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {progress.awakened ? (
                  <button
                    type="button"
                    onClick={handleReplayFinale}
                    className="rounded-full border border-signal/55 bg-signal/16 px-2.5 py-0.5 font-serif text-[10.5px] text-signal transition hover:bg-signal/26"
                  >
                    再现奇观
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAwakenAll}
                      className="rounded-full border border-signal/50 bg-signal/15 px-2.5 py-0.5 font-serif text-[10.5px] text-signal transition hover:bg-signal/25"
                    >
                      ✨ 唤醒奇观
                    </button>
                    <button
                      type="button"
                      onClick={handleGuideNextGoal}
                      className="rounded-full border border-white/16 bg-white/[0.04] px-2.5 py-0.5 font-serif text-[10.5px] text-white/80 transition hover:border-signal/55 hover:text-signal"
                    >
                      寻光指引
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  aria-label="收起指引"
                  title="收起指引"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white/14 bg-white/[0.04] text-[11px] text-white/65 transition hover:border-signal/50 hover:text-signal"
                >
                  ×
                </button>
              </div>
            </div>

            <ul className="mt-2 space-y-1.5">
              {progress.encounters.map((goal, idx) => (
                <li key={goal.id}>
                  <button
                    type="button"
                    onClick={() => handleTriggerEncounter(goal.id)}
                    title={`一键触发：${goal.hint}`}
                    className={`group flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11.5px] transition ${
                      goal.done
                        ? 'border-signal/30 bg-signal/[0.08] text-white/70 hover:border-signal/60'
                        : 'border-white/10 bg-white/[0.04] text-white/90 hover:border-signal/55 hover:bg-signal/[0.12]'
                    }`}
                  >
                    <span className="font-mono text-[10px] tracking-[0.06em] text-signal/90">
                      0{idx + 1}
                    </span>
                    <span
                      className={`cinema-gem h-1.5 w-1.5 shrink-0 transition ${
                        goal.done
                          ? 'bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]'
                          : 'border border-white/40 bg-transparent group-hover:border-signal'
                      }`}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate font-serif transition ${
                        goal.done ? 'text-white/62' : 'text-white/92'
                      }`}
                    >
                      {goal.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 font-serif text-[9.5px] transition ${
                        goal.done
                          ? 'bg-signal/18 text-signal/90'
                          : 'bg-white/[0.06] text-white/60 group-hover:bg-signal/22 group-hover:text-signal'
                      }`}
                    >
                      {goal.done ? '重放' : '触发 ↗'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2 border-t border-white/10 pt-2">
              <p className="font-serif text-[11px] leading-[1.6] text-white/62">
                {relay.promise
                  ? `带着草原约定「${relay.promise}」，漫步 ${DIORAMA_SCENES.length} 座 3D 世界收集印记与奇观。`
                  : '轻点 3D 地标，或切换电影全景。'}
              </p>
              {!relay.completedPrologue && onGoPrologue && (
                <button
                  type="button"
                  onClick={onGoPrologue}
                  className="mt-1 font-serif text-[10.5px] text-signal/90 underline decoration-signal/40 underline-offset-4 transition hover:text-signal"
                >
                  返回序章 · 地球的一天 →
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
      )}

      {/* 右上角控制栏：三态天光 / 缓转 / 声乐 / 吹气生风 / 奇境乐台 / 纯享 / 纪念册 */}
      {!immersive && (
      <div
        className={`fixed right-3 top-[60px] z-20 flex max-w-[calc(100vw-24px)] flex-wrap items-center justify-end gap-1.5 transition-opacity duration-500 sm:right-6 sm:top-[78px] sm:max-w-[680px] ${
          isCinemaHidden ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        }`}
      >
        <div className="cinema-surface-soft flex items-center rounded-full p-0.5">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMood(opt.id)}
              className={`rounded-full px-2.5 py-1 font-serif text-[11px] transition ${
                mood === opt.id
                  ? 'bg-signal font-medium text-[#170f07] shadow-[0_0_10px_rgba(242,194,139,0.5)]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAutoOrbit((v) => !v)}
          aria-pressed={autoOrbit}
          className={`cinema-surface-soft rounded-full px-2.5 py-1.5 font-serif text-[11px] transition ${
            autoOrbit ? 'border-signal/50 text-signal' : 'text-white/72 hover:text-white'
          }`}
        >
          {autoOrbit ? '缓转开' : '缓转关'}
        </button>

        <button
          type="button"
          onClick={() => {
            setZoomPreset('standard')
            worldRef.current?.resetView()
          }}
          className="cinema-surface-soft hidden rounded-full px-2.5 py-1.5 font-serif text-[11px] text-white/78 transition hover:border-signal/55 hover:text-signal sm:block"
        >
          复位
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !soundOn
            setSoundOn(next)
            mixer.setActive(next)
            if (next && !muted) {
              void mixer.ensure()
              mixer.startStation(activeMeta.city)
            } else {
              mixer.stopStation()
            }
          }}
          className="cinema-surface-soft rounded-full px-2.5 py-1.5 font-serif text-[11px] text-white/78 transition hover:border-signal/55 hover:text-signal"
        >
          {soundOn ? '♪ 声乐开' : '声乐关'}
        </button>

        {/* 🎤 吹气生风（真实麦克风检测；不可用时无缝提供按住起风） */}
        {!micUnavailable ? (
          <button
            type="button"
            onClick={() => void handleToggleBreath()}
            aria-pressed={breathOn}
            title="开启麦克风吹气生风，轻吹唤起奇境流风与波纹"
            className={`cinema-surface-soft relative flex items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1.5 font-serif text-[11px] transition ${
              breathOn
                ? 'border-amber-200/75 bg-amber-300/18 text-[#fff8ee] shadow-[0_0_16px_-3px_rgba(242,194,139,0.75)]'
                : 'text-white/80 hover:border-signal/55 hover:text-signal'
            }`}
          >
            <span>🎤 吹气生风</span>
            {breathOn && (
              <span
                aria-hidden="true"
                className="flex h-2.5 items-end gap-0.5"
              >
                <span
                  className="w-0.5 rounded-full bg-signal transition-all duration-75"
                  style={{ height: `${Math.max(3, Math.round(breathLevel * 10))}px` }}
                />
                <span
                  className="w-0.5 rounded-full bg-amber-200 transition-all duration-75"
                  style={{ height: `${Math.max(4, Math.round((0.3 + breathLevel * 0.7) * 10))}px` }}
                />
                <span
                  className="w-0.5 rounded-full bg-signal transition-all duration-75"
                  style={{ height: `${Math.max(3, Math.round(breathLevel * 8))}px` }}
                />
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              startManualWind()
            }}
            onPointerUp={stopManualWind}
            onPointerLeave={stopManualWind}
            onPointerCancel={stopManualWind}
            title="按住即可持续唤起奇境微风与波纹"
            className={`cinema-surface-soft flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-serif text-[11px] transition select-none ${
              manualWindHeld
                ? 'border-amber-200/80 bg-amber-300/22 text-[#fff8ee] shadow-[0_0_18px_-3px_rgba(242,194,139,0.85)]'
                : 'border-signal/40 text-signal hover:border-signal'
            }`}
          >
            <span>🌬 按住起风</span>
            {manualWindHeld && (
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-signal" />
            )}
          </button>
        )}

        {/* 🎹 奇境乐台（全局 15 键风铃琴 + 3D 音符奇观） */}
        <button
          type="button"
          onClick={() => setHarpOpen((v) => !v)}
          aria-pressed={harpOpen}
          title={`展开 15 键奇境乐台，在 ${DIORAMA_SCENES.length} 座 3D 世界奏响星尘光柱`}
          className={`cinema-surface-soft rounded-full px-2.5 py-1.5 font-serif text-[11px] transition ${
            harpOpen
              ? 'border-signal/70 bg-signal/22 text-signal shadow-[0_0_16px_-4px_rgba(242,194,139,0.65)]'
              : 'text-white/80 hover:border-signal/55 hover:text-signal'
          }`}
        >
          🎹 奇境乐台
        </button>

        {/* 👁 纯享模式 (H) */}
        <button
          type="button"
          onClick={handleToggleCinema}
          aria-pressed={isCinemaHidden}
          title="切换纯享观影模式（快捷键 H）"
          className="cinema-surface-soft rounded-full px-2.5 py-1.5 font-serif text-[11px] text-white/78 transition hover:border-signal/55 hover:text-signal"
        >
          👁 纯享 (H)
        </button>

        <button
          type="button"
          onClick={() => setAlbumOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-signal/50 bg-signal/16 px-3 py-1.5 font-serif text-[11.5px] text-[#fff8ee] backdrop-blur-md transition hover:bg-signal/25"
        >
          <span>纪念册</span>
          <span className="rounded-full bg-signal px-1.5 py-0.2 font-mono text-[10px] font-medium text-[#170f07]">
            {album.length}
          </span>
          <span className="font-mono text-[10px] text-signal/90">
            ◆{stamps.length}/{DIORAMA_SCENES.length}
          </span>
        </button>
      </div>
      )}

      {immersive && !isCinemaHidden && !pendingShot && !albumOpen && (
        <>
          {/* 左上角极简返回 + 6 城下拉切换 + 奇遇进度点 */}
          <div className="fixed left-3 top-4 z-[65] flex flex-col items-start gap-2 sm:left-6 sm:top-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {onExitWorld && (
                <button
                  type="button"
                  onClick={onExitWorld}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/16 bg-[#060a14]/65 px-3 py-1 font-serif text-[11.5px] text-[#fff8ee]/90 backdrop-blur-2xl transition hover:border-signal/60 hover:text-signal"
                >
                  <span>←</span>
                  <span>返回地球</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setWorldMenuOpen((v) => !v)
                  setToolsOpen(false)
                }}
                aria-expanded={worldMenuOpen}
                className="flex min-h-9 items-center gap-2 rounded-full border border-signal/30 bg-[#060a14]/65 px-3.5 py-1 font-serif text-[12px] tracking-[0.04em] text-[#fff8ee] backdrop-blur-2xl transition hover:border-signal/65"
              >
                <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
                <span>{activeMeta.title}</span>
                <span className="flex items-center gap-1 pl-0.5">
                  {progress.encounters.map((g) => (
                    <span
                      key={g.id}
                      className={`h-1.5 w-1.5 rounded-full transition ${
                        g.done ? 'bg-signal shadow-[0_0_6px_rgba(242,194,139,0.9)]' : 'bg-white/25'
                      }`}
                    />
                  ))}
                </span>
                <span className="text-[10px] text-white/55">▾</span>
              </button>
            </div>

            {worldMenuOpen && (
              <div className="w-60 rounded-2xl border border-signal/25 bg-[#060a14]/88 p-1.5 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
                {CURATED_DIORAMA_SCENES.map((item) => {
                  const active = item.id === sceneId
                  const hasStamp = stamps.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        switchScene(item.id)
                        setWorldMenuOpen(false)
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left font-serif text-[12px] transition ${
                        active
                          ? 'bg-signal/18 text-signal'
                          : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                      {hasStamp && <span className="cinema-gem h-1.5 w-1.5 shrink-0 bg-signal" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 右上角：奇境回声 + 折叠工具箱 */}
          <div className="fixed right-3 top-4 z-[65] flex flex-col items-end gap-2 sm:right-6 sm:top-5">
            <div className="flex items-center gap-1.5">
              <WorldEchoDrawer
                code={radioCode}
                title={worldTitle ?? `${activeMeta.city} · ${activeMeta.title}`}
                muted={muted}
              />
              <button
                type="button"
                onClick={() => {
                  setToolsOpen((v) => !v)
                  setWorldMenuOpen(false)
                }}
                aria-expanded={toolsOpen}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 font-serif text-[12px] backdrop-blur-2xl transition ${
                  toolsOpen
                    ? 'border-signal/65 bg-signal/18 text-signal'
                    : 'border-white/16 bg-[#060a14]/65 text-[#fff8ee]/90 hover:border-signal/55 hover:text-signal'
                }`}
              >
                <span>工具</span>
                <span className="text-[10px] opacity-70">▾</span>
              </button>
            </div>

            {toolsOpen && (
              <div className="flex w-44 flex-col gap-1 rounded-2xl border border-signal/25 bg-[#060a14]/88 p-1.5 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setHarpOpen((v) => !v)
                    setToolsOpen(false)
                  }}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-white/85 transition hover:bg-white/[0.06] hover:text-signal"
                >
                  <span>🎹 奇境乐台</span>
                  <span className="text-[10px] text-white/45">{harpOpen ? '开' : '15键'}</span>
                </button>
                {!micUnavailable ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleBreath()
                      setToolsOpen(false)
                    }}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-white/85 transition hover:bg-white/[0.06] hover:text-signal"
                  >
                    <span>🎤 吹气生风</span>
                    <span className="text-[10px] text-white/45">{breathOn ? '开' : '关'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      startManualWind()
                    }}
                    onPointerUp={stopManualWind}
                    onPointerLeave={stopManualWind}
                    onPointerCancel={stopManualWind}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-signal transition hover:bg-white/[0.06]"
                  >
                    <span>🌬 按住起风</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAlbumOpen(true)
                    setToolsOpen(false)
                  }}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-white/85 transition hover:bg-white/[0.06] hover:text-signal"
                >
                  <span>纪念册</span>
                  <span className="font-mono text-[10px] text-signal">{album.length}</span>
                </button>
                {vantageLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      worldRef.current?.teleportToVantage()
                      setWalkMode(true)
                      setFlightMode(false)
                      setToolsOpen(false)
                      showToast(`已抵达${vantageLabel}`, 2600)
                    }}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-white/85 transition hover:bg-white/[0.06] hover:text-signal"
                  >
                    <span>{vantageLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setViewfinder((v) => !v)
                    setToolsOpen(false)
                  }}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-white/85 transition hover:bg-white/[0.06] hover:text-signal"
                >
                  <span>取景摄影</span>
                  <span className="text-[10px] text-white/45">{viewfinder ? '开' : '关'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleCinema()
                    setToolsOpen(false)
                  }}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left font-serif text-[12px] text-white/85 transition hover:bg-white/[0.06] hover:text-signal"
                >
                  <span>👁 纯享模式</span>
                  <span className="font-mono text-[10px] text-white/45">H</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 互动反馈吐司（避开顶部天光栏与导航栏） */}
      {toast && !isCinemaHidden && (
        <div className="pointer-events-none fixed left-1/2 top-[132px] z-30 w-max max-w-[90vw] -translate-x-1/2 sm:top-[124px]">
          <div className="cinema-surface animate-fade-in flex items-center gap-2 rounded-full border-signal/35 px-4 py-1.5">
            <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
            <span className="font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">{toast}</span>
          </div>
        </div>
      )}

      {/* 奇境乐台：悬浮在底部操作栏上方，避免遮挡场景与底部按钮 */}
      {harpOpen && !pendingShot && !albumOpen && (
        <div
          className={`pointer-events-none fixed inset-x-3 bottom-[max(7.6rem,calc(env(safe-area-inset-bottom)+7rem))] z-[35] flex justify-center transition-opacity duration-500 min-[1400px]:bottom-[84px] ${
            isCinemaHidden ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className={isCinemaHidden ? 'pointer-events-none w-full max-w-[680px]' : 'w-full max-w-[680px]'}>
            <WindChimeHarp
              open={harpOpen}
              onClose={() => setHarpOpen(false)}
              onPlayNote={handlePlayHarpNote}
              docked={false}
            />
          </div>
        </div>
      )}

      {/* 场景欣赏双态 HUD（immersive && !walkMode） */}

      {immersive && !walkMode && !isCinemaHidden && !pendingShot && !albumOpen && (
        <>
          <div className="pointer-events-none fixed left-5 top-[22%] z-20 max-w-[360px] sm:left-10">
            <p className="font-mono text-[10.5px] tracking-[0.26em] text-sky-200/75 uppercase">
              {sceneId === 'agra' ? 'AGRA · TAJ MAHAL DAWN BLUSH' : activeMeta.region}
            </p>
            <h2 className="mt-1.5 font-serif text-[30px] font-normal tracking-[0.06em] text-[#fffdf6] drop-shadow-[0_2px_18px_rgba(4,12,34,0.85)] sm:text-[40px]">
              {activeMeta.title}
            </h2>
            <p className="mt-1 font-serif text-[15px] italic tracking-[0.03em] text-sky-100/85 drop-shadow-[0_2px_10px_rgba(4,12,34,0.8)] sm:text-[17px]">
              {sceneId === 'agra' ? 'Marble holds the blush of dawn.' : activeMeta.city}
            </p>
            <p className="mt-2 font-serif text-[12px] tracking-[0.06em] text-white/75 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]">
              {sceneId === 'agra' ? '晨光很轻，白玉与长池记住了整座拂晓。' : activeMeta.tempDusk}
            </p>
          </div>

          <div className="fixed right-5 top-[24%] z-20 w-56 rounded-2xl border border-white/16 bg-[#06112a]/55 p-3.5 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:right-10">
            <div className="flex items-center justify-between border-b border-white/12 pb-2">
              <span className="font-serif text-[13px] tracking-[0.08em] text-[#fff8ee]">奇遇探索</span>
              <span className="font-mono text-[11px] text-signal">
                {String(progress.discovered).padStart(2, '0')} / {String(progress.total).padStart(2, '0')}
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {progress.encounters.map((goal, idx) => (
                <li key={goal.id}>
                  <button
                    type="button"
                    onClick={() => handleTriggerEncounter(goal.id)}
                    title={goal.hint}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-serif text-[12px] transition ${
                      goal.done
                        ? 'bg-signal/16 text-signal'
                        : 'text-white/85 hover:bg-white/[0.08] hover:text-[#fff8ee]'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-white/55">0{idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{goal.title}</span>
                    {goal.done && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 border-t border-white/10 pt-2 font-serif text-[10.5px] text-white/55">
              轻触画面，或选择一场奇遇。
            </p>
          </div>

          <p className="pointer-events-none fixed bottom-16 left-6 z-20 hidden max-w-[260px] font-serif text-[12px] leading-[1.7] text-white/75 drop-shadow-[0_1px_10px_rgba(0,0,0,0.85)] sm:bottom-8 sm:left-10 sm:block">
            让未曾说出的心愿，
            <br />
            沿着金色的江流，漂向远方。
          </p>
        </>
      )}

      {/* 底部控制区：immersive 模式下采用美术馆级单行极简胶囊；非 immersive 保持完整控制栏 */}
      {immersive ? (
        !pendingShot &&
        !albumOpen && (
          <div
            className={`pointer-events-none fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 transition-opacity duration-500 ${
              isCinemaHidden ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {!walkMode && (
              <button
                type="button"
                onClick={handleToggleWalkMode}
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-signal/55 bg-[#06112a]/75 px-5 py-2 font-serif text-[13px] tracking-[0.06em] text-[#fff8ee] shadow-[0_12px_36px_-8px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition hover:border-signal hover:bg-signal/20"
              >
                <span>按</span>
                <kbd className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-signal">
                  N
                </kbd>
                <span>走进场景漫步</span>
              </button>
            )}
            <div
              className={`no-scrollbar flex h-10 max-w-[calc(100vw-24px)] items-center gap-1.5 overflow-x-auto rounded-full border border-white/15 bg-[#060a14]/65 px-2.5 backdrop-blur-2xl ${
                isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
              }`}
            >
              <div className="flex shrink-0 items-center rounded-full bg-white/[0.04] p-0.5">
                {MOOD_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      const nextHour = option.id === 'dawn' ? 6.3 : option.id === 'night' ? 21.5 : 18.1
                      setMood(option.id)
                      setTimeHour(nextHour)
                      worldRef.current?.setMood(option.id)
                    }}
                    className={`rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                      mood === option.id
                        ? 'bg-signal font-medium text-[#170f07]'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {option.label.slice(0, 1)}
                  </button>
                ))}
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <input
                  type="range"
                  min={5}
                  max={23.5}
                  step={0.1}
                  value={timeHour}
                  aria-label="24 小时太阳时刻"
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    setTimeHour(next)
                    setMood(moodForHour(next))
                    worldRef.current?.setTimeOfDay(next)
                  }}
                  className="h-1 w-16 cursor-pointer accent-[#f2c28b]"
                />
                <span className="w-8 font-mono text-[10px] text-white/60">
                  {`${String(Math.floor(timeHour)).padStart(2, '0')}:${String(Math.round((timeHour % 1) * 60) % 60).padStart(2, '0')}`}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setWeather((w) => (w === 'clear' ? 'rain' : w === 'rain' ? 'snow' : 'clear'))
                }
                title="切换天气：晴 / 雨 / 雪"
                className={`shrink-0 rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                  weather === 'clear'
                    ? 'text-white/72 hover:text-white'
                    : 'bg-sky-400/18 text-sky-200'
                }`}
              >
                {weather === 'rain' ? '雨' : weather === 'snow' ? '雪' : '晴'}
              </button>

              <span className="h-3.5 w-px shrink-0 bg-white/15" />

              {rideAvailable && (
                <button
                  type="button"
                  onClick={() => worldRef.current?.setRidingMode(!riding)}
                  aria-pressed={riding}
                  title="登上或离开当前城市的游船甲板"
                  className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                    riding ? 'bg-signal/22 text-signal' : 'text-white/75 hover:text-signal'
                  }`}
                >
                  {riding ? '下船' : '登船'}
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleWalkMode}
                aria-pressed={walkMode}
                title="切换观景 / 走进漫步 (N)"
                className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 font-serif text-[11px] transition ${
                  walkMode ? 'text-emerald-200' : 'text-signal'
                }`}
              >
                {walkMode ? '← 观景 (N)' : '漫步'}
              </button>
              {walkMode && (
                <button
                  type="button"
                  onClick={handleToggleFlightMode}
                  aria-pressed={flightMode}
                  title="御风飞行 (F)"
                  className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                    flightMode ? 'bg-sky-400/20 text-sky-200' : 'text-white/75 hover:text-sky-200'
                  }`}
                >
                  {flightMode ? '降落' : '飞行 (F)'}
                </button>
              )}
              <button
                type="button"
                aria-pressed={flowPaused}
                onClick={() => setFlowPaused((v) => !v)}
                title={flowPaused ? '恢复场景流动' : '暂停场景流动'}
                className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                  flowPaused ? 'bg-sky-400/20 text-sky-200' : 'text-white/75 hover:text-sky-200'
                }`}
              >
                {flowPaused ? '▶ 继续' : '⏸ 定格'}
              </button>
              <button
                type="button"
                onClick={takePhoto}
                className="shrink-0 whitespace-nowrap rounded-full bg-signal px-3 py-1 font-serif text-[11px] font-medium text-[#170f07] transition hover:brightness-105 active:scale-95"
              >
                拍下纪念
              </button>
            </div>
          </div>
        )
      ) : (
        <div
          className={`pointer-events-none fixed inset-x-3 bottom-[max(3.6rem,calc(env(safe-area-inset-bottom)+3rem))] z-20 flex flex-col items-center gap-2 transition-opacity duration-500 ${
            isCinemaHidden ? 'opacity-0' : 'opacity-100'
          }`}
        >

        {flightMode && !pendingShot && !albumOpen && !harpOpen && (
          <div
            className={`cinema-surface-soft flex items-center gap-2 rounded-full border-sky-300/45 px-3.5 py-1 backdrop-blur-md ${
              isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.95)]" />
            <span className="font-serif text-[11px] tracking-[0.04em] text-[#fff8ee]/94">
              WASD 飞行 · Space/R 攀升 · Q 下降 · F 降落
            </span>
          </div>
        )}

        {walkMode && !flightMode && !pendingShot && !albumOpen && !harpOpen && (
          <div
            className={`cinema-surface-soft flex items-center gap-2 rounded-full border-signal/40 px-3.5 py-1 backdrop-blur-md ${
              isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]" />
            <span className="font-serif text-[11px] tracking-[0.04em] text-[#fff8ee]/92">
              拖拽 360° 环顾 · WASD 漫步 · 双击 Space/F 飞行 · N 切换电影全景
            </span>
          </div>
        )}

        {viewfinder && !pendingShot && !albumOpen && !harpOpen && (
          <div
            className={`cinema-surface-soft flex flex-wrap items-center justify-center gap-2 rounded-full px-3.5 py-1.5 backdrop-blur-md ${
              isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            {!walkMode && (
              <>
                <div className="flex items-center gap-1">
                  <span className="font-serif text-[10.5px] text-white/50">焦距</span>
                  {ZOOM_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setZoomPreset(opt.id)}
                      className={`rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                        zoomPreset === opt.id
                          ? 'bg-signal text-[#170f07] font-medium'
                          : 'text-white/75 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="h-3.5 w-px bg-white/15" />
              </>
            )}
            <div className="flex items-center gap-1">
              <span className="font-serif text-[10.5px] text-white/50">底片</span>
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilmFilter(opt.id)}
                  className={`rounded-full px-2 py-0.5 font-serif text-[11px] transition ${
                    filmFilter === opt.id
                      ? 'bg-signal/25 text-signal'
                      : 'text-white/72 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={`cinema-surface flex w-full max-w-[min(1080px,calc(100vw-24px))] flex-wrap items-center justify-between gap-2 rounded-3xl px-3 py-2 sm:flex-nowrap sm:rounded-full sm:px-3.5 2xl:max-w-[1120px] ${
            isCinemaHidden ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          <button
            type="button"
            onClick={() => sceneSwitcherRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
            className="shrink-0 rounded-full px-1.5 py-1 font-serif text-[17px] leading-none text-signal/70 transition hover:bg-white/[0.08] hover:text-signal"
            aria-label="向左浏览奇境"
            title="向左浏览 12 境"
          >
            ‹
          </button>
          <div
            ref={sceneSwitcherRef}
            className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth"
            aria-label={`${DIORAMA_SCENES.length} 座奇境切换栏`}
          >
            {DIORAMA_SCENES.map((item) => {
              const active = item.id === sceneId
              const hasStamp = stamps.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  data-scene-active={active ? 'true' : 'false'}
                  onClick={() => switchScene(item.id)}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 font-serif text-[11.5px] tracking-[0.03em] transition ${
                    active
                      ? 'bg-signal font-medium text-[#170f07] shadow-[0_6px_18px_-6px_rgba(242,194,139,0.8)]'
                      : 'text-white/75 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {hasStamp && (
                    <span
                      className={`cinema-gem h-1.5 w-1.5 ${
                        active ? 'bg-[#170f07]' : 'bg-signal shadow-[0_0_6px_rgba(242,194,139,0.9)]'
                      }`}
                    />
                  )}
                  <span>{item.short}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => sceneSwitcherRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
            className="shrink-0 rounded-full px-1.5 py-1 font-serif text-[17px] leading-none text-signal/70 transition hover:bg-white/[0.08] hover:text-signal"
            aria-label="向右浏览奇境"
            title="向右浏览 12 境"
          >
            ›
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleWalkMode}
              aria-pressed={walkMode}
              aria-label={`${walkMode ? '漫步场景' : '电影全景'} (快捷键 N 切换)`}
              title={`${walkMode ? '漫步场景' : '电影全景'} (快捷键 N 切换)`}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 font-serif text-[12px] transition ${
                walkMode
                  ? 'border-emerald-300/70 bg-emerald-400/20 text-emerald-100 shadow-[0_0_16px_-4px_rgba(110,231,183,0.7)]'
                  : 'border-signal/50 bg-signal/14 text-signal hover:border-signal hover:bg-signal/24'
              }`}
            >
              <span>{walkMode ? '漫步场景' : '电影全景'}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleFlightMode}
              aria-pressed={flightMode}
              aria-label={flightMode ? '降落 (F)' : '御风飞行 (F)'}
              title={flightMode ? '降落 (快捷键 F)' : '御风飞行 (快捷键 F 或漫步中双击 Space)'}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 font-serif text-[12px] transition ${
                flightMode
                  ? 'border-sky-300/75 bg-sky-400/22 text-sky-100 shadow-[0_0_16px_-4px_rgba(125,211,252,0.78)]'
                  : 'border-white/16 bg-white/[0.05] text-white/85 hover:border-sky-300/55 hover:text-sky-200'
              }`}
            >
              <span>{flightMode ? '🪽 降落 (F)' : '🪽 御风飞行 (F)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewfinder((v) => !v)}
              className={`rounded-full border px-3 py-1.5 font-serif text-[12px] transition ${
                viewfinder
                  ? 'border-signal/65 bg-signal/20 text-signal'
                  : 'border-white/15 bg-white/[0.05] text-white/82 hover:border-signal/45 hover:text-signal'
              }`}
            >
              {viewfinder ? '收起镜框' : '取景摄影'}
            </button>
            <button
              type="button"
              onClick={takePhoto}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-signal px-4 py-1.5 font-serif text-[12.5px] font-medium tracking-[0.06em] text-[#170f07] shadow-[0_8px_24px_-6px_rgba(242,194,139,0.78)] transition hover:brightness-105 active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 8.5h3.2l1.6-2h6.4l1.6 2H20a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 4 8.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>拍下纪念</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 拍摄完成：填写个人留言并收入纪念册 */}
      {pendingShot && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/72 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="写下纪念册留言"
        >
          <div className="cinema-surface animate-fade-up no-scrollbar max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-[26px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hud-label text-signal/85">CAPTURED FRAME · {activeMeta.city}</span>
                  {stampUnlockedHere && (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-signal/20 px-2 py-0.5 font-serif text-[10px] text-signal">
                      含「{activeMeta.stampTitle}」
                    </span>
                  )}
                </div>
                <h2 className="mt-1 font-serif text-[19px] font-normal tracking-[0.06em] text-[#fff8ee]">
                  {activeMeta.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingShot(null)}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/14 px-3 py-1 font-serif text-[11.5px] text-white/70 transition hover:border-signal/50 hover:text-signal"
              >
                重拍
              </button>
            </div>

            <div className="mt-3.5 overflow-hidden rounded-2xl border border-white/14 bg-black/40">
              <img src={pendingShot} alt={activeMeta.title} className="aspect-video w-full object-cover" />
            </div>

            <label className="mt-4 block">
              <span className="font-serif text-[12.5px] tracking-[0.06em] text-signal/90">
                写一句留在纪念册里的留言
              </span>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={3}
                maxLength={140}
                placeholder={activeMeta.loreNote}
                className="mt-2 w-full resize-none rounded-2xl border border-white/14 bg-[#070e1f]/75 px-3.5 py-2.5 font-serif text-[13px] leading-[1.75] text-[#fff8ee] outline-none placeholder:text-white/35 focus:border-signal/60"
              />
            </label>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUICK_NOTES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDraftNote(preset)}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 font-serif text-[11px] text-white/68 transition hover:border-signal/45 hover:text-signal"
                >
                  {preset.slice(0, 14)}…
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setPendingShot(null)} className="btn-ghost">
                取消
              </button>
              <button type="button" onClick={() => saveShotAndMaybeSend(false)} className="btn-ghost border-signal/45 text-signal">
                仅存纪念册
              </button>
              {onSendToPost && (
                <button type="button" onClick={() => saveShotAndMaybeSend(true)} className="btn-primary">
                  存入并去寄视野 ✉
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 视界纪念册总览弹窗（含 12 座奇境印记馆 + 分类筛选 + 序章实拍胶片） */}
      {albumOpen && (
        <div
          className={`fixed inset-0 z-[60] flex bg-[#030712]/74 px-4 py-6 backdrop-blur-sm ${
            immersive ? 'items-stretch justify-end p-0 sm:p-3' : 'items-center justify-center'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="风信纪念册"
          onClick={closeAlbum}
        >
          <div
            className={`cinema-surface animate-fade-up no-scrollbar overflow-y-auto ${
              immersive
                ? 'h-full max-h-none w-full max-w-[520px] rounded-none border-l border-signal/25 p-5 sm:rounded-[28px] sm:p-7'
                : 'max-h-[88dvh] w-full max-w-[840px] rounded-[28px] p-5 sm:p-7'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
                  <span className="hud-label text-signal/85">KEEPSAKE ALBUM · 风信奇境馆纪念册</span>
                </div>
                <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.08em] text-[#fff8ee]">
                  {DIORAMA_SCENES.length} 座奇境印记与立体留影 ({album.length})
                </h2>
                <p className="mt-1 font-serif text-[12px] text-white/58">
                  点亮每座可漫步 3D 奇境的全部机关即可收集专属印记，导出含金漆封印的高清纪念页。
                </p>
              </div>
              <button
                type="button"
                onClick={closeAlbum}
                className="rounded-full border border-white/14 bg-white/[0.05] px-3.5 py-1.5 font-serif text-[12px] text-white/75 transition hover:border-signal/55 hover:text-signal"
              >
                收起 ×
              </button>
            </div>

            {/* 12 座奇境唤醒印记栏 */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DIORAMA_SCENES.map((sc) => {
                const earned = stamps.includes(sc.id)
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      switchScene(sc.id)
                      setAlbumOpen(false)
                    }}
                    className={`rounded-2xl border p-3 text-left transition ${
                      earned
                        ? 'border-signal/40 bg-signal/[0.08] hover:border-signal/65'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif text-[12.5px] text-[#fff8ee]">{sc.short}</span>
                      <span
                        className={`cinema-gem h-2 w-2 ${
                          earned ? 'bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]' : 'border border-white/30'
                        }`}
                      />
                    </div>
                    <div className="mt-1 font-serif text-[11px] text-signal/88">
                      {earned ? `◆ ${sc.stampTitle}` : '待唤醒 3 处机关'}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="cinema-rule my-4" />

            {/* 分类筛选 */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: `全部 (${album.length})` },
                  {
                    id: 'diorama',
                    label: `沉浸奇境 (${album.filter((e) => e.sceneId !== 'meadow' && e.sceneId !== 'postcard').length})`,
                  },
                  {
                    id: 'meadow',
                    label: `序章草原 (${album.filter((e) => e.sceneId === 'meadow').length})`,
                  },
                  {
                    id: 'postcard',
                    label: `漂流明信片 (${album.filter((e) => e.sceneId === 'postcard').length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAlbumCategory(tab.id as typeof albumCategory)}
                    className={`rounded-full px-3 py-1 font-serif text-[11.5px] transition ${
                      albumCategory === tab.id
                        ? 'bg-signal font-medium text-[#170f07]'
                        : 'border border-white/12 text-white/70 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10.5px] text-white/48">
                STAMPS {stamps.length}/{DIORAMA_SCENES.length}
              </span>
            </div>

            {filteredAlbum.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
                <p className="font-serif text-[15px] text-[#fff8ee]/88">
                  {album.length === 0 ? '纪念册还空着' : '当前分类暂无留影'}
                </p>
                <p className="mt-2 font-serif text-[12.5px] leading-[1.8] text-white/55">
                  在沉浸奇境中按提示唤醒三项互动机关，再用取景摄影条调整焦距与底片色调拍下纪念吧。
                </p>
                <button
                  type="button"
                  onClick={closeAlbum}
                  className="btn-primary mt-5"
                >
                  回去拍摄立体奇境
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredAlbum.map((entry) => {
                  const isEditing = editingId === entry.id
                  return (
                    <article
                      key={entry.id}
                      className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]"
                    >
                      <div className="relative aspect-video overflow-hidden bg-black/40">
                        <img
                          src={entry.image}
                          alt={entry.sceneTitle}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                        <span className="absolute left-2.5 top-2.5 rounded-full border border-white/16 bg-[#070e1f]/70 px-2.5 py-0.5 font-serif text-[10.5px] text-[#fff8ee] backdrop-blur-md">
                          {entry.city} · {moodBadgeLabel(entry.mood)}
                        </span>
                        {entry.awakened && (
                          <span className="absolute bottom-2.5 left-2.5 rounded-full border border-signal/55 bg-[#0a1224]/78 px-2.5 py-0.5 font-serif text-[10px] text-signal backdrop-blur-md">
                            ◆ {entry.stampTitle ?? '奇境印记'}
                          </span>
                        )}
                        <span className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] text-white/70">
                          {formatStamp(entry.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="font-serif text-[14px] tracking-[0.04em] text-signal">
                          {entry.sceneTitle}
                        </div>

                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editingNote}
                              onChange={(e) => setEditingNote(e.target.value)}
                              rows={2}
                              maxLength={140}
                              className="w-full resize-none rounded-xl border border-signal/45 bg-[#070e1f]/80 px-2.5 py-1.5 font-serif text-[12.5px] text-[#fff8ee] outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-full border border-white/14 px-2.5 py-1 font-serif text-[11px] text-white/65"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(entry.id)}
                                className="rounded-full bg-signal px-3 py-1 font-serif text-[11px] font-medium text-[#170f07]"
                              >
                                保存留言
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 flex-1 font-serif text-[12.5px] leading-[1.75] text-white/82">
                            “{entry.note}”
                          </p>
                        )}

                        <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
                          <button
                            type="button"
                            onClick={() => void handleExport(entry)}
                            disabled={exportingId === entry.id}
                            className="rounded-full border border-signal/40 bg-signal/12 px-2.5 py-1 font-serif text-[11px] text-signal transition hover:bg-signal/22"
                          >
                            {exportingId === entry.id ? '导出中…' : '保存 PNG'}
                          </button>
                          {onSendToPost && (
                            <button
                              type="button"
                              onClick={() => {
                                setAlbumOpen(false)
                                onSendToPost(entry)
                              }}
                              className="rounded-full border border-white/16 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/84 transition hover:border-signal/50 hover:text-signal"
                            >
                              寄出此景
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(entry.id)
                              setEditingNote(entry.note)
                            }}
                            className="rounded-full border border-white/12 px-2.5 py-1 font-serif text-[11px] text-white/65 transition hover:text-white"
                          >
                            改留言
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="ml-auto rounded-full px-2 py-1 font-serif text-[11px] text-white/45 transition hover:text-ember"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {relay.memories.length > 0 && (
              <>
                <div className="cinema-rule-cool my-5" />
                <div>
                  <h3 className="font-serif text-[13px] tracking-[0.1em] text-signal/88">
                    序章 · 草原实拍胶片 ({relay.memories.length} 帧)
                  </h3>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {relay.memories.map((frame) => (
                      <div
                        key={`${frame.act}-${frame.title}`}
                        className="overflow-hidden rounded-lg border border-white/14 bg-black/40"
                        title={`${frame.act} · ${frame.title}`}
                      >
                        <img src={frame.dataUrl} alt={frame.title} className="aspect-video w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {contextLost && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[#060c1a]/82 px-5 backdrop-blur-md">
          <div className="cinema-surface max-w-[360px] rounded-[24px] p-6 text-center">
            <div className="font-mono text-[10px] tracking-[0.2em] text-signal/80">WEBGL CONTEXT</div>
            <h2 className="mt-2 font-serif text-[17px] font-normal text-[#fff8ee]">
              图形渲染已暂停（设备内存释放）
            </h2>
            <p className="mt-2 font-serif text-[12px] leading-[1.75] text-white/62">
              设备临时回收了三维画布上下文，你的纪念册照片已安全保存在本机。
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
    </main>
  )
}
