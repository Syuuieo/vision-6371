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
    speaker: '草原电话亭 · 铃声接通',
    timeLabel: '06:38',
    text: '陈舟推开蒙着朝露的玻璃门，摘下还在嗡嗡震动的黑色听筒——电话那头轻轻笑了一声。',
    sub: '“喂，听得见吗？我是林微。昨晚塞进你背包里的那副眼镜，现在就在你手边吧？”',
  },
  {
    speaker: '林微 · 电话另一端',
    timeLabel: '06:39',
    text: '“我在一个很远很安静的观测站值班，暂时飞不回地面，只好厚着脸皮向你借一天假期——放心，就今天一天。”',
    sub: '电话线里夹杂着极轻的电流沙沙声，可她的语气轻快得像刚跑完早操的老朋友。',
  },
  {
    speaker: '神经传感眼镜 · 准备佩戴',
    timeLabel: '06:40',
    text: '“现在戴上那副传感镜框吧，陈舟。只要神经协议接通，你看见的太阳、碰到的野花和风，都会变成我的眼睛。”',
    sub: '镜脚内侧刻着一行极小的编号：SUNSET-06 · 林微。轻点继续，启动超感视界。',
  },
]

export const DESCENT_CAPTIONS: DescentCaption[] = [
  {
    thresholdKm: 0,
    layer: '地壳 · MOHO 35 KM',
    line: '草原的风与晨露急剧远去，你第一次顺着她的信号垂直跌进黑色岩层。',
  },
  {
    thresholdKm: 650,
    layer: '下地幔 · 2,900 KM',
    line: '四周不再有天空和花海——十一年来，她每天睁开眼看见的只有这种暗红高压硅酸盐。',
  },
  {
    thresholdKm: 4400,
    layer: '液态铁镍外核 · 6,371.4 KM',
    line: '在 5,400°C 的炽热核心中央，那艘写着「落日六号」的钛金小球正静静闪光。',
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
    body: '电话里的她爱笑、爱问路边的花和晚雨，像只是被困在远方的同事；直到星夜尽头信号穿透岩层，陈舟才真正看清她身处的坐标。',
  },
  {
    tag: '03 · 交互体验',
    title: '接起电话 · 戴上脑机 · 触摸人间',
    body: '走进草原接听响铃电话亭，在 8 幕日夜流转中帮她轻触野花、听湖风、接晚雨；即使读过原著也可直接跳过，或随时在序章里开启自由漫游。',
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
      '你的指尖刚碰弯那根花茎，她就在电话那头轻呼了一声：“哇——露水弹在我手背上了！”',
      '陈舟笑起来：“不是你手背，是我这边起了点晨风。”她沉默了半秒才小声补道：“我这边窗外其实没有风，也没有天气。”',
      '可花瓣在阳光里轻颤的那两下，像真的替她把清晨晒热了。',
    ],
    clue: {
      id: 'no-weather',
      label: '异常线索 I · “她那边没有天气”',
    },
    question: '她仰起头似的问：“你那边的太阳，现在照到这朵花了吗？”',
    choices: [
      {
        id: 'sun-yes',
        label: '“嗯，花瓣全亮起来了，整片山坡都是青草被晒暖的味道。”',
        reply: [
          '“真好啊……”她像在很认真地背下这个词，“‘晒暖’听起来好宽敞。往前带我去看看湖边吧？”',
        ],
      },
      {
        id: 'sun-stay',
        label: '“刚晒上花尖。你想多看一会儿，我就蹲在花旁再陪你五分钟。”',
        reply: [
          '“才不要耽误你休假呢！”她故意加快语速，“走吧，我在视野边角看见山谷下面好像有水反光了！”',
        ],
      },
    ],
    nextLabel: '09:30 · 去湖畔看水',
    signature: '—— 林微 · 超感传感同步中',
  },
  wind: {
    eyebrow: '09:30 · 湖风过境 · 上午',
    lines: [
      '指尖划开湖水的瞬间，耳机里突然响起一声沉闷到发颤的金属撞击，像是几万吨钢板正被死死挤压。',
      '下一秒草原的暖风呼地涌进麦克风，把那阵可怕的杂音遮得干干净净。',
      '“哈哈吓到你了？”她很快找补，“站里老旧压缩机总是这样吱呀乱叫，别理它。”',
    ],
    clue: {
      id: 'hull-groan',
      label: '异常线索 II · “深处传来重压金属声”',
    },
    question: '她忽然有点嘴馋似的问：“湖风吹久了，头发和衣领会变凉吧？”',
    choices: [
      {
        id: 'wind-warm',
        label: '“太阳照着一点都不冷，风倒像把刚晒过的被子抖在人身上。”',
        reply: [
          '“我这里的恒温表，已经好多年没跳动过一格了。”她轻笑，“去高坡那棵孤树下面好不好？我想看蒲公英。”',
        ],
      },
      {
        id: 'wind-cool',
        label: '“水汽带点凉意，吸一口气整个人一下子就醒过来了。”',
        reply: [
          '“真羡慕……在只有四平米见方的铁壁里，白天和夜里连风向都没有。”她顿住，“走，往高处跑两步！”',
        ],
      },
    ],
    nextLabel: '13:15 · 前往孤树坡',
    signature: '—— 林微 · 听见湖水与长风',
  },
  dandelion: {
    eyebrow: '13:15 · 向上飞去的种子 · 午后',
    lines: [
      '成千上万朵蒲公英猛地腾空时，林微在耳机里失声笑出来：“太棒了……你看它们一直往上飞！”',
      '笑声落下时她却像忽然卡住：“奇怪……为什么在地面上，人一眼就能分出哪边是‘上’、哪边是‘下’呢？”',
      '“算了，”她很快把话题岔开，“大概是我值夜班躺晕了头。”',
    ],
    clue: {
      id: 'no-direction',
      label: '异常线索 III · “她分不清上和下”',
    },
    question: '“陈舟，如果只能从今天借走一样小纪念品，你想替我留什么？”',
    choices: [
      {
        id: 'seed-home',
        label: '“一颗还正往高处飘的蒲公英——总觉得它还能飞到很远的地方。”',
        reply: [
          '“嗯！只要风没有停下来，哪怕落不回泥土里，也算替我飞出去了。”',
        ],
      },
      {
        id: 'lantern-tree',
        label: '“把孤树枝头被吹响的木风铃记下来，夜里放给你听。”',
        reply: [
          '“木头碰撞的声音真温和呀……比舱壁上滴答作响的警报灯温柔太多了。”',
        ],
      },
    ],
    nextLabel: '15:50 · 走近石拱',
    signature: '—— 林微 · 记住了午后晴空',
  },
  ruin: {
    eyebrow: '15:50 · 远古山谷 · 午后转暮',
    lines: [
      '石拱三声回响散开时，陈舟听见耳机另一端隐隐传来极细微的喘息——那不是草地上的风，而像有人隔着极高的血压与重力在说话。',
      '可她的声音依然亮亮的：“真希望山谷里真能住着回声啊。那样我说过的每一句‘祝你好运’，就都会顺着风回到地面了。”',
    ],
    question: '夕阳斜斜切进石拱时，她轻声问：“你有什么愿望，想先替我们寄存在石头里吗？”',
    choices: [
      {
        id: 'wish-meet',
        label: '“愿所有独自熬过漫长黑夜的人，最后都能等到天亮和风声。”',
        reply: [
          '“这句我记下了！等这次值班结束后……不，哪怕现在，我也把它当作我们拉过勾的约定。”',
        ],
        wishNote: '愿所有独自熬过长夜的人，最终都能等到天亮与风声。',
      },
      {
        id: 'wish-eyes',
        label: '“愿人类看过的每一眼晴朗山河，都不会只留在自己手里。”',
        reply: [
          '“这句话真好。要是以后的旅人们也在电台里互相寄风景，那就再也没人是一个人啦。”',
        ],
        wishNote: '愿每一眼晴朗山河，都有人与你同频共享。',
      },
    ],
    nextLabel: '18:10 · 云压过来了',
    signature: '—— 林微 · 山谷答应了我们',
  },
  rain: {
    eyebrow: '18:10 · 迟到四年的晚雨 · 黄昏',
    lines: [
      '云层压低，细雨忽然打湿传感镜面。林微沉默了好久，耳机里只能听见雨点打在草尖上啪嗒轻响。',
      '忽然，她的声音轻得发抖：“陈舟……你可以伸出手去，替我摸一摸雨水吗？”',
      '“我好想念雨滴凉凉地落在指背上的感觉……我已经四年零七个月，没碰见过一场真正的雨了。”',
    ],
    question: '你伸出手掌接住微凉的雨点，信号角开始泛红闪烁。她低声问：“天黑前……还来得及看夜色吗？”',
    choices: [
      {
        id: 'wait-fireflies',
        label: '“我带你去看湖畔木船。雨刚停，萤火虫已经绕着船舷飞起来了。”',
        reply: [
          '“萤火虫也会自己发光呀……走慢一点陈舟，我想把这一夜的每一粒亮光都数清楚。”',
        ],
      },
      {
        id: 'wait-night',
        label: '“信号再闪我也不走，今夜哪里都不去，把整片星河全留给你。”',
        reply: [
          '“你傻不傻……”她小声吸了吸鼻子，破涕笑出来，“好，去岸边看看那条摇摇晃晃的小木船吧。”',
        ],
      },
    ],
    nextLabel: '19:45 · 去木船旁',
    signature: '—— 林微 · 摸到了四年后的雨',
  },
  fireflies: {
    eyebrow: '19:45 · 中继告警 12% · 暮夜',
    lines: [
      '金色的流萤绕着木船升起时，镜角突然刺眼地跳出红色一行字：【中微子中继余量 12% · 屏蔽衰竭】。',
      '林微没有提那行字。她只是盯着船头一点微弱灯火轻声道：“十一年前刚进来时我每天都在哭。可今天我才知道，夜之所以会暗下来，是为了让星星和萤火亮起来。”',
    ],
    clue: {
      id: 'neutrino-12',
      label: '异常线索 IV · “中微子信标余量 12%”',
    },
    question: '陈舟忽然心里发紧，赶在她换气前哑声许下承诺：',
    choices: [
      {
        id: 'promise-share',
        label: '“林微，不管今天几点结束，以后我每走到一座城市，都会把当地的风景寄给你。”',
        reply: [
          '“那可说定了——以后在几千公里下面太无聊的时候，我就翻出你的电台信箱。最后一次了，带我仰起头看看星空好吗？”',
        ],
        epilogueNote: '“以后我走过的每一座城市，都会在电台里给你寄回一双眼睛。”',
      },
      {
        id: 'promise-light',
        label: '“你在哪儿我都不会挂掉电话——这片地面上的人，会永远替你留着一盏灯。”',
        reply: [
          '“能听见你这句，我已经很赚啦。走吧陈舟，只剩最后一次抬头看星星的时间了。”',
        ],
        epilogueNote: '“无论隔着多深的黑暗，地面上总有人替你把灯亮着。”',
      },
    ],
    nextLabel: '22:30 · 仰望夜空',
    signature: '—— 林微 · 中继余量 12%',
  },
  stars: {
    eyebrow: '22:30 · 真相击穿地壳 · 星空之下',
    lines: [
      '最后一颗星连上的瞬间，所有温柔的伪装彻底崩裂——强磁场杂音骤然炸响，镜片上强制弹出完整轨迹坐标：【地心深度：6,371.4 KM · 落日六号失事舱】。',
      '“……对不起陈舟，根本没有什么偏远观测站。”林微在热辐射刺耳的爆鸣里笑得那么安静，“我不是在天上，我是十一年前被困在地球内核里的地航员。所以才没有风，也没有上下。”',
      '“我真的快坚持到中继耗尽了。但今天你给我的草原、野花、雨点和星星……足够我在黑洞般的铁镍海洋里再亮一辈子。陈舟——别哭，顺着信号看看我吧。”',
    ],
    question: '陈舟死死攥住耳麦，在信号彻底坠入地核前一字一句大喊回去：',
    choices: [
      {
        id: 'plunge-hold',
        label: '“林微，别怕！我会继续带上你的眼睛，替你看遍世间百态——直到每一座城市都认得你！”',
        reply: [
          '“我听见了！……我就在地球心脏跳动的地方接着看你走遍人间。三、二、一，跟紧中微子波束——！”',
        ],
      },
      {
        id: 'plunge-quiet',
        label: '“哪怕只能用这副眼镜，我也要带着你走出这六千公里，把整个地球表面全都走一遍！”',
        reply: [
          '“这一刻起，我就真的再也不孤单了。再见啦，替我休假的老朋友——”',
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
    '原来林微从未抬头望向任何一颗遥远星星——',
    '十一年前地航飞船「落日六号」失事沉入地球最深处，',
    '在 360 GPa 高压与 5,400°C 的液态铁镍核心里，她永远无法返航。',
    '而今天草坡的露水、指尖触动的野花与那场迟来的雨，全部通过你的眼睛真正照进了地心。',
  ],
  vessel: '落日六号 SUNSET-06 · 深地航行器 · 第 4,113 天',
  warning: '外部压强 360 GPa · 5,400°C // NEURAL OVERRIDE',
}

export const PRESSURE_ALERT = '外部压强 360 GPa · 5,400°C // 地心脉动'

export const FINAL_LINES = [
  '“林微，从今天起我不会停下脚步——我会继续带上你的眼睛，替你看遍世间百态。”',
  '只要「风信」电台还在一座座城市点亮，地心深处的她就永远与你同频。',
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
