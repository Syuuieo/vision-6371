import { useRef } from 'react'

interface CalibrationDialProps {
  value: number
  inZone: boolean
  onChange: (value: number) => void
  disabled?: boolean
}

const SIZE = 248
const CENTER = SIZE / 2
const RADIUS = 94
const START = 135
const SWEEP = 270

function polar(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: CENTER + Math.cos(rad) * radius,
    y: CENTER + Math.sin(rad) * radius,
  }
}

function arcPath(from: number, to: number, radius: number) {
  const start = polar(from, radius)
  const end = polar(to, radius)
  const large = to - from > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function CalibrationDial({ value, inZone, onChange, disabled }: CalibrationDialProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const knobAngle = START + SWEEP * value
  const knob = polar(knobAngle, RADIUS)
  const zoneStart = START + SWEEP * 0.625
  const zoneEnd = START + SWEEP * 0.795

  const updateFromPoint = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
    let rel = (((deg - START) % 360) + 360) % 360
    if (rel > SWEEP) {
      rel = rel > (SWEEP + 360) / 2 ? 0 : SWEEP
    }
    onChange(Math.min(1, Math.max(0, rel / SWEEP)))
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-[248px] w-[248px] touch-none select-none"
      onPointerDown={(event) => {
        if (disabled) return
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        updateFromPoint(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (!dragging.current || disabled) return
        updateFromPoint(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        dragging.current = false
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
      role="slider"
      aria-label="声学频率校准"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault()
          onChange(Math.max(0, value - 0.02))
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault()
          onChange(Math.min(1, value + 0.02))
        }
        if (event.key === 'Home') onChange(0)
        if (event.key === 'End') onChange(1)
      }}
    >
      <div
        className="pointer-events-none absolute inset-8 rounded-full transition-all duration-500"
        style={{
          background: inZone
            ? 'radial-gradient(circle, rgba(242,194,139,0.18), transparent 68%)'
            : 'radial-gradient(circle, rgba(242,194,139,0.06), transparent 68%)',
          filter: inZone ? 'blur(2px)' : 'none',
        }}
      />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="dial-shell absolute inset-0">
        <defs>
          <linearGradient id="dial-progress" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#a88762" />
            <stop offset="55%" stopColor="#f2c28b" />
            <stop offset="100%" stopColor="#fff4e0" />
          </linearGradient>
          <filter id="dial-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(242,194,139,0.18)" strokeWidth="1.2" />
        <path
          d={arcPath(START, START + SWEEP, RADIUS)}
          fill="none"
          stroke="rgba(196,214,245,0.34)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d={arcPath(zoneStart, zoneEnd, RADIUS)}
          fill="none"
          stroke={inZone ? '#ffe2bd' : 'rgba(242,194,139,0.85)'}
          strokeWidth={inZone ? 8 : 6}
          strokeLinecap="round"
          filter="url(#dial-glow)"
          className="transition-all duration-300"
        />
        <path
          d={arcPath(START, Math.max(START + 0.01, knobAngle), RADIUS)}
          fill="none"
          stroke="url(#dial-progress)"
          strokeWidth="2.4"
          strokeLinecap="round"
          filter="url(#dial-glow)"
        />

        {Array.from({ length: 37 }).map((_, i) => {
          const angle = START + (SWEEP * i) / 36
          const major = i % 6 === 0
          const inner = polar(angle, RADIUS - (major ? 16 : 10))
          const outer = polar(angle, RADIUS - 5)
          const inZoneTick = angle >= zoneStart && angle <= zoneEnd
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={
                inZoneTick
                  ? 'rgba(242,194,139,0.82)'
                  : major
                    ? 'rgba(220,232,255,0.38)'
                    : 'rgba(220,232,255,0.16)'
              }
              strokeWidth={major ? 1.2 : 0.8}
            />
          )
        })}

        <circle cx={CENTER} cy={CENTER} r={RADIUS - 30} fill="none" stroke="rgba(196,214,245,0.08)" strokeWidth="0.8" />
        <circle cx={CENTER} cy={CENTER} r={RADIUS - 44} fill="none" stroke="rgba(196,214,245,0.06)" strokeWidth="0.8" />

        <circle cx={knob.x} cy={knob.y} r="13" fill="rgba(242,194,139,0.1)" />
        <circle cx={knob.x} cy={knob.y} r="7.5" fill="#080d19" stroke="#ffe2bd" strokeWidth="1.4" filter="url(#dial-glow)" />
        <circle cx={knob.x} cy={knob.y} r="2.4" fill="#fff6ea" />
        <line
          x1={polar(knobAngle, RADIUS + 2).x}
          y1={polar(knobAngle, RADIUS + 2).y}
          x2={polar(knobAngle, RADIUS + 12).x}
          y2={polar(knobAngle, RADIUS + 12).y}
          stroke="#ffe2bd"
          strokeWidth="1.2"
          opacity="0.7"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="hud-label !text-[7px] !tracking-[0.32em]">ACOUSTIC SYNC</span>
        <span
          className={`hud-value mt-1 text-[38px] font-light leading-none ${
            inZone ? 'text-signal text-glow' : 'text-white/80'
          }`}
        >
          {Math.round(value * 100)}
          <span className="ml-0.5 text-[12px] text-white/35">%</span>
        </span>
        <span
          className={`mt-2 font-mono text-[7.5px] tracking-[0.24em] ${
            inZone ? 'text-signal/85' : 'text-white/30'
          }`}
        >
          {inZone ? 'RESONANCE FOUND' : value > 0.5 ? 'TUNING…' : 'NOISE PRESENT'}
        </span>
        <span className="mt-1 font-mono text-[7px] tracking-[0.18em] text-white/22">
          40 Hz — 2.4 kHz
        </span>
      </div>
    </div>
  )
}
