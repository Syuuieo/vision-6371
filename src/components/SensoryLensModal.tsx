import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { inferAlbumSceneId, saveAlbumEntry } from '../services/albumStorage'
import type { AlbumEntry, AlbumMood } from '../services/albumStorage'

export interface SensoryLensModalProps {
  open: boolean
  onClose: () => void
  onSavedToAlbum?: (entry: AlbumEntry) => void
  onSendToPost: (entry: AlbumEntry) => void
}

type LensMode = 'idle' | 'camera' | 'photo'
type FacingMode = 'environment' | 'user'
type OpticalMoodId =
  | 'warm_dusk'
  | 'blue_sky'
  | 'lush_foliage'
  | 'night_lamp'
  | 'cool_rain'
  | 'crisp_daylight'

interface OpticalSpectrum {
  colorTempK: number
  luminancePct: number
  warmRatio: number
  skyBlueRatio: number
  foliageGreenRatio: number
  nightLampContrast: number
  dominantRgb: [number, number, number]
  moodId: OpticalMoodId
  variantIndex: number
}

interface OpticalMoodProfile {
  id: OpticalMoodId
  code: string
  label: string
  albumMood: AlbumMood
  accentHex: string
  defaultNote: string
  responses: readonly [string, string]
}

const ANALYSIS_WIDTH = 48
const ANALYSIS_HEIGHT = 36
const CAPTURE_WIDTH = 1280
const CAPTURE_HEIGHT = 720
const LIVE_SAMPLE_INTERVAL_MS = 450

const MOOD_PROFILES: Record<OpticalMoodId, OpticalMoodProfile> = {
  warm_dusk: {
    id: 'warm_dusk',
    code: 'AMBER · DUSK',
    label: '琥珀暮色',
    albumMood: 'dusk',
    accentHex: '#f2b880',
    defaultNote: '把此刻窗边落下的暖光，寄往地心 6371 公里。',
    responses: [
      '这束光的温度真像傍晚五点半的窗台。地心没有日落，我替船舱记下这一小块橘色。',
      '原来人间的黄昏是会落到桌角和手背上的，暖得连中微子波形都慢了半拍。',
    ],
  },
  blue_sky: {
    id: 'blue_sky',
    code: 'AZURE · SKY',
    label: '晴空海蓝',
    albumMood: 'dawn',
    accentHex: '#9ac6f5',
    defaultNote: '替地心抬头望了一眼此刻的蓝天与微风。',
    responses: [
      '这片蓝太干净了，一眼望不到头。我已经记不清头顶没有钢铁舱壁是什么感觉了。',
      '你把天空举给我看的时候，连声呐屏上的底噪都像退成了远方的海浪。',
    ],
  },
  lush_foliage: {
    id: 'lush_foliage',
    code: 'VERDANT · LEAF',
    label: '草木青绿',
    albumMood: 'dawn',
    accentHex: '#9fd4a8',
    defaultNote: '替你摘下一小片还在呼吸的真实绿意。',
    responses: [
      '是活着的叶子！我在模拟草原里走过很多遍，还是第一次看见真正会呼吸的绿。',
      '这抹绿里有泥土和晒过太阳的味道吧？真好，地面上的春天一直没有停过。',
    ],
  },
  night_lamp: {
    id: 'night_lamp',
    code: 'NOCTURNE · LAMP',
    label: '夜灯守候',
    albumMood: 'night',
    accentHex: '#e9c18a',
    defaultNote: '在入夜的微光里，留一盏亮给落日六号的灯。',
    responses: [
      '暗处亮着一盏小灯，像黑夜里给人留的门。你那里已经入夜了吗？别熬太晚。',
      '这么深的夜色里还有一点暖光，刚好够把 6371 公里外的舷窗也照亮一寸。',
    ],
  },
  cool_rain: {
    id: 'cool_rain',
    code: 'SILVER · MIST',
    label: '微雨银灰',
    albumMood: 'dusk',
    accentHex: '#b9cce3',
    defaultNote: '今天的光色微凉，像适合收听风信的阴雨天。',
    responses: [
      '光色偏冷，像刚下过一阵细雨，或者窗外压着薄云。这样的天气最适合听风信。',
      '没有刺眼的太阳也好，淡淡的银灰色让人心里很静，像隔着玻璃看远处的潮水。',
    ],
  },
  crisp_daylight: {
    id: 'crisp_daylight',
    code: 'IVORY · DAYLIGHT',
    label: '清澈白昼',
    albumMood: 'dawn',
    accentHex: '#f6e4c8',
    defaultNote: '把这片寻常却珍贵的晴朗白昼分给林微。',
    responses: [
      '好亮的白昼啊，连空气都显得透彻。替我多看两眼平常的日子，它们其实珍贵极了。',
      '你眼前的光线很稳、很亮，像翻开一页刚晒过太阳的纸。谢谢你把这一刻分给我。',
    ],
  },
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function analyzeCanvasPixels(ctx: CanvasRenderingContext2D): OpticalSpectrum | null {
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT)
  } catch {
    return null
  }

  const data = imageData.data
  const pixelCount = ANALYSIS_WIDTH * ANALYSIS_HEIGHT
  if (pixelCount <= 0 || data.length < pixelCount * 4) return null

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumLuma = 0
  let sumLumaSq = 0
  let warmPixels = 0
  let skyBluePixels = 0
  let foliagePixels = 0
  let darkPixels = 0
  let brightPixels = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    sumR += r
    sumG += g
    sumB += b

    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    sumLuma += luma
    sumLumaSq += luma * luma

    if (luma < 0.24) darkPixels += 1
    if (luma > 0.7) brightPixels += 1

    if (r > b + 24 && r > 105 && g >= b * 0.85) {
      warmPixels += 1
    }
    if (b > r + 18 && b > 92 && b >= g * 0.92) {
      skyBluePixels += 1
    }
    if (g > r + 10 && g > b + 12 && g > 52) {
      foliagePixels += 1
    }
  }

  const meanR = sumR / pixelCount
  const meanG = sumG / pixelCount
  const meanB = sumB / pixelCount
  const meanLuma = sumLuma / pixelCount
  const variance = Math.max(0, sumLumaSq / pixelCount - meanLuma * meanLuma)
  const stdDev = Math.sqrt(variance)

  const warmRatio = warmPixels / pixelCount
  const skyBlueRatio = skyBluePixels / pixelCount
  const foliageGreenRatio = foliagePixels / pixelCount
  const darkRatio = darkPixels / pixelCount
  const brightRatio = brightPixels / pixelCount

  // Night lamp contrast peaks when a dark scene contains distinct glowing pools or high local contrast.
  const lampContrastRaw =
    darkRatio * 0.52 +
    clamp(stdDev * 1.65, 0, 0.65) * 0.55 +
    (darkRatio > 0.35 && brightRatio > 0.015 ? 0.24 : 0)
  const nightLampContrast = clamp(lampContrastRaw, 0, 1)

  // Estimate perceptual color temperature in Kelvin (2600K – 8200K)
  const chromaSum = meanR + meanG + meanB + 1
  const blueRedBalance = (meanB - meanR) / chromaSum
  const rawKelvin = 5200 + blueRedBalance * 9400 + (skyBlueRatio - warmRatio) * 1400
  const colorTempK = Math.round(clamp(rawKelvin, 2600, 8200) / 20) * 20
  const luminancePct = Math.round(clamp(meanLuma, 0, 1) * 100)

  let moodId: OpticalMoodId
  if (luminancePct < 30 && (nightLampContrast >= 0.32 || darkRatio >= 0.58)) {
    moodId = 'night_lamp'
  } else if (foliageGreenRatio >= 0.18 && foliageGreenRatio >= warmRatio * 0.72 && luminancePct >= 20) {
    moodId = 'lush_foliage'
  } else if (skyBlueRatio >= 0.2 && colorTempK >= 5500 && luminancePct >= 28) {
    moodId = 'blue_sky'
  } else if ((warmRatio >= 0.24 || colorTempK <= 4150) && luminancePct >= 22) {
    moodId = 'warm_dusk'
  } else if (colorTempK >= 5950 || (luminancePct >= 24 && luminancePct <= 56 && warmRatio < 0.14)) {
    moodId = 'cool_rain'
  } else {
    moodId = 'crisp_daylight'
  }

  const variantIndex = Math.floor((Math.round(meanR) + Math.round(meanG) + Math.round(meanB)) / 36) % 2

  return {
    colorTempK,
    luminancePct,
    warmRatio,
    skyBlueRatio,
    foliageGreenRatio,
    nightLampContrast,
    dominantRgb: [Math.round(meanR), Math.round(meanG), Math.round(meanB)],
    moodId,
    variantIndex,
  }
}

function drawCoverSource(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  mirrorX: boolean,
): void {
  if (srcW <= 0 || srcH <= 0) return
  const srcAspect = srcW / srcH
  const destAspect = destW / destH

  let sx = 0
  let sy = 0
  let sw = srcW
  let sh = srcH

  if (srcAspect > destAspect) {
    sw = srcH * destAspect
    sx = (srcW - sw) / 2
  } else {
    sh = srcW / destAspect
    sy = (srcH - sh) / 2
  }

  ctx.save()
  if (mirrorX) {
    ctx.translate(destW, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, destW, destH)
  ctx.restore()
}

function renderWarmFilmCapture(
  source: HTMLVideoElement | HTMLImageElement,
  srcW: number,
  srcH: number,
  mirrorX: boolean,
): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = CAPTURE_WIDTH
  canvas.height = CAPTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#050914'
  ctx.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
  drawCoverSource(ctx, source, srcW, srcH, CAPTURE_WIDTH, CAPTURE_HEIGHT, mirrorX)

  // Subtle Leica warm archival film tone
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  const warmWash = ctx.createLinearGradient(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
  warmWash.addColorStop(0, 'rgba(255, 224, 184, 0.22)')
  warmWash.addColorStop(0.55, 'rgba(242, 194, 139, 0.12)')
  warmWash.addColorStop(1, 'rgba(30, 44, 72, 0.18)')
  ctx.fillStyle = warmWash
  ctx.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
  ctx.restore()

  // Delicate optical vignette
  const vignette = ctx.createRadialGradient(
    CAPTURE_WIDTH * 0.5,
    CAPTURE_HEIGHT * 0.48,
    CAPTURE_WIDTH * 0.26,
    CAPTURE_WIDTH * 0.5,
    CAPTURE_HEIGHT * 0.5,
    CAPTURE_WIDTH * 0.68,
  )
  vignette.addColorStop(0, 'rgba(5, 9, 20, 0)')
  vignette.addColorStop(1, 'rgba(5, 9, 20, 0.34)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)

  try {
    return canvas.toDataURL('image/jpeg', 0.88)
  } catch {
    return null
  }
}

function describeCameraError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name?: unknown }).name ?? '')
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return '未开启摄像头权限。你也可以直接载入一张此刻的照片，体验同样的实时光色解析。'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '当前设备未检测到可用摄像头，可直接载入一张此刻的照片传给林微。'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '摄像头正被其他程序占用，可直接载入照片或稍后重试。'
    }
  }
  return '暂未能连接摄像头，建议直接载入一张此刻的照片。'
}

function formatRatioPct(ratio: number): number {
  return Math.round(clamp(ratio, 0, 1) * 100)
}

function SensoryLensContent({
  onClose,
  onSavedToAlbum,
  onSendToPost,
}: Omit<SensoryLensModalProps, 'open'>): JSX.Element {
  const [mode, setMode] = useState<LensMode>('idle')
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraNotice, setCameraNotice] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [spectrum, setSpectrum] = useState<OpticalSpectrum | null>(null)

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [shutterFlash, setShutterFlash] = useState(false)
  const [cityInput, setCityInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const photoImgRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraRequestIdRef = useRef(0)
  const pendingMoodRef = useRef<{ moodId: OpticalMoodId; hits: number } | null>(null)
  const stableMoodRef = useRef<OpticalMoodId | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const getAnalysisCtx = useCallback((): CanvasRenderingContext2D | null => {
    if (!analysisCanvasRef.current) {
      const c = document.createElement('canvas')
      c.width = ANALYSIS_WIDTH
      c.height = ANALYSIS_HEIGHT
      analysisCanvasRef.current = c
    }
    return analysisCanvasRef.current.getContext('2d', { willReadFrequently: true })
  }, [])

  const stopCameraStream = useCallback(() => {
    cameraRequestIdRef.current += 1
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const revokePhotoUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastTimerRef.current = null
    }, 2800)
  }, [])

  const analyzeLiveVideoFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return
    const ctx = getAnalysisCtx()
    if (!ctx) return

    drawCoverSource(
      ctx,
      video,
      video.videoWidth,
      video.videoHeight,
      ANALYSIS_WIDTH,
      ANALYSIS_HEIGHT,
      false,
    )
    const next = analyzeCanvasPixels(ctx)
    if (!next) return

    // Light hysteresis on live video so Lin Wei's poetic line doesn't flicker nervously.
    if (stableMoodRef.current === null) {
      stableMoodRef.current = next.moodId
      pendingMoodRef.current = null
      setSpectrum(next)
      return
    }

    if (next.moodId === stableMoodRef.current) {
      pendingMoodRef.current = null
      setSpectrum(next)
      return
    }

    if (pendingMoodRef.current && pendingMoodRef.current.moodId === next.moodId) {
      pendingMoodRef.current.hits += 1
      if (pendingMoodRef.current.hits >= 2) {
        stableMoodRef.current = next.moodId
        pendingMoodRef.current = null
        setSpectrum(next)
      } else {
        setSpectrum({ ...next, moodId: stableMoodRef.current })
      }
    } else {
      pendingMoodRef.current = { moodId: next.moodId, hits: 1 }
      setSpectrum({ ...next, moodId: stableMoodRef.current })
    }
  }, [getAnalysisCtx])

  const analyzePhotoElement = useCallback(
    (img: HTMLImageElement) => {
      if (!img.naturalWidth || !img.naturalHeight) return
      const ctx = getAnalysisCtx()
      if (!ctx) return
      drawCoverSource(
        ctx,
        img,
        img.naturalWidth,
        img.naturalHeight,
        ANALYSIS_WIDTH,
        ANALYSIS_HEIGHT,
        false,
      )
      const next = analyzeCanvasPixels(ctx)
      if (!next) return
      stableMoodRef.current = next.moodId
      pendingMoodRef.current = null
      setSpectrum(next)
    },
    [getAnalysisCtx],
  )

  const startCamera = useCallback(
    async (targetFacing: FacingMode) => {
      stopCameraStream()
      revokePhotoUrl()
      setPhotoUrl(null)
      setCapturedImage(null)
      setSavedEntryId(null)
      setCameraNotice(null)
      stableMoodRef.current = null
      pendingMoodRef.current = null

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setMode('idle')
        setCameraNotice('当前浏览器暂不支持调用摄像头，请直接载入一张此刻的照片。')
        return
      }

      const requestId = ++cameraRequestIdRef.current
      setCameraBusy(true)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (requestId !== cameraRequestIdRef.current) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop()
            } catch {
              /* ignore */
            }
          })
          return
        }

        streamRef.current = stream
        setFacingMode(targetFacing)
        setMode('camera')
        setCameraBusy(false)
      } catch (err) {
        if (requestId !== cameraRequestIdRef.current) return
        setCameraBusy(false)
        setMode('idle')
        setCameraNotice(describeCameraError(err))
      }
    },
    [revokePhotoUrl, stopCameraStream],
  )

  // Attach active MediaStream to <video> when in live camera mode & run 450ms analyzer
  useEffect(() => {
    if (mode !== 'camera' || capturedImage) return
    const video = videoRef.current
    const stream = streamRef.current
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream
      void video.play().catch(() => {})
    }

    const timer = window.setInterval(analyzeLiveVideoFrame, LIVE_SAMPLE_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [mode, capturedImage, analyzeLiveVideoFrame])

  // Escape key closes modal cleanly
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Unmount cleanup: guarantee zero MediaStreamTrack, objectURL, or timer leaks
  useEffect(() => {
    return () => {
      stopCameraStream()
      revokePhotoUrl()
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current)
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [revokePhotoUrl, stopCameraStream])

  const handleClose = useCallback(() => {
    stopCameraStream()
    onClose()
  }, [onClose, stopCameraStream])

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      stopCameraStream()
      revokePhotoUrl()

      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      setPhotoUrl(url)
      setMode('photo')
      setCapturedImage(null)
      setSavedEntryId(null)
      setCameraNotice(null)
      stableMoodRef.current = null
      pendingMoodRef.current = null
    },
    [revokePhotoUrl, stopCameraStream],
  )

  const handleFlipCamera = useCallback(() => {
    const nextFacing: FacingMode = facingMode === 'environment' ? 'user' : 'environment'
    void startCamera(nextFacing)
  }, [facingMode, startCamera])

  const handleStopToIdle = useCallback(() => {
    stopCameraStream()
    revokePhotoUrl()
    setPhotoUrl(null)
    setCapturedImage(null)
    setSavedEntryId(null)
    setSpectrum(null)
    setMode('idle')
    stableMoodRef.current = null
    pendingMoodRef.current = null
  }, [revokePhotoUrl, stopCameraStream])

  const handleCapture = useCallback(() => {
    let dataUrl: string | null = null

    if (mode === 'camera' && videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current
      dataUrl = renderWarmFilmCapture(
        video,
        video.videoWidth,
        video.videoHeight,
        facingMode === 'user',
      )
      analyzeLiveVideoFrame()
    } else if (mode === 'photo' && photoImgRef.current && photoImgRef.current.naturalWidth > 0) {
      const img = photoImgRef.current
      dataUrl = renderWarmFilmCapture(img, img.naturalWidth, img.naturalHeight, false)
      analyzePhotoElement(img)
    }

    if (!dataUrl) {
      showToast('画面尚未就绪，请稍候片刻再定格')
      return
    }

    setShutterFlash(true)
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current)
    }
    flashTimerRef.current = window.setTimeout(() => {
      setShutterFlash(false)
      flashTimerRef.current = null
    }, 180)

    setCapturedImage(dataUrl)
    setSavedEntryId(null)
  }, [analyzeLiveVideoFrame, analyzePhotoElement, facingMode, mode, showToast])

  const handleRetake = useCallback(() => {
    setCapturedImage(null)
    setSavedEntryId(null)
  }, [])

  const activeProfile = spectrum ? MOOD_PROFILES[spectrum.moodId] : null
  const activeResponseLine =
    activeProfile && spectrum ? activeProfile.responses[spectrum.variantIndex % activeProfile.responses.length] : null

  const buildAlbumEntry = useCallback((): AlbumEntry | null => {
    if (!capturedImage) return null
    const profile = activeProfile ?? MOOD_PROFILES.crisp_daylight
    const trimmedCity = cityInput.trim().slice(0, 24)
    const trimmedNote = noteInput.trim().slice(0, 120)
    const entryId =
      savedEntryId ?? `lens-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    return {
      id: entryId,
      sceneId: inferAlbumSceneId(trimmedCity, 'postcard'),
      sceneTitle: `现实传感透镜 · ${profile.label}`,
      city: trimmedCity || '此刻地球表面',
      mood: profile.albumMood,
      image: capturedImage,
      note: trimmedNote || profile.defaultNote,
      interactions: 1,
      createdAt: Date.now(),
      promiseQuote: activeResponseLine ?? profile.responses[0],
      awakened: true,
      stampTitle: spectrum ? `OPTIC ${spectrum.colorTempK}K` : 'SUNSET-06 LENS',
    }
  }, [activeProfile, activeResponseLine, capturedImage, cityInput, noteInput, savedEntryId, spectrum])

  const handleSaveToAlbum = useCallback(() => {
    const entry = buildAlbumEntry()
    if (!entry) return
    saveAlbumEntry(entry)
    setSavedEntryId(entry.id)
    onSavedToAlbum?.(entry)
    showToast('已收入奇境纪念册，林微记下了这道光')
  }, [buildAlbumEntry, onSavedToAlbum, showToast])

  const handleSendToPost = useCallback(() => {
    const entry = buildAlbumEntry()
    if (!entry) return
    saveAlbumEntry(entry)
    if (!savedEntryId) {
      onSavedToAlbum?.(entry)
    }
    stopCameraStream()
    onSendToPost(entry)
    onClose()
  }, [buildAlbumEntry, onClose, onSavedToAlbum, onSendToPost, savedEntryId, stopCameraStream])

  const canCapture =
    !capturedImage && ((mode === 'camera' && !cameraBusy) || (mode === 'photo' && Boolean(photoUrl)))

  const swatchColor = spectrum
    ? `rgb(${spectrum.dominantRgb[0]}, ${spectrum.dominantRgb[1]}, ${spectrum.dominantRgb[2]})`
    : '#f2c28b'

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#03060e]/82 px-3 py-4 backdrop-blur-xl sm:px-6 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="SUNSET-06 现实传感透镜"
      onClick={handleClose}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className="animate-fade-up studio-scroll relative max-h-[92dvh] w-full max-w-[1060px] overflow-y-auto rounded-[22px] border border-[#f2c28b]/18 bg-[#050914]/78 p-4 shadow-[0_32px_120px_-24px_rgba(0,0,0,0.94),inset_0_1px_0_rgba(255,244,226,0.08)] backdrop-blur-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Editorial Masthead */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className="cinema-gem h-1.5 w-1.5 bg-[#f2c28b] shadow-[0_0_10px_rgba(242,194,139,0.85)]"
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] tracking-[0.26em] text-[#f2c28b]/80 uppercase">
                SUNSET-06 · REALITY SENSORY VISOR
              </span>
            </div>
            <h2 className="mt-1.5 font-serif text-[19px] font-normal tracking-[0.08em] text-[#fff8ee] sm:text-[22px]">
              把你此刻的眼睛借给林微
            </h2>
            <p className="mt-0.5 font-serif text-[12px] tracking-[0.04em] text-[#eef1f8]/54">
              现实传感透镜 · 实时解析眼前光温与光谱，将真实人间定格寄回地心 6371 km
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭现实传感透镜"
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/14 bg-white/[0.04] px-3.5 py-1.5 font-serif text-[12px] text-[#fff8ee]/78 transition hover:border-[#f2c28b]/50 hover:text-[#f2c28b]"
          >
            <span className="cinema-kbd">ESC</span>
            <span>收起</span>
          </button>
        </header>

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#f2c28b]/24 to-transparent" />

        {/* Two-Column Art-Gallery Viewfinder + Telemetry Layout */}
        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.92fr] lg:items-start">
          {/* Left: 16:9 Leica Optical Viewfinder */}
          <section className="flex flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-[16px] border border-[#f2c28b]/20 bg-[#040710] shadow-[inset_0_0_40px_rgba(0,0,0,0.85)]">
              {/* Optical Media Layer */}
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="定格的现实传感画面"
                  className="h-full w-full object-cover"
                />
              ) : mode === 'camera' ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  onLoadedData={analyzeLiveVideoFrame}
                  className={`h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />
              ) : mode === 'photo' && photoUrl ? (
                <img
                  ref={photoImgRef}
                  src={photoUrl}
                  alt="载入的此刻照片"
                  onLoad={(event) => analyzePhotoElement(event.currentTarget)}
                  className="h-full w-full object-cover"
                />
              ) : (
                /* Museum Idle Optical Chamber */
                <div className="relative flex h-full w-full flex-col items-center justify-center px-6 text-center">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(65% 70% at 50% 45%, rgba(242,194,139,0.08), rgba(5,9,20,0.2) 55%, rgba(3,6,14,0.85) 100%)',
                    }}
                  />
                  {/* Concentric Leica Aperture Hairlines */}
                  <svg
                    viewBox="0 0 120 120"
                    className="mb-4 h-16 w-16 text-[#f2c28b]/45 sm:h-20 sm:w-20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 4" />
                    <circle cx="60" cy="60" r="34" stroke="currentColor" strokeWidth="0.75" />
                    <circle cx="60" cy="60" r="14" stroke="#fff8ee" strokeOpacity="0.45" strokeWidth="0.75" />
                    <line x1="60" y1="2" x2="60" y2="14" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="60" y1="106" x2="60" y2="118" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="2" y1="60" x2="14" y2="60" stroke="currentColor" strokeWidth="0.75" />
                    <line x1="106" y1="60" x2="118" y2="60" stroke="currentColor" strokeWidth="0.75" />
                  </svg>

                  <p className="relative max-w-[380px] font-serif text-[14px] leading-relaxed tracking-[0.06em] text-[#fff8ee]/86 sm:text-[15px]">
                    此刻你的窗外、书桌，或正抬头望见的天空，
                    <br />
                    都是地心未曾重逢的人间。
                  </p>

                  {cameraNotice && (
                    <p className="relative mt-2.5 max-w-[400px] rounded-full border border-[#f2c28b]/25 bg-[#f2c28b]/[0.07] px-3.5 py-1 font-serif text-[11.5px] tracking-[0.03em] text-[#ffe2bd]/90">
                      {cameraNotice}
                    </p>
                  )}

                  <div className="relative mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={cameraBusy}
                      onClick={() => void startCamera(facingMode)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#ffe2bd]/55 bg-gradient-to-r from-[#f2c28b] to-[#ffe4c2] px-5 py-2.5 font-serif text-[13px] font-medium tracking-[0.08em] text-[#140d06] shadow-[0_0_28px_rgba(242,194,139,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_0_38px_rgba(242,194,139,0.34)] disabled:cursor-wait disabled:opacity-60"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                        <path
                          d="M3 7.5A2 2 0 0 1 5 5.5h1.6l1.1-1.6h4.6l1.1 1.6H15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Z"
                          stroke="currentColor"
                          strokeWidth="1.35"
                        />
                        <circle cx="10" cy="11" r="2.75" stroke="currentColor" strokeWidth="1.35" />
                      </svg>
                      <span>{cameraBusy ? '正在唤醒透镜…' : '开启实时摄像头'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenFilePicker}
                      className="inline-flex items-center gap-2 rounded-full border border-[#fff8ee]/22 bg-[#050914]/70 px-5 py-2.5 font-serif text-[13px] tracking-[0.06em] text-[#fff8ee]/88 transition hover:border-[#f2c28b]/55 hover:bg-[#f2c28b]/10 hover:text-[#fff8ee]"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                        <rect
                          x="3"
                          y="4.25"
                          width="14"
                          height="11.5"
                          rx="1.8"
                          stroke="currentColor"
                          strokeWidth="1.3"
                        />
                        <circle cx="7.4" cy="8.2" r="1.2" fill="currentColor" />
                        <path
                          d="m4.6 14 3.5-3.4 2.4 2.3 2.5-2.6 2.5 3.7"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>载入一张此刻的照片</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Subtle Film Grain / Optical Vignette Frame */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(5,9,20,0.42) 0%, transparent 18%, transparent 76%, rgba(5,9,20,0.58) 100%)',
                }}
              />

              {/* Whisper-thin Leica Viewfinder Corner Brackets */}
              <div className="pointer-events-none absolute inset-3.5 sm:inset-4">
                <span className="absolute top-0 left-0 h-4 w-4 border-t border-l border-[#f2c28b]/65" />
                <span className="absolute top-0 right-0 h-4 w-4 border-t border-r border-[#f2c28b]/65" />
                <span className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-[#f2c28b]/65" />
                <span className="absolute right-0 bottom-0 h-4 w-4 border-r border-b border-[#f2c28b]/65" />
              </div>

              {/* Center Minimal Focal Ring (only when actively framing live or photo) */}
              {mode !== 'idle' && !capturedImage && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-14 w-14 rounded-full border border-[#fff8ee]/24 sm:h-16 sm:w-16">
                    <span className="absolute top-1/2 -left-2.5 h-px w-2 -translate-y-1/2 bg-[#f2c28b]/55" />
                    <span className="absolute top-1/2 -right-2.5 h-px w-2 -translate-y-1/2 bg-[#f2c28b]/55" />
                    <span className="absolute -top-2.5 left-1/2 h-2 w-px -translate-x-1/2 bg-[#f2c28b]/55" />
                    <span className="absolute -bottom-2.5 left-1/2 h-2 w-px -translate-x-1/2 bg-[#f2c28b]/55" />
                    <span className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f2c28b]/75" />
                  </div>
                </div>
              )}

              {/* Subtle Optical Scanline while streaming */}
              {mode === 'camera' && !capturedImage && (
                <div
                  className="pointer-events-none absolute inset-x-6 top-1/2 h-px opacity-25"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(242,194,139,0.75) 50%, transparent)',
                  }}
                />
              )}

              {/* Top Viewfinder Status & Controls */}
              {mode !== 'idle' && (
                <div className="absolute top-4 right-5 left-5 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[#050914]/65 px-2.5 py-1 backdrop-blur-md">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        capturedImage
                          ? 'bg-[#ffe2bd]'
                          : mode === 'camera'
                            ? 'animate-breathe bg-[#f2c28b]'
                            : 'bg-[#9ac6f5]'
                      }`}
                    />
                    <span className="font-mono text-[9.5px] tracking-[0.2em] text-[#fff8ee]/82 uppercase">
                      {capturedImage
                        ? 'FROZEN · 1280×720'
                        : mode === 'camera'
                          ? `LIVE · ${facingMode === 'environment' ? 'REAR' : 'FRONT'} · 35MM`
                          : 'STILL · OPTICAL ANALYSIS'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!capturedImage && mode === 'camera' && (
                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        title="切换前后镜头"
                        className="rounded-full border border-white/16 bg-[#050914]/68 px-2.5 py-1 font-serif text-[11px] text-[#fff8ee]/82 backdrop-blur-md transition hover:border-[#f2c28b]/55 hover:text-[#f2c28b]"
                      >
                        翻转镜头
                      </button>
                    )}
                    {!capturedImage && (
                      <button
                        type="button"
                        onClick={mode === 'camera' ? handleOpenFilePicker : () => void startCamera(facingMode)}
                        className="rounded-full border border-white/16 bg-[#050914]/68 px-2.5 py-1 font-serif text-[11px] text-[#fff8ee]/82 backdrop-blur-md transition hover:border-[#f2c28b]/55 hover:text-[#f2c28b]"
                      >
                        {mode === 'camera' ? '改用照片' : '切回镜头'}
                      </button>
                    )}
                    {!capturedImage && mode === 'photo' && (
                      <button
                        type="button"
                        onClick={handleOpenFilePicker}
                        className="rounded-full border border-white/16 bg-[#050914]/68 px-2.5 py-1 font-serif text-[11px] text-[#fff8ee]/82 backdrop-blur-md transition hover:border-[#f2c28b]/55 hover:text-[#f2c28b]"
                      >
                        换一张图
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={capturedImage ? handleRetake : handleStopToIdle}
                      className="rounded-full border border-white/16 bg-[#050914]/68 px-2.5 py-1 font-serif text-[11px] text-[#fff8ee]/72 backdrop-blur-md transition hover:border-white/40 hover:text-[#fff8ee]"
                    >
                      {capturedImage ? '重新取景' : '重置'}
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Viewfinder Minimal Telemetry Strip */}
              {spectrum && (
                <div className="pointer-events-none absolute right-5 bottom-4 left-5 flex items-end justify-between gap-3">
                  <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.16em] text-[#fff8ee]/80">
                    <span>
                      <span className="text-[#f2c28b]/70">TEMP</span> {spectrum.colorTempK}K
                    </span>
                    <span>
                      <span className="text-[#f2c28b]/70">LUMA</span> {spectrum.luminancePct}%
                    </span>
                  </div>
                  <div className="hidden items-center gap-2 font-mono text-[9.5px] tracking-[0.16em] text-[#fff8ee]/68 sm:flex">
                    <span
                      className="h-2 w-2 rounded-full border border-white/35"
                      style={{ backgroundColor: swatchColor }}
                    />
                    <span>{activeProfile?.code ?? 'OPTIC'}</span>
                  </div>
                </div>
              )}

              {/* Delicate Ivory Shutter Flash */}
              {shutterFlash && (
                <div className="pointer-events-none absolute inset-0 bg-[#fff8ee]/75 transition-opacity duration-200" />
              )}
            </div>

            {/* Capture Bar Underneath Viewfinder */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.025] px-4 py-3">
              <div className="flex items-center gap-2.5 text-[12px] text-[#eef1f8]/62">
                <span className="font-mono text-[10px] tracking-[0.18em] text-[#f2c28b]/75 uppercase">
                  16:9 FILM
                </span>
                <span className="h-3 w-px bg-white/15" />
                <span className="font-serif">
                  {capturedImage
                    ? '已定格为暖调胶片帧，可在右侧附注并封存寄出'
                    : mode === 'idle'
                      ? '支持实时摄像头取景或载入本地照片'
                      : '对准窗外、灯光或手中物件，点击定格此刻'}
                </span>
              </div>

              {!capturedImage ? (
                <button
                  type="button"
                  disabled={!canCapture}
                  onClick={handleCapture}
                  className="inline-flex items-center gap-2 rounded-full border border-[#ffe2bd]/55 bg-gradient-to-r from-[#f2c28b] to-[#ffe4c2] px-5 py-2 font-serif text-[13px] font-medium tracking-[0.08em] text-[#140d06] shadow-[0_0_24px_rgba(242,194,139,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_0_34px_rgba(242,194,139,0.34)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  <span className="h-2 w-2 rounded-full bg-[#140d06]" />
                  <span>定格此刻给林微</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetake}
                  className="rounded-full border border-white/18 bg-white/[0.04] px-4 py-1.5 font-serif text-[12px] tracking-[0.06em] text-[#fff8ee]/84 transition hover:border-[#f2c28b]/50 hover:text-[#f2c28b]"
                >
                  重新取景
                </button>
              )}
            </div>
          </section>

          {/* Right: Live Optical Spectrum Telemetry + Lin Wei Response + Relay Actions */}
          <aside className="flex flex-col gap-3.5">
            {/* Telemetry Instrument Card */}
            <div className="rounded-[16px] border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.24em] text-[#f2c28b]/80 uppercase">
                  OPTICAL SPECTRUM
                </span>
                <span className="font-mono text-[10px] tracking-[0.14em] text-white/45">
                  {spectrum ? `${ANALYSIS_WIDTH}×${ANALYSIS_HEIGHT} LIVE` : 'STANDBY'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-[12px] border border-white/8 bg-[#050914]/60 px-3 py-2.5">
                  <div className="font-mono text-[9.5px] tracking-[0.2em] text-white/45 uppercase">
                    TEMP · 色温
                  </div>
                  <div className="hud-value mt-1 text-[18px] text-[#fff8ee]">
                    {spectrum ? `${spectrum.colorTempK}K` : '—'}
                  </div>
                </div>
                <div className="rounded-[12px] border border-white/8 bg-[#050914]/60 px-3 py-2.5">
                  <div className="font-mono text-[9.5px] tracking-[0.2em] text-white/45 uppercase">
                    LUMA · 照度
                  </div>
                  <div className="hud-value mt-1 text-[18px] text-[#fff8ee]">
                    {spectrum ? `${spectrum.luminancePct}%` : '—'}
                  </div>
                </div>
              </div>

              {/* Four-Band Spectrum Hairline Bars */}
              <div className="mt-3.5 space-y-2.5">
                {[
                  {
                    label: '暖金暮光 · WARM',
                    value: spectrum ? formatRatioPct(spectrum.warmRatio) : 0,
                    barColor: '#f2b880',
                  },
                  {
                    label: '天海蔚蓝 · SKY',
                    value: spectrum ? formatRatioPct(spectrum.skyBlueRatio) : 0,
                    barColor: '#8dbdf2',
                  },
                  {
                    label: '草木青绿 · LEAF',
                    value: spectrum ? formatRatioPct(spectrum.foliageGreenRatio) : 0,
                    barColor: '#8fc99a',
                  },
                  {
                    label: '夜灯反差 · LAMP',
                    value: spectrum ? formatRatioPct(spectrum.nightLampContrast) : 0,
                    barColor: '#d9c3a3',
                  },
                ].map((band) => (
                  <div key={band.label}>
                    <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.12em] text-white/58">
                      <span>{band.label}</span>
                      <span className="hud-value text-white/78">
                        {spectrum ? `${band.value}%` : '--'}
                      </span>
                    </div>
                    <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-out"
                        style={{
                          width: `${band.value}%`,
                          backgroundColor: band.barColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lin Wei Real-Time Poetic Response Card */}
            <div className="relative overflow-hidden rounded-[16px] border border-[#f2c28b]/22 bg-gradient-to-b from-[#f2c28b]/[0.07] to-[#050914]/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: activeProfile?.accentHex ?? '#f2c28b',
                      boxShadow: `0 0 10px ${activeProfile?.accentHex ?? '#f2c28b'}`,
                    }}
                  />
                  <span className="font-serif text-[12px] tracking-[0.12em] text-[#ffe2bd]">
                    林微的实时感应回响
                  </span>
                </div>
                {activeProfile && (
                  <span className="rounded-full border border-[#f2c28b]/28 bg-[#050914]/60 px-2.5 py-0.5 font-serif text-[10.5px] tracking-[0.06em] text-[#f2c28b]">
                    {activeProfile.label}
                  </span>
                )}
              </div>

              <p className="mt-3 min-h-[56px] font-serif text-[14px] leading-[1.85] tracking-[0.04em] text-[#fff8ee]/92">
                {activeResponseLine
                  ? `“${activeResponseLine}”`
                  : '“透镜尚未开启。当你举起镜头或放进一张照片，我就能隔着地幔读懂你眼前的光。”'}
              </p>

              <div className="mt-2.5 flex items-center justify-between font-mono text-[9.5px] tracking-[0.16em] text-white/38">
                <span>RELAY · 6371 KM</span>
                <span>SUNSET-06</span>
              </div>
            </div>

            {/* Post-Capture Note + Relay Controls */}
            {capturedImage ? (
              <div className="rounded-[16px] border border-[#f2c28b]/24 bg-[#080e1d]/82 p-4">
                <div className="font-mono text-[10px] tracking-[0.22em] text-[#f2c28b]/82 uppercase">
                  ARCHIVE &amp; RELAY · 封存与寄送
                </div>

                <div className="mt-3 space-y-2.5">
                  <label className="block">
                    <span className="block font-serif text-[11px] tracking-[0.06em] text-white/56">
                      此刻所在地点（选填）
                    </span>
                    <input
                      type="text"
                      value={cityInput}
                      maxLength={24}
                      onChange={(event) => {
                        setCityInput(event.target.value)
                        setSavedEntryId(null)
                      }}
                      placeholder="例如：上海窗边 / 杭州雨夜 / 图书馆三楼"
                      className="mt-1 w-full rounded-[10px] border border-white/12 bg-[#050914]/80 px-3 py-2 font-serif text-[13px] text-[#fff8ee] placeholder:text-white/28 focus:border-[#f2c28b]/55 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="block font-serif text-[11px] tracking-[0.06em] text-white/56">
                      留给林微的一行附注（选填）
                    </span>
                    <input
                      type="text"
                      value={noteInput}
                      maxLength={120}
                      onChange={(event) => {
                        setNoteInput(event.target.value)
                        setSavedEntryId(null)
                      }}
                      placeholder={activeProfile?.defaultNote ?? '把此刻眼前的这道光寄给你。'}
                      className="mt-1 w-full rounded-[10px] border border-white/12 bg-[#050914]/80 px-3 py-2 font-serif text-[13px] text-[#fff8ee] placeholder:text-white/28 focus:border-[#f2c28b]/55 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSendToPost}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[#ffe2bd]/60 bg-gradient-to-r from-[#f2c28b] to-[#ffe4c2] px-4 py-2.5 font-serif text-[13px] font-medium tracking-[0.08em] text-[#140d06] shadow-[0_0_26px_rgba(242,194,139,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(242,194,139,0.36)]"
                  >
                    <span>封存并寄往地球电台 →</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToAlbum}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/16 bg-white/[0.04] px-4 py-2 font-serif text-[12.5px] tracking-[0.06em] text-[#fff8ee]/86 transition hover:border-[#f2c28b]/50 hover:bg-[#f2c28b]/10 hover:text-[#ffe2bd]"
                  >
                    <span>{savedEntryId ? '已收入奇境纪念册 ✓' : '收入奇境纪念册'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[14px] border border-white/8 bg-white/[0.018] px-4 py-3 font-serif text-[11.5px] leading-relaxed text-white/46">
                所有画面仅在你的浏览器本地进行 48×36 像素光色演算，不会自动上传；只有在你点击「封存并寄往地球电台」后，才会带入明信片寄送工坊。
              </div>
            )}
          </aside>
        </div>

        {/* Subtle Editorial Toast */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="animate-fade-up pointer-events-none fixed right-6 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-[95] rounded-full border border-[#f2c28b]/45 bg-[#050914]/92 px-4 py-2 font-serif text-[12.5px] tracking-[0.04em] text-[#ffe2bd] shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-xl"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export function SensoryLensModal({
  open,
  onClose,
  onSavedToAlbum,
  onSendToPost,
}: SensoryLensModalProps): JSX.Element | null {
  if (!open) return null
  return (
    <SensoryLensContent
      onClose={onClose}
      onSavedToAlbum={onSavedToAlbum}
      onSendToPost={onSendToPost}
    />
  )
}
