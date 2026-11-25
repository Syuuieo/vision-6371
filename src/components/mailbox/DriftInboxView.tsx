import { useEffect, useMemo, useState } from 'react'
import type { AmbientMixer } from '../../audio/ambientMixer'
import { citySignature } from '../../data/citySignature'
import {
  DRIFT_INBOX_LETTERS,
  LOCAL_STAMPS,
  findStampForCity,
  type DriftLetterMeta,
} from '../../data/mailboxData'
import { getPresetImage } from '../../data/presetVisions'
import { inferAlbumSceneId, saveAlbumEntry, subscribeAlbum, type AlbumEntry } from '../../services/albumStorage'
import {
  getRadioSignal,
  listRadioSignals,
  sendRadioHeartbeat,
} from '../../services/visionApi'
import type { RadioSignal } from '../../types/vision'
import { WIND_LABELS } from '../../types/vision'

const INBOX_STATE_KEY = 'vision6371_drift_inbox_v1'

interface InboxStateStore {
  likedIds: string[]
  savedIds: string[]
}

function loadInboxState(): InboxStateStore {
  if (typeof window === 'undefined') return { likedIds: [], savedIds: [] }
  try {
    const raw = window.localStorage.getItem(INBOX_STATE_KEY)
    if (!raw) return { likedIds: [], savedIds: [] }
    const parsed = JSON.parse(raw) as Partial<InboxStateStore>
    return {
      likedIds: Array.isArray(parsed.likedIds)
        ? parsed.likedIds.filter((v): v is string => typeof v === 'string')
        : [],
      savedIds: Array.isArray(parsed.savedIds)
        ? parsed.savedIds.filter((v): v is string => typeof v === 'string')
        : [],
    }
  } catch {
    return { likedIds: [], savedIds: [] }
  }
}

function saveInboxState(state: InboxStateStore) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INBOX_STATE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

interface DriftMailItem {
  id: string
  source: 'radio' | 'curated'
  radioCode?: string
  fromTitle: string
  city: string
  tempC: number
  weather: string
  image: string
  stampId: string
  sticker: string
  letter: string
  sender: string
  hearts: number
  presetId?: string
}

function curatedToMail(item: DriftLetterMeta): DriftMailItem {
  return {
    id: item.id,
    source: 'curated',
    fromTitle: item.fromTitle,
    city: item.city,
    tempC: item.tempC,
    weather: item.weather,
    image: getPresetImage(item.presetId),
    stampId: item.stampId,
    sticker: item.sticker,
    letter: item.letter,
    sender: item.sender,
    hearts: 0,
    presetId: item.presetId,
  }
}

interface DriftInboxViewProps {
  mixer: AmbientMixer
  soundOn: boolean
  muted: boolean
  onAlbumUpdated: (entries: AlbumEntry[]) => void
  onOpenRadio: (code: string) => void
  onToast: (message: string) => void
}

export function DriftInboxView({
  mixer,
  soundOn,
  muted,
  onAlbumUpdated,
  onOpenRadio,
  onToast,
}: DriftInboxViewProps) {
  const [radioMails, setRadioMails] = useState<DriftMailItem[]>([])
  const [detailByCode, setDetailByCode] = useState<Record<string, RadioSignal>>({})
  const [inboxIdx, setInboxIdx] = useState(0)
  const [inboxState, setInboxState] = useState<InboxStateStore>(() => loadInboxState())
  const [resonating, setResonating] = useState(false)

  useEffect(() => subscribeAlbum(() => setInboxState(loadInboxState())), [])

  // 从电台拉取真实公开/本地视野，与精选漂流信组成同一个收件箱
  useEffect(() => {
    let alive = true
    void listRadioSignals('new').then((feed) => {
      if (!alive) return
      const realItems = feed.items.filter((item) => item.origin !== 'seed').slice(0, 12)
      const mapped: DriftMailItem[] = realItems.map((item) => ({
        id: `radio-${item.code}`,
        source: 'radio',
        radioCode: item.code,
        fromTitle: item.title,
        city: item.city,
        tempC: item.tempC,
        weather:
          citySignature(item.city)?.weather ||
          WIND_LABELS[Math.min(3, Math.max(0, Math.round(item.windLevel)))],
        image: item.thumbnail,
        stampId: findStampForCity(item.city),
        sticker: item.scentTag || '✦ 来自地球表面',
        letter: `${item.sender} 从 ${item.city} 寄来这帧风景，此时气温 ${item.tempC}°C。`,
        sender: item.sender,
        hearts: item.hearts,
      }))
      setRadioMails(mapped)
    })
    return () => {
      alive = false
    }
  }, [])

  const mails = useMemo<DriftMailItem[]>(
    () => [...radioMails, ...DRIFT_INBOX_LETTERS.map(curatedToMail)],
    [radioMails],
  )

  const currentBase = mails[inboxIdx % mails.length]

  // 懒加载当前真实电台视野的完整 packet（包含 letter / stampId / sticker / weather）
  useEffect(() => {
    const code = currentBase?.radioCode
    if (!code || detailByCode[code]) return
    let alive = true
    void getRadioSignal(code).then((signal) => {
      if (!alive || !signal) return
      setDetailByCode((prev) => ({ ...prev, [code]: signal }))
    })
    return () => {
      alive = false
    }
  }, [currentBase?.radioCode, detailByCode])

  const activeMail = useMemo<DriftMailItem>(() => {
    if (!currentBase.radioCode) return currentBase
    const full = detailByCode[currentBase.radioCode]
    if (!full) return currentBase
    const p = full.packet
    const firstNote = p.focus.find((f) => f.note.trim())?.note.trim()
    return {
      ...currentBase,
      fromTitle: p.title || currentBase.fromTitle,
      city: p.city || currentBase.city,
      tempC: p.tempC,
      weather: p.weather?.trim() || currentBase.weather,
      image: p.image || currentBase.image,
      stampId: p.stampId || currentBase.stampId,
      sticker: p.sticker?.trim() || p.scentTag?.trim() || currentBase.sticker,
      letter: p.letter?.trim() || firstNote || currentBase.letter,
      sender: p.sender || currentBase.sender,
      hearts: Math.max(currentBase.hearts, full.hearts),
    }
  }, [currentBase, detailByCode])

  const activeStamp =
    LOCAL_STAMPS.find((s) => s.id === activeMail.stampId) ??
    LOCAL_STAMPS.find((s) => s.id === findStampForCity(activeMail.city)) ??
    LOCAL_STAMPS[0]

  const isLiked = inboxState.likedIds.includes(activeMail.id)
  const isSaved = inboxState.savedIds.includes(activeMail.id)

  const handleBless = async () => {
    if (resonating) return
    const nextLiked = isLiked ? inboxState.likedIds : [...inboxState.likedIds, activeMail.id]
    const nextState: InboxStateStore = { ...inboxState, likedIds: nextLiked }
    setInboxState(nextState)
    saveInboxState(nextState)

    if (soundOn && !muted) {
      void mixer.ensure()
      mixer.playInteractionSfx('star')
    }

    if (activeMail.radioCode && !isLiked) {
      setResonating(true)
      try {
        const res = await sendRadioHeartbeat(activeMail.radioCode, undefined, activeMail.hearts)
        setDetailByCode((prev) => {
          const existing = prev[activeMail.radioCode!]
          if (!existing) return prev
          return { ...prev, [activeMail.radioCode!]: { ...existing, hearts: res.hearts } }
        })
      } finally {
        setResonating(false)
      }
    }
    onToast(`已向「${activeMail.sender}」回赠一颗同频祝福 ❤️`)
  }

  const handleSaveToAlbum = () => {
    const entry: AlbumEntry = {
      id: `drift-${activeMail.id}`,
      sceneId: inferAlbumSceneId(activeMail.city, activeMail.presetId),
      sceneTitle: `${activeMail.fromTitle} · ${activeMail.city}`,
      city: activeMail.city,
      mood: activeMail.tempC < 0 ? 'night' : 'dusk',
      image: activeMail.image,
      note: `${activeMail.letter} —— ${activeMail.sender}`.slice(0, 160),
      interactions: 1,
      createdAt: Date.now(),
      awakened: true,
      stampTitle: activeStamp.title,
    }
    const updated = saveAlbumEntry(entry)
    onAlbumUpdated(updated)
    if (!isSaved) {
      const nextState: InboxStateStore = {
        ...inboxState,
        savedIds: [...inboxState.savedIds, activeMail.id],
      }
      setInboxState(nextState)
      saveInboxState(nextState)
    }
    onToast('已把这封远方明信片收进我的纪念册')
  }

  const stepInbox = (delta: number) => {
    setInboxIdx((prev) => (prev + delta + mails.length) % mails.length)
    if (soundOn && !muted) {
      void mixer.ensure()
      mixer.playInteractionSfx('lamp')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center py-2 lg:items-center">
      <div className="cinema-surface animate-fade-up relative my-auto w-full max-w-[780px] overflow-hidden rounded-[28px] border-signal/35 p-4 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
              <span className="font-mono text-[10.5px] tracking-[0.18em] text-signal/85">
                {activeMail.source === 'radio'
                  ? `RADIO DRIFT · 真实电台来信 (${(inboxIdx % mails.length) + 1}/${mails.length})`
                  : `DRIFT POST · 来自「${activeMail.fromTitle}」(${(inboxIdx % mails.length) + 1}/${mails.length})`}
              </span>
            </div>
            <h2 className="mt-1.5 font-serif text-[20px] font-normal tracking-[0.06em] text-[#fff8ee] sm:text-[24px]">
              {activeMail.city} · {activeMail.tempC}°C · {activeMail.weather}
            </h2>
          </div>

          <div
            className="relative flex shrink-0 flex-col items-center rounded-xl border-2 border-dashed px-3 py-2 text-center shadow-lg"
            style={{
              borderColor: activeStamp.accent,
              backgroundColor: 'rgba(12, 22, 46, 0.85)',
            }}
          >
            <span className="text-[16px] leading-none">{activeStamp.motif}</span>
            <span className="mt-1 font-serif text-[11px] text-[#fff8ee]">
              {activeStamp.title}
            </span>
            <span className="font-mono text-[9.5px] text-signal/85">{activeStamp.denom}</span>
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black/40">
          <img
            src={activeMail.image}
            alt={activeMail.city}
            className="aspect-[16/9] max-h-[300px] w-full object-cover"
            draggable={false}
          />
          <span className="absolute left-3 top-3 rounded-full border border-white/18 bg-[#070e1f]/75 px-3 py-1 font-serif text-[11px] text-signal backdrop-blur-md">
            {activeMail.sticker}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4 sm:p-5">
          <p className="font-serif text-[14.5px] leading-[1.9] tracking-[0.04em] text-[#fff8ee]/92">
            “{activeMail.letter}”
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 font-serif text-[12px] text-white/62">
            <span>
              邮戳号 · #{activeMail.id.toUpperCase()}
              {activeMail.radioCode ? ` · ♥ ${activeMail.hearts}` : ''}
            </span>
            <span className="text-signal">署名：{activeMail.sender}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleBless()}
              disabled={resonating}
              className={
                'rounded-full border px-3.5 py-2 font-serif text-[12px] transition ' +
                (isLiked
                  ? 'border-signal/60 bg-signal/18 text-signal'
                  : 'border-white/16 bg-white/[0.04] text-white/82 hover:border-signal/50 hover:text-signal')
              }
            >
              {isLiked ? '已送出祝福 ♥' : '回赠祝福 ♡'}
            </button>
            <button
              type="button"
              onClick={handleSaveToAlbum}
              className="rounded-full border border-white/16 bg-white/[0.04] px-3.5 py-2 font-serif text-[12px] text-white/82 transition hover:border-signal/50 hover:text-signal"
            >
              {isSaved ? '✓ 已收进纪念册' : '收进我的纪念册'}
            </button>
            {activeMail.radioCode && (
              <button
                type="button"
                onClick={() => onOpenRadio(activeMail.radioCode!)}
                className="rounded-full border border-signal/35 bg-signal/10 px-3.5 py-2 font-serif text-[12px] text-signal transition hover:border-signal/65"
              >
                去电台看 3D 视窗
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepInbox(-1)}
              className="rounded-full border border-white/16 bg-white/[0.04] px-3 py-2 font-serif text-[12px] text-white/75 transition hover:border-white/35 hover:text-white"
            >
              上一封
            </button>
            <button type="button" onClick={() => stepInbox(1)} className="btn-primary">
              拆开下一封随机视野 ✉
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
