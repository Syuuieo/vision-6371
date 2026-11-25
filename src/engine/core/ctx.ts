import * as THREE from 'three'
import {
  WORLD_DISCOVERIES,
  sunArc,
  sunDirectionCoords,
  type WorldDiscoveryId,
  type WorldDiscoveryMeta,
} from '../../data/prologueWorldMeta'
import type { FocusTarget, SkyStage } from '../../types/sensor'

export { WORLD_DISCOVERIES, sunArc, sunDirectionCoords }
export type { WorldDiscoveryId, WorldDiscoveryMeta }

/**
 * 序章 3D 引擎全局常量、昼夜调色盘与共享 Uniform 注册表（Petalwake 统一架构）。
 *
 * 所有地形、水体、草叶、野花、云层、风带与地标材质共同引用同一套 `U` 对象，
 * 确保晨雾（06:40）→ 正午 → 夕照（18:17）→ 暮色 → 星空（22:30）全场景色彩严丝合缝。
 */

export const LAKE = { x: -58, z: -96, rx: 74, rz: 52, y: -1.9 }
export const ROAM = { minX: -225, maxX: 225, minZ: -265, maxZ: 175 }
export const ROAM_CENTER = { x: 0, z: -42 }
export const ROAM_RADIUS = 220
export const EYE_HEIGHT = 1.72
export const CAMERA_HOME = new THREE.Vector3(0, 0, 12)

export interface ScenicBenchMeta {
  id: string
  name: string
  hint: string
  x: number
  z: number
  lookX: number
  lookZ: number
}

export const SCENIC_BENCHES: readonly ScenicBenchMeta[] = [
  {
    id: 'bench_pier_overlook',
    name: '渡口长椅',
    hint: '面向轻舟渡口与西山湖心',
    x: -11.5,
    z: -33.2,
    lookX: -48,
    lookZ: -86,
  },
  {
    id: 'bench_windmill_ridge',
    name: '风车崖长椅',
    hint: '俯瞰整座山谷与暮色湖湾',
    x: 75.8,
    z: -24.5,
    lookX: -12,
    lookZ: -44,
  },
  {
    id: 'bench_north_relay',
    name: '北岭望湖长椅',
    hint: '远望孤岛踏石堤与南坡孤树',
    x: 11.4,
    z: -124.2,
    lookX: -32,
    lookZ: -74,
  },
] as const

export interface WorldTrailMeta {
  id: string
  width: number
  points: readonly (readonly [number, number])[]
}

export const WORLD_TRAILS: readonly WorldTrailMeta[] = [
  {
    id: 'trail_east_cliff',
    width: 2.35,
    points: [
      [1.5, -10],
      [15, -21],
      [34, -25],
      [56, -26],
      [79, -23],
    ],
  },
  {
    id: 'trail_birch',
    width: 2.2,
    points: [
      [34, -25],
      [46, -44],
      [57, -65],
      [66, -84],
    ],
  },
  {
    id: 'trail_north_relay',
    width: 2.25,
    points: [
      [10, -34],
      [14, -64],
      [18, -98],
      [16, -130],
    ],
  },
  {
    id: 'trail_west_cairn',
    width: 2.3,
    points: [
      [-14, -22],
      [-36, -25],
      [-60, -26],
      [-81, -24],
    ],
  },
] as const

export const PLACES = [
  { name: '轻舟渡口', x: -16.5, z: -38.5, radius: 16 },
  { name: '孤树山坡', x: 15.5, z: -24, radius: 22 },
  { name: '石拱谷地', x: -15.5, z: -23, radius: 22 },
  { name: '晨雾草甸', x: -3.8, z: -8.5, radius: 20 },
  { name: '湖东高岸', x: 8, z: -40, radius: 14 },
  { name: '东南雨岸', x: 30, z: -58, radius: 16 },
  { name: '东脊星野', x: 30, z: -16, radius: 14 },
  { name: '东南风车崖', x: 84, z: -22, radius: 24 },
  { name: '东谷白桦林', x: 68, z: -86, radius: 24 },
  { name: '北岭中继站', x: 16, z: -134, radius: 24 },
  { name: '湖心浅滩岛', x: -58, z: -94, radius: 22 },
  { name: '西原石阵', x: -84, z: -24, radius: 24 },
] as const

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeInCubic = (t: number) => t * t * t
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

export function distanceToSegmentSq2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax
  const vz = bz - az
  const wx = px - ax
  const wz = pz - az
  const lenSq = vx * vx + vz * vz || 1
  const t = clamp((wx * vx + wz * vz) / lenSq, 0, 1)
  const dx = px - (ax + vx * t)
  const dz = pz - (az + vz * t)
  return dx * dx + dz * dz
}

/** 序章连续草原地形高度函数：草叶、野花、地标、水底与脚下碰撞共用 */
export function heightAt(x: number, z: number): number {
  let h =
    Math.sin(x * 0.028) * 1.8 +
    Math.cos(z * 0.033) * 1.5 +
    Math.sin((x * 0.6 + z * 0.8) * 0.021) * 2.4 +
    Math.sin(x * 0.13 + 1.7) * 0.18 +
    Math.cos(z * 0.11 + 0.4) * 0.16

  const dx = (x - LAKE.x) / LAKE.rx
  const dz = (z - LAKE.z) / LAKE.rz
  const lakeDistance = Math.sqrt(dx * dx + dz * dz)
  h -= 5.6 * (1 - smoothstep(0.55, 1.0, lakeDistance))
  h += 0.9 * Math.exp(-((x + 4.5) ** 2 + (z + 11) ** 2) / 34)
  h += 2.4 * Math.exp(-((x - 10) ** 2 + (z + 30) ** 2) / 90)

  // 五处开放草原地标与远景起伏
  h += 14.2 * Math.exp(-((x - 84) ** 2 + (z + 22) ** 2) / 680)
  h += 1.15 * Math.exp(-((x - 68) ** 2 + (z + 86) ** 2) / 480)
  h += 9.8 * Math.exp(-((x - 16) ** 2 + (z + 134) ** 2) / 560)
  h += 7.8 * Math.exp(-((x + 84) ** 2 + (z + 24) ** 2) / 460)

  // 外缘盆地自然起伏边界
  const rimX = x / 245
  const rimZ = (z + 42) / 245
  h += 4.8 * smoothstep(0.84, 1.16, Math.sqrt(rimX * rimX + rimZ * rimZ))

  // 浅滩踏石堤 (-20, -46) -> (-39, -71) -> (-58, -94) 与湖心孤岛
  const c1 = distanceToSegmentSq2D(x, z, -20, -46, -39, -71)
  const c2 = distanceToSegmentSq2D(x, z, -39, -71, -58, -94)
  const causeDist = Math.sqrt(Math.min(c1, c2))
  const causeBlend = smoothstep(8.2, 2.2, causeDist)
  const islandBlend = Math.exp(-((x + 58) ** 2 + (z + 94) ** 2) / 145)
  const shoalBlend = Math.min(1, causeBlend + islandBlend)
  const targetShoalH = -1.72 + 0.34 * islandBlend
  h = h + (targetShoalH - h) * shoalBlend

  return h
}

export function normalAt(x: number, z: number, out = new THREE.Vector3(), span = 0.75) {
  const hl = heightAt(x - span, z)
  const hr = heightAt(x + span, z)
  const hd = heightAt(x, z - span)
  const hu = heightAt(x, z + span)
  return out.set(hl - hr, 2 * span, hd - hu).normalize()
}

export interface Look {
  zenith: THREE.Color
  mid: THREE.Color
  horizon: THREE.Color
  sun: THREE.Color
  halo: THREE.Color
  fog: THREE.Color
  sunDir: THREE.Vector3
  sunPower: number
  sunLight: THREE.Color
  sunIntensity: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
  waterDeep: THREE.Color
  grassTip: number
  galaxy: number
  stars: number
  exposure: number
  fogDensity: number
}

type SkyKey = Omit<Look, 'sunDir' | 'mid' | 'halo'> & { mid?: THREE.Color; halo?: THREE.Color }

const SKY_KEYS: { hour: number; key: SkyKey }[] = [
  {
    hour: 0,
    key: {
      zenith: new THREE.Color('#01030a'),
      mid: new THREE.Color('#050a1a'),
      horizon: new THREE.Color('#0d1730'),
      sun: new THREE.Color('#7f97cc'),
      halo: new THREE.Color('#445c90'),
      fog: new THREE.Color('#060b16'),
      sunPower: 0.12,
      sunLight: new THREE.Color('#5b74b8'),
      sunIntensity: 0.42,
      hemiSky: new THREE.Color('#1b2950'),
      hemiGround: new THREE.Color('#070a10'),
      hemiIntensity: 0.44,
      waterDeep: new THREE.Color('#03060e'),
      grassTip: 0.52,
      galaxy: 1,
      stars: 1,
      exposure: 1.05,
      fogDensity: 0.0044,
    },
  },
  {
    hour: 5.2,
    key: {
      zenith: new THREE.Color('#0b1c33'),
      mid: new THREE.Color('#1c2a46'),
      horizon: new THREE.Color('#4a3a5e'),
      sun: new THREE.Color('#b98a86'),
      halo: new THREE.Color('#8c6278'),
      fog: new THREE.Color('#2b3242'),
      sunPower: 0.28,
      sunLight: new THREE.Color('#8f7f9e'),
      sunIntensity: 0.72,
      hemiSky: new THREE.Color('#3d4a6b'),
      hemiGround: new THREE.Color('#12161c'),
      hemiIntensity: 0.46,
      waterDeep: new THREE.Color('#070d14'),
      grassTip: 0.68,
      galaxy: 0.35,
      stars: 0.45,
      exposure: 1.0,
      fogDensity: 0.0038,
    },
  },
  {
    hour: 6.67,
    key: {
      zenith: new THREE.Color('#1a4c5e'),
      mid: new THREE.Color('#4c7675'),
      horizon: new THREE.Color('#eab06c'),
      sun: new THREE.Color('#ffd094'),
      halo: new THREE.Color('#f2a866'),
      fog: new THREE.Color('#5a7266'),
      sunPower: 0.88,
      sunLight: new THREE.Color('#ffc98e'),
      sunIntensity: 1.85,
      hemiSky: new THREE.Color('#7ea396'),
      hemiGround: new THREE.Color('#1a2a1b'),
      hemiIntensity: 0.64,
      waterDeep: new THREE.Color('#0a1b18'),
      grassTip: 1.04,
      galaxy: 0,
      stars: 0,
      exposure: 0.96,
      fogDensity: 0.0025,
    },
  },
  {
    hour: 9.5,
    key: {
      zenith: new THREE.Color('#226898'),
      mid: new THREE.Color('#5ea3b6'),
      horizon: new THREE.Color('#cfe3df'),
      sun: new THREE.Color('#fff2d4'),
      halo: new THREE.Color('#ffdca4'),
      fog: new THREE.Color('#7d9a92'),
      sunPower: 1.05,
      sunLight: new THREE.Color('#fff0cf'),
      sunIntensity: 2.55,
      hemiSky: new THREE.Color('#a8c8c4'),
      hemiGround: new THREE.Color('#243424'),
      hemiIntensity: 0.82,
      waterDeep: new THREE.Color('#0d2420'),
      grassTip: 1.14,
      galaxy: 0,
      stars: 0,
      exposure: 0.98,
      fogDensity: 0.0019,
    },
  },
  {
    hour: 12.5,
    key: {
      zenith: new THREE.Color('#1e70b4'),
      mid: new THREE.Color('#64abcf'),
      horizon: new THREE.Color('#dfeae4'),
      sun: new THREE.Color('#fffaf0'),
      halo: new THREE.Color('#ffebc4'),
      fog: new THREE.Color('#8fa8a0'),
      sunPower: 1.2,
      sunLight: new THREE.Color('#fff8ea'),
      sunIntensity: 3.0,
      hemiSky: new THREE.Color('#bcd8d2'),
      hemiGround: new THREE.Color('#2c3c28'),
      hemiIntensity: 0.95,
      waterDeep: new THREE.Color('#102b27'),
      grassTip: 1.22,
      galaxy: 0,
      stars: 0,
      exposure: 1.0,
      fogDensity: 0.0016,
    },
  },
  {
    hour: 15.83,
    key: {
      zenith: new THREE.Color('#2c6294'),
      mid: new THREE.Color('#6f96aa'),
      horizon: new THREE.Color('#f0cf9a'),
      sun: new THREE.Color('#ffe6b4'),
      halo: new THREE.Color('#ffbe78'),
      fog: new THREE.Color('#8b8a72'),
      sunPower: 1.08,
      sunLight: new THREE.Color('#ffe1ae'),
      sunIntensity: 2.45,
      hemiSky: new THREE.Color('#b6bda0'),
      hemiGround: new THREE.Color('#2a2c1e'),
      hemiIntensity: 0.76,
      waterDeep: new THREE.Color('#12221c'),
      grassTip: 1.12,
      galaxy: 0,
      stars: 0,
      exposure: 0.98,
      fogDensity: 0.0022,
    },
  },
  {
    hour: 18.17,
    key: {
      zenith: new THREE.Color('#1f1840'),
      mid: new THREE.Color('#6b3a54'),
      horizon: new THREE.Color('#ff8e4f'),
      sun: new THREE.Color('#ffbf7c'),
      halo: new THREE.Color('#ff7a48'),
      fog: new THREE.Color('#8c5236'),
      sunPower: 1.12,
      sunLight: new THREE.Color('#ff9a5c'),
      sunIntensity: 1.95,
      hemiSky: new THREE.Color('#bd7d55'),
      hemiGround: new THREE.Color('#20140f'),
      hemiIntensity: 0.54,
      waterDeep: new THREE.Color('#150d13'),
      grassTip: 1.06,
      galaxy: 0,
      stars: 0.02,
      exposure: 0.98,
      fogDensity: 0.0031,
    },
  },
  {
    hour: 19.75,
    key: {
      zenith: new THREE.Color('#11183b'),
      mid: new THREE.Color('#2c2854'),
      horizon: new THREE.Color('#6b4a72'),
      sun: new THREE.Color('#c08a9e'),
      halo: new THREE.Color('#8c5e7c'),
      fog: new THREE.Color('#3a3350'),
      sunPower: 0.4,
      sunLight: new THREE.Color('#9a7fb0'),
      sunIntensity: 0.88,
      hemiSky: new THREE.Color('#4a4470'),
      hemiGround: new THREE.Color('#12121a'),
      hemiIntensity: 0.48,
      waterDeep: new THREE.Color('#0a0c18'),
      grassTip: 0.74,
      galaxy: 0.48,
      stars: 0.52,
      exposure: 1.02,
      fogDensity: 0.0036,
    },
  },
  {
    hour: 22.5,
    key: {
      zenith: new THREE.Color('#01030a'),
      mid: new THREE.Color('#060c1d'),
      horizon: new THREE.Color('#0d1730'),
      sun: new THREE.Color('#7f97cc'),
      halo: new THREE.Color('#4b6296'),
      fog: new THREE.Color('#060b16'),
      sunPower: 0.14,
      sunLight: new THREE.Color('#5b74b8'),
      sunIntensity: 0.44,
      hemiSky: new THREE.Color('#1b2950'),
      hemiGround: new THREE.Color('#070a10'),
      hemiIntensity: 0.44,
      waterDeep: new THREE.Color('#03060e'),
      grassTip: 0.52,
      galaxy: 1,
      stars: 1,
      exposure: 1.06,
      fogDensity: 0.0044,
    },
  },
]

/** 太阳沿真实弧线运行：06:00 东升、12:15 中天、18:30 西落，之后换成月亮。 */
export function sunDirection(hour: number): THREE.Vector3 {
  const dir = sunDirectionCoords(hour)
  return new THREE.Vector3(dir.x, dir.y, dir.z)
}

export function makeLookAt(hour: number): Look {
  const h = ((hour % 24) + 24) % 24
  let from = SKY_KEYS[0]
  let to = SKY_KEYS[SKY_KEYS.length - 1]
  for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
    if (h >= SKY_KEYS[i].hour && h <= SKY_KEYS[i + 1].hour) {
      from = SKY_KEYS[i]
      to = SKY_KEYS[i + 1]
      break
    }
  }
  const span = to.hour - from.hour
  const t = span > 0 ? (h - from.hour) / span : 0
  const mix = (a: number, b: number) => a + (b - a) * t
  const col = (a: THREE.Color, b: THREE.Color) => a.clone().lerp(b, t)
  const fromMid = from.key.mid ?? from.key.zenith.clone().lerp(from.key.horizon, 0.42)
  const toMid = to.key.mid ?? to.key.zenith.clone().lerp(to.key.horizon, 0.42)
  const fromHalo = from.key.halo ?? from.key.sun.clone().lerp(from.key.horizon, 0.35)
  const toHalo = to.key.halo ?? to.key.sun.clone().lerp(to.key.horizon, 0.35)
  return {
    zenith: col(from.key.zenith, to.key.zenith),
    mid: col(fromMid, toMid),
    horizon: col(from.key.horizon, to.key.horizon),
    sun: col(from.key.sun, to.key.sun),
    halo: col(fromHalo, toHalo),
    fog: col(from.key.fog, to.key.fog),
    sunDir: sunDirection(h),
    sunPower: mix(from.key.sunPower, to.key.sunPower),
    sunLight: col(from.key.sunLight, to.key.sunLight),
    sunIntensity: mix(from.key.sunIntensity, to.key.sunIntensity),
    hemiSky: col(from.key.hemiSky, to.key.hemiSky),
    hemiGround: col(from.key.hemiGround, to.key.hemiGround),
    hemiIntensity: mix(from.key.hemiIntensity, to.key.hemiIntensity),
    waterDeep: col(from.key.waterDeep, to.key.waterDeep),
    grassTip: mix(from.key.grassTip, to.key.grassTip),
    galaxy: mix(from.key.galaxy, to.key.galaxy),
    stars: mix(from.key.stars, to.key.stars),
    exposure: mix(from.key.exposure, to.key.exposure),
    fogDensity: mix(from.key.fogDensity, to.key.fogDensity),
  }
}

const STAGE_HOUR: Record<SkyStage, number> = { 0: 6.67, 1: 18.17, 2: 22.5 }
export function makeLook(stage: SkyStage): Look {
  return makeLookAt(STAGE_HOUR[stage])
}

function makeBlankTexture(rgba: [number, number, number, number]): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/** 生成 256×256 四通道无缝多倍频噪声纹理（GPU 与 CPU WindFX 共享同一阵风场） */
export function makeNoiseTexture() {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  let seed = 1234567
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

  for (let ch = 0; ch < 4; ch += 1) {
    const acc = new Float32Array(size * size)
    let amp = 0.5
    let norm = 0
    for (let oct = 0; oct < 5; oct += 1) {
      const p = 8 << oct
      const lat = new Float32Array(p * p)
      for (let i = 0; i < lat.length; i += 1) lat[i] = rnd()
      const cell = size / p
      for (let y = 0; y < size; y += 1) {
        const fy = y / cell
        const iy = Math.floor(fy)
        const ty = fy - iy
        const sy = ty * ty * (3 - 2 * ty)
        for (let x = 0; x < size; x += 1) {
          const fx = x / cell
          const ix = Math.floor(fx)
          const tx = fx - ix
          const sx = tx * tx * (3 - 2 * tx)
          const a = lat[(iy % p) * p + (ix % p)]
          const b = lat[(iy % p) * p + ((ix + 1) % p)]
          const c = lat[((iy + 1) % p) * p + (ix % p)]
          const d = lat[((iy + 1) % p) * p + ((ix + 1) % p)]
          acc[y * size + x] += amp * (a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy)
        }
      }
      norm += amp
      amp *= 0.5
    }
    let lo = 1e9
    let hi = -1e9
    for (let i = 0; i < acc.length; i += 1) {
      const v = acc[i] / norm
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    const range = Math.max(hi - lo, 1e-4)
    for (let i = 0; i < acc.length; i += 1) {
      data[i * 4 + ch] = Math.round(((acc[i] / norm - lo) / range) * 255)
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return { texture, data, size }
}

const DEFAULT_BLANK = makeBlankTexture([0, 0, 0, 255])
const DEFAULT_WAKE = makeBlankTexture([128, 128, 0, 255])

/** 引擎全局共享 Uniform 字典：每个 ShaderMaterial 通过 `shared(...)` 按需绑定 */
export const SHARED_UNIFORMS = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uCamXZ: { value: new THREE.Vector2() },
  uSunDir: { value: new THREE.Vector3(0.4, 0.5, -0.5).normalize() },
  uSunColor: { value: new THREE.Vector3(1.4, 1.1, 0.85) },
  uSunPower: { value: 0.88 },
  uSkyZenith: { value: new THREE.Vector3(0.02, 0.08, 0.14) },
  uSkyMid: { value: new THREE.Vector3(0.08, 0.19, 0.21) },
  uSkyHorizon: { value: new THREE.Vector3(0.84, 0.44, 0.16) },
  uSunHalo: { value: new THREE.Vector3(0.95, 0.55, 0.25) },
  uAmbSky: { value: new THREE.Vector3(0.24, 0.36, 0.34) },
  uAmbGround: { value: new THREE.Vector3(0.04, 0.06, 0.04) },
  uFogColor: { value: new THREE.Vector3(0.12, 0.18, 0.16) },
  uFog: { value: new THREE.Vector4(0.0025, 1 / 55, 0, 0) }, // x: density, y: heightFalloff, z: undergroundBlend
  uWaterDeep: { value: new THREE.Vector3(0.01, 0.03, 0.03) },
  uGalaxy: { value: 0 },
  uGalaxyBoost: { value: 0 },
  uStars: { value: 0 },
  uGrassTip: { value: 1 },

  // Terrain & Splat
  uHeightTex: { value: DEFAULT_BLANK as THREE.Texture },
  uSplatTex: { value: DEFAULT_BLANK as THREE.Texture },
  uNoiseTex: { value: DEFAULT_BLANK as THREE.Texture },
  // originX, originZ, span, 1/span
  uHeightRect: { value: new THREE.Vector4(-300, -342, 600, 1 / 600) },
  uWaterY: { value: LAKE.y },

  // Clouds
  uCloudTex: { value: DEFAULT_BLANK as THREE.Texture },
  uCloudReady: { value: 0 },

  // Wind & Wake
  // dirX, dirZ, strength, timeOffset
  uWind: { value: new THREE.Vector4(0.62, 0.78, 0.55, 0) },
  uWakeTex: { value: DEFAULT_WAKE as THREE.Texture },
  uWake: { value: new THREE.Vector4(0, 0, 1 / 72, 0) },
  uPlayerPos: { value: new THREE.Vector3() },
  uCursorPos: { value: new THREE.Vector3(999, 999, 999) },
  uClearStele: { value: new THREE.Vector4(14, -34, 1.55, 0) },
}

export type SharedUniformKey = keyof typeof SHARED_UNIFORMS

export function shared(...keys: SharedUniformKey[]): Record<string, THREE.IUniform> {
  const out: Record<string, THREE.IUniform> = {}
  for (const key of keys) {
    out[key] = SHARED_UNIFORMS[key]
  }
  return out
}

/** 将 Look 状态同步到全局共享 Uniform，驱动所有材质实时切换晨昏 */
export function syncLookUniforms(
  look: Look,
  underground = false,
  undergroundFog?: THREE.Color,
  undergroundDensity = 0.012,
) {
  const U = SHARED_UNIFORMS
  if (underground && undergroundFog) {
    U.uFogColor.value.set(undergroundFog.r, undergroundFog.g, undergroundFog.b)
    U.uFog.value.set(undergroundDensity, 0, 1, 0)
    return
  }

  U.uSunDir.value.copy(look.sunDir)
  // 线性 HDR 主光强度增益，配合 acesFilm 展现高光层次而不丢失暗部
  const hdrScale = 1.25 + look.sunPower * 0.45
  U.uSunColor.value.set(look.sunLight.r * hdrScale, look.sunLight.g * hdrScale, look.sunLight.b * hdrScale)
  U.uSunPower.value = look.sunPower

  U.uSkyZenith.value.set(look.zenith.r, look.zenith.g, look.zenith.b)
  U.uSkyMid.value.set(look.mid.r, look.mid.g, look.mid.b)
  U.uSkyHorizon.value.set(look.horizon.r, look.horizon.g, look.horizon.b)
  U.uSunHalo.value.set(look.halo.r, look.halo.g, look.halo.b)

  const ambScale = 0.65 + look.hemiIntensity * 0.45
  U.uAmbSky.value.set(look.hemiSky.r * ambScale, look.hemiSky.g * ambScale, look.hemiSky.b * ambScale)
  U.uAmbGround.value.set(
    look.hemiGround.r * (0.9 + look.hemiIntensity * 0.3),
    look.hemiGround.g * (0.9 + look.hemiIntensity * 0.3),
    look.hemiGround.b * (0.9 + look.hemiIntensity * 0.3),
  )

  U.uFogColor.value.set(look.fog.r, look.fog.g, look.fog.b)
  U.uFog.value.set(look.fogDensity, 1 / 52, 0, 0)
  U.uWaterDeep.value.set(look.waterDeep.r, look.waterDeep.g, look.waterDeep.b)
  U.uGrassTip.value = look.grassTip
  U.uGalaxy.value = look.galaxy
  U.uStars.value = look.stars
}

/** 创建预设视角的理想相机位置与焦点 */
export function getCameraPreset(target: FocusTarget) {
  const homeY = heightAt(CAMERA_HOME.x, CAMERA_HOME.z) + EYE_HEIGHT
  const flowerBase = new THREE.Vector3(-3.8, heightAt(-3.8, -8.5), -8.5)
  const windBase = new THREE.Vector3(10, heightAt(10, -30), -30)

  if (target === 'flower') {
    return {
      pos: new THREE.Vector3(flowerBase.x + 0.5, flowerBase.y + 1.72, flowerBase.z + 1.25),
      look: new THREE.Vector3(flowerBase.x, flowerBase.y + 1.08, flowerBase.z),
      fov: 34,
    }
  }
  if (target === 'wind') {
    return {
      pos: new THREE.Vector3(windBase.x + 4.4, windBase.y + 3.0, windBase.z + 6.4),
      look: new THREE.Vector3(windBase.x, windBase.y + 2.2, windBase.z),
      fov: 46,
    }
  }
  if (target === 'sky') {
    const ridgeY = heightAt(30, -16)
    return {
      pos: new THREE.Vector3(30, ridgeY + 2.4, -16),
      look: new THREE.Vector3(-10, ridgeY + 52, -78),
      fov: 62,
    }
  }
  if (target === 'lake') {
    const shoreY = heightAt(8, -40)
    return {
      pos: new THREE.Vector3(8, shoreY + 3.2, -40),
      look: new THREE.Vector3(-44, -5, -78),
      fov: 56,
    }
  }
  if (target === 'shore') {
    const rimY = heightAt(30, -58)
    return {
      pos: new THREE.Vector3(30, rimY + 3.2, -58),
      look: new THREE.Vector3(-30, -5, -92),
      fov: 58,
    }
  }
  if (target === 'dandelion') {
    return {
      pos: new THREE.Vector3(6.5, heightAt(6.5, -14) + 2.35, -14),
      look: new THREE.Vector3(-14, heightAt(-14, -36) + 3.2, -36),
      fov: 50,
    }
  }
  if (target === 'fireflies') {
    return {
      pos: new THREE.Vector3(-6, heightAt(-6, -18) + 2.1, -18),
      look: new THREE.Vector3(6, heightAt(6, -34) + 2.6, -34),
      fov: 52,
    }
  }
  if (target === 'tree') {
    return {
      pos: new THREE.Vector3(24, heightAt(24, -34) + 3.0, -34),
      look: new THREE.Vector3(15.5, heightAt(15.5, -24) + 3.6, -24),
      fov: 48,
    }
  }
  if (target === 'ruin') {
    return {
      pos: new THREE.Vector3(-26, heightAt(-26, -12) + 2.8, -12),
      look: new THREE.Vector3(-15.5, heightAt(-15.5, -23) + 3.2, -23),
      fov: 48,
    }
  }
  if (target === 'boat') {
    return {
      pos: new THREE.Vector3(-8.8, heightAt(-8.8, -30.4) + 2.35, -30.4),
      look: new THREE.Vector3(-17.8, LAKE.y + 0.55, -40.2),
      fov: 50,
    }
  }
  return {
    pos: new THREE.Vector3(0, homeY, 12),
    look: new THREE.Vector3(0, homeY - 0.75, -18),
    fov: 55,
  }
}
