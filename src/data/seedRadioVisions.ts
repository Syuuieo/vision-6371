import type {
  AmbientKind,
  FocusPoint,
  ParticleKind,
  RadioSignal,
  RadioSignalPreview,
  VisionEcho,
  VisionPacket,
} from '../types/vision'

const W = 1600
const H = 1000
const TAU = Math.PI * 2

type Rand = () => number
type SceneKind =
  | 'rain-study'
  | 'coast'
  | 'alley'
  | 'snow-field'
  | 'lake'
  | 'metro'
  | 'rain-street'
  | 'fog-bridge'
  | 'hutong'
  | 'city-wall'
  | 'tropic-coast'
  | 'plateau'
  | 'sydney-harbor'
  | 'hawaii-sunset'
  | 'iceland-aurora'
  | 'capetown-summer'
  | 'kyoto-river'
  | 'paris-seine'

interface Palette {
  top: string
  mid: string
  bottom: string
  glow: string
  accent: string
  ground: string
}

interface SeedMeta {
  code: string
  city: string
  title: string
  sender: string
  scene: SceneKind
  lat: number
  lon: number
  particles: ParticleKind
  ambience: AmbientKind
  tempC: number
  windLevel: number
  scentTag: string
  palette: Palette
  hearts: number
  publishedAt: number
  focus: FocusPoint[]
  echoes: VisionEcho[]
}

function seedOf(text: string) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry(seed: number): Rand {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  inner = 0,
) {
  const gradient = ctx.createRadialGradient(x, y, inner, x, y, radius)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.34, `${color}${Math.round(alpha * 100).toString(16).padStart(2, '0')}`)
  gradient.addColorStop(1, `${color}00`)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function fillLinear(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  stops.forEach(([at, color]) => gradient.addColorStop(at, color))
  return gradient
}


function stars(ctx: CanvasRenderingContext2D, rand: Rand, count: number, top = 0, bottom = H * 0.62) {
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const x = rand() * W
    const y = top + rand() * (bottom - top)
    const size = rand() * 1.7 + 0.3
    ctx.globalAlpha = 0.18 + rand() * 0.7
    ctx.fillStyle = rand() > 0.82 ? '#ffe9c8' : '#d7f6ff'
    ctx.beginPath()
    ctx.arc(x, y, size, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function grain(ctx: CanvasRenderingContext2D, rand: Rand, count = 1300) {
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    ctx.globalAlpha = 0.012 + rand() * 0.04
    ctx.fillStyle = rand() > 0.4 ? '#dff8ef' : '#020506'
    const size = 0.6 + rand() * 1.1
    ctx.fillRect(rand() * W, rand() * H, size, size)
  }
  ctx.restore()
}

function vignette(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.26, W * 0.5, H * 0.5, W * 0.72)
  gradient.addColorStop(0, 'rgba(2,6,8,0)')
  gradient.addColorStop(0.68, 'rgba(2,6,8,0.16)')
  gradient.addColorStop(1, 'rgba(2,6,8,0.78)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
}

function rain(ctx: CanvasRenderingContext2D, rand: Rand, count: number, color = 'rgba(196,230,255,0.28)', width = 1.2) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  for (let i = 0; i < count; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const len = 22 + rand() * 92
    ctx.globalAlpha = 0.2 + rand() * 0.65
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - len * 0.14, y + len)
    ctx.stroke()
  }
  ctx.restore()
}

function snow(ctx: CanvasRenderingContext2D, rand: Rand, count: number) {
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const size = 0.8 + rand() * 3.2
    ctx.globalAlpha = 0.25 + rand() * 0.65
    ctx.fillStyle = '#f6fbff'
    ctx.beginPath()
    ctx.arc(x, y, size, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function skyline(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  baseY: number,
  minH: number,
  maxH: number,
  color: string,
  lights = 0,
) {
  let x = -40
  while (x < W + 80) {
    const w = 32 + rand() * 96
    const h = minH + rand() * (maxH - minH)
    ctx.fillStyle = color
    ctx.fillRect(x, baseY - h, w, h + 120)
    if (rand() > 0.45) ctx.fillRect(x + w * 0.55, baseY - h - 22, w * 0.32, 26)
    if (lights > 0) {
      for (let i = 0; i < lights; i += 1) {
        if (rand() > 0.32) {
          ctx.fillStyle = rand() > 0.78 ? 'rgba(255,213,151,0.74)' : 'rgba(147,224,224,0.42)'
          ctx.fillRect(x + 5 + rand() * Math.max(4, w - 12), baseY - h + 8 + rand() * (h - 18), 2.4, 4.2)
        }
      }
    }
    x += w + 4 + rand() * 18
  }
}

function mountain(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  baseY: number,
  color: string,
  count: number,
  height: number,
) {
  ctx.fillStyle = color
  for (let i = 0; i < count; i += 1) {
    const cx = (i / (count - 1)) * W + (rand() - 0.5) * 180
    const peak = baseY - height * (0.4 + rand() * 0.75)
    ctx.beginPath()
    ctx.moveTo(cx - 300 - rand() * 190, baseY)
    ctx.lineTo(cx, peak)
    ctx.lineTo(cx + 320 + rand() * 220, baseY)
    ctx.closePath()
    ctx.fill()
  }
}

function treeBranch(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, len: number, angle: number, depth: number) {
  if (depth <= 0 || len < 8) return
  const x2 = x + Math.cos(angle) * len
  const y2 = y + Math.sin(angle) * len
  ctx.strokeStyle = 'rgba(3,8,8,0.92)'
  ctx.lineWidth = Math.max(1, depth * 2.2)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const spread = 0.32 + rand() * 0.3
  treeBranch(ctx, rand, x2, y2, len * (0.62 + rand() * 0.12), angle - spread, depth - 1)
  treeBranch(ctx, rand, x2, y2, len * (0.58 + rand() * 0.14), angle + spread, depth - 1)
  if (rand() > 0.52) {
    ctx.fillStyle = 'rgba(226,245,232,0.12)'
    ctx.beginPath()
    ctx.arc(x2, y2, 1.6 + rand() * 2.2, 0, TAU)
    ctx.fill()
  }
}

function leafCanopy(ctx: CanvasRenderingContext2D, rand: Rand, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  for (let i = 0; i < 140; i += 1) {
    const x = rand() * W
    const y = rand() * H * 0.42
    const r = 8 + rand() * 42
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.35 + rand() * 0.4), rand() * TAU, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function reflection(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, rand: Rand) {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 34; i += 1) {
    const yy = y + (i / 34) * height
    const spread = (i / 34) * width
    ctx.globalAlpha = 0.03 + rand() * 0.11
    ctx.fillStyle = color
    ctx.fillRect(x - spread / 2, yy, spread, 1.3 + rand() * 2)
  }
  ctx.restore()
}

function renderRainStudy(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  ctx.fillStyle = palette.top
  ctx.fillRect(0, 0, W, H)
  const wx = 104
  const wy = 76
  const ww = W - 208
  const wh = 742
  ctx.save()
  ctx.beginPath()
  ctx.rect(wx, wy, ww, wh)
  ctx.clip()
  ctx.fillStyle = fillLinear(ctx, 0, wy, 0, wy + wh, [
    [0, '#0b1b29'],
    [0.55, '#173345'],
    [1, '#2d4b4f'],
  ])
  ctx.fillRect(wx, wy, ww, wh)
  glow(ctx, W * 0.7, wy + wh * 0.78, 540, '#ffc887', 0.24)
  glow(ctx, W * 0.17, wy + wh * 0.2, 370, '#56a8a4', 0.16)
  skyline(ctx, rand, wy + wh * 0.88, 80, 270, 'rgba(4,12,17,0.86)', 18)
  skyline(ctx, rand, wy + wh * 0.97, 40, 160, 'rgba(3,9,13,0.94)', 9)
  rain(ctx, rand, 720, 'rgba(198,231,245,0.3)', 1.25)
  ctx.fillStyle = fillLinear(ctx, 0, wy + wh * 0.58, 0, wy + wh, [
    [0, 'rgba(7,18,23,0)'],
    [0.6, 'rgba(7,18,23,0.38)'],
    [1, 'rgba(5,13,17,0.86)'],
  ])
  ctx.fillRect(wx, wy + wh * 0.5, ww, wh * 0.5)
  for (let i = 0; i < 38; i += 1) {
    const x = wx + rand() * ww
    const y = wy + rand() * wh * 0.7
    const r = 2 + rand() * 12
    ctx.strokeStyle = 'rgba(210,245,244,0.16)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 1.7, 0, 0, TAU)
    ctx.stroke()
    if (rand() > 0.72) {
      ctx.strokeStyle = 'rgba(218,249,247,0.12)'
      ctx.beginPath()
      ctx.moveTo(x, y + r)
      ctx.lineTo(x + rand() * 3 - 1.5, y + r + 16 + rand() * 28)
      ctx.stroke()
    }
  }
  ctx.restore()

  ctx.fillStyle = '#071014'
  ctx.fillRect(0, 0, W, wy)
  ctx.fillRect(0, wy + wh, W, H - wy - wh)
  ctx.fillRect(0, 0, wx, H)
  ctx.fillRect(wx + ww, 0, W - wx - ww, H)
  ctx.fillStyle = 'rgba(9,20,22,0.84)'
  ctx.fillRect(W * 0.49, wy, 16, wh)
  ctx.fillRect(wx, wy + wh * 0.5, ww, 12)
  ctx.strokeStyle = 'rgba(143,240,192,0.08)'
  ctx.lineWidth = 2
  ctx.strokeRect(wx + 7, wy + 7, ww - 14, wh - 14)

  const deskY = H - 202
  ctx.fillStyle = '#050a0b'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, deskY + 24)
  ctx.lineTo(W, deskY - 12)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = fillLinear(ctx, 0, deskY - 60, 0, H, [
    [0, 'rgba(35,45,39,0.6)'],
    [1, '#040708'],
  ])
  ctx.fillRect(0, deskY + 20, W, H - deskY)

  glow(ctx, 300, deskY - 54, 240, '#ffb86e', 0.5)
  ctx.fillStyle = '#151611'
  ctx.fillRect(278, deskY - 56, 14, 84)
  ctx.beginPath()
  ctx.moveTo(244, deskY - 64)
  ctx.lineTo(326, deskY - 64)
  ctx.lineTo(306, deskY - 112)
  ctx.lineTo(264, deskY - 112)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,214,155,0.48)'
  ctx.beginPath()
  ctx.moveTo(260, deskY - 68)
  ctx.lineTo(310, deskY - 68)
  ctx.lineTo(298, deskY - 104)
  ctx.lineTo(272, deskY - 104)
  ctx.closePath()
  ctx.fill()

  ctx.save()
  ctx.translate(800, deskY + 6)
  ctx.rotate(-0.04)
  ctx.fillStyle = 'rgba(225,228,208,0.78)'
  ctx.fillRect(-236, 0, 472, 128)
  ctx.fillStyle = 'rgba(255,209,162,0.16)'
  ctx.fillRect(-210, 16, 420, 96)
  ctx.strokeStyle = 'rgba(55,58,48,0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 8)
  ctx.lineTo(0, 118)
  ctx.stroke()
  for (let i = 0; i < 7; i += 1) {
    ctx.strokeStyle = 'rgba(55,58,48,0.22)'
    ctx.beginPath()
    ctx.moveTo(-200, 32 + i * 12)
    ctx.lineTo(-18, 32 + i * 12)
    ctx.moveTo(20, 32 + i * 12)
    ctx.lineTo(202, 32 + i * 12)
    ctx.stroke()
  }
  ctx.restore()

  ctx.fillStyle = 'rgba(12,16,13,0.95)'
  ctx.beginPath()
  ctx.roundRect(1190, deskY - 34, 92, 74, 10)
  ctx.fill()
  ctx.strokeStyle = 'rgba(219,245,232,0.22)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(1236, deskY - 34, 34, Math.PI, TAU)
  ctx.stroke()
  glow(ctx, 1236, deskY - 66, 80, '#b9f7db', 0.15)

  ctx.strokeStyle = 'rgba(184,240,213,0.13)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(1420, 0)
  ctx.quadraticCurveTo(1398, 160, 1438, 322)
  ctx.stroke()
  ctx.fillStyle = 'rgba(196,255,231,0.06)'
  ctx.beginPath()
  ctx.arc(1438, 330, 18, 0, TAU)
  ctx.fill()
}

function renderCoast(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette, tropical = false) {
  const horizon = H * 0.52
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, horizon, [
    [0, palette.top],
    [0.6, palette.mid],
    [1, palette.bottom],
  ])
  ctx.fillRect(0, 0, W, horizon)
  stars(ctx, rand, tropical ? 120 : 38, 0, horizon * 0.55)
  const sunX = tropical ? W * 0.28 : W * 0.68
  const sunY = horizon - (tropical ? 22 : 6)
  glow(ctx, sunX, sunY, tropical ? 240 : 430, palette.glow, tropical ? 0.3 : 0.66)
  ctx.fillStyle = tropical ? 'rgba(255,221,171,0.32)' : 'rgba(255,216,161,0.9)'
  ctx.beginPath()
  ctx.arc(sunX, sunY, tropical ? 42 : 62, 0, TAU)
  ctx.fill()

  ctx.fillStyle = fillLinear(ctx, 0, horizon, 0, H, [
    [0, palette.ground],
    [0.4, '#0c2730'],
    [1, '#03090c'],
  ])
  ctx.fillRect(0, horizon, W, H - horizon)
  reflection(ctx, sunX, horizon, tropical ? 330 : 520, H - horizon, palette.glow, rand)

  ctx.save()
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 80; i += 1) {
    const y = horizon + Math.pow(rand(), 1.7) * (H - horizon)
    const x = rand() * W
    ctx.strokeStyle = rand() > 0.55 ? 'rgba(208,246,247,0.24)' : 'rgba(4,13,17,0.45)'
    ctx.lineWidth = 0.8 + rand() * 1.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 30 + rand() * 150, y)
    ctx.stroke()
  }
  ctx.restore()

  const pierBase = H + 30
  const pierTop = H * 0.64
  ctx.fillStyle = '#050c0f'
  ctx.beginPath()
  ctx.moveTo(W * 0.1, pierBase)
  ctx.lineTo(W * 0.55, pierBase)
  ctx.lineTo(W * 0.76, pierTop)
  ctx.lineTo(W * 0.7, pierTop)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(33,48,48,0.75)'
  ctx.beginPath()
  ctx.moveTo(W * 0.14, pierBase - 16)
  ctx.lineTo(W * 0.55, pierBase - 16)
  ctx.lineTo(W * 0.755, pierTop)
  ctx.lineTo(W * 0.712, pierTop)
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 7; i += 1) {
    const t = i / 7
    const x = W * (0.54 + 0.19 * t)
    const y = H - (H - pierTop) * t
    const scale = 1 - t * 0.55
    ctx.fillStyle = 'rgba(3,8,10,0.95)'
    ctx.fillRect(x, y - 170 * scale, 7 * scale, 170 * scale)
    if (i === 2 || i === 5) {
      glow(ctx, x + 4 * scale, y - 186 * scale, 100 * scale, '#ffd49b', 0.38)
      ctx.fillStyle = 'rgba(255,222,172,0.78)'
      ctx.beginPath()
      ctx.arc(x + 4 * scale, y - 188 * scale, 4.5 * scale, 0, TAU)
      ctx.fill()
    }
  }

  if (tropical) {
    ctx.strokeStyle = 'rgba(3,10,11,0.96)'
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.moveTo(W * 0.08, H)
    ctx.quadraticCurveTo(W * 0.07, H * 0.7, W * 0.19, H * 0.5)
    ctx.stroke()
    for (let i = 0; i < 8; i += 1) {
      const angle = -2.7 + i * 0.4
      const len = 170 + rand() * 180
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(W * 0.19, H * 0.5)
      ctx.quadraticCurveTo(
        W * 0.19 + Math.cos(angle) * len * 0.6,
        H * 0.5 + Math.sin(angle) * len * 0.6 + 40,
        W * 0.19 + Math.cos(angle) * len,
        H * 0.5 + Math.sin(angle) * len + 90,
      )
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = 'rgba(3,8,10,0.92)'
    for (let i = 0; i < 9; i += 1) {
      const x = W * 0.13 + i * 58
      const h = 12 + rand() * 28
      ctx.fillRect(x, H - 54 - h, 46, h)
    }
  }

  ctx.strokeStyle = 'rgba(3,9,12,0.72)'
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i += 1) {
    const x = W * (0.28 + rand() * 0.4)
    const y = H * (0.28 + rand() * 0.12)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 12, y - 8, x + 24, y)
    ctx.quadraticCurveTo(x + 14, y + 2, x, y)
    ctx.stroke()
  }
}

function renderAlley(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette, hutong = false) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H, [
    [0, palette.top],
    [0.5, palette.mid],
    [1, '#100d0b'],
  ])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.5, H * 0.42, 620, palette.glow, 0.34)

  ctx.fillStyle = 'rgba(8,11,11,0.9)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(W * 0.36, H * 0.22)
  ctx.lineTo(W * 0.36, H * 0.62)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(W, 0)
  ctx.lineTo(W * 0.64, H * 0.22)
  ctx.lineTo(W * 0.64, H * 0.62)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  const vanishY = H * 0.53
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      const near = 0.2 + i * 0.18
      const x = side < 0 ? W * (0.34 - near * 0.34) : W * (0.66 + near * 0.34)
      const wallW = side < 0 ? W * 0.22 : W * 0.22
      const top = vanishY - (0.28 - i * 0.035) * H
      const bottom = vanishY + (0.38 + i * 0.11) * H
      ctx.fillStyle = hutong ? 'rgba(48,48,44,0.94)' : 'rgba(48,36,30,0.92)'
      ctx.fillRect(side < 0 ? x - wallW : x, top, wallW, bottom - top)
      ctx.fillStyle = 'rgba(10,10,10,0.82)'
      ctx.beginPath()
      ctx.moveTo(side < 0 ? x - wallW - 18 : x, top)
      ctx.lineTo(side < 0 ? x + 6 : x + wallW - 6, top - 22)
      ctx.lineTo(side < 0 ? x + 10 : x + wallW - 10, top - 6)
      ctx.lineTo(side < 0 ? x - wallW + 8 : x + 20, top + 12)
      ctx.closePath()
      ctx.fill()

      if (!hutong && i % 2 === 0) {
        const wx = side < 0 ? x - wallW * 0.7 : x + wallW * 0.18
        const wy = top + (bottom - top) * 0.34
        glow(ctx, wx + wallW * 0.22, wy + 46, 100, '#ffb066', 0.36)
        ctx.fillStyle = 'rgba(255,190,112,0.52)'
        ctx.fillRect(wx, wy, wallW * 0.44, 88)
        ctx.strokeStyle = 'rgba(10,10,9,0.8)'
        ctx.lineWidth = 3
        for (let j = 1; j < 4; j += 1) {
          ctx.beginPath()
          ctx.moveTo(wx + (wallW * 0.44 * j) / 4, wy)
          ctx.lineTo(wx + (wallW * 0.44 * j) / 4, wy + 88)
          ctx.stroke()
        }
      }

      if (hutong && i % 2 === 0) {
        const dx = side < 0 ? x - wallW * 0.64 : x + wallW * 0.24
        const dy = top + (bottom - top) * 0.42
        ctx.fillStyle = 'rgba(108,33,28,0.86)'
        ctx.fillRect(dx, dy, wallW * 0.34, 132)
        ctx.strokeStyle = 'rgba(25,15,13,0.85)'
        ctx.lineWidth = 3
        ctx.strokeRect(dx, dy, wallW * 0.34, 132)
        ctx.beginPath()
        ctx.arc(dx + wallW * 0.17, dy + 16, 7, 0, TAU)
        ctx.stroke()
      }
    }
  }

  if (!hutong) {
    ctx.strokeStyle = 'rgba(22,16,10,0.9)'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(W * 0.06, 0)
    ctx.quadraticCurveTo(W * 0.27, H * 0.1, W * 0.39, H * 0.26)
    ctx.stroke()
    for (let i = 0; i < 20; i += 1) {
      const x = W * (0.08 + rand() * 0.5)
      const y = rand() * H * 0.34
      glow(ctx, x, y, 28 + rand() * 30, '#ffc36d', 0.16)
      ctx.fillStyle = 'rgba(255,203,118,0.72)'
      ctx.beginPath()
      ctx.arc(x, y, 1.8 + rand() * 2.6, 0, TAU)
      ctx.fill()
    }
  }

  ctx.fillStyle = fillLinear(ctx, 0, vanishY, 0, H, [
    [0, 'rgba(32,25,23,0.8)'],
    [0.45, 'rgba(14,13,14,0.92)'],
    [1, '#050708'],
  ])
  ctx.beginPath()
  ctx.moveTo(W * 0.36, H)
  ctx.lineTo(W * 0.47, vanishY)
  ctx.lineTo(W * 0.53, vanishY)
  ctx.lineTo(W * 0.64, H)
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 26; i += 1) {
    const t = rand()
    const y = vanishY + t * (H - vanishY)
    const spread = 20 + t * 390
    const x = W * 0.5 + (rand() - 0.5) * spread
    ctx.strokeStyle = rand() > 0.55 ? 'rgba(255,202,127,0.18)' : 'rgba(172,236,222,0.12)'
    ctx.lineWidth = 1 + t * 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rand() - 0.5) * 46, y + 12 + rand() * 24)
    ctx.stroke()
  }

  if (hutong) {
    ctx.save()
    treeBranch(ctx, rand, W * 0.78, H * 0.08, 120, Math.PI * 0.5, 5)
    ctx.fillStyle = 'rgba(238,248,250,0.5)'
    for (let i = 0; i < 170; i += 1) {
      ctx.globalAlpha = 0.2 + rand() * 0.6
      ctx.beginPath()
      ctx.arc(W * 0.55 + rand() * W * 0.42, rand() * H * 0.48, 1 + rand() * 2.5, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(12,14,13,0.92)'
    ctx.beginPath()
    ctx.arc(W * 0.33, H * 0.87, 64, 0, TAU)
    ctx.arc(W * 0.43, H * 0.87, 64, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(12,14,13,0.92)'
    ctx.lineWidth = 5
    for (let i = 0; i < 10; i += 1) {
      ctx.beginPath()
      ctx.moveTo(W * 0.33 + i * 11, H * 0.87)
      ctx.lineTo(W * 0.33 + i * 11 + 30, H * 0.85)
      ctx.stroke()
    }
  }
}

function renderSnowField(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H, [
    [0, palette.top],
    [0.48, palette.mid],
    [1, '#dce8e7'],
  ])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.34, H * 0.2, 520, '#dff2ff', 0.22)
  mountain(ctx, rand, H * 0.48, 'rgba(92,112,125,0.34)', 7, 190)

  ctx.fillStyle = fillLinear(ctx, 0, H * 0.46, 0, H, [
    [0, 'rgba(202,219,222,0.22)'],
    [0.32, 'rgba(207,224,225,0.82)'],
    [1, '#eef4f2'],
  ])
  ctx.fillRect(0, H * 0.46, W, H * 0.54)

  ctx.fillStyle = 'rgba(27,37,43,0.94)'
  ctx.fillRect(W * 0.57, H * 0.36, W * 0.4, H * 0.18)
  ctx.fillStyle = 'rgba(34,45,51,0.98)'
  ctx.fillRect(W * 0.6, H * 0.4, W * 0.34, H * 0.12)
  for (let i = 0; i < 18; i += 1) {
    const wx = W * 0.61 + (i % 9) * W * 0.036
    const wy = H * 0.42 + Math.floor(i / 9) * H * 0.045
    glow(ctx, wx + 18, wy + 20, 44, '#ffd391', 0.18)
    ctx.fillStyle = 'rgba(255,211,145,0.55)'
    ctx.fillRect(wx, wy, 28, 30)
  }
  ctx.fillStyle = 'rgba(24,34,39,0.9)'
  ctx.fillRect(W * 0.74, H * 0.3, 10, 70)
  ctx.beginPath()
  ctx.arc(W * 0.745, H * 0.3, 16, 0, TAU)
  ctx.fill()

  ctx.strokeStyle = 'rgba(102,132,143,0.54)'
  ctx.lineWidth = 3
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.ellipse(W * 0.44, H * 0.9, W * (0.26 + i * 0.085), H * (0.1 + i * 0.035), -0.1, Math.PI * 0.96, Math.PI * 2.04)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(30,41,47,0.9)'
  const goalY = H * 0.76
  ctx.fillRect(W * 0.14, goalY - 92, 7, 128)
  ctx.fillRect(W * 0.27, goalY - 92, 7, 128)
  ctx.fillRect(W * 0.14, goalY - 92, W * 0.13, 6)
  ctx.strokeStyle = 'rgba(30,41,47,0.34)'
  ctx.lineWidth = 1.5
  for (let i = 1; i < 8; i += 1) {
    ctx.beginPath()
    ctx.moveTo(W * 0.14 + (W * 0.13 * i) / 8, goalY - 92)
    ctx.lineTo(W * 0.14 + (W * 0.13 * i) / 8, goalY + 36)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(W * 0.14, goalY - 92 + (128 * i) / 8)
    ctx.lineTo(W * 0.27, goalY - 92 + (128 * i) / 8)
    ctx.stroke()
  }

  ctx.save()
  for (let i = 0; i < 22; i += 1) {
    const x = W * (0.3 + rand() * 0.58)
    const y = H * (0.78 + rand() * 0.18)
    const step = 8 + rand() * 7
    ctx.globalAlpha = 0.09 + rand() * 0.16
    ctx.fillStyle = '#6b848e'
    ctx.beginPath()
    ctx.ellipse(x, y, step, step * 0.4, rand() * 0.4 - 0.2, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(29,37,42,0.9)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(W * 0.035, H * 0.6)
  ctx.quadraticCurveTo(W * 0.03, H * 0.34, W * 0.1, H * 0.2)
  ctx.stroke()
  ctx.lineWidth = 3
  for (let i = 0; i < 9; i += 1) {
    const x = W * (0.04 + rand() * 0.12)
    const y = H * (0.2 + rand() * 0.35)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rand() - 0.5) * 100, y - 80 - rand() * 90)
    ctx.stroke()
  }
  snow(ctx, rand, 480)
}

function renderLake(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  const horizon = H * 0.52
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, horizon, [
    [0, palette.top],
    [0.58, palette.mid],
    [1, palette.bottom],
  ])
  ctx.fillRect(0, 0, W, horizon)
  stars(ctx, rand, 90, 0, horizon * 0.6)
  glow(ctx, W * 0.7, horizon * 0.38, 210, '#e6ecff', 0.36)
  ctx.fillStyle = 'rgba(234,242,255,0.75)'
  ctx.beginPath()
  ctx.arc(W * 0.7, horizon * 0.38, 30, 0, TAU)
  ctx.fill()

  mountain(ctx, rand, horizon + 8, 'rgba(54,63,90,0.82)', 6, 250)
  mountain(ctx, rand, horizon + 28, 'rgba(35,43,62,0.94)', 5, 170)
  ctx.fillStyle = fillLinear(ctx, 0, horizon, 0, H, [
    [0, '#26334b'],
    [0.3, '#172334'],
    [1, '#050a10'],
  ])
  ctx.fillRect(0, horizon, W, H - horizon)
  reflection(ctx, W * 0.7, horizon, 260, H - horizon, '#f2f3ff', rand)
  ctx.save()
  ctx.globalAlpha = 0.28
  for (let i = 0; i < 100; i += 1) {
    const y = horizon + rand() * (H - horizon)
    const x = rand() * W
    ctx.strokeStyle = rand() > 0.4 ? 'rgba(212,230,247,0.4)' : 'rgba(10,18,29,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 12 + rand() * 72, y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(4,9,10,0.82)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(W * 0.52, H * 0.72)
  ctx.quadraticCurveTo(W * 0.6, H * 0.71, W * 0.66, H * 0.73)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W * 0.58, H * 0.715)
  ctx.lineTo(W * 0.6, H * 0.75)
  ctx.stroke()
  ctx.fillStyle = 'rgba(5,9,11,0.94)'
  ctx.beginPath()
  ctx.moveTo(W * 0.62, H * 0.7)
  ctx.quadraticCurveTo(W * 0.66, H * 0.63, W * 0.74, H * 0.72)
  ctx.lineTo(W * 0.62, H * 0.72)
  ctx.fill()

  ctx.strokeStyle = 'rgba(6,12,13,0.9)'
  ctx.lineWidth = 5
  for (let i = 0; i < 12; i += 1) {
    const x = W * (0.02 + rand() * 0.18)
    const base = H * (0.88 + rand() * 0.12)
    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.quadraticCurveTo(x + 10, base - 90 - rand() * 90, x + 30 + rand() * 40, base - 150 - rand() * 110)
    ctx.stroke()
  }
  for (let i = 0; i < 32; i += 1) {
    const x = W * (0.04 + rand() * 0.26)
    const y = H * (0.74 + rand() * 0.22)
    ctx.fillStyle = 'rgba(131,154,155,0.38)'
    ctx.beginPath()
    ctx.ellipse(x, y, 2 + rand() * 3, 9 + rand() * 17, rand() * 0.3, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(201,216,225,0.1)'
  ctx.beginPath()
  ctx.ellipse(W * 0.33, horizon + 30, 260, 22, 0, 0, TAU)
  ctx.fill()
}

function renderMetro(ctx: CanvasRenderingContext2D, rand: Rand) {
  ctx.fillStyle = '#03080a'
  ctx.fillRect(0, 0, W, H)
  const wx = 118
  const wy = 84
  const ww = W - 236
  const wh = 690
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(wx, wy, ww, wh, 88)
  ctx.clip()
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, wy + wh, [
    [0, '#0a1822'],
    [0.52, '#183b44'],
    [1, '#0e1e23'],
  ])
  ctx.fillRect(wx, wy, ww, wh)
  glow(ctx, wx + ww * 0.74, wy + wh * 0.6, 500, '#ffbd7d', 0.24)
  skyline(ctx, rand, wy + wh * 0.76, 150, 400, 'rgba(4,11,15,0.94)', 26)
  ctx.fillStyle = 'rgba(6,14,18,0.6)'
  ctx.fillRect(wx, wy + wh * 0.76, ww, wh * 0.24)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 20; i += 1) {
    const y = wy + 180 + rand() * (wh * 0.52)
    const x = wx + rand() * ww
    const len = 80 + rand() * 320
    const color = rand() > 0.5 ? 'rgba(255,191,113,0.42)' : 'rgba(114,224,220,0.32)'
    const gradient = ctx.createLinearGradient(x, y, x + len, y)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.65, color)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, len, 2 + rand() * 4)
  }
  ctx.restore()

  ctx.fillStyle = 'rgba(252,222,180,0.12)'
  ctx.fillRect(wx, wy + wh * 0.55, ww, 2)
  ctx.strokeStyle = 'rgba(206,247,239,0.16)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(wx + ww * 0.15, wy - 30)
  ctx.lineTo(wx + ww * 0.15, wy + wh + 20)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(wx + ww * 0.78, wy - 20)
  ctx.lineTo(wx + ww * 0.78, wy + wh + 20)
  ctx.stroke()

  ctx.fillStyle = 'rgba(2,7,8,0.42)'
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.ellipse(wx + ww * (0.24 + i * 0.16), wy + wh * 0.84, 58, 16, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(7,17,18,0.98)'
  ctx.lineWidth = 46
  ctx.beginPath()
  ctx.roundRect(wx - 23, wy - 23, ww + 46, wh + 46, 108)
  ctx.stroke()
  ctx.fillStyle = '#060f11'
  ctx.fillRect(0, 0, W, wy - 22)
  ctx.fillRect(0, wy + wh + 22, W, H - wy - wh - 22)
  ctx.fillRect(0, 0, wx - 22, H)
  ctx.fillRect(wx + ww + 22, 0, W - wx - ww - 22, H)
  ctx.fillStyle = 'rgba(10,24,25,0.9)'
  ctx.fillRect(wx + ww * 0.5 - 9, wy, 18, wh)

  ctx.fillStyle = 'rgba(2,7,8,0.94)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, H - 116)
  ctx.quadraticCurveTo(W * 0.26, H - 182, W * 0.55, H - 146)
  ctx.lineTo(W, H - 164)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(185,235,222,0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.18, H - 128)
  ctx.quadraticCurveTo(W * 0.32, H - 130, W * 0.45, H - 104)
  ctx.stroke()

  glow(ctx, W * 0.13, H * 0.23, 260, '#8fe8df', 0.12)
  ctx.fillStyle = 'rgba(186,238,225,0.24)'
  ctx.fillRect(W * 0.1, H * 0.2, 155, 4)
  ctx.fillRect(W * 0.1, H * 0.2, 4, 46)
  ctx.fillRect(W * 0.1, H * 0.2 + 65, 4, 26)
}

function renderRainStreet(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H, [
    [0, palette.top],
    [0.45, palette.mid],
    [1, '#070b10'],
  ])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.18, H * 0.36, 440, '#ffb86f', 0.24)
  glow(ctx, W * 0.82, H * 0.46, 520, '#70cfc5', 0.18)
  leafCanopy(ctx, rand, 'rgba(10,26,21,0.94)', 0.86)
  leafCanopy(ctx, rand, 'rgba(32,68,45,0.55)', 0.34)

  const vanishX = W * 0.52
  const horizon = H * 0.55
  ctx.fillStyle = 'rgba(5,10,12,0.88)'
  skyline(ctx, rand, horizon, 40, 160, 'rgba(5,12,15,0.84)', 8)

  ctx.fillStyle = fillLinear(ctx, 0, horizon, 0, H, [
    [0, '#11181b'],
    [0.42, '#091014'],
    [1, '#030607'],
  ])
  ctx.fillRect(0, horizon, W, H - horizon)
  ctx.strokeStyle = 'rgba(4,8,10,0.9)'
  ctx.lineWidth = 13
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(W * 0.5 + side * W * 0.16, H)
    ctx.lineTo(vanishX + side * 46, horizon)
    ctx.stroke()
  }
  for (let i = 0; i < 5; i += 1) {
    const t = i / 5
    const y = horizon + Math.pow(t, 1.5) * (H - horizon)
    const spread = 80 + t * 700
    ctx.fillStyle = 'rgba(221,238,229,0.08)'
    ctx.fillRect(vanishX - spread / 2, y, spread, 2 + t * 4)
  }

  for (let i = 0; i < 7; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const t = Math.floor(i / 2) / 3
    const x = W * 0.5 + side * (W * 0.18 + t * W * 0.28)
    const y = horizon - 50 + t * 220
    glow(ctx, x, y - 40, 200 - t * 50, '#ffc07a', 0.32)
    ctx.strokeStyle = 'rgba(7,12,12,0.96)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + 160 + t * 200)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,211,151,0.8)'
    ctx.beginPath()
    ctx.arc(x, y - 44, 6 + t * 3, 0, TAU)
    ctx.fill()
    reflection(ctx, x, H - 260 - t * 40, 170 + t * 80, 230, '#ffc37d', rand)
  }

  ctx.strokeStyle = 'rgba(10,15,16,0.94)'
  ctx.lineWidth = 7
  ctx.fillStyle = 'rgba(10,15,16,0.94)'
  ctx.beginPath()
  ctx.arc(W * 0.23, H * 0.86, 44, 0, TAU)
  ctx.arc(W * 0.31, H * 0.86, 44, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(W * 0.23, H * 0.86)
  ctx.lineTo(W * 0.27, H * 0.74)
  ctx.lineTo(W * 0.32, H * 0.86)
  ctx.moveTo(W * 0.31, H * 0.86)
  ctx.lineTo(W * 0.29, H * 0.74)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W * 0.29, H * 0.74)
  ctx.lineTo(W * 0.35, H * 0.7)
  ctx.stroke()

  rain(ctx, rand, 850, 'rgba(199,232,244,0.28)', 1.15)
}

function renderFogBridge(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H, [
    [0, palette.top],
    [0.55, palette.mid],
    [1, '#d8e2df'],
  ])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.62, H * 0.4, 600, '#ffe2b5', 0.28)
  ctx.fillStyle = 'rgba(244,235,216,0.34)'
  ctx.beginPath()
  ctx.arc(W * 0.62, H * 0.4, 58, 0, TAU)
  ctx.fill()

  mountain(ctx, rand, H * 0.55, 'rgba(126,143,146,0.25)', 5, 150)
  ctx.fillStyle = 'rgba(143,161,163,0.22)'
  ctx.fillRect(0, H * 0.53, W, H * 0.1)
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.58, 0, H, [
    [0, 'rgba(112,134,137,0.42)'],
    [0.44, 'rgba(59,78,84,0.72)'],
    [1, '#142329'],
  ])
  ctx.fillRect(0, H * 0.58, W, H * 0.42)
  ctx.save()
  ctx.globalAlpha = 0.3
  for (let i = 0; i < 70; i += 1) {
    const y = H * 0.6 + rand() * H * 0.36
    ctx.strokeStyle = 'rgba(225,238,236,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(rand() * W, y)
    ctx.lineTo(rand() * W, y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.fillStyle = 'rgba(37,50,54,0.94)'
  ctx.fillRect(0, H * 0.52, W, 46)
  ctx.fillRect(0, H * 0.52, W, 9)
  for (let i = 0; i < 5; i += 1) {
    const x = W * (0.1 + i * 0.2)
    ctx.fillRect(x, H * 0.31, 26, H * 0.23)
    ctx.beginPath()
    ctx.moveTo(x, H * 0.31)
    ctx.lineTo(x + 13, H * 0.24)
    ctx.lineTo(x + 26, H * 0.31)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(53,69,72,0.74)'
  ctx.lineWidth = 2.2
  for (let i = 0; i < 42; i += 1) {
    const x = W * (0.03 + (i / 42) * 0.94)
    ctx.beginPath()
    ctx.moveTo(x, H * 0.33)
    ctx.quadraticCurveTo(x + 30, H * 0.52, x + 100, H * 0.53)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(20,31,34,0.72)'
  ctx.beginPath()
  ctx.moveTo(W * 0.07, H * 0.83)
  ctx.lineTo(W * 0.2, H * 0.78)
  ctx.lineTo(W * 0.22, H * 0.81)
  ctx.lineTo(W * 0.1, H * 0.86)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(212,230,229,0.14)'
  ctx.fillRect(0, H * 0.62, W, H * 0.16)
  for (let i = 0; i < 3; i += 1) {
    const x = W * (0.26 + rand() * 0.5)
    const y = H * (0.2 + rand() * 0.12)
    ctx.strokeStyle = 'rgba(44,58,61,0.42)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 10, y - 7, x + 20, y)
    ctx.quadraticCurveTo(x + 11, y + 2, x, y)
    ctx.stroke()
  }
}

function renderCityWall(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  const horizon = H * 0.57
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, horizon, [
    [0, palette.top],
    [0.5, palette.mid],
    [1, palette.bottom],
  ])
  ctx.fillRect(0, 0, W, horizon)
  glow(ctx, W * 0.55, horizon * 0.74, 620, palette.glow, 0.6)
  ctx.fillStyle = 'rgba(255,214,151,0.66)'
  ctx.beginPath()
  ctx.arc(W * 0.55, horizon * 0.74, 74, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(62,46,38,0.24)'
  for (let i = 0; i < 6; i += 1) {
    const y = H * (0.16 + i * 0.065)
    ctx.fillRect(0, y, W, 16 + rand() * 22)
  }

  mountain(ctx, rand, horizon + 8, 'rgba(49,43,43,0.78)', 7, 170)
  ctx.fillStyle = 'rgba(28,27,27,0.94)'
  ctx.fillRect(0, horizon - 52, W, H - horizon + 52)
  for (let i = 0; i < 18; i += 1) {
    const x = i * 94 - 30
    ctx.fillRect(x, horizon - 110, 58, 60)
    ctx.fillStyle = 'rgba(18,18,18,0.8)'
    ctx.fillRect(x + 8, horizon - 96, 28, 40)
    ctx.fillStyle = 'rgba(28,27,27,0.94)'
  }
  ctx.fillStyle = 'rgba(31,29,28,0.98)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, H * 0.78)
  ctx.lineTo(W, H * 0.68)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(115,93,72,0.2)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 22; i += 1) {
    const y = H * (0.7 + i * 0.014)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y - 96)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(22,23,23,0.98)'
  ctx.beginPath()
  ctx.moveTo(W * 0.78, H * 0.24)
  ctx.lineTo(W * 0.78, H * 0.54)
  ctx.lineTo(W * 0.94, H * 0.47)
  ctx.lineTo(W * 0.94, H * 0.22)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,195,120,0.32)'
  ctx.fillRect(W * 0.83, H * 0.36, 26, 52)
  ctx.fillRect(W * 0.89, H * 0.35, 22, 46)

  ctx.strokeStyle = 'rgba(18,17,17,0.9)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(W * 0.09, H * 0.65)
  ctx.lineTo(W * 0.08, H * 0.28)
  ctx.stroke()
  for (let i = 0; i < 9; i += 1) {
    const x = W * (0.08 + rand() * 0.1)
    const y = H * (0.30 + rand() * 0.25)
    ctx.beginPath()
    ctx.moveTo(W * 0.08, H * 0.54)
    ctx.quadraticCurveTo(x, y, x + 40, y - 30)
    ctx.stroke()
  }
}

function renderPlateau(ctx: CanvasRenderingContext2D, rand: Rand, palette: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H, [
    [0, palette.top],
    [0.52, palette.mid],
    [1, palette.bottom],
  ])
  ctx.fillRect(0, 0, W, H)
  stars(ctx, rand, 530, 0, H * 0.62)
  ctx.save()
  ctx.translate(W * 0.52, H * 0.28)
  ctx.rotate(-0.48)
  for (let i = 0; i < 360; i += 1) {
    const x = (rand() - 0.5) * W * 1.1
    const y = (rand() - 0.5) * 190
    ctx.globalAlpha = 0.05 + rand() * 0.23
    ctx.fillStyle = rand() > 0.7 ? '#b9d8ff' : '#edf4ff'
    ctx.beginPath()
    ctx.arc(x, y, 0.6 + rand() * 2.1, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  glow(ctx, W * 0.5, H * 0.3, 540, '#4c79a8', 0.16)

  mountain(ctx, rand, H * 0.7, 'rgba(8,18,27,0.96)', 6, 270)
  mountain(ctx, rand, H * 0.77, 'rgba(3,9,14,0.99)', 5, 190)
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.72, 0, H, [
    [0, 'rgba(9,20,24,0.62)'],
    [1, '#020609'],
  ])
  ctx.fillRect(0, H * 0.72, W, H * 0.28)
  ctx.fillStyle = 'rgba(196,225,228,0.16)'
  ctx.beginPath()
  ctx.ellipse(W * 0.28, H * 0.72, 250, 16, 0, 0, TAU)
  ctx.fill()

  ctx.fillStyle = 'rgba(4,8,10,0.98)'
  ctx.beginPath()
  ctx.moveTo(W * 0.7, H * 0.77)
  ctx.lineTo(W * 0.7, H * 0.67)
  ctx.lineTo(W * 0.74, H * 0.64)
  ctx.lineTo(W * 0.78, H * 0.67)
  ctx.lineTo(W * 0.78, H * 0.77)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,198,113,0.32)'
  ctx.fillRect(W * 0.735, H * 0.69, 10, 28)

  ctx.strokeStyle = 'rgba(11,16,18,0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W * 0.84, H * 0.88)
  ctx.lineTo(W * 0.84, H * 0.5)
  ctx.stroke()
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.moveTo(W * 0.84, H * (0.51 + i * 0.035))
    ctx.quadraticCurveTo(W * 0.73, H * (0.53 + i * 0.035), W * 0.64, H * (0.51 + i * 0.035))
    ctx.stroke()
    const colors = ['#d2e9df', '#e7c27f', '#92b7d4', '#d8b0a0', '#e9f2ef']
    ctx.fillStyle = colors[i]
    ctx.globalAlpha = 0.58
    ctx.beginPath()
    ctx.moveTo(W * (0.67 + i * 0.02), H * (0.505 + i * 0.035))
    ctx.lineTo(W * (0.7 + i * 0.02), H * (0.535 + i * 0.035))
    ctx.lineTo(W * (0.73 + i * 0.02), H * (0.505 + i * 0.035))
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawPagodaEave(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  bodyW: number,
  tierH: number,
  eaveW: number,
  bodyFill: string,
  roofFill: string,
  litColor?: string,
) {
  ctx.fillStyle = bodyFill
  ctx.fillRect(cx - bodyW / 2, y - tierH, bodyW, tierH)
  if (litColor) {
    ctx.fillStyle = litColor
    ctx.fillRect(cx - bodyW * 0.14, y - tierH * 0.72, bodyW * 0.28, tierH * 0.45)
  }
  ctx.fillStyle = roofFill
  ctx.beginPath()
  ctx.moveTo(cx - eaveW / 2, y - tierH + 2)
  ctx.quadraticCurveTo(cx - eaveW * 0.22, y - tierH - 8, cx, y - tierH - 13)
  ctx.quadraticCurveTo(cx + eaveW * 0.22, y - tierH - 8, cx + eaveW / 2, y - tierH + 2)
  ctx.lineTo(cx + bodyW * 0.48, y - tierH + 6)
  ctx.lineTo(cx - bodyW * 0.48, y - tierH + 6)
  ctx.closePath()
  ctx.fill()
}

function renderCityLandmark(ctx: CanvasRenderingContext2D, city: string, palette: Palette) {
  ctx.save()

  if (city === '三亚') {
    const horizon = H * 0.52
    const towers = [
      { x: W * 0.52, w: 32, h: 112 },
      { x: W * 0.57, w: 38, h: 146 },
      { x: W * 0.625, w: 42, h: 164 },
      { x: W * 0.68, w: 36, h: 138 },
      { x: W * 0.73, w: 28, h: 102 },
    ]
    glow(ctx, W * 0.625, horizon - 54, 240, '#ffd498', 0.26)
    ctx.fillStyle = 'rgba(6,16,22,0.92)'
    ctx.fillRect(W * 0.48, horizon - 6, W * 0.29, 10)
    for (const t of towers) {
      ctx.fillStyle = 'rgba(10,24,33,0.9)'
      ctx.beginPath()
      ctx.moveTo(t.x - t.w * 0.5, horizon)
      ctx.quadraticCurveTo(t.x - t.w * 0.62, horizon - t.h * 0.55, t.x - t.w * 0.08, horizon - t.h)
      ctx.quadraticCurveTo(t.x + t.w * 0.55, horizon - t.h * 0.52, t.x + t.w * 0.45, horizon)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = 'rgba(255,212,150,0.68)'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(t.x - t.w * 0.14, horizon - 6)
      ctx.quadraticCurveTo(t.x + t.w * 0.12, horizon - t.h * 0.5, t.x - t.w * 0.05, horizon - t.h + 10)
      ctx.stroke()

      // Shimmer reflection in sea below horizon
      ctx.fillStyle = 'rgba(255,204,138,0.16)'
      ctx.fillRect(t.x - t.w * 0.28, horizon + 6, t.w * 0.56, t.h * 0.48)
    }
    // Distant cape lighthouse on the far right
    ctx.fillStyle = 'rgba(7,16,22,0.88)'
    ctx.fillRect(W * 0.86, horizon - 44, 10, 44)
    glow(ctx, W * 0.865, horizon - 48, 42, '#ffe1a6', 0.55)
  } else if (city === '杭州') {
    const wx = 104
    const wy = 76
    const ww = W - 208
    const wh = 742
    ctx.beginPath()
    ctx.rect(wx, wy, ww, wh)
    ctx.clip()
    const baseY = wy + wh * 0.78
    glow(ctx, W * 0.67, baseY - 120, 260, '#ffd494', 0.28)
    // Misty West Lake Broken Bridge silhouette
    ctx.fillStyle = 'rgba(9,22,28,0.86)'
    ctx.beginPath()
    ctx.moveTo(wx + ww * 0.14, baseY + 8)
    ctx.quadraticCurveTo(wx + ww * 0.34, baseY - 26, wx + ww * 0.54, baseY + 8)
    ctx.lineTo(wx + ww * 0.54, baseY + 18)
    ctx.lineTo(wx + ww * 0.14, baseY + 18)
    ctx.closePath()
    ctx.fill()
    // 5-tier Leifeng Pagoda
    const cx = W * 0.67
    ctx.fillStyle = 'rgba(8,18,24,0.92)'
    ctx.fillRect(cx - 58, baseY - 28, 116, 36)
    for (let i = 0; i < 5; i += 1) {
      const tierW = 74 - i * 9
      const tierH = 34 - i * 2.5
      const y = baseY - 28 - i * 31
      drawPagodaEave(
        ctx,
        cx,
        y,
        tierW,
        tierH,
        tierW + 34,
        'rgba(10,24,30,0.94)',
        'rgba(14,32,38,0.98)',
        'rgba(255,204,132,0.52)',
      )
    }
    ctx.strokeStyle = 'rgba(255,214,152,0.75)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx, baseY - 196)
    ctx.lineTo(cx, baseY - 236)
    ctx.stroke()
  } else if (city === '青岛') {
    const horizon = H * 0.52
    // Zhanqiao Octagonal Huilan Pavilion above pier tip
    const px = W * 0.735
    const py = H * 0.642
    glow(ctx, px, py - 72, 170, '#ffd494', 0.35)
    ctx.fillStyle = 'rgba(8,18,22,0.95)'
    ctx.fillRect(px - 44, py - 14, 88, 22)
    drawPagodaEave(ctx, px, py - 14, 62, 34, 96, 'rgba(12,24,28,0.96)', 'rgba(18,30,34,0.98)', 'rgba(255,208,142,0.68)')
    drawPagodaEave(ctx, px, py - 52, 42, 26, 72, 'rgba(12,24,28,0.96)', 'rgba(18,30,34,0.98)', 'rgba(255,208,142,0.76)')
    ctx.fillStyle = 'rgba(255,220,164,0.85)'
    ctx.beginPath()
    ctx.arc(px, py - 92, 5, 0, TAU)
    ctx.fill()

    // May Fourth Square "Wind of May" distant spiral cape sculpture
    const mx = W * 0.37
    ctx.fillStyle = 'rgba(10,18,22,0.86)'
    ctx.fillRect(mx - 45, horizon - 4, 90, 10)
    glow(ctx, mx, horizon - 48, 120, '#ff8e72', 0.25)
    ctx.strokeStyle = 'rgba(224,96,74,0.82)'
    ctx.lineWidth = 7
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath()
      ctx.ellipse(mx + (i - 1.5) * 3, horizon - 28 - i * 16, 26 - i * 4, 11, -0.22, 0, TAU)
      ctx.stroke()
    }
  } else if (city === '成都') {
    // Glowing Anshun Covered Bridge & Wangjiang Tower at the end of the lantern alley
    const cx = W * 0.5
    const baseY = H * 0.538
    glow(ctx, cx, baseY - 90, 220, '#ffbd75', 0.32)
    ctx.fillStyle = 'rgba(18,14,13,0.9)'
    ctx.fillRect(cx - 115, baseY - 28, 230, 32)
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = 'rgba(255,200,122,0.52)'
      ctx.fillRect(cx - 88 + i * 40, baseY - 22, 18, 16)
    }
    for (let i = 0; i < 3; i += 1) {
      const w = 86 - i * 18
      drawPagodaEave(
        ctx,
        cx,
        baseY - 28 - i * 32,
        w,
        30,
        w + 46,
        'rgba(16,13,12,0.92)',
        'rgba(24,18,16,0.96)',
        'rgba(255,196,118,0.62)',
      )
    }
  } else if (city === '哈尔滨') {
    // St. Sophia Cathedral onion domes & brick nave on the snowy horizon
    const cx = W * 0.42
    const baseY = H * 0.485
    glow(ctx, cx, baseY - 90, 220, '#ffd498', 0.28)
    ctx.fillStyle = 'rgba(34,42,50,0.92)'
    ctx.fillRect(cx - 95, baseY - 68, 190, 74)
    ctx.fillRect(cx - 46, baseY - 122, 92, 60)
    ctx.fillRect(cx - 22, baseY - 166, 44, 48)
    // Main central dome + flanking onion domes
    const domes: [number, number, number][] = [
      [cx, baseY - 182, 24],
      [cx - 56, baseY - 128, 15],
      [cx + 56, baseY - 128, 15],
      [cx - 84, baseY - 82, 11],
      [cx + 84, baseY - 82, 11],
    ]
    for (const [dx, dy, r] of domes) {
      ctx.fillStyle = 'rgba(42,76,74,0.92)'
      ctx.beginPath()
      ctx.arc(dx, dy, r, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(dx - r * 0.72, dy - r * 0.2)
      ctx.quadraticCurveTo(dx, dy - r * 1.9, dx, dy - r * 2.15)
      ctx.quadraticCurveTo(dx, dy - r * 1.9, dx + r * 0.72, dy - r * 0.2)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,215,152,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(dx, dy - r * 2.1)
      ctx.lineTo(dx, dy - r * 2.75)
      ctx.stroke()
    }
    // Warm cathedral windows
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillStyle = 'rgba(255,204,130,0.68)'
      ctx.beginPath()
      ctx.roundRect(cx + i * 32 - 6, baseY - 46, 12, 26, [6, 6, 0, 0])
      ctx.fill()
    }
  } else if (city === '大理') {
    // Chongsheng Three Pagodas on the distant Erhai Lake shore + water shimmer
    const baseY = H * 0.52
    const cx = W * 0.34
    glow(ctx, cx, baseY - 110, 230, '#e6eeff', 0.22)
    const drawTieredStupa = (sx: number, width: number, tiers: number, stepH: number) => {
      ctx.fillStyle = 'rgba(220,232,245,0.62)'
      ctx.fillRect(sx - width * 0.75, baseY - 14, width * 1.5, 16)
      for (let i = 0; i < tiers; i += 1) {
        const w = width * (1 - i * 0.055)
        const y = baseY - 14 - i * stepH
        ctx.fillStyle = 'rgba(218,230,245,0.72)'
        ctx.fillRect(sx - w / 2, y - stepH, w, stepH - 2)
        ctx.fillStyle = 'rgba(38,48,72,0.82)'
        ctx.fillRect(sx - w * 0.62, y - stepH - 2, w * 1.24, 3.2)
      }
      const topY = baseY - 14 - tiers * stepH
      ctx.fillStyle = 'rgba(255,222,172,0.82)'
      ctx.beginPath()
      ctx.moveTo(sx - width * 0.16, topY)
      ctx.lineTo(sx, topY - 26)
      ctx.lineTo(sx + width * 0.16, topY)
      ctx.closePath()
      ctx.fill()
      // Soft lake reflection beneath
      ctx.fillStyle = 'rgba(224,238,255,0.12)'
      ctx.fillRect(sx - width * 0.32, baseY + 4, width * 0.64, tiers * stepH * 0.7)
    }
    drawTieredStupa(cx, 30, 11, 14)
    drawTieredStupa(cx - 58, 19, 8, 11)
    drawTieredStupa(cx + 58, 19, 8, 11)
  } else if (city === '阿格拉') {
    const cx = W * 0.5
    const baseY = H * 0.62
    glow(ctx, cx, baseY - 120, 260, '#ffd4b8', 0.36)
    ctx.fillStyle = 'rgba(244,234,224,0.94)'
    ctx.fillRect(cx - 120, baseY - 96, 240, 96)
    ctx.beginPath()
    ctx.arc(cx, baseY - 135, 58, Math.PI, 0)
    ctx.fill()
    for (const mx of [-155, -108, 108, 155]) {
      ctx.fillRect(cx + mx - 8, baseY - 165, 16, 165)
    }
  } else if (city === '复活节岛') {
    const baseY = H * 0.65
    glow(ctx, W * 0.5, baseY - 90, 290, '#ffd498', 0.34)
    ctx.fillStyle = 'rgba(28,32,36,0.94)'
    ctx.fillRect(W * 0.24, baseY - 12, W * 0.52, 20)
    for (let i = -3; i <= 3; i += 1) {
      const mx = W * 0.5 + i * 74
      const mh = 96 + (3 - Math.abs(i)) * 14
      ctx.fillStyle = 'rgba(72,66,58,0.95)'
      ctx.fillRect(mx - 18, baseY - mh, 36, mh)
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(128,58,42,0.94)'
        ctx.fillRect(mx - 14, baseY - mh - 18, 28, 18)
      }
    }
  } else if (city === '罗马') {
    // Flavian Colosseum arches & golden Roman sunset silhouette
    const cx = W * 0.54
    const baseY = H * 0.62
    glow(ctx, cx, baseY - 120, 290, '#ffd490', 0.36)
    ctx.fillStyle = 'rgba(72,56,42,0.92)'
    ctx.fillRect(cx - 190, baseY - 140, 380, 140)
    ctx.fillStyle = 'rgba(255,204,132,0.58)'
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        ctx.fillRect(cx - 165 + col * 38, baseY - 122 + row * 42, 18, 26)
      }
    }
  } else if (city === '北京') {
    // Temple of Heaven Hall of Prayer for Good Harvests down the hutong axis
    const cx = W * 0.5
    const baseY = H * 0.532
    glow(ctx, cx, baseY - 82, 200, '#ffd59a', 0.3)
    ctx.fillStyle = 'rgba(218,214,205,0.42)'
    ctx.fillRect(cx - 86, baseY - 14, 172, 16)
    ctx.fillRect(cx - 72, baseY - 26, 144, 14)
    ctx.fillStyle = 'rgba(32,28,30,0.94)'
    ctx.fillRect(cx - 56, baseY - 56, 112, 32)
    for (const [rw, ry, h] of [
      [136, baseY - 56, 26],
      [104, baseY - 80, 26],
      [74, baseY - 104, 34],
    ] as const) {
      ctx.fillStyle = 'rgba(28,58,92,0.92)'
      ctx.beginPath()
      ctx.moveTo(cx - rw / 2, ry)
      ctx.quadraticCurveTo(cx - rw * 0.18, ry - h * 0.55, cx, ry - h)
      ctx.quadraticCurveTo(cx + rw * 0.18, ry - h * 0.55, cx + rw / 2, ry)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,214,132,0.92)'
    ctx.beginPath()
    ctx.arc(cx, baseY - 142, 6, 0, TAU)
    ctx.fill()
  } else if (city === '西安') {
    // Giant Wild Goose Pagoda rising behind the ancient city wall
    const cx = W * 0.34
    const baseY = H * 0.522
    glow(ctx, cx, baseY - 125, 240, '#ffcb88', 0.32)
    for (let i = 0; i < 7; i += 1) {
      const w = 96 - i * 8
      const tierH = 26 - i * 1.2
      const y = baseY - i * (tierH + 1)
      ctx.fillStyle = 'rgba(34,26,24,0.96)'
      ctx.fillRect(cx - w / 2, y - tierH, w, tierH)
      ctx.fillStyle = 'rgba(54,40,34,0.98)'
      ctx.fillRect(cx - w * 0.57, y - tierH - 3, w * 1.14, 5)
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,198,124,0.58)'
        ctx.fillRect(cx - 5, y - tierH + 6, 10, 12)
      }
    }
    ctx.fillStyle = 'rgba(255,204,136,0.88)'
    ctx.beginPath()
    ctx.arc(cx, baseY - 196, 10, Math.PI, TAU)
    ctx.fill()
  } else if (city === '格鲁吉亚') {
    // Mount Ushba twin sword peaks & Gergeti Trinity Stone Sanctuary
    const cx = W * 0.5
    const baseY = H * 0.68
    glow(ctx, cx, baseY - 170, 290, '#ffd4b8', 0.34)
    ctx.fillStyle = 'rgba(46,58,66,0.94)'
    ctx.beginPath()
    ctx.moveTo(cx - 210, baseY + 20)
    ctx.lineTo(cx - 82, baseY - 215)
    ctx.lineTo(cx - 12, baseY - 95)
    ctx.lineTo(cx + 68, baseY - 190)
    ctx.lineTo(cx + 210, baseY + 20)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(248,236,228,0.86)'
    ctx.beginPath()
    ctx.moveTo(cx - 82, baseY - 215)
    ctx.lineTo(cx - 46, baseY - 135)
    ctx.lineTo(cx - 110, baseY - 140)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(184,171,152,0.92)'
    ctx.fillRect(cx + 35, baseY - 48, 42, 48)
  } else {
    void palette
  }

  ctx.restore()
}

function renderScene(ctx: CanvasRenderingContext2D, meta: SeedMeta, w: number, h: number) {
  const rand = mulberry(seedOf(`${meta.code}-${meta.scene}-${w}`))
  ctx.save()
  if (w !== W || h !== H) {
    ctx.scale(w / W, h / H)
  }
  switch (meta.scene) {
    case 'rain-study':
      renderRainStudy(ctx, rand, meta.palette)
      break
    case 'coast':
      renderCoast(ctx, rand, meta.palette)
      break
    case 'alley':
      renderAlley(ctx, rand, meta.palette)
      break
    case 'snow-field':
      renderSnowField(ctx, rand, meta.palette)
      break
    case 'lake':
      renderLake(ctx, rand, meta.palette)
      break
    case 'metro':
      renderMetro(ctx, rand)
      break
    case 'rain-street':
      renderRainStreet(ctx, rand, meta.palette)
      break
    case 'fog-bridge':
      renderFogBridge(ctx, rand, meta.palette)
      break
    case 'hutong':
      renderAlley(ctx, rand, meta.palette, true)
      break
    case 'city-wall':
      renderCityWall(ctx, rand, meta.palette)
      break
    case 'tropic-coast':
      renderCoast(ctx, rand, meta.palette, true)
      break
    case 'plateau':
      renderPlateau(ctx, rand, meta.palette)
      break
    case 'sydney-harbor':
      renderSydneyHarbor(ctx, rand, meta.palette)
      break
    case 'hawaii-sunset':
      renderHawaiiSunset(ctx, rand, meta.palette)
      break
    case 'iceland-aurora':
      renderIcelandAurora(ctx, rand, meta.palette)
      break
    case 'capetown-summer':
      renderCapeTownSummer(ctx, rand, meta.palette)
      break
    case 'kyoto-river':
      renderKyotoRiver(ctx, rand, meta.palette)
      break
    case 'paris-seine':
      renderParisSeine(ctx, rand, meta.palette)
      break
  }
  renderCityLandmark(ctx, meta.city, meta.palette)
  grain(ctx, rand, w > 800 ? 1300 : 420)
  vignette(ctx)
  ctx.restore()
}

function dataUrl(canvas: HTMLCanvasElement) {
  const webp = canvas.toDataURL('image/webp', 0.9)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.86)
}

const imageCache = new Map<string, string>()

function renderSydneyHarbor(ctx: CanvasRenderingContext2D, rand: Rand, p: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H * 0.68, [[0, p.top], [0.46, p.mid], [1, p.bottom]])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.76, H * 0.34, 420, p.glow, 0.52)
  ctx.save()
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = 'rgba(255, 224, 186, 0.18)'
    ctx.beginPath()
    ctx.ellipse(180 + i * 210, 210 + (i % 3) * 44, 170 + rand() * 80, 18 + rand() * 14, -0.06, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  ctx.save()
  ctx.strokeStyle = 'rgba(28, 42, 68, 0.78)'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(W * 0.28, H * 0.78, 300, Math.PI * 1.12, Math.PI * 1.88)
  ctx.stroke()
  ctx.lineWidth = 3
  for (let i = 0; i < 12; i += 1) {
    const x = W * 0.11 + i * 44
    ctx.beginPath()
    ctx.moveTo(x, H * 0.62)
    ctx.lineTo(x, H * 0.51)
    ctx.stroke()
  }
  ctx.restore()
  ctx.save()
  const shells: [number, number, number, number][] = [
    [820, 628, 175, 190],
    [945, 628, 155, 162],
    [1055, 628, 128, 125],
    [1175, 628, 145, 148],
    [1280, 628, 112, 106],
  ]
  shells.forEach(([sx, sy, sw, sh], idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#fff2df' : '#f2d9be'
    ctx.beginPath()
    ctx.moveTo(sx - sw * 0.45, sy)
    ctx.quadraticCurveTo(sx - sw * 0.1, sy - sh * 0.92, sx + sw * 0.52, sy - sh)
    ctx.quadraticCurveTo(sx + sw * 0.42, sy - sh * 0.32, sx + sw * 0.36, sy)
    ctx.closePath()
    ctx.fill()
  })
  ctx.fillStyle = '#1b2b44'
  ctx.fillRect(740, 626, 660, 26)
  ctx.restore()
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.64, 0, H, [[0, '#1e5b7a'], [0.45, '#133e5c'], [1, '#081d33']])
  ctx.fillRect(0, H * 0.64, W, H * 0.36)
  for (let i = 0; i < 65; i += 1) {
    const y = H * 0.66 + rand() * (H * 0.32)
    const x = W * 0.42 + (rand() - 0.35) * 900
    ctx.fillStyle = rand() > 0.4 ? 'rgba(255, 224, 168, 0.35)' : 'rgba(130, 224, 240, 0.25)'
    ctx.fillRect(x, y, 24 + rand() * 88, 2.2)
  }
}

function renderHawaiiSunset(ctx: CanvasRenderingContext2D, rand: Rand, p: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H * 0.65, [[0, p.top], [0.48, p.mid], [1, p.bottom]])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.52, H * 0.52, 460, p.glow, 0.72)
  ctx.fillStyle = '#fff0c8'
  ctx.beginPath()
  ctx.arc(W * 0.52, H * 0.52, 74, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#2e2238'
  ctx.beginPath()
  ctx.moveTo(0, H * 0.64)
  ctx.lineTo(W * 0.18, H * 0.47)
  ctx.lineTo(W * 0.34, H * 0.52)
  ctx.lineTo(W * 0.48, H * 0.64)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.62, 0, H, [[0, '#c8685c'], [0.35, '#2b5876'], [1, '#12263a']])
  ctx.fillRect(0, H * 0.62, W, H * 0.38)
  for (let i = 0; i < 80; i += 1) {
    const y = H * 0.63 + rand() * H * 0.34
    const spread = 140 + ((y - H * 0.63) / (H * 0.34)) * 460
    const x = W * 0.52 + (rand() - 0.5) * spread
    ctx.fillStyle = 'rgba(255, 222, 160, 0.46)'
    ctx.fillRect(x, y, 22 + rand() * 64, 2.6)
  }
  ctx.save()
  ctx.strokeStyle = '#181224'
  ctx.lineCap = 'round'
  for (const [bx, lean] of [[180, 110], [1420, -120]] as const) {
    ctx.lineWidth = 22
    ctx.beginPath()
    ctx.moveTo(bx, H)
    ctx.quadraticCurveTo(bx + lean * 0.45, H * 0.62, bx + lean, H * 0.32)
    ctx.stroke()
    const tx = bx + lean
    const ty = H * 0.32
    for (let f = 0; f < 7; f += 1) {
      const a = -Math.PI + (f / 6) * Math.PI * 1.45
      ctx.lineWidth = 7
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.quadraticCurveTo(tx + Math.cos(a) * 110, ty + Math.sin(a) * 60 - 25, tx + Math.cos(a) * 195, ty + Math.sin(a) * 125 + 40)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function renderIcelandAurora(ctx: CanvasRenderingContext2D, rand: Rand, p: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H, [[0, p.top], [0.5, p.mid], [1, p.bottom]])
  ctx.fillRect(0, 0, W, H)
  stars(ctx, rand, 280, 0, H * 0.65)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let band = 0; band < 3; band += 1) {
    const grad = ctx.createLinearGradient(0, 90 + band * 70, 0, 520 + band * 40)
    grad.addColorStop(0, 'rgba(110, 255, 190, 0)')
    grad.addColorStop(0.45, band === 1 ? 'rgba(98, 224, 255, 0.36)' : 'rgba(84, 248, 178, 0.44)')
    grad.addColorStop(1, 'rgba(40, 120, 140, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(-40, 420)
    for (let x = 0; x <= W + 80; x += 60) {
      const y = 180 + band * 65 + Math.sin(x * 0.0042 + band * 1.6) * 85
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W + 40, 560)
    ctx.lineTo(-40, 560)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  mountain(ctx, rand, H * 0.72, '#102234', 6, 250)
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.7, 0, H, [[0, '#0c2638'], [1, '#06131f']])
  ctx.fillRect(0, H * 0.7, W, H * 0.3)
  glow(ctx, W * 0.48, H * 0.78, 360, '#5ef0be', 0.28)
  snow(ctx, rand, 120)
}

function renderCapeTownSummer(ctx: CanvasRenderingContext2D, rand: Rand, p: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H * 0.66, [[0, p.top], [0.52, p.mid], [1, p.bottom]])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.24, H * 0.28, 380, p.glow, 0.56)
  ctx.fillStyle = '#2d3b52'
  ctx.beginPath()
  ctx.moveTo(140, H * 0.64)
  ctx.lineTo(360, H * 0.36)
  ctx.lineTo(1140, H * 0.36)
  ctx.lineTo(1380, H * 0.64)
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 14; i += 1) {
    const cx = 360 + i * 58
    glow(ctx, cx, H * 0.37 + rand() * 34, 88, '#fff4e6', 0.44)
  }
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.63, 0, H, [[0, '#2a7aa0'], [0.55, '#195478'], [1, '#0c2b44']])
  ctx.fillRect(0, H * 0.63, W, H * 0.37)
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = 'rgba(255, 240, 210, 0.34)'
    ctx.fillRect(rand() * W, H * 0.65 + rand() * H * 0.33, 30 + rand() * 90, 2.5)
  }
}

function renderKyotoRiver(ctx: CanvasRenderingContext2D, rand: Rand, p: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H * 0.65, [[0, p.top], [0.5, p.mid], [1, p.bottom]])
  ctx.fillRect(0, 0, W, H)
  mountain(ctx, rand, H * 0.58, '#282a42', 5, 175)
  ctx.fillStyle = '#181826'
  ctx.fillRect(0, H * 0.48, W, H * 0.16)
  for (let i = 0; i < 16; i += 1) {
    const lx = 70 + i * 96
    glow(ctx, lx, H * 0.56, 46, '#ffb870', 0.45)
    ctx.fillStyle = '#ffe0a8'
    ctx.beginPath()
    ctx.ellipse(lx, H * 0.56, 10, 14, 0, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.63, 0, H, [[0, '#242c48'], [1, '#0e1424']])
  ctx.fillRect(0, H * 0.63, W, H * 0.37)
  for (let i = 0; i < 16; i += 1) {
    const lx = 70 + i * 96
    for (let j = 0; j < 7; j += 1) {
      ctx.fillStyle = 'rgba(255, 198, 128, 0.28)'
      ctx.fillRect(lx - 14 + (rand() - 0.5) * 14, H * 0.66 + j * 38, 28, 3)
    }
  }
}

function renderParisSeine(ctx: CanvasRenderingContext2D, rand: Rand, p: Palette) {
  ctx.fillStyle = fillLinear(ctx, 0, 0, 0, H * 0.65, [[0, p.top], [0.5, p.mid], [1, p.bottom]])
  ctx.fillRect(0, 0, W, H)
  glow(ctx, W * 0.66, H * 0.48, 360, p.glow, 0.44)
  skyline(ctx, rand, H * 0.62, 70, 165, '#192038', 10)
  ctx.save()
  ctx.fillStyle = '#141a2e'
  ctx.beginPath()
  ctx.moveTo(W * 0.66, H * 0.18)
  ctx.lineTo(W * 0.62, H * 0.62)
  ctx.lineTo(W * 0.7, H * 0.62)
  ctx.closePath()
  ctx.fill()
  glow(ctx, W * 0.66, H * 0.21, 52, '#ffe09e', 0.65)
  ctx.restore()
  ctx.fillStyle = fillLinear(ctx, 0, H * 0.62, 0, H, [[0, '#202d4a'], [1, '#0c1324']])
  ctx.fillRect(0, H * 0.62, W, H * 0.38)
  for (let i = 0; i < 10; i += 1) {
    const lx = 110 + i * 155
    glow(ctx, lx, H * 0.61, 44, '#ffd088', 0.48)
    for (let j = 0; j < 6; j += 1) {
      ctx.fillStyle = 'rgba(255, 214, 146, 0.3)'
      ctx.fillRect(lx - 18, H * 0.66 + j * 42, 36, 2.8)
    }
  }
}

function imageFor(meta: SeedMeta, width: number, height: number) {
  const key = `${meta.code}:${width}x${height}`
  const cached = imageCache.get(key)
  if (cached) return cached
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  renderScene(ctx, meta, width, height)
  const url = dataUrl(canvas)
  imageCache.set(key, url)
  return url
}

const ALL_SEEDS: SeedMeta[] = [
  {
    code: 'VRHZ01',
    city: '杭州',
    title: '杭州 · 凌晨雨夜自习室',
    sender: '林见',
    scene: 'rain-study',
    lat: 30.2741,
    lon: 120.1551,
    particles: 'rain',
    ambience: 'rain',
    tempC: 16,
    windLevel: 1,
    scentTag: '旧书与湿梧桐',
    hearts: 371,
    publishedAt: Date.UTC(2026, 10, 22, 17, 42),
    palette: {
      top: '#071018',
      mid: '#13303b',
      bottom: '#224846',
      glow: '#ffc27c',
      accent: '#9ff0d1',
      ground: '#13323a',
    },
    focus: [
      {
        id: 'hz-1',
        x: 0.3,
        y: 0.68,
        note: '窗上全是雾。我写下一行字，又用手心擦掉，只留下外面的雨声。',
      },
      {
        id: 'hz-2',
        x: 0.72,
        y: 0.62,
        note: '对面楼的最后一盏灯刚刚灭。整座城只剩图书馆和我还在醒着。',
      },
      {
        id: 'hz-3',
        x: 0.51,
        y: 0.86,
        note: '摊开的书停在第七页。我其实读不进去，只是想再坐一会儿。',
      },
    ],
    echoes: [
      {
        id: 'hz-e1',
        message: '我也在杭州。雨下到后半夜的时候，文三路的灯会变得特别软。',
        createdAt: Date.UTC(2026, 10, 22, 19, 8),
      },
    ],
  },
  {
    code: 'VRQD02',
    city: '青岛',
    title: '青岛 · 傍晚防波堤',
    sender: '周岚',
    scene: 'coast',
    lat: 36.0671,
    lon: 120.3826,
    particles: 'dust',
    ambience: 'ocean',
    tempC: 14,
    windLevel: 3,
    scentTag: '海盐与旧木',
    hearts: 264,
    publishedAt: Date.UTC(2026, 10, 22, 10, 18),
    palette: {
      top: '#12213b',
      mid: '#5a5367',
      bottom: '#dda574',
      glow: '#ffd096',
      accent: '#ffd3a2',
      ground: '#173644',
    },
    focus: [
      {
        id: 'qd-1',
        x: 0.69,
        y: 0.48,
        note: '太阳落下去的那三分钟，浪会突然变得很轻。像海也在屏住呼吸。',
      },
      {
        id: 'qd-2',
        x: 0.44,
        y: 0.74,
        note: '我在第七块防波石上坐到过末班车。海替我陪了很久，风把外套吹得很响。',
      },
      {
        id: 'qd-3',
        x: 0.84,
        y: 0.61,
        note: '远处那盏灯塔每十二秒闪一次。我数过，今天一次也没有错过。',
      },
    ],
    echoes: [
      {
        id: 'qd-e1',
        message: '青岛的晚霞真的会把海水染成蜜色。替我看一眼栈桥尽头的灯。',
        createdAt: Date.UTC(2026, 10, 22, 11, 32),
      },
    ],
  },
  {
    code: 'VRCD03',
    city: '成都',
    title: '成都 · 桂花巷口',
    sender: '阿澄',
    scene: 'alley',
    lat: 30.5728,
    lon: 104.0668,
    particles: 'firefly',
    ambience: 'wind',
    tempC: 19,
    windLevel: 1,
    scentTag: '桂花与热汤',
    hearts: 208,
    publishedAt: Date.UTC(2026, 10, 21, 14, 6),
    palette: {
      top: '#1a1924',
      mid: '#4a3b35',
      bottom: '#cd8c58',
      glow: '#ffb969',
      accent: '#ffd18d',
      ground: '#2b201c',
    },
    focus: [
      {
        id: 'cd-1',
        x: 0.24,
        y: 0.42,
        note: '巷口的桂花今年开得晚。老板娘说，再等两场雨，香就会落满整条街。',
      },
      {
        id: 'cd-2',
        x: 0.56,
        y: 0.54,
        note: '这家面馆只摆六张桌子。我从小坐到二十二岁，老板还记得我不吃葱。',
      },
      {
        id: 'cd-3',
        x: 0.7,
        y: 0.78,
        note: '石板缝里积着一点雨水。灯光掉进去，像一小片还热着的夜色。',
      },
    ],
    echoes: [
      {
        id: 'cd-e1',
        message: '闻到桂花香了。成都的秋天从来不急着赶路。',
        createdAt: Date.UTC(2026, 10, 21, 16, 40),
      },
      {
        id: 'cd-e2',
        message: '替我在巷口那家面馆加一份臊子。',
        createdAt: Date.UTC(2026, 10, 21, 20, 12),
      },
    ],
  },
  {
    code: 'VRHR04',
    city: '哈尔滨',
    title: '哈尔滨 · 初雪操场',
    sender: '宋野',
    scene: 'snow-field',
    lat: 45.8038,
    lon: 126.5349,
    particles: 'snow',
    ambience: 'snow',
    tempC: -8,
    windLevel: 2,
    scentTag: '雪与铁栏杆',
    hearts: 319,
    publishedAt: Date.UTC(2026, 10, 22, 5, 26),
    palette: {
      top: '#0c1725',
      mid: '#354a59',
      bottom: '#d6e2e5',
      glow: '#d9edff',
      accent: '#eaf6ff',
      ground: '#e5eef0',
    },
    focus: [
      {
        id: 'hr-1',
        x: 0.73,
        y: 0.43,
        note: '教学楼还亮着两扇窗。雪把排球网压弯了，整个操场静得像一张没写字的纸。',
      },
      {
        id: 'hr-2',
        x: 0.29,
        y: 0.66,
        note: '我沿着跑道走了一圈，脚印很快就被新雪盖住。好像这一圈从来没有发生过。',
      },
      {
        id: 'hr-3',
        x: 0.53,
        y: 0.8,
        note: '球门后面埋着我们去年堆的雪人。今年还没人去找它。',
      },
    ],
    echoes: [
      {
        id: 'hr-e1',
        message: '哈尔滨的第一场雪是不是还是先把路灯点亮，再慢慢落下来。',
        createdAt: Date.UTC(2026, 10, 22, 7, 3),
      },
    ],
  },
  {
    code: 'VRDL05',
    city: '大理',
    title: '大理 · 洱海晚风',
    sender: '阿遥',
    scene: 'lake',
    lat: 25.6065,
    lon: 100.2676,
    particles: 'dust',
    ambience: 'wind',
    tempC: 17,
    windLevel: 2,
    scentTag: '水草与冷月',
    hearts: 287,
    publishedAt: Date.UTC(2026, 10, 21, 12, 44),
    palette: {
      top: '#08111f',
      mid: '#29344f',
      bottom: '#6d6e87',
      glow: '#c9d4ff',
      accent: '#dae4ff',
      ground: '#101c2d',
    },
    focus: [
      {
        id: 'dl-1',
        x: 0.7,
        y: 0.33,
        note: '月亮很低，像有人把它随手放在苍山顶上。风从洱海上过来，带着一点凉。',
      },
      {
        id: 'dl-2',
        x: 0.6,
        y: 0.71,
        note: '那条小船今天没有出湖。船头系着的绳子一直轻轻敲着木头。',
      },
      {
        id: 'dl-3',
        x: 0.2,
        y: 0.77,
        note: '我在岸边踩到一根很老的芦苇。它折下去的声音，比风还轻。',
      },
    ],
    echoes: [
      {
        id: 'dl-e1',
        message: '替我多站一会儿。洱海的风会把没说出口的话带走。',
        createdAt: Date.UTC(2026, 10, 21, 14, 18),
      },
    ],
  },
  {
    code: 'VRAG06',
    city: '阿格拉',
    title: '阿格拉 · 泰姬陵破晓',
    sender: '沙贾汗',
    scene: 'lake',
    lat: 27.1751,
    lon: 78.0421,
    particles: 'dust',
    ambience: 'city',
    tempC: 21,
    windLevel: 1,
    scentTag: '白玉与茉莉晨露',
    hearts: 452,
    publishedAt: Date.UTC(2026, 10, 22, 15, 50),
    palette: {
      top: '#426186',
      mid: '#9fb0c8',
      bottom: '#f3d2cb',
      glow: '#ffd2a8',
      accent: '#f4d3b8',
      ground: '#3e5a39',
    },
    focus: [
      {
        id: 'ag-1',
        x: 0.5,
        y: 0.36,
        note: '第一缕淡粉晨光落上白大理石穹顶，整座主陵像浮在晨雾里的珍珠。',
      },
      {
        id: 'ag-2',
        x: 0.24,
        y: 0.48,
        note: '四座白玉宣礼塔隔水对望，查尔巴格花园的丝柏刚沾满露水。',
      },
      {
        id: 'ag-3',
        x: 0.5,
        y: 0.78,
        note: '长池水波平静得像整面镜子，把穹顶和拂晓都完整收进了水里。',
      },
    ],
    echoes: [
      {
        id: 'ag-e1',
        message: '站在长池南端看泰姬陵醒来，才知道白色也可以有这么多层次的温度。',
        createdAt: Date.UTC(2026, 10, 22, 16, 12),
      },
      {
        id: 'ag-e2',
        message: '如果只能替地下的她选一座清晨，那就留住这里吧。',
        createdAt: Date.UTC(2026, 10, 22, 17, 4),
      },
    ],
  },
  {
    code: 'VRRI07',
    city: '复活节岛',
    title: '复活节岛 · 摩艾石像阵',
    sender: '拉帕努伊守望者',
    scene: 'coast',
    lat: -27.1127,
    lon: -109.3497,
    particles: 'dust',
    ambience: 'ocean',
    tempC: 21,
    windLevel: 3,
    scentTag: '火山石与咸潮',
    hearts: 233,
    publishedAt: Date.UTC(2026, 10, 21, 16, 9),
    palette: {
      top: '#284972',
      mid: '#768fb2',
      bottom: '#f5c79e',
      glow: '#ffd4a0',
      accent: '#ffd8a8',
      ground: '#4a5b35',
    },
    focus: [
      {
        id: 'ri-1',
        x: 0.5,
        y: 0.44,
        note: '九尊玄武岩摩艾背对着南太平洋站在阿胡石台上，赤金破晓正好从它们肩膀后面升起。',
      },
      {
        id: 'ri-2',
        x: 0.22,
        y: 0.62,
        note: '拉诺拉拉库火山草坡里还半埋着未雕刻完的石像，像时间按下了暂停。',
      },
      {
        id: 'ri-3',
        x: 0.78,
        y: 0.68,
        note: '这是地球上离其他大陆最远的一座岛，浪声比风声还要辽阔。',
      },
    ],
    echoes: [
      {
        id: 'ri-e1',
        message: '在南太平洋看着摩艾的白珊瑚眼睛亮起时，忽然就不觉得孤单了。',
        createdAt: Date.UTC(2026, 10, 21, 18, 26),
      },
    ],
  },
  {
    code: 'VRRM08',
    city: '罗马',
    title: '罗马 · 斗兽场夕照',
    sender: '奥古斯都',
    scene: 'fog-bridge',
    lat: 41.8902,
    lon: 12.4922,
    particles: 'dust',
    ambience: 'city',
    tempC: 19,
    windLevel: 2,
    scentTag: '洞石夕照',
    hearts: 268,
    publishedAt: Date.UTC(2026, 10, 23, 22, 15),
    palette: {
      top: '#2b3459',
      mid: '#87636c',
      bottom: '#ebb47f',
      glow: '#ffd498',
      accent: '#f2c98d',
      ground: '#766452',
    },
    focus: [
      {
        id: 'rm-1',
        x: 0.54,
        y: 0.36,
        note: '斜阳透过四层残缺的洞石拱洞斜照进竞技场，每一道柱廊都在发光。',
      },
      {
        id: 'rm-2',
        x: 0.78,
        y: 0.58,
        note: '君士坦丁凯旋门旁边的罗马伞松站得很静，像给神圣大道守了两千年。',
      },
      {
        id: 'rm-3',
        x: 0.24,
        y: 0.72,
        note: '墨达苏丹斯古泉前的倒影池像一块温热的琥珀，把整座罗马接进了夜色里。',
      },
    ],
    echoes: [
      {
        id: 'rm-e1',
        message: '地中海的黄昏落在斗兽场石拱上时，真希望有人能在这里替她吹一阵晚风。',
        createdAt: Date.UTC(2026, 10, 23, 23, 2),
      },
    ],
  },
  {
    code: 'VRBJ09',
    city: '北京',
    title: '北京 · 胡同初冬',
    sender: '小满',
    scene: 'hutong',
    lat: 39.9042,
    lon: 116.4074,
    particles: 'snow',
    ambience: 'wind',
    tempC: 2,
    windLevel: 2,
    scentTag: '蜂窝煤与冻柿子',
    hearts: 178,
    publishedAt: Date.UTC(2026, 10, 22, 20, 31),
    palette: {
      top: '#101820',
      mid: '#39444a',
      bottom: '#6f7472',
      glow: '#ffb66f',
      accent: '#dbe7e8',
      ground: '#1d2326',
    },
    focus: [
      {
        id: 'bj-1',
        x: 0.26,
        y: 0.54,
        note: '檐上落了一层很薄的雪。风一吹，就变成一点点白灰飘下来。',
      },
      {
        id: 'bj-2',
        x: 0.62,
        y: 0.62,
        note: '那扇红门还是旧的。门环被摸得发亮，像有人刚刚从这里回家。',
      },
      {
        id: 'bj-3',
        x: 0.74,
        y: 0.82,
        note: '自行车靠在墙边，车筐里落着雪。车主人大概进屋喝热茶去了。',
      },
    ],
    echoes: [
      {
        id: 'bj-e1',
        message: '雪后的胡同会突然变得很安静。好像整座城都放轻了声音。',
        createdAt: Date.UTC(2026, 10, 22, 21, 14),
      },
    ],
  },
  {
    code: 'VRXA10',
    city: '西安',
    title: '西安 · 城墙落日',
    sender: '阿芷',
    scene: 'city-wall',
    lat: 34.3416,
    lon: 108.9398,
    particles: 'dust',
    ambience: 'wind',
    tempC: 12,
    windLevel: 3,
    scentTag: '砖土与晚风',
    hearts: 242,
    publishedAt: Date.UTC(2026, 10, 20, 10, 2),
    palette: {
      top: '#17213a',
      mid: '#7a5a56',
      bottom: '#e0a15e',
      glow: '#ffcb85',
      accent: '#ffdda6',
      ground: '#2c2422',
    },
    focus: [
      {
        id: 'xa-1',
        x: 0.55,
        y: 0.41,
        note: '落日刚好卡在城墙的齿口。风把旗子吹得很直，影子一路铺到砖缝里。',
      },
      {
        id: 'xa-2',
        x: 0.78,
        y: 0.7,
        note: '角楼亮灯了。六百年前有人在这里看黄昏，今天换成了我。',
      },
      {
        id: 'xa-3',
        x: 0.12,
        y: 0.7,
        note: '那棵树的叶子快落光了。可每次起风，它还是像在跟人招手。',
      },
    ],
    echoes: [
      {
        id: 'xa-e1',
        message: '西安的落日有重量。它落在城墙上，也落在每一个过路人的肩上。',
        createdAt: Date.UTC(2026, 10, 20, 12, 23),
      },
    ],
  },
  {
    code: 'VRSY11',
    city: '三亚',
    title: '三亚 · 凌晨海边',
    sender: '南风',
    scene: 'tropic-coast',
    lat: 18.2528,
    lon: 109.5119,
    particles: 'none',
    ambience: 'ocean',
    tempC: 25,
    windLevel: 2,
    scentTag: '椰叶与潮水',
    hearts: 335,
    publishedAt: Date.UTC(2026, 10, 23, 19, 44),
    palette: {
      top: '#07111f',
      mid: '#273e56',
      bottom: '#c28a72',
      glow: '#ffd9ae',
      accent: '#ffe2bd',
      ground: '#0d2e38',
    },
    focus: [
      {
        id: 'sy-1',
        x: 0.28,
        y: 0.46,
        note: '天还没有亮。潮水一遍遍推上岸，又像什么都没带走。',
      },
      {
        id: 'sy-2',
        x: 0.7,
        y: 0.66,
        note: '昨夜有人在这里放过烟花。沙滩上只剩一小截烧黑的引线。',
      },
      {
        id: 'sy-3',
        x: 0.58,
        y: 0.83,
        note: '我赤脚站了一会儿。沙子是凉的，海水比想象中温柔。',
      },
    ],
    echoes: [
      {
        id: 'sy-e1',
        message: '凌晨的海最适合把心事说出口。浪会替你保守秘密。',
        createdAt: Date.UTC(2026, 10, 23, 20, 17),
      },
    ],
  },
  {
    code: 'VRGE12',
    city: '格鲁吉亚',
    title: '格鲁吉亚 · 圣剑双峰',
    sender: '高加索牧风人',
    scene: 'plateau',
    lat: 43.1249,
    lon: 42.6589,
    particles: 'snow',
    ambience: 'snow',
    tempC: 2,
    windLevel: 2,
    scentTag: '雪松与晨雾岩石',
    hearts: 409,
    publishedAt: Date.UTC(2026, 10, 20, 18, 58),
    palette: {
      top: '#2a4a7a',
      mid: '#7691b8',
      bottom: '#f5cbb8',
      glow: '#ffd8ba',
      accent: '#ffd6c4',
      ground: '#344a32',
    },
    focus: [
      {
        id: 'ge-1',
        x: 0.48,
        y: 0.24,
        note: '乌什巴双刃雪峰在破晓第一缕日光里变成了玫瑰金，像高加索山脊插着的两把剑。',
      },
      {
        id: 'ge-2',
        x: 0.73,
        y: 0.62,
        note: '石砌修道院的火盆刚升起烟，圣钟的余音沿着冷水湖面传过山谷。',
      },
      {
        id: 'ge-3',
        x: 0.25,
        y: 0.68,
        note: '冷杉林里守了千年的方形石碉楼还留着微弱窗光，天亮前风雪就已经停了。',
      },
    ],
    echoes: [
      {
        id: 'ge-e1',
        message: '在斯瓦涅季抬头看圣剑双峰的日照金山，会突然觉得自己离天空很近。',
        createdAt: Date.UTC(2026, 10, 20, 21, 35),
      },
    ],
  },
  {
    code: 'VRSY13',
    city: '悉尼',
    title: '悉尼 · 南半球盛夏海港',
    sender: '南风渡客',
    scene: 'sydney-harbor',
    lat: -33.8688,
    lon: 151.2093,
    particles: 'dust',
    ambience: 'ocean',
    tempC: 28,
    windLevel: 2,
    scentTag: '海盐、防晒霜与盛夏晚风',
    hearts: 392,
    publishedAt: Date.UTC(2026, 10, 24, 7, 20),
    palette: {
      top: '#184e77',
      mid: '#528aae',
      bottom: '#f2b880',
      glow: '#ffd699',
      accent: '#fff0d2',
      ground: '#0a2239',
    },
    focus: [
      {
        id: 'sy13-1',
        x: 0.62,
        y: 0.54,
        note: '北半球正在降温下雪，可悉尼歌剧院的白色贝壳正泡在 28°C 的盛夏晚霞里。',
      },
      {
        id: 'sy13-2',
        x: 0.28,
        y: 0.56,
        note: '渡轮从大桥底下开过去，带起一长条碎金色的水花，替你收进眼睛里。',
      },
    ],
    echoes: [
      {
        id: 'sy13-e1',
        message: '把南半球的夏天寄给正在过冬的人，大概是最浪漫的时差。',
        createdAt: Date.UTC(2026, 10, 24, 8, 12),
      },
    ],
  },
  {
    code: 'VRGZ14',
    city: '吉萨',
    title: '吉萨 · 金字塔与狮身人面像',
    sender: '尼罗河行者',
    scene: 'hawaii-sunset',
    lat: 29.9792,
    lon: 31.1342,
    particles: 'dust',
    ambience: 'wind',
    tempC: 27,
    windLevel: 2,
    scentTag: '撒哈拉暖沙与乳香',
    hearts: 438,
    publishedAt: Date.UTC(2026, 10, 24, 4, 45),
    palette: {
      top: '#283058',
      mid: '#875c68',
      bottom: '#f2aa68',
      glow: '#ffcc7c',
      accent: '#f5cc82',
      ground: '#c79b64',
    },
    focus: [
      {
        id: 'gz-1',
        x: 0.45,
        y: 0.42,
        note: '胡夫、哈夫拉与孟卡拉三座金字塔在落日余晖中排成一线，塔尖黄金顶石还在微微发亮。',
      },
      {
        id: 'gz-2',
        x: 0.72,
        y: 0.6,
        note: '斯芬克斯胸前梦想石碑火坛刚被点亮，尼罗河的晚风静静绕过沙丘。',
      },
    ],
    echoes: [
      {
        id: 'gz-e1',
        message: '在撒哈拉看着猎户座三颗星慢慢浮现在金字塔顶上，时间像慢了一百倍。',
        createdAt: Date.UTC(2026, 10, 24, 5, 30),
      },
    ],
  },
  {
    code: 'VRIS15',
    city: '雷克雅未克',
    title: '雷克雅未克 · 极光冰湾',
    sender: '北纬六十四',
    scene: 'iceland-aurora',
    lat: 64.1466,
    lon: -21.9426,
    particles: 'snow',
    ambience: 'snow',
    tempC: -2,
    windLevel: 2,
    scentTag: '冰川冷空气与松针雪',
    hearts: 465,
    publishedAt: Date.UTC(2026, 10, 23, 23, 15),
    palette: {
      top: '#040b18',
      mid: '#0c2338',
      bottom: '#14424e',
      glow: '#7cf5c4',
      accent: '#c8ffeb',
      ground: '#05101a',
    },
    focus: [
      {
        id: 'is15-1',
        x: 0.48,
        y: 0.28,
        note: '极光是地球磁场和太阳风撞出的光——你在地核最深处，一定也和它连着同一根磁感线。',
      },
      {
        id: 'is15-2',
        x: 0.68,
        y: 0.78,
        note: '冰湾的水面安静得像镜子，把一整条绿色星河接住了。',
      },
    ],
    echoes: [
      {
        id: 'is15-e1',
        message: '站在冰岛看极光时，突然觉得整颗地球都在轻声呼吸。',
        createdAt: Date.UTC(2026, 10, 24, 1, 5),
      },
    ],
  },
  {
    code: 'VRCT16',
    city: '开普敦',
    title: '开普敦 · 桌山云瀑与南大洋',
    sender: '好望角旅人',
    scene: 'capetown-summer',
    lat: -33.9249,
    lon: 18.4241,
    particles: 'dust',
    ambience: 'wind',
    tempC: 25,
    windLevel: 3,
    scentTag: '南大洋海风与桉树清香',
    hearts: 318,
    publishedAt: Date.UTC(2026, 10, 23, 15, 20),
    palette: {
      top: '#1c5a8a',
      mid: '#6ba8c8',
      bottom: '#f4d3a2',
      glow: '#fff0cc',
      accent: '#ffffff',
      ground: '#13314a',
    },
    focus: [
      {
        id: 'ct16-1',
        x: 0.54,
        y: 0.39,
        note: '桌山顶上铺着一层白雾，像有人给南半球的夏天盖了条桌布。',
      },
      {
        id: 'ct16-2',
        x: 0.44,
        y: 0.76,
        note: '大西洋和印度洋的风在这儿撞在一起，吹得整个人都轻快起来。',
      },
    ],
    echoes: [
      {
        id: 'ct16-e1',
        message: '南半球的阳光好透亮，连云朵都像刚晒过一样蓬松。',
        createdAt: Date.UTC(2026, 10, 23, 17, 10),
      },
    ],
  },
  {
    code: 'VRKY17',
    city: '京都',
    title: '京都 · 鸭川暮色风铃',
    sender: '木廊听风',
    scene: 'kyoto-river',
    lat: 35.0116,
    lon: 135.7681,
    particles: 'firefly',
    ambience: 'wind',
    tempC: 16,
    windLevel: 1,
    scentTag: '桧木廊檐与河畔晚风',
    hearts: 356,
    publishedAt: Date.UTC(2026, 10, 23, 11, 40),
    palette: {
      top: '#181e3a',
      mid: '#4a4068',
      bottom: '#d48a78',
      glow: '#ffd098',
      accent: '#ffe6bd',
      ground: '#121526',
    },
    focus: [
      {
        id: 'ky17-1',
        x: 0.52,
        y: 0.56,
        note: '河岸一排町屋刚点亮暖灯，风铃隔几秒轻轻响一下。',
      },
      {
        id: 'ky17-2',
        x: 0.44,
        y: 0.78,
        note: '水声盖住了车流，坐在石阶上能听见很远以外的笑声。',
      },
    ],
    echoes: [
      {
        id: 'ky17-e1',
        message: '傍晚的鸭川让人觉得一天可以走得很慢很慢。',
        createdAt: Date.UTC(2026, 10, 23, 13, 18),
      },
    ],
  },
  {
    code: 'VRPR18',
    city: '巴黎',
    title: '巴黎 · 塞纳河黄昏路灯',
    sender: '左岸散步者',
    scene: 'paris-seine',
    lat: 48.8566,
    lon: 2.3522,
    particles: 'dust',
    ambience: 'city',
    tempC: 14,
    windLevel: 1,
    scentTag: '旧书摊纸香与晚风咖啡',
    hearts: 374,
    publishedAt: Date.UTC(2026, 10, 22, 19, 30),
    palette: {
      top: '#131d38',
      mid: '#3e4268',
      bottom: '#d89a7a',
      glow: '#ffd89e',
      accent: '#ffebc8',
      ground: '#0d1426',
    },
    focus: [
      {
        id: 'pr18-1',
        x: 0.66,
        y: 0.32,
        note: '整点一到，铁塔尖的灯光轻轻闪起来，桥上路过的人都停下了脚步。',
      },
      {
        id: 'pr18-2',
        x: 0.36,
        y: 0.72,
        note: '河边人来人往的脚步声和远处手风琴混在一起，是活生生的人间烟火。',
      },
    ],
    echoes: [
      {
        id: 'pr18-e1',
        message: '左岸的晚风总是带着烤栗子和旧书页的味道。',
        createdAt: Date.UTC(2026, 10, 22, 21, 5),
      },
    ],
  },
]

const DEFAULT_SEED_CODES = [
  'VRAG06',
  'VRRI07',
  'VRRM08',
  'VRDL05',
  'VRHR04',
  'VRGE12',
  'VRSY13',
  'VRGZ14',
  'VRIS15',
  'VRKY17',
  'VRPR18',
] as const
const DEFAULT_SEED_CODE_SET = new Set<string>(DEFAULT_SEED_CODES)
const ALL_SEED_BY_CODE = new Map(ALL_SEEDS.map((seed) => [seed.code, seed]))
const SEEDS: SeedMeta[] = DEFAULT_SEED_CODES.flatMap((code) => {
  const seed = ALL_SEED_BY_CODE.get(code)
  return seed ? [seed] : []
})
const SEED_BY_CODE = new Map(SEEDS.map((seed) => [seed.code, seed]))
// 旧 2D 城市保留完整原数据，仅通过已知 code 访问，不进入默认预览或信标。
const LEGACY_SEED_BY_CODE = new Map(
  ALL_SEEDS.filter((seed) => !DEFAULT_SEED_CODE_SET.has(seed.code)).map((seed) => [seed.code, seed]),
)

export const RADIO_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  阿格拉: { lat: 27.1751, lon: 78.0421 },
  复活节岛: { lat: -27.1127, lon: -109.3497 },
  罗马: { lat: 41.8902, lon: 12.4922 },
  大理: { lat: 25.6065, lon: 100.2676 },
  哈尔滨: { lat: 45.8038, lon: 126.5349 },
  格鲁吉亚: { lat: 43.1249, lon: 42.6589 },
  悉尼: { lat: -33.8688, lon: 151.2093 },
  吉萨: { lat: 29.9792, lon: 31.1342 },
  雷克雅未克: { lat: 64.1466, lon: -21.9426 },
  京都: { lat: 35.0116, lon: 135.7681 },
  巴黎: { lat: 48.8566, lon: 2.3522 },
}

const LEGACY_RADIO_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  北京: { lat: 39.9042, lon: 116.4074 },
  杭州: { lat: 30.2741, lon: 120.1551 },
  成都: { lat: 30.5728, lon: 104.0668 },
  西安: { lat: 34.3416, lon: 108.9398 },
  三亚: { lat: 18.2528, lon: 109.5119 },
  青岛: { lat: 36.0671, lon: 120.3826 },
  开普敦: { lat: -33.9249, lon: 18.4241 },
}

export function cityCoords(city: string) {
  const name = city.trim()
  const direct = RADIO_CITY_COORDS[name] ?? LEGACY_RADIO_CITY_COORDS[name]
  if (direct) return direct
  const hash = seedOf(name || 'earth')
  return {
    lat: 18 + (hash % 2800) / 100,
    lon: 74 + ((hash >>> 8) % 5600) / 100,
  }
}

function seedMetaByCode(code: string) {
  const normalized = code.trim().toUpperCase()
  return SEED_BY_CODE.get(normalized) ?? LEGACY_SEED_BY_CODE.get(normalized) ?? null
}

function packetFor(meta: SeedMeta, image: string): VisionPacket {
  return {
    id: `seed-${meta.code.toLowerCase()}`,
    title: meta.title,
    sender: meta.sender,
    city: meta.city,
    image,
    particles: meta.particles,
    ambience: meta.ambience,
    voice: null,
    tempC: meta.tempC,
    windLevel: meta.windLevel,
    scentTag: meta.scentTag,
    focus: meta.focus,
    createdAt: meta.publishedAt,
  }
}

export function getSeedSignal(code: string): RadioSignal | null {
  const meta = seedMetaByCode(code)
  if (!meta) return null
  return {
    code: meta.code,
    packet: packetFor(meta, imageFor(meta, W, H)),
    hearts: meta.hearts,
    echoes: meta.echoes,
    visibility: 'public',
    origin: 'seed',
    publishedAt: meta.publishedAt,
  }
}

export function getSeedVisionByCode(code: string): RadioSignal | null {
  return getSeedSignal(code)
}

export function getSeedPreview(code: string): RadioSignalPreview | null {
  const meta = seedMetaByCode(code)
  if (!meta) return null
  return {
    code: meta.code,
    title: meta.title,
    sender: meta.sender,
    city: meta.city,
    thumbnail: imageFor(meta, 480, 300),
    tempC: meta.tempC,
    windLevel: meta.windLevel,
    scentTag: meta.scentTag,
    particles: meta.particles,
    ambience: meta.ambience,
    hasVoice: false,
    hearts: meta.hearts,
    visibility: 'public',
    origin: 'seed',
    publishedAt: meta.publishedAt,
  }
}

export function listSeedPreviews() {
  return SEEDS.map((meta) => getSeedPreview(meta.code)).filter((item): item is RadioSignalPreview => item !== null)
}

export function seedBrief(code: string) {
  const meta = seedMetaByCode(code)
  return meta ? { code: meta.code, title: meta.title, sender: meta.sender, city: meta.city } : null
}

export function seedSignalCodes() {
  return SEEDS.map((seed) => seed.code)
}

export function isSeedCode(code: string) {
  return seedMetaByCode(code) !== null
}

export function seedCityId(code: string) {
  return seedMetaByCode(code)?.city ?? null
}