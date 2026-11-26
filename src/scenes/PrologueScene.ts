import * as THREE from 'three'
import {
  ROAM_RADIUS,
  SHARED_UNIFORMS,
  clamp,
  makeLook,
  makeLookAt,
  makeNoiseTexture,
  sunArc,
  syncLookUniforms,
} from '../engine/core/ctx'
import { CinemaPipeline } from '../engine/core/pipeline'
import { WakeField } from '../engine/fx/wake'
import { WindFX } from '../engine/fx/windfx'
import {
  PlayerController,
  type HoverTargetInfo,
  type PlayerTelemetry,
} from '../engine/player/controller'
import { CloudBaker } from '../engine/world/clouds'
import { LandmarksWorld } from '../engine/world/landmarks'
import { MeadowWorld } from '../engine/world/meadow'
import { SkyWorld } from '../engine/world/sky'
import { TerrainWorld } from '../engine/world/terrain'
import { UndergroundWorld } from '../engine/world/underground'
import { LakeWater } from '../engine/world/water'
import type { QualityTier } from '../services/settings'
import type { DescentEvent, FocusTarget, PickId, SkyStage } from '../types/sensor'

export { sunArc }
export type { HoverTargetInfo, PlayerTelemetry }

export interface PrologueSceneOptions {
  onPick?: (id: PickId) => void
  onDescentEvent?: (event: DescentEvent) => void
  onLakeRipple?: () => void
  onHoverTarget?: (info: HoverTargetInfo | null) => void
  onZoomChange?: (zoom: number) => void
  onPlaceChange?: (place: string) => void
  onTelemetry?: (telemetry: PlayerTelemetry) => void
  onBoundary?: () => void
  onSkimChange?: (amount: number) => void
  onContextLost?: (lost: boolean) => void
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

/**
 * 序章 3D 总控引擎（完全重写版 · 基于 Petalwake 统一物理渲染管线）。
 *
 * 将天空、体云、地形、草原、野花海、湖水倒影、风带粒子、地标彩蛋与地下 6,371.4 KM
 * 下潜通道装配于一套共享全局 Uniform (`ctx.ts`) + HDR 后处理管线 (`CinemaPipeline`) 上，
 * 对外 100% 兼容原有交互接口。
 */
export class PrologueScene {
  private host: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.3, 2600)
  private readonly surfaceGroup = new THREE.Group()
  private readonly pickables: THREE.Object3D[] = []

  private pipeline: CinemaPipeline | null = null
  private cloudBaker: CloudBaker | null = null
  private skyWorld: SkyWorld | null = null
  private terrainWorld: TerrainWorld | null = null
  private lakeWater: LakeWater | null = null
  private wakeField: WakeField | null = null
  private meadowWorld: MeadowWorld | null = null
  private windFX: WindFX | null = null
  private landmarks: LandmarksWorld | null = null
  private underground: UndergroundWorld | null = null
  private discoveredIds: string[] = []
  private controller: PlayerController | null = null
  private noiseTex: THREE.DataTexture | null = null
  private glowTex: THREE.Texture | null = null

  private options: PrologueSceneOptions = {}
  private isMobile = false
  private quality: QualityTier = 'auto'
  private calmMotion = false
  private paused = false
  private disposed = false
  private raf: number | null = null
  private lastFrame = 0
  private elapsed = 0

  private windLevel = 0.55
  private windTarget = 0.55
  private look = makeLook(0)
  private lookTarget = makeLook(0)

  private handleContextLost = (event: Event) => {
    event.preventDefault()
    this.stopLoop()
    this.options.onContextLost?.(true)
  }

  private handleContextRestored = () => {
    this.options.onContextLost?.(false)
    this.startLoop()
  }

  private get lowDetail(): boolean {
    if (this.quality === 'lite') return true
    if (this.quality === 'full') return false
    return this.isMobile
  }

  private get roamRadius(): number {
    return this.lowDetail ? 165 : ROAM_RADIUS
  }

  private get pixelCap(): number {
    if (this.quality === 'lite') return 1.2
    if (this.quality === 'full') return 2
    return this.isMobile ? 1.5 : 1.75
  }

  mount(host: HTMLElement, options: PrologueSceneOptions = {}) {
    this.host = host
    this.options = options
    this.isMobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      reversedDepthBuffer: true,
    })
    renderer.autoClear = true
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.pixelCap))
    renderer.toneMapping = THREE.NoToneMapping
    renderer.setClearColor(0x04070a, 1)
    this.renderer = renderer

    const canvas = renderer.domElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    host.appendChild(canvas)
    this.canvas = canvas

    this.scene.background = new THREE.Color('#04070a')
    this.scene.add(this.surfaceGroup)

    const noise = makeNoiseTexture()
    this.noiseTex = noise.texture
    SHARED_UNIFORMS.uNoiseTex.value = noise.texture
    this.glowTex = makeGlowTexture()

    const dpr = Math.min(window.devicePixelRatio, this.pixelCap)
    this.pipeline = new CinemaPipeline(renderer)
    if (!this.pipeline.reversed) {
      this.camera.near = 0.5
      this.camera.updateProjectionMatrix()
    }
    this.pipeline.setQuality(this.lowDetail, this.calmMotion)

    this.cloudBaker = new CloudBaker(renderer, this.lowDetail)
    this.skyWorld = new SkyWorld(this.surfaceGroup, this.pickables, this.glowTex, this.lowDetail, dpr)
    this.terrainWorld = new TerrainWorld(this.surfaceGroup, this.roamRadius, this.lowDetail)
    this.landmarks = new LandmarksWorld(this.surfaceGroup, this.pickables, this.glowTex, this.lowDetail)
    this.terrainWorld.bakeFields(this.landmarks.clearZones, this.lowDetail)

    this.wakeField = new WakeField(renderer)
    this.lakeWater = new LakeWater(this.surfaceGroup, this.pickables)
    this.meadowWorld = new MeadowWorld(this.surfaceGroup, this.lowDetail)
    this.windFX = new WindFX(
      this.surfaceGroup,
      this.glowTex,
      noise.data,
      noise.size,
      this.lowDetail,
      dpr,
    )
    this.windFX.setCalmMotion(this.calmMotion)
    this.underground = new UndergroundWorld(this.scene, this.glowTex, dpr)

    this.controller = new PlayerController(
      this.camera,
      canvas,
      this.pickables,
      this.terrainWorld.terrainMesh,
      () => this.roamRadius,
      {
        onPick: (id) => this.options.onPick?.(id),
        onLakeRipple: (pt, strength) => {
          this.lakeWater?.spawnRipple(pt, strength)
          this.options.onLakeRipple?.()
        },
        onHoverTarget: (info) => this.options.onHoverTarget?.(info),
        onZoomChange: (zoom) => this.options.onZoomChange?.(zoom),
        onPlaceChange: (place) => this.options.onPlaceChange?.(place),
        onTelemetry: (telemetry) => this.options.onTelemetry?.(telemetry),
        onBoundary: () => this.options.onBoundary?.(),
        onWalkStart: (pt) => this.landmarks?.triggerWalkMarker(pt),
        onSkyCall: () => this.emitSkyCall(),
        onSkimChange: (amt) => this.options.onSkimChange?.(amt),
        onCursorMeadow: (pt) => this.windFX?.spawnHoverMotes(pt, 3),
        isConstellationStarPicked: (obj) => this.skyWorld?.isStarPicked(obj) ?? true,
        isConstellationActive: () => this.skyWorld?.constellationGroup.visible ?? false,
        isMeteorRunning: () => this.skyWorld?.meteorRunning ?? false,
        connectConstellation: (idx) =>
          this.skyWorld?.connectConstellation(idx, () => this.captureGalaxy()),
        hideMeteor: () => this.skyWorld?.hideMeteor(),
        isSurfaceActive: () => !(this.underground?.active ?? false),
      },
    )
    this.controller.setCalmMotion(this.calmMotion)
    this.controller.focusTarget('home', 0.01)

    this.applyLook()
    this.resize()

    if (import.meta.env.DEV) {
      ;(window as unknown as { __prologue?: PrologueScene }).__prologue = this
    }
    this.startLoop()
  }

  setStage(stage: SkyStage, immediate = false) {
    this.lookTarget = makeLook(stage)
    this.skyWorld?.setMeteorActive(stage === 2)
    if (immediate) {
      this.look = makeLook(stage)
      this.applyLook()
    }
  }

  setClockHour(hour: number) {
    this.setClock(hour, true)
  }

  setClock(hour: number, immediate = false) {
    this.lookTarget = makeLookAt(hour)
    if (immediate) {
      this.look = makeLookAt(hour)
      this.applyLook()
    }
  }

  setActiveTask(task: PickId | null) {
    this.landmarks?.setActiveTask(task)
  }

  setTuning(value: number) {
    this.windTarget = 0.72 + clamp(value, 0, 1) * 0.7
  }

  lockWind() {
    this.windTarget = 1.95
  }

  setFocusRing(progress: number | null) {
    this.landmarks?.setFocusRing(progress)
  }

  collectFlower() {
    this.landmarks?.collectFlower()
    this.windFX?.triggerHeroPetals()
  }

  touchHeroFlower() {
    this.landmarks?.touchHeroFlower()
    this.windFX?.triggerHeroPetals()
  }

  captureGalaxy() {
    this.setStage(2)
    this.skyWorld?.boostGalaxy()
  }

  focusTarget(target: FocusTarget, duration = 2.3) {
    this.controller?.focusTarget(target, duration)
  }

  triggerDescent() {
    if (!this.underground || !this.controller || this.underground.active) return
    this.underground.triggerDescent(
      this.controller.camPos,
      this.controller.lookCurrent,
      this.controller.fov,
    )
    this.controller.clearInputForDescent()
    this.windTarget = 0.25
    this.wakeField?.reset()
    this.windFX?.hideForDescent()
    this.landmarks?.hideForDescent()
    this.skyWorld?.setConstellationActive(false, this.camera, this.pickables)
    this.skyWorld?.setMeteorActive(false)
  }

  triggerCoreBurst() {
    this.underground?.triggerCoreBurst()
  }

  setRoamEnabled(enabled: boolean) {
    this.controller?.setRoamEnabled(enabled)
  }

  setMoveAxis(x: number, y: number) {
    this.controller?.setMoveAxis(x, y)
  }

  setLookAxis(x: number, y: number) {
    this.controller?.setLookAxis(x, y)
  }

  startRain() {
    this.windFX?.startRain()
  }

  stopRain() {
    this.windFX?.stopRain()
  }

  blowDandelion(strength = 1) {
    this.windFX?.blowDandelion(strength)
  }

  setFireflyLevel(level: number) {
    this.windFX?.setFireflyLevel(level)
  }

  pulseSanctuaryRune(level: number) {
    this.landmarks?.pulseSanctuaryRune(level)
    if (level > 0) this.emitSkyCall()
  }

  setDiscoveredIds(ids: readonly string[]) {
    this.discoveredIds = [...ids]
  }

  sitOnBench(benchId: string) {
    if (this.underground?.active) return
    this.controller?.sitOnBench(benchId)
  }

  standFromBench() {
    this.controller?.standFromBench()
  }

  emitSkyCall(discoveredIds?: readonly string[]) {
    if (!this.controller || this.underground?.active) return
    if (discoveredIds) this.discoveredIds = [...discoveredIds]
    this.landmarks?.emitSkyCall(this.controller.camPos)
    this.landmarks?.triggerEchoBeams(this.discoveredIds)
  }

  setConstellationActive(active: boolean) {
    this.skyWorld?.setConstellationActive(active, this.camera, this.pickables)
  }

  autoCompleteConstellation() {
    this.skyWorld?.autoCompleteConstellation(() => this.captureGalaxy())
  }

  captureSnapshot(): string | null {
    if (!this.renderer || !this.pipeline || this.disposed) return null
    try {
      this.pipeline.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/jpeg', 0.94)
    } catch {
      return null
    }
  }

  resetToSurface() {
    this.underground?.resetToSurface()
    this.surfaceGroup.visible = true
    if (this.skyWorld) this.skyWorld.skyGroup.visible = true
    this.lakeWater?.clearRipples()
    this.windFX?.resetToSurface()
    this.landmarks?.resetToSurface()
    this.skyWorld?.resetToSurface(this.pickables)
    this.wakeField?.reset()
    this.windLevel = 0.55
    this.windTarget = 0.55
    this.setStage(0, true)
    this.controller?.resetSurfaceState()
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) this.stopLoop()
    else this.startLoop()
  }

  setQuality(quality: QualityTier) {
    if (this.quality === quality) return
    this.quality = quality
    this.pipeline?.setQuality(this.lowDetail, this.calmMotion)
    if (this.lowDetail) this.wakeField?.reset()
    if (!this.renderer) return
    const ratio = Math.min(window.devicePixelRatio, this.pixelCap)
    this.renderer.setPixelRatio(ratio)
    this.resize()
  }

  setCalmMotion(calm: boolean) {
    this.calmMotion = calm
    this.pipeline?.setQuality(this.lowDetail, calm)
    this.windFX?.setCalmMotion(calm)
    this.controller?.setCalmMotion(calm)
    if (calm) this.wakeField?.reset()
  }

  resize() {
    if (!this.host || !this.renderer || !this.pipeline) return
    const width = this.host.clientWidth || window.innerWidth
    const height = this.host.clientHeight || window.innerHeight
    const ratio = Math.min(window.devicePixelRatio, this.pixelCap)
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(width, height, false)
    this.pipeline.setSize(width, height, ratio)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
    this.skyWorld?.setPixelRatio(ratio)
    this.windFX?.setPixelRatio(ratio)
    this.underground?.setPixelRatio(ratio)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.stopLoop()
    this.controller?.dispose()
    this.options.onSkimChange?.(0)

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose())
      } else if (material) {
        material.dispose()
      }
    })

    this.wakeField?.dispose()
    this.cloudBaker?.dispose()
    this.skyWorld?.dispose()
    this.terrainWorld?.dispose()
    this.lakeWater?.dispose()
    this.meadowWorld?.dispose()
    this.windFX?.dispose()
    this.landmarks?.dispose()
    this.pipeline?.dispose()
    this.noiseTex?.dispose()
    this.glowTex?.dispose()
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    }
    this.renderer?.dispose()
    this.renderer?.forceContextLoss()
    if (this.canvas?.parentElement) this.canvas.parentElement.removeChild(this.canvas)

    this.scene.clear()
    this.pickables.length = 0
    this.canvas = null
    this.renderer = null
    this.pipeline = null
    this.host = null
  }

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

  private tick = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    if (this.paused) return
    const now = performance.now()
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05)
    this.lastFrame = now
    this.elapsed += dt
    this.update(dt)
    this.pipeline?.render(this.scene, this.camera)
  }

  private applyLook() {
    const undergroundActive = this.underground?.active ?? false
    syncLookUniforms(
      this.look,
      undergroundActive,
      this.underground?.fogColor,
      this.underground?.fogDensity,
    )
    if (this.pipeline) {
      this.pipeline.params.exposure = undergroundActive ? 0.94 : this.look.exposure
    }
  }

  private updateLook(dt: number) {
    if (this.underground?.active) {
      syncLookUniforms(this.look, true, this.underground.fogColor, this.underground.fogDensity)
      if (this.pipeline) {
        this.pipeline.params.exposure += (0.94 - this.pipeline.params.exposure) * (1 - Math.exp(-dt * 2.2))
      }
      return
    }

    const k = 1 - Math.exp(-dt * 1.1)
    this.look.zenith.lerp(this.lookTarget.zenith, k)
    this.look.mid.lerp(this.lookTarget.mid, k)
    this.look.horizon.lerp(this.lookTarget.horizon, k)
    this.look.sun.lerp(this.lookTarget.sun, k)
    this.look.halo.lerp(this.lookTarget.halo, k)
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

  private update(dt: number) {
    this.updateLook(dt)

    this.windLevel += (this.windTarget - this.windLevel) * (1 - Math.exp(-dt * 1.4))
    SHARED_UNIFORMS.uTime.value = this.elapsed
    SHARED_UNIFORMS.uWind.value.z = this.windLevel

    this.controller?.update(dt)
    SHARED_UNIFORMS.uCamPos.value.copy(this.camera.position)
    SHARED_UNIFORMS.uCamXZ.value.set(this.camera.position.x, this.camera.position.z)

    if (this.pipeline) {
      this.pipeline.params.speed = this.controller?.speedNorm ?? 0
    }

    this.cloudBaker?.update(dt)
    this.skyWorld?.update(dt, this.elapsed, this.camera)

    const wakeActive =
      !this.lowDetail &&
      !this.calmMotion &&
      !(this.underground?.active ?? false) &&
      this.surfaceGroup.visible
    const cursorActive =
      wakeActive &&
      !(this.controller?.isInFlight ?? false) &&
      (this.controller?.cursorWorld.x ?? 999) < 450 &&
      (this.controller?.cursorWorld.z ?? 999) < 450
    this.wakeField?.update(
      dt,
      wakeActive,
      this.controller?.camPos.x ?? 0,
      this.controller?.camPos.z ?? 0,
      this.controller?.cursorWorld.x ?? 999,
      this.controller?.cursorWorld.z ?? 999,
      cursorActive,
    )

    this.lakeWater?.update(dt)
    this.windFX?.update(
      dt,
      this.elapsed,
      this.camera.position,
      this.windLevel,
      this.look.galaxy,
      this.controller?.speedNorm ?? 0,
    )
    this.landmarks?.update(dt, this.elapsed, this.camera.position)

    if (this.underground && this.skyWorld && this.controller) {
      this.underground.update(
        dt,
        this.elapsed,
        this.surfaceGroup,
        this.skyWorld.skyGroup,
        this.scene,
        this.controller.camPos,
        this.controller.lookCurrent,
        (pos, look, fov) => this.controller?.applyCamera(pos, look, fov),
        (event) => this.options.onDescentEvent?.(event),
        this.calmMotion,
      )
    }
  }
}
