export type DioramaSceneId =
  | 'shanghai'
  | 'library'
  | 'sydney'
  | 'hawaii'
  | 'harbin'
  | 'observatory'

export type AlbumSceneId = DioramaSceneId | 'meadow'

export interface AlbumEntry {
  id: string
  sceneId: AlbumSceneId
  sceneTitle: string
  city: string
  mood: 'dusk' | 'night'
  image: string
  note: string
  interactions: number
  createdAt: number
  promiseQuote?: string | null
}

const STORAGE_KEY = 'vision6371_keepsake_album_v1'
const MAX_ENTRIES = 18
const MAX_BYTES = 3_400_000

function isValidEntry(value: unknown): value is AlbumEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<AlbumEntry>
  return (
    typeof item.id === 'string' &&
    typeof item.sceneId === 'string' &&
    typeof item.sceneTitle === 'string' &&
    typeof item.city === 'string' &&
    (item.mood === 'dusk' || item.mood === 'night') &&
    typeof item.image === 'string' &&
    typeof item.note === 'string' &&
    typeof item.interactions === 'number' &&
    typeof item.createdAt === 'number'
  )
}

function approxBytes(entries: AlbumEntry[]) {
  return JSON.stringify(entries).length * 2
}

function persistEntries(entries: AlbumEntry[]): AlbumEntry[] {
  let trimmed = entries.slice(0, MAX_ENTRIES)
  while (trimmed.length > 1 && approxBytes(trimmed) > MAX_BYTES) {
    trimmed = trimmed.slice(0, -1)
  }
  if (typeof window === 'undefined') return trimmed
  while (trimmed.length >= 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      return trimmed
    } catch {
      if (trimmed.length <= 1) return []
      trimmed = trimmed.slice(0, -1)
    }
  }
  return trimmed
}

export function loadAlbum(): AlbumEntry[] {
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

export function saveAlbumEntry(entry: AlbumEntry): AlbumEntry[] {
  const existing = loadAlbum().filter((item) => item.id !== entry.id)
  return persistEntries([entry, ...existing])
}

export function updateAlbumNote(id: string, note: string): AlbumEntry[] {
  const next = loadAlbum().map((item) => (item.id === id ? { ...item, note: note.slice(0, 160) } : item))
  return persistEntries(next)
}

export function deleteAlbumEntry(id: string): AlbumEntry[] {
  const next = loadAlbum().filter((item) => item.id !== id)
  return persistEntries(next)
}

export function clearAlbum(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
