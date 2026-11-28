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
import { createParisianBench } from './parisAssets'
import {
  createAhuTongarikiPlatform,
  createBirdmanAltar,
  createRanoRarakuQuarry,
  createRapanuiPalette,
} from './rapanuiAssets'

/**
 * 复活节岛 · 摩艾石像阵（1:1 原生米制南太海岸重造）：
 * - 站在玄武岩草原与「鸟人石刻火坛」前景露台，正对巍然矗立于镜面南太平洋海崖之畔的 62 m 阿胡通加里基石台与 9 尊摩艾巨石像；
 * - 左侧拉诺拉拉库火山斜坡清晰半埋古采石像群，海中耸立两座火山海蚀岩屿，赤金破晓从海面升起。
 */
export function buildRapanuiCity(ctx: DioramaBuilderCtx) {
  const g = ctx.group
  g.name = 'rapanui-moai-ahu-scene'

  const PROMENADE_Y = 0.65
  const WATER_Y = -2.2
  const AHU_Z = -34

  const cityMaterials = createCityPbrMaterials(ctx.textures)
  cityMaterials.addWeatherHook(ctx)
  const palette = createRapanuiPalette(ctx.textures)

  // -------------------------------------------------------------------------
  // 1. 1:1 南太平洋火山草原海岸 + 前景玄武岩露台 + 海崖与镜面大洋
  // -------------------------------------------------------------------------
  const volcanicGrassMat = applyPbrSet(
    createMat('#4a5c35', { roughness: 0.94, bumpMap: ctx.textures.plasterBump, bumpScale: 0.04 }),
    'grass',
    28,
    24,
  )

  // Continuous coastal meadow ending cleanly along the ocean cliff rim (z = -38.5..+381.5)
  const openGround = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), volcanicGrassMat)
  openGround.name = 'open-horizon-ground'
  openGround.rotation.x = -Math.PI / 2
  openGround.position.set(0, -0.02, 171.5)
  openGround.receiveShadow = true
  g.add(openGround)

  // Sculpted coastal basalt seawall cliff face dropping directly into the Pacific ocean
  const cliffFace = new THREE.Mesh(new THREE.BoxGeometry(420, 3.2, 5.2), palette.basalt)
  cliffFace.position.set(0, -1.5, -39.2)
  cliffFace.receiveShadow = true
  g.add(cliffFace)

  // Foreground carved volcanic slate terrace (x: -26..+26, z: 6..22)
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(52, 1.35, 16), palette.basalt)
  terrace.name = 'rapanui-coastal-terrace'
  terrace.userData.foregroundDeck = true
  terrace.position.set(0, PROMENADE_Y - 0.675, 14)
  terrace.receiveShadow = true
  g.add(terrace)

  const rails: CityRailSegment[] = [
    { from: [-25.5, PROMENADE_Y, 6.2], to: [-2.8, PROMENADE_Y, 6.2] },
    { from: [2.8, PROMENADE_Y, 6.2], to: [25.5, PROMENADE_Y, 6.2] },
  ]
  buildContinuousRailing(g, rails, 'stone')

  const bench = createParisianBench()
  bench.position.set(6.8, PROMENADE_Y, 9.6)
  bench.rotation.y = Math.PI
  g.add(bench)

  // Weathered stepping tuff stone walkway linking terrace to Ahu Tongariki ramp
  for (let s = 0; s < 12; s += 1) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.24, 2.4), palette.tuff)
    slab.position.set(Math.sin(s * 0.4) * 0.35, 0.1, 3.5 - s * 2.8)
    slab.receiveShadow = true
    g.add(slab)
  }

  // Unobstructed South Pacific Ocean (Reflector water extending to the dawn horizon)
  const pacific = buildSceneWater(ctx, {
    width: 420,
    depth: 240,
    x: 0,
    y: WATER_Y,
    z: -158,
    deepHex: '#0d2b40',
    shallowHex: '#2e6780',
    fadeRadius: 240,
    reflective: true,
  })
  pacific.mesh.name = 'rapanui-south-pacific-ocean'
  ctx.bindWater(
    (x, z) => pacific.setRipple(x, z),
    (bio) => pacific.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      pacific.uniforms.uFogColor.value.set(fogHex)
      if (sunHex) pacific.uniforms.uSunCol.value.set(sunHex)
      if (sunDir) pacific.uniforms.uSunDir.value.set(...sunDir).normalize()
    },
  )

  // Offshore volcanic basalt sea stacks (Motu islets) emerging from the Pacific surf
  for (const [ix, iz, r, h] of [
    [54, -108, 12, 18],
    [82, -135, 16, 26],
    [-46, -125, 10, 14],
  ] as [number, number, number, number][]) {
    const stack = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), palette.basalt)
    stack.position.set(ix, WATER_Y + h * 0.35, iz)
    stack.rotation.y = ix * 0.1
    g.add(stack)
  }

  // Scattered coastal volcanic boulders across the turf & surf edge
  for (const [bx, bz, sc] of [
    [-18, 2.0, 1.3],
    [-26, -12, 1.8],
    [19, -4, 1.4],
    [28, -18, 2.0],
    [36, -30, 2.2],
    [-34, -30, 1.9],
    [18, -50, 2.5],
    [-18, -54, 2.2],
  ] as [number, number, number][]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), palette.basalt)
    rock.scale.set(1.4, 0.72, 1.15)
    rock.position.set(bx, bz < -40 ? WATER_Y + sc * 0.25 : sc * 0.28, bz)
    g.add(rock)
  }

  // -------------------------------------------------------------------------
  // 2. 阿胡通加里基 9 尊摩艾巨石阵 + 前景鸟人火坛 + 左侧独立拉诺拉拉库火山采石丘
  // -------------------------------------------------------------------------
  const { ahu, eyeMats, eyeHalos } = createAhuTongarikiPlatform(palette, ctx.textures.glowHalo)
  ahu.position.set(0, 0, AHU_Z)
  g.add(ahu)

  const { altar, flames, halos: altarHalos } = createBirdmanAltar(palette, ctx.textures.glowHalo)
  altar.position.set(-7.5, PROMENADE_Y, 8.2)
  g.add(altar)

  const quarryMountains = createRanoRarakuQuarry(palette, ctx.textures.glowHalo)
  g.add(quarryMountains)

  // Pacific golden dawn salt-spray & sunlit dust motes drifting across the headland
  const dustCount = 120
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i += 1) {
    const a = i * 2.399963
    const r = 6 + ((i * 19) % 52)
    dustPos[i * 3] = Math.cos(a) * r
    dustPos[i * 3 + 1] = 1.2 + ((i * 13) % 14) * 1.1
    dustPos[i * 3 + 2] = -24 + Math.sin(a) * r * 0.85
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dawnDust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: '#ffe0b4',
      size: 0.34,
      map: ctx.textures.glowHalo,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  )
  g.add(dawnDust)

  // -------------------------------------------------------------------------
  // 3. 三重奇遇（moai / altar / ocean）、拉诺拉拉库山坡观景台与步行高程
  // -------------------------------------------------------------------------
  let fireBoost = 0

  const awakenMoaiEyes = () => {
    eyeMats.forEach((m) => { m.emissiveIntensity = 1.65 })
    eyeHalos.forEach((h) => { h.material.opacity = 0.72 })
    ctx.discoverEncounter('moai')
    return { label: '九尊摩艾白珊瑚圣眸在太平洋拂晓中苏醒 · 凝望火山故乡', sfx: 'star' as const }
  }

  const igniteAltar = () => {
    fireBoost = 1.3
    palette.flame.emissiveIntensity = 2.0
    altarHalos.forEach((h) => { h.material.opacity = 0.85 })
    ctx.discoverEncounter('altar')
    return { label: '鸟人（Tangata Manu）石刻火坛燃起橙金圣火', sfx: 'lamp' as const }
  }

  const touchPacificSurf = () => {
    ctx.triggerRipple(0, -68)
    pacific.setBio(0.68)
    ctx.discoverEncounter('ocean')
    return { label: '轻触南太平洋拍岸浪涌 · 碎金波光漫过玄武岩海岸', sfx: 'ripple' as const }
  }

  ctx.registerInteractive(ahu, {
    encounterId: 'moai',
    focusPoint: new THREE.Vector3(0, 7.6, AHU_Z),
    onClick: awakenMoaiEyes,
  })
  ctx.registerInteractive(altar, {
    encounterId: 'altar',
    focusPoint: new THREE.Vector3(-7.5, PROMENADE_Y + 2.0, 8.2),
    onClick: igniteAltar,
  })
  ctx.registerInteractive(pacific.mesh, {
    encounterId: 'ocean',
    focusPoint: new THREE.Vector3(0, WATER_Y + 0.5, -72),
    onClick: touchPacificSurf,
  })

  ctx.setFinaleTrigger(() => {
    awakenMoaiEyes()
    igniteAltar()
    touchPacificSurf()
    pacific.setBio(0.95)
  })

  ctx.setVantageAnchor?.({
    label: '拉诺拉拉库采石高坡 · 俯瞰九尊摩艾阵',
    pos: [-52, 12.5, -14],
    yaw: -1.05,
    pitch: -0.1,
  })

  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 26 && z >= 6 && z <= 22) return PROMENADE_Y
    if (Math.abs(x) <= 32 && z >= -28 && z <= 6) return 0.16
    return null
  })

  const tickGulls = createGlidingBirds(g, [6, 26, -42], 34, 5)

  ctx.addTick((t, dt) => {
    tickGulls(t)
    fireBoost = Math.max(0, fireBoost - dt * 0.4)
    flames.forEach((f, idx) => {
      f.scale.setScalar(1 + Math.sin(t * 7.8 + idx) * 0.14 + fireBoost * 0.18)
    })
    dawnDust.position.x = Math.sin(t * 0.08) * 3.5
  })

  ctx.addMoodHook((mood) => {
    const isNight = mood === 'night'
    palette.flame.emissiveIntensity = isNight ? 1.85 : 1.25
    eyeMats.forEach((m) => {
      m.emissiveIntensity = isNight ? Math.max(m.emissiveIntensity, 0.85) : m.emissiveIntensity
    })
  })

  enableShadows(g, true, true)
  pacific.mesh.castShadow = false
  openGround.castShadow = false
  terrace.castShadow = false
  dawnDust.castShadow = false
}

export const buildRapanui = buildRapanuiCity
