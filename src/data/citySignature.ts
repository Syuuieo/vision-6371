import type { AmbientKind } from '../types/vision'

export type SignatureEffect = 'frost' | 'ripple' | 'starlight' | 'bloom' | 'drizzle' | 'sway'

export interface CitySignature {
  weather: string
  verb: string
  reply: string
  effect: SignatureEffect
}

export const CITY_SIGNATURES: Record<string, CitySignature> = {
  北京: {
    weather: '干冷晴',
    verb: '呵一口气',
    reply: '镜片起了雾，胡同的灯被揉成一团暖黄。她说这就是她记忆里的冬天。',
    effect: 'frost',
  },
  哈尔滨: {
    weather: '细雪',
    verb: '接一片雪',
    reply: '雪花落在镜片上化成一点水。她笑说，像有人替她擦了擦眼睛。',
    effect: 'frost',
  },
  三亚: {
    weather: '闷热无风',
    verb: '踩一脚浪',
    reply: '海水漫过脚背。她说她从来没真正感受过浪的温度。',
    effect: 'ripple',
  },
  青岛: {
    weather: '海雾',
    verb: '踢一下防波堤',
    reply: '鞋底磕出闷响，回声被海风拖走，像很远的地方有人在回答。',
    effect: 'ripple',
  },
  大理: {
    weather: '晚风',
    verb: '把手伸进洱海',
    reply: '水很凉。她说像摸到了一块在黑暗里藏了很久的石头。',
    effect: 'ripple',
  },
  武汉: {
    weather: '江雾',
    verb: '等一声汽笛',
    reply: '汽笛从雾里穿出来。她说，这是她第一次听见一条江的形状。',
    effect: 'ripple',
  },
  拉萨: {
    weather: '高原晴夜',
    verb: '数三颗星',
    reply: '三颗星连成一条线。她说在 6371 公里以下，是看不到星的。',
    effect: 'starlight',
  },
  上海: {
    weather: '末班地铁',
    verb: '贴着车窗看站台',
    reply: '站台的灯一盏盏退走。她说这像她每天穿过地层的那条隧道。',
    effect: 'starlight',
  },
  成都: {
    weather: '阴天有雾',
    verb: '捧一碗热汤',
    reply: '热气模糊了镜片。她说这味道让她想起很久以前的人间。',
    effect: 'bloom',
  },
  西安: {
    weather: '落日',
    verb: '摸一下城墙',
    reply: '砖是暖的。她说地心的岩壁也热，但从不带着落日的余温。',
    effect: 'bloom',
  },
  杭州: {
    weather: '夜雨',
    verb: '抖一下伞',
    reply: '雨点弹开。她说，雨声是她最想念的声音。',
    effect: 'drizzle',
  },
  南京: {
    weather: '梧桐夜雨',
    verb: '踩一片落叶',
    reply: '叶子在积水里打了个旋。她说这声音像有人在轻轻敲门。',
    effect: 'drizzle',
  },
}

const AMBIENCE_FALLBACK: Record<AmbientKind, SignatureEffect> = {
  rain: 'drizzle',
  ocean: 'ripple',
  night: 'starlight',
  cicada: 'bloom',
  wind: 'sway',
  none: 'sway',
}

const GENERIC_REPLY: Record<SignatureEffect, string> = {
  frost: '冷意漫上镜片。她说，原来冬天是这样贴在脸上的。',
  ripple: '水声一圈圈荡开。她说，原来声音也是有形状的。',
  starlight: '远处亮起几点光。她说，原来抬头是这样的感觉。',
  bloom: '一层暖光慢慢化开。她说，原来温度是可以被看见的。',
  drizzle: '雨点顺着画面淌下来。她说，原来雨是会走路的。',
  sway: '风从画面里穿过去。她说，原来风能带着别的东西一起走。',
}

export function citySignature(city: string): CitySignature | null {
  return CITY_SIGNATURES[city.trim()] ?? null
}

export function signatureFor(
  city: string,
  ambience: AmbientKind = 'wind',
): CitySignature {
  const known = citySignature(city)
  if (known) return known
  const effect = AMBIENCE_FALLBACK[ambience] ?? 'sway'
  return {
    weather: '',
    verb: effect === 'ripple' ? '把手伸进水里' : effect === 'starlight' ? '抬头看一会儿' : '替她深呼吸',
    reply: GENERIC_REPLY[effect],
    effect,
  }
}
