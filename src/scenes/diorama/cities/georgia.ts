import * as THREE from 'three'
import { buildSceneWater, createMat, enableShadows } from '../materials'
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
  createColossalSword,
  createGeorgiaPalette,
  createGeorgianCrossPillar,
  createSvanWatchtower,
  createSwordTwinPeaks,
  createTrinitySanctuary,
} from './georgiaAssets'
import { createKyotoCedar } from './kyotoAssets'
import { createParisianBench } from './parisAssets'

/**
 * 格鲁吉亚 · 圣剑双峰（1:1 原生米制高加索重构）：
 * - 前景悬崖石砌祈祷露台（带十字圣碑与木长椅）俯瞰高加索冰川镜湖（Reflector 实时倒影）；
 * - 右前方石堤连通山脊上的「圣三一石砌修道院」与独立钟楼火盆；左前方山谷冷杉林中矗立四座「斯瓦涅季古石碉楼」；
 * - 正北方高加索乌什巴「双刃圣剑雪峰」（~112 m）直刺破晓粉金天穹，日照金山倾泻山谷。
 */
export function buildGeorgiaCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'georgia-ushba-peaks-scene'

  const PROMENADE_Y = 0.65
  const WATER_Y = -0.35
  const SANCTUARY_X = 24
  const SANCTUARY_Z = -34

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createGeorgiaPalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 1:1 高加索高山苔草谷地 + 悬崖露台 + 连通石堤
  // -------------------------------------------------------------------------
  const alpineGrassMat = applyPbrSet(
    createMat('#344a32', { roughness: 0.94, bumpMap: ctx.textures.plasterBump, bumpScale: 0.04 }),
    'grass',
    28,
    28,
  )

  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), alpineGrassMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -0.02, -45)
  openGround.receiveShadow = true
  g.add(openGround)

  // Undulating flanking Caucasus valley ridges tapering cleanly below openGround on margins
  const sampleValleyY = (wx: number, wz: number) => {
    const pondClear = Math.min(1, Math.max(0, (Math.hypot(wx * 0.65, (wz + 11) * 0.95) - 22) / 14))
    const leftSlope = Math.exp(-Math.pow((wx + 58) / 36, 2) - Math.pow((wz + 28) / 48, 2)) * 12.5
    const rightSlope = Math.exp(-Math.pow((wx - 64) / 38, 2) - Math.pow((wz + 26) / 48, 2)) * 11.0
    const sanctKnoll = Math.exp(-Math.pow((wx - SANCTUARY_X) / 22, 2) - Math.pow((wz - SANCTUARY_Z) / 18, 2)) * 1.15
    const edgeFade = Math.max(0, 1 - Math.pow(Math.hypot(wx, wz + 40) / 145, 3))
    return (leftSlope + rightSlope) * pondClear * edgeFade + sanctKnoll - (1 - edgeFade) * 0.45
  }
  const valleyGeo = new THREE.PlaneGeometry(290, 240, 72, 60)
  valleyGeo.rotateX(-Math.PI / 2)
  const vPos = valleyGeo.attributes.position
  for (let i = 0; i < vPos.count; i += 1) {
    const wx = vPos.getX(i)
    const wz = vPos.getZ(i) - 42
    vPos.setY(i, sampleValleyY(wx, wz))
  }
  valleyGeo.computeVertexNormals()
  const valleyMesh = new THREE.Mesh(valleyGeo, alpineGrassMat)
  valleyMesh.position.set(0, 0, -42)
  valleyMesh.receiveShadow = true
  g.add(valleyMesh)

  // Foreground slate overlook terrace (x: -24..+24, z: 7..22)
  const cliffTerrace = new THREE.Mesh(new THREE.BoxGeometry(48, 1.35, 15), palette.slateRoof)
  cliffTerrace.name = 'georgia-cliff-prayer-terrace'
  cliffTerrace.userData.foregroundDeck = true
  cliffTerrace.position.set(0, PROMENADE_Y - 0.675, 14.5)
  cliffTerrace.receiveShadow = true
  g.add(cliffTerrace)

  const terraceCurb = new THREE.Mesh(new THREE.BoxGeometry(48.6, 1.4, 0.9), palette.granite)
  terraceCurb.position.set(0, 0.0, 7.0)
  g.add(terraceCurb)

  // Stone causeway connecting overlook terrace to the Sanctuary knoll (x = 18.5, z = 7..-26)
  const causeway = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.5, 34), palette.granite)
  causeway.position.set(18.5, PROMENADE_Y - 0.55, -9.5)
  causeway.receiveShadow = true
  g.add(causeway)

  const sanctuaryApron = new THREE.Mesh(new THREE.BoxGeometry(28, 1.75, 24), palette.granite)
  sanctuaryApron.position.set(SANCTUARY_X, PROMENADE_Y - 0.25, SANCTUARY_Z)
  sanctuaryApron.receiveShadow = true
  g.add(sanctuaryApron)

  const rails: CityRailSegment[] = [
    { from: [-23.5, PROMENADE_Y, 7.2], to: [15.5, PROMENADE_Y, 7.2] },
    { from: [21.5, PROMENADE_Y, 7.2], to: [23.5, PROMENADE_Y, 7.2] },
  ]
  buildContinuousRailing(g, rails, 'stone')

  const crossPillar = createGeorgianCrossPillar(palette)
  crossPillar.position.set(-7.5, PROMENADE_Y, 9.2)
  g.add(crossPillar)

  const bench = createParisianBench()
  bench.position.set(3.2, PROMENADE_Y, 9.8)
  bench.rotation.y = Math.PI
  g.add(bench)

  // -------------------------------------------------------------------------
  // 2. 高山冰川镜湖（Reflector）+ 岸石苇草
  // -------------------------------------------------------------------------
  const glacialTarn = buildSceneWater(ctx, {
    width: 68,
    depth: 32,
    x: -4,
    y: WATER_Y,
    z: -10,
    deepHex: '#153447',
    shallowHex: '#43768c',
    fadeRadius: 92,
    reflective: true,
  })
  glacialTarn.mesh.name = 'georgia-glacial-tarn'
  ctx.bindWater(
    (x, z) => glacialTarn.setRipple(x, z),
    (bio) => glacialTarn.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      glacialTarn.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) glacialTarn.uniforms.uSunCol.value.set(sunHex)
      if (sunDir) glacialTarn.uniforms.uSunDir.value.set(...sunDir).normalize()
    },
  )

  const rockMat = createMat('#5d646b', { roughness: 0.92, flatShading: true })
  for (const [rx, rz, sc] of [
    [-16, 6.2, 1.4],
    [-26, -4, 1.8],
    [-24, -22, 1.6],
    [4, 5.4, 1.1],
    [18, 4.2, 1.5],
    [22, -16, 1.7],
  ] as [number, number, number][]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), rockMat)
    r.scale.set(1.4, 0.72, 1.1)
    r.position.set(rx, WATER_Y + sc * 0.3, rz)
    g.add(r)
  }
  for (const [rx, rz] of [[-14.5, 5.6], [2.8, 4.8], [-22.5, -18.5], [16.5, -14.2]] as [number, number][]) {
    const reed = createShoreReedClump()
    reed.scale.setScalar(1.3)
    reed.position.set(rx, WATER_Y + 0.08, rz)
    g.add(reed)
  }

  // -------------------------------------------------------------------------
  // 3. 圣三一石砌修道院 + 四座斯瓦涅季古石碉楼 + 高加索乌什巴双子圣剑雪峰
  // -------------------------------------------------------------------------
  const { sanctuary, halos: sanctHalos, flame } = createTrinitySanctuary(
    palette,
    ctx.textures.glowHalo,
  )
  sanctuary.position.set(SANCTUARY_X, PROMENADE_Y + 0.62, SANCTUARY_Z)
  g.add(sanctuary)

  const towerSpecs: [number, number, number][] = [
    [-26, -32, 20.5],
    [-36, -42, 17.5],
    [-19, -46, 16.0],
    [-32, -56, 19.0],
  ]
  const towerHalos: THREE.Sprite[] = []
  const towersGroup = new THREE.Group()
  towersGroup.name = 'georgia-svaneti-towers'
  for (const [tx, tz, th] of towerSpecs) {
    const { tower, halo } = createSvanWatchtower(palette, ctx.textures.glowHalo, th)
    tower.position.set(tx, Math.max(0, sampleValleyY(tx, tz)) - 0.2, tz)
    towersGroup.add(tower)
    towerHalos.push(halo)
  }
  g.add(towersGroup)

  const { massif: twinPeaks, peakHalo } = createSwordTwinPeaks(ctx.textures.glowHalo)
  g.add(twinPeaks)

  // Didgori Monument: 15 colossal bronze-steel broadswords plunged across the central ridge & flanks!
  const swordGroup = new THREE.Group()
  swordGroup.name = 'georgia-didgori-sword-field'
  const swordMound = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 13.5, 1.6, 20), palette.granite)
  swordMound.position.set(-2, 0.8, -36)
  swordGroup.add(swordMound)

  const swordHalos: THREE.Sprite[] = []
  const swordRuneMats: THREE.MeshStandardMaterial[] = []
  const swordSpecs: [number, number, number, number, number][] = [
    [-2, -36, 28, 0, 0],
    [-9.5, -33, 19, 0.06, 0.09],
    [5.5, -33, 20, 0.05, -0.08],
    [-7.5, -41, 21, -0.06, 0.07],
    [4.0, -41, 18.5, -0.05, -0.06],
    [-14.5, -38, 16.5, 0.03, 0.11],
    [9.8, -38, 17, 0.04, -0.1],
    [-18, -48, 22, -0.07, 0.05],
    [-6, -50, 24, -0.04, -0.03],
    [7, -51, 21, -0.06, 0.04],
    [-28, -44, 17.5, 0.05, 0.12],
    [16, -48, 19, -0.04, -0.09],
    [-12, -59, 20.5, 0.04, 0.06],
    [2, -62, 23, -0.05, -0.05],
    [18, -58, 18, 0.03, -0.08],
  ]
  swordSpecs.forEach(([sx, sz, sh, tx, tz]) => {
    const { sword, runeGlowMat, halo } = createColossalSword(palette, ctx.textures.glowHalo, sh, tx, tz)
    const sy = Math.max(0.4, sampleValleyY(sx, sz))
    sword.position.set(sx, sy, sz)
    swordGroup.add(sword)
    swordHalos.push(halo)
    swordRuneMats.push(runeGlowMat)
  })
  g.add(swordGroup)

  // Caucasus alpine cedar & fir forest framing the valley flanks
  const pinePositions: [number, number, number][] = [
    [-28, 10, 10.2], [-34, -8, 11.4], [-42, -20, 12.6], [-45, -36, 13.0], [-42, -54, 12.2],
    [-14, -56, 11.5], [-4, -58, 12.8], [32, -48, 11.6], [40, -32, 10.8], [38, -18, 10.4],
    [28, 10, 11.0], [-52, -46, 13.4], [40, -44, 12.5], [-20, -68, 13.5], [14, -68, 12.9],
    [-58, -24, 12.0], [46, -24, 11.8], [6, -74, 13.2], [-36, -72, 13.6], [28, -68, 12.4],
  ]
  pinePositions.forEach(([cx, cz, ch], idx) => {
    const tree = createKyotoCedar(ch, idx)
    tree.position.set(cx, Math.max(0, sampleValleyY(cx, cz)) - 0.15, cz)
    g.add(tree)
  })

  // Crisp alpine spindrift snow & golden morning mist motes
  const moteCount = 160
  const motePos = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i += 1) {
    const a = i * 2.399963
    const r = 6 + ((i * 19) % 58)
    motePos[i * 3] = Math.cos(a) * r
    motePos[i * 3 + 1] = 1.2 + ((i * 13) % 18) * 1.15
    motePos[i * 3 + 2] = -28 + Math.sin(a) * r * 0.8
  }
  const moteGeo = new THREE.BufferGeometry()
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
  const spindrift = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: '#ffe8d8',
      size: 0.3,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    }),
  )
  g.add(spindrift)

  // -------------------------------------------------------------------------
  // 4. 三重奇遇（sanctuary / towers / peak）、斯瓦涅季高塔观景台与步行高程
  // -------------------------------------------------------------------------
  let alpenglowBoost = 0

  const igniteSanctuary = () => {
    palette.candleGlow.emissiveIntensity = 1.75
    palette.fireEmber.emissiveIntensity = 1.9
    sanctHalos.forEach((h) => { h.material.opacity = 0.78 })
    ctx.discoverEncounter('sanctuary')
    return { label: '圣三一石砌修道院彩窗与火盆燃起 · 暖光照亮高加索晨雾', sfx: 'lamp' as const }
  }

  const igniteTowers = () => {
    towerHalos.forEach((h) => { h.material.opacity = 0.82 })
    ctx.discoverEncounter('towers')
    return { label: '四座斯瓦涅季千年石碉楼守望窗灯次第苏醒', sfx: 'lamp' as const }
  }

  const awakenTwinPeaks = () => {
    alpenglowBoost = 1.4
    peakHalo.material.opacity = 0.65
    swordHalos.forEach((h) => { h.material.opacity = 0.68 })
    swordRuneMats.forEach((m) => { m.emissiveIntensity = 1.75 })
    ctx.triggerRipple(-4, -10)
    glacialTarn.setBio(0.65)
    ctx.discoverEncounter('peak')
    return { label: '圣剑山十五柄巨剑符文与双刃雪峰同时绽放日照金山', sfx: 'snow' as const }
  }

  ctx.registerInteractive(sanctuary, {
    encounterId: 'sanctuary',
    focusPoint: new THREE.Vector3(SANCTUARY_X, PROMENADE_Y + 9, SANCTUARY_Z),
    onClick: igniteSanctuary,
  })
  ctx.registerInteractive(towersGroup, {
    encounterId: 'towers',
    focusPoint: new THREE.Vector3(-26, 14, -32),
    onClick: igniteTowers,
  })
  ctx.registerInteractive(swordGroup, {
    encounterId: 'peak',
    focusPoint: new THREE.Vector3(-2, 16, -36),
    onClick: awakenTwinPeaks,
  })
  ctx.registerInteractive(twinPeaks, {
    encounterId: 'peak',
    focusPoint: new THREE.Vector3(-4, 62, -148),
    onClick: awakenTwinPeaks,
  })
  ctx.registerInteractive(glacialTarn.mesh, {
    encounterId: 'peak',
    focusPoint: new THREE.Vector3(-4, 0.5, -10),
    onClick: awakenTwinPeaks,
  })

  ctx.setFinaleTrigger(() => {
    igniteSanctuary()
    igniteTowers()
    awakenTwinPeaks()
    glacialTarn.setBio(0.92)
  })

  // Svaneti tall watchtower machicolation gallery overlooking Trinity Sanctuary & Twin Peaks
  ctx.setVantageAnchor?.({
    label: '斯瓦涅季高塔顶层 · 俯瞰修道院与圣剑双峰',
    pos: [-26, 22.8, -32],
    yaw: -0.42,
    pitch: 0.04,
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 24 && z >= 7 && z <= 22) return PROMENADE_Y
    if (Math.abs(x - 18.5) <= 2.6 && z >= -26 && z <= 7.5) return PROMENADE_Y + 0.2
    if (Math.abs(x - SANCTUARY_X) <= 13.8 && Math.abs(z - SANCTUARY_Z) <= 11.8) return PROMENADE_Y + 0.62
    return null
  })

  const tickBirds = createGlidingBirds(g, [-4, 34, -52], 32, 4)

  ctx.addTick((t, dt) => {
    tickBirds(t)
    alpenglowBoost = Math.max(0, alpenglowBoost - dt * 0.35)
    flame.scale.setScalar(1 + Math.sin(t * 7.2) * 0.12)
    peakHalo.scale.setScalar(1 + alpenglowBoost * 0.14 + Math.sin(t * 0.8) * 0.02)

    const mAttr = moteGeo.attributes.position as THREE.BufferAttribute
    const wind = 1.1 + alpenglowBoost * 1.8
    for (let i = 0; i < moteCount; i += 1) {
      let x = mAttr.getX(i) + dt * wind
      let y = mAttr.getY(i) - dt * 0.7
      if (x > 55) x = -55
      if (y < WATER_Y + 0.2) y = 20
      mAttr.setXY(i, x, y)
    }
    mAttr.needsUpdate = true
  })

  ctx.addMoodHook((mood) => {
    const isNight = mood === 'night'
    palette.candleGlow.emissiveIntensity = isNight ? 1.55 : mood === 'dusk' ? 0.95 : 0.64
    peakHalo.material.opacity = isNight ? 0.14 : mood === 'dusk' ? 0.28 : 0.42
  })

  enableShadows(g, true, true)
  glacialTarn.mesh.castShadow = false
  openGround.castShadow = false
  valleyMesh.castShadow = false
  cliffTerrace.castShadow = false
  spindrift.castShadow = false
}

export const buildGeorgia = buildGeorgiaCity
