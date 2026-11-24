export type ParticleKind = 'rain' | 'firefly' | 'snow' | 'dust' | 'none'

export type AmbientKind = 'wind' | 'rain' | 'ocean' | 'cicada' | 'night' | 'library' | 'snow' | 'city' | 'none'

export type StudioMode = 'edit' | 'preview'

export interface FocusPoint {
  id: string
  /** 0..1 画面横向位置 */
  x: number
  /** 0..1 画面纵向位置 */
  y: number
  note: string
}

export interface VisionPacket {
  id: string
  title: string
  /** 寄件人署名 */
  sender: string
  city: string
  /** 压缩后的照片 DataURL */
  image: string
  particles: ParticleKind
  ambience: AmbientKind
  /** 可选 10 秒现场录音 DataURL */
  voice: string | null
  tempC: number
  /** 0 无风 · 1 微风 · 2 清风 · 3 长风 */
  windLevel: number
  scentTag: string
  focus: FocusPoint[]
  createdAt: number
}

export interface VisionPreset extends Omit<VisionPacket, 'image' | 'voice' | 'createdAt'> {
  essence: string
  palette: string
}

export type VisionVisibility = 'public' | 'private'

export type VisionOrigin = 'cloud' | 'local' | 'seed'

export interface VisionEcho {
  id: string
  message: string
  createdAt: number
}

export interface RadioSignal {
  code: string
  packet: VisionPacket
  hearts: number
  echoes: VisionEcho[]
  visibility: VisionVisibility
  origin: VisionOrigin
  publishedAt: number
}

export interface RadioSignalPreview {
  code: string
  title: string
  sender: string
  city: string
  thumbnail: string
  tempC: number
  windLevel: number
  scentTag: string
  particles: ParticleKind
  ambience: AmbientKind
  hasVoice: boolean
  hearts: number
  visibility: VisionVisibility
  origin: VisionOrigin
  publishedAt: number
}

export interface RadioFeed {
  items: RadioSignalPreview[]
  source: 'cloud' | 'local'
}

export interface StoredVision {
  packet: VisionPacket
  code: string
  savedAt: number
  visibility?: VisionVisibility
  hearts?: number
  echoes?: VisionEcho[]
  origin?: 'cloud' | 'local'
  ownerToken?: string
}

export interface PublishResult {
  code: string
  link: string
  visibility: VisionVisibility
  source: 'cloud' | 'local'
  signal: RadioSignal
}

export interface HeartbeatResult {
  hearts: number
  echoes: VisionEcho[]
  source: 'cloud' | 'local'
}

export const WIND_LABELS = ['无风', '微风', '清风', '长风'] as const

export const WIND_DESCRIPTIONS = [
  '空气几乎静止，只余一点余温',
  '树叶轻轻擦过彼此',
  '风从远处带来另一种气味',
  '衣角与发梢都被推着向前',
] as const