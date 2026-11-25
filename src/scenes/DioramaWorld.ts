import * as THREE from 'three'
import type { DioramaSceneId } from '../services/albumStorage'
import {
  buildHarbin,
  buildHawaii,
  buildObservatory,
} from './diorama/buildersB'
import {
  buildLibrary,
  buildShanghai,
  buildSydney,
} from './diorama/buildersA'
import {
  createDioramaSkyDome,
  createDioramaTextures,
  createGoalBeacon,
  createMat,
  disposeDioramaTextures,
  type SkyDomeHandle,
} from './diorama/materials'
import {
  DIORAMA_SCENES,
  type DioramaBuilderCtx,
  type DioramaFilter,
  type DioramaGoalState,
  type DioramaInteractEvent,
  type DioramaMood,
  type DioramaProgressSnapshot,
  type DioramaSceneMeta,
  type DioramaSfx,
  type DioramaTextures,
  type DioramaZoomPreset,
  type InteractiveRegistration,
} from './diorama/types'

export {
  DIORAMA_SCENES,
  type DioramaFilter,
  type DioramaGoalState,
  type DioramaInteractEvent,
  type DioramaMood,
  type DioramaProgressSnapshot,
  type DioramaSceneMeta,
  type DioramaSfx,
  type DioramaZoomPreset,
}

interface InteractiveNode {
  mesh: THREE.Object3D
  goalId?: string
  focusPoint?: THREE.Vector3
  onClick: (point?: THREE.Vector3) => { label: string; sfx: DioramaSfx }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

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

export function buildGoalSnapshot(
  sceneId: DioramaSceneId,
  completedIds: ReadonlySet<string>,
): DioramaProgressSnapshot {
  const meta = DIORAMA_SCENES.find((s) => s.id === sceneId) ?? DIORAMA_SCENES[0]
  const goals: DioramaGoalState[] = meta.goals.map((g) => ({
    ...g,
    done: completedIds.has(g.id),
  }))
  const completed = goals.filter((g) => g.done).length
  return {
    sceneId,
    goals,
    completed,
    total: goals.length,
    awakened: completed >= goals.length,
  }
}

/**
 * 立体漫游 · 微缩奇境 3D 渲染与互动引擎：
 * - 实时 HDR/ACES 光影 + 软阴影 + 程序化梯度天空穹与 GLSL 动态水波；
 * - 6 座雕刻级世界城景模型 + 三段式「奇境唤醒目标」与 3D 终局奇观动画；
 * - 晨曦 / 暮色 / 星夜三态切换、自动缓转展台、三档镜头焦距与胶片滤镜抓拍。
 */
export class DioramaWorld {
  private readonly host: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly worldGroup = new THREE.Group()
  private readonly keyLight: THREE.DirectionalLight
  private readonly fillLight: THREE.DirectionalLight
  private readonly rimLight: THREE.DirectionalLight
  private readonly hemiLight: THREE.HemisphereLight
  private readonly skyDome: SkyDomeHandle
  private readonly textures: DioramaTextures
  private readonly clock = new THREE.Clock()

  private sceneId: DioramaSceneId = 'shanghai'
  private mood: DioramaMood = 'dusk'
  private autoOrbit = false
  private orbitDir = 1
  private onInteract?: (event: DioramaInteractEvent) => void
  private onProgress?: (snapshot: DioramaProgressSnapshot) => void

  private interactives: InteractiveNode[] = []
  private hitMeshes: THREE.Object3D[] = []
  private completedGoals = new Set<string>()
  private goalFocusMap = new Map<string, THREE.Vector3>()
  private unlockedAwakened = false
  private tickHooks: ((elapsed: number, dt: number) => void)[] = []
  private moodHooks: ((mood: DioramaMood) => void)[] = []
  private waterRippleFn: ((x: number, z: number) => void) | null = null
  private waterBioFn: ((bio: number) => void) | null = null
  private finaleTrigger: (() => void) | null = null
  private goalBeacon: THREE.Group | null = null
  private beaconLife = 0
  private interactionCount = 0

  private azimuth = 0.52
  private targetAzimuth = 0.52
  private polar = 0.72
  private targetPolar = 0.72
  private distance = 12.6
  private targetDistance = 12.6
  private pointer = { down: false, id: -1, lastX: 0, lastY: 0, moved: 0 }

  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly resizeObserver: ResizeObserver
  private disposed = false

  constructor(
    host: HTMLElement,
    initialScene: DioramaSceneId,
    onInteract?: (event: DioramaInteractEvent) => void,
    onProgress?: (snapshot: DioramaProgressSnapshot) => void,
  ) {
    this.host = host
    this.sceneId = initialScene
    this.onInteract = onInteract
    this.onProgress = onProgress

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const dom = this.renderer.domElement
    dom.style.position = 'absolute'
    dom.style.inset = '0'
    dom.style.width = '100%'
    dom.style.height = '100%'
    dom.style.display = 'block'
    dom.style.touchAction = 'none'
    dom.style.cursor = 'grab'
    host.appendChild(dom)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 110)
    this.textures = createDioramaTextures()

    this.skyDome = createDioramaSkyDome()
    this.scene.add(this.skyDome.mesh)
    this.scene.add(this.worldGroup)

    this.hemiLight = new THREE.HemisphereLight('#d6e8ff', '#3a4668', 1.05)
    this.scene.add(this.hemiLight)

    this.keyLight = new THREE.DirectionalLight('#ffddb2', 2.2)
    this.keyLight.position.set(8.5, 13.5, 7.5)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(1024, 1024)
    this.keyLight.shadow.camera.near = 2
    this.keyLight.shadow.camera.far = 34
    this.keyLight.shadow.camera.left = -5.8
    this.keyLight.shadow.camera.right = 5.8
    this.keyLight.shadow.camera.top = 6.2
    this.keyLight.shadow.camera.bottom = -4.5
    this.keyLight.shadow.bias = -0.0005
    this.keyLight.shadow.normalBias = 0.03
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

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()

    this.renderer.setAnimationLoop(() => this.renderFrame())
  }

  private resize() {
    if (this.disposed) return
    const w = Math.max(2, this.host.clientWidth)
    const h = Math.max(2, this.host.clientHeight)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  setMood(mood: DioramaMood) {
    this.mood = mood
    this.applyLighting()
  }

  setAutoOrbit(enabled: boolean) {
    this.autoOrbit = enabled
  }

  setZoomPreset(preset: DioramaZoomPreset) {
    this.targetDistance = preset === 'wide' ? 15.2 : preset === 'macro' ? 9.4 : 12.6
  }

  resetView() {
    this.targetAzimuth = 0.52
    this.targetPolar = 0.72
    this.targetDistance = 12.6
  }

  replayFinale() {
    this.finaleTrigger?.()
  }

  focusNextGoal(): string | null {
    const meta = DIORAMA_SCENES.find((s) => s.id === this.sceneId) ?? DIORAMA_SCENES[0]
    const nextGoal = meta.goals.find((g) => !this.completedGoals.has(g.id))
    if (!nextGoal) {
      this.replayFinale()
      return '此场景奇境已全部唤醒 · 重放终局奇观'
    }
    const pt = this.goalFocusMap.get(nextGoal.id)
    if (pt) {
      const ang = Math.atan2(pt.x, Math.max(0.5, pt.z + 4.5))
      this.targetAzimuth = clamp(ang + 0.35, -0.95, 1.95)
      this.targetPolar = clamp(0.76 - pt.y * 0.04, 0.42, 1.05)
      if (this.goalBeacon) {
        this.goalBeacon.position.set(pt.x, pt.y + 0.32, pt.z)
        this.goalBeacon.visible = true
        this.beaconLife = 5.5
      }
    }
    return `指引：${nextGoal.title}（${nextGoal.hint}）`
  }

  captureFrame(filter: DioramaFilter = 'none'): string | null {
    if (this.disposed) return null
    try {
      this.renderer.render(this.scene, this.camera)
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
    }
  }

  loadScene(id: DioramaSceneId, preAwakened = false) {
    this.sceneId = id
    this.interactionCount = 0
    this.interactives = []
    this.hitMeshes = []
    this.completedGoals.clear()
    this.goalFocusMap.clear()
    this.unlockedAwakened = preAwakened
    this.tickHooks = []
    this.moodHooks = []
    this.waterRippleFn = null
    this.waterBioFn = null
    this.finaleTrigger = null
    this.goalBeacon = null
    this.beaconLife = 0

    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0]
      this.worldGroup.remove(child)
      disposeTree(child)
    }

    this.buildAmbientClouds()

    const meta = DIORAMA_SCENES.find((s) => s.id === id) ?? DIORAMA_SCENES[0]
    const ctx: DioramaBuilderCtx = {
      group: this.worldGroup,
      textures: this.textures,
      getMood: () => this.mood,
      registerInteractive: (mesh, opts) => this.registerInteractive(mesh, opts),
      completeGoal: (goalId) => {
        if (this.completedGoals.has(goalId)) return
        this.completedGoals.add(goalId)
        this.beaconLife = 0
        if (this.goalBeacon) this.goalBeacon.visible = false
        const snap = buildGoalSnapshot(this.sceneId, this.completedGoals)
        if (snap.awakened && !this.unlockedAwakened) {
          this.unlockedAwakened = true
          this.finaleTrigger?.()
        }
        this.onProgress?.(snap)
      },
      isGoalDone: (goalId) => this.completedGoals.has(goalId),
      bindWater: (setRipple, setBio) => {
        this.waterRippleFn = setRipple
        this.waterBioFn = setBio
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
    }

    switch (id) {
      case 'shanghai':
        buildShanghai(ctx)
        break
      case 'library':
        buildLibrary(ctx)
        break
      case 'sydney':
        buildSydney(ctx)
        break
      case 'hawaii':
        buildHawaii(ctx)
        break
      case 'harbin':
        buildHarbin(ctx)
        break
      case 'observatory':
        buildObservatory(ctx)
        break
    }

    const beacon = createGoalBeacon(this.textures.glowHalo, meta.accent)
    this.worldGroup.add(beacon)
    this.goalBeacon = beacon

    this.applyLighting()
    this.resetView()
  }

  private registerInteractive(mesh: THREE.Object3D, opts: InteractiveRegistration) {
    const idx = this.interactives.length
    mesh.userData.interactIdx = idx
    this.interactives.push({
      mesh,
      goalId: opts.goalId,
      focusPoint: opts.focusPoint,
      onClick: opts.onClick,
    })
    this.hitMeshes.push(mesh)
    if (opts.goalId && opts.focusPoint && !this.goalFocusMap.has(opts.goalId)) {
      this.goalFocusMap.set(opts.goalId, opts.focusPoint)
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
      shanghai: {
        dawn: {
          zenith: '#274d80',
          mid: '#6c92be',
          horizon: '#f5cfa0',
          sun: '#ffe4b4',
          key: '#ffe2b6',
          fill: '#98c2f8',
          hemiTop: '#e4efff',
          hemiBot: '#46526e',
          keyInt: 2.35,
          hemiInt: 1.2,
          stars: 0.04,
          sunDir: [0.55, 0.32, -0.78],
        },
        dusk: {
          zenith: '#141e3c',
          mid: '#344974',
          horizon: '#df946e',
          sun: '#ffc98e',
          key: '#ffcf98',
          fill: '#82aef8',
          hemiTop: '#c4dcff',
          hemiBot: '#344162',
          keyInt: 2.1,
          hemiInt: 1.05,
          stars: 0.25,
          sunDir: [-0.45, 0.24, -0.86],
        },
        night: {
          zenith: '#050a18',
          mid: '#0e1934',
          horizon: '#1e3056',
          sun: '#a8c8ff',
          key: '#9ec0ff',
          fill: '#5678c4',
          hemiTop: '#8fb4f4',
          hemiBot: '#1d2742',
          keyInt: 1.28,
          hemiInt: 0.85,
          stars: 0.92,
          sunDir: [-0.28, 0.48, -0.82],
        },
      },
      library: {
        dawn: {
          zenith: '#2b5284',
          mid: '#6e94ba',
          horizon: '#ebd0ae',
          sun: '#ffe3b8',
          key: '#ffdfaf',
          fill: '#98c0f0',
          hemiTop: '#dfeeff',
          hemiBot: '#464d66',
          keyInt: 2.2,
          hemiInt: 1.18,
          stars: 0.02,
          sunDir: [0.5, 0.36, -0.78],
        },
        dusk: {
          zenith: '#17203f',
          mid: '#39486d',
          horizon: '#c98872',
          sun: '#ffc58d',
          key: '#ffc78f',
          fill: '#86a8ea',
          hemiTop: '#c6d6ff',
          hemiBot: '#3e3952',
          keyInt: 1.98,
          hemiInt: 1.02,
          stars: 0.2,
          sunDir: [-0.4, 0.26, -0.88],
        },
        night: {
          zenith: '#060b1c',
          mid: '#111c3a',
          horizon: '#233258',
          sun: '#9ebeff',
          key: '#94b6f8',
          fill: '#5a78ba',
          hemiTop: '#8aaee8',
          hemiBot: '#21273d',
          keyInt: 1.18,
          hemiInt: 0.82,
          stars: 0.88,
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
      hawaii: {
        dawn: {
          zenith: '#285e96',
          mid: '#6ba8c8',
          horizon: '#ffe1b0',
          sun: '#ffebb6',
          key: '#ffe5b0',
          fill: '#9ad4ee',
          hemiTop: '#e8f6ff',
          hemiBot: '#46585c',
          keyInt: 2.45,
          hemiInt: 1.22,
          stars: 0,
          sunDir: [0.58, 0.38, -0.72],
        },
        dusk: {
          zenith: '#241c44',
          mid: '#683f5e',
          horizon: '#ff9660',
          sun: '#ffc382',
          key: '#ffb87e',
          fill: '#98a6ee',
          hemiTop: '#ffd6be',
          hemiBot: '#3c3052',
          keyInt: 2.15,
          hemiInt: 1.05,
          stars: 0.22,
          sunDir: [0.35, 0.22, -0.9],
        },
        night: {
          zenith: '#070c1c',
          mid: '#14203e',
          horizon: '#243c5e',
          sun: '#9ec6ff',
          key: '#92beff',
          fill: '#5882c8',
          hemiTop: '#8db8f4',
          hemiBot: '#1d2d46',
          keyInt: 1.24,
          hemiInt: 0.84,
          stars: 0.94,
          sunDir: [0.28, 0.5, -0.82],
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
      observatory: {
        dawn: {
          zenith: '#1d447c',
          mid: '#5280b4',
          horizon: '#f2cba0',
          sun: '#ffe3b2',
          key: '#ffe0ae',
          fill: '#90bcf4',
          hemiTop: '#d8ecff',
          hemiBot: '#364a6c',
          keyInt: 2.25,
          hemiInt: 1.16,
          stars: 0.14,
          sunDir: [0.5, 0.34, -0.8],
        },
        dusk: {
          zenith: '#0c1530',
          mid: '#1f305a',
          horizon: '#866e94',
          sun: '#e2c2b8',
          key: '#d8dcff',
          fill: '#789ef0',
          hemiTop: '#bad8ff',
          hemiBot: '#243154',
          keyInt: 1.85,
          hemiInt: 0.96,
          stars: 0.65,
          sunDir: [-0.42, 0.32, -0.84],
        },
        night: {
          zenith: '#030714',
          mid: '#091229',
          horizon: '#152448',
          sun: '#a8ccff',
          key: '#9ec4ff',
          fill: '#5276c2',
          hemiTop: '#8cb4f2',
          hemiBot: '#182442',
          keyInt: 1.38,
          hemiInt: 0.82,
          stars: 1.0,
          sunDir: [-0.24, 0.54, -0.8],
        },
      },
    }

    const p = palettes[this.sceneId][this.mood]
    const sky = this.skyDome.uniforms
    sky.uZenith.value.set(p.zenith)
    sky.uMid.value.set(p.mid)
    sky.uHorizon.value.set(p.horizon)
    sky.uSunCol.value.set(p.sun)
    sky.uSunDir.value.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize()
    sky.uStars.value = p.stars

    this.keyLight.color.set(p.key)
    this.keyLight.intensity = p.keyInt
    this.keyLight.position.set(p.sunDir[0] * 14, Math.max(6, p.sunDir[1] * 24), p.sunDir[2] * -12)
    this.fillLight.color.set(p.fill)
    this.fillLight.intensity = this.mood === 'night' ? 0.62 : 0.85
    this.hemiLight.color.set(p.hemiTop)
    this.hemiLight.groundColor.set(p.hemiBot)
    this.hemiLight.intensity = p.hemiInt

    for (const hook of this.moodHooks) hook(this.mood)
  }

  private buildAmbientClouds() {
    const clouds = new THREE.Group()
    const cloudMat = createMat('#edf4fd', {
      transparent: true,
      opacity: 0.38,
      roughness: 0.95,
      depthWrite: false,
    })
    const specs: [number, number, number, number][] = [
      [-4.6, 4.4, -3.8, 0.72],
      [4.7, 4.8, -3.1, 0.65],
      [0.4, 5.4, -4.6, 0.82],
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

  private onPointerDown = (event: PointerEvent) => {
    this.pointer.down = true
    this.pointer.id = event.pointerId
    this.pointer.lastX = event.clientX
    this.pointer.lastY = event.clientY
    this.pointer.moved = 0
    this.renderer.domElement.setPointerCapture?.(event.pointerId)
    this.renderer.domElement.style.cursor = 'grabbing'
  }

  private onPointerMove = (event: PointerEvent) => {
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
    this.targetAzimuth = clamp(this.targetAzimuth - dx * 0.0044, -1.05, 2.15)
    this.targetPolar = clamp(this.targetPolar - dy * 0.0036, 0.34, 1.15)
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointer.down || event.pointerId !== this.pointer.id) return
    this.pointer.down = false
    this.renderer.domElement.releasePointerCapture?.(event.pointerId)
    this.renderer.domElement.style.cursor = 'grab'
    if (this.pointer.moved < 8) {
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
    this.targetDistance = clamp(this.targetDistance + event.deltaY * 0.007, 8.2, 16.5)
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
    const dt = Math.min(0.05, this.clock.getDelta())
    const elapsed = this.clock.elapsedTime

    this.skyDome.uniforms.uTime.value = elapsed

    if (this.autoOrbit && !this.pointer.down) {
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

    const k = 1 - Math.exp(-dt * 7.5)
    this.azimuth += (this.targetAzimuth - this.azimuth) * k
    this.polar += (this.targetPolar - this.polar) * k
    this.distance += (this.targetDistance - this.distance) * k

    const cosP = Math.cos(this.polar)
    const sinP = Math.sin(this.polar)
    this.camera.position.set(
      Math.sin(this.azimuth) * cosP * this.distance,
      sinP * this.distance + 0.9,
      Math.cos(this.azimuth) * cosP * this.distance,
    )
    this.camera.lookAt(0, 1.05, -0.35)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    const dom = this.renderer.domElement
    dom.removeEventListener('pointerdown', this.onPointerDown)
    dom.removeEventListener('pointermove', this.onPointerMove)
    dom.removeEventListener('pointerup', this.onPointerUp)
    dom.removeEventListener('pointercancel', this.onPointerUp)
    dom.removeEventListener('wheel', this.onWheel)
    this.resizeObserver.disconnect()

    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0]
      this.worldGroup.remove(child)
      disposeTree(child)
    }
    disposeTree(this.skyDome.mesh)
    disposeDioramaTextures(this.textures)
    this.renderer.dispose()
    dom.parentNode?.removeChild(dom)
  }
}
