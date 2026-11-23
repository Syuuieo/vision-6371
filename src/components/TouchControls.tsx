import { useEffect, useRef, useState } from 'react'

interface StickProps {
  label: string
  hint: string
  onChange: (x: number, y: number) => void
}

const RADIUS = 42

function Stick({ label, hint, onChange }: StickProps) {
  const padRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const center = useRef({ x: 0, y: 0 })
  const activeId = useRef<number | null>(null)

  const place = (dx: number, dy: number) => {
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    }
  }

  const release = () => {
    activeId.current = null
    place(0, 0)
    if (padRef.current) padRef.current.dataset.active = 'off'
    onChange(0, 0)
  }

  const track = (clientX: number, clientY: number) => {
    let dx = clientX - center.current.x
    let dy = clientY - center.current.y
    const dist = Math.hypot(dx, dy)
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS
      dy = (dy / dist) * RADIUS
    }
    place(dx, dy)
    onChange(dx / RADIUS, -dy / RADIUS)
  }

  return (
    <div className="pointer-events-auto select-none text-center">
      <div
        ref={padRef}
        data-active="off"
        role="application"
        aria-label={label}
        className="touch-none relative h-[104px] w-[104px] rounded-full border border-white/18 bg-[#0b1224]/45 backdrop-blur-sm transition-colors data-[active=on]:border-signal/55 data-[active=on]:bg-signal/10"
        onPointerDown={(event) => {
          if (activeId.current !== null) return
          const rect = event.currentTarget.getBoundingClientRect()
          center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          activeId.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.dataset.active = 'on'
          track(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (activeId.current !== event.pointerId) return
          track(event.clientX, event.clientY)
        }}
        onPointerUp={(event) => {
          if (activeId.current !== event.pointerId) return
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          release()
        }}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <div className="absolute inset-[26px] rounded-full border border-dashed border-white/12" />
        <div
          ref={thumbRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-signal/45 bg-signal/25 shadow-[0_4px_16px_-4px_rgba(242,194,139,0.6)]"
        />
      </div>
      <div className="mt-1.5 font-serif text-[10.5px] tracking-[0.14em] text-white/45">{hint}</div>
    </div>
  )
}

interface TouchControlsProps {
  visible: boolean
  onMove: (x: number, y: number) => void
  onLook: (x: number, y: number) => void
}

export function TouchControls({ visible, onMove, onLook }: TouchControlsProps) {
  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+6.5rem)] z-[45] flex items-end justify-between px-4 landscape:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)]">
      <Stick label="移动摇杆" hint="移动" onChange={onMove} />
      <Stick label="视角摇杆" hint="视角" onChange={onLook} />
    </div>
  )
}

export function LandscapeHint({ onDismiss }: { onDismiss: () => void }) {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)')
    const onChange = () => setPortrait(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (!portrait) return null
  return (
    <div className="pointer-events-auto fixed inset-x-3 top-[max(4.5rem,env(safe-area-inset-top))] z-[46]">
      <div className="glass flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-signal">
          <rect x="2.5" y="7" width="19" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 3.5l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="min-w-0 flex-1 font-serif text-[12px] leading-[1.7] text-white/78">
          横过手机，这片风景会铺满整个视野。
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1 font-serif text-[11.5px] text-white/70 transition hover:border-signal/55 hover:text-signal"
        >
          知道了
        </button>
      </div>
    </div>
  )
}