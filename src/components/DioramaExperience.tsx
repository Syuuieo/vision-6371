import { useEffect, useMemo, useRef, useState } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import {
  DIORAMA_SCENES,
  DioramaWorld,
  type DioramaInteractEvent,
} from '../scenes/DioramaWorld'
import {
  deleteAlbumEntry,
  loadAlbum,
  saveAlbumEntry,
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
  '替不能再来地面的人，把这一刻的灯火存进纪念册。',
  '北半球正降温时，我在南半球替你收下了 28°C 的海风。',
  '今晚的星星很亮，走过这里时想起草原上那句约定。',
  '风声和翻书声都很轻，留作下一次重逢时的凭据。',
]

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
  const [mood, setMood] = useState<'dusk' | 'night'>('dusk')
  const [soundOn, setSoundOn] = useState(true)
  const [viewfinder, setViewfinder] = useState(false)
  const [shutterFlash, setShutterFlash] = useState(false)
  const [interactCount, setInteractCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const [album, setAlbum] = useState<AlbumEntry[]>(() => loadAlbum())
  const [albumOpen, setAlbumOpen] = useState(false)
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)

  const soundOnRef = useRef(soundOn)
  const mutedRef = useRef(muted)
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

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }

  // 初始化立体微缩场景引擎
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const world = new DioramaWorld(host, 'shanghai', (event: DioramaInteractEvent) => {
      setInteractCount(event.count)
      setToast(event.label)
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2400)
      if (soundOnRef.current && !mutedRef.current) {
        void mixer.ensure()
        mixer.playInteractionSfx(event.sfx)
      }
      try {
        navigator.vibrate?.(16)
      } catch {
        /* ignore */
      }
    })
    worldRef.current = world
    return () => {
      world.dispose()
      worldRef.current = null
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [mixer])

  useEffect(() => {
    mixer.revive()
    return () => mixer.dispose()
  }, [mixer])

  // 切换立体场景时同步声景与城市记录
  useEffect(() => {
    worldRef.current?.loadScene(sceneId)
    worldRef.current?.setMood(mood)
    onRecordCity?.(activeMeta.city)
    mixer.setKind(activeMeta.ambience)
    mixer.setVolume(0.56)
    mixer.setActive(soundOn)
    if (soundOn && !muted) void mixer.ensure()
  }, [activeMeta.ambience, activeMeta.city, mixer, mood, muted, onRecordCity, sceneId, soundOn])

  useEffect(() => {
    worldRef.current?.setMood(mood)
  }, [mood])

  const takePhoto = () => {
    const dataUrl = worldRef.current?.captureFrame()
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

  const confirmSaveShot = () => {
    if (!pendingShot) return
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
    }
    const next = saveAlbumEntry(entry)
    setAlbum(next)
    setPendingShot(null)
    setDraftNote('')
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

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c1324] select-none">
      {/* 全屏纪念碑谷风格 3D 微缩立体场景 */}
      <div ref={hostRef} className="absolute inset-0" />

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
            REC · 35MM DIORAMA · {activeMeta.city}
          </div>
        </div>
      )}

      {/* 左上角无框编辑部浮层（承接序章剧情且严格尊重原著离别设定） */}
      <aside className="pointer-events-none fixed left-4 top-[70px] z-20 max-w-[330px] sm:left-6 sm:top-[82px]">
        <div className="hud-ink flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_12px_rgba(242,194,139,0.9)]" />
            <span className="font-mono text-[10.5px] tracking-[0.2em] text-signal/90">
              DIORAMA · {activeMeta.region}
            </span>
          </div>
          <h1 className="font-serif text-[21px] font-light tracking-[0.06em] text-[#fff8ee] sm:text-[24px]">
            {activeMeta.title}
          </h1>
          <p className="font-serif text-[12px] leading-[1.7] text-white/76">
            {activeMeta.tempDusk} · {activeMeta.interactHint}
          </p>
        </div>

        {/* 序章剧情温和联动：纪念而非打破原著最后一次地心告别 */}
        <div className="cinema-surface-soft pointer-events-auto mt-3 rounded-2xl px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-serif text-[11px] tracking-[0.08em] text-signal/90">
              {relay.completedPrologue ? '延续草原上的约定' : '纪念册手记'}
            </span>
            {interactCount > 0 && (
              <span className="font-mono text-[10px] text-white/60">互动 {interactCount} 次</span>
            )}
          </div>
          <p className="mt-1 font-serif text-[11.5px] leading-[1.7] text-white/75">
            {relay.promise
              ? `草原的连线已留在 6,371 公里深处。带着那句「${relay.promise}」，替她把人间的灯火与冬夏收进这本纪念册。`
              : relay.wish
                ? `带着石拱下的心愿「${relay.wish}」，在立体微缩风景里替记忆定格一帧温柔。`
                : '草原那一天是她最后一次看见地表。在这里小范围环视世界角落，拍下风景与留言，收进属于你的纪念册。'}
          </p>
          {!relay.completedPrologue && onGoPrologue && (
            <button
              type="button"
              onClick={onGoPrologue}
              className="mt-1.5 font-serif text-[11px] text-signal/90 underline decoration-signal/40 underline-offset-4 transition hover:text-signal"
            >
              先去体验序章 · 地球的一天 →
            </button>
          )}
        </div>
      </aside>

      {/* 右上角快捷操作（昼夜切换 / 归位视角 / 环境声 / 纪念册入口） */}
      <div className="pointer-events-auto fixed right-4 top-[70px] z-20 flex flex-wrap items-center justify-end gap-1.5 sm:right-6 sm:top-[82px]">
        <button
          type="button"
          onClick={() => setMood((m) => (m === 'dusk' ? 'night' : 'dusk'))}
          className="cinema-surface-soft flex items-center gap-1.5 rounded-full px-3 py-1.5 font-serif text-[11.5px] text-white/86 transition hover:border-signal/55 hover:text-signal"
        >
          <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
          <span>{mood === 'dusk' ? '切至星夜' : '切回黄昏'}</span>
        </button>
        <button
          type="button"
          onClick={() => worldRef.current?.resetView()}
          className="cinema-surface-soft rounded-full px-3 py-1.5 font-serif text-[11.5px] text-white/80 transition hover:border-signal/55 hover:text-signal"
        >
          复位视角
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !soundOn
            setSoundOn(next)
            mixer.setActive(next)
            if (next) void mixer.ensure()
          }}
          className="cinema-surface-soft rounded-full px-3 py-1.5 font-serif text-[11.5px] text-white/80 transition hover:border-signal/55 hover:text-signal"
        >
          {soundOn ? '声景开' : '声景关'}
        </button>
        <button
          type="button"
          onClick={() => setAlbumOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-signal/50 bg-signal/16 px-3.5 py-1.5 font-serif text-[12px] text-[#fff8ee] backdrop-blur-md transition hover:bg-signal/25"
        >
          <span>纪念册</span>
          <span className="rounded-full bg-signal px-1.5 py-0.2 font-mono text-[10px] font-medium text-[#170f07]">
            {album.length}
          </span>
        </button>
      </div>

      {/* 互动反馈吐司 */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-[128px] z-30 w-max max-w-[90vw] -translate-x-1/2 sm:top-[84px]">
          <div className="cinema-surface animate-fade-in flex items-center gap-2 rounded-full border-signal/35 px-4 py-1.5">
            <span className="cinema-gem h-1.5 w-1.5 bg-signal" />
            <span className="font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">{toast}</span>
          </div>
        </div>
      )}

      {/* 底部场景切换栏 + 相机快门条 */}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2.5 sm:bottom-6">
        <div className="hud-ink-soft hidden font-serif text-[11.5px] text-white/70 sm:block">
          拖拽小范围环视微缩世界 · 滚轮缩放 · 直接点击建筑/灯火/船只/星石互动
        </div>

        <div className="cinema-surface pointer-events-auto flex w-full max-w-[860px] flex-wrap items-center justify-between gap-2 rounded-3xl px-3 py-2.5 sm:flex-nowrap sm:rounded-full sm:px-3.5 sm:py-2">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {DIORAMA_SCENES.map((item) => {
              const active = item.id === sceneId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSceneId(item.id)
                    setInteractCount(0)
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-serif text-[12px] tracking-[0.04em] transition ${
                    active
                      ? 'bg-signal font-medium text-[#170f07] shadow-[0_6px_18px_-6px_rgba(242,194,139,0.8)]'
                      : 'text-white/75 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {item.short}
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
              {viewfinder ? '关闭取景框' : '取景框'}
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
                <div className="hud-label text-signal/85">CAPTURED FRAME · {activeMeta.city}</div>
                <h2 className="mt-1 font-serif text-[19px] font-light tracking-[0.06em] text-[#fff8ee]">
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

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setPendingShot(null)} className="btn-ghost">
                取消
              </button>
              <button type="button" onClick={confirmSaveShot} className="btn-primary">
                收进纪念册
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 视界纪念册总览弹窗（展示已拍立体照片 + 序章记忆胶片） */}
      {albumOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/74 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="视界纪念册"
          onClick={() => setAlbumOpen(false)}
        >
          <div
            className="cinema-surface animate-fade-up no-scrollbar max-h-[88dvh] w-full max-w-[820px] overflow-y-auto rounded-[28px] p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
                  <span className="hud-label text-signal/85">KEEPSAKE ALBUM · 视界纪念册</span>
                </div>
                <h2 className="mt-1.5 font-serif text-[22px] font-light tracking-[0.08em] text-[#fff8ee]">
                  已定格的立体风景与留言 ({album.length})
                </h2>
                <p className="mt-1 font-serif text-[12px] text-white/58">
                  每一帧都会永久保存在当前设备，可随时改写留言、导出高清纪念页或带去第 03 章寄出。
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

            <div className="cinema-rule my-4" />

            {album.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
                <p className="font-serif text-[15px] text-[#fff8ee]/88">纪念册还空着</p>
                <p className="mt-2 font-serif text-[12.5px] leading-[1.8] text-white/55">
                  先在立体微缩场景里点亮几盏灯、换个喜欢的角度，再按下底部「拍下纪念」即可留下第一页。
                </p>
                <button
                  type="button"
                  onClick={() => setAlbumOpen(false)}
                  className="btn-primary mt-5"
                >
                  回去拍第一张
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {album.map((entry) => {
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
                          {entry.city} · {entry.mood === 'night' ? '星夜' : '黄昏'}
                        </span>
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
    </main>
  )
}
