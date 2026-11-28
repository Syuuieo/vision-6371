import * as THREE from 'three'
import { buildSceneWater, createMat, enableShadows, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import {
  createCityPbrMaterials,
  createGlidingBirds,
} from './cityKit'
import { createShoreReedClump } from './daliAssets'
import {
  createDatePalm,
  createEgyptianObelisk,
  createGizaPalette,
  createGreatSphinx,
  createLotusPillar,
  createSteppedPyramid,
} from './gizaAssets'
import { createParisianBench } from './parisAssets'

/**
 * 吉萨 · 金字塔与狮身人面像（1:1 原生米制撒哈拉日落精修）：
 * - 站在砂岩谷庙高台与莲花柱廊前，眼前展开双座玫瑰花岗岩方尖碑与皇家砂岩参道；
 * - 左侧谷庙圣水倒影池（Reflector）被尼罗河椰枣树与纸莎草环抱，池面直接映出落日与金字塔；
 * - 右前方以四分之三经典侧正面展现蹲伏的「狮身人面像」、伸展前爪间的梦想石碑与荷鲁斯圣火；
 * - 远处三座斜棱分明、带石灰岩砌石肌理与哈夫拉白石灰岩顶套的吉萨大金字塔群与撒哈拉流沙丘脊巍然耸立。
 */
export function buildGizaCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'giza-pyramids-sphinx-scene'

  const TERRACE_Y = 0.55
  const CAUSEWAY_Y = 0.38
  const WATER_Y = 0.12
  const POOL_X = -15.5
  const POOL_Z = -6.5

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createGizaPalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 1:1 撒哈拉起伏沙海 + 谷庙高台、缓降石阶与皇家参道
  // -------------------------------------------------------------------------
  const desertSandMat = createMat('#cfa46a', {
    roughness: 0.94,
    bumpMap: ctx.textures.plasterBump,
    bumpScale: 0.04,
  })
  const causewayMat = applyPbrSet(
    createMat('#c69b64', { roughness: 0.88, bumpMap: ctx.textures.darkStoneTex, bumpScale: 0.045 }),
    'cobble',
    18,
    12,
  )

  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), desertSandMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -0.02, -45)
  openGround.receiveShadow = true
  g.add(openGround)

  // Wind-carved Sahara sand dunes surrounding the plateau margins (horizon-mountains, variant = 'giza')
  const dunes = new THREE.Group()
  dunes.name = 'horizon-mountains'
  dunes.userData.horizonVariant = 'giza'
  const duneGeo = new THREE.PlaneGeometry(380, 320, 108, 90)
  duneGeo.rotateX(-Math.PI / 2)
  const dPos = duneGeo.attributes.position
  const dCol = new Float32Array(dPos.count * 3)
  const sandLow = new THREE.Color('#c39459')
  const sandCrest = new THREE.Color('#e8c389')
  const cTmp = new THREE.Color()

  for (let i = 0; i < dPos.count; i += 1) {
    const wx = dPos.getX(i)
    const wz = dPos.getZ(i) - 60
    const zoneMask = Math.min(1, Math.max(0, (Math.hypot(wx * 0.7, (wz + 42) * 0.65) - 64) / 36))
    const edgeFade = Math.max(0, 1 - Math.pow(Math.hypot(wx, wz + 60) / 168, 3))
    const waveA = Math.sin(wx * 0.032 + wz * 0.024) * 7.2 + Math.cos(wx * 0.019 - wz * 0.038) * 5.8
    const waveB = Math.abs(Math.sin(wx * 0.062 - 0.7)) * 4.8
    const leftViewDune = Math.exp(-Math.pow((wx + 54) / 28, 2) - Math.pow((wz + 26) / 36, 2)) * 12.5
    const h = Math.max(0, (waveA + waveB + 4.8) * zoneMask * edgeFade + leftViewDune * edgeFade) - (1 - edgeFade) * 0.6
    dPos.setY(i, h)
    cTmp.copy(sandLow).lerp(sandCrest, Math.min(1, Math.max(0, h / 16)))
    dCol[i * 3] = cTmp.r
    dCol[i * 3 + 1] = cTmp.g
    dCol[i * 3 + 2] = cTmp.b
  }
  duneGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3))
  duneGeo.computeVertexNormals()
  const duneMesh = new THREE.Mesh(
    duneGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, flatShading: true }),
  )
  duneMesh.position.set(0, -0.1, -60)
  dunes.add(duneMesh)
  g.add(dunes)

  // Valley Temple Upper Overlook Terrace (z: 8..22)
  const valleyTerrace = new THREE.Mesh(new THREE.BoxGeometry(56, TERRACE_Y + 0.2, 14), causewayMat)
  valleyTerrace.name = 'giza-valley-temple-terrace'
  valleyTerrace.userData.foregroundDeck = true
  valleyTerrace.position.set(0, (TERRACE_Y - 0.2) * 0.5, 15)
  valleyTerrace.receiveShadow = true
  g.add(valleyTerrace)

  // Monumental broad sandstone curb step descending from terrace (z = 8) to causeway (z = 6.5)
  const terraceStep = new THREE.Mesh(new THREE.BoxGeometry(10.8, CAUSEWAY_Y + 0.25, 2.2), causewayMat)
  terraceStep.position.set(0, (CAUSEWAY_Y - 0.15) * 0.5, 7.0)
  terraceStep.receiveShadow = true
  g.add(terraceStep)

  // Royal limestone Causeway leading north toward Great Pyramid of Khufu
  const causeway = new THREE.Mesh(new THREE.BoxGeometry(9.2, CAUSEWAY_Y + 0.2, 54), causewayMat)
  causeway.position.set(0, (CAUSEWAY_Y - 0.2) * 0.5, -23)
  causeway.receiveShadow = true
  g.add(causeway)

  // Low bevelled sandstone terrace edge & spaced lotus-capital columns (keeps sacred pool view wide open)
  for (const px of [-20.0, 20.0]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.22, 0.65), palette.sandstone)
    curb.position.set(px, TERRACE_Y + 0.11, 8.35)
    g.add(curb)
  }
  const lotusCoords: [number, number][] = [
    [-25.5, 8.35], [-7.2, 8.35],
    [7.2, 8.35], [25.5, 8.35],
  ]
  for (const [cx, cz] of lotusCoords) {
    const isOuter = Math.abs(cx) > 12
    const pillar = createLotusPillar(palette, isOuter ? 3.2 : 1.75)
    pillar.position.set(cx, TERRACE_Y, cz)
    g.add(pillar)

    if (!isOuter) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.36, 10), palette.lapis)
      bowl.position.set(cx, TERRACE_Y + 1.92, cz)
      const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), palette.ember)
      flame.position.set(cx, TERRACE_Y + 2.22, cz)
      g.add(bowl, flame)
    }
  }

  const bench = createParisianBench()
  bench.position.set(5.4, TERRACE_Y, 12.2)
  bench.rotation.y = Math.PI
  g.add(bench)

  // Twin Aswan Granite Obelisks framing the mid-ground causeway portal (no longer blocking foreground camera)
  const obeliskHalos: THREE.Sprite[] = []
  for (const ox of [-9.4, 9.4]) {
    const { obelisk, halo } = createEgyptianObelisk(palette, ctx.textures.glowHalo, 10.6)
    obelisk.position.set(ox, CAUSEWAY_Y, -3.5)
    g.add(obelisk)
    obeliskHalos.push(halo)
  }

  // -------------------------------------------------------------------------
  // 2. 谷庙神圣镜面倒影池（Reflector）+ 尼罗河椰枣树 & 纸莎草丛
  // -------------------------------------------------------------------------
  const poolW = 21
  const poolD = 13
  for (const rz of [POOL_Z - poolD * 0.5, POOL_Z + poolD * 0.5]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(poolW + 1.2, 0.24, 0.65), palette.sandstone)
    rim.position.set(POOL_X, WATER_Y + 0.04, rz)
    g.add(rim)
  }
  for (const rx of [POOL_X - poolW * 0.5, POOL_X + poolW * 0.5]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, poolD + 0.65), palette.sandstone)
    rim.position.set(rx, WATER_Y + 0.04, POOL_Z)
    g.add(rim)
  }

  const sacredPool = buildSceneWater(ctx, {
    width: poolW,
    depth: poolD,
    x: POOL_X,
    y: WATER_Y,
    z: POOL_Z,
    deepHex: '#183748',
    shallowHex: '#4f7c8a',
    fadeRadius: 68,
    reflective: true,
  })
  sacredPool.mesh.name = 'giza-sacred-pool'
  ctx.bindWater(
    (x, z) => sacredPool.setRipple(x, z),
    (bio) => sacredPool.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      sacredPool.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) sacredPool.uniforms.uSunCol.value.set(sunHex)
      if (sunDir) sacredPool.uniforms.uSunDir.value.set(...sunDir).normalize()
    },
  )

  for (const [rx, rz] of [[-24.2, -11.4], [-7.5, -11.2], [-24.2, -1.6], [-7.2, -1.6]] as [number, number][]) {
    const papyrus = createShoreReedClump()
    papyrus.scale.setScalar(1.25)
    papyrus.position.set(rx, WATER_Y + 0.06, rz)
    g.add(papyrus)
  }

  // Date palms flanking the far/left bank of the Valley Temple oasis
  const palmSpecs: [number, number, number, number][] = [
    [-28.5, -13.5, 8.2, 0.16],
    [-27.0, -2.5, 6.8, -0.14],
    [-19.5, -15.5, 7.5, 0.1],
    [29.5, -12.0, 7.6, -0.12],
  ]
  for (const [px, pz, ph, lean] of palmSpecs) {
    const palm = createDatePalm(palette, ph, lean)
    palm.position.set(px, 0, pz)
    g.add(palm)
  }

  // -------------------------------------------------------------------------
  // 3. 三座斜棱分明大金字塔 + 四分之三侧视狮身人面像 + 猎户三星
  // -------------------------------------------------------------------------
  const pyramidsGroup = new THREE.Group()
  pyramidsGroup.name = 'giza-three-pyramids'

  const { pyramid: khufu, halo: khufuHalo } = createSteppedPyramid(palette, ctx.textures.glowHalo, 58, 42, false)
  khufu.position.set(-14, 0, -78)
  khufu.rotation.y = 0.26

  const { pyramid: khafre, halo: khafreHalo } = createSteppedPyramid(palette, ctx.textures.glowHalo, 52, 39, true)
  khafre.position.set(30, 0, -106)
  khafre.rotation.y = 0.26

  const { pyramid: menkaure, halo: menkaureHalo } = createSteppedPyramid(palette, ctx.textures.glowHalo, 34, 24, false)
  menkaure.position.set(-56, 0, -112)
  menkaure.rotation.y = 0.26

  pyramidsGroup.add(khufu, khafre, menkaure)

  // Two Queen's small companion pyramids on the far left of Khufu
  for (const [qx, qz] of [[-50, -68], [-58, -82]] as [number, number][]) {
    const { pyramid: queenP } = createSteppedPyramid(palette, ctx.textures.glowHalo, 14, 10, false)
    queenP.position.set(qx, 0, qz)
    queenP.rotation.y = 0.26
    pyramidsGroup.add(queenP)
  }
  g.add(pyramidsGroup)

  const { sphinx, fire: sphinxFire, fireHalo: sphinxHalo } = createGreatSphinx(
    palette,
    ctx.textures.glowHalo,
  )
  // Angled in heroic 3/4 view so crouching lion body, haunches, tail, outstretched paws & face are all readable
  sphinx.position.set(17.8, CAUSEWAY_Y - 0.15, -18.5)
  sphinx.rotation.y = -0.82
  g.add(sphinx)

  // Three Orion's Belt alignment stars above the three pyramid apexes (dim at dusk, emerge in night sky)
  const orionStars: THREE.Sprite[] = []
  for (const [sx, sy, sz] of [
    [-14, 52, -78],
    [30, 49, -106],
    [-56, 33, -112],
  ] as [number, number, number][]) {
    const star = makeGlowSprite(ctx.textures.glowHalo, '#fff0c8', 8.5, 0.04)
    star.position.set(sx, sy, sz)
    g.add(star)
    orionStars.push(star)
  }

  // Sunlit Sahara golden sand-grain dust motes
  const dustCount = 130
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i += 1) {
    const a = i * 2.399963
    const r = 6 + ((i * 19) % 58)
    dustPos[i * 3] = Math.cos(a) * r
    dustPos[i * 3 + 1] = 1.0 + ((i * 13) % 16) * 1.1
    dustPos[i * 3 + 2] = -32 + Math.sin(a) * r * 0.85
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const desertDust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: '#ffe2aa',
      size: 0.3,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  )
  g.add(desertDust)

  // -------------------------------------------------------------------------
  // 4. 三重奇遇（pyramid / sphinx / pool）、撒哈拉高沙丘观景台与神道连续步行高程
  // -------------------------------------------------------------------------
  let fireBoost = 0

  const awakenPyramids = () => {
    palette.gold.emissiveIntensity = 1.15
    khufuHalo.material.opacity = 0.58
    khafreHalo.material.opacity = 0.58
    menkaureHalo.material.opacity = 0.52
    orionStars.forEach((s) => { s.material.opacity = 0.82 })
    ctx.discoverEncounter('pyramid')
    return { label: '三大金字塔黄金顶石与猎户座三星齐亮 · 撒哈拉黄昏流金', sfx: 'star' as const }
  }

  const awakenSphinx = () => {
    fireBoost = 1.3
    palette.ember.emissiveIntensity = 2.0
    palette.runeGlow.emissiveIntensity = 1.35
    sphinxHalo.material.opacity = 0.78
    obeliskHalos.forEach((h) => { h.material.opacity = 0.55 })
    ctx.discoverEncounter('sphinx')
    return { label: '狮身人面像胸前圣坛燃起荷鲁斯圣火 · 方尖碑金铭苏醒', sfx: 'lamp' as const }
  }

  const touchSacredPool = () => {
    ctx.triggerRipple(POOL_X, POOL_Z)
    sacredPool.setBio(0.68)
    ctx.discoverEncounter('pool')
    return { label: '轻触谷庙圣水倒影池 · 金字塔尖顶随流沙金波荡漾', sfx: 'ripple' as const }
  }

  ctx.registerInteractive(pyramidsGroup, {
    encounterId: 'pyramid',
    focusPoint: new THREE.Vector3(-14, 24, -78),
    onClick: awakenPyramids,
  })
  ctx.registerInteractive(sphinx, {
    encounterId: 'sphinx',
    focusPoint: new THREE.Vector3(17.8, 5.5, -18.5),
    onClick: awakenSphinx,
  })
  ctx.registerInteractive(sacredPool.mesh, {
    encounterId: 'pool',
    focusPoint: new THREE.Vector3(POOL_X, WATER_Y + 0.5, POOL_Z),
    onClick: touchSacredPool,
  })

  ctx.setFinaleTrigger(() => {
    awakenPyramids()
    awakenSphinx()
    touchSacredPool()
    sacredPool.setBio(0.95)
  })

  ctx.setVantageAnchor?.({
    label: '撒哈拉高沙丘 · 俯瞰狮身人面像与三塔',
    pos: [-46, 15.5, -22],
    yaw: -0.95,
    pitch: -0.1,
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 28 && z >= 8 && z <= 22) return TERRACE_Y
    if (Math.abs(x) <= 5.4 && z >= 3.5 && z < 8) {
      const t = (8 - z) / 4.5
      return THREE.MathUtils.lerp(TERRACE_Y, CAUSEWAY_Y, t)
    }
    if (Math.abs(x) <= 5.2 && z >= -48 && z < 3.5) return CAUSEWAY_Y
    if (x >= 4 && x <= 28 && z >= -34 && z <= -6) return CAUSEWAY_Y
    return null
  })

  const tickBirds = createGlidingBirds(g, [4, 34, -52], 32, 4)

  ctx.addTick((t, dt) => {
    tickBirds(t)
    fireBoost = Math.max(0, fireBoost - dt * 0.4)
    sphinxFire.scale.setScalar(1 + Math.sin(t * 7.4) * 0.14 + fireBoost * 0.16)
    desertDust.position.x = Math.sin(t * 0.08) * 3.8
    orionStars.forEach((s, idx) => {
      s.scale.setScalar(8.5 + Math.sin(t * 2.1 + idx) * 1.2)
    })
  })

  ctx.addMoodHook((mood) => {
    const isNight = mood === 'night'
    palette.runeGlow.emissiveIntensity = isNight ? 1.15 : mood === 'dusk' ? 0.22 : 0.12
    orionStars.forEach((s) => {
      s.material.opacity = isNight ? Math.max(s.material.opacity, 0.72) : Math.min(s.material.opacity, 0.12)
    })
  })

  enableShadows(g, true, true)
  sacredPool.mesh.castShadow = false
  openGround.castShadow = false
  duneMesh.castShadow = false
  valleyTerrace.castShadow = false
  causeway.castShadow = false
  desertDust.castShadow = false
}

export const buildGiza = buildGizaCity
