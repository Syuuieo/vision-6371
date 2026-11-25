import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import {
  AMBIENCE_OPTIONS,
  PARTICLE_OPTIONS,
  VISION_PRESETS,
  getPresetImage,
  getPresetThumb,
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
import {
  CARD_FRAMES,
  CARD_STICKERS,
  DRIFT_INBOX_LETTERS,
  LOCAL_STAMPS,
  findStampForCity,
  type CardFrameMeta,
} from '../data/mailboxData'
import { loadAlbum, loadAlbumAsync, subscribeAlbum, type AlbumEntry } from '../services/albumStorage'
import { countVisionSent } from '../services/journey'
import { deleteMyVision, listMyVisions, publishRadioSignal, type MyVision } from '../services/visionApi'
import { compressImage, dataUrlBytes, formatBytes } from '../utils/imageCompress'
import { POSTCARD_TONES, type PostcardTone } from '../utils/postcardExport'
import { getCityWhisper, type StoryRelayState } from '../utils/storyRelay'
import { DriftInboxView } from './mailbox/DriftInboxView'
import { LetterCardPreview } from './mailbox/LetterCardPreview'
import { MyVisionsModal } from './mailbox/MyVisionsModal'
import { PublishResultModal } from './mailbox/PublishResultModal'
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
  onBack: _onBack,
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
  const [sensoryOpen, setSensoryOpen] = useState(false)

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

  useEffect(() => {
    let alive = true
    const sync = () => {
      void loadAlbumAsync().then((loaded) => {
        if (alive) setAlbumEntries(loaded)
      })
    }
    sync()
    const unsub = subscribeAlbum(sync)
    return () => {
      alive = false
      unsub()
    }
  }, [])

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
      scentTag: scent.trim(),
      focus: nextFocus,
      stampId: selectedStampId,
      frameId: selectedFrameId,
      sticker: selectedSticker,
      weather: letterWeather.trim(),
      letter: cleanLetter,
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
                  {DRIFT_INBOX_LETTERS.length}+
                </span>
              </button>
            </div>
          </div>
          <div className="hidden font-serif text-[11.5px] tracking-[0.04em] text-white/55 sm:block">
            从纪念册挑风景 · 贴上当地邮票写信漂流 · 也能拆开真实电台与远方的明信片
          </div>
        </div>

        {mailboxTab === 'inbox' ? (
          <DriftInboxView
            mixer={mixer}
            soundOn={soundOn}
            muted={muted}
            onAlbumUpdated={setAlbumEntries}
            onOpenRadio={onOpenRadio}
            onToast={showToast}
          />
        ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(360px,0.39fr)_minmax(0,0.61fr)] lg:gap-4">
        <section
          className={`cinema-surface-soft order-1 flex flex-col overflow-hidden rounded-[28px] lg:order-2 lg:h-full lg:min-h-0 ${
            cardView === 'letter'
              ? 'h-auto min-h-0'
              : 'h-[44dvh] min-h-[300px]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <h1 className="min-w-0 truncate font-serif text-[15px] tracking-[0.06em] text-[#fff8ee] sm:text-[16px]">
              {livePacket.title}
            </h1>
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
            <div className={cardView === 'letter' ? 'hidden h-full w-full lg:block' : 'h-full w-full'}>
              <VisionViewport3D
                packet={livePacket}
                mode={mode}
                paused={cardView === 'letter'}
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
            </div>
            {cardView === 'letter' && (
              <LetterCardPreview
                activeFrame={activeFrame}
                activeStamp={activeStamp}
                city={city}
                tempC={tempC}
                letterWeather={letterWeather}
                image={image}
                title={title}
                cssFilter={activeToneMeta.cssFilter}
                selectedSticker={selectedSticker}
                letterBody={letterBody}
                sender={sender}
              />
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
                      onClick={() => void loadAlbumAsync().then(setAlbumEntries)}
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

                <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.025]">
                  <button
                    type="button"
                    onClick={() => setSensoryOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition hover:bg-white/[0.03]"
                    aria-expanded={sensoryOpen}
                  >
                    <div>
                      <div className="font-serif text-[12.5px] text-[#fff8ee]">
                        感官附签（可选）
                      </div>
                      <div className="mt-0.5 font-sans text-[11px] text-white/48">
                        {AMBIENCE_OPTIONS.find((o) => o.id === ambience)?.label ?? '微风'} ·{' '}
                        {['无风', '微风', '清风', '长风'][windLevel] ?? '微风'}
                        {voice ? ' · 含现场原声' : ''}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/14 px-2.5 py-1 font-serif text-[11px] text-signal">
                      {sensoryOpen ? '收起' : '展开微调'}
                    </span>
                  </button>

                  {sensoryOpen && (
                    <div className="space-y-4 border-t border-white/10 p-3.5">
                      <div>
                        <SectionLabel>挑选一段环境底噪</SectionLabel>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {AMBIENCE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => chooseAmbience(option.id)}
                              className={`rounded-xl border px-2 py-2 text-center font-serif text-[12px] transition ${
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

                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
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
                </div>
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
        <PublishResultModal
          result={publishResult}
          copied={copied}
          onClose={() => setPublishOpen(false)}
          onCopyLink={() => void copyShareLink()}
          onOpenPostcard={openPostcardModal}
          onOpenRadio={onOpenRadio}
        />
      )}
      <MyVisionsModal
        open={mineOpen}
        items={mine}
        confirmCode={confirmCode}
        deleting={deleting}
        onClose={() => setMineOpen(false)}
        onCopyLink={(link) => {
          void writeClipboard(link)
          showToast('分享链接已复制')
        }}
        onOpenRadio={onOpenRadio}
        onArmDelete={setConfirmCode}
        onConfirmDelete={(code) => void removeMine(code)}
      />
      {postcardOpen && (
        <PostcardPreviewModal
          open
          packet={buildPacket()}
          shareCode={publishResult?.code}
          initialTheme={
            selectedFrameId === 'warm-paper'
              ? 'polaroid'
              : selectedFrameId === 'navy-gold'
                ? 'letter'
                : 'twilight'
          }
          initialTone={photoTone}
          whisperText={relay?.promise || getCityWhisper(city)}
          onClose={() => setPostcardOpen(false)}
          onToast={showToast}
        />
      )}
    </main>
  )
}
