import type { ModuleId } from '../types/sensor'

const MODULES: { id: ModuleId; short: string; label: string }[] = [
  { id: 'prologue', short: '序章', label: '序章 · 地球的一天' },
  { id: 'radio', short: '电台', label: '行星电台 · 3D 奇境' },
  { id: 'post', short: '视野信箱', label: '视野信箱 · 漂流邮局' },
]

interface TopNavProps {
  module: ModuleId
  onModuleChange: (module: ModuleId) => void
  muted: boolean
  onToggleSound: () => void
  onOpenSettings: () => void
  onOpenSensoryLens?: () => void
  hidden?: boolean
  canGoBack?: boolean
  onBack?: () => void
  onGoHome?: () => void
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5v5h3.4L12 18.5v-13L7.4 9.5H4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M16 9.5l4 5M20 9.5l-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 6.8a7.4 7.4 0 0 1 0 10.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
        </>
      )}
    </svg>
  )
}

export function TopNav({
  module,
  onModuleChange,
  muted,
  onToggleSound,
  onOpenSettings,
  onOpenSensoryLens,
  hidden = false,
  canGoBack = false,
  onBack,
  onGoHome,
}: TopNavProps) {
  const interactiveClass = hidden ? 'pointer-events-none' : 'pointer-events-auto'

  return (
    <header
      aria-hidden={hidden || undefined}
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-[#050a16]/68 via-[#050a16]/22 to-transparent px-3.5 pb-4 pt-3 transition-all duration-500 ease-out sm:px-6 sm:pt-4 ${
        hidden ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-2">
        <div className={`${interactiveClass} flex shrink-0 items-center gap-2`}>
          {canGoBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="返回上一级"
              title="返回上一级"
              className="hud-ink-soft flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/15 bg-[#060a14]/60 px-2.5 text-white/86 backdrop-blur-2xl transition hover:border-signal/55 hover:text-signal sm:h-9 sm:px-3"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-serif text-[12px] tracking-[0.04em]">
                {module === 'prologue' ? '退出' : '返回'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => (onGoHome ? onGoHome() : onModuleChange('prologue'))}
            className={`${canGoBack && onBack ? 'hidden sm:flex' : 'flex'} hud-ink shrink-0 items-center gap-2.5 whitespace-nowrap px-1 py-1 text-left transition hover:opacity-90`}
            aria-label="回到首页 · 风信"
            title="回到封面首页"
          >
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_12px_rgba(242,194,139,0.92)]" />
              <span className="cinema-gem absolute inset-0 border border-signal/35 animate-[pulseRing_4.2s_ease-out_infinite]" />
            </span>
            <span className="hidden items-baseline gap-1.5 font-serif text-[15px] tracking-[0.16em] text-[#fff6ea] sm:inline-flex">
              <span>风信</span>
              <span className="hidden font-mono text-[10px] tracking-[0.2em] text-signal/82 md:inline">
                WINDPOST
              </span>
            </span>
          </button>
        </div>

        <nav
          aria-label="主导航"
          className={`${interactiveClass} flex min-w-0 items-center gap-0.5 rounded-full border border-signal/15 bg-[#060a14]/60 p-0.5 backdrop-blur-2xl sm:gap-1 sm:px-1.5 sm:py-1`}
        >
          {MODULES.map((item) => {
            const active = module === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModuleChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative whitespace-nowrap rounded-full px-2.5 py-1.5 font-serif text-[12px] tracking-[0.04em] transition sm:px-4 sm:text-[13px] sm:tracking-[0.06em] ${
                  active
                    ? 'bg-signal/16 text-[#fff6ea] font-medium shadow-[inset_0_0_0_1px_rgba(242,194,139,0.45)]'
                    : 'text-white/65 hover:bg-white/[0.06] hover:text-white/95'
                }`}
              >
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-4 bottom-0.5 h-px bg-gradient-to-r from-transparent via-signal to-transparent opacity-85"
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className={`${interactiveClass} flex shrink-0 items-center gap-1.5`}>
          {onOpenSensoryLens && (
            <button
              type="button"
              onClick={onOpenSensoryLens}
              aria-label="打开传感透镜"
              title="传感透镜 · 借一双真实的眼睛"
              className="hud-ink-soft flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-signal/25 bg-[#060a14]/60 px-2.5 text-[#fff6ea]/88 backdrop-blur-2xl transition hover:border-signal/55 hover:bg-signal/12 hover:text-[#fff9f0] sm:h-9 sm:px-3"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_8px_rgba(242,194,139,0.92)]"
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-signal/90">
                <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hidden font-serif text-[12px] tracking-[0.06em] md:inline">
                传感透镜
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={!muted}
            aria-label={muted ? '开启声音' : '静音'}
            className="hud-ink-soft flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/14 bg-[#060a14]/60 px-2.5 text-white/78 backdrop-blur-2xl transition hover:border-signal/45 hover:text-[#fff6ea] sm:h-9 sm:px-3"
          >
            <SoundIcon muted={muted} />
            <span className="hidden font-serif text-[12px] tracking-[0.06em] sm:inline">
              {muted ? '已静音' : '声音'}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="设置与关于"
            title="设置与关于"
            className="hud-ink-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/14 bg-[#060a14]/60 text-white/75 backdrop-blur-2xl transition hover:border-signal/45 hover:text-signal sm:h-9 sm:w-9"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h10M18 17h2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="10" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
