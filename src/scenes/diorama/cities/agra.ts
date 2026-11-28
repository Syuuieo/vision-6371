import * as THREE from 'three'
import { buildSceneWater, createMat, enableShadows, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import {
  buildContinuousRailing,
  createCityPbrMaterials,
  createGlidingBirds,
  type CityRailSegment,
} from './cityKit'
import {
  createSandstonePavilion,
  createTajMausoleum,
  createTajPalette,
  createYamunaSkiff,
} from './agraAssets'
import { createParisianBench } from './parisAssets'
import { createRomanCypress } from './romeAssets'

/**
 * 阿格拉 · 泰姬陵（1:1 原生米制建筑重造）：
 * - 站在查尔巴格莫卧儿四分花园南端红砂岩观景台，沿 62 m 白大理石中轴倒影长池与对称丝柏直望主陵；
 * - 远处高台矗立玛克拉纳白大理石主陵（洋葱莲花主穹顶 + 四角亭 + 尖券 Iwan 大门）、四角宣礼塔及左右红砂岩清真寺；
 * - 陵后亚穆纳河静水东流、游舟缓行（可登舟），步行可沿池畔走上白玉高台仰望主拱门。
 */
export function buildAgraCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'agra-taj-mahal-scene'

  const PROMENADE_Y = 0.65
  const POOL_Y = 0.25
  const RIVER_Y = -0.4
  const TAJ_Z = -88
  const POOL_CENTER_Z = -20

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createTajPalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 1:1 莫卧儿园林大地 + 南端砂岩露台 + 中轴步行道
  // -------------------------------------------------------------------------
  const gardenGrassMat = applyPbrSet(
    createMat('#3e5a39', { roughness: 0.92, bumpMap: ctx.textures.plasterBump, bumpScale: 0.035 }),
    'grass',
    26,
    26,
  )

  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), gardenGrassMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -0.02, -45)
  openGround.receiveShadow = true
  g.add(openGround)

  // South Charbagh foreground terrace (z = 8..26)
  const southTerrace = new THREE.Mesh(new THREE.BoxGeometry(68, 1.35, 18), palette.sandstone)
  southTerrace.name = 'agra-charbagh-south-terrace'
  southTerrace.userData.foregroundDeck = true
  southTerrace.position.set(0, PROMENADE_Y - 0.675, 17)
  southTerrace.receiveShadow = true
  g.add(southTerrace)

  // Symmetric sandstone promenade paths flanking the central reflecting pool (z = -54..+10)
  for (const px of [-9.2, 9.2]) {
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.35, 64), palette.sandstone)
    walkway.position.set(px, PROMENADE_Y - 0.675, -22)
    walkway.receiveShadow = true
    g.add(walkway)
  }

  // Cross-garden red sandstone pathways + Central Raised White-Marble Lotus Chabutra Platform
  const crossPath = new THREE.Mesh(new THREE.BoxGeometry(72, 1.32, 6.2), palette.sandstone)
  crossPath.position.set(0, PROMENADE_Y - 0.68, POOL_CENTER_Z)
  crossPath.receiveShadow = true
  g.add(crossPath)

  const chabutra = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.9, 11.5), palette.marble)
  chabutra.position.set(0, POOL_Y + 0.16, POOL_CENTER_Z)
  chabutra.receiveShadow = true
  g.add(chabutra)
  for (const [bx, bz] of [[-5.6, -4.4], [5.6, -4.4], [-5.6, 4.4], [5.6, 4.4]] as [number, number][]) {
    const cornerFin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.45, 8), palette.marbleTrim)
    cornerFin.position.set(bx, POOL_Y + 0.9, POOL_CENTER_Z + bz)
    g.add(cornerFin)
  }

  // Flowering Mughal garden parterre hedges & sandstone lantern bollards along Charbagh walkways
  const hedgeMat = createMat('#2f4f2c', { roughness: 0.92, flatShading: true })
  const roseBedMat = createMat('#b84c65', { roughness: 0.85, flatShading: true })
  for (let i = 0; i < 6; i += 1) {
    const hz = 3.5 - i * 9.5
    if (Math.abs(hz - POOL_CENTER_Z) < 4.5) continue
    for (const side of [-1, 1]) {
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 5.4), hedgeMat)
      hedge.position.set(side * 13.6, 0.36, hz)
      const blooms = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.32, 4.6), roseBedMat)
      blooms.position.set(side * 13.6, 0.78, hz)
      const lampStand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6), palette.sandstone)
      lampStand.position.set(side * 6.5, PROMENADE_Y + 0.8, hz)
      const lampCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.42, 6), palette.diyaGlow)
      lampCap.position.set(side * 6.5, PROMENADE_Y + 1.75, hz)
      g.add(hedge, blooms, lampStand, lampCap)
    }
  }

  // Low white marble coping borders along foreground terrace & reflecting pool edges
  const poolRails: CityRailSegment[] = [
    { from: [-32, PROMENADE_Y, 8.4], to: [-12.5, PROMENADE_Y, 8.4] },
    { from: [12.5, PROMENADE_Y, 8.4], to: [32, PROMENADE_Y, 8.4] },
  ]
  buildContinuousRailing(g, poolRails, 'stone')

  for (const [bx, rotY] of [[-11, Math.PI], [11, Math.PI], [-9.2, Math.PI * 0.5], [9.2, -Math.PI * 0.5]] as [number, number][]) {
    const bench = createParisianBench()
    bench.position.set(bx, PROMENADE_Y, Math.abs(rotY) > 2 ? 12.2 : -8)
    bench.rotation.y = rotY
    g.add(bench)
  }

  // -------------------------------------------------------------------------
  // 2. 查尔巴格 62 m 中轴白大理石倒影长池（Reflector）+ 亚穆纳河
  // -------------------------------------------------------------------------
  const poolW = 10.8
  const poolD = 61
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.92, poolD + 1.4), palette.marble)
    curb.position.set(side * (poolW * 0.5 + 0.45), POOL_Y + 0.28, POOL_CENTER_Z)
    g.add(curb)
  }
  for (const endZ of [POOL_CENTER_Z - poolD * 0.5, POOL_CENTER_Z + poolD * 0.5]) {
    const endCurb = new THREE.Mesh(new THREE.BoxGeometry(poolW + 1.8, 0.92, 0.9), palette.marble)
    endCurb.position.set(0, POOL_Y + 0.28, endZ)
    g.add(endCurb)
  }

  const mirrorPool = buildSceneWater(ctx, {
    width: poolW,
    depth: poolD,
    x: 0,
    y: POOL_Y,
    z: POOL_CENTER_Z,
    deepHex: '#1b3d4a',
    shallowHex: '#4f7f8c',
    fadeRadius: 85,
    reflective: true,
  })
  mirrorPool.mesh.name = 'agra-charbagh-mirror-pool'

  // Tranquil Yamuna River flowing behind the marble plinth (z = -128..-212)
  const yamunaRiver = buildSceneWater(ctx, {
    width: 420,
    depth: 86,
    x: 0,
    y: RIVER_Y,
    z: -172,
    deepHex: '#163547',
    shallowHex: '#3f6d80',
    fadeRadius: 210,
    reflective: true,
  })
  yamunaRiver.mesh.name = 'agra-yamuna-river'

  ctx.bindWater(
    (x, z) => {
      mirrorPool.setRipple(x, z)
      yamunaRiver.setRipple(x, z)
    },
    (bio) => {
      mirrorPool.setBio(bio)
      yamunaRiver.setBio(bio)
    },
    (fogHex, sunHex, sunDir) => {
      mirrorPool.uniforms.uFogColor.value.set(fogHex)
      yamunaRiver.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) {
        mirrorPool.uniforms.uSunCol.value.set(sunHex)
        yamunaRiver.uniforms.uSunCol.value.set(sunHex)
      }
      if (sunDir) {
        mirrorPool.uniforms.uSunDir.value.set(...sunDir).normalize()
        yamunaRiver.uniforms.uSunDir.value.set(...sunDir).normalize()
      }
    },
  )

  // Floating Mughal Diya oil lamps & pool fountain jets down the center spine
  const poolDiyas: { grp: THREE.Group; mat: THREE.MeshStandardMaterial; halo: THREE.Sprite; oz: number; ox: number; phase: number }[] = []
  for (let i = 0; i < 12; i += 1) {
    const dz = 6 - i * 4.7
    if (Math.abs(dz - POOL_CENTER_Z) < 6.4) continue
    const dx = i % 2 === 0 ? -1.8 : 1.8
    const diya = new THREE.Group()
    diya.position.set(dx, POOL_Y + 0.03, dz)
    const dMat = palette.diyaGlow.clone()
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.16, 0.14, 10), dMat)
    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffd078', 1.6, 0.34)
    halo.position.y = 0.22
    diya.add(cup, halo)
    g.add(diya)
    poolDiyas.push({ grp: diya, mat: dMat, halo, oz: dz, ox: dx, phase: i * 0.75 })
  }

  // -------------------------------------------------------------------------
  // 3. 1:1 泰姬陵白大理石主陵 + 四座宣礼塔 + 对称红砂岩清真寺 & 亚穆纳河游舟
  // -------------------------------------------------------------------------
  const { taj, plinthTop, mainHalos, minaretHalos } = createTajMausoleum(palette, ctx.textures.glowHalo)
  taj.position.set(0, PROMENADE_Y, TAJ_Z)
  g.add(taj)

  const { pavilion: masjid, halo: masjidHalo } = createSandstonePavilion(palette, ctx.textures.glowHalo)
  masjid.position.set(-60, PROMENADE_Y, TAJ_Z)
  g.add(masjid)

  const { pavilion: jawab, halo: jawabHalo } = createSandstonePavilion(palette, ctx.textures.glowHalo)
  jawab.position.set(60, PROMENADE_Y, TAJ_Z)
  jawab.rotation.y = Math.PI
  g.add(jawab)

  const { boat: yamunaBoat, wake: boatWake } = createYamunaSkiff(palette, ctx.textures.glowHalo)
  yamunaBoat.position.set(-16, RIVER_Y + 0.05, -148)
  g.add(yamunaBoat)

  // -------------------------------------------------------------------------
  // 4. 对称丝柏林荫大道与远岸阿格拉红砂岩城堡天际线
  // -------------------------------------------------------------------------
  for (let i = 0; i < 8; i += 1) {
    const cz = 6 - i * 8.0
    for (const side of [-1, 1]) {
      const cyp = createRomanCypress(9.5 + (i % 3) * 0.8, i)
      cyp.position.set(side * 14.5, 0, cz)
      g.add(cyp)
    }
  }
  for (const [cx, cz] of [
    [-34, 4], [34, 4], [-38, -28], [38, -28], [-44, -52], [44, -52], [-76, -86], [76, -86],
  ] as [number, number][]) {
    const outerCyp = createRomanCypress(11.5, cx)
    outerCyp.position.set(cx, 0, cz)
    g.add(outerCyp)
  }

  // Far Yamuna riverbank lush tree silhouettes & Agra pavilion domes (horizon-skyline, variant = 'agra')
  const skyline = new THREE.Group()
  skyline.name = 'horizon-skyline'
  skyline.userData.horizonVariant = 'agra'
  for (let i = -4; i <= 4; i += 1) {
    const cx = i * 38
    const cz = -224 - Math.abs(i) * 5
    const tree = createRomanCypress(14 + (Math.abs(i) % 3) * 2, i)
    tree.position.set(cx, 0, cz)
    skyline.add(tree)
    if (i % 2 === 0) {
      const domeBase = new THREE.Mesh(new THREE.BoxGeometry(12, 4.8, 10), palette.sandstone)
      domeBase.position.set(cx + 16, 2.4, cz - 4)
      const miniDome = new THREE.Mesh(new THREE.SphereGeometry(3.8, 14, 10), palette.marbleTrim)
      miniDome.position.set(cx + 16, 6.2, cz - 4)
      skyline.add(domeBase, miniDome)
    }
  }
  g.add(skyline)

  // Floating lotus-pink & warm gold morning dust motes over Charbagh garden
  const petalCount = 130
  const petalPos = new Float32Array(petalCount * 3)
  for (let i = 0; i < petalCount; i += 1) {
    const a = i * 2.399963
    const r = 6 + ((i * 19) % 58)
    petalPos[i * 3] = Math.cos(a) * r * 0.72
    petalPos[i * 3 + 1] = 1.4 + ((i * 11) % 18) * 1.15
    petalPos[i * 3 + 2] = -38 + Math.sin(a) * r
  }
  const petalGeo = new THREE.BufferGeometry()
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3))
  const lotusMotes = new THREE.Points(
    petalGeo,
    new THREE.PointsMaterial({
      color: '#ffdcb8',
      size: 0.34,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  )
  g.add(lotusMotes)

  // -------------------------------------------------------------------------
  // 5. 三重探索奇遇（dome / minarets / pool）、观景高台与游舟乘骑
  // -------------------------------------------------------------------------
  let poolPulse = 0

  const igniteDome = () => {
    palette.warmGlow.emissiveIntensity = 1.65
    mainHalos.forEach((h) => { h.material.opacity = 0.72 })
    ctx.discoverEncounter('dome')
    return { label: '玛克拉纳白大理石主陵亮起柔暖金辉 · 倒影映满长池', sfx: 'lamp' as const }
  }

  const igniteMinarets = () => {
    minaretHalos.forEach((h) => { h.material.opacity = 0.78 })
    masjidHalo.material.opacity = 0.65
    jawabHalo.material.opacity = 0.65
    ctx.discoverEncounter('minarets')
    return { label: '四座白玉宣礼塔与红砂岩清真寺圆顶同辉', sfx: 'lamp' as const }
  }

  const ignitePool = () => {
    poolPulse = 1.2
    ctx.triggerRipple(0, POOL_CENTER_Z)
    mirrorPool.setBio(0.62)
    yamunaRiver.setBio(0.52)
    poolDiyas.forEach((d) => {
      d.mat.emissiveIntensity = 1.85
      d.halo.material.opacity = 0.88
    })
    ctx.discoverEncounter('pool')
    return { label: '中轴长池十二盏油灯与亚穆纳河莲光水波同步苏醒', sfx: 'ripple' as const }
  }

  ctx.registerInteractive(taj, {
    encounterId: 'dome',
    focusPoint: new THREE.Vector3(0, PROMENADE_Y + 26, TAJ_Z),
    onClick: igniteDome,
  })
  ctx.registerInteractive(masjid, {
    encounterId: 'minarets',
    focusPoint: new THREE.Vector3(-56, PROMENADE_Y + 12, TAJ_Z),
    onClick: igniteMinarets,
  })
  ctx.registerInteractive(jawab, {
    encounterId: 'minarets',
    focusPoint: new THREE.Vector3(56, PROMENADE_Y + 12, TAJ_Z),
    onClick: igniteMinarets,
  })
  ctx.registerInteractive(mirrorPool.mesh, {
    encounterId: 'pool',
    focusPoint: new THREE.Vector3(0, POOL_Y + 0.6, POOL_CENTER_Z),
    onClick: ignitePool,
  })

  ctx.setFinaleTrigger(() => {
    igniteDome()
    igniteMinarets()
    ignitePool()
    mirrorPool.setBio(0.9)
    yamunaRiver.setBio(0.85)
  })

  // High Minaret gallery overlook down the Charbagh reflection axis
  ctx.setVantageAnchor?.({
    label: '宣礼塔上层回廊 · 俯瞰中轴对称长池',
    pos: [-28.5, PROMENADE_Y + plinthTop + 26.8, TAJ_Z + 28.5],
    yaw: -0.45,
    pitch: -0.24,
  })

  ctx.setRideAnchor?.(() => {
    yamunaBoat.updateWorldMatrix(true, false)
    return {
      pos: yamunaBoat.localToWorld(new THREE.Vector3(0, 2.2, 0)),
      yawOffset: yamunaBoat.rotation.y,
    }
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    // Walk across Marble Taj Plinth terrace (66 × 66 m at TAJ_Z = -88)
    if (Math.abs(x) <= 32.5 && z >= TAJ_Z - 32.5 && z <= TAJ_Z + 32.5) return PROMENADE_Y + plinthTop
    // South marble access stairs ramp up from red sandstone base (-50.5..-55.5)
    if (Math.abs(x) <= 5.2 && z >= -55.5 && z <= -50.5) {
      const u = THREE.MathUtils.clamp((-50.5 - z) / 5.0, 0, 1)
      return PROMENADE_Y + 1.15 + u * (plinthTop - 1.15)
    }
    // Red sandstone base apron around plinth
    if (Math.abs(x) <= 45 && z >= -124 && z <= -51) return PROMENADE_Y + 1.15
    // Charbagh cross & pool walkways + foreground viewing terrace
    if (Math.abs(x) <= 34 && z >= 8 && z <= 26) return PROMENADE_Y
    if (Math.abs(x) <= 36 && Math.abs(z - POOL_CENTER_Z) <= 3.1) return PROMENADE_Y
    if (Math.abs(x) >= 5.6 && Math.abs(x) <= 12.6 && z >= -51 && z <= 8.5) return PROMENADE_Y
    return null
  })

  const tickBirds = createGlidingBirds(g, [6, 36, -68], 28, 4)

  ctx.addTick((t, dt) => {
    tickBirds(t)
    poolPulse = Math.max(0, poolPulse - dt * 0.45)

    // Yamuna skiff glides slowly back and forth along northern backwater
    const bx = Math.sin(t * 0.045) * 42
    yamunaBoat.position.set(bx, RIVER_Y + 0.05 + Math.sin(t * 1.4) * 0.05, -148 + Math.cos(t * 0.045) * 8)
    yamunaBoat.rotation.y = Math.cos(t * 0.045) >= 0 ? 0 : Math.PI
    boatWake.material.opacity = 0.24 + poolPulse * 0.3

    poolDiyas.forEach((d) => {
      d.grp.position.set(
        d.ox + Math.sin(t * 0.5 + d.phase) * 0.35,
        POOL_Y + 0.03 + Math.sin(t * 2.1 + d.phase) * 0.025,
        d.oz + Math.cos(t * 0.42 + d.phase) * 0.45,
      )
    })
    lotusMotes.position.y = Math.sin(t * 0.2) * 0.65
  })

  ctx.addMoodHook((mood) => {
    const isNight = mood === 'night'
    palette.warmGlow.emissiveIntensity = isNight ? 1.45 : mood === 'dusk' ? 0.92 : 0.48
    palette.diyaGlow.emissiveIntensity = isNight ? 1.6 : 0.9
  })

  enableShadows(g, true, true)
  mirrorPool.mesh.castShadow = false
  yamunaRiver.mesh.castShadow = false
  openGround.castShadow = false
  southTerrace.castShadow = false
  crossPath.castShadow = false
  lotusMotes.castShadow = false
}

export const buildAgra = buildAgraCity
