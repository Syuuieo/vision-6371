export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  bytes: number
  mime: string
}

type Source = ImageBitmap | HTMLImageElement

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|jfif|svg)$/i
const MAX_COMPRESSED_CHARS = 1_400_000

export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  if (!file.type || file.type === 'application/octet-stream') {
    const hasExt = /\.[a-z0-9]{1,8}$/i.test(file.name)
    return !hasExt || IMAGE_EXT_RE.test(file.name)
  }
  return false
}

function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = url
  })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'))
    reader.readAsDataURL(file)
  })
}

async function loadSource(file: File): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* 某些移动端浏览器不支持 imageOrientation 参数 */
    }
    try {
      return await createImageBitmap(file)
    } catch {
      /* 回退到 <img> 解码 */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await loadImageUrl(url)
  } catch {
    /* 部分 WebView 对 blob: 图片有限制，继续尝试 DataURL */
  } finally {
    URL.revokeObjectURL(url)
  }

  try {
    const dataUrl = await readAsDataUrl(file)
    if (dataUrl.startsWith('data:')) {
      return await loadImageUrl(dataUrl)
    }
  } catch {
    /* 所有解码路径均失败 */
  }

  throw new Error('无法解析这张图片（如为 iPhone HEIC 原图，请在相册选「兼容性最佳」或截图后上传）')
}

function sourceDimensions(source: Source): { width: number; height: number } {
  if ('naturalWidth' in source) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    }
  }
  return { width: source.width, height: source.height }
}

export function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const base64 = dataUrl.slice(comma + 1)
  return Math.max(0, Math.round((base64.length * 3) / 4) - 2)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 上传照片自适应压缩为长边 ≤ 1280px 的 WebP（不支持时回退 JPEG）。
 */
export async function compressImage(file: File, maxEdge = 1280, quality = 0.82): Promise<CompressedImage> {
  if (!isLikelyImageFile(file)) {
    throw new Error('请选择 JPG、PNG 或 WebP 图片文件')
  }

  const source = await loadSource(file)
  const { width: sourceWidth, height: sourceHeight } = sourceDimensions(source)
  if (!sourceWidth || !sourceHeight) {
    if ('close' in source && typeof source.close === 'function') source.close()
    throw new Error('无法读取图片尺寸')
  }

  try {
    const edges = [maxEdge, Math.min(maxEdge, 960)]
    const qualities = [quality, 0.72, 0.6]

    for (const edge of edges) {
      const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight))
      const width = Math.max(1, Math.round(sourceWidth * scale))
      const height = Math.max(1, Math.round(sourceHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('浏览器不支持 Canvas 压缩')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(source, 0, 0, width, height)

      for (const q of qualities) {
        const webp = canvas.toDataURL('image/webp', q)
        const useWebp = webp.startsWith('data:image/webp') && webp.length > 64
        const dataUrl = useWebp ? webp : canvas.toDataURL('image/jpeg', q)
        const mime = useWebp ? 'image/webp' : 'image/jpeg'
        if (dataUrl.startsWith('data:image/') && dataUrl.length > 64 && dataUrl.length <= MAX_COMPRESSED_CHARS) {
          return {
            dataUrl,
            width,
            height,
            bytes: dataUrlBytes(dataUrl),
            mime,
          }
        }
      }
    }

    throw new Error('图片体积过大，请换一张分辨率小一点的照片')
  } finally {
    if ('close' in source && typeof source.close === 'function') source.close()
  }
}
