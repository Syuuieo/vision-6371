import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { DioramaSceneId } from '../services/albumStorage'
import { buildAgraCity } from './diorama/cities/agra'
import { buildParisCity } from './diorama/cities/paris'
import { buildIcelandCity } from './diorama/cities/iceland'
import { buildDaliCity } from './diorama/cities/dali'
import { buildHarbinCity } from './diorama/cities/harbin'
import { buildKyotoCity } from './diorama/cities/kyoto'
import { buildGeorgiaCity } from './diorama/cities/georgia'
import { buildRapanuiCity } from './diorama/cities/rapanui'
import { buildGizaCity } from './diorama/cities/giza'
import { buildCore } from './diorama/buildersC'
import { buildSydney } from './diorama/buildersA'
import { buildRome } from './diorama/buildersD'
import {
  createCinemaGodRayPass,
  computeSolarProfile,
} from './diorama/cinemaPass'
import {
  createDioramaSkyDome,
  createDioramaTextures,
  createGoalBeacon,
  createMat,
  disposeDioramaTextures,
  type SkyDomeHandle,
} from './diorama/materials'
import { DioramaWeatherSystem } from './diorama/weather'
import {
  clamp,
  computeDioramaFraming,
} from './diorama/framing'
import {
  DIORAMA_SCENES,
  type DioramaBuilderCtx,
  type DioramaEncounterState,
  type DioramaFilter,
  type DioramaInteractEvent,
  type DioramaMood,
  type DioramaProgressSnapshot,
  type DioramaSceneMeta,
  type DioramaSfx,
  type DioramaTextures,
  type DioramaWeather,
  type DioramaZoomPreset,
  type InteractiveRegistration,
} from './diorama/types'

export {
  DIORAMA_SCENES,
  type DioramaEncounterState,
  type DioramaFilter,
  type DioramaInteractEvent,
  type DioramaMood,
  type DioramaProgressSnapshot,
  type DioramaSceneMeta,
  type DioramaSfx,
  type DioramaWeather,
  type DioramaZoomPreset,
}

export type DioramaCameraMode = 'orbit' | 'walk' | 'flight'

export interface DioramaWorldOptions {
  onModeChange?: (mode: DioramaCameraMode) => void
  onRideChange?: (riding: boolean) => void
  bloomEnabled?: boolean
}

interface InteractiveNode {
  mesh: THREE.Object3D
  encounterId?: string
  focusPoint?: THREE.Vector3
  onClick: (point?: THREE.Vector3) => { label: string; sfx: DioramaSfx }
}

interface NoteSpectacleSlot {
  active: boolean
  age: number
  duration: number
  group: THREE.Group
  ring: THREE.Mesh
  ringMat: THREE.MeshBasicMaterial
  motes: THREE.Points
  motesMat: THREE.PointsMaterial
  motePos: Float32Array
  moteAngles: Float32Array
  moteRadialSpeed: Float32Array
  moteRiseSpeed: Float32Array
}

interface WindStreakSlot {
  active: boolean
  age: number
  duration: number
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  startX: number
  baseY: number
  baseZ: number
  speed: number
  wavePhase: number
  waveAmp: number
  scaleX: number
}

const WIND_STREAK_TINT: Record<DioramaSceneId, string> = {
  agra: '#ffe2c6',
  rapanui: '#ffd8a8',
  sydney: '#a8ecff',
  giza: '#f5cc82',
  harbin: '#d8eeff',
  georgia: '#ffd6c4',
  iceland: '#7ef7d4',
  kyoto: '#ffc4d8',
  core: '#ffab52',
  rome: '#f2c98d',
  paris: '#f3b7c8',
  dali: '#b9d8ef',
}

const BLOOM_BOOST_SCENES = new Set<DioramaSceneId>(['iceland', 'georgia', 'core'])
const NATIVE_1TO1_SCENES = new Set<DioramaSceneId>([
  'agra',
  'rapanui',
  'giza',
  'paris',
  'iceland',
  'dali',
  'harbin',
  'rome',
  'kyoto',
  'georgia',
])
const AMBIENT_MOTE_COUNT = 28
const NOTE_SPECTACLE_POOL_SIZE = 14
const NOTE_MOTE_COUNT = 4
const WIND_STREAK_POOL_SIZE = 10
export const WORLD_SCALE = 2.4
const CINEMATIC_DISTANCE = 24
const CINEMATIC_MIN_DISTANCE = 14
const CINEMATIC_MAX_DISTANCE = 34
const WALK_RADIUS = 18
const FLIGHT_RADIUS = 60
const WALK_SPEED = 3.8
const FLIGHT_SPEED = 7.6
const FLIGHT_HEIGHT_MIN = 1.8
const FLIGHT_HEIGHT_MAX = 60

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    } else if (obj instanceof THREE.Sprite) {
      obj.material.dispose()
    }
  })
}

export function buildEncounterSnapshot(
  sceneId: DioramaSceneId,
  discoveredIds: ReadonlySet<string>,
): DioramaProgressSnapshot {
  const meta = DIORAMA_SCENES.find((s) => s.id === sceneId) ?? DIORAMA_SCENES[0]
  const encounters: DioramaEncounterState[] = meta.encounters.map((g) => ({
    ...g,
    done: discoveredIds.has(g.id),
  }))
  const discovered = encounters.filter((g) => g.done).length
  return {
    sceneId,
    encounters,
    discovered,
    total: encounters.length,
    awakened: discovered >= encounters.length,
  }
}

/**
 * 风信奇境馆 · 12 座可走进的 3D 世界渲染与互动引擎：
 * - 实时 HDR/ACES 光影 + 软阴影 + 程序化梯度天空穹与 GLSL 动态水波/极光/地核岩浆；
 * - 12 座雕刻级世界城景模型 + 三段式「奇境奇遇」一键触发与 3D 终局奇观动画；
 * - 电影全景与第一人称「漫步场景」丝滑切换、晨曦/暮色/星夜三态与胶片滤镜抓拍。
 */
export class DioramaWorld {
  private readonly host: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly renderPass: RenderPass
  private readonly bloomPass: UnrealBloomPass
  private readonly cinemaPass: ReturnType<typeof createCinemaGodRayPass>
  private readonly smaaPass: SMAAPass
  private readonly outputPass: OutputPass
  private readonly weatherSystem: DioramaWeatherSystem
  private readonly fog = new THREE.FogExp2('#df946e', 0.0082)
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly worldGroup = new THREE.Group()
  private readonly atmosphereGroup = new THREE.Group()
  private readonly keyLight: THREE.DirectionalLight
  private readonly fillLight: THREE.DirectionalLight
  private readonly rimLight: THREE.DirectionalLight
  private readonly hemiLight: THREE.HemisphereLight
  private readonly skyDome: SkyDomeHandle
  private readonly pmremGenerator: THREE.PMREMGenerator
  private envRT: THREE.WebGLRenderTarget | null = null
  private readonly hdrCache = new Map<string, THREE.WebGLRenderTarget>()
  private readonly hdrLoader = new RGBELoader()
  private hdrLoadToken = 0
  private readonly textures: DioramaTextures
  private readonly timer = new THREE.Timer()

  private readonly ambientMotes: THREE.Points
  private readonly ambientMoteMat: THREE.PointsMaterial
  private readonly ambientMotePos: Float32Array
  private readonly ambientMoteBaseY: Float32Array
  private readonly ambientMotePhase: Float32Array
  private readonly ambientMoteSpeed: Float32Array

  private readonly spectacleRingGeo: THREE.RingGeometry
  private readonly spectaclePool: NoteSpectacleSlot[] = []
  private spectacleCursor = 0

  private readonly windStreakGeo: THREE.PlaneGeometry
  private readonly windStreakPool: WindStreakSlot[] = []
  private windStreakCursor = 0
  private windGust = 0
  private windRippleCooldown = 0
  private windSpawnAccum = 0

  private bloomEnabled = true
  private baseBloomStrength = 0.4
  private bloomPulse = 0

  private sceneId: DioramaSceneId = 'agra'
  private mood: DioramaMood = 'dusk'
  private autoOrbit = false
  private orbitDir = 1
  private onInteract?: (event: DioramaInteractEvent) => void
  private onProgress?: (snapshot: DioramaProgressSnapshot) => void
  private onContextLost?: (lost: boolean) => void
  private onModeChange?: (mode: DioramaCameraMode) => void
  private onRideChange?: (riding: boolean) => void
  private inputPaused = false
  private flowPaused = false
  private timeOfDay = 18.1
  private weather: DioramaWeather = 'clear'
  private ridingMode = false
  private flashSafe = false
  private pmremDebounceTimer: number | null = null
  private readonly currentSunDir = new THREE.Vector3(-0.04, 0.115, -0.99).normalize()
  private readonly tmpSunWorld = new THREE.Vector3()

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    this.renderer.setAnimationLoop(null)
    this.onContextLost?.(true)
  }

  private readonly handleContextRestored = () => {
    this.onContextLost?.(false)
    if (!this.disposed) {
      this.renderer.setAnimationLoop(() => this.renderFrame())
    }
  }

  private interactives: InteractiveNode[] = []
  private hitMeshes: THREE.Object3D[] = []
  private discoveredEncounters = new Set<string>()
  private encounterFocusMap = new Map<string, THREE.Vector3>()
  private unlockedAwakened = false
  private tickHooks: ((elapsed: number, dt: number) => void)[] = []
  private moodHooks: ((mood: DioramaMood) => void)[] = []
  private timeHooks: ((hour: number, nightFactor: number) => void)[] = []
  private weatherHooks: ((weather: DioramaWeather, rainIntensity: number) => void)[] = []
  private walkHeightSampler: ((x: number, z: number) => number | null) | null = null
  private rideAnchorFn: (() => { pos: THREE.Vector3; yawOffset?: number } | null) | null = null
  private vantageAnchor: { label: string; pos: [number, number, number]; yaw: number; pitch: number } | null = null
  private waterRippleFn: ((x: number, z: number) => void) | null = null
  private waterBioFn: ((bio: number) => void) | null = null
  private waterMoodFn: ((fogHex: string, sunHex?: string, sunDir?: [number, number, number]) => void) | null = null
  private isNativeScene = false
  private framingView: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null
  private wishTrigger: (() => { label: string; sfx: DioramaSfx }) | null = null
  private disposeHooks: (() => void)[] = []
  private finaleTrigger: (() => void) | null = null
  private goalBeacon: THREE.Group | null = null
  private beaconLife = 0
  private interactionCount = 0

  private azimuth = 0.52
  private targetAzimuth = 0.52
  private polar = 0.42
  private targetPolar = 0.42
  private distance = CINEMATIC_DISTANCE
  private targetDistance = CINEMATIC_DISTANCE
  private distanceScale = 1
  private orbitBaseFov = 40
  private walkMode = true
  private flightMode = false
  private flightRoll = 0
  private lastSpaceTime = 0
  private walkBlend = 1
  private readonly walkPos = new THREE.Vector3(0, 1.7, 6.8)
  private readonly walkTargetPos = new THREE.Vector3(0, 1.7, 6.8)
  private walkYaw = Math.PI
  private walkTargetYaw = Math.PI
  private walkPitch = 0.12
  private walkTargetPitch = 0.12
  private walkFov = 58
  private walkTargetFov = 58
  private readonly keysPressed = new Set<string>()
  private readonly tmpOrbitPos = new THREE.Vector3()
  private readonly tmpOrbitLook = new THREE.Vector3(0, 3.2, -1.2)
  private readonly tmpWalkLook = new THREE.Vector3()
  private readonly tmpLookTarget = new THREE.Vector3()
  private pointer = { down: false, id: -1, lastX: 0, lastY: 0, moved: 0 }
  private readonly activePointers = new Map<number, { x: number; y: number }>()
  private pinch = {
    active: false,
    startDist: 0,
    baseDistance: CINEMATIC_DISTANCE,
    hadPinch: false,
  }

  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly resizeObserver: ResizeObserver
  private disposed = false

  constructor(
    host: HTMLElement,
    initialScene: DioramaSceneId,
    onInteract?: (event: DioramaInteractEvent) => void,
    onProgress?: (snapshot: DioramaProgressSnapshot) => void,
    onContextLost?: (lost: boolean) => void,
    options?: DioramaWorldOptions,
  ) {
    this.host = host
    this.sceneId = initialScene
    this.onInteract = onInteract
    this.onProgress = onProgress
    this.onContextLost = onContextLost
    this.onModeChange = options?.onModeChange
    this.onRideChange = options?.onRideChange
    this.bloomEnabled = options?.bloomEnabled ?? true

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.92
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap

    const dom = this.renderer.domElement
    dom.style.position = 'absolute'
    dom.style.inset = '0'
    dom.style.width = '100%'
    dom.style.height = '100%'
    dom.style.display = 'block'
    dom.style.touchAction = 'none'
    dom.style.cursor = 'grab'
    host.appendChild(dom)

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.15, 360)
    this.scene.fog = this.fog
    this.worldGroup.scale.setScalar(WORLD_SCALE)
    this.textures = createDioramaTextures()

    const initW = Math.max(2, host.clientWidth)
    const initH = Math.max(2, host.clientHeight)
    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(initW, initH), 0.26, 0.48, 0.8)
    this.bloomPass.enabled = this.bloomEnabled
    this.cinemaPass = createCinemaGodRayPass()
    this.smaaPass = new SMAAPass()
    this.outputPass = new OutputPass()
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(this.cinemaPass.pass)
    this.composer.addPass(this.smaaPass)
    this.composer.addPass(this.outputPass)

    this.skyDome = createDioramaSkyDome()
    this.scene.add(this.skyDome.mesh)
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    this.pmremGenerator.compileEquirectangularShader()
    this.scene.add(this.worldGroup)
    this.weatherSystem = new DioramaWeatherSystem(this.textures.glowHalo)
    this.atmosphereGroup.add(this.weatherSystem.group)
    this.scene.add(this.atmosphereGroup)

    this.ambientMotePos = new Float32Array(AMBIENT_MOTE_COUNT * 3)
    this.ambientMoteBaseY = new Float32Array(AMBIENT_MOTE_COUNT)
    this.ambientMotePhase = new Float32Array(AMBIENT_MOTE_COUNT)
    this.ambientMoteSpeed = new Float32Array(AMBIENT_MOTE_COUNT)
    let moteSeed = 42193
    const nextMoteRand = () => {
      moteSeed = (moteSeed * 16807) % 2147483647
      return (moteSeed - 1) / 2147483646
    }
    for (let i = 0; i < AMBIENT_MOTE_COUNT; i += 1) {
      this.ambientMotePos[i * 3] = (nextMoteRand() - 0.5) * 30
      const by = 0.8 + nextMoteRand() * 10.2
      this.ambientMotePos[i * 3 + 1] = by
      this.ambientMotePos[i * 3 + 2] = (nextMoteRand() - 0.5) * 30
      this.ambientMoteBaseY[i] = by
      this.ambientMotePhase[i] = nextMoteRand() * Math.PI * 2
      this.ambientMoteSpeed[i] = 0.22 + nextMoteRand() * 0.45
    }
    const ambientMoteGeo = new THREE.BufferGeometry()
    ambientMoteGeo.setAttribute('position', new THREE.BufferAttribute(this.ambientMotePos, 3))
    this.ambientMoteMat = new THREE.PointsMaterial({
      map: this.textures.glowHalo,
      color: '#f2c28b',
      size: 0.168,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.ambientMotes = new THREE.Points(ambientMoteGeo, this.ambientMoteMat)
    this.ambientMotes.frustumCulled = false
    this.atmosphereGroup.add(this.ambientMotes)

    this.spectacleRingGeo = new THREE.RingGeometry(0.22, 0.232, 64)
    this.spectacleRingGeo.rotateX(-Math.PI / 2)
    for (let i = 0; i < NOTE_SPECTACLE_POOL_SIZE; i += 1) {
      const slotGroup = new THREE.Group()
      slotGroup.visible = false

      const ringMat = new THREE.MeshBasicMaterial({
        color: '#f2c28b',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(this.spectacleRingGeo, ringMat)
      ring.position.y = 0.08
      slotGroup.add(ring)

      const motePos = new Float32Array(NOTE_MOTE_COUNT * 3)
      const moteAngles = new Float32Array(NOTE_MOTE_COUNT)
      const moteRadialSpeed = new Float32Array(NOTE_MOTE_COUNT)
      const moteRiseSpeed = new Float32Array(NOTE_MOTE_COUNT)
      for (let m = 0; m < NOTE_MOTE_COUNT; m += 1) {
        moteAngles[m] = (m / NOTE_MOTE_COUNT) * Math.PI * 2 + (m % 3) * 0.23
        moteRadialSpeed[m] = 0.08 + ((m * 37) % 10) * 0.018
        moteRiseSpeed[m] = 0.32 + ((m * 53) % 10) * 0.035
      }
      const motesGeo = new THREE.BufferGeometry()
      motesGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
      const motesMat = new THREE.PointsMaterial({
        map: this.textures.glowHalo,
        color: '#f2c28b',
        size: 0.09,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      const motes = new THREE.Points(motesGeo, motesMat)
      motes.frustumCulled = false
      slotGroup.add(motes)

      this.atmosphereGroup.add(slotGroup)
      this.spectaclePool.push({
        active: false,
        age: 0,
        duration: 2.4,
        group: slotGroup,
        ring,
        ringMat,
        motes,
        motesMat,
        motePos,
        moteAngles,
        moteRadialSpeed,
        moteRiseSpeed,
      })
    }

    this.windStreakGeo = new THREE.PlaneGeometry(1.8, 0.026, 16, 1)
    const windPositions = this.windStreakGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < windPositions.count; i += 1) {
      const x = windPositions.getX(i)
      windPositions.setY(i, windPositions.getY(i) + Math.sin((x / 1.8 + 0.5) * Math.PI) * 0.045)
    }
    for (let i = 0; i < WIND_STREAK_POOL_SIZE; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures.glowHalo,
        color: '#ffe2b4',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(this.windStreakGeo, mat)
      mesh.visible = false
      this.atmosphereGroup.add(mesh)
      this.windStreakPool.push({
        active: false,
        age: 0,
        duration: 1.8,
        mesh,
        mat,
        startX: -5,
        baseY: 1.5,
        baseZ: 0,
        speed: 3,
        wavePhase: 0,
        waveAmp: 0.12,
        scaleX: 1,
      })
    }

    this.hemiLight = new THREE.HemisphereLight('#d6e8ff', '#3a4668', 1.05)
    this.scene.add(this.hemiLight)

    this.keyLight = new THREE.DirectionalLight('#ffddb2', 2.2)
    this.keyLight.position.set(8.5, 13.5, 7.5)
    this.keyLight.castShadow = true
    const lowPowerDisplay = window.innerWidth < 768 || window.devicePixelRatio < 1.25
    this.keyLight.shadow.mapSize.set(lowPowerDisplay ? 1024 : 2048, lowPowerDisplay ? 1024 : 2048)
    this.keyLight.shadow.camera.near = 2
    this.keyLight.shadow.camera.far = 75
    this.keyLight.shadow.camera.left = -18
    this.keyLight.shadow.camera.right = 18
    this.keyLight.shadow.camera.top = 18
    this.keyLight.shadow.camera.bottom = -15
    this.keyLight.shadow.bias = -0.0022
    this.keyLight.shadow.normalBias = 0.065
    this.scene.add(this.keyLight)

    this.fillLight = new THREE.DirectionalLight('#8ab8ff', 0.8)
    this.fillLight.position.set(-9, 6, -7)
    this.scene.add(this.fillLight)

    this.rimLight = new THREE.DirectionalLight('#ffd7b2', 0.55)
    this.rimLight.position.set(-4, 5, -10)
    this.scene.add(this.rimLight)

    this.loadScene(initialScene)

    dom.addEventListener('pointerdown', this.onPointerDown)
    dom.addEventListener('pointermove', this.onPointerMove)
    dom.addEventListener('pointerup', this.onPointerUp)
    dom.addEventListener('pointercancel', this.onPointerUp)
    dom.addEventListener('wheel', this.onWheel, { passive: false })
    dom.addEventListener('webglcontextlost', this.handleContextLost)
    dom.addEventListener('webglcontextrestored', this.handleContextRestored)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onWindowBlur)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()

    this.renderer.setAnimationLoop(() => this.renderFrame())
  }

  private resize() {
    if (this.disposed) return
    const w = Math.max(2, this.host.clientWidth)
    const h = Math.max(2, this.host.clientHeight)
    const aspect = w / h
    const framing = computeDioramaFraming(aspect, this.distance)
    this.distanceScale = framing.distanceScale
    this.orbitBaseFov = framing.fov
    const t = this.walkBlend * this.walkBlend * (3 - 2 * this.walkBlend)
    this.camera.fov = this.orbitBaseFov + (this.walkFov - this.orbitBaseFov) * t
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(w, h)
  }

  private emitModeChange() {
    const mode: DioramaCameraMode = this.flightMode ? 'flight' : this.walkMode ? 'walk' : 'orbit'
    this.onModeChange?.(mode)
  }

  setInputPaused(paused: boolean) {
    this.inputPaused = paused
    if (paused) this.keysPressed.clear()
  }

  /** 暂停/恢复画境流动（冻结世界动画与渲染，仅保留最后画面） */
  setFlowPaused(paused: boolean) {
    if (this.flowPaused === paused) return
    this.flowPaused = paused
    this.renderer.setAnimationLoop(paused ? null : () => this.renderFrame())
  }

  isFlowPaused(): boolean {
    return this.flowPaused
  }

  setBloomEnabled(enabled: boolean) {
    this.bloomEnabled = enabled
    this.bloomPass.enabled = enabled
  }

  private applyWalkViewFromMeta(meta: DioramaSceneMeta, snap = false) {
    const [px, py, pz] = meta.walkView.pos
    const [lx, ly, lz] = meta.walkView.look
    this.walkTargetPos.set(px, py, pz)
    const dx = lx - px
    const dy = ly - py
    const dz = lz - pz
    const len = Math.max(0.001, Math.hypot(dx, dy, dz))
    this.walkTargetYaw = Math.atan2(dx, dz)
    this.walkTargetPitch = clamp(Math.asin(clamp(dy / len, -0.95, 0.95)), -0.68, 0.98)
    this.walkTargetFov = clamp(meta.walkView.fov, 36, 68)
    // 有地形采样器时，出生高度遵循物理地面（平台高 + 视线 1.1m）
    if (this.walkHeightSampler) {
      const h = this.walkHeightSampler(px, pz)
      if (h !== null) {
        this.walkTargetPos.y = h + 1.1
      }
    }
    if (snap) {
      this.walkPos.copy(this.walkTargetPos)
      this.walkYaw = this.walkTargetYaw
      this.walkPitch = this.walkTargetPitch
      this.walkFov = this.walkTargetFov
    }
  }

  setWalkMode(enabled: boolean) {
    if (!enabled) {
      const changed = this.walkMode || this.flightMode
      this.walkMode = false
      this.flightMode = false
      this.flightRoll = 0
      this.keysPressed.clear()
      if (changed) this.emitModeChange()
      return
    }
    if (this.walkMode) return
    this.walkMode = true
    this.flightMode = false
    this.keysPressed.clear()
    const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
    this.applyWalkViewFromMeta(meta, true)
    this.emitModeChange()
  }

  isWalkMode(): boolean {
    return this.walkMode
  }

  setFlightMode(enabled: boolean) {
    if (this.flightMode === enabled) return
    const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
    if (enabled) {
      if (!this.walkMode) {
        this.walkMode = true
        this.applyWalkViewFromMeta(meta, true)
      }
      this.flightMode = true
      this.walkTargetPos.y = clamp(Math.max(this.walkPos.y + 1.8, 3.2), FLIGHT_HEIGHT_MIN, FLIGHT_HEIGHT_MAX)
      this.walkTargetFov = 62
      this.keysPressed.delete('Space')
    } else {
      this.flightMode = false
      this.walkTargetPos.y = meta.walkView.pos[1]
      this.walkTargetFov = clamp(meta.walkView.fov, 36, 68)
      this.walkTargetPitch = clamp(this.walkTargetPitch, -0.68, 0.98)
      const radial = Math.hypot(this.walkTargetPos.x, this.walkTargetPos.z)
      if (radial > WALK_RADIUS) {
        const s = WALK_RADIUS / radial
        this.walkTargetPos.x *= s
        this.walkTargetPos.z *= s
      }
      this.keysPressed.delete('Space')
      this.keysPressed.delete('KeyR')
      this.keysPressed.delete('KeyQ')
      this.keysPressed.delete('ControlLeft')
    }
    this.emitModeChange()
  }

  isFlightMode(): boolean {
    return this.flightMode
  }

  triggerNoteSpectacle(noteIndex: number, hueHex: string) {
    if (this.disposed) return
    const slot = this.spectaclePool[this.spectacleCursor]
    this.spectacleCursor = (this.spectacleCursor + 1) % this.spectaclePool.length

    const u = ((noteIndex % 15) / 14 - 0.5) * 2
    let px: number
    let py: number
    let pz: number
    if (this.walkMode) {
      const fwdX = Math.sin(this.walkYaw)
      const fwdZ = Math.cos(this.walkYaw)
      const rightX = -fwdZ
      const rightZ = fwdX
      const dist = 4.2 + (noteIndex % 3) * 0.45
      px = clamp(this.walkPos.x + fwdX * dist + rightX * u * 2.4, -12, 12)
      pz = clamp(this.walkPos.z + fwdZ * dist + rightZ * u * 2.4, -12, 12)
      py = clamp(this.walkPos.y - 0.45 + (noteIndex % 4) * 0.14, 0.2, 12)
    } else {
      px = u * 5.5
      pz = -1.2 + Math.cos(u * 1.35) * 2.4
      py = 0.8 + (noteIndex % 5) * 0.18
    }

    slot.group.position.set(px, py, pz)
    slot.group.visible = true
    slot.active = true
    slot.age = 0
    slot.duration = 2.4

    slot.ringMat.color.set(hueHex)
    slot.motesMat.color.set(hueHex)
    slot.ringMat.opacity = 0.26
    slot.motesMat.opacity = 0.42
    slot.ring.scale.setScalar(0.45)

    for (let m = 0; m < NOTE_MOTE_COUNT; m += 1) {
      slot.motePos[m * 3] = Math.cos(slot.moteAngles[m]) * 0.08
      slot.motePos[m * 3 + 1] = 0.1 + (m % 4) * 0.06
      slot.motePos[m * 3 + 2] = Math.sin(slot.moteAngles[m]) * 0.08
    }
    const attr = slot.motes.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true

    this.waterRippleFn?.(
      clamp(px / WORLD_SCALE, -3.1, 3.1),
      clamp(pz / WORLD_SCALE, 0.35, 3.2),
    )
    this.bloomPulse = 0.05
  }

  applyWindGust(strength: number) {
    if (this.disposed) return
    const s = clamp(strength, 0, 1)
    if (s <= 0.02) return
    this.windGust = Math.max(this.windGust, s)
    if (s > 0.16) {
      this.spawnWindStreak(s)
    }
    if (s > 0.22 && this.windRippleCooldown <= 0) {
      this.waterRippleFn?.((Math.random() - 0.5) * 4.6, 0.8 + Math.random() * 2.1)
      this.windRippleCooldown = 0.28
    }
  }

  private spawnWindStreak(strength: number) {
    const slot = this.windStreakPool[this.windStreakCursor]
    this.windStreakCursor = (this.windStreakCursor + 1) % this.windStreakPool.length
    const tint = WIND_STREAK_TINT[this.sceneId] ?? '#ffe2b4'
    slot.active = true
    slot.age = 0
    slot.duration = 1.7 + Math.random() * 0.5
    slot.startX = -15 - Math.random() * 2
    slot.baseY = 0.8 + Math.random() * 10
    slot.baseZ = (Math.random() - 0.5) * 22
    slot.speed = 4.8 + strength * 4.2 + Math.random() * 1.2
    slot.wavePhase = Math.random() * Math.PI * 2
    slot.waveAmp = 0.08 + Math.random() * 0.12
    slot.scaleX = 0.7 + strength * 0.55 + Math.random() * 0.25
    slot.mat.color.set(tint)
    slot.mat.opacity = 0
    slot.mesh.position.set(slot.startX, slot.baseY, slot.baseZ)
    slot.mesh.scale.set(slot.scaleX, 0.55 + strength * 0.35, 1)
    slot.mesh.rotation.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.08)
    slot.mesh.visible = true
  }

  setFlashSafe(enabled: boolean) {
    this.flashSafe = enabled
    this.cinemaPass.uniforms.uGodRayIntensity.value = enabled ? 0.12 : 0.28
  }

  setMood(mood: DioramaMood) {
    if (this.isNativeScene && mood === this.mood) return
    this.mood = mood
    if (this.isNativeScene) {
      this.timeOfDay = mood === 'dawn' ? 6.3 : mood === 'night' ? 22.4 : 18.1
      this.applySolarProfile(this.timeOfDay, true)
      return
    }
    this.applyLighting()
  }

  setTimeOfDay(hour: number) {
    this.timeOfDay = clamp(hour, 5.0, 23.5)
    this.mood = this.timeOfDay < 9.5 ? 'dawn' : this.timeOfDay >= 19.6 ? 'night' : 'dusk'
    if (this.isNativeScene) {
      this.applySolarProfile(this.timeOfDay, false)
    } else {
      this.applyLighting()
    }
  }

  getTimeOfDay(): number {
    return this.timeOfDay
  }

  setWeather(weather: DioramaWeather) {
    this.weather = weather
    this.weatherSystem.setWeather(weather)
  }

  getWeather(): DioramaWeather {
    return this.weather
  }

  hasRideable(): boolean {
    return this.rideAnchorFn !== null
  }

  hasRideAnchor(): boolean {
    return this.rideAnchorFn !== null
  }

  getVantageLabel(): string | null {
    return this.vantageAnchor?.label ?? null
  }

  teleportToVantage() {
    if (!this.vantageAnchor) return false
    this.setRidingMode(false)
    this.walkMode = true
    this.flightMode = false
    this.walkTargetPos.set(...this.vantageAnchor.pos)
    this.walkTargetYaw = this.vantageAnchor.yaw
    this.walkTargetPitch = this.vantageAnchor.pitch
    this.emitModeChange()
    return true
  }

  isRidingMode(): boolean {
    return this.ridingMode
  }

  setRidingMode(enabled: boolean) {
    if (enabled && !this.rideAnchorFn) return
    if (this.ridingMode === enabled) return
    this.ridingMode = enabled
    if (enabled) {
      this.walkMode = true
      this.flightMode = false
      this.emitModeChange()
      const anchor = this.rideAnchorFn?.()
      if (anchor) {
        this.walkTargetPos.copy(anchor.pos)
        this.walkPos.copy(anchor.pos)
        this.walkTargetYaw = Math.PI
        this.walkTargetPitch = 0.06
      }
    } else {
      const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
      this.applyWalkViewFromMeta(meta, false)
    }
    this.onRideChange?.(this.ridingMode)
  }

  teleportToBridge() {
    this.teleportToVantage()
  }

  setAutoOrbit(enabled: boolean) {
    this.autoOrbit = enabled
  }

  setZoomPreset(preset: DioramaZoomPreset) {
    this.targetDistance =
      preset === 'wide' ? 30 : preset === 'macro' ? 18 : CINEMATIC_DISTANCE
  }

  resetView() {
    this.targetAzimuth = 0.52
    this.targetPolar = 0.42
    this.targetDistance = CINEMATIC_DISTANCE
    if (this.walkMode) {
      const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
      this.applyWalkViewFromMeta(meta, false)
    }
  }

  replayFinale() {
    this.finaleTrigger?.()
  }

  triggerWish() {
    if (!this.wishTrigger) return
    const res = this.wishTrigger()
    this.bloomPulse = Math.max(this.bloomPulse, 0.08)
    this.waterRippleFn?.(0, -14)
    this.interactionCount += 1
    this.onInteract?.({
      label: res.label,
      sfx: res.sfx,
      count: this.interactionCount,
    })
  }

  private focusPointInView(pt: THREE.Vector3, beaconSeconds = 5.5) {
    const worldPt = this.isNativeScene ? pt.clone() : pt.clone().multiplyScalar(WORLD_SCALE)
    if (this.walkMode) {
      const dx = worldPt.x - this.walkTargetPos.x
      const dy = worldPt.y - this.walkTargetPos.y
      const dz = worldPt.z - this.walkTargetPos.z
      const len = Math.max(0.001, Math.hypot(dx, dy, dz))
      this.walkTargetYaw = Math.atan2(dx, dz)
      this.walkTargetPitch = clamp(Math.asin(clamp(dy / len, -0.95, 0.95)), -0.68, 0.98)
    } else {
      const ang = Math.atan2(worldPt.x, Math.max(0.5, worldPt.z + 4.5))
      this.targetAzimuth = clamp(ang + 0.35, -0.95, 1.95)
      this.targetPolar = clamp(0.4 - worldPt.y * 0.008, 0.16, 0.56)
    }
    if (this.goalBeacon) {
      this.goalBeacon.position.set(pt.x, pt.y + 0.32, pt.z)
      this.goalBeacon.visible = true
      this.beaconLife = beaconSeconds
    }
  }

  focusNextEncounter(): string | null {
    const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
    const nextEncounter = meta.encounters.find((g) => !this.discoveredEncounters.has(g.id))
    if (!nextEncounter) {
      this.replayFinale()
      return '此场景奇遇已全部点亮 · 重放终局奇观'
    }
    const pt = this.encounterFocusMap.get(nextEncounter.id)
    if (pt) {
      this.focusPointInView(pt, 5.5)
    }
    return `指引：${nextEncounter.title}（${nextEncounter.hint}）`
  }

  triggerEncounterById(encounterId: string): boolean {
    const matching = this.interactives.filter((node) => node.encounterId === encounterId)
    if (matching.length === 0) return false

    const wasDone = this.discoveredEncounters.has(encounterId)
    const wasAwakened = this.unlockedAwakened
    let lastResult: { label: string; sfx: DioramaSfx } | null = null

    const isOffToggle = (label: string) =>
      label.includes('调暗') ||
      label.includes('轻熄') ||
      label.includes('轻掩') ||
      label.includes('抬升')

    if (wasDone) {
      let res = matching[0].onClick(matching[0].focusPoint)
      if (isOffToggle(res.label)) {
        res = matching[0].onClick(matching[0].focusPoint)
      }
      lastResult = res
    } else {
      for (const node of matching) {
        let res = node.onClick(node.focusPoint)
        if (!this.discoveredEncounters.has(encounterId) && isOffToggle(res.label)) {
          res = node.onClick(node.focusPoint)
        }
        lastResult = res
        if (this.discoveredEncounters.has(encounterId)) break
      }
    }

    const focusPt = this.encounterFocusMap.get(encounterId) ?? matching[0].focusPoint
    if (focusPt) {
      this.focusPointInView(focusPt, 3.2)
    }

    if (lastResult) {
      this.interactionCount += 1
      const justAwakened = !wasAwakened && this.unlockedAwakened
      const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
      this.onInteract?.({
        label: justAwakened ? `◆ 奇境觉醒 · ${meta.stampTitle}` : lastResult.label,
        sfx: justAwakened ? 'celebrate' : lastResult.sfx,
        count: this.interactionCount,
        awakened: justAwakened,
      })
    }
    return true
  }

  awakenAll(): string {
    const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
    for (const g of meta.encounters) {
      this.discoveredEncounters.add(g.id)
    }
    this.beaconLife = 0
    if (this.goalBeacon) this.goalBeacon.visible = false
    this.unlockedAwakened = true
    this.finaleTrigger?.()
    const snap = buildEncounterSnapshot(this.sceneId, this.discoveredEncounters)
    this.onProgress?.(snap)
    this.interactionCount += 1
    const label = `◆ 奇境觉醒 · ${meta.stampTitle}`
    this.onInteract?.({
      label,
      sfx: 'celebrate',
      count: this.interactionCount,
      awakened: true,
    })
    return label
  }

  captureFrame(filter: DioramaFilter = 'none'): string | null {
    if (this.disposed) return null
    const captureW = 1280
    const captureH = 720
    const prevPixelRatio = this.renderer.getPixelRatio()
    const prevAspect = this.camera.aspect
    const prevFov = this.camera.fov
    const prevPos = this.camera.position.clone()
    const prevQuat = this.camera.quaternion.clone()

    try {
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(captureW, captureH, false)
      this.composer.setPixelRatio(1)
      this.composer.setSize(captureW, captureH)
      this.camera.aspect = captureW / captureH
      this.camera.updateProjectionMatrix()
      this.composer.render()

      const canvas = this.renderer.domElement
      if (filter === 'none') return canvas.toDataURL('image/jpeg', 0.94)

      const out = document.createElement('canvas')
      out.width = canvas.width
      out.height = canvas.height
      const ctx = out.getContext('2d')
      if (!ctx) return canvas.toDataURL('image/jpeg', 0.94)

      ctx.filter =
        filter === 'warm'
          ? 'contrast(1.04) saturate(1.12) sepia(0.14)'
          : 'contrast(1.08) saturate(0.92) hue-rotate(-6deg)'
      ctx.drawImage(canvas, 0, 0)
      ctx.filter = 'none'

      ctx.fillStyle =
        filter === 'warm' ? 'rgba(255, 198, 128, 0.07)' : 'rgba(64, 178, 210, 0.08)'
      ctx.fillRect(0, 0, out.width, out.height)

      return out.toDataURL('image/jpeg', 0.94)
    } catch {
      return null
    } finally {
      this.renderer.setPixelRatio(prevPixelRatio)
      this.camera.fov = prevFov
      this.camera.aspect = prevAspect
      this.camera.position.copy(prevPos)
      this.camera.quaternion.copy(prevQuat)
      this.camera.updateProjectionMatrix()
      this.resize()
      this.composer.render()
    }
  }

  loadScene(id: DioramaSceneId, preAwakened = false) {
    this.sceneId = id
    this.interactionCount = 0
    this.interactives = []
    this.hitMeshes = []
    this.discoveredEncounters.clear()
    this.encounterFocusMap.clear()
    this.unlockedAwakened = preAwakened
    this.tickHooks = []
    this.moodHooks = []
    this.timeHooks = []
    this.weatherHooks = []
    for (const d of this.disposeHooks) d()
    this.disposeHooks = []
    this.framingView = null
    this.wishTrigger = null
    this.walkHeightSampler = null
    this.rideAnchorFn = null
    this.vantageAnchor = null
    if (this.ridingMode) {
      this.ridingMode = false
      this.onRideChange?.(false)
    }
    this.waterRippleFn = null
    this.waterBioFn = null
    this.waterMoodFn = null
    this.finaleTrigger = null
    this.goalBeacon = null
    this.beaconLife = 0
    this.bloomPulse = 0
    this.windGust = 0

    const isNative = NATIVE_1TO1_SCENES.has(id)
    this.isNativeScene = isNative
    this.worldGroup.scale.setScalar(isNative ? 1.0 : WORLD_SCALE)

    const sRange = isNative ? 46 : 18
    this.keyLight.shadow.camera.left = -sRange
    this.keyLight.shadow.camera.right = sRange
    this.keyLight.shadow.camera.top = sRange
    this.keyLight.shadow.camera.bottom = -sRange * 0.85
    this.keyLight.shadow.camera.far = isNative ? 160 : 75
    this.keyLight.shadow.camera.updateProjectionMatrix()

    for (const slot of this.spectaclePool) {
      slot.active = false
      slot.group.visible = false
    }
    for (const streak of this.windStreakPool) {
      streak.active = false
      streak.mesh.visible = false
    }

    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0]
      this.worldGroup.remove(child)
      disposeTree(child)
    }

    if (id !== 'core' && !isNative) {
      this.buildAmbientClouds()
    }

    const meta = DIORAMA_SCENES.find((s) => s.id === id) ?? DIORAMA_SCENES[0]
    if (isNative && meta.defaultHour !== undefined) {
      this.timeOfDay = meta.defaultHour
      this.mood = this.timeOfDay < 9.5 ? 'dawn' : this.timeOfDay >= 19.6 ? 'night' : 'dusk'
    }
    const ctx: DioramaBuilderCtx = {
      group: this.worldGroup,
      textures: this.textures,
      getMood: () => this.mood,
      registerInteractive: (mesh, opts) => this.registerInteractive(mesh, opts),
      discoverEncounter: (encounterId) => {
        if (this.discoveredEncounters.has(encounterId)) return
        this.discoveredEncounters.add(encounterId)
        this.beaconLife = 0
        if (this.goalBeacon) this.goalBeacon.visible = false
        const snap = buildEncounterSnapshot(this.sceneId, this.discoveredEncounters)
        if (snap.awakened && !this.unlockedAwakened) {
          this.unlockedAwakened = true
          this.finaleTrigger?.()
        }
        this.onProgress?.(snap)
      },
      isEncounterDone: (encounterId) => this.discoveredEncounters.has(encounterId),
      bindWater: (setRipple, setBio, setWaterMood) => {
        this.waterRippleFn = (x, z) =>
          setRipple(isNative ? x : x * WORLD_SCALE, isNative ? z : z * WORLD_SCALE)
        this.waterBioFn = setBio
        this.waterMoodFn = setWaterMood ?? null
      },
      triggerRipple: (x, z) => {
        this.waterRippleFn?.(x, z)
      },
      setWaterBio: (bio) => {
        this.waterBioFn?.(bio)
      },
      setFinaleTrigger: (fn) => {
        this.finaleTrigger = fn
      },
      addTick: (fn) => {
        this.tickHooks.push(fn)
      },
      addMoodHook: (fn) => {
        this.moodHooks.push(fn)
      },
      setWalkHeightSampler: (fn) => {
        this.walkHeightSampler = fn
      },
      setRideAnchor: (fn) => {
        this.rideAnchorFn = fn
      },
      setVantageAnchor: (vantage) => {
        this.vantageAnchor = vantage
      },
      addTimeHook: (fn) => {
        this.timeHooks.push(fn)
      },
      addWeatherHook: (fn) => {
        this.weatherHooks.push(fn)
      },
      setWishTrigger: (fn) => {
        this.wishTrigger = fn
      },
      addDisposeHook: (fn) => {
        this.disposeHooks.push(fn)
      },
      setFramingView: (view) => {
        const scale = isNative ? 1 : WORLD_SCALE
        this.framingView = {
          pos: new THREE.Vector3(...view.pos).multiplyScalar(scale),
          look: new THREE.Vector3(...view.look).multiplyScalar(scale),
          fov: view.fov,
        }
      },
    }

    switch (id) {
      case 'agra':
        buildAgraCity(ctx)
        break
      case 'rapanui':
        buildRapanuiCity(ctx)
        break
      case 'sydney':
        buildSydney(ctx)
        break
      case 'giza':
        buildGizaCity(ctx)
        break
      case 'harbin':
        buildHarbinCity(ctx)
        break
      case 'georgia':
        buildGeorgiaCity(ctx)
        break
      case 'iceland':
        buildIcelandCity(ctx)
        break
      case 'kyoto':
        buildKyotoCity(ctx)
        break
      case 'core':
        buildCore(ctx)
        break
      case 'rome':
        buildRome(ctx)
        break
      case 'paris':
        buildParisCity(ctx)
        break
      case 'dali':
        buildDaliCity(ctx)
        break
    }

    const beacon = createGoalBeacon(this.textures.glowHalo, meta.accent)
    this.worldGroup.add(beacon)
    this.goalBeacon = beacon

    this.applyLighting()
    if (this.walkMode) {
      this.targetAzimuth = 0.52
      this.targetPolar = 0.42
      this.targetDistance = CINEMATIC_DISTANCE
      this.applyWalkViewFromMeta(meta, true)
      if (this.flightMode) {
        const flightY = clamp(Math.max(meta.walkView.pos[1] + 1.8, 3.2), FLIGHT_HEIGHT_MIN, FLIGHT_HEIGHT_MAX)
        this.walkPos.y = flightY
        this.walkTargetPos.y = flightY
        this.walkFov = 62
        this.walkTargetFov = 62
      }
    } else {
      this.resetView()
    }
  }

  private registerInteractive(mesh: THREE.Object3D, opts: InteractiveRegistration) {
    const idx = this.interactives.length
    mesh.userData.interactIdx = idx
    this.interactives.push({
      mesh,
      encounterId: opts.encounterId,
      focusPoint: opts.focusPoint,
      onClick: opts.onClick,
    })
    this.hitMeshes.push(mesh)
    if (opts.encounterId && opts.focusPoint && !this.encounterFocusMap.has(opts.encounterId)) {
      this.encounterFocusMap.set(opts.encounterId, opts.focusPoint)
    }
  }

  private applyLighting() {
    const palettes: Record<
      DioramaSceneId,
      Record<
        DioramaMood,
        {
          zenith: string
          mid: string
          horizon: string
          sun: string
          key: string
          fill: string
          hemiTop: string
          hemiBot: string
          keyInt: number
          hemiInt: number
          stars: number
          sunDir: [number, number, number]
        }
      >
    > = {
      agra: {
        dawn: {
          zenith: '#426186',
          mid: '#9fb0c8',
          horizon: '#f3d2cb',
          sun: '#ff9670',
          key: '#ffe5cf',
          fill: '#98bce8',
          hemiTop: '#f2e8eb',
          hemiBot: '#3c4b5c',
          keyInt: 2.25,
          hemiInt: 1.2,
          stars: 0.0,
          sunDir: [0.38, 0.22, -0.9],
        },
        dusk: {
          zenith: '#283052',
          mid: '#7c627a',
          horizon: '#efb89e',
          sun: '#ff7d56',
          key: '#ffd2a8',
          fill: '#7d9dd2',
          hemiTop: '#f0d8dc',
          hemiBot: '#293044',
          keyInt: 2.0,
          hemiInt: 1.05,
          stars: 0.14,
          sunDir: [-0.36, 0.24, -0.9],
        },
        night: {
          zenith: '#070e20',
          mid: '#152544',
          horizon: '#2d4266',
          sun: '#dce8ff',
          key: '#b2ccf8',
          fill: '#5074c0',
          hemiTop: '#8ab0f0',
          hemiBot: '#162036',
          keyInt: 1.3,
          hemiInt: 0.82,
          stars: 0.9,
          sunDir: [-0.22, 0.36, -0.9],
        },
      },
      rapanui: {
        dawn: {
          zenith: '#284972',
          mid: '#768fb2',
          horizon: '#f5c79e',
          sun: '#ffd4a0',
          key: '#ffdaa6',
          fill: '#8ab4e6',
          hemiTop: '#e6ebf4',
          hemiBot: '#39463c',
          keyInt: 2.25,
          hemiInt: 1.15,
          stars: 0.05,
          sunDir: [0.44, 0.25, -0.86],
        },
        dusk: {
          zenith: '#182446',
          mid: '#4b5074',
          horizon: '#d8967c',
          sun: '#ffbc82',
          key: '#ffc48a',
          fill: '#829fd8',
          hemiTop: '#cad6f2',
          hemiBot: '#2e3440',
          keyInt: 1.95,
          hemiInt: 1.0,
          stars: 0.28,
          sunDir: [-0.42, 0.24, -0.87],
        },
        night: {
          zenith: '#050c1e',
          mid: '#122244',
          horizon: '#283d62',
          sun: '#a8ccff',
          key: '#9ec0f8',
          fill: '#5678be',
          hemiTop: '#8aaee8',
          hemiBot: '#1c2432',
          keyInt: 1.25,
          hemiInt: 0.82,
          stars: 0.92,
          sunDir: [-0.25, 0.5, -0.8],
        },
      },
      sydney: {
        dawn: {
          zenith: '#1f64a8',
          mid: '#5ea8dc',
          horizon: '#fff0cc',
          sun: '#fff2cf',
          key: '#fff0ca',
          fill: '#a4dcff',
          hemiTop: '#e6f6ff',
          hemiBot: '#366886',
          keyInt: 2.55,
          hemiInt: 1.28,
          stars: 0,
          sunDir: [0.6, 0.42, -0.68],
        },
        dusk: {
          zenith: '#1a4270',
          mid: '#3e7ca4',
          horizon: '#f4c094',
          sun: '#ffe2ad',
          key: '#ffe2ac',
          fill: '#90c8fa',
          hemiTop: '#d8f2ff',
          hemiBot: '#295778',
          keyInt: 2.25,
          hemiInt: 1.12,
          stars: 0.14,
          sunDir: [-0.46, 0.28, -0.84],
        },
        night: {
          zenith: '#071426',
          mid: '#122c4a',
          horizon: '#244a6e',
          sun: '#a8d4ff',
          key: '#9ecbff',
          fill: '#558ac4',
          hemiTop: '#96c6f8',
          hemiBot: '#1c3852',
          keyInt: 1.32,
          hemiInt: 0.86,
          stars: 0.9,
          sunDir: [-0.3, 0.5, -0.8],
        },
      },
      giza: {
        dawn: {
          zenith: '#2a4a78',
          mid: '#c48f6b',
          horizon: '#ffd99e',
          sun: '#ffe8b4',
          key: '#ffdf9e',
          fill: '#8db4dc',
          hemiTop: '#fff0d4',
          hemiBot: '#6a5036',
          keyInt: 2.55,
          hemiInt: 1.18,
          stars: 0,
          sunDir: [0.68, 0.34, -0.65],
        },
        dusk: {
          zenith: '#2d3258',
          mid: '#b56046',
          horizon: '#ffa95e',
          sun: '#ffd584',
          key: '#ffbf6e',
          fill: '#848ec2',
          hemiTop: '#ffcea2',
          hemiBot: '#4a3424',
          keyInt: 2.65,
          hemiInt: 0.96,
          stars: 0.03,
          sunDir: [-0.74, 0.26, -0.62],
        },
        night: {
          zenith: '#060a18',
          mid: '#121c36',
          horizon: '#283652',
          sun: '#b8d4ff',
          key: '#a4c4f4',
          fill: '#5c78b4',
          hemiTop: '#8aaee4',
          hemiBot: '#2a221a',
          keyInt: 1.28,
          hemiInt: 0.78,
          stars: 0.96,
          sunDir: [0.3, 0.52, -0.8],
        },
      },
      harbin: {
        dawn: {
          zenith: '#2e5890',
          mid: '#76a4d0',
          horizon: '#f4e0d2',
          sun: '#fff0d8',
          key: '#fff0db',
          fill: '#a8cef8',
          hemiTop: '#edf6ff',
          hemiBot: '#485a74',
          keyInt: 2.35,
          hemiInt: 1.24,
          stars: 0.04,
          sunDir: [0.48, 0.34, -0.8],
        },
        dusk: {
          zenith: '#182846',
          mid: '#385278',
          horizon: '#cf9a88',
          sun: '#ffdfb8',
          key: '#ffe2be',
          fill: '#8fb4ea',
          hemiTop: '#dceeff',
          hemiBot: '#384c6b',
          keyInt: 2.02,
          hemiInt: 1.08,
          stars: 0.28,
          sunDir: [-0.42, 0.25, -0.86],
        },
        night: {
          zenith: '#060d1c',
          mid: '#0f1d38',
          horizon: '#1c3258',
          sun: '#b0d0ff',
          key: '#a4c8ff',
          fill: '#5d84c8',
          hemiTop: '#9ec4f8',
          hemiBot: '#21324e',
          keyInt: 1.3,
          hemiInt: 0.88,
          stars: 0.95,
          sunDir: [-0.25, 0.52, -0.8],
        },
      },
      georgia: {
        dawn: {
          zenith: '#2a4a7a',
          mid: '#7691b8',
          horizon: '#f5cbb8',
          sun: '#ffd8ba',
          key: '#ffe0c6',
          fill: '#90b6ec',
          hemiTop: '#e8eff8',
          hemiBot: '#38485c',
          keyInt: 2.3,
          hemiInt: 1.18,
          stars: 0.06,
          sunDir: [0.46, 0.28, -0.84],
        },
        dusk: {
          zenith: '#141d3c',
          mid: '#3b4a78',
          horizon: '#ba8d9a',
          sun: '#ffd0c0',
          key: '#f0cebe',
          fill: '#7898e0',
          hemiTop: '#ccd8f6',
          hemiBot: '#242e48',
          keyInt: 1.9,
          hemiInt: 0.98,
          stars: 0.45,
          sunDir: [-0.42, 0.3, -0.85],
        },
        night: {
          zenith: '#030816',
          mid: '#0c1830',
          horizon: '#1f3254',
          sun: '#b8d6ff',
          key: '#a8ccff',
          fill: '#5278c4',
          hemiTop: '#8cb4f2',
          hemiBot: '#182442',
          keyInt: 1.4,
          hemiInt: 0.84,
          stars: 1.0,
          sunDir: [-0.24, 0.52, -0.8],
        },
      },
      iceland: {
        dawn: {
          zenith: '#163554',
          mid: '#3b6d8a',
          horizon: '#d8ccd2',
          sun: '#ffe8d8',
          key: '#f0ecff',
          fill: '#7ec8e8',
          hemiTop: '#d8f2ff',
          hemiBot: '#243a4d',
          keyInt: 2.1,
          hemiInt: 1.15,
          stars: 0.16,
          sunDir: [0.46, 0.28, -0.84],
        },
        dusk: {
          zenith: '#071429',
          mid: '#163b5a',
          horizon: '#4e6f8c',
          sun: '#9ef2d8',
          key: '#b6e8ff',
          fill: '#7d72d6',
          hemiTop: '#96e4ec',
          hemiBot: '#1b2b44',
          keyInt: 1.72,
          hemiInt: 0.96,
          stars: 0.72,
          sunDir: [-0.38, 0.24, -0.88],
        },
        night: {
          zenith: '#030816',
          mid: '#0a2238',
          horizon: '#1f4464',
          sun: '#86f2d8',
          key: '#94d8ff',
          fill: '#6e5cd0',
          hemiTop: '#7cd8e6',
          hemiBot: '#102033',
          keyInt: 1.35,
          hemiInt: 0.84,
          stars: 1.0,
          sunDir: [-0.22, 0.5, -0.82],
        },
      },
      kyoto: {
        dawn: {
          zenith: '#2c4f7c',
          mid: '#8f88b0',
          horizon: '#f7c5ca',
          sun: '#ffe5de',
          key: '#ffdfd6',
          fill: '#b2c8f4',
          hemiTop: '#ffeef2',
          hemiBot: '#463f52',
          keyInt: 2.3,
          hemiInt: 1.2,
          stars: 0.04,
          sunDir: [0.52, 0.34, -0.78],
        },
        dusk: {
          zenith: '#1c1d42',
          mid: '#6a446c',
          horizon: '#f09c96',
          sun: '#ffd0be',
          key: '#ffc4b0',
          fill: '#9ea8ee',
          hemiTop: '#ffd8de',
          hemiBot: '#392e46',
          keyInt: 2.02,
          hemiInt: 1.06,
          stars: 0.28,
          sunDir: [-0.42, 0.25, -0.86],
        },
        night: {
          zenith: '#070a1c',
          mid: '#181e3f',
          horizon: '#422f4d',
          sun: '#e0b8d8',
          key: '#c4b8f2',
          fill: '#7868b8',
          hemiTop: '#baaee8',
          hemiBot: '#211c33',
          keyInt: 1.26,
          hemiInt: 0.84,
          stars: 0.92,
          sunDir: [-0.26, 0.48, -0.82],
        },
      },
      core: {
        dawn: {
          zenith: '#1c0d12',
          mid: '#4d1e18',
          horizon: '#e2883e',
          sun: '#ffdc96',
          key: '#ffd28e',
          fill: '#ff7d3c',
          hemiTop: '#ffcf98',
          hemiBot: '#5e2212',
          keyInt: 2.35,
          hemiInt: 1.15,
          stars: 0.08,
          sunDir: [0.35, 0.38, -0.84],
        },
        dusk: {
          zenith: '#0e070c',
          mid: '#2f1314',
          horizon: '#bc5624',
          sun: '#ffc676',
          key: '#ffbe6e',
          fill: '#e8682c',
          hemiTop: '#ffbe82',
          hemiBot: '#4d1a10',
          keyInt: 2.05,
          hemiInt: 1.02,
          stars: 0.16,
          sunDir: [-0.32, 0.3, -0.88],
        },
        night: {
          zenith: '#050308',
          mid: '#190a10',
          horizon: '#722d16',
          sun: '#ffa654',
          key: '#ffa252',
          fill: '#b8461c',
          hemiTop: '#e89658',
          hemiBot: '#38120a',
          keyInt: 1.65,
          hemiInt: 0.9,
          stars: 0.28,
          sunDir: [-0.2, 0.46, -0.86],
        },
      },
      rome: {
        dawn: {
          zenith: '#355d78',
          mid: '#7f9aa8',
          horizon: '#e7c79d',
          sun: '#ffe2ac',
          key: '#ffe0ad',
          fill: '#8eb8ce',
          hemiTop: '#dceaf0',
          hemiBot: '#3d5260',
          keyInt: 2.25,
          hemiInt: 1.2,
          stars: 0.02,
          sunDir: [0.48, 0.3, -0.82],
        },
        dusk: {
          zenith: '#2b3459',
          mid: '#87636c',
          horizon: '#ebb47f',
          sun: '#ffd498',
          key: '#ffd094',
          fill: '#869cc4',
          hemiTop: '#f3d4b8',
          hemiBot: '#3b332d',
          keyInt: 2.1,
          hemiInt: 1.1,
          stars: 0.08,
          sunDir: [-0.46, 0.28, -0.84],
        },
        night: {
          zenith: '#071525',
          mid: '#1d344b',
          horizon: '#405d72',
          sun: '#a9cbe4',
          key: '#aacbe2',
          fill: '#54769b',
          hemiTop: '#a7c4d8',
          hemiBot: '#162c3d',
          keyInt: 1.35,
          hemiInt: 0.86,
          stars: 0.72,
          sunDir: [-0.26, 0.48, -0.84],
        },
      },
      paris: {
        dawn: {
          zenith: '#596a91',
          mid: '#ad91ad',
          horizon: '#f3c9c1',
          sun: '#ffe2c5',
          key: '#ffe0c2',
          fill: '#a9b9e4',
          hemiTop: '#eee1ec',
          hemiBot: '#56536b',
          keyInt: 2.15,
          hemiInt: 1.14,
          stars: 0.01,
          sunDir: [0.52, 0.32, -0.79],
        },
        dusk: {
          zenith: '#35274f',
          mid: '#8f6288',
          horizon: '#e69a9f',
          sun: '#ffd0a5',
          key: '#ffc4aa',
          fill: '#9c8fd2',
          hemiTop: '#e6bfd2',
          hemiBot: '#3f354f',
          keyInt: 1.9,
          hemiInt: 1.0,
          stars: 0.1,
          sunDir: [-0.4, 0.31, -0.86],
        },
        night: {
          zenith: '#100e2a',
          mid: '#302347',
          horizon: '#614563',
          sun: '#c5b7ff',
          key: '#c7baff',
          fill: '#766bb4',
          hemiTop: '#bdb5db',
          hemiBot: '#211d38',
          keyInt: 1.4,
          hemiInt: 0.82,
          stars: 0.86,
          sunDir: [-0.24, 0.5, -0.83],
        },
      },
      dali: {
        dawn: {
          zenith: '#456c8d',
          mid: '#8ba7b4',
          horizon: '#ead7bd',
          sun: '#fff0cf',
          key: '#ffe7c2',
          fill: '#8bb7cb',
          hemiTop: '#dcebf0',
          hemiBot: '#3f5960',
          keyInt: 2.2,
          hemiInt: 1.18,
          stars: 0.01,
          sunDir: [0.46, 0.36, -0.81],
        },
        dusk: {
          zenith: '#263f63',
          mid: '#637f98',
          horizon: '#c2b7ad',
          sun: '#e5edf0',
          key: '#dbe8ee',
          fill: '#7398b8',
          hemiTop: '#c8dce5',
          hemiBot: '#2c4654',
          keyInt: 1.72,
          hemiInt: 0.98,
          stars: 0.22,
          sunDir: [-0.36, 0.4, -0.84],
        },
        night: {
          zenith: '#071a34',
          mid: '#1c3c58',
          horizon: '#365a70',
          sun: '#d8ecf5',
          key: '#c9e4f1',
          fill: '#4f7597',
          hemiTop: '#9fc3d5',
          hemiBot: '#152e40',
          keyInt: 1.28,
          hemiInt: 0.82,
          stars: 0.94,
          sunDir: [-0.22, 0.52, -0.83],
        },
      },
    }

    const p = palettes[this.sceneId][this.mood]
    if (this.isNativeScene) {
      this.applySolarProfile(this.timeOfDay, true)
      return
    }

    const sky = this.skyDome.uniforms
    sky.uZenith.value.set(p.zenith)
    sky.uMid.value.set(p.mid)
    sky.uHorizon.value.set(p.horizon)
    sky.uSunCol.value.set(p.sun)
    sky.uSunDir.value.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize()
    this.currentSunDir.copy(sky.uSunDir.value)
    sky.uStars.value = p.stars

    this.keyLight.color.set(p.key)
    this.keyLight.intensity = p.keyInt
    this.keyLight.position.set(p.sunDir[0] * 14, Math.max(6, p.sunDir[1] * 24), p.sunDir[2] * -12)
    this.fillLight.color.set(p.fill)
    this.fillLight.intensity = this.mood === 'night' ? 0.62 : 0.85
    this.hemiLight.color.set(p.hemiTop)
    this.hemiLight.groundColor.set(p.hemiBot)
    this.hemiLight.intensity = p.hemiInt

    this.applyMood(p.horizon, p.sun, p.sunDir)
    this.updateSkyEnvironment()

    for (const hook of this.moodHooks) hook(this.mood)
  }

  private applySolarProfile(hour: number, immediateEnv: boolean) {
    const sp = computeSolarProfile(hour)
    const sky = this.skyDome.uniforms
    sky.uZenith.value.set(sp.zenith)
    sky.uMid.value.set(sp.mid)
    sky.uHorizon.value.set(sp.horizon)
    sky.uSunCol.value.set(sp.sun)
    sky.uSunDir.value.set(sp.sunDir[0], sp.sunDir[1], sp.sunDir[2]).normalize()
    this.currentSunDir.copy(sky.uSunDir.value)
    sky.uStars.value = sp.stars

    this.keyLight.color.set(sp.key)
    this.keyLight.intensity = sp.keyInt
    this.keyLight.position.set(sp.sunDir[0] * 18, Math.max(6, sp.sunDir[1] * 28), sp.sunDir[2] * -16)
    this.fillLight.color.set(sp.fill)
    this.fillLight.intensity = 0.58 + (1 - sp.nightFactor) * 0.28
    this.hemiLight.color.set(sp.hemiTop)
    this.hemiLight.groundColor.set(sp.hemiBot)
    this.hemiLight.intensity = sp.hemiInt

    this.cinemaPass.uniforms.uSunColor.value.set(sp.sun)
    this.cinemaPass.uniforms.uGodRayIntensity.value = this.flashSafe
      ? sp.godRayStrength * 0.4
      : sp.godRayStrength

    this.applyMood(sp.horizon, sp.sun, sp.sunDir)
    for (const hook of this.moodHooks) hook(this.mood)
    for (const hook of this.timeHooks) hook(sp.hour, sp.nightFactor)

    if (immediateEnv) {
      this.updateSkyEnvironment()
    } else {
      this.scheduleSkyEnvUpdate()
    }
  }

  private scheduleSkyEnvUpdate() {
    if (typeof window === 'undefined') return
    if (this.pmremDebounceTimer !== null) {
      window.clearTimeout(this.pmremDebounceTimer)
    }
    this.pmremDebounceTimer = window.setTimeout(() => {
      this.pmremDebounceTimer = null
      if (!this.disposed) this.updateSkyEnvironment()
    }, 180)
  }

  private getSceneHdriPath(): string | null {
    switch (this.sceneId) {
      case 'paris':
      case 'rome':
      case 'kyoto':
      case 'agra':
      case 'georgia':
      case 'rapanui':
      case 'giza':
        return '/hdri/belfast_sunset_puresky_2k.hdr'
      case 'iceland':
      case 'dali':
        return '/hdri/blue_lagoon_night_2k.hdr'
      case 'harbin':
        return '/hdri/clarens_night_02_2k.hdr'
      default:
        return null
    }
  }

  private updateSkyEnvironment() {
    if (!this.isNativeScene) {
      this.scene.environment = null
      return
    }
    const hdriPath = this.getSceneHdriPath()
    if (hdriPath && typeof window !== 'undefined') {
      const cached = this.hdrCache.get(hdriPath)
      if (cached) {
        this.scene.environment = cached.texture
        this.scene.environmentIntensity = this.mood === 'night' ? 0.22 : 0.32
        return
      }
      const token = ++this.hdrLoadToken
      this.hdrLoader.load(hdriPath, (hdrTex) => {
        if (this.disposed || token !== this.hdrLoadToken) {
          hdrTex.dispose()
          return
        }
        const rt = this.pmremGenerator.fromEquirectangular(hdrTex)
        hdrTex.dispose()
        this.hdrCache.set(hdriPath, rt)
        this.scene.environment = rt.texture
        this.scene.environmentIntensity = this.mood === 'night' ? 0.22 : 0.32
      })
    }

    const envScene = new THREE.Scene()
    const envSky = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      this.skyDome.mesh.material,
    )
    envScene.add(envSky)
    const nextRT = this.pmremGenerator.fromScene(envScene, 0.035)
    envSky.geometry.dispose()
    if (this.envRT) {
      this.envRT.dispose()
    }
    this.envRT = nextRT
    this.scene.environment = nextRT.texture
    this.scene.environmentIntensity = this.mood === 'night' ? 0.28 : 0.42
  }

  private applyMood(horizonHex: string, sunHex: string, sunDir?: [number, number, number]) {
    // Selective HDR-only bloom: threshold > 1.0 so sunlit stone/snow never blows out
    const moodStrength = this.isNativeScene
      ? this.mood === 'dawn' ? 0.18 : this.mood === 'night' ? 0.26 : 0.22
      : this.mood === 'dawn' ? 0.16 : this.mood === 'night' ? 0.24 : 0.22
    const sceneBoost = BLOOM_BOOST_SCENES.has(this.sceneId) ? (this.isNativeScene ? 0.02 : 0.05) : 0
    this.baseBloomStrength = Math.min(this.isNativeScene ? 0.28 : 0.34, moodStrength + sceneBoost)
    this.bloomPass.threshold = 1.05
    this.bloomPass.radius = this.isNativeScene ? 0.38 : 0.44
    this.bloomPass.strength = Math.min(0.34, this.baseBloomStrength + this.bloomPulse)
    this.bloomPass.enabled = this.bloomEnabled

    // Painterly atmospheric horizon fog
    this.fog.color.set(horizonHex)
    this.waterMoodFn?.(horizonHex, sunHex, sunDir)
    this.cinemaPass.uniforms.uSunColor.value.set(sunHex)

    // Soft floating atmospheric light-mote tint matched to scene accent & sunlight
    const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
    this.ambientMoteMat.color.set(meta.accent).lerp(new THREE.Color(sunHex), 0.32)
    this.ambientMoteMat.opacity = this.mood === 'dawn' ? 0.04 : this.mood === 'night' ? 0.12 : 0.12
  }

  private buildAmbientClouds() {
    const clouds = new THREE.Group()
    const cloudMat = createMat('#edf4fd', {
      transparent: true,
      opacity: 0.26,
      roughness: 0.95,
      depthWrite: false,
    })
    const specs: [number, number, number, number][] = [
      [-9.5, 8.1, -7.8, 1.15],
      [10.2, 9.4, -5.6, 1.3],
      [1.2, 10.5, -11.5, 1.55],
      [8.5, 7.5, 7.2, 1.05],
    ]
    specs.forEach(([x, y, z, s], idx) => {
      const c = new THREE.Group()
      c.position.set(x, y, z)
      c.scale.setScalar(s)
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 2), cloudMat)
      a.scale.set(1.55, 0.62, 0.92)
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 2), cloudMat)
      b.position.set(0.65, -0.08, 0.12)
      b.scale.set(1.22, 0.54, 0.82)
      c.add(a, b)
      clouds.add(c)
      this.tickHooks.push((t) => {
        c.position.x = x + Math.sin(t * 0.32 + idx * 1.9) * 0.58
      })
    })
    this.worldGroup.add(clouds)
  }

  private findInteractiveFromObject(obj: THREE.Object3D | null): InteractiveNode | null {
    let cur: THREE.Object3D | null = obj
    while (cur) {
      const idx = cur.userData?.interactIdx
      if (typeof idx === 'number' && this.interactives[idx]) {
        return this.interactives[idx]
      }
      cur = cur.parent
    }
    return null
  }

  private twoFingerDistance(): number {
    const pts = Array.from(this.activePointers.values())
    if (pts.length < 2) return 0
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  private onPointerDown = (event: PointerEvent) => {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    this.renderer.domElement.setPointerCapture?.(event.pointerId)
    if (this.activePointers.size === 2) {
      const dist = this.twoFingerDistance()
      this.pinch = {
        active: true,
        startDist: Math.max(dist, 20),
        baseDistance: this.targetDistance,
        hadPinch: true,
      }
      this.pointer.down = false
      return
    }
    if (this.activePointers.size === 1) {
      this.pointer.down = true
      this.pointer.id = event.pointerId
      this.pointer.lastX = event.clientX
      this.pointer.lastY = event.clientY
      this.pointer.moved = 0
      this.pinch.hadPinch = false
      this.renderer.domElement.style.cursor = 'grabbing'
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }
    if (this.pinch.active && this.activePointers.size >= 2) {
      const dist = this.twoFingerDistance()
      this.targetDistance = clamp(
        this.pinch.baseDistance * (this.pinch.startDist / Math.max(dist, 20)),
        CINEMATIC_MIN_DISTANCE,
        CINEMATIC_MAX_DISTANCE,
      )
      return
    }
    if (!this.pointer.down || event.pointerId !== this.pointer.id) {
      const hit = this.pickInteractive(event.clientX, event.clientY)
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
      return
    }
    const dx = clamp(event.clientX - this.pointer.lastX, -48, 48)
    const dy = clamp(event.clientY - this.pointer.lastY, -48, 48)
    this.pointer.lastX = event.clientX
    this.pointer.lastY = event.clientY
    this.pointer.moved += Math.abs(dx) + Math.abs(dy)
    if (this.walkMode) {
      this.walkTargetYaw += dx * 0.0044
      const minPitch = this.flightMode ? -1.05 : -0.68
      const maxPitch = this.flightMode ? 1.05 : 0.98
      this.walkTargetPitch = clamp(this.walkTargetPitch + dy * 0.0036, minPitch, maxPitch)
    } else {
      this.targetAzimuth = clamp(this.targetAzimuth - dx * 0.0044, -1.05, 2.15)
      this.targetPolar = clamp(this.targetPolar - dy * 0.0036, 0.16, 0.56)
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    this.activePointers.delete(event.pointerId)
    this.renderer.domElement.releasePointerCapture?.(event.pointerId)
    if (this.activePointers.size < 2) {
      this.pinch.active = false
    }
    const isSingleTapCandidate =
      !this.pinch.hadPinch &&
      this.pointer.down &&
      event.pointerId === this.pointer.id &&
      this.pointer.moved < 8
    if (event.pointerId === this.pointer.id) {
      this.pointer.down = false
    }
    if (this.activePointers.size === 0) {
      this.pointer.down = false
      this.pinch.hadPinch = false
      this.renderer.domElement.style.cursor = 'grab'
    }
    if (isSingleTapCandidate && event.type === 'pointerup') {
      const hit = this.pickInteractive(event.clientX, event.clientY)
      if (hit) {
        const wasAwakened = this.unlockedAwakened
        const res = hit.node.onClick(hit.point)
        this.interactionCount += 1
        const justAwakened = !wasAwakened && this.unlockedAwakened
        const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
        this.onInteract?.({
          label: justAwakened ? `◆ 奇境觉醒 · ${meta.stampTitle}` : res.label,
          sfx: justAwakened ? 'celebrate' : res.sfx,
          count: this.interactionCount,
          awakened: justAwakened,
        })
      }
    }
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (this.walkMode) {
      this.walkTargetFov = clamp(this.walkTargetFov + event.deltaY * 0.025, 36, 68)
      return
    }
    this.targetDistance = clamp(
      this.targetDistance + event.deltaY * 0.008,
      CINEMATIC_MIN_DISTANCE,
      CINEMATIC_MAX_DISTANCE,
    )
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.inputPaused || event.defaultPrevented) return
    if (event.metaKey || event.altKey) return
    const active = document.activeElement as HTMLElement | null
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable)
    ) {
      return
    }

    // KeyF toggles All-9-City Free Flight Mode seamlessly
    if (event.code === 'KeyF' && !event.ctrlKey && !event.repeat) {
      event.preventDefault()
      this.setFlightMode(!this.flightMode)
      return
    }

    if (!this.walkMode) return

    // Double-tap Space within 320ms toggles flight mode while inside Walk/Flight Mode
    if (event.code === 'Space' && !event.ctrlKey) {
      event.preventDefault()
      if (!event.repeat) {
        const now = performance.now()
        if (now - this.lastSpaceTime <= 320) {
          this.lastSpaceTime = 0
          this.setFlightMode(!this.flightMode)
        } else {
          this.lastSpaceTime = now
        }
      }
      this.keysPressed.add('Space')
      return
    }

    if (
      event.code === 'KeyW' ||
      event.code === 'KeyA' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD' ||
      event.code === 'KeyR' ||
      event.code === 'KeyQ' ||
      event.code === 'ControlLeft' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight'
    ) {
      if (event.code.startsWith('Arrow')) event.preventDefault()
      this.keysPressed.add(event.code)
    }
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.keysPressed.delete(event.code)
  }

  private onWindowBlur = () => {
    this.keysPressed.clear()
  }

  private pickInteractive(
    clientX: number,
    clientY: number,
  ): { node: InteractiveNode; point: THREE.Vector3 } | null {
    if (this.hitMeshes.length === 0) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(this.hitMeshes, true)
    for (const hit of hits) {
      const node = this.findInteractiveFromObject(hit.object)
      if (node) return { node, point: hit.point }
    }
    return null
  }

  private renderFrame() {
    if (this.disposed) return
    this.timer.update()
    const dt = Math.min(0.05, this.timer.getDelta())
    const elapsed = this.timer.getElapsed()

    this.skyDome.uniforms.uTime.value = elapsed
    this.cinemaPass.uniforms.uTime.value = elapsed

    this.weatherSystem.update(elapsed, dt, this.camera.position, this.windGust)
    const rainIntensity = this.weatherSystem.getRainIntensity()
    for (const hook of this.weatherHooks) hook(this.weather, rainIntensity)

    // 计算太阳屏幕空间投影与丁达尔光可见度（地心洞穴无天空太阳，其余世界全量启用）
    if (this.sceneId === 'core') {
      this.cinemaPass.uniforms.uSunVisibility.value = 0
    } else {
      this.tmpSunWorld.copy(this.camera.position).addScaledVector(this.currentSunDir, 180)
      this.tmpSunWorld.project(this.camera)
      const camFwdX = -Math.sin(this.camera.rotation.y)
      const inFront = this.tmpSunWorld.z < 1.0 && Number.isFinite(camFwdX)
      const sx = this.tmpSunWorld.x * 0.5 + 0.5
      const sy = this.tmpSunWorld.y * 0.5 + 0.5
      this.cinemaPass.uniforms.uSunScreenPos.value.set(clamp(sx, -0.4, 1.4), clamp(sy, -0.4, 1.4))
      const edgeFade = inFront
        ? clamp(1 - Math.hypot(sx - 0.5, sy - 0.5) * 0.85, 0, 1)
        : 0
      this.cinemaPass.uniforms.uSunVisibility.value = edgeFade
    }

    if (this.autoOrbit && !this.pointer.down && !this.walkMode) {
      this.targetAzimuth += dt * 0.14 * this.orbitDir
      if (this.targetAzimuth > 1.72) this.orbitDir = -1
      else if (this.targetAzimuth < -0.52) this.orbitDir = 1
    }

    if (this.beaconLife > 0 && this.goalBeacon) {
      this.beaconLife = Math.max(0, this.beaconLife - dt)
      this.goalBeacon.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.14)
      if (this.beaconLife <= 0) this.goalBeacon.visible = false
    }

    for (const fn of this.tickHooks) fn(elapsed, dt)

    // Decay the restrained musical bloom pulse smoothly (~0.8s).
    if (this.bloomPulse > 0) {
      this.bloomPulse = Math.max(0, this.bloomPulse - dt * (0.05 / 0.8))
    }
    this.bloomPass.strength = Math.min(0.4, this.baseBloomStrength + this.bloomPulse)

    // Update breath-to-wind gust energy & streaks
    if (this.windRippleCooldown > 0) {
      this.windRippleCooldown = Math.max(0, this.windRippleCooldown - dt)
    }
    if (this.windGust > 0) {
      this.windGust = Math.max(0, this.windGust - dt * 0.85)
      if (this.windGust > 0.08) {
        this.windSpawnAccum += dt * (1.5 + this.windGust * 4.5)
        while (this.windSpawnAccum >= 1) {
          this.windSpawnAccum -= 1
          this.spawnWindStreak(this.windGust)
        }
      }
    } else {
      this.windSpawnAccum = 0
    }

    const moteAttr = this.ambientMotes.geometry.getAttribute('position') as THREE.BufferAttribute
    const windDriftX = dt * (0.04 + this.windGust * 1.6)
    for (let i = 0; i < AMBIENT_MOTE_COUNT; i += 1) {
      const i3 = i * 3
      let mx = this.ambientMotePos[i3] + windDriftX * this.ambientMoteSpeed[i]
      if (mx > 15) mx = -15
      this.ambientMotePos[i3] = mx
      this.ambientMotePos[i3 + 1] =
        this.ambientMoteBaseY[i] +
        Math.sin(elapsed * 0.42 * this.ambientMoteSpeed[i] + this.ambientMotePhase[i]) * 0.18
      this.ambientMotePos[i3 + 2] +=
        Math.cos(elapsed * 0.28 * this.ambientMoteSpeed[i] + this.ambientMotePhase[i]) * dt * 0.035
      if (this.ambientMotePos[i3 + 2] > 15) this.ambientMotePos[i3 + 2] = -15
      else if (this.ambientMotePos[i3 + 2] < -15) this.ambientMotePos[i3 + 2] = 15
    }
    moteAttr.needsUpdate = true

    // Animate active pooled wind gust streaks
    for (const streak of this.windStreakPool) {
      if (!streak.active) continue
      streak.age += dt
      const t = streak.age / streak.duration
      if (t >= 1) {
        streak.active = false
        streak.mesh.visible = false
        continue
      }
      const x = streak.startX + streak.speed * streak.age
      const y = streak.baseY + Math.sin(streak.age * 4.5 + streak.wavePhase) * streak.waveAmp
      const z = streak.baseZ + Math.cos(streak.age * 2.8 + streak.wavePhase) * 0.18
      streak.mesh.position.set(x, y, z)
      const fade = Math.sin(t * Math.PI)
      streak.mat.opacity = fade * 0.14
      if (x > 17) {
        streak.active = false
        streak.mesh.visible = false
      }
    }

    // Animate active pooled 3D musical note spectacles
    for (const slot of this.spectaclePool) {
      if (!slot.active) continue
      slot.age += dt
      const t = slot.age / slot.duration
      if (t >= 1) {
        slot.active = false
        slot.group.visible = false
        continue
      }
      const env = Math.min(1, t / 0.16) * (1 - t) * (1 - t)
      slot.ring.scale.setScalar(0.45 + t * 2.4)
      slot.ringMat.opacity = env * 0.24

      const attr = slot.motes.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let m = 0; m < NOTE_MOTE_COUNT; m += 1) {
        const ang = slot.moteAngles[m] + slot.age * 0.18
        const r = 0.08 + slot.moteRadialSpeed[m] * slot.age
        slot.motePos[m * 3] = Math.cos(ang) * r
        slot.motePos[m * 3 + 1] = 0.12 + slot.moteRiseSpeed[m] * slot.age
        slot.motePos[m * 3 + 2] = Math.sin(ang) * r
      }
      attr.needsUpdate = true
      slot.motesMat.opacity = env * 0.38
    }

    const k = 1 - Math.exp(-dt * 7.5)
    this.azimuth += (this.targetAzimuth - this.azimuth) * k
    this.polar += (this.targetPolar - this.polar) * k
    this.distance += (this.targetDistance - this.distance) * k

    let rightInputForRoll = 0
    if (this.walkMode) {
      let fwdInput = 0
      let rightInput = 0
      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) fwdInput += 1
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) fwdInput -= 1
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) rightInput += 1
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) rightInput -= 1
      rightInputForRoll = rightInput

      if (this.flightMode) {
        let upInput = 0
        if (this.keysPressed.has('Space') || this.keysPressed.has('KeyR')) upInput += 1
        if (this.keysPressed.has('KeyQ') || this.keysPressed.has('ControlLeft')) upInput -= 1
        if (fwdInput !== 0 || rightInput !== 0 || upInput !== 0) {
          const cosPitch = Math.cos(this.walkPitch)
          const fwdX = Math.sin(this.walkYaw) * cosPitch
          const fwdY = Math.sin(this.walkPitch)
          const fwdZ = Math.cos(this.walkYaw) * cosPitch
          const rightX = -Math.cos(this.walkYaw)
          const rightZ = Math.sin(this.walkYaw)
          let vx = fwdX * fwdInput + rightX * rightInput
          let vy = fwdY * fwdInput + upInput
          let vz = fwdZ * fwdInput + rightZ * rightInput
          const mag = Math.hypot(vx, vy, vz)
          if (mag > 1) {
            vx /= mag
            vy /= mag
            vz /= mag
          }
          const step = FLIGHT_SPEED * dt
          const nx = this.walkTargetPos.x + vx * step
          const ny = clamp(this.walkTargetPos.y + vy * step, FLIGHT_HEIGHT_MIN, FLIGHT_HEIGHT_MAX)
          const nz = this.walkTargetPos.z + vz * step
          const radial = Math.hypot(nx, nz)
          if (radial > FLIGHT_RADIUS) {
            const clampScale = FLIGHT_RADIUS / radial
            this.walkTargetPos.set(nx * clampScale, ny, nz * clampScale)
          } else {
            this.walkTargetPos.set(nx, ny, nz)
          }
        }
      } else if (this.ridingMode && this.rideAnchorFn) {
        if (fwdInput !== 0 || rightInput !== 0 || this.keysPressed.has('Escape')) {
          this.setRidingMode(false)
        } else {
          const anchor = this.rideAnchorFn()
          if (anchor) {
            this.walkTargetPos.copy(anchor.pos)
            this.walkPos.lerp(anchor.pos, Math.min(1, dt * 10))
          }
        }
      } else if (fwdInput !== 0 || rightInput !== 0) {
        const norm = Math.hypot(fwdInput, rightInput)
        const moveStep = (WALK_SPEED * dt) / norm
        const fwdX = Math.sin(this.walkYaw)
        const fwdZ = Math.cos(this.walkYaw)
        const rightX = -fwdZ
        const rightZ = fwdX
        const dx = (fwdX * fwdInput + rightX * rightInput) * moveStep
        const dz = (fwdZ * fwdInput + rightZ * rightInput) * moveStep
        let nx = this.walkTargetPos.x + dx
        let nz = this.walkTargetPos.z + dz

        if (this.walkHeightSampler) {
          const hBoth = this.walkHeightSampler(nx, nz)
          if (hBoth !== null) {
            this.walkTargetPos.x = nx
            this.walkTargetPos.z = nz
            this.walkTargetPos.y = hBoth + 1.1
          } else {
            const hX = this.walkHeightSampler(nx, this.walkTargetPos.z)
            const hZ = this.walkHeightSampler(this.walkTargetPos.x, nz)
            if (hX !== null) {
              this.walkTargetPos.x = nx
              this.walkTargetPos.y = hX + 1.1
            } else if (hZ !== null) {
              this.walkTargetPos.z = nz
              this.walkTargetPos.y = hZ + 1.1
            }
          }
        } else {
          const radial = Math.hypot(nx, nz)
          const maxWalk = this.isNativeScene ? 26 : WALK_RADIUS
          if (radial > maxWalk) {
            const clampScale = maxWalk / radial
            nx *= clampScale
            nz *= clampScale
          }
          this.walkTargetPos.x = nx
          this.walkTargetPos.z = nz
        }
      }
      const wk = 1 - Math.exp(-dt * 8.2)
      this.walkPos.lerp(this.walkTargetPos, wk)
      this.walkYaw += (this.walkTargetYaw - this.walkYaw) * wk
      this.walkPitch += (this.walkTargetPitch - this.walkPitch) * wk
      this.walkFov += (this.walkTargetFov - this.walkFov) * wk
    }

    const targetRoll = this.flightMode ? -rightInputForRoll * 0.075 : 0
    this.flightRoll += (targetRoll - this.flightRoll) * (1 - Math.exp(-dt * 6.5))

    const blendTarget = this.walkMode ? 1 : 0
    const blendK = 1 - Math.exp(-dt * 5.2)
    this.walkBlend += (blendTarget - this.walkBlend) * blendK
    if (Math.abs(blendTarget - this.walkBlend) < 0.001) {
      this.walkBlend = blendTarget
    }

    if (this.framingView) {
      const parallaxX = (this.azimuth - 0.52) * 2.2
      const parallaxY = (this.polar - 0.42) * 1.4
      this.tmpOrbitPos.set(
        this.framingView.pos.x + parallaxX + Math.sin(elapsed * 0.35) * 0.12,
        this.framingView.pos.y + parallaxY + Math.cos(elapsed * 0.28) * 0.06,
        this.framingView.pos.z,
      )
      this.tmpOrbitLook.copy(this.framingView.look)
    } else {
      const cosP = Math.cos(this.polar)
      const sinP = Math.sin(this.polar)
      const effectiveDist = clamp(
        this.distance * this.distanceScale,
        CINEMATIC_MIN_DISTANCE,
        CINEMATIC_MAX_DISTANCE,
      )
      this.tmpOrbitPos.set(
        Math.sin(this.azimuth) * cosP * effectiveDist,
        sinP * effectiveDist + 0.9,
        Math.cos(this.azimuth) * cosP * effectiveDist,
      )
      this.tmpOrbitLook.set(0, 3.2, -1.2)
    }

    const blend = this.walkBlend * this.walkBlend * (3 - 2 * this.walkBlend)
    this.fog.density = this.isNativeScene
      ? 0.0042
      : 0.0082 + (this.flightMode ? 0 : 0.0033) * blend

    const windBob = this.windGust > 0.005 ? Math.sin(elapsed * 3.2) * 0.018 * this.windGust : 0
    const windRoll = this.windGust > 0.005 ? Math.sin(elapsed * 2.4) * 0.008 * this.windGust : 0

    if (blend <= 0.0005) {
      this.camera.position.copy(this.tmpOrbitPos)
      this.camera.position.y += windBob
      this.camera.lookAt(this.tmpOrbitLook)
    } else {
      this.tmpWalkLook.set(
        this.walkPos.x + Math.sin(this.walkYaw) * Math.cos(this.walkPitch) * 4,
        this.walkPos.y + Math.sin(this.walkPitch) * 4,
        this.walkPos.z + Math.cos(this.walkYaw) * Math.cos(this.walkPitch) * 4,
      )
      this.camera.position.lerpVectors(this.tmpOrbitPos, this.walkPos, blend)
      this.camera.position.y += windBob
      this.tmpLookTarget.lerpVectors(this.tmpOrbitLook, this.tmpWalkLook, blend)
      this.camera.lookAt(this.tmpLookTarget)
    }

    const totalRoll = this.flightRoll * blend + windRoll
    if (Math.abs(totalRoll) > 0.0002) {
      this.camera.rotateZ(totalRoll)
    }

    const baseOrbitFov = this.framingView ? this.framingView.fov : this.orbitBaseFov
    const desiredFov = baseOrbitFov + (this.walkFov - baseOrbitFov) * blend
    if (Math.abs(this.camera.fov - desiredFov) > 0.02) {
      this.camera.fov = desiredFov
      this.camera.updateProjectionMatrix()
    }

    this.composer.render()
  }

  dispose() {
    this.disposed = true
    this.timer.dispose()
    this.renderer.setAnimationLoop(null)
    const dom = this.renderer.domElement
    dom.removeEventListener('pointerdown', this.onPointerDown)
    dom.removeEventListener('pointermove', this.onPointerMove)
    dom.removeEventListener('pointerup', this.onPointerUp)
    dom.removeEventListener('pointercancel', this.onPointerUp)
    dom.removeEventListener('wheel', this.onWheel)
    dom.removeEventListener('webglcontextlost', this.handleContextLost)
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onWindowBlur)
    this.resizeObserver.disconnect()

    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0]
      this.worldGroup.remove(child)
      disposeTree(child)
    }

    this.ambientMotes.geometry.dispose()
    this.ambientMoteMat.dispose()
    this.spectacleRingGeo.dispose()
    for (const slot of this.spectaclePool) {
      slot.ringMat.dispose()
      slot.motes.geometry.dispose()
      slot.motesMat.dispose()
    }
    this.windStreakGeo.dispose()
    for (const streak of this.windStreakPool) {
      streak.mat.dispose()
    }

    for (const d of this.disposeHooks) d()
    this.disposeHooks = []
    disposeTree(this.skyDome.mesh)
    if (this.pmremDebounceTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.pmremDebounceTimer)
      this.pmremDebounceTimer = null
    }
    this.weatherSystem.dispose()
    this.cinemaPass.pass.dispose()
    if (this.envRT) {
      this.envRT.dispose()
      this.envRT = null
    }
    for (const rt of this.hdrCache.values()) rt.dispose()
    this.hdrCache.clear()
    this.pmremGenerator.dispose()
    disposeDioramaTextures(this.textures)
    this.bloomPass.dispose()
    this.smaaPass.dispose()
    this.outputPass.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    dom.parentNode?.removeChild(dom)
  }
}
