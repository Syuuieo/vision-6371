import { useEffect, useState } from 'react'
import { getSettings, prefersReducedMotion, subscribeSettings } from '../services/settings'
import type { DailyEcho } from '../services/journey'
import type { ModuleId, SkyStage } from '../types/sensor'
import { CoverHorizonCanvas } from './prologue/CoverHorizonCanvas'

const COVER_SKY_OPTIONS: {
  stage: SkyStage
  label: string
  time: string
  caption: string
}[] = [
  { stage: 0, label: '晨雾', time: '06:40', caption: '06:40 · SURFACE MEADOW · SUNSET-06 STANDBY' },
  { stage: 1, label: '炽暮', time: '18:10', caption: '18:10 · GOLDEN DUSK MEADOW · SUNSET-06 STANDBY' },
  { stage: 2, label: '星河', time: '22:30', caption: '22:30 · STARLIT MEADOW · SUNSET-06 STANDBY' },
]

const PORTAL_CARDS: {
  id: ModuleId
  index: string
  title: string
  sub: string
}[] = [
  { id: 'prologue', index: '01', title: '草原序章', sub: '滑翔风铃 · 8 幕剧情' },
  { id: 'radio', index: '02', title: '行星电台', sub: '12 座可走进 3D 世界' },
  { id: 'post', index: '03', title: '视野信箱', sub: '漂流邮局与明信片' },
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
  coverStage?: SkyStage
  onChangeCoverStage?: (stage: SkyStage) => void
  onOpenSensoryLens?: () => void
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
  coverStage = 0,
  onChangeCoverStage,
  onOpenSensoryLens,
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

  const activeCoverSky = COVER_SKY_OPTIONS.find((item) => item.stage === coverStage) ?? COVER_SKY_OPTIONS[0]

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${opening ? 'pointer-events-none' : ''}`}>
      {/* 按需挂载 3D 前，用轻量 Canvas 2D「双界地平线」承载黎明草原与地底脉冲暗喻，零 Three.js 负载 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          sceneMounted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <CoverHorizonCanvas paused={sceneMounted || opening} calm={flashSafe || reducedMotion} />
      </div>

      {/* 光学取景标记（仅保留左上 / 右上 / 左下，确保右下角 220×64px 徽章区 100% 净空） */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 hidden transition-opacity duration-700 sm:block ${
          opening ? 'opacity-0' : sceneMounted ? 'opacity-75' : 'opacity-100'
        }`}
      >
        <span className="absolute left-7 top-20 h-4 w-4 border-l border-t border-signal/28" />
        <span className="absolute right-7 top-20 h-4 w-4 border-r border-t border-signal/28" />
        <span className="absolute bottom-7 left-7 h-4 w-4 border-b border-l border-signal/24" />
        <span className="absolute bottom-8 left-12 font-mono text-[9.5px] tracking-[0.26em] text-white/42">
          {sceneMounted ? activeCoverSky.caption : '06:38 · SURFACE MEADOW · SUNSET-06 STANDBY'}
        </span>
      </div>

      {/* 桌面端实景草原实时天色切换胶囊（左下角，稳居坐标铭文上方，100% 避让右下角角标） */}
      {sceneMounted && !opening && onChangeCoverStage && (
        <div
          role="group"
          aria-label="切换实景草原天色"
          className="animate-fade-in pointer-events-auto absolute bottom-16 left-7 z-20 hidden items-center gap-1 rounded-full border border-white/12 bg-[#060c1a]/62 p-1 shadow-[0_14px_38px_-14px_rgba(3,7,18,0.88)] backdrop-blur-xl sm:flex"
        >
          {COVER_SKY_OPTIONS.map((option) => {
            const selected = option.stage === coverStage
            return (
              <button
                key={option.stage}
                type="button"
                onClick={() => onChangeCoverStage(option.stage)}
                aria-pressed={selected}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-serif text-[11.5px] tracking-[0.06em] transition ${
                  selected
                    ? 'border border-signal/45 bg-signal/16 text-signal shadow-[0_0_16px_rgba(242,194,139,0.22)]'
                    : 'border border-transparent text-white/62 hover:bg-white/[0.06] hover:text-[#fff8ee]'
                }`}
              >
                <span>{option.label}</span>
                <span
                  className={`font-mono text-[9.5px] tracking-[0.08em] ${
                    selected ? 'text-signal/90' : 'text-white/38'
                  }`}
                >
                  {option.time}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 桌面端 3D 实景草原巡航状态徽标 */}
      {sceneMounted && !opening && (
        <div
          aria-live="polite"
          className="animate-fade-in pointer-events-none absolute left-4 top-[72px] z-20 flex items-center gap-2 rounded-full border border-signal/28 bg-[#060c1a]/58 px-3.5 py-1 backdrop-blur-xl sm:left-12 sm:top-[76px]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_rgba(242,194,139,0.92)] animate-[blinkDot_2.2s_ease-in-out_infinite]" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#fff8ee]/86">
            LIVE 3D · 实景草原巡航中
          </span>
        </div>
      )}

      {/* 轻柔电影暗角：3D 实景草原就绪后柔和提亮，让体云、阳光草浪与湖面在标题背后自然闪耀 */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          opening || sceneMounted ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background:
            'radial-gradient(90% 76% at 50% 44%, rgba(4, 8, 18, 0.12) 0%, rgba(4, 8, 18, 0.34) 64%, rgba(4, 8, 18, 0.62) 100%)',
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          !opening && sceneMounted ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(90% 76% at 50% 44%, rgba(4, 8, 18, 0.08) 0%, rgba(4, 8, 18, 0.24) 64%, rgba(4, 8, 18, 0.48) 100%)',
        }}
      />

      <div className="no-scrollbar relative z-10 h-full overflow-y-auto">
        <div
          className={`flex min-h-full flex-col items-center justify-center px-6 py-14 pb-24 text-center transition-all duration-700 ${
            opening ? '-translate-y-4 opacity-0 blur-md' : 'opacity-100'
          }`}
        >
          <div
            className="animate-fade-up flex items-center gap-3.5 text-signal/88 hud-ink-soft"
            style={{ animationDelay: '0.15s' }}
          >
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-signal/55" />
            <span className="font-serif text-[12px] tracking-[0.28em]">
              致敬刘慈欣《带上她的眼睛》
            </span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-signal/55" />
          </div>

          <h1
            className="animate-fade-up hud-ink mt-5 select-none font-serif text-[clamp(56px,11vw,108px)] font-light leading-[1.04] tracking-[0.24em] text-[#fff8ee]"
            style={{ animationDelay: '0.32s' }}
          >
            风<span className="text-glow text-signal">信</span>
          </h1>
          <div
            className="animate-fade-up mt-3.5 flex flex-col items-center gap-3"
            style={{ animationDelay: '0.42s' }}
          >
            <span className="font-mono text-[10.5px] tracking-[0.38em] text-signal/80 sm:text-[11.5px]">
              WINDPOST · NO.6371
            </span>
            <span
              aria-hidden="true"
              className="h-px w-24 bg-gradient-to-r from-transparent via-signal/45 to-transparent"
            />
          </div>

          <p
            className="animate-fade-up hud-ink-soft mt-5 max-w-[33rem] font-serif text-[15px] font-normal leading-[2] tracking-[0.07em] text-white/86 sm:text-[16.5px]"
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
                  className="cinema-surface-soft relative rounded-full border-signal/38 bg-[#060c1a]/56 px-5 py-3.5 font-serif text-[13.5px] tracking-[0.06em] text-signal backdrop-blur-xl transition hover:border-signal/75 hover:bg-signal/14 active:scale-[0.98] disabled:cursor-wait"
                >
                  {resumeLabel}
                </button>
              )}
              {onOpenSensoryLens && (
                <button
                  type="button"
                  onClick={onOpenSensoryLens}
                  disabled={opening}
                  className="cinema-surface-soft group relative inline-flex items-center gap-2 rounded-full border border-white/16 bg-[#060c1a]/56 px-5 py-3.5 font-serif text-[13.5px] tracking-[0.06em] text-[#fff8ee]/88 backdrop-blur-xl transition hover:border-signal/60 hover:bg-signal/12 hover:text-signal active:scale-[0.98] disabled:cursor-wait"
                >
                  <span aria-hidden="true" className="text-[13px] opacity-85 transition group-hover:opacity-100">
                    👁
                  </span>
                  <span>借用此刻真实视野</span>
                </button>
              )}
            </div>

            {onToggleFlashSafe && (
              <p className="hud-ink-soft mt-4 font-serif text-[11.5px] tracking-[0.05em] text-white/52">
                含微光转场 ·{' '}
                <button
                  type="button"
                  onClick={onToggleFlashSafe}
                  aria-pressed={flashSafe}
                  className="underline decoration-white/28 underline-offset-4 transition hover:text-signal hover:decoration-signal/65"
                >
                  {flashSafe ? '已开启闪烁抑制' : '如对闪烁敏感可开启抑制'}
                </button>
              </p>
            )}
          </div>

          {echo && (
            <div
              className="animate-fade-up cinema-surface-soft mt-9 w-full max-w-[448px] rounded-[20px] border-white/12 bg-[#060c1a]/58 px-5 py-4 text-left backdrop-blur-xl"
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
            className="animate-fade-up mt-7 grid w-full max-w-[680px] grid-cols-2 gap-2.5 sm:grid-cols-3"
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
                className="cinema-surface-soft group relative overflow-hidden rounded-2xl border border-white/12 bg-[#060c1a]/54 px-3.5 py-3 text-left backdrop-blur-xl transition hover:border-signal/55 hover:bg-signal/[0.08] disabled:cursor-wait"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-signal/0 to-transparent transition duration-300 group-hover:via-signal/60"
                />
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-signal/75">
                  <span>{card.index}</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
                <div className="mt-1.5 font-serif text-[13px] tracking-[0.05em] text-[#fff8ee] transition group-hover:text-signal">
                  {card.title}
                </div>
                <div className="mt-0.5 truncate font-serif text-[11px] tracking-[0.02em] text-white/52">
                  {card.sub}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {opening && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {!sceneMounted && (
            <>
              <div
                className="absolute inset-x-0 top-0 h-[51%] bg-[#091122]"
                style={{ animation: 'lidTop 0.72s cubic-bezier(0.76, 0, 0.24, 1) 0.12s forwards' }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-[51%] bg-[#091122]"
                style={{ animation: 'lidBottom 0.72s cubic-bezier(0.76, 0, 0.24, 1) 0.12s forwards' }}
              />
            </>
          )}
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-signal/85 shadow-[0_0_40px_10px_rgba(242,194,139,0.55)]"
            style={{ animation: 'irisGlow 0.82s ease-out 0.06s both' }}
          />
        </div>
      )}
    </div>
  )
}
