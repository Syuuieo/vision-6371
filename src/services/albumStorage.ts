import { deleteMedia, deleteMediaByPrefix, getMedia, putMedia } from './mediaDb'

export type DioramaSceneId =
  | 'shanghai'
  | 'library'
  | 'sydney'
  | 'hawaii'
  | 'harbin'
  | 'observatory'

export type AlbumSceneId = DioramaSceneId | 'meadow' | 'postcard'
export type AlbumMood = 'dawn' | 'dusk' | 'night'

export interface AlbumEntry {
  id: string
  sceneId: AlbumSceneId
  sceneTitle: string
  city: string
  mood: AlbumMood
  image: string
  note: string
  interactions: number
  createdAt: number
  promiseQuote?: string | null
  awakened?: boolean
  stampTitle?: string
}

const STORAGE_KEY = 'vision6371_keepsake_album_v1'
const STAMPS_KEY = 'vision6371_diorama_stamps_v1'
const MAX_ENTRIES = 48
const MAX_INLINE_BYTES = 1_400_000
const IDB_PREFIX = 'idb:album:'
const VALID_MOODS: readonly AlbumMood[] = ['dawn', 'dusk', 'night']
const VALID_STAMP_SCENES: readonly DioramaSceneId[] = [
  'shanghai',
  'library',
  'sydney',
  'hawaii',
  'harbin',
  'observatory',
]

const memoryImages = new Map<string, string>()
const albumListeners = new Set<() => void>()

function notifyAlbumChange() {
  albumListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      /* ignore */
    }
  })
}

export function subscribeAlbum(listener: () => void): () => void {
  albumListeners.add(listener)
  return () => {
    albumListeners.delete(listener)
  }
}

export function inferAlbumSceneId(city: string, presetId?: string): AlbumSceneId {
  const text = `${city} ${presetId ?? ''}`.trim().toLowerCase()
  if (text.includes('上海') || text.includes('shanghai')) return 'shanghai'
  if (text.includes('南京') || text.includes('图书馆') || text.includes('library')) return 'library'
  if (text.includes('悉尼') || text.includes('sydney')) return 'sydney'
  if (text.includes('夏威夷') || text.includes('hawaii') || text.includes('sea')) return 'hawaii'
  if (text.includes('哈尔滨') || text.includes('harbin')) return 'harbin'
  if (
    text.includes('拉萨') ||
    text.includes('西藏') ||
    text.includes('那曲') ||
    text.includes('观星') ||
    text.includes('observatory')
  ) {
    return 'observatory'
  }
  if (text.includes('草原') || text.includes('meadow')) return 'meadow'
  return 'postcard'
}

function isValidEntry(value: unknown): value is AlbumEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<AlbumEntry>
  return (
    typeof item.id === 'string' &&
    typeof item.sceneId === 'string' &&
    typeof item.sceneTitle === 'string' &&
    typeof item.city === 'string' &&
    typeof item.mood === 'string' &&
    VALID_MOODS.includes(item.mood as AlbumMood) &&
    typeof item.image === 'string' &&
    typeof item.note === 'string' &&
    typeof item.interactions === 'number' &&
    typeof item.createdAt === 'number'
  )
}

function approxBytes(entries: AlbumEntry[]) {
  return JSON.stringify(entries).length * 2
}

function cacheImage(entry: AlbumEntry) {
  if (entry.image && !entry.image.startsWith(IDB_PREFIX)) {
    memoryImages.set(entry.id, entry.image)
    void putMedia(`album:${entry.id}`, entry.image)
  }
}

function readRawEntries(): AlbumEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry).slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function hydrateSync(entries: AlbumEntry[]): AlbumEntry[] {
  const hydrated: AlbumEntry[] = []
  for (const entry of entries) {
    if (entry.image.startsWith(IDB_PREFIX)) {
      const mem = memoryImages.get(entry.id)
      if (mem) hydrated.push({ ...entry, image: mem })
    } else {
      memoryImages.set(entry.id, entry.image)
      hydrated.push(entry)
    }
  }
  return hydrated
}

function persistEntries(entries: AlbumEntry[]): AlbumEntry[] {
  const trimmed = entries.slice(0, MAX_ENTRIES)
  trimmed.forEach(cacheImage)

  if (typeof window === 'undefined') {
    const result = hydrateSync(trimmed)
    notifyAlbumChange()
    return result
  }

  // 先让最新的条目优先内联，超过安全体积则将旧图卸载到 IndexedDB，仅保留 idb 指针
  let storageCopy: AlbumEntry[] = trimmed.map((e) => ({ ...e }))
  for (let i = storageCopy.length - 1; i >= 0 && approxBytes(storageCopy) > MAX_INLINE_BYTES; i -= 1) {
    if (!storageCopy[i].image.startsWith(IDB_PREFIX)) {
      storageCopy[i] = { ...storageCopy[i], image: `${IDB_PREFIX}${storageCopy[i].id}` }
    }
  }

  while (storageCopy.length >= 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageCopy))
      const result = hydrateSync(trimmed)
      notifyAlbumChange()
      return result
    } catch {
      // 如果 localStorage 仍报配额异常，优先继续把剩余内联图片卸载为 idb 指针
      let offloaded = false
      for (let i = storageCopy.length - 1; i >= 0; i -= 1) {
        if (!storageCopy[i].image.startsWith(IDB_PREFIX)) {
          storageCopy[i] = { ...storageCopy[i], image: `${IDB_PREFIX}${storageCopy[i].id}` }
          offloaded = true
          break
        }
      }
      if (offloaded) continue
      if (storageCopy.length <= 1) {
        try {
          window.localStorage.setItem(STORAGE_KEY, '[]')
        } catch {
          /* ignore */
        }
        const result = hydrateSync(trimmed)
        notifyAlbumChange()
        return result
      }
      storageCopy = storageCopy.slice(0, -1)
    }
  }
  const result = hydrateSync(trimmed)
  notifyAlbumChange()
  return result
}

export function loadAlbum(): AlbumEntry[] {
  return hydrateSync(readRawEntries())
}

export async function loadAlbumAsync(): Promise<AlbumEntry[]> {
  const raw = readRawEntries()
  const resolved: AlbumEntry[] = []
  for (const entry of raw) {
    if (!entry.image.startsWith(IDB_PREFIX)) {
      memoryImages.set(entry.id, entry.image)
      void putMedia(`album:${entry.id}`, entry.image)
      resolved.push(entry)
      continue
    }
    const cached = memoryImages.get(entry.id)
    if (cached) {
      resolved.push({ ...entry, image: cached })
      continue
    }
    const stored = await getMedia(`album:${entry.id}`)
    if (stored) {
      memoryImages.set(entry.id, stored)
      resolved.push({ ...entry, image: stored })
    }
  }
  return resolved
}

export function getAlbumCount(): number {
  return readRawEntries().length
}

export function saveAlbumEntry(entry: AlbumEntry): AlbumEntry[] {
  cacheImage(entry)
  const existing = readRawEntries().filter((item) => item.id !== entry.id)
  return persistEntries([entry, ...existing])
}

export function updateAlbumNote(id: string, note: string): AlbumEntry[] {
  const next = readRawEntries().map((item) => (item.id === id ? { ...item, note: note.slice(0, 160) } : item))
  return persistEntries(next)
}

export function deleteAlbumEntry(id: string): AlbumEntry[] {
  memoryImages.delete(id)
  void deleteMedia(`album:${id}`)
  const next = readRawEntries().filter((item) => item.id !== id)
  return persistEntries(next)
}

export function clearAlbum(): void {
  memoryImages.clear()
  void deleteMediaByPrefix('album:')
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
  notifyAlbumChange()
}

export function loadDioramaStamps(): DioramaSceneId[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STAMPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const unique: DioramaSceneId[] = []
    for (const item of parsed) {
      if (
        typeof item === 'string' &&
        VALID_STAMP_SCENES.includes(item as DioramaSceneId) &&
        !unique.includes(item as DioramaSceneId)
      ) {
        unique.push(item as DioramaSceneId)
      }
    }
    return unique
  } catch {
    return []
  }
}

export function markDioramaStamp(sceneId: DioramaSceneId): DioramaSceneId[] {
  const current = loadDioramaStamps()
  if (current.includes(sceneId)) return current
  const next = [...current, sceneId]
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STAMPS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

export function clearDioramaStamps(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STAMPS_KEY)
  } catch {
    /* ignore */
  }
}
