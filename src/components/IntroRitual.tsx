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
}: IntroRitualProps) {
  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${opening ? 'pointer-events-none' : ''}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-b from-[#0b1630]/55 via-[#0b1630]/28 to-[#091122]/78 transition-opacity duration-1000 ${
          opening ? 'opacity-0' : 'opacity-100'
        }`}
      />

      <div className="no-scrollbar relative z-10 h-full overflow-y-auto">
        <div
          className={`flex min-h-full flex-col items-center justify-center px-6 py-10 text-center transition-all duration-700 ${
            opening ? '-translate-y-4 opacity-0 blur-md' : 'opacity-100'
          }`}
        >
        <p
          className="animate-fade-up font-serif text-[13px] tracking-[0.22em] text-signal/90"
          style={{ animationDelay: '0.15s' }}
        >
          献给刘慈欣《带上她的眼睛》
        </p>

        <h1
          className="animate-fade-up mt-4 select-none font-serif text-[clamp(48px,10vw,96px)] font-light leading-[1] tracking-[0.06em] text-[#fff8ee]"
          style={{ animationDelay: '0.32s' }}
        >
          视界 <span className="text-glow text-signal">6371</span>
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-[32rem] font-serif text-[15px] font-light leading-[1.9] tracking-[0.06em] text-white/85 sm:text-[17px]"
          style={{ animationDelay: '0.52s' }}
        >
          地航局寄来一副传感眼镜——
          <br className="sm:hidden" />
          替耳机另一端的她，度过一次迟到的休假。
        </p>

        <div
          className="animate-fade-up relative mt-10 flex flex-col items-center"
          style={{ animationDelay: '0.72s' }}
        >
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <div className="relative inline-flex items-center justify-center">
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute -inset-12 rounded-full border border-signal/20 animate-[pulseRing_4.6s_ease-out_infinite]" />
                <span
                  className="absolute -inset-12 rounded-full border border-signal/15 animate-[pulseRing_4.6s_ease-out_infinite]"
                  style={{ animationDelay: '1.6s' }}
                />
              </div>
              <button
                type="button"
                onClick={onEnter}
                disabled={opening}
                className="relative rounded-full bg-signal px-8 py-3.5 font-serif text-[15px] font-medium tracking-[0.12em] text-[#170f07] shadow-[0_14px_40px_-8px_rgba(242,194,139,0.72)] transition hover:scale-[1.03] hover:brightness-105 active:scale-[0.98] disabled:cursor-wait"
              >
                戴上她的眼睛
              </button>
            </div>
            {resumeLabel && onResume && (
              <button
                type="button"
                onClick={onResume}
                disabled={opening}
                className="relative rounded-full border border-signal/40 bg-[#0d172e]/68 px-5 py-3.5 font-serif text-[13.5px] tracking-[0.06em] text-signal backdrop-blur-md transition hover:border-signal/75 hover:bg-signal/14 active:scale-[0.98] disabled:cursor-wait"
              >
                {resumeLabel}
              </button>
            )}
          </div>
          {onToggleFlashSafe && (
            <p className="mt-4 font-serif text-[11.5px] tracking-[0.04em] text-white/48">
              含微光转场 ·{' '}
              <button
                type="button"
                onClick={onToggleFlashSafe}
                aria-pressed={flashSafe}
                className="underline decoration-white/25 underline-offset-4 transition hover:text-signal hover:decoration-signal/60"
              >
                {flashSafe ? '已开启闪烁抑制' : '如对闪烁敏感可开启抑制'}
              </button>
            </p>
          )}
        </div>

        {echo && (
          <div
            className="animate-fade-up mt-9 w-full max-w-[420px] rounded-[22px] border border-signal/25 bg-[#0d172e]/70 px-5 py-4 text-left backdrop-blur-md"
            style={{ animationDelay: '0.92s' }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="hud-label text-signal/75">今日回声 · {echo.label}</span>
              {echoRead && <span className="hud-value text-[10px] text-white/35">已读</span>}
            </div>
            <p className="mt-2.5 font-serif text-[13px] leading-[1.85] tracking-[0.03em] text-white/80">
              {echo.whisper}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-white/45">
                {echo.title}
              </span>
              <button
                type="button"
                onClick={() => onListenEcho?.(echo.code)}
                disabled={opening}
                className="shrink-0 rounded-full border border-signal/45 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.06em] text-signal transition hover:bg-signal/12"
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
