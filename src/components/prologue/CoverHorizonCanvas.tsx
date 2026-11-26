import { useEffect, useRef } from 'react'

interface CoverHorizonCanvasProps {
  paused?: boolean
  calm?: boolean
}

interface StarSpec {
  nx: number
  ny: number
  radius: number
  alpha: number
  phase: number
  speed: number
  depth: number
  warm: boolean
  glint: boolean
}

interface MoteSpec {
  nx: number
  ny: number
  radius: number
  vx: number
  vy: number
  phase: number
  alpha: number
  depth: number
  warm: boolean
}

interface FloraSpec {
  nx: number
  heightRatio: number
  lean: number
  phase: number
  thickness: number
  flower: boolean
}

interface MeteorState {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  nextAt: number
}

function createSeededRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ridgeY(nx: number, baseY: number, ampA: number, ampB: number, phaseA: number, phaseB: number, H: number) {
  const wave =
    Math.sin(nx * Math.PI * 2.1 + phaseA) * ampA +
    Math.cos(nx * Math.PI * 4.3 + phaseB) * ampB
  return H * (baseY + wave)
}

function foregroundY(nx: number, H: number) {
  const bowl = Math.cos((nx - 0.5) * Math.PI) * 0.032
  const ripple = Math.sin(nx * 9.5 + 0.7) * 0.011 + Math.cos(nx * 18.2 - 0.4) * 0.005
  return H * (0.768 + bowl + ripple)
}

/**
 * 封面「双界地平线」轻量 2D Canvas 电影背景：
 * - 上层：清晨蓝调渐层天穹、微闪星野、偶然流星与地平线暖金破晓光晕
 * - 中景：三层视差雾霭山坡、流动晨雾与风吹草浪野花剪影
 * - 地表之下：隐约透出的地球深层同心弧线与微弱琥珀中微子波纹
 */
export function CoverHorizonCanvas({ paused = false, calm = false }: CoverHorizonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  const calmRef = useRef(calm)
  const syncLoopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    pausedRef.current = paused
    calmRef.current = calm
    syncLoopRef.current?.()
  }, [paused, calm])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rng = createSeededRng(6371)

    const stars: StarSpec[] = Array.from({ length: 132 }, (_, i) => {
      const warm = i < 12 || rng() < 0.14
      const glint = i < 9
      return {
        nx: rng(),
        ny: 0.03 + Math.pow(rng(), 1.25) * 0.62,
        radius: glint ? 1.55 + rng() * 0.65 : 0.45 + rng() * 1.15,
        alpha: glint ? 0.65 + rng() * 0.3 : 0.2 + rng() * 0.65,
        phase: rng() * Math.PI * 2,
        speed: 0.7 + rng() * 1.9,
        depth: 0.25 + rng() * 0.75,
        warm,
        glint,
      }
    })

    const motes: MoteSpec[] = Array.from({ length: 36 }, (_, i) => ({
      nx: rng(),
      ny: 0.18 + rng() * 0.74,
      radius: 0.9 + rng() * 1.85,
      vx: 0.004 + rng() * 0.009,
      vy: -(0.005 + rng() * 0.011),
      phase: rng() * Math.PI * 2,
      alpha: 0.18 + rng() * 0.48,
      depth: 0.35 + rng() * 0.65,
      warm: i % 3 !== 0,
    }))

    const flora: FloraSpec[] = Array.from({ length: 94 }, (_, i) => {
      const t = i / 93
      const edgeWeight = Math.abs(t - 0.5) * 2
      const inCenter = edgeWeight < 0.38
      const jitter = (rng() - 0.5) * 0.014
      return {
        nx: Math.max(0, Math.min(1, t + jitter)),
        heightRatio: (inCenter ? 0.022 : 0.034 + edgeWeight * 0.034) * (0.65 + rng() * 0.7),
        lean: (rng() - 0.5) * 0.45,
        phase: rng() * Math.PI * 2,
        thickness: 0.8 + rng() * 1.15,
        flower: !inCenter && i % 9 === 0,
      }
    })

    const meteor: MeteorState = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      nextAt: 3.5,
    }

    let width = 0
    let height = 0
    let dpr = 1
    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    let targetPx = 0
    let targetPy = 0
    let px = 0
    let py = 0

    const coarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches

    const resize = () => {
      const parent = canvas.parentElement
      const nextW = parent?.clientWidth ?? window.innerWidth
      const nextH = parent?.clientHeight ?? window.innerHeight
      if (nextW < 1 || nextH < 1) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = nextW
      height = nextH
      canvas.width = Math.round(nextW * dpr)
      canvas.height = Math.round(nextH * dpr)
      canvas.style.width = `${nextW}px`
      canvas.style.height = `${nextH}px`
    }

    const drawRidge = (
      offsetX: number,
      baseY: number,
      ampA: number,
      ampB: number,
      phaseA: number,
      phaseB: number,
      fillStyle: string | CanvasGradient,
      rimColor?: string,
    ) => {
      const steps = 42
      ctx.beginPath()
      for (let i = 0; i <= steps; i += 1) {
        const nx = i / steps
        const x = nx * width
        const y = ridgeY(nx + offsetX, baseY, ampA, ampB, phaseA, phaseB, height)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(width + 4, height + 4)
      ctx.lineTo(-4, height + 4)
      ctx.closePath()
      ctx.fillStyle = fillStyle
      ctx.fill()

      if (rimColor) {
        ctx.beginPath()
        for (let i = 0; i <= steps; i += 1) {
          const nx = i / steps
          const x = nx * width
          const y = ridgeY(nx + offsetX, baseY, ampA, ampB, phaseA, phaseB, height)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = rimColor
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
    }

    const drawFrame = (t: number, dt: number) => {
      if (width < 1 || height < 1) return
      const isCalm = calmRef.current

      if (!isCalm) {
        const ease = 1 - Math.exp(-dt * 4.5)
        px += (targetPx - px) * ease
        py += (targetPy - py) * ease
      } else {
        px = 0
        py = 0
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const horizonY = height * 0.67 + py * 6

      // 1. 清晨蓝调天穹渐层
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.85)
      skyGrad.addColorStop(0, '#040814')
      skyGrad.addColorStop(0.28, '#081227')
      skyGrad.addColorStop(0.55, '#122544')
      skyGrad.addColorStop(0.72, '#243554')
      skyGrad.addColorStop(0.86, '#332f42')
      skyGrad.addColorStop(1, '#080e1d')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, width, height)

      // 2. 极轻银河尘带斜掠高空
      ctx.save()
      ctx.translate(width * 0.48 + px * 8, height * 0.3 + py * 4)
      ctx.rotate(-0.36)
      const bandGrad = ctx.createLinearGradient(0, -height * 0.16, 0, height * 0.16)
      bandGrad.addColorStop(0, 'rgba(130, 168, 232, 0)')
      bandGrad.addColorStop(0.5, 'rgba(154, 188, 244, 0.075)')
      bandGrad.addColorStop(1, 'rgba(130, 168, 232, 0)')
      ctx.fillStyle = bandGrad
      ctx.fillRect(-width * 0.9, -height * 0.16, width * 1.8, height * 0.32)
      ctx.restore()

      // 3. 地平线破晓暖金光晕
      const glowX = width * 0.5 + px * 16
      const glowRadius = Math.max(width * 0.56, height * 0.52)
      const horizonGlow = ctx.createRadialGradient(glowX, horizonY, 4, glowX, horizonY, glowRadius)
      horizonGlow.addColorStop(0, 'rgba(255, 214, 162, 0.34)')
      horizonGlow.addColorStop(0.26, 'rgba(242, 194, 139, 0.18)')
      horizonGlow.addColorStop(0.55, 'rgba(196, 128, 96, 0.08)')
      horizonGlow.addColorStop(1, 'rgba(10, 18, 38, 0)')
      ctx.fillStyle = horizonGlow
      ctx.fillRect(0, 0, width, height)

      // 4. 分层微闪星野
      for (const s of stars) {
        const sx = ((s.nx * width + px * 14 * s.depth) % (width + 20) + (width + 20)) % (width + 20) - 10
        const sy = s.ny * height + py * 7 * s.depth
        const twinkle = isCalm ? 0.8 : 0.58 + 0.42 * Math.sin(t * s.speed + s.phase)
        const alpha = s.alpha * twinkle
        ctx.fillStyle = s.warm
          ? `rgba(255, 226, 189, ${alpha.toFixed(3)})`
          : `rgba(202, 222, 255, ${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(sx, sy, s.radius, 0, Math.PI * 2)
        ctx.fill()

        if (s.glint) {
          const arm = s.radius * (3.1 + twinkle * 1.2)
          ctx.strokeStyle = `rgba(255, 232, 200, ${(alpha * 0.42).toFixed(3)})`
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(sx - arm, sy)
          ctx.lineTo(sx + arm, sy)
          ctx.moveTo(sx, sy - arm)
          ctx.lineTo(sx, sy + arm)
          ctx.stroke()
        }
      }

      // 5. 偶现细微流星
      if (!isCalm) {
        if (!meteor.active && t >= meteor.nextAt) {
          meteor.active = true
          meteor.x = width * (0.18 + rng() * 0.52)
          meteor.y = height * (0.08 + rng() * 0.22)
          const speed = 340 + rng() * 140
          meteor.vx = speed * 0.92
          meteor.vy = speed * 0.36
          meteor.life = 0
          meteor.maxLife = 0.85 + rng() * 0.35
        }
        if (meteor.active) {
          meteor.life += dt
          meteor.x += meteor.vx * dt
          meteor.y += meteor.vy * dt
          const p = meteor.life / meteor.maxLife
          if (p >= 1) {
            meteor.active = false
            meteor.nextAt = t + 7.5 + rng() * 5.5
          } else {
            const fade = Math.sin(p * Math.PI)
            const tailLen = 84
            const norm = Math.hypot(meteor.vx, meteor.vy) || 1
            const tx = meteor.x - (meteor.vx / norm) * tailLen
            const ty = meteor.y - (meteor.vy / norm) * tailLen
            const mGrad = ctx.createLinearGradient(tx, ty, meteor.x, meteor.y)
            mGrad.addColorStop(0, 'rgba(255, 226, 189, 0)')
            mGrad.addColorStop(1, `rgba(255, 236, 206, ${(fade * 0.78).toFixed(3)})`)
            ctx.strokeStyle = mGrad
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.moveTo(tx, ty)
            ctx.lineTo(meteor.x, meteor.y)
            ctx.stroke()
          }
        }
      }

      // 6. 远山、流动晨雾与中景丘陵
      drawRidge(
        px * 0.012,
        0.655 + py * 0.008,
        0.032,
        0.014,
        0.4,
        1.1,
        'rgba(15, 27, 52, 0.78)',
        'rgba(242, 194, 139, 0.16)',
      )

      // 山腰流动薄雾
      const mistShift = isCalm ? 0 : Math.sin(t * 0.22) * 28
      const mistY = height * 0.695 + py * 9
      const mistGrad = ctx.createLinearGradient(0, mistY - 38, 0, mistY + 46)
      mistGrad.addColorStop(0, 'rgba(242, 194, 139, 0)')
      mistGrad.addColorStop(0.5, 'rgba(226, 212, 206, 0.075)')
      mistGrad.addColorStop(1, 'rgba(10, 18, 38, 0)')
      ctx.fillStyle = mistGrad
      ctx.fillRect(mistShift - 40, mistY - 38, width + 80, 84)

      drawRidge(
        px * 0.022,
        0.715 + py * 0.012,
        0.028,
        0.012,
        1.9,
        2.6,
        'rgba(10, 19, 39, 0.91)',
        'rgba(242, 194, 139, 0.1)',
      )

      // 7. 前景草原剪影与内部地层暗喻
      ctx.save()
      ctx.beginPath()
      const fgSteps = 56
      for (let i = 0; i <= fgSteps; i += 1) {
        const nx = i / fgSteps
        const x = nx * width
        const y = foregroundY(nx + px * 0.03, height) + py * 14
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(width + 4, height + 4)
      ctx.lineTo(-4, height + 4)
      ctx.closePath()

      const fgGrad = ctx.createLinearGradient(0, height * 0.72, 0, height)
      fgGrad.addColorStop(0, '#091224')
      fgGrad.addColorStop(0.55, '#060c1a')
      fgGrad.addColorStop(1, '#040814')
      ctx.fillStyle = fgGrad
      ctx.fill()

      // 裁切在前景草坡之下：地球深层同心弧线 + 微弱中微子脉冲波纹
      ctx.clip()

      const coreX = width * 0.5 + px * 22
      const coreY = height * 1.24 + py * 10
      const baseR = Math.max(width * 0.28, height * 0.27)
      const strataRadii = [0.78, 1.0, 1.24, 1.5]

      strataRadii.forEach((mul, idx) => {
        const r = baseR * mul
        ctx.save()
        ctx.beginPath()
        ctx.arc(coreX, coreY, r, Math.PI * 1.15, Math.PI * 1.85)
        if (idx % 2 === 1) ctx.setLineDash([4, 7])
        ctx.strokeStyle =
          idx === 0
            ? 'rgba(255, 148, 104, 0.16)'
            : `rgba(242, 194, 139, ${(0.11 - idx * 0.018).toFixed(3)})`
        ctx.lineWidth = idx === 0 ? 1.25 : 0.9
        ctx.stroke()
        ctx.restore()
      })

      // 从地底隐约升起的两道错峰脉冲波纹
      const pulsePhase = isCalm ? 0.35 : (t * 0.24) % 1
      for (let w = 0; w < 2; w += 1) {
        const progress = (pulsePhase + w * 0.5) % 1
        const r = baseR * (0.48 + progress * 1.15)
        const alpha = (1 - progress) * (1 - progress) * 0.24
        ctx.beginPath()
        ctx.arc(coreX, height * 1.12 + py * 8, r, Math.PI * 1.18, Math.PI * 1.82)
        ctx.strokeStyle = `rgba(242, 194, 139, ${alpha.toFixed(3)})`
        ctx.lineWidth = 1.4
        ctx.stroke()
      }

      // 一束极细的琥珀信号线，从地下无声升向地平线
      const threadGrad = ctx.createLinearGradient(0, height, 0, height * 0.74)
      threadGrad.addColorStop(0, 'rgba(255, 148, 104, 0.32)')
      threadGrad.addColorStop(0.65, 'rgba(242, 194, 139, 0.12)')
      threadGrad.addColorStop(1, 'rgba(242, 194, 139, 0)')
      ctx.strokeStyle = threadGrad
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(coreX, height)
      ctx.lineTo(coreX, height * 0.74)
      ctx.stroke()

      // 底部微弱呼吸的信标光点
      const beaconPulse = isCalm ? 0.8 : 0.65 + 0.35 * Math.sin(t * 2.2)
      const beaconR = 26 + beaconPulse * 10
      const beaconGlow = ctx.createRadialGradient(coreX, height - 10, 1, coreX, height - 10, beaconR)
      beaconGlow.addColorStop(0, `rgba(255, 186, 132, ${(0.38 * beaconPulse).toFixed(3)})`)
      beaconGlow.addColorStop(1, 'rgba(255, 148, 104, 0)')
      ctx.fillStyle = beaconGlow
      ctx.beginPath()
      ctx.arc(coreX, height - 10, beaconR, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      // 8. 前景草坡柔和暮金勾边
      ctx.beginPath()
      for (let i = 0; i <= fgSteps; i += 1) {
        const nx = i / fgSteps
        const x = nx * width
        const y = foregroundY(nx + px * 0.03, height) + py * 14
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(242, 194, 139, 0.22)'
      ctx.lineWidth = 1.15
      ctx.stroke()

      // 9. 随风起伏的前景草叶与小朵野花剪影
      for (const blade of flora) {
        const x = blade.nx * width
        const baseY = foregroundY(blade.nx + px * 0.03, height) + py * 14 + 3
        const sway = isCalm
          ? blade.lean * 6
          : Math.sin(t * 1.45 + blade.nx * 14 + blade.phase) * (5 + blade.heightRatio * 80) + blade.lean * 6
        const h = height * blade.heightRatio
        const tipX = x + sway
        const tipY = baseY - h

        ctx.beginPath()
        ctx.moveTo(x, baseY)
        ctx.quadraticCurveTo(x + sway * 0.35, baseY - h * 0.55, tipX, tipY)
        ctx.strokeStyle = blade.flower ? 'rgba(28, 38, 62, 0.92)' : 'rgba(11, 18, 36, 0.92)'
        ctx.lineWidth = blade.thickness
        ctx.lineCap = 'round'
        ctx.stroke()

        if (blade.flower) {
          ctx.fillStyle = 'rgba(255, 226, 189, 0.72)'
          ctx.beginPath()
          ctx.arc(tipX, tipY, 1.85, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 10. 漂浮暖金微尘与清晨蒲公英光点
      for (const m of motes) {
        const mx = isCalm
          ? m.nx * width
          : (((m.nx + t * m.vx) % 1) + 1) % 1 * width + px * 26 * m.depth
        const my = isCalm
          ? m.ny * height
          : (((m.ny + t * m.vy) % 1) + 1) % 1 * height + py * 16 * m.depth
        const breath = isCalm ? 0.75 : 0.45 + 0.55 * Math.sin(t * 1.3 + m.phase)
        const alpha = m.alpha * breath
        const glowR = m.radius * 3.4
        const mGrad = ctx.createRadialGradient(mx, my, 0, mx, my, glowR)
        if (m.warm) {
          mGrad.addColorStop(0, `rgba(255, 226, 189, ${alpha.toFixed(3)})`)
          mGrad.addColorStop(0.5, `rgba(242, 194, 139, ${(alpha * 0.35).toFixed(3)})`)
          mGrad.addColorStop(1, 'rgba(242, 194, 139, 0)')
        } else {
          mGrad.addColorStop(0, `rgba(186, 214, 255, ${alpha.toFixed(3)})`)
          mGrad.addColorStop(1, 'rgba(186, 214, 255, 0)')
        }
        ctx.fillStyle = mGrad
        ctx.beginPath()
        ctx.arc(mx, my, glowR, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (coarsePointer || calmRef.current || width < 1 || height < 1) return
      const nx = (event.clientX / width) * 2 - 1
      const ny = (event.clientY / height) * 2 - 1
      targetPx = Math.max(-1, Math.min(1, nx))
      targetPy = Math.max(-1, Math.min(1, ny))
    }

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const tick = (now: number) => {
      rafId = 0
      if (pausedRef.current || calmRef.current || document.hidden) return
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
      lastTime = now
      elapsed += dt
      drawFrame(elapsed, dt)
      rafId = requestAnimationFrame(tick)
    }

    const syncLoop = () => {
      drawFrame(elapsed, 0.016)
      if (!pausedRef.current && !calmRef.current && !document.hidden) {
        if (!rafId) {
          lastTime = performance.now()
          rafId = requestAnimationFrame(tick)
        }
      } else {
        stopLoop()
      }
    }
    syncLoopRef.current = syncLoop

    const ro = new ResizeObserver(() => {
      resize()
      drawFrame(elapsed, 0.016)
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('visibilitychange', syncLoop)

    resize()
    syncLoop()

    return () => {
      syncLoopRef.current = null
      stopLoop()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', syncLoop)
    }
  }, [])

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
}
