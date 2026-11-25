export interface LocalStampMeta {
  id: string
  city: string
  title: string
  denom: string
  accent: string
  motif: string
}

export const LOCAL_STAMPS: readonly LocalStampMeta[] = [
  { id: 'tibet-snow', city: '拉萨', title: '西藏雪山印', denom: '6371m', accent: '#9cd8ff', motif: '🏔' },
  { id: 'shanghai-bund', city: '上海', title: '浦江钟楼邮票', denom: '20:00', accent: '#f2c28b', motif: '🕰' },
  { id: 'nanjing-leaf', city: '南京', title: '金陵梧桐书签', denom: '18°C', accent: '#ffd08a', motif: '🍂' },
  { id: 'sydney-sail', city: '悉尼', title: '南半球白帆票', denom: '28°C', accent: '#8ee0ec', motif: '⛵' },
  { id: 'hawaii-palm', city: '夏威夷', title: '椰风珊瑚夕阳', denom: '27°C', accent: '#ff9d76', motif: '🌴' },
  { id: 'harbin-dove', city: '哈尔滨', title: '圣索菲亚雪鸽', denom: '-7°C', accent: '#cbe6ff', motif: '❄' },
  { id: 'meadow-windmill', city: '大草原', title: '守风人风车章', denom: '06:40', accent: '#e8c47a', motif: '🌾' },
  { id: 'sunset-core', city: '落日六号', title: '地心深处信物', denom: '6371KM', accent: '#f29a8a', motif: '✦' },
] as const

export interface CardFrameMeta {
  id: 'navy-gold' | 'warm-paper' | 'aurora-air'
  name: string
  borderClass: string
  bgClass: string
  textClass: string
}

export const CARD_FRAMES: readonly CardFrameMeta[] = [
  {
    id: 'navy-gold',
    name: '典雅暗蓝金线',
    borderClass: 'border-signal/45',
    bgClass: 'bg-[#091329]/92',
    textClass: 'text-[#fff6ea]',
  },
  {
    id: 'warm-paper',
    name: '暖白手写信笺',
    borderClass: 'border-[#e6c99b]/60',
    bgClass: 'bg-[#2a2118]/92',
    textClass: 'text-[#fff3de]',
  },
  {
    id: 'aurora-air',
    name: '极光航空邮笺',
    borderClass: 'border-sky-300/45',
    bgClass: 'bg-[#0b1f33]/92',
    textClass: 'text-[#eaf7ff]',
  },
] as const

export const CARD_STICKERS = [
  '✦ 天气晴朗',
  '❄ 初雪微寒',
  '🌴 异域椰风',
  '🌊 听见海浪',
  '🔭 仰望星河',
  '💌 愿你安好',
] as const

export interface DriftLetterMeta {
  id: string
  fromTitle: string
  city: string
  tempC: number
  weather: string
  presetId: 'observatory' | 'library' | 'sydney' | 'sea' | 'rain' | 'ginkgo'
  stampId: string
  sticker: string
  letter: string
  sender: string
}

export const DRIFT_INBOX_LETTERS: readonly DriftLetterMeta[] = [
  {
    id: 'lhasa-starlight',
    fromTitle: '高原观星人',
    city: '拉萨',
    tempC: -4,
    weather: '晴空微风',
    presetId: 'observatory',
    stampId: 'tibet-snow',
    sticker: '🔭 仰望星河',
    letter:
      '今晚高原的夜空清澈得像洗过一样，天文台圆顶外能一眼望见雪山轮廓和低垂的星河。把这一缕干爽清冽的夜风寄给你，愿屏幕另一端的你也拥有安静闪亮的夜晚。',
    sender: '雪域慢递',
  },
  {
    id: 'sydney-ferry',
    fromTitle: '悉尼南风渡客',
    city: '悉尼',
    tempC: 28,
    weather: '盛夏晴湾',
    presetId: 'sydney',
    stampId: 'sydney-sail',
    sticker: '🌊 听见海浪',
    letter:
      '海港大桥上车来车往，贝壳风帆下面有人在喂海鸥。刚才两只海豚顺着浪头跃出水面，帮你拍下了这帧南半球的夏天，愿你心里也一直暖融融的。',
    sender: '南风渡客',
  },
  {
    id: 'nanjing-library',
    fromTitle: '金陵夜读生',
    city: '南京',
    tempC: 18,
    weather: '晚雨微凉',
    presetId: 'library',
    stampId: 'nanjing-leaf',
    sticker: '💌 愿你安好',
    letter:
      '图书馆三楼靠窗的位置今天刚好亮着温暖的灯，窗外梧桐叶沾满细雨。翻过一页书的工夫想起草原上的约定，把这盏安静的灯寄给你做书签。',
    sender: '晚雨拾叶',
  },
  {
    id: 'harbin-snow',
    fromTitle: '北国守钟人',
    city: '哈尔滨',
    tempC: -9,
    weather: '初雪飘落',
    presetId: 'rain',
    stampId: 'harbin-dove',
    sticker: '❄ 初雪微寒',
    letter:
      '圣索菲亚广场刚响过整点钟声，洋葱穹顶上落了一层松软的雪。街角的冰雕灯亮起来以后，整条街像被烤热的黄油面包一样暖和。',
    sender: '松花江边人',
  },
  {
    id: 'qingdao-coast',
    fromTitle: '夏威夷与珊瑚湾旅人',
    city: '夏威夷',
    tempC: 27,
    weather: '椰风晚霞',
    presetId: 'sea',
    stampId: 'hawaii-palm',
    sticker: '🌴 异域椰风',
    letter:
      '木栈桥旁的椰树刚掉下一颗清甜椰子，海滩上到处是热带落日的橘光。愿收到这封信的人也能随时拥有一次不需要理由的远行。',
    sender: '椰林邮差',
  },
  {
    id: 'beijing-ginkgo',
    fromTitle: '旧秋银杏道信使',
    city: '北京',
    tempC: 13,
    weather: '秋高气爽',
    presetId: 'ginkgo',
    stampId: 'shanghai-bund',
    sticker: '✦ 天气晴朗',
    letter:
      '风穿过金色银杏叶的时候发出很轻的沙沙声，长椅上留着半杯热咖啡。今天也在替地球另一端的她认真记下四季的颜色。',
    sender: '秋日慢递',
  },
] as const

export function findStampForCity(city: string): string {
  const c = city.trim()
  const match = LOCAL_STAMPS.find((s) => c.includes(s.city) || s.city.includes(c))
  return match?.id ?? 'sunset-core'
}
