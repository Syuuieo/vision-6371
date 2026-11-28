import * as THREE from 'three'
import { buildSceneWater, createMat, enableShadows, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx, DioramaMood } from '../types'
import {
  buildContinuousRailing,
  buildStreetLampRow,
  createCityPbrMaterials,
  createGlidingBirds,
  type CityRailSegment,
} from './cityKit'
import {
  createChongshengThreePagodas,
  createErhaiPavilion,
  createOrnateBaiCourtyard,
  createShoreReedClump,
} from './daliAssets'
import { createBaiGatehouse } from './radicalAssets'

type Vec3 = [number, number, number]

const SHORE_Z = 7
const PROMENADE_TOP_Y = 0.65
const BOARDWALK_WIDTH = 4
const BOARDWALK_LENGTH = 32
const BOARDWALK_NEAR_Z = SHORE_Z
const BOARDWALK_FAR_Z = BOARDWALK_NEAR_Z - (BOARDWALK_LENGTH - 1)
const BOARDWALK_TOP_Y = 0.65
const PAVILION_X = 0
const PAVILION_Z = -28
const PAVILION_RADIUS = 6
const VANTAGE_EYE_HEIGHT = 1.65
const BOAT_X = -11
const BOAT_Z = -10
const WATER_WIDTH = 420
const WATER_DEPTH = 260
const WATER_CENTER_Z = SHORE_Z - WATER_DEPTH / 2
const WATER_Y = -1
const MOON_X = 12
const MOON_Y = 56
const MOON_Z = -225

function seededRandom(seedInit: number) {
  let seed = seedInit
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function addBox(
  parent: THREE.Object3D,
  size: Vec3,
  position: Vec3,
  material: THREE.Material,
  rotationY = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.rotation.y = rotationY
  parent.add(mesh)
  return mesh
}

function createWillow(
  height: number,
  trunkMaterial: THREE.Material,
  leafMaterial: THREE.Material,
  rng: () => number,
) {
  const willow = new THREE.Group()
  willow.name = 'weeping-willow'
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.32, height * 0.72, 9),
    trunkMaterial,
  )
  trunk.position.y = height * 0.36
  trunk.rotation.z = (rng() - 0.5) * 0.08
  willow.add(trunk)

  const crown = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), leafMaterial)
  crown.position.y = height * 0.72
  crown.scale.set(height * 0.3, height * 0.2, height * 0.28)
  willow.add(crown)

  for (let b = 0; b < 7; b += 1) {
    const angle = (b / 7) * Math.PI * 2 + rng() * 0.35
    const reach = height * (0.22 + rng() * 0.1)
    const start = new THREE.Vector3(Math.cos(angle) * height * 0.05, height * 0.7, Math.sin(angle) * height * 0.05)
    const middle = new THREE.Vector3(Math.cos(angle) * reach * 0.72, height * 0.72, Math.sin(angle) * reach * 0.72)
    const end = new THREE.Vector3(Math.cos(angle) * reach, height * 0.28, Math.sin(angle) * reach)
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end)
    const branch = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.05, 5, false), trunkMaterial)
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), leafMaterial)
    leaves.position.copy(end)
    leaves.scale.set(0.52, height * 0.17, 0.52)
    willow.add(branch, leaves)
  }
  return willow
}

function createBaiFishingBoat(woodMat: THREE.Material, lanternMat: THREE.Material, glowTex: THREE.Texture) {
  const boat = new THREE.Group()
  boat.name = 'erhai-fishing-boat'
  const hullMat = createMat('#433022', { roughness: 0.85 })
  const canopyMat = createMat('#2f3f46', { roughness: 0.88 })

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.78, 8.2, 8), hullMat)
  hull.rotation.z = Math.PI / 2
  hull.scale.z = 0.62
  hull.position.y = 0.2
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.14, 1.3), woodMat)
  deck.position.y = 0.65
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.0, 2.9, 10, 1, false, 0, Math.PI),
    canopyMat,
  )
  canopy.rotation.z = Math.PI / 2
  canopy.position.set(-0.3, 1.05, 0)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6), woodMat)
  pole.position.set(2.9, 1.4, 0)
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lanternMat)
  lantern.position.set(3.2, 2.0, 0)
  const halo = makeGlowSprite(glowTex, '#ffaa4e', 3.4, 0.45)
  halo.position.set(3.2, 2.0, 0)

  boat.add(hull, deck, canopy, pole, lantern, halo)
  return { boat, halo }
}

/**
 * 大理 · 洱海苍山明月（从零彻底重构，1:1 原生米制）：
 * - 真实“S 弯生态廊道”月牙水岸 + 苍山翠麓余脉，告别直尺海岸与空绿平板；
 * - 左前 S 弯沿岸实造雕花木廊“三坊一照壁”白族古村落、牌坊门楼、红灯笼与岸边芦苇垂柳；
 * - 对岸实造苍山山麓半岛托起真密檐崇圣寺三塔、苍山雪峰与满月 1:1 镜面洱海倒影。
 */
export function buildDaliCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'dali-erhai-scene'
  const rng = seededRandom(2026)

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)

  const lanternMat = createMat('#ff944d', { emissive: '#ff6f28', emissiveIntensity: 0.95 })

  // -------------------------------------------------------------------------
  // 1. 近岸云南绿坡与 S 弯半岛地形 + 洱海 420 × 260 m 镜面湖水
  // -------------------------------------------------------------------------
  const terrainGeo = new THREE.PlaneGeometry(420, 180, 96, 36)
  terrainGeo.rotateX(-Math.PI / 2)
  const tPos = terrainGeo.attributes.position
  const tCol = new Float32Array(tPos.count * 3)
  const grassLow = new THREE.Color('#344838')
  const hillGreen = new THREE.Color('#273b2f')
  const tmpC = new THREE.Color()

  for (let i = 0; i < tPos.count; i += 1) {
    const vx = tPos.getX(i)
    const vz = tPos.getZ(i) // -90..+90 relative to z = 92 => world z = 2..182
    const worldZ = vz + 92
    // S-bend shoreline: curves forward on the left (x < -14) around z = -12, recedes gently on right
    const leftCape = Math.exp(-Math.pow((vx + 36) / 22, 2)) * 18
    const sCurve = 7 + 3.5 * Math.sin(vx * 0.04) - leftCape
    let y = 0.05
    if (worldZ < sCurve) {
      y = WATER_Y - 0.8
    } else if (worldZ > 56) {
      y = Math.min(22, (worldZ - 56) * 0.18 + Math.abs(Math.sin(vx * 0.05)) * 4.5)
    }
    tPos.setY(i, y)
    tmpC.copy(grassLow).lerp(hillGreen, Math.min(1, y / 14))
    tCol[i * 3] = tmpC.r
    tCol[i * 3 + 1] = tmpC.g
    tCol[i * 3 + 2] = tmpC.b
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3))
  terrainGeo.computeVertexNormals()
  const terrainMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }),
  )
  terrainMesh.name = 'open-horizon-ground'
  terrainMesh.position.set(0, 0, 92)
  terrainMesh.receiveShadow = true
  g.add(terrainMesh)

  const water = buildSceneWater(ctx, {
    width: WATER_WIDTH,
    depth: WATER_DEPTH,
    x: 0,
    z: WATER_CENTER_Z,
    y: WATER_Y,
    deepHex: '#0d2236',
    shallowHex: '#254e68',
    fadeRadius: 240,
    reflective: true,
  })
  water.mesh.name = 'erhai-mirror-lake'
  water.mesh.userData.dimensionsMeters = { width: WATER_WIDTH, depth: WATER_DEPTH }
  ctx.bindWater(
    (rx, rz) => water.setRipple(rx, rz),
    (bio) => water.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      water.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) water.uniforms.uSunCol.value.set(sunHex)
      if (sunDir) water.uniforms.uSunDir.value.set(sunDir[0], sunDir[1], sunDir[2]).normalize()
    },
  )

  // -------------------------------------------------------------------------
  // 2. S 弯青石生态廊道（z = 7..20 前沿 + 左侧弧弯岸台 x = -54..-22, z = -18..+7）
  // -------------------------------------------------------------------------
  const stoneTex = ctx.textures.darkStoneTex.clone()
  stoneTex.needsUpdate = true
  stoneTex.wrapS = THREE.RepeatWrapping
  stoneTex.wrapT = THREE.RepeatWrapping
  stoneTex.repeat.set(16, 4)
  const bluestoneMat = applyPbrSet(
    createMat('#76817c', { roughness: 0.72, metalness: 0.06, map: stoneTex }),
    'cobble',
    18,
    4,
  )

  const promenade = addBox(g, [180, 0.3, 14], [0, PROMENADE_TOP_Y - 0.15, 14], bluestoneMat)
  promenade.name = 'bluestone-waterfront-promenade'
  promenade.userData.foregroundDeck = true
  promenade.userData.dimensionsMeters = { width: 180, depth: 14, topY: PROMENADE_TOP_Y }
  promenade.castShadow = false

  // Left crescent bay promenade jutting gently into the lake view
  const leftCorridor = addBox(g, [34, 0.3, 28], [-39, PROMENADE_TOP_Y - 0.15, -6], bluestoneMat)
  leftCorridor.castShadow = false
  // Cobblestone Bai village street behind promenade (z = 21..56)
  const villageStreet = addBox(g, [176, 0.18, 36], [0, 0.09, 38], bluestoneMat)
  villageStreet.castShadow = false

  // Stone seawalls
  addBox(g, [180, 1.8, 1.1], [0, -0.55, 7.2], cityMaterials.granite)
  addBox(g, [1.1, 1.8, 28], [-22.4, -0.55, -6], cityMaterials.granite)

  // -------------------------------------------------------------------------
  // 3. 32 m 木栈道与双檐八角望海茶亭
  // -------------------------------------------------------------------------
  const woodTex = ctx.textures.weatheredWoodTex.clone()
  woodTex.needsUpdate = true
  woodTex.wrapS = THREE.RepeatWrapping
  woodTex.wrapT = THREE.RepeatWrapping
  woodTex.repeat.set(1.4, 10)
  const boardwalkMat = createMat('#7a5b44', { roughness: 0.82, map: woodTex })

  const boardwalk = new THREE.Group()
  boardwalk.name = 'erhai-wooden-boardwalk'
  const bwDeck = addBox(
    boardwalk,
    [BOARDWALK_WIDTH, 0.28, BOARDWALK_LENGTH - 1],
    [0, BOARDWALK_TOP_Y - 0.14, (BOARDWALK_NEAR_Z + BOARDWALK_FAR_Z) / 2],
    boardwalkMat,
  )
  bwDeck.receiveShadow = true
  for (let pz = 5; pz >= -22; pz -= 4.5) {
    for (const px of [-1.75, 1.75]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.2, 8), boardwalkMat)
      pile.position.set(px, -0.45, pz)
      boardwalk.add(pile)
    }
  }
  g.add(boardwalk)

  const { pav, lanternMat: pavLanternMat, pt: pavLight } = createErhaiPavilion(ctx.textures.glowHalo)
  pav.position.set(PAVILION_X, BOARDWALK_TOP_Y, PAVILION_Z)
  g.add(pav)

  const rails: CityRailSegment[] = [
    { from: [-22, PROMENADE_TOP_Y, -18], to: [-22, PROMENADE_TOP_Y, 7] },
    { from: [-22, PROMENADE_TOP_Y, 7], to: [-2.4, PROMENADE_TOP_Y, 7] },
    { from: [2.4, PROMENADE_TOP_Y, 7], to: [88, PROMENADE_TOP_Y, 7] },
    { from: [-BOARDWALK_WIDTH / 2, BOARDWALK_TOP_Y, 7], to: [-BOARDWALK_WIDTH / 2, BOARDWALK_TOP_Y, -23.5] },
    { from: [BOARDWALK_WIDTH / 2, BOARDWALK_TOP_Y, 7], to: [BOARDWALK_WIDTH / 2, BOARDWALK_TOP_Y, -23.5] },
  ]
  buildContinuousRailing(g, rails, 'stone')

  // -------------------------------------------------------------------------
  // 4. S 弯沿岸精雕白族村落（三坊一照壁、牌坊门楼、红灯笼、垂柳与芦苇丛）
  // -------------------------------------------------------------------------
  const villageGroup = new THREE.Group()
  villageGroup.name = 'bai-sanfang-yizhaobi-compounds'

  // Left crescent bay courtyards facing east across the lake (immediately visible in default walkView!)
  for (const [cx, cz, rot] of [
    [-34, -10, Math.PI / 2],
    [-34, 6, Math.PI / 2],
  ] as [number, number, number][]) {
    const c = createOrnateBaiCourtyard(ctx.textures.glowHalo, { width: 14, depth: 11, lanternMat })
    c.position.set(cx, PROMENADE_TOP_Y, cz)
    c.rotation.y = rot
    villageGroup.add(c)
  }

  // Main lakeside village avenue (two rows along z = 22 & z = 39)
  for (const [cx, cz] of [
    [-16, 22], [18, 22], [38, 22], [58, 22],
    [-46, 39], [-24, 39], [0, 41], [24, 39], [46, 39],
  ] as [number, number][]) {
    const c = createOrnateBaiCourtyard(ctx.textures.glowHalo, {
      width: 15 + rng() * 1.5,
      depth: 11.5,
      lanternMat,
    })
    c.position.set(cx, 0.1, cz)
    villageGroup.add(c)
  }
  g.add(villageGroup)

  const gatehouse = createBaiGatehouse(ctx.textures.glowHalo)
  gatehouse.position.set(0, PROMENADE_TOP_Y, 20.2)
  g.add(gatehouse)

  // Weeping willows & lakeside cattail reeds along the S-bend shoreline
  const trunkMat = createMat('#5b4a38', { roughness: 0.94 })
  const leafMat = createMat('#486a44', { roughness: 0.9 })
  for (const [wx, wz] of [
    [-25, -18], [-25, -2], [-25, 13], [-12, 18], [12, 18], [28, 18], [48, 18], [-32, 34], [32, 34],
  ] as [number, number][]) {
    const willow = createWillow(7.2 + rng() * 1.8, trunkMat, leafMat, rng)
    willow.position.set(wx, 0.2, wz)
    g.add(willow)
  }
  for (const [rx, rz] of [
    [-21, -14], [-21, -4], [-18, 5.5], [10, 5.5], [22, 5.5], [34, 5.5], [46, 5.5],
  ] as [number, number][]) {
    const reeds = createShoreReedClump(rx)
    reeds.position.set(rx, WATER_Y + 0.1, rz)
    g.add(reeds)
  }

  buildStreetLampRow(
    g,
    ctx.textures,
    [
      [-23.5, PROMENADE_TOP_Y, -12],
      [-23.5, PROMENADE_TOP_Y, 2],
      [-12, PROMENADE_TOP_Y, 8.2],
      [12, PROMENADE_TOP_Y, 8.2],
      [28, PROMENADE_TOP_Y, 8.2],
    ],
    'dali',
  )

  // -------------------------------------------------------------------------
  // 5. 对岸苍山青翠山麓半岛 + 真密檐崇圣寺三塔 + 苍山十九峰 + 明月
  // -------------------------------------------------------------------------
  const foothillsGeo = new THREE.PlaneGeometry(360, 120, 72, 24)
  foothillsGeo.rotateX(-Math.PI / 2)
  const fPos = foothillsGeo.attributes.position
  for (let i = 0; i < fPos.count; i += 1) {
    const fx = fPos.getX(i)
    const fz = fPos.getZ(i) // -60..+60 relative to z = -190
    const worldZ = fz - 190
    const pagodaPeninsula = Math.exp(-Math.pow((fx + 36) / 36, 2)) * 28
    const shoreLine = -168 + pagodaPeninsula
    let y = 1.8
    if (worldZ > shoreLine) {
      y = WATER_Y - 1.0 - Math.min(2.0, (worldZ - shoreLine) * 0.18)
    } else {
      y = 1.6 + Math.max(0, (shoreLine - worldZ) * 0.08)
    }
    fPos.setY(i, y)
  }
  foothillsGeo.computeVertexNormals()
  const foothills = new THREE.Mesh(
    foothillsGeo,
    createMat('#2a4239', { roughness: 0.94, flatShading: true }),
  )
  foothills.position.set(0, 0, -190)
  g.add(foothills)

  const pagodas = createChongshengThreePagodas()
  pagodas.position.set(-36, 1.4, -158)
  g.add(pagodas)

  // Cangshan Nineteen Peaks with snowline vertex colors
  const mountains = new THREE.Group()
  mountains.name = 'horizon-mountains'
  mountains.userData.horizonVariant = 'dali'
  mountains.userData.peakCount = 19
  const ridgeGeo = new THREE.PlaneGeometry(460, 150, 96, 28)
  ridgeGeo.rotateX(-Math.PI / 2)
  const rPos = ridgeGeo.attributes.position
  const rCol = new Float32Array(rPos.count * 3)
  const baseCol = new THREE.Color('#223947')
  const midCol = new THREE.Color('#345160')
  const snowCol = new THREE.Color('#e2ecf4')
  const rTmp = new THREE.Color()
  for (let i = 0; i < rPos.count; i += 1) {
    const vx = rPos.getX(i)
    const vz = rPos.getZ(i)
    const fall = Math.max(0, 1 - Math.abs(vz) / 72)
    const r1 = Math.abs(Math.sin(vx * 0.03 + 0.4) * Math.cos(vz * 0.04))
    const r2 = Math.abs(Math.sin(vx * 0.072 - 1.0) * Math.sin(vz * 0.08 + 0.6)) * 0.45
    const h = Math.max(0, (r1 * 64 + r2 * 38) * Math.pow(fall, 0.72) - 2)
    rPos.setY(i, h)
    if (h > 42) {
      rTmp.copy(midCol).lerp(snowCol, Math.min(1, (h - 42) / 14))
    } else {
      rTmp.copy(baseCol).lerp(midCol, Math.min(1, h / 30))
    }
    rCol[i * 3] = rTmp.r
    rCol[i * 3 + 1] = rTmp.g
    rCol[i * 3 + 2] = rTmp.b
  }
  ridgeGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3))
  ridgeGeo.computeVertexNormals()
  const ridgeMesh = new THREE.Mesh(
    ridgeGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }),
  )
  ridgeMesh.position.set(0, -1.5, -238)
  mountains.add(ridgeMesh)
  g.add(mountains)

  // Soft glowing Full Moon above Cangshan snowline (reflected cleanly in Reflector lake)
  const moonMat = createMat('#fff0cf', { emissive: '#ffe6b0', emissiveIntensity: 1.25 })
  const moon = new THREE.Group()
  moon.name = 'full-moon'
  moon.position.set(MOON_X, MOON_Y, MOON_Z)
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(8.5, 32, 24), moonMat)
  const moonHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffe8b8', 36, 0.48)
  moon.add(moonDisc, moonHalo)
  g.add(moon)

  // -------------------------------------------------------------------------
  // 6. 乌篷暖灯渔舟 & 3/3 奇遇互动（lanterns, moon, boat）
  // -------------------------------------------------------------------------
  const { boat, halo: boatHalo } = createBaiFishingBoat(boardwalkMat, lanternMat, ctx.textures.glowHalo)
  boat.position.set(BOAT_X, -0.86, BOAT_Z)
  g.add(boat)

  let lanternsLit = ctx.isEncounterDone('lanterns')
  let moonRaised = ctx.isEncounterDone('moon')
  let boatRowing = ctx.isEncounterDone('boat')
  let moonTargetY = moonRaised ? MOON_Y + 9 : MOON_Y

  const awakenLanterns = () => {
    lanternsLit = true
    lanternMat.emissiveIntensity = 1.65
    pavLanternMat.emissiveIntensity = 1.65
    pavLight.intensity = 3.6
  }
  const awakenMoon = () => {
    moonRaised = true
    moonTargetY = MOON_Y + 9
    moonMat.emissiveIntensity = 1.65
    water.setBio(0.42)
  }
  const awakenBoat = () => {
    boatRowing = true
    water.setRipple(boat.position.x, boat.position.z)
    water.setBio(0.58)
  }

  ctx.registerInteractive(villageGroup, {
    encounterId: 'lanterns',
    focusPoint: new THREE.Vector3(-34, 4, 2),
    onClick: () => {
      awakenLanterns()
      ctx.discoverEncounter('lanterns')
      return { label: '白族院落红灯笼次第亮起 · S 弯水岸暖意融融', sfx: 'lamp' }
    },
  })
  ctx.registerInteractive(moon, {
    encounterId: 'moon',
    focusPoint: new THREE.Vector3(MOON_X, MOON_Y + 6, MOON_Z),
    onClick: () => {
      awakenMoon()
      ctx.discoverEncounter('moon')
      return { label: '苍山雪线之上明月缓缓升起 · 洱海铺开一片银辉', sfx: 'star' }
    },
  })
  ctx.registerInteractive(boat, {
    encounterId: 'boat',
    focusPoint: new THREE.Vector3(BOAT_X, 1.5, BOAT_Z),
    onClick: () => {
      awakenBoat()
      ctx.discoverEncounter('boat')
      return { label: '乌篷灯舟推开镜面洱海 · 星月倒影碎成银波', sfx: 'ripple' }
    },
  })

  ctx.setFinaleTrigger(() => {
    awakenLanterns()
    awakenMoon()
    awakenBoat()
    water.setBio(0.85)
  })

  ctx.setVantageAnchor?.({
    label: '望海八角水榭 · 苍山明月',
    pos: [PAVILION_X, BOARDWALK_TOP_Y + VANTAGE_EYE_HEIGHT, PAVILION_Z],
    yaw: 0.14,
    pitch: 0.06,
  })
  ctx.setRideAnchor?.(() => {
    boat.updateWorldMatrix(true, false)
    return {
      pos: boat.localToWorld(new THREE.Vector3(0, 2.55, 0)),
      yawOffset: boat.rotation.y,
    }
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    const pavDx = Math.abs(x - PAVILION_X)
    const pavDz = Math.abs(z - PAVILION_Z)
    if (pavDx <= PAVILION_RADIUS && pavDz <= PAVILION_RADIUS && pavDx + pavDz <= PAVILION_RADIUS * (1 + Math.SQRT1_2)) {
      return BOARDWALK_TOP_Y
    }
    if (Math.abs(x) <= BOARDWALK_WIDTH / 2 && z >= BOARDWALK_FAR_Z && z <= BOARDWALK_NEAR_Z) {
      return BOARDWALK_TOP_Y
    }
    if (x >= -56 && x <= -22 && z >= -20 && z <= 7) return PROMENADE_TOP_Y
    if (Math.abs(x) <= 88 && z >= 7 && z <= 56) return PROMENADE_TOP_Y
    return null
  })

  ctx.addMoodHook((mood: DioramaMood) => {
    moonMat.emissiveIntensity = moonRaised ? 1.65 : mood === 'night' ? 1.35 : 0.9
    lanternMat.emissiveIntensity = lanternsLit ? 1.65 : mood === 'night' ? 0.95 : 0.55
  })

  const tickBirds = createGlidingBirds(g, [-8, 12, -36], 26, 3)

  ctx.addTick((time, dt) => {
    tickBirds(time)
    water.uniforms.uTime.value = time
    water.uniforms.uRippleAge.value = Math.min(10, water.uniforms.uRippleAge.value + dt)
    moon.position.y += (moonTargetY - moon.position.y) * Math.min(1, dt * 1.4)
    moonHalo.material.opacity = (moonRaised ? 0.62 : 0.42) + Math.sin(time * 0.5) * 0.03

    const boatSpeed = boatRowing ? 0.14 : 0.08
    const bx = BOAT_X + Math.sin(time * boatSpeed) * 5
    const bz = BOAT_Z + Math.sin(time * 0.07 + 1.1) * 7
    const vx = Math.cos(time * boatSpeed) * 5 * boatSpeed
    const vz = Math.cos(time * 0.07 + 1.1) * 7 * 0.07
    boat.position.set(bx, -0.86 + Math.sin(time * 1.3) * 0.08, bz)
    boat.rotation.y = Math.atan2(-vz, vx)
    boat.rotation.z = Math.sin(time * 1.05) * 0.022
    boatHalo.material.opacity = (boatRowing ? 0.65 : 0.42) + Math.sin(time * 1.8) * 0.05
  })

  enableShadows(g, true, true)
  water.mesh.castShadow = false
  terrainMesh.castShadow = false
  foothills.castShadow = false
  moonDisc.castShadow = false
  moonHalo.castShadow = false

  ctx.addDisposeHook?.(() => {
    stoneTex.dispose()
    woodTex.dispose()
    terrainGeo.dispose()
    foothillsGeo.dispose()
    ridgeGeo.dispose()
  })
}
