import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cityCoords } from '../data/seedRadioVisions'
import { citySignature } from '../data/citySignature'
import { getRadioSignal, listRadioSignals, previewLocalSignals } from '../services/visionApi'
import type { RadioSignal, RadioSignalPreview, VisionOrigin } from '../types/vision'
import { getCityWhisper, type StoryRelayState } from '../utils/storyRelay'
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
}

type SortMode = 'new' | 'hot'

const ORIGIN_RANK: Record<VisionOrigin, number> = { cloud: 3, local: 2, seed: 1 }

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
    grouped.set(item.city, {
      id: item.city,
      label: item.city,
      lat: coords.lat,
      lon: coords.lon,
      heat: item.hearts,
      origin: item.origin,
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
}: RadioExperienceProps) {
  const [sort, setSort] = useState<SortMode>('new')
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<RadioSignalPreview[]>(() => previewLocalSignals('new'))
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [pendingCity, setPendingCity] = useState<string | null>(null)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [activeSignal, setActiveSignal] = useState<RadioSignal | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const globeRef = useRef<EarthRadioGlobeHandle>(null)
  const openTimer = useRef<number | null>(null)
  const toastTimer = useRef<number | null>(null)
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
    }
  }, [clearOpenTimer])

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

  const beacons = useMemo(() => buildBeacons(items), [items])
  const selectedCount = useMemo(
    () => (selectedCity ? items.filter((item) => item.city === selectedCity).length : 0),
    [items, selectedCity],
  )

  const requestSignal = useCallback(
    (preview: RadioSignalPreview) => {
      clearOpenTimer()
      setSelectedCity(preview.city)
      globeRef.current?.focusCity(preview.city)
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
    [clearOpenTimer, showToast],
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
    const target = items.find((item) => item.city === beacon.id)
    if (!target) return
    requestSignal(target)
  }

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
        requestSignal(target)
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

      <div className="relative mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-3 px-3 pb-6 pt-[66px] sm:px-5 sm:pt-[78px] lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1.42fr)_minmax(360px,0.58fr)] lg:gap-4 lg:pb-5">
        <section className="cinema-surface-soft relative flex h-[62dvh] min-h-[420px] flex-col overflow-hidden rounded-[28px] lg:h-full lg:min-h-0">
          <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-[90%] pr-3 sm:max-w-[85%]">
            <h1 className="hud-ink font-serif text-[20px] font-light tracking-[0.08em] text-[#fff8ee] sm:text-[24px]">
              地球表面电台
            </h1>
            <p className="mt-1 font-serif text-[12.5px] tracking-[0.04em] text-signal/90 sm:text-[13px]">
              {selectedCity
                ? `${selectedCity} · ${selectedCount} 份视野正在呼吸`
                : '轻触发光地标，替地心深处的她借用一双眼睛'}
            </p>
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-[#091224]/72 px-3 py-1 font-serif text-[11.5px] text-white/80 backdrop-blur-md">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal animate-[blinkDot_2.2s_ease-in-out_infinite]" />
              <span className="truncate">
                {relay?.completedPrologue
                  ? `落日六号接力中 · 已替林微点亮 ${relay.relayedCities.length}/12 座城${relay.promise ? ` · ${relay.promise}` : ''}`
                  : selectedCity
                    ? getCityWhisper(selectedCity)
                    : '地心 6,371 公里处的林微正在收听 · 点击发光地标接力视野'}
              </span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <EarthRadioGlobe
              ref={globeRef}
              beacons={beacons}
              selectedId={selectedCity}
              onSelect={handleBeaconSelect}
              className="h-full w-full"
            />
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2.5 sm:inset-x-4 sm:bottom-4">
            <div className="pointer-events-auto no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {beacons.map((beacon) => {
                const active = selectedCity === beacon.id
                return (
                  <button
                    key={beacon.id}
                    type="button"
                    onClick={() => handleBeaconSelect(beacon)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-serif text-[12px] tracking-[0.04em] backdrop-blur-md transition ${
                      active
                        ? 'border-signal bg-signal text-[#170f07] font-medium shadow-[0_6px_20px_-6px_rgba(242,194,139,0.85)]'
                        : 'border-white/15 bg-[#0d1935]/72 text-white/85 hover:border-signal/55 hover:text-[#fff8ee]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        active ? 'bg-[#170f07]' : beacon.origin === 'cloud' ? 'bg-sky-300' : 'bg-signal'
                      }`}
                    />
                    {beacon.label}
                  </button>
                )
              })}
            </div>

            <div className="pointer-events-auto flex items-center justify-center gap-2.5 sm:justify-start">
              <button
                type="button"
                onClick={handleRandom}
                disabled={!items.length || pendingCity !== null}
                className="flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 font-serif text-[13px] font-medium tracking-[0.06em] text-[#170f07] shadow-[0_12px_32px_-8px_rgba(242,194,139,0.65)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
                  <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                随机借一双眼
              </button>
              <button
                type="button"
                onClick={onCompose}
                className="rounded-full border border-white/20 bg-[#0d1935]/75 px-4 py-2.5 font-serif text-[13px] tracking-[0.06em] text-[#fff8ee] backdrop-blur-md transition hover:border-signal/60 hover:bg-signal/15 active:scale-[0.98]"
              >
                寄出我的视野
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
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5">
            <div>
              <h2 className="font-serif text-[16px] font-light tracking-[0.08em] text-[#fff8ee]">
                最近抵达的风景
              </h2>
              <p className="mt-0.5 font-serif text-[11.5px] text-white/55">
                {loading ? '正在刷新城市视野…' : `共 ${items.length} 份来自地表的目光`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
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
                    className={`rounded-full px-3 py-1 font-serif text-[12px] tracking-[0.04em] transition ${
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
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/65 transition hover:border-signal/50 hover:text-signal disabled:cursor-wait disabled:opacity-40"
                aria-label="刷新风景列表"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

          <div className="studio-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
            {loading && items.length === 0
              ? Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[88px] animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]"
                  />
                ))
              : items.map((item) => {
                  const active = item.code === pendingCode
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => requestSignal(item)}
                      className={`group flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
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
                        <div className="truncate font-serif text-[14px] tracking-[0.04em] text-[#fff8ee]">
                          {item.title}
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
                    </button>
                  )
                })}
          </div>
        </aside>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 w-[min(90vw,460px)] -translate-x-1/2 sm:bottom-6">
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
