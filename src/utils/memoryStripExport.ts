export interface MemoryFrame {
  act: string
  title: string
  dataUrl: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    img.src = src
  })
}

export async function exportMemoryFilmstrip(frames: MemoryFrame[]): Promise<void> {
  if (!frames.length) return

  const width = 760
  const padX = 74
  const frameW = width - padX * 2
  const frameH = Math.round((frameW * 9) / 16)
  const headerH = 126
  const gap = 58
  const footerH = 128
  const height = headerH + frames.length * (frameH + gap) + footerH

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Filmstrip twilight indigo base
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, '#0b1630')
  bg.addColorStop(0.5, '#102042')
  bg.addColorStop(1, '#091122')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Subtle side tracks & sprocket holes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
  ctx.fillRect(0, 0, 48, height)
  ctx.fillRect(width - 48, 0, 48, height)
  ctx.strokeStyle = 'rgba(242, 194, 139, 0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(48.5, 0)
  ctx.lineTo(48.5, height)
  ctx.moveTo(width - 48.5, 0)
  ctx.lineTo(width - 48.5, height)
  ctx.stroke()

  for (let y = 26; y < height - 26; y += 38) {
    ctx.fillStyle = '#060b18'
    ctx.strokeStyle = 'rgba(255, 226, 189, 0.2)'
    ctx.beginPath()
    ctx.roundRect(14, y, 20, 14, 3)
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.roundRect(width - 34, y, 20, 14, 3)
    ctx.fill()
    ctx.stroke()
  }

  // Header
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(242, 194, 139, 0.85)'
  ctx.font = '500 13px "SFMono-Regular", Consolas, monospace'
  ctx.fillText('SUNSET-06  //  SENSORY MEMORY ROLL', width / 2, 54)

  ctx.fillStyle = 'rgba(255, 248, 238, 0.94)'
  ctx.font = '300 26px "Songti SC", "STSong", Georgia, serif'
  ctx.fillText('带上她的眼睛 · 地表记忆胶片', width / 2, 90)

  ctx.strokeStyle = 'rgba(242, 194, 139, 0.26)'
  ctx.beginPath()
  ctx.moveTo(padX, 110)
  ctx.lineTo(width - padX, 110)
  ctx.stroke()

  // Frames
  let cursorY = headerH
  for (let i = 0; i < frames.length; i += 1) {
    const item = frames[i]
    try {
      const img = await loadImage(item.dataUrl)
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(padX, cursorY, frameW, frameH, 10)
      ctx.clip()

      const scale = Math.max(frameW / img.width, frameH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, padX + (frameW - dw) / 2, cursorY + (frameH - dh) / 2, dw, dh)

      const vignette = ctx.createLinearGradient(0, cursorY + frameH * 0.55, 0, cursorY + frameH)
      vignette.addColorStop(0, 'rgba(6, 11, 24, 0)')
      vignette.addColorStop(1, 'rgba(6, 11, 24, 0.55)')
      ctx.fillStyle = vignette
      ctx.fillRect(padX, cursorY, frameW, frameH)
      ctx.restore()
    } catch {
      ctx.fillStyle = '#0d1832'
      ctx.fillRect(padX, cursorY, frameW, frameH)
    }

    ctx.strokeStyle = 'rgba(255, 226, 189, 0.24)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.roundRect(padX, cursorY, frameW, frameH, 10)
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(242, 194, 139, 0.82)'
    ctx.font = '500 12px "SFMono-Regular", Consolas, monospace'
    ctx.fillText(`FRAME 0${i + 1} · ${item.act}`, padX + 4, cursorY + frameH + 24)

    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255, 248, 238, 0.88)'
    ctx.font = '300 15px "Songti SC", "STSong", Georgia, serif'
    ctx.fillText(item.title, padX + frameW - 4, cursorY + frameH + 24)

    cursorY += frameH + gap
  }

  // Footer
  ctx.strokeStyle = 'rgba(242, 194, 139, 0.22)'
  ctx.beginPath()
  ctx.moveTo(padX, height - footerH + 14)
  ctx.lineTo(width - padX, height - footerH + 14)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255, 173, 150, 0.9)'
  ctx.font = '500 13px "SFMono-Regular", Consolas, monospace'
  ctx.fillText('DEPTH 6,371.4 KM  ·  EARTH CORE', width / 2, height - 74)

  ctx.fillStyle = 'rgba(255, 240, 222, 0.72)'
  ctx.font = '400 15px "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  ctx.fillText('风信 · WINDPOST', width / 2, height - 42)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'windpost-memory-roll.png'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
