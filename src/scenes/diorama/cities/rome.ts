import * as THREE from 'three'
import { buildSceneWater, createMat, enableShadows } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import {
  buildContinuousRailing,
  buildStreetLampRow,
  createCityPbrMaterials,
  createGlidingBirds,
  type CityRailSegment,
} from './cityKit'
import { createParisianBench } from './parisAssets'
import {
  createArchOfConstantine,
  createColosseum,
  createMetaSudansFountain,
  createRomanCypress,
  createRomanUmbrellaPine,
  createRomePalette,
} from './romeAssets'

/**
 * 罗马 · 斗兽场夕照（1:1 原生米制建筑重造）：
 * - 站在「神圣大道广场」前景石板路（含墨达苏丹斯古泉与 24×15 m 大理石倒影池 + 伞松林 + 右侧君士坦丁凯旋门）；
 * - 正对 92×74 m 四层真拱券罗马斗兽场，标志性北高南低残缺外墙斜切面展露阶梯看台与中央沙地核心；
 * - 第一人称可经正门拱道直接步入斗兽场沙地中央，或登上二层残壁观景台俯瞰罗马假日金色夕照。
 */
export function buildRomeCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'rome-colosseum-sunset-scene'

  const PROMENADE_Y = 0.65
  const WATER_Y = 0.05
  const COLOSSEUM_X = 0
  const COLOSSEUM_Z = -54
  const ARCH_X = 24.5
  const ARCH_Z = -10
  const FOUNTAIN_X = -14.5
  const FOUNTAIN_Z = -4

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createRomePalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 1:1 连续地中海草丘大地 + 神圣大道（Via Sacra）洞石广场前景
  // -------------------------------------------------------------------------
  const parkGrassMat = applyPbrSet(
    createMat('#4a5c39', { roughness: 0.94, bumpMap: ctx.textures.plasterBump, bumpScale: 0.04 }),
    'grass',
    28,
    28,
  )
  const piazzaCobbleMat = applyPbrSet(
    createMat('#9c9180', { roughness: 0.86, bumpMap: ctx.textures.darkStoneTex, bumpScale: 0.04 }),
    'cobble',
    22,
    18,
  )

  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), parkGrassMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -0.02, -40)
  openGround.receiveShadow = true
  g.add(openGround)

  // Gently sculpted Palatine & Oppian parklands smoothly tapering into openGround
  const sampleHillY = (wx: number, wz: number) => {
    const plazaExclusion = Math.min(1, Math.max(0, (Math.hypot(wx * 0.72, (wz + 18) * 0.68) - 42) / 28))
    const leftMound = Math.exp(-Math.pow((wx + 58) / 36, 2) - Math.pow((wz + 32) / 48, 2)) * 9.5
    const backRidge = Math.exp(-Math.pow((wz + 115) / 34, 2)) * (6.2 + Math.sin(wx * 0.04) * 2.5)
    const rightHill = Math.exp(-Math.pow((wx - 74) / 38, 2) - Math.pow((wz + 42) / 48, 2)) * 8.2
    const edgeFade = Math.max(0, 1 - Math.pow(Math.hypot(wx, wz + 55) / 145, 3))
    return (leftMound + backRidge + rightHill) * plazaExclusion * edgeFade - (1 - edgeFade) * 0.45
  }
  const parkHillGeo = new THREE.PlaneGeometry(290, 260, 72, 64)
  parkHillGeo.rotateX(-Math.PI / 2)
  const pPos = parkHillGeo.attributes.position
  for (let i = 0; i < pPos.count; i += 1) {
    const wx = pPos.getX(i)
    const wz = pPos.getZ(i) - 55
    pPos.setY(i, sampleHillY(wx, wz))
  }
  parkHillGeo.computeVertexNormals()
  const parkHill = new THREE.Mesh(parkHillGeo, parkGrassMat)
  parkHill.position.set(0, 0, -55)
  parkHill.receiveShadow = true
  g.add(parkHill)

  // Sacred Stone Promenade (Via Sacra foreground plaza + approach apron into Colosseum)
  const piazzaFloor = new THREE.Mesh(new THREE.BoxGeometry(82, 1.35, 34), piazzaCobbleMat)
  piazzaFloor.name = 'rome-via-sacra-plaza'
  piazzaFloor.userData.foregroundDeck = true
  piazzaFloor.position.set(2, PROMENADE_Y - 0.675, 4)
  piazzaFloor.receiveShadow = true
  g.add(piazzaFloor)

  const approachApron = new THREE.Mesh(new THREE.BoxGeometry(34, 1.35, 22), piazzaCobbleMat)
  approachApron.position.set(0, PROMENADE_Y - 0.675, -20)
  approachApron.receiveShadow = true
  g.add(approachApron)

  // Low dressed marble border curbs framing the Sacred Plaza foreground
  const plazaRails: CityRailSegment[] = [
    { from: [-38, PROMENADE_Y, 16.5], to: [42, PROMENADE_Y, 16.5] },
    { from: [-38, PROMENADE_Y, -12.5], to: [-27, PROMENADE_Y, -12.5] },
  ]
  buildContinuousRailing(g, plazaRails, 'stone')

  buildStreetLampRow(
    g,
    ctx.textures,
    [
      [-26, PROMENADE_Y, 12.2],
      [-6, PROMENADE_Y, 12.2],
      [10, PROMENADE_Y, 12.2],
      [26, PROMENADE_Y, 12.2],
      [16, PROMENADE_Y, -6.5],
      [-10, PROMENADE_Y, -16.5],
    ],
    'paris',
  )

  for (const [bx, rotY] of [[-4, Math.PI], [12, Math.PI], [-22, Math.PI * 0.8]] as [number, number][]) {
    const bench = createParisianBench()
    bench.position.set(bx, PROMENADE_Y, 13.8)
    bench.rotation.y = rotY
    g.add(bench)
  }

  // -------------------------------------------------------------------------
  // 2. 墨达苏丹斯锥形古泉（Meta Sudans）+ 大理石镜面倒影水池（Reflector）
  // -------------------------------------------------------------------------
  const poolWidth = 24
  const poolDepth = 14
  const poolRimMat = palette.marble
  const northRim = new THREE.Mesh(new THREE.BoxGeometry(poolWidth + 1.4, 0.9, 0.7), poolRimMat)
  northRim.position.set(FOUNTAIN_X, WATER_Y + 0.3, FOUNTAIN_Z - poolDepth * 0.5)
  const southRim = new THREE.Mesh(new THREE.BoxGeometry(poolWidth + 1.4, 0.9, 0.7), poolRimMat)
  southRim.position.set(FOUNTAIN_X, WATER_Y + 0.3, FOUNTAIN_Z + poolDepth * 0.5)
  const westRim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, poolDepth + 0.7), poolRimMat)
  westRim.position.set(FOUNTAIN_X - poolWidth * 0.5, WATER_Y + 0.3, FOUNTAIN_Z)
  const eastRim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, poolDepth + 0.7), poolRimMat)
  eastRim.position.set(FOUNTAIN_X + poolWidth * 0.5, WATER_Y + 0.3, FOUNTAIN_Z)
  g.add(northRim, southRim, westRim, eastRim)

  const poolWater = buildSceneWater(ctx, {
    width: poolWidth,
    depth: poolDepth,
    x: FOUNTAIN_X,
    y: WATER_Y,
    z: FOUNTAIN_Z,
    deepHex: '#1c3e4e',
    shallowHex: '#4f7f8c',
    fadeRadius: 60,
    reflective: true,
  })
  poolWater.mesh.name = 'rome-reflecting-pool'
  ctx.bindWater(
    (x, z) => poolWater.setRipple(x, z),
    (bio) => poolWater.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      poolWater.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) poolWater.uniforms.uSunCol.value.set(sunHex)
      if (sunDir) poolWater.uniforms.uSunDir.value.set(...sunDir).normalize()
    },
  )

  const { fountain, orb: fountainOrb, halo: fountainHalo } = createMetaSudansFountain(
    palette,
    ctx.textures.glowHalo,
  )
  fountain.position.set(FOUNTAIN_X, WATER_Y, FOUNTAIN_Z)
  g.add(fountain)

  const sprayCount = 48
  const sprayPos = new Float32Array(sprayCount * 3)
  for (let i = 0; i < sprayCount; i += 1) {
    const a = (i / sprayCount) * Math.PI * 2
    const r = 1.1 + (i % 6) * 0.45
    sprayPos[i * 3] = FOUNTAIN_X + Math.cos(a) * r
    sprayPos[i * 3 + 1] = WATER_Y + 0.8 + ((i * 7) % 10) * 0.5
    sprayPos[i * 3 + 2] = FOUNTAIN_Z + Math.sin(a) * r
  }
  const sprayGeo = new THREE.BufferGeometry()
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3))
  const fountainSpray = new THREE.Points(
    sprayGeo,
    new THREE.PointsMaterial({
      color: '#ffe8bf',
      size: 0.24,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  )
  g.add(fountainSpray)

  // -------------------------------------------------------------------------
  // 3. 核心地标：1:1 罗马斗兽场 & 君士坦丁凯旋门
  // -------------------------------------------------------------------------
  const { colosseum, bayGlowHalos, outerRx, outerRz, innerRx, innerRz } = createColosseum(
    palette,
    ctx.textures.glowHalo,
  )
  colosseum.position.set(COLOSSEUM_X, PROMENADE_Y - 0.15, COLOSSEUM_Z)
  g.add(colosseum)

  const { arch: constantineArch, halos: archHalos } = createArchOfConstantine(
    palette,
    ctx.textures.glowHalo,
  )
  constantineArch.position.set(ARCH_X, PROMENADE_Y, ARCH_Z)
  constantineArch.rotation.y = -0.42
  g.add(constantineArch)

  // -------------------------------------------------------------------------
  // 4. 罗马伞松与地中海丝柏林荫 + 远景古罗马高架输水道天际线
  // -------------------------------------------------------------------------
  const pineCoords: [number, number, number, number][] = [
    [-32, 14.5, 1.05, 101],
    [-35, -8, 1.12, 202],
    [35, 13.5, 1.08, 303],
    [39, -18, 1.15, 404],
    [-48, -28, 1.25, 505],
    [48, -32, 1.2, 606],
    [-54, -56, 1.28, 707],
    [52, -62, 1.22, 808],
    [-36, -86, 1.3, 909],
    [34, -88, 1.26, 1010],
  ]
  for (const [px, pz, sc, seed] of pineCoords) {
    const pine = createRomanUmbrellaPine(seed, sc)
    const py = Math.max(pz > -28 ? PROMENADE_Y : 0, sampleHillY(px, pz))
    pine.position.set(px, py - 0.1, pz)
    g.add(pine)
  }

  const cypressCoords: [number, number, number][] = [
    [-29, 2.5, 10.5],
    [36, 4.0, 11.4],
    [37, -6.0, 12.2],
    [-42, -16, 11.8],
    [-56, -42, 13.2],
    [56, -46, 12.8],
    [-20, -96, 13.6],
    [24, -98, 13.0],
    [0, -104, 14.2],
  ]
  cypressCoords.forEach(([cx, cz, ch], idx) => {
    const cyp = createRomanCypress(ch, idx)
    const cy = Math.max(cz > -24 ? PROMENADE_Y : 0, sampleHillY(cx, cz))
    cyp.position.set(cx, cy - 0.1, cz)
    g.add(cyp)
  })

  // Distant Roman Aqueduct Arches & Aventine ridge horizon (horizon-skyline, variant = 'rome')
  const skyline = new THREE.Group()
  skyline.name = 'horizon-skyline'
  skyline.userData.horizonVariant = 'rome'
  const aqueductMat = createMat('#9e8971', { roughness: 0.9 })
  for (let i = -5; i <= 5; i += 1) {
    const ax = 68 + i * 7.5
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 14.5, 2.4), aqueductMat)
    pier.position.set(ax, 6.2, -138 + Math.abs(i) * 2.5)
    skyline.add(pier)
    if (i < 5) {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.4, 2.4), aqueductMat)
      lintel.position.set(ax + 3.75, 12.6, -138 + Math.abs(i + 0.5) * 2.5)
      skyline.add(lintel)
    }
  }
  for (const [tx, tz, sc, seed] of [
    [-82, -125, 1.5, 11],
    [-64, -135, 1.4, 22],
    [-46, -130, 1.55, 33],
    [48, -132, 1.45, 44],
    [82, -128, 1.5, 55],
  ] as [number, number, number, number][]) {
    const farPine = createRomanUmbrellaPine(seed, sc)
    farPine.position.set(tx, 1.5, tz)
    skyline.add(farPine)
  }
  g.add(skyline)

  // Floating golden Roman sunset motes over plaza & arena
  const dustCount = 110
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i += 1) {
    const a = i * 2.399963
    const r = 6 + ((i * 17) % 48)
    dustPos[i * 3] = Math.cos(a) * r
    dustPos[i * 3 + 1] = 1.4 + ((i * 13) % 16) * 1.1
    dustPos[i * 3 + 2] = -28 + Math.sin(a) * r * 0.85
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const goldenDust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: '#ffe0a8',
      size: 0.34,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
  )
  g.add(goldenDust)

  // -------------------------------------------------------------------------
  // 5. 三重探索奇遇（arches / arch / fountain）、终局黄金星火与高台观景
  // -------------------------------------------------------------------------
  let fountainBoost = 0

  const igniteColosseum = () => {
    palette.archGlow.emissiveIntensity = 1.65
    bayGlowHalos.forEach((h) => { h.material.opacity = 0.68 })
    ctx.discoverEncounter('arches')
    return { label: '罗马斗兽场四十八座拱洞次第亮起 · 古石壁流淌夕照金光', sfx: 'lamp' as const }
  }

  const igniteConstantineArch = () => {
    palette.torchGlow.emissiveIntensity = 1.75
    archHalos.forEach((h) => { h.material.opacity = 0.82 })
    ctx.discoverEncounter('arch')
    return { label: '君士坦丁凯旋门火炬灯柱燃起 · 映亮神圣大道古石板', sfx: 'lamp' as const }
  }

  const awakenFountain = () => {
    fountainBoost = 1.2
    ctx.triggerRipple(FOUNTAIN_X, FOUNTAIN_Z)
    poolWater.setBio(0.65)
    fountainHalo.material.opacity = 0.78
    ctx.discoverEncounter('fountain')
    return { label: '轻触墨达苏丹斯古泉 · 斗兽场拱影在金澄水波中轻轻摇曳', sfx: 'ripple' as const }
  }

  ctx.registerInteractive(colosseum, {
    encounterId: 'arches',
    focusPoint: new THREE.Vector3(COLOSSEUM_X, 16, COLOSSEUM_Z + outerRz),
    onClick: igniteColosseum,
  })
  ctx.registerInteractive(constantineArch, {
    encounterId: 'arch',
    focusPoint: new THREE.Vector3(ARCH_X, 7.5, ARCH_Z),
    onClick: igniteConstantineArch,
  })
  ctx.registerInteractive(fountain, {
    encounterId: 'fountain',
    focusPoint: new THREE.Vector3(FOUNTAIN_X, 3.2, FOUNTAIN_Z),
    onClick: awakenFountain,
  })
  ctx.registerInteractive(poolWater.mesh, {
    encounterId: 'fountain',
    focusPoint: new THREE.Vector3(FOUNTAIN_X, 0.8, FOUNTAIN_Z),
    onClick: awakenFountain,
  })

  ctx.setFinaleTrigger(() => {
    igniteColosseum()
    igniteConstantineArch()
    awakenFountain()
    poolWater.setBio(0.95)
  })

  ctx.setVantageAnchor?.({
    label: '斗兽场二层残壁观景廊 · 俯瞰广场',
    pos: [-24, 14.5, -24],
    yaw: -2.42,
    pitch: -0.14,
  })

  // Walk across Sacred Stone Plaza OR straight inside the Colosseum Arena oval!
  ctx.setWalkHeightSampler?.((x, z) => {
    // Inside Arena sand floor & southern portal tunnel
    const relX = x - COLOSSEUM_X
    const relZ = z - COLOSSEUM_Z
    const innerDist = (relX * relX) / (innerRx * innerRx) + (relZ * relZ) / (innerRz * innerRz)
    if (innerDist <= 0.94) return PROMENADE_Y + 0.1
    const outerDist = (relX * relX) / (outerRx * outerRx) + (relZ * relZ) / (outerRz * outerRz)
    if (outerDist <= 1.02 && Math.abs(relX) <= 4.2 && relZ > 0) return PROMENADE_Y
    if (Math.abs(x) <= 17 && z >= -31 && z <= -9) return PROMENADE_Y
    if (x >= -39 && x <= 43 && z >= -13 && z <= 21) return PROMENADE_Y
    return null
  })

  const tickBirds = createGlidingBirds(g, [-4, 28, -32], 26, 4)

  ctx.addTick((t, dt) => {
    tickBirds(t)
    fountainBoost = Math.max(0, fountainBoost - dt * 0.45)
    fountainOrb.scale.setScalar(1 + Math.sin(t * 2.8) * 0.08 + fountainBoost * 0.16)
    goldenDust.position.x = Math.sin(t * 0.08) * 2.5

    const sAttr = sprayGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < sprayCount; i += 1) {
      let y = sAttr.getY(i) - dt * (1.8 + fountainBoost * 1.4)
      if (y < WATER_Y + 0.25) y = WATER_Y + 5.8 + (i % 3) * 0.4
      sAttr.setY(i, y)
    }
    sAttr.needsUpdate = true
  })

  ctx.addMoodHook((mood) => {
    const isNight = mood === 'night'
    palette.archGlow.emissiveIntensity = isNight ? 1.55 : mood === 'dusk' ? 0.85 : 0.42
    palette.torchGlow.emissiveIntensity = isNight ? 1.65 : mood === 'dusk' ? 0.92 : 0.48
  })

  enableShadows(g, true, true)
  poolWater.mesh.castShadow = false
  openGround.castShadow = false
  parkHill.castShadow = false
  piazzaFloor.castShadow = false
  approachApron.castShadow = false
  goldenDust.castShadow = false
  fountainSpray.castShadow = false
}

export const buildRome = buildRomeCity
