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
    speaker: '随身通信终端 · 加密频段接通',
    timeLabel: '06:38',
    text: '清晨的草原起了薄雾。陈舟手腕上的个人通信终端忽然亮起琥珀微光，耳机接通的瞬间，那头轻轻笑了一声。',
    sub: '“喂，听得见吗？我是林微。昨晚拜托人塞进你背包的那副眼镜，没忘在车上吧？”',
  },
  {
    speaker: '林微 · 加密频道另一端',
    timeLabel: '06:39',
    text: '“我在一个挺偏的观测站值班，一时半会儿回不来，只好厚着脸皮向你借一天假期。就今天一天，不耽误你玩。”',
    sub: '频道里夹杂着极轻的载波底噪，可她的语气轻快得像刚跑完早操的老朋友。',
  },
  {
    speaker: '神经传感眼镜 · 准备佩戴',
    timeLabel: '06:40',
    text: '“戴上镜框试试吧，陈舟。等神经协议接通，你看见的光、碰到的草和风，我这边都能跟着感觉到。”',
    sub: '镜脚内侧刻着一行极小的编号：SUNSET-06 · 林微。轻点继续，启动超感视界。',
  },
]

export const DESCENT_CAPTIONS: DescentCaption[] = [
  {
    thresholdKm: 0,
    layer: '地壳 · MOHO 35 KM',
    line: '穿越莫霍面，地表风声与草香彻底隔绝。',
  },
  {
    thresholdKm: 650,
    layer: '下地幔 · 2,900 KM',
    line: '高温高压硅酸盐岩层，暗红岩浆在舱外无声翻涌。',
  },
  {
    thresholdKm: 4400,
    layer: '液态铁镍外核 · 6,371.4 KM',
    line: '炽热铁镍核心中央，「落日六号」的琥珀信标仍在闪烁。',
  },
]

export const BRIEFING_CARDS: BriefingItem[] = [
  {
    tag: '01 · 序幕设定',
    title: '替无法返航的姑娘休一天假',
    body: '灵感致敬刘慈欣《带上她的眼睛》：旅人「陈舟」在休假前夜收到一副特殊的神经传感眼镜，只要戴上它，草原上的光线、气味与触感都会实时传给耳机另一端的「林微」。',
  },
  {
    tag: '02 · 她的谎言',
    title: '“我只是在偏远观测站值班”',
    body: '频段里的她爱笑、爱问路边的花和晚雨，像只是被困在远方的同事；直到星夜尽头信号穿透岩层，陈舟才真正看清她身处的坐标。',
  },
  {
    tag: '03 · 交互体验',
    title: '接通频段 · 戴上脑机 · 触摸人间',
    body: '置身清晨草原接通林微的加密呼叫，在 8 幕日夜流转中帮她轻触野花、听湖风、接晚雨；即使读过原著也可直接跳过，或随时在序章里开启自由漫游。',
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
    title: '晨雾触花',
    short: '触花',
    timeLabel: '06:40',
    hint: '超感眼镜已定位草坡野花——调准焦距，或直接轻触花瓣看它随风摇曳。',
    accent: '#f2c28b',
    focus: 'flower',
  },
  {
    act: 2,
    index: 'II',
    title: '湖畔听风',
    short: '湖风',
    timeLabel: '09:30',
    hint: '走到湖边划开两次水面，把波光与上午的草原长风送进她的耳机。',
    accent: '#8ec8ff',
    focus: 'lake',
  },
  {
    act: 3,
    index: 'III',
    title: '孤树蒲公英',
    short: '孤树',
    timeLabel: '13:15',
    hint: '站在悬崖孤树下聚起午后暖风，看白绒替她一路往高处飞去。',
    accent: '#ffe2bd',
    focus: 'tree',
  },
  {
    act: 4,
    index: 'IV',
    title: '石拱回声',
    short: '石拱',
    timeLabel: '15:50',
    hint: '在山腰石拱前轻叩三次呼唤，让整座山谷替她把愿望喊出来。',
    accent: '#f2c28b',
    focus: 'ruin',
  },
  {
    act: 5,
    index: 'V',
    title: '手心晚雨',
    short: '晚雨',
    timeLabel: '18:10',
    hint: '她小声问你：能帮我伸手摸一摸雨水吗？点住落下的 5 滴晚雨吧。',
    accent: '#a9c8ff',
    focus: 'shore',
  },
  {
    act: 6,
    index: 'VI',
    title: '轻舟聚萤',
    short: '流萤',
    timeLabel: '19:45',
    hint: '暮色压低时中继电量开始告警，替湖畔木船点亮 6 簇暖色流萤。',
    accent: '#f7d294',
    focus: 'boat',
  },
  {
    act: 7,
    index: 'VII',
    title: '星夜揭秘',
    short: '真话',
    timeLabel: '22:30',
    hint: '连起夜空三颗亮星——她终于说出「观察站」究竟在多深的地下。',
    accent: '#c4d4ff',
    focus: 'sky',
  },
  {
    act: 8,
    index: 'VIII',
    title: '落日六号',
    short: '地心',
    timeLabel: '00:00',
    hint: '坠向 6,371.4 公里炽热地心，接住她的最后告别，并带走她的眼睛。',
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
    eyebrow: '06:40 · 触碰第一朵花 · 清晨',
    lines: [
      '你的指尖刚碰弯那根花茎，她就在耳机那头轻呼了一声：“哇——露水弹在我手背上了！”',
      '陈舟还没来得及回话，她又赶忙补了一句：“……对不起有点一惊一乍的，主要是我这边窗外没有风，也没有天气。”',
    ],
    clue: {
      id: 'no-weather',
      label: '异常线索 I · “她那边没有天气”',
    },
    question: '耳机里安静了一秒，她像是踮脚看过来：“你那边的太阳，现在照到这朵花了吗？”',
    choices: [
      {
        id: 'sun-yes',
        label: '“就是路边最普通的野花，满坡都是，没什么特别的。”',
        reply: [
          '“普通才好呀，我连普通的草叶都好久没见过了。往前走走吧，我好像看见山谷下面有水反光了。”',
        ],
      },
      {
        id: 'sun-stay',
        label: '“露水还凉着，我蹲低一点，让你把花瓣看清楚。”',
        reply: [
          '“好啦别耽误你散步！往前带我去湖边看看吧，我想听水声。”',
        ],
      },
    ],
    nextLabel: '09:30 · 去湖畔看水',
    signature: '—— 林微 · 超感传感同步中',
  },
  wind: {
    eyebrow: '09:30 · 湖风过境 · 上午',
    lines: [
      '指尖划开湖水时，耳机里突然传出一声沉闷发颤的钢板挤压声，随即被湖风遮得干干净净。',
      '“哈哈吓着你了吧？”她马上笑着找补，“站里老旧加压阀老这样吱呀乱叫。……湖风吹久了，头发和衣领会变凉吧？”',
    ],
    clue: {
      id: 'hull-groan',
      label: '异常线索 II · “深处传来重压金属声”',
    },
    question: '山谷的风穿过衣领时，你对着通信器回她：',
    choices: [
      {
        id: 'wind-warm',
        label: '“你们站里经费挺紧啊，加压阀听着像要散架了。”',
        reply: [
          '“是啊，修也修不好，习惯了。去高坡那棵孤树下面好不好？我想看蒲公英。”',
        ],
      },
      {
        id: 'wind-cool',
        label: '“刚才那声不像加压阀，像很厚的钢板在变形，你那边真没事？”',
        reply: [
          '“真没事，隔音太差而已。别站湖边吹风啦，往高处跑两步吧！”',
        ],
      },
    ],
    nextLabel: '13:15 · 前往孤树坡',
    signature: '—— 林微 · 听见湖水与长风',
  },
  dandelion: {
    eyebrow: '13:15 · 向上飞去的种子 · 午后',
    lines: [
      '成千上万朵蒲公英猛地腾空时，林微失声笑出来：“太棒了……你看它们一直往上飞！”',
      '笑声落下时她却忽然卡住：“奇怪……在地面上，人为什么一眼就能分出哪边是上、哪边是下呢？……算了，大概是我值夜班躺迷糊了。”',
    ],
    clue: {
      id: 'no-direction',
      label: '异常线索 III · “她分不清上和下”',
    },
    question: '白绒球飘过头顶的蓝天时，你随口接了句：',
    choices: [
      {
        id: 'seed-home',
        label: '“头顶有太阳、脚底踩着草，这还能分不清？”',
        reply: [
          '“嗯……有太阳和草地的地方，方向确实很简单。你看那朵，还在往高处飘呢。”',
        ],
      },
      {
        id: 'lantern-tree',
        label: '“你多久没下地走两步了？下回换班一定出来转转。”',
        reply: [
          '“……好呀。要是有机会，我也想脱了鞋踩踩草坡，再听听树枝被风吹响的声音。”',
        ],
      },
    ],
    nextLabel: '15:50 · 走近石拱',
    signature: '—— 林微 · 记住了午后晴空',
  },
  ruin: {
    eyebrow: '15:50 · 远古山谷 · 午后转暮',
    lines: [
      '石拱三声回响散开时，她突然安静下来，只听见耳机里隔着高重压的轻微喘息。',
      '“真好呀，山谷里居然有回声。我这里说话从来没有回声。四面舱壁离我不到一臂远，声音刚出嘴就被铁板吃掉了。”',
    ],
    clue: {
      id: 'cabin-hum',
      label: '异常线索 IV · “四面舱壁不到一臂远，没有回声”',
    },
    question: '夕阳斜切进石拱时，她轻声说：“对着石头喊一句什么吧？我想听听一个声音，能跑多远。”',
    choices: [
      {
        id: 'wish-meet',
        label: '“喂——明天的天气一定也很好！”',
        reply: [
          '“听见啦，回声跑得好远！这句话我记在今天的日志里了。”',
        ],
        wishNote: '明天的天气一定也很好。',
      },
      {
        id: 'wish-eyes',
        label: '“喂——不管你在哪座观测站，记得早点下班回来！”',
        reply: [
          '“……嗯，山谷替你记着呢。天色好像暗下来了，起风了是不是？”',
        ],
        wishNote: '不管在哪座观测站，记得早点下班回来。',
      },
    ],
    nextLabel: '18:10 · 云压过来了',
    signature: '—— 林微 · 记住了山谷的回声',
  },
  rain: {
    eyebrow: '18:10 · 迟到十一年的晚雨 · 黄昏',
    lines: [
      '云层压低，细雨打湿传感镜面。林微沉默了好久，只剩雨点落在草尖上的轻响。',
      '忽然，她的声音轻得发抖：“陈舟……你能不能伸出手，替我摸一下雨水？我有点忘了雨点落在指背上是什么温度……我已经整整十一年，没淋过一场雨了。”',
    ],
    question: '你伸出手背接住冰凉的雨滴，信号格开始泛红。她屏息等着你的触感传过去：',
    choices: [
      {
        id: 'wait-fireflies',
        label: '“挺凉的，打在手背上还有点麻。等雨小了，我带你去湖边看木船。”',
        reply: [
          '“嗯，慢一点走……我想把指背变凉的感觉多记一会儿。”',
        ],
      },
      {
        id: 'wait-night',
        label: '“十一年？林微，你到底在哪个观测站？怎么可能十一年不回地面？”',
        reply: [
          '“哎呀休假别查户口啦！快看湖岸那边，雨刚停，好像有亮晶晶的东西飞起来了！”',
        ],
      },
    ],
    nextLabel: '19:45 · 去木船旁',
    signature: '—— 林微 · 摸到了十一年后的雨',
  },
  fireflies: {
    eyebrow: '19:45 · 中继告警 12% · 暮夜',
    lines: [
      '金色流萤绕着木船亮起时，镜角突然刺眼地跳出红字：【中微子中继余量 12%】。',
      '她盯着船头一点微光，语气反而平静得近乎透明：“萤火虫是不是只能活几天、亮几个晚上呀？……那挺好的。只要真亮给一个人看过，就不算白来这一趟。”',
    ],
    clue: {
      id: 'neutrino-12',
      label: '异常线索 V · “中微子信标余量 12%”',
    },
    question: '陈舟看着跳红的中继余量，声音终于沉了下来：',
    choices: [
      {
        id: 'promise-share',
        label: '“等我回城里，把街角的晚风、热面摊和地铁灯都录进电台发给你。”',
        reply: [
          '“好啊，那我以后一个人值班就不算无聊了。陈舟，最后帮我做一件事，抬头看看星星吧。”',
        ],
        epilogueNote: '“以后回城里，把街角晚风、热面摊和地铁灯都寄进电台给你听。”',
      },
      {
        id: 'promise-light',
        label: '“今晚信号不管撑到几点，我都不摘眼镜，陪你把天看黑。”',
        reply: [
          '“有你这句话，今天这趟假我休得太值了。抬头吧，陈舟。”',
        ],
        epilogueNote: '“信号不管撑到几点，眼镜我都不会摘下来。”',
      },
    ],
    nextLabel: '22:30 · 仰望夜空',
    signature: '—— 林微 · 中继余量 12%',
  },
  stars: {
    eyebrow: '22:30 · 坐标解锁 · 星空之下',
    lines: [
      '三颗星连成瞬间，所有伪装彻底裂开——强磁场爆鸣中，镜片强制解码完整坐标：【深度：6,371.4 KM · 落日六号】',
      '“……被你看见坐标啦。对不起啊陈舟，骗了你一整天。其实早就没有返航舱了。我一直都在你脚底下。”',
      '“可今天清晨那朵野花真香，傍晚的雨也比我记得的更凉。信标只剩最后几十秒了。陈舟，别难过，顺着信号，下来看我一眼吧。”',
    ],
    question: '陈舟按住耳畔仍在发烫的终端，赶在中微子波束彻底坍缩前喊了回去：',
    choices: [
      {
        id: 'plunge-hold',
        label: '“林微你别挂！眼镜我不会摘的。明年春天野花开的时候，我再帮你闻一次！”',
        reply: [
          '“一言为定。三、二、一，别眨眼——”',
        ],
      },
      {
        id: 'plunge-quiet',
        label: '“你别怕黑！以后我去的每一座城、淋到的每一场雨，全都带着你一起看！”',
        reply: [
          '“那我以后真的不怕黑了。再见啦，替我休假的老朋友——”',
        ],
      },
    ],
    nextLabel: '穿透地心 · 6,371.4 KM',
    signature: '—— 落日六号 SUNSET-06 · 最后通联',
  },
}

export const TRUTH: TruthMeta = {
  tag: 'CORE TRUTH // 6,371.4 KM',
  depth: '6,371.4',
  unit: 'KM',
  subtitle: 'SUNSET-06 · EARTH CORE',
  lines: [
    '落日六号失事沉入地下六千三百七十一点四公里。',
    '外部压强三百六十吉帕，温度五千四百摄氏度。她被永远封在地球的铁镍核心里。',
    '而今天这片草坡上的晨雾、晚雨和星光，是她十一年来，最后看见的人间。',
  ],
  vessel: '落日六号 SUNSET-06 · 深地航行器 · 第 4,113 天',
  warning: '外部压强 360 GPa · 5,400°C // NEURAL OVERRIDE',
}

export const PRESSURE_ALERT = '外部压强 360 GPa · 5,400°C // 地心脉动'

export const FINAL_LINES = [
  '眼镜没有摘下来。',
  '以后的每一场雨、每一座城市的灯火，都会通过「风信」继续替她去看。',
]

export const FINAL_CAPTION = '风信 · WINDPOST NO.6371 · 把全世界的晴朗寄往地球最深处'

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
