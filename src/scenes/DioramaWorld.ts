import * as THREE from 'three'
import type { DioramaSceneId } from '../services/albumStorage'
import type { AmbientKind } from '../types/vision'

export type DioramaSfx = 'lamp' | 'star' | 'ripple' | 'snow' | 'horn'

export interface DioramaSceneMeta {
  id: DioramaSceneId
  title: string
  short: string
  city: string
  region: string
  ambience: AmbientKind
  tempDusk: string
  accent: string
  interactHint: string
  loreNote: string
}

export const DIORAMA_SCENES: DioramaSceneMeta[] = [
  {
    id: 'shanghai',
    title: '上海外滩 · 黄浦暮色',
    short: '上海外滩',
    city: '上海',
    region: '华东江岸',
    ambience: 'city',
    tempDusk: '15°C · 江风汽笛',
    accent: '#f2c28b',
    interactHint: '轻触江畔路灯、东方明珠或江轮，点亮外滩夜色与汽笛',
    loreNote: '替她记下整条江岸依次亮起的钟楼与渡轮。',
  },
  {
    id: 'library',
    title: '南京 · 晚雨图书馆',
    short: '晚雨图书馆',
    city: '南京',
    region: '金陵梧桐',
    ambience: 'library',
    tempDusk: '18°C · 翻书与微雨',
    accent: '#ffd08a',
    interactHint: '轻点图书馆拱形窗格，亲手替自习室逐盏点亮暖灯',
    loreNote: '安静的翻书声和窗前暖黄的灯，最像人间寻常的黄昏。',
  },
  {
    id: 'sydney',
    title: '悉尼海港 · 南半球盛夏',
    short: '悉尼盛夏',
    city: '悉尼',
    region: '南半球夏日',
    ambience: 'ocean',
    tempDusk: '28°C · 盛夏海风',
    accent: '#8ee0ec',
    interactHint: '轻点海港或白帆，荡起夏日海浪并推动帆船穿过海湾',
    loreNote: '北半球正在降温时，地球另一侧的白色风帆正泡在盛夏阳光里。',
  },
  {
    id: 'hawaii',
    title: '夏威夷 · 珊瑚日落湾',
    short: '夏威夷湾',
    city: '夏威夷',
    region: '太平洋热带',
    ambience: 'ocean',
    tempDusk: '27°C · 热带椰风',
    accent: '#ff9d76',
    interactHint: '轻触栈桥火把灯笼或暖海，点亮暮色海湾并涌起潮声',
    loreNote: '把太平洋最暖的一捧晚霞，留在这一页纪念册里。',
  },
  {
    id: 'harbin',
    title: '哈尔滨 · 初雪教堂广场',
    short: '哈尔滨初雪',
    city: '哈尔滨',
    region: '北国雪夜',
    ambience: 'snow',
    tempDusk: '-7°C · 细雪钟声',
    accent: '#b8dcff',
    interactHint: '轻点穹顶钟楼或积雪路灯，唤起漫天初雪与暖灯冰晕',
    loreNote: '零下七度的雪片落得很慢，路灯把整座广场烘成奶油色。',
  },
  {
    id: 'observatory',
    title: '高山观星台 · 穹顶星海',
    short: '观星穹顶',
    city: '拉萨',
    region: '高原星空',
    ambience: 'night',
    tempDusk: '2°C · 高原晴夜',
    accent: '#9cf2d4',
    interactHint: '轻点悬浮星石，旋转望远镜圆顶并在夜空连起专属星座',
    loreNote: '哪怕再也发不出中微子信号，仰望星空的人总会想起地心深处。',
  },
]

export interface DioramaInteractEvent {
  label: string
  sfx: DioramaSfx
  count: number
}

interface InteractiveNode {
  mesh: THREE.Object3D
  onClick: () => { label: string; sfx: DioramaSfx }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function makeMat(
  color: string,
  options: {
    emissive?: string
    emissiveIntensity?: number
    roughness?: number
    metalness?: number
    transparent?: boolean
    opacity?: number
    side?: THREE.Side
  } = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: options.emissiveIntensity ?? 0,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.08,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    flatShading: true,
  })
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

/**
 * 纪念碑谷风格 3D 微缩景观引擎：
 * - 低多边形柔和粉彩建筑体块 + 阶梯底座 + 柔和漫射光；
 * - 小范围舒适轨道环视（阻尼柔和、不眩晕）+ 场景内立体道具直点互动；
 * - 支持黄昏 / 星夜双氛围切换与高清取景截帧。
 */
export class DioramaWorld {
  private readonly host: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly worldGroup = new THREE.Group()
  private readonly keyLight: THREE.DirectionalLight
  private readonly fillLight: THREE.DirectionalLight
  private readonly hemiLight: THREE.HemisphereLight
  private readonly clock = new THREE.Clock()

  private sceneId: DioramaSceneId = 'shanghai'
  private mood: 'dusk' | 'night' = 'dusk'
  private onInteract?: (event: DioramaInteractEvent) => void

  private interactives: InteractiveNode[] = []
  private hitMeshes: THREE.Object3D[] = []
  private tickHooks: ((elapsed: number, dt: number) => void)[] = []
  private interactionCount = 0

  private azimuth = 0.56
  private targetAzimuth = 0.56
  private polar = 0.68
  private targetPolar = 0.68
  private distance = 12.8
  private targetDistance = 12.8
  private pointer = { down: false, id: -1, lastX: 0, lastY: 0, moved: 0 }

  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly resizeObserver: ResizeObserver
  private disposed = false

  constructor(
    host: HTMLElement,
    initialScene: DioramaSceneId,
    onInteract?: (event: DioramaInteractEvent) => void,
  ) {
    this.host = host
    this.sceneId = initialScene
    this.onInteract = onInteract

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.domElement.style.position = 'absolute'
    this.renderer.domElement.style.inset = '0'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    this.renderer.domElement.style.cursor = 'grab'
    host.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 90)
    this.scene.add(this.worldGroup)

    this.hemiLight = new THREE.HemisphereLight('#d6e8ff', '#3a4668', 1.15)
    this.scene.add(this.hemiLight)

    this.keyLight = new THREE.DirectionalLight('#ffddb2', 2.05)
    this.keyLight.position.set(10, 15, 9)
    this.scene.add(this.keyLight)

    this.fillLight = new THREE.DirectionalLight('#8ab8ff', 0.85)
    this.fillLight.position.set(-10, 7, -8)
    this.scene.add(this.fillLight)

    this.loadScene(initialScene)

    const dom = this.renderer.domElement
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

  setMood(mood: 'dusk' | 'night') {
    this.mood = mood
    this.applyLighting()
  }

  resetView() {
    this.targetAzimuth = 0.56
    this.targetPolar = 0.68
    this.targetDistance = 12.8
  }

  captureFrame(): string | null {
    if (this.disposed) return null
    try {
      this.renderer.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/jpeg', 0.94)
    } catch {
      return null
    }
  }

  loadScene(id: DioramaSceneId) {
    this.sceneId = id
    this.interactionCount = 0
    this.interactives = []
    this.hitMeshes = []
    this.tickHooks = []

    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0]
      this.worldGroup.remove(child)
      disposeTree(child)
    }

    // 柔和柔和云环背景点缀
    this.buildAmbientClouds()

    switch (id) {
      case 'shanghai':
        this.buildShanghai()
        break
      case 'library':
        this.buildLibrary()
        break
      case 'sydney':
        this.buildSydney()
        break
      case 'hawaii':
        this.buildHawaii()
        break
      case 'harbin':
        this.buildHarbin()
        break
      case 'observatory':
        this.buildObservatory()
        break
    }

    this.applyLighting()
    this.resetView()
  }

  private registerInteractive(mesh: THREE.Object3D, onClick: () => { label: string; sfx: DioramaSfx }) {
    const idx = this.interactives.length
    mesh.userData.interactIdx = idx
    this.interactives.push({ mesh, onClick })
    this.hitMeshes.push(mesh)
  }

  private applyLighting() {
    const night = this.mood === 'night'
    const palettes: Record<
      DioramaSceneId,
      {
        bgDusk: string
        bgNight: string
        keyDusk: string
        keyNight: string
        hemiTop: string
        hemiBot: string
      }
    > = {
      shanghai: {
        bgDusk: '#1b2640',
        bgNight: '#0c1324',
        keyDusk: '#ffd2a0',
        keyNight: '#9dbdff',
        hemiTop: '#c4dcff',
        hemiBot: '#344162',
      },
      library: {
        bgDusk: '#1f2842',
        bgNight: '#0e1528',
        keyDusk: '#ffcca0',
        keyNight: '#8faee8',
        hemiTop: '#c6d6ff',
        hemiBot: '#3e3952',
      },
      sydney: {
        bgDusk: '#1f4568',
        bgNight: '#0d2238',
        keyDusk: '#ffe8bd',
        keyNight: '#a0cbff',
        hemiTop: '#d8f2ff',
        hemiBot: '#295778',
      },
      hawaii: {
        bgDusk: '#352646',
        bgNight: '#121830',
        keyDusk: '#ffb98a',
        keyNight: '#9bbcff',
        hemiTop: '#ffd6be',
        hemiBot: '#3c3052',
      },
      harbin: {
        bgDusk: '#1c2c44',
        bgNight: '#0c1628',
        keyDusk: '#e8effa',
        keyNight: '#a8ccff',
        hemiTop: '#dceeff',
        hemiBot: '#384c6b',
      },
      observatory: {
        bgDusk: '#141e38',
        bgNight: '#080e1d',
        keyDusk: '#c8dcff',
        keyNight: '#9cc2ff',
        hemiTop: '#bad8ff',
        hemiBot: '#243154',
      },
    }
    const p = palettes[this.sceneId]
    this.scene.background = new THREE.Color(night ? p.bgNight : p.bgDusk)
    this.keyLight.color.set(night ? p.keyNight : p.keyDusk)
    this.keyLight.intensity = night ? 1.15 : 2.1
    this.hemiLight.color.set(p.hemiTop)
    this.hemiLight.groundColor.set(p.hemiBot)
    this.hemiLight.intensity = night ? 0.78 : 1.18
  }

  private buildPlinth(topColor: string, sideColor: string, waterColor?: string) {
    const base = new THREE.Group()
    // 纪念碑谷经典阶梯悬浮基座
    const lower = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 5.6), makeMat('#24324c'))
    lower.position.y = -0.95
    base.add(lower)

    const mid = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.55, 6.3), makeMat(sideColor))
    mid.position.y = -0.42
    base.add(mid)

    const top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.24, 6.6), makeMat(topColor))
    top.position.y = -0.05
    base.add(top)

    if (waterColor) {
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(6.62, 0.16, 2.7),
        makeMat(waterColor, { roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.88 }),
      )
      water.position.set(0, -0.04, 1.96)
      base.add(water)
      this.tickHooks.push((t) => {
        water.position.y = -0.04 + Math.sin(t * 1.8) * 0.018
      })
    }

    this.worldGroup.add(base)
    return base
  }

  private buildAmbientClouds() {
    const clouds = new THREE.Group()
    const cloudMat = makeMat('#e6effa', { transparent: true, opacity: 0.42, roughness: 0.95 })
    const specs: [number, number, number, number][] = [
      [-4.2, 4.1, -3.4, 0.72],
      [4.5, 4.6, -2.8, 0.65],
      [0.6, 5.2, -4.4, 0.82],
    ]
    specs.forEach(([x, y, z, s], idx) => {
      const c = new THREE.Group()
      c.position.set(x, y, z)
      c.scale.setScalar(s)
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), cloudMat)
      a.scale.set(1.5, 0.65, 0.9)
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), cloudMat)
      b.position.set(0.65, -0.08, 0.12)
      b.scale.set(1.2, 0.55, 0.8)
      c.add(a, b)
      clouds.add(c)
      this.tickHooks.push((t) => {
        c.position.x = x + Math.sin(t * 0.35 + idx * 1.9) * 0.55
      })
    })
    this.worldGroup.add(clouds)
  }

  private buildShanghai() {
    this.buildPlinth('#d8c9b8', '#485b7c', '#296c8e')
    const group = new THREE.Group()
    this.worldGroup.add(group)

    // 沿岸石栏与万国建筑钟楼（纪念碑谷粉彩几何）
    const promenade = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 3.85), makeMat('#e2d2be'))
    promenade.position.set(0, 0.08, -1.36)
    group.add(promenade)

    const clockBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.85, 1.3), makeMat('#d9b89c'))
    clockBody.position.set(-1.75, 1.05, -1.6)
    group.add(clockBody)
    const clockTower = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.45, 0.86), makeMat('#e8ccb2'))
    clockTower.position.set(-1.75, 2.55, -1.6)
    group.add(clockTower)
    const clockRoof = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.9, 4), makeMat('#58798a'))
    clockRoof.rotation.y = Math.PI / 4
    clockRoof.position.set(-1.75, 3.7, -1.6)
    group.add(clockRoof)

    const clockFaceMat = makeMat('#ffe4ad', { emissive: '#ffba5c', emissiveIntensity: 0.9 })
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), clockFaceMat)
    clockFace.rotation.x = Math.PI / 2
    clockFace.position.set(-1.75, 2.72, -1.15)
    group.add(clockFace)

    // 东方明珠风格塔体（可点击点亮粉色/金色霓虹）
    const pearlGroup = new THREE.Group()
    pearlGroup.position.set(1.65, 0.18, -1.85)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3.9, 8), makeMat('#e4d5d8'))
    shaft.position.y = 1.95
    pearlGroup.add(shaft)
    const lowerOrbMat = makeMat('#f2a6b6', { emissive: '#e66c8e', emissiveIntensity: 0.55 })
    const lowerOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 2), lowerOrbMat)
    lowerOrb.position.y = 1.3
    pearlGroup.add(lowerOrb)
    const upperOrbMat = makeMat('#ffd29c', { emissive: '#ff9d5c', emissiveIntensity: 0.65 })
    const upperOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 2), upperOrbMat)
    upperOrb.position.y = 2.95
    pearlGroup.add(upperOrb)
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.9, 6), makeMat('#fff0d8'))
    spire.position.y = 4.25
    pearlGroup.add(spire)
    group.add(pearlGroup)

    let pearlBright = false
    this.registerInteractive(lowerOrb, () => {
      pearlBright = !pearlBright
      lowerOrbMat.emissiveIntensity = pearlBright ? 1.45 : 0.55
      upperOrbMat.emissiveIntensity = pearlBright ? 1.55 : 0.65
      return { label: pearlBright ? '点亮外滩塔灯' : '柔和江岸霓虹', sfx: 'lamp' }
    })

    // 4 盏沿江可点击复古路灯
    for (let i = 0; i < 4; i += 1) {
      const lx = -2.25 + i * 1.5
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1.05, 6), makeMat('#394862'))
      pole.position.set(lx, 0.68, 0.35)
      group.add(pole)
      const lampMat = makeMat('#ffe0a6', { emissive: '#ffae48', emissiveIntensity: i % 2 === 0 ? 1.1 : 0.2 })
      const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), lampMat)
      bulb.position.set(lx, 1.24, 0.35)
      group.add(bulb)
      let lit = i % 2 === 0
      this.registerInteractive(bulb, () => {
        lit = !lit
        lampMat.emissiveIntensity = lit ? 1.35 : 0.12
        return { label: lit ? '点亮一盏外滩江灯' : '调暗一盏江灯', sfx: 'lamp' }
      })
    }

    // 黄浦江游船（缓缓巡航，点击鸣笛加速并激起涟漪）
    const ferry = new THREE.Group()
    ferry.position.set(-1.2, 0.14, 2.0)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.44), makeMat('#f2e6d8'))
    ferry.add(hull)
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.22, 0.32),
      makeMat('#ffe0a3', { emissive: '#ffb04f', emissiveIntensity: 0.7 }),
    )
    cabin.position.set(0.05, 0.2, 0)
    ferry.add(cabin)
    group.add(ferry)

    let ferryBoost = 0
    this.registerInteractive(hull, () => {
      ferryBoost = 1.4
      return { label: '黄浦江轮鸣笛驶过', sfx: 'horn' }
    })
    this.tickHooks.push((t, dt) => {
      ferryBoost = Math.max(0, ferryBoost - dt * 0.6)
      ferry.position.x = Math.sin(t * (0.38 + ferryBoost * 0.35)) * 2.15
      ferry.position.y = 0.14 + Math.sin(t * 2.4) * 0.025
    })
  }

  private buildLibrary() {
    this.buildPlinth('#cfc5b8', '#4d5472')
    const group = new THREE.Group()
    this.worldGroup.add(group)

    // 阶梯广场与砖红纪念碑谷主馆
    const steps = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.26, 1.2), makeMat('#dfd4c4'))
    steps.position.set(0, 0.16, 1.15)
    group.add(steps)

    const building = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 2.35), makeMat('#b86e66'))
    building.position.set(0, 1.38, -0.5)
    group.add(building)

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.24, 2.65), makeMat('#e6d9c8'))
    cornice.position.set(0, 2.75, -0.5)
    group.add(cornice)

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.85, 1.05, 4), makeMat('#425978'))
    roof.rotation.y = Math.PI / 4
    roof.scale.set(1.18, 1, 0.68)
    roof.position.set(0, 3.38, -0.5)
    group.add(roof)

    // 9 扇可逐个点亮的自习室拱窗
    let litCount = 0
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const initLit = (row + col) % 2 === 0
        if (initLit) litCount += 1
        const wMat = makeMat(initLit ? '#ffe2a4' : '#3a4a66', {
          emissive: '#ffaa44',
          emissiveIntensity: initLit ? 1.05 : 0.06,
        })
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.14), wMat)
        win.position.set(-1.38 + col * 0.92, 0.92 + row * 1.02, 0.68)
        group.add(win)
        let lit = initLit
        this.registerInteractive(win, () => {
          lit = !lit
          litCount += lit ? 1 : -1
          wMat.color.set(lit ? '#ffe2a4' : '#3a4a66')
          wMat.emissiveIntensity = lit ? 1.25 : 0.05
          return { label: lit ? `亮起一盏自习灯 (${litCount}/8)` : `熄灭一盏窗灯 (${litCount}/8)`, sfx: 'lamp' }
        })
      }
    }

    // 庭院两棵秋金梧桐树
    for (const [tx, tz] of [[-2.35, 1.55], [2.35, 1.45]] as const) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.15, 7), makeMat('#6b4d3e'))
      trunk.position.set(tx, 0.62, tz)
      group.add(trunk)
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), makeMat('#e8b264'))
      crown.position.set(tx, 1.45, tz)
      group.add(crown)
      this.tickHooks.push((t) => {
        crown.rotation.y = Math.sin(t * 0.8 + tx) * 0.08
      })
    }

    // 轻柔晚雨丝粒子
    this.addParticleLayer('#a8d0ff', 140, 'rain')
  }

  private buildSydney() {
    this.buildPlinth('#f0dec4', '#4b7896', '#2e98b6')
    const group = new THREE.Group()
    this.worldGroup.add(group)

    // 歌剧院石台基座
    const quay = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.34, 2.9), makeMat('#e5d6c3'))
    quay.position.set(-0.3, 0.22, -1.0)
    group.add(quay)

    // 纪念碑谷几何贝壳风帆群
    const sailMat = makeMat('#fff6ea', { emissive: '#ffd29e', emissiveIntensity: 0.15, roughness: 0.45 })
    const sailSpecs: [number, number, number, number, number][] = [
      [-1.55, 0.4, -1.1, 1.05, 1.85],
      [-0.55, 0.4, -1.0, 0.92, 1.58],
      [0.35, 0.4, -0.95, 0.78, 1.28],
      [1.25, 0.4, -1.15, 0.86, 1.48],
    ]
    let warmGlow = false
    sailSpecs.forEach(([sx, sy, sz, rad, h]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 4), sailMat)
      cone.position.set(sx, sy + h * 0.46, sz)
      cone.rotation.set(-0.18, 0.3, -0.26)
      cone.scale.set(0.75, 1, 1.15)
      group.add(cone)
      this.registerInteractive(cone, () => {
        warmGlow = !warmGlow
        sailMat.emissiveIntensity = warmGlow ? 0.55 : 0.15
        return { label: warmGlow ? '悉尼风帆映亮夏日金光' : '恢复盛夏象牙白帆', sfx: 'ripple' }
      })
    })

    // 南半球海港帆船（点击加速顺风航行）
    const boat = new THREE.Group()
    boat.position.set(0.4, 0.15, 2.0)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.38), makeMat('#ffffff'))
    boat.add(hull)
    const mast = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.08, 3), makeMat('#ff8f70'))
    mast.position.set(0, 0.65, 0)
    boat.add(mast)
    group.add(boat)

    let sailSpeed = 0
    this.registerInteractive(hull, () => {
      sailSpeed = 1.6
      return { label: '盛夏海风推动帆船穿湾', sfx: 'ripple' }
    })
    this.tickHooks.push((t, dt) => {
      sailSpeed = Math.max(0, sailSpeed - dt * 0.55)
      boat.position.x = Math.cos(t * (0.42 + sailSpeed * 0.45)) * 2.1
      boat.rotation.z = Math.sin(t * 2.2) * 0.06
    })
  }

  private buildHawaii() {
    this.buildPlinth('#e8b88a', '#8c5a5a', '#249aa8')
    const group = new THREE.Group()
    this.worldGroup.add(group)

    // 阶梯珊瑚火山岬角
    const hill1 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 1.25, 6), makeMat('#d4846a'))
    hill1.position.set(-1.45, 0.65, -1.45)
    group.add(hill1)
    const hill2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.5, 1.05, 6), makeMat('#68986c'))
    hill2.position.set(-1.45, 1.65, -1.45)
    group.add(hill2)

    // 落日太阳圆盘
    const sunMat = makeMat('#ffd996', { emissive: '#ff8a4c', emissiveIntensity: 1.05 })
    const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 2), sunMat)
    sun.position.set(1.85, 2.45, -2.1)
    group.add(sun)
    let sunsetDeep = false
    this.registerInteractive(sun, () => {
      sunsetDeep = !sunsetDeep
      sunMat.emissiveIntensity = sunsetDeep ? 1.6 : 1.05
      sun.position.y = sunsetDeep ? 1.85 : 2.45
      return { label: sunsetDeep ? '太平洋落日沉入珊瑚海' : '升起金色热带夕阳', sfx: 'lamp' }
    })

    // 3 棵摇曳几何椰子树
    for (const [px, pz, lean] of [[-2.1, 0.05, 0.25], [1.95, -0.35, -0.22], [-0.45, -1.75, 0.12]] as const) {
      const palm = new THREE.Group()
      palm.position.set(px, 0.08, pz)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.9, 6), makeMat('#8d6247'))
      trunk.position.y = 0.92
      trunk.rotation.z = lean
      palm.add(trunk)
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.45, 6), makeMat('#4d9468'))
      crown.position.set(-lean * 1.1, 1.92, 0)
      palm.add(crown)
      group.add(palm)
      this.tickHooks.push((t) => {
        crown.rotation.z = Math.sin(t * 1.5 + px) * 0.09
      })
    }

    // 暖木栈桥与 3 盏可点亮热带火把灯
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 2.75), makeMat('#82543d'))
    pier.position.set(0.45, 0.18, 1.4)
    group.add(pier)
    for (let i = 0; i < 3; i += 1) {
      const lz = 0.55 + i * 0.85
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 6), makeMat('#5a3929'))
      pole.position.set(0.85, 0.52, lz)
      group.add(pole)
      const flameMat = makeMat('#ffcb78', { emissive: '#ff7d30', emissiveIntensity: 1.0 })
      const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), flameMat)
      flame.position.set(0.85, 0.95, lz)
      group.add(flame)
      let on = true
      this.registerInteractive(flame, () => {
        on = !on
        flameMat.emissiveIntensity = on ? 1.45 : 0.08
        return { label: on ? '点燃栈桥火把灯' : '轻熄海湾火光', sfx: 'lamp' }
      })
    }
  }

  private buildHarbin() {
    this.buildPlinth('#eef5fc', '#667f9e')
    const group = new THREE.Group()
    this.worldGroup.add(group)

    // 粉彩红砖教堂主体 + 标志性绿色洋葱穹顶
    const hall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.95, 2.6), makeMat('#c47c6e'))
    hall.position.set(0, 1.02, -0.45)
    group.add(hall)

    const domeMat = makeMat('#4c8f7a', { emissive: '#225245', emissiveIntensity: 0.25 })
    const mainTower = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 1.25, 10), makeMat('#d69888'))
    mainTower.position.set(0, 2.55, -0.45)
    group.add(mainTower)
    const onion = new THREE.Mesh(new THREE.SphereGeometry(0.82, 12, 10), domeMat)
    onion.scale.set(1, 1.15, 1)
    onion.position.set(0, 3.45, -0.45)
    group.add(onion)
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.85, 6), makeMat('#f2c28b', { emissive: '#e09a44', emissiveIntensity: 0.6 }))
    spire.position.set(0, 4.55, -0.45)
    group.add(spire)

    for (const [cx, cz] of [[-1.15, -1.45], [1.15, -1.45], [-1.15, 0.55], [1.15, 0.55]] as const) {
      const sub = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), domeMat)
      sub.position.set(cx, 2.28, cz)
      group.add(sub)
    }

    let snowSwirl = 0
    this.registerInteractive(onion, () => {
      snowSwirl = 1.8
      return { label: '圣索菲亚钟声扬起初雪', sfx: 'snow' }
    })

    // 4 盏暖黄雪夜路灯
    for (const [lx, lz] of [[-2.05, 1.65], [2.05, 1.65]] as const) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.35, 6), makeMat('#3a485e'))
      pole.position.set(lx, 0.72, lz)
      group.add(pole)
      const bulbMat = makeMat('#ffe3a8', { emissive: '#ffaa44', emissiveIntensity: 1.15 })
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bulbMat)
      bulb.position.set(lx, 1.46, lz)
      group.add(bulb)
      let lit = true
      this.registerInteractive(bulb, () => {
        lit = !lit
        bulbMat.emissiveIntensity = lit ? 1.55 : 0.1
        return { label: lit ? '点亮雪夜路灯暖晕' : '雪夜路灯渐暗', sfx: 'lamp' }
      })
    }

    this.addParticleLayer('#f4f9ff', 170, 'snow', () => snowSwirl)
    this.tickHooks.push((_, dt) => {
      snowSwirl = Math.max(0, snowSwirl - dt * 0.7)
    })
  }

  private buildObservatory() {
    this.buildPlinth('#3e5278', '#223152')
    const group = new THREE.Group()
    this.worldGroup.add(group)

    // 阶梯观星高台与旋转圆顶
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.55, 0.65, 8), makeMat('#50668f'))
    tier.position.set(0, 0.36, -0.3)
    group.add(tier)

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.42, 1.45, 12), makeMat('#d2dce8'))
    tower.position.set(0, 1.38, -0.3)
    group.add(tower)

    const domeGroup = new THREE.Group()
    domeGroup.position.set(0, 2.1, -0.3)
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
      makeMat('#eef4fa'),
    )
    domeGroup.add(dome)
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.35, 10),
      makeMat('#e8b97e', { emissive: '#c48a42', emissiveIntensity: 0.4 }),
    )
    scope.position.set(0, 0.62, 0.85)
    scope.rotation.x = Math.PI / 3.2
    domeGroup.add(scope)
    group.add(domeGroup)

    let domeTargetY = 0.2
    this.registerInteractive(dome, () => {
      domeTargetY += Math.PI / 3
      return { label: '转动天文台望远镜穹顶', sfx: 'star' }
    })

    // 6 颗悬浮立体星石，点击观测并连起发光星座线
    const starCoords: [number, number, number][] = [
      [-2.4, 3.7, -1.6],
      [-1.1, 4.4, -2.0],
      [0.3, 4.1, -2.2],
      [1.7, 4.6, -1.7],
      [2.5, 3.6, -1.1],
      [0.9, 3.2, -2.5],
    ]
    const observedPts: THREE.Vector3[] = []
    let lineMesh: THREE.Line | null = null
    const lineMat = new THREE.LineBasicMaterial({ color: '#9cf2d4', transparent: true, opacity: 0.85 })

    starCoords.forEach(([sx, sy, sz], idx) => {
      const sMat = makeMat('#fff2cc', { emissive: '#8cc8ff', emissiveIntensity: 0.55 })
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), sMat)
      star.position.set(sx, sy, sz)
      group.add(star)
      let picked = false
      this.registerInteractive(star, () => {
        if (!picked) {
          picked = true
          sMat.emissive.set('#ffd278')
          sMat.emissiveIntensity = 1.65
          star.scale.setScalar(1.32)
          observedPts.push(new THREE.Vector3(sx, sy, sz))
          domeTargetY = Math.atan2(sx, sz + 0.3)
          if (observedPts.length >= 2) {
            if (lineMesh) {
              group.remove(lineMesh)
              lineMesh.geometry.dispose()
            }
            const geo = new THREE.BufferGeometry().setFromPoints(observedPts)
            lineMesh = new THREE.Line(geo, lineMat)
            group.add(lineMesh)
          }
        }
        return { label: `观测第 ${observedPts.length} 颗星 · 连起星座`, sfx: 'star' }
      })
      this.tickHooks.push((t) => {
        star.rotation.y = t * 0.9 + idx
        star.position.y = sy + Math.sin(t * 1.4 + idx) * 0.12
      })
    })

    this.tickHooks.push((_, dt) => {
      domeGroup.rotation.y += (domeTargetY - domeGroup.rotation.y) * Math.min(1, dt * 4)
    })
  }

  private addParticleLayer(
    color: string,
    count: number,
    mode: 'rain' | 'snow',
    getBoost?: () => number,
  ) {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 8.5
      positions[i * 3 + 1] = Math.random() * 6.5
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8.5
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color,
      size: mode === 'snow' ? 0.11 : 0.065,
      transparent: true,
      opacity: mode === 'snow' ? 0.82 : 0.52,
      depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    this.worldGroup.add(points)
    this.tickHooks.push((t, dt) => {
      const attr = geo.attributes.position as THREE.BufferAttribute
      const boost = getBoost ? getBoost() : 0
      const fall = (mode === 'rain' ? 4.8 : 0.85) + boost * 1.4
      for (let i = 0; i < count; i += 1) {
        let y = attr.getY(i) - fall * dt
        if (y < 0.05) y = 6.4
        attr.setY(i, y)
        if (mode === 'snow') {
          const x = attr.getX(i) + Math.sin(t * 1.2 + i) * (0.25 + boost * 0.7) * dt
          attr.setX(i, x > 4.2 ? -4.2 : x < -4.2 ? 4.2 : x)
        }
      }
      attr.needsUpdate = true
    })
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
    // 小范围舒适环视：左右约 ±68°，俯仰约 22°..64°
    this.targetAzimuth = clamp(this.targetAzimuth - dx * 0.0044, -0.7, 1.85)
    this.targetPolar = clamp(this.targetPolar - dy * 0.0036, 0.36, 1.12)
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointer.down || event.pointerId !== this.pointer.id) return
    this.pointer.down = false
    this.renderer.domElement.releasePointerCapture?.(event.pointerId)
    this.renderer.domElement.style.cursor = 'grab'
    if (this.pointer.moved < 8) {
      const node = this.pickInteractive(event.clientX, event.clientY)
      if (node) {
        const res = node.onClick()
        this.interactionCount += 1
        this.onInteract?.({ label: res.label, sfx: res.sfx, count: this.interactionCount })
      }
    }
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault()
    this.targetDistance = clamp(this.targetDistance + Math.sign(event.deltaY) * 0.75, 9.2, 16.5)
  }

  private pickInteractive(clientX: number, clientY: number): InteractiveNode | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(this.hitMeshes, true)
    if (!hits.length) return null
    let obj: THREE.Object3D | null = hits[0].object
    while (obj) {
      if (typeof obj.userData.interactIdx === 'number') {
        return this.interactives[obj.userData.interactIdx] ?? null
      }
      obj = obj.parent
    }
    return null
  }

  private renderFrame() {
    if (this.disposed) return
    const dt = Math.min(0.05, this.clock.getDelta())
    const elapsed = this.clock.elapsedTime

    const damp = 1 - Math.exp(-dt * 6.5)
    this.azimuth += (this.targetAzimuth - this.azimuth) * damp
    this.polar += (this.targetPolar - this.polar) * damp
    this.distance += (this.targetDistance - this.distance) * damp

    // 极轻盈悬浮微呼吸
    this.worldGroup.position.y = Math.sin(elapsed * 0.85) * 0.06

    const sinP = Math.sin(this.polar)
    this.camera.position.set(
      Math.sin(this.azimuth) * sinP * this.distance,
      1.35 + Math.cos(this.polar) * this.distance,
      Math.cos(this.azimuth) * sinP * this.distance,
    )
    this.camera.lookAt(0, 1.15, -0.2)

    for (const hook of this.tickHooks) hook(elapsed, dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    const dom = this.renderer.domElement
    dom.removeEventListener('pointerdown', this.onPointerDown)
    dom.removeEventListener('pointermove', this.onPointerMove)
    dom.removeEventListener('pointerup', this.onPointerUp)
    dom.removeEventListener('pointercancel', this.onPointerUp)
    dom.removeEventListener('wheel', this.onWheel)
    disposeTree(this.scene)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    if (dom.parentElement === this.host) this.host.removeChild(dom)
  }
}
