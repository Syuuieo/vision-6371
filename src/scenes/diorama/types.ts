import type * as THREE from 'three'
import type { DioramaSceneId } from '../../services/albumStorage'
import type { AmbientKind } from '../../types/vision'

export type DioramaMood = 'dawn' | 'dusk' | 'night'
export type DioramaWeather = 'clear' | 'rain' | 'snow'
export type DioramaFilter = 'none' | 'warm' | 'cinema'
export type DioramaZoomPreset = 'wide' | 'standard' | 'macro'
export type DioramaSfx = 'lamp' | 'star' | 'ripple' | 'snow' | 'horn' | 'celebrate'
export type DioramaHorizonStyle =
  | 'skyline'
  | 'mountains'
  | 'islands'
  | 'snowhills'
  | 'courtyard_trees'
  | 'cavern'

/** 「场景奇遇」：漫步世界里可被点亮的一场奇观演出 */
export interface DioramaEncounterMeta {
  id: string
  title: string
  hint: string
  /** 奇遇点亮时浮现的诗意字幕 */
  verse: string
}

export interface DioramaEncounterState extends DioramaEncounterMeta {
  done: boolean
}

export interface DioramaWalkView {
  /** 直接使用世界坐标，不再按 WORLD_SCALE 换算。 */
  pos: [number, number, number]
  look: [number, number, number]
  fov: number
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
  walkView: DioramaWalkView
  horizonStyle: DioramaHorizonStyle
  defaultHour?: number
  encounters: readonly DioramaEncounterMeta[]
}

export const DIORAMA_SCENES: readonly DioramaSceneMeta[] = [
  {
    id: 'agra',
    title: '阿格拉 · 泰姬陵破晓',
    short: '泰姬陵',
    city: '阿格拉',
    region: '查尔巴格花园 · 粉金晨曦',
    ambience: 'city',
    tempDusk: '21°C · 白玉长池',
    accent: '#f4d3b8',
    interactHint: '漫步查尔巴格花园：点亮主陵莲花白玉穹顶、四座宣礼塔与长池油灯，也可步入白玉台基或泛舟亚穆纳河',
    loreNote: '破晓的第一缕淡粉落上白大理石穹顶时，整座长池都在替她留住这一瞬的拂晓。',
    stampTitle: '莫卧儿晨曦印记',
    stampSubtitle: '四座白玉宣礼塔与红砂岩清真寺同时亮起暖光，十二盏长池油灯倒映出整座泰姬陵。',
    walkView: { pos: [-1.8, 1.82, 14.5], look: [0, 6.2, -52], fov: 56 },
    horizonStyle: 'skyline',
    defaultHour: 6.25,
    encounters: [
      { id: 'dome', title: '点亮主陵白玉穹顶', hint: '轻点正前方查尔巴格花园远端的泰姬陵白玉主拱门', verse: '第一缕柔金照亮尖券拱洞，白大理石透出如玉温润。' },
      { id: 'minarets', title: '唤醒宣礼塔与红砂岩殿', hint: '轻点主陵四角白玉宣礼塔或左右对称红砂岩清真寺', verse: '四座高塔与两侧红砂岩穹顶同辉，中轴天地合而为一。' },
      { id: 'pool', title: '点亮长池油灯喷泉', hint: '点击身前纵深白大理石倒影长池或飘浮油灯', verse: '长池涟漪与十二盏油灯唤醒亚穆纳河莲光，倒影绵延至天际。' },
    ],
  },
  {
    id: 'rapanui',
    title: '复活节岛 · 摩艾石像阵',
    short: '复活节岛',
    city: '复活节岛',
    region: '南太平洋玻利尼西亚',
    ambience: 'ocean',
    tempDusk: '21°C · 大洋破晓',
    accent: '#ffd8a8',
    interactHint: '漫步玄武岩火山草坡：唤醒阿胡通加里基 9 尊摩艾白珊瑚眼眸、燃亮鸟人石刻火坛并轻触南太平洋拍岸浪涌',
    loreNote: '当南太平洋破晓从九尊玄武岩巨像背后升起，两千公里外的大洋碎浪也在替她守望天际。',
    stampTitle: '拉帕努伊曙光印记',
    stampSubtitle: '九尊摩艾石像的白珊瑚圣眸在破晓中睁开，鸟人火坛与拉诺拉拉库山坡同迎朝阳。',
    walkView: { pos: [-4.2, 1.82, 11.4], look: [1.5, 5.4, -36], fov: 56 },
    horizonStyle: 'mountains',
    defaultHour: 6.15,
    encounters: [
      { id: 'moai', title: '唤醒摩艾圣眸', hint: '轻点海岸仪式石台上并肩而立的九尊摩艾巨石像', verse: '白珊瑚圣眸在破晓亮起，巨像替人类凝望过整个南太平洋。' },
      { id: 'altar', title: '燃起鸟人石刻火坛', hint: '轻点前景草坡上的唐加塔马努玄武岩火坛与石碑火把', verse: '火把燃起赤金火光，海风吹过两千年的拉帕努伊神话。' },
      { id: 'ocean', title: '轻触太平洋涌浪', hint: '点击巨像背后拍岸而来的南太平洋广袤镜面大洋', verse: '晨潮漫过玄武岩礁，整片南大洋都在太阳升起时发光。' },
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
    walkView: { pos: [0, 1.84, 8.04], look: [-0.3, 4.8, -3.6], fov: 58 },
    horizonStyle: 'skyline',
    encounters: [
      { id: 'buoys', title: '唤醒盛夏海风', hint: '点击海面浮标、帆船或蔚蓝海湾', verse: '季风涨满船帆，整片海湾跟着咸咸地明亮起来。' },
      { id: 'opera', title: '点亮歌剧院幻彩', hint: '轻点歌剧院层叠的白色曲面贝壳群', verse: '白色贝壳披上幻彩灯光，像南十字落在海面。' },
      { id: 'bridge', title: '点亮钢拱大桥灯串', hint: '轻点远方跨越海湾的抛物线大桥拱', verse: '大桥灯串一颗颗亮起，把海港缝成一件乐器。' },
    ],
  },
  {
    id: 'giza',
    title: '吉萨 · 金字塔与狮身人面像',
    short: '吉萨金字塔',
    city: '吉萨',
    region: '撒哈拉尼罗河谷',
    ambience: 'wind',
    tempDusk: '27°C · 撒哈拉金晖',
    accent: '#f5cc82',
    interactHint: '漫步谷庙神道石台：点亮三大金字塔黄金顶石与猎户三星、燃起狮身人面像胸前圣火并轻触圣水倒影池',
    loreNote: '当撒哈拉的炽金落日漫过三大金字塔斜棱时，猎户座三颗星在沙漠天际悄然对齐。',
    stampTitle: '撒哈拉圣金印记',
    stampSubtitle: '斯芬克斯胸前火坛燃起橙金火焰，猎户座三星与胡夫金字塔黄金顶石同频共振。',
    walkView: { pos: [-4.6, 1.9, 13.6], look: [0.8, 5.2, -45], fov: 56 },
    horizonStyle: 'mountains',
    defaultHour: 17.3,
    encounters: [
      { id: 'pyramid', title: '点亮金字塔顶石与三星', hint: '轻点正前方阶梯起伏的三座吉萨大金字塔', verse: '黄金顶石与猎户三星亮起共振金光，整片沙海记下了四千年的黄昏。' },
      { id: 'sphinx', title: '燃亮狮身人面像圣坛', hint: '轻点右侧神道旁的斯芬克斯与双座方尖碑', verse: '梦想石碑前圣火腾起，狮身人面像替人类守望着东方拂晓。' },
      { id: 'pool', title: '轻触谷庙圣水倒影池', hint: '点击左侧纸莎草环绕的谷庙倒影水池', verse: '流沙金波荡开在镜池水面，连最远处的金字塔都落进了波纹。' },
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
    interactHint: '漫步雪原广场：唤亮玫瑰窗、敲响洋葱穹顶、点亮冰灯街市、召唤绿极光',
    loreNote: '零下七度的雪片落得很慢，洋葱穹顶上空飘起北国的柔绿极光。',
    stampTitle: '圣索菲亚雪鸽印记',
    stampSubtitle: '厚雪压住红砖线脚的夜晚，钟声放飞成群雪白信鸽，极光在天际缓缓摇曳。',
    walkView: { pos: [0, 1.75, 12], look: [0, 6.5, -10], fov: 54 },
    horizonStyle: 'snowhills',
    defaultHour: 17.6,
    encounters: [
      { id: 'lamps', title: '点亮广场路灯', hint: '轻点雪地旁的双臂铁艺路灯与冰雕灯柱', verse: '路灯一盏盏醒来，雪地上长出一排小月亮。' },
      { id: 'rose', title: '唤亮玫瑰窗', hint: '轻点教堂正立面的彩绘玫瑰花窗', verse: '玫瑰窗亮起的刹那，整座教堂变成一盏琉璃灯。' },
      { id: 'bell', title: '敲响穹顶铜钟', hint: '点击孔雀绿洋葱穹顶与金十字架', verse: '钟声荡过雪原，成群白鸽替初雪飞了起来。' },
    ],
  },
  {
    id: 'georgia',
    title: '格鲁吉亚 · 圣剑山',
    short: '圣剑山',
    city: '格鲁吉亚',
    region: '大高加索圣剑山',
    ambience: 'snow',
    tempDusk: '2°C · 日照金山',
    accent: '#ffd6c4',
    interactHint: '漫步崖顶石台：点亮圣三一石头修道院、唤醒斯瓦涅季古石碉楼、唤亮插入山脊的十五柄迪德戈里巨剑碑',
    loreNote: '十五柄十余米青铜巨剑深深插在高加索绿草山脊上，守望着乌什巴雪峰第一缕破晓。',
    stampTitle: '圣剑金山印记',
    stampSubtitle: '高加索山谷十五柄迪德戈里圣剑符文齐亮，倒映冰川镜湖与日照金山。',
    walkView: { pos: [-3.8, 1.82, 11.8], look: [0, 6.4, -34], fov: 58 },
    horizonStyle: 'mountains',
    defaultHour: 6.55,
    encounters: [
      { id: 'sanctuary', title: '点亮圣三一修道院', hint: '轻点右前方山脊上的格鲁吉亚石头教堂与火盆', verse: '圣三一钟楼火盆燃起，彩窗暖光穿透高加索晨雾。' },
      { id: 'towers', title: '唤醒斯瓦涅季古碉楼', hint: '轻点左侧冷杉山谷里的千年方形石碉楼群', verse: '守望山谷千年的古石碉楼亮起窗灯，像山风下的灯塔。' },
      { id: 'peak', title: '唤亮圣剑群碑与金山', hint: '轻点斜插在山脊上的巨剑阵或远方双刃雪峰', verse: '十五柄圣剑符文与双刃雪顶同时染上日照金山。' },
    ],
  },
  {
    id: 'iceland',
    title: '冰岛 · 雷克雅未克极光峡湾',
    short: '极光峡湾',
    city: '雷克雅未克',
    region: '北极圈峡湾',
    ambience: 'snow',
    tempDusk: '-3°C · 冰海极光',
    accent: '#6ff2c8',
    interactHint: '漫步玄武岩海岸：点亮红白灯塔、唤醒极光绸带、唤出座头鲸、轻触浮冰蓝泪',
    loreNote: '把北纬六十四度的绿紫极光与座头鲸跃水的回声，一起存进极地星笺。',
    stampTitle: '冰海极光印记',
    stampSubtitle: '红白灯塔光束划过玄武岩峡湾时，绿紫极光在冰山与座头鲸上空骤然绽放。',
    walkView: { pos: [4.8, 1.75, 11.8], look: [-14, 5.8, 28], fov: 58 },
    horizonStyle: 'mountains',
    defaultHour: 22.2,
    encounters: [
      { id: 'lighthouse', title: '点亮极地灯塔', hint: '轻点玄武岩悬崖上的红白条纹灯塔', verse: '光束扫过峡湾，像有人在黑夜里为你掌灯。' },
      { id: 'aurora', title: '唤醒极光绸带', hint: '轻点峡湾上空的极光幕布或极地石碑', verse: '绿紫绸带在天穹起舞，整片夜空开始呼吸。' },
      { id: 'whale', title: '唤出座头鲸跃水', hint: '点击冰川浮冰之间游弋的座头鲸', verse: '座头鲸跃出冰海，浪花里盛满碎掉的月光。' },
    ],
  },
  {
    id: 'kyoto',
    title: '京都 · 暮春樱花古寺',
    short: '京都樱寺',
    city: '京都',
    region: '古都春樱',
    ambience: 'wind',
    tempDusk: '16°C · 晚樱钟声',
    accent: '#ffb3c8',
    interactHint: '点亮朱红鸟居与石灯笼、轻摇垂枝古樱唤起落樱雨，再敲响青铜古钟放飞纸灯',
    loreNote: '暮春古寺的镜池映着三重塔影与纸灯暖光，风一吹便落满肩头樱雪。',
    stampTitle: '古寺落樱印记',
    stampSubtitle: '青铜梵钟的金色声波掠过朱红拱桥，漫天晚樱与池畔暖灯同赴春夜。',
    walkView: { pos: [-5.8, 1.85, 11.8], look: [3.2, 5.4, -26], fov: 58 },
    horizonStyle: 'mountains',
    defaultHour: 18.25,
    encounters: [
      { id: 'torii', title: '点亮朱红鸟居', hint: '轻点古寺参道的朱红鸟居或花岗岩石灯笼', verse: '朱红鸟居亮起，参道尽头是人间与神明的边界。' },
      { id: 'sakura', title: '摇落漫天樱雪', hint: '轻点池畔盛开的垂枝樱花树冠', verse: '樱枝一颤，整座庭院落起粉色的雪。' },
      { id: 'bell', title: '敲响青铜古钟', hint: '点击钟楼下悬挂的青铜梵钟', verse: '梵钟金色声波荡开，池畔纸灯一同升空。' },
    ],
  },
  {
    id: 'core',
    title: '地心深处 · 落日六号耐压舱',
    short: '落日六号',
    city: '地心 · 落日六号',
    region: '地下 6371km',
    ambience: 'night',
    tempDusk: '5500K · 360 GPa',
    accent: '#ffba66',
    interactHint: '漫步钛合金栈道：点亮琥珀信标、展开全息草原、启动中微子共振、聆听熔岩心跳',
    loreNote: '在地下六千三百七十一公里的熔融铁镍海里，她依然守着一朵全息草原野花。',
    stampTitle: '落日六号印记',
    stampSubtitle: '三道金色中微子环与地核 360 GPa 心跳同频共振，全息草原在球舱中悄然绽放。',
    walkView: { pos: [0.84, 2.25, 8.4], look: [0, 4.5, -0.36], fov: 56 },
    horizonStyle: 'cavern',
    encounters: [
      { id: 'beacon', title: '点亮琥珀信标', hint: '轻点落日六号球形耐压舱外侧琥珀信标', verse: '四枚琥珀信标依次醒来，黑暗里有了心跳的节拍。' },
      { id: 'holo', title: '展开全息草原', hint: '轻点剖面观察舱内悬浮的全息野花台', verse: '全息草原层层展开，地心升起了她的春天。' },
      { id: 'resonance', title: '启动中微子共振', hint: '点击环绕耐压舱旋转的金色中微子环', verse: '三道金环同频共振，360 GPa 的心跳传向地表。' },
      { id: 'lava', title: '聆听熔岩心跳', hint: '走近熔融铁镍海轻点涌动的岩流', verse: '岩浆翻涌如潮汐，这是行星最深处的呼吸。' },
      { id: 'observatory', title: '外环观测台', hint: '沿钛金外环栈道走到观测舱，轻触测微子望远镜', verse: '外环望远镜对准地核，中微子计数器替她数着星星。' },
    ],
  },
  {
    id: 'rome',
    title: '罗马 · 斗兽场夕照',
    short: '罗马斗兽场',
    city: '罗马',
    region: '地中海永恒之城',
    ambience: 'city',
    tempDusk: '19°C · 古城金晖',
    accent: '#f2c98d',
    interactHint: '漫步神圣大道广场：点亮斗兽场千座拱券金灯、燃起君士坦丁凯旋门火炬、轻触墨达苏丹斯古泉水波',
    loreNote: '地中海斜阳透过残缺外墙洒进圆形竞技场，两千年的洞石拱影在水池里泛着余温。',
    stampTitle: '永恒之城印记',
    stampSubtitle: '君士坦丁凯旋门与斗兽场四十八座拱洞同时亮起，夕阳碎金在水池倒影间流动。',
    walkView: { pos: [-5.6, 1.82, 12.6], look: [3.2, 6.0, -42], fov: 58 },
    horizonStyle: 'skyline',
    defaultHour: 17.85,
    encounters: [
      { id: 'arches', title: '点亮斗兽场拱廊', hint: '轻点正前方四层真拱券罗马斗兽场外墙', verse: '四十八座石拱次第亮起，两千年的风在看台间回响。' },
      { id: 'arch', title: '燃亮凯旋门火炬', hint: '轻点广场右侧的君士坦丁凯旋门', verse: '大理石浮雕被琥珀火光唤醒，神圣大道延伸向黄昏。' },
      { id: 'fountain', title: '轻触古泉水池涟漪', hint: '点击广场左侧墨达苏丹斯锥形古泉或倒影水池', verse: '古泉水波轻轻荡开，把夕阳与整座竞技场揉成流金。' },
    ],
  },
  {
    id: 'paris',
    title: '巴黎 · 塞纳河暮色铁塔',
    short: '巴黎塞纳',
    city: '巴黎',
    region: '左岸暮色',
    ambience: 'city',
    tempDusk: '14°C · 晚霞书页',
    accent: '#f3b7c8',
    interactHint: '漫步塞纳左岸：点燃铁塔香槟星火、唤亮石桥灯影、翻开左岸书摊、启航塞纳游船',
    loreNote: '紫粉晚霞落进塞纳河，铁塔的香槟星点与左岸旧书摊一起亮起。',
    stampTitle: '塞纳暮光印记',
    stampSubtitle: '石拱桥与铁塔同亮的黄昏，观光游船在紫色河面拖出一条细碎金光。',
    walkView: { pos: [-5.2, 1.75, 11.2], look: [-8.5, 6.4, -44], fov: 60 },
    horizonStyle: 'skyline',
    defaultHour: 18.3,
    encounters: [
      { id: 'tower', title: '点燃铁塔香槟星火', hint: '轻点四足弧拱镂空铁塔', verse: '香槟星火逐层爬升，铁塔在暮色里开成一束光。' },
      { id: 'bridge', title: '唤亮石桥灯影', hint: '轻点三孔石拱桥或岸边的复古路灯', verse: '石拱桥与煤气灯一同醒来，河面镀上一条金线。' },
      { id: 'boat', title: '启航塞纳游船', hint: '点击河面缓行的玻璃顶观光游船', verse: '游船缓缓离岸，紫色河面拖出一条碎金长尾。' },
    ],
  },
  {
    id: 'dali',
    title: '大理 · 洱海苍山明月',
    short: '大理洱海',
    city: '大理',
    region: '滇西高原',
    ambience: 'ocean',
    tempDusk: '16°C · 湖风月色',
    accent: '#b9d8ef',
    interactHint: '漫步洱海栈道：点亮白族院落灯火、升起苍山满月、推船荡开星月倒影、轻拨栈桥涟漪',
    loreNote: '苍山雪线之上升起满月，洱海的每一道细波都替她接住一小片银光。',
    stampTitle: '洱海月路印记',
    stampSubtitle: '白墙青瓦与栈桥暖灯次第亮起，木舟荡开镜面湖水，满月银辉铺成一条长路。',
    walkView: { pos: [4.6, 1.75, 11.4], look: [-7.5, 5.4, -36], fov: 58 },
    horizonStyle: 'mountains',
    defaultHour: 20.8,
    encounters: [
      { id: 'lanterns', title: '点亮白族院落', hint: '轻点岸边白族小院或蜿蜒木栈桥', verse: '白墙青瓦次第亮灯，炊烟与暖光一起有了归处。' },
      { id: 'moon', title: '升起苍山满月', hint: '轻点苍山雪顶上方的柔和满月', verse: '满月越过雪线，月光在湖面铺成一条长路。' },
      { id: 'boat', title: '荡起渔舟星月', hint: '点击湖面随波轻摇的木渔船', verse: '木舟荡开镜面湖水，星星跟着碎了一湖。' },
    ],
  },
] as const

export const CURATED_SCENE_IDS: readonly DioramaSceneId[] = [
  'agra',
  'georgia',
  'rapanui',
  'giza',
  'rome',
  'kyoto',
  'paris',
  'iceland',
  'dali',
  'harbin',
  'core',
]

export const CURATED_DIORAMA_SCENES: readonly DioramaSceneMeta[] = CURATED_SCENE_IDS.map(
  (id) => DIORAMA_SCENES.find((s) => s.id === id)!,
)

export interface DioramaInteractEvent {
  label: string
  sfx: DioramaSfx
  count: number
  awakened?: boolean
}

export interface DioramaProgressSnapshot {
  sceneId: DioramaSceneId
  encounters: DioramaEncounterState[]
  discovered: number
  total: number
  awakened: boolean
}

export interface DioramaTextures {
  plasterBump: THREE.CanvasTexture
  brickTex: THREE.CanvasTexture
  brickBump: THREE.CanvasTexture
  glowHalo: THREE.CanvasTexture
  weatheredWoodTex: THREE.CanvasTexture
  darkStoneTex: THREE.CanvasTexture
  skyscraperFacadeTex: THREE.CanvasTexture
  skyscraperEmissiveTex: THREE.CanvasTexture
}

export interface InteractiveRegistration {
  encounterId?: string
  focusPoint?: THREE.Vector3
  onClick: (point?: THREE.Vector3) => { label: string; sfx: DioramaSfx }
}

export interface DioramaBuilderCtx {
  readonly group: THREE.Group
  readonly textures: DioramaTextures
  getMood(): DioramaMood
  registerInteractive(mesh: THREE.Object3D, opts: InteractiveRegistration): void
  discoverEncounter(encounterId: string): void
  isEncounterDone(encounterId: string): boolean
  bindWater(
    setRipple: (x: number, z: number) => void,
    setBio: (bio: number) => void,
    setWaterMood?: (fogHex: string, sunHex?: string, sunDir?: [number, number, number]) => void,
  ): void
  triggerRipple(x: number, z: number): void
  setWaterBio(bio: number): void
  setFinaleTrigger(fn: () => void): void
  addTick(fn: (elapsed: number, dt: number) => void): void
  addMoodHook(fn: (mood: DioramaMood) => void): void
  setWalkHeightSampler?: (fn: (x: number, z: number) => number | null) => void
  setRideAnchor?: (fn: () => { pos: THREE.Vector3; yawOffset?: number } | null) => void
  setVantageAnchor?: (vantage: { label: string; pos: [number, number, number]; yaw: number; pitch: number }) => void
  addTimeHook?: (fn: (hour: number, nightFactor: number) => void) => void
  addWeatherHook?: (fn: (weather: DioramaWeather, rainIntensity: number) => void) => void
  setWishTrigger?: (fn: () => { label: string; sfx: DioramaSfx }) => void
  addDisposeHook?: (fn: () => void) => void
  setFramingView?: (view: { pos: [number, number, number]; look: [number, number, number]; fov: number }) => void
}
