import * as THREE from 'three'
import { createMat, enableShadows } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import {
  buildContinuousRailing,
  buildStreetLampRow,
  createCityPbrMaterials,
  type CityRailSegment,
} from './cityKit'
import {
  createOrnateSophiaCathedral,
  createRussianMusicGazebo,
  createSnowyPineTree,
  createWinterMarketKiosk,
} from './harbinAssets'
import { createHarbinBaroqueBuilding } from './radicalAssets'

const PLAZA_HALF_WIDTH = 36
const PLAZA_HALF_DEPTH = 17
const PLAZA_Y = 0.65
const CHURCH_Z = -34
const GAZEBO_X = 25
const GAZEBO_Z = -6
const POND_X = -28
const POND_Z = -22
const POND_RADIUS_X = 10
const POND_RADIUS_Z = 7.5

function createSeededRand(seedInit: number) {
  let seed = seedInit
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function createBirchTree(height: number, rng: () => number, barkMat: THREE.Material, snowMat: THREE.Material) {
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, height, 7), barkMat)
  trunk.position.y = height / 2
  tree.add(trunk)
  for (let i = 0; i < 4; i += 1) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 2.2, 5), barkMat)
    branch.position.set(0, height * (0.55 + i * 0.1), 0)
    branch.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.52 + rng() * 0.25)
    branch.rotation.y = i * 1.4
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), snowMat)
    cap.position.set((i % 2 === 0 ? -1 : 1) * 0.72, height * (0.62 + i * 0.1), 0)
    cap.scale.set(1.25, 0.48, 1.0)
    tree.add(branch, cap)
  }
  return tree
}

/**
 * 哈尔滨 · 初雪教堂广场（从零彻底重构，1:1 原生米制）：
 * - 拆除右侧突兀白棚架，改为俄式铸铁雪顶欧式音乐亭 + 热红酒雪夜木屋市集；
 * - 圣索菲亚教堂本体重做红砖柱廊拱门、白色 Kokoshnik 山花叠涩檐口、四角钟楼与 5 座金色肋条绿穹顶；
 * - 打开东西南北开放式面包石“中央大街”十字透视走廊，四周错落巴洛克街区、自然雪松白桦与飘雪粒子。
 */
export function buildHarbinCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'harbin-city'
  ctx.setFramingView?.({ pos: [0, 20, 48], look: [0, 12, -18], fov: 50 })

  const rng = createSeededRand(1907)
  const materials = createCityPbrMaterials(ctx.textures)
  materials.addWeatherHook(ctx)

  const brickMat = materials.brick
  const trimMat = materials.stone
  const snowMat = materials.snow
  const cobbleMat = applyPbrSet(
    createMat('#9ea9b5', { roughness: 0.88, bumpMap: ctx.textures.darkStoneTex, bumpScale: 0.04 }),
    'snow',
    16,
    8,
  )
  const iceMat = createMat('#cfeefc', {
    emissive: '#3fa8d0',
    emissiveIntensity: 0.52,
    transparent: true,
    opacity: 0.88,
    roughness: 0.2,
    flatShading: true,
  })

  // -------------------------------------------------------------------------
  // 1. 远山雪丘与 420 m 连续雪原（绝不向城内穿插灰白多面体）
  // -------------------------------------------------------------------------
  const farSnowHorizon = new THREE.Group()
  farSnowHorizon.name = 'horizon-snowhills'
  farSnowHorizon.userData.horizonVariant = 'harbin'
  const hillGeo = new THREE.CylinderGeometry(185, 220, 26, 64, 1, true)
  const hPos = hillGeo.attributes.position
  for (let i = 0; i < hPos.count; i += 1) {
    const hx = hPos.getX(i)
    const hy = hPos.getY(i)
    const hz = hPos.getZ(i)
    if (hy > 0) {
      hPos.setY(i, hy + Math.sin(hx * 0.05) * 4 + Math.cos(hz * 0.06) * 3)
    }
  }
  hillGeo.computeVertexNormals()
  const hillRing = new THREE.Mesh(
    hillGeo,
    createMat('#dae6f2', { roughness: 0.96, side: THREE.BackSide }),
  )
  hillRing.position.y = 9
  farSnowHorizon.add(hillRing)
  g.add(farSnowHorizon)

  const openSnowGeo = new THREE.PlaneGeometry(420, 420)
  const openSnow = new THREE.Mesh(
    openSnowGeo,
    applyPbrSet(createMat('#e5eef6', { roughness: 0.96 }), 'snow', 36, 36),
  )
  openSnow.name = 'open-horizon-ground'
  openSnow.rotation.x = -Math.PI / 2
  openSnow.position.y = 0.015
  openSnow.receiveShadow = true
  g.add(openSnow)

  // -------------------------------------------------------------------------
  // 2. 索菲亚面包石雪夜广场 + 开放式十字步行街轴线 + 前景观景台
  // -------------------------------------------------------------------------
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(PLAZA_HALF_WIDTH * 2, 0.55, PLAZA_HALF_DEPTH * 2), cobbleMat)
  plaza.name = 'continuous-snow-plaza'
  plaza.position.set(0, PLAZA_Y - 0.275, 0)
  plaza.receiveShadow = true
  g.add(plaza)

  // Open Bread-Stone Central Street axes extending West-East & North-South
  addBox(g, [180, 0.36, 16], [0, 0.18, 0], cobbleMat).castShadow = false
  addBox(g, [16, 0.36, 160], [0, 0.18, 12], cobbleMat).castShadow = false

  const foregroundDeck = new THREE.Group()
  foregroundDeck.name = 'harbin-foreground-standing-deck'
  foregroundDeck.userData.foregroundDeck = true
  addBox(foregroundDeck, [12, 0.32, 5], [0, 0.16, 17.5], materials.wood)
  buildContinuousRailing(
    foregroundDeck,
    [
      { from: [-6, 0.32, 15], to: [-6, 0.32, 20] },
      { from: [6, 0.32, 15], to: [6, 0.32, 20] },
      { from: [-6, 0.32, 20], to: [6, 0.32, 20] },
    ],
    'iron',
  )
  g.add(foregroundDeck)

  const railSegments: CityRailSegment[] = [
    { from: [-PLAZA_HALF_WIDTH, PLAZA_Y, -PLAZA_HALF_DEPTH], to: [-12, PLAZA_Y, -PLAZA_HALF_DEPTH] },
    { from: [12, PLAZA_Y, -PLAZA_HALF_DEPTH], to: [PLAZA_HALF_WIDTH, PLAZA_Y, -PLAZA_HALF_DEPTH] },
    { from: [-PLAZA_HALF_WIDTH, PLAZA_Y, PLAZA_HALF_DEPTH], to: [-8, PLAZA_Y, PLAZA_HALF_DEPTH] },
    { from: [8, PLAZA_Y, PLAZA_HALF_DEPTH], to: [PLAZA_HALF_WIDTH, PLAZA_Y, PLAZA_HALF_DEPTH] },
  ]
  buildContinuousRailing(g, railSegments, 'iron')

  // -------------------------------------------------------------------------
  // 3. 精雕圣索菲亚教堂本体（奇遇 rose + bell）
  // -------------------------------------------------------------------------
  const cathedral = createOrnateSophiaCathedral(brickMat, trimMat, snowMat)
  cathedral.church.position.set(0, PLAZA_Y, CHURCH_Z)
  g.add(cathedral.church)

  ctx.registerInteractive(cathedral.rose, {
    encounterId: 'rose',
    focusPoint: new THREE.Vector3(0, PLAZA_Y + 12.1, CHURCH_Z + 11.2),
    onClick: () => {
      cathedral.roseMat.emissiveIntensity = 1.6
      ctx.discoverEncounter('rose')
      return { label: '玫瑰窗亮起的刹那，整座教堂变成一盏琉璃灯', sfx: 'lamp' }
    },
  })

  // Flying snow doves circling the peacock-green onion dome
  const doveGroup = new THREE.Group()
  doveGroup.name = 'cathedral-snow-doves'
  doveGroup.visible = false
  const doves: THREE.Mesh[] = []
  const doveMat = createMat('#ffffff', { emissive: '#cfe6ff', emissiveIntensity: 0.55 })
  const doveGeo = new THREE.ConeGeometry(0.45, 1.2, 4)
  for (let i = 0; i < 8; i += 1) {
    const dove = new THREE.Mesh(doveGeo, doveMat)
    dove.rotation.x = Math.PI / 2
    doveGroup.add(dove)
    doves.push(dove)
  }
  g.add(doveGroup)

  // -------------------------------------------------------------------------
  // 4. 俄式铸铁雪顶欧式音乐亭 + 热红酒木屋市集 + 冰雕灯柱 + 冰湖滑冰场
  // -------------------------------------------------------------------------
  const { gazebo, lanternMat: gazeboLanternMat } = createRussianMusicGazebo(ctx.textures.glowHalo)
  gazebo.position.set(GAZEBO_X, PLAZA_Y, GAZEBO_Z)
  g.add(gazebo)

  for (const [kx, kz, rot] of [
    [29, 10, -0.45],
    [16, 12, 0.25],
    [-20, 12, -0.2],
  ] as [number, number, number][]) {
    const kiosk = createWinterMarketKiosk(ctx.textures.glowHalo)
    kiosk.position.set(kx, PLAZA_Y, kz)
    kiosk.rotation.y = rot
    g.add(kiosk)
  }

  const iceMarket = new THREE.Group()
  iceMarket.name = 'ice-lantern-market'
  const coreMat = createMat('#ffd388', { emissive: '#ffaa48', emissiveIntensity: 1.0 })
  for (let i = 0; i < 4; i += 1) {
    const height = 2.3 + (i % 2) * 0.8
    const ix = 12 + i * 3.0
    addBox(iceMarket, [1.0, 0.35, 1.0], [ix, PLAZA_Y + 0.175, -13.5], trimMat).castShadow = false
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.48, height, 6), iceMat)
    pillar.position.set(ix, PLAZA_Y + 0.35 + height / 2, -13.5)
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), coreMat)
    crystal.position.set(ix, PLAZA_Y + 0.35 + height + 0.4, -13.5)
    iceMarket.add(pillar, crystal)
  }
  g.add(iceMarket)

  // Frozen Skating Pond on west square lawn
  const pond = new THREE.Group()
  pond.name = 'frozen-pond'
  pond.position.set(POND_X, 0.08, POND_Z)
  const pondIce = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    createMat('#cfeaf6', { emissive: '#4f9cc8', emissiveIntensity: 0.35, roughness: 0.16, metalness: 0.12 }),
  )
  pondIce.rotation.x = -Math.PI / 2
  pondIce.scale.set(POND_RADIUS_X, POND_RADIUS_Z, 1)
  pond.add(pondIce)
  const skaters: { person: THREE.Group; radius: number; speed: number; phase: number }[] = []
  for (let i = 0; i < 2; i += 1) {
    const skater = new THREE.Group()
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.38, 1.1, 8),
      createMat(i === 0 ? '#26334c' : '#5e2a36', { roughness: 0.8 }),
    )
    torso.position.y = 0.95
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), createMat('#d8b49a', { roughness: 0.7 }))
    head.position.y = 1.8
    skater.add(torso, head)
    pond.add(skater)
    skaters.push({ person: skater, radius: 3.2 + i * 2.2, speed: 0.7 + i * 0.25, phase: i * 2.4 })
  }
  g.add(pond)

  // -------------------------------------------------------------------------
  // 5. 开放透视中央大街俄式巴洛克长街（留出十字长街开口，告别封闭盒子）
  // -------------------------------------------------------------------------
  const baroqueWalls = ['#8ea692', '#cbb07b', '#b57a64', '#d2c6b0']
  const blockPlacements: Array<[number, number, number, boolean]> = [
    // North of Cathedral (leaving central north corridor x ∈ [-16, 16] open)
    [-58, -68, 0, true], [-34, -68, 0, false], [34, -68, 0, false], [58, -68, 0, true],
    // East & West avenues (leaving z ∈ [-12, 12] Central Street open!)
    [-58, -36, Math.PI / 2, true], [-58, 28, Math.PI / 2, false],
    [58, -36, -Math.PI / 2, true], [58, 28, -Math.PI / 2, false],
    // South framing avenue behind camera (leaving x ∈ [-16, 16] open)
    [-56, 48, Math.PI, false], [-32, 48, Math.PI, true], [32, 48, Math.PI, true], [56, 48, Math.PI, false],
  ]
  blockPlacements.forEach(([bx, bz, rot, cupola], idx) => {
    const bldg = createHarbinBaroqueBuilding({
      width: 18 + (idx % 3) * 2,
      depth: 14,
      floors: 3 + (idx % 2),
      wallTint: baroqueWalls[idx % baroqueWalls.length],
      hasCornerCupola: cupola,
    })
    bldg.position.set(bx, 0.02, bz)
    bldg.rotation.y = rot
    g.add(bldg)
  })

  // Streetlamps & organic snowy pines + birches
  const streetLamps = buildStreetLampRow(
    g,
    ctx.textures,
    [
      [-18, PLAZA_Y, -12], [18, PLAZA_Y, -12],
      [-18, PLAZA_Y, 6], [18, PLAZA_Y, 6],
      [-8, PLAZA_Y, 14], [8, PLAZA_Y, 14],
    ],
    'harbin',
  )
  const barkMat = createMat('#e5e3dc', { roughness: 0.92 })
  for (const [tx, tz, s] of [
    [-40, -14, 1.0], [-40, 12, 1.15], [40, -14, 1.05], [40, 14, 1.1],
    [-22, -46, 1.2], [22, -46, 1.15], [-44, 34, 1.1], [44, 34, 1.2],
  ] as [number, number, number][]) {
    const pine = createSnowyPineTree(s)
    pine.position.set(tx, 0.02, tz)
    g.add(pine)
  }
  for (const [bx, bz, h] of [
    [-38, -28, 9], [38, -26, 9.5], [-24, 24, 8.5], [24, 24, 9],
  ] as [number, number, number][]) {
    const birch = createBirchTree(h, rng, barkMat, snowMat)
    birch.position.set(bx, 0.02, bz)
    g.add(birch)
  }

  // Gentle falling winter snowflakes (260 lightweight snow points)
  const snowCount = 260
  const snowPos = new Float32Array(snowCount * 3)
  for (let i = 0; i < snowCount; i += 1) {
    snowPos[i * 3] = (rng() - 0.5) * 90
    snowPos[i * 3 + 1] = rng() * 34 + 1
    snowPos[i * 3 + 2] = (rng() - 0.5) * 90 - 12
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  const snowPointsMat = new THREE.PointsMaterial({
    color: '#eef6ff',
    size: 0.36,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  })
  const snowField = new THREE.Points(snowGeo, snowPointsMat)
  g.add(snowField)

  // Subtle Northern Aurora Ribbon high in the Harbin twilight sky
  const auroraUniforms = { uTime: { value: 0 }, uOpacity: { value: 0.14 } }
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 1.4 + uTime * 1.4) * 1.4;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float curtain = sin(vUv.x * 12.0 + uTime * 1.3) * 0.5 + 0.5;
        float fadeX = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        float fadeY = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        vec3 col = mix(vec3(0.24, 0.92, 0.68), vec3(0.45, 0.68, 1.0), vUv.y);
        gl_FragColor = vec4(col * (0.65 + 0.45 * curtain), fadeX * fadeY * uOpacity);
      }
    `,
  })
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(220, 62, 30, 8), auroraMat)
  aurora.position.set(0, 68, -135)
  g.add(aurora)

  // -------------------------------------------------------------------------
  // 6. 3/3 奇遇互动（lamps, rose, bell）+ 漫步与观景契约
  // -------------------------------------------------------------------------
  const lampLights: THREE.PointLight[] = []
  streetLamps.traverse((o) => {
    if (o instanceof THREE.PointLight) lampLights.push(o)
  })

  const igniteLamps = () => {
    lampLights.forEach((l) => { l.intensity = 3.4 })
    gazeboLanternMat.emissiveIntensity = 1.65
    iceMat.emissiveIntensity = 1.15
  }
  const ringBell = () => {
    doveGroup.visible = true
    auroraUniforms.uOpacity.value = 0.55
  }

  ctx.registerInteractive(streetLamps, {
    encounterId: 'lamps',
    focusPoint: new THREE.Vector3(-18, PLAZA_Y + 3.2, 6),
    onClick: () => {
      igniteLamps()
      ctx.discoverEncounter('lamps')
      return { label: '路灯一盏盏醒来，雪地上长出一排小月亮', sfx: 'lamp' }
    },
  })
  ctx.registerInteractive(iceMarket, {
    encounterId: 'lamps',
    focusPoint: new THREE.Vector3(16, PLAZA_Y + 2, -13.5),
    onClick: () => {
      igniteLamps()
      ctx.discoverEncounter('lamps')
      return { label: '冰雕灯柱与俄式长街路灯在雪夜里一同暖亮', sfx: 'lamp' }
    },
  })
  ctx.registerInteractive(cathedral.church, {
    encounterId: 'bell',
    focusPoint: new THREE.Vector3(0, PLAZA_Y + 22, CHURCH_Z),
    onClick: () => {
      ringBell()
      ctx.discoverEncounter('bell')
      return { label: '钟声荡过雪原，成群白鸽替初雪飞了起来', sfx: 'horn' }
    },
  })

  ctx.setFinaleTrigger(() => {
    igniteLamps()
    cathedral.roseMat.emissiveIntensity = 1.75
    ringBell()
  })

  ctx.setVantageAnchor?.({
    label: '俄式雪顶音乐亭 · 索菲亚广场',
    pos: [GAZEBO_X, PLAZA_Y + 1.65, GAZEBO_Z],
    yaw: Math.atan2(-GAZEBO_X, CHURCH_Z - GAZEBO_Z),
    pitch: 0.14,
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 6 && z >= 15 && z <= 20) return 0.32
    if (Math.abs(x) <= PLAZA_HALF_WIDTH && Math.abs(z) <= PLAZA_HALF_DEPTH) return PLAZA_Y
    if (Math.abs(x) <= 8 && z >= -70 && z <= 68) return 0.36
    if (Math.abs(z) <= 8 && Math.abs(x) <= 85) return 0.36
    return null
  })

  ctx.addTick((time, dt) => {
    auroraUniforms.uTime.value = time
    for (const s of skaters) {
      const a = time * s.speed + s.phase
      s.person.position.set(Math.cos(a) * s.radius, 0.05, Math.sin(a) * s.radius * 0.72)
      s.person.rotation.y = -a
    }
    if (doveGroup.visible) {
      doves.forEach((d, i) => {
        const a = time * 0.65 + (i / doves.length) * Math.PI * 2
        d.position.set(Math.cos(a) * 14, PLAZA_Y + 22 + Math.sin(time * 2.2 + i) * 1.8, CHURCH_Z + Math.sin(a) * 14)
        d.rotation.y = -a
      })
    }
    const attr = snowGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < snowCount; i += 1) {
      let sy = attr.getY(i) - dt * 1.6
      if (sy < 0.2) sy = 34
      attr.setY(i, sy)
    }
    attr.needsUpdate = true
  })

  enableShadows(g, true, true)
  openSnow.castShadow = false
  aurora.castShadow = false

  ctx.addDisposeHook?.(() => {
    openSnowGeo.dispose()
    snowGeo.dispose()
    snowPointsMat.dispose()
    hillGeo.dispose()
  })
}
