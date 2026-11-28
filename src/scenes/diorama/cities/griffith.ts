import * as THREE from 'three'
import { createMat, createMiniCar, enableShadows, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import {
  buildContinuousRailing,
  createCityPbrMaterials,
  createGlidingBirds,
  type CityRailSegment,
} from './cityKit'
import {
  createGriffithObservatory,
  createGriffithPalette,
  createHollywoodSign,
  createJazzGrandPiano,
  createLaLaLandDancers,
  createPlanetariumCanopy,
  createVintageStreetLamp,
} from './griffithAssets'
import { createParisianBench } from './parisAssets'

/**
 * 洛杉矶 · 格里菲斯天文台 × 爱乐之城（1:1 原生米制紫金暮光重造）：
 * - 前景站在山坡观景石台（Cathy's Corner 意象）：复古双头铸铁灯下，明黄礼服与深蓝西装并肩共舞，一旁摆着黑漆大三角钢琴；
 * - 右前方坐落 Art Deco 象牙白「格里菲斯天文台」与三座青铜铜绿穹顶、天文学家方尖碑及星空投影环；
 * - 正前方断崖下方铺开无垠紫金洛杉矶城市灯海、高架流光车河与左后方山脊「HOLLYWOOD」经典白标牌。
 */
export function buildGriffithCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'griffith-lalaland-scene'

  const TERRACE_Y = 0.55
  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createGriffithPalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 好莱坞山地貌与远景紫金洛杉矶霓虹盆地（horizon-mountains, variant = 'griffith'）
  // -------------------------------------------------------------------------
  const hillsideMat = createMat('#473b4f', {
    roughness: 0.94,
    bumpMap: ctx.textures.plasterBump,
    bumpScale: 0.04,
  })
  const terraceMat = applyPbrSet(
    createMat('#cbb79c', { roughness: 0.86, bumpMap: ctx.textures.darkStoneTex, bumpScale: 0.03 }),
    'limestone',
    16,
    10,
  )

  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), hillsideMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -6.2, -55)
  openGround.receiveShadow = true
  g.add(openGround)

  // Rolling Santa Monica / Mount Hollywood ridge framing left-back (Hollywood sign) & right-mid (Observatory hill)
  const hills = new THREE.Group()
  hills.name = 'griffith-hollywood-hills'
  const hillGeo = new THREE.PlaneGeometry(340, 260, 96, 72)
  hillGeo.rotateX(-Math.PI / 2)
  const hPos = hillGeo.attributes.position
  const hCol = new Float32Array(hPos.count * 3)
  const colLow = new THREE.Color('#271e36')
  const colMid = new THREE.Color('#64496a')
  const tmpCol = new THREE.Color()

  for (let i = 0; i < hPos.count; i += 1) {
    const wx = hPos.getX(i)
    const wz = hPos.getZ(i) - 65
    // Foreground hilltop knoll under overlook terrace + tight Observatory knoll + Mount Lee ridge
    const obsHill = Math.exp(-Math.pow((wx - 16.0) / 36, 2) - Math.pow((wz + 46) / 30, 2)) * 9.8
    const fgRidge = Math.exp(-Math.pow(wx / 28, 2) - Math.pow((wz - 12) / 11, 2)) * 6.8
    const mountLee = Math.exp(-Math.pow((wx + 14) / 22, 2) - Math.pow((wz + 84) / 20, 2)) * 21.5
    const backRidge = Math.exp(-Math.pow((wz + 150) / 24, 2)) * (9.5 + Math.sin(wx * 0.045) * 4.5)
    const h = Math.max(-6.3, Math.max(obsHill, fgRidge, mountLee, backRidge) - 6.2)
    hPos.setY(i, h)
    tmpCol.copy(colLow).lerp(colMid, Math.min(1, Math.max(0, (h + 6.2) / 19)))
    hCol[i * 3] = tmpCol.r
    hCol[i * 3 + 1] = tmpCol.g
    hCol[i * 3 + 2] = tmpCol.b
  }
  hillGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3))
  hillGeo.computeVertexNormals()
  const hillMesh = new THREE.Mesh(
    hillGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }),
  )
  hillMesh.position.set(0, 0, -65)
  hills.add(hillMesh)
  g.add(hills)

  // Full crisp HOLLYWOOD sign mounted high in open sky gap between streetlamp & Observatory
  const hollywoodSign = createHollywoodSign(palette)
  hollywoodSign.position.set(-13.5, 16.2, -84)
  hollywoodSign.scale.setScalar(0.86)
  hollywoodSign.rotation.y = 0.16
  g.add(hollywoodSign)

  // -------------------------------------------------------------------------
  // 2. 前景《爱乐之城》山坡石台 + 镶铜石缝线脚 + 复古路灯 + 共舞双像 + 大三角钢琴
  // -------------------------------------------------------------------------
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(44, 1.35, 16), terraceMat)
  terrace.name = 'griffith-overlook-terrace'
  terrace.userData.foregroundDeck = true
  terrace.position.set(0, TERRACE_Y - 0.675, 12)
  terrace.receiveShadow = true
  g.add(terrace)

  // Art Deco radial travertine stone inlay ribs + warm amber spotlight pool beneath streetlamp/dancers
  for (const sx of [-6.0, -1.5, 3.0, 7.5]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 15.6), palette.bronze)
    seam.position.set(sx, TERRACE_Y + 0.01, 12)
    g.add(seam)
  }
  const lampLightPool = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 28),
    createMat('#ffcf78', { emissive: '#ffaa44', emissiveIntensity: 0.42, transparent: true, opacity: 0.28 }),
  )
  lampLightPool.rotation.x = -Math.PI / 2
  lampLightPool.position.set(-3.4, TERRACE_Y + 0.015, 5.5)
  g.add(lampLightPool)

  // Wrought-iron hillside overlook railings (continuous along edge looking down onto LA lights)
  const rails: CityRailSegment[] = [
    { from: [-21.5, TERRACE_Y, 4.25], to: [1.2, TERRACE_Y, 4.25] },
    { from: [6.8, TERRACE_Y, 4.25], to: [21.5, TERRACE_Y, 4.25] },
  ]
  buildContinuousRailing(g, rails, 'iron')

  // Connecting Esplanade bridge starting cleanly at z = 4.0 (no terrace overlap seam)
  const esplanadeWalk = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.7, 36), terraceMat)
  esplanadeWalk.position.set(8.5, TERRACE_Y + 0.12, -14.2)
  esplanadeWalk.rotation.y = -0.26
  esplanadeWalk.rotation.x = -0.045
  esplanadeWalk.receiveShadow = true
  g.add(esplanadeWalk)

  // *A Lovely Night* cast-iron streetlamp + unclipped bench + sculpted Mia & Sebastian dancers
  const { lamp, halos: lampHalos } = createVintageStreetLamp(palette, ctx.textures.glowHalo)
  lamp.position.set(-4.4, TERRACE_Y, 5.1)
  g.add(lamp)

  const bench = createParisianBench()
  bench.position.set(-0.2, TERRACE_Y, 5.25)
  bench.rotation.y = Math.PI
  g.add(bench)

  const dancers = createLaLaLandDancers(palette)
  dancers.position.set(-3.0, TERRACE_Y, 5.8)
  dancers.rotation.y = 0.25
  g.add(dancers)

  // Jazz grand piano on right-foreground overlook terrace
  const grandPiano = createJazzGrandPiano(palette)
  grandPiano.position.set(3.4, TERRACE_Y, 5.5)
  grandPiano.scale.setScalar(1.06)
  grandPiano.rotation.y = -0.58
  g.add(grandPiano)

  // Floating golden-pink musical notes above the dancers & piano
  const noteSprites: THREE.Mesh[] = []
  const noteGroup = new THREE.Group()
  for (let i = 0; i < 12; i += 1) {
    const note = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), palette.noteGold)
    note.position.set(
      (i % 2 === 0 ? -3.0 : 3.5) + Math.sin(i * 1.9) * 1.2,
      TERRACE_Y + 2.2 + (i % 4) * 0.65,
      5.6 + Math.cos(i * 2.1) * 0.8,
    )
    noteGroup.add(note)
    noteSprites.push(note)
  }
  g.add(noteGroup)

  // -------------------------------------------------------------------------
  // 3. 右前方 1:1 格里菲斯天文台三穹顶建筑 + 星象投影环 + 山下洛杉矶百万紫金灯海
  // -------------------------------------------------------------------------
  const { observatory, mainHalo, wingHalos } = createGriffithObservatory(palette, ctx.textures.glowHalo)
  observatory.position.set(16.0, 2.1, -46)
  observatory.scale.setScalar(0.88)
  observatory.rotation.y = -0.48
  g.add(observatory)

  const canopy = createPlanetariumCanopy(palette)
  canopy.position.set(16.0, 21.8, -46)
  canopy.scale.setScalar(0.88)
  g.add(canopy)

  // Sparkling Los Angeles Valley Cityscape clearly visible across the left-center valley below overlook
  const skylineGroup = new THREE.Group()
  skylineGroup.name = 'horizon-skyline'
  skylineGroup.userData.horizonVariant = 'griffith'

  const towerMat = createMat('#251d36', {
    map: ctx.textures.skyscraperFacadeTex,
    emissive: '#ff96d8',
    emissiveIntensity: 0.78,
    roughness: 0.45,
  })
  towerMat.emissiveMap = ctx.textures.skyscraperEmissiveTex
  towerMat.needsUpdate = true
  const towerGeo = new THREE.BoxGeometry(1, 1, 1)
  const towerCount = 96
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < towerCount; i += 1) {
    const u = ((i * 37) % 97) / 97
    const v = ((i * 53) % 97) / 97
    const bx = -56 + u * 64
    const bz = -36 - v * 78
    const isDowntown = Math.hypot(bx + 24, bz + 76) < 16
    const bh = isDowntown ? 4.8 + ((i * 19) % 6) : 1.6 + ((i * 11) % 3.4)
    const bw = isDowntown ? 2.6 : 2.0
    dummy.position.set(bx, -6.2 + bh * 0.5, bz)
    dummy.scale.set(bw, bh, bw)
    dummy.rotation.y = ((i % 7) - 3) * 0.08
    dummy.updateMatrix()
    towers.setMatrixAt(i, dummy.matrix)
  }
  skylineGroup.add(towers)

  // Glowing LA grid avenues & freeway traffic light trails in the valley below
  const streetLightsCount = 360
  const lightPos = new Float32Array(streetLightsCount * 3)
  const lightCol = new Float32Array(streetLightsCount * 3)
  const cGold = new THREE.Color('#ffd478')
  const cMagenta = new THREE.Color('#ff7ed4')
  const cCyan = new THREE.Color('#80e8ff')
  for (let i = 0; i < streetLightsCount; i += 1) {
    const gx = ((i * 29) % 114) - 66
    const gz = -22 - ((i * 43) % 98)
    lightPos[i * 3] = gx
    lightPos[i * 3 + 1] = -5.75
    lightPos[i * 3 + 2] = gz
    const col = i % 5 === 0 ? cCyan : i % 3 === 0 ? cMagenta : cGold
    lightCol[i * 3] = col.r
    lightCol[i * 3 + 1] = col.g
    lightCol[i * 3 + 2] = col.b
  }
  const lightGeo = new THREE.BufferGeometry()
  lightGeo.setAttribute('position', new THREE.BufferAttribute(lightPos, 3))
  lightGeo.setAttribute('color', new THREE.BufferAttribute(lightCol, 3))
  const valleyLights = new THREE.Points(
    lightGeo,
    new THREE.PointsMaterial({
      size: 0.95,
      vertexColors: true,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    }),
  )
  skylineGroup.add(valleyLights)

  // Moving boulevard cars down in the LA basin
  const boulevardCars: Array<{ mesh: THREE.Object3D; dir: number; baseX: number; speed: number }> = []
  for (let i = 0; i < 6; i += 1) {
    const car = createMiniCar(i % 2 === 0 ? '#ffd880' : '#ff86c8')
    car.scale.setScalar(1.35)
    car.position.set(-40 + i * 14, -6.0, -34 - (i % 3) * 14)
    const dir = i % 2 === 0 ? 1 : -1
    car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
    skylineGroup.add(car)
    boulevardCars.push({ mesh: car, dir, baseX: -54, speed: 5.5 + i * 0.7 })
  }
  g.add(skylineGroup)

  // Overhead stars & La La Land lavender-gold stardust particles
  const starSprites: THREE.Sprite[] = []
  for (let i = 0; i < 14; i += 1) {
    const s = makeGlowSprite(ctx.textures.glowHalo, i % 2 === 0 ? '#ffe8b8' : '#dca8ff', 2.4, 0.25)
    s.position.set(-45 + ((i * 19) % 90), 22 + (i % 5) * 3.5, -35 - ((i * 13) % 55))
    g.add(s)
    starSprites.push(s)
  }

  // -------------------------------------------------------------------------
  // 4. 三重奇遇（lamp / dome / skyline）、高地观景锚点与连续漫步采样
  // -------------------------------------------------------------------------
  let waltzSpinSpeed = 0.28

  const awakenLampWaltz = () => {
    waltzSpinSpeed = 1.15
    palette.lampGlow.emissiveIntensity = 2.4
    palette.noteGold.emissiveIntensity = 1.9
    palette.pianoIvory.emissiveIntensity = 0.55
    lampHalos.forEach((h) => { h.material.opacity = 0.88 })
    ctx.discoverEncounter('lamp')
    return { label: '星夜双人舞路灯与大三角钢琴齐亮 · 爵士琴声伴着黄裙华尔兹升起', sfx: 'lamp' as const }
  }

  const awakenPlanetariumDome = () => {
    palette.windowWarm.emissiveIntensity = 1.55
    palette.copperDome.emissiveIntensity = 0.55
    mainHalo.material.opacity = 0.72
    wingHalos.forEach((h) => { h.material.opacity = 0.75 })
    ctx.discoverEncounter('dome')
    return { label: '格里菲斯青铜穹顶与《爱乐之城》星象天穹齐亮', sfx: 'star' as const }
  }

  const awakenCityNeon = () => {
    towerMat.emissiveIntensity = 1.55
    palette.hollywoodWhite.emissiveIntensity = 1.15
    starSprites.forEach((s) => { s.material.opacity = 0.85 })
    ctx.discoverEncounter('skyline')
    return { label: '百万点洛杉矶紫金霓虹夜海与 HOLLYWOOD 山脊标牌点亮', sfx: 'lamp' as const }
  }

  ctx.registerInteractive(lamp, {
    encounterId: 'lamp',
    focusPoint: new THREE.Vector3(-4.3, 3.0, 5.1),
    onClick: awakenLampWaltz,
  })
  ctx.registerInteractive(dancers, {
    encounterId: 'lamp',
    focusPoint: new THREE.Vector3(-3.0, 2.0, 5.8),
    onClick: awakenLampWaltz,
  })
  ctx.registerInteractive(grandPiano, {
    encounterId: 'lamp',
    focusPoint: new THREE.Vector3(3.5, 1.5, 5.6),
    onClick: awakenLampWaltz,
  })
  ctx.registerInteractive(observatory, {
    encounterId: 'dome',
    focusPoint: new THREE.Vector3(16.0, 11.5, -46),
    onClick: awakenPlanetariumDome,
  })
  ctx.registerInteractive(skylineGroup, {
    encounterId: 'skyline',
    focusPoint: new THREE.Vector3(-12, 0, -64),
    onClick: awakenCityNeon,
  })
  ctx.registerInteractive(hollywoodSign, {
    encounterId: 'skyline',
    focusPoint: new THREE.Vector3(-18.5, 12.8, -76),
    onClick: awakenCityNeon,
  })

  ctx.setFinaleTrigger(() => {
    awakenLampWaltz()
    awakenPlanetariumDome()
    awakenCityNeon()
  })

  ctx.setVantageAnchor?.({
    label: '好莱坞山脊制高点 · 俯瞰天文台与洛杉矶灯海',
    pos: [38, 15.8, -6],
    yaw: 0.72,
    pitch: -0.14,
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 22 && z >= 4 && z <= 20) return TERRACE_Y
    if (x >= 1 && x <= 14 && z >= -22 && z < 4) return TERRACE_Y
    return null
  })

  const tickBirds = createGlidingBirds(g, [-4, 24, -46], 28, 4)

  ctx.addTick((t, dt) => {
    tickBirds(t)
    waltzSpinSpeed = THREE.MathUtils.lerp(waltzSpinSpeed, 0.28, dt * 0.25)
    dancers.rotation.y += dt * waltzSpinSpeed
    canopy.rotation.y += dt * 0.14

    noteSprites.forEach((n, idx) => {
      n.position.y = TERRACE_Y + 2.1 + ((t * 0.45 + idx * 0.35) % 2.4)
      n.rotation.y = t * 1.4 + idx
    })

    for (const c of boulevardCars) {
      const span = 110
      const prog = ((t * c.speed) % span)
      c.mesh.position.x = c.dir > 0 ? c.baseX + prog : -c.baseX - prog
    }
  })

  ctx.addMoodHook((mood) => {
    const isNight = mood === 'night'
    const duskBoost = mood === 'dusk' ? 1.0 : 0.45
    towerMat.emissiveIntensity = isNight ? 1.55 : 0.85 * duskBoost
    palette.windowWarm.emissiveIntensity = isNight ? 1.35 : 0.65
    palette.lampGlow.emissiveIntensity = isNight ? 2.1 : 1.35
    starSprites.forEach((s) => {
      s.material.opacity = isNight ? 0.85 : mood === 'dusk' ? 0.32 : 0.05
    })
  })

  enableShadows(g, true, true)
  openGround.castShadow = false
  hillMesh.castShadow = false
  terrace.castShadow = false
  esplanadeWalk.castShadow = false
  valleyLights.castShadow = false
  towers.castShadow = false
}

export const buildGriffith = buildGriffithCity
