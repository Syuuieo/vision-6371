import { useSyncExternalStore } from 'react'

export type QualityTier = 'auto' | 'full' | 'lite'

export interface VisionSettings {
  masterVolume: number
  ambienceVolume: number
  voiceVolume: number
  sfxVolume: number
  quality: QualityTier
  reducedMotion: boolean
  flashSafe: boolean
  parallax: boolean
  flashNoticeSeen: boolean
  landscapeHintSeen: boolean
}

const STORAGE_KEY = 'vision6371:settings:v1'

export const DEFAULT_SETTINGS: VisionSettings = {
  masterVolume: 1,
  ambienceVolume: 1,
  voiceVolume: 1,
  sfxVolume: 1,
  quality: 'auto',
  reducedMotion: false,
  flashSafe: false,
  parallax: false,
  flashNoticeSeen: false,
  landscapeHintSeen: false,
}

const QUALITY_TIERS: QualityTier[] = ['auto', 'full', 'lite']

function clampVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function normalize(raw: Partial<VisionSettings>): VisionSettings {
  return {
    masterVolume: clampVolume(raw.masterVolume),
    ambienceVolume: clampVolume(raw.ambienceVolume),
    voiceVolume: clampVolume(raw.voiceVolume),
    sfxVolume: clampVolume(raw.sfxVolume),
    quality: QUALITY_TIERS.includes(raw.quality as QualityTier)
      ? (raw.quality as QualityTier)
      : 'auto',
    reducedMotion: Boolean(raw.reducedMotion),
    flashSafe: Boolean(raw.flashSafe),
    parallax: Boolean(raw.parallax),
    flashNoticeSeen: Boolean(raw.flashNoticeSeen),
    landscapeHintSeen: Boolean(raw.landscapeHintSeen),
  }
}

function loadSettings(): VisionSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return normalize(JSON.parse(raw) as Partial<VisionSettings>)
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persist(settings: VisionSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* storage disabled or full */
  }
}

let current: VisionSettings = loadSettings()
const listeners = new Set<() => void>()

export function getSettings(): VisionSettings {
  return current
}

export function updateSettings(patch: Partial<VisionSettings>): VisionSettings {
  current = normalize({ ...current, ...patch })
  persist(current)
  listeners.forEach((listener) => listener())
  return current
}

export function resetSettings(): VisionSettings {
  return updateSettings({
    ...DEFAULT_SETTINGS,
    flashNoticeSeen: current.flashNoticeSeen,
    landscapeHintSeen: current.landscapeHintSeen,
  })
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSettings(): VisionSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings)
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(pointer: coarse)').matches
}