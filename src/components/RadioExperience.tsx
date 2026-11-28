import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cityCoords } from '../data/seedRadioVisions'
import { SEED_RADIO_BRIEFS } from '../data/seedRadioBriefs'
import { citySignature } from '../data/citySignature'
import type { DioramaSceneId } from '../services/albumStorage'
import { loadAlbum, loadAlbumAsync, loadDioramaStamps, subscribeAlbum } from '../services/albumStorage'
import { getSettings } from '../services/settings'
import { getRadioSignal, listRadioSignals, previewLocalSignals } from '../services/visionApi'
import { CURATED_DIORAMA_SCENES, DIORAMA_SCENES, type DioramaSceneMeta } from '../scenes/diorama/types'
import type { RadioSignal, RadioSignalPreview, VisionOrigin } from '../types/vision'
import { getCityWhisper, type StoryRelayState } from '../utils/storyRelay'
import { resolveRadioEntry, WALKABLE_CITY_SCENE } from '../utils/radioEntry'
import { EarthRadioGlobe, type EarthRadioGlobeHandle, type GlobeBeacon } from './EarthRadioGlobe'
import { SignalViewer } from './SignalViewer'

interface RadioExperienceProps {
  muted: boolean
  onBack: () => void
  onCompose: () => void
  focusCode?: string | null
  autoOpenFocus?: boolean
  relay?: StoryRelayState
  onRecordCity?: (city: string) => void
  onDiveWorld?: (sceneId: DioramaSceneId, title: string, mode: 'cloud' | 'core', code?: string | null) => void
  onOpenAlbum?: () => void
  onOpenSensoryLens?: () => void
}

type SortMode = 'new' | 'hot'
type RegionFilter = 'all' | 'china' | 'south' | 'global'

const SOUTH_CITIES = new Set(['悉尼', '开普敦'])
const GLOBAL_CITIES = new Set(['悉尼', '吉萨', '雷克雅未克', '开普敦', '京都', '巴黎', '罗马', '阿格拉', '格鲁吉亚', '复活节岛'])

const ORIGIN_RANK: Record<VisionOrigin, number> = { cloud: 3, local: 2, seed: 1 }

const CURATED_BY_CITY = new Map<string, DioramaSceneMeta>(
  CURATED_DIORAMA_SCENES.filter((scene) => scene.id !== 'core').map((scene) => [scene.city, scene]),
)
const CORE_SCENE = CURATED_DIORAMA_SCENES.find((scene) => scene.id === 'core') ?? null

function formatAge(timestamp: number) {
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
}

function buildBeacons(items: RadioSignalPreview[]): GlobeBeacon[] {
  const grouped = new Map<string, GlobeBeacon>()
  for (const item of items) {
    const existing = grouped.get(item.city)
    if (existing) {
      existing.heat += item.hearts
      if (ORIGIN_RANK[item.origin] > ORIGIN_RANK[existing.origin]) existing.origin = item.origin
      continue
    }
    const coords = cityCoords(item.city)
    const curated = CURATED_BY_CITY.get(item.city)
    grouped.set(item.city, {
      id: item.city,
      label: item.city,
      lat: coords.lat,
      lon: coords.lon,
      heat: item.hearts,
      origin: item.origin,
      featured: Boolean(curated),
      accent: curated?.accent,
    })
  }
  return [...grouped.values()]
}

export function RadioExperience({
  muted,
  onBack: _onBack,
  onCompose,
  focusCode,
  autoOpenFocus = false,
  relay,
  onRecordCity,
  onDiveWorld,
  onOpenAlbum,
  onOpenSensoryLens,
}: RadioExperienceProps) {
  const [sort, setSort] = useState<SortMode>('new')
  const [region, setRegion] = useState<RegionFilter>('all')
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<RadioSignalPreview[]>(() => previewLocalSignals('new'))
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [hoveredCity, setHoveredCity] = useState<string | null>(null)
  const [previewCore, setPreviewCore] = useState(false)
  const [pendingCity, setPendingCity] = useState<string | null>(null)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [activeSignal, setActiveSignal] = useState<RadioSignal | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pulsing, setPulsing] = useState(false)
  const [cutaway, setCutaway] = useState(false)
  const [albumCount, setAlbumCount] = useState(() => loadAlbum().length)
  const [stampCount] = useState(() => loadDioramaStamps().length)

  const globeRef = useRef<EarthRadioGlobeHandle>(null)
  const openTimer = useRef<number | null>(null)
  const toastTimer = useRef<number | null>(null)
  const pulseTimer = useRef<number | null>(null)
  const pulseAudioRef = useRef<AudioContext | null>(null)
  const focusHandled = useRef<string | null>(null)
  const stepSeqRef = useRef(0)

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }, [])

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearOpenTimer()
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current)
      const ctx = pulseAudioRef.current
      pulseAudioRef.current = null
      if (ctx) void ctx.close()
    }
  }, [clearOpenTimer])

  const playCorePulseChime = useCallback(() => {
    if (muted) return
    const { masterVolume, sfxVolume } = getSettings()
    const level = Math.min(1, Math.max(0, masterVolume * sfxVolume))
    if (level <= 0.001) return
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    try {
      if (!pulseAudioRef.current) {
        pulseAudioRef.current = new AudioCtor()
      }
      const ctx = pulseAudioRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }
      const now = ctx.currentTime + 0.015

      // Warm deep-mantle sub resonance thrum
      const subOsc = ctx.createOscillator()
      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(110, now)
      subOsc.frequency.exponentialRampToValueAtTime(73.42, now + 1.35)
      const subGain = ctx.createGain()
      subGain.gain.setValueAtTime(0.0001, now)
      subGain.gain.exponentialRampToValueAtTime(0.11 * level, now + 0.09)
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55)
      subOsc.connect(subGain)
      subGain.connect(ctx.destination)
      subOsc.start(now)
      subOsc.stop(now + 1.6)

      // Luminous crystalline beacon chime triad
      const chimeNotes = [392.0, 587.33, 783.99, 1174.66]
      chimeNotes.forEach((freq, idx) => {
        const at = now + idx * 0.085
        const osc = ctx.createOscillator()
        osc.type = idx === 0 ? 'triangle' : 'sine'
        osc.frequency.setValueAtTime(freq, at)
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 2400
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime((0.068 * level) / (1 + idx * 0.35), at + 0.018)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.35)
        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        osc.start(at)
        osc.stop(at + 1.42)
      })
    } catch {
      /* ignore audio playback failures */
    }
  }, [muted])

  const handleGlobalPulse = useCallback(() => {
    globeRef.current?.triggerGlobalPulse()
    playCorePulseChime()
    try {
      navigator.vibrate?.([16, 40, 22])
    } catch {
      /* 设备不支持震动 */
    }
    setPulsing(true)
    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current)
    pulseTimer.current = window.setTimeout(() => {
      pulseTimer.current = null
      setPulsing(false)
    }, 1800)
    showToast('地心共鸣波已穿过地幔 · 全球城市信标同步响应')
  }, [playCorePulseChime, showToast])

  const handleSortChange = (nextSort: SortMode) => {
    if (nextSort === sort) return
    setSort(nextSort)
    setLoading(true)
    setItems(previewLocalSignals(nextSort))
  }

  const handleReload = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  useEffect(() => {
    let alive = true
    void listRadioSignals(sort).then((feed) => {
      if (!alive) return
      setItems(feed.items)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [sort, reloadKey])

  useEffect(() => {
    let alive = true
    void loadAlbumAsync().then((entries) => {
      if (alive) setAlbumCount(entries.length)
    })
    const unsubscribe = subscribeAlbum(() => setAlbumCount(loadAlbum().length))
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const filteredItems = useMemo(() => {
    if (region === 'all') return items
    if (region === 'south') return items.filter((item) => SOUTH_CITIES.has(item.city))
    if (region === 'global') return items.filter((item) => GLOBAL_CITIES.has(item.city))
    return items.filter((item) => !GLOBAL_CITIES.has(item.city))
  }, [items, region])
  const beacons = useMemo(() => buildBeacons(filteredItems.length ? filteredItems : items), [filteredItems, items])
  const selectedCount = useMemo(
    () => (selectedCity ? items.filter((item) => item.city === selectedCity).length : 0),
    [items, selectedCity],
  )

  const requestSignal = useCallback(
    (preview: RadioSignalPreview, forceSignal = false) => {
      clearOpenTimer()
      setSelectedCity(preview.city)
      globeRef.current?.focusCity(preview.city)
      const entry = resolveRadioEntry(preview, forceSignal)
      if (entry.kind === 'world' && onDiveWorld) {
        onDiveWorld(entry.sceneId, preview.title, 'cloud', preview.code)
        return
      }
      setPendingCity(preview.city)
      setPendingCode(preview.code)
      void getRadioSignal(preview.code).then((signal) => {
        if (!signal) {
          setPendingCity(null)
          setPendingCode(null)
          showToast('这条风景刚刚走散了 · 换一座城市试试')
          return
        }
        openTimer.current = window.setTimeout(() => {
          openTimer.current = null
          setPendingCity(null)
          setPendingCode(null)
          setActiveSignal(signal)
        }, 720)
      })
    },
    [clearOpenTimer, onDiveWorld, showToast],
  )

  const activeIndex = activeSignal ? items.findIndex((item) => item.code === activeSignal.code) : -1

  const stepSignal = (delta: number) => {
    if (items.length < 2 || activeIndex < 0) return
    clearOpenTimer()
    const next = (activeIndex + delta + items.length) % items.length
    const target = items[next]
    const seq = ++stepSeqRef.current
    setSelectedCity(target.city)
    globeRef.current?.focusCity(target.city)
    void getRadioSignal(target.code).then((signal) => {
      if (seq !== stepSeqRef.current) return
      if (!signal) {
        showToast('这条风景刚刚走散了 · 再按一次试试')
        return
      }
      setPendingCity(null)
      setPendingCode(null)
      setActiveSignal(signal)
    })
  }

  const handleBeaconSelect = (beacon: GlobeBeacon) => {
    setPreviewCore(false)
    const target = items.find((item) => item.city === beacon.id)
    if (!target) return
    requestSignal(target)
  }

  const handleGlobeHover = useCallback((beacon: GlobeBeacon | null) => {
    setHoveredCity(beacon?.id ?? null)
  }, [])

  const diveCuratedScene = useCallback(
    (scene: DioramaSceneMeta) => {
      if (!onDiveWorld) return
      if (scene.id === 'core') {
        onDiveWorld('core', '地心深处 · 落日六号', 'core')
        return
      }
      const matching = items.find((item) => item.city === scene.city && item.origin === 'seed')
      onDiveWorld(scene.id, matching?.title ?? scene.title, 'cloud', matching?.code ?? null)
    },
    [items, onDiveWorld],
  )

  const handleSelectCurated = useCallback(
    (scene: DioramaSceneMeta) => {
      if (scene.id === 'core') {
        const alreadyCore = previewCore && cutaway
        if (alreadyCore) {
          diveCuratedScene(scene)
          return
        }
        setSelectedCity(null)
        setPreviewCore(true)
        setCutaway(true)
        showToast('地球 1/4 地核剖面已展开 · 点击「走进奇境」直潜落日六号')
        return
      }
      setPreviewCore(false)
      if (selectedCity === scene.city) {
        diveCuratedScene(scene)
        return
      }
      setSelectedCity(scene.city)
      globeRef.current?.focusCity(scene.city)
    },
    [cutaway, diveCuratedScene, previewCore, selectedCity, showToast],
  )

  const previewCityName = hoveredCity ?? selectedCity
  const previewCuratedScene = useMemo<DioramaSceneMeta | null>(() => {
    if (hoveredCity) return CURATED_BY_CITY.get(hoveredCity) ?? null
    if (previewCore && cutaway) return CORE_SCENE
    if (selectedCity) return CURATED_BY_CITY.get(selectedCity) ?? null
    return null
  }, [cutaway, hoveredCity, previewCore, selectedCity])
  const previewSignalItem = useMemo(
    () => (previewCityName ? items.find((item) => item.city === previewCityName) ?? null : null),
    [items, previewCityName],
  )

  const handleRandom = () => {
    if (!items.length) return
    const pool = items.length > 1 ? items.filter((item) => item.code !== pendingCode) : items
    const pick = pool[Math.floor(Math.random() * pool.length)]
    requestSignal(pick)
  }

  const handleHeartsChange = (code: string, hearts: number) => {
    setItems((current) => current.map((item) => (item.code === code ? { ...item, hearts } : item)))
  }

  const handleDeleted = (code: string) => {
    setItems((current) => current.filter((item) => item.code !== code))
  }

  useEffect(() => {
    if (!focusCode) {
      focusHandled.current = null
      return
    }
    if (focusHandled.current === focusCode) return
    const target = items.find((item) => item.code === focusCode)
    if (!target) return
    focusHandled.current = focusCode
    if (autoOpenFocus) {
      const timer = window.setTimeout(() => {
        requestSignal(target, true)
        showToast(`正在接通今日回声 · ${target.city}`)
      }, 180)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      setSelectedCity(target.city)
      globeRef.current?.focusCity(target.city)
      showToast(`已在 ${target.city} 点亮你的风景`)
    }, 420)
    return () => window.clearTimeout(timer)
  }, [autoOpenFocus, focusCode, items, requestSignal, showToast])

  return (
    <main
      className="no-scrollbar relative z-10 h-dvh w-full overflow-y-auto overflow-x-hidden lg:overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0b1630 0%, #122347 48%, #091122 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 36% 34%, rgba(92, 162, 240, 0.2), transparent 72%), radial-gradient(45% 40% at 80% 82%, rgba(242, 194, 139, 0.1), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-3 px-3 pb-16 pt-[66px] sm:px-5 sm:pb-16 sm:pt-[78px] lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1.42fr)_minmax(360px,0.58fr)] lg:gap-4 lg:pb-14">
        <section className="cinema-surface-soft relative flex h-[66dvh] min-h-[450px] flex-col overflow-hidden rounded-[28px] lg:h-full lg:min-h-0">
          <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[66%] pr-2 sm:left-5 sm:top-5 sm:max-w-[70%]">
            <h1 className="hud-ink font-serif text-[20px] font-normal tracking-[0.08em] text-[#fff8ee] sm:text-[24px]">
              行星电台
            </h1>
            <p className="hud-ink-soft mt-1 font-serif text-[12px] tracking-[0.04em] text-signal/90 sm:text-[13px]">
              {selectedCity
                ? `${selectedCity} · ${selectedCount} 份视野正在呼吸`
                : '轻触发光地标，替地心深处的她借用一双眼睛'}
            </p>
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-[#091224]/72 px-3 py-1 font-serif text-[11px] text-white/80 backdrop-blur-md sm:text-[11.5px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal animate-[blinkDot_2.2s_ease-in-out_infinite]" />
              <span className="truncate">
                {relay?.completedPrologue
                  ? `落日六号接力中 · 已点亮 ${relay.relayedCities.length}/18 座全球城市${relay.promise ? ` · ${relay.promise}` : ''}`
                  : selectedCity
                    ? getCityWhisper(selectedCity)
                    : `${CURATED_DIORAMA_SCENES.length} 大 3D 奇境与 ${SEED_RADIO_BRIEFS.length} 座地表信标 · 悬停预览，轻触走进`}
              </span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <EarthRadioGlobe
              ref={globeRef}
              beacons={beacons}
              selectedId={selectedCity}
              onSelect={handleBeaconSelect}
              onHover={handleGlobeHover}
              cutaway={cutaway}
              onSelectCore={() => onDiveWorld?.('core', '地心深处 · 落日六号', 'core')}
              className="h-full w-full"
            />
            {onOpenAlbum && (
              <button
                type="button"
                onClick={onOpenAlbum}
                className="absolute right-3 top-4 z-20 flex min-h-10 items-center gap-2 rounded-full border border-signal/35 bg-[#060a14]/70 px-3.5 py-2 font-serif text-[11px] tracking-[0.05em] text-[#fff8ee] shadow-[0_12px_36px_-18px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition hover:border-signal/75 hover:bg-[#060a14]/88 sm:right-5 sm:top-5 sm:min-h-11 sm:px-4 sm:text-[11.5px]"
                title="打开我的纪念册与奇境印记墙"
              >
                <span className="text-signal">◇</span>
                <span className="hidden sm:inline">我的纪念册（{albumCount} 张 · 印记 {stampCount}/{DIORAMA_SCENES.length}）</span>
                <span className="sm:hidden">纪念册 ({albumCount})</span>
              </button>
            )}
            <div className="pointer-events-none absolute right-4 top-[68px] z-10 hidden rounded-full border border-white/12 bg-[#060a14]/55 px-3 py-1 font-serif text-[10.5px] tracking-[0.04em] text-white/65 backdrop-blur-2xl sm:block">
              {cutaway ? 'X 光地核模式 · 点击地心可直潜落日六号' : '可拖拽旋转地球 · 滚轮缩放'}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 sm:inset-x-4 sm:bottom-4">
            {(previewCuratedScene || previewSignalItem) && (
              <div className="pointer-events-auto animate-fade-in max-w-[440px] rounded-2xl border border-signal/35 bg-[#071022]/86 p-3 shadow-[0_18px_44px_-16px_rgba(0,0,0,0.92)] backdrop-blur-2xl transition-all duration-300 sm:p-3.5">
                {previewCuratedScene ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                          style={{ backgroundColor: previewCuratedScene.accent, color: previewCuratedScene.accent }}
                        />
                        <span className="font-serif text-[10.5px] tracking-[0.08em] text-signal/90">
                          ✦ 3D 奇境传送门 · {previewCuratedScene.region}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate font-serif text-[15px] font-normal tracking-[0.05em] text-[#fff8ee]">
                        {previewCuratedScene.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 font-sans text-[11.5px] text-white/68">
                        {previewCuratedScene.tempDusk} · {previewCuratedScene.loreNote}
                      </p>
                    </div>
                    {onDiveWorld && (
                      <button
                        type="button"
                        onClick={() => diveCuratedScene(previewCuratedScene)}
                        className="shrink-0 rounded-full bg-gradient-to-r from-[#f2c28b] via-[#ffcf96] to-[#f49d56] px-4 py-2 font-serif text-[12px] font-medium tracking-[0.06em] text-[#170f07] shadow-[0_10px_28px_-8px_rgba(242,194,139,0.75)] transition hover:brightness-105 active:scale-[0.98]"
                      >
                        走进奇境 →
                      </button>
                    )}
                  </div>
                ) : previewSignalItem ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-[10.5px] tracking-[0.08em] text-sky-200/85">
                        ◈ 地表电台信标 · {previewSignalItem.city}
                      </div>
                      <h3 className="mt-0.5 truncate font-serif text-[14.5px] tracking-[0.04em] text-[#fff8ee]">
                        {previewSignalItem.title}
                      </h3>
                      <p className="mt-0.5 truncate font-sans text-[11.5px] text-white/65">
                        {previewSignalItem.sender} · {previewSignalItem.tempC}°C · {getCityWhisper(previewSignalItem.city)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestSignal(previewSignalItem)}
                      className="shrink-0 rounded-full border border-signal/55 bg-signal/18 px-3.5 py-2 font-serif text-[12px] tracking-[0.05em] text-[#fff8ee] transition hover:bg-signal hover:text-[#170f07]"
                    >
                      收听视野
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div className="pointer-events-auto no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {CURATED_DIORAMA_SCENES.map((scene) => {
                const isCore = scene.id === 'core'
                const active = isCore ? previewCore && cutaway : selectedCity === scene.city
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => handleSelectCurated(scene)}
                    className={`group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-serif text-[11.5px] tracking-[0.05em] backdrop-blur-2xl transition sm:text-[12px] ${
                      active
                        ? 'border-signal bg-signal text-[#170f07] font-medium shadow-[0_8px_22px_-6px_rgba(242,194,139,0.85)]'
                        : 'border-white/16 bg-[#060a14]/70 text-[#fff8ee]/88 hover:border-signal/60 hover:bg-[#0b152c]/85 hover:text-[#fff8ee]'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full transition-transform group-hover:scale-125"
                      style={{
                        backgroundColor: active ? '#170f07' : scene.accent,
                        boxShadow: active ? 'none' : `0 0 8px ${scene.accent}`,
                      }}
                    />
                    <span>{scene.short}</span>
                  </button>
                )
              })}
            </div>

            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
              <button
                type="button"
                onClick={handleRandom}
                disabled={!items.length || pendingCity !== null}
                className="flex items-center gap-1.5 rounded-full bg-signal px-3.5 py-2 font-serif text-[12px] font-medium tracking-[0.06em] text-[#170f07] shadow-[0_12px_32px_-8px_rgba(242,194,139,0.65)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:py-2 sm:text-[12.5px]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
                  <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                随机借一双眼
              </button>
              <button
                type="button"
                onClick={onCompose}
                className="rounded-full border border-white/18 bg-[#060a14]/65 px-3.5 py-2 font-serif text-[12px] tracking-[0.06em] text-[#fff8ee] backdrop-blur-2xl transition hover:border-signal/60 hover:bg-signal/15 active:scale-[0.98] sm:px-4 sm:text-[12.5px]"
              >
                寄出我的视野
              </button>
              <button
                type="button"
                onClick={handleGlobalPulse}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-serif text-[12px] tracking-[0.06em] backdrop-blur-2xl transition active:scale-[0.98] sm:px-4 sm:text-[12.5px] ${
                  pulsing
                    ? 'border-signal/80 bg-signal/22 text-[#fff8ee] shadow-[0_0_26px_-4px_rgba(242,194,139,0.72)]'
                    : 'border-signal/35 bg-[#060a14]/65 text-signal hover:border-signal/70 hover:bg-signal/16 hover:text-[#fff8ee]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block text-[12px] leading-none ${pulsing ? 'animate-pulse text-[#ffe8bd]' : 'text-signal'}`}
                >
                  ◉
                </span>
                <span>地心共鸣波</span>
              </button>
              <button
                type="button"
                aria-pressed={cutaway}
                onClick={() => {
                  setCutaway((prev) => {
                    const next = !prev
                    if (next) {
                      setPreviewCore(true)
                      showToast('地球 1/4 地核剖面已展开 · 点击「走进奇境」可穿壳下潜')
                    } else {
                      setPreviewCore(false)
                    }
                    return next
                  })
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-serif text-[12px] tracking-[0.06em] backdrop-blur-2xl transition active:scale-[0.98] sm:px-4 sm:text-[12.5px] ${
                  cutaway
                    ? 'border-[#ff9d5c]/75 bg-[#36110e]/75 text-[#ffe6c4] shadow-[0_0_24px_-4px_rgba(255,146,72,0.58)]'
                    : 'border-signal/30 bg-[#060a14]/65 text-[#fff3df]/88 hover:border-signal/65 hover:bg-signal/12 hover:text-[#fff9f0]'
                }`}
              >
                <span aria-hidden="true" className="text-[12px] leading-none">◎</span>
                <span>地球 X 光剖面</span>
              </button>
            </div>
          </div>

          {pendingCity && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#091226]/40 backdrop-blur-[2px]">
              <div className="cinema-surface flex items-center gap-3 rounded-full px-5 py-3">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-signal/30 border-t-signal" />
                <span className="font-serif text-[13px] tracking-[0.06em] text-[#fff8ee]">
                  正在前往 {pendingCity}，借用一双眼睛…
                </span>
              </div>
            </div>
          )}
        </section>

        <aside className="cinema-surface flex min-h-[42dvh] flex-col overflow-hidden rounded-[28px] lg:h-full lg:min-h-0">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-[15.5px] font-normal tracking-[0.08em] text-[#fff8ee]">
                  奇境与电台驿站
                </h2>
                <p className="mt-0.5 font-serif text-[11px] text-white/55">
                  {loading ? '正在刷新城市视野…' : `共 ${filteredItems.length} 份来自地表的目光`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenSensoryLens && (
                  <button
                    type="button"
                    onClick={onOpenSensoryLens}
                    className="flex items-center gap-1 rounded-full border border-signal/25 bg-[#060a14]/60 px-2.5 py-1 font-serif text-[11px] tracking-[0.04em] text-signal/90 backdrop-blur-2xl transition hover:border-signal/60 hover:bg-signal/12 hover:text-[#fff8ee]"
                    title="打开传感透镜采集实景"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
                    <span>传感透镜</span>
                  </button>
                )}
                <div className="flex rounded-full border border-white/12 bg-white/[0.04] p-0.5">
                  {([
                    ['new', '最新'],
                    ['hot', '最热'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSortChange(id)}
                      aria-pressed={sort === id}
                      className={`rounded-full px-2.5 py-1 font-serif text-[11.5px] tracking-[0.04em] transition ${
                        sort === id ? 'bg-signal text-[#170f07] font-medium' : 'text-white/65 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleReload}
                  disabled={loading}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/65 transition hover:border-signal/50 hover:text-signal disabled:cursor-wait disabled:opacity-40"
                  aria-label="刷新风景列表"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 11a8 8 0 1 0-.6 4M20 5v6h-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto">
              {([
                ['all', `全部 ${SEED_RADIO_BRIEFS.length} 城`, null],
                ['china', '中国城市', '大理'],
                ['global', '异域极境', '雷克雅未克'],
                ['south', '南半球盛夏', '悉尼'],
              ] as const).map(([id, label, focusTarget]) => {
                const active = region === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setRegion(id)
                      if (focusTarget) globeRef.current?.focusCity(focusTarget)
                    }}
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 font-serif text-[11px] tracking-[0.04em] transition ${
                      active
                        ? 'border-signal/65 bg-signal/18 text-signal'
                        : 'border-white/10 bg-white/[0.03] text-white/62 hover:border-signal/35 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="studio-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 pb-6">
            {loading && items.length === 0
              ? Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[88px] animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]"
                  />
                ))
              : filteredItems.map((item) => {
                  const active = item.code === pendingCode
                  const walkableSceneId = WALKABLE_CITY_SCENE[item.city]
                  return (
                    <div
                      key={item.code}
                      role="button"
                      tabIndex={0}
                      onClick={() => requestSignal(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          requestSignal(item)
                        }
                      }}
                      className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                        active
                          ? 'border-signal/55 bg-signal/12 shadow-[0_8px_28px_-12px_rgba(242,194,139,0.5)]'
                          : 'border-white/10 bg-white/[0.03] hover:border-signal/35 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-xl border border-white/10">
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className={`h-full w-full object-cover transition duration-500 ${
                            active ? 'scale-[1.05]' : 'group-hover:scale-[1.04]'
                          }`}
                          draggable={false}
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-[#091122]/80 via-transparent to-transparent" />
                        <span className="absolute bottom-1 left-1.5 rounded-full bg-black/45 px-2 py-0.5 font-serif text-[10.5px] text-[#fff8ee]">
                          {item.city}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-serif text-[14px] tracking-[0.04em] text-[#fff8ee]">
                            {item.title}
                          </div>
                          {walkableSceneId && item.origin === 'seed' && (
                            <span className="shrink-0 rounded-full border border-signal/25 bg-signal/[0.08] px-2 py-0.5 font-serif text-[10px] text-signal/90">
                              可走进 3D
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate font-sans text-[12px] text-white/62">
                          {item.sender} · {item.tempC}°C ·{' '}
                          {citySignature(item.city)?.weather || item.scentTag || '安静的风'}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 font-sans text-[11px] text-white/55">
                          <span className="flex items-center gap-1 text-signal">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M3 12h4l2-6 4 12 2.5-7.5L17 12h4"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {item.hearts.toLocaleString('zh-CN')} 次共鸣
                          </span>
                          <span>{formatAge(item.publishedAt)}</span>
                          {item.hasVoice && <span className="ml-auto text-sky-200/85">含原声</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
          </div>
        </aside>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] left-1/2 z-40 w-[min(90vw,460px)] -translate-x-1/2">
          <div className="animate-fade-in cinema-surface rounded-full border-signal/35 px-4 py-2.5 text-center font-serif text-[12.5px] tracking-[0.04em] text-[#fff8ee]">
            {toast}
          </div>
        </div>
      )}

      {activeSignal && (
        <SignalViewer
          key={activeSignal.code}
          signal={activeSignal}
          muted={muted}
          onHeartsChange={handleHeartsChange}
          onDeleted={handleDeleted}
          onCityResonate={onRecordCity}
          onClose={() => setActiveSignal(null)}
          onStep={stepSignal}
          position={{ index: activeIndex + 1, total: items.length }}
        />
      )}
    </main>
  )
}
