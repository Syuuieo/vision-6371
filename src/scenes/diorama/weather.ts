import * as THREE from 'three'
import type { DioramaWeather } from './types'

const RAIN_COUNT = 650
const SNOW_COUNT = 520
const FIELD_RADIUS = 70
const FIELD_HEIGHT = 42

function nextRand(seedRef: { v: number }) {
  seedRef.v = (seedRef.v * 16807) % 2147483647
  return (seedRef.v - 1) / 2147483646
}

/**
 * 实时 3D 晴 / 雨 / 雪天气粒子引擎：
 * - rain: 650 条倾斜高速 3D 雨丝（LineSegments）+ 平滑雨势强度驱动镜面水波多点雨滴涟漪
 * - snow: 520 片三维正弦飘落柔光雪花（Points）
 */
export class DioramaWeatherSystem {
  readonly group = new THREE.Group()

  private weather: DioramaWeather = 'clear'
  private rainIntensity = 0
  private snowIntensity = 0

  private readonly rainLines: THREE.LineSegments
  private readonly rainMat: THREE.LineBasicMaterial
  private readonly rainPositions: Float32Array
  private readonly rainSpeeds: Float32Array
  private readonly rainOffsets: Float32Array

  private readonly snowPoints: THREE.Points
  private readonly snowMat: THREE.PointsMaterial
  private readonly snowPositions: Float32Array
  private readonly snowSpeeds: Float32Array
  private readonly snowPhases: Float32Array
  private readonly snowOffsets: Float32Array

  constructor(glowHalo: THREE.Texture) {
    this.group.name = 'weather-system'
    const seed = { v: 82741 }

    // 1. 3D 斜雨丝
    this.rainPositions = new Float32Array(RAIN_COUNT * 6)
    this.rainSpeeds = new Float32Array(RAIN_COUNT)
    this.rainOffsets = new Float32Array(RAIN_COUNT * 3)
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const rx = (nextRand(seed) - 0.5) * FIELD_RADIUS * 2
      const ry = nextRand(seed) * FIELD_HEIGHT
      const rz = (nextRand(seed) - 0.5) * FIELD_RADIUS * 2
      this.rainOffsets[i * 3] = rx
      this.rainOffsets[i * 3 + 1] = ry
      this.rainOffsets[i * 3 + 2] = rz
      this.rainSpeeds[i] = 17 + nextRand(seed) * 9
    }
    const rainGeo = new THREE.BufferGeometry()
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3))
    this.rainMat = new THREE.LineBasicMaterial({
      color: '#b8d6f0',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    this.rainLines = new THREE.LineSegments(rainGeo, this.rainMat)
    this.rainLines.frustumCulled = false
    this.rainLines.visible = false
    this.group.add(this.rainLines)

    // 2. 3D 柔光雪花
    this.snowPositions = new Float32Array(SNOW_COUNT * 3)
    this.snowSpeeds = new Float32Array(SNOW_COUNT)
    this.snowPhases = new Float32Array(SNOW_COUNT)
    this.snowOffsets = new Float32Array(SNOW_COUNT * 3)
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const sx = (nextRand(seed) - 0.5) * FIELD_RADIUS * 2
      const sy = nextRand(seed) * FIELD_HEIGHT
      const sz = (nextRand(seed) - 0.5) * FIELD_RADIUS * 2
      this.snowOffsets[i * 3] = sx
      this.snowOffsets[i * 3 + 1] = sy
      this.snowOffsets[i * 3 + 2] = sz
      this.snowSpeeds[i] = 1.6 + nextRand(seed) * 1.8
      this.snowPhases[i] = nextRand(seed) * Math.PI * 2
    }
    const snowGeo = new THREE.BufferGeometry()
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3))
    this.snowMat = new THREE.PointsMaterial({
      map: glowHalo,
      color: '#eef6ff',
      size: 0.18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.snowPoints = new THREE.Points(snowGeo, this.snowMat)
    this.snowPoints.frustumCulled = false
    this.snowPoints.visible = false
    this.group.add(this.snowPoints)
  }

  setWeather(mode: DioramaWeather) {
    this.weather = mode
  }

  getWeather(): DioramaWeather {
    return this.weather
  }

  getRainIntensity(): number {
    return this.rainIntensity
  }

  update(elapsed: number, dt: number, anchorPos: THREE.Vector3, windGust = 0) {
    const rainTarget = this.weather === 'rain' ? 1 : 0
    const snowTarget = this.weather === 'snow' ? 1 : 0
    const k = Math.min(1, dt * 3.5)
    this.rainIntensity += (rainTarget - this.rainIntensity) * k
    this.snowIntensity += (snowTarget - this.snowIntensity) * k
    if (Math.abs(rainTarget - this.rainIntensity) < 0.005) this.rainIntensity = rainTarget
    if (Math.abs(snowTarget - this.snowIntensity) < 0.005) this.snowIntensity = snowTarget

    if (this.rainIntensity > 0.005) {
      this.rainLines.visible = true
      this.rainMat.opacity = 0.34 * this.rainIntensity
      const slantX = 0.16 + windGust * 0.45
      const dropLen = 0.78
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        const i3 = i * 3
        let ox = this.rainOffsets[i3] + slantX * this.rainSpeeds[i] * dt * 0.35
        let oy = this.rainOffsets[i3 + 1] - this.rainSpeeds[i] * dt
        if (oy < 0) oy += FIELD_HEIGHT
        if (ox > FIELD_RADIUS) ox -= FIELD_RADIUS * 2
        this.rainOffsets[i3] = ox
        this.rainOffsets[i3 + 1] = oy

        const wx = anchorPos.x + ox
        const wy = oy
        const wz = anchorPos.z + this.rainOffsets[i3 + 2]
        const i6 = i * 6
        this.rainPositions[i6] = wx
        this.rainPositions[i6 + 1] = wy
        this.rainPositions[i6 + 2] = wz
        this.rainPositions[i6 + 3] = wx - slantX * dropLen
        this.rainPositions[i6 + 4] = wy + dropLen
        this.rainPositions[i6 + 5] = wz
      }
      ;(this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    } else {
      this.rainLines.visible = false
    }

    if (this.snowIntensity > 0.005) {
      this.snowPoints.visible = true
      this.snowMat.opacity = 0.72 * this.snowIntensity
      const windPush = 0.35 + windGust * 2.2
      for (let i = 0; i < SNOW_COUNT; i += 1) {
        const i3 = i * 3
        let ox = this.snowOffsets[i3] + (Math.sin(elapsed * 0.9 + this.snowPhases[i]) * 0.45 + windPush) * dt
        let oy = this.snowOffsets[i3 + 1] - this.snowSpeeds[i] * dt
        let oz = this.snowOffsets[i3 + 2] + Math.cos(elapsed * 0.7 + this.snowPhases[i]) * 0.35 * dt
        if (oy < 0) oy += FIELD_HEIGHT
        if (ox > FIELD_RADIUS) ox -= FIELD_RADIUS * 2
        else if (ox < -FIELD_RADIUS) ox += FIELD_RADIUS * 2
        if (oz > FIELD_RADIUS) oz -= FIELD_RADIUS * 2
        else if (oz < -FIELD_RADIUS) oz += FIELD_RADIUS * 2
        this.snowOffsets[i3] = ox
        this.snowOffsets[i3 + 1] = oy
        this.snowOffsets[i3 + 2] = oz

        this.snowPositions[i3] = anchorPos.x + ox
        this.snowPositions[i3 + 1] = oy
        this.snowPositions[i3 + 2] = anchorPos.z + oz
      }
      ;(this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    } else {
      this.snowPoints.visible = false
    }
  }

  dispose() {
    this.rainLines.geometry.dispose()
    this.rainMat.dispose()
    this.snowPoints.geometry.dispose()
    this.snowMat.dispose()
  }
}
