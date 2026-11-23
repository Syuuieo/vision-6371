import type { VisionPacket } from '../types/vision'

const W = 1800
const H = 2300

const SERIF = '"Noto Serif SC","Songti SC","STSong",serif'
const MONO = '"JetBrains Mono","SFMono-Regular",Consolas,monospace'
const SANS = '"Space Grotesk","Noto Sans SC","PingFang SC",sans-serif'

export type PostcardTheme = 'twilight' | 'polaroid' | 'film' | 'letter'
export type PostcardTone = 'natural' | 'sunset' | 'twilight_film' | 'mono'

export interface PostcardOptions {
  theme: PostcardTheme
  tone: PostcardTone
  showWhisper: boolean
  showStamp: boolean
  shareCode?: string
  whisperText?: string
}

export const DEFAULT_POSTCARD_OPTIONS: PostcardOptions = {
  theme: 'twilight',
  tone: 'natural',
  showWhisper: true,
  showStamp: true,
}

export const POSTCARD_THEMES: { id: PostcardTheme; label: string; hint: string }[] = [
  { id: 'twilight', label: '暮靛星海', hint: '经典深空传感明信片' },
  { id: 'polaroid', label: '银盐拍立得', hint: '象牙相纸与手写寄语' },
  { id: 'film', label: '35mm 胶片', hint: '暗房齿孔与电影字幕' },
  { id: 'letter', label: '落日六号信笺', hint: '航空邮票与双栏手记' },
]

export const POSTCARD_TONES: { id: PostcardTone; label: string; cssFilter: string }[] = [
  { id: 'natural', label: '原片自然', cssFilter: '' },
  { id: 'sunset', label: '落日暖金', cssFilter: 'contrast(1.04) saturate(1.14) sepia(0.18) brightness(1.03)' },
  { id: 'twilight_film', label: '暮色胶片', cssFilter: 'contrast(1.08) saturate(0.92) hue-rotate(-8deg) brightness(0.96)' },
  { id: 'mono', label: '银盐黑白', cssFilter: 'grayscale(1) contrast(1.12) brightness(1.02)' },
]

const AMB_LABELS: Record<VisionPacket['ambience'], string> = {
  wind: '微风',
  rain: '夜雨',
  ocean: '海浪',
  cicada: '夏夜蝉鸣',
  night: '深夜静谧',
  none: '无环境声',
}

const WIND_LABELS = ['无风', '微风', '清风', '长风']

function hashOf(text: string) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rngFrom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      image.crossOrigin = 'anonymous'
    }
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('明信片图片加载失败'))
    image.src = src
  })
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function trackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): number {
  const previous = ctx.textAlign
  ctx.textAlign = 'left'
  let cursor = x
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + tracking
  }
  ctx.textAlign = previous
  return cursor - x - tracking
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  let width = 0
  for (const char of text) width += ctx.measureText(char).width + tracking
  return Math.max(0, width - tracking)
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  maxSize: number,
  maxWidth: number,
  minSize = 42,
) {
  let size = maxSize
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) return size
    size -= 4
  }
  ctx.font = `${weight} ${minSize}px ${family}`
  return minSize
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = ''
  for (const char of text) {
    if (ctx.measureText(`${out}${char}…`).width > maxWidth) break
    out += char
  }
  return `${out}…`
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const clean = text.trim()
  if (!clean) return []
  const lines: string[] = []
  let line = ''
  for (const char of clean) {
    if (ctx.measureText(line + char).width > maxWidth) {
      lines.push(line)
      line = char
      if (lines.length >= maxLines) {
        const last = lines[maxLines - 1]
        lines[maxLines - 1] = truncate(ctx, last, maxWidth - 18)
        return lines
      }
    } else {
      line += char
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function applyPhotoTone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  tone: PostcardTone,
) {
  if (tone === 'natural') return
  ctx.save()
  if (tone === 'sunset') {
    const warm = ctx.createLinearGradient(x, y, x + width, y + height)
    warm.addColorStop(0, 'rgba(255, 200, 128, 0.34)')
    warm.addColorStop(1, 'rgba(255, 134, 86, 0.24)')
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = warm
    ctx.fillRect(x, y, width, height)

    ctx.globalCompositeOperation = 'color'
    ctx.fillStyle = 'rgba(242, 184, 114, 0.14)'
    ctx.fillRect(x, y, width, height)
  } else if (tone === 'twilight_film') {
    const cool = ctx.createLinearGradient(x, y, x, y + height)
    cool.addColorStop(0, 'rgba(72, 134, 224, 0.34)')
    cool.addColorStop(0.68, 'rgba(42, 74, 148, 0.16)')
    cool.addColorStop(1, 'rgba(242, 190, 132, 0.2)')
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = cool
    ctx.fillRect(x, y, width, height)

    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = 'rgba(20, 34, 68, 0.16)'
    ctx.fillRect(x, y, width, height)
  } else if (tone === 'mono') {
    ctx.globalCompositeOperation = 'saturation'
    ctx.fillStyle = 'hsl(0, 0%, 0%)'
    ctx.fillRect(x, y, width, height)

    const silver = ctx.createLinearGradient(x, y, x + width, y + height)
    silver.addColorStop(0, 'rgba(255, 252, 244, 0.14)')
    silver.addColorStop(1, 'rgba(12, 18, 28, 0.22)')
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = silver
    ctx.fillRect(x, y, width, height)
  }
  ctx.restore()
}

function drawCoverWithTone(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  tone: PostcardTone,
) {
  const iw = image.naturalWidth || image.width || 1
  const ih = image.naturalHeight || image.height || 1
  ctx.save()
  if (radius > 0) {
    roundedPath(ctx, x, y, width, height, radius)
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.rect(x, y, width, height)
    ctx.clip()
  }
  const scale = Math.max(width / iw, height / ih)
  const drawWidth = iw * scale
  const drawHeight = ih * scale
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
  applyPhotoTone(ctx, x, y, width, height, tone)
  ctx.restore()
}

function drawGazePins(
  ctx: CanvasRenderingContext2D,
  packet: VisionPacket,
  px: number,
  py: number,
  pw: number,
  ph: number,
  pillBg = 'rgba(11,22,48,0.82)',
) {
  packet.focus.slice(0, 3).forEach((point, index) => {
    const fx = px + clamp(point.x, 0.04, 0.96) * pw
    const fy = py + clamp(point.y, 0.06, 0.94) * ph
    ctx.save()
    ctx.shadowColor = 'rgba(242,194,139,0.9)'
    ctx.shadowBlur = 24
    ctx.strokeStyle = 'rgba(255,226,189,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(fx, fy, 22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,226,189,0.32)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(fx, fy, 32, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,248,238,0.96)'
    ctx.beginPath()
    ctx.arc(fx, fy, 4.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const label = `0${index + 1}`
    ctx.font = `500 15px ${MONO}`
    const labelWidth = 40
    roundedPath(ctx, fx + 28, fy - 13, labelWidth, 26, 13)
    ctx.fillStyle = pillBg
    ctx.fill()
    ctx.strokeStyle = 'rgba(242,194,139,0.48)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,244,226,0.94)'
    ctx.fillText(label, fx + 28 + labelWidth / 2, fy + 1)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  })
}

function drawPostmarkStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  city: string,
  dateShort: string,
  code: string,
  color: string,
  softColor: string,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.24)

  // 外环与内环
  ctx.strokeStyle = color
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.arc(0, 0, 102, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = softColor
  ctx.lineWidth = 1.4
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.arc(0, 0, 92, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = softColor
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, 72, 0, Math.PI * 2)
  ctx.stroke()

  // 航空波浪邮戳线
  ctx.strokeStyle = softColor
  ctx.lineWidth = 2
  for (let line = -1; line <= 1; line += 1) {
    const oy = line * 22
    ctx.beginPath()
    for (let sx = 88; sx <= 198; sx += 11) {
      const waveY = oy + Math.sin((sx - 88) * 0.14) * 5.5
      if (sx === 88) ctx.moveTo(sx, waveY)
      else ctx.lineTo(sx, waveY)
    }
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = softColor
  ctx.font = `500 12px ${MONO}`
  ctx.fillText('EARTH SURFACE', 0, -45)

  ctx.fillStyle = color
  ctx.font = `600 28px ${SERIF}`
  ctx.fillText(truncate(ctx, city || '地球表面', 120), 0, -4)

  ctx.fillStyle = softColor
  ctx.font = `500 13px ${MONO}`
  ctx.fillText(dateShort, 0, 30)
  ctx.font = `400 11px ${MONO}`
  ctx.fillText(`6371KM · ${code}`, 0, 50)

  ctx.restore()
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  ctx.font = `400 15px ${MONO}`
  const labelWidth = ctx.measureText(label).width
  ctx.font = `500 21px ${SANS}`
  const valueWidth = ctx.measureText(value).width
  const width = 26 + labelWidth + 16 + valueWidth + 26
  const height = 50
  roundedPath(ctx, x, y, width, height, 25)
  ctx.fillStyle = 'rgba(242,194,139,0.06)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(242,194,139,0.24)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(242,194,139,0.72)'
  ctx.font = `400 15px ${MONO}`
  ctx.fillText(label, x + 26, y + height / 2 + 1)
  ctx.fillStyle = 'rgba(255,248,238,0.9)'
  ctx.font = `500 21px ${SANS}`
  ctx.fillText(value, x + 26 + labelWidth + 16, y + height / 2 + 1)
  ctx.textBaseline = 'alphabetic'
  return width
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  accent = 'rgba(242,194,139,0.85)',
) {
  const rand = rngFrom(seed)
  const points: { x: number; y: number }[] = []
  let value = 0
  let velocity = 0
  const count = 190
  for (let i = 0; i <= count; i += 1) {
    velocity += (rand() - 0.5) * 0.14
    velocity *= 0.9
    value = clamp(value + velocity, -1, 1)
    const envelope = Math.sin((i / count) * Math.PI) * 0.75 + 0.25
    points.push({
      x: x + (i / count) * width,
      y: y + height / 2 + value * height * 0.34 * envelope,
    })
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(242,194,139,0.1)'
  ctx.lineWidth = 1
  for (let i = 0; i < 7; i += 1) {
    const gy = y + (i / 6) * height
    ctx.beginPath()
    ctx.moveTo(x, gy)
    ctx.lineTo(x + width, gy)
    ctx.stroke()
  }

  const trace = () => {
    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
  }

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  trace()
  ctx.strokeStyle = 'rgba(242,194,139,0.14)'
  ctx.lineWidth = 10
  ctx.stroke()
  trace()
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0)
  gradient.addColorStop(0, 'rgba(242,194,139,0.4)')
  gradient.addColorStop(0.45, 'rgba(255,226,189,0.94)')
  gradient.addColorStop(1, 'rgba(154,208,255,0.6)')
  ctx.strokeStyle = gradient
  ctx.lineWidth = 2.4
  ctx.stroke()

  ctx.fillStyle = accent
  const last = points[points.length - 1]
  ctx.beginPath()
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateShort(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

export function visionCode(id: string) {
  const hash = hashOf(id).toString(36).toUpperCase()
  return `VE-${hash.slice(-4).padStart(4, '0')}`
}

export function visionCoordinates(city: string) {
  const hash = hashOf(city || 'earth')
  const lat = 20 + (hash % 2500) / 100
  const lon = 74 + ((hash >>> 8) % 5100) / 100
  return `${lat.toFixed(1)}°N / ${lon.toFixed(1)}°E`
}

function drawTwilightPostcard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  packet: VisionPacket,
  options: PostcardOptions,
) {
  const code = options.shareCode?.trim().toUpperCase() || visionCode(packet.id)
  const signal = 0.86 + ((hashOf(packet.id) % 120) / 1000)
  const rand = rngFrom(hashOf(`${packet.id}-twilight`))
  const whisper = options.showWhisper ? (options.whisperText?.trim() || '') : ''

  const background = ctx.createLinearGradient(0, 0, W * 0.6, H)
  background.addColorStop(0, '#0b1630')
  background.addColorStop(0.55, '#102042')
  background.addColorStop(1, '#091122')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  const glowA = ctx.createRadialGradient(280, 180, 0, 280, 180, 1100)
  glowA.addColorStop(0, 'rgba(72,130,210,0.42)')
  glowA.addColorStop(0.55, 'rgba(32,68,128,0.18)')
  glowA.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glowA
  ctx.fillRect(0, 0, W, H)

  const glowB = ctx.createRadialGradient(1660, 1980, 0, 1660, 1980, 1000)
  glowB.addColorStop(0, 'rgba(242,194,139,0.22)')
  glowB.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glowB
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,226,189,0.035)'
  ctx.lineWidth = 1
  for (let gx = 100; gx < W; gx += 92) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, H)
    ctx.stroke()
  }
  for (let gy = 100; gy < H; gy += 92) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }

  for (let i = 0; i < 3600; i += 1) {
    const tone = rand() > 0.5 ? '255,255,255' : '0,0,0'
    ctx.fillStyle = `rgba(${tone},${0.015 + rand() * 0.025})`
    ctx.fillRect(rand() * W, rand() * H, 1.2, 1.2)
  }

  roundedPath(ctx, 68, 68, W - 136, H - 136, 62)
  ctx.strokeStyle = 'rgba(242,194,139,0.22)'
  ctx.lineWidth = 2
  ctx.stroke()
  roundedPath(ctx, 84, 84, W - 168, H - 168, 50)
  ctx.strokeStyle = 'rgba(242,194,139,0.07)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 页眉
  ctx.fillStyle = 'rgba(242,194,139,0.78)'
  ctx.font = `400 22px ${MONO}`
  trackedText(ctx, 'VISION 6371 · POST HER EYES', 150, 148, 5)

  ctx.fillStyle = 'rgba(255,244,226,0.45)'
  ctx.font = `400 19px ${MONO}`
  const serial = `No. ${code} / ${options.shareCode ? 'EARTH RADIO' : 'LOCAL SEAL'}`
  trackedText(ctx, serial, 1650 - trackedWidth(ctx, serial, 4), 148, 4)

  const hairline = ctx.createLinearGradient(150, 0, 1650, 0)
  hairline.addColorStop(0, 'rgba(242,194,139,0)')
  hairline.addColorStop(0.2, 'rgba(242,194,139,0.36)')
  hairline.addColorStop(0.8, 'rgba(242,194,139,0.22)')
  hairline.addColorStop(1, 'rgba(242,194,139,0)')
  ctx.fillStyle = hairline
  ctx.fillRect(150, 180, 1500, 1)

  // 标题
  const titleSize = fitFont(ctx, packet.title, SERIF, 600, 82, 1420)
  ctx.font = `600 ${titleSize}px ${SERIF}`
  ctx.fillStyle = 'rgba(255,248,238,0.96)'
  ctx.shadowColor = 'rgba(242,194,139,0.22)'
  ctx.shadowBlur = 30
  ctx.fillText(packet.title, 150, 294)
  ctx.shadowBlur = 0

  ctx.font = `400 19px ${MONO}`
  ctx.fillStyle = 'rgba(232,224,210,0.48)'
  trackedText(ctx, `${packet.city} · 地球表面 · ${formatDate(packet.createdAt)}`, 152, 340, 3.2)

  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(242,194,139,0.42)'
  const seal = 'SEALED VISION / 1 OF 1'
  trackedText(ctx, seal, 1650 - trackedWidth(ctx, seal, 3.2), 340, 3.2)

  // 照片区
  const px = 150
  const py = 376
  const pw = 1500
  const ph = 890
  drawCoverWithTone(ctx, image, px, py, pw, ph, 26, options.tone)

  ctx.save()
  roundedPath(ctx, px, py, pw, ph, 26)
  ctx.clip()

  const shade = ctx.createLinearGradient(0, py, 0, py + ph)
  shade.addColorStop(0, 'rgba(6,11,24,0.32)')
  shade.addColorStop(0.26, 'rgba(6,11,24,0)')
  shade.addColorStop(0.66, 'rgba(6,11,24,0)')
  shade.addColorStop(1, 'rgba(6,11,24,0.74)')
  ctx.fillStyle = shade
  ctx.fillRect(px, py, pw, ph)

  ctx.strokeStyle = 'rgba(255,226,189,0.68)'
  ctx.lineWidth = 3
  const inset = 24
  const arm = 54
  const corners = [
    [px + inset, py + inset, 1, 1],
    [px + pw - inset, py + inset, -1, 1],
    [px + inset, py + ph - inset, 1, -1],
    [px + pw - inset, py + ph - inset, -1, -1],
  ] as const
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy + dy * arm)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + dx * arm, cy)
    ctx.stroke()
  })

  ctx.fillStyle = 'rgba(242,194,139,0.92)'
  ctx.beginPath()
  ctx.arc(px + 46, py + 46, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(255,244,226,0.78)'
  trackedText(ctx, 'SENSORY WINDOW · LIVE', px + 64, py + 51, 3)

  ctx.font = `400 14px ${MONO}`
  ctx.fillStyle = 'rgba(255,244,226,0.52)'
  const focusCount = `${packet.focus.length} GAZE POINTS`
  trackedText(ctx, focusCount, px + pw - 46 - trackedWidth(ctx, focusCount, 2.6), py + 51, 2.6)

  drawGazePins(ctx, packet, px, py, pw, ph)

  ctx.font = `600 40px ${SERIF}`
  ctx.fillStyle = 'rgba(255,248,238,0.96)'
  ctx.fillText(packet.city, px + 42, py + ph - 84)
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(255,244,226,0.62)'
  trackedText(ctx, `${formatDate(packet.createdAt)} · EARTH SURFACE`, px + 44, py + ph - 52, 2.4)

  ctx.font = `400 13px ${MONO}`
  ctx.fillStyle = 'rgba(242,194,139,0.58)'
  const linkText = `LINK ${signal.toFixed(2)}`
  trackedText(ctx, linkText, px + pw - 44 - trackedWidth(ctx, linkText, 2), py + ph - 52, 2)
  ctx.restore()

  // 五感胶囊
  const chips: [string, string][] = [
    ['TEMP', `${packet.tempC}°C`],
    ['WIND', `${WIND_LABELS[clamp(Math.round(packet.windLevel), 0, 3)]} · L${clamp(Math.round(packet.windLevel), 0, 3)}`],
    ['SCENT', packet.scentTag.trim() || '未命名气味'],
    ['AUDIO', packet.voice ? `${AMB_LABELS[packet.ambience]} + 原声` : AMB_LABELS[packet.ambience]],
  ]
  let chipX = 150
  let chipY = 1306
  ctx.font = `500 21px ${SANS}`
  chips.forEach(([label, value]) => {
    const approx = 26 + label.length * 9.5 + 16 + Math.min(value.length * 21, 520) + 26
    if (chipX + approx > 1650) {
      chipX = 150
      chipY += 62
    }
    chipX += drawChip(ctx, chipX, chipY, label, truncate(ctx, value, 520)) + 14
    ctx.font = `500 21px ${SANS}`
  })

  // 信号波形
  drawWaveform(ctx, 150, 1424, 1500, 92, hashOf(packet.id))
  ctx.font = `400 13px ${MONO}`
  ctx.fillStyle = 'rgba(242,194,139,0.45)'
  trackedText(ctx, 'NEUTRINO SIGNAL / LIVE TRACE', 152, 1412, 2.6)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,226,189,0.68)'
  ctx.font = `400 17px ${MONO}`
  ctx.fillText(`SIGNAL ${signal.toFixed(3)}`, 1650, 1412)
  ctx.textAlign = 'left'

  // 目光细语
  ctx.font = `500 28px ${SERIF}`
  ctx.fillStyle = 'rgba(255,248,238,0.92)'
  ctx.fillText('她留下的目光', 150, 1582)
  ctx.font = `400 13px ${MONO}`
  ctx.fillStyle = 'rgba(242,194,139,0.48)'
  const gazeLabel = `GAZE NOTES / ${packet.focus.length}`
  trackedText(ctx, gazeLabel, 1650 - trackedWidth(ctx, gazeLabel, 2.4), 1582, 2.4)

  if (packet.focus.length === 0) {
    ctx.font = `300 23px ${SERIF}`
    ctx.fillStyle = 'rgba(232,224,210,0.4)'
    ctx.fillText('她还没有在这里留下目光。', 152, 1638)
  } else {
    packet.focus.slice(0, 3).forEach((point, index) => {
      const y = 1636 + index * 56
      ctx.strokeStyle = 'rgba(242,194,139,0.28)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(168, y - 8, 15, 0, Math.PI * 2)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.font = `500 13px ${MONO}`
      ctx.fillStyle = 'rgba(255,226,189,0.8)'
      ctx.fillText(`0${index + 1}`, 168, y - 3)
      ctx.textAlign = 'left'
      ctx.font = `300 24px ${SERIF}`
      ctx.fillStyle = 'rgba(246,238,224,0.84)'
      const note = point.note.trim() || '她在这里停了一会儿，没有说话。'
      ctx.fillText(truncate(ctx, note, 1340), 204, y)
    })
  }

  // 来自地心的林微低语条
  if (whisper) {
    roundedPath(ctx, 150, 1808, 1220, 108, 22)
    ctx.fillStyle = 'rgba(242,194,139,0.065)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(242,194,139,0.22)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.font = `500 17px ${SERIF}`
    ctx.fillStyle = 'rgba(242,194,139,0.88)'
    ctx.fillText('来自地心的回响 · 林微', 180, 1844)
    ctx.font = `300 22px ${SERIF}`
    ctx.fillStyle = 'rgba(255,244,224,0.9)'
    const lines = wrapLines(ctx, whisper, 1140, 1)
    if (lines[0]) ctx.fillText(lines[0], 180, 1888)
  }

  // 页脚
  const footerLine = ctx.createLinearGradient(150, 0, 1650, 0)
  footerLine.addColorStop(0, 'rgba(242,194,139,0.32)')
  footerLine.addColorStop(1, 'rgba(242,194,139,0.04)')
  ctx.fillStyle = footerLine
  ctx.fillRect(150, 1954, 1500, 1)

  ctx.font = `500 32px ${SERIF}`
  ctx.fillStyle = 'rgba(255,248,238,0.86)'
  ctx.fillText(`寄自 ${packet.city} · ${packet.sender}`, 150, 2016)

  if (!options.showStamp) {
    ctx.textAlign = 'right'
    ctx.font = `400 16px ${MONO}`
    ctx.fillStyle = 'rgba(232,224,210,0.48)'
    ctx.fillText(visionCoordinates(packet.city), 1650, 2014)
    ctx.textAlign = 'left'
  }
  ctx.font = `300 23px ${SERIF}`
  ctx.fillStyle = 'rgba(236,226,210,0.5)'
  ctx.fillText('把这一秒的风景，寄给另一个人。', 150, 2064)

  ctx.font = `400 12px ${MONO}`
  ctx.fillStyle = 'rgba(242,194,139,0.38)'
  trackedText(ctx, `OTA / ${code} · ${visionCoordinates(packet.city)}`, 150, 2172, 2.2)
  ctx.fillStyle = 'rgba(232,224,210,0.34)'
  const brandLabel = '视界 6371 · TAKE HER EYES'
  trackedText(ctx, brandLabel, 1650 - trackedWidth(ctx, brandLabel, 2), 2172, 2)

  if (options.showStamp) {
    drawPostmarkStamp(
      ctx,
      1465,
      1935,
      packet.city,
      formatDateShort(packet.createdAt),
      code,
      'rgba(242, 194, 139, 0.78)',
      'rgba(242, 194, 139, 0.44)',
    )
  }
}

function drawPolaroidPostcard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  packet: VisionPacket,
  options: PostcardOptions,
) {
  const code = options.shareCode?.trim().toUpperCase() || visionCode(packet.id)
  const rand = rngFrom(hashOf(`${packet.id}-polaroid`))
  const wind = WIND_LABELS[clamp(Math.round(packet.windLevel), 0, 3)]
  const whisper = options.showWhisper ? (options.whisperText?.trim() || '') : ''

  // 暖调象牙白银盐相纸
  const paper = ctx.createLinearGradient(0, 0, W, H)
  paper.addColorStop(0, '#f7f1e5')
  paper.addColorStop(0.55, '#f3ecde')
  paper.addColorStop(1, '#ede4d2')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)

  // 相纸细腻纸纹
  for (let i = 0; i < 4200; i += 1) {
    const tone = rand() > 0.5 ? '120,98,66' : '255,255,255'
    ctx.fillStyle = `rgba(${tone},${0.015 + rand() * 0.025})`
    ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4)
  }

  roundedPath(ctx, 56, 56, W - 112, H - 112, 24)
  ctx.strokeStyle = 'rgba(42, 34, 24, 0.1)'
  ctx.lineWidth = 2
  ctx.stroke()

  // 顶部编号条
  ctx.fillStyle = 'rgba(48, 38, 28, 0.5)'
  ctx.font = `500 17px ${MONO}`
  trackedText(ctx, 'INSTANT ARCHIVE // VISION 6371', 124, 118, 3.6)
  const rightTop = `No. ${code}`
  trackedText(ctx, rightTop, 1676 - trackedWidth(ctx, rightTop, 3.2), 118, 3.2)

  // 相框外影与画面
  const px = 124
  const py = 152
  const pw = 1552
  const ph = 1320

  ctx.save()
  ctx.shadowColor = 'rgba(34, 24, 12, 0.16)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#faf6ee'
  roundedPath(ctx, px - 12, py - 12, pw + 24, ph + 24, 14)
  ctx.fill()
  ctx.restore()

  drawCoverWithTone(ctx, image, px, py, pw, ph, 10, options.tone)
  ctx.save()
  roundedPath(ctx, px, py, pw, ph, 10)
  ctx.clip()
  drawGazePins(ctx, packet, px, py, pw, ph)
  ctx.restore()

  // 相纸下方留白手写区
  const titleSize = fitFont(ctx, packet.title, SERIF, 600, 74, 1340, 40)
  ctx.font = `600 ${titleSize}px ${SERIF}`
  ctx.fillStyle = '#1f232c'
  ctx.fillText(packet.title, 128, 1590)

  ctx.font = `400 22px ${MONO}`
  ctx.fillStyle = 'rgba(31, 35, 44, 0.56)'
  const metaLine = `${packet.city} · ${packet.tempC}°C · ${wind}${packet.scentTag ? ` · ${packet.scentTag}` : ''} · ${formatDateShort(packet.createdAt)}`
  ctx.fillText(truncate(ctx, metaLine, 1420), 130, 1646)

  ctx.fillStyle = 'rgba(31, 35, 44, 0.12)'
  ctx.fillRect(128, 1684, 1544, 1.5)

  // 留言列表（左侧）
  let cursorY = 1746
  if (packet.focus.length === 0) {
    ctx.font = `300 26px ${SERIF}`
    ctx.fillStyle = 'rgba(31, 35, 44, 0.45)'
    ctx.fillText('这一刻没有留下文字，风替她把画面记住了。', 128, cursorY)
    cursorY += 56
  } else {
    packet.focus.slice(0, 3).forEach((point, index) => {
      const note = point.note.trim() || '她在这里停了一会儿，没有说话。'
      ctx.font = `500 15px ${MONO}`
      ctx.fillStyle = '#b44f3c'
      ctx.fillText(`0${index + 1}`, 128, cursorY)
      ctx.font = `400 26px ${SERIF}`
      ctx.fillStyle = 'rgba(28, 32, 42, 0.88)'
      ctx.fillText(truncate(ctx, note, 1140), 178, cursorY)
      cursorY += 54
    })
  }

  if (whisper) {
    const wy = Math.max(cursorY + 20, 1940)
    roundedPath(ctx, 128, wy, 1080, 104, 16)
    ctx.fillStyle = 'rgba(180, 79, 60, 0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(180, 79, 60, 0.2)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.font = `500 17px ${SERIF}`
    ctx.fillStyle = '#a84432'
    ctx.fillText('林微 · 来自地心的回响', 156, wy + 34)
    ctx.font = `300 22px ${SERIF}`
    ctx.fillStyle = 'rgba(31, 35, 44, 0.85)'
    const lines = wrapLines(ctx, whisper, 1020, 1)
    if (lines[0]) ctx.fillText(lines[0], 156, wy + 76)
  }

  // 页脚签名
  ctx.font = `500 30px ${SERIF}`
  ctx.fillStyle = '#1f232c'
  ctx.fillText(`寄自 ${packet.city} · ${packet.sender}`, 128, 2142)

  ctx.font = `400 14px ${MONO}`
  ctx.fillStyle = 'rgba(31, 35, 44, 0.45)'
  ctx.fillText(`${visionCoordinates(packet.city)} · 6,371.4 KM BELOW`, 128, 2184)

  ctx.textAlign = 'right'
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(31, 35, 44, 0.42)'
  ctx.fillText('视界 6371 · TAKE HER EYES', 1672, 2184)
  ctx.textAlign = 'left'

  if (options.showStamp) {
    drawPostmarkStamp(
      ctx,
      1460,
      1970,
      packet.city,
      formatDateShort(packet.createdAt),
      code,
      'rgba(180, 72, 54, 0.84)',
      'rgba(180, 72, 54, 0.48)',
    )
  }
}

function drawFilmPostcard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  packet: VisionPacket,
  options: PostcardOptions,
) {
  const code = options.shareCode?.trim().toUpperCase() || visionCode(packet.id)
  const wind = WIND_LABELS[clamp(Math.round(packet.windLevel), 0, 3)]
  const whisper = options.showWhisper ? (options.whisperText?.trim() || '') : ''

  // 暗房胶片黑底
  ctx.fillStyle = '#090b10'
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W / 2, 720, 100, W / 2, 720, 960)
  glow.addColorStop(0, 'rgba(242, 194, 139, 0.09)')
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // 左右 35mm 齿孔
  ctx.fillStyle = '#181c26'
  ctx.strokeStyle = 'rgba(255, 226, 189, 0.14)'
  ctx.lineWidth = 1.2
  for (let y = 74; y < H - 80; y += 92) {
    roundedPath(ctx, 42, y, 54, 40, 8)
    ctx.fill()
    ctx.stroke()
    roundedPath(ctx, W - 96, y, 54, 40, 8)
    ctx.fill()
    ctx.stroke()
  }

  // 胶片边码
  ctx.fillStyle = 'rgba(242, 194, 139, 0.72)'
  ctx.font = `500 18px ${MONO}`
  trackedText(ctx, 'VISION 6371 · SAFETY FILM 5219', 150, 114, 3.6)
  const rightCode = `FRAME ${code} · 35MM`
  trackedText(ctx, rightCode, 1650 - trackedWidth(ctx, rightCode, 3.2), 114, 3.2)

  // 主画面（35mm 电影画幅框）
  const px = 150
  const py = 158
  const pw = 1500
  const ph = 1040
  drawCoverWithTone(ctx, image, px, py, pw, ph, 8, options.tone)

  ctx.save()
  roundedPath(ctx, px, py, pw, ph, 8)
  ctx.clip()
  const vignette = ctx.createLinearGradient(0, py, 0, py + ph)
  vignette.addColorStop(0, 'rgba(5,7,12,0.3)')
  vignette.addColorStop(0.5, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(5,7,12,0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(px, py, pw, ph)
  drawGazePins(ctx, packet, px, py, pw, ph)
  ctx.restore()

  ctx.strokeStyle = 'rgba(242, 194, 139, 0.28)'
  ctx.lineWidth = 2
  roundedPath(ctx, px, py, pw, ph, 8)
  ctx.stroke()

  // 电影居中标题与金字字幕
  ctx.textAlign = 'center'
  const titleSize = fitFont(ctx, packet.title, SERIF, 600, 68, 1380, 38)
  ctx.font = `600 ${titleSize}px ${SERIF}`
  ctx.fillStyle = '#fff7ea'
  ctx.fillText(packet.title, W / 2, 1320)

  ctx.font = `400 19px ${MONO}`
  ctx.fillStyle = 'rgba(242, 194, 139, 0.78)'
  ctx.fillText(
    `${packet.city} · ${packet.tempC}°C · ${wind} · ${formatDate(packet.createdAt)}`,
    W / 2,
    1376,
  )

  if (whisper) {
    ctx.font = `400 29px ${SERIF}`
    ctx.fillStyle = '#f5d08a'
    const lines = wrapLines(ctx, whisper, 1320, 2)
    lines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, 1468 + idx * 46)
    })
  }

  ctx.textAlign = 'left'

  // 目光手记（三行居中式卡槽）
  const notesTop = whisper ? 1608 : 1480
  if (packet.focus.length > 0) {
    packet.focus.slice(0, 3).forEach((point, idx) => {
      const y = notesTop + idx * 54
      ctx.font = `500 15px ${MONO}`
      ctx.fillStyle = 'rgba(242, 194, 139, 0.75)'
      ctx.fillText(`0${idx + 1}`, 190, y)
      ctx.font = `300 24px ${SERIF}`
      ctx.fillStyle = 'rgba(246, 240, 228, 0.86)'
      ctx.fillText(truncate(ctx, point.note.trim() || '她在这里停了一会儿，没有说话。', 1240), 240, y)
    })
  } else {
    ctx.textAlign = 'center'
    ctx.font = `300 24px ${SERIF}`
    ctx.fillStyle = 'rgba(232, 224, 210, 0.42)'
    ctx.fillText('没有附加旁白，让镜头自己说话。', W / 2, notesTop + 26)
    ctx.textAlign = 'left'
  }

  // 波形条
  drawWaveform(ctx, 180, 1824, 1440, 82, hashOf(`${packet.id}-film`))

  // 页脚暗房印记
  ctx.fillStyle = 'rgba(242, 194, 139, 0.22)'
  ctx.fillRect(150, 1966, 1500, 1)

  ctx.font = `500 30px ${SERIF}`
  ctx.fillStyle = 'rgba(255, 248, 238, 0.88)'
  ctx.fillText(`寄自 ${packet.city} · ${packet.sender}`, 150, 2032)

  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(232, 224, 210, 0.5)'
  ctx.fillText(`${visionCoordinates(packet.city)} · ${AMB_LABELS[packet.ambience]}${packet.voice ? ' + 原声' : ''}`, 150, 2078)

  ctx.fillStyle = 'rgba(242, 194, 139, 0.55)'
  ctx.font = `400 15px ${MONO}`
  trackedText(ctx, `REEL ${code} · 6,371.4 KM`, 150, 2180, 2.8)
  const brand = '视界 6371 · TAKE HER EYES'
  trackedText(ctx, brand, 1650 - trackedWidth(ctx, brand, 2.2), 2180, 2.2)

  if (options.showStamp) {
    drawPostmarkStamp(
      ctx,
      1465,
      2020,
      packet.city,
      formatDateShort(packet.createdAt),
      code,
      'rgba(242, 194, 139, 0.78)',
      'rgba(242, 194, 139, 0.44)',
    )
  }
}

function drawLetterPostcard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  packet: VisionPacket,
  options: PostcardOptions,
) {
  const code = options.shareCode?.trim().toUpperCase() || visionCode(packet.id)
  const wind = WIND_LABELS[clamp(Math.round(packet.windLevel), 0, 3)]
  const whisper = options.showWhisper ? (options.whisperText?.trim() || '') : ''

  // 深暮靛航空信笺底色
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0d1834')
  bg.addColorStop(0.5, '#122248')
  bg.addColorStop(1, '#091122')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 四周经典航空条纹花边
  ctx.save()
  ctx.beginPath()
  ctx.rect(36, 36, W - 72, H - 72)
  ctx.clip()
  const stripeColors = ['rgba(242,194,139,0.58)', 'rgba(255,148,104,0.52)', 'rgba(138,184,255,0.45)']
  for (let offset = -H; offset < W + H; offset += 56) {
    const idx = Math.abs(Math.floor(offset / 56)) % stripeColors.length
    ctx.strokeStyle = stripeColors[idx]
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.moveTo(offset, 0)
    ctx.lineTo(offset + 220, 220)
    ctx.moveTo(offset, H - 220)
    ctx.lineTo(offset + 220, H)
    ctx.stroke()
  }
  ctx.restore()

  // 内层信笺卡片遮罩
  roundedPath(ctx, 64, 64, W - 128, H - 128, 30)
  ctx.fillStyle = '#0e1934'
  ctx.fill()
  ctx.strokeStyle = 'rgba(242, 194, 139, 0.28)'
  ctx.lineWidth = 2
  ctx.stroke()

  // 航空抬头发信标识
  ctx.fillStyle = 'rgba(242, 194, 139, 0.85)'
  ctx.font = `500 18px ${MONO}`
  trackedText(ctx, 'PAR AVION // NEUTRINO POST · 6,371.4 KM', 140, 146, 3.4)

  const titleSize = fitFont(ctx, packet.title, SERIF, 600, 72, 1080, 40)
  ctx.font = `600 ${titleSize}px ${SERIF}`
  ctx.fillStyle = '#fff8ee'
  ctx.fillText(truncate(ctx, packet.title, 1080), 140, 252)

  ctx.font = `400 19px ${MONO}`
  ctx.fillStyle = 'rgba(232, 224, 210, 0.56)'
  trackedText(ctx, `${packet.city} · ${formatDate(packet.createdAt)} · No. ${code}`, 142, 308, 2.4)

  // 右上角带照片缩略图的拟真齿孔邮票
  const sx = 1404
  const sy = 114
  const sw = 248
  const sh = 276
  ctx.save()
  ctx.fillStyle = '#f3eadb'
  roundedPath(ctx, sx, sy, sw, sh, 10)
  ctx.fill()
  drawCoverWithTone(ctx, image, sx + 16, sy + 16, sw - 32, sh - 78, 6, options.tone)
  ctx.fillStyle = '#1d2230'
  ctx.font = `600 18px ${MONO}`
  ctx.fillText('6371 KM', sx + 18, sy + sh - 32)
  ctx.textAlign = 'right'
  ctx.font = `500 17px ${SERIF}`
  ctx.fillText(truncate(ctx, packet.city, 110), sx + sw - 18, sy + sh - 31)
  ctx.textAlign = 'left'
  ctx.restore()

  if (options.showStamp) {
    drawPostmarkStamp(
      ctx,
      1355,
      298,
      packet.city,
      formatDateShort(packet.createdAt),
      code,
      'rgba(255, 166, 130, 0.88)',
      'rgba(242, 194, 139, 0.56)',
    )
  }

  // 主风景画幅
  const px = 140
  const py = 420
  const pw = 1520
  const ph = 860
  drawCoverWithTone(ctx, image, px, py, pw, ph, 20, options.tone)
  ctx.save()
  roundedPath(ctx, px, py, pw, ph, 20)
  ctx.clip()
  drawGazePins(ctx, packet, px, py, pw, ph)
  ctx.restore()
  ctx.strokeStyle = 'rgba(242, 194, 139, 0.22)'
  ctx.lineWidth = 1.5
  roundedPath(ctx, px, py, pw, ph, 20)
  ctx.stroke()

  // 下方双栏明信片布局
  const splitX = 1048
  ctx.fillStyle = 'rgba(242, 194, 139, 0.2)'
  ctx.fillRect(140, 1332, 1520, 1.5)
  ctx.fillRect(splitX, 1368, 1.5, 760)

  // 左栏：手记 + 林微低语 + 波形
  ctx.font = `500 28px ${SERIF}`
  ctx.fillStyle = '#fff8ee'
  ctx.fillText('捎往地心的目光', 140, 1404)

  if (packet.focus.length === 0) {
    ctx.font = `300 23px ${SERIF}`
    ctx.fillStyle = 'rgba(232, 224, 210, 0.45)'
    ctx.fillText('这一刻的沉默，已随信号一并寄出。', 140, 1468)
  } else {
    packet.focus.slice(0, 3).forEach((point, idx) => {
      const y = 1468 + idx * 72
      ctx.font = `500 14px ${MONO}`
      ctx.fillStyle = 'rgba(242, 194, 139, 0.85)'
      ctx.fillText(`0${idx + 1}`, 140, y)
      ctx.font = `300 23px ${SERIF}`
      ctx.fillStyle = 'rgba(246, 238, 224, 0.86)'
      const lines = wrapLines(ctx, point.note.trim() || '她在这里停了一会儿，没有说话。', 810, 2)
      lines.forEach((line, lIdx) => {
        ctx.fillText(line, 184, y + lIdx * 32)
      })
    })
  }

  if (whisper) {
    roundedPath(ctx, 140, 1710, 860, 132, 18)
    ctx.fillStyle = 'rgba(242, 194, 139, 0.07)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(242, 194, 139, 0.24)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.font = `500 17px ${SERIF}`
    ctx.fillStyle = 'rgba(242, 194, 139, 0.9)'
    ctx.fillText('来自地心的回响 · 林微', 168, 1748)
    ctx.font = `300 22px ${SERIF}`
    ctx.fillStyle = 'rgba(255, 244, 224, 0.88)'
    wrapLines(ctx, whisper, 800, 2).forEach((line, i) => {
      ctx.fillText(line, 168, 1788 + i * 32)
    })
  }

  drawWaveform(ctx, 140, 1910, 860, 88, hashOf(`${packet.id}-letter`))

  // 右栏：标准收发地址框
  const rx = 1094
  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(242, 194, 139, 0.72)'
  trackedText(ctx, 'RECIPIENT / TO', rx, 1402, 2.6)
  ctx.font = `500 26px ${SERIF}`
  ctx.fillStyle = '#fff8ee'
  ctx.fillText('落日六号 · 林微', rx, 1446)
  ctx.font = `400 19px ${SANS}`
  ctx.fillStyle = 'rgba(255, 148, 104, 0.85)'
  ctx.fillText('地下 6,371.4 KM · 地球内核', rx, 1484)

  ctx.fillStyle = 'rgba(242, 194, 139, 0.16)'
  ctx.fillRect(rx, 1522, 560, 1)

  ctx.font = `400 15px ${MONO}`
  ctx.fillStyle = 'rgba(242, 194, 139, 0.72)'
  trackedText(ctx, 'SENDER / FROM', rx, 1572, 2.6)
  ctx.font = `500 26px ${SERIF}`
  ctx.fillStyle = '#fff8ee'
  ctx.fillText(truncate(ctx, `${packet.sender} · ${packet.city}`, 540), rx, 1616)
  ctx.font = `400 16px ${MONO}`
  ctx.fillStyle = 'rgba(232, 224, 210, 0.56)'
  ctx.fillText(visionCoordinates(packet.city), rx, 1652)

  ctx.fillStyle = 'rgba(242, 194, 139, 0.16)'
  ctx.fillRect(rx, 1690, 560, 1)

  const rows: [string, string][] = [
    ['气温 / 风力', `${packet.tempC}°C · ${wind}`],
    ['气味线索', packet.scentTag.trim() || '安静的空气'],
    ['声景采集', packet.voice ? `${AMB_LABELS[packet.ambience]} + 原声` : AMB_LABELS[packet.ambience]],
    ['中继码', code],
  ]
  rows.forEach(([k, v], idx) => {
    const ry = 1744 + idx * 72
    ctx.font = `400 15px ${MONO}`
    ctx.fillStyle = 'rgba(242, 194, 139, 0.6)'
    ctx.fillText(k, rx, ry)
    ctx.font = `400 22px ${SANS}`
    ctx.fillStyle = 'rgba(255, 248, 238, 0.9)'
    ctx.fillText(truncate(ctx, v, 540), rx, ry + 32)
  })

  // 底部铭文
  ctx.font = `400 13px ${MONO}`
  ctx.fillStyle = 'rgba(242, 194, 139, 0.45)'
  trackedText(ctx, `NEUTRINO POSTAL SERVICE · ${code}`, 140, 2166, 2.2)
  ctx.fillStyle = 'rgba(232, 224, 210, 0.4)'
  const brand = '视界 6371 · TAKE HER EYES'
  trackedText(ctx, brand, 1660 - trackedWidth(ctx, brand, 2), 2166, 2)
}

export async function renderPostcardBlob(
  packet: VisionPacket,
  partialOptions?: Partial<PostcardOptions>,
): Promise<{ blob: Blob; code: string; width: number; height: number }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* 使用系统回退字体 */
    }
  }

  const options: PostcardOptions = {
    ...DEFAULT_POSTCARD_OPTIONS,
    ...partialOptions,
  }
  const image = await loadImage(packet.image)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas 导出')

  if (options.theme === 'polaroid') {
    drawPolaroidPostcard(ctx, image, packet, options)
  } else if (options.theme === 'film') {
    drawFilmPostcard(ctx, image, packet, options)
  } else if (options.theme === 'letter') {
    drawLetterPostcard(ctx, image, packet, options)
  } else {
    drawTwilightPostcard(ctx, image, packet, options)
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('明信片生成失败')

  const code = (options.shareCode?.trim() || visionCode(packet.id)).toLowerCase()
  return { blob, code, width: W, height: H }
}

export async function exportVisionPostcard(
  packet: VisionPacket,
  partialOptions?: Partial<PostcardOptions>,
) {
  const { blob, code } = await renderPostcardBlob(packet, partialOptions)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `vision6371-postcard-${code}.png`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { code, bytes: blob.size }
}
