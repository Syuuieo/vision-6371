import type { ModuleId } from '../types/sensor'

const MODULES: { id: ModuleId; short: string; label: string }[] = [
  { id: 'prologue', short: '序章', label: '序章 · 地球的一天' },
  { id: 'radio', short: '电台', label: '地球表面电台' },
  { id: 'post', short: '寄视野', label: '寄出我的视野' },
]

interface TopNavProps {
  module: ModuleId
  onModuleChange: (module: ModuleId) => void
  muted: boolean
  onToggleSound: () => void
  onOpenSettings: () => void
  canGoBack?: boolean
  onBack?: () => void
  onGoHome?: () => void
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  canGoBack = false,
  onBack,
  onGoHome,
}: TopNavProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-2.5 sm:px-5 sm:pt-4">
      <div className="pointer-events-auto flex w-full max-w-[1040px] items-center justify-between gap-2 rounded-full border border-white/12 bg-[#0d172e]/70 px-2.5 py-1.5 shadow-[0_14px_40px_-14px_rgba(4,9,22,0.75)] backdrop-blur-xl sm:px-3.5 sm:py-2">
        <div className="flex shrink-0 items-center gap-1.5">
          {canGoBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="返回上一级"
              title="返回上一级"
              className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/14 bg-white/[0.05] px-2.5 text-white/85 transition hover:border-signal/55 hover:text-signal sm:h-9 sm:px-3"
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
            className={`${canGoBack && onBack ? 'hidden sm:flex' : 'flex'} shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-1 py-0.5 text-left transition hover:opacity-90`}
            aria-label="回到首页 · 视界 6371"
            title="回到封面首页"
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-signal/40 bg-signal/12">
              <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
              <span className="absolute inset-0 rounded-full border border-signal/25 animate-[pulseRing_4s_ease-out_infinite]" />
            </span>
            <span className="hidden font-serif text-[14px] tracking-[0.12em] text-[#fff6ea] sm:inline">
              视界 6371
            </span>
          </button>
        </div>

        <nav
          aria-label="主导航"
          className="flex min-w-0 items-center gap-1 rounded-full bg-white/[0.04] p-1"
        >
          {MODULES.map((item) => {
            const active = module === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModuleChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 font-serif text-[12px] tracking-[0.04em] transition sm:px-4 sm:text-[13px] sm:tracking-[0.06em] ${
                  active
                    ? 'bg-signal text-[#170f07] font-medium shadow-[0_0_20px_-4px_rgba(242,194,139,0.75)]'
                    : 'text-white/68 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={!muted}
            aria-label={muted ? '开启声音' : '静音'}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/12 bg-white/[0.04] px-2.5 text-white/75 transition hover:border-signal/45 hover:text-[#fff6ea] sm:h-9 sm:px-3"
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition hover:border-signal/45 hover:text-signal sm:h-9 sm:w-9"
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
