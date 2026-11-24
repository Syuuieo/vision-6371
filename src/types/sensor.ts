export type ModuleId = 'prologue' | 'radio' | 'post' | 'diorama'

export type SkyStage = 0 | 1 | 2

export type ActId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type EggId = 'bottle' | 'tablet' | 'meteor'

export type CollectionId = 'flower' | 'wind' | 'stars'

export type Phase =
  | 'ritual'
  | 'intro_call'
  | 'explore'
  | 'descending'
  | 'core_pulse'
  | 'epilogue'

export type FocusTarget =
  | 'home'
  | 'flower'
  | 'wind'
  | 'sky'
  | 'lake'
  | 'shore'
  | 'dandelion'
  | 'fireflies'
  | 'tree'
  | 'ruin'
  | 'boat'

export type PickId = CollectionId | 'lake' | 'star1' | 'star2' | 'star3' | EggId

export type QuoteKey =
  | 'flower'
  | 'wind'
  | 'dandelion'
  | 'ruin'
  | 'rain'
  | 'fireflies'
  | 'stars'

export type PanelKind =
  | 'none'
  | 'focus'
  | 'wind'
  | 'dandelion'
  | 'ruin'
  | 'rain'
  | 'fireflies'
  | 'constellation'

export interface IntroBeat {
  speaker: string
  timeLabel: string
  text: string
  sub?: string
}

export interface DescentCaption {
  thresholdKm: number
  layer: string
  line: string
}

export interface BriefingItem {
  tag: string
  title: string
  body: string
}

export interface DialogueChoice {
  id: string
  label: string
  reply: string[]
  epilogueNote?: string
  wishNote?: string
}

export interface SensorReadings {
  /** 0..1 光感强度 */
  light: number
  /** 0..1 风速感应 */
  wind: number
  /** 0..1 花香波谱 */
  scent: number
  /** 0..1 声频清晰度 */
  sound: number
}

export interface SensorState {
  phase: Phase
  act: ActId
  stage: SkyStage
  completed: CollectionId[]
  activeTask: CollectionId | null
  tuned: boolean
  muted: boolean
  readings: SensorReadings
  signal: number
  depthKm: number
  depthRevealed: boolean
  eggsFound: EggId[]
  pressureAlert: boolean
}

export interface CollectionMeta {
  id: CollectionId
  index: string
  title: string
  short: string
  hint: string
  hudLabel: string
  accent: string
  focus: FocusTarget
}

export interface StepMeta {
  act: ActId
  index: string
  title: string
  short: string
  timeLabel: string
  hint: string
  accent: string
  focus: FocusTarget
}

export interface StageMeta {
  index: string
  name: string
  english: string
}

export type DescentEvent =
  | { type: 'breach' }
  | { type: 'mantle' }
  | { type: 'core' }
  | { type: 'arrive' }
  | { type: 'tick'; progress: number }

export interface PrologueQuote {
  eyebrow: string
  lines: string[]
  clue?: {
    id: string
    label: string
  }
  question?: string
  choices?: DialogueChoice[]
  nextLabel?: string
  signature: string
}

export interface StageLookMeta {
  stage: SkyStage
  label: string
  english: string
  time: string
}

export interface EasterEggMeta {
  id: EggId
  kicker: string
  title: string
  lines: string[]
  signature: string
  accent: string
}

export interface TruthMeta {
  tag: string
  depth: string
  unit: string
  subtitle: string
  lines: string[]
  vessel: string
  warning: string
}
