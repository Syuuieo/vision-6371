import { useEffect, useMemo, useRef, useState } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import {
  DIORAMA_SCENES,
  DioramaWorld,
  buildGoalSnapshot,
  type DioramaFilter,
  type DioramaInteractEvent,
  type DioramaMood,
  type DioramaProgressSnapshot,
  type DioramaZoomPreset,
} from '../scenes/DioramaWorld'
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

interface DioramaExperienceProps {
  muted: boolean
  flashSafe?: boolean
  relay: StoryRelayState
  onRecordCity?: (city: string) => void
  onSendToPost?: (entry: AlbumEntry) => void
  onGoPrologue?: () => void
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

export function DioramaExperience({
  muted,
  flashSafe = false,
  relay,
  onRecordCity,
  onSendToPost,
  onGoPrologue,
}: DioramaExperienceProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<DioramaWorld | null>(null)
  const [mixer] = useState(() => new AmbientMixer())

  const [sceneId, setSceneId] = useState<DioramaSceneId>('shanghai')
  const [mood, setMood] = useState<DioramaMood>('dusk')
  const [autoOrbit, setAutoOrbit] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [viewfinder, setViewfinder] = useState(false)
  const [zoomPreset, setZoomPreset] = useState<DioramaZoomPreset>('standard')
  const [filmFilter, setFilmFilter] = useState<DioramaFilter>('none')
  const [shutterFlash, setShutterFlash] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [interactCount, setInteractCount] = useState(0)
  const [progress, setProgress] = useState<DioramaProgressSnapshot>(() =>
    buildGoalSnapshot('shanghai', new Set()),
  )
  const [guideOpen, setGuideOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  )
  const [stamps, setStamps] = useState<DioramaSceneId[]>(() => loadDioramaStamps())
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const guideAutoHideRef = useRef<number | null>(null)

  const [album, setAlbum] = useState<AlbumEntry[]>(() => loadAlbum())
  const [albumOpen, setAlbumOpen] = useState(false)
  const [albumCategory, setAlbumCategory] = useState<'all' | 'diorama' | 'meadow' | 'postcard'>('all')
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)

  const soundOnRef = useRef(soundOn)
  const mutedRef = useRef(muted)
  const sceneIdRef = useRef(sceneId)
  const stampsRef = useRef(stamps)
  const activeMeta = useMemo(
    () => DIORAMA_SCENES.find((s) => s.id === sceneId) ?? DIORAMA_SCENES[0],
    [sceneId],
  )

  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    mutedRef.current = muted
    mixer.setMuted(muted)
  }, [mixer, muted])

  useEffect(() => {
    sceneIdRef.current = sceneId
  }, [sceneId])

  useEffect(() => {
    stampsRef.current = stamps
  }, [stamps])

  const showToast = (msg: string, ms = 2600) => {
    setToast(msg)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms)
  }

  // 初始化立体微缩奇境引擎
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
    )
    worldRef.current = world
    return () => {
      world.dispose()
      worldRef.current = null
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      if (guideAutoHideRef.current !== null) window.clearTimeout(guideAutoHideRef.current)
    }
  }, [mixer])

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
    worldRef.current?.loadScene(sceneId, stampsRef.current.includes(sceneId))
    onRecordCity?.(activeMeta.city)
    mixer.setKind(activeMeta.ambience)
    mixer.setVolume(0.5)
    mixer.setActive(soundOn)
    if (soundOn && !muted) {
      void mixer.ensure()
      mixer.startStation(activeMeta.city)
    } else {
      mixer.stopStation()
    }
  }, [activeMeta.ambience, activeMeta.city, mixer, muted, onRecordCity, sceneId, soundOn])

  useEffect(() => {
    worldRef.current?.setMood(mood)
  }, [mood])

  useEffect(() => {
    worldRef.current?.setAutoOrbit(autoOrbit)
  }, [autoOrbit])

  useEffect(() => {
    worldRef.current?.setZoomPreset(zoomPreset)
  }, [zoomPreset])

  const switchScene = (nextId: DioramaSceneId) => {
    if (guideAutoHideRef.current !== null) {
      window.clearTimeout(guideAutoHideRef.current)
      guideAutoHideRef.current = null
    }
    setSceneId(nextId)
    setInteractCount(0)
    setProgress(buildGoalSnapshot(nextId, new Set()))
  }

  const handleGuideNextGoal = () => {
    const msg = worldRef.current?.focusNextGoal()
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
      {/* 全屏立体微缩奇境 3D 场景 */}
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
      {viewfinder && !pendingShot && !albumOpen && (
        <div className="pointer-events-none fixed inset-6 z-20 sm:inset-14">
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
      <aside className="pointer-events-none fixed left-4 top-[112px] z-20 max-w-[320px] sm:left-6 sm:top-[78px] sm:max-w-[335px]">
        <div className="hud-ink flex flex-col gap-0.5 sm:gap-1">
          <div className="flex items-center gap-2">
            <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_12px_rgba(242,194,139,0.9)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-signal/90 sm:text-[10.5px]">
              DIORAMA · {activeMeta.region}
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
          <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="cinema-surface-soft flex items-center gap-1.5 rounded-full px-3 py-1 font-serif text-[11px] text-signal transition hover:border-signal/60"
            >
              <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
              <span>
                {stampUnlockedHere
                  ? `${activeMeta.stampTitle} · 3/3`
                  : `奇境指引 · ${progress.completed}/${progress.total}`}
              </span>
              <span className="text-white/50">▾</span>
            </button>
            {progress.awakened && (
              <button
                type="button"
                onClick={handleReplayFinale}
                className="cinema-surface-soft rounded-full border-signal/45 px-2.5 py-1 font-serif text-[11px] text-[#fff8ee] transition hover:border-signal hover:text-signal"
              >
                再现奇观
              </button>
            )}
          </div>
        ) : (
          <div className="cinema-surface-soft pointer-events-auto mt-2.5 rounded-2xl px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-[11.5px] tracking-[0.06em] text-signal">
                  奇境唤醒 · {progress.completed}/{progress.total}
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
                  <button
                    type="button"
                    onClick={handleGuideNextGoal}
                    className="rounded-full border border-white/16 bg-white/[0.04] px-2.5 py-0.5 font-serif text-[10.5px] text-white/80 transition hover:border-signal/55 hover:text-signal"
                  >
                    寻光指引
                  </button>
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
              {progress.goals.map((goal) => (
                <li key={goal.id} className="flex items-center gap-2 text-[11.5px]">
                  <span
                    className={`cinema-gem h-1.5 w-1.5 shrink-0 transition ${
                      goal.done
                        ? 'bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]'
                        : 'border border-white/35 bg-transparent'
                    }`}
                  />
                  <span
                    className={`font-serif transition ${
                      goal.done ? 'text-white/48 line-through' : 'text-white/84'
                    }`}
                  >
                    {goal.title}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-2 border-t border-white/10 pt-2">
              <p className="font-serif text-[11px] leading-[1.6] text-white/62">
                {relay.promise
                  ? `带着草原约定「${relay.promise}」，在六座城市收集印记与烟火。`
                  : '点亮三处奇境机关可解锁专属城市印记与 3D 奇观；随时可点右上角 × 收起此框。'}
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

      {/* 右上角控制栏：三态天光 / 自动缓转 / 视角复位 / 声乐 / 纪念册 */}
      <div className="pointer-events-auto fixed right-3 top-[60px] z-20 flex flex-wrap items-center justify-end gap-1.5 sm:right-6 sm:top-[78px]">
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

        <button
          type="button"
          onClick={() => setAlbumOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-signal/50 bg-signal/16 px-3 py-1.5 font-serif text-[11.5px] text-[#fff8ee] backdrop-blur-md transition hover:bg-signal/25"
        >
          <span>纪念册</span>
          <span className="rounded-full bg-signal px-1.5 py-0.2 font-mono text-[10px] font-medium text-[#170f07]">
            {album.length}
          </span>
          <span className="font-mono text-[10px] text-signal/90">◆{stamps.length}/6</span>
        </button>
      </div>

      {/* 互动反馈吐司 */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-[122px] z-30 w-max max-w-[90vw] -translate-x-1/2 sm:top-[80px]">
          <div className="cinema-surface animate-fade-in flex items-center gap-2 rounded-full border-signal/35 px-4 py-1.5">
            <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
            <span className="font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">{toast}</span>
          </div>
        </div>
      )}

      {/* 底部场景切换栏 + 取景焦距滤镜与快门 */}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.85rem,env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2 sm:bottom-5">
        {viewfinder && !pendingShot && !albumOpen && (
          <div className="cinema-surface-soft pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full px-3.5 py-1.5 backdrop-blur-md">
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

        <div className="cinema-surface pointer-events-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-2 rounded-3xl px-3 py-2 sm:flex-nowrap sm:rounded-full sm:px-3.5">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {DIORAMA_SCENES.map((item) => {
              const active = item.id === sceneId
              const hasStamp = stamps.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchScene(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-serif text-[12px] tracking-[0.04em] transition ${
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

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
              className="flex items-center gap-1.5 rounded-full bg-signal px-4 py-1.5 font-serif text-[12.5px] font-medium tracking-[0.06em] text-[#170f07] shadow-[0_8px_24px_-6px_rgba(242,194,139,0.78)] transition hover:brightness-105 active:scale-95"
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

      {/* 拍摄完成：填写个人留言并收入纪念册 */}
      {pendingShot && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/72 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="写下纪念册留言"
        >
          <div className="cinema-surface animate-fade-up no-scrollbar max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="hud-label text-signal/85">CAPTURED FRAME · {activeMeta.city}</span>
                  {stampUnlockedHere && (
                    <span className="rounded-full bg-signal/20 px-2 py-0.5 font-serif text-[10px] text-signal">
                      含「{activeMeta.stampTitle}」印记
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
                className="rounded-full border border-white/14 px-3 py-1 font-serif text-[11.5px] text-white/70 transition hover:border-signal/50 hover:text-signal"
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

      {/* 视界纪念册总览弹窗（含 6 城奇境印记馆 + 分类筛选 + 序章实拍胶片） */}
      {albumOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/74 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="视界纪念册"
          onClick={() => setAlbumOpen(false)}
        >
          <div
            className="cinema-surface animate-fade-up no-scrollbar max-h-[88dvh] w-full max-w-[840px] overflow-y-auto rounded-[28px] p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
                  <span className="hud-label text-signal/85">KEEPSAKE ALBUM · 视界纪念册</span>
                </div>
                <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.08em] text-[#fff8ee]">
                  奇境印记与立体留影 ({album.length})
                </h2>
                <p className="mt-1 font-serif text-[12px] text-white/58">
                  点亮每座微缩奇境的全部机关即可收集对应城市印记，导出含金漆封印的高清纪念页。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlbumOpen(false)}
                className="rounded-full border border-white/14 bg-white/[0.05] px-3.5 py-1.5 font-serif text-[12px] text-white/75 transition hover:border-signal/55 hover:text-signal"
              >
                收起 ×
              </button>
            </div>

            {/* 六城奇境唤醒印记栏 */}
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
                    label: `微缩奇境 (${album.filter((e) => e.sceneId !== 'meadow' && e.sceneId !== 'postcard').length})`,
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
              <span className="font-mono text-[10.5px] text-white/48">STAMPS {stamps.length}/6</span>
            </div>

            {filteredAlbum.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
                <p className="font-serif text-[15px] text-[#fff8ee]/88">
                  {album.length === 0 ? '纪念册还空着' : '当前分类暂无留影'}
                </p>
                <p className="mt-2 font-serif text-[12.5px] leading-[1.8] text-white/55">
                  在微缩奇境中按提示唤醒三项互动机关，再用取景摄影条调整焦距与底片色调拍下纪念吧。
                </p>
                <button
                  type="button"
                  onClick={() => setAlbumOpen(false)}
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
