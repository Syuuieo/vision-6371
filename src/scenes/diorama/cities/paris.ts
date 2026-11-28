import * as THREE from 'three'
import { createEiffelTowerModel, TOWER_HEIGHT as EIFFEL_MODEL_HEIGHT } from '../assets/eiffel/createEiffelTower'
import { buildSceneWater, createMat, enableShadows, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx, DioramaMood } from '../types'
import {
  buildContinuousRailing,
  createCityPbrMaterials,
  createGlidingBirds,
  type CityRailSegment,
} from './cityKit'
import {
  createBouquinisteStall,
  createHaussmannBuilding,
  createParisianBench,
  createParisianBistroSet,
  createParisianLamp,
  createParisianPlaneTree,
  createParisianTextures,
} from './parisAssets'

type Vec3 = [number, number, number]

/** Inland Seine river-valley layout: 32 m river channel flanked by continuous Left & Right Banks. */
const SEINE_WIDTH = 360
const SEINE_DEPTH = 32
const LEFT_BANK_Z = 7
const RIGHT_BANK_Z = LEFT_BANK_Z - SEINE_DEPTH // -25
const SEINE_CENTER_Z = (LEFT_BANK_Z + RIGHT_BANK_Z) / 2 // -9
const WATER_Y = -1.1
const PROMENADE_Y = 0.65

const BRIDGE_X = 14
const BRIDGE_CENTER_Z = SEINE_CENTER_Z // -9
const BRIDGE_HALF_WIDTH = 4.6
const BRIDGE_HALF_LENGTH = 16 // spans -25 .. +7
const BRIDGE_DECK_Y = 2.1
const BRIDGE_RAMP_LENGTH = 5.5

const TOWER_X = -12
const TOWER_Z = -50
const TOWER_Y = PROMENADE_Y
const TOWER_HEIGHT = 42
const VANTAGE_EYE_HEIGHT = 1.65
const BOAT_X = 36
const BOAT_Z = SEINE_CENTER_Z

function addBox(
  parent: THREE.Object3D,
  size: Vec3,
  position: Vec3,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** 178k-triangle MIT Eiffel Tower asset scaled to 42 m with warm beacon & halo. */
function createEiffelTower(glowTexture: THREE.Texture) {
  const tower = new THREE.Group()
  tower.name = 'eiffel-tower-42m'
  const model = createEiffelTowerModel()
  const scale = TOWER_HEIGHT / Math.max(1, EIFFEL_MODEL_HEIGHT)
  model.scale.setScalar(scale)
  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
  tower.add(model)

  const beaconMaterial = createMat('#fff3cf', {
    emissive: '#ffca70',
    emissiveIntensity: 1.8,
    roughness: 0.2,
  })
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), beaconMaterial)
  beacon.position.y = TOWER_HEIGHT - 0.4
  tower.add(beacon)
  const halo = makeGlowSprite(glowTexture, '#ffdf9c', 7.2, 0.65)
  halo.position.y = TOWER_HEIGHT - 0.4
  tower.add(halo)
  return { tower, beacon, beaconMaterial, halo }
}

function createGlassRoofBoat(glowTexture: THREE.Texture) {
  const boat = new THREE.Group()
  boat.name = 'seine-glass-roof-boat'
  const hullMaterial = createMat('#182231', { roughness: 0.42, metalness: 0.45 })
  const trimMaterial = createMat('#c7b98f', { roughness: 0.35, metalness: 0.65 })
  const cabinMaterial = createMat('#e1d8c5', { roughness: 0.62 })
  const windowMaterial = createMat('#ffe2a8', {
    emissive: '#ffb45c',
    emissiveIntensity: 0.85,
    roughness: 0.2,
  })
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.1, 22, 6), hullMaterial)
  hull.rotation.z = Math.PI / 2
  hull.scale.z = 0.72
  hull.position.y = 0.35
  hull.castShadow = true
  boat.add(hull)
  addBox(boat, [15.5, 0.32, 4.4], [0, 1.2, 0], trimMaterial)
  addBox(boat, [14.2, 1.5, 4.0], [0, 2.05, 0], cabinMaterial)
  for (const side of [-1, 1]) {
    addBox(boat, [13.5, 0.88, 0.08], [0, 2.12, side * 2.03], windowMaterial)
  }
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#b8d9e4',
    transparent: true,
    opacity: 0.3,
    roughness: 0.08,
    metalness: 0.05,
    transmission: 0.25,
    thickness: 0.16,
    depthWrite: false,
  })
  const glassRoof = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.1, 4.3), glassMaterial)
  glassRoof.position.y = 3.32
  boat.add(glassRoof)
  for (let i = -3; i <= 3; i += 1) {
    addBox(boat, [0.07, 0.12, 4.4], [i * 2.1, 3.38, 0], trimMaterial)
  }
  for (const x of [-6.2, 6.2]) {
    for (const z of [-1.9, 1.9]) {
      addBox(boat, [0.09, 2.0, 0.09], [x, 2.3, z], trimMaterial)
    }
  }
  const bowLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), windowMaterial)
  bowLight.position.set(10.8, 1.05, 0)
  boat.add(bowLight)
  const wakeGlow = makeGlowSprite(glowTexture, '#f7d69a', 5, 0.18)
  wakeGlow.position.set(-11.5, 0.15, 0)
  boat.add(wakeGlow)
  return { boat, windowMaterial, wakeGlow }
}

/** Builds a three-arch Parisian limestone bridge spanning Left Bank (z=7) to Right Bank (z=-25) with stone ramps. */
function createThreeArchBridge(
  stoneMaterial: THREE.Material,
  glowTexture: THREE.Texture,
) {
  const bridge = new THREE.Group()
  bridge.name = 'pont-d-iena-bridge'
  bridge.position.set(BRIDGE_X, 0, BRIDGE_CENTER_Z)

  // Main deck spanning -16 .. +16
  addBox(bridge, [BRIDGE_HALF_WIDTH * 2, 0.55, BRIDGE_HALF_LENGTH * 2], [0, BRIDGE_DECK_Y - 0.275, 0], stoneMaterial)

  // Stone piers in the Seine
  for (const pierZ of [-9.5, 9.5]) {
    addBox(
      bridge,
      [BRIDGE_HALF_WIDTH * 2 + 1.1, BRIDGE_DECK_Y - WATER_Y + 0.2, 2.2],
      [0, (BRIDGE_DECK_Y + WATER_Y) / 2, pierZ],
      stoneMaterial,
    )
  }

  // Three decorative arch rings under the deck
  for (const archZ of [-10.5, 0, 10.5]) {
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.4, BRIDGE_HALF_WIDTH * 2 - 0.4, 16, 1, true, 0, Math.PI),
      stoneMaterial,
    )
    arch.rotation.z = Math.PI / 2
    arch.rotation.x = Math.PI / 2
    arch.position.set(0, BRIDGE_DECK_Y - 3.6, archZ)
    bridge.add(arch)
  }

  // Stone ramps at both Left Bank (+Z) and Right Bank (-Z)
  const rampSlope = Math.atan2(BRIDGE_DECK_Y - PROMENADE_Y, BRIDGE_RAMP_LENGTH)
  const rampLen = Math.hypot(BRIDGE_RAMP_LENGTH, BRIDGE_DECK_Y - PROMENADE_Y)
  for (const dir of [-1, 1]) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(BRIDGE_HALF_WIDTH * 2, 0.48, rampLen),
      stoneMaterial,
    )
    ramp.position.set(
      0,
      (BRIDGE_DECK_Y + PROMENADE_Y) / 2 - 0.24,
      dir * (BRIDGE_HALF_LENGTH + BRIDGE_RAMP_LENGTH / 2),
    )
    ramp.rotation.x = dir * rampSlope
    ramp.receiveShadow = true
    ramp.castShadow = true
    bridge.add(ramp)
  }

  // Carved stone balustrades & warm Parisian globe lamps on bridge parapets
  const parapetRails: CityRailSegment[] = [
    { from: [-BRIDGE_HALF_WIDTH + 0.35, BRIDGE_DECK_Y, -BRIDGE_HALF_LENGTH], to: [-BRIDGE_HALF_WIDTH + 0.35, BRIDGE_DECK_Y, BRIDGE_HALF_LENGTH] },
    { from: [BRIDGE_HALF_WIDTH - 0.35, BRIDGE_DECK_Y, -BRIDGE_HALF_LENGTH], to: [BRIDGE_HALF_WIDTH - 0.35, BRIDGE_DECK_Y, BRIDGE_HALF_LENGTH] },
  ]
  buildContinuousRailing(bridge, parapetRails, 'stone')

  const globeMats: THREE.MeshStandardMaterial[] = []
  for (const sx of [-BRIDGE_HALF_WIDTH + 0.4, BRIDGE_HALF_WIDTH - 0.4]) {
    for (const sz of [-12, 0, 12]) {
      const { lamp, globeMat } = createParisianLamp(glowTexture, sz === 0)
      lamp.scale.setScalar(0.78)
      lamp.position.set(sx, BRIDGE_DECK_Y, sz)
      bridge.add(lamp)
      globeMats.push(globeMat)
    }
  }

  return { bridge, globeMats }
}

export function buildParisCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'paris-seine-native-1to1'

  const textures = createParisianTextures()
  ctx.addDisposeHook?.(() => textures.dispose())

  const materials = createCityPbrMaterials(ctx.textures)
  const cobbleMat = applyPbrSet(
    new THREE.MeshStandardMaterial({
      color: '#9e958e',
      map: textures.groundCobbleMap,
      roughness: 0.88,
      metalness: 0.04,
    }),
    'cobble',
    36,
    26,
  )
  const quayMaterial = applyPbrSet(createMat('#c7bca9', { roughness: 0.86 }), 'limestone', 18, 1)
  const gravelMat = createMat('#a89b84', { roughness: 0.92 })
  const lawnMat = applyPbrSet(
    new THREE.MeshStandardMaterial({
      color: '#5a7852',
      map: textures.lawnMap,
      roughness: 0.92,
    }),
    'grass',
    3,
    4,
  )

  // 1. Continuous inland Left Bank & Right Bank urban ground (zero floating island edges!)
  const leftGround = new THREE.Mesh(new THREE.PlaneGeometry(380, 240), cobbleMat)
  leftGround.rotation.x = -Math.PI / 2
  leftGround.position.set(0, PROMENADE_Y - 0.02, LEFT_BANK_Z + 120)
  leftGround.receiveShadow = true
  leftGround.name = 'left-bank-urban-ground'
  g.add(leftGround)

  const rightGround = new THREE.Mesh(new THREE.PlaneGeometry(380, 240), cobbleMat)
  rightGround.rotation.x = -Math.PI / 2
  rightGround.position.set(0, PROMENADE_Y - 0.02, RIGHT_BANK_Z - 120)
  rightGround.receiveShadow = true
  rightGround.name = 'right-bank-urban-ground'
  g.add(rightGround)

  // Foreground Left-Bank Quai Promenade deck (matches openHorizon.test foregroundDeck & walkHeightSampler)
  const leftPromenade = addBox(
    g,
    [180, PROMENADE_Y - WATER_Y, 18],
    [0, (PROMENADE_Y + WATER_Y) / 2, LEFT_BANK_Z + 9],
    cobbleMat,
  )
  leftPromenade.name = 'left-bank-promenade-180x18'
  leftPromenade.userData.foregroundDeck = true
  leftPromenade.userData.dimensionsMeters = { width: 180, depth: 18, topY: PROMENADE_Y }
  leftPromenade.castShadow = false

  // Continuous stone quay walls along both banks of the Seine (z = 7 and z = -25)
  addBox(g, [360, PROMENADE_Y - WATER_Y + 0.15, 1.4], [0, (PROMENADE_Y + WATER_Y) / 2, LEFT_BANK_Z - 0.5], quayMaterial)
  addBox(g, [360, PROMENADE_Y - WATER_Y + 0.15, 1.4], [0, (PROMENADE_Y + WATER_Y) / 2, RIGHT_BANK_Z + 0.5], quayMaterial)

  // Cast-iron riverside quay railings along both banks (leaving bridge approaches open)
  const quayRails: CityRailSegment[] = [
    { from: [-90, PROMENADE_Y, LEFT_BANK_Z + 0.25], to: [BRIDGE_X - BRIDGE_HALF_WIDTH - 0.5, PROMENADE_Y, LEFT_BANK_Z + 0.25] },
    { from: [BRIDGE_X + BRIDGE_HALF_WIDTH + 0.5, PROMENADE_Y, LEFT_BANK_Z + 0.25], to: [90, PROMENADE_Y, LEFT_BANK_Z + 0.25] },
    { from: [-90, PROMENADE_Y, RIGHT_BANK_Z - 0.25], to: [BRIDGE_X - BRIDGE_HALF_WIDTH - 0.5, PROMENADE_Y, RIGHT_BANK_Z - 0.25] },
    { from: [BRIDGE_X + BRIDGE_HALF_WIDTH + 0.5, PROMENADE_Y, RIGHT_BANK_Z - 0.25], to: [90, PROMENADE_Y, RIGHT_BANK_Z - 0.25] },
  ]
  buildContinuousRailing(g, quayRails, 'iron')

  // 2. Reflective Seine River channel (360 x 32 m between Left & Right Bank stone quays)
  const water = buildSceneWater(ctx, {
    width: SEINE_WIDTH,
    depth: SEINE_DEPTH,
    x: 0,
    z: SEINE_CENTER_Z,
    y: WATER_Y,
    deepHex: '#101c33',
    shallowHex: '#25455e',
    fadeRadius: 240,
    reflective: true,
  })
  water.mesh.name = 'seine-water-360x32'
  water.mesh.userData.dimensionsMeters = { width: SEINE_WIDTH, depth: SEINE_DEPTH }
  ctx.bindWater(
    (x, z) => water.setRipple(x, z),
    (bio) => water.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      const uniforms = water.uniforms
      uniforms.uFogColor.value.set(fogHex)
      if (sunHex) uniforms.uSunCol.value.set(sunHex)
      if (sunDir) uniforms.uSunDir.value.set(sunDir[0], sunDir[1], sunDir[2]).normalize()
    },
  )
  ctx.registerInteractive(water.mesh, {
    onClick: (point) => {
      const local = point ? ctx.group.worldToLocal(point.clone()) : null
      water.setRipple(local?.x ?? 0, local?.z ?? 0)
      return { label: '轻点镜面塞纳河 · 紫粉天光碎成金波', sfx: 'ripple' }
    },
  })

  // 3. Champ de Mars Park (lush lawns + gravel paths beneath Eiffel Tower on Right Bank)
  const champDeMars = new THREE.Mesh(new THREE.PlaneGeometry(54, 88), gravelMat)
  champDeMars.rotation.x = -Math.PI / 2
  champDeMars.position.set(TOWER_X, PROMENADE_Y + 0.01, -68)
  champDeMars.receiveShadow = true
  g.add(champDeMars)

  for (const lx of [TOWER_X - 15, TOWER_X + 15]) {
    for (const lz of [-36, -68, -94]) {
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), lawnMat)
      lawn.rotation.x = -Math.PI / 2
      lawn.position.set(lx, PROMENADE_Y + 0.025, lz)
      lawn.receiveShadow = true
      g.add(lawn)
    }
  }

  // 4. 178k-triangle Eiffel Tower anchored on Champ de Mars
  const tower = createEiffelTower(ctx.textures.glowHalo)
  tower.tower.position.set(TOWER_X, TOWER_Y, TOWER_Z)
  g.add(tower.tower)

  // 5. Three-arch Parisian stone bridge
  const { bridge, globeMats } = createThreeArchBridge(quayMaterial, ctx.textures.glowHalo)
  g.add(bridge)

  // 6. Left-Bank Parisian Boulevard: Haussmann buildings, Plane Trees, Bouquinistes, Lamps & Benches
  const lampMats: THREE.MeshStandardMaterial[] = [...globeMats]
  for (const [idx, lx] of [-38, -22, -10, 6, 22, 38].entries()) {
    const { lamp, globeMat } = createParisianLamp(ctx.textures.glowHalo, idx % 2 === 0)
    lamp.position.set(lx, PROMENADE_Y, LEFT_BANK_Z + 1.2)
    g.add(lamp)
    lampMats.push(globeMat)
  }

  for (const tx of [-34, -25, -14, 14, 25, 34]) {
    const tree = createParisianPlaneTree(0.95 + (Math.abs(tx) % 3) * 0.08)
    tree.position.set(tx, PROMENADE_Y, LEFT_BANK_Z + 4.8)
    g.add(tree)
  }

  for (const bx of [-18, 18]) {
    const bench = createParisianBench()
    bench.position.set(bx, PROMENADE_Y, LEFT_BANK_Z + 3.0)
    g.add(bench)
  }

  const stallGroup = new THREE.Group()
  const stallLampMats: THREE.MeshStandardMaterial[] = []
  for (const sx of [-29, -20, 20, 29]) {
    const { stall, lampMat } = createBouquinisteStall(ctx.textures.glowHalo)
    stall.position.set(sx, PROMENADE_Y, LEFT_BANK_Z + 1.6)
    stallGroup.add(stall)
    stallLampMats.push(lampMat)
  }
  g.add(stallGroup)
  ctx.registerInteractive(stallGroup, {
    onClick: () => {
      for (const m of stallLampMats) m.emissiveIntensity = 1.4
      return { label: '左岸旧书摊亮起暖灯 · 塞纳的风翻过一页诗', sfx: 'lamp' }
    },
  })

  // Left-Bank Haussmann facades facing the Seine (along z = 25) + secondary avenue behind (z = 52)
  const storefrontColors = ['#3b1f25', '#1f3429', '#202b3d', '#3a2b20']
  const limestoneTints = ['#e2d7c4', '#dbd0bd', '#e7decb', '#d4c8b3']
  for (const [idx, bx] of [-56, -37, -19, 19, 37, 56].entries()) {
    const bldg = createHaussmannBuilding(textures, {
      width: 17,
      depth: 13,
      floors: 4 + (idx % 2),
      tint: limestoneTints[idx % limestoneTints.length],
      storefrontColor: storefrontColors[idx % storefrontColors.length],
      hasCafeAwning: idx % 2 === 0,
    })
    bldg.position.set(bx, PROMENADE_Y, 26)
    bldg.rotation.y = Math.PI
    g.add(bldg)
    if (idx % 2 === 0) {
      for (const offset of [-3.2, 3.2]) {
        const bistro = createParisianBistroSet()
        bistro.position.set(bx + offset, PROMENADE_Y, 17.8)
        g.add(bistro)
      }
    }
  }
  for (const [idx, bx] of [-64, -42, -20, 2, 24, 46, 68].entries()) {
    const backBldg = createHaussmannBuilding(textures, {
      width: 19,
      depth: 14,
      floors: 5,
      tint: limestoneTints[(idx + 1) % limestoneTints.length],
      storefrontColor: storefrontColors[(idx + 2) % storefrontColors.length],
    })
    backBldg.position.set(bx, PROMENADE_Y, 54)
    backBldg.rotation.y = Math.PI
    g.add(backBldg)
  }

  // 7. Right-Bank Haussmann Boulevards flanking Champ de Mars + avenue behind Eiffel Tower
  for (const [idx, bx] of [-68, -48, 16, 36, 56, 76].entries()) {
    const bldg = createHaussmannBuilding(textures, {
      width: 17,
      depth: 13,
      floors: 4 + (idx % 2),
      tint: limestoneTints[(idx + 2) % limestoneTints.length],
      storefrontColor: storefrontColors[(idx + 1) % storefrontColors.length],
      hasCafeAwning: idx % 2 === 1,
    })
    bldg.position.set(bx, PROMENADE_Y, RIGHT_BANK_Z - 14)
    g.add(bldg)
  }
  for (const tx of [-30, -2, 10, 26]) {
    const tree = createParisianPlaneTree(1.05)
    tree.position.set(tx, PROMENADE_Y, RIGHT_BANK_Z - 4.2)
    g.add(tree)
  }
  for (const [idx, bx] of [-58, -38, -16, 6, 28, 50, 72].entries()) {
    const farBldg = createHaussmannBuilding(textures, {
      width: 19,
      depth: 14,
      floors: 4 + (idx % 2),
      tint: limestoneTints[idx % limestoneTints.length],
      storefrontColor: storefrontColors[idx % storefrontColors.length],
    })
    farBldg.position.set(bx, PROMENADE_Y, -98)
    g.add(farBldg)
  }

  // 8. Distant Parisian Mansard Skyline Horizon on land (replaces giant grey boxes in water)
  const horizon = new THREE.Group()
  horizon.name = 'horizon-skyline'
  horizon.userData.horizonVariant = 'paris'
  const skylineMat = createMat('#343245', { roughness: 0.94, metalness: 0.02 })
  for (let i = -6; i <= 6; i += 1) {
    const h = 15 + ((Math.abs(i) * 7) % 9)
    addBox(horizon, [22, h, 14], [i * 26, PROMENADE_Y + h / 2, -138], skylineMat)
    addBox(horizon, [22, h - 2, 14], [i * 26 + 10, PROMENADE_Y + (h - 2) / 2, 118], skylineMat)
  }
  g.add(horizon)

  // 9. Seine Glass-Roof Bateaux-Mouches Cruise Boat
  const boat = createGlassRoofBoat(ctx.textures.glowHalo)
  boat.boat.position.set(BOAT_X, WATER_Y + 0.1, BOAT_Z)
  g.add(boat.boat)

  let towerLit = false
  let bridgeLit = false
  let boatLit = false
  let nightFactor = 0.85
  let wakeBoost = 0

  const igniteTower = () => {
    towerLit = true
    tower.beaconMaterial.emissiveIntensity = 2.8
    tower.halo.material.opacity = 0.92
    materials.glass.emissiveIntensity = 1.15
  }
  const igniteBridge = () => {
    bridgeLit = true
    for (const m of lampMats) m.emissiveIntensity = 2.4
    water.setBio(0.45)
  }
  const igniteBoat = () => {
    boatLit = true
    boat.windowMaterial.emissiveIntensity = 1.8
    wakeBoost = 1
    water.setBio(0.35)
  }

  ctx.registerInteractive(tower.tower, {
    encounterId: 'tower',
    focusPoint: new THREE.Vector3(TOWER_X, TOWER_Y + 22, TOWER_Z),
    onClick: () => {
      igniteTower()
      ctx.discoverEncounter('tower')
      return { label: '铁塔香槟星火逐层点亮 · 灯塔扫过塞纳暮色', sfx: 'star' }
    },
  })
  ctx.registerInteractive(bridge, {
    encounterId: 'bridge',
    focusPoint: new THREE.Vector3(BRIDGE_X, BRIDGE_DECK_Y + 1.2, BRIDGE_CENTER_Z),
    onClick: () => {
      igniteBridge()
      ctx.discoverEncounter('bridge')
      return { label: '三孔石桥与两岸煤气灯在紫粉天色里苏醒', sfx: 'lamp' }
    },
  })
  ctx.registerInteractive(boat.boat, {
    encounterId: 'boat',
    focusPoint: new THREE.Vector3(BOAT_X, 2.0, BOAT_Z),
    onClick: () => {
      igniteBoat()
      ctx.discoverEncounter('boat')
      ctx.triggerRipple(boat.boat.position.x, boat.boat.position.z)
      return { label: '塞纳玻璃顶游船启航 · 晚霞水面拖出一条金波', sfx: 'ripple' }
    },
  })

  // 3/3 finale: all three awakenings converge cleanly.
  ctx.setFinaleTrigger(() => {
    igniteTower()
    igniteBridge()
    igniteBoat()
    water.setBio(0.7)
    ctx.triggerRipple(boat.boat.position.x, boat.boat.position.z)
  })

  const vantageY = BRIDGE_DECK_Y + VANTAGE_EYE_HEIGHT
  const towerFocusY = TOWER_Y + TOWER_HEIGHT * 0.5
  ctx.setVantageAnchor?.({
    label: '三孔石桥 · 铁塔暮色',
    pos: [BRIDGE_X, vantageY, BRIDGE_CENTER_Z],
    yaw: Math.atan2(TOWER_X - BRIDGE_X, TOWER_Z - BRIDGE_CENTER_Z),
    pitch: Math.atan2(towerFocusY - vantageY, Math.hypot(TOWER_X - BRIDGE_X, TOWER_Z - BRIDGE_CENTER_Z)),
  })

  ctx.setRideAnchor?.(() => {
    boat.boat.updateWorldMatrix(true, false)
    return {
      pos: boat.boat.localToWorld(new THREE.Vector3(0, 3.85, 0)),
      yawOffset: boat.boat.rotation.y,
    }
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x - BRIDGE_X) <= BRIDGE_HALF_WIDTH) {
      const localZ = z - BRIDGE_CENTER_Z
      if (localZ >= -BRIDGE_HALF_LENGTH && localZ <= BRIDGE_HALF_LENGTH) {
        return BRIDGE_DECK_Y
      }
      if (localZ > BRIDGE_HALF_LENGTH && localZ <= BRIDGE_HALF_LENGTH + BRIDGE_RAMP_LENGTH) {
        const t = (localZ - BRIDGE_HALF_LENGTH) / BRIDGE_RAMP_LENGTH
        return THREE.MathUtils.lerp(BRIDGE_DECK_Y, PROMENADE_Y, t)
      }
      if (localZ < -BRIDGE_HALF_LENGTH && localZ >= -BRIDGE_HALF_LENGTH - BRIDGE_RAMP_LENGTH) {
        const t = (-localZ - BRIDGE_HALF_LENGTH) / BRIDGE_RAMP_LENGTH
        return THREE.MathUtils.lerp(BRIDGE_DECK_Y, PROMENADE_Y, t)
      }
    }
    if (x >= -90 && x <= 90 && (z >= LEFT_BANK_Z || z <= RIGHT_BANK_Z)) {
      return PROMENADE_Y
    }
    return null
  })

  ctx.addTimeHook?.((_hour, nextNightFactor) => {
    nightFactor = nextNightFactor
  })
  ctx.addMoodHook((mood: DioramaMood) => {
    nightFactor = mood === 'night' ? 0.94 : mood === 'dawn' ? 0.28 : 0.76
    if (!towerLit) tower.beaconMaterial.emissiveIntensity = 0.8 + nightFactor * 1.2
    if (!boatLit) boat.windowMaterial.emissiveIntensity = 0.45 + nightFactor * 0.55
  })

  const tickBirds = createGlidingBirds(g, [6, 11.5, SEINE_CENTER_Z], 22, 3)

  ctx.addTick((time, delta) => {
    tickBirds(time)
    const boatPhase = time * 0.055
    boat.boat.position.x = BOAT_X + Math.sin(boatPhase) * 10
    boat.boat.position.y = WATER_Y + 0.1 + Math.sin(time * 1.35) * 0.08
    boat.boat.rotation.y = Math.cos(boatPhase) >= 0 ? 0 : Math.PI
    boat.boat.rotation.z = Math.sin(time * 1.1) * 0.012
    wakeBoost = Math.max(0, wakeBoost - delta * 0.25)
    boat.wakeGlow.material.opacity = (boatLit ? 0.28 : 0.12) + wakeBoost * 0.2
    if (towerLit) tower.beaconMaterial.emissiveIntensity = 2.8 + Math.sin(time * 3.2) * 0.45
    if (bridgeLit) {
      for (const m of lampMats) m.emissiveIntensity = 2.3 + Math.sin(time * 1.8) * 0.15
    }
  })

  enableShadows(g, true, true)
  water.mesh.castShadow = false
  leftGround.castShadow = false
  rightGround.castShadow = false
  leftPromenade.castShadow = false
}
