import * as THREE from 'three'
import { buildSceneWater, createMat, createMiniFish, enableShadows, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import {
  buildContinuousRailing,
  createCityPbrMaterials,
  createGlidingBirds,
  type CityRailSegment,
} from './cityKit'
import { createShoreReedClump } from './daliAssets'
import {
  createBambooClump,
  createBellPavilion,
  createFiveTierPagoda,
  createKyotoCedar,
  createKyotoPalette,
  createSenbonToriiPath,
  createStoneChozuya,
  createTempleMainHall,
  createVermilionArchBridge,
  createWeepingSakura,
} from './kyotoAssets'
import { createParisianBench } from './parisAssets'

/**
 * 京都 · 暮春樱花古寺（1:1 原生米制重造）：
 * - 近岸青石庭院与缘侧木栈道设于鸭川镜池南畔，檐下玻璃风铃随晚岚轻晃；
 * - 朱红弧形拱桥跨过 96×36 m 镜面水池，对岸矗立 28 m 五重飞檐木塔、正殿本堂与青铜梵钟亭；
 * - 左侧山坡蜿蜒 15 重千本鸟居石阶通往东山苍翠群岭，260 片樱瓣与水漂纸灯随钟声与夜幕渐次点亮。
 */
export function buildKyotoCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'kyoto-sakura-temple-scene'

  const WATER_Y = -0.35
  const NEAR_PROMENADE_Y = 0.65
  const FAR_TERRACE_Y = 1.15
  const BRIDGE_START_Z = 7.4
  const BRIDGE_END_Z = -22.6

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createKyotoPalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 1:1 连续苔草大地与近/对岸石砌庭院基底
  // -------------------------------------------------------------------------
  const mossGrassMat = applyPbrSet(
    createMat('#3d523c', { roughness: 0.94, bumpMap: ctx.textures.plasterBump, bumpScale: 0.04 }),
    'grass',
    28,
    28,
  )
  const cobbleMat = applyPbrSet(
    createMat('#6c716c', { roughness: 0.88, bumpMap: ctx.textures.darkStoneTex, bumpScale: 0.045 }),
    'cobble',
    18,
    12,
  )
  const slateFloorMat = applyPbrSet(
    createMat('#565e62', { roughness: 0.78, bumpMap: ctx.textures.darkStoneTex, bumpScale: 0.035 }),
    'slate',
    14,
    10,
  )

  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mossGrassMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -0.02, -40)
  openGround.receiveShadow = true
  g.add(openGround)

  // Near-shore foreground bluestone promenade (x: -27..+27, z: 7.2..23.2)
  const nearDeck = new THREE.Mesh(new THREE.BoxGeometry(54, 1.35, 16), slateFloorMat)
  nearDeck.name = 'kyoto-foreground-courtyard'
  nearDeck.userData.foregroundDeck = true
  nearDeck.position.set(0, NEAR_PROMENADE_Y - 0.675, 15.2)
  nearDeck.receiveShadow = true
  g.add(nearDeck)

  const nearBorder = new THREE.Mesh(new THREE.BoxGeometry(54, 1.4, 0.9), palette.stone)
  nearBorder.position.set(0, 0.0, 7.2)
  nearBorder.receiveShadow = true
  g.add(nearBorder)

  // Far-shore temple sanctuary terrace hugging Bell Pavilion, Main Hall & Pagoda (x: -21..+25, z: -22.4..-49.4)
  const farTerrace = new THREE.Mesh(new THREE.BoxGeometry(46, 1.85, 27), cobbleMat)
  farTerrace.position.set(2, FAR_TERRACE_Y - 0.925, -35.9)
  farTerrace.receiveShadow = true
  g.add(farTerrace)

  const farEmbankment = new THREE.Mesh(new THREE.BoxGeometry(47.2, 1.9, 1.1), palette.stone)
  farEmbankment.position.set(2, 0.2, -22.4)
  const farLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 27.6), palette.stone)
  farLeftWall.position.set(-21.2, 0.25, -35.9)
  const farRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 27.6), palette.stone)
  farRightWall.position.set(25.2, 0.25, -35.9)
  farEmbankment.receiveShadow = true
  farLeftWall.receiveShadow = true
  farRightWall.receiveShadow = true
  g.add(farEmbankment, farLeftWall, farRightWall)

  // Seamless rising Higashiyama foot-slope tapering flush into the open horizon ground on every margin
  const HILL_CENTER_X = -8
  const HILL_CENTER_Z = -68
  const HILL_W = 260
  const HILL_D = 126
  const sampleHillHeight = (wx: number, wz: number) => {
    const lx = wx - HILL_CENTER_X
    const lz = wz - HILL_CENTER_Z
    const fallX = Math.max(0, 1 - Math.pow(Math.abs(lx) / (HILL_W * 0.48), 2.4))
    const fallBack = Math.max(0, 1 - Math.max(0, (-lz - 28) / 34))
    const riseZ = THREE.MathUtils.smoothstep(-lz, -40, 26)
    const toriiRidge = Math.exp(-Math.pow((wx + 27) / 22, 2)) * 4.4
    const eastRise = Math.exp(-Math.pow((wx - 22) / 36, 2)) * 2.2
    const undulation = (Math.sin(wx * 0.08) * Math.cos(wz * 0.09) + 1) * 1.1
    const baseH = (riseZ * (8.5 + toriiRidge + eastRise) + undulation * riseZ) * fallX * fallBack
    const marginSink = (1 - fallX * fallBack) * -0.55
    return baseH + marginSink
  }

  const hillGeo = new THREE.PlaneGeometry(HILL_W, HILL_D, 76, 36)
  hillGeo.rotateX(-Math.PI / 2)
  const hPos = hillGeo.attributes.position
  for (let i = 0; i < hPos.count; i += 1) {
    const wx = hPos.getX(i) + HILL_CENTER_X
    const wz = hPos.getZ(i) + HILL_CENTER_Z
    hPos.setY(i, sampleHillHeight(wx, wz))
  }
  hillGeo.computeVertexNormals()
  const templeHill = new THREE.Mesh(hillGeo, mossGrassMat)
  templeHill.position.set(HILL_CENTER_X, 0, HILL_CENTER_Z)
  templeHill.receiveShadow = true
  g.add(templeHill)

  // -------------------------------------------------------------------------
  // 2. 镜面水池（Reflector）+ 岸石苇草 + 双尾锦鲤 + 漂浮纸灯
  // -------------------------------------------------------------------------
  const pond = buildSceneWater(ctx, {
    width: 96,
    depth: 36,
    x: 0,
    y: WATER_Y,
    z: -7.6,
    deepHex: '#183644',
    shallowHex: '#43737a',
    fadeRadius: 120,
    reflective: true,
  })
  pond.mesh.name = 'kyoto-mirror-pond'
  ctx.bindWater(
    (x, z) => pond.setRipple(x, z),
    (bio) => pond.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      pond.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) pond.uniforms.uSunCol.value.set(sunHex)
      if (sunDir) pond.uniforms.uSunDir.value.set(...sunDir).normalize()
    },
  )
  ctx.registerInteractive(pond.mesh, {
    onClick: (pt) => {
      const local = pt ? ctx.group.worldToLocal(pt.clone()) : null
      pond.setRipple(local?.x ?? 0, local?.z ?? -7.6)
      return { label: '轻拨古寺镜池 · 樱瓣与塔影随涟漪轻漾', sfx: 'ripple' }
    },
  })

  // Shoreline moss boulders & lake reeds framing mirror pond
  const rockMat = createMat('#666d68', { roughness: 0.9, flatShading: true })
  const boulderCoords: [number, number, number][] = [
    [-6.2, 6.6, 1.15],
    [-11.8, 5.2, 1.5],
    [7.4, 6.4, 1.25],
    [13.6, 4.4, 1.6],
    [-8.5, -21.2, 1.4],
    [6.4, -21.4, 1.2],
    [19.2, -20.5, 1.7],
  ]
  boulderCoords.forEach(([bx, bz, sc], idx) => {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), rockMat)
    boulder.scale.set(1.4, 0.72, 1.1)
    boulder.position.set(bx, WATER_Y + sc * 0.28, bz)
    boulder.rotation.y = idx * 1.1
    g.add(boulder)
  })
  for (const [rx, rz] of [[-7.2, 5.8], [8.8, 5.4], [-9.8, -20.4], [17.5, -20.8]] as [number, number][]) {
    const reed = createShoreReedClump()
    reed.scale.setScalar(1.35)
    reed.position.set(rx, WATER_Y + 0.08, rz)
    g.add(reed)
  }

  const koiFish = [createMiniFish('#ff7d44'), createMiniFish('#ffd568'), createMiniFish('#ff5e3a')]
  koiFish.forEach((k) => {
    k.scale.setScalar(2.4)
    g.add(k)
  })

  // 10 Floating washi paper lanterns on the mirror pond
  const pondLanterns: { grp: THREE.Group; mat: THREE.MeshStandardMaterial; halo: THREE.Sprite; ox: number; oz: number; phase: number }[] = []
  const pondLanternCoords: [number, number][] = [
    [-12.5, -1.5],
    [-8.2, -5.8],
    [-4.8, 1.4],
    [-3.6, -12.4],
    [4.4, 1.8],
    [6.2, -6.4],
    [10.8, -2.8],
    [14.5, -10.5],
    [8.2, -16.8],
    [-7.6, -15.6],
  ]
  pondLanternCoords.forEach(([lx, lz], idx) => {
    const lg = new THREE.Group()
    lg.position.set(lx, WATER_Y + 0.04, lz)
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.68), palette.cedar)
    const pMat = createMat('#ffe7ba', { emissive: '#ffaa46', emissiveIntensity: 0.72, roughness: 0.35 })
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.46), pMat)
    paper.position.y = 0.32
    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffc46e', 2.4, 0.36)
    halo.position.y = 0.36
    lg.add(tray, paper, halo)
    g.add(lg)
    pondLanterns.push({ grp: lg, mat: pMat, halo, ox: lx, oz: lz, phase: idx * 0.85 })
  })

  // -------------------------------------------------------------------------
  // 3. 近岸石钵、休憩长凳、连续栏杆 + 朱红跨池木拱桥
  // -------------------------------------------------------------------------
  const rails: CityRailSegment[] = [
    { from: [-26.5, NEAR_PROMENADE_Y, 7.2], to: [-2.0, NEAR_PROMENADE_Y, 7.2] },
    { from: [2.0, NEAR_PROMENADE_Y, 7.2], to: [26.5, NEAR_PROMENADE_Y, 7.2] },
  ]
  buildContinuousRailing(g, rails, 'stone')

  const chozuya = createStoneChozuya(palette)
  chozuya.position.set(-5.6, NEAR_PROMENADE_Y, 8.8)
  g.add(chozuya)

  const bench = createParisianBench()
  bench.position.set(5.2, NEAR_PROMENADE_Y, 9.6)
  bench.rotation.y = Math.PI
  g.add(bench)

  const ARCH_HEIGHT = 2.6
  const { bridge, getDeckY } = createVermilionArchBridge(
    palette,
    BRIDGE_START_Z,
    BRIDGE_END_Z,
    NEAR_PROMENADE_Y,
    FAR_TERRACE_Y,
    ARCH_HEIGHT,
  )
  g.add(bridge)

  // -------------------------------------------------------------------------
  // 4. 对岸核心古建：28 m 五重飞檐古木塔 + 正殿本堂 + 梵钟亭 + 千本鸟居石阶
  // -------------------------------------------------------------------------
  const { pagoda, halos: pagodaHalos } = createFiveTierPagoda(palette, ctx.textures.glowHalo)
  pagoda.position.set(12.5, FAR_TERRACE_Y, -34)
  g.add(pagoda)

  const { hall: templeHall, chimes } = createTempleMainHall(palette)
  templeHall.position.set(-4.5, FAR_TERRACE_Y, -39)
  g.add(templeHall)

  const { bellPavilion, bellSwingPivot, striker } = createBellPavilion(palette)
  bellPavilion.position.set(-14.5, FAR_TERRACE_Y, -28.5)
  g.add(bellPavilion)

  const { toriiGroup, lanternsGroup, lanterns, getPathHeight } = createSenbonToriiPath(
    palette,
    ctx.textures.glowHalo,
  )
  g.add(toriiGroup, lanternsGroup)

  const toriiLight = new THREE.PointLight('#ffbd6a', 1.4, 28, 1.5)
  toriiLight.position.set(-18, 4.8, -26)
  g.add(toriiLight)

  // -------------------------------------------------------------------------
  // 5. 六棵苍劲垂枝古樱与 260 片飘散粉樱花瓣
  // -------------------------------------------------------------------------
  const cherryCanopies: { grp: THREE.Group; phase: number }[] = []
  let sakuraGust = 0
  const sakuraPlacements: [number, number, number, number, number][] = [
    [-9.8, NEAR_PROMENADE_Y, 9.6, 1.15, 101],
    [9.4, NEAR_PROMENADE_Y, 8.8, 1.05, 203],
    [3.8, FAR_TERRACE_Y, -25.2, 1.25, 307],
    [-11.2, FAR_TERRACE_Y, -23.8, 1.15, 409],
    [22.4, FAR_TERRACE_Y, -28.6, 1.35, 521],
    [24.5, 2.2, -46.5, 1.4, 631],
  ]

  const triggerSakuraGust = () => {
    sakuraGust = 3.2
    ctx.discoverEncounter('sakura')
    return { label: '轻摇垂枝古樱 · 漫天粉樱化作春雪雨落入镜池', sfx: 'snow' as const }
  }

  sakuraPlacements.forEach(([sx, sy, sz, sc, seed], idx) => {
    const { tree, canopy } = createWeepingSakura(seed, sc)
    tree.position.set(sx, sy, sz)
    g.add(tree)
    cherryCanopies.push({ grp: canopy, phase: idx * 1.9 })
    ctx.registerInteractive(tree, {
      encounterId: 'sakura',
      focusPoint: new THREE.Vector3(sx, sy + 5.2 * sc, sz),
      onClick: triggerSakuraGust,
    })
  })

  const petalCount = 260
  const petalPos = new Float32Array(petalCount * 3)
  const petalCol = new Float32Array(petalCount * 3)
  const petalSpeed = new Float32Array(petalCount)
  const pCols = [new THREE.Color('#ffb8ce'), new THREE.Color('#ffe5ef'), new THREE.Color('#f493b5')]
  for (let i = 0; i < petalCount; i += 1) {
    const a = i * 2.399963
    const r = 4 + ((i * 19) % 44)
    petalPos[i * 3] = Math.cos(a) * r
    petalPos[i * 3 + 1] = 0.8 + ((i * 13) % 18) * 0.95
    petalPos[i * 3 + 2] = -14 + Math.sin(a) * r * 0.72
    petalSpeed[i] = 0.85 + ((i * 7) % 10) * 0.14
    const c = pCols[i % pCols.length]
    petalCol[i * 3] = c.r
    petalCol[i * 3 + 1] = c.g
    petalCol[i * 3 + 2] = c.b
  }
  const petalGeo = new THREE.BufferGeometry()
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3))
  petalGeo.setAttribute('color', new THREE.BufferAttribute(petalCol, 3))
  let petalTex: THREE.Texture = ctx.textures.glowHalo
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const c2d = canvas.getContext('2d')
    if (c2d) {
      c2d.fillStyle = '#ffffff'
      c2d.beginPath()
      c2d.ellipse(16, 16, 11, 6.5, 0.4, 0, Math.PI * 2)
      c2d.fill()
      const tex = new THREE.CanvasTexture(canvas)
      tex.needsUpdate = true
      petalTex = tex
      ctx.addDisposeHook?.(() => tex.dispose())
    }
  }
  const sakuraPetals = new THREE.Points(
    petalGeo,
    new THREE.PointsMaterial({
      size: 0.36,
      map: petalTex,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.15,
      opacity: 0.85,
      depthWrite: false,
    }),
  )
  g.add(sakuraPetals)

  // Flanking Kyoto cedar woods & bamboo groves grounding the Torii stairway and temple ridge
  const cedarCoords: [number, number, number][] = [
    [-35, -24, 10.5], [-33, -31, 11.8], [-37, -38, 12.2], [-35, -47, 13.0], [-36, -55, 11.5],
    [-32, -62, 12.4], [-22, -59, 13.2], [-18, -51, 11.0], [-14, -42, 10.4], [-10, -54, 12.8],
    [-2, -56, 13.5], [6, -55, 12.0], [16, -54, 12.8], [24, -52, 11.6], [30, -45, 12.2],
    [32, -35, 10.8], [30, -25, 9.8], [-27, -18, 9.4], [-42, -32, 11.4], [-44, -44, 12.5],
    [38, -38, 11.8], [41, -49, 13.2], [-46, -56, 13.5], [12, -62, 13.6], [-26, -66, 12.8],
  ]
  cedarCoords.forEach(([cx, cz, ch], idx) => {
    const cedar = createKyotoCedar(ch, idx)
    cedar.position.set(cx, Math.max(0, sampleHillHeight(cx, cz)) - 0.15, cz)
    g.add(cedar)
  })
  for (const [bx, bz, bSeed] of [
    [-22.2, -23.5, 11],
    [-20.8, -34.2, 23],
    [22.5, -24.2, 37],
    [-19.6, -45.5, 53],
    [23.2, -41.5, 71],
  ] as [number, number, number][]) {
    const bamboo = createBambooClump(bSeed, 1.08)
    bamboo.position.set(bx, Math.max(0, sampleHillHeight(bx, bz)) - 0.1, bz)
    g.add(bamboo)
  }

  // -------------------------------------------------------------------------
  // 6. 东山苍翠群岭天际线（horizon-mountains, variant = 'kyoto'）
  // -------------------------------------------------------------------------
  const mountains = new THREE.Group()
  mountains.name = 'horizon-mountains'
  mountains.userData.horizonVariant = 'kyoto'
  const buildMountainBand = (width: number, depth: number, zCenter: number, maxH: number, nearColHex: string, farColHex: string, seedShift: number) => {
    const geo = new THREE.PlaneGeometry(width, depth, 120, 32)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const col = new Float32Array(pos.count * 3)
    const cLow = new THREE.Color(nearColHex)
    const cHigh = new THREE.Color(farColHex)
    const cTmp = new THREE.Color()
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i)
      const vz = pos.getZ(i)
      const fallZ = Math.max(0, 1 - Math.abs(vz) / (depth * 0.49))
      const fallX = Math.max(0, 1 - Math.pow(Math.abs(vx) / (width * 0.49), 3))
      const o1 = 1 - Math.abs(Math.sin(vx * 0.017 + seedShift) * Math.cos(vz * 0.029 + 0.4))
      const o2 = 1 - Math.abs(Math.sin(vx * 0.043 - seedShift * 1.4) + Math.sin(vz * 0.055 + 0.9)) * 0.5
      const o3 = Math.abs(Math.sin(vx * 0.11 + vz * 0.08 + seedShift * 2.1)) * 0.28
      const h = Math.max(0, (o1 * 0.56 + o2 * 0.34 + o3 * 0.25) * maxH * Math.pow(fallZ, 0.68) * fallX - 1.2)
      pos.setY(i, h)
      cTmp.copy(cLow).lerp(cHigh, Math.min(1, h / (maxH * 0.72)))
      col[i * 3] = cTmp.r
      col[i * 3 + 1] = cTmp.g
      col[i * 3 + 2] = cTmp.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    )
    mesh.position.set(0, -1.0, zCenter)
    return mesh
  }
  mountains.add(
    buildMountainBand(440, 110, -150, 34, '#1e352d', '#2b473d', 0.6),
    buildMountainBand(520, 140, -218, 52, '#283d46', '#3a4b5d', 2.3),
  )
  g.add(mountains)

  // -------------------------------------------------------------------------
  // 7. 三重奇遇、梵钟声波、天灯终局、步行高度与观景锚点
  // -------------------------------------------------------------------------
  const soundRings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; delay: number }[] = []
  for (let i = 0; i < 3; i += 1) {
    const sMat = new THREE.MeshBasicMaterial({
      color: '#ffda88',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const sMesh = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.09, 8, 42), sMat)
    sMesh.rotation.x = Math.PI / 2
    sMesh.position.set(-14.5, FAR_TERRACE_Y + 3.2, -28.5)
    sMesh.visible = false
    g.add(sMesh)
    soundRings.push({ mesh: sMesh, mat: sMat, delay: i * 0.36 })
  }

  const skyLanternGrp = new THREE.Group()
  skyLanternGrp.visible = false
  const skyLanterns: { mesh: THREE.Mesh; ox: number; oz: number; offset: number }[] = []
  const skyLanternMat = createMat('#ffe0a4', { emissive: '#ff9638', emissiveIntensity: 1.65 })
  for (let i = 0; i < 14; i += 1) {
    const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.65, 8), skyLanternMat)
    skyLanternGrp.add(lm)
    skyLanterns.push({
      mesh: lm,
      ox: -18 + (i % 7) * 6.0,
      oz: -6 - Math.floor(i / 7) * 16,
      offset: i * 0.48,
    })
  }
  g.add(skyLanternGrp)

  let bellSwingTime = -1
  let lanternsLit = false
  let finaleTimer = -1

  const igniteToriiAndLanterns = () => {
    lanterns.forEach((l) => {
      l.mat.emissiveIntensity = 1.85
      l.halo.material.opacity = 0.85
    })
    pagodaHalos.forEach((h) => { h.material.opacity = 0.56 })
    toriiLight.intensity = 4.2
    ctx.discoverEncounter('torii')
    return { label: '千本鸟居与石灯笼参道次第点亮 · 暖光照彻东山石阶', sfx: 'lamp' as const }
  }

  const ringTempleBell = () => {
    bellSwingTime = 0
    lanternsLit = true
    pondLanterns.forEach((l) => {
      l.mat.emissiveIntensity = 1.75
      l.halo.material.opacity = 0.88
    })
    ctx.triggerRipple(0, -7.6)
    pond.setBio(0.55)
    soundRings.forEach((r) => { r.mesh.visible = true })
    ctx.discoverEncounter('bell')
    return { label: '敲响古寺青铜梵钟 · 金色声波荡开池畔纸灯', sfx: 'horn' as const }
  }

  ctx.registerInteractive(toriiGroup, {
    encounterId: 'torii',
    focusPoint: new THREE.Vector3(-19, 3.8, -28),
    onClick: igniteToriiAndLanterns,
  })
  ctx.registerInteractive(lanternsGroup, {
    encounterId: 'torii',
    focusPoint: new THREE.Vector3(-2.4, 2.2, -22.2),
    onClick: igniteToriiAndLanterns,
  })
  ctx.registerInteractive(bellPavilion, {
    encounterId: 'bell',
    focusPoint: new THREE.Vector3(-14.5, 4.2, -28.5),
    onClick: ringTempleBell,
  })

  ctx.setFinaleTrigger(() => {
    sakuraGust = 3.6
    bellSwingTime = 0
    lanternsLit = true
    finaleTimer = 0
    skyLanternGrp.visible = true
    igniteToriiAndLanterns()
    pondLanterns.forEach((l) => {
      l.mat.emissiveIntensity = 1.9
      l.halo.material.opacity = 0.92
    })
    pond.setBio(0.85)
  })

  ctx.setVantageAnchor?.({
    label: '五重古塔回廊 · 俯瞰镜池拱桥',
    pos: [12.5, FAR_TERRACE_Y + 4.8, -27.5],
    yaw: -0.22,
    pitch: -0.1,
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 1.75 && z >= BRIDGE_END_Z && z <= BRIDGE_START_Z) {
      const u = THREE.MathUtils.clamp((BRIDGE_START_Z - z) / (BRIDGE_START_Z - BRIDGE_END_Z), 0, 1)
      return getDeckY(u)
    }
    const stairH = getPathHeight(x, z)
    if (stairH !== null) return stairH
    if (Math.abs(x) <= 27 && z >= BRIDGE_START_Z && z <= 23.2) return NEAR_PROMENADE_Y
    if (x >= -21 && x <= 25 && z >= -49.4 && z <= BRIDGE_END_Z) return FAR_TERRACE_Y
    return null
  })

  const tickBirds = createGlidingBirds(g, [4, 22, -32], 24, 4)

  ctx.addTick((t, dt) => {
    tickBirds(t)
    sakuraGust = Math.max(0, sakuraGust - dt * 0.6)
    cherryCanopies.forEach((c) => {
      c.grp.rotation.z = Math.sin(t * 1.3 + c.phase) * (0.025 + sakuraGust * 0.045)
      c.grp.rotation.x = Math.cos(t * 1.1 + c.phase) * (0.02 + sakuraGust * 0.03)
    })
    chimes.forEach((ch, idx) => {
      ch.rotation.z = Math.sin(t * 2.3 + idx * 1.2) * (0.09 + sakuraGust * 0.05)
      ch.rotation.x = Math.cos(t * 1.8 + idx) * 0.05
    })

    koiFish.forEach((koi, idx) => {
      const a = t * (0.42 + idx * 0.08) + idx * 2.1
      const kx = Math.sin(a) * 8.5 + (idx - 1) * 4.2
      const kz = -7.6 + Math.sin(a * 1.8) * 6.5
      const dx = Math.cos(a) * 8.5
      const dz = Math.cos(a * 1.8) * 11.7
      koi.position.set(kx, WATER_Y - 0.14, kz)
      koi.rotation.y = Math.atan2(-dz, dx)
    })

    pondLanterns.forEach((l) => {
      const drift = lanternsLit ? 1.1 : 0.45
      l.grp.position.set(
        l.ox + Math.sin(t * 0.35 + l.phase) * drift,
        WATER_Y + 0.04 + Math.sin(t * 1.9 + l.phase) * 0.035,
        l.oz + Math.cos(t * 0.3 + l.phase) * drift * 0.7,
      )
    })

    const pAttr = petalGeo.attributes.position as THREE.BufferAttribute
    const windX = 0.8 + sakuraGust * 1.6
    const fallBoost = 1 + sakuraGust * 0.55
    for (let i = 0; i < petalCount; i += 1) {
      let y = pAttr.getY(i) - dt * petalSpeed[i] * fallBoost
      let x = pAttr.getX(i) + dt * (windX + Math.sin(t * 1.8 + i * 0.7) * 1.1)
      let z = pAttr.getZ(i) + Math.cos(t * 1.4 + i * 0.5) * dt * (0.7 + sakuraGust * 0.9)
      if (y < WATER_Y + 0.1) y = 18.5
      if (x > 42) x = -42
      if (z > 18) z = -48
      if (z < -48) z = 18
      pAttr.setXYZ(i, x, y, z)
    }
    pAttr.needsUpdate = true

    if (bellSwingTime >= 0) {
      bellSwingTime += dt
      const dur = 3.4
      if (bellSwingTime >= dur) {
        bellSwingTime = -1
        bellSwingPivot.rotation.z = 0
        striker.position.x = 1.55
        soundRings.forEach((r) => { r.mesh.visible = false })
      } else {
        const decay = Math.exp(-bellSwingTime * 1.25)
        bellSwingPivot.rotation.z = Math.sin(bellSwingTime * 6.8) * 0.24 * decay
        striker.position.x = 1.55 - Math.sin(Math.min(Math.PI, bellSwingTime * 8.5)) * 0.55 * decay
        soundRings.forEach((r) => {
          const local = (bellSwingTime - r.delay) / 2.2
          if (local > 0 && local < 1) {
            r.mesh.visible = true
            r.mesh.scale.setScalar(0.8 + local * 8.5)
            r.mat.opacity = (1 - local) * 0.78
          } else {
            r.mesh.visible = false
          }
        })
      }
    }

    if (finaleTimer >= 0) {
      finaleTimer += dt
      const dur = 8.5
      if (finaleTimer >= dur) {
        finaleTimer = -1
        skyLanternGrp.visible = false
      } else {
        const prog = Math.min(1, finaleTimer / dur)
        skyLanterns.forEach((l) => {
          l.mesh.position.set(
            l.ox + Math.sin(t * 0.9 + l.offset) * 1.4,
            2.2 + prog * 22 + (l.offset % 1) * 2.2,
            l.oz + Math.cos(t * 0.8 + l.offset) * 1.1,
          )
        })
      }
    }
  })

  ctx.addMoodHook((mood) => {
    palette.shoji.emissiveIntensity = mood === 'dawn' ? 0.38 : mood === 'night' ? 1.35 : 0.85
  })

  enableShadows(g, true, true)
  pond.mesh.castShadow = false
  sakuraPetals.castShadow = false
  openGround.castShadow = false
  nearDeck.castShadow = false
  farTerrace.castShadow = false
}

export const buildKyoto = buildKyotoCity
