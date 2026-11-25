export interface SeedRadioBrief {
  code: string
  city: string
  title: string
  sender: string
}

export const SEED_RADIO_BRIEFS: readonly SeedRadioBrief[] = [
  { code: 'VRHZ01', city: '杭州', title: '杭州 · 凌晨雨夜自习室', sender: '林见' },
  { code: 'VRQD02', city: '青岛', title: '青岛 · 傍晚防波堤', sender: '周岚' },
  { code: 'VRCD03', city: '成都', title: '成都 · 桂花巷口', sender: '阿澄' },
  { code: 'VRHR04', city: '哈尔滨', title: '哈尔滨 · 初雪操场', sender: '宋野' },
  { code: 'VRDL05', city: '大理', title: '大理 · 洱海晚风', sender: '阿遥' },
  { code: 'VRSH06', city: '上海', title: '上海 · 陆家嘴末班地铁窗外', sender: '江屿' },
  { code: 'VRNJ07', city: '南京', title: '南京 · 梧桐夜雨', sender: '夜航员' },
  { code: 'VRWH08', city: '武汉', title: '武汉 · 长江大桥晨雾', sender: '楚天' },
  { code: 'VRBJ09', city: '北京', title: '北京 · 胡同初冬', sender: '小满' },
  { code: 'VRXA10', city: '西安', title: '西安 · 城墙落日', sender: '阿芷' },
  { code: 'VRSY11', city: '三亚', title: '三亚 · 凌晨海边', sender: '南风' },
  { code: 'VRLS12', city: '拉萨', title: '拉萨 · 高原星空', sender: '高原邮差' },
  { code: 'VRSY13', city: '悉尼', title: '悉尼 · 南半球盛夏海港', sender: '南风渡客' },
  { code: 'VRHW14', city: '夏威夷', title: '夏威夷 · 珊瑚日落湾', sender: '浪尖邮差' },
  { code: 'VRIS15', city: '雷克雅未克', title: '雷克雅未克 · 极光冰湾', sender: '北纬六十四' },
  { code: 'VRCT16', city: '开普敦', title: '开普敦 · 桌山云瀑与南大洋', sender: '好望角旅人' },
  { code: 'VRKY17', city: '京都', title: '京都 · 鸭川暮色风铃', sender: '木廊听风' },
  { code: 'VRPR18', city: '巴黎', title: '巴黎 · 塞纳河黄昏路灯', sender: '左岸散步者' },
]

const BRIEF_BY_CODE = new Map(SEED_RADIO_BRIEFS.map((item) => [item.code, item]))

export function seedBrief(code: string): SeedRadioBrief | null {
  return BRIEF_BY_CODE.get(code.trim().toUpperCase()) ?? null
}

export function seedSignalCodes(): string[] {
  return SEED_RADIO_BRIEFS.map((item) => item.code)
}

export function isSeedCode(code: string): boolean {
  return BRIEF_BY_CODE.has(code.trim().toUpperCase())
}
