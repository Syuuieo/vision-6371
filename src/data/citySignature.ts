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
  悉尼: {
    weather: '南半球盛夏',
    verb: '听一声港湾汽笛',
    reply: '北半球正在过冬，可这里的海风还是热的。她说原来地球另一边一直藏着夏天。',
    effect: 'ripple',
  },
  夏威夷: {
    weather: '热带椰风',
    verb: '捧起一捧温热海沙',
    reply: '金红色的夕阳落进太平洋。她说热浪拍在脚背上，比岩浆温柔一万倍。',
    effect: 'bloom',
  },
  雷克雅未克: {
    weather: '极光冰夜',
    verb: '仰头追一道极光',
    reply: '绿色的光幕在冰原上慢慢折起。她说这是她从未见过的天空的呼吸。',
    effect: 'starlight',
  },
  开普敦: {
    weather: '南大洋晴夏',
    verb: '迎着好望角张开手',
    reply: '云像瀑布一样从桌山边缘倾泻下来。她说风从两大洋交汇的地方吹过来真宽敞。',
    effect: 'sway',
  },
  京都: {
    weather: '鸭川晚岚',
    verb: '拨响檐下风铃',
    reply: '清脆的一声顺着河面飘走。她说木廊和河水的声音让人瞬间安静下来。',
    effect: 'sway',
  },
  巴黎: {
    weather: '塞纳河暮色',
    verb: '听远处街头手风琴',
    reply: '路灯倒映在河水里晃成一条金带。她说人群走过的脚步声原来这么暖。',
    effect: 'bloom',
  },
}

const AMBIENCE_FALLBACK: Record<AmbientKind, SignatureEffect> = {
  rain: 'drizzle',
  ocean: 'ripple',
  night: 'starlight',
  cicada: 'bloom',
  wind: 'sway',
  library: 'bloom',
  snow: 'frost',
  city: 'starlight',
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
