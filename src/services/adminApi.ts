import { LOCAL_PACKETS_STORAGE_KEY } from './localVisionStats'
import { deleteMedia } from './mediaDb'
import type { StoredVision, VisionEcho, VisionVisibility } from '../types/vision'

const API_ADMIN_BASE = '/functions/v1/app/api/admin'
const ADMIN_SESSION_KEY = 'vision6371:admin_token_v1'
const LOCAL_HEARTS_KEY = 'vision6371:radio:hearts:v1'
const ADMIN_TIMEOUT_MS = 8000

export type AdminMode = 'cloud' | 'local'
export type AdminErrorKind = 'unauthorized' | 'unconfigured' | 'offline' | 'request_failed'

export class AdminApiError extends Error {
  readonly kind: AdminErrorKind

  constructor(kind: AdminErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface AdminStats {
  totalVisions: number
  publicVisions: number
  privateVisions: number
  totalHearts: number
  totalEchoes: number
  citiesCount: number
  voiceVisions: number
  recent24h: number
}

export interface AdminEchoSummary {
  id: string
  visionId: string
  visionCode: string
  visionTitle: string
  city: string
  message: string
  createdAt: number
}

export interface AdminVisionSummary {
  id: string
  code: string
  title: string
  sender: string
  city: string
  thumbnail: string
  tempC: number
  windLevel: number
  scentTag: string
  particles: string
  ambience: string
  hasVoice: boolean
  hearts: number
  visibility: VisionVisibility
  publishedAt: number
  letter: string
  weather: string
  sticker: string
  stampId: string
  echoes: VisionEcho[]
}

export interface AdminOverview {
  stats: AdminStats
  visions: AdminVisionSummary[]
  recentEchoes: AdminEchoSummary[]
}

export function loadAdminSessionToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveAdminSessionToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearAdminSessionToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

async function adminRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ADMIN_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_ADMIN_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        'x-admin-token': token.trim(),
        ...(init.headers ?? {}),
      },
    })
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new AdminApiError('offline', '云端后台接口未就绪，可能正处于本地预览环境')
    }
    const payload = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      if (response.status === 401) {
        throw new AdminApiError('unauthorized', '管理员密钥不正确，请核对 ADMIN_TOKEN')
      }
      if (response.status === 503) {
        throw new AdminApiError(
          'unconfigured',
          '云端尚未配置 ADMIN_TOKEN（请在 Qoder Sites 环境变量中设置至少 8 位密钥后重新部署）',
        )
      }
      const errCode =
        typeof payload.code === 'string'
          ? payload.code
          : typeof (payload.error as { code?: unknown } | undefined)?.code === 'string'
            ? String((payload.error as { code: string }).code)
            : ''
      if (response.status === 404 && !errCode) {
        throw new AdminApiError('offline', '云端后台接口未找到')
      }
      throw new AdminApiError('request_failed', `操作失败（HTTP ${response.status}）`)
    }
    return payload as T
  } catch (error) {
    if (error instanceof AdminApiError) throw error
    throw new AdminApiError('offline', '当前无法连接到云端数据库')
  } finally {
    window.clearTimeout(timer)
  }
}

export async function fetchAdminOverview(
  token: string,
  filters: { visibility?: 'all' | VisionVisibility; q?: string } = {},
): Promise<AdminOverview> {
  const params = new URLSearchParams()
  if (filters.visibility && filters.visibility !== 'all') {
    params.set('visibility', filters.visibility)
  }
  if (filters.q?.trim()) {
    params.set('q', filters.q.trim())
  }
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return adminRequest<AdminOverview>(`/overview${suffix}`, token, { method: 'GET' })
}

export async function adminSetVisionVisibility(
  token: string,
  code: string,
  visibility: VisionVisibility,
): Promise<void> {
  await adminRequest<{ code: string; visibility: VisionVisibility }>(
    `/visions/${encodeURIComponent(code.toUpperCase())}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    },
  )
}

export async function adminDeleteVision(token: string, code: string): Promise<void> {
  await adminRequest<{ deleted: boolean }>(
    `/visions/${encodeURIComponent(code.toUpperCase())}`,
    token,
    { method: 'DELETE' },
  )
}

export async function adminDeleteEcho(token: string, echoId: string): Promise<void> {
  await adminRequest<{ deleted: boolean }>(
    `/echoes/${encodeURIComponent(echoId)}`,
    token,
    { method: 'DELETE' },
  )
}

interface LocalHeartRecord {
  added?: number
  echoes?: VisionEcho[]
}

function readLocalStored(): StoredVision[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_PACKETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as StoredVision[]) : []
  } catch {
    return []
  }
}

function writeLocalStored(list: StoredVision[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_PACKETS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function readLocalHearts(): Record<string, LocalHeartRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LOCAL_HEARTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, LocalHeartRecord>)
      : {}
  } catch {
    return {}
  }
}

function writeLocalHearts(store: Record<string, LocalHeartRecord>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_HEARTS_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function loadLocalAdminOverview(
  filters: { visibility?: 'all' | VisionVisibility; q?: string } = {},
): AdminOverview {
  const stored = [...readLocalStored()].sort((a, b) => b.savedAt - a.savedAt)
  const heartStore = readLocalHearts()
  const q = filters.q?.trim().toLowerCase() ?? ''
  const visibilityFilter = filters.visibility ?? 'all'

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000
  const cities = new Set<string>()
  let publicVisions = 0
  let privateVisions = 0
  let totalHearts = 0
  let voiceVisions = 0
  let recent24h = 0

  const recentEchoesAll: AdminEchoSummary[] = []

  const allVisions: AdminVisionSummary[] = stored.map((item) => {
    const code = item.code.toUpperCase()
    const pkt = item.packet
    const vis: VisionVisibility = item.visibility === 'private' ? 'private' : 'public'
    if (vis === 'private') privateVisions += 1
    else publicVisions += 1
    const boost = heartStore[code]
    const hearts = Math.max(0, Number(item.hearts) || 0) + Math.max(0, Number(boost?.added) || 0)
    const echoes = [...(boost?.echoes ?? [])].sort((a, b) => b.createdAt - a.createdAt)
    totalHearts += hearts
    const hasVoice = Boolean(pkt.voice)
    if (hasVoice) voiceVisions += 1
    if (pkt.city) cities.add(pkt.city)
    if (item.savedAt >= cutoff24h) recent24h += 1

    for (const echo of echoes) {
      recentEchoesAll.push({
        id: echo.id,
        visionId: pkt.id || code,
        visionCode: code,
        visionTitle: pkt.title,
        city: pkt.city,
        message: echo.message,
        createdAt: echo.createdAt,
      })
    }

    return {
      id: pkt.id || code,
      code,
      title: pkt.title,
      sender: pkt.sender,
      city: pkt.city,
      thumbnail: pkt.image,
      tempC: pkt.tempC,
      windLevel: pkt.windLevel,
      scentTag: pkt.scentTag ?? '',
      particles: pkt.particles,
      ambience: pkt.ambience,
      hasVoice,
      hearts,
      visibility: vis,
      publishedAt: item.savedAt,
      letter: pkt.letter ?? '',
      weather: pkt.weather ?? '',
      sticker: pkt.sticker ?? '',
      stampId: pkt.stampId ?? '',
      echoes,
    }
  })

  recentEchoesAll.sort((a, b) => b.createdAt - a.createdAt)

  const filteredVisions = allVisions.filter((item) => {
    if (visibilityFilter !== 'all' && item.visibility !== visibilityFilter) return false
    if (!q) return true
    return (
      item.code.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.sender.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q) ||
      item.scentTag.toLowerCase().includes(q) ||
      item.letter.toLowerCase().includes(q)
    )
  })

  const filteredEchoes = recentEchoesAll
    .filter((item) => {
      if (!q) return true
      return (
        item.message.toLowerCase().includes(q) ||
        item.visionCode.toLowerCase().includes(q) ||
        item.visionTitle.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q)
      )
    })
    .slice(0, 80)

  return {
    stats: {
      totalVisions: allVisions.length,
      publicVisions,
      privateVisions,
      totalHearts,
      totalEchoes: recentEchoesAll.length,
      citiesCount: cities.size,
      voiceVisions,
      recent24h,
    },
    visions: filteredVisions,
    recentEchoes: filteredEchoes,
  }
}

export function localAdminSetVisibility(code: string, visibility: VisionVisibility): void {
  const key = code.trim().toUpperCase()
  const next = readLocalStored().map((item) =>
    item.code.toUpperCase() === key ? { ...item, visibility } : item,
  )
  writeLocalStored(next)
}

export function localAdminDeleteVision(code: string): void {
  const key = code.trim().toUpperCase()
  writeLocalStored(readLocalStored().filter((item) => item.code.toUpperCase() !== key))
  const hearts = readLocalHearts()
  if (key in hearts) {
    delete hearts[key]
    writeLocalHearts(hearts)
  }
  void deleteMedia(`vision-voice:${key}`)
}

export function localAdminDeleteEcho(visionCode: string, echoId: string): void {
  const key = visionCode.trim().toUpperCase()
  const hearts = readLocalHearts()
  const record = hearts[key]
  if (!record?.echoes) return
  hearts[key] = {
    ...record,
    echoes: record.echoes.filter((echo) => echo.id !== echoId),
  }
  writeLocalHearts(hearts)
}
