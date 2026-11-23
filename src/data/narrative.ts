import type {
  BriefingItem,
  CollectionMeta,
  DescentCaption,
  EasterEggMeta,
  IntroBeat,
  PrologueQuote,
  QuoteKey,
  StageLookMeta,
  StepMeta,
  TruthMeta,
} from '../types/sensor'

export const INTRO_CALL_BEATS: IntroBeat[] = [
  {
    speaker: '地航局主任来信 · 昨晚',
    timeLabel: '06:38',
    text: '陈舟，休假去草原时带上这副传感眼镜吧——就当帮老同学一个忙。',
    sub: '眼镜镜脚内侧刻着一行极小的编号：SUNSET-06 · 林微。',
  },
  {
    speaker: '林微 · 耳机另一端',
    timeLabel: '06:39',
    text: '“喂，听得见吗？我只是在偏远观测站值班，一时走不开，才向你借一天假期。”',
    sub: '信号微弱得像隔着一层厚玻璃，可她的笑声很轻快。',
  },
  {
    speaker: '林微 · 清晨连线',
    timeLabel: '06:40',
    text: '“眼睛刚睁开时全是雾——先帮我调一调焦距吧，我想看清草叶上那朵花。”',
    sub: '清晨的风正穿过旷野，替她度过这一天，才刚刚开始。',
  },
]

export const DESCENT_CAPTIONS: DescentCaption[] = [
  {
    thresholdKm: 0,
    layer: '地壳 · MOHO 35 KM',
    line: '草原的清晨沉进黑色岩层，风声与露水一起退在身后。',
  },
  {
    thresholdKm: 650,
    layer: '下地幔 · 2,900 KM',
    line: '高压硅酸盐发出暗红光流——十一年来，她每天睁眼看见的只有这种颜色。',
  },
  {
    thresholdKm: 4400,
    layer: '液态铁镍外核 · 6,371.4 KM',
    line: '在 5,400°C 的炽热核心中央，一枚微弱却倔强的琥珀色信标仍在闪光。',
  },
]

export const BRIEFING_CARDS: BriefingItem[] = [
  {
    tag: '01 · 你的身份',
    title: '草原休假的旅人 · 陈舟',
    body: '出发前往草原前，地航局主任托你随身戴上一副传感眼镜，替远方的故人休一天假。',
  },
  {
    tag: '02 · 传感眼镜',
    title: '替她同步五感',
    body: '它把你眼里的光、耳边的风和花香实时传进另一端封闭舱室。',
  },
  {
    tag: '03 · 她的隐瞒',
    title: '从未去往远星',
    body: '直到夜深星落，你才会发现那句“在观测站值班”背后究竟隔着多少公里。',
  },
]

export const COLLECTIONS: CollectionMeta[] = [
  {
    id: 'flower',
    index: '01',
    title: '晨雾对焦',
    short: '对焦',
    hint: '转动对焦环，替她看清清晨第一朵逆风的野花。',
    hudLabel: '晨光与花香已同步',
    accent: '#f2c28b',
    focus: 'flower',
  },
  {
    id: 'wind',
    index: '02',
    title: '湖畔水波与风',
    short: '湖风',
    hint: '轻划湖面传去水声，再校准草原风频。',
    hudLabel: '风声频段已锁定',
    accent: '#9bd2ff',
    focus: 'lake',
  },
  {
    id: 'stars',
    index: '03',
    title: '专属星河',
    short: '连星',
    hint: '连接夜空最亮的三颗星，听她最后的真话。',
    hudLabel: '星座已连成',
    accent: '#c4d4ff',
    focus: 'sky',
  },
]

export const STEPS: StepMeta[] = [
  {
    act: 1,
    index: 'I',
    title: '晨雾对焦',
    short: '对焦',
    timeLabel: '06:40',
    hint: '拖动对焦环散开晨雾，替她看清清晨第一朵逆风的野花。',
    accent: '#f2c28b',
    focus: 'flower',
  },
  {
    act: 2,
    index: 'II',
    title: '湖水听风',
    short: '湖风',
    timeLabel: '09:30',
    hint: '轻划或点击湖面两次传去水声，再校准草原上的风频。',
    accent: '#8ec8ff',
    focus: 'lake',
  },
  {
    act: 3,
    index: 'III',
    title: '孤树蒲公英',
    short: '孤树',
    timeLabel: '13:15',
    hint: '走到悬崖孤树下，长按聚风吹散漫山白色绒毛。',
    accent: '#ffe2bd',
    focus: 'tree',
  },
  {
    act: 4,
    index: 'IV',
    title: '石拱回声',
    short: '石拱',
    timeLabel: '15:50',
    hint: '在古老石拱前发出三次心光呼唤，听山谷替她应答。',
    accent: '#f2c28b',
    focus: 'ruin',
  },
  {
    act: 5,
    index: 'V',
    title: '黄昏晚雨',
    short: '晚雨',
    timeLabel: '18:10',
    hint: '雨落下来了——伸手点住空中飘落的 5 滴晚雨。',
    accent: '#a9c8ff',
    focus: 'shore',
  },
  {
    act: 6,
    index: 'VI',
    title: '轻舟聚萤',
    short: '流萤',
    timeLabel: '19:45',
    hint: '轻点暮色湖畔，为岸边空荡的木船引来 6 簇流萤。',
    accent: '#f7d294',
    focus: 'boat',
  },
  {
    act: 7,
    index: 'VII',
    title: '专属星河',
    short: '连星',
    timeLabel: '22:30',
    hint: '仰望夜空，按你喜欢的顺序把三颗最亮的星连成星座。',
    accent: '#c4d4ff',
    focus: 'sky',
  },
  {
    act: 8,
    index: 'VIII',
    title: '落日六号',
    short: '地心',
    timeLabel: '00:00',
    hint: '穿过 6,371.4 公里炽热铁镍，去回应地心深处的心跳。',
    accent: '#ff9468',
    focus: 'sky',
  },
]

export const STAGE_META: StageLookMeta[] = [
  { stage: 0, label: '清晨微光', english: 'FIRST LIGHT', time: '06:40' },
  { stage: 1, label: '炽热落日', english: 'GOLDEN LOW', time: '16:20' },
  { stage: 2, label: '紫蓝暮色', english: 'DEEP FIELD', time: '22:30' },
]

export const QUOTES: Record<QuoteKey, PrologueQuote> = {
  flower: {
    eyebrow: '06:40 · 视觉与嗅觉连线 · 清晨',
    lines: [
      '草叶上的露水亮起来那一秒，我耳机里居然听见了微风擦过衣领的沙沙声。',
      '陈舟，我这边的“观测站”窗外其实一直没有天气——没有雾，也不会开花。',
      '刚才你凑近花瓣时，我差点下意识抬手，想挡一下早晨的光。',
    ],
    clue: {
      id: 'no-weather',
      label: '线索 I · “窗外没有天气”',
    },
    question: '她停顿了一下，轻声问你：“草地另一头，太阳已经升过山坡了吗？”',
    choices: [
      {
        id: 'sun-yes',
        label: '“刚照亮一整片草甸，山风里全都是青草味。”',
        reply: [
          '好久没人这样用动词形容早晨了……“照亮”听起来真宽敞。',
          '听说谷底还有一面湖，带我去岸边听听水声好不好？',
        ],
      },
      {
        id: 'sun-stay',
        label: '“刚过山脊。你如果看不够，我可以多停几分钟。”',
        reply: [
          '傻瓜，你难得休假，不用陪着一朵花站太久。',
          '往前走吧，我好像在镜头边缘看见湖水的反光了。',
        ],
      },
    ],
    nextLabel: '09:30 · 去湖边',
    signature: '—— 林微 · 连线已建立',
  },
  wind: {
    eyebrow: '09:30 · 声波共振 · 湖畔',
    lines: [
      '水波落进耳道之前，耳机里刚闪过一声沉闷的金属低鸣——像整面铁壁被什么撞响。',
      '紧接着草原的风涌了进来，正好把那阵杂音盖住。',
      '“抱歉刚才断了一拍，”她故作轻松地笑，“站里老空调总是嗡嗡作响。”',
    ],
    clue: {
      id: 'hull-groan',
      label: '线索 II · “深处传来金属低鸣”',
    },
    question: '“外面的风吹在身上久了，会觉得冷吗？”',
    choices: [
      {
        id: 'wind-warm',
        label: '“晒着太阳就不冷，风反倒像把棉被抖松了一样暖。”',
        reply: [
          '真会说话啊，我这里的温度计，十年没动过半格了。',
          '那边山坡孤树下有一大片蒲公英，正午的风正好。',
        ],
      },
      {
        id: 'wind-cool',
        label: '“湖边风凉，正好让人醒得透彻。”',
        reply: [
          '清醒真好……在四平米见方的舱壁之间，黑夜和白天是没有缝隙的。',
          '走，带我往高处的孤树坡上跑两步。',
        ],
      },
    ],
    nextLabel: '13:15 · 去孤树下',
    signature: '—— 林微 · 正在听风声',
  },
  dandelion: {
    eyebrow: '13:15 · 失重的风 · 孤树山坡',
    lines: [
      '漫山白绒顺着风往谷口飘起来那一刻，林微在耳机另一端轻轻“哇”了一声。',
      '“好奇怪，看着它们一直往高处飞……我忽然想不起‘向上’和‘向下’是怎么分的了。”',
      '她随即含糊补了一句：“可能躺着值班久了，方向感都退化了。”',
    ],
    clue: {
      id: 'no-direction',
      label: '线索 III · “船舱里没有上下”',
    },
    question: '“如果只能从地球表面带一件小东西回房间，你会选哪样？”',
    choices: [
      {
        id: 'seed-home',
        label: '“一粒被风托起的蒲公英种子，看着它总像还能再飞很远。”',
        reply: [
          '嗯……只要风还在刮，哪怕飞不到土里，也算替我出发过了。',
        ],
      },
      {
        id: 'lantern-tree',
        label: '“把那棵孤树枝头的木风铃和灯光，借一半留在视野里。”',
        reply: [
          '木头被风吹得吱呀响的声音，确实比冷冰冰的指示灯温柔得多。',
        ],
      },
    ],
    nextLabel: '15:50 · 前往石拱',
    signature: '—— 林微 · 记住了午后的光',
  },
  ruin: {
    eyebrow: '15:50 · 远古回声 · 山腰石拱',
    lines: [
      '三声心光撞上石拱，碑纹暗红亮起的那一瞬，风似乎绕着石柱多盘旋了半圈。',
      '“我以为很久以前的守望者都会把愿望刻在石头上——”',
      '“后来才发现，如果真的有人听见，回声自己会沿着风回到地面。”',
    ],
    question: '站在被夕阳染暖的石拱下，她问：“要替今天的我们，留下一个愿望吗？”',
    choices: [
      {
        id: 'wish-meet',
        label: '“愿所有独自值班的夜，最终都能等到天亮和风声。”',
        reply: [
          '那这个愿望我偷偷收进 log 档案第一页了，陈舟，不许反悔。',
        ],
        wishNote: '愿所有独自值班的夜，都能等到天亮与风声。',
      },
      {
        id: 'wish-eyes',
        label: '“愿地球上有人看过的每一眼晴朗，都不必独自咽下去。”',
        reply: [
          '真好啊，如果以后有人在城市角落看到同一阵云，或许也会替我们记着。',
        ],
        wishNote: '愿每一眼晴朗，都有人与你同频看见。',
      },
    ],
    nextLabel: '18:10 · 云合雨来',
    signature: '—— 林微 · 听见了山谷应答',
  },
  rain: {
    eyebrow: '18:10 · 迟到的雨 · 湖岸',
    lines: [
      '第一滴晚雨打上镜片的瞬间，林微突然安静了好几秒，连呼吸声都放得很低。',
      '“……陈舟，我已经四年零七个月，没听见过雨水落在水面的声音了。”',
      '雨丝渐渐疏朗，暮色像一块巨大的蓝丝绒正从山脊后慢慢掀开。',
    ],
    question: '雨停时信号格微微闪红，她小声说：“要是天黑了……还来得及看夜晚吗？”',
    choices: [
      {
        id: 'wait-fireflies',
        label: '“来得及。湖边木船旁刚落下一片萤火虫，我带你去。”',
        reply: [
          '地面上也有自己发光的小东西啊——别走快，我想把每一点微光都数一数。',
        ],
      },
      {
        id: 'wait-night',
        label: '“就算屏幕闪了也没关系，我今晚哪都不去，把整片夜色留给你。”',
        reply: [
          '嗯，那去岸边那条小木船看看吧，傍晚的风吹着船尾摇一摇的，很像摇篮。',
        ],
      },
    ],
    nextLabel: '19:45 · 去木船旁',
    signature: '—— 林微 · 等来了四年后的雨',
  },
  fireflies: {
    eyebrow: '19:45 · 轻舟守夜 · 微光湖畔',
    lines: [
      '草叶间的金光随着木船微晃起落，镜角突然跳出一行极淡的低电量警报：中微子中继余量 12%。',
      '林微没有解释那行字，只是安静地看着流萤停在船舷边。',
      '“十一年了，”她轻声说，“原来夜晚并不是黑的，只是把亮起来的机会让给了星和萤。”',
    ],
    clue: {
      id: 'neutrino-12',
      label: '线索 IV · “中微子信标余量 12%”',
    },
    question: '如果这副眼镜还能替你留下一句带往世界角落的约定，你想说什么？',
    choices: [
      {
        id: 'promise-share',
        label: '“以后我走过的每一座城市，都会在电台里给你寄回一张视野。”',
        reply: [
          '好，哪怕以后中继熄了，我也在下面一寸一寸地听着。最后一次——帮我仰起头看看星空吧。',
        ],
        epilogueNote: '“以后我去过的每座城市，都会替你多看两眼。”',
      },
      {
        id: 'promise-light',
        label: '“无论你在多深多远的地方，地面上的人一直记得替你点灯。”',
        reply: [
          '有今天这一天，这十一年就不算困住我了。走吧，我们去连最后一颗星。',
        ],
        epilogueNote: '“无论隔着多少公里，地面上的灯会一直为你亮着。”',
      },
    ],
    nextLabel: '22:30 · 仰望夜空',
    signature: '—— 林微 · 中继电量 12%',
  },
  stars: {
    eyebrow: '22:30 · 最后的真话 · 星河之下',
    lines: [
      '三颗星连在一起那一刻，她隔着微弱噪声轻声开口：“陈舟，谢谢你替我休完这一天假。”',
      '“其实根本没有什么偏远观测站——我现在所在的地方，没有方向，也永远见不到地面上的夜。”',
      '“别难过。闭上眼，顺着中微子信标往下听——我现在就在你脚下。”',
    ],
    question: '电台警报彻底响起，信号只剩穿过铁镍核心的最后一跳：',
    choices: [
      {
        id: 'plunge-hold',
        label: '“我抓紧了——我去见你，哪怕穿过整颗地球。”',
        reply: [
          '“我就在地球心脏跳动的地方等你。……三、二、一，跟紧我。”',
        ],
      },
      {
        id: 'plunge-quiet',
        label: '“我听见了……六千多公里深处的心跳，一直在响。”',
        reply: [
          '“这一刻起，我就真的拥有过整个地球表面了。再见，陈舟。”',
        ],
      },
    ],
    nextLabel: '穿透地心 · 6,371.4 KM',
    signature: '—— 落日六号 SUNSET-06 · 最后通联',
  },
}

export const TRUTH: TruthMeta = {
  tag: 'NEUTRINO TRACE',
  depth: '6,371.4',
  unit: 'KM',
  subtitle: 'EARTH CORE',
  lines: [
    '落日六号从未飞向太空——它是一艘地航飞船。',
    '11 年前失事沉入地下 6,371.4 公里的地球内核，',
    '四周是 360 GPa 高压与 5,400°C 的炽热铁镍，她永远无法返航。',
    '而这一整天草原上的花、风、雨、萤火与星辰，全都是你借给她的眼睛。',
  ],
  vessel: '落日六号 SUNSET-06 · 深地航行器 · 第 4,113 天',
  warning: '外部压强 360 GPa · 5,400°C // OVERRIDE',
}

export const PRESSURE_ALERT = '外部压强 360 GPa · 5,400°C // 异常脉动'

export const FINAL_LINES = [
  '不管隔着多少公里，只要地面上还有人肯借出一双眼睛，',
  '她就能在地球心脏深处，再走完一次人间晨昏。',
]

export const FINAL_CAPTION = 'SUNSET-06 · 6,371.4 KM · 每一眼晴朗都值得寄给远方的人'

export const EASTER_EGGS: Record<'bottle' | 'tablet' | 'meteor', EasterEggMeta> = {
  bottle: {
    id: 'bottle',
    kicker: 'HIDDEN ECHO 01 · 湖畔漂流瓶',
    title: '一封没有写完的晚安',
    lines: [
      '致偶然走来湖边的人：',
      '如果瓶身还是温的，说明今天的太阳也同样晒暖了这片山坡。',
      '请替我把这句话放回水里——无论沉到多深，我依然往有光的地方走。',
    ],
    signature: '—— SUNSET-06 试航备忘 · 出航前夜',
    accent: '#9bd2ff',
  },
  tablet: {
    id: 'tablet',
    kicker: 'HIDDEN ECHO 02 · 山坡风化石碑',
    title: '旧观测台遗留铜牌',
    lines: [
      '多年前曾有一支地面接力组，每天傍晚把草原的风声通过电缆发往深井。',
      '后来信道早被地幔高温熔断，',
      '但路过的牧人与旅人，仍习惯把野花放在碑前。',
    ],
    signature: '—— 草原旧标牌 · 风化铭文',
    accent: '#f2c28b',
  },
  meteor: {
    id: 'meteor',
    kicker: 'HIDDEN ECHO 03 · 划过天穹的流星',
    title: '替她许过的愿',
    lines: [
      '其实她早听见你抬头那一秒的心跳了。',
      '越是不肯说出口的愿望，夜空越亮着替你们保管。',
    ],
    signature: '—— 林微 · 同在一片苍穹之下',
    accent: '#c4d4ff',
  },
}

export const INTRO_SPECS = [
  { label: 'NEUTRINO LINK', value: 'SUNSET-06' },
  { label: 'CABIN STATE', value: 'SEALED · 11 YRS' },
  { label: 'DEPTH', value: 'ENCRYPTED // SEALED' },
  { label: 'BANDWIDTH', value: '0.31 kb/s' },
]
