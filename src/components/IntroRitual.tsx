import { useEffect, useState } from 'react'
import { getSettings, prefersReducedMotion, subscribeSettings } from '../services/settings'
import type { DailyEcho } from '../services/journey'
import type { ModuleId } from '../types/sensor'
import { CoverHorizonCanvas } from './prologue/CoverHorizonCanvas'

const PORTAL_CARDS: {
  id: ModuleId
  index: string
  title: string
  sub: string
}[] = [
  { id: 'prologue', index: '01', title: '草原序章', sub: '8 幕剧情 · 地心反转' },
  { id: 'radio', index: '02', title: '全球电台', sub: '3D 地球 · 全球声景' },
  { id: 'post', index: '03', title: '视野信箱', sub: '漂流邮局 · 明信片' },
  { id: 'diorama', index: '04', title: '立体纪念册', sub: '6 城微缩 3D 奇观' },
]

interface IntroRitualProps {
  opening: boolean
  onEnter: () => void
  onNavigate?: (target: ModuleId) => void
  resumeLabel?: string | null
  onResume?: () => void
  echo?: DailyEcho | null
  echoRead?: boolean
  onListenEcho?: (code: string) => void
  flashSafe?: boolean
  onToggleFlashSafe?: () => void
  onPreloadScene?: () => void
  sceneMounted?: boolean
}

export function IntroRitual({
  opening,
  onEnter,
  onNavigate,
  resumeLabel,
  onResume,
  echo,
  echoRead,
  onListenEcho,
  flashSafe = false,
  onToggleFlashSafe,
  onPreloadScene,
  sceneMounted = false,
}: IntroRitualProps) {
  const [reducedMotion, setReducedMotion] = useState(
    () => getSettings().reducedMotion || prefersReducedMotion(),
  )

  useEffect(
    () =>
      subscribeSettings(() => {
        setReducedMotion(getSettings().reducedMotion || prefersReducedMotion())
      }),
    [],
  )

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${opening ? 'pointer-events-none' : ''}`}>
      {/* 按需挂载 3D 前，用轻量 Canvas 2D「双界地平线」承载黎明草原与地底脉冲暗喻，零 Three.js 负载 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          sceneMounted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <CoverHorizonCanvas paused={sceneMounted || opening} calm={flashSafe || reducedMotion} />
      </div>

      {/* 光学取景四角框与地平线刻度（桌面端轻量点缀，不剧透深度数字） */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 hidden transition-opacity duration-700 sm:block ${
          opening || sceneMounted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="absolute left-7 top-20 h-4 w-4 border-l border-t border-signal/25" />
        <span className="absolute right-7 top-20 h-4 w-4 border-r border-t border-signal/25" />
        <span className="absolute bottom-7 left-7 h-4 w-4 border-b border-l border-signal/20" />
        <span className="absolute bottom-7 right-7 h-4 w-4 border-b border-r border-signal/20" />
        <span className="absolute bottom-8 left-12 font-mono text-[9.5px] tracking-[0.26em] text-white/30">
          06:38 · SURFACE MEADOW
        </span>
        <span className="absolute bottom-8 right-12 font-mono text-[9.5px] tracking-[0.26em] text-signal/38">
          SUNSET-06 · LINK STANDBY
        </span>
      </div>

      {/* 轻柔电影暗角：保留星野与地平线通透度，同时托住中心排版对比 */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          opening ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background:
            'radial-gradient(90% 76% at 50% 44%, rgba(4, 8, 18, 0.12) 0%, rgba(4, 8, 18, 0.34) 64%, rgba(4, 8, 18, 0.62) 100%)',
        }}
      />

      <div className="no-scrollbar relative z-10 h-full overflow-y-auto">
        <div
          className={`flex min-h-full flex-col items-center justify-center px-6 py-12 text-center transition-all duration-700 ${
            opening ? '-translate-y-4 opacity-0 blur-md' : 'opacity-100'
          }`}
        >
          <div
            className="animate-fade-up flex items-center gap-3 text-signal/90 hud-ink-soft"
            style={{ animationDelay: '0.15s' }}
          >
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-signal/60" />
            <span className="font-serif text-[12.5px] tracking-[0.24em]">
              致敬刘慈欣《带上她的眼睛》
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-signal/60" />
          </div>

          <h1
            className="animate-fade-up hud-ink mt-4 select-none font-serif text-[clamp(56px,11vw,108px)] font-light leading-[1.04] tracking-[0.22em] text-[#fff8ee]"
            style={{ animationDelay: '0.32s' }}
          >
            风<span className="text-glow text-signal">信</span>
          </h1>
          <div
            className="animate-fade-up mt-3 font-mono text-[11px] tracking-[0.34em] text-signal/82 sm:text-[12px]"
            style={{ animationDelay: '0.42s' }}
          >
            WINDPOST · NO.6371
          </div>

          <p
            className="animate-fade-up hud-ink-soft mt-5 max-w-[33rem] font-serif text-[15px] font-normal leading-[1.95] tracking-[0.06em] text-white/88 sm:text-[17px]"
            style={{ animationDelay: '0.52s' }}
          >
            地航局寄来一副传感眼镜——
            <br className="sm:hidden" />
            替耳机另一端的她，度过一次迟到的休假。
          </p>

          <div
            className="animate-fade-up relative mt-9 flex flex-col items-center"
            style={{ animationDelay: '0.72s' }}
          >
            <div className="relative flex flex-wrap items-center justify-center gap-3">
              <div className="relative inline-flex items-center justify-center">
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="absolute -inset-12 rounded-full border border-signal/22 animate-[pulseRing_4.6s_ease-out_infinite]" />
                  <span
                    className="absolute -inset-12 rounded-full border border-signal/14 animate-[pulseRing_4.6s_ease-out_infinite]"
                    style={{ animationDelay: '1.6s' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={onEnter}
                  onPointerEnter={onPreloadScene}
                  onFocus={onPreloadScene}
                  disabled={opening}
                  className="relative rounded-full bg-signal px-8 py-3.5 font-serif text-[15px] font-medium tracking-[0.14em] text-[#170f07] shadow-[0_14px_42px_-8px_rgba(242,194,139,0.74)] transition hover:scale-[1.03] hover:brightness-105 active:scale-[0.98] disabled:cursor-wait"
                >
                  戴上她的眼睛
                </button>
              </div>
              {resumeLabel && onResume && (
                <button
                  type="button"
                  onClick={onResume}
                  onPointerEnter={onPreloadScene}
                  onFocus={onPreloadScene}
                  disabled={opening}
                  className="cinema-surface-soft relative rounded-full border-signal/38 px-5 py-3.5 font-serif text-[13.5px] tracking-[0.06em] text-signal transition hover:border-signal/75 hover:bg-signal/14 active:scale-[0.98] disabled:cursor-wait"
                >
                  {resumeLabel}
                </button>
              )}
            </div>

            {onToggleFlashSafe && (
              <p className="hud-ink-soft mt-4 font-serif text-[11.5px] tracking-[0.04em] text-white/54">
                含微光转场 ·{' '}
                <button
                  type="button"
                  onClick={onToggleFlashSafe}
                  aria-pressed={flashSafe}
                  className="underline decoration-white/30 underline-offset-4 transition hover:text-signal hover:decoration-signal/65"
                >
                  {flashSafe ? '已开启闪烁抑制' : '如对闪烁敏感可开启抑制'}
                </button>
              </p>
            )}
          </div>

          {echo && (
            <div
              className="animate-fade-up cinema-surface-soft mt-9 w-full max-w-[440px] rounded-[20px] px-5 py-4 text-left"
              style={{ animationDelay: '0.92s' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="cinema-gem h-1.5 w-1.5 bg-signal/85 shadow-[0_0_8px_rgba(242,194,139,0.7)]" />
                  <span className="hud-label text-signal/85">今日回声 · {echo.label}</span>
                </div>
                {echoRead && <span className="hud-value text-[10px] text-white/38">已读</span>}
              </div>
              <div className="cinema-rule my-2.5 opacity-60" />
              <p className="font-serif text-[13px] leading-[1.85] tracking-[0.03em] text-white/82">
                {echo.whisper}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-serif text-[11.5px] text-white/48">{echo.title}</span>
                <button
                  type="button"
                  onClick={() => onListenEcho?.(echo.code)}
                  disabled={opening}
                  className="shrink-0 rounded-full border border-signal/45 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.06em] text-signal transition hover:bg-signal/14"
                >
                  去听这份视野
                </button>
              </div>
            </div>
          )}

          <div
            className="animate-fade-up mt-6 grid w-full max-w-[660px] grid-cols-2 gap-2 sm:grid-cols-4"
            style={{ animationDelay: '1.05s' }}
          >
            {PORTAL_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                disabled={opening}
                onClick={() => {
                  if (card.id === 'prologue') {
                    onEnter()
                  } else {
                    onNavigate?.(card.id)
                  }
                }}
                className="cinema-surface-soft group rounded-2xl px-3 py-2.5 text-left transition hover:border-signal/55 hover:bg-signal/[0.08] disabled:cursor-wait"
              >
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-signal/75">
                  <span>{card.index}</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
                <div className="mt-1 font-serif text-[13px] tracking-[0.04em] text-[#fff8ee] transition group-hover:text-signal">
                  {card.title}
                </div>
                <div className="mt-0.5 truncate font-serif text-[11px] text-white/55">
                  {card.sub}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {opening && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="absolute inset-x-0 top-0 h-[51%] bg-[#091122]"
            style={{ animation: 'lidTop 2s cubic-bezier(0.76, 0, 0.24, 1) 0.45s forwards' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[51%] bg-[#091122]"
            style={{ animation: 'lidBottom 2s cubic-bezier(0.76, 0, 0.24, 1) 0.45s forwards' }}
          />
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-signal/85 shadow-[0_0_40px_10px_rgba(242,194,139,0.55)]"
            style={{ animation: 'irisGlow 1.8s ease-out 0.5s both' }}
          />
        </div>
      )}
    </div>
  )
}
