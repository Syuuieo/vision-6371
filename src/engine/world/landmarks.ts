import * as THREE from 'three'
import {
  LAKE,
  ROAM,
  SCENIC_BENCHES,
  WORLD_DISCOVERIES,
  WORLD_TRAILS,
  distanceToSegmentSq2D,
  heightAt,
  shared,
  smoothstep,
  type WorldDiscoveryId,
} from '../core/ctx'
import { GLSL_ATMOSPHERE, GLSL_CLOUD_SHADOW, GLSL_NOISE } from '../shaders/common'
import type { PickId } from '../../types/sensor'
import type { ClearZone } from './terrain'

interface BeaconHandle {
  group: THREE.Group
  halo: THREE.Sprite
  rings: THREE.Mesh[]
  core: THREE.Mesh
  beam: THREE.Mesh
  baseY: number
  active: number
}

interface ShadowSpec {
  x: number
  z: number
  radius: number
  rz?: number
  yaw?: number
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

function makeTaperedBranch(
  curve: THREE.CatmullRomCurve3,
  rStart: number,
  rEnd: number,
  tubularSegs = 16,
  radialSegs = 8,
) {
  const frames = curve.computeFrenetFrames(tubularSegs, false)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const vertex = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i <= tubularSegs; i += 1) {
    const t = i / tubularSegs
    const P = curve.getPointAt(t)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    const radius = rStart * (1 - t) + rEnd * t
    for (let j = 0; j <= radialSegs; j += 1) {
      const v = (j / radialSegs) * Math.PI * 2
      const sin = Math.sin(v)
      const cos = -Math.cos(v)
      normal.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize()
      vertex.set(P.x + radius * normal.x, P.y + radius * normal.y, P.z + radius * normal.z)
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(normal.x, normal.y, normal.z)
    }
  }
  const stride = radialSegs + 1
  for (let i = 0; i < tubularSegs; i += 1) {
    for (let j = 0; j < radialSegs; j += 1) {
      const a = i * stride + j
      const b = (i + 1) * stride + j
      const c = (i + 1) * stride + j + 1
      const d = i * stride + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setIndex(indices)
  return geo
}

function makeSculptedBoulderGeo(seed = 1) {
  const geo = new THREE.IcosahedronGeometry(1, 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i)
    const n1 = Math.sin(v.x * 2.1 + seed) * Math.cos(v.z * 1.9 - seed * 0.7) * 0.16
    const n2 = Math.sin(v.y * 3.8 + v.x * 2.5 + seed * 1.3) * 0.08
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

/** 创建接入全局昼夜光照、云影与高度雾的自定义地标着色器材质 */
function makeStylizedMat(options: {
  color?: string
  emissive?: string
  emissiveStrength?: number
  vertexColors?: boolean
  map?: THREE.Texture | null
  alphaTest?: number
  side?: THREE.Side
  flutter?: boolean
}) {
  const base = new THREE.Color(options.color ?? '#ffffff')
  const em = new THREE.Color(options.emissive ?? '#000000')
  const usesMap = Boolean(options.map)
  const usesInstColor = Boolean(options.vertexColors)

  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared(
        'uTime',
        'uCamPos',
        'uSunDir',
        'uSunColor',
        'uSunPower',
        'uSkyZenith',
        'uSkyMid',
        'uSkyHorizon',
        'uSunHalo',
        'uAmbSky',
        'uAmbGround',
        'uFogColor',
        'uFog',
        'uGalaxy',
        'uWind',
      ),
      uBaseColor: { value: new THREE.Vector3(base.r, base.g, base.b) },
      uEmissive: { value: new THREE.Vector3(em.r, em.g, em.b) },
      uEmissiveStrength: { value: options.emissiveStrength ?? 0 },
      uMap: { value: options.map ?? null },
      uAlphaTest: { value: options.alphaTest ?? 0 },
      uHasMap: { value: usesMap ? 1 : 0 },
      uUseVertexColor: { value: usesInstColor ? 1 : 0 },
      uFlutter: { value: options.flutter ? 1 : 0 },
    },
    defines: options.vertexColors ? { USE_VCOLOR: '' } : undefined,
    side: options.side ?? THREE.FrontSide,
    vertexShader: /* glsl */ `
      #ifdef USE_VCOLOR
      attribute vec3 color;
      #endif
      uniform float uTime;
      uniform float uFlutter;
      uniform vec4 uWind;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        vUv = uv;
        vec3 tint = vec3(1.0);
        #ifdef USE_VCOLOR
        tint = color;
        #endif
        #ifdef USE_INSTANCING_COLOR
        tint *= instanceColor;
        #endif
        vTint = tint;

        vec4 local = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        #endif
        vec4 w = modelMatrix * local;
        if (uFlutter > 0.5) {
          float phase = w.x * 0.7 + w.z * 0.6 + uTime * 2.4;
          float sway = sin(phase) * (0.04 + 0.06 * uWind.z) * (uv.y * 0.7 + 0.3);
          w.x += sway * uWind.x;
          w.z += sway * uWind.y;
        }
        vWorld = w.xyz;
        mat3 nMat = mat3(modelMatrix);
        #ifdef USE_INSTANCING
        nMat = nMat * mat3(instanceMatrix);
        #endif
        vNormal = normalize(nMat * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uBaseColor;
      uniform vec3 uEmissive;
      uniform float uEmissiveStrength;
      uniform sampler2D uMap;
      uniform float uAlphaTest;
      uniform float uHasMap;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vTint;

      ${GLSL_NOISE}
      ${GLSL_ATMOSPHERE}
      ${GLSL_CLOUD_SHADOW}

      void main() {
        vec3 alb = uBaseColor * vTint;
        if (uHasMap > 0.5) {
          vec4 tex = texture2D(uMap, vUv);
          if (tex.a < uAlphaTest) discard;
          alb *= tex.rgb;
        }
        vec3 N = normalize(vNormal);
        if (!gl_FrontFacing) N = -N;
        vec3 S = normalize(uSunDir);
        float cs = cloudShadow(vWorld.xz, uTime);
        float ndl = saturate(dot(N, S) * 0.68 + 0.32);
        vec3 hemi = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl * cs + hemi * 1.15);
        col += uEmissive * uEmissiveStrength;
        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}

/**
 * 序章地面全部可交互地标与散落自然地貌：
 * - 第一幕交互主花 (-3.8, -8.5) + 对焦环
 * - 第二幕木栈道 + 轻舟 (-22, -46 / -25.8, -49.5)
 * - 第三幕孤树与纸灯笼 (15.5, -24)
 * - 第四幕石拱门圣地 (-15.5, -23) + 心光符文 + 呼唤光环
 * - 湖畔漂流瓶 & 山坡星图石碑彩蛋
 * - 苔原巨石、石堆、灌木、地面接触阴影、任务信标与点走地标环
 */
export class LandmarksWorld {
  readonly clearZones: ClearZone[] = []
  private readonly shadowSpecs: ShadowSpec[] = []
  private readonly materials: THREE.Material[] = []

  private heroFlowerGlow: THREE.Sprite | null = null
  private focusRing: THREE.Group | null = null
  private focusRingProgress = 0
  private readonly heroBloomEmissive: { value: number }[] = []

  private sanctuaryRuneMat: THREE.MeshBasicMaterial | null = null
  private sanctuaryRuneLevel = 0
  private lakeBoat: THREE.Group | null = null
  private windmillRotor: THREE.Group | null = null
  private relayDish: THREE.Group | null = null
  private relayLedMat: THREE.MeshBasicMaterial | null = null
  private cairnFlameMat: THREE.MeshBasicMaterial | null = null
  private readonly windChimes: THREE.Mesh[] = []
  private readonly echoBeams = new Map<
    WorldDiscoveryId,
    { beam: THREE.Mesh; ring: THREE.Mesh; age: number; active: boolean; baseOpacity: number }
  >()
  private walkMarker: { mesh: THREE.Mesh; age: number; active: boolean } | null = null
  private callWave: { mesh: THREE.Mesh; age: number; active: boolean } | null = null

  private readonly beacons: Partial<Record<PickId, BeaconHandle>> = {}
  private activeTask: PickId | null = 'flower'

  constructor(
    surfaceGroup: THREE.Group,
    pickables: THREE.Object3D[],
    glowTexture: THREE.Texture,
    lowDetail: boolean,
  ) {
    this.buildHeroFlower(surfaceGroup, pickables, glowTexture)
    this.buildScenery(surfaceGroup, glowTexture, lowDetail)
    this.buildScatter(surfaceGroup, lowDetail)
    this.buildEasterEggs(surfaceGroup, pickables, glowTexture)
    this.buildOpenWorld(surfaceGroup, glowTexture, lowDetail)
    this.buildBeacons(surfaceGroup, pickables, glowTexture)
    this.buildContactShadows(surfaceGroup)
    this.buildWalkMarker(surfaceGroup)
    this.buildCallWave(surfaceGroup)

    // 注册全场景净空遮罩区域（主花、木栈道全段与岸坡接驳、轻舟及所有地标投影）
    this.clearZones.push({ x: -3.8, z: -8.5, radius: 2.2 })
    for (let s = 0; s <= 7; s += 1) {
      const t = s / 7
      this.clearZones.push({
        x: -11.6 + (-19.2 - -11.6) * t,
        z: -31.5 + (-42.0 - -31.5) * t,
        radius: 2.35,
      })
    }
    this.clearZones.push({ x: -19.5, z: -42.1, radius: 2.6 })
    this.clearZones.push(
      { x: 84, z: -22, radius: 9.5 },
      { x: 68, z: -86, radius: 6.5 },
      { x: 16, z: -134, radius: 8.5 },
      { x: -58, z: -94, radius: 6.2 },
      { x: -84, z: -24, radius: 8.5 },
    )
    for (const bench of SCENIC_BENCHES) {
      this.clearZones.push({ x: bench.x, z: bench.z, radius: 2.6 })
    }
    for (const spec of this.shadowSpecs) {
      this.clearZones.push({ x: spec.x, z: spec.z, radius: Math.max(0.55, spec.radius * 0.72) })
    }
  }

  private buildHeroFlower(
    surfaceGroup: THREE.Group,
    pickables: THREE.Object3D[],
    glowTexture: THREE.Texture,
  ) {
    const flowerBase = new THREE.Vector3(-3.8, heightAt(-3.8, -8.5), -8.5)
    const hero = new THREE.Group()
    hero.position.copy(flowerBase)

    const stemMat = makeStylizedMat({ color: '#3b5331', emissive: '#17220f', emissiveStrength: 0.3 })
    this.materials.push(stemMat)

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
    const petalMat = makeStylizedMat({
      color: '#ffffff',
      vertexColors: true,
      emissive: '#ffb877',
      emissiveStrength: 0.22,
      side: THREE.DoubleSide,
    })
    this.materials.push(petalMat)
    this.heroBloomEmissive.push(petalMat.uniforms.uEmissiveStrength as { value: number })

    const centerMat = makeStylizedMat({ color: '#ffbe68', emissive: '#ff9a3c', emissiveStrength: 0.45 })
    this.materials.push(centerMat)

    const heads = [
      { x: 0, z: 0, h: 1.02, scale: 1, tilt: -0.08, yaw: 0.35 },
      { x: 0.26, z: -0.12, h: 0.8, scale: 0.72, tilt: -0.32, yaw: 1.3 },
      { x: -0.23, z: 0.14, h: 0.72, scale: 0.58, tilt: -0.18, yaw: 2.5 },
    ]

    for (const head of heads) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.013, head.h, 5), stemMat)
      stem.position.set(head.x, head.h / 2, head.z)
      stem.rotation.z = head.x * 0.22
      stem.rotation.x = -head.z * 0.22
      hero.add(stem)

      const bloom = new THREE.Group()
      bloom.position.set(head.x, head.h, head.z)
      bloom.scale.setScalar(head.scale)
      bloom.rotation.set(head.tilt, head.yaw, 0)

      for (let p = 0; p < 9; p += 1) {
        const pivot = new THREE.Group()
        pivot.rotation.y = (p / 9) * Math.PI * 2 + 0.2
        const petal = new THREE.Mesh(petalGeometry, petalMat)
        petal.rotation.x = -Math.PI / 2 + 0.24
        petal.position.set(0, 0.018 + Math.sin(p * 2.4) * 0.008, -0.035)
        petal.scale.set(0.92, 1, 1)
        pivot.add(petal)
        bloom.add(pivot)
      }
      for (let p = 0; p < 5; p += 1) {
        const pivot = new THREE.Group()
        pivot.rotation.y = (p / 5) * Math.PI * 2 + 0.7
        const petal = new THREE.Mesh(petalGeometry, petalMat)
        petal.rotation.x = -Math.PI / 2 + 0.6
        petal.position.set(0, 0.04, -0.02)
        petal.scale.set(0.55, 0.62, 1)
        pivot.add(petal)
        bloom.add(pivot)
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), centerMat)
      center.position.y = 0.05
      bloom.add(center)
      for (let s = 0; s < 7; s += 1) {
        const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), centerMat)
        const sa = (s / 7) * Math.PI * 2
        stamen.position.set(Math.cos(sa) * 0.035, 0.058, Math.sin(sa) * 0.035)
        bloom.add(stamen)
      }
      hero.add(bloom)
    }

    const leafMat = makeStylizedMat({ color: '#3d5d34', side: THREE.DoubleSide })
    this.materials.push(leafMat)
    for (let i = 0; i < 3; i += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), leafMat)
      leaf.scale.set(0.34, 0.05, 1.5)
      leaf.position.set(i === 0 ? 0.13 : -0.11, 0.32 + i * 0.1, i === 2 ? 0.1 : -0.06)
      leaf.rotation.set(0.2, i * 2.1, -0.35)
      hero.add(leaf)
    }

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
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
        new THREE.TorusGeometry(
          0.14 + i * 0.045,
          0.0018,
          6,
          96,
          i === 0 ? Math.PI * 2 : Math.PI * 1.45,
        ),
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

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: glowTexture,
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
      if ((object as THREE.Mesh).isMesh) object.userData.pick = 'flower'
    })

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    hit.position.y = 0.8
    hit.userData.pick = 'flower'
    hero.add(hit)
    pickables.push(hit)
    surfaceGroup.add(hero)
  }

  private buildScenery(surfaceGroup: THREE.Group, glowTexture: THREE.Texture, lowDetail: boolean) {
    // 1. 孤树山坡与手扎枝干 + 摇曳叶簇 + 纸灯笼
    const treePos = new THREE.Vector3(15.5, heightAt(15.5, -24), -24)
    this.shadowSpecs.push({ x: treePos.x, z: treePos.z, radius: 1.9 })
    const tree = new THREE.Group()
    tree.position.copy(treePos)
    const barkMat = makeStylizedMat({ color: '#453123' })
    this.materials.push(barkMat)

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.25, 0),
      new THREE.Vector3(0.08, 1.4, -0.05),
      new THREE.Vector3(0.45, 3.0, -0.15),
      new THREE.Vector3(1.15, 4.7, -0.25),
    ])
    tree.add(new THREE.Mesh(makeTaperedBranch(trunkCurve, 0.44, 0.14, 24, 10), barkMat))

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

    const leafTex = makeFoliageTexture()
    const quadA = new THREE.PlaneGeometry(0.95, 0.95)
    const quadB = new THREE.PlaneGeometry(0.95, 0.95)
    quadB.rotateY(Math.PI / 2)
    const posA = quadA.attributes.position.array as Float32Array
    const posB = quadB.attributes.position.array as Float32Array
    const uvA = quadA.attributes.uv.array as Float32Array
    const uvB = quadB.attributes.uv.array as Float32Array
    const leafGeo = new THREE.BufferGeometry()
    const cPos = new Float32Array(posA.length + posB.length)
    cPos.set(posA, 0)
    cPos.set(posB, posA.length)
    const cUv = new Float32Array(uvA.length + uvB.length)
    cUv.set(uvA, 0)
    cUv.set(uvB, uvA.length)
    leafGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3))
    leafGeo.setAttribute('uv', new THREE.BufferAttribute(cUv, 2))
    leafGeo.setIndex([
      ...Array.from(quadA.index!.array),
      ...Array.from(quadB.index!.array).map((idx) => idx + 4),
    ])
    leafGeo.computeVertexNormals()
    quadA.dispose()
    quadB.dispose()

    const leafMat = makeStylizedMat({
      color: '#ffffff',
      map: leafTex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      emissive: '#2c3824',
      emissiveStrength: 0.25,
      flutter: true,
    })
    this.materials.push(leafMat)

    const crownCenters = [
      { pos: new THREE.Vector3(1.15, 5.15, -0.25), r: 1.65 },
      { pos: new THREE.Vector3(2.35, 4.8, 0.45), r: 1.25 },
      { pos: new THREE.Vector3(-0.85, 4.65, -0.95), r: 1.2 },
      { pos: new THREE.Vector3(1.65, 5.55, -1.05), r: 1.1 },
      { pos: new THREE.Vector3(-0.05, 5.25, 1.05), r: 1.1 },
    ]
    const clusterCount = lowDetail ? 160 : 240
    const foliage = new THREE.InstancedMesh(leafGeo, leafMat, clusterCount)
    const lMat = new THREE.Matrix4()
    const lQuat = new THREE.Quaternion()
    const lScale = new THREE.Vector3()
    const lPos = new THREE.Vector3()
    const lEuler = new THREE.Euler()
    const cEmerald = new THREE.Color('#3a6b52')
    const cChartreuse = new THREE.Color('#789e64')
    const cGoldRim = new THREE.Color('#e0b468')
    const lCol = new THREE.Color()

    for (let i = 0; i < clusterCount; i += 1) {
      const center = crownCenters[i % crownCenters.length]
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 1.7 - 0.7)
      const rad = Math.pow(Math.random(), 0.55) * center.r
      lPos.set(
        center.pos.x + Math.sin(phi) * Math.cos(theta) * rad,
        center.pos.y + Math.cos(phi) * rad * 0.62,
        center.pos.z + Math.sin(phi) * Math.sin(theta) * rad,
      )
      lEuler.set((Math.random() - 0.5) * 0.8, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.8)
      lQuat.setFromEuler(lEuler)
      const s = 0.62 + Math.random() * 0.65
      lScale.set(s, s * 0.88, s)
      lMat.compose(lPos, lQuat, lScale)
      foliage.setMatrixAt(i, lMat)

      const hr = Math.max(0, Math.min(1, (lPos.y - 4.0) / 2.2))
      if (hr < 0.62) lCol.copy(cEmerald).lerp(cChartreuse, hr / 0.62)
      else lCol.copy(cChartreuse).lerp(cGoldRim, (hr - 0.62) / 0.38)
      foliage.setColorAt(i, lCol)
    }
    foliage.instanceMatrix.needsUpdate = true
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true
    tree.add(foliage)

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
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
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
    surfaceGroup.add(tree)

    // 2. 山腰石拱门圣地与符文石柱
    const ruinX = -15.5
    const ruinZ = -23
    const ruin = new THREE.Group()
    ruin.position.set(ruinX, heightAt(ruinX, ruinZ) - 0.12, ruinZ)
    ruin.rotation.y = 0.48
    const stoneMat = makeStylizedMat({ color: '#384152' })
    this.materials.push(stoneMat)

    const daisLower = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.55, 0.36, 8), stoneMat)
    daisLower.position.y = 0.18
    ruin.add(daisLower)
    const daisUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.96, 0.32, 8), stoneMat)
    daisUpper.position.y = 0.52
    ruin.add(daisUpper)

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
    surfaceGroup.add(ruin)
    this.shadowSpecs.push({ x: ruinX, z: ruinZ, radius: 5.8 })

    // 3. 湖畔木栈道（严格锚定干岸并斜坡平滑延伸至深水，零悬空零穿模）与摇曳木舟
    const pierX = -15.4
    const pierZ = -36.8
    const pierY = LAKE.y + 0.44
    const pierRotY = Math.atan2(LAKE.x - pierX, LAKE.z - pierZ)
    const pier = new THREE.Group()
    pier.position.set(pierX, pierY, pierZ)
    pier.rotation.y = pierRotY

    const woodMat = makeStylizedMat({ color: '#5c4030' })
    const beamMat = makeStylizedMat({ color: '#422d21' })
    const abutmentStoneMat = makeStylizedMat({ color: '#6b675f' })
    this.materials.push(woodMat, beamMat, abutmentStoneMat)

    // 纵向承重木梁（避免木板悬空）
    for (const bx of [-0.66, 0.66]) {
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 7.2), beamMat)
      stringer.position.set(bx, -0.08, -0.2)
      pier.add(stringer)
    }

    // 14 块栈道横板（离水面 +0.44m，避开浪峰与岸坡草丛）
    for (let i = 0; i < 14; i += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 0.44), woodMat)
      plank.position.set((Math.sin(i * 2.1) - 0.5) * 0.025, 0.04, -3.55 + i * 0.53)
      pier.add(plank)
    }

    // 干岸石砌引桥与缓坡木阶，平滑衔接岸边地形
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 1.35), woodMat)
    ramp.position.set(0, -0.1, -4.35)
    ramp.rotation.x = 0.24
    pier.add(ramp)
    for (const [sx, sy, sz, sw, sh, sd] of [
      [-0.42, -0.34, -4.95, 0.96, 0.34, 0.72],
      [0.44, -0.38, -5.05, 0.88, 0.32, 0.68],
      [0.0, -0.42, -5.55, 1.32, 0.28, 0.62],
    ]) {
      const stepStone = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), abutmentStoneMat)
      stepStone.position.set(sx, sy, sz)
      stepStone.rotation.y = sx * 0.25
      pier.add(stepStone)
    }

    // 8 根实心木桩深插湖底与岸基，顶部配护桩帽
    for (const pz of [-3.4, -1.2, 1.1, 3.2]) {
      for (const px of [-0.76, 0.76]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.11, 3.4, 8), beamMat)
        post.position.set(px, -1.18, pz)
        pier.add(post)
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.112, 0.09, 8), woodMat)
        cap.position.set(px, 0.54, pz)
        pier.add(cap)
      }
    }

    // 两侧垂坠粗麻护绳
    const ropeMat = makeStylizedMat({ color: '#8f7254' })
    this.materials.push(ropeMat)
    for (const rx of [-0.76, 0.76]) {
      const ropeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx, 0.48, -3.4),
        new THREE.Vector3(rx, 0.26, -2.3),
        new THREE.Vector3(rx, 0.48, -1.2),
        new THREE.Vector3(rx, 0.26, -0.05),
        new THREE.Vector3(rx, 0.48, 1.1),
        new THREE.Vector3(rx, 0.26, 2.15),
        new THREE.Vector3(rx, 0.48, 3.2),
      ])
      pier.add(new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 28, 0.024, 6, false), ropeMat))
    }

    const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.085, 2.5, 8), beamMat)
    lanternPost.position.set(0.76, 1.24, 3.25)
    pier.add(lanternPost)
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.76, 2.26, 3.25),
      new THREE.Vector3(0.56, 2.48, 3.25),
      new THREE.Vector3(0.36, 2.3, 3.25),
    ])
    pier.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.025, 6, false), beamMat))
    const pierLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.24, 6),
      new THREE.MeshBasicMaterial({ color: '#ffd699' }),
    )
    pierLantern.position.set(0.36, 2.16, 3.25)
    pier.add(pierLantern)
    const pierGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#ffd699',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    pierGlow.position.set(0.36, 2.16, 3.25)
    pierGlow.scale.setScalar(2.4)
    pier.add(pierGlow)
    surfaceGroup.add(pier)

    const boat = new THREE.Group()
    boat.position.set(-19.5, LAKE.y + 0.08, -42.1)
    boat.rotation.y = 0.76
    const hullMat = makeStylizedMat({ color: '#5f402e', side: THREE.DoubleSide })
    this.materials.push(hullMat)
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
    boat.add(new THREE.Mesh(hullGeo, hullMat))
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
    surfaceGroup.add(boat)

    // 4. 苔原巨石与祈愿石堆
    const rockMat = makeStylizedMat({ vertexColors: true })
    this.materials.push(rockMat)
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
      surfaceGroup.add(rock)
      this.shadowSpecs.push({ x: bx, z: bz, radius: scaleXZ * 1.4 })
    })

    for (const [cx, cz] of [
      [9.5, -18],
      [-11, -34],
    ]) {
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
      surfaceGroup.add(cairn)
      this.shadowSpecs.push({ x: cx, z: cz, radius: 0.85 })
    }
  }

  private buildScatter(surfaceGroup: THREE.Group, lowDetail: boolean) {
    const keepOut: [number, number, number][] = [
      [84, -22, 14],
      [68, -86, 15],
      [16, -134, 14],
      [-58, -94, 12],
      [-84, -24, 14],
      [-39, -71, 7],
      ...SCENIC_BENCHES.map((b) => [b.x, b.z, 4] as [number, number, number]),
      [-3.8, -8.5, 3.6],
      [15.5, -24, 4.5],
      [-15.5, -23, 5.5],
      [-15.4, -36.8, 5.2],
      [-12.2, -32.2, 4.2],
      [-19.5, -42.1, 4.6],
      [-3.3, -7.25, 3],
      [8, -40, 3.5],
      [30, -58, 3.5],
      [24, -34, 3.5],
      [-26, -12, 3.5],
      [-8.8, -30.4, 3.5],
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
        if (
          WORLD_TRAILS.some((trail) => {
            for (let s = 0; s < trail.points.length - 1; s += 1) {
              const dSq = distanceToSegmentSq2D(
                x,
                z,
                trail.points[s][0],
                trail.points[s][1],
                trail.points[s + 1][0],
                trail.points[s + 1][1],
              )
              if (dSq < (trail.width + 1.15) ** 2) return true
            }
            return false
          })
        ) {
          continue
        }
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

    const rockMat = makeStylizedMat({ vertexColors: true })
    this.materials.push(rockMat)
    const rockCount = lowDetail ? 56 : 138
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
        this.shadowSpecs.push({ x: s.x, z: s.z, radius: sxz * 1.45 })
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.name = `scatter-rock-${vi}`
      surfaceGroup.add(mesh)
    }

    const quadA = new THREE.PlaneGeometry(1, 1)
    const quadB = new THREE.PlaneGeometry(1, 1)
    quadB.rotateY(Math.PI / 2)
    const posA = quadA.attributes.position.array as Float32Array
    const posB = quadB.attributes.position.array as Float32Array
    const uvA = quadA.attributes.uv.array as Float32Array
    const uvB = quadB.attributes.uv.array as Float32Array
    const shrubGeo = new THREE.BufferGeometry()
    const sPos = new Float32Array(posA.length + posB.length)
    sPos.set(posA, 0)
    sPos.set(posB, posA.length)
    const sUv = new Float32Array(uvA.length + uvB.length)
    sUv.set(uvA, 0)
    sUv.set(uvB, uvA.length)
    shrubGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    shrubGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2))
    shrubGeo.setIndex([
      ...Array.from(quadA.index!.array),
      ...Array.from(quadB.index!.array).map((idx) => idx + 4),
    ])
    shrubGeo.computeVertexNormals()
    quadA.dispose()
    quadB.dispose()

    const shrubMat = makeStylizedMat({
      color: '#ffffff',
      map: makeFoliageTexture(),
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      emissive: '#1d2718',
      emissiveStrength: 0.2,
      flutter: true,
    })
    this.materials.push(shrubMat)
    const shrubCount = lowDetail ? 110 : 275
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
      this.shadowSpecs.push({ x: s.x, z: s.z, radius: sxy * 1.15 })
    }
    shrubs.count = sn
    shrubs.instanceMatrix.needsUpdate = true
    if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true
    shrubs.name = 'scatter-shrub'
    surfaceGroup.add(shrubs)
  }

  private buildEasterEggs(
    surfaceGroup: THREE.Group,
    pickables: THREE.Object3D[],
    glowTexture: THREE.Texture,
  ) {
    // 1. 湖畔漂流瓶（停留在栈道下游浅水苇岸边，岸上清晰可见可拾取）
    const bottle = new THREE.Group()
    bottle.position.set(-20.4, LAKE.y + 0.08, -36.8)
    bottle.rotation.y = -0.65
    const glassMat = new THREE.MeshBasicMaterial({
      color: '#9ee4d0',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.72, 12), glassMat)
    body.rotation.z = Math.PI / 2
    body.position.y = 0.16
    bottle.add(body)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.24, 10), glassMat)
    neck.rotation.z = Math.PI / 2
    neck.position.set(0.46, 0.16, 0)
    bottle.add(neck)
    const corkMat = makeStylizedMat({ color: '#8a6747' })
    this.materials.push(corkMat)
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 8), corkMat)
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
        map: glowTexture,
        color: '#9df5c8',
        transparent: true,
        opacity: 0.34,
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
    pickables.push(bottleHit)
    surfaceGroup.add(bottle)

    // 2. 山坡风化石碑
    const tabletX = 14
    const tabletZ = -34
    const tablet = new THREE.Group()
    tablet.position.set(tabletX, heightAt(tabletX, tabletZ), tabletZ)
    tablet.rotation.y = -0.5
    const stoneMat = makeStylizedMat({ color: '#293332', emissive: '#0a100e', emissiveStrength: 0.4 })
    this.materials.push(stoneMat)
    const stone = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.55, 0.18), stoneMat)
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
      for (const [dx, dy] of [
        [128, 44],
        [58, 174],
        [198, 174],
      ]) {
        engravingCtx.beginPath()
        engravingCtx.fillStyle = 'rgba(255, 226, 180, 0.85)'
        engravingCtx.arc(dx, dy, 4, 0, Math.PI * 2)
        engravingCtx.fill()
      }
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
        map: glowTexture,
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
    pickables.push(tabletHit)
    surfaceGroup.add(tablet)
    this.shadowSpecs.push({ x: tabletX, z: tabletZ, radius: 0.85, rz: 0.3, yaw: -0.5 })
  }

  private buildBeacons(
    surfaceGroup: THREE.Group,
    pickables: THREE.Object3D[],
    glowTexture: THREE.Texture,
  ) {
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
          map: glowTexture,
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
      pickables.push(hit)

      surfaceGroup.add(group)
      this.beacons[id] = {
        group,
        halo,
        rings,
        core,
        beam,
        baseY: position.y,
        active: id === this.activeTask ? 1 : 0.25,
      }
    }

    const flowerBase = new THREE.Vector3(-3.8, heightAt(-3.8, -8.5), -8.5)
    makeBeacon('flower', '#ffd9a3', flowerBase.clone().add(new THREE.Vector3(0.55, 2.75, 0.35)), 1.8)
    const windBase = new THREE.Vector3(10, heightAt(10, -30), -30)
    makeBeacon('wind', '#9df5c8', windBase.clone().add(new THREE.Vector3(0, 2.0, 0)), 2.4)
    const starBase = new THREE.Vector3(-15, heightAt(-15, -55) + 13.5, -55)
    makeBeacon('stars', '#a9c0ff', starBase, 2.6)
  }

  private buildContactShadows(surfaceGroup: THREE.Group) {
    if (this.shadowSpecs.length === 0) return
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
    const mesh = new THREE.InstancedMesh(geo, material, this.shadowSpecs.length)
    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const yawQuat = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const normal = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const eps = 0.4
    this.shadowSpecs.forEach((spec, i) => {
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
    surfaceGroup.add(mesh)
  }

  private buildWalkMarker(surfaceGroup: THREE.Group) {
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
    surfaceGroup.add(mesh)
    this.walkMarker = { mesh, age: 0, active: false }
  }

  private buildCallWave(surfaceGroup: THREE.Group) {
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
    surfaceGroup.add(mesh)
    this.callWave = { mesh, age: 0, active: false }
  }

  setActiveTask(task: PickId | null) {
    this.activeTask = task
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
      ;(this.heroFlowerGlow.material as THREE.SpriteMaterial).opacity = 1
    }
  }

  pulseSanctuaryRune(level: number) {
    this.sanctuaryRuneLevel = Math.max(0, Math.min(3, level))
    if (this.sanctuaryRuneMat) {
      this.sanctuaryRuneMat.opacity = Math.min(1, 0.35 + this.sanctuaryRuneLevel * 0.22)
    }
  }

  triggerWalkMarker(point: THREE.Vector3) {
    if (!this.walkMarker) return
    this.walkMarker.mesh.position.set(point.x, heightAt(point.x, point.z) + 0.08, point.z)
    this.walkMarker.mesh.scale.setScalar(0.7)
    this.walkMarker.mesh.visible = true
    this.walkMarker.age = 0
    this.walkMarker.active = true
  }

  emitSkyCall(camPos: THREE.Vector3) {
    if (!this.callWave) return
    const groundY = Math.max(LAKE.y + 0.15, heightAt(camPos.x, camPos.z) + 0.18)
    this.callWave.mesh.position.set(camPos.x, groundY, camPos.z)
    this.callWave.mesh.scale.setScalar(1)
    ;(this.callWave.mesh.material as THREE.MeshBasicMaterial).opacity = 0.78
    this.callWave.mesh.visible = true
    this.callWave.age = 0
    this.callWave.active = true
  }

  hideForDescent() {
    if (this.callWave) {
      this.callWave.active = false
      this.callWave.mesh.visible = false
    }
  }

  resetToSurface() {
    if (this.walkMarker) {
      this.walkMarker.active = false
      this.walkMarker.mesh.visible = false
    }
    if (this.callWave) {
      this.callWave.active = false
      this.callWave.mesh.visible = false
    }
    this.sanctuaryRuneLevel = 0
  }

  update(dt: number, elapsed: number) {
    const callBoost = this.callWave?.active ? Math.sin(Math.min(1, this.callWave.age / 2.4) * Math.PI) : 0
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 1.6)

    for (const [id, beacon] of Object.entries(this.beacons)) {
      if (!beacon) continue
      const activeTarget = this.activeTask === null || this.activeTask === id ? 0.95 : 0.16
      beacon.active += (activeTarget - beacon.active) * (1 - Math.exp(-dt * 3))
      const phase = id === 'flower' ? 0 : id === 'wind' ? 2 : 4
      const wave = 0.5 + 0.5 * Math.sin(elapsed * 1.2 + phase)
      beacon.group.position.y = beacon.baseY + Math.sin(elapsed * 0.9 + phase * 0.35) * 0.18
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
        0.28 + 0.14 * Math.sin(elapsed * 1.5) + this.sanctuaryRuneLevel * 0.18 + callBoost * 0.48,
      )
    }

    if (this.lakeBoat) {
      this.lakeBoat.position.y = LAKE.y + 0.06 + Math.sin(elapsed * 1.15) * 0.045
      this.lakeBoat.rotation.x = Math.sin(elapsed * 0.9) * 0.03
      this.lakeBoat.rotation.z = Math.cos(elapsed * 1.05) * 0.04
    }

    if (this.heroFlowerGlow) {
      ;(this.heroFlowerGlow.material as THREE.SpriteMaterial).opacity = 0.07 + pulse * 0.05
      this.heroFlowerGlow.scale.setScalar(0.95 + Math.sin(elapsed * 1.4) * 0.08)
    }
    for (const em of this.heroBloomEmissive) em.value = 0.16 + pulse * 0.2

    if (this.focusRing?.visible) {
      this.focusRing.children[0].rotation.z += dt * 0.22
      this.focusRing.children[1].rotation.z -= dt * (0.3 + this.focusRingProgress * 0.7)
    }

    if (this.walkMarker?.active) {
      this.walkMarker.age += dt
      const t = this.walkMarker.age / 1.1
      if (t >= 1) {
        this.walkMarker.active = false
        this.walkMarker.mesh.visible = false
      } else {
        this.walkMarker.mesh.scale.setScalar(0.7 + t * 1.4)
        ;(this.walkMarker.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.72
      }
    }

    if (this.callWave?.active) {
      this.callWave.age += dt
      const t = this.callWave.age / 2.4
      if (t >= 1) {
        this.callWave.active = false
        this.callWave.mesh.visible = false
      } else {
        this.callWave.mesh.scale.setScalar(1 + t * 43)
        const fade = 1 - t
        ;(this.callWave.mesh.material as THREE.MeshBasicMaterial).opacity = fade * fade * 0.78
      }
    }

    if (this.windmillRotor) {
      this.windmillRotor.rotation.z -= dt * (0.48 + 0.14 * Math.sin(elapsed * 0.45))
    }

    if (this.relayDish) {
      this.relayDish.rotation.y = Math.sin(elapsed * 0.22) * 0.48 - 0.55
    }

    if (this.relayLedMat) {
      const blink = 0.5 + 0.5 * Math.sin(elapsed * 3.4)
      this.relayLedMat.opacity = 0.28 + Math.pow(blink, 3) * 0.72
    }

    if (this.cairnFlameMat) {
      this.cairnFlameMat.opacity = 0.56 + 0.28 * Math.sin(elapsed * 5.2 + 0.8)
    }

    this.windChimes.forEach((chime, idx) => {
      chime.rotation.z = Math.sin(elapsed * (2.1 + idx * 0.45) + idx * 1.4) * 0.14
      chime.rotation.x = Math.cos(elapsed * (1.7 + idx * 0.3) + idx) * 0.08
    })

    for (const echo of this.echoBeams.values()) {
      if (!echo.active) continue
      echo.age += dt
      const t = echo.age / 4.4
      if (t >= 1) {
        echo.active = false
        echo.beam.visible = false
        echo.ring.visible = false
      } else {
        const env = Math.sin(t * Math.PI)
        ;(echo.beam.material as THREE.MeshBasicMaterial).opacity = echo.baseOpacity * env
        echo.beam.rotation.y += dt * 0.55
        echo.ring.scale.setScalar(1 + t * 5.5)
        ;(echo.ring.material as THREE.MeshBasicMaterial).opacity = echo.baseOpacity * 0.9 * (1 - t)
      }
    }
  }

  triggerEchoBeams(discoveredIds: readonly string[] = []) {
    const discovered = new Set(discoveredIds)
    const allFound = discovered.size >= WORLD_DISCOVERIES.length
    for (const meta of WORLD_DISCOVERIES) {
      const echo = this.echoBeams.get(meta.id)
      if (!echo) continue
      const isFound = discovered.has(meta.id)
      if (isFound && !allFound) continue
      echo.active = true
      echo.age = 0
      echo.baseOpacity = allFound ? 0.26 : 0.52
      echo.beam.visible = true
      echo.ring.visible = true
      echo.ring.scale.setScalar(1)
    }
  }

  private buildOpenWorld(
    surfaceGroup: THREE.Group,
    glowTexture: THREE.Texture,
    lowDetail: boolean,
  ) {
    const reg = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m)
      return m
    }

    // ── 1. 东南风车崖 (84, -22) ─────────────────────────────
    {
      const cx = 84
      const cz = -22
      const cy = heightAt(cx, cz)
      const g = new THREE.Group()
      g.position.set(cx, cy - 0.15, cz)
      g.rotation.y = -Math.PI * 0.68

      const plinthMat = reg(makeStylizedMat({ color: '#454b52' }))
      const towerMat = reg(makeStylizedMat({ color: '#ddd6c6' }))
      const timberMat = reg(makeStylizedMat({ color: '#5b4330' }))
      const sailMat = reg(makeStylizedMat({ color: '#efe8d5', side: THREE.DoubleSide }))

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 1.3, 8), plinthMat)
      plinth.position.y = 0.45
      g.add(plinth)

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.92, 7.6, 8), towerMat)
      tower.position.y = 4.6
      g.add(tower)

      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.56, 2.25, 8), timberMat)
      roof.position.y = 9.4
      g.add(roof)

      const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.22, 10), timberMat)
      deck.position.y = 1.15
      g.add(deck)

      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), timberMat)
        post.position.set(Math.cos(ang) * 3.15, 1.62, Math.sin(ang) * 3.15)
        g.add(post)
      }

      const rotor = new THREE.Group()
      rotor.position.set(0, 7.35, 1.38)
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.85, 10), timberMat)
      axle.rotation.x = Math.PI / 2
      rotor.add(axle)
      for (let b = 0; b < 4; b += 1) {
        const armGroup = new THREE.Group()
        armGroup.rotation.z = (b * Math.PI) / 2 + Math.PI / 4
        const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.7, 0.1), timberMat)
        spar.position.y = 2.45
        armGroup.add(spar)
        const sail = new THREE.Mesh(new THREE.BoxGeometry(0.56, 3.5, 0.03), sailMat)
        sail.position.set(0.24, 2.85, -0.02)
        armGroup.add(sail)
        rotor.add(armGroup)
      }
      g.add(rotor)
      this.windmillRotor = rotor

      const doorGlow = new THREE.Sprite(
        reg(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: '#ffd08a',
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      )
      doorGlow.position.set(0, 2.2, 1.95)
      doorGlow.scale.set(2.2, 2.2, 1)
      g.add(doorGlow)

      g.name = 'landmark-windmill-cliff'
      surfaceGroup.add(g)
      this.shadowSpecs.push({ x: cx, z: cz, radius: 5.4 })
    }

    // ── 2. 东谷白桦林与风铃门 (68, -86) ───────────────────────
    {
      const gx = 68
      const gz = -86
      const gy = heightAt(gx, gz)

      // 中心风铃木门
      const gate = new THREE.Group()
      gate.position.set(gx, gy - 0.1, gz)
      gate.rotation.y = 0.55
      const cedarMat = reg(makeStylizedMat({ color: '#614835' }))
      const chimeMat = reg(makeStylizedMat({ color: '#dfc38d', emissive: '#e8c47a', emissiveStrength: 0.25 }))

      for (const sx of [-1.45, 1.45]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 3.25, 8), cedarMat)
        post.position.set(sx, 1.58, 0)
        gate.add(post)
      }
      const beamTop = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.2, 0.24), cedarMat)
      beamTop.position.y = 3.02
      gate.add(beamTop)
      const beamSub = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.12, 0.16), cedarMat)
      beamSub.position.y = 2.48
      gate.add(beamSub)

      for (let c = -1; c <= 1; c += 1) {
        const chime = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.04), chimeMat)
        chime.position.set(c * 0.55, 2.02, 0)
        gate.add(chime)
        this.windChimes.push(chime)
      }

      const stonePad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.92, 0.34, 7),
        reg(makeStylizedMat({ color: '#5d665b' })),
      )
      stonePad.position.set(0, 0.17, 0)
      gate.add(stonePad)
      gate.name = 'landmark-birch-gate'
      surfaceGroup.add(gate)
      this.shadowSpecs.push({ x: gx, z: gz, radius: 2.8 })

      // 实例化白桦林
      const treeCount = lowDetail ? 20 : 38
      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 1, 7)
      const barkMat = reg(makeStylizedMat({ color: '#e6e3da' }))
      const bandGeo = new THREE.CylinderGeometry(0.125, 0.135, 0.22, 7)
      const bandMat = reg(makeStylizedMat({ color: '#33363b' }))
      const canopyGeo = new THREE.IcosahedronGeometry(1.18, 1)
      const canopyMat = reg(makeStylizedMat({ color: '#9bc482' }))

      const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, treeCount)
      const bands = new THREE.InstancedMesh(bandGeo, bandMat, treeCount * 2)
      const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount * 2)
      const mtx = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const eu = new THREE.Euler()
      const p = new THREE.Vector3()
      const sc = new THREE.Vector3()

      let seed = 4219
      const rand = () => {
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646
      }

      let placed = 0
      for (let attempt = 0; attempt < treeCount * 4 && placed < treeCount; attempt += 1) {
        const ang = rand() * Math.PI * 2
        const dist = 4.6 + rand() * 14.5
        const tx = gx + Math.cos(ang) * dist
        const tz = gz + Math.sin(ang) * dist
        if (Math.hypot(tx - gx, tz - gz) < 4.1) continue
        const ty = heightAt(tx, tz)
        if (ty < LAKE.y + 0.5) continue

        const h = 4.2 + rand() * 2.8
        const s = 0.85 + rand() * 0.45
        p.set(tx, ty + h * 0.48, tz)
        eu.set((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08)
        q.setFromEuler(eu)
        sc.set(s, h, s)
        mtx.compose(p, q, sc)
        trunks.setMatrixAt(placed, mtx)

        for (let bi = 0; bi < 2; bi += 1) {
          p.set(tx, ty + h * (0.34 + bi * 0.3), tz)
          sc.set(s, 1, s)
          mtx.compose(p, q, sc)
          bands.setMatrixAt(placed * 2 + bi, mtx)

          const cw = 1.05 + rand() * 0.65
          p.set(
            tx + (bi === 0 ? 0 : (rand() - 0.5) * 0.85),
            ty + h * (bi === 0 ? 0.92 : 0.72),
            tz + (bi === 0 ? 0 : (rand() - 0.5) * 0.85),
          )
          sc.set(cw, cw * 0.68, cw * (0.9 + rand() * 0.2))
          mtx.compose(p, q, sc)
          canopies.setMatrixAt(placed * 2 + bi, mtx)
        }

        this.shadowSpecs.push({ x: tx, z: tz, radius: 1.45 * s })
        placed += 1
      }
      trunks.count = placed
      bands.count = placed * 2
      canopies.count = placed * 2
      trunks.instanceMatrix.needsUpdate = true
      bands.instanceMatrix.needsUpdate = true
      canopies.instanceMatrix.needsUpdate = true
      trunks.name = 'birch-grove-trunks'
      bands.name = 'birch-grove-bands'
      canopies.name = 'birch-grove-canopies'
      surfaceGroup.add(trunks, bands, canopies)
    }

    // ── 3. 北岭深地中继站 06 (16, -134) ──────────────────────
    {
      const rx = 16
      const rz = -134
      const ry = heightAt(rx, rz)
      const g = new THREE.Group()
      g.position.set(rx, ry - 0.1, rz)

      const concreteMat = reg(makeStylizedMat({ color: '#5c6670' }))
      const hullMat = reg(makeStylizedMat({ color: '#e4e8ec' }))
      const darkMetalMat = reg(makeStylizedMat({ color: '#29333f' }))

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.3, 0.55, 6), concreteMat)
      pad.position.y = 0.22
      g.add(pad)

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(2.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
        hullMat,
      )
      dome.position.y = 0.45
      g.add(dome)

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 5.2, 8), darkMetalMat)
      mast.position.set(1.65, 2.8, -0.45)
      g.add(mast)

      const dishPivot = new THREE.Group()
      dishPivot.position.set(1.65, 5.25, -0.45)
      const dishGeo = new THREE.SphereGeometry(1.1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)
      const dishMesh = new THREE.Mesh(
        dishGeo,
        reg(makeStylizedMat({ color: '#d4dce2', side: THREE.DoubleSide })),
      )
      dishMesh.rotation.x = Math.PI * 0.66
      dishPivot.add(dishMesh)
      const feedPin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.95, 6), darkMetalMat)
      feedPin.rotation.x = Math.PI * 0.16
      feedPin.position.set(0, -0.18, 0.45)
      dishPivot.add(feedPin)
      g.add(dishPivot)
      this.relayDish = dishPivot

      const ledMat = reg(
        new THREE.MeshBasicMaterial({
          color: '#72e6ff',
          transparent: true,
          opacity: 0.85,
        }),
      )
      this.relayLedMat = ledMat
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), ledMat)
      led.position.set(1.65, 5.7, -0.45)
      g.add(led)

      const ledGlow = new THREE.Sprite(
        reg(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: '#72e6ff',
            transparent: true,
            opacity: 0.48,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      )
      ledGlow.position.set(1.65, 5.7, -0.45)
      ledGlow.scale.set(2.2, 2.2, 1)
      g.add(ledGlow)

      const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.18), darkMetalMat)
      plaque.position.set(-1.35, 0.85, 2.35)
      plaque.rotation.y = 0.45
      g.add(plaque)

      g.name = 'landmark-relay-station'
      surfaceGroup.add(g)
      this.shadowSpecs.push({ x: rx, z: rz, radius: 5.0 })
    }

    // ── 4. 踏石长堤（18 块踏石）与湖心浅滩石龛 (-58, -94) ──────
    {
      const stoneGeo = makeSculptedBoulderGeo(77)
      const stoneMat = reg(makeStylizedMat({ vertexColors: true }))
      const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, 18)
      const mtx = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const eu = new THREE.Euler()
      const p = new THREE.Vector3()
      const sc = new THREE.Vector3()

      for (let i = 0; i < 18; i += 1) {
        const t = 0.04 + (i / 17) * 0.91
        const px = -20 + (-56 - -20) * t + Math.sin(i * 1.6) * 0.45
        const pz = -46 + (-91 - -46) * t + Math.cos(i * 1.3) * 0.4
        const py = Math.max(heightAt(px, pz), LAKE.y + 0.02)
        p.set(px, py + 0.04, pz)
        eu.set((Math.random() - 0.5) * 0.08, i * 0.72, (Math.random() - 0.5) * 0.08)
        q.setFromEuler(eu)
        const r = 0.62 + (i % 3) * 0.14
        sc.set(r, 0.24, r * 0.86)
        mtx.compose(p, q, sc)
        stones.setMatrixAt(i, mtx)
      }
      stones.instanceMatrix.needsUpdate = true
      stones.name = 'lake-stepping-stones'
      surfaceGroup.add(stones)

      const ix = -58
      const iz = -94
      const iy = heightAt(ix, iz)
      const island = new THREE.Group()
      island.position.set(ix, iy - 0.05, iz)
      const stoneMat2 = reg(makeStylizedMat({ color: '#6b7578' }))
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.45, 0.52, 8), stoneMat2)
      base.position.y = 0.24
      island.add(base)

      for (const sx of [-0.72, 0.72]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.9, 0.36), stoneMat2)
        col.position.set(sx, 1.3, 0)
        island.add(col)
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.32, 0.72), stoneMat2)
      cap.position.y = 2.34
      island.add(cap)

      const shrineGlow = new THREE.Sprite(
        reg(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: '#9bd8df',
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      )
      shrineGlow.position.set(0, 1.25, 0)
      shrineGlow.scale.set(2.4, 2.4, 1)
      island.add(shrineGlow)

      island.name = 'landmark-lake-island-shrine'
      surfaceGroup.add(island)
      this.shadowSpecs.push({ x: ix, z: iz, radius: 3.1 })
    }

    // ── 5. 西原日落石阵 (-84, -24) ───────────────────────────
    {
      const wx = -84
      const wz = -24
      const wy = heightAt(wx, wz)
      const g = new THREE.Group()
      g.position.set(wx, wy - 0.1, wz)

      const rockMat = reg(makeStylizedMat({ vertexColors: true }))
      const monoGeo = makeSculptedBoulderGeo(93)
      for (let i = 0; i < 7; i += 1) {
        const ang = (i / 7) * Math.PI * 2 + 0.25
        const r = 5.4
        const sx = Math.cos(ang) * r
        const sz = Math.sin(ang) * r
        const localY = heightAt(wx + sx, wz + sz) - wy
        const monolith = new THREE.Mesh(monoGeo, rockMat)
        const hScale = 1.35 + (i % 3) * 0.45
        monolith.position.set(sx, localY + hScale * 0.68, sz)
        monolith.scale.set(0.75 + (i % 2) * 0.22, hScale, 0.62)
        monolith.rotation.set(0, -ang + 0.3, (i % 2 === 0 ? 1 : -1) * 0.08)
        g.add(monolith)
        this.shadowSpecs.push({ x: wx + sx, z: wz + sz, radius: 1.25 })
      }

      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.45, 0.72, 7),
        reg(makeStylizedMat({ color: '#4c4743' })),
      )
      plinth.position.y = 0.34
      g.add(plinth)

      const gnomon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 1.9, 6),
        reg(makeStylizedMat({ color: '#a87d56' })),
      )
      gnomon.position.set(0, 1.32, 0)
      gnomon.rotation.x = 0.38
      gnomon.rotation.z = -0.32
      g.add(gnomon)

      const emberMat = reg(
        new THREE.MeshBasicMaterial({
          color: '#ff9c64',
          transparent: true,
          opacity: 0.76,
        }),
      )
      this.cairnFlameMat = emberMat
      const ember = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), emberMat)
      ember.position.set(0, 0.78, 0)
      g.add(ember)

      const brazierGlow = new THREE.Sprite(
        reg(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: '#ff9c64',
            transparent: true,
            opacity: 0.56,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      )
      brazierGlow.position.set(0, 1.05, 0)
      brazierGlow.scale.set(2.5, 2.5, 1)
      g.add(brazierGlow)

      g.name = 'landmark-west-cairn-ring'
      surfaceGroup.add(g)
      this.shadowSpecs.push({ x: wx, z: wz, radius: 2.2 })
    }

    // ── 6. 3 处可坐下观景长椅 ────────────────────────────────
    {
      const woodMat = reg(makeStylizedMat({ color: '#78583e' }))
      const legMat = reg(makeStylizedMat({ color: '#454a50' }))
      for (const b of SCENIC_BENCHES) {
        const bg = new THREE.Group()
        bg.position.set(b.x, heightAt(b.x, b.z) - 0.04, b.z)
        bg.rotation.y = Math.atan2(b.lookX - b.x, b.lookZ - b.z)

        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.56), woodMat)
        seat.position.y = 0.48
        bg.add(seat)

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.42, 0.07), woodMat)
        back.position.set(0, 0.82, -0.24)
        back.rotation.x = -0.18
        bg.add(back)

        for (const lx of [-0.78, 0.78]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.52), legMat)
          leg.position.set(lx, 0.24, 0)
          bg.add(leg)
        }

        const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.32, 6), legMat)
        lanternPost.position.set(1.22, 0.64, -0.05)
        bg.add(lanternPost)

        const lanternGlow = new THREE.Sprite(
          reg(
            new THREE.SpriteMaterial({
              map: glowTexture,
              color: '#ffcf8f',
              transparent: true,
              opacity: 0.46,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ),
        )
        lanternGlow.position.set(1.22, 1.32, -0.05)
        lanternGlow.scale.set(1.35, 1.35, 1)
        bg.add(lanternGlow)

        bg.name = 'bench-' + b.id
        surfaceGroup.add(bg)
        this.shadowSpecs.push({ x: b.x, z: b.z, radius: 1.85 })
      }
    }

    // ── 7. 呼唤天穹垂直回响光柱 (Space 激活) ─────────────────
    {
      const beamGeo = new THREE.CylinderGeometry(0.18, 0.72, 68, 12, 1, true)
      const ringGeo = new THREE.RingGeometry(1.2, 2.0, 32)
      ringGeo.rotateX(-Math.PI / 2)

      for (const meta of WORLD_DISCOVERIES) {
        const gy = heightAt(meta.x, meta.z)
        const beamMat = reg(
          new THREE.MeshBasicMaterial({
            color: meta.accent,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        )
        const beam = new THREE.Mesh(beamGeo, beamMat)
        beam.position.set(meta.x, gy + 33, meta.z)
        beam.visible = false
        surfaceGroup.add(beam)

        const ringMat = reg(
          new THREE.MeshBasicMaterial({
            color: meta.accent,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        )
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.position.set(meta.x, gy + 0.18, meta.z)
        ring.visible = false
        surfaceGroup.add(ring)

        this.echoBeams.set(meta.id, { beam, ring, age: 0, active: false, baseOpacity: 0.5 })
      }
    }
  }

  dispose() {
    for (const m of this.materials) m.dispose()
  }
}
