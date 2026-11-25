import type * as THREE from 'three'
import type { DioramaSceneId } from '../../services/albumStorage'
import type { AmbientKind } from '../../types/vision'

export type DioramaMood = 'dawn' | 'dusk' | 'night'
export type DioramaFilter = 'none' | 'warm' | 'cinema'
export type DioramaZoomPreset = 'wide' | 'standard' | 'macro'
export type DioramaSfx = 'lamp' | 'star' | 'ripple' | 'snow' | 'horn' | 'celebrate'

export interface DioramaGoalMeta {
  id: string
  title: string
  hint: string
}

export interface DioramaGoalState extends DioramaGoalMeta {
  done: boolean
}

export interface DioramaSceneMeta {
  id: DioramaSceneId
  title: string
  short: string
  city: string
  region: string
  ambience: AmbientKind
  tempDusk: string
  accent: string
  interactHint: string
  loreNote: string
  stampTitle: string
  stampSubtitle: string
  goals: readonly [DioramaGoalMeta, DioramaGoalMeta, DioramaGoalMeta]
}

export const DIORAMA_SCENES: readonly DioramaSceneMeta[] = [
  {
    id: 'shanghai',
    title: '上海外滩 · 黄浦暮色',
    short: '上海外滩',
    city: '上海',
    region: '华东江岸',
    ambience: 'city',
    tempDusk: '15°C · 江风汽笛',
    accent: '#f2c28b',
    interactHint: '点亮沿江路灯、敲响钟楼整点、唤亮东方明珠与江轮汽笛，解锁外滩烟花',
    loreNote: '替她记下整条江岸依次亮起的钟楼灯火与江心礼花。',
    stampTitle: '浦江初灯印记',
    stampSubtitle: '三脚架明珠与百年钟楼同时亮起的那晚，江面上绽开过金色烟火。',
    goals: [
      { id: 'lamps', title: '点亮 4 盏沿江复古路灯', hint: '轻点江岸栏杆旁的 4 盏柱灯' },
      { id: 'clock', title: '校准海关钟楼整点报时', hint: '轻点左侧高耸钟楼的金色表盘' },
      { id: 'pearl', title: '呼唤明珠双球霓虹并鸣笛', hint: '点击东方明珠球体或江面游船' },
    ],
  },
  {
    id: 'library',
    title: '南京 · 晚雨图书馆',
    short: '晚雨图书馆',
    city: '南京',
    region: '金陵梧桐',
    ambience: 'library',
    tempDusk: '18°C · 翻书与微雨',
    accent: '#ffd08a',
    interactHint: '点亮自习室拱窗、掀开玻璃天窗并轻触书卷台与秋金梧桐，唤出书香流光',
    loreNote: '安静的翻书声、天窗暖光和金叶梧桐，最像人间寻常的夜晚。',
    stampTitle: '金陵暖灯印记',
    stampSubtitle: '半城微雨里，九扇拱窗与天窗同亮，书页间飞起盘旋的金光纸鹤。',
    goals: [
      { id: 'windows', title: '点亮自习室半数以上拱窗', hint: '轻点红砖立面上的复古拱窗' },
      { id: 'skylight', title: '掀开穹顶玻璃天窗迎雨夜', hint: '轻点图书馆屋脊中央的玻璃天窗' },
      { id: 'book', title: '轻触庭院书卷或摇落梧桐叶', hint: '点击阶前发光书本台或金色梧桐树冠' },
    ],
  },
  {
    id: 'sydney',
    title: '悉尼海港 · 南半球盛夏',
    short: '悉尼盛夏',
    city: '悉尼',
    region: '南半球夏日',
    ambience: 'ocean',
    tempDusk: '28°C · 盛夏海风',
    accent: '#8ee0ec',
    interactHint: '轻触海湾浮标唤风航行、点亮贝壳歌剧院投影与钢拱大桥，迎出海豚跃湾',
    loreNote: '北半球正在降温时，地球另一侧的海港正跃出成双的白海豚。',
    stampTitle: '盛夏扬帆印记',
    stampSubtitle: '贝壳风帆披上南十字幻彩灯光，海豚顺着季风在游艇旁划出银弧。',
    goals: [
      { id: 'buoys', title: '轻敲航标唤醒盛夏海风与帆船', hint: '点击海面浮标、帆船或蔚蓝海湾' },
      { id: 'opera', title: '切换歌剧院贝壳幻彩投影', hint: '轻点歌剧院层叠的白色曲面贝壳群' },
      { id: 'bridge', title: '点亮海港钢拱大桥灯串', hint: '轻点远方跨越海湾的抛物线大桥拱' },
    ],
  },
  {
    id: 'hawaii',
    title: '夏威夷 · 珊瑚日落湾',
    short: '夏威夷湾',
    city: '夏威夷',
    region: '太平洋热带',
    ambience: 'ocean',
    tempDusk: '27°C · 热带椰风',
    accent: '#ff9d76',
    interactHint: '点燃栈桥火把、轻降珊瑚夕阳并拨动独木舟划水，唤醒荧光珊瑚湾与天灯',
    loreNote: '把太平洋最暖的一捧晚霞和蓝眼泪荧光，留在这一页纪念册里。',
    stampTitle: '珊瑚蓝泪印记',
    stampSubtitle: '落日沉入火山岬角后，整片珊瑚浅海亮起星尘般的夜光浮游与暖灯。',
    goals: [
      { id: 'torches', title: '点燃栈桥三支热带火把灯', hint: '依次点击木栈桥边熄灭的火把盆' },
      { id: 'sunset', title: '轻降金色夕阳浸染珊瑚海湾', hint: '轻点海湾远方悬停的热带落日圆盘' },
      { id: 'canoe', title: '轻推独木舟荡起海面夜光波', hint: '点击茅草屋前漂浮的弦外独木舟' },
    ],
  },
  {
    id: 'harbin',
    title: '哈尔滨 · 初雪教堂广场',
    short: '哈尔滨初雪',
    city: '哈尔滨',
    region: '北国雪夜',
    ambience: 'snow',
    tempDusk: '-7°C · 细雪钟声',
    accent: '#b8dcff',
    interactHint: '点亮雕花路灯与冰灯柱、唤亮玫瑰花窗、敲响洋葱穹顶铜钟，召唤极光与白鸽',
    loreNote: '零下七度的雪片落得很慢，洋葱穹顶上空飘起北国的柔绿极光。',
    stampTitle: '圣索菲亚雪鸽印记',
    stampSubtitle: '厚雪压住红砖线脚的夜晚，钟声放飞成群雪白信鸽，极光在天际缓缓摇曳。',
    goals: [
      { id: 'lamps', title: '点亮广场铁艺路灯与晶莹冰灯', hint: '轻点雪地旁的锻铁双臂路灯与冰雕柱' },
      { id: 'rose', title: '唤亮红砖立面的彩绘玫瑰花窗', hint: '轻点正立面拱门上方的圆形彩色窗' },
      { id: 'bell', title: '敲响中央大洋葱穹顶钟声', hint: '点击最高大的孔雀绿洋葱穹顶与金十字架' },
    ],
  },
  {
    id: 'observatory',
    title: '高山观星台 · 穹顶星海',
    short: '观星穹顶',
    city: '拉萨',
    region: '高原星空',
    ambience: 'night',
    tempDusk: '2°C · 高原晴夜',
    accent: '#9cf2d4',
    interactHint: '拨动黄铜浑天星仪、展开观星圆顶与测星光束并连起 4 颗星石，迎候流星雨',
    loreNote: '哪怕再也发不出中微子信号，仰望流星雨的人总会想起地心深处。',
    stampTitle: '星穹流星印记',
    stampSubtitle: '高原之巅的铜环浑仪对齐瞬间，群星连成银线，流星雨斜掠过观测穹顶。',
    goals: [
      { id: 'astrolabe', title: '校准高原露台的三环黄铜浑仪', hint: '轻点阶梯平台旁旋转的青铜星环仪' },
      { id: 'dome', title: '打开天文台对开天窗并射出星束', hint: '轻点白色肋骨观测圆顶或黄铜望远镜' },
      { id: 'stars', title: '观测并连起 4 颗以上悬浮星晶', hint: '依次点击空中悬浮的多面体发光星石' },
    ],
  },
] as const

export interface DioramaInteractEvent {
  label: string
  sfx: DioramaSfx
  count: number
  awakened?: boolean
}

export interface DioramaProgressSnapshot {
  sceneId: DioramaSceneId
  goals: DioramaGoalState[]
  completed: number
  total: number
  awakened: boolean
}

export interface DioramaTextures {
  plasterBump: THREE.CanvasTexture
  brickTex: THREE.CanvasTexture
  brickBump: THREE.CanvasTexture
  glowHalo: THREE.CanvasTexture
}

export interface InteractiveRegistration {
  goalId?: string
  focusPoint?: THREE.Vector3
  onClick: (point?: THREE.Vector3) => { label: string; sfx: DioramaSfx }
}

export interface DioramaBuilderCtx {
  readonly group: THREE.Group
  readonly textures: DioramaTextures
  getMood(): DioramaMood
  registerInteractive(mesh: THREE.Object3D, opts: InteractiveRegistration): void
  completeGoal(goalId: string): void
  isGoalDone(goalId: string): boolean
  bindWater(setRipple: (x: number, z: number) => void, setBio: (bio: number) => void): void
  triggerRipple(x: number, z: number): void
  setWaterBio(bio: number): void
  setFinaleTrigger(fn: () => void): void
  addTick(fn: (elapsed: number, dt: number) => void): void
  addMoodHook(fn: (mood: DioramaMood) => void): void
}
