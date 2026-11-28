export interface SeedRadioBrief {
  code: string
  city: string
  title: string
  sender: string
}

export const SEED_RADIO_BRIEFS: readonly SeedRadioBrief[] = [
  { code: 'VRAG06', city: '阿格拉', title: '阿格拉 · 泰姬陵破晓', sender: '沙贾汗' },
  { code: 'VRRI07', city: '复活节岛', title: '复活节岛 · 摩艾石像阵', sender: '拉帕努伊守望者' },
  { code: 'VRRM08', city: '罗马', title: '罗马 · 斗兽场夕照', sender: '奥古斯都' },
  { code: 'VRDL05', city: '大理', title: '大理 · 洱海晚风', sender: '阿遥' },
  { code: 'VRHR04', city: '哈尔滨', title: '哈尔滨 · 初雪操场', sender: '宋野' },
  { code: 'VRGE12', city: '格鲁吉亚', title: '格鲁吉亚 · 圣剑双峰', sender: '高加索牧风人' },
  { code: 'VRSY13', city: '悉尼', title: '悉尼 · 南半球盛夏海港', sender: '南风渡客' },
  { code: 'VRGZ14', city: '吉萨', title: '吉萨 · 金字塔与狮身人面像', sender: '尼罗河行者' },
  { code: 'VRIS15', city: '雷克雅未克', title: '雷克雅未克 · 极光冰湾', sender: '北纬六十四' },
  { code: 'VRKY17', city: '京都', title: '京都 · 鸭川暮色风铃', sender: '木廊听风' },
  { code: 'VRPR18', city: '巴黎', title: '巴黎 · 塞纳河黄昏路灯', sender: '左岸散步者' },
]

// 旧 2D 城市仅用于已有书签兼容，不进入默认电台预设与每日信标。
const LEGACY_SEED_RADIO_BRIEFS: readonly SeedRadioBrief[] = [
  { code: 'VRHZ01', city: '杭州', title: '杭州 · 凌晨雨夜自习室', sender: '林见' },
  { code: 'VRQD02', city: '青岛', title: '青岛 · 傍晚防波堤', sender: '周岚' },
  { code: 'VRCD03', city: '成都', title: '成都 · 桂花巷口', sender: '阿澄' },
  { code: 'VRBJ09', city: '北京', title: '北京 · 胡同初冬', sender: '小满' },
  { code: 'VRXA10', city: '西安', title: '西安 · 城墙落日', sender: '阿芷' },
  { code: 'VRSY11', city: '三亚', title: '三亚 · 凌晨海边', sender: '南风' },
  { code: 'VRCT16', city: '开普敦', title: '开普敦 · 桌山云瀑与南大洋', sender: '好望角旅人' },
]

const BRIEF_BY_CODE = new Map(
  [...SEED_RADIO_BRIEFS, ...LEGACY_SEED_RADIO_BRIEFS].map((item) => [item.code, item]),
)

export function seedBrief(code: string): SeedRadioBrief | null {
  return BRIEF_BY_CODE.get(code.trim().toUpperCase()) ?? null
}

export function seedSignalCodes(): string[] {
  return SEED_RADIO_BRIEFS.map((item) => item.code)
}

export function isSeedCode(code: string): boolean {
  return BRIEF_BY_CODE.has(code.trim().toUpperCase())
}
