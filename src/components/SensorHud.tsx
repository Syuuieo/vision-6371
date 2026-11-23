import { PRESSURE_ALERT, STEPS } from '../data/narrative'
import { sunArc } from '../scenes/PrologueScene'
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
      className={compact ? 'h-[18px] w-[54px]' : 'h-[26px] w-[78px]'}
      aria-hidden="true"
    >
      <path d="M6 30 Q50 -2 94 30" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.4" />
      <line x1="4" y1="30" x2="96" y2="30" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <circle cx={x} cy={y} r="4.2" fill={tint} opacity="0.28" />
      <circle cx={x} cy={y} r="2.4" fill={tint} />
    </svg>
  )
}

function PlaceTag({ place, className = '' }: { place: string; className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-signal/70">
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
      className="flex items-center gap-2 rounded-full border border-ember/45 bg-[#2a1210]/85 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.04em] text-[#ffd4c4] shadow-lg backdrop-blur-md"
      style={{ animation: 'blinkSoft 0.75s ease-in-out infinite' }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
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
}: SensorHudProps) {
  const step = STEPS[act - 1] ?? STEPS[0]
  const clockHour = Number(step.timeLabel.slice(0, 2)) + Number(step.timeLabel.slice(3, 5)) / 60
  const descending = phase === 'descending' || phase === 'core_pulse'
  const showDepthBadge = pressureAlert || depthRevealed || descending

  return (
    <>
      <aside className="pointer-events-none fixed left-4 top-[78px] z-30 hidden select-none flex-col items-start gap-2 lg:flex">
        <div className="flex flex-col gap-1.5 rounded-2xl border border-white/14 bg-[#0d172e]/64 px-3.5 py-2.5 shadow-[0_12px_32px_-12px_rgba(3,8,22,0.75)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
            <span className="whitespace-nowrap font-serif text-[12.5px] tracking-[0.05em] text-[#fff8ee]">
              第 {step.index} 幕 · {step.title}
            </span>
            <span className="font-mono text-[10.5px] text-signal/80">{step.timeLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3 font-serif text-[11.5px] text-white/70">
            <span className="flex items-center gap-2">
              <SunArc hour={clockHour} />
              <span>{dayPhase(clockHour)}</span>
            </span>
            <span className="flex items-center gap-2.5">
              <span className="flex items-center gap-1">
                <span>线索</span>
                <span className="text-signal">{cluesFound.length}/4</span>
              </span>
              <span className="h-2.5 w-px bg-white/15" />
              <span className="flex items-center gap-1">
                <span>彩蛋</span>
                <span className="text-signal">{eggsFound.length}/3</span>
              </span>
            </span>
          </div>
          {!descending && <PlaceTag place={place} className="font-serif text-[11px] text-white/58" />}
        </div>

        {showDepthBadge &&
          (pressureAlert ? (
            <AlertCapsule text={PRESSURE_ALERT} />
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-ember/40 bg-[#1f1218]/80 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.05em] text-[#ffd4c4] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-ember animate-[blinkDot_1.6s_ease-in-out_infinite]" />
              <span>地核深度 {formatDepth(depthKm)} KM</span>
            </div>
          ))}
      </aside>

      <div className="pointer-events-none fixed inset-x-3 top-[64px] z-30 flex flex-col items-center gap-1.5 select-none lg:hidden">
        <div className="flex max-w-full items-center gap-2 rounded-full border border-white/14 bg-[#0d172e]/66 px-3.5 py-1.5 shadow-lg backdrop-blur-xl">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]" />
          <span className="truncate font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">
            第 {step.index} 幕 · {step.title} · {step.timeLabel}
          </span>
          <span className="h-3 w-px shrink-0 bg-white/15" />
          <SunArc hour={clockHour} compact />
          <span className="h-3 w-px shrink-0 bg-white/15" />
          <span className="shrink-0 font-serif text-[11px] text-signal">
            线索 {cluesFound.length}/4 · 彩蛋 {eggsFound.length}/3
          </span>
        </div>

        {!descending && (
          <div className="flex items-center rounded-full border border-white/12 bg-[#0d172e]/60 px-3 py-0.5 font-serif text-[10.5px] text-white/65 backdrop-blur-md">
            <PlaceTag place={place} />
          </div>
        )}

        {showDepthBadge &&
          (pressureAlert ? (
            <AlertCapsule text={PRESSURE_ALERT} />
          ) : (
            <div className="rounded-full border border-ember/40 bg-[#1f1218]/80 px-3 py-1 font-serif text-[11.5px] text-[#ffd4c4] backdrop-blur-md">
              地核深度 {formatDepth(depthKm)} KM
            </div>
          ))}
      </div>
    </>
  )
}
