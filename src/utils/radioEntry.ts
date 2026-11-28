import type { DioramaSceneId } from '../services/albumStorage'
import type { RadioSignalPreview } from '../types/vision'

export const WALKABLE_CITY_SCENE: Record<string, DioramaSceneId> = {
  阿格拉: 'agra',
  格鲁吉亚: 'georgia',
  复活节岛: 'rapanui',
  吉萨: 'giza',
  罗马: 'rome',
  京都: 'kyoto',
  巴黎: 'paris',
  雷克雅未克: 'iceland',
  大理: 'dali',
  哈尔滨: 'harbin',
}

export type RadioEntry = { kind: 'world'; sceneId: DioramaSceneId } | { kind: 'signal' }

export function resolveRadioEntry(preview: RadioSignalPreview, forceSignal = false): RadioEntry {
  const sceneId = WALKABLE_CITY_SCENE[preview.city]
  if (!forceSignal && preview.origin === 'seed' && sceneId) return { kind: 'world', sceneId }
  return { kind: 'signal' }
}
