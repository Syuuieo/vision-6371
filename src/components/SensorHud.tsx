import { PRESSURE_ALERT, STEPS } from '../data/narrative'
import { sunArc } from '../data/prologueWorldMeta'
import type { ActId, EggId, Phase, SensorReadings } from '../types/sensor'

interface SensorHudProps {
  readings: SensorReadings
  act: ActId
  place: string
  depthKm: number
  depthRevealed: boolean
  pressureAlert: boolean
  signal: number
  phase: Phase
  tuned: boolean
  eggsFound: EggId[]
  cluesFound?: string[]
  onOpenJournal?: () => void
}

function formatDepth(depth: number) {
  if (depth >= 6371) return '6,371.4'
  if (depth <= 0) return '0.0'
  return depth.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function dayPhase(hour: number) {
  if (hour < 5.2) return '深夜'
  if (hour < 6.67) return '拂晓'
  if (hour < 9.5) return '清晨'
  if (hour < 12.5) return '上午'
  if (hour < 15.83) return '正午'
  if (hour < 18.17) return '午后'
  if (hour < 19.75) return '黄昏'
  if (hour < 22.5) return '暮色'
  return '夜'
}

function SunArc({ hour, compact = false }: { hour: number; compact?: boolean }) {
  const { altitude, azimuth, daylight } = sunArc(hour)
  const x = 50 + (azimuth / 1.05) * 44
  const y = 30 - (altitude / (Math.PI / 2)) * 26
  const tint = daylight ? '#f2c28b' : '#9db4e8'
  return (
    <svg
      viewBox="0 0 100 34"
      className={compact ? 'h-[16px] w-[48px]' : 'h-[22px] w-[68px]'}
      aria-hidden="true"
    >
      <path d="M6 30 Q50 -2 94 30" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" />
      <line x1="4" y1="30" x2="96" y2="30" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <circle cx={x} cy={y} r="4.4" fill={tint} opacity="0.3" />
      <circle cx={x} cy={y} r="2.4" fill={tint} />
    </svg>
  )
}

function PlaceTag({ place, className = '' }: { place: string; className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-signal/78">
        <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.4" fill="currentColor" />
      </svg>
      <span className="whitespace-nowrap">{place}</span>
    </span>
  )
}

function AlertCapsule({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-ember/45 bg-[#2a1210]/82 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.04em] text-[#ffd4c4] shadow-lg backdrop-blur-md"
      style={{ animation: 'blinkSoft 0.75s ease-in-out infinite' }}
    >
      <span className="cinema-gem h-1.5 w-1.5 shrink-0 bg-ember" />
      <span>{text}</span>
    </div>
  )
}

export function SensorHud({
  readings: _readings,
  act,
  place,
  depthKm,
  depthRevealed,
  pressureAlert,
  signal: _signal,
  phase,
  tuned: _tuned,
  eggsFound,
  cluesFound = [],
  onOpenJournal,
}: SensorHudProps) {
  const step = STEPS[act - 1] ?? STEPS[0]
  const clockHour = Number(step.timeLabel.slice(0, 2)) + Number(step.timeLabel.slice(3, 5)) / 60
  const descending = phase === 'descending' || phase === 'core_pulse'
  const showDepthBadge = pressureAlert || depthRevealed || descending

  return (
    <>
      {/* 桌面端：Petalwake 无框轻盈排印浮层 */}
      <aside className="pointer-events-none fixed left-6 top-[78px] z-30 hidden select-none flex-col items-start gap-2.5 lg:flex">
        <div className="hud-ink flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_12px_rgba(242,194,139,0.92)]" />
            <span className="whitespace-nowrap font-serif text-[13.5px] font-medium tracking-[0.06em] text-[#fff8ee]">
              第 {step.index} 幕 · {step.title}
            </span>
            <span className="font-mono text-[11px] tracking-[0.08em] text-signal/88">{step.timeLabel}</span>
          </div>

          <div className="flex items-center gap-3 font-serif text-[12px] text-white/82">
            <span className="flex items-center gap-1.5">
              <SunArc hour={clockHour} />
              <span>{dayPhase(clockHour)}</span>
            </span>
            {!descending && (
              <>
                <span className="h-2.5 w-px bg-white/25" />
                <PlaceTag place={place} className="text-white/74" />
              </>
            )}
          </div>

          <div className="pointer-events-auto mt-0.5 flex items-center gap-2">
            {onOpenJournal ? (
              <button
                type="button"
                onClick={onOpenJournal}
                aria-label="打开传感观测手账"
                title="打开观测手账 (快捷键 J)"
                className="group flex items-center gap-2 rounded-full border border-white/16 bg-[#070e1f]/36 px-3 py-1 font-serif text-[11.5px] tracking-[0.04em] text-white/84 backdrop-blur-md transition hover:border-signal/55 hover:bg-signal/12 hover:text-[#fff8ee]"
              >
                <span className="cinema-gem h-1.5 w-1.5 border border-signal bg-signal/40 transition group-hover:bg-signal" />
                <span>
                  线索 <span className="text-signal">{cluesFound.length}/4</span>
                </span>
                <span className="h-2.5 w-px bg-white/18" />
                <span>
                  彩蛋 <span className="text-signal">{eggsFound.length}/3</span>
                </span>
                <span className="cinema-kbd ml-0.5 text-[9.5px] text-white/75 group-hover:border-signal/50 group-hover:text-signal">
                  J
                </span>
              </button>
            ) : (
              <div className="hud-ink-soft flex items-center gap-2 font-serif text-[11.5px] text-white/76">
                <span>
                  线索 <span className="text-signal">{cluesFound.length}/4</span>
                </span>
                <span className="h-2.5 w-px bg-white/20" />
                <span>
                  彩蛋 <span className="text-signal">{eggsFound.length}/3</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {showDepthBadge &&
          (pressureAlert ? (
            <AlertCapsule text={PRESSURE_ALERT} />
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-ember/40 bg-[#1f1218]/78 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.05em] text-[#ffd4c4] backdrop-blur-md">
              <span className="cinema-gem h-1.5 w-1.5 bg-ember animate-[blinkDot_1.6s_ease-in-out_infinite]" />
              <span>地核深度 {formatDepth(depthKm)} KM</span>
            </div>
          ))}
      </aside>

      {/* 移动端：纤薄顶部半透胶囊 */}
      <div className="pointer-events-none fixed inset-x-3 top-[62px] z-30 flex flex-col items-center gap-1.5 select-none lg:hidden">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/14 bg-[#070e1f]/52 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
          <span className="cinema-gem h-1.5 w-1.5 shrink-0 bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]" />
          <span className="truncate font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">
            第 {step.index} 幕 · {step.title} · {step.timeLabel}
          </span>
          <span className="h-3 w-px shrink-0 bg-white/15" />
          <SunArc hour={clockHour} compact />
          <span className="h-3 w-px shrink-0 bg-white/15" />
          {onOpenJournal ? (
            <button
              type="button"
              onClick={onOpenJournal}
              aria-label="打开观测手账"
              className="shrink-0 font-serif text-[11px] text-signal underline decoration-signal/35 underline-offset-2"
            >
              线索 {cluesFound.length}/4 · 彩蛋 {eggsFound.length}/3
            </button>
          ) : (
            <span className="shrink-0 font-serif text-[11px] text-signal">
              线索 {cluesFound.length}/4 · 彩蛋 {eggsFound.length}/3
            </span>
          )}
        </div>

        {!descending && (
          <div className="hud-ink-soft flex items-center px-3 py-0.5 font-serif text-[10.5px] text-white/75">
            <PlaceTag place={place} />
          </div>
        )}

        {showDepthBadge &&
          (pressureAlert ? (
            <AlertCapsule text={PRESSURE_ALERT} />
          ) : (
            <div className="rounded-full border border-ember/40 bg-[#1f1218]/78 px-3 py-1 font-serif text-[11.5px] text-[#ffd4c4] backdrop-blur-md">
              地核深度 {formatDepth(depthKm)} KM
            </div>
          ))}
      </div>
    </>
  )
}
