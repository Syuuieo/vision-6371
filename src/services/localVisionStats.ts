export const LOCAL_PACKETS_STORAGE_KEY = 'vision6371:packets:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function localSignalCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(LOCAL_PACKETS_STORAGE_KEY)
    if (!raw) return 0
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return 0
    return data.filter(
      (item) =>
        isRecord(item) &&
        typeof item.code === 'string' &&
        typeof item.savedAt === 'number' &&
        isRecord(item.packet) &&
        typeof item.packet.image === 'string',
    ).length
  } catch {
    return 0
  }
}
