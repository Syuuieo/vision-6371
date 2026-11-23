import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { QualityTier } from '../services/settings'
import { bakeCloudField } from './CloudBaker'
import { FLOWER_FRAG, FLOWER_VERT } from './flowerShaders'
import { WakeField } from './WakeField'
import { CLOUD_SHADOW, MEADOW_NOISE, MEADOW_TINT } from './meadowShaders'
import type { DescentEvent, FocusTarget, PickId, SkyStage } from '../types/sensor'

const LAKE = { x: -58, z: -96, rx: 74, rz: 52, y: -1.9 }
const ROAM = { minX: -78, maxX: 78, minZ: -118, maxZ: 34 }
const ROAM_CENTER = { x: 0, z: -42 }
const ROAM_RADIUS = 96
const EYE_HEIGHT = 1.72

const PLACES = [
  { name: '轻舟渡口', x: -25.5, z: -49.5, radius: 16 },
  { name: '孤树山坡', x: 15.5, z: -24, radius: 22 },
  { name: '石拱谷地', x: -15.5, z: -23, radius: 22 },
  { name: '晨雾草甸', x: -3.8, z: -8.5, radius: 20 },
  { name: '湖东高岸', x: 8, z: -40, radius: 14 },
  { name: '东南雨岸', x: 30, z: -58, radius: 16 },
  { name: '东脊星野', x: 30, z: -16, radius: 14 },
]
const CAMERA_HOME = new THREE.Vector3(0, 0, 12)

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeInCubic = (t: number) => t * t * t
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

function heightAt(x: number, z: number) {
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
  return h
}

function makeGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.22, 'rgba(255,255,255,0.75)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.16)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeContactShadowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.92)')
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.55)')
    gradient.addColorStop(0.8, 'rgba(255,255,255,0.18)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeFoliageTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    let seed = 1337
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < 28; i += 1) {
      const a = rand() * Math.PI * 2
      const d = Math.pow(rand(), 0.7) * 34
      const cx = size / 2 + Math.cos(a) * d
      const cy = size / 2 + Math.sin(a) * d
      const rx = 11 + rand() * 11
      const ry = 7 + rand() * 8
      const rot = rand() * Math.PI
      const shade = 215 + Math.floor(rand() * 40)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.fillStyle = `rgb(${shade}, ${Math.min(255, shade + 10)}, ${shade - 12})`
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** 可无缝平铺的周期性值噪声，用于地面细节贴图。 */
function makeTileableNoise(size: number, lattice: number, seed: number) {
  const rand = (i: number, j: number) => {
    const n = Math.sin((i % lattice) * 127.1 + (j % lattice) * 311.7 + seed * 74.7) * 43758.5453
    return n - Math.floor(n)
  }
  const out = new Float32Array(size * size)
  const cell = size / lattice
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fx = x / cell
      const fy = y / cell
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      const tx = smoothstep(0, 1, fx - ix)
      const ty = smoothstep(0, 1, fy - iy)
      const a = rand(ix, iy)
      const b = rand(ix + 1, iy)
      const c = rand(ix, iy + 1)
      const d = rand(ix + 1, iy + 1)
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
    }
  }
  return out
}

function makeGroundTextures() {
  const size = 256
  const layers = [
    { data: makeTileableNoise(size, 8, 1.3), weight: 0.44 },
    { data: makeTileableNoise(size, 16, 5.1), weight: 0.28 },
    { data: makeTileableNoise(size, 32, 9.7), weight: 0.18 },
    { data: makeTileableNoise(size, 64, 13.4), weight: 0.1 },
  ]
  const height = new Float32Array(size * size)
  for (let i = 0; i < height.length; i += 1) {
    let v = 0
    for (const layer of layers) v += layer.data[i] * layer.weight
    height[i] = v
  }

  const albedoCanvas = document.createElement('canvas')
  albedoCanvas.width = size
  albedoCanvas.height = size
  const albedoCtx = albedoCanvas.getContext('2d')
  if (albedoCtx) {
    const image = albedoCtx.createImageData(size, size)
    for (let i = 0; i < height.length; i += 1) {
      const h = height[i]
      const shade = 0.72 + h * 0.5
      image.data[i * 4] = Math.min(255, shade * 252)
      image.data[i * 4 + 1] = Math.min(255, shade * 255)
      image.data[i * 4 + 2] = Math.min(255, shade * 238)
      image.data[i * 4 + 3] = 255
    }
    albedoCtx.putImageData(image, 0, 0)
    // 近景草茎笔触，九宫格重绘保证接缝连续
    albedoCtx.lineCap = 'round'
    let seed = 20261123
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let i = 0; i < 1400; i += 1) {
      const x = next() * size
      const y = next() * size
      const len = 2.5 + next() * 6
      const lean = (next() - 0.5) * 3.4
      const bright = next() > 0.45
      albedoCtx.strokeStyle = bright ? 'rgba(255,255,246,0.20)' : 'rgba(38,52,30,0.22)'
      albedoCtx.lineWidth = 0.7 + next() * 0.8
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          albedoCtx.beginPath()
          albedoCtx.moveTo(x + ox, y + oy)
          albedoCtx.lineTo(x + ox + lean, y + oy - len)
          albedoCtx.stroke()
        }
      }
    }
  }

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = size
  normalCanvas.height = size
  const normalCtx = normalCanvas.getContext('2d')
  if (normalCtx) {
    const image = normalCtx.createImageData(size, size)
    const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]
    const strength = 3.4
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength
        const len = Math.sqrt(dx * dx + dy * dy + 1)
        const i = (y * size + x) * 4
        image.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
        image.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
        image.data[i + 2] = (1 / len) * 0.5 * 255 + 127
        image.data[i + 3] = 255
      }
    }
    normalCtx.putImageData(image, 0, 0)
  }

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const roughCtx = roughCanvas.getContext('2d')
  if (roughCtx) {
    const image = roughCtx.createImageData(size, size)
    for (let i = 0; i < height.length; i += 1) {
      const v = (0.82 + (1 - height[i]) * 0.17) * 255
      image.data[i * 4] = v
      image.data[i * 4 + 1] = v
      image.data[i * 4 + 2] = v
      image.data[i * 4 + 3] = 255
    }
    roughCtx.putImageData(image, 0, 0)
  }

  const wrap = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 4
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
  return {
    map: wrap(albedoCanvas, true),
    normalMap: wrap(normalCanvas, false),
    roughnessMap: wrap(roughCanvas, false),
  }
}

function makeTaperedBranch(
  curve: THREE.CatmullRomCurve3,
  rStart: number,
  rEnd: number,
  tubularSegments = 20,
  radialSegments = 9,
) {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const ringCount = tubularSegments + 1
  const vertsPerRing = radialSegments + 1
  const center = new THREE.Vector3()
  const offset = new THREE.Vector3()

  for (let i = 0; i < ringCount; i += 1) {
    const t = i / tubularSegments
    curve.getPointAt(t, center)
    const radius = rStart + (rEnd - rStart) * Math.pow(t, 0.85)
    for (let j = 0; j < vertsPerRing; j += 1) {
      const idx = i * vertsPerRing + j
      offset.set(pos.getX(idx) - center.x, pos.getY(idx) - center.y, pos.getZ(idx) - center.z)
      offset.multiplyScalar(radius)
      pos.setXYZ(idx, center.x + offset.x, center.y + offset.y, center.z + offset.z)
    }
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function makeSculptedBoulderGeo(seed: number) {
  const geo = new THREE.IcosahedronGeometry(0.95, 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i)
    const n1 = Math.sin(v.x * 2.7 + seed) * Math.cos(v.y * 3.1 + seed * 1.4) * 0.17
    const n2 = Math.sin(v.z * 4.3 + v.x * 2.1 + seed * 0.7) * 0.08
    const n3 = Math.cos(v.y * 5.2 - v.z * 3.4 + seed) * 0.045
    v.multiplyScalar(1 + n1 + n2 + n3)
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.35
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const norm = geo.attributes.normal as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const baseCol = new THREE.Color('#242c36')
  const mossCol = new THREE.Color('#3d5244')
  const rimCol = new THREE.Color('#5a6b52')
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i += 1) {
    const ny = norm.getY(i)
    const mossMix = smoothstep(0.18, 0.72, ny)
    tmp.copy(baseCol).lerp(mossCol, mossMix)
    if (ny > 0.65) tmp.lerp(rimCol, (ny - 0.65) * 0.7)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

interface Look {
  zenith: THREE.Color
  horizon: THREE.Color
  sun: THREE.Color
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

type SkyKey = Omit<Look, 'sunDir'>

const SKY_KEYS: { hour: number; key: SkyKey }[] = [
  {
    hour: 0,
    key: {
      zenith: new THREE.Color('#01030a'),
      horizon: new THREE.Color('#0d1730'),
      sun: new THREE.Color('#7f97cc'),
      fog: new THREE.Color('#060b16'),
      sunPower: 0.1,
      sunLight: new THREE.Color('#5b74b8'),
      sunIntensity: 0.4,
      hemiSky: new THREE.Color('#1b2950'),
      hemiGround: new THREE.Color('#070a10'),
      hemiIntensity: 0.42,
      waterDeep: new THREE.Color('#03060e'),
      grassTip: 0.5,
      galaxy: 1,
      stars: 1,
      exposure: 1.02,
      fogDensity: 0.0046,
    },
  },
  {
    hour: 5.2,
    key: {
      zenith: new THREE.Color('#0b1c33'),
      horizon: new THREE.Color('#4a3a5e'),
      sun: new THREE.Color('#b98a86'),
      fog: new THREE.Color('#2b3242'),
      sunPower: 0.25,
      sunLight: new THREE.Color('#8f7f9e'),
      sunIntensity: 0.7,
      hemiSky: new THREE.Color('#3d4a6b'),
      hemiGround: new THREE.Color('#12161c'),
      hemiIntensity: 0.45,
      waterDeep: new THREE.Color('#070d14'),
      grassTip: 0.68,
      galaxy: 0.35,
      stars: 0.45,
      exposure: 0.98,
      fogDensity: 0.004,
    },
  },
  {
    hour: 6.67,
    key: {
      zenith: new THREE.Color('#1a4c5e'),
      horizon: new THREE.Color('#eab06c'),
      sun: new THREE.Color('#ffd094'),
      fog: new THREE.Color('#557065'),
      sunPower: 0.8,
      sunLight: new THREE.Color('#ffc98e'),
      sunIntensity: 1.7,
      hemiSky: new THREE.Color('#7ea396'),
      hemiGround: new THREE.Color('#1a2a1b'),
      hemiIntensity: 0.62,
      waterDeep: new THREE.Color('#0a1a17'),
      grassTip: 1.0,
      galaxy: 0,
      stars: 0,
      exposure: 0.92,
      fogDensity: 0.0026,
    },
  },
  {
    hour: 9.5,
    key: {
      zenith: new THREE.Color('#2f7fa8'),
      horizon: new THREE.Color('#cfe3e0'),
      sun: new THREE.Color('#fff2d4'),
      fog: new THREE.Color('#7d9a92'),
      sunPower: 1.0,
      sunLight: new THREE.Color('#fff0cf'),
      sunIntensity: 2.5,
      hemiSky: new THREE.Color('#a8c8c4'),
      hemiGround: new THREE.Color('#243424'),
      hemiIntensity: 0.8,
      waterDeep: new THREE.Color('#0d2320'),
      grassTip: 1.12,
      galaxy: 0,
      stars: 0,
      exposure: 0.95,
      fogDensity: 0.002,
    },
  },
  {
    hour: 12.5,
    key: {
      zenith: new THREE.Color('#2b86c4'),
      horizon: new THREE.Color('#dfeae4'),
      sun: new THREE.Color('#fffaf0'),
      fog: new THREE.Color('#8fa8a0'),
      sunPower: 1.15,
      sunLight: new THREE.Color('#fff8ea'),
      sunIntensity: 3.0,
      hemiSky: new THREE.Color('#bcd8d2'),
      hemiGround: new THREE.Color('#2c3c28'),
      hemiIntensity: 0.95,
      waterDeep: new THREE.Color('#102a26'),
      grassTip: 1.2,
      galaxy: 0,
      stars: 0,
      exposure: 0.98,
      fogDensity: 0.0016,
    },
  },
  {
    hour: 15.83,
    key: {
      zenith: new THREE.Color('#3a76a6'),
      horizon: new THREE.Color('#f0cf9a'),
      sun: new THREE.Color('#ffe6b4'),
      fog: new THREE.Color('#8b8a72'),
      sunPower: 1.05,
      sunLight: new THREE.Color('#ffe1ae'),
      sunIntensity: 2.35,
      hemiSky: new THREE.Color('#b6bda0'),
      hemiGround: new THREE.Color('#2a2c1e'),
      hemiIntensity: 0.74,
      waterDeep: new THREE.Color('#12211c'),
      grassTip: 1.1,
      galaxy: 0,
      stars: 0,
      exposure: 0.95,
      fogDensity: 0.0024,
    },
  },
  {
    hour: 18.17,
    key: {
      zenith: new THREE.Color('#241d46'),
      horizon: new THREE.Color('#ff8e4f'),
      sun: new THREE.Color('#ffbf7c'),
      fog: new THREE.Color('#8c5236'),
      sunPower: 1.05,
      sunLight: new THREE.Color('#ff9a5c'),
      sunIntensity: 1.85,
      hemiSky: new THREE.Color('#bd7d55'),
      hemiGround: new THREE.Color('#20140f'),
      hemiIntensity: 0.52,
      waterDeep: new THREE.Color('#150d13'),
      grassTip: 1.05,
      galaxy: 0,
      stars: 0.01,
      exposure: 0.94,
      fogDensity: 0.0034,
    },
  },
  {
    hour: 19.75,
    key: {
      zenith: new THREE.Color('#131a3e'),
      horizon: new THREE.Color('#6b4a72'),
      sun: new THREE.Color('#c08a9e'),
      fog: new THREE.Color('#3a3350'),
      sunPower: 0.35,
      sunLight: new THREE.Color('#9a7fb0'),
      sunIntensity: 0.85,
      hemiSky: new THREE.Color('#4a4470'),
      hemiGround: new THREE.Color('#12121a'),
      hemiIntensity: 0.46,
      waterDeep: new THREE.Color('#0a0c18'),
      grassTip: 0.72,
      galaxy: 0.45,
      stars: 0.5,
      exposure: 1.0,
      fogDensity: 0.0038,
    },
  },
  {
    hour: 22.5,
    key: {
      zenith: new THREE.Color('#01030a'),
      horizon: new THREE.Color('#0d1730'),
      sun: new THREE.Color('#7f97cc'),
      fog: new THREE.Color('#060b16'),
      sunPower: 0.1,
      sunLight: new THREE.Color('#5b74b8'),
      sunIntensity: 0.4,
      hemiSky: new THREE.Color('#1b2950'),
      hemiGround: new THREE.Color('#070a10'),
      hemiIntensity: 0.42,
      waterDeep: new THREE.Color('#03060e'),
      grassTip: 0.5,
      galaxy: 1,
      stars: 1,
      exposure: 1.02,
      fogDensity: 0.0046,
    },
  },
]

/** 太阳沿真实弧线运行：06:00 东升、12:15 中天、18:30 西落，之后换成月亮。 */
function sunDirection(hour: number) {
  const day = (hour - 6) / 12.5
  if (day >= 0 && day <= 1) {
    const angle = day * Math.PI
    return new THREE.Vector3(-Math.cos(angle) * 0.85, Math.sin(angle) * 0.98 + 0.02, -0.5).normalize()
  }
  const night = ((hour - 18.5 + 24) % 24) / 11.5
  const angle = night * Math.PI
  return new THREE.Vector3(-Math.cos(angle) * 0.7, Math.sin(angle) * 0.62 + 0.03, -0.62).normalize()
}

function makeLookAt(hour: number): Look {
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
  return {
    zenith: col(from.key.zenith, to.key.zenith),
    horizon: col(from.key.horizon, to.key.horizon),
    sun: col(from.key.sun, to.key.sun),
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

export function sunArc(hour: number) {
  const dir = sunDirection(((hour % 24) + 24) % 24)
  return {
    altitude: Math.asin(clamp(dir.y, -1, 1)),
    azimuth: Math.atan2(dir.x, -dir.z),
    daylight: hour >= 6 && hour <= 18.5,
  }
}

function makeLook(stage: SkyStage): Look {
  return makeLookAt(STAGE_HOUR[stage])
}

const ATMOSPHERE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSunUv: { value: new THREE.Vector2(0.5, 0.5) },
    uSunGain: { value: 0 },
    uAspect: { value: 1 },
    uStrength: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunUv;
    uniform float uSunGain;
    uniform float uAspect;
    uniform float uStrength;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float r = length((vUv - 0.5) * vec2(uAspect, 1.0)) / 0.72;

      vec3 color = base.rgb;
      float blur = smoothstep(0.62, 1.3, r) * 0.0026 * uStrength;
      if (blur > 0.00005) {
        vec2 o = vec2(blur / uAspect, blur);
        vec3 acc = texture2D(tDiffuse, vUv + vec2(o.x, o.y)).rgb
                 + texture2D(tDiffuse, vUv + vec2(-o.x, o.y)).rgb
                 + texture2D(tDiffuse, vUv + vec2(o.x, -o.y)).rgb
                 + texture2D(tDiffuse, vUv + vec2(-o.x, -o.y)).rgb;
        color = mix(color, acc * 0.25, 0.8);
      }

      if (uSunGain > 0.001) {
        vec2 stride = (uSunUv - vUv) / 12.0;
        vec2 probe = vUv;
        float decay = 1.0;
        vec3 rays = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          probe += stride;
          vec3 s = texture2D(tDiffuse, clamp(probe, 0.0, 1.0)).rgb;
          float lum = dot(s, vec3(0.299, 0.587, 0.114));
          rays += s * smoothstep(0.7, 1.05, lum) * decay;
          decay *= 0.86;
        }
        color += rays / 12.0 * vec3(1.0, 0.84, 0.62) * uSunGain * 1.15;
      }

      color *= 1.0 - 0.14 * uStrength * smoothstep(0.55, 1.38, r);
      gl_FragColor = vec4(color, base.a);
    }
  `,
}

export interface HoverTargetInfo {
  id: PickId
  x: number
  y: number
  distance: number
}

export interface PrologueSceneOptions {
  onPick?: (id: PickId) => void
  onDescentEvent?: (event: DescentEvent) => void
  /** 湖面被轻划或点击时触发，用于播放实时水声 */
  onLakeRipple?: () => void
  onHoverTarget?: (info: HoverTargetInfo | null) => void
  onZoomChange?: (zoom: number) => void
  onSkimChange?: (amount: number) => void
  onPlaceChange?: (place: string) => void
  onBoundary?: () => void
}

interface BeaconHandle {
  group: THREE.Group
  halo: THREE.Sprite
  rings: THREE.Mesh[]
  core: THREE.Mesh
  beam: THREE.Mesh
  baseY: number
  active: number
}

interface PickHit {
  id: PickId
  point: THREE.Vector3
  object: THREE.Object3D
}

export class PrologueScene {
  private host: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2600)
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private atmosphere: ShaderPass | null = null
  private calmMotion = false
  private skim = 0
  private skimReported = 0
  private wake: WakeField | null = null
  private grassMaterials: THREE.ShaderMaterial[] = []
  private lastFrame = 0
  private raf: number | null = null
  private paused = false
  private disposed = false
  private isMobile = false
  private quality: QualityTier = 'auto'

  private get lowDetail(): boolean {
    if (this.quality === 'lite') return true
    if (this.quality === 'full') return false
    return this.isMobile
  }

  /** 省电档的脚步范围更小，避免走到草地边缘之外 */
  private get roamRadius(): number {
    return this.lowDetail ? 80 : ROAM_RADIUS
  }

  private inRoam(x: number, z: number): boolean {
    return Math.hypot(x - ROAM_CENTER.x, z - ROAM_CENTER.z) < this.roamRadius
  }

  private get pixelCap(): number {
    if (this.quality === 'lite') return 1.2
    if (this.quality === 'full') return 2
    return this.isMobile ? 1.6 : 2
  }

  private options: PrologueSceneOptions = {}
  private elapsed = 0
  private windLevel = 0.55
  private windTarget = 0.55

  private look = makeLook(0)
  private lookTarget = makeLook(0)

  private camPos = new THREE.Vector3()
  private lookCurrent = new THREE.Vector3()
  private yaw = 0
  private pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private fov = 55
  private fovTarget = 55
  private flight: {
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromLook: THREE.Vector3
    toLook: THREE.Vector3
    fromFov: number
    toFov: number
    time: number
    duration: number
    ease: (t: number) => number
  } | null = null

  private pointer = {
    down: false,
    id: -1,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    drag: 0,
  }
  private raycaster = new THREE.Raycaster()
  private pickables: THREE.Object3D[] = []
  private terrainMesh: THREE.Mesh | null = null

  private roamEnabled = false
  private keys = new Set<string>()
  private moveAxis = { x: 0, y: 0 }
  private lookAxis = { x: 0, y: 0 }
  private walkTarget: THREE.Vector3 | null = null
  private walkPhase = 0
  private walkMarker: { mesh: THREE.Mesh; age: number; active: boolean } | null = null
  private cursorWorld = new THREE.Vector3(999, 999, 999)
  private lastHoverCheck = 0
  private lastCursorCheck = 0
  private place = ''
  private lastPlaceCheck = 0
  private lastBoundaryReport = 0
  private mistUniforms: Record<string, THREE.IUniform> | null = null
  private hoverMotes: {
    points: THREE.Points
    positions: Float32Array
    alphas: Float32Array
    life: Float32Array
    velocities: Float32Array
    uniforms: Record<string, THREE.IUniform>
  } | null = null

  private rippleGroup = new THREE.Group()
  private ripples: { mesh: THREE.Mesh; age: number; delay: number; strength: number }[] = []
  private lastLakeHover = 0

  private rainGroup = new THREE.Group()
  private rainUniforms: Record<string, THREE.IUniform> = {}
  private rainIntensity = 0
  private rainTarget = 0

  private constellationGroup = new THREE.Group()
  private constellationStars: {
    core: THREE.Mesh
    halo: THREE.Sprite
    hit: THREE.Mesh
    index: number
    picked: boolean
    phase: number
  }[] = []
  private constellationLines: THREE.Mesh[] = []
  private constellationActive = false
  private constellationPicked = 0
  private constellationOrder: number[] = []

  private meteorGroup = new THREE.Group()
  private meteorTail: THREE.Line | null = null
  private meteorActive = false
  private meteorRunning = false
  private meteorCooldown = 7
  private meteorProgress = 0
  private meteorStart = new THREE.Vector3()
  private meteorEnd = new THREE.Vector3()

  private dandelion: {
    points: THREE.Points
    positions: Float32Array
    velocities: Float32Array
    life: Float32Array
    active: boolean
    uniforms: Record<string, THREE.IUniform>
  } | null = null

  private fireflies: {
    points: THREE.Points
    uniforms: Record<string, THREE.IUniform>
    level: number
    target: number
  } | null = null

  private surfaceGroup = new THREE.Group()
  private skyGroup = new THREE.Group()
  private undergroundGroup = new THREE.Group()
  private dustMote: { points: THREE.Points; uniforms: Record<string, THREE.IUniform> } | null = null
  private rockTunnel: THREE.Mesh | null = null
  private magmaGroup = new THREE.Group()
  private coreGroup = new THREE.Group()
  private magmaSparks: { points: THREE.Points; uniforms: Record<string, THREE.IUniform> } | null = null
  private coreSparks: THREE.Points | null = null
  private vehicle: THREE.Group | null = null
  private vehicleBeacon: { mesh: THREE.Mesh; glow: THREE.Sprite; light: THREE.PointLight } | null = null

  private grassUniforms: Record<string, THREE.IUniform> = {}
  private skyUniforms: Record<string, THREE.IUniform> = {}
  private waterUniforms: Record<string, THREE.IUniform> = {}
  private pollenUniforms: Record<string, THREE.IUniform> = {}
  private petalUniforms: Record<string, THREE.IUniform> = {}
  private starUniforms: Record<string, THREE.IUniform> = {}
  private magmaUniforms: Record<string, THREE.IUniform> = {}

  private sunLight = new THREE.DirectionalLight(0xffd3a0, 2.4)
  private hemiLight = new THREE.HemisphereLight(0xb8d8cf, 0x2e3a2a, 0.9)

  private beacons: Partial<Record<PickId, BeaconHandle>> = {}
  private activeTask: PickId | null = 'flower'
  private glowTexture: THREE.Texture | null = null
  private heroFlowerGlow: THREE.Sprite | null = null
  private focusRing: THREE.Group | null = null
  private focusRingProgress = 0
  private contactShadowSpecs: { x: number; z: number; radius: number; rz?: number; yaw?: number }[] = []
  private heroBloomMaterials: THREE.MeshStandardMaterial[] = []

  private callWave: { mesh: THREE.Mesh; age: number; active: boolean } | null = null
  private skyBirds: {
    group: THREE.Group
    radius: number
    speed: number
    angle: number
    baseY: number
    phase: number
    wings: [THREE.Mesh, THREE.Mesh]
  }[] = []
  private sanctuaryRuneMat: THREE.MeshBasicMaterial | null = null
  private sanctuaryRuneLevel = 0
  private coreAccretionGroup: THREE.Group | null = null
  private warpStreams: THREE.Group | null = null
  private lakeBoat: THREE.Group | null = null
  private vehicleCommsRing: THREE.Mesh | null = null

  private descent = {
    active: false,
    time: 0,
    startPos: new THREE.Vector3(),
    startLook: new THREE.Vector3(),
    startFov: 55,
    breached: false,
    mantle: false,
    core: false,
    arrived: false,
    lastTick: 0,
  }
  private undergroundLook = {
    fog: new THREE.Color('#0a0d12'),
    density: 0.03,
  }

  mount(host: HTMLElement, options: PrologueSceneOptions = {}) {
    this.host = host
    this.options = options
    this.isMobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches

    const renderer = new THREE.WebGLRenderer({
      antialias: !this.isMobile,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.pixelCap))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.setClearColor(0x04070a, 1)
    this.renderer = renderer

    const canvas = renderer.domElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
    host.appendChild(canvas)
    this.canvas = canvas

    this.scene.background = new THREE.Color('#04070a')
    this.scene.fog = new THREE.FogExp2(this.look.fog.getHex(), this.look.fogDensity)

    this.scene.add(this.surfaceGroup)
    this.scene.add(this.undergroundGroup)
    this.surfaceGroup.add(this.skyGroup)
    this.surfaceGroup.add(this.sunLight)
    this.surfaceGroup.add(this.hemiLight)
    this.surfaceGroup.add(new THREE.AmbientLight(0x2c4036, 0.45))
    this.surfaceGroup.add(this.rippleGroup)

    this.glowTexture = makeGlowTexture()

    this.buildSky()
    this.buildStars()
    this.buildMountains()
    this.buildTerrain()
    this.buildMistBoundary()
    this.buildWater()
    this.buildScenery()
    this.buildScatter()
    this.buildEasterEggs()
    this.buildGrass()
    this.buildFlowers()
    this.buildBeacons()
    this.buildPollen()
    this.buildPetals()
    this.buildDandelion()
    this.buildFireflies()
    this.buildHoverMotes()
    this.buildWalkMarker()
    this.buildCallWave()
    this.buildContactShadows()
    this.buildRain()
    this.buildConstellation()
    this.buildMeteor()
    this.buildUnderground()

    this.undergroundGroup.visible = false

    this.syncAngles()
    this.focusTarget('home', 0.01)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(this.scene, this.camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(host.clientWidth || 800, host.clientHeight || 600),
      this.lowDetail ? 0.34 : 0.44,
      0.62,
      0.84,
    )
    composer.addPass(bloom)
    const atmosphere = new ShaderPass(ATMOSPHERE_SHADER)
    atmosphere.enabled = !this.lowDetail && !this.calmMotion
    composer.addPass(atmosphere)
    composer.addPass(new OutputPass())
    this.composer = composer
    this.bloom = bloom
    this.atmosphere = atmosphere
    this.wake = new WakeField()
    this.grassUniforms.uWakeOrigin.value.set(-110, -152)
    this.grassUniforms.uWakeSpan.value = this.wake.span

    this.resize()

    this.attachEvents()
    this.applyLook()
    if (import.meta.env.DEV) {
      ;(window as unknown as { __prologue?: PrologueScene }).__prologue = this
    }
    this.loop()
  }

  setStage(stage: SkyStage, immediate = false) {
    this.lookTarget = makeLook(stage)
    this.meteorActive = stage === 2
    if (stage !== 2) this.hideMeteor()
    if (immediate) {
      this.look = makeLook(stage)
      this.applyLook()
    }
  }

  setClock(hour: number, immediate = false) {
    this.lookTarget = makeLookAt(hour)
    if (immediate) {
      this.look = makeLookAt(hour)
      this.applyLook()
    }
  }

  setActiveTask(task: PickId | null) {
    this.activeTask = task
  }

  setTuning(value: number) {
    this.windTarget = 0.72 + clamp(value, 0, 1) * 0.7
  }

  lockWind() {
    this.windTarget = 1.95
  }

  setFocusRing(progress: number | null) {
    if (!this.focusRing) return
    this.focusRing.visible = progress !== null
    if (progress === null) return
    this.focusRingProgress = progress
    this.focusRing.scale.setScalar(1.22 - progress * 0.22)
    this.focusRing.children.forEach((arc, i) => {
      const material = (arc as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = (i === 0 ? 0.3 : 0.2) + progress * 0.55
    })
  }

  collectFlower() {
    if (this.heroFlowerGlow) {
      const material = this.heroFlowerGlow.material as THREE.SpriteMaterial
      material.opacity = 1
    }
    this.petalUniforms.uBurst.value = 1
    this.petalUniforms.uOpacity.value = 1
  }

  captureGalaxy() {
    this.setStage(2)
    this.skyUniforms.uGalaxyBoost.value = 0.9
    this.starUniforms.uBoost.value = 1.25
  }

  focusTarget(target: FocusTarget, duration = 2.3) {
    if (this.descent.active) return
    this.walkTarget = null
    const preset = this.getPreset(target)
    this.fovTarget = preset.fov
    this.options.onZoomChange?.(55 / this.fovTarget)
    if (duration <= 0.02) {
      this.flight = null
      this.camPos.copy(preset.pos)
      this.lookCurrent.copy(preset.look)
      this.fov = preset.fov
      this.syncAngles()
      this.camera.position.copy(this.camPos)
      this.camera.lookAt(this.lookCurrent)
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
      this.camera.updateMatrixWorld()
      this.skyGroup.position.copy(this.camPos)
      return
    }
    this.flight = {
      fromPos: this.camPos.clone(),
      toPos: preset.pos.clone(),
      fromLook: this.lookCurrent.clone(),
      toLook: preset.look.clone(),
      fromFov: this.fov,
      toFov: preset.fov,
      time: 0,
      duration,
      ease: easeInOutCubic,
    }
  }

  triggerDescent() {
    if (this.descent.active) return
    this.descent.active = true
    this.descent.time = 0
    this.descent.startPos.copy(this.camPos)
    this.descent.startLook.copy(this.lookCurrent)
    this.descent.startFov = this.fov
    this.descent.breached = false
    this.descent.mantle = false
    this.descent.core = false
    this.descent.arrived = false
    this.descent.lastTick = -1
    this.flight = null
    this.walkTarget = null
    this.undergroundGroup.visible = false
    this.windTarget = 0.25
    this.roamEnabled = false
    this.keys.clear()
    this.options.onHoverTarget?.(null)
    this.rainTarget = 0
    this.meteorActive = false
    this.hideMeteor()
    this.setFireflyLevel(0)
    if (this.dandelion) {
      this.dandelion.active = false
      this.dandelion.points.visible = false
    }
    if (this.callWave) {
      this.callWave.active = false
      this.callWave.mesh.visible = false
    }
    this.setConstellationActive(false)
  }

  setRoamEnabled(enabled: boolean) {
    this.roamEnabled = enabled
    if (!enabled) {
      this.keys.clear()
      this.moveAxis.x = 0
      this.moveAxis.y = 0
      this.lookAxis.x = 0
      this.lookAxis.y = 0
      this.walkTarget = null
      this.options.onHoverTarget?.(null)
    }
  }

  setMoveAxis(x: number, y: number) {
    this.moveAxis.x = clamp(x, -1, 1)
    this.moveAxis.y = clamp(y, -1, 1)
    if (this.moveAxis.x !== 0 || this.moveAxis.y !== 0) this.walkTarget = null
  }

  setLookAxis(x: number, y: number) {
    this.lookAxis.x = clamp(x, -1, 1)
    this.lookAxis.y = clamp(y, -1, 1)
  }

  startRain() {
    this.rainTarget = 1
    this.rainGroup.visible = true
  }

  stopRain() {
    this.rainTarget = 0
  }

  blowDandelion(strength = 1) {
    const field = this.dandelion
    if (!field) return
    const originA = new THREE.Vector3(3.2, heightAt(3.2, -17.5) + 1.45, -17.5)
    const originB = new THREE.Vector3(11.4, heightAt(11.4, -20.5) + 1.65, -20.5)
    const count = field.life.length
    for (let i = 0; i < count; i += 1) {
      const origin = i % 2 === 0 ? originB : originA
      const spread = 3.2
      field.positions[i * 3] = origin.x + (Math.random() - 0.5) * spread
      field.positions[i * 3 + 1] = origin.y + (Math.random() - 0.35) * 1.2
      field.positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread
      const drift = 0.65 + Math.random() * 0.95
      field.velocities[i * 3] = (-2.6 - Math.random() * 2.4) * drift * strength
      field.velocities[i * 3 + 1] = (0.7 + Math.random() * 1.4) * drift * strength
      field.velocities[i * 3 + 2] = (-2.2 - Math.random() * 2.2) * drift * strength
      field.life[i] = 0.75 + Math.random() * 0.55
    }
    field.points.geometry.attributes.position.needsUpdate = true
    field.points.geometry.attributes.aLife.needsUpdate = true
    field.active = true
    field.points.visible = true
  }

  setFireflyLevel(level: number) {
    if (!this.fireflies) return
    this.fireflies.target = clamp(level / 3, 0, 1)
    if (level > 0) this.fireflies.points.visible = true
  }

  pulseSanctuaryRune(level: number) {
    this.sanctuaryRuneLevel = clamp(level, 0, 3)
    if (this.sanctuaryRuneMat) {
      this.sanctuaryRuneMat.opacity = Math.min(1, 0.35 + this.sanctuaryRuneLevel * 0.22)
    }
    if (level > 0) this.emitSkyCall()
  }

  emitSkyCall() {
    if (!this.callWave || this.descent.active) return
    const groundY = Math.max(LAKE.y + 0.15, heightAt(this.camPos.x, this.camPos.z) + 0.18)
    this.callWave.mesh.position.set(this.camPos.x, groundY, this.camPos.z)
    this.callWave.mesh.scale.setScalar(1)
    ;(this.callWave.mesh.material as THREE.MeshBasicMaterial).opacity = 0.78
    this.callWave.mesh.visible = true
    this.callWave.age = 0
    this.callWave.active = true
  }

  setConstellationActive(active: boolean) {
    if (!active) {
      this.clearConstellation()
      this.constellationActive = false
      this.constellationGroup.visible = false
      return
    }
    if (this.constellationActive) return
    this.constellationActive = true
    this.clearConstellation()
    this.createConstellationStars()
    this.constellationGroup.visible = true
    this.meteorActive = true
  }

  autoCompleteConstellation() {
    if (!this.constellationActive) return
    for (const star of this.constellationStars) {
      if (!star.picked) this.connectConstellation(star.index)
    }
  }

  captureSnapshot(): string | null {
    if (!this.renderer || this.disposed) return null
    try {
      if (this.composer) {
        this.composer.render()
      } else {
        this.renderer.render(this.scene, this.camera)
      }
      return this.renderer.domElement.toDataURL('image/jpeg', 0.84)
    } catch {
      return null
    }
  }

  resetToSurface() {
    this.descent.active = false
    this.descent.time = 0
    this.descent.arrived = false
    this.undergroundGroup.visible = false
    this.surfaceGroup.visible = true
    this.coreGroup.visible = false
    this.magmaGroup.visible = false
    this.skyGroup.visible = true
    this.roamEnabled = false
    this.keys.clear()
    this.walkTarget = null
    this.walkPhase = 0
    if (this.walkMarker) {
      this.walkMarker.active = false
      this.walkMarker.mesh.visible = false
    }
    if (this.callWave) {
      this.callWave.active = false
      this.callWave.mesh.visible = false
    }
    this.sanctuaryRuneLevel = 0
    this.options.onHoverTarget?.(null)
    this.clearRipples()
    this.clearConstellation()
    this.constellationActive = false
    this.constellationGroup.visible = false
    this.rainTarget = 0
    this.rainIntensity = 0
    if (this.rainUniforms.uOpacity) this.rainUniforms.uOpacity.value = 0
    this.rainGroup.visible = false
    this.meteorActive = false
    this.meteorGroup.visible = false
    this.meteorRunning = false
    if (this.hoverMotes) {
      this.hoverMotes.life.fill(0)
      this.hoverMotes.alphas.fill(0)
      this.hoverMotes.points.geometry.attributes.aAlpha.needsUpdate = true
    }
    if (this.dandelion) {
      this.dandelion.active = false
      this.dandelion.life.fill(0)
      this.dandelion.points.geometry.attributes.aLife.needsUpdate = true
      this.dandelion.points.visible = false
    }
    if (this.fireflies) {
      this.fireflies.level = 0
      this.fireflies.target = 0
      this.fireflies.uniforms.uLevel.value = 0
      this.fireflies.points.visible = false
    }
    this.scene.fog?.color.copy(this.look.fog)
    this.windLevel = 0.55
    this.windTarget = 0.55
    this.skyUniforms.uGalaxyBoost.value = 0
    this.starUniforms.uBoost.value = 1
    this.petalUniforms.uOpacity.value = 0
    this.petalUniforms.uBurst.value = 0
    this.magmaUniforms.uOpacity.value = 0
    if (this.dustMote) this.dustMote.uniforms.uOpacity.value = 0
    if (this.magmaSparks) this.magmaSparks.uniforms.uOpacity.value = 0
    this.magmaGroup.visible = false
    this.coreGroup.visible = false
    this.setStage(0, true)
    this.focusTarget('home', 0.02)
  }

  private clearConstellation() {
    for (const line of this.constellationLines) {
      this.constellationGroup.remove(line)
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    }
    this.constellationLines = []
    for (const star of this.constellationStars) {
      this.constellationGroup.remove(star.core, star.halo, star.hit)
      star.core.geometry.dispose()
      ;(star.core.material as THREE.Material).dispose()
      ;(star.halo.material as THREE.Material).dispose()
      ;(star.hit.material as THREE.Material).dispose()
      this.pickables = this.pickables.filter((item) => item !== star.hit)
    }
    this.constellationStars = []
    this.constellationPicked = 0
    this.constellationOrder = []
  }

  private createConstellationStars() {
    this.constellationGroup.visible = true
    this.camera.updateMatrixWorld()
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    const base = this.camera.position.clone().addScaledVector(forward, 175)
    const offsets = [
      new THREE.Vector3(-42, 16, 0),
      new THREE.Vector3(40, -3, 0),
      new THREE.Vector3(0, 58, 0),
    ]
    const colors = ['#ffe4b5', '#cfe1ff', '#ffd2df']
    offsets.forEach((offset, index) => {
      const position = base
        .clone()
        .addScaledVector(right, offset.x)
        .addScaledVector(up, offset.y)
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 12, 10),
        new THREE.MeshBasicMaterial({ color: colors[index] }),
      )
      core.position.copy(position)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: colors[index],
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      halo.position.copy(position)
      halo.scale.setScalar(8)
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(7.5, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      hit.position.copy(position)
      hit.userData.pick = `star${index + 1}`
      this.constellationGroup.add(core, halo, hit)
      this.pickables.push(hit)
      this.constellationStars.push({
        core,
        halo,
        hit,
        index,
        picked: false,
        phase: Math.random() * Math.PI * 2,
      })
    })
  }

  private connectConstellation(index: number) {
    if (!this.constellationActive) return
    const star = this.constellationStars.find((item) => item.index === index)
    if (!star || star.picked) return
    star.picked = true
    this.constellationPicked += 1
    star.halo.scale.setScalar(9.5)
    ;(star.halo.material as THREE.SpriteMaterial).opacity = 1
    const previousIndex = this.constellationOrder[this.constellationOrder.length - 1]
    if (previousIndex !== undefined) {
      const previous = this.constellationStars.find((item) => item.index === previousIndex)
      if (previous) this.drawConstellationLine(previous.core.position, star.core.position)
    }
    this.constellationOrder.push(index)
    if (this.constellationPicked >= this.constellationStars.length && this.constellationStars.length >= 3) {
      const first = this.constellationStars.find((item) => item.index === this.constellationOrder[0])
      if (first) this.drawConstellationLine(star.core.position, first.core.position)
      this.captureGalaxy()
    }
  }

  private drawConstellationLine(from: THREE.Vector3, to: THREE.Vector3) {
    const direction = to.clone().sub(from)
    const length = direction.length()
    if (length < 0.001) return
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, length, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#cfe1ff',
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    mesh.position.copy(from).add(to).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    this.constellationGroup.add(mesh)
    this.constellationLines.push(mesh)
  }

  private hideMeteor() {
    this.meteorRunning = false
    this.meteorGroup.visible = false
    this.meteorCooldown = 9 + Math.random() * 8
  }

  private launchMeteor() {
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    const start = this.camera.position
      .clone()
      .addScaledVector(forward, 240)
      .addScaledVector(right, (Math.random() - 0.5) * 80)
      .addScaledVector(up, 15 + Math.random() * 40)
    const side = Math.random() > 0.5 ? 1 : -1
    const end = start
      .clone()
      .addScaledVector(right, side * (80 + Math.random() * 70))
      .addScaledVector(up, -10 - Math.random() * 30)
    this.meteorStart.copy(start)
    this.meteorEnd.copy(end)
    this.meteorProgress = 0
    this.meteorRunning = true
    this.meteorGroup.visible = true
    this.meteorGroup.position.copy(start)
    const tailDirection = start.clone().sub(end).normalize()
    if (this.meteorTail) {
      const attribute = this.meteorTail.geometry.attributes.position as THREE.BufferAttribute
      attribute.setXYZ(0, 0, 0, 0)
      attribute.setXYZ(1, tailDirection.x * 26, tailDirection.y * 26, tailDirection.z * 26)
      attribute.needsUpdate = true
    }
  }

  private spawnRipple(point: THREE.Vector3, strength = 1) {
    for (let i = 0; i < 3; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: '#c8efe2',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), material)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(point.x, LAKE.y + 0.035, point.z)
      mesh.scale.setScalar(0.5)
      this.rippleGroup.add(mesh)
      this.ripples.push({ mesh, age: 0, delay: i * 0.12, strength })
    }
    if (this.ripples.length > 36) {
      const old = this.ripples.splice(0, this.ripples.length - 36)
      old.forEach((ripple) => {
        this.rippleGroup.remove(ripple.mesh)
        ripple.mesh.geometry.dispose()
        ;(ripple.mesh.material as THREE.Material).dispose()
      })
    }
  }

  private clearRipples() {
    this.ripples.forEach((ripple) => {
      this.rippleGroup.remove(ripple.mesh)
      ripple.mesh.geometry.dispose()
      ;(ripple.mesh.material as THREE.Material).dispose()
    })
    this.ripples = []
  }

  private buildWalkMarker() {
    const geometry = new THREE.RingGeometry(0.32, 0.44, 32)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      color: '#f2c28b',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.visible = false
    this.surfaceGroup.add(mesh)
    this.walkMarker = { mesh, age: 0, active: false }
  }

  private buildCallWave() {
    const geometry = new THREE.RingGeometry(0.45, 0.78, 64)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      color: '#f2c28b',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.visible = false
    this.surfaceGroup.add(mesh)
    this.callWave = { mesh, age: 0, active: false }
  }

  private triggerWalkMarker(point: THREE.Vector3) {
    if (!this.walkMarker) return
    this.walkMarker.mesh.position.set(point.x, heightAt(point.x, point.z) + 0.08, point.z)
    this.walkMarker.mesh.scale.setScalar(0.7)
    this.walkMarker.mesh.visible = true
    this.walkMarker.age = 0
    this.walkMarker.active = true
  }

  private buildDandelion() {
    const count = this.lowDetail ? 110 : 180
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const life = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      sizes[i] = 10 + Math.random() * 14
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const uniforms: Record<string, THREE.IUniform> = {
      uPixel: { value: Math.min(window.devicePixelRatio, this.pixelCap) },
      uMap: { value: this.glowTexture },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        uniform float uPixel;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPixel * (22.0 / max(1.0, -mv.z)), 2.0, 44.0 * uPixel);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vLife;
        void main() {
          if (vLife <= 0.01) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float alpha = tex.a * smoothstep(0.0, 0.35, vLife) * 0.92;
          gl_FragColor = vec4(vec3(1.0, 0.96, 0.84), alpha);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.visible = false
    this.surfaceGroup.add(points)
    this.dandelion = { points, positions, velocities, life, active: false, uniforms }
  }

  private buildFireflies() {
    const count = this.lowDetail ? 85 : 140
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const x = -18 + Math.random() * 44
      const z = -44 + Math.random() * 34
      positions[i * 3] = x
      positions[i * 3 + 1] = Math.max(LAKE.y + 0.6, heightAt(x, z) + 0.45 + Math.random() * 2.6)
      positions[i * 3 + 2] = z
      phases[i] = Math.random() * Math.PI * 2
      sizes[i] = 12 + Math.random() * 14
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uPixel: { value: Math.min(window.devicePixelRatio, this.pixelCap) },
      uMap: { value: this.glowTexture },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uLevel;
        uniform float uPixel;
        varying float vGlow;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.55 + aPhase) * 0.85;
          p.y += sin(uTime * 0.9 + aPhase * 1.7) * 0.45;
          p.z += cos(uTime * 0.48 + aPhase * 1.3) * 0.85;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 3.1), 2.0);
          vGlow = pulse * uLevel;
          gl_PointSize = clamp(aSize * uPixel * (26.0 / max(1.0, -mv.z)) * (0.65 + 0.55 * pulse), 2.0, 48.0 * uPixel);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vGlow;
        void main() {
          if (vGlow <= 0.01) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          vec3 col = mix(vec3(0.56, 0.96, 0.72), vec3(1.0, 0.92, 0.58), 0.35);
          gl_FragColor = vec4(col, tex.a * vGlow * 0.95);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.visible = false
    this.surfaceGroup.add(points)
    this.fireflies = { points, uniforms, level: 0, target: 0 }
  }

  private updateDandelion(dt: number) {
    const field = this.dandelion
    if (!field || !field.active) return
    let alive = false
    const count = field.life.length
    for (let i = 0; i < count; i += 1) {
      if (field.life[i] <= 0) continue
      alive = true
      field.life[i] = Math.max(0, field.life[i] - dt * 0.16)
      const sway = Math.sin(this.elapsed * 2.1 + i * 0.7) * 0.55
      field.positions[i * 3] += (field.velocities[i * 3] + sway) * dt
      field.positions[i * 3 + 1] += (field.velocities[i * 3 + 1] + Math.cos(this.elapsed * 1.8 + i) * 0.28) * dt
      field.positions[i * 3 + 2] += field.velocities[i * 3 + 2] * dt
      field.velocities[i * 3 + 1] *= 1 - dt * 0.18
    }
    field.points.geometry.attributes.position.needsUpdate = true
    field.points.geometry.attributes.aLife.needsUpdate = true
    if (!alive) {
      field.active = false
      field.points.visible = false
    }
  }

  private updateFireflies(dt: number) {
    const field = this.fireflies
    if (!field) return
    field.level += (field.target - field.level) * Math.min(1, dt * 1.8)
    field.uniforms.uTime.value = this.elapsed
    field.uniforms.uLevel.value = field.level
    if (field.target === 0 && field.level < 0.01) {
      field.level = 0
      field.points.visible = false
    }
  }

  private updateWalkMarker(dt: number) {
    const marker = this.walkMarker
    if (!marker || !marker.active) return
    marker.age += dt
    const t = marker.age / 1.1
    if (t >= 1) {
      marker.active = false
      marker.mesh.visible = false
      return
    }
    marker.mesh.scale.setScalar(0.7 + t * 1.4)
    ;(marker.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.72
  }

  private updateCallWave(dt: number) {
    const wave = this.callWave
    if (!wave || !wave.active) return
    wave.age += dt
    const t = wave.age / 2.4
    if (t >= 1) {
      wave.active = false
      wave.mesh.visible = false
      return
    }
    wave.mesh.scale.setScalar(1 + t * 43)
    const fade = 1 - t
    ;(wave.mesh.material as THREE.MeshBasicMaterial).opacity = fade * fade * 0.78
  }

  private updateHoverMotes(dt: number) {
    const motes = this.hoverMotes
    if (!motes) return
    let changed = false
    for (let i = 0; i < motes.life.length; i += 1) {
      if (motes.life[i] <= 0) continue
      motes.life[i] = Math.max(0, motes.life[i] - dt * 0.55)
      motes.positions[i * 3 + 1] += motes.velocities[i] * dt
      motes.velocities[i] *= 1 - dt * 0.7
      motes.alphas[i] = motes.life[i] * 0.9
      changed = true
    }
    if (changed) {
      motes.points.geometry.attributes.position.needsUpdate = true
      motes.points.geometry.attributes.aAlpha.needsUpdate = true
    }
  }

  private updateRipples(dt: number) {
    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      const ripple = this.ripples[i]
      ripple.age += dt
      const local = ripple.age - ripple.delay
      if (local < 0) continue
      const t = local / 1.7
      if (t >= 1) {
        this.rippleGroup.remove(ripple.mesh)
        ripple.mesh.geometry.dispose()
        ;(ripple.mesh.material as THREE.Material).dispose()
        this.ripples.splice(i, 1)
        continue
      }
      const material = ripple.mesh.material as THREE.MeshBasicMaterial
      ripple.mesh.scale.setScalar(0.6 + t * 3.4 * ripple.strength)
      material.opacity = (1 - t) * 0.45 * ripple.strength
    }
  }

  private updateRain(dt: number) {
    if (!this.rainGroup.visible && this.rainTarget === 0) return
    this.rainIntensity += (this.rainTarget - this.rainIntensity) * Math.min(1, dt * 1.8)
    if (this.rainUniforms.uTime) this.rainUniforms.uTime.value = this.elapsed
    if (this.rainUniforms.uOpacity) this.rainUniforms.uOpacity.value = this.rainIntensity
    this.rainGroup.position.copy(this.camera.position).add(new THREE.Vector3(0, 8, 0))
    if (this.rainTarget === 0 && this.rainIntensity < 0.015) {
      this.rainIntensity = 0
      this.rainGroup.visible = false
    }
  }

  private updateConstellation() {
    if (!this.constellationActive) return
    for (const star of this.constellationStars) {
      const twinkle = 0.82 + 0.18 * Math.sin(this.elapsed * 1.8 + star.phase)
      ;(star.halo.material as THREE.SpriteMaterial).opacity = (star.picked ? 1 : 0.7) * twinkle
      star.halo.scale.setScalar((star.picked ? 9.5 : 8) * twinkle)
      star.core.scale.setScalar(twinkle)
    }
  }

  private updateMeteor(dt: number) {
    if (!this.meteorActive) return
    if (!this.meteorRunning) {
      this.meteorCooldown -= dt
      if (this.meteorCooldown <= 0) this.launchMeteor()
      return
    }
    this.meteorProgress = Math.min(1, this.meteorProgress + dt / 1.5)
    const position = this.meteorStart.clone().lerp(this.meteorEnd, this.meteorProgress)
    this.meteorGroup.position.copy(position)
    if (this.meteorProgress >= 1) this.hideMeteor()
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) {
      this.stopLoop()
    } else {
      this.startLoop()
    }
  }

  setQuality(quality: QualityTier) {
    if (this.quality === quality) return
    this.quality = quality
    if (this.atmosphere) this.atmosphere.enabled = !this.lowDetail && !this.calmMotion
    if (!this.renderer) return
    const ratio = Math.min(window.devicePixelRatio, this.pixelCap)
    this.renderer.setPixelRatio(ratio)
    this.composer?.setPixelRatio(ratio)
    this.resize()
  }

  setCalmMotion(calm: boolean) {
    this.calmMotion = calm
    if (this.atmosphere) this.atmosphere.enabled = !this.lowDetail && !calm
  }

  resize() {
    if (!this.host || !this.renderer || !this.composer) return
    const width = this.host.clientWidth || window.innerWidth
    const height = this.host.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
    const pixelRatio = Math.min(window.devicePixelRatio, this.pixelCap)
    if (this.starUniforms.uPixel) this.starUniforms.uPixel.value = pixelRatio
    if (this.pollenUniforms.uPixel) this.pollenUniforms.uPixel.value = pixelRatio
    if (this.petalUniforms.uPixel) this.petalUniforms.uPixel.value = pixelRatio
    if (this.dustMote) this.dustMote.uniforms.uPixel.value = pixelRatio
    if (this.magmaSparks) this.magmaSparks.uniforms.uPixel.value = pixelRatio
    if (this.rainUniforms.uPixel) this.rainUniforms.uPixel.value = pixelRatio
    if (this.hoverMotes?.uniforms.uPixel) this.hoverMotes.uniforms.uPixel.value = pixelRatio
    if (this.dandelion?.uniforms.uPixel) this.dandelion.uniforms.uPixel.value = pixelRatio
    if (this.fireflies?.uniforms.uPixel) this.fireflies.uniforms.uPixel.value = pixelRatio
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.stopLoop()
    this.detachEvents()

    const disposeMaterial = (material: THREE.Material) => {
      const mapped = material as THREE.Material & { map?: THREE.Texture | null }
      mapped.map?.dispose()
      material.dispose()
    }
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) {
        material.forEach(disposeMaterial)
      } else if (material) {
        disposeMaterial(material)
      }
    })

    this.glowTexture?.dispose()
    this.composer?.dispose()
    this.bloom?.dispose()
    this.atmosphere?.dispose()
    this.renderer?.dispose()
    this.renderer?.forceContextLoss()
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }

    this.scene.clear()
    this.pickables = []
    this.skyBirds = []
    this.heroBloomMaterials = []
    this.sanctuaryRuneMat = null
    this.coreAccretionGroup = null
    this.warpStreams = null
    this.lakeBoat = null
    this.vehicleCommsRing = null
    this.wake?.dispose()
    this.wake = null
    this.grassMaterials = []
    const cloudTex = this.skyUniforms.uCloudTex?.value as THREE.Texture | undefined
    cloudTex?.dispose()
    this.glowTexture = null
    this.contactShadowSpecs = []
    this.skim = 0
    this.skimReported = 0
    this.options.onSkimChange?.(0)
    this.canvas = null
    this.renderer = null
    this.composer = null
    this.atmosphere = null
    this.host = null
  }

  // ---------------------------------------------------------------- build

  private buildSky() {
    const uniforms: Record<string, THREE.IUniform> = {
      uZenith: { value: this.look.zenith.clone() },
      uHorizon: { value: this.look.horizon.clone() },
      uSunColor: { value: this.look.sun.clone() },
      uSunDir: { value: this.look.sunDir.clone() },
      uSunPower: { value: this.look.sunPower },
      uGalaxy: { value: 0 },
      uGalaxyBoost: { value: 0 },
      uGalaxyColor: { value: new THREE.Color('#a4b3ef') },
      uCloudTex: { value: bakeCloudField(this.lowDetail ? { width: 512, height: 128 } : { width: 1024, height: 256 }) },
      uTime: { value: 0 },
    }
    this.skyUniforms = uniforms

    const material = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform vec3 uGalaxyColor;
        uniform float uSunPower;
        uniform float uGalaxy;
        uniform float uGalaxyBoost;
        uniform sampler2D uCloudTex;
        uniform float uTime;

        float hash13(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float noise3(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n000 = hash13(i);
          float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
          float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
          float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
          float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
          float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
          float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
          float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
          return mix(
            mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
            mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float value = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            value += amp * noise3(p);
            p *= 2.03;
            amp *= 0.5;
          }
          return value;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float up = max(dir.y, 0.0);
          float horizonBand = pow(clamp(1.0 - up / 0.24, 0.0, 1.0), 1.7);
          vec3 col = mix(uZenith, uHorizon, horizonBand * 0.97);
          col += uZenith * 0.1 * smoothstep(0.1, 0.7, up);
          col = mix(col * 0.3, col, smoothstep(-0.2, 0.012, dir.y));

          vec3 sunDir = normalize(uSunDir);
          float sd = max(dot(dir, sunDir), 0.0);
          float disc = smoothstep(0.9994, 0.99985, sd);
          float halo = pow(sd, 130.0) * 0.34 + pow(sd, 16.0) * 0.12;
          col += uSunColor * (halo * uSunPower);
          col += uSunColor * disc * uSunPower * 1.4;

          float cloud = fbm(vec3(dir.x * 2.4, dir.y * 6.5, dir.z * 2.4 + 4.0));
          float sunRayAngle = atan(dir.y - sunDir.y, dir.x - sunDir.x);
          float sunRay = 0.5 + 0.5 * sin(sunRayAngle * 9.0 + cloud * 4.2);
          float shaft = pow(sd, 12.0) * (0.35 + 0.65 * sunRay) * (0.45 + 0.55 * cloud) * smoothstep(-0.02, 0.28, dir.y);
          col += uSunColor * shaft * uSunPower * (1.0 - uGalaxy) * 0.22;

          vec2 cuv = dir.xz / max(dir.y + 0.34, 0.12) * 0.12 + vec2(uTime * 0.0021, uTime * 0.0013);
          vec4 cloudField = texture2D(uCloudTex, cuv);
          float deck = smoothstep(0.04, 0.6, cloudField.g) * smoothstep(0.0, 0.18, dir.y);
          float albedo = 0.55 + 0.45 * cloudField.r;
          float hg = 0.62 * (0.25 + 0.75 * pow(max(dot(dir, sunDir), 0.0), 6.0));
          vec3 lit = mix(uHorizon, uSunColor, 0.35 + 0.5 * hg) * (0.75 + 0.5 * cloudField.b);
          col = mix(col, lit * albedo, deck * (0.55 - 0.3 * uGalaxy) * (0.6 + 0.6 * uSunPower));
          float veil = smoothstep(0.1, 0.75, cloudField.a) * (1.0 - smoothstep(0.02, 0.3, dir.y));
          col = mix(col, lit * 0.92, veil * 0.22 * (1.0 - uGalaxy));
          float cloudBand = (1.0 - smoothstep(0.02, 0.17, abs(dir.y - 0.055))) * smoothstep(0.25, 0.7, cloud);
          col = mix(col, mix(vec3(0.95, 0.74, 0.56), vec3(0.82, 0.44, 0.4), 0.5) * (0.55 + 0.4 * uSunPower), cloudBand * 0.1 * (1.0 - uGalaxy));

          vec3 bandNormal = normalize(vec3(0.32, 0.62, 0.72));
          float band = 1.0 - smoothstep(0.0, 0.36, abs(dot(dir, bandNormal)));
          float core = 1.0 - smoothstep(0.0, 0.14, abs(dot(dir, bandNormal)));
          float dust = fbm(dir * 7.0 + vec3(2.0, 1.0, 0.0));
          float dust2 = fbm(dir * 19.0 + vec3(5.0));
          float gmask = smoothstep(-0.06, 0.32, dir.y);
          vec3 galaxy = uGalaxyColor * band * (0.08 + dust * 0.52) * (0.65 + uGalaxyBoost * 0.5);
          galaxy += vec3(0.5, 0.55, 0.9) * core * dust2 * 0.24 * (0.5 + uGalaxyBoost * 0.4);
          galaxy -= vec3(0.03, 0.025, 0.05) * band * smoothstep(0.35, 0.8, dust2) * 1.2;
          col += galaxy * uGalaxy * gmask * 0.66;

          float dither = (hash13(vec3(dir * 512.0)) - 0.5) / 255.0;
          gl_FragColor = vec4(col + dither, 1.0);
        }
      `,
    })

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), material)
    sphere.frustumCulled = false
    sphere.renderOrder = -10
    this.skyGroup.add(sphere)
  }

  private buildStars() {
    if (!this.glowTexture) return
    const count = this.lowDetail ? 2200 : 4200
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const bandNormal = new THREE.Vector3(0.32, 0.62, 0.72).normalize()
    const color = new THREE.Color()

    for (let i = 0; i < count; i += 1) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize()
      if (i % 3 === 0) {
        const d = dir.dot(bandNormal)
        dir.addScaledVector(bandNormal, -d * 0.82).normalize()
        dir.y = Math.abs(dir.y) * 0.9 + 0.02
        dir.normalize()
      }
      dir.multiplyScalar(760)
      positions[i * 3] = dir.x
      positions[i * 3 + 1] = dir.y
      positions[i * 3 + 2] = dir.z

      const tint = Math.random()
      if (tint > 0.86) color.set('#ffd7ad')
      else if (tint > 0.72) color.set('#bcd4ff')
      else color.set('#eef4ff')
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      sizes[i] = 0.6 + Math.pow(Math.random(), 2.6) * 3.4
      phases[i] = Math.random() * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uStars: { value: 0 },
      uBoost: { value: 1 },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    this.starUniforms = uniforms

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixel;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float twinkle = 0.62 + 0.38 * sin(uTime * (0.7 + fract(aPhase) * 1.9) + aPhase * 6.283);
          gl_PointSize = aSize * uPixel * (1300.0 / max(1.0, -mv.z));
          vAlpha = twinkle;
          vColor = aColor;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStars;
        uniform float uBoost;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          float flare = (1.0 - smoothstep(0.0, 0.5, abs(p.x) * 9.0)) * (1.0 - smoothstep(0.0, 0.5, abs(p.y) * 2.4));
          float alpha = (core * 0.85 + flare * 0.32) * vAlpha * uStars * uBoost;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = -4
    this.skyGroup.add(points)
  }

  private buildMountains() {
    const makeRidge = (
      radius: number,
      base: number,
      amplitude: number,
      valleyHex: string,
      slopeHex: string,
      peakHex: string,
      seed: number,
    ) => {
      const segments = 260
      const rows = 4
      const positions: number[] = []
      const colors: number[] = []
      const indices: number[] = []
      const cValley = new THREE.Color(valleyHex)
      const cSlope = new THREE.Color(slopeHex)
      const cPeak = new THREE.Color(peakHex)
      const tmp = new THREE.Color()

      for (let i = 0; i < segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2
        const n =
          Math.sin(angle * 3.1 + seed) * 0.5 +
          Math.sin(angle * 7.3 + seed * 2.2) * 0.28 +
          Math.sin(angle * 15.7 + seed * 4.1) * 0.16 +
          Math.sin(angle * 31.3 + seed * 7.7) * 0.1 +
          Math.sin(angle * 47.9 + seed * 11.3) * 0.06
        const top = base + (n * 0.5 + 0.5) * amplitude
        const ridgeWobble = Math.sin(angle * 5.0 + seed) * 7
        const r = radius + ridgeWobble

        for (let rIdx = 0; rIdx < rows; rIdx += 1) {
          const t = rIdx / (rows - 1)
          const radialPull = (1 - t) * 28
          const y = -40 + (top + 40) * Math.pow(t, 0.92)
          const rr = r - radialPull + Math.sin(angle * 11 + rIdx * 1.3 + seed) * 3.2
          const x = Math.cos(angle) * rr
          const z = Math.sin(angle) * rr
          positions.push(x, y, z)
          if (t < 0.55) {
            tmp.copy(cValley).lerp(cSlope, t / 0.55)
          } else {
            tmp.copy(cSlope).lerp(cPeak, (t - 0.55) / 0.45)
          }
          colors.push(tmp.r, tmp.g, tmp.b)
        }

        if (i < segments - 1) {
          const a = i * rows
          const b = (i + 1) * rows
          for (let rIdx = 0; rIdx < rows - 1; rIdx += 1) {
            indices.push(a + rIdx, b + rIdx, a + rIdx + 1, a + rIdx + 1, b + rIdx, b + rIdx + 1)
          }
        }
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        metalness: 0.02,
        side: THREE.DoubleSide,
        fog: true,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      this.surfaceGroup.add(mesh)
    }

    makeRidge(620, 32, 74, '#2c3d59', '#495b76', '#8d8790', 1.7)
    makeRidge(420, 22, 48, '#1f3042', '#334d58', '#687678', 3.4)
    makeRidge(310, 12, 28, '#15222b', '#243a3c', '#4a5a50', 6.1)
  }

  private buildTerrain() {
    const half = 450
    const centerZ = -42
    const segments = this.lowDetail ? 150 : 210
    const stride = segments + 1
    // 网格向漫游中心加密：近场约 0.5m 一格，远景放宽到 12m，顶点预算与均匀网格持平
    const warp = (t: number) => {
      const a = Math.abs(t)
      return Math.sign(t) * (0.12 * a + 0.88 * a * a * a) * half
    }

    const positions = new Float32Array(stride * stride * 3)
    const colors = new Float32Array(stride * stride * 3)
    const uvs = new Float32Array(stride * stride * 2)
    const indices: number[] = []
    const base = new THREE.Color()
    const underwaterColor = new THREE.Color('#1b2c28')

    for (let iz = 0; iz < stride; iz += 1) {
      const z = centerZ + warp((iz / segments) * 2 - 1)
      for (let ix = 0; ix < stride; ix += 1) {
        const x = warp((ix / segments) * 2 - 1)
        const y = heightAt(x, z)
        const i = iz * stride + ix
        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = z
        uvs[i * 2] = x / 6
        uvs[i * 2 + 1] = z / 6

        const variation = Math.sin(x * 0.11 + z * 0.07) * 0.04 + Math.cos(x * 0.045 - z * 0.09) * 0.03
        const lakeDX = (x - LAKE.x) / LAKE.rx
        const lakeDZ = (z - LAKE.z) / LAKE.rz
        const underwater = smoothstep(1.02, 0.6, Math.sqrt(lakeDX * lakeDX + lakeDZ * lakeDZ))
        base.setHSL(0.285 + variation, 0.33, 0.104 + y * 0.0045 + variation * 0.22)
        base.lerp(underwaterColor, underwater * 0.7)
        base.multiplyScalar(0.88 + smoothstep(-2, 5, y) * 0.18)
        colors[i * 3] = base.r
        colors[i * 3 + 1] = base.g
        colors[i * 3 + 2] = base.b
      }
    }
    for (let iz = 0; iz < segments; iz += 1) {
      for (let ix = 0; ix < segments; ix += 1) {
        const a = iz * stride + ix
        const b = a + 1
        const c = a + stride
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const textures = makeGroundTextures()
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      map: textures.map,
      normalMap: textures.normalMap,
      roughnessMap: textures.roughnessMap,
    })
    material.normalScale.set(0.85, 0.85)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    this.terrainMesh = mesh
    this.surfaceGroup.add(mesh)
  }

  private buildWater() {
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uZenith: { value: this.look.zenith.clone() },
      uHorizon: { value: this.look.horizon.clone() },
      uSunColor: { value: this.look.sun.clone() },
      uSunDir: { value: this.look.sunDir.clone() },
      uSunPower: { value: this.look.sunPower },
      uDeep: { value: this.look.waterDeep.clone() },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }
    this.waterUniforms = uniforms

    const material = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform vec3 uDeep;
        uniform float uSunPower;
        varying vec3 vWorld;
        #include <fog_pars_fragment>

        void main() {
          vec3 view = normalize(vWorld - cameraPosition);
          vec3 reflected = reflect(view, vec3(0.0, 1.0, 0.0));
          float up = clamp(reflected.y, 0.0, 1.0);
          vec3 sky = mix(uHorizon, uZenith, pow(up, 0.5));

          float ripple = sin(vWorld.x * 0.42 + uTime * 0.75) * 0.5
            + sin(vWorld.z * 0.31 - uTime * 0.52) * 0.4
            + sin((vWorld.x + vWorld.z) * 0.9 + uTime * 1.3) * 0.1;
          vec3 perturbed = normalize(reflected + vec3(ripple * 0.012, 0.0, ripple * 0.008));

          float fresnel = pow(1.0 - max(dot(-view, vec3(0.0, 1.0, 0.0)), 0.0), 2.6);
          vec3 col = mix(uDeep, sky, 0.22 + 0.5 * fresnel);
          col += vec3(0.015, 0.035, 0.032) * (0.5 + 0.5 * ripple);

          float spec = pow(max(dot(perturbed, normalize(uSunDir)), 0.0), 300.0);
          float glint = pow(max(dot(perturbed, normalize(uSunDir)), 0.0), 24.0) * 0.16;
          col += uSunColor * (spec * 3.4 + glint) * uSunPower;

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    })

    const geometry = new THREE.CircleGeometry(1, 96)
    const water = new THREE.Mesh(geometry, material)
    water.rotation.x = -Math.PI / 2
    water.scale.set(LAKE.rx * 1.12, LAKE.rz * 1.12, 1)
    water.position.set(LAKE.x, LAKE.y, LAKE.z)
    water.frustumCulled = false
    water.userData.pick = 'lake'
    this.pickables.push(water)
    this.surfaceGroup.add(water)
  }

  private buildGrass() {
    const height = this.bakeHeightTexture()
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uWind: { value: 0.55 },
      uSunColor: { value: new THREE.Color('#ffd3a0') },
      uAmbient: { value: new THREE.Color('#41564d') },
      uTip: { value: 1 },
      uPlayerPos: { value: new THREE.Vector3() },
      uCursorPos: { value: new THREE.Vector3(999, 999, 999) },
      uCamXZ: { value: new THREE.Vector2() },
      uCell: { value: 6 },
      uRadius: { value: 30 },
      uFade: { value: new THREE.Vector4(-1, 0, 25, 30) },
      uHeightTex: { value: height.texture },
      uHeightOrigin: { value: new THREE.Vector2(height.origin.x, height.origin.z) },
      uHeightSpan: { value: height.span },
      uWaterY: { value: LAKE.y + 0.35 },
      uSunDir: { value: this.look.sunDir.clone() },
      uSunPower: { value: this.look.sunPower },
      uGalaxy: { value: this.look.galaxy },
      uWakeTex: { value: new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1) },
      uWakeOrigin: { value: new THREE.Vector2(0, -42) },
      uWakeSpan: { value: 220 },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }
    this.grassUniforms = uniforms

    const vertexShader = /* glsl */ `
        attribute float aRand;
        attribute vec2 aCell;
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uWind;
        uniform vec3 uPlayerPos;
        uniform vec3 uCursorPos;
        uniform vec2 uCamXZ;
        uniform float uCell;
        uniform float uRadius;
        uniform vec4 uFade;
        uniform sampler2D uHeightTex;
        uniform vec2 uHeightOrigin;
        uniform float uHeightSpan;
        uniform float uWaterY;
        uniform sampler2D uWakeTex;
        uniform vec2 uWakeOrigin;
        uniform float uWakeSpan;
        varying float vH;
        varying float vClump;
        varying float vEdgeOn;
        varying vec2 vRootXZ;
        varying float vRand;
        varying vec3 vWorld;
        #include <fog_pars_vertex>

        ${MEADOW_NOISE}

        void main() {
          vH = uv.y;
          vRand = aRand;

          vec2 cellIndex = floor(uCamXZ / uCell) + aCell;
          vec2 jitter = hash2(cellIndex + aSeed.xy * 37.0);
          vec2 wrapped = (cellIndex + jitter) * uCell - uCamXZ;
          wrapped -= uRadius * 2.0 * round(wrapped / (uRadius * 2.0));
          vec2 xz = uCamXZ + wrapped;
          float dist = length(wrapped);

          float keep = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
          if (keep <= 0.002) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          vec4 packed = texture2D(uHeightTex, clamp((xz - uHeightOrigin) / uHeightSpan, 0.0, 1.0));
          float ground = -20.0 + ((packed.r * 65280.0 + packed.g * 255.0) / 65535.0) * 40.0;
          float cleared = smoothstep(0.28, 0.82, packed.b);
          float mask = 1.0 - cleared;
          if (mask <= 0.01 || ground < uWaterY) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          float hgt = (0.38 + pow(fract(aSeed.x * 3.71), 1.5) * 1.05) * keep * mask;
          float wid = (0.7 + fract(aSeed.y * 5.13) * 0.55) * keep;
          float yaw = aSeed.z * 6.2831853;
          float cs = cos(yaw);
          float sn = sin(yaw);
          vec2 clump = hash2(floor(xz / 0.75) + aSeed.xy * 1.7);
          vClump = clump.x;
          vRootXZ = xz;
          vec2 toEye = normalize(uCamXZ - xz + vec2(0.0001));
          vEdgeOn = abs(dot(vec2(cs, sn), toEye));
          wid *= mix(1.32, 1.0, vEdgeOn);
          vec3 p = position;
          p.xz *= wid;
          p.y *= hgt;
          p.xz = mat2(cs, -sn, sn, cs) * p.xz;

          vec3 world = vec3(xz.x + p.x, ground + p.y, xz.y + p.z);
          vec3 root = vec3(xz.x, ground, xz.y);

          float gust = 0.5 + 0.5 * sin(root.x * 0.021 - root.z * 0.017 + uTime * 0.55);
          float wave = sin(root.x * 0.16 + root.z * 0.12 + uTime * 1.9 + aRand * 6.283);
          float amp = (0.05 + 0.16 * uWind * gust) * (0.6 + aRand * 0.8);
          float bend = amp * vH * vH;
          world.x += wave * bend * 1.7;
          world.z += cos(root.x * 0.1 + uTime * 1.3 + aRand * 4.0) * bend;
          world.y -= bend * 0.35;

          vec2 toPlayer = world.xz - uPlayerPos.xz;
          float playerDist = length(toPlayer);
          float playerPush = (1.0 - smoothstep(0.35, 2.2, playerDist)) * 0.55;
          vec2 playerDir = playerDist > 0.001 ? toPlayer / playerDist : vec2(0.0);

          vec2 toCursor = world.xz - uCursorPos.xz;
          float cursorDist = length(toCursor);
          float cursorPush = (1.0 - smoothstep(0.25, 2.4, cursorDist)) * 0.48;
          vec2 cursorDir = cursorDist > 0.001 ? toCursor / cursorDist : vec2(0.0);

          vec2 wuv = (xz - uWakeOrigin) / uWakeSpan;
          vec2 wpush = (texture2D(uWakeTex, clamp(wuv, 0.0, 1.0)).rg - 0.5) * 2.0;
          world.xz += wpush * 0.75;
          float pushWeight = vH * vH;
          world.xz += (playerDir * playerPush + cursorDir * cursorPush) * pushWeight;
          world.y -= (playerPush + cursorPush) * 0.22 * pushWeight;

          vWorld = world;
          vec4 mvPosition = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `
    const fragmentShader = /* glsl */ `
        uniform vec3 uSunColor;
        uniform vec3 uAmbient;
        uniform float uTip;
        uniform vec3 uSunDir;
        uniform float uSunPower;
        uniform float uGalaxy;
        uniform float uTime;
        varying float vH;
        varying float vRand;
        varying vec3 vWorld;
        varying float vClump;
        varying float vEdgeOn;
        varying vec2 vRootXZ;
        #include <fog_pars_fragment>
        ${MEADOW_NOISE}
        ${MEADOW_TINT}
        ${CLOUD_SHADOW}
        void main() {
          vec3 tint = meadowTint(vRootXZ, vRand + vClump * 0.7, 0.55);
          vec3 root = mix(vec3(0.016, 0.034, 0.012), vec3(0.038, 0.066, 0.022), vRand) * tint;
          vec3 tip = mix(vec3(0.2, 0.38, 0.12), vec3(0.46, 0.56, 0.18), vRand) * uTip * tint;
          float h = clamp(vH, 0.0, 1.0);
          vec3 col = mix(root, tip, pow(h, 0.88));
          float daylight = 1.0 - smoothstep(0.25, 0.75, uGalaxy);
          float shade = cloudShadow(vRootXZ, uTime, daylight);
          float lightAmt = 0.24 + 0.5 * h;
          col = col * uAmbient * 1.15 + col * uSunColor * lightAmt * 0.8 * shade;
          float up = smoothstep(0.55, 1.0, h);
          col += uSunColor * up * (0.035 + 0.05 * vRand) * shade;
          float back = pow(max(dot(normalize(vWorld - cameraPosition), normalize(uSunDir + vec3(0.0001))), 0.0), 2.5);
          col += uSunColor * back * smoothstep(0.3, 1.0, h) * uSunPower * 0.18 * daylight;
          col *= mix(1.0, 0.82 + 0.18 * vEdgeOn, 0.5);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `

    const shells = [
      { key: 'near', cell: 6, per: 70, radius: 30, fade: [-1, 0, 25, 30], segs: 4, quality: 1 },
      { key: 'mid', cell: 16, per: 48, radius: 66, fade: [20, 28, 56, 66], segs: 3, quality: 1 },
      { key: 'far', cell: 44, per: 34, radius: 150, fade: [52, 64, 128, 150], segs: 2, quality: 0.55 },
    ] as const

    for (const shell of shells) {
      const reach = Math.ceil(shell.radius / shell.cell)
      const cells: [number, number][] = []
      for (let cz = -reach; cz <= reach; cz += 1) {
        for (let cx = -reach; cx <= reach; cx += 1) {
          cells.push([cx, cz])
        }
      }
      const per = Math.max(1, Math.round(shell.per * (this.lowDetail ? shell.quality * 0.55 : 1)))
      const count = cells.length * per
      const geometry = this.createBladeGeometry(shell.segs)
      const aCell = new Float32Array(count * 2)
      const aSeed = new Float32Array(count * 3)
      const randoms = new Float32Array(count)
      let index = 0
      for (const [cx, cz] of cells) {
        for (let slot = 0; slot < per; slot += 1) {
          aCell[index * 2] = cx
          aCell[index * 2 + 1] = cz
          aSeed[index * 3] = Math.random()
          aSeed[index * 3 + 1] = Math.random()
          aSeed[index * 3 + 2] = Math.random()
          randoms[index] = Math.random()
          index += 1
        }
      }
      geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(randoms, 1))
      geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2))
      geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 3))
      const shellMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          uCell: { value: shell.cell },
          uRadius: { value: shell.radius },
          uFade: { value: new THREE.Vector4(...shell.fade) },
        },
        fog: true,
        side: THREE.DoubleSide,
        vertexShader,
        fragmentShader,
      })
      const mesh = new THREE.InstancedMesh(geometry, shellMaterial, count)
      mesh.frustumCulled = false
      mesh.name = 'grass-' + shell.key
      this.grassMaterials.push(shellMaterial)
      this.surfaceGroup.add(mesh)
    }
  }

  private bakeHeightTexture() {
    const resolution = 512
    const span = 600
    const origin = { x: -span / 2, z: -42 - span / 2 }
    const data = new Uint8Array(resolution * resolution * 4)
    const texel = span / resolution
    for (let j = 0; j < resolution; j += 1) {
      const z = origin.z + ((j + 0.5) / resolution) * span
      for (let i = 0; i < resolution; i += 1) {
        const x = origin.x + ((i + 0.5) / resolution) * span
        const encoded = Math.round(Math.min(1, Math.max(0, (heightAt(x, z) + 20) / 40)) * 65535)
        const offset = (j * resolution + i) * 4
        data[offset] = Math.floor(encoded / 256)
        data[offset + 1] = encoded % 256
        const lakeDX = (x - LAKE.x) / (LAKE.rx * 1.02)
        const lakeDZ = (z - LAKE.z) / (LAKE.rz * 1.02)
        data[offset + 2] = lakeDX * lakeDX + lakeDZ * lakeDZ < 1 ? 255 : 0
        data[offset + 3] = 255
      }
    }

    const stamp = (x: number, z: number, radius: number) => {
      const minX = Math.max(0, Math.floor((x - radius - origin.x) / texel))
      const maxX = Math.min(resolution - 1, Math.ceil((x + radius - origin.x) / texel))
      const minZ = Math.max(0, Math.floor((z - radius - origin.z) / texel))
      const maxZ = Math.min(resolution - 1, Math.ceil((z + radius - origin.z) / texel))
      for (let j = minZ; j <= maxZ; j += 1) {
        const wz = origin.z + ((j + 0.5) / resolution) * span
        for (let i = minX; i <= maxX; i += 1) {
          const wx = origin.x + ((i + 0.5) / resolution) * span
          const d = Math.hypot(wx - x, wz - z)
          const falloff = d >= radius ? 0 : 255 * (1 - d / radius) * (1 - d / radius)
          const offset = (j * resolution + i) * 4
          data[offset + 2] = Math.max(data[offset + 2], Math.round(falloff))
        }
      }
      const ci = Math.min(resolution - 1, Math.max(0, Math.floor((x - origin.x) / texel)))
      const cj = Math.min(resolution - 1, Math.max(0, Math.floor((z - origin.z) / texel)))
      data[(cj * resolution + ci) * 4 + 2] = 255
    }

    this.contactShadowSpecs.forEach((spec) => {
      stamp(spec.x, spec.z, Math.max(0.5, spec.radius * 0.66))
    })
    stamp(-3.8, -8.5, 2.2)

    const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.UnsignedByteType)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    return { texture, origin, span }
  }

  private createBladeGeometry(segments = 4) {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const width = 0.042
    const bladeCount = 3

    for (let blade = 0; blade < bladeCount; blade += 1) {
      const rotation = blade * (Math.PI / 2)
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const baseIndex = positions.length / 3
      for (let s = 0; s <= segments; s += 1) {
        const t = s / segments
        const halfW = width * (1 - t * 0.92) * (1 + 0.35 * Math.sin(t * Math.PI))
        const bend = t * t * 0.24
        for (const side of [-1, 1]) {
          const lx = halfW * side
          const ly = t
          const lz = bend + (side === 1 ? 0.004 : 0)
          positions.push(lx * cos - lz * sin, ly, lx * sin + lz * cos)
          uvs.push(side === -1 ? 0 : 1, t)
        }
      }
      for (let s = 0; s < segments; s += 1) {
        const a = baseIndex + s * 2
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    return geometry
  }

  private buildFlowers() {
    const flowerBase = new THREE.Vector3(-3.8, heightAt(-3.8, -8.5), -8.5)
    const hero = new THREE.Group()
    hero.position.copy(flowerBase)
    hero.scale.setScalar(1)

    const stemMaterial = new THREE.MeshStandardMaterial({
      color: '#3b5331',
      roughness: 0.9,
      emissive: '#17220f',
      emissiveIntensity: 0.35,
    })
    const petalShape = new THREE.Shape()
    petalShape.moveTo(0, 0)
    petalShape.bezierCurveTo(0.06, 0.06, 0.065, 0.18, 0, 0.26)
    petalShape.bezierCurveTo(-0.065, 0.18, -0.06, 0.06, 0, 0)
    const petalGeometry = new THREE.ShapeGeometry(petalShape, 10)
    const petalColors = new Float32Array(petalGeometry.attributes.position.count * 3)
    const petalBase = new THREE.Color('#e6c7a1')
    const petalTip = new THREE.Color('#ffe3cd')
    for (let i = 0; i < petalGeometry.attributes.position.count; i += 1) {
      const t = Math.min(1, Math.max(0, petalGeometry.attributes.position.getY(i) / 0.26))
      const color = petalBase.clone().lerp(petalTip, t)
      petalColors[i * 3] = color.r
      petalColors[i * 3 + 1] = color.g
      petalColors[i * 3 + 2] = color.b
    }
    petalGeometry.setAttribute('color', new THREE.BufferAttribute(petalColors, 3))
    const petalMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      emissive: new THREE.Color('#ffb877'),
      emissiveIntensity: 0.2,
      roughness: 0.62,
      side: THREE.DoubleSide,
    })
    this.heroBloomMaterials.push(petalMaterial)
    const centerMaterial = new THREE.MeshStandardMaterial({
      color: '#ffbe68',
      emissive: new THREE.Color('#ff9a3c'),
      emissiveIntensity: 0.5,
      roughness: 0.4,
    })

    const heads = [
      { x: 0, z: 0, h: 1.02, scale: 1, tilt: -0.08, yaw: 0.35 },
      { x: 0.26, z: -0.12, h: 0.8, scale: 0.72, tilt: -0.32, yaw: 1.3 },
      { x: -0.23, z: 0.14, h: 0.72, scale: 0.58, tilt: -0.18, yaw: 2.5 },
    ]

    for (const head of heads) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.013, head.h, 5), stemMaterial)
      stem.position.set(head.x, head.h / 2, head.z)
      stem.rotation.z = head.x * 0.22
      stem.rotation.x = -head.z * 0.22
      hero.add(stem)

      const bloom = new THREE.Group()
      bloom.position.set(head.x, head.h, head.z)
      bloom.scale.setScalar(head.scale)
      bloom.rotation.set(head.tilt, head.yaw, 0)

      const petalPivot = (p: number, count: number, offset: number) => {
        const pivot = new THREE.Group()
        pivot.rotation.y = (p / count) * Math.PI * 2 + offset
        return pivot
      }
      for (let p = 0; p < 9; p += 1) {
        const pivot = petalPivot(p, 9, 0.2)
        const petal = new THREE.Mesh(petalGeometry, petalMaterial)
        petal.rotation.x = -Math.PI / 2 + 0.24
        petal.position.set(0, 0.018 + Math.sin(p * 2.4) * 0.008, -0.035)
        petal.scale.set(0.92, 1, 1)
        pivot.add(petal)
        bloom.add(pivot)
      }
      for (let p = 0; p < 5; p += 1) {
        const pivot = petalPivot(p, 5, 0.7)
        const petal = new THREE.Mesh(petalGeometry, petalMaterial)
        petal.rotation.x = -Math.PI / 2 + 0.6
        petal.position.set(0, 0.04, -0.02)
        petal.scale.set(0.55, 0.62, 1)
        pivot.add(petal)
        bloom.add(pivot)
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), centerMaterial)
      center.position.y = 0.05
      bloom.add(center)
      for (let s = 0; s < 7; s += 1) {
        const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), centerMaterial)
        const sa = (s / 7) * Math.PI * 2
        stamen.position.set(Math.cos(sa) * 0.035, 0.058, Math.sin(sa) * 0.035)
        bloom.add(stamen)
      }
      hero.add(bloom)
    }

    const leafMaterial = new THREE.MeshStandardMaterial({
      color: '#3d5d34',
      roughness: 0.9,
      side: THREE.DoubleSide,
    })
    for (let i = 0; i < 3; i += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), leafMaterial)
      leaf.scale.set(0.34, 0.05, 1.5)
      leaf.position.set(i === 0 ? 0.13 : -0.11, 0.32 + i * 0.1, i === 2 ? 0.1 : -0.06)
      leaf.rotation.set(0.2, i * 2.1, -0.35)
      hero.add(leaf)
    }

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ffd08f',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    glow.scale.setScalar(1.6)
    glow.position.set(0, 1.02, 0)
    hero.add(glow)
    this.heroFlowerGlow = glow

    const focusRing = new THREE.Group()
    focusRing.position.set(0, 1.02, 0)
    focusRing.rotation.x = -0.445
    focusRing.visible = false
    for (let i = 0; i < 2; i += 1) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.14 + i * 0.045, 0.0018, 6, 96, i === 0 ? Math.PI * 2 : Math.PI * 1.45),
        new THREE.MeshBasicMaterial({
          color: '#ffd9a3',
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      arc.rotation.z = i * 1.1
      focusRing.add(arc)
    }
    hero.add(focusRing)
    this.focusRing = focusRing

    const aura = new THREE.PointLight(0xffc78a, 0.8, 5, 2)
    aura.position.set(0, 1, 0)
    hero.add(aura)

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        color: '#000000',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.015
    hero.add(shadow)

    hero.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.userData.pick = 'flower'
      }
    })

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    hit.position.y = 0.8
    hit.userData.pick = 'flower'
    hero.add(hit)
    this.pickables.push(hit)

    this.surfaceGroup.add(hero)

    // 远景野花：相机跟随的两圈世界锚定花海，与草地共用高度图与清除遮罩
    const geometry = (() => {
      const positions: number[] = []
      const parts: number[] = []
      const locals: number[] = []
      const push = (x: number, y: number, z: number, part: number) => {
        positions.push(x, y, z)
        parts.push(part)
        locals.push(x, z)
      }
      push(-0.007, 0, 0, 0)
      push(0.007, 0, 0, 0)
      push(-0.005, 1, 0, 0)
      push(-0.005, 1, 0, 0)
      push(0.007, 0, 0, 0)
      push(0.005, 1, 0, 0)
      const rim = 6
      for (let i = 0; i < rim; i += 1) {
        const a0 = (i / rim) * Math.PI * 2
        const a1 = ((i + 1) / rim) * Math.PI * 2
        push(0, 1, 0, 1)
        push(Math.cos(a0) * 0.075, 1, Math.sin(a0) * 0.075, 1)
        push(Math.cos(a1) * 0.075, 1, Math.sin(a1) * 0.075, 1)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('aPart', new THREE.Float32BufferAttribute(parts, 1))
      geo.setAttribute('aLocal', new THREE.Float32BufferAttribute(locals, 2))
      return geo
    })()

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: this.grassUniforms.uTime,
      uCamXZ: this.grassUniforms.uCamXZ,
      uHeightTex: this.grassUniforms.uHeightTex,
      uHeightOrigin: this.grassUniforms.uHeightOrigin,
      uHeightSpan: this.grassUniforms.uHeightSpan,
      uWaterY: this.grassUniforms.uWaterY,
      uWakeTex: this.grassUniforms.uWakeTex,
      uWakeOrigin: this.grassUniforms.uWakeOrigin,
      uWakeSpan: this.grassUniforms.uWakeSpan,
      uSunColor: this.grassUniforms.uSunColor,
      uAmbient: this.grassUniforms.uAmbient,
      uSunPower: this.grassUniforms.uSunPower,
      uGalaxy: this.grassUniforms.uGalaxy,
      uCell: { value: 8 },
      uRadius: { value: 38 },
      uFade: { value: new THREE.Vector4(-1, 0, 30, 38) },
    }

    const shells = [
      { cell: 8, per: 11, radius: 38, fade: [-1, 0, 30, 38], quality: 1 },
      { cell: 22, per: 7, radius: 92, fade: [26, 36, 78, 92], quality: 0.5 },
    ] as const

    for (const shell of shells) {
      const reach = Math.ceil(shell.radius / shell.cell)
      const cells: [number, number][] = []
      for (let cz = -reach; cz <= reach; cz += 1) {
        for (let cx = -reach; cx <= reach; cx += 1) {
          if (Math.hypot(cx, cz) > reach) continue
          cells.push([cx, cz])
        }
      }
      const per = Math.max(1, Math.round(shell.per * (this.lowDetail ? shell.quality : 1)))
      const count = cells.length * per
      const aCell = new Float32Array(count * 2)
      const aSeed = new Float32Array(count * 3)
      let index = 0
      for (const [cx, cz] of cells) {
        for (let slot = 0; slot < per; slot += 1) {
          aCell[index * 2] = cx
          aCell[index * 2 + 1] = cz
          aSeed[index * 3] = Math.random()
          aSeed[index * 3 + 1] = Math.random()
          aSeed[index * 3 + 2] = Math.random()
          index += 1
        }
      }
      const shellGeometry = geometry.clone()
      shellGeometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2))
      shellGeometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 3))
      const material = new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          uCell: { value: shell.cell },
          uRadius: { value: shell.radius },
          uFade: { value: new THREE.Vector4(...shell.fade) },
        },
        vertexShader: FLOWER_VERT,
        fragmentShader: FLOWER_FRAG,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.InstancedMesh(shellGeometry, material, count)
      mesh.frustumCulled = false
      mesh.name = 'flower-' + shell.cell
      this.surfaceGroup.add(mesh)
    }
  }

  private buildScenery() {
    // 1. Ghibli / Sky Wind-Swept Sanctuary Tree with curved CatmullRom trunk + instanced leaf clusters
    const treePos = new THREE.Vector3(15.5, heightAt(15.5, -24), -24)
    this.contactShadowSpecs.push({ x: treePos.x, z: treePos.z, radius: 1.9 })
    const tree = new THREE.Group()
    tree.position.copy(treePos)
    const barkMat = new THREE.MeshStandardMaterial({
      color: '#3f2d21',
      roughness: 0.92,
      metalness: 0.04,
    })

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.25, 0),
      new THREE.Vector3(0.08, 1.4, -0.05),
      new THREE.Vector3(0.45, 3.0, -0.15),
      new THREE.Vector3(1.15, 4.7, -0.25),
    ])
    tree.add(new THREE.Mesh(makeTaperedBranch(trunkCurve, 0.44, 0.14, 24, 10), barkMat))

    // Root buttress flares hugging terrain slope
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.35
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.18, 0.65, Math.sin(a) * 0.18),
        new THREE.Vector3(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62),
        new THREE.Vector3(Math.cos(a) * 1.05, -0.22, Math.sin(a) * 1.05),
      ])
      tree.add(new THREE.Mesh(makeTaperedBranch(rootCurve, 0.18, 0.05, 10, 7), barkMat))
    }

    const branchCurves = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.42, 2.9, -0.14),
        new THREE.Vector3(1.4, 3.9, 0.32),
        new THREE.Vector3(2.35, 4.65, 0.48),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.32, 2.7, -0.1),
        new THREE.Vector3(-0.45, 3.85, -0.68),
        new THREE.Vector3(-0.95, 4.55, -1.05),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.76, 3.8, -0.2),
        new THREE.Vector3(1.25, 4.9, -0.82),
        new THREE.Vector3(1.75, 5.45, -1.15),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.68, 3.65, -0.18),
        new THREE.Vector3(0.25, 4.75, 0.65),
        new THREE.Vector3(-0.1, 5.25, 1.15),
      ]),
    ]
    const branchSpecs: [number, number][] = [
      [0.2, 0.045],
      [0.18, 0.042],
      [0.16, 0.038],
      [0.16, 0.04],
    ]
    branchCurves.forEach((curve, i) => {
      tree.add(new THREE.Mesh(makeTaperedBranch(curve, branchSpecs[i][0], branchSpecs[i][1], 14, 8), barkMat))
    })

    // Billowy InstancedMesh leaf-cluster canopy around branch tips
    const leafTex = makeFoliageTexture()
    const quadA = new THREE.PlaneGeometry(0.95, 0.95)
    const quadB = new THREE.PlaneGeometry(0.95, 0.95)
    quadB.rotateY(Math.PI / 2)
    // Combine two crossed planes manually into one BufferGeometry for crisp 3D depth per leaf cluster
    const posA = quadA.attributes.position.array as Float32Array
    const posB = quadB.attributes.position.array as Float32Array
    const uvA = quadA.attributes.uv.array as Float32Array
    const uvB = quadB.attributes.uv.array as Float32Array
    const idxA = Array.from(quadA.index!.array)
    const idxB = Array.from(quadB.index!.array).map((idx) => idx + 4)
    const leafClusterGeo = new THREE.BufferGeometry()
    const combinedPos = new Float32Array(posA.length + posB.length)
    combinedPos.set(posA, 0)
    combinedPos.set(posB, posA.length)
    const combinedUv = new Float32Array(uvA.length + uvB.length)
    combinedUv.set(uvA, 0)
    combinedUv.set(uvB, uvA.length)
    leafClusterGeo.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3))
    leafClusterGeo.setAttribute('uv', new THREE.BufferAttribute(combinedUv, 2))
    leafClusterGeo.setIndex([...idxA, ...idxB])
    leafClusterGeo.computeVertexNormals()
    quadA.dispose()
    quadB.dispose()

    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
      emissive: new THREE.Color('#2c3824'),
      emissiveIntensity: 0.32,
    })

    const crownCenters = [
      { pos: new THREE.Vector3(1.15, 5.15, -0.25), r: 1.65 },
      { pos: new THREE.Vector3(2.35, 4.8, 0.45), r: 1.25 },
      { pos: new THREE.Vector3(-0.85, 4.65, -0.95), r: 1.2 },
      { pos: new THREE.Vector3(1.65, 5.55, -1.05), r: 1.1 },
      { pos: new THREE.Vector3(-0.05, 5.25, 1.05), r: 1.1 },
    ]
    const clusterCount = this.lowDetail ? 160 : 240
    const foliageMesh = new THREE.InstancedMesh(leafClusterGeo, leafMat, clusterCount)
    const leafMatrix = new THREE.Matrix4()
    const leafQuat = new THREE.Quaternion()
    const leafScale = new THREE.Vector3()
    const leafPos = new THREE.Vector3()
    const leafEuler = new THREE.Euler()
    const cEmerald = new THREE.Color('#3a6b52')
    const cChartreuse = new THREE.Color('#789e64')
    const cGoldRim = new THREE.Color('#e0b468')
    const leafColor = new THREE.Color()

    for (let i = 0; i < clusterCount; i += 1) {
      const center = crownCenters[i % crownCenters.length]
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 1.7 - 0.7)
      const rad = Math.pow(Math.random(), 0.55) * center.r
      const lx = center.pos.x + Math.sin(phi) * Math.cos(theta) * rad
      const ly = center.pos.y + Math.cos(phi) * rad * 0.62
      const lz = center.pos.z + Math.sin(phi) * Math.sin(theta) * rad
      leafPos.set(lx, ly, lz)
      leafEuler.set(
        (Math.random() - 0.5) * 0.8,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.8,
      )
      leafQuat.setFromEuler(leafEuler)
      const s = 0.62 + Math.random() * 0.65
      leafScale.set(s, s * 0.88, s)
      leafMatrix.compose(leafPos, leafQuat, leafScale)
      foliageMesh.setMatrixAt(i, leafMatrix)

      const heightRatio = clamp((ly - 4.0) / 2.2, 0, 1)
      if (heightRatio < 0.62) {
        leafColor.copy(cEmerald).lerp(cChartreuse, heightRatio / 0.62)
      } else {
        leafColor.copy(cChartreuse).lerp(cGoldRim, (heightRatio - 0.62) / 0.38)
      }
      foliageMesh.setColorAt(i, leafColor)
    }
    foliageMesh.instanceMatrix.needsUpdate = true
    if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true
    tree.add(foliageMesh)

    // 2 detailed wood-framed hanging paper lanterns under limbs
    const lanternPaperMat = new THREE.MeshBasicMaterial({ color: '#ffdf9e' })
    const treeLanternCoords: [number, number, number][] = [
      [1.8, 3.85, 0.38],
      [-0.45, 3.7, -0.68],
    ]
    for (const [lx, ly, lz] of treeLanternCoords) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 5), barkMat)
      cord.position.set(lx, ly + 0.28, lz)
      tree.add(cord)

      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.05, 6), barkMat)
      capTop.position.set(lx, ly + 0.13, lz)
      tree.add(capTop)

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.22, 6), lanternPaperMat)
      drum.position.set(lx, ly, lz)
      tree.add(drum)

      const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.05, 6), barkMat)
      capBot.position.set(lx, ly - 0.13, lz)
      tree.add(capBot)

      if (this.glowTexture) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: '#ffd99a',
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        sprite.position.set(lx, ly, lz)
        sprite.scale.setScalar(1.45)
        tree.add(sprite)
      }
    }
    this.surfaceGroup.add(tree)

    // 2. Sculpted Sanctuary Stone Archway, Octagonal Temple Dais & Center Rune Stele
    const ruinX = -15.5
    const ruinZ = -23
    const ruin = new THREE.Group()
    ruin.position.set(ruinX, heightAt(ruinX, ruinZ) - 0.12, ruinZ)
    ruin.rotation.y = 0.48
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#323a48',
      roughness: 0.88,
      metalness: 0.06,
    })

    // 2-tier octagonal stepped dais
    const daisLower = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.55, 0.36, 8), stoneMat)
    daisLower.position.y = 0.18
    ruin.add(daisLower)
    const daisUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.96, 0.32, 8), stoneMat)
    daisUpper.position.y = 0.52
    ruin.add(daisUpper)

    // Fluted cylindrical stone columns with attic base rings & flared capitals
    for (const side of [-1, 1]) {
      const colX = side * 2.02
      const baseMolding = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 8, 18), stoneMat)
      baseMolding.rotation.x = Math.PI / 2
      baseMolding.position.set(colX, 0.72, 0)
      ruin.add(baseMolding)

      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 3.6, 14), stoneMat)
      col.position.set(colX, 2.52, 0)
      ruin.add(col)

      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.38, 0.38, 14), stoneMat)
      capital.position.set(colX, 4.46, 0)
      ruin.add(capital)
    }

    // Extruded beveled semicircular archway spanning across the columns
    const archShape = new THREE.Shape()
    archShape.absarc(0, 0, 2.62, 0, Math.PI, false)
    archShape.lineTo(-1.58, 0)
    archShape.absarc(0, 0, 1.58, Math.PI, 0, true)
    archShape.closePath()
    const archGeo = new THREE.ExtrudeGeometry(archShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
      curveSegments: 24,
    })
    archGeo.translate(0, 0, -0.36)
    const archMesh = new THREE.Mesh(archGeo, stoneMat)
    archMesh.position.set(0, 4.62, 0)
    ruin.add(archMesh)

    // Carved center Rune Stele standing on the temple dais
    const stelePlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.82, 0.36, 6), stoneMat)
    stelePlinth.position.set(0, 0.86, 0)
    ruin.add(stelePlinth)
    const stele = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.35, 6), stoneMat)
    stele.position.set(0, 2.2, 0)
    ruin.add(stele)

    const runeMat = new THREE.MeshBasicMaterial({
      color: '#f2c28b',
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.sanctuaryRuneMat = runeMat
    const runeVert = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.55), runeMat)
    runeVert.position.set(0, 2.25, 0.38)
    ruin.add(runeVert)
    const runeHalo = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 32), runeMat)
    runeHalo.position.set(0, 2.6, 0.39)
    ruin.add(runeHalo)
    this.surfaceGroup.add(ruin)
    this.contactShadowSpecs.push({ x: ruinX, z: ruinZ, radius: 5.8 })

    // 3. Lakeside Wooden Pier (with bollards & draped rope) + Gently Bobbing Wooden Rowboat
    const pier = new THREE.Group()
    pier.position.set(-22, LAKE.y + 0.16, -46)
    pier.rotation.y = Math.atan2(-58 - -22, -96 - -46)
    const woodMat = new THREE.MeshStandardMaterial({ color: '#4c3528', roughness: 0.9 })
    for (let i = 0; i < 8; i += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 0.44), woodMat)
      plank.position.set((Math.random() - 0.5) * 0.03, 0.05, -2.1 + i * 0.54)
      pier.add(plank)
    }
    const pilings: [number, number][] = [
      [-0.72, -1.5],
      [0.72, -1.5],
      [-0.72, 1.55],
      [0.72, 1.55],
    ]
    for (const [px, pz] of pilings) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 2.75, 8), woodMat)
      post.position.set(px, -0.92, pz)
      pier.add(post)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.11, 0.09, 8), woodMat)
      cap.position.set(px, 0.48, pz)
      pier.add(cap)
    }

    // Draped mooring rope between left bollards
    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.72, 0.42, -1.5),
      new THREE.Vector3(-0.72, 0.16, 0.0),
      new THREE.Vector3(-0.72, 0.42, 1.55),
    ])
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#8f7254', roughness: 0.95 })
    pier.add(new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 16, 0.024, 6, false), ropeMat))

    const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 2.35, 8), woodMat)
    lanternPost.position.set(0.74, 1.18, 1.6)
    pier.add(lanternPost)
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.74, 2.15, 1.6),
      new THREE.Vector3(0.56, 2.38, 1.6),
      new THREE.Vector3(0.38, 2.22, 1.6),
    ])
    pier.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.025, 6, false), woodMat))
    const pierLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.24, 6),
      new THREE.MeshBasicMaterial({ color: '#ffd699' }),
    )
    pierLantern.position.set(0.38, 2.08, 1.6)
    pier.add(pierLantern)
    if (this.glowTexture) {
      const pierGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: '#ffd699',
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      pierGlow.position.set(0.38, 2.08, 1.6)
      pierGlow.scale.setScalar(2.4)
      pier.add(pierGlow)
    }
    const pierLight = new THREE.PointLight(0xffcf87, 2.4, 16, 2)
    pierLight.position.set(0.38, 2.08, 1.6)
    pier.add(pierLight)
    this.surfaceGroup.add(pier)

    // Sculpted floating wooden rowboat beside the pier
    const boat = new THREE.Group()
    boat.position.set(-25.8, LAKE.y + 0.06, -49.5)
    boat.rotation.y = 0.72
    const boatHullMat = new THREE.MeshStandardMaterial({
      color: '#5a3c2a',
      roughness: 0.84,
      side: THREE.DoubleSide,
    })
    const hullProfile = [
      new THREE.Vector2(0.0, -0.14),
      new THREE.Vector2(0.45, -0.14),
      new THREE.Vector2(0.66, 0.06),
      new THREE.Vector2(0.72, 0.34),
      new THREE.Vector2(0.65, 0.34),
      new THREE.Vector2(0.56, 0.08),
      new THREE.Vector2(0.38, -0.07),
      new THREE.Vector2(0.0, -0.07),
    ]
    const hullGeo = new THREE.LatheGeometry(hullProfile, 24)
    hullGeo.scale(0.88, 1, 2.15)
    boat.add(new THREE.Mesh(hullGeo, boatHullMat))

    for (const bz of [-0.55, 0.2]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.24), woodMat)
      bench.position.set(0, 0.16, bz)
      boat.add(bench)
    }
    const oarGroup = new THREE.Group()
    oarGroup.position.set(0.18, 0.25, -0.1)
    oarGroup.rotation.set(0.04, 0.32, 0.06)
    const oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.1, 8), ropeMat)
    oarShaft.rotation.x = Math.PI / 2
    oarGroup.add(oarShaft)
    const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.56), woodMat)
    oarBlade.position.set(0, 0, 1.05)
    oarGroup.add(oarBlade)
    boat.add(oarGroup)
    this.lakeBoat = boat
    this.surfaceGroup.add(boat)

    // 4. Organic Eroded Vertex-Colored Moss Boulders & Sky Cairns
    const rockMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
    })
    const boulderVariants = [makeSculptedBoulderGeo(1.1), makeSculptedBoulderGeo(3.7), makeSculptedBoulderGeo(6.4)]
    const boulderSpecs: [number, number, number, number][] = [
      [-11.5, -14, 1.15, 0.72],
      [12.5, -19, 1.45, 0.92],
      [-18.5, -30, 1.7, 1.1],
      [18.5, -38, 2.1, 1.3],
      [-8.5, -36, 0.95, 0.65],
      [6.8, -26, 0.85, 0.58],
      [-23.5, -37, 1.35, 0.88],
      [21.0, -21, 1.6, 0.95],
      [16.2, -9.5, 1.1, 0.72],
      [-14.8, -8.0, 1.05, 0.68],
    ]
    boulderSpecs.forEach(([bx, bz, scaleXZ, scaleY], idx) => {
      const rock = new THREE.Mesh(boulderVariants[idx % boulderVariants.length], rockMat)
      rock.position.set(bx, heightAt(bx, bz) + scaleY * 0.24, bz)
      rock.scale.set(scaleXZ, scaleY, scaleXZ * 0.9)
      rock.rotation.set(bx * 0.14, bz * 0.35, bx * 0.08)
      this.surfaceGroup.add(rock)
      this.contactShadowSpecs.push({ x: bx, z: bz, radius: scaleXZ * 1.4 })
    })

    const cairnCoords: [number, number][] = [
      [9.5, -18],
      [-11, -34],
    ]
    for (const [cx, cz] of cairnCoords) {
      const cairn = new THREE.Group()
      cairn.position.set(cx, heightAt(cx, cz), cz)
      const tiers = [
        { y: 0.22, sXZ: 0.52, sY: 0.24 },
        { y: 0.54, sXZ: 0.36, sY: 0.19 },
        { y: 0.8, sXZ: 0.22, sY: 0.15 },
      ]
      tiers.forEach((tier, ti) => {
        const stone = new THREE.Mesh(boulderVariants[ti % boulderVariants.length], rockMat)
        stone.position.y = tier.y
        stone.scale.set(tier.sXZ, tier.sY, tier.sXZ * 0.88)
        stone.rotation.y = tier.y * 2.4
        cairn.add(stone)
      })
      this.surfaceGroup.add(cairn)
      this.contactShadowSpecs.push({ x: cx, z: cz, radius: 0.85 })
    }

    // 5. Soaring Light-Birds gliding above meadow & lake
    const wingGeo = new THREE.PlaneGeometry(0.55, 0.22)
    wingGeo.translate(0.275, 0, 0)
    const wingMat = new THREE.MeshBasicMaterial({
      color: '#fff3dc',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (let i = 0; i < 5; i += 1) {
      const birdGroup = new THREE.Group()
      const leftWing = new THREE.Mesh(wingGeo, wingMat)
      leftWing.rotation.x = Math.PI / 2
      leftWing.rotation.y = Math.PI
      const rightWing = new THREE.Mesh(wingGeo, wingMat)
      rightWing.rotation.x = Math.PI / 2
      birdGroup.add(leftWing)
      birdGroup.add(rightWing)
      if (this.glowTexture) {
        const birdGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: '#ffe6bd',
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        birdGlow.scale.setScalar(1.2)
        birdGroup.add(birdGlow)
      }
      this.surfaceGroup.add(birdGroup)
      this.skyBirds.push({
        group: birdGroup,
        radius: 18 + i * 5.2,
        speed: 0.11 + (i % 3) * 0.03,
        angle: (i / 5) * Math.PI * 2,
        baseY: 14 + i * 2.6,
        phase: i * 1.4,
        wings: [leftWing, rightWing],
      })
    }
  }

  private buildScatter() {
    const keepOut: [number, number, number][] = [
      [-3.8, -8.5, 3.6],
      [15.5, -24, 4.5],
      [-15.5, -23, 5.5],
      [-25.5, -49.5, 4.5],
      [-3.3, -7.25, 3],
      [8, -40, 3.5],
      [30, -58, 3.5],
      [24, -34, 3.5],
      [-26, -12, 3.5],
      [-14, -44, 3.5],
      [30, -16, 3.5],
    ]
    const placed: [number, number][] = []
    const spot = (minGap: number) => {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const x = ROAM.minX + Math.random() * (ROAM.maxX - ROAM.minX)
        const z = ROAM.minZ + Math.random() * (ROAM.maxZ - ROAM.minZ)
        const y = heightAt(x, z)
        if (y < LAKE.y + 0.55) continue
        if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue
        if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < minGap)) continue
        placed.push([x, z])
        return { x, y, z }
      }
      return null
    }

    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scale = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const tint = new THREE.Color()

    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.04 })
    const rockCount = this.lowDetail ? 34 : 76
    for (const [vi, seed] of [2.9, 8.1].entries()) {
      const geo = makeSculptedBoulderGeo(seed)
      const mesh = new THREE.InstancedMesh(geo, rockMat, rockCount)
      let n = 0
      for (let i = 0; i < rockCount; i += 1) {
        const s = spot(2.4)
        if (!s) continue
        const sxz = 0.2 + Math.pow(Math.random(), 1.6) * 0.52
        const sy = sxz * (0.5 + Math.random() * 0.45)
        pos.set(s.x, s.y + sy * 0.22, s.z)
        euler.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5)
        quat.setFromEuler(euler)
        scale.set(sxz, sy, sxz * (0.82 + Math.random() * 0.3))
        matrix.compose(pos, quat, scale)
        mesh.setMatrixAt(n, matrix)
        tint.setHSL(0.24 + Math.random() * 0.08, 0.1 + Math.random() * 0.12, 0.62 + Math.random() * 0.3)
        mesh.setColorAt(n, tint)
        n += 1
        this.contactShadowSpecs.push({ x: s.x, z: s.z, radius: sxz * 1.45 })
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.name = `scatter-rock-${vi}`
      this.surfaceGroup.add(mesh)
    }

    const quadA = new THREE.PlaneGeometry(1, 1)
    const quadB = new THREE.PlaneGeometry(1, 1)
    quadB.rotateY(Math.PI / 2)
    const posA = quadA.attributes.position.array as Float32Array
    const posB = quadB.attributes.position.array as Float32Array
    const uvA = quadA.attributes.uv.array as Float32Array
    const uvB = quadB.attributes.uv.array as Float32Array
    const shrubGeo = new THREE.BufferGeometry()
    const shrubPos = new Float32Array(posA.length + posB.length)
    shrubPos.set(posA, 0)
    shrubPos.set(posB, posA.length)
    const shrubUv = new Float32Array(uvA.length + uvB.length)
    shrubUv.set(uvA, 0)
    shrubUv.set(uvB, uvA.length)
    shrubGeo.setAttribute('position', new THREE.BufferAttribute(shrubPos, 3))
    shrubGeo.setAttribute('uv', new THREE.BufferAttribute(shrubUv, 2))
    shrubGeo.setIndex([...Array.from(quadA.index!.array), ...Array.from(quadB.index!.array).map((i) => i + 4)])
    shrubGeo.computeVertexNormals()
    quadA.dispose()
    quadB.dispose()

    const shrubMat = new THREE.MeshStandardMaterial({
      map: makeFoliageTexture(),
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.02,
      emissive: new THREE.Color('#26301f'),
      emissiveIntensity: 0.28,
    })
    const shrubCount = this.lowDetail ? 70 : 165
    const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount)
    let sn = 0
    for (let i = 0; i < shrubCount; i += 1) {
      const s = spot(1.5)
      if (!s) continue
      const sxy = 0.55 + Math.pow(Math.random(), 1.4) * 1.15
      pos.set(s.x, s.y + sxy * 0.42, s.z)
      euler.set(0, Math.random() * Math.PI, 0)
      quat.setFromEuler(euler)
      scale.set(sxy * (0.85 + Math.random() * 0.4), sxy, sxy * (0.85 + Math.random() * 0.4))
      matrix.compose(pos, quat, scale)
      shrubs.setMatrixAt(sn, matrix)
      tint.setHSL(0.26 + Math.random() * 0.07, 0.24 + Math.random() * 0.18, 0.4 + Math.random() * 0.26)
      shrubs.setColorAt(sn, tint)
      sn += 1
      this.contactShadowSpecs.push({ x: s.x, z: s.z, radius: sxy * 1.15 })
    }
    shrubs.count = sn
    shrubs.instanceMatrix.needsUpdate = true
    if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true
    shrubs.name = 'scatter-shrub'
    this.surfaceGroup.add(shrubs)
  }

  private buildContactShadows() {
    if (this.contactShadowSpecs.length === 0) return
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      map: makeContactShadowTexture(),
      color: '#0a1207',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    const mesh = new THREE.InstancedMesh(geo, material, this.contactShadowSpecs.length)
    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const yawQuat = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const normal = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const eps = 0.4
    this.contactShadowSpecs.forEach((spec, i) => {
      normal
        .set(
          heightAt(spec.x - eps, spec.z) - heightAt(spec.x + eps, spec.z),
          2 * eps,
          heightAt(spec.x, spec.z - eps) - heightAt(spec.x, spec.z + eps),
        )
        .normalize()
      quat.setFromUnitVectors(up, normal)
      if (spec.yaw) quat.multiply(yawQuat.setFromAxisAngle(up, spec.yaw))
      pos.set(spec.x, heightAt(spec.x, spec.z), spec.z).addScaledVector(normal, 0.06)
      scale.set(spec.radius * 2, 1, (spec.rz ?? spec.radius) * 2)
      matrix.compose(pos, quat, scale)
      mesh.setMatrixAt(i, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.name = 'contact-shadows'
    this.surfaceGroup.add(mesh)
  }

  private buildBeacons() {
    const makeBeacon = (id: PickId, color: string, position: THREE.Vector3, pickRadius: number) => {
      const group = new THREE.Group()
      group.position.copy(position)
      const tint = new THREE.Color(color)
      const glowTint = tint.clone().multiplyScalar(0.82)
      const lineTint = tint.clone().multiplyScalar(0.55)

      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.2, 1),
        new THREE.MeshBasicMaterial({ color: glowTint }),
      )
      group.add(core)

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: glowTint,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      halo.scale.setScalar(2.6)
      group.add(halo)

      const rings: THREE.Mesh[] = []
      for (let i = 0; i < 2; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.72 + i * 0.2, 0.01, 6, 72),
          new THREE.MeshBasicMaterial({
            color: lineTint,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        ring.rotation.x = i === 0 ? Math.PI / 2.3 : Math.PI / 1.8
        ring.rotation.y = i === 0 ? 0.3 : 0.9
        group.add(ring)
        rings.push(ring)
      }

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.03, 3.2, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: lineTint,
          transparent: true,
          opacity: 0.02,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      beam.position.y = 2.0
      group.add(beam)

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(pickRadius, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      hit.userData.pick = id
      group.add(hit)
      this.pickables.push(hit)

      this.surfaceGroup.add(group)
      this.beacons[id] = {
        group,
        halo,
        rings,
        core,
        beam,
        baseY: position.y,
        active: id === this.activeTask ? 1 : 0.25,
      }
      return group
    }

    const flowerBase = new THREE.Vector3(-3.8, heightAt(-3.8, -8.5), -8.5)
    makeBeacon('flower', '#ffd9a3', flowerBase.clone().add(new THREE.Vector3(0.55, 2.75, 0.35)), 1.8)

    const windBase = new THREE.Vector3(10, heightAt(10, -30), -30)
    makeBeacon('wind', '#9df5c8', windBase.clone().add(new THREE.Vector3(0, 2.0, 0)), 2.4)

    const starBase = new THREE.Vector3(-15, heightAt(-15, -55) + 13.5, -55)
    makeBeacon('stars', '#a9c0ff', starBase, 2.6)
  }

  private buildPollen() {
    if (!this.glowTexture) return
    const count = this.lowDetail ? 160 : 320
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    const palette = [new THREE.Color('#ffd9a0'), new THREE.Color('#bff5d6'), new THREE.Color('#fff2cc')]

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * 46
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 10
      const y = heightAt(x, z) + 0.3 + Math.random() * 3.4
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      const c = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      seeds[i] = Math.random()
      sizes[i] = 0.7 + Math.random() * 1.9
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0.75 },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    this.pollenUniforms = uniforms

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float t = uTime * (0.12 + aSeed * 0.22);
          p.x += sin(t * 1.3 + aSeed * 33.0) * 0.9;
          p.z += cos(t * 1.1 + aSeed * 21.0) * 0.9;
          p.y += sin(t * 1.8 + aSeed * 41.0) * 0.55;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (95.0 / max(1.0, -mv.z)), 7.0 * uPixel);
          vAlpha = 0.25 + 0.55 * (0.5 + 0.5 * sin(uTime * (0.7 + aSeed) + aSeed * 50.0));
          vColor = aColor;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.02, 0.5, d);
          gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.surfaceGroup.add(points)
  }

  private buildPetals() {
    const count = 120
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 1.6
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0.8 + Math.random() * 1.2
      positions[i * 3 + 2] = Math.sin(angle) * radius
      seeds[i] = Math.random()
      sizes[i] = 0.7 + Math.random() * 1.5
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uBurst: { value: 0 },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    this.petalUniforms = uniforms

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        uniform float uBurst;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float speed = (0.12 + aSeed * 0.16) * (1.0 + uBurst * 1.5);
          float life = fract(uTime * speed + aSeed);
          p.y += life * (3.0 + uBurst * 3.0);
          p.x += sin((uTime + aSeed * 10.0) * 1.15) * life * (0.8 + uBurst);
          p.z += cos((uTime * 0.9 + aSeed * 7.0)) * life * (0.7 + uBurst);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (60.0 / max(1.0, -mv.z)), 12.0 * uPixel);
          vAlpha = (1.0 - life) * (0.55 + 0.45 * sin(aSeed * 40.0 + uTime));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.05, 0.5, d);
          gl_FragColor = vec4(1.0, 0.78, 0.58, a * vAlpha * uOpacity * 0.9);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.position.set(-3.8, heightAt(-3.8, -8.5), -8.5)
    points.frustumCulled = false
    this.surfaceGroup.add(points)
  }

  // ---------------------------------------------------------------- underground

  private buildHoverMotes() {
    const count = 96
    const positions = new Float32Array(count * 3)
    const alphas = new Float32Array(count)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const palette = [new THREE.Color('#ffe2b0'), new THREE.Color('#b6f5d8'), new THREE.Color('#d4e5ff')]
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -999
      positions[i * 3 + 2] = 0
      alphas[i] = 0
      sizes[i] = 1.1 + Math.random() * 1.8
      const color = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    const uniforms: Record<string, THREE.IUniform> = {
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        attribute vec3 aColor;
        uniform float uPixel;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * uPixel * (80.0 / max(1.0, -mv.z)), 8.0 * uPixel);
          vAlpha = aAlpha;
          vColor = aColor;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(vColor, a * vAlpha * 0.85);
        }
      `,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.surfaceGroup.add(points)
    this.hoverMotes = {
      points,
      positions,
      alphas,
      life: new Float32Array(count),
      velocities: new Float32Array(count),
      uniforms,
    }
  }

  private spawnHoverMotes(point: THREE.Vector3, amount = 4) {
    const motes = this.hoverMotes
    if (!motes) return
    let spawned = 0
    for (let i = 0; i < motes.life.length && spawned < amount; i += 1) {
      if (motes.life[i] > 0.05) continue
      motes.life[i] = 0.7 + Math.random() * 0.5
      motes.velocities[i] = 0.22 + Math.random() * 0.5
      motes.positions[i * 3] = point.x + (Math.random() - 0.5) * 0.9
      motes.positions[i * 3 + 1] = point.y + 0.15 + Math.random() * 0.35
      motes.positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.9
      motes.alphas[i] = 0.85
      spawned += 1
    }
    if (spawned > 0) {
      const geometry = motes.points.geometry
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.aAlpha.needsUpdate = true
    }
  }

  private buildEasterEggs() {
    const bottle = new THREE.Group()
    bottle.position.set(-26, LAKE.y + 0.08, -54)
    bottle.rotation.y = -0.7
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: '#a8e6d4',
      transparent: true,
      opacity: 0.42,
      roughness: 0.15,
      metalness: 0.1,
      emissive: new THREE.Color('#1c5a48'),
      emissiveIntensity: 0.5,
    })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.72, 12), glassMaterial)
    body.rotation.z = Math.PI / 2
    body.position.y = 0.16
    bottle.add(body)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.24, 10), glassMaterial)
    neck.rotation.z = Math.PI / 2
    neck.position.set(0.46, 0.16, 0)
    bottle.add(neck)
    const cork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: '#8a6747', roughness: 0.9 }),
    )
    cork.rotation.z = Math.PI / 2
    cork.position.set(0.6, 0.16, 0)
    bottle.add(cork)
    const note = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6),
      new THREE.MeshBasicMaterial({ color: '#f2e4c2' }),
    )
    note.rotation.z = Math.PI / 2
    note.position.set(-0.02, 0.16, 0)
    bottle.add(note)
    const bottleGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#9df5c8',
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    bottleGlow.scale.setScalar(1.4)
    bottleGlow.position.set(0.1, 0.35, 0)
    bottle.add(bottleGlow)
    const bottleHit = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    bottleHit.position.y = 0.3
    bottleHit.userData.pick = 'bottle'
    bottle.add(bottleHit)
    this.pickables.push(bottleHit)
    this.surfaceGroup.add(bottle)

    const tabletX = 14
    const tabletZ = -34
    const tabletGround = heightAt(tabletX, tabletZ)
    const tablet = new THREE.Group()
    tablet.position.set(tabletX, tabletGround, tabletZ)
    tablet.rotation.y = -0.5
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.55, 0.18),
      new THREE.MeshStandardMaterial({
        color: '#242d2c',
        roughness: 0.95,
        metalness: 0.08,
        emissive: new THREE.Color('#0a100e'),
        emissiveIntensity: 0.5,
      }),
    )
    stone.position.y = 0.78
    stone.rotation.x = -0.08
    stone.rotation.z = 0.06
    tablet.add(stone)

    const engravingCanvas = document.createElement('canvas')
    engravingCanvas.width = 256
    engravingCanvas.height = 320
    const engravingCtx = engravingCanvas.getContext('2d')
    if (engravingCtx) {
      engravingCtx.clearRect(0, 0, 256, 320)
      engravingCtx.strokeStyle = 'rgba(255, 214, 160, 0.55)'
      engravingCtx.lineWidth = 1.5
      engravingCtx.beginPath()
      engravingCtx.moveTo(128, 44)
      engravingCtx.lineTo(58, 174)
      engravingCtx.lineTo(198, 174)
      engravingCtx.lineTo(128, 44)
      engravingCtx.stroke()
      const dots: [number, number][] = [[128, 44], [58, 174], [198, 174]]
      dots.forEach(([x, y]) => {
        engravingCtx.beginPath()
        engravingCtx.fillStyle = 'rgba(255, 226, 180, 0.85)'
        engravingCtx.arc(x, y, 4, 0, Math.PI * 2)
        engravingCtx.fill()
      })
      engravingCtx.strokeStyle = 'rgba(255, 214, 160, 0.35)'
      engravingCtx.lineWidth = 1
      for (let i = 0; i < 6; i += 1) {
        engravingCtx.beginPath()
        engravingCtx.moveTo(64, 226 + i * 13)
        engravingCtx.lineTo(192 - i * 8, 226 + i * 13)
        engravingCtx.stroke()
      }
    }
    const engravingTexture = new THREE.CanvasTexture(engravingCanvas)
    engravingTexture.colorSpace = THREE.SRGBColorSpace
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 1.05),
      new THREE.MeshBasicMaterial({
        map: engravingTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.9,
      }),
    )
    plaque.position.set(0, 0.82, 0.11)
    plaque.rotation.x = -0.08
    tablet.add(plaque)

    const tabletGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ffd6a0',
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    tabletGlow.scale.setScalar(2)
    tabletGlow.position.set(0, 0.8, 0.2)
    tablet.add(tabletGlow)
    const tabletHit = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    tabletHit.position.y = 0.8
    tabletHit.userData.pick = 'tablet'
    tablet.add(tabletHit)
    this.pickables.push(tabletHit)
    this.surfaceGroup.add(tablet)
    this.contactShadowSpecs.push({ x: tabletX, z: tabletZ, radius: 0.78, rz: 0.26, yaw: -0.5 })
  }

  private buildRain() {
    const count = this.lowDetail ? 1100 : 2200
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 48
      positions[i * 3 + 1] = (Math.random() - 0.5) * 28
      positions[i * 3 + 2] = (Math.random() - 0.5) * 48
      seeds[i] = Math.random()
      sizes[i] = 0.8 + Math.random() * 1.4
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    this.rainUniforms = uniforms
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        varying float vAlpha;
        void main() {
          float fall = mod(position.y - uTime * 22.0 + aSeed * 28.0, 28.0) - 14.0;
          vec3 p = vec3(position.x + sin(uTime * 0.45 + aSeed * 30.0) * 0.7, fall, position.z);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (110.0 / max(1.0, -mv.z)), 5.5 * uPixel);
          vAlpha = 0.45 + 0.55 * aSeed;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float ax = 1.0 - smoothstep(0.02, 0.12, abs(p.x));
          float ay = 1.0 - smoothstep(0.2, 0.5, abs(p.y));
          gl_FragColor = vec4(0.78, 0.88, 1.0, ax * ay * vAlpha * uOpacity * 0.9);
        }
      `,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.rainGroup.add(points)
    this.rainGroup.visible = false
    this.surfaceGroup.add(this.rainGroup)
  }

  private buildConstellation() {
    this.constellationGroup.visible = false
    this.surfaceGroup.add(this.constellationGroup)
  }

  private buildMeteor() {
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#dce9ff',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    head.scale.setScalar(4.2)
    this.meteorGroup.add(head)
    const tailGeometry = new THREE.BufferGeometry()
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const tail = new THREE.Line(
      tailGeometry,
      new THREE.LineBasicMaterial({
        color: '#cfe0ff',
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.meteorGroup.add(tail)
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(9.5, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    hit.userData.pick = 'meteor'
    this.meteorGroup.add(hit)
    this.pickables.push(hit)
    this.meteorGroup.visible = false
    this.meteorTail = tail
    this.surfaceGroup.add(this.meteorGroup)
  }

  private buildUnderground() {
    this.undergroundGroup.visible = false

    const rockCanvas = document.createElement('canvas')
    rockCanvas.width = 512
    rockCanvas.height = 1024
    const rockCtx = rockCanvas.getContext('2d')
    if (rockCtx) {
      rockCtx.fillStyle = '#0b0e13'
      rockCtx.fillRect(0, 0, 512, 1024)
      for (let i = 0; i < 260; i += 1) {
        const x = Math.random() * 512
        const y = Math.random() * 1024
        const w = 1 + Math.random() * 7
        const h = 30 + Math.random() * 280
        const shade = Math.random()
        rockCtx.fillStyle =
          shade > 0.72 ? 'rgba(74, 82, 92, 0.16)' : shade > 0.4 ? 'rgba(28, 34, 42, 0.5)' : 'rgba(2, 4, 6, 0.6)'
        rockCtx.fillRect(x, y, w, h)
      }
      for (let i = 0; i < 80; i += 1) {
        rockCtx.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.5)' : 'rgba(96, 88, 78, 0.12)'
        rockCtx.lineWidth = 0.6 + Math.random() * 1.4
        rockCtx.beginPath()
        let x = Math.random() * 512
        let y = Math.random() * 1024
        rockCtx.moveTo(x, y)
        for (let k = 0; k < 5; k += 1) {
          x += (Math.random() - 0.5) * 30
          y += Math.random() * 40
          rockCtx.lineTo(x, y)
        }
        rockCtx.stroke()
      }
    }
    const rockTexture = new THREE.CanvasTexture(rockCanvas)
    rockTexture.colorSpace = THREE.SRGBColorSpace
    rockTexture.wrapS = THREE.RepeatWrapping
    rockTexture.wrapT = THREE.RepeatWrapping
    rockTexture.repeat.set(3, 3)
    const rockMaterial = new THREE.MeshBasicMaterial({
      map: rockTexture,
      side: THREE.BackSide,
      fog: true,
    })
    const rockTunnel = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 118, 36, 24, true), rockMaterial)
    rockTunnel.position.set(0, -56, 0)
    this.rockTunnel = rockTunnel
    this.undergroundGroup.add(rockTunnel)

    const shaftGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#7a563e',
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    shaftGlow.scale.setScalar(4)
    shaftGlow.position.set(0, -108, 0)
    this.undergroundGroup.add(shaftGlow)

    const rockShardMaterial = new THREE.MeshBasicMaterial({ color: '#04060a' })
    for (let i = 0; i < 14; i += 1) {
      const shard = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3 + Math.random() * 1.1, 0),
        rockShardMaterial,
      )
      const angle = Math.random() * Math.PI * 2
      const radius = 2.6 + Math.random() * 2.4
      shard.position.set(
        Math.cos(angle) * radius,
        -18 - Math.random() * 90,
        Math.sin(angle) * radius,
      )
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      this.undergroundGroup.add(shard)
    }

    const dustUniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSpeed: { value: 14 },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    const dust = this.createMoteField(900, 14, 22, '#8a9aa2', 0.9, dustUniforms, false)
    dust.points.position.set(0, -20, 0)
    this.dustMote = dust
    this.undergroundGroup.add(dust.points)

    // magma tunnel shell
    const magmaUniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    }
    this.magmaUniforms = magmaUniforms
    const tunnelMaterial = new THREE.ShaderMaterial({
      uniforms: magmaUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float x = vUv.x * 6.283;
          float flow = sin(vUv.y * 90.0 - uTime * 6.0 + sin(x * 7.0) * 0.9) * 0.5 + 0.5;
          float band = smoothstep(0.35, 1.0, flow);
          float streak = pow(0.5 + 0.5 * sin(x * 22.0 + uTime * 0.7 + sin(vUv.y * 30.0 + uTime * 4.0) * 1.4), 6.0);
          vec3 col = mix(vec3(0.07, 0.006, 0.001), vec3(1.0, 0.24, 0.03), band);
          col += vec3(1.0, 0.5, 0.08) * streak * 0.35;
          gl_FragColor = vec4(col, (0.08 + band * 0.24 + streak * 0.12) * uOpacity);
        }
      `,
    })
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 150, 40, 30, true), tunnelMaterial)
    tunnel.position.set(0, -130, 0)
    this.magmaGroup.add(tunnel)

    const shardMaterial = new THREE.MeshBasicMaterial({ color: '#0b0503' })
    for (let i = 0; i < 16; i += 1) {
      const shard = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.35 + Math.random() * 1.2, 0),
        shardMaterial,
      )
      const angle = Math.random() * Math.PI * 2
      const radius = 4.6 + Math.random() * 2.2
      shard.position.set(
        Math.cos(angle) * radius,
        -58 - Math.random() * 150,
        Math.sin(angle) * radius,
      )
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      this.magmaGroup.add(shard)
    }

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#ff7a2a',
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (let i = 0; i < 12; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.075, 6, 64), ringMaterial)
      ring.rotation.x = Math.random() * 0.4
      ring.rotation.y = Math.random() * 0.4
      ring.position.set(0, -62 - i * 12.5, 0)
      this.magmaGroup.add(ring)
    }

    const sparkUniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSpeed: { value: 16 },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    }
    const sparks = this.createMoteField(600, 9, 20, '#ff9a4a', 1.8, sparkUniforms, true)
    sparks.points.position.set(0, -160, 0)
    this.magmaSparks = sparks
    this.magmaGroup.add(sparks.points)

    const endGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ff8a3c',
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    endGlow.scale.setScalar(22)
    endGlow.material.opacity = 0.5
    endGlow.position.set(0, -252, 0)
    this.magmaGroup.add(endGlow)

    // Interstellar wormhole / tesseract vertical light filaments
    const warpStreams = new THREE.Group()
    const goldFilamentMat = new THREE.MeshBasicMaterial({
      color: '#f2c28b',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const blueFilamentMat = new THREE.MeshBasicMaterial({
      color: '#8ab8ff',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (let i = 0; i < 36; i += 1) {
      const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.16
      const radius = 4.2 + Math.random() * 2.6
      const len = 22 + Math.random() * 26
      const filament = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, len, 0.035),
        i % 2 === 0 ? goldFilamentMat : blueFilamentMat,
      )
      filament.position.set(
        Math.cos(angle) * radius,
        -60 - Math.random() * 175,
        Math.sin(angle) * radius,
      )
      warpStreams.add(filament)
    }
    this.warpStreams = warpStreams
    this.magmaGroup.add(warpStreams)

    this.magmaGroup.visible = false
    this.undergroundGroup.add(this.magmaGroup)

    // core backdrop
    const backdropUniform = { uTime: { value: 0 } }
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 170),
      new THREE.ShaderMaterial({
        uniforms: backdropUniform,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            p.x *= 2.4;
            float d = length(p);
            float glow = (1.0 - smoothstep(0.0, 0.55, d)) * 0.32;
            float veins = sin(vUv.x * 34.0 + sin(vUv.y * 7.0 + uTime * 0.2) * 2.0) * 0.5 + 0.5;
            veins *= 1.0 - smoothstep(0.08, 0.5, d);
            vec3 col = mix(vec3(0.02, 0.003, 0.002), vec3(0.62, 0.13, 0.03), glow);
            col += vec3(1.0, 0.32, 0.08) * veins * 0.035;
            gl_FragColor = vec4(col, glow * 0.55);
          }
        `,
      }),
    )
    backdrop.position.set(0, -292, -130)
    this.coreGroup.add(backdrop)

    // Gargantua-inspired Earth-core accretion rings
    const accretion = new THREE.Group()
    accretion.position.set(0, -292, -34)
    const diskRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.22, 10, 96),
      new THREE.MeshBasicMaterial({
        color: '#ffae5c',
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    diskRing1.rotation.set(Math.PI / 2 - 0.28, 0.16, 0)
    accretion.add(diskRing1)
    const diskRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(23, 0.14, 8, 96),
      new THREE.MeshBasicMaterial({
        color: '#ffd9a0',
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    diskRing2.rotation.set(Math.PI / 2 - 0.24, -0.18, 0)
    accretion.add(diskRing2)
    const lensRing = new THREE.Mesh(
      new THREE.TorusGeometry(19.5, 0.16, 8, 96),
      new THREE.MeshBasicMaterial({
        color: '#ff8f4a',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    lensRing.rotation.set(0.06, 0.1, 0)
    accretion.add(lensRing)
    this.coreAccretionGroup = accretion
    this.coreGroup.add(accretion)

    const coreHaze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ff5a1e',
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    coreHaze.scale.setScalar(130)
    coreHaze.position.set(0, -296, -92)
    this.coreGroup.add(coreHaze)

    const emberPositions = new Float32Array(200 * 3)
    for (let i = 0; i < 200; i += 1) {
      emberPositions[i * 3] = (Math.random() - 0.5) * 90
      emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 60
      emberPositions[i * 3 + 2] = -20 - Math.random() * 110
    }
    const emberGeo = new THREE.BufferGeometry()
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
    const emberMat = new THREE.PointsMaterial({
      color: '#ff8a4a',
      size: 0.07,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const embers = new THREE.Points(emberGeo, emberMat)
    embers.position.set(0, -292, 0)
    this.coreGroup.add(embers)
    this.coreSparks = embers

    this.buildVehicle()
    this.coreGroup.visible = false
    this.undergroundGroup.add(this.coreGroup)
  }

  private buildVehicle() {
    const ship = new THREE.Group()
    ship.position.set(0, -290.5, -40)
    ship.scale.setScalar(1.55)
    ship.rotation.set(0.14, 0.82, 0.04)

    // Smooth metallic teardrop/drill fuselage via LatheGeometry
    const hullProfile = [
      new THREE.Vector2(0.0, -5.8),
      new THREE.Vector2(0.75, -5.2),
      new THREE.Vector2(1.5, -3.5),
      new THREE.Vector2(2.05, -1.0),
      new THREE.Vector2(2.1, 1.8),
      new THREE.Vector2(1.65, 4.2),
      new THREE.Vector2(0.95, 5.8),
      new THREE.Vector2(0.32, 6.9),
      new THREE.Vector2(0.0, 7.35),
    ]
    const hullGeo = new THREE.LatheGeometry(hullProfile, 36)
    hullGeo.rotateX(Math.PI / 2)
    const hullMat = new THREE.MeshStandardMaterial({
      color: '#242c38',
      metalness: 0.72,
      roughness: 0.32,
    })
    const hull = new THREE.Mesh(hullGeo, hullMat)
    ship.add(hull)

    // Copper-gold thermal nosecone heat rings
    const thermalRingMat = new THREE.MeshStandardMaterial({
      color: '#ff9e52',
      emissive: new THREE.Color('#ff6e20'),
      emissiveIntensity: 0.65,
      metalness: 0.6,
      roughness: 0.25,
    })
    for (const [rz, rr] of [
      [3.9, 1.72],
      [4.95, 1.32],
      [5.85, 0.92],
    ]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.075, 10, 48), thermalRingMat)
      ring.position.z = rz
      ship.add(ring)
    }

    // 3 beveled aerodynamic stabilizer fins
    const finShape = new THREE.Shape()
    finShape.moveTo(0, 0)
    finShape.lineTo(3.1, -1.6)
    finShape.lineTo(3.4, -3.2)
    finShape.lineTo(0.3, -2.5)
    finShape.closePath()
    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2,
    })
    finGeo.translate(0, 0, -0.07)
    finGeo.rotateX(Math.PI / 2)
    const finMat = new THREE.MeshStandardMaterial({
      color: '#2e3846',
      metalness: 0.65,
      roughness: 0.36,
    })
    for (let i = 0; i < 3; i += 1) {
      const fin = new THREE.Mesh(finGeo, finMat)
      fin.position.z = -1.6
      fin.rotation.z = (i / 3) * Math.PI * 2 + Math.PI / 6
      ship.add(fin)
    }

    // Recessed warm-amber panoramic cockpit canopy
    const canopyGeo = new THREE.SphereGeometry(0.95, 24, 16)
    canopyGeo.scale(0.86, 0.56, 2.05)
    const canopyMat = new THREE.MeshStandardMaterial({
      color: '#ffcf88',
      emissive: new THREE.Color('#ff9a3c'),
      emissiveIntensity: 0.58,
      roughness: 0.14,
      metalness: 0.25,
    })
    const canopy = new THREE.Mesh(canopyGeo, canopyMat)
    canopy.position.set(0, 1.32, 1.85)
    ship.add(canopy)

    // Rotating rear neutrino comms ring
    const commsRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.45, 0.048, 10, 64),
      new THREE.MeshStandardMaterial({
        color: '#f2c28b',
        emissive: new THREE.Color('#d98a3c'),
        emissiveIntensity: 0.5,
        metalness: 0.78,
        roughness: 0.22,
      }),
    )
    commsRing.position.z = -3.4
    for (let i = 0; i < 4; i += 1) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), finMat)
      const angle = (i / 4) * Math.PI * 2
      strut.position.set(Math.cos(angle) * 2.0, Math.sin(angle) * 2.0, 0)
      strut.rotation.z = angle - Math.PI / 2
      commsRing.add(strut)
    }
    this.vehicleCommsRing = commsRing
    ship.add(commsRing)

    const beaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#ffd28a' }),
    )
    beaconMesh.position.set(1.85, 1.75, -1.5)
    ship.add(beaconMesh)

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ffb85c',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    glow.scale.setScalar(1.6)
    glow.position.copy(beaconMesh.position)
    ship.add(glow)

    const light = new THREE.PointLight(0xffb85c, 16, 42, 2)
    light.position.copy(beaconMesh.position)
    ship.add(light)

    // Rim lighting so brushed metallic fuselage gleams in core cavern
    const rimWarm = new THREE.PointLight(0xffb866, 26, 60, 1.8)
    rimWarm.position.set(9, 6, 8)
    ship.add(rimWarm)
    const rimCool = new THREE.PointLight(0x7ca8ff, 18, 60, 1.8)
    rimCool.position.set(-10, -4, -7)
    ship.add(rimCool)

    this.vehicleBeacon = { mesh: beaconMesh, glow, light }
    this.vehicle = ship
    this.coreGroup.add(ship)
  }

  private createMoteField(
    count: number,
    radius: number,
    height: number,
    color: string,
    sizeBase: number,
    uniforms: Record<string, THREE.IUniform>,
    additive: boolean,
  ) {
    uniforms.uColor = { value: new THREE.Color(color) }
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = (Math.random() - 0.5) * height
      positions[i * 3 + 2] = Math.sin(angle) * r
      seeds[i] = Math.random()
      sizes[i] = sizeBase * (0.5 + Math.random())
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uSpeed;
        uniform float uPixel;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * uSpeed * (0.4 + aSeed), ${height.toFixed(1)}) - ${(height / 2).toFixed(1)};
          p.x += sin(uTime * 0.7 + aSeed * 20.0) * 0.7;
          p.z += cos(uTime * 0.6 + aSeed * 17.0) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (320.0 / max(1.0, -mv.z)), 40.0 * uPixel);
          vAlpha = 0.35 + 0.65 * aSeed;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float ax = 1.0 - smoothstep(0.02, 0.13, abs(p.x));
          float ay = 1.0 - smoothstep(0.3, 0.5, abs(p.y));
          float a = ax * ay;
          gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
        }
      `,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    return { points, uniforms: material.uniforms }
  }

  private getPreset(target: FocusTarget) {
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
        pos: new THREE.Vector3(-14, heightAt(-14, -44) + 2.6, -44),
        look: new THREE.Vector3(-25.5, LAKE.y + 0.6, -49.5),
        fov: 50,
      }
    }
    return {
      pos: new THREE.Vector3(0, homeY, 12),
      look: new THREE.Vector3(0, homeY - 0.75, -18),
      fov: 55,
    }
  }

  // ---------------------------------------------------------------- events

  private attachEvents() {
    if (!this.canvas) return
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onWindowBlur)
  }

  private detachEvents() {
    if (!this.canvas) return
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onWindowBlur)
  }

  private onWheel = (event: WheelEvent) => {
    if (this.descent.active || this.flight || !this.roamEnabled) return
    event.preventDefault()
    this.fovTarget = clamp(this.fovTarget + event.deltaY * 0.024, 34, 62)
    this.options.onZoomChange?.(55 / this.fovTarget)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.roamEnabled || this.descent.active) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const movement = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (!movement.includes(event.code) && event.code !== 'ShiftLeft' && event.code !== 'ShiftRight') return
    this.keys.add(event.code)
    if (event.code.startsWith('Arrow')) event.preventDefault()
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }

  private onWindowBlur = () => {
    this.keys.clear()
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.descent.active || this.flight) return
    this.pointer.down = true
    this.pointer.id = event.pointerId
    this.pointer.lastX = event.clientX
    this.pointer.lastY = event.clientY
    this.pointer.startX = event.clientX
    this.pointer.startY = event.clientY
    this.pointer.drag = 0
    this.options.onHoverTarget?.(null)
    this.canvas?.setPointerCapture(event.pointerId)
    if (this.canvas) this.canvas.style.cursor = 'grabbing'
  }

  private onPointerMove = (event: PointerEvent) => {
    if (this.pointer.down && !this.flight) {
      const dx = event.clientX - this.pointer.lastX
      const dy = event.clientY - this.pointer.lastY
      this.pointer.lastX = event.clientX
      this.pointer.lastY = event.clientY
      this.pointer.drag += Math.abs(dx) + Math.abs(dy)
      this.targetYaw -= dx * 0.0036
      this.targetPitch = clamp(this.targetPitch + dy * 0.003, -1.15, 1.28)
      return
    }
    if (this.descent.active) {
      if (this.canvas) this.canvas.style.cursor = 'default'
      this.options.onHoverTarget?.(null)
      return
    }
    const hit = this.pickHit(event.clientX, event.clientY)
    if (this.canvas) {
      this.canvas.style.cursor = hit ? 'pointer' : 'grab'
    }
    if (hit) {
      this.options.onHoverTarget?.({
        id: hit.id,
        x: event.clientX,
        y: event.clientY,
        distance: hit.point.distanceTo(this.camPos),
      })
    } else {
      this.options.onHoverTarget?.(null)
    }

    const now = performance.now()
    if (hit?.id === 'lake') {
      this.cursorWorld.set(999, 999, 999)
      if (now - this.lastHoverCheck >= 85 && now - this.lastLakeHover > 260) {
        this.lastHoverCheck = now
        this.lastLakeHover = now
        this.spawnRipple(hit.point, 0.55)
        this.options.onLakeRipple?.()
      }
      return
    }
    if (hit || !this.terrainMesh || !this.canvas) {
      this.cursorWorld.set(999, 999, 999)
      return
    }
    if (now - this.lastCursorCheck < 30) return
    this.lastCursorCheck = now
    const rect = this.canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
    const ground = this.raycaster.intersectObject(this.terrainMesh, false)[0]
    if (ground && ground.distance < 34 && ground.point.y > LAKE.y + 0.1) {
      this.cursorWorld.copy(ground.point)
      if (now - this.lastHoverCheck >= 85) {
        this.lastHoverCheck = now
        this.spawnHoverMotes(ground.point, 3)
      }
    } else {
      this.cursorWorld.set(999, 999, 999)
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointer.down) return
    this.pointer.down = false
    if (this.canvas?.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }
    if (this.canvas) this.canvas.style.cursor = 'grab'
    if (this.pointer.drag < 8 && !this.flight && !this.descent.active) {
      const hit = this.pickHit(event.clientX, event.clientY)
      if (!hit) {
        if (this.roamEnabled && this.terrainMesh && this.canvas) {
          const rect = this.canvas.getBoundingClientRect()
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
          this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
          const ground = this.raycaster.intersectObject(this.terrainMesh, false)[0]
          if (
            ground &&
            ground.distance < 42 &&
            this.inRoam(ground.point.x, ground.point.z) &&
            heightAt(ground.point.x, ground.point.z) > LAKE.y + 0.25
          ) {
            this.walkTarget = ground.point.clone()
            this.triggerWalkMarker(this.walkTarget)
          }
        }
        return
      }
      if (hit.id === 'lake') {
        this.spawnRipple(hit.point, 1)
      } else if (hit.id === 'star1' || hit.id === 'star2' || hit.id === 'star3') {
        const index = Number(hit.id.slice(4)) - 1
        this.connectConstellation(index)
      } else if (hit.id === 'meteor') {
        this.hideMeteor()
      }
      this.options.onPick?.(hit.id)
    }
  }

  private onPointerLeave = () => {
    this.pointer.down = false
    this.cursorWorld.set(999, 999, 999)
    this.options.onHoverTarget?.(null)
    if (this.canvas) this.canvas.style.cursor = 'grab'
  }

  private pickHit(clientX: number, clientY: number): PickHit | null {
    if (!this.canvas) return null
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, false)
    for (const hit of hits) {
      const pick = hit.object.userData.pick as PickId | undefined
      if (!pick) continue
      if (pick === 'meteor' && !this.meteorRunning) continue
      if (pick === 'star1' || pick === 'star2' || pick === 'star3') {
        if (!this.constellationActive) continue
        const star = this.constellationStars.find((item) => item.hit === hit.object)
        if (star?.picked) continue
      }
      return { id: pick, point: hit.point.clone(), object: hit.object }
    }
    return null
  }

  private updateRoam(dt: number) {
    if (!this.roamEnabled) return
    let forwardInput = 0
    let rightInput = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forwardInput += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forwardInput -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) rightInput += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) rightInput -= 1
    forwardInput += this.moveAxis.y
    rightInput += this.moveAxis.x

    const valid = (x: number, z: number) => this.inRoam(x, z) && heightAt(x, z) > LAKE.y + 0.25

    let moveX = 0
    let moveZ = 0
    let speed = 0

    if (forwardInput !== 0 || rightInput !== 0) {
      this.walkTarget = null
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw))
      const move = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(rightInput))
      if (move.lengthSq() >= 0.0001) {
        move.normalize()
        const fast = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
        const magnitude = Math.min(1, Math.hypot(forwardInput, rightInput))
        speed = (fast ? 6 : 3.1) * Math.max(0.35, magnitude)
        moveX = move.x
        moveZ = move.z
      }
    } else if (this.walkTarget) {
      const dx = this.walkTarget.x - this.camPos.x
      const dz = this.walkTarget.z - this.camPos.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.65) {
        this.walkTarget = null
      } else {
        moveX = dx / dist
        moveZ = dz / dist
        speed = 3.8
      }
    }

    if (speed <= 0) {
      const restY = heightAt(this.camPos.x, this.camPos.z) + EYE_HEIGHT
      this.camPos.y += (restY - this.camPos.y) * Math.min(1, dt * 4)
      return
    }

    const step = speed * dt
    const targetX = this.camPos.x + moveX * step
    const targetZ = this.camPos.z + moveZ * step
    let nextX = this.camPos.x
    let nextZ = this.camPos.z
    if (valid(targetX, targetZ)) {
      nextX = targetX
      nextZ = targetZ
    } else if (valid(targetX, this.camPos.z)) {
      nextX = targetX
    } else if (valid(this.camPos.x, targetZ)) {
      nextZ = targetZ
    }
    if (nextX === this.camPos.x && nextZ === this.camPos.z) {
      this.walkTarget = null
      if (!this.inRoam(targetX, targetZ)) this.reportBoundary()
      return
    }
    this.camPos.x = nextX
    this.camPos.z = nextZ
    this.walkPhase += dt
    const bob = Math.sin(this.walkPhase * 7.5) * 0.05
    const targetY = heightAt(nextX, nextZ) + EYE_HEIGHT + bob
    this.camPos.y += (targetY - this.camPos.y) * Math.min(1, dt * 6)
  }

  // ---------------------------------------------------------------- loop

  private startLoop() {
    if (this.raf !== null || this.disposed) return
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private stopLoop() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
  }

  private loop() {
    this.startLoop()
  }

  private updatePlace() {
    const now = performance.now()
    if (now - this.lastPlaceCheck < 300) return
    this.lastPlaceCheck = now
    const { x, z } = this.camPos
    let name = '远脊草原'
    let best = Infinity
    for (const spot of PLACES) {
      const d = Math.hypot(x - spot.x, z - spot.z)
      if (d < spot.radius && d < best) {
        name = spot.name
        best = d
      }
    }
    if (name === '远脊草原') {
      const dx = (x - LAKE.x) / LAKE.rx
      const dz = (z - LAKE.z) / LAKE.rz
      if (Math.sqrt(dx * dx + dz * dz) < 1.45) name = '湖岸'
    }
    if (name !== this.place) {
      this.place = name
      this.options.onPlaceChange?.(name)
    }
  }

  private tick = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    if (this.paused) return
    const now = performance.now()
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05)
    this.lastFrame = now
    this.elapsed += dt
    this.update(dt)
    if (this.composer) this.composer.render()
  }

  private update(dt: number) {
    this.updateLook(dt)
    this.updateCamera(dt)
    this.updatePlace()
    this.updateWorld(dt)
    if (this.descent.active) {
      this.updateDescent(dt)
    }
    this.updateAtmosphere()
    const skimTarget = this.walkTarget || this.keys.size > 0 ? 1 : 0
    const skimRate = skimTarget > this.skim ? 2.4 : 1.3
    this.skim += (skimTarget - this.skim) * Math.min(1, dt * skimRate)
    if (Math.abs(this.skim - this.skimReported) > 0.03) {
      this.skimReported = this.skim
      this.options.onSkimChange?.(this.skim)
    }
  }

  private updateAtmosphere() {
    const pass = this.atmosphere
    if (!pass || !pass.enabled) return
    const uniforms = pass.uniforms
    uniforms.uAspect.value = this.camera.aspect
    const sun = this.look.sunDir
    const probe = this.camera.position.clone().addScaledVector(sun, 900)
    const forward = this.camera.getWorldDirection(new THREE.Vector3())
    const facing = forward.dot(sun)
    if (facing <= 0.05 || sun.y <= -0.02) {
      uniforms.uSunGain.value = 0
      return
    }
    probe.project(this.camera)
    uniforms.uSunUv.value.set(probe.x * 0.5 + 0.5, probe.y * 0.5 + 0.5)
    const edge = Math.max(Math.abs(probe.x), Math.abs(probe.y))
    const onScreen = 1 - clamp((edge - 1) / 0.9, 0, 1)
    const altitude = clamp(sun.y * 3.2, 0, 1)
    uniforms.uSunGain.value = onScreen * altitude * clamp((facing - 0.05) / 0.35, 0, 1) * 0.5
  }

  private updateLook(dt: number) {
    if (this.descent.active) {
      const k = 1 - Math.exp(-dt * 2.2)
      const fog = this.scene.fog as THREE.FogExp2
      fog.color.lerp(this.undergroundLook.fog, k)
      fog.density += (this.undergroundLook.density - fog.density) * k
      if (this.renderer) {
        this.renderer.toneMappingExposure += (0.92 - this.renderer.toneMappingExposure) * k
      }
      return
    }

    const k = 1 - Math.exp(-dt * 1.1)
    this.look.zenith.lerp(this.lookTarget.zenith, k)
    this.look.horizon.lerp(this.lookTarget.horizon, k)
    this.look.sun.lerp(this.lookTarget.sun, k)
    this.look.fog.lerp(this.lookTarget.fog, k)
    this.look.sunLight.lerp(this.lookTarget.sunLight, k)
    this.look.hemiSky.lerp(this.lookTarget.hemiSky, k)
    this.look.hemiGround.lerp(this.lookTarget.hemiGround, k)
    this.look.waterDeep.lerp(this.lookTarget.waterDeep, k)
    this.look.sunDir.lerp(this.lookTarget.sunDir, k).normalize()
    this.look.sunPower += (this.lookTarget.sunPower - this.look.sunPower) * k
    this.look.sunIntensity += (this.lookTarget.sunIntensity - this.look.sunIntensity) * k
    this.look.hemiIntensity += (this.lookTarget.hemiIntensity - this.look.hemiIntensity) * k
    this.look.grassTip += (this.lookTarget.grassTip - this.look.grassTip) * k
    this.look.galaxy += (this.lookTarget.galaxy - this.look.galaxy) * k
    this.look.stars += (this.lookTarget.stars - this.look.stars) * k
    this.look.exposure += (this.lookTarget.exposure - this.look.exposure) * k
    this.look.fogDensity += (this.lookTarget.fogDensity - this.look.fogDensity) * k

    this.applyLook()
  }

  private buildMistBoundary() {
    const uniforms: Record<string, THREE.IUniform> = {
      uColor: { value: this.look.fog.clone() },
      uTime: { value: 0 },
    }
    this.mistUniforms = uniforms
    const geometry = new THREE.CylinderGeometry(this.roamRadius + 3, this.roamRadius + 7, 26, 96, 1, true)
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying float vH;
        varying vec2 vXZ;
        void main() {
          vH = uv.y;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vXZ = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        varying float vH;
        varying vec2 vXZ;
        void main() {
          float drift = 0.5 + 0.5 * sin(vXZ.x * 0.045 + vXZ.y * 0.037 + uTime * 0.16);
          float body = smoothstep(1.0, 0.12, vH);
          float alpha = body * (0.3 + 0.34 * drift);
          gl_FragColor = vec4(uColor * 1.12, alpha);
        }
      `,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(ROAM_CENTER.x, 6, ROAM_CENTER.z)
    mesh.frustumCulled = false
    mesh.renderOrder = 2
    this.surfaceGroup.add(mesh)
  }

  private reportBoundary() {
    const now = performance.now()
    if (now - this.lastBoundaryReport < 6000) return
    this.lastBoundaryReport = now
    this.options.onBoundary?.()
  }

  private applyLook() {
    const fog = this.scene.fog as THREE.FogExp2
    fog.color.copy(this.look.fog)
    fog.density = this.look.fogDensity

    this.sunLight.color.copy(this.look.sunLight)
    this.sunLight.intensity = this.look.sunIntensity
    this.sunLight.position.copy(this.look.sunDir).multiplyScalar(180)
    this.hemiLight.color.copy(this.look.hemiSky)
    this.hemiLight.groundColor.copy(this.look.hemiGround)
    this.hemiLight.intensity = this.look.hemiIntensity
    if (this.renderer) this.renderer.toneMappingExposure = this.look.exposure

    this.skyUniforms.uZenith.value.copy(this.look.zenith)
    this.skyUniforms.uHorizon.value.copy(this.look.horizon)
    this.skyUniforms.uSunColor.value.copy(this.look.sun)
    this.skyUniforms.uSunDir.value.copy(this.look.sunDir)
    this.skyUniforms.uSunPower.value = this.look.sunPower
    this.skyUniforms.uGalaxy.value = this.look.galaxy

    this.waterUniforms.uZenith?.value.copy(this.look.zenith)
    this.waterUniforms.uHorizon?.value.copy(this.look.horizon)
    this.waterUniforms.uSunColor?.value.copy(this.look.sun)
    this.waterUniforms.uSunDir?.value.copy(this.look.sunDir)
    if (this.waterUniforms.uSunPower) this.waterUniforms.uSunPower.value = this.look.sunPower
    this.waterUniforms.uDeep?.value.copy(this.look.waterDeep)

    this.grassUniforms.uSunColor?.value.copy(this.look.sunLight)
    if (this.grassUniforms.uTip) this.grassUniforms.uTip.value = this.look.grassTip
    this.mistUniforms?.uColor.value.copy(this.look.fog)
    const ambient = this.look.hemiSky.clone().multiplyScalar(0.42).lerp(this.look.hemiGround, 0.45)
    this.grassUniforms.uAmbient?.value.copy(ambient)
    this.grassUniforms.uSunDir?.value.copy(this.look.sunDir)
    if (this.grassUniforms.uSunPower) this.grassUniforms.uSunPower.value = this.look.sunPower
    if (this.grassUniforms.uGalaxy) this.grassUniforms.uGalaxy.value = this.look.galaxy

    if (this.starUniforms.uStars) this.starUniforms.uStars.value = this.look.stars
  }

  private updateCamera(dt: number) {
    if (this.descent.active) {
      this.updateDescentCamera()
      return
    }

    if (this.flight) {
      const flight = this.flight
      flight.time += dt
      const raw = clamp(flight.time / flight.duration, 0, 1)
      const k = flight.ease(raw)
      this.camPos.lerpVectors(flight.fromPos, flight.toPos, k)
      this.lookCurrent.lerpVectors(flight.fromLook, flight.toLook, k)
      this.fov = flight.fromFov + (flight.toFov - flight.fromFov) * k
      if (raw >= 1) {
        this.camPos.copy(flight.toPos)
        this.lookCurrent.copy(flight.toLook)
        this.fov = flight.toFov
        this.flight = null
        this.syncAngles()
      }
    } else {
      this.updateRoam(dt)
      if (this.lookAxis.x !== 0 || this.lookAxis.y !== 0) {
        this.targetYaw += this.lookAxis.x * dt * 1.6
        this.targetPitch = clamp(this.targetPitch + this.lookAxis.y * dt * 1.1, -1.15, 1.28)
      }
      const damp = 1 - Math.exp(-dt * 9)
      this.yaw += (this.targetYaw - this.yaw) * damp
      this.pitch += (this.targetPitch - this.pitch) * damp
      const cosPitch = Math.cos(this.pitch)
      const dir = new THREE.Vector3(
        Math.sin(this.yaw) * cosPitch,
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * cosPitch,
      )
      this.lookCurrent.copy(this.camPos).addScaledVector(dir, 20)
      this.fov += (this.fovTarget - this.fov) * damp
    }

    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.lookCurrent)
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }

    this.skyGroup.position.copy(this.camera.position)
    if (this.starUniforms.uPixel) this.starUniforms.uPixel.value = this.renderer?.getPixelRatio() ?? 1
  }

  private updateWorld(dt: number) {
    if (this.grassUniforms.uTime) this.grassUniforms.uTime.value = this.elapsed
    if (this.grassUniforms.uCamXZ) {
      this.grassUniforms.uCamXZ.value.set(this.camera.position.x, this.camera.position.z)
    }
    if (this.mistUniforms) this.mistUniforms.uTime.value = this.elapsed
    if (this.skyUniforms.uTime) this.skyUniforms.uTime.value = this.elapsed
    if (this.wake && this.renderer && !this.lowDetail && !this.calmMotion) {
      const player = new THREE.Vector2(this.camPos.x, this.camPos.z)
      const cursor = new THREE.Vector2(this.grassUniforms.uCursorPos.value.x, this.grassUniforms.uCursorPos.value.z)
      this.wake.update(this.renderer, player, cursor, this.walkTarget !== null || this.keys.size > 0)
      this.grassUniforms.uWakeTex.value = this.wake.texture
    }
    this.windLevel += (this.windTarget - this.windLevel) * (1 - Math.exp(-dt * 1.4))
    if (this.grassUniforms.uWind) this.grassUniforms.uWind.value = this.windLevel

    this.skyUniforms.uGalaxyBoost.value = Math.max(0, this.skyUniforms.uGalaxyBoost.value - dt * 0.12)
    const boost = this.starUniforms.uBoost
    if (boost) boost.value = Math.max(1, boost.value - dt * 0.25)

    if (this.waterUniforms.uTime) this.waterUniforms.uTime.value = this.elapsed
    if (this.pollenUniforms.uTime) this.pollenUniforms.uTime.value = this.elapsed
    if (this.petalUniforms.uTime) this.petalUniforms.uTime.value = this.elapsed
    if (this.starUniforms.uTime) this.starUniforms.uTime.value = this.elapsed
    if (this.pollenUniforms.uOpacity) {
      this.pollenUniforms.uOpacity.value = (0.4 + this.windLevel * 0.16) * (1 - this.look.galaxy * 0.72)
    }

    const callBoost = this.callWave?.active
      ? Math.sin(Math.min(1, this.callWave.age / 2.4) * Math.PI)
      : 0
    const pulse = 0.55 + 0.45 * Math.sin(this.elapsed * 1.6)
    for (const [id, beacon] of Object.entries(this.beacons)) {
      if (!beacon) continue
      const activeTarget = this.activeTask === null || this.activeTask === id ? 0.95 : 0.16
      beacon.active += (activeTarget - beacon.active) * (1 - Math.exp(-dt * 3))
      const phase = id === 'flower' ? 0 : id === 'wind' ? 2 : 4
      const wave = 0.5 + 0.5 * Math.sin(this.elapsed * 1.2 + phase)
      beacon.group.position.y = beacon.baseY + Math.sin(this.elapsed * 0.9 + phase * 0.35) * 0.18
      beacon.halo.material.opacity = 0.16 + beacon.active * 0.34 * (0.7 + wave * 0.3) + callBoost * 0.38
      beacon.halo.scale.setScalar(2.2 + wave * 0.4 + beacon.active * 0.55 + callBoost * 0.9)
      beacon.core.scale.setScalar(0.9 + wave * 0.12)
      beacon.rings.forEach((ring, i) => {
        ring.rotation.z += dt * (0.4 + i * 0.25)
        ring.rotation.y += dt * 0.18
        ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.1 + beacon.active * 0.34
      })
      ;(beacon.beam.material as THREE.MeshBasicMaterial).opacity = 0.004 + beacon.active * 0.01
    }

    if (this.sanctuaryRuneMat) {
      this.sanctuaryRuneMat.opacity = Math.min(
        1,
        0.28 + 0.14 * Math.sin(this.elapsed * 1.5) + this.sanctuaryRuneLevel * 0.18 + callBoost * 0.48,
      )
    }
    if (this.lakeBoat) {
      this.lakeBoat.position.y = LAKE.y + 0.06 + Math.sin(this.elapsed * 1.15) * 0.045
      this.lakeBoat.rotation.x = Math.sin(this.elapsed * 0.9) * 0.03
      this.lakeBoat.rotation.z = Math.cos(this.elapsed * 1.05) * 0.04
    }
    for (const bird of this.skyBirds) {
      bird.angle += bird.speed * dt
      const bx = -12 + Math.cos(bird.angle) * bird.radius
      const bz = -36 + Math.sin(bird.angle) * bird.radius * 0.72
      const by = bird.baseY + Math.sin(this.elapsed * 0.8 + bird.phase) * 1.2
      bird.group.position.set(bx, by, bz)
      bird.group.rotation.y = -bird.angle
      const flap = Math.sin(this.elapsed * 5.2 + bird.phase) * 0.42
      bird.wings[0].rotation.z = flap
      bird.wings[1].rotation.z = -flap
    }

    if (this.heroFlowerGlow) {
      const material = this.heroFlowerGlow.material as THREE.SpriteMaterial
      material.opacity = 0.07 + pulse * 0.05
      this.heroFlowerGlow.scale.setScalar(0.95 + Math.sin(this.elapsed * 1.4) * 0.08)
    }
    for (const material of this.heroBloomMaterials) {
      material.emissiveIntensity = 0.16 + pulse * 0.2
    }
    if (this.focusRing?.visible) {
      this.focusRing.children[0].rotation.z += dt * 0.22
      this.focusRing.children[1].rotation.z -= dt * (0.3 + this.focusRingProgress * 0.7)
    }

    const burst = Number(this.petalUniforms.uBurst.value) || 0
    this.petalUniforms.uOpacity.value = Math.min(
      1,
      Number(this.petalUniforms.uOpacity.value) + dt * 0.15 * burst,
    )

    if (this.vehicle) {
      this.vehicle.position.y = -290.5 + Math.sin(this.elapsed * 0.4) * 0.32
      this.vehicle.rotation.y = 0.82 + Math.sin(this.elapsed * 0.17) * 0.07
      this.vehicle.rotation.z = 0.04 + Math.sin(this.elapsed * 0.23) * 0.02
    }
    if (this.vehicleCommsRing) {
      this.vehicleCommsRing.rotation.z += dt * 0.45
    }
    this.magmaGroup.rotation.y = this.elapsed * 0.025
    if (this.warpStreams) {
      this.warpStreams.rotation.y = this.elapsed * 0.38
    }
    if (this.coreAccretionGroup) {
      this.coreAccretionGroup.rotation.z = this.elapsed * 0.04
      this.coreAccretionGroup.rotation.y = Math.sin(this.elapsed * 0.15) * 0.08
    }
    if (this.vehicleBeacon) {
      const blink = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(this.elapsed * 1.7), 6)
      ;(this.vehicleBeacon.glow.material as THREE.SpriteMaterial).opacity = blink
      this.vehicleBeacon.glow.scale.setScalar(1.0 + blink * 1.1)
      this.vehicleBeacon.light.intensity = 4 + blink * 10
      this.vehicleBeacon.mesh.scale.setScalar(0.9 + blink * 0.22)
    }
    if (this.coreSparks) {
      this.coreSparks.rotation.y = this.elapsed * 0.02
    }

    if (this.dustMote) this.dustMote.uniforms.uTime.value = this.elapsed
    if (this.magmaSparks) this.magmaSparks.uniforms.uTime.value = this.elapsed
    this.magmaUniforms.uTime.value = this.elapsed

    this.grassUniforms.uPlayerPos?.value.copy(this.camPos)
    const cursorUniform = this.grassUniforms.uCursorPos?.value as THREE.Vector3 | undefined
    if (cursorUniform) {
      if (this.cursorWorld.x > 500 || cursorUniform.x > 500) {
        cursorUniform.copy(this.cursorWorld)
      } else {
        cursorUniform.lerp(this.cursorWorld, Math.min(1, dt * 12))
      }
    }

    this.updateWalkMarker(dt)
    this.updateCallWave(dt)
    this.updateDandelion(dt)
    this.updateFireflies(dt)
    this.updateHoverMotes(dt)
    this.updateRipples(dt)
    this.updateRain(dt)
    this.updateConstellation()
    this.updateMeteor(dt)
  }

  // ---------------------------------------------------------------- descent

  private updateDescent(dt: number) {
    const d = this.descent
    if (d.arrived) {
      this.idleAtCore(dt)
      return
    }
    d.time += dt
    const t = d.time

    if (!d.breached && t >= 2.42) {
      d.breached = true
      this.surfaceGroup.visible = false
      this.undergroundGroup.visible = true
      this.scene.background = new THREE.Color('#05070a')
      this.undergroundLook.fog.set('#0b0e13')
      this.undergroundLook.density = 0.012
      if (this.dustMote) this.dustMote.uniforms.uOpacity.value = 0.32
      if (this.rockTunnel) this.rockTunnel.visible = true
      this.options.onDescentEvent?.({ type: 'breach' })
    }
    if (!d.mantle && t >= 3.55) {
      d.mantle = true
      this.magmaGroup.visible = true
      this.magmaUniforms.uOpacity.value = 0.78
      if (this.magmaSparks) this.magmaSparks.uniforms.uOpacity.value = 0.8
      if (this.dustMote) this.dustMote.uniforms.uOpacity.value = 0.1
      this.undergroundLook.fog.set('#2a0d06')
      this.undergroundLook.density = 0.009
      this.options.onDescentEvent?.({ type: 'mantle' })
    }
    if (!d.core && t >= 6.2) {
      d.core = true
      this.coreGroup.visible = true
      this.magmaUniforms.uOpacity.value = 0.28
      if (this.magmaSparks) this.magmaSparks.uniforms.uOpacity.value = 0
      if (this.dustMote) this.dustMote.uniforms.uOpacity.value = 0
      this.undergroundLook.fog.set('#060304')
      this.undergroundLook.density = 0.005
      this.options.onDescentEvent?.({ type: 'core' })
    }

    if (t >= 9.15 && !d.arrived) {
      d.arrived = true
      this.camPos.set(0, -291.6, 9)
      this.lookCurrent.set(0, -293.6, -40)
      this.fov = 50
      this.camera.position.copy(this.camPos)
      this.camera.lookAt(this.lookCurrent)
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
      this.options.onDescentEvent?.({ type: 'arrive' })
      return
    }

    const progress = clamp(t / 9.15, 0, 1)
    if (t - d.lastTick > 0.12) {
      d.lastTick = t
      this.options.onDescentEvent?.({ type: 'tick', progress })
    }

    // waypoint interpolation
    const startPos = d.startPos
    const startLook = d.startLook
    const rise = startPos.clone().add(new THREE.Vector3(0, 17, 2))
    const riseLook = new THREE.Vector3(0, startPos.y - 6, -28)
    const dive = new THREE.Vector3(0, -15, 1)
    const diveLook = new THREE.Vector3(0, -80, 0)
    const rock = new THREE.Vector3(0, -110, 0)
    const rockLook = new THREE.Vector3(0, -190, 0)
    const magma = new THREE.Vector3(0, -238, 0)
    const magmaLook = new THREE.Vector3(0, -300, 0)
    const core = new THREE.Vector3(0, -291.6, 9)
    const coreLook = new THREE.Vector3(0, -293.6, -40)

    let pos: THREE.Vector3
    let look: THREE.Vector3
    let fov = this.fov

    if (t < 1.4) {
      const k = easeInOutCubic(t / 1.4)
      pos = startPos.clone().lerp(rise, k)
      look = startLook.clone().lerp(riseLook, k)
      fov = d.startFov + (52 - d.startFov) * k
    } else if (t < 2.6) {
      const k = easeInCubic((t - 1.4) / 1.2)
      pos = rise.clone().lerp(dive, k)
      look = riseLook.clone().lerp(diveLook, k)
      fov = 52 + 4 * k
    } else if (t < 4.7) {
      const k = (t - 2.6) / 2.1
      pos = dive.clone().lerp(rock, easeInOutSine(k))
      look = diveLook.clone().lerp(rockLook, k)
      fov = 56
    } else if (t < 6.7) {
      const k = (t - 4.7) / 2
      pos = rock.clone().lerp(magma, easeInOutSine(k))
      look = rockLook.clone().lerp(magmaLook, k)
      fov = 56
    } else {
      const k = easeInOutCubic((t - 6.7) / 2.45)
      pos = magma.clone().lerp(core, k)
      look = magmaLook.clone().lerp(coreLook, k)
      fov = 56 + (52 - 56) * k
    }

    if (t > 2.9 && t < 6.8) {
      const sway = Math.sin((t - 2.9) * 0.8)
      pos.x += sway * 1.15
      pos.z += Math.cos((t - 2.9) * 0.62) * 0.9
      look.x += sway * 2.6
      look.z -= 9
    }

    this.camPos.copy(pos)
    this.lookCurrent.copy(look)
    this.fov = fov
    this.updateDescentCamera()

    this.dustMote?.points.position.set(pos.x, pos.y, pos.z)
    if (this.magmaSparks) this.magmaSparks.points.position.set(pos.x, pos.y, pos.z)
    this.undergroundLook.density = d.core ? 0.005 : d.mantle ? 0.009 : 0.012
    this.undergroundLook.fog.set(d.core ? '#060304' : d.mantle ? '#2a0d06' : '#0b0e13')
  }

  private updateDescentCamera() {
    const shakeAmp =
      this.descent.time < 2.6 && this.descent.time > 1.3
        ? 0.16 * (1 - Math.abs(this.descent.time - 1.95) / 0.7)
        : this.descent.time > 4.4 && this.descent.time < 7
          ? 0.05
          : 0.015
    const shake = new THREE.Vector3(
      Math.sin(this.elapsed * 41.7) * shakeAmp,
      Math.sin(this.elapsed * 37.3 + 1.3) * shakeAmp,
      Math.sin(this.elapsed * 29.1 + 2.1) * shakeAmp,
    )
    this.camera.position.copy(this.camPos).add(shake)
    this.camera.lookAt(this.lookCurrent)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
  }

  private idleAtCore(dt: number) {
    const side = Math.sin(this.elapsed * 0.12) * 1.8
    this.camPos.set(side, -291.6 + Math.sin(this.elapsed * 0.21) * 0.25, 9.4)
    this.lookCurrent.set(Math.sin(this.elapsed * 0.16) * 0.7, -293.5, -40)
    this.fov += (52 - this.fov) * (1 - Math.exp(-dt * 1.5))
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.lookCurrent)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
  }

  private syncAngles() {
    const dir = this.lookCurrent.clone().sub(this.camPos).normalize()
    this.pitch = Math.asin(clamp(dir.y, -1, 1))
    this.yaw = Math.atan2(dir.x, -dir.z)
    this.targetPitch = this.pitch
    this.targetYaw = this.yaw
    this.fovTarget = this.fov
  }
}
