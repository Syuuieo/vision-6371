import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../services/settings'

export type CloudDiveMode = 'cloud' | 'core'

export interface CloudDiveOverlayProps {
  active: boolean
  mode: CloudDiveMode
  targetTitle: string
  targetSub: string
  onMidpoint: () => void
  onDone: () => void
}

/**
 * 潜入过场：0.3 秒黑场淡入淡出（直进场景，无画框、无运镜、无字幕卡）。
 * 保留 App 的 onMidpoint/onDone 握手协议：黑场最深处挂载新世界，随后揭示。
 */
export function CloudDiveOverlay({
  active,
  onMidpoint,
  onDone,
}: CloudDiveOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onMidpointRef = useRef(onMidpoint)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onMidpointRef.current = onMidpoint
    onDoneRef.current = onDone
  }, [onMidpoint, onDone])

  useEffect(() => {
    if (!active) return
    const reduced = prefersReducedMotion() || document.querySelector('[data-motion="calm"]') !== null
    const fadeIn = reduced ? 60 : 120
    const hold = reduced ? 80 : 100
    const fadeOut = reduced ? 60 : 110
    let midpointFired = false
    let doneFired = false
    let rafId = 0
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const root = rootRef.current
      if (root) {
        let opacity: number
        if (elapsed < fadeIn) {
          opacity = elapsed / fadeIn
        } else if (elapsed < fadeIn + hold) {
          opacity = 1
        } else {
          opacity = Math.max(0, 1 - (elapsed - fadeIn - hold) / fadeOut)
        }
        root.style.opacity = opacity.toFixed(3)
      }
      if (!midpointFired && elapsed >= fadeIn) {
        midpointFired = true
        onMidpointRef.current()
      }
      if (!doneFired && elapsed >= fadeIn + hold + fadeOut) {
        doneFired = true
        onDoneRef.current()
        return
      }
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [active])

  if (!active) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-auto fixed inset-0 z-[95] bg-[#04070f]"
      ref={rootRef}
      style={{ opacity: 0 }}
    />
  )
}
