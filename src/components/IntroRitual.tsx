import type { DailyEcho } from '../services/journey'

interface IntroRitualProps {
  opening: boolean
  onEnter: () => void
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
  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${opening ? 'pointer-events-none' : ''}`}>
      {/* 按需挂载 3D 前，用极轻 CSS + SVG 黎明地平线承载封面氛围，零 GPU 负载 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          sceneMounted ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background:
            'radial-gradient(85% 55% at 50% 62%, rgba(242, 194, 139, 0.22), rgba(28, 48, 86, 0.36) 48%, rgba(6, 11, 24, 0.96) 100%), linear-gradient(180deg, #060b18 0%, #0f1d3a 54%, #1a2844 100%)',
        }}
      >
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-[36vh] w-full opacity-55"
        >
          <path
            d="M0,224 C220,178 410,248 640,214 C860,180 1120,136 1440,196 L1440,320 L0,320 Z"
            fill="rgba(7, 13, 28, 0.85)"
          />
          <path
            d="M0,256 C280,228 540,276 880,240 C1140,212 1300,236 1440,248 L1440,320 L0,320 Z"
            fill="rgba(5, 9, 20, 0.96)"
          />
        </svg>
        <div
          className="absolute left-1/2 top-[58%] h-44 w-[76vw] max-w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(242, 194, 139, 0.32), transparent 72%)' }}
        />
      </div>

      {/* 极轻的径向电影暗角：让 3D 晨雾、体积云与花海完整呼吸 */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          opening ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background:
            'radial-gradient(92% 78% at 50% 46%, rgba(5, 10, 22, 0.16) 0%, rgba(5, 10, 22, 0.42) 62%, rgba(4, 8, 18, 0.72) 100%)',
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
              献给刘慈欣《带上她的眼睛》
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-signal/60" />
          </div>

          <h1
            className="animate-fade-up hud-ink mt-4 select-none font-serif text-[clamp(50px,10vw,98px)] font-light leading-[1] tracking-[0.07em] text-[#fff8ee]"
            style={{ animationDelay: '0.32s' }}
          >
            视界 <span className="text-glow text-signal">6371</span>
          </h1>

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
