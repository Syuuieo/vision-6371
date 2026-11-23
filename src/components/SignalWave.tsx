import { useEffect, useRef } from 'react'

interface SignalWaveProps {
  className?: string
  color?: string
}

export function SignalWave({ className, color = '242, 194, 139' }: SignalWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const started = performance.now()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const waveY = (nx: number, t: number) => {
      const envelope = Math.pow(Math.abs(Math.sin(nx * Math.PI)), 1.35)
      const composite =
        Math.sin(nx * 12.5 + t * 1.7) * 0.5 +
        Math.sin(nx * 31.0 - t * 2.4) * 0.22 +
        Math.sin(nx * 5.5 - t * 0.8) * 0.8 +
        Math.sin(nx * 71.0 + t * 3.1) * 0.06
      return height / 2 + composite * height * 0.4 * envelope
    }

    const draw = (now: number) => {
      if (width < 2 || height < 2) {
        raf = requestAnimationFrame(draw)
        return
      }
      const t = reduceMotion ? 1.4 : Math.max(0, (now - started) / 1000)
      ctx.clearRect(0, 0, width, height)

      ctx.strokeStyle = `rgba(${color}, 0.1)`
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 42) {
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, height)
        ctx.stroke()
      }
      ctx.strokeStyle = `rgba(${color}, 0.16)`
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      ctx.save()
      ctx.shadowBlur = 18
      ctx.shadowColor = `rgba(${color}, 0.55)`
      ctx.strokeStyle = `rgba(${color}, 0.28)`
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let x = 0; x <= width; x += 2) {
        const y = waveY(x / width, t)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()

      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, `rgba(${color}, 0.05)`)
      gradient.addColorStop(0.5, `rgba(${color}, 0.95)`)
      gradient.addColorStop(1, `rgba(${color}, 0.05)`)
      ctx.strokeStyle = gradient
      ctx.lineWidth = 1.15
      ctx.beginPath()
      for (let x = 0; x <= width; x += 2) {
        const y = waveY(x / width, t)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      const px = ((t * 0.16) % 1) * width
      const py = waveY(px / width, t)
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 16)
      glow.addColorStop(0, `rgba(255, 244, 224, 0.95)`)
      glow.addColorStop(0.35, `rgba(${color}, 0.5)`)
      glow.addColorStop(1, `rgba(${color}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, 16, 0, Math.PI * 2)
      ctx.fill()

      if (!reduceMotion) raf = requestAnimationFrame(draw)
    }

    resize()
    raf = requestAnimationFrame(draw)
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [color])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
