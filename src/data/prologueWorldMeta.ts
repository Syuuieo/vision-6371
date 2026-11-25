export type WorldDiscoveryId =
  | 'cliff_windmill'
  | 'birch_grove'
  | 'relay_station'
  | 'lake_island'
  | 'west_cairn'

export interface WorldDiscoveryMeta {
  id: WorldDiscoveryId
  name: string
  subtitle: string
  clueText: string
  x: number
  z: number
  radius: number
  accent: string
}

export const WORLD_DISCOVERIES: readonly WorldDiscoveryMeta[] = [
  {
    id: 'cliff_windmill',
    name: '东南风车崖',
    subtitle: '守风人的白木测风台',
    clueText: '风车仍在替地下三千公里的她数着地面上的风速与季候。',
    x: 84,
    z: -22,
    radius: 14,
    accent: '#e8c47a',
  },
  {
    id: 'birch_grove',
    name: '东谷白桦林',
    subtitle: '风铃木牌与林间林荫',
    clueText: '白桦枝头悬着地面航行时代留下的风铃木牌，风过时会轻响。',
    x: 68,
    z: -86,
    radius: 15,
    accent: '#b4d8a6',
  },
  {
    id: 'relay_station',
    name: '北岭中继站 06',
    subtitle: '地心纪行地表声呐转播塔',
    clueText: '「落日六号」地表最后一座微弱中继台，抛物面天线仍朝向湖心。',
    x: 16,
    z: -134,
    radius: 14,
    accent: '#8cd4f2',
  },
  {
    id: 'lake_island',
    name: '湖心浅滩石龛',
    subtitle: '踏石长堤尽头的孤岛',
    clueText: '踩过十八块踏石走上孤岛，风停时能在石龛倒影里看见整片山谷。',
    x: -58,
    z: -94,
    radius: 14,
    accent: '#9bd8df',
  },
  {
    id: 'west_cairn',
    name: '西原日落石阵',
    subtitle: '七石日晷与温火盆台',
    clueText: '七块玄石围成旧日历阵，落日前后影针正好指向湖畔的木栈道。',
    x: -84,
    z: -24,
    radius: 14,
    accent: '#f0a67e',
  },
] as const

/** 太阳沿真实弧线运行（纯数学计算，供零 Three.js UI 与 3D 引擎共享）。 */
export function sunDirectionCoords(hour: number): { x: number; y: number; z: number } {
  const day = (hour - 6) / 12.5
  let x: number
  let y: number
  let z: number
  if (day >= 0 && day <= 1) {
    const angle = day * Math.PI
    x = -Math.cos(angle) * 0.85
    y = Math.sin(angle) * 0.98 + 0.02
    z = -0.5
  } else {
    const night = ((hour - 18.5 + 24) % 24) / 11.5
    const angle = night * Math.PI
    x = -Math.cos(angle) * 0.7
    y = Math.sin(angle) * 0.62 + 0.03
    z = -0.62
  }
  const len = Math.hypot(x, y, z) || 1
  return { x: x / len, y: y / len, z: z / len }
}

export function sunArc(hour: number) {
  const dir = sunDirectionCoords(((hour % 24) + 24) % 24)
  const yClamped = Math.max(-1, Math.min(1, dir.y))
  return {
    altitude: Math.asin(yClamped),
    azimuth: Math.atan2(dir.x, -dir.z),
    daylight: hour >= 6 && hour <= 18.5,
  }
}
