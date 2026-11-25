import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import {
  AMBIENCE_OPTIONS,
  PARTICLE_OPTIONS,
  VISION_PRESETS,
  getPresetImage,
  getPresetThumb,
  windLabel,
} from '../data/presetVisions'
import type {
  AmbientKind,
  FocusPoint,
  ParticleKind,
  PublishResult,
  StudioMode,
  VisionPacket,
  VisionPreset,
  VisionVisibility,
} from '../types/vision'
import { WIND_DESCRIPTIONS } from '../types/vision'
import { citySignature } from '../data/citySignature'
import {
  CARD_FRAMES,
  CARD_STICKERS,
  DRIFT_INBOX_LETTERS,
  LOCAL_STAMPS,
  findStampForCity,
  type CardFrameMeta,
} from '../data/mailboxData'
import { loadAlbum, saveAlbumEntry, type AlbumEntry } from '../services/albumStorage'
import { countVisionSent } from '../services/journey'
import { buildShareLink, deleteMyVision, listMyVisions, publishRadioSignal, type MyVision } from '../services/visionApi'
import { compressImage, dataUrlBytes, formatBytes } from '../utils/imageCompress'
import { POSTCARD_TONES, type PostcardTone } from '../utils/postcardExport'
import { getCityWhisper, type StoryRelayState } from '../utils/storyRelay'
import { PostcardPreviewModal } from './PostcardPreviewModal'
import { VisionViewport3D } from './VisionViewport3D'

interface PostVisionStudioProps {
  muted: boolean
  onBack: () => void
  onOpenRadio: (code: string) => void
  relay?: StoryRelayState
  onRelayCity?: (city: string) => void
  initialAlbumEntry?: AlbumEntry | null
  onConsumeInitialEntry?: () => void
}

const STUDIO_TABS: { id: 1 | 2 | 3; label: string }[] = [
  { id: 1, label: '1. 风景卡片' },
  { id: 2, label: '2. 邮票与装饰' },
  { id: 3, label: '3. 写信寄出' },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function makeId() {
  return `vp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="font-serif text-[12.5px] tracking-[0.04em] text-white/72">{children}</div>
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-white/12 bg-[#081022]/75 px-3 py-2 font-sans text-[13px] text-[#fff8ee] outline-none transition placeholder:text-white/30 focus:border-signal/60 focus:bg-[#081022]'

export function PostVisionStudio({
  muted,
  onBack,
  onOpenRadio,
  relay,
  onRelayCity,
  initialAlbumEntry,
  onConsumeInitialEntry,
}: PostVisionStudioProps) {
  const firstPreset = VISION_PRESETS[0]
  const [mixer] = useState(() => new AmbientMixer())
  const [packetId] = useState(makeId)
  const [createdAt, setCreatedAt] = useState(() => Date.now())
  const [thumbs] = useState<Record<string, string>>(() =>
    Object.fromEntries(VISION_PRESETS.map((preset) => [preset.id, getPresetThumb(preset.id)])),
  )

  const [albumEntries, setAlbumEntries] = useState<AlbumEntry[]>(() => loadAlbum())
  const [mailboxTab, setMailboxTab] = useState<'compose' | 'inbox'>('compose')
  const [cardView, setCardView] = useState<'viewport' | 'letter'>(() =>
    initialAlbumEntry ? 'letter' : 'viewport',
  )
  const [selectedStampId, setSelectedStampId] = useState<string>(() =>
    initialAlbumEntry ? findStampForCity(initialAlbumEntry.city) : findStampForCity(firstPreset.city),
  )
  const [selectedFrameId, setSelectedFrameId] = useState<CardFrameMeta['id']>('navy-gold')
  const [selectedSticker, setSelectedSticker] = useState<string>(CARD_STICKERS[0])
  const [letterWeather, setLetterWeather] = useState<string>(() =>
    initialAlbumEntry?.mood === 'night'
      ? '星夜晴朗'
      : initialAlbumEntry?.mood === 'dawn'
        ? '晨光微风'
        : '黄昏微风',
  )
  const [letterBody, setLetterBody] = useState<string>(
    () =>
      initialAlbumEntry?.note ||
      '把今天看到的这一刻风景和心情折进明信片，贴好当地邮票寄给远方的你。',
  )
  const [inboxIdx, setInboxIdx] = useState(0)
  const [inboxLiked, setInboxLiked] = useState<string[]>([])
  const [inboxSaved, setInboxSaved] = useState<string[]>([])

  const [presetId, setPresetId] = useState<string | null>(() =>
    initialAlbumEntry ? null : firstPreset.id,
  )
  const [image, setImage] = useState(() =>
    initialAlbumEntry ? initialAlbumEntry.image : getPresetImage(firstPreset.id),
  )
  const [title, setTitle] = useState(() =>
    initialAlbumEntry ? initialAlbumEntry.sceneTitle : firstPreset.title,
  )
  const [sender, setSender] = useState('扫码旅人')
  const [city, setCity] = useState(() =>
    initialAlbumEntry ? initialAlbumEntry.city : firstPreset.city,
  )
  const [particles, setParticles] = useState<ParticleKind>(() =>
    initialAlbumEntry?.mood === 'night' ? 'firefly' : firstPreset.particles,
  )
  const [ambience, setAmbience] = useState<AmbientKind>(() => {
    if (!initialAlbumEntry) return firstPreset.ambience
    if (initialAlbumEntry.city.includes('悉尼') || initialAlbumEntry.city.includes('夏威夷')) return 'ocean'
    if (initialAlbumEntry.city.includes('哈尔滨')) return 'snow'
    if (initialAlbumEntry.city.includes('南京')) return 'library'
    if (initialAlbumEntry.city.includes('上海')) return 'city'
    return 'wind'
  })
  const [tempC, setTempC] = useState(() => {
    if (!initialAlbumEntry) return firstPreset.tempC
    if (initialAlbumEntry.city.includes('哈尔滨')) return -7
    if (initialAlbumEntry.city.includes('悉尼')) return 28
    if (initialAlbumEntry.city.includes('夏威夷')) return 27
    return 18
  })
  const [windLevel, setWindLevel] = useState(firstPreset.windLevel)
  const [scent, setScent] = useState(firstPreset.scentTag)
  const [focus, setFocus] = useState<FocusPoint[]>(() =>
    initialAlbumEntry
      ? [
          {
            id: 'album-focus-1',
            x: 0.5,
            y: 0.55,
            note: initialAlbumEntry.note,
          },
        ]
      : firstPreset.focus,
  )

  const [voice, setVoice] = useState<string | null>(null)
  const [voiceSeconds, setVoiceSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(10)
  const [recordError, setRecordError] = useState<string | null>(null)
  const recorderRef = useRef<{
    recorder: MediaRecorder
    stream: MediaStream
    interval: number
  } | null>(null)

  const [volume, setVolume] = useState(0.62)
  const [soundOn, setSoundOn] = useState(false)
  const [mode, setMode] = useState<StudioMode>('edit')
  const [step, setStep] = useState<1 | 2 | 3>(() => (initialAlbumEntry ? 2 : 1))

  useEffect(() => {
    if (initialAlbumEntry) onConsumeInitialEntry?.()
  }, [initialAlbumEntry, onConsumeInitialEntry])

  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [photoTone, setPhotoTone] = useState<PostcardTone>('natural')

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const [postcardOpen, setPostcardOpen] = useState(false)
  const [visibility, setVisibility] = useState<VisionVisibility>('public')
  const [publishing, setPublishing] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [mineOpen, setMineOpen] = useState(false)
  const [mine, setMine] = useState<MyVision[]>([])
  const [confirmCode, setConfirmCode] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3400)
  }

  useEffect(() => {
    mixer.setMuted(muted)
  }, [mixer, muted])

  useEffect(() => {
    mixer.setVolume(volume)
  }, [mixer, volume])

  useEffect(() => {
    mixer.setKind(ambience)
  }, [mixer, ambience])

  useEffect(() => {
    mixer.setActive(soundOn)
    if (soundOn) void mixer.ensure()
  }, [mixer, soundOn])

  useEffect(() => {
    mixer.revive()
    return () => {
      mixer.dispose()
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      const active = recorderRef.current
      if (active) {
        active.recorder.onstop = null
        active.recorder.ondataavailable = null
        try {
          if (active.recorder.state !== 'inactive') active.recorder.stop()
        } catch {
          /* ignore */
        }
        active.stream.getTracks().forEach((track) => track.stop())
        window.clearInterval(active.interval)
        recorderRef.current = null
      }
    }
  }, [mixer])

  const livePacket = useMemo<VisionPacket>(
    () => ({
      id: packetId,
      title: title.trim() || '未命名的视界',
      sender: sender.trim() || '我',
      city: city.trim() || '地球某处',
      image,
      particles,
      ambience,
      voice,
      tempC,
      windLevel,
      scentTag: scent.trim(),
      focus,
      createdAt,
    }),
    [packetId, title, sender, city, image, particles, ambience, voice, tempC, windLevel, scent, focus, createdAt],
  )

  const activeStamp = LOCAL_STAMPS.find((s) => s.id === selectedStampId) ?? LOCAL_STAMPS[0]
  const activeFrame = CARD_FRAMES.find((f) => f.id === selectedFrameId) ?? CARD_FRAMES[0]
  const activeInboxLetter = DRIFT_INBOX_LETTERS[inboxIdx % DRIFT_INBOX_LETTERS.length]
  const activeInboxStamp =
    LOCAL_STAMPS.find((s) => s.id === activeInboxLetter.stampId) ?? LOCAL_STAMPS[0]

  const buildPacket = (): VisionPacket => {
    const cleanLetter = letterBody.trim()
    const nextFocus =
      focus.length > 0
        ? focus
        : cleanLetter
          ? [{ id: 'letter-focus-1', x: 0.5, y: 0.54, note: cleanLetter.slice(0, 88) }]
          : []
    return {
      ...livePacket,
      scentTag: [selectedSticker, letterWeather, scent.trim()].filter(Boolean).join(' · ').slice(0, 28),
      focus: nextFocus,
      createdAt: Date.now(),
    }
  }

  const applyAlbumCard = (entry: AlbumEntry) => {
    setPresetId(null)
    setCreatedAt(Date.now())
    setImage(entry.image)
    setTitle(entry.sceneTitle)
    setCity(entry.city)
    setSelectedStampId(findStampForCity(entry.city))
    setLetterWeather(entry.mood === 'night' ? '星夜晴朗' : entry.mood === 'dawn' ? '晨光微风' : '黄昏晴朗')
    setLetterBody(entry.note || '在纪念册里挑了这张风景，写信寄给你。')
    setFocus([{ id: 'alb-' + entry.id, x: 0.5, y: 0.54, note: entry.note.slice(0, 88) }])
    setUploadNote('纪念册精选卡片 · ' + entry.city)
    setCardView('letter')
    setStep(2)
    showToast('已装载纪念册卡片 · 请挑一枚当地邮票')
  }

  const applyPreset = (preset: VisionPreset) => {
    setPresetId(preset.id)
    setCreatedAt(Date.now())
    setImage(getPresetImage(preset.id))
    setTitle(preset.title)
    setSender(preset.sender)
    setCity(preset.city)
    setParticles(preset.particles)
    setAmbience(preset.ambience)
    setTempC(preset.tempC)
    setWindLevel(preset.windLevel)
    setScent(preset.scentTag)
    setFocus(preset.focus)
    setSelectedStampId(findStampForCity(preset.city))
    setUploadNote(null)
    setMode('edit')
    setSoundOn(true)
    void mixer.ensure()
    showToast(`已切换画面 · ${preset.title}`)
  }

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const result = await compressImage(file)
      setImage(result.dataUrl)
      setPresetId(null)
      setCreatedAt(Date.now())
      setFocus([])
      setUploadNote(`${result.width}×${result.height} · ${formatBytes(result.bytes)}`)
      if (presetId) setTitle(`我的这一秒 · ${city}`)
      showToast(`照片已导入 · ${formatBytes(result.bytes)}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '图片处理失败')
    } finally {
      setUploading(false)
    }
  }

  const handleFileRef = useRef(handleFile)

  useEffect(() => {
    handleFileRef.current = handleFile
  })

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            void handleFileRef.current(file)
            return
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const stopRecording = () => {
    const active = recorderRef.current
    if (!active) return
    window.clearInterval(active.interval)
    try {
      if (active.recorder.state !== 'inactive') active.recorder.stop()
    } catch {
      /* ignore */
    }
  }

  const startRecording = async () => {
    if (recording) return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const message = '当前浏览器不支持现场录音，其他功能不受影响'
      setRecordError(message)
      showToast(message)
      return
    }
    setRecordError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = candidates.find((item) => MediaRecorder.isTypeSupported(item))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      const startedAt = performance.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const active = recorderRef.current
        if (active) window.clearInterval(active.interval)
        recorderRef.current = null
        setRecording(false)
        setRecordSeconds(10)
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) {
          setRecordError('没有捕捉到声音，其他功能不受影响')
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const url = String(reader.result ?? '')
          if (!url) return
          setVoice(url)
          setVoiceSeconds(Math.min(10, (performance.now() - startedAt) / 1000))
          if (soundOn && !muted) void mixer.playVoice(url)
          showToast('10 秒现场原声已录好')
        }
        reader.readAsDataURL(blob)
      }
      recorder.start()
      setRecording(true)
      setRecordSeconds(10)
      const interval = window.setInterval(() => {
        const remaining = Math.max(0, 10 - Math.floor((performance.now() - startedAt) / 1000))
        setRecordSeconds(remaining)
        if (remaining <= 0) {
          window.clearInterval(interval)
          const active = recorderRef.current
          if (active) {
            try {
              if (active.recorder.state !== 'inactive') active.recorder.stop()
            } catch {
              /* ignore */
            }
          }
        }
      }, 200)
      recorderRef.current = { recorder, stream, interval }
    } catch (error) {
      const denied =
        error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      const message = denied
        ? '未获得麦克风权限，已跳过录音'
        : '无法启动麦克风，已跳过录音'
      setRecordError(message)
      showToast(message)
    }
  }

  const removeVoice = () => {
    mixer.stopVoice()
    setVoice(null)
    setVoiceSeconds(0)
    showToast('现场原声已移除')
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    if (next) void mixer.ensure()
  }

  const chooseAmbience = (id: AmbientKind) => {
    setAmbience(id)
    if (id !== 'none') {
      setSoundOn(true)
      void mixer.ensure()
    }
  }

  const switchMode = (next: StudioMode) => {
    setMode(next)
    if (next === 'preview') {
      if (ambience !== 'none') {
        setSoundOn(true)
        void mixer.ensure()
      }
      if (focus.length === 0) showToast('还没有贴留言 · 也可以直接沉浸预览')
    }
  }

  const handleAddFocus = (x: number, y: number) => {
    if (focus.length >= 3) {
      showToast('画面留言最多 3 条 · 删除一条后再添加')
      return
    }
    const id = `gaze-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    setFocus((current) => (current.length >= 3 ? current : [...current, { id, x, y, note: '' }]))
    setStep(3)
    setMode('edit')
    showToast(`已贴上第 ${focus.length + 1} 处留言 · 可在下方填写文字`)
  }

  const updateFocusNote = (id: string, note: string) => {
    setFocus((current) => current.map((point) => (point.id === id ? { ...point, note } : point)))
  }

  const removeFocus = (id: string) => {
    setFocus((current) => current.filter((point) => point.id !== id))
  }

  const handlePlayVoice = async () => {
    if (!voice) return
    if (muted) {
      showToast('全局静音中 · 请先开启右上角声音')
      return
    }
    const ok = await mixer.playVoice(voice)
    showToast(ok ? '正在播放现场原声…' : '原声播放失败')
  }

  const handleHeartbeat = () => {
    return mixer.playHeartbeat()
  }

  const openPostcardModal = () => {
    setPostcardOpen(true)
  }

  const handlePublish = async () => {
    if (publishing) return
    const packet = buildPacket()
    setPublishing(true)
    try {
      const result = await publishRadioSignal(packet, visibility)
      countVisionSent()
      if (visibility === 'public') onRelayCity?.(packet.city)
      setPublishResult(result)
      setPublishOpen(true)
      setCopied(false)
      showToast(
        result.source === 'cloud'
          ? visibility === 'public'
            ? '这片风景已投递到地球表面电台'
            : '私密分享链接已生成'
          : '已封存在本机电台 · 分享链接仍可打开',
      )
    } catch {
      showToast('已封存在本机电台 · 分享链接仍可打开')
    } finally {
      setPublishing(false)
    }
  }

  const writeClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const field = document.createElement('textarea')
      field.value = link
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      try {
        document.execCommand('copy')
      } catch {
        /* selection remains available */
      }
      field.remove()
    }
  }

  const copyShareLink = async () => {
    if (!publishResult) return
    await writeClipboard(publishResult.link)
    setCopied(true)
    showToast('分享链接已复制')
  }

  const openMine = () => {
    setMine(listMyVisions())
    setConfirmCode(null)
    setMineOpen(true)
  }

  const mineCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mineOpen) return
    mineCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMineOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mineOpen])

  const removeMine = async (code: string) => {
    if (deleting) return
    setDeleting(code)
    const source = await deleteMyVision(code)
    setMine(listMyVisions())
    setConfirmCode(null)
    setDeleting(null)
    showToast(source === 'cloud' ? '已从电台撤回，本机也清掉了' : '已从本机移除')
  }

  const voiceBytes = voice ? dataUrlBytes(voice) : 0
  const activeToneMeta = POSTCARD_TONES.find((item) => item.id === photoTone) ?? POSTCARD_TONES[0]

  return (
    <main
      className="no-scrollbar relative z-10 h-dvh w-full overflow-y-auto overflow-x-hidden lg:overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0b1630 0%, #122347 48%, #091122 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 72% 24%, rgba(92, 162, 240, 0.18), transparent 72%), radial-gradient(45% 40% at 22% 84%, rgba(242, 194, 139, 0.1), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-3 px-3 pb-6 pt-[64px] sm:px-5 sm:pt-[76px] lg:h-full lg:min-h-0">
        {/* 视野信箱双模式切换条：写信寄视野 vs 漂流收件箱 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="返回上一级"
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/14 bg-white/[0.04] px-3 py-1.5 font-serif text-[12px] text-white/80 transition hover:border-signal/55 hover:text-signal"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              返回
            </button>
            <div className="flex rounded-full border border-white/14 bg-[#081228]/72 p-0.5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setMailboxTab('compose')}
                className={
                  'rounded-full px-3.5 py-1.5 font-serif text-[12px] tracking-[0.04em] transition ' +
                  (mailboxTab === 'compose'
                    ? 'bg-signal font-medium text-[#170f07] shadow-[0_4px_14px_-4px_rgba(242,194,139,0.75)]'
                    : 'text-white/75 hover:text-white')
                }
              >
                ✉ 写信寄视野
              </button>
              <button
                type="button"
                onClick={() => setMailboxTab('inbox')}
                className={
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-serif text-[12px] tracking-[0.04em] transition ' +
                  (mailboxTab === 'inbox'
                    ? 'bg-signal font-medium text-[#170f07] shadow-[0_4px_14px_-4px_rgba(242,194,139,0.75)]'
                    : 'text-white/75 hover:text-white')
                }
              >
                <span>📮 漂流收件箱</span>
                <span className="rounded-full bg-white/15 px-1.5 py-0.2 font-mono text-[10px]">
                  {DRIFT_INBOX_LETTERS.length}
                </span>
              </button>
            </div>
          </div>
          <div className="hidden font-serif text-[11.5px] tracking-[0.04em] text-white/55 sm:block">
            从纪念册挑风景 · 贴上当地邮票写信随机漂流 · 也能拆开来自远方的明信片祝福
          </div>
        </div>

        {mailboxTab === 'inbox' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center py-2">
            <div className="cinema-surface animate-fade-up relative w-full max-w-[780px] overflow-hidden rounded-[28px] border-signal/35 p-5 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
                    <span className="font-mono text-[10.5px] tracking-[0.18em] text-signal/85">
                      DRIFT POST · 来自「{activeInboxLetter.fromTitle}」的视野
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-serif text-[20px] font-light tracking-[0.06em] text-[#fff8ee] sm:text-[24px]">
                    {activeInboxLetter.city} · {activeInboxLetter.tempC}°C · {activeInboxLetter.weather}
                  </h2>
                </div>

                {/* 锯齿邮票装饰 */}
                <div
                  className="relative flex shrink-0 flex-col items-center rounded-xl border-2 border-dashed px-3 py-2 text-center shadow-lg"
                  style={{
                    borderColor: activeInboxStamp.accent,
                    backgroundColor: 'rgba(12, 22, 46, 0.85)',
                  }}
                >
                  <span className="text-[16px] leading-none">{activeInboxStamp.motif}</span>
                  <span className="mt-1 font-serif text-[11px] text-[#fff8ee]">
                    {activeInboxStamp.title}
                  </span>
                  <span className="font-mono text-[9.5px] text-signal/85">
                    {activeInboxStamp.denom}
                  </span>
                </div>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black/40">
                <img
                  src={getPresetImage(activeInboxLetter.presetId)}
                  alt={activeInboxLetter.city}
                  className="aspect-[16/9] max-h-[300px] w-full object-cover"
                  draggable={false}
                />
                <span className="absolute left-3 top-3 rounded-full border border-white/18 bg-[#070e1f]/75 px-3 py-1 font-serif text-[11px] text-signal backdrop-blur-md">
                  {activeInboxLetter.sticker}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4 sm:p-5">
                <p className="font-serif text-[14.5px] leading-[1.9] tracking-[0.04em] text-[#fff8ee]/92">
                  “{activeInboxLetter.letter}”
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 font-serif text-[12px] text-white/62">
                  <span>邮戳号 · #{activeInboxLetter.id.toUpperCase()}</span>
                  <span className="text-signal">署名：{activeInboxLetter.sender}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInboxLiked((cur) =>
                        cur.includes(activeInboxLetter.id)
                          ? cur
                          : [...cur, activeInboxLetter.id],
                      )
                      if (soundOn && !muted) {
                        void mixer.ensure()
                        mixer.playInteractionSfx('star')
                      }
                      showToast('已向「' + activeInboxLetter.sender + '」回赠一颗同频祝福 ❤️')
                    }}
                    className={
                      'rounded-full border px-3.5 py-2 font-serif text-[12px] transition ' +
                      (inboxLiked.includes(activeInboxLetter.id)
                        ? 'border-signal/60 bg-signal/18 text-signal'
                        : 'border-white/16 bg-white/[0.04] text-white/82 hover:border-signal/50 hover:text-signal')
                    }
                  >
                    {inboxLiked.includes(activeInboxLetter.id) ? '已送出祝福 ♥' : '回赠祝福 ♡'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const saved = saveAlbumEntry({
                        id: 'drift-' + activeInboxLetter.id + '-' + Date.now(),
                        sceneId: 'shanghai',
                        sceneTitle: activeInboxLetter.fromTitle + ' · ' + activeInboxLetter.city,
                        city: activeInboxLetter.city,
                        mood: activeInboxLetter.tempC < 0 ? 'night' : 'dusk',
                        image: getPresetImage(activeInboxLetter.presetId),
                        note: activeInboxLetter.letter + ' —— ' + activeInboxLetter.sender,
                        interactions: 1,
                        createdAt: Date.now(),
                        awakened: true,
                        stampTitle: activeInboxStamp.title,
                      })
                      setAlbumEntries(saved)
                      setInboxSaved((cur) =>
                        cur.includes(activeInboxLetter.id) ? cur : [...cur, activeInboxLetter.id],
                      )
                      showToast('已把这封远方明信片收进我的纪念册')
                    }}
                    className="rounded-full border border-white/16 bg-white/[0.04] px-3.5 py-2 font-serif text-[12px] text-white/82 transition hover:border-signal/50 hover:text-signal"
                  >
                    {inboxSaved.includes(activeInboxLetter.id) ? '✓ 已收进纪念册' : '收进我的纪念册'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInboxIdx((prev) => (prev + 1) % DRIFT_INBOX_LETTERS.length)
                    if (soundOn && !muted) {
                      void mixer.ensure()
                      mixer.playInteractionSfx('lamp')
                    }
                  }}
                  className="btn-primary"
                >
                  拆开下一封随机视野 ✉
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(360px,0.39fr)_minmax(0,0.61fr)] lg:gap-4">
        <section className="cinema-surface-soft order-1 flex h-[44dvh] min-h-[300px] flex-col overflow-hidden rounded-[28px] lg:order-2 lg:h-full lg:min-h-0">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={onBack}
                aria-label="返回上一级"
                className="flex shrink-0 items-center gap-1 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[12px] text-white/80 transition hover:border-signal/55 hover:text-signal"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                返回
              </button>
              <h1 className="min-w-0 truncate font-serif text-[15px] tracking-[0.06em] text-[#fff8ee] sm:text-[16px]">
                {livePacket.title}
              </h1>
            </div>
            <div className="flex shrink-0 rounded-full border border-white/12 bg-white/[0.04] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setCardView('viewport')
                  switchMode('edit')
                }}
                aria-pressed={cardView === 'viewport' && mode === 'edit'}
                className={`rounded-full px-2.5 py-1 font-serif text-[11.5px] tracking-[0.04em] transition ${
                  cardView === 'viewport' && mode === 'edit'
                    ? 'bg-signal text-[#170f07] font-medium'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                贴留言
              </button>
              <button
                type="button"
                onClick={() => setCardView('letter')}
                aria-pressed={cardView === 'letter'}
                className={`rounded-full px-2.5 py-1 font-serif text-[11.5px] tracking-[0.04em] transition ${
                  cardView === 'letter'
                    ? 'bg-signal text-[#170f07] font-medium'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                信笺实景
              </button>
              <button
                type="button"
                onClick={() => {
                  setCardView('viewport')
                  switchMode('preview')
                }}
                aria-pressed={cardView === 'viewport' && mode === 'preview'}
                className={`rounded-full px-2.5 py-1 font-serif text-[11.5px] tracking-[0.04em] transition ${
                  cardView === 'viewport' && mode === 'preview'
                    ? 'bg-signal text-[#170f07] font-medium'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                沉浸预览
              </button>
            </div>
          </div>

          <div
            className="relative min-h-0 flex-1"
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files?.[0]
              if (file) void handleFile(file)
            }}
          >
            <VisionViewport3D
              packet={livePacket}
              mode={mode}
              onAddFocus={handleAddFocus}
              onHeartbeat={handleHeartbeat}
              onPlayVoice={() => void handlePlayVoice()}
              onSceneInteract={(kind) => {
                if (soundOn && !muted) {
                  void mixer.ensure()
                  mixer.playInteractionSfx(kind)
                }
              }}
              photoFilterCss={activeToneMeta.cssFilter}
            />
            {cardView === 'letter' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#060c1a]/78 p-4 backdrop-blur-md">
                <div
                  className={
                    'relative w-full max-w-[490px] rounded-[24px] border-2 p-4 shadow-2xl sm:p-5 ' +
                    activeFrame.borderClass +
                    ' ' +
                    activeFrame.bgClass +
                    ' ' +
                    activeFrame.textClass
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.18em] text-signal/85">
                        POSTCARD · {city || '某座城'}
                      </div>
                      <div className="mt-0.5 font-serif text-[15px] tracking-[0.04em]">
                        {city} {tempC}°C · {letterWeather}
                      </div>
                    </div>
                    <div
                      className="flex flex-col items-center rounded-xl border-2 border-dashed px-2.5 py-1.5 text-center"
                      style={{ borderColor: activeStamp.accent }}
                    >
                      <span className="text-[14px] leading-none">{activeStamp.motif}</span>
                      <span className="mt-1 font-serif text-[10px]">{activeStamp.title}</span>
                      <span className="font-mono text-[9px] text-signal/85">{activeStamp.denom}</span>
                    </div>
                  </div>
                  <div className="relative mt-3 overflow-hidden rounded-xl border border-white/15">
                    <img
                      src={image}
                      alt={title}
                      className="aspect-video w-full object-cover"
                      style={{ filter: activeToneMeta.cssFilter }}
                      draggable={false}
                    />
                    <span className="absolute bottom-2 left-2 rounded-full bg-[#070e1f]/75 px-2.5 py-0.5 font-serif text-[10.5px] text-signal backdrop-blur-sm">
                      {selectedSticker}
                    </span>
                  </div>
                  <p className="mt-3 font-serif text-[13px] leading-[1.8]">
                    “{letterBody || '把这一刻的天色与风声折进信封寄给你。'}”
                  </p>
                  <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 font-serif text-[11.5px] text-white/65">
                    <span>{title}</span>
                    <span className="text-signal">署名：{sender || '我'}</span>
                  </div>
                </div>
              </div>
            )}
            {dragging && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#091226]/75 backdrop-blur-sm">
                <div className="rounded-2xl border border-dashed border-signal/65 bg-[#0e1a36]/90 px-6 py-4 text-center">
                  <div className="font-serif text-[14px] tracking-[0.06em] text-[#fff8ee]">
                    松开手指，把这张照片放进明信片
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="cinema-surface order-2 flex min-h-0 flex-col overflow-hidden rounded-[28px] lg:order-1 lg:h-full">
          <div className="grid grid-cols-3 gap-1 border-b border-white/10 p-2">
            {STUDIO_TABS.map((tab) => {
              const active = step === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStep(tab.id)}
                  className={`rounded-2xl px-2 py-2 font-serif text-[12px] tracking-[0.04em] transition sm:text-[12.5px] ${
                    active
                      ? 'bg-signal text-[#170f07] font-medium shadow-[0_6px_20px_-6px_rgba(242,194,139,0.75)]'
                      : 'text-white/68 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="studio-scroll min-h-0 flex-1 overflow-y-auto p-4">
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>
                      从纪念册选取风景卡片 ({albumEntries.length})
                    </SectionLabel>
                    <button
                      type="button"
                      onClick={() => setAlbumEntries(loadAlbum())}
                      className="font-serif text-[11px] text-signal/85 hover:underline"
                    >
                      刷新
                    </button>
                  </div>
                  {albumEntries.length === 0 ? (
                    <div className="mt-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3.5 py-3 font-serif text-[11.5px] leading-[1.7] text-white/58">
                      纪念册暂无照片：可在「04 纪念册」或「01 序章按 P」拍下风景卡片后直接来此贴邮票寄出，也可先用下方预设风景。
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {albumEntries.slice(0, 6).map((entry) => {
                        const active = image === entry.image
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => applyAlbumCard(entry)}
                            className={`group relative overflow-hidden rounded-2xl border text-left transition ${
                              active
                                ? 'border-signal shadow-[0_0_20px_-6px_rgba(242,194,139,0.65)]'
                                : 'border-white/14 hover:border-signal/45'
                            }`}
                          >
                            <img
                              src={entry.image}
                              alt={entry.sceneTitle}
                              className="h-[58px] w-full object-cover opacity-88 transition group-hover:opacity-100"
                              draggable={false}
                            />
                            <span className="absolute inset-0 bg-gradient-to-t from-[#081022]/92 via-transparent to-transparent" />
                            <span className="absolute bottom-1 left-1.5 right-1.5 block truncate font-serif text-[10.5px] text-[#fff8ee]">
                              {entry.city} · {entry.sceneTitle.split(' · ')[0]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <SectionLabel>选一张风景预设</SectionLabel>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    {VISION_PRESETS.map((preset) => {
                      const active = presetId === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`group relative overflow-hidden rounded-2xl border text-left transition ${
                            active
                              ? 'border-signal shadow-[0_0_24px_-8px_rgba(242,194,139,0.55)]'
                              : 'border-white/12 hover:border-white/30'
                          }`}
                        >
                          <img
                            src={thumbs[preset.id]}
                            alt={preset.title}
                            className={`h-[68px] w-full object-cover transition duration-500 ${
                              active ? 'opacity-95' : 'opacity-75 group-hover:opacity-95'
                            }`}
                            draggable={false}
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-[#081022]/90 via-[#081022]/25 to-transparent" />
                          <span className="absolute bottom-2 left-2.5 right-2.5 block truncate font-serif text-[12px] text-[#fff8ee]">
                            {preset.title.split(' · ')[0]}
                          </span>
                          {active && (
                            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-signal text-[#170f07]">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>或者换上你拍的照片</SectionLabel>
                    <span className="font-sans text-[10.5px] text-white/40">支持拖拽 / Ctrl+V 粘贴</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <label
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-3.5 py-3 font-serif text-[12.5px] text-white/75 transition hover:border-signal/60 hover:bg-signal/10 hover:text-[#fff8ee] ${
                        uploading ? 'pointer-events-none opacity-60' : ''
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void handleFile(file)
                          event.target.value = ''
                        }}
                      />
                      {uploading ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-signal/30 border-t-signal" />
                          正在压缩照片…
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          上传本地照片
                        </>
                      )}
                    </label>
                    <label
                      className={`flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-signal/35 bg-signal/10 px-3.5 py-3 font-serif text-[12.5px] text-signal transition hover:border-signal/65 hover:bg-signal/18 ${
                        uploading ? 'pointer-events-none opacity-60' : ''
                      }`}
                      title="调用相机拍下眼前的风景"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={uploading}
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void handleFile(file)
                          event.target.value = ''
                        }}
                      />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.8a1 1 0 0 1 .83-.45h2.94a1 1 0 0 1 .83.45L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      拍下此刻
                    </label>
                  </div>
                  {presetId === null && uploadNote && (
                    <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-signal/30 bg-signal/[0.06] p-2">
                      <img
                        src={image}
                        alt="已上传照片预览"
                        className="h-11 w-16 shrink-0 rounded-xl border border-white/12 object-cover"
                        style={activeToneMeta.cssFilter ? { filter: activeToneMeta.cssFilter } : undefined}
                        draggable={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-serif text-[12px] text-[#fff8ee]">已使用你的照片</div>
                        <div className="mt-0.5 font-sans text-[11px] text-signal/85">{uploadNote}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <SectionLabel>明信片色调滤镜</SectionLabel>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {POSTCARD_TONES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPhotoTone(option.id)}
                        className={`rounded-xl border px-2.5 py-2 font-serif text-[12px] transition ${
                          photoTone === option.id
                            ? 'border-signal/65 bg-signal/15 text-[#fff8ee]'
                            : 'border-white/12 bg-white/[0.03] text-white/65 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel>空气里的微粒</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PARTICLE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setParticles(option.id)}
                        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-serif text-[12px] transition ${
                          particles === option.id
                            ? 'border-signal/65 bg-signal/15 text-[#fff8ee]'
                            : 'border-white/12 bg-white/[0.03] text-white/65 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: option.dot, boxShadow: `0 0 8px ${option.dot}` }}
                        />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <SectionLabel>贴上当地邮票</SectionLabel>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {LOCAL_STAMPS.map((st) => {
                      const active = selectedStampId === st.id
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedStampId(st.id)
                            setCardView('letter')
                          }}
                          className={
                            'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ' +
                            (active
                              ? 'border-signal/70 bg-signal/15 text-[#fff8ee]'
                              : 'border-white/12 bg-white/[0.03] text-white/70 hover:border-white/28')
                          }
                        >
                          <span className="text-[15px] leading-none">{st.motif}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-serif text-[11.5px]">{st.title}</span>
                            <span className="block font-mono text-[9.5px] text-white/45">
                              {st.city} · {st.denom}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <SectionLabel>信笺边框与贴纸装饰</SectionLabel>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {CARD_FRAMES.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => {
                          setSelectedFrameId(frame.id)
                          setCardView('letter')
                        }}
                        className={
                          'rounded-xl border px-2 py-2 font-serif text-[11px] transition ' +
                          (selectedFrameId === frame.id
                            ? 'border-signal/70 bg-signal/15 text-signal'
                            : 'border-white/12 bg-white/[0.03] text-white/65 hover:text-white')
                        }
                      >
                        {frame.name}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {CARD_STICKERS.map((sticker) => (
                      <button
                        key={sticker}
                        type="button"
                        onClick={() => {
                          setSelectedSticker(sticker)
                          setCardView('letter')
                        }}
                        className={
                          'rounded-full border px-2.5 py-1 font-serif text-[11px] transition ' +
                          (selectedSticker === sticker
                            ? 'border-signal/65 bg-signal/15 text-signal'
                            : 'border-white/12 bg-white/[0.03] text-white/65 hover:text-white')
                        }
                      >
                        {sticker}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel>挑选一段环境底噪</SectionLabel>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {AMBIENCE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => chooseAmbience(option.id)}
                        className={`rounded-xl border px-2 py-2.5 text-center font-serif text-[12.5px] transition ${
                          ambience === option.id
                            ? 'border-signal/65 bg-signal/15 text-[#fff8ee]'
                            : 'border-white/12 bg-white/[0.03] text-white/65 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                  <button
                    type="button"
                    onClick={toggleSound}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                      soundOn
                        ? 'border-signal/60 bg-signal/15 text-signal'
                        : 'border-white/15 text-white/55 hover:border-white/35'
                    }`}
                    aria-label={soundOn ? '关闭环境声' : '打开环境声'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 9.5v5h3.4L12 18.5v-13L7.4 9.5H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      {!soundOn && <path d="M16 9.5l4 5M20 9.5l-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
                      {soundOn && <path d="M15.5 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
                    </svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between font-sans text-[12px] text-white/70">
                      <span>{soundOn ? '环境声正在播放' : '环境声已暂停'}</span>
                      <span className="text-signal">{Math.round(volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(event) => setVolume(Number(event.target.value))}
                      className="mt-1.5 w-full accent-[#f2c28b]"
                      aria-label="环境声音量"
                    />
                  </div>
                </div>

                <div>
                  <SectionLabel>录一段 10 秒现场原声（可选）</SectionLabel>
                  {recording ? (
                    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-ember/45 bg-ember/10 px-3.5 py-2.5">
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-ember" />
                      <div className="flex-1 font-sans text-[12.5px] text-[#ffd6c9]">
                        正在录音 · 还剩 {recordSeconds} 秒
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-ember/50 px-3 py-1 font-serif text-[12px] text-[#ffd6c9] transition hover:bg-ember/20"
                        onClick={stopRecording}
                      >
                        完成
                      </button>
                    </div>
                  ) : voice ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-signal/35 bg-signal/10 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="font-serif text-[12.5px] text-[#fff8ee]">
                          已录好 · {voiceSeconds.toFixed(1)} 秒
                        </div>
                        <div className="font-sans text-[11px] text-white/55">{formatBytes(voiceBytes)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handlePlayVoice()}
                          className="rounded-full border border-white/20 px-2.5 py-1 font-serif text-[11.5px] text-white/85 transition hover:border-signal/60"
                        >
                          试听
                        </button>
                        <button
                          type="button"
                          onClick={startRecording}
                          className="rounded-full border border-white/20 px-2.5 py-1 font-serif text-[11.5px] text-white/85 transition hover:border-signal/60"
                        >
                          重录
                        </button>
                        <button
                          type="button"
                          onClick={removeVoice}
                          className="rounded-full border border-white/15 px-2.5 py-1 font-serif text-[11.5px] text-white/60 transition hover:border-ember/50 hover:text-ember"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-2.5 font-serif text-[12.5px] text-white/75 transition hover:border-signal/60 hover:bg-signal/10 hover:text-[#fff8ee]"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      点击录制 10 秒身边声音
                    </button>
                  )}
                  {recordError && <div className="mt-1.5 font-sans text-[11.5px] text-ember">{recordError}</div>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <SectionLabel>所在城市</SectionLabel>
                    <input
                      value={city}
                      maxLength={14}
                      onChange={(event) => setCity(event.target.value)}
                      className={inputClass}
                      placeholder="南京"
                    />
                  </label>
                  <label className="block">
                    <SectionLabel>此刻气温 (°C)</SectionLabel>
                    <input
                      type="number"
                      min={-40}
                      max={55}
                      value={tempC}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setTempC(Number.isFinite(next) ? clamp(Math.round(next), -40, 55) : 0)
                      }}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <SectionLabel>风的触感</SectionLabel>
                    <span className="font-sans text-[11.5px] text-white/55">
                      {WIND_DESCRIPTIONS[windLevel] ?? WIND_DESCRIPTIONS[0]}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {['无风', '微风', '清风', '长风'].map((label, level) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setWindLevel(level)}
                        className={`rounded-xl border px-2 py-2 font-serif text-[12px] transition ${
                          windLevel === level
                            ? 'border-signal/65 bg-signal/15 text-[#fff8ee]'
                            : 'border-white/12 bg-white/[0.03] text-white/60 hover:border-white/30'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <SectionLabel>空气里的气味</SectionLabel>
                  <input
                    value={scent}
                    maxLength={22}
                    onChange={(event) => setScent(event.target.value)}
                    className={inputClass}
                    placeholder="桂花与旧书页"
                  />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <SectionLabel>当地天气</SectionLabel>
                    <input
                      value={letterWeather}
                      maxLength={12}
                      onChange={(e) => setLetterWeather(e.target.value)}
                      className={inputClass}
                      placeholder="天气晴朗"
                    />
                  </label>
                  <div className="block">
                    <SectionLabel>邮票预览</SectionLabel>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-signal/35 bg-signal/10 px-3 py-2 font-serif text-[12px] text-signal">
                      <span>{activeStamp.motif}</span>
                      <span className="truncate">{activeStamp.title}</span>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <SectionLabel>写给收信人的短笺与祝福</SectionLabel>
                  <textarea
                    value={letterBody}
                    maxLength={140}
                    rows={3}
                    onChange={(e) => setLetterBody(e.target.value)}
                    placeholder="替不能去远方的人写一段今天看见的风景与祝福…"
                    className={inputClass + ' resize-none leading-[1.7]'}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <SectionLabel>风景标题</SectionLabel>
                    <input
                      value={title}
                      maxLength={26}
                      onChange={(event) => setTitle(event.target.value)}
                      className={inputClass}
                      placeholder="未命名的视界"
                    />
                  </label>
                  <label className="block">
                    <SectionLabel>你的署名</SectionLabel>
                    <input
                      value={sender}
                      maxLength={14}
                      onChange={(event) => setSender(event.target.value)}
                      className={inputClass}
                      placeholder="我"
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <SectionLabel>画面上的悄悄话 ({focus.length}/3)</SectionLabel>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('edit')
                        showToast('轻点上方画面任意处，即可贴上留言')
                      }}
                      className="font-serif text-[12px] text-signal transition hover:underline"
                    >
                      + 去画面贴留言
                    </button>
                  </div>
                  {(relay?.promise || relay?.wish) && (
                    <button
                      type="button"
                      onClick={() => {
                        const text = (relay.promise || relay.wish || '').replace(/^[“"]|[”"]$/g, '')
                        if (!text) return
                        setFocus((current) => {
                          if (current.length > 0) {
                            return current.map((pt, i) => (i === 0 ? { ...pt, note: text } : pt))
                          }
                          return [
                            {
                              id: `relay-${Date.now().toString(36)}`,
                              x: 0.52,
                              y: 0.52,
                              note: text,
                            },
                          ]
                        })
                        showToast('已把你在草原留下的承诺填入第 1 处目光')
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-signal/35 bg-signal/10 px-3 py-2 font-serif text-[12px] text-signal transition hover:bg-signal/20"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                      填入你在草原留下的承诺
                    </button>
                  )}
                  <div className="mt-2 space-y-2.5">
                    {focus.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-center font-serif text-[12.5px] leading-[1.8] text-white/60">
                        还没有添加画面留言。
                        <br />
                        轻点上方风景任意处，指给她看你想分享的一处角落。
                      </div>
                    )}
                    {focus.map((point, index) => (
                      <div
                        key={point.id}
                        className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 focus-within:border-signal/55"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-[12px] text-signal">
                            第 {index + 1} 处目光
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFocus(point.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-ember"
                            aria-label="删除留言"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                        <textarea
                          value={point.note}
                          maxLength={90}
                          rows={2}
                          onChange={(event) => updateFocusNote(point.id, event.target.value)}
                          placeholder="写下指着这处风景时，想对接收者说的话…"
                          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#081022]/80 px-3 py-2 font-serif text-[12.5px] leading-[1.65] text-[#fff8ee] outline-none placeholder:text-white/32 focus:border-signal/55"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel>投递方式</SectionLabel>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/12 bg-white/[0.03] p-1">
                    {([
                      ['public', '公开放到电台'],
                      ['private', '仅凭链接分享'],
                    ] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setVisibility(id)}
                        aria-pressed={visibility === id}
                        className={`rounded-xl px-2 py-2 font-serif text-[12px] transition ${
                          visibility === id
                            ? 'bg-signal text-[#170f07] font-medium'
                            : 'text-white/65 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openMine}
                  className="w-full rounded-2xl border border-white/12 bg-white/[0.03] px-3.5 py-3 text-left font-serif text-[12.5px] text-white/75 transition hover:border-signal/45 hover:text-signal"
                >
                  我寄出的视野 · 查看与撤回
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-[#091224]/90 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openPostcardModal}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-4 py-2.5 font-serif text-[12.5px] text-[#fff8ee] transition hover:border-signal/60 hover:text-signal"
              >
                冲印明信片
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-signal px-4 py-2.5 font-serif text-[13px] font-medium text-[#170f07] shadow-[0_10px_28px_-8px_rgba(242,194,139,0.65)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {publishing
                  ? '正在投递漂流信箱…'
                  : visibility === 'public'
                    ? '贴好邮票 · 随机漂流寄出'
                    : '生成私密分享信函'}
              </button>
            </div>
          </div>
        </aside>
        </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[95] w-[min(92vw,460px)] -translate-x-1/2">
          <div className="animate-fade-in rounded-full border border-signal/35 bg-[#0e1a36]/95 px-4 py-2.5 text-center font-serif text-[12.5px] text-[#fff8ee] shadow-2xl backdrop-blur-md">
            {toast}
          </div>
        </div>
      )}

      {publishOpen && publishResult && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-[#060c1a]/80 px-4 backdrop-blur-md"
          onClick={() => setPublishOpen(false)}
        >
          <div
            className="relative max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-[28px] border border-white/15 bg-[#0d1832]/95 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex gap-4">
              <img
                src={publishResult.signal.packet.image}
                alt={publishResult.signal.packet.title}
                className="h-[88px] w-[132px] shrink-0 rounded-2xl border border-white/12 object-cover"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[17px] text-[#fff8ee]">
                  {publishResult.signal.packet.title}
                </div>
                <div className="mt-1 font-sans text-[12px] text-white/65">
                  {publishResult.signal.packet.city} · {publishResult.signal.packet.tempC}°C ·{' '}
                  {citySignature(publishResult.signal.packet.city)?.weather ??
                    windLabel(publishResult.signal.packet.windLevel)}
                </div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-signal/35 bg-signal/12 px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-signal">
                  信号编号 {publishResult.code}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/12 bg-[#081022]/85 p-3">
              <div className="font-serif text-[12px] text-white/65">
                分享链接 · 把这双眼睛交给想分享的人
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={publishResult.link}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-[#060c1a] px-3 py-2 font-mono text-[11.5px] text-signal outline-none"
                  aria-label="分享链接"
                />
                <button
                  type="button"
                  onClick={() => void copyShareLink()}
                  className="shrink-0 rounded-xl border border-signal/40 bg-signal/15 px-3.5 py-2 font-serif text-[12px] text-signal transition hover:bg-signal/25"
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>

            <p className="mt-4 font-serif text-[13px] leading-[1.85] text-white/75">
              {publishResult.visibility === 'private'
                ? '这是一枚私密视界，只有拿到这条链接的人才能打开它。'
                : publishResult.source === 'cloud'
                  ? `它已经点亮在 ${publishResult.signal.packet.city} 的地图上，任何人打开电台都能借用这一秒的风景。`
                  : '这枚视界已保存在当前设备，分享链接同样可以打开查看。'}
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-white/18 px-4 py-2 font-serif text-[12.5px] text-white/80 transition hover:border-white/40"
                onClick={() => setPublishOpen(false)}
              >
                继续编辑
              </button>
              <button
                type="button"
                className="rounded-full border border-white/18 px-4 py-2 font-serif text-[12.5px] text-white/80 transition hover:border-signal/60"
                onClick={() => {
                  setPublishOpen(false)
                  openPostcardModal()
                }}
              >
                冲印明信片
              </button>
              {publishResult.visibility === 'public' && (
                <button
                  type="button"
                  className="rounded-full bg-signal px-5 py-2 font-serif text-[12.5px] font-medium text-[#170f07] transition hover:brightness-105"
                  onClick={() => {
                    setPublishOpen(false)
                    onOpenRadio(publishResult.code)
                  }}
                >
                  去电台看看
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {mineOpen && (
        <div
          className="fixed inset-0 z-[78] flex items-center justify-center bg-[#060c1a]/80 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="我寄出的视野"
          onClick={() => setMineOpen(false)}
        >
          <div
            className="no-scrollbar max-h-[86dvh] w-full max-w-[560px] overflow-y-auto rounded-[28px] border border-white/15 bg-[#0d1832]/95 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] tracking-[0.24em] text-signal/75">MY VISIONS</div>
                <h2 className="mt-1.5 font-serif text-[18px] font-light tracking-[0.06em] text-[#fff6ea]">
                  我寄出的视野
                </h2>
              </div>
              <button
                ref={mineCloseRef}
                type="button"
                onClick={() => setMineOpen(false)}
                className="shrink-0 rounded-full border border-white/18 px-3.5 py-1.5 font-serif text-[12px] text-white/75 transition hover:border-signal/55 hover:text-signal"
              >
                关闭
              </button>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/45">
              这里只列出这台设备寄出过的视野。撤回会同时删掉电台上的那一份；若此刻连不上云端，就只清本机，不会弹出错误。
            </p>

            {mine.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center font-serif text-[13px] text-white/50">
                还没有寄出过视野。挑一片风景，寄给地心试试。
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {mine.map((item) => (
                  <div
                    key={item.code}
                    className="rounded-2xl border border-white/12 bg-white/[0.03] p-3"
                  >
                    <div className="flex gap-3">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="h-[56px] w-[84px] shrink-0 rounded-xl border border-white/12 object-cover"
                        draggable={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-serif text-[13.5px] text-[#fff8ee]">{item.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-white/50">
                          {item.city} · {item.hearts} 次共鸣 · {new Date(item.savedAt).toLocaleDateString('zh-CN')}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-white/55">
                            {item.code}
                          </span>
                          <span className="rounded-full border border-signal/30 px-2 py-0.5 text-[10px] text-signal/80">
                            {item.visibility === 'private' ? '仅凭链接' : '公开'}
                          </span>
                          <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-white/45">
                            {item.onCloud ? '已在电台' : '仅本机'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          void writeClipboard(buildShareLink(item.code))
                          showToast('分享链接已复制')
                        }}
                        className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/75 transition hover:border-signal/55 hover:text-signal"
                      >
                        复制链接
                      </button>
                      {item.visibility === 'public' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMineOpen(false)
                            onOpenRadio(item.code)
                          }}
                          className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/75 transition hover:border-signal/55 hover:text-signal"
                        >
                          打开
                        </button>
                      )}
                      {item.deletable ? (
                        confirmCode === item.code ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmCode(null)}
                              className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/60 transition hover:border-white/40"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeMine(item.code)}
                              disabled={deleting === item.code}
                              className="rounded-full border border-[#ff9b8a]/50 bg-[#ff9b8a]/12 px-3 py-1.5 font-serif text-[11.5px] text-[#ffb9ac] transition hover:bg-[#ff9b8a]/22 disabled:cursor-wait disabled:opacity-60"
                            >
                              {deleting === item.code ? '撤回中…' : '确认撤回'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCode(item.code)}
                            className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/60 transition hover:border-[#ff9b8a]/55 hover:text-[#ffb9ac]"
                          >
                            撤回
                          </button>
                        )
                      ) : (
                        <span className="px-1 text-[10.5px] leading-relaxed text-white/35">
                          这份寄出于旧版本，没有撤回凭证
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {postcardOpen && (
        <PostcardPreviewModal
          open
          packet={buildPacket()}
          shareCode={publishResult?.code}
          initialTone={photoTone}
          whisperText={relay?.promise || getCityWhisper(city)}
          onClose={() => setPostcardOpen(false)}
          onToast={showToast}
        />
      )}
    </main>
  )
}
