import type { AlbumEntry } from '../services/albumStorage'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('ALBUM_IMAGE_LOAD_FAILED'))
    img.src = src
  })
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const chars = Array.from(text.trim())
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    if (ch === '\n') {
      lines.push(line)
      line = ''
      if (lines.length >= maxLines) break
      continue
    }
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day}  ${hh}:${mm}`
}

export async function exportAlbumCardPng(entry: AlbumEntry): Promise<void> {
  const width = 1400
  const height = 1140
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 典雅纪念册暗蓝纸面底色
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#0a1224')
  bg.addColorStop(0.55, '#101c36')
  bg.addColorStop(1, '#080e1d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // 外框细金线
  ctx.strokeStyle = 'rgba(242, 194, 139, 0.3)'
  ctx.lineWidth = 2
  ctx.strokeRect(38, 38, width - 76, height - 76)

  // 照片区
  const px = 86
  const py = 86
  const pw = width - 172
  const ph = 690
  try {
    const img = await loadImage(entry.image)
    const scale = Math.max(pw / img.width, ph / img.height)
    const sw = pw / scale
    const sh = ph / scale
    const sx = (img.width - sw) / 2
    const sy = (img.height - sh) / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(px, py, pw, ph)
    ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, px, py, pw, ph)
    ctx.restore()
  } catch {
    ctx.fillStyle = '#14223d'
    ctx.fillRect(px, py, pw, ph)
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = 2
  ctx.strokeRect(px, py, pw, ph)

  // 顶部角标与唤醒印记徽章
  ctx.fillStyle = '#f2c28b'
  ctx.font = '500 24px "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  ctx.fillText(`◆  ${entry.sceneTitle}`, px, py + ph + 62)

  if (entry.awakened) {
    const sealText = `◆ 奇境印记 · ${entry.stampTitle ?? 'AWAKENED'}`
    ctx.font = '500 17px "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif'
    const sealW = ctx.measureText(sealText).width + 26
    const sealX = px + pw - sealW
    const sealY = py + ph - 52
    ctx.fillStyle = 'rgba(10, 18, 36, 0.78)'
    ctx.fillRect(sealX, sealY, sealW, 34)
    ctx.strokeStyle = 'rgba(242, 194, 139, 0.75)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(sealX, sealY, sealW, 34)
    ctx.fillStyle = '#f2c28b'
    ctx.fillText(sealText, sealX + 13, sealY + 23)
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)'
  ctx.font = '20px ui-monospace, SFMono-Regular, monospace'
  const moodTag =
    entry.mood === 'dawn' ? 'MORNING LIGHT' : entry.mood === 'night' ? 'STARLIGHT' : 'GOLDEN DUSK'
  const stamp = `${entry.city} · ${moodTag} · ${formatDate(entry.createdAt)}`
  const stampW = ctx.measureText(stamp).width
  ctx.fillText(stamp, px + pw - stampW, py + ph + 60)

  // 细分隔线
  const rule = ctx.createLinearGradient(px, 0, px + pw, 0)
  rule.addColorStop(0, 'rgba(242, 194, 139, 0.45)')
  rule.addColorStop(1, 'rgba(242, 194, 139, 0.04)')
  ctx.fillStyle = rule
  ctx.fillRect(px, py + ph + 84, pw, 1.5)

  // 用户的留言
  const noteText = entry.note.trim() || '替不能再来地面的人，把这一刻的晴朗与灯火收进纪念册。'
  ctx.fillStyle = '#fff6ea'
  ctx.font = '400 28px "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  const lines = wrapLines(ctx, noteText, pw, 3)
  lines.forEach((line, idx) => {
    ctx.fillText(line, px, py + ph + 142 + idx * 44)
  })

  // 底部落款
  ctx.fillStyle = 'rgba(242, 194, 139, 0.68)'
  ctx.font = '18px "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  const footerLeft = entry.promiseQuote
    ? `草原约定：${entry.promiseQuote}`
    : '视界 6371 · 立体漫游纪念册 · 留给人间与记忆'
  ctx.fillText(footerLeft, px, height - 72)

  const footerRight = 'TAKE HER EYES · ARCHIVE'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '16px ui-monospace, SFMono-Regular, monospace'
  const frW = ctx.measureText(footerRight).width
  ctx.fillText(footerRight, px + pw - frW, height - 72)

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `vision6371-album-${entry.sceneId}-${entry.createdAt}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
