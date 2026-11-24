import type { AmbientKind, ParticleKind, VisionPreset } from '../types/vision'

const TAU = Math.PI * 2
const DW = 1600
const DH = 1000

type Rand = () => number
type Renderer = (ctx: CanvasRenderingContext2D, w: number, h: number, rand: Rand) => void

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
  rgb: string,
  alpha: number,
  inner = 0,
) {
  const gradient = ctx.createRadialGradient(x, y, inner, x, y, radius)
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`)
  gradient.addColorStop(0.38, `rgba(${rgb},${alpha * 0.36})`)
  gradient.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

function puff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function finish(ctx: CanvasRenderingContext2D, w: number, h: number, rand: Rand, tint: string) {
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.74)
  vignette.addColorStop(0, 'rgba(2,5,7,0)')
  vignette.addColorStop(0.72, 'rgba(2,5,7,0.12)')
  vignette.addColorStop(1, 'rgba(2,5,7,0.62)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.globalAlpha = 0.16
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  const dots = Math.floor((w * h) / 1500)
  for (let i = 0; i < dots; i += 1) {
    const tone = rand() > 0.5 ? '255,255,255' : '0,0,0'
    ctx.fillStyle = `rgba(${tone},${0.025 + rand() * 0.045})`
    ctx.fillRect(rand() * w, rand() * h, 1.2, 1.2)
  }
}

function ginkgoLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string,
  alpha: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-size * 0.18, -size * 0.5, -size * 0.92, -size * 0.82)
  ctx.quadraticCurveTo(-size * 0.66, -size * 1.1, -size * 0.12, -size * 0.99)
  ctx.lineTo(0, -size * 0.74)
  ctx.lineTo(size * 0.12, -size * 0.99)
  ctx.quadraticCurveTo(size * 0.66, -size * 1.1, size * 0.92, -size * 0.82)
  ctx.quadraticCurveTo(size * 0.18, -size * 0.5, 0, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(80,48,16,0.35)'
  ctx.lineWidth = Math.max(0.6, size * 0.045)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, size * 0.42)
  ctx.stroke()
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* 01 · 图书馆归途 · 蓝调晚霞                                          */
/* ------------------------------------------------------------------ */

const drawLibrary: Renderer = (ctx, w, h, rand) => {
  ctx.save()
  ctx.scale(w / DW, h / DH)

  const sky = ctx.createLinearGradient(0, 0, 0, 690)
  sky.addColorStop(0, '#081222')
  sky.addColorStop(0.28, '#15233d')
  sky.addColorStop(0.52, '#38405f')
  sky.addColorStop(0.74, '#7b657c')
  sky.addColorStop(0.9, '#c99080')
  sky.addColorStop(1, '#efb489')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1600, 1000)

  for (let i = 0; i < 80; i += 1) {
    ctx.fillStyle = `rgba(220,236,255,${0.06 + rand() * 0.22})`
    ctx.fillRect(rand() * 1600, rand() * 300, 1.2, 1.2)
  }

  for (let i = 0; i < 7; i += 1) {
    const y = 200 + rand() * 240
    const x = rand() * 1600
    puff(ctx, x, y, 150 + rand() * 220, 12 + rand() * 24, i % 2 ? '#4b4f72' : '#6b5a74', 0.28)
  }

  glow(ctx, 1130, 548, 420, '255,206,158', 0.42)
  glow(ctx, 1130, 548, 120, '255,232,204', 0.5)
  ctx.fillStyle = 'rgba(255,238,214,0.85)'
  ctx.beginPath()
  ctx.arc(1130, 548, 26, 0, TAU)
  ctx.fill()

  // 远处天际线
  for (let i = 0; i < 26; i += 1) {
    const bw = 34 + rand() * 84
    const bh = 32 + rand() * 120
    const x = i * 64 + rand() * 20 - 40
    ctx.fillStyle = `rgba(11,18,30,${0.6 + rand() * 0.3})`
    ctx.fillRect(x, 640 - bh, bw, bh + 30)
    if (rand() > 0.55) {
      ctx.fillStyle = `rgba(255,200,140,${0.18 + rand() * 0.3})`
      ctx.fillRect(x + bw * 0.25, 640 - bh + 14, 4, 4)
    }
  }

  // 图书馆主楼
  ctx.fillStyle = '#0d1723'
  ctx.fillRect(872, 402, 610, 268)
  ctx.fillStyle = '#101c2a'
  ctx.fillRect(842, 380, 670, 26)
  ctx.fillStyle = '#0a121c'
  ctx.fillRect(842, 380, 670, 6)
  ctx.fillStyle = 'rgba(160,180,210,0.16)'
  ctx.fillRect(842, 406, 670, 2)
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const lit = rand() > 0.38
      const x = 902 + col * 62
      const y = 436 + row * 44
      ctx.fillStyle = lit ? `rgba(255,203,135,${0.55 + rand() * 0.32})` : 'rgba(20,36,50,0.9)'
      ctx.fillRect(x, y, 38, 24)
      if (lit) {
        glow(ctx, x + 19, y + 12, 42, '255,196,128', 0.12)
      }
    }
  }
  ctx.fillStyle = 'rgba(255,220,170,0.7)'
  ctx.fillRect(1080, 610, 60, 60)
  ctx.fillStyle = 'rgba(10,16,24,0.9)'
  ctx.fillRect(1092, 622, 36, 48)
  ctx.fillStyle = 'rgba(255,216,166,0.35)'
  ctx.fillRect(854, 392, 646, 1)

  // 中景树冠
  const canopy = (cx: number, cy: number, scale: number) => {
    for (let i = 0; i < 16; i += 1) {
      const a = rand() * TAU
      const r = rand() * 150 * scale
      puff(
        ctx,
        cx + Math.cos(a) * r,
        cy + Math.sin(a) * r * 0.55,
        70 + rand() * 80,
        42 + rand() * 40,
        i % 3 === 0 ? '#0c1a1d' : '#061114',
        0.9,
      )
    }
  }
  canopy(-40, 480, 1.4)
  canopy(320, 560, 1.05)
  canopy(1560, 470, 1.3)
  canopy(1330, 585, 0.9)

  // 草地
  const ground = ctx.createLinearGradient(0, 640, 0, 1000)
  ground.addColorStop(0, '#101e23')
  ground.addColorStop(0.5, '#0a1519')
  ground.addColorStop(1, '#050b0e')
  ctx.fillStyle = ground
  ctx.fillRect(0, 636, 1600, 364)

  // 湿路
  const path = ctx.createLinearGradient(0, 646, 0, 1000)
  path.addColorStop(0, '#1b2534')
  path.addColorStop(0.45, '#131b27')
  path.addColorStop(1, '#080d14')
  ctx.fillStyle = path
  ctx.beginPath()
  ctx.moveTo(748, 646)
  ctx.lineTo(852, 646)
  ctx.lineTo(1210, 1000)
  ctx.lineTo(360, 1000)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(255,214,168,0.045)'
  for (let i = 0; i < 9; i += 1) {
    const y = 690 + i * 36
    const spread = 40 + i * 22
    ctx.beginPath()
    ctx.ellipse(800, y, spread, 3, 0, 0, TAU)
    ctx.fill()
  }

  // 路灯与反光
  const lamps = [
    { x: 700, y: 700, h: 92 },
    { x: 646, y: 770, h: 110 },
    { x: 566, y: 860, h: 134 },
    { x: 452, y: 980, h: 158 },
  ]
  lamps.forEach((lamp, index) => {
    const topY = lamp.y - lamp.h
    glow(ctx, lamp.x, topY, 150 + index * 20, '255,198,132', 0.22)
    ctx.strokeStyle = 'rgba(6,10,14,0.95)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(lamp.x, lamp.y)
    ctx.lineTo(lamp.x, topY + 10)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,238,204,0.95)'
    ctx.beginPath()
    ctx.arc(lamp.x, topY, 6 + index * 1.4, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,230,190,0.9)'
    ctx.beginPath()
    ctx.arc(lamp.x, topY, 3.4, 0, TAU)
    ctx.fill()

    const refl = ctx.createLinearGradient(lamp.x, lamp.y, lamp.x, lamp.y + 190)
    refl.addColorStop(0, 'rgba(255,190,120,0.24)')
    refl.addColorStop(0.5, 'rgba(255,170,100,0.08)')
    refl.addColorStop(1, 'rgba(255,160,90,0)')
    ctx.fillStyle = refl
    ctx.fillRect(lamp.x - 12, lamp.y, 24, 200)
  })

  // 湿润高光
  ctx.strokeStyle = 'rgba(180,200,230,0.12)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 14; i += 1) {
    const y = 720 + rand() * 260
    const x = 480 + rand() * 640
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 30 + rand() * 60, y + 2)
    ctx.stroke()
  }

  // 城市光斑
  for (let i = 0; i < 26; i += 1) {
    glow(ctx, 200 + rand() * 1200, 660 + rand() * 300, 8 + rand() * 26, '255,205,150', 0.05 + rand() * 0.08)
  }

  // 飞鸟
  ctx.strokeStyle = 'rgba(10,16,22,0.8)'
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i += 1) {
    const x = 330 + rand() * 360
    const y = 250 + rand() * 150
    ctx.beginPath()
    ctx.moveTo(x - 9, y)
    ctx.quadraticCurveTo(x - 4, y - 5, x, y)
    ctx.quadraticCurveTo(x + 4, y - 5, x + 9, y)
    ctx.stroke()
  }

  ctx.restore()
  finish(ctx, w, h, rand, '#6d7fb8')
}

/* ------------------------------------------------------------------ */
/* 02 · 海边长堤 · 暮色听浪                                            */
/* ------------------------------------------------------------------ */

const drawSea: Renderer = (ctx, w, h, rand) => {
  ctx.save()
  ctx.scale(w / DW, h / DH)

  const sky = ctx.createLinearGradient(0, 0, 0, 560)
  sky.addColorStop(0, '#171a38')
  sky.addColorStop(0.34, '#3f3055')
  sky.addColorStop(0.62, '#8c4f63')
  sky.addColorStop(0.84, '#d8776b')
  sky.addColorStop(1, '#f5b184')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1600, 1000)

  for (let i = 0; i < 9; i += 1) {
    const y = 120 + i * 44 + rand() * 20
    puff(ctx, rand() * 1600, y, 170 + rand() * 300, 8 + rand() * 16, i % 2 ? '#6a4560' : '#9a5a66', 0.3)
  }

  glow(ctx, 1000, 520, 430, '255,183,138', 0.45)
  glow(ctx, 1000, 520, 130, '255,225,190', 0.55)
  ctx.fillStyle = 'rgba(255,232,198,0.92)'
  ctx.beginPath()
  ctx.arc(1000, 520, 42, 0, TAU)
  ctx.fill()

  // 海
  const sea = ctx.createLinearGradient(0, 528, 0, 1000)
  sea.addColorStop(0, '#8f5f66')
  sea.addColorStop(0.18, '#5d4359')
  sea.addColorStop(0.55, '#343149')
  sea.addColorStop(1, '#181b2c')
  ctx.fillStyle = sea
  ctx.fillRect(0, 526, 1600, 474)

  const reflection = ctx.createLinearGradient(0, 528, 0, 940)
  reflection.addColorStop(0, 'rgba(255,205,150,0.62)')
  reflection.addColorStop(0.5, 'rgba(255,180,120,0.2)')
  reflection.addColorStop(1, 'rgba(255,150,100,0)')
  ctx.fillStyle = reflection
  ctx.beginPath()
  ctx.moveTo(968, 528)
  ctx.lineTo(1032, 528)
  ctx.lineTo(1160, 960)
  ctx.lineTo(840, 960)
  ctx.closePath()
  ctx.fill()

  for (let i = 0; i < 120; i += 1) {
    const t = rand()
    const y = 540 + t * 380
    const spread = 20 + t * 340
    const x = 1000 - spread / 2 + rand() * spread
    ctx.fillStyle = `rgba(255,214,168,${0.05 + (1 - t) * 0.24})`
    ctx.fillRect(x, y, 18 + rand() * (70 * (1 - t) + 10), 1.4)
  }

  ctx.strokeStyle = 'rgba(240,228,232,0.16)'
  for (let i = 0; i < 34; i += 1) {
    const y = 580 + rand() * 400
    const x = rand() * 1600
    ctx.lineWidth = 0.8 + rand() * 1.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 40, y - 3, x + 70 + rand() * 90, y)
    ctx.stroke()
  }

  // 远处灯塔
  glow(ctx, 1408, 486, 60, '255,214,150', 0.6)
  ctx.fillStyle = '#202234'
  ctx.beginPath()
  ctx.moveTo(1396, 524)
  ctx.lineTo(1401, 464)
  ctx.lineTo(1415, 464)
  ctx.lineTo(1420, 524)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,224,168,0.95)'
  ctx.beginPath()
  ctx.arc(1408, 460, 5, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(22,24,38,0.9)'
  ctx.fillRect(1390, 524, 38, 8)

  // 长堤
  const deck = ctx.createLinearGradient(0, 640, 0, 1000)
  deck.addColorStop(0, '#3a3b4c')
  deck.addColorStop(0.4, '#2a2b3a')
  deck.addColorStop(1, '#12141d')
  ctx.fillStyle = deck
  ctx.beginPath()
  ctx.moveTo(0, 872)
  ctx.lineTo(668, 628)
  ctx.lineTo(856, 700)
  ctx.lineTo(0, 1100)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#191b26'
  ctx.beginPath()
  ctx.moveTo(0, 872)
  ctx.lineTo(668, 628)
  ctx.lineTo(694, 662)
  ctx.lineTo(0, 968)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,206,168,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 872)
  ctx.lineTo(668, 628)
  ctx.stroke()

  // 铺装接缝
  ctx.strokeStyle = 'rgba(8,10,16,0.55)'
  ctx.lineWidth = 1.4
  for (let i = 0; i < 9; i += 1) {
    const t = i / 9
    const x = 40 + t * 600
    const y = 870 - t * 230
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 40 + t * 150, y + 34 + t * 46)
    ctx.stroke()
  }

  // 栏杆
  ctx.strokeStyle = 'rgba(6,8,12,0.94)'
  ctx.lineWidth = 3
  for (let i = 0; i < 12; i += 1) {
    const t = i / 12
    const x = 20 + t * 630
    const groundY = 868 - t * 236
    const postH = 98 - t * 46
    ctx.beginPath()
    ctx.moveTo(x, groundY)
    ctx.lineTo(x, groundY - postH)
    ctx.stroke()
  }
  ctx.lineWidth = 1.6
  for (let line = 0; line < 2; line += 1) {
    ctx.beginPath()
    ctx.moveTo(20, 770 - line * 26)
    ctx.lineTo(646, 632 - line * 22)
    ctx.stroke()
  }

  // 堤岸灯
  const lamps = [
    { x: 96, y: 868, h: 118 },
    { x: 322, y: 784, h: 96 },
    { x: 520, y: 706, h: 78 },
  ]
  lamps.forEach((lamp, index) => {
    const topY = lamp.y - lamp.h
    glow(ctx, lamp.x, topY, 110 - index * 18, '255,206,148', 0.3)
    ctx.strokeStyle = 'rgba(5,7,11,0.95)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(lamp.x, lamp.y)
    ctx.lineTo(lamp.x, topY)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,235,198,0.95)'
    ctx.beginPath()
    ctx.arc(lamp.x, topY, 5.5, 0, TAU)
    ctx.fill()
    const refl = ctx.createLinearGradient(lamp.x, lamp.y, lamp.x, lamp.y + 150)
    refl.addColorStop(0, 'rgba(255,190,130,0.22)')
    refl.addColorStop(1, 'rgba(255,170,110,0)')
    ctx.fillStyle = refl
    ctx.fillRect(lamp.x - 10, lamp.y, 20, 150)
  })

  // 浪花
  for (let i = 0; i < 60; i += 1) {
    const t = rand()
    const x = 690 + t * 470
    const y = 690 + t * 250 + rand() * 40
    ctx.fillStyle = `rgba(246,238,236,${0.05 + rand() * 0.22})`
    ctx.beginPath()
    ctx.ellipse(x, y, 6 + rand() * 26, 1.6 + rand() * 3, 0, 0, TAU)
    ctx.fill()
  }
  glow(ctx, 820, 760, 190, '235,225,225', 0.08)

  // 海鸟
  ctx.strokeStyle = 'rgba(14,16,24,0.85)'
  ctx.lineWidth = 2.2
  for (let i = 0; i < 5; i += 1) {
    const x = 240 + rand() * 780
    const y = 180 + rand() * 240
    const s = 7 + rand() * 8
    ctx.beginPath()
    ctx.moveTo(x - s, y)
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y)
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y)
    ctx.stroke()
  }

  // 前景虚化栏杆
  ctx.fillStyle = 'rgba(4,6,10,0.7)'
  ctx.fillRect(0, 0, 26, 1000)
  ctx.fillRect(1574, 0, 26, 1000)

  for (let i = 0; i < 22; i += 1) {
    glow(ctx, 100 + rand() * 1400, 620 + rand() * 330, 6 + rand() * 16, '255,214,170', 0.05 + rand() * 0.09)
  }

  ctx.restore()
  finish(ctx, w, h, rand, '#c47f86')
}

/* ------------------------------------------------------------------ */
/* 03 · 雨夜自习室 · 窗外霓虹                                          */
/* ------------------------------------------------------------------ */

const drawRainRoom: Renderer = (ctx, w, h, rand) => {
  ctx.save()
  ctx.scale(w / DW, h / DH)

  const wall = ctx.createLinearGradient(0, 0, 0, 1000)
  wall.addColorStop(0, '#05080b')
  wall.addColorStop(0.6, '#080d12')
  wall.addColorStop(1, '#04070a')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, 1600, 1000)

  // 窗外世界
  ctx.save()
  ctx.beginPath()
  ctx.rect(160, 116, 1280, 728)
  ctx.clip()

  const night = ctx.createLinearGradient(0, 116, 0, 700)
  night.addColorStop(0, '#081120')
  night.addColorStop(0.45, '#102039')
  night.addColorStop(1, '#1b2236')
  ctx.fillStyle = night
  ctx.fillRect(160, 116, 1280, 728)

  // 楼群
  for (let i = 0; i < 12; i += 1) {
    const bw = 80 + rand() * 130
    const bh = 150 + rand() * 300
    const x = 130 + i * 110
    ctx.fillStyle = `rgba(8,14,24,${0.82 + rand() * 0.16})`
    ctx.fillRect(x, 700 - bh, bw, bh)
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        if (rand() > 0.66) {
          ctx.fillStyle = rand() > 0.55 ? 'rgba(255,196,130,0.55)' : 'rgba(118,210,235,0.4)'
          ctx.fillRect(x + 12 + c * (bw / 4.4), 706 - bh + 20 + r * 32, 10, 12)
        }
      }
    }
  }

  // 霓虹招牌
  const neon = (x: number, y: number, nw: number, nh: number, color: string, strength: number) => {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 48
    ctx.fillStyle = color
    ctx.globalAlpha = strength
    ctx.fillRect(x, y, nw, nh)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 90
    ctx.fillRect(x + nw * 0.1, y + nh * 0.24, nw * 0.8, Math.max(2, nh * 0.14))
    ctx.restore()
    glow(ctx, x + nw / 2, y + nh / 2, nw * 0.9, color === '#ff5f9e' ? '255,95,158' : color === '#57dfff' ? '87,223,255' : '255,176,94', 0.16)
  }
  neon(812, 398, 250, 58, '#ff5f9e', 0.85)
  neon(1074, 454, 42, 190, '#57dfff', 0.75)
  neon(588, 500, 150, 40, '#ffb05e', 0.7)
  neon(940, 330, 96, 30, '#caa2ff', 0.55)

  // 湿街
  const street = ctx.createLinearGradient(0, 660, 0, 844)
  street.addColorStop(0, '#121a26')
  street.addColorStop(0.55, '#0c1119')
  street.addColorStop(1, '#070a0e')
  ctx.fillStyle = street
  ctx.fillRect(160, 660, 1280, 190)

  const streak = (x: number, color: string, sw: number) => {
    const g = ctx.createLinearGradient(0, 662, 0, 844)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 662, sw, 182)
  }
  streak(842, 'rgba(255,95,158,0.26)', 60)
  streak(1042, 'rgba(87,223,255,0.22)', 26)
  streak(620, 'rgba(255,176,94,0.18)', 44)
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(255,235,220,${0.05 + rand() * 0.16})`
    ctx.fillRect(240 + rand() * 1120, 690 + rand() * 130, 20 + rand() * 90, 1.4)
  }

  // 窗外的雨
  ctx.strokeStyle = 'rgba(190,214,236,0.2)'
  ctx.lineWidth = 1
  for (let i = 0; i < 140; i += 1) {
    const x = 170 + rand() * 1260
    const y = 120 + rand() * 650
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 4 - rand() * 4, y + 12 + rand() * 26)
    ctx.stroke()
  }

  ctx.restore()

  // 窗框
  ctx.fillStyle = '#05080b'
  ctx.fillRect(130, 86, 1340, 34)
  ctx.fillRect(130, 834, 1340, 44)
  ctx.fillRect(128, 84, 36, 800)
  ctx.fillRect(1436, 84, 36, 800)
  ctx.fillRect(552, 116, 18, 720)
  ctx.fillRect(1150, 116, 18, 720)
  ctx.fillRect(160, 474, 1280, 16)
  ctx.fillStyle = 'rgba(150,190,205,0.1)'
  ctx.fillRect(130, 86, 1340, 2)
  ctx.fillStyle = 'rgba(196,220,232,0.05)'
  ctx.fillRect(148, 116, 2, 718)

  // 玻璃雨珠
  for (let i = 0; i < 120; i += 1) {
    const x = 180 + rand() * 1240
    const y = 132 + rand() * 690
    const r = 2 + rand() * 5.5
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.45, 'rgba(190,220,235,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0.06)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
    if (rand() > 0.62) {
      ctx.strokeStyle = 'rgba(200,224,240,0.13)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + r * 0.2, y + r)
      ctx.lineTo(x + r * 0.2, y + r + 12 + rand() * 40)
      ctx.stroke()
    }
  }

  // 玻璃雾气
  const fog = ctx.createRadialGradient(800, 480, 380, 800, 480, 760)
  fog.addColorStop(0, 'rgba(190,210,220,0)')
  fog.addColorStop(1, 'rgba(190,210,220,0.09)')
  ctx.fillStyle = fog
  ctx.fillRect(160, 116, 1280, 728)

  // 窗台
  ctx.fillStyle = '#070b0f'
  ctx.fillRect(96, 866, 1420, 42)
  ctx.fillStyle = 'rgba(255,195,130,0.1)'
  ctx.fillRect(96, 866, 1420, 2)

  // 桌面暖光与静物
  glow(ctx, 120, 930, 470, '255,176,96', 0.3)
  glow(ctx, 190, 850, 150, '255,206,140', 0.24)

  ctx.save()
  ctx.translate(214, 860)
  ctx.rotate(-0.18)
  ctx.fillStyle = '#0a0d10'
  ctx.fillRect(0, 0, 300, 26)
  ctx.fillStyle = 'rgba(255,210,150,0.2)'
  ctx.fillRect(0, 0, 300, 2)
  ctx.fillRect(30, 8, 170, 1.4)
  ctx.fillRect(30, 14, 210, 1.2)
  ctx.restore()

  ctx.strokeStyle = 'rgba(10,12,15,0.95)'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(540, 950)
  ctx.lineTo(670, 918)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(660, 922)
  ctx.lineTo(690, 906)
  ctx.stroke()

  // 台灯灯罩
  ctx.fillStyle = '#0a0e11'
  ctx.beginPath()
  ctx.moveTo(60, 760)
  ctx.lineTo(230, 760)
  ctx.lineTo(196, 838)
  ctx.lineTo(96, 838)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,214,150,0.5)'
  ctx.fillRect(98, 834, 96, 4)
  glow(ctx, 146, 848, 90, '255,205,135', 0.3)

  ctx.restore()
  finish(ctx, w, h, rand, '#6e7bb5')
}

/* ------------------------------------------------------------------ */
/* 04 · 十月银杏道 · 午后微风                                          */
/* ------------------------------------------------------------------ */

const drawGinkgo: Renderer = (ctx, w, h, rand) => {
  ctx.save()
  ctx.scale(w / DW, h / DH)

  const sky = ctx.createLinearGradient(0, 0, 0, 720)
  sky.addColorStop(0, '#7fb0b9')
  sky.addColorStop(0.32, '#b8ccbe')
  sky.addColorStop(0.6, '#e8d49c')
  sky.addColorStop(0.82, '#f6c577')
  sky.addColorStop(1, '#edb463')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1600, 1000)

  glow(ctx, 1250, 150, 520, '255,244,205', 0.62)
  glow(ctx, 1250, 150, 180, '255,252,235', 0.7)

  for (let i = 0; i < 8; i += 1) {
    puff(ctx, 300 + rand() * 1100, 140 + rand() * 260, 150 + rand() * 260, 10 + rand() * 20, '#fdf1cf', 0.16)
  }

  // 远处树影
  ctx.fillStyle = 'rgba(88,72,40,0.32)'
  for (let i = 0; i < 24; i += 1) {
    const x = i * 70 + rand() * 30
    puff(ctx, x, 600 + rand() * 30, 60 + rand() * 60, 40 + rand() * 30, '#8b7137', 0.24)
  }

  // 地面
  const ground = ctx.createLinearGradient(0, 620, 0, 1000)
  ground.addColorStop(0, '#c29244')
  ground.addColorStop(0.4, '#a9772f')
  ground.addColorStop(1, '#5f3f1a')
  ctx.fillStyle = ground
  ctx.fillRect(0, 618, 1600, 382)
  glow(ctx, 900, 700, 620, '255,220,150', 0.2)

  // 小径
  const path = ctx.createLinearGradient(0, 640, 0, 1000)
  path.addColorStop(0, '#c9a15c')
  path.addColorStop(0.5, '#b5853f')
  path.addColorStop(1, '#7c5624')
  ctx.fillStyle = path
  ctx.beginPath()
  ctx.moveTo(768, 640)
  ctx.lineTo(840, 640)
  ctx.lineTo(1250, 1000)
  ctx.lineTo(240, 1000)
  ctx.closePath()
  ctx.fill()

  // 树干
  const trunk = (x: number, width: number, lean: number) => {
    ctx.fillStyle = '#38291b'
    ctx.beginPath()
    ctx.moveTo(x - width / 2, 700)
    ctx.quadraticCurveTo(x - width * 0.4, 470, x + lean * 0.4 - width * 0.34, 250)
    ctx.lineTo(x + lean * 0.4 + width * 0.2, 250)
    ctx.quadraticCurveTo(x + width * 0.5, 480, x + width / 2, 700)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(244,206,142,0.24)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + width * 0.2, 690)
    ctx.quadraticCurveTo(x + width * 0.22, 470, x + lean * 0.4 + width * 0.1, 260)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(20,14,8,0.6)'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 5; i += 1) {
      const y = 380 + rand() * 300
      ctx.beginPath()
      ctx.moveTo(x - width * 0.3, y)
      ctx.quadraticCurveTo(x, y + 8, x + width * 0.3, y - 4)
      ctx.stroke()
    }
  }

  const trees = [
    { x: 92, width: 120, lean: 60 },
    { x: 400, width: 92, lean: -30 },
    { x: 690, width: 58, lean: 20 },
    { x: 1010, width: 64, lean: -18 },
    { x: 1300, width: 96, lean: 40 },
    { x: 1540, width: 130, lean: -60 },
  ]
  trees.forEach((t) => trunk(t.x, t.width, t.lean))

  // 金色树冠
  const canopy = (cx: number, cy: number, spread: number) => {
    for (let i = 0; i < 44; i += 1) {
      const a = rand() * TAU
      const r = Math.pow(rand(), 0.6) * spread
      const palette = ['#e2ad45', '#efc65f', '#c98d2c', '#f4d77e', '#b27a26']
      puff(
        ctx,
        cx + Math.cos(a) * r,
        cy + Math.sin(a) * r * 0.62,
        18 + rand() * 44,
        14 + rand() * 34,
        palette[Math.floor(rand() * palette.length)],
        0.55 + rand() * 0.35,
      )
    }
  }
  canopy(90, 220, 380)
  canopy(420, 200, 330)
  canopy(1330, 190, 360)
  canopy(1580, 240, 380)
  canopy(760, 120, 300)

  // 逆光树叶边缘
  for (let i = 0; i < 60; i += 1) {
    const x = 700 + rand() * 620
    const y = 120 + rand() * 330
    ctx.fillStyle = `rgba(255,242,198,${0.1 + rand() * 0.4})`
    ctx.beginPath()
    ctx.arc(x, y, 1 + rand() * 4, 0, TAU)
    ctx.fill()
  }

  // 光柱
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 5; i += 1) {
    const g = ctx.createLinearGradient(1180, 140, 700 + i * 90, 820)
    g.addColorStop(0, 'rgba(255,246,210,0.2)')
    g.addColorStop(1, 'rgba(255,238,190,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(1160 + i * 30, 120)
    ctx.lineTo(1230 + i * 34, 160)
    ctx.lineTo(760 + i * 100, 900)
    ctx.lineTo(620 + i * 96, 900)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // 满地银杏叶
  const leafPalette = ['#e0aa3f', '#f0c75f', '#c3892a', '#f7df94', '#a96f1f', '#d99b35']
  for (let i = 0; i < 360; i += 1) {
    const t = rand()
    const y = 646 + Math.pow(t, 0.7) * 356
    const spread = 260 + t * 640
    const x = 800 + (rand() - 0.5) * spread * 2
    const size = 5 + t * 18
    ginkgoLeaf(
      ctx,
      x,
      y,
      size,
      rand() * TAU,
      leafPalette[Math.floor(rand() * leafPalette.length)],
      0.55 + rand() * 0.4,
    )
  }

  // 飘落的叶子
  for (let i = 0; i < 42; i += 1) {
    ginkgoLeaf(
      ctx,
      120 + rand() * 1360,
      120 + rand() * 660,
      6 + rand() * 14,
      rand() * TAU,
      '#ffd27a',
      0.5 + rand() * 0.4,
    )
  }

  // 长椅
  ctx.fillStyle = 'rgba(52,35,20,0.9)'
  ctx.fillRect(1060, 760, 190, 16)
  ctx.fillRect(1078, 776, 12, 54)
  ctx.fillRect(1210, 776, 12, 54)
  ctx.fillRect(1060, 722, 190, 11)
  ctx.fillRect(1074, 733, 10, 30)
  ctx.fillRect(1226, 733, 10, 30)

  // 远处人影
  ctx.fillStyle = 'rgba(58,42,26,0.5)'
  ctx.beginPath()
  ctx.ellipse(726, 690, 8, 19, 0.05, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(726, 664, 8, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(890, 700, 7, 16, -0.06, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(890, 679, 6.5, 0, TAU)
  ctx.fill()

  // 光圈与光尘
  for (let i = 0; i < 30; i += 1) {
    glow(ctx, 200 + rand() * 1300, 120 + rand() * 700, 5 + rand() * 22, '255,242,200', 0.05 + rand() * 0.12)
  }

  ctx.restore()
  finish(ctx, w, h, rand, '#d2a55e')
}

/* ------------------------------------------------------------------ */

const drawSydneySummer: Renderer = (ctx, w, h, rand) => {
  ctx.save()
  ctx.scale(w / DW, h / DH)
  const sky = ctx.createLinearGradient(0, 0, 0, 640)
  sky.addColorStop(0, '#124670')
  sky.addColorStop(0.45, '#4688b4')
  sky.addColorStop(0.82, '#e2ad84')
  sky.addColorStop(1, '#ffd9a4')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, DW, DH)
  glow(ctx, 1180, 440, 400, '255,218,162', 0.48)
  const shells: [number, number, number, number][] = [
    [760, 635, 195, 210],
    [905, 635, 170, 178],
    [1028, 635, 138, 138],
    [1160, 635, 155, 162],
    [1276, 635, 118, 114],
  ]
  shells.forEach(([sx, sy, sw, sh], idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#fff5e6' : '#f0d8be'
    ctx.beginPath()
    ctx.moveTo(sx - sw * 0.45, sy)
    ctx.quadraticCurveTo(sx - sw * 0.08, sy - sh * 0.92, sx + sw * 0.52, sy - sh)
    ctx.quadraticCurveTo(sx + sw * 0.42, sy - sh * 0.3, sx + sw * 0.35, sy)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 2
    ctx.stroke()
  })
  ctx.fillStyle = '#192a42'
  ctx.fillRect(680, 634, 720, 24)
  const sea = ctx.createLinearGradient(0, 650, 0, DH)
  sea.addColorStop(0, '#1f6282')
  sea.addColorStop(0.55, '#123e5e')
  sea.addColorStop(1, '#081b30')
  ctx.fillStyle = sea
  ctx.fillRect(0, 650, DW, 350)
  for (let i = 0; i < 85; i += 1) {
    ctx.fillStyle = rand() > 0.35 ? 'rgba(255,228,176,0.38)' : 'rgba(138,228,244,0.28)'
    ctx.fillRect(rand() * DW, 668 + rand() * 310, 26 + rand() * 88, 2.4)
  }
  ctx.restore()
  finish(ctx, w, h, rand, '#f2b880')
}

const drawObservatory: Renderer = (ctx, w, h, rand) => {
  ctx.save()
  ctx.scale(w / DW, h / DH)
  const sky = ctx.createLinearGradient(0, 0, 0, DH)
  sky.addColorStop(0, '#040916')
  sky.addColorStop(0.52, '#0d1d38')
  sky.addColorStop(1, '#1a3250')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, DW, DH)
  for (let i = 0; i < 320; i += 1) {
    const sx = rand() * DW
    const sy = rand() * 680
    const r = 0.7 + rand() * 2.1
    ctx.fillStyle = rand() > 0.8 ? '#ffe2b0' : '#d8ecff'
    ctx.globalAlpha = 0.25 + rand() * 0.75
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  glow(ctx, 820, 290, 420, '124,186,255', 0.22)
  // 几何山脊与白色天文台圆顶
  ctx.fillStyle = '#0b1424'
  ctx.beginPath()
  ctx.moveTo(0, 760)
  ctx.lineTo(420, 580)
  ctx.lineTo(940, 650)
  ctx.lineTo(1320, 560)
  ctx.lineTo(DW, 680)
  ctx.lineTo(DW, DH)
  ctx.lineTo(0, DH)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#d4dde8'
  ctx.beginPath()
  ctx.arc(1140, 575, 84, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#253852'
  ctx.fillRect(1056, 575, 168, 68)
  ctx.fillStyle = '#ffd796'
  ctx.fillRect(1118, 594, 42, 26)
  glow(ctx, 1139, 607, 70, '255,204,132', 0.42)
  ctx.restore()
  finish(ctx, w, h, rand, '#7fa8e8')
}

const RENDERERS: Record<string, Renderer> = {
  library: drawLibrary,
  sea: drawSea,
  rain: drawRainRoom,
  ginkgo: drawGinkgo,
  sydney: drawSydneySummer,
  observatory: drawObservatory,
}

export const VISION_PRESETS: VisionPreset[] = [
  {
    id: 'library',
    title: '图书馆归途 · 蓝调晚霞',
    sender: '阿遥',
    city: '南京',
    particles: 'firefly',
    ambience: 'library',
    tempC: 19,
    windLevel: 1,
    scentTag: '桂花与旧书页',
    essence: 'BLUE HOUR · 19:42',
    palette: '#8fa7ff',
    focus: [
      {
        id: 'library-f1',
        x: 0.682,
        y: 0.404,
        note: '图书馆的第七扇窗。去年冬天，我在这里等你等到闭馆。',
      },
      {
        id: 'library-f2',
        x: 0.318,
        y: 0.742,
        note: '每次走到这盏灯下，我都会放慢一点。像有人替我把夜色调暗了半格。',
      },
    ],
  },
  {
    id: 'sea',
    title: '海边长堤 · 暮色听浪',
    sender: '林岸',
    city: '青岛',
    particles: 'dust',
    ambience: 'ocean',
    tempC: 22,
    windLevel: 2,
    scentTag: '咸涩海风与晒干的毛巾',
    essence: 'TIDE LINE · 18:26',
    palette: '#ffb28a',
    focus: [
      {
        id: 'sea-f1',
        x: 0.626,
        y: 0.522,
        note: '太阳沉下去的那三分钟，浪会突然变得很轻。我一直觉得那是海在换气。',
      },
      {
        id: 'sea-f2',
        x: 0.342,
        y: 0.792,
        note: '我在这块石头上坐到过末班车。那天你没有来，海替我陪了很久。',
      },
    ],
  },
  {
    id: 'rain',
    title: '雨夜自习室 · 窗外霓虹',
    sender: '小满',
    city: '重庆',
    particles: 'rain',
    ambience: 'rain',
    tempC: 16,
    windLevel: 1,
    scentTag: '潮湿的粉笔灰与关东煮',
    essence: 'RAIN TRACE · 21:08',
    palette: '#ff9ec4',
    focus: [
      {
        id: 'rain-f1',
        x: 0.584,
        y: 0.462,
        note: '雨把整条街揉成了一块正在融化的霓虹。我把它留在这里，怕它明天就不见了。',
      },
      {
        id: 'rain-f2',
        x: 0.262,
        y: 0.796,
        note: '桌角的咖啡凉了，但我还不想回去。再坐十分钟，就十分钟。',
      },
    ],
  },
  {
    id: 'ginkgo',
    title: '十月银杏道 · 午后微风',
    sender: '陈见',
    city: '北京',
    particles: 'firefly',
    ambience: 'wind',
    tempC: 17,
    windLevel: 2,
    scentTag: '银杏果与晒暖的石阶',
    essence: 'OCTOBER LIGHT · 15:20',
    palette: '#ffd27a',
    focus: [
      {
        id: 'ginkgo-f1',
        x: 0.736,
        y: 0.282,
        note: '阳光从叶子背面透过来，整条路都是蜜的颜色。我想让你也尝一口。',
      },
      {
        id: 'ginkgo-f2',
        x: 0.352,
        y: 0.688,
        note: '每年十月，我都会来这里假装偶遇一个人。今年没有装，因为真的遇见了一场好天气。',
      },
    ],
  },
  {
    id: 'sydney',
    title: '悉尼海港 · 南半球盛夏',
    sender: '南风渡客',
    city: '悉尼',
    particles: 'dust',
    ambience: 'ocean',
    tempC: 28,
    windLevel: 2,
    scentTag: '盛夏海盐与微风',
    essence: 'SOUTHERN SUMMER · 18:40',
    palette: '#f2b880',
    focus: [
      {
        id: 'sydney-f1',
        x: 0.62,
        y: 0.54,
        note: '北半球正在下雪，我从地球另一边寄来 28°C 的盛夏晚风。',
      },
    ],
  },
  {
    id: 'observatory',
    title: '高山观星台 · 猎户座夜空',
    sender: '星图记录员',
    city: '拉萨',
    particles: 'dust',
    ambience: 'night',
    tempC: 3,
    windLevel: 1,
    scentTag: '高原寒夜与松木',
    essence: 'STAR DOME · 23:12',
    palette: '#9ac6ff',
    focus: [
      {
        id: 'obs-f1',
        x: 0.52,
        y: 0.28,
        note: '点击夜空就能连起你看到的星。今晚的银河离山顶很近。',
      },
    ],
  },
]

const imageCache = new Map<string, string>()
const thumbCache = new Map<string, string>()

function renderPreset(id: string, width: number, height: number, quality: number) {
  const preset = VISION_PRESETS.find((item) => item.id === id) ?? VISION_PRESETS[0]
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const render = RENDERERS[preset.id] ?? drawLibrary
  render(ctx, width, height, mulberry(seedOf(preset.id)))
  return canvas.toDataURL('image/jpeg', quality)
}

export function getPresetImage(id: string): string {
  const cached = imageCache.get(id)
  if (cached) return cached
  const url = renderPreset(id, 1600, 1000, 0.96)
  imageCache.set(id, url)
  return url
}

export function getPresetThumb(id: string): string {
  const cached = thumbCache.get(id)
  if (cached) return cached
  const url = renderPreset(id, 480, 300, 0.82)
  thumbCache.set(id, url)
  return url
}

export const PARTICLE_OPTIONS: { id: ParticleKind; label: string; english: string; dot: string }[] = [
  { id: 'rain', label: '雨丝', english: 'RAIN', dot: '#a9c8e6' },
  { id: 'firefly', label: '萤火', english: 'FIREFLY', dot: '#ffd27f' },
  { id: 'snow', label: '细雪', english: 'SNOW', dot: '#f4f7ff' },
  { id: 'dust', label: '光尘', english: 'DUST', dot: '#ffe3b8' },
  { id: 'none', label: '留白', english: 'NONE', dot: '#7d8c88' },
]

export const AMBIENCE_OPTIONS: { id: AmbientKind; label: string; english: string }[] = [
  { id: 'library', label: '图书馆翻书', english: 'LIBRARY' },
  { id: 'wind', label: '微风', english: 'BREEZE' },
  { id: 'rain', label: '夜雨', english: 'RAIN' },
  { id: 'snow', label: '落雪踏雪', english: 'SNOW' },
  { id: 'city', label: '城市街渡', english: 'CITY' },
  { id: 'ocean', label: '海浪', english: 'OCEAN' },
  { id: 'cicada', label: '夏夜蝉鸣', english: 'CICADA' },
  { id: 'night', label: '深夜静谧', english: 'NIGHT' },
  { id: 'none', label: '无环境声', english: 'SILENT' },
]

export function windLabel(level: number) {
  return ['无风', '微风', '清风', '长风'][Math.max(0, Math.min(3, Math.round(level)))]
}