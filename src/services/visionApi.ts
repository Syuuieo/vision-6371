import {
  getSeedSignal,
  isSeedCode,
  listSeedPreviews,
  seedSignalCodes,
} from '../data/seedRadioVisions'
import { LOCAL_PACKETS_STORAGE_KEY } from './localVisionStats'
import { deleteMedia, getMedia, putMedia } from './mediaDb'
import type {
  HeartbeatResult,
  PublishResult,
  RadioFeed,
  RadioSignal,
  RadioSignalPreview,
  StoredVision,
  VisionEcho,
  VisionPacket,
  VisionVisibility,
} from '../types/vision'

const API_BASE = '/functions/v1/app/api/visions'
const STORAGE_KEY = LOCAL_PACKETS_STORAGE_KEY
const LOCAL_HEARTS_KEY = 'vision6371:radio:hearts:v1'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_LOCAL_SIGNALS = 24
const LOCAL_BUDGET_CHARS = 3_600_000
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3Crect width=%224%22 height=%223%22 fill=%22%230b152c%22/%3E%3C/svg%3E'
const MAX_THUMBNAIL_CHARS = 360_000
const VOICE_IDB_PREFIX = 'idb:voice:'
const MAX_INLINE_VOICE_CHARS = 120_000
const TIMEOUT_LIST = 3500
const TIMEOUT_SIGNAL = 4500
const TIMEOUT_PUBLISH = 20000
const TIMEOUT_HEARTBEAT = 7000

interface LocalHeartRecord {
  added: number
  echoes: VisionEcho[]
}

type LocalHeartStore = Record<string, LocalHeartRecord>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function readStored(): StoredVision[] {
  if (typeof window === 'undefined') return []
  const data = safeParse<unknown>(localStorage.getItem(STORAGE_KEY), [])
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is StoredVision =>
      isRecord(item) &&
      typeof item.code === 'string' &&
      typeof item.savedAt === 'number' &&
      isRecord(item.packet) &&
      typeof item.packet.image === 'string',
  )
}

export function fitLocalBudget(list: StoredVision[]): StoredVision[] {
  let out = list.slice(0, MAX_LOCAL_SIGNALS)
  while (out.length > 0) {
    if (JSON.stringify(out).length <= LOCAL_BUDGET_CHARS) return out
    if (out.length === 1 && out[0].packet.image !== PLACEHOLDER_IMAGE) {
      const only = out[0]
      out = [{ ...only, packet: { ...only.packet, image: PLACEHOLDER_IMAGE } }]
      continue
    }
    out = out.slice(0, -1)
  }
  return out
}

function writeStored(list: StoredVision[]) {
  if (typeof window === 'undefined') return false
  let attempt = fitLocalBudget(list)
  for (;;) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt))
      return true
    } catch {
      if (attempt.length === 0) return false
      attempt = attempt.slice(0, -1)
    }
  }
}

function readHeartStore(): LocalHeartStore {
  if (typeof window === 'undefined') return {}
  const data = safeParse<unknown>(localStorage.getItem(LOCAL_HEARTS_KEY), {})
  return isRecord(data) ? (data as LocalHeartStore) : {}
}

function writeHeartStore(store: LocalHeartStore) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_HEARTS_KEY, JSON.stringify(store))
  } catch {
    /* 本地空间不足时保持会话内计数 */
  }
}

function localBoost(code: string) {
  return readHeartStore()[code.toUpperCase()] ?? null
}

function sortEchoes(echoes: VisionEcho[]): VisionEcho[] {
  return [...echoes].sort((a, b) => b.createdAt - a.createdAt)
}

function clearLocalBoost(code: string) {
  const store = readHeartStore()
  if (store[code]) {
    delete store[code]
    writeHeartStore(store)
  }
}

function applyLocalBoost(signal: RadioSignal): RadioSignal {
  const boost = localBoost(signal.code)
  if (!boost) return signal
  return {
    ...signal,
    hearts: signal.hearts + (Number.isFinite(boost.added) ? boost.added : 0),
    echoes: sortEchoes([...signal.echoes, ...(Array.isArray(boost.echoes) ? boost.echoes : [])]),
  }
}

function makeLocalCode() {
  const existing = new Set([
    ...seedSignalCodes(),
    ...readStored().map((item) => item.code.toUpperCase()),
  ])
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    let code = ''
    for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    if (!existing.has(code)) return code
  }
  return `X${Date.now().toString(36).slice(-5).toUpperCase()}`
}

function storedToSignal(item: StoredVision): RadioSignal {
  const storedHearts = Number.isFinite(item.hearts) ? item.hearts ?? 0 : 0
  return applyLocalBoost({
    code: item.code,
    packet: item.packet,
    hearts: storedHearts,
    echoes: Array.isArray(item.echoes) ? item.echoes : [],
    visibility: item.visibility === 'private' ? 'private' : 'public',
    origin: 'local',
    publishedAt: item.savedAt,
  })
}

function storedToPreview(item: StoredVision): RadioSignalPreview {
  const signal = storedToSignal(item)
  return {
    code: signal.code,
    title: signal.packet.title,
    sender: signal.packet.sender,
    city: signal.packet.city,
    thumbnail: signal.packet.image,
    tempC: signal.packet.tempC,
    windLevel: signal.packet.windLevel,
    scentTag: signal.packet.scentTag,
    particles: signal.packet.particles,
    ambience: signal.packet.ambience,
    hasVoice: Boolean(signal.packet.voice),
    hearts: signal.hearts,
    visibility: signal.visibility,
    origin: 'local',
    publishedAt: signal.publishedAt,
  }
}

function rememberLocal(signal: RadioSignal, ownerToken?: string, storedImage?: string) {
  const list = readStored()
  const image = storedImage ?? signal.packet.image
  const codeKey = signal.code.toUpperCase()
  let voice = signal.packet.voice
  if (voice && !voice.startsWith(VOICE_IDB_PREFIX) && voice.length > MAX_INLINE_VOICE_CHARS) {
    void putMedia(`vision-voice:${codeKey}`, voice)
    voice = `${VOICE_IDB_PREFIX}${codeKey}`
  }
  const nextPacket =
    image === signal.packet.image && voice === signal.packet.voice
      ? signal.packet
      : { ...signal.packet, image, voice }
  const entry: StoredVision = {
    packet: nextPacket,
    code: signal.code,
    savedAt: signal.publishedAt,
    visibility: signal.visibility,
    hearts: signal.hearts,
    echoes: signal.echoes,
    origin: signal.origin === 'cloud' ? 'cloud' : 'local',
    ownerToken,
  }
  writeStored([entry, ...list.filter((item) => item.code !== signal.code)])
}

function buildSignalLink(code: string) {
  if (typeof window === 'undefined') return `?signal=${encodeURIComponent(code)}`
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('signal', code)
  return url.toString()
}

function sortSignals<T extends { hearts: number; publishedAt: number }>(items: T[], sort: 'new' | 'hot') {
  return [...items].sort((a, b) =>
    sort === 'hot' ? b.hearts - a.hearts || b.publishedAt - a.publishedAt : b.publishedAt - a.publishedAt,
  )
}

async function makeThumbnail(dataUrl: string) {
  if (dataUrl.length <= MAX_THUMBNAIL_CHARS) return dataUrl
  const image = new Image()
  image.decoding = 'async'
  image.src = dataUrl
  await image.decode()
  for (const edge of [520, 384, 288, 208]) {
    const scale = Math.min(1, edge / Math.max(1, image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) break
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.7, 0.5, 0.35]) {
      const webp = canvas.toDataURL('image/webp', quality)
      if (webp.startsWith('data:image/webp') && webp.length <= MAX_THUMBNAIL_CHARS) return webp
      const jpeg = canvas.toDataURL('image/jpeg', quality)
      if (jpeg.length <= MAX_THUMBNAIL_CHARS) return jpeg
    }
  }
  throw new Error('THUMBNAIL_TOO_LARGE')
}

async function requestJson<T>(path: string, init?: RequestInit, timeout = TIMEOUT_LIST): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data: unknown = await response.json()
    if (!isRecord(data)) throw new Error('INVALID_RESPONSE')
    return data as T
  } finally {
    window.clearTimeout(timer)
  }
}

function decodePreview(value: unknown): RadioSignalPreview | null {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.title !== 'string') return null
  if (typeof value.city !== 'string' || typeof value.thumbnail !== 'string') return null
  return {
    code: value.code.toUpperCase(),
    title: value.title,
    sender: typeof value.sender === 'string' ? value.sender : '地表某人',
    city: value.city,
    thumbnail: value.thumbnail,
    tempC: typeof value.tempC === 'number' ? value.tempC : 0,
    windLevel: typeof value.windLevel === 'number' ? value.windLevel : 0,
    scentTag: typeof value.scentTag === 'string' ? value.scentTag : '',
    particles: (typeof value.particles === 'string' ? value.particles : 'none') as RadioSignalPreview['particles'],
    ambience: (typeof value.ambience === 'string' ? value.ambience : 'none') as RadioSignalPreview['ambience'],
    hasVoice: value.hasVoice === true,
    hearts: typeof value.hearts === 'number' ? value.hearts : 0,
    visibility: value.visibility === 'private' ? 'private' : 'public',
    origin: 'cloud',
    publishedAt: typeof value.publishedAt === 'number' ? value.publishedAt : Date.now(),
  }
}

function decodeSignal(value: unknown): RadioSignal | null {
  if (!isRecord(value) || typeof value.code !== 'string' || !isRecord(value.packet)) return null
  const code = value.code.toUpperCase()
  const seed = getSeedSignal(code)
  if (seed) return applyLocalBoost(seed)
  return {
    code,
    packet: value.packet as unknown as VisionPacket,
    hearts: typeof value.hearts === 'number' ? value.hearts : 0,
    echoes: Array.isArray(value.echoes) ? (value.echoes as VisionEcho[]) : [],
    visibility: value.visibility === 'private' ? 'private' : 'public',
    origin: 'cloud',
    publishedAt: typeof value.publishedAt === 'number' ? value.publishedAt : Date.now(),
  }
}

function localFeed(sort: 'new' | 'hot'): RadioSignalPreview[] {
  const local = readStored().map(storedToPreview).filter((item) => item.visibility === 'public')
  const seeds = listSeedPreviews().map((item) => {
    const boost = localBoost(item.code)
    return boost
      ? {
          ...item,
          hearts: item.hearts + (Number.isFinite(boost.added) ? boost.added : 0),
        }
      : item
  })
  const seen = new Set<string>()
  return sortSignals(
    [...local, ...seeds].filter((item) => {
      const key = item.code.toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
    sort,
  )
}

export function previewLocalSignals(sort: 'new' | 'hot' = 'new') {
  return localFeed(sort)
}

export async function listRadioSignals(sort: 'new' | 'hot' = 'new'): Promise<RadioFeed> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('OFFLINE')
    const data = await requestJson<{ items?: unknown[] }>(`${API_BASE}?sort=${sort}&limit=32`, undefined, TIMEOUT_LIST)
    if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE')
    const cloud = data.items
      .map(decodePreview)
      .filter((item): item is RadioSignalPreview => item !== null)
    const local = readStored().map(storedToPreview).filter((item) => item.visibility === 'public')
    const seeds = listSeedPreviews().map((item) => {
      const boost = localBoost(item.code)
      return boost ? { ...item, hearts: item.hearts + (Number.isFinite(boost.added) ? boost.added : 0) } : item
    })
    const seen = new Set<string>()
    const merged = [...cloud, ...local, ...seeds].filter((item) => {
      const key = item.code.toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return { items: sortSignals(merged, sort), source: 'cloud' }
  } catch {
    return { items: localFeed(sort), source: 'local' }
  }
}

async function hydrateStoredSignal(item: StoredVision): Promise<RadioSignal> {
  const signal = storedToSignal(item)
  if (signal.packet.voice && signal.packet.voice.startsWith(VOICE_IDB_PREFIX)) {
    const key = signal.packet.voice.slice(VOICE_IDB_PREFIX.length)
    const voiceData = await getMedia(`vision-voice:${key}`)
    return { ...signal, packet: { ...signal.packet, voice: voiceData } }
  }
  return signal
}

export async function getRadioSignal(code: string): Promise<RadioSignal | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const localStored = readStored().find((item) => item.code.toUpperCase() === normalized)
  if (isSeedCode(normalized)) return getSeedSignal(normalized)
  if (localStored && (typeof navigator === 'undefined' || navigator.onLine === false)) {
    return hydrateStoredSignal(localStored)
  }
  try {
    const data = await requestJson<unknown>(`${API_BASE}/${encodeURIComponent(normalized)}`, undefined, TIMEOUT_SIGNAL)
    const signal = decodeSignal(data)
    if (signal) return signal
  } catch {
    /* 云端不可用时读取本机封存的视野 */
  }
  if (localStored) return hydrateStoredSignal(localStored)
  return getSeedSignal(normalized)
}

export async function publishRadioSignal(packet: VisionPacket, visibility: VisionVisibility): Promise<PublishResult> {
  const publishedAt = Date.now()
  const signalBase: Omit<RadioSignal, 'code'> = {
    packet,
    hearts: 0,
    echoes: [],
    visibility,
    origin: 'cloud',
    publishedAt,
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('OFFLINE')
    const thumbnail = await makeThumbnail(packet.image)
    const data = await requestJson<{ code?: unknown; ownerToken?: unknown }>(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ packet, thumbnail, visibility }),
    }, TIMEOUT_PUBLISH)
    if (typeof data.code !== 'string' || !/^[A-Z2-9]{6}$/.test(data.code)) throw new Error('INVALID_RESPONSE')
    const signal: RadioSignal = { ...signalBase, code: data.code }
    const ownerToken = typeof data.ownerToken === 'string' && /^[0-9a-f]{48}$/.test(data.ownerToken)
      ? data.ownerToken
      : undefined
    rememberLocal(signal, ownerToken, thumbnail)
    return {
      code: data.code,
      link: buildSignalLink(data.code),
      visibility,
      source: 'cloud',
      signal,
    }
  } catch {
    const code = makeLocalCode()
    const signal: RadioSignal = { ...signalBase, code, origin: 'local' }
    let storedImage = PLACEHOLDER_IMAGE
    try {
      storedImage = await makeThumbnail(packet.image)
    } catch {
      /* 原图过大或无法解码时用纯色占位，保证记录本身不丢 */
    }
    rememberLocal(signal, undefined, storedImage)
    return {
      code,
      link: buildSignalLink(code),
      visibility,
      source: 'local',
      signal,
    }
  }
}

export async function sendRadioHeartbeat(
  code: string,
  message: string | undefined,
  baseHearts: number,
): Promise<HeartbeatResult> {
  const normalized = code.trim().toUpperCase()
  const cleanMessage = message?.trim().slice(0, 120) || undefined
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('OFFLINE')
    const data = await requestJson<{ hearts?: unknown; echoes?: unknown }>(
      `${API_BASE}/${encodeURIComponent(normalized)}/heartbeat`,
      {
        method: 'POST',
        body: JSON.stringify(cleanMessage ? { message: cleanMessage } : {}),
      },
      TIMEOUT_HEARTBEAT,
    )
    if (typeof data.hearts !== 'number') throw new Error('INVALID_RESPONSE')
    const cloudEchoes = Array.isArray(data.echoes) ? (data.echoes as VisionEcho[]) : []
    clearLocalBoost(normalized)
    return {
      hearts: data.hearts,
      echoes: sortEchoes(cloudEchoes),
      source: 'cloud',
    }
  } catch {
    const store = readHeartStore()
    const current = store[normalized] ?? { added: 0, echoes: [] }
    const echo: VisionEcho | null = cleanMessage
      ? {
          id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          message: cleanMessage,
          createdAt: Date.now(),
        }
      : null
    const next: LocalHeartRecord = {
      added: (Number.isFinite(current.added) ? current.added : 0) + 1,
      echoes: echo ? [...(Array.isArray(current.echoes) ? current.echoes : []), echo].slice(-6) : current.echoes,
    }
    store[normalized] = next
    writeHeartStore(store)
    return {
      hearts: baseHearts + 1,
      echoes: sortEchoes(next.echoes),
      source: 'local',
    }
  }
}

export function buildShareLink(code: string) {
  return buildSignalLink(code)
}

export function localSignalCount() {
  return readStored().length
}

export function getLocalSignal(code: string) {
  const found = readStored().find((item) => item.code.toUpperCase() === code.trim().toUpperCase())
  return found ? storedToSignal(found) : null
}

export interface MyVision {
  code: string
  title: string
  city: string
  thumbnail: string
  savedAt: number
  visibility: VisionVisibility
  hearts: number
  onCloud: boolean
  deletable: boolean
}

export function listMyVisions(): MyVision[] {
  return readStored()
    .map((item) => {
      const onCloud = item.origin === 'cloud'
      return {
        code: item.code,
        title: item.packet.title,
        city: item.packet.city,
        thumbnail: item.packet.image,
        savedAt: item.savedAt,
        visibility: item.visibility === 'private' ? 'private' : ('public' as VisionVisibility),
        hearts: storedToSignal(item).hearts,
        onCloud,
        deletable: !onCloud || Boolean(item.ownerToken),
      }
    })
    .sort((a, b) => b.savedAt - a.savedAt)
}

export function ownsLocalVision(code: string): boolean {
  const key = code.trim().toUpperCase()
  const entry = readStored().find((item) => item.code.toUpperCase() === key)
  return Boolean(entry?.ownerToken)
}

export async function deleteMyVision(code: string): Promise<'cloud' | 'local'> {
  const key = code.trim().toUpperCase()
  const entry = readStored().find((item) => item.code.toUpperCase() === key)
  let source: 'cloud' | 'local' = 'local'
  if (entry?.origin === 'cloud' && entry.ownerToken) {
    try {
      await requestJson<{ deleted?: unknown }>(`${API_BASE}/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { 'x-owner-token': entry.ownerToken },
      }, TIMEOUT_SIGNAL)
      source = 'cloud'
    } catch {
      /* 云端不可达时只清本机，不打断访客 */
    }
  }
  writeStored(readStored().filter((item) => item.code.toUpperCase() !== key))
  void deleteMedia(`vision-voice:${key}`)
  clearLocalBoost(key)
  return source
}