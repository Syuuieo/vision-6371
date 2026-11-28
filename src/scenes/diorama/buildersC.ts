import * as THREE from 'three'
import {
  buildForegroundDeck,
  buildSceneTerrain,
  buildSceneWater,
  buildSculptedPlinth,
  createMat,
  createMiniPerson,
  enableShadows,
  makeGlowSprite,
} from './materials'
import {
  buildStarHaloTexture,
  buildStarHalos,
  createPainterlyTextures,
} from './painterlyEngine'
import type { DioramaBuilderCtx } from './types'

function createSeededRand(seedInit: number) {
  let seed = seedInit
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const createSeededRandIceland = createSeededRand

/**
 * 冰岛 · 雷克雅未克极光峡湾（1:1 原生尺度 · 写实场景重做）
 * 连续玄武岩海岸地形 + 镜面峡湾 + 悬崖村庄 + 灯塔礁石岬角 + 极光天幕 + 座头鲸
 * 五段「场景奇遇」：灯塔光束 / 极光绸带 / 座头鲸跃 / 浮冰蓝泪 / 冰川蓝洞
 */
export function buildIcelandV3(ctx: DioramaBuilderCtx) {
  const g = new THREE.Group()
  ctx.group.add(g)
  ctx.setFramingView?.({ pos: [-6, 9, 8], look: [8, 6, 55], fov: 52 })

  // 南岸连续地形（村庄与悬崖），北面是整片峡湾
  buildSceneTerrain(ctx, {
    size: 420,
    color: '#2c3833',
    patchColor: '#37453c',
    flatRadius: 105,
    relief: 3.0,
    x: 0,
    z: -95,
  })

  // 峡湾镜面水面（极光与灯光实时倒映）
  const water = buildSceneWater(ctx, {
    width: 420,
    depth: 185,
    x: 0,
    z: 112.5,
    y: -0.9,
    deepHex: '#081c2a',
    shallowHex: '#17475c',
    fadeRadius: 190,
  })
  ctx.bindWater(
    (rx, rz) => water.setRipple(rx, rz),
    (bio) => water.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      const u = water.uniforms
      u.uFogColor.value.set(fogHex)
      if (sunHex) u.uSunCol.value.set(sunHex)
      if (sunDir) u.uSunDir.value.set(sunDir[0], sunDir[1], sunDir[2]).normalize()
    },
  )
  ctx.registerInteractive(water.mesh, {
    onClick: (pt) => {
      const lp = pt ? ctx.group.worldToLocal(pt.clone()) : null
      water.setRipple(lp?.x ?? 0, lp?.z ?? 40)
      return { label: '轻拨峡湾冰海 · 极光在水面碎成流动的绸', sfx: 'ripple' }
    },
  })

  // 村后玄武岩悬崖（连续岩壁，18-34m）
  const cliffMat = createMat('#1b242e', { roughness: 0.92, flatShading: true })
  const cliffTopMat = createMat('#3c4d58', { roughness: 0.94, flatShading: true })
  const cliffRand = createSeededRandIceland(881)
  for (let i = 0; i < 16; i += 1) {
    const cx = -75 + i * 10
    const h = 16 + cliffRand() * 18
    const wall = new THREE.Mesh(new THREE.BoxGeometry(11, h, 12), cliffMat)
    wall.position.set(cx, h / 2 - 1, -52 - cliffRand() * 14)
    wall.rotation.y = (cliffRand() - 0.5) * 0.22
    wall.castShadow = true
    wall.receiveShadow = true
    g.add(wall)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 13), cliffTopMat)
    cap.position.set(cx, h - 1.6, wall.position.z)
    g.add(cap)
  }

  // 石砌护岸（沿水岸 z=20 的挡墙）
  const shoreWallMat = createMat('#222b31', { roughness: 0.88, bumpMap: ctx.textures.darkStoneTex })
  const shoreWall = new THREE.Mesh(new THREE.BoxGeometry(180, 1.4, 1.6), shoreWallMat)
  shoreWall.position.set(0, -0.25, 19.6)
  g.add(shoreWall)
  const shoreEdge = new THREE.Mesh(new THREE.BoxGeometry(180, 0.25, 2.2), createMat('#39444b', { roughness: 0.9 }))
  shoreEdge.position.set(0, 0.42, 19.2)
  shoreEdge.receiveShadow = true
  g.add(shoreEdge)

  // 灯塔礁石岬角：伸入峡湾的石岬 + 红白灯塔（16m）
  const point = new THREE.Group()
  point.name = 'lighthouse-point'
  const pointRockMat = createMat('#2a333b', { roughness: 0.9, flatShading: true })
  const pointBase = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 3.4, 9), pointRockMat)
  pointBase.position.set(20, 0.2, 34)
  pointBase.receiveShadow = true
  point.add(pointBase)
  const pointTop = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 9, 1.6, 9), pointRockMat)
  pointTop.position.set(20, 2.6, 34)
  pointTop.receiveShadow = true
  point.add(pointTop)
  g.add(point)

  const lh = new THREE.Group()
  lh.position.set(20, 3.3, 34)
  const stoneBaseMat = createMat('#313c49', { roughness: 0.88 })
  const ironTrimMat = createMat('#222b38', { metalness: 0.74, roughness: 0.34 })
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.2, 10), stoneBaseMat)
  lhBase.position.y = 0.6
  lh.add(lhBase)
  const whiteStripe = createMat('#f4f7fb', { roughness: 0.46 })
  const redStripe = createMat('#d8453d', { roughness: 0.5 })
  for (let i = 0; i < 6; i += 1) {
    const rBot = 2.0 - i * 0.16
    const rTop = 2.0 - (i + 1) * 0.16
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 2.0, 18),
      i % 2 === 0 ? whiteStripe : redStripe,
    )
    seg.position.y = 2.2 + i * 2.0
    seg.castShadow = true
    lh.add(seg)
    const collar = new THREE.Mesh(new THREE.TorusGeometry((rTop + rBot) * 0.5 + 0.04, 0.09, 6, 20), ironTrimMat)
    collar.rotation.x = Math.PI / 2
    collar.position.y = seg.position.y + 1.0
    lh.add(collar)
  }
  const galleryDeck = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 1.9, 0.4, 16), ironTrimMat)
  galleryDeck.position.y = 14.4
  lh.add(galleryDeck)
  const lanternGlass = createMat('#dff6ff', {
    emissive: '#ffcf78',
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.45,
    roughness: 0.12,
    metalness: 0.2,
  })
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.9, 14), lanternGlass)
  lantern.position.y = 15.6
  const fresnelCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.72, 1),
    createMat('#ffe9b2', { emissive: '#ffbb52', emissiveIntensity: 1.1, roughness: 0.18 }),
  )
  fresnelCore.position.y = 15.6
  lh.add(lantern, fresnelCore)
  for (let m = 0; m < 8; m += 1) {
    const a = (m / 8) * Math.PI * 2
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.95, 0.1), ironTrimMat)
    mullion.position.set(Math.cos(a) * 1.34, 15.6, Math.sin(a) * 1.34)
    lh.add(mullion)
  }
  const lhDome = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.7, 14), redStripe)
  lhDome.position.y = 17.5
  lh.add(lhDome)
  const lanternHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffd480', 7.5, 0.4)
  lanternHalo.position.y = 15.6
  lh.add(lanternHalo)
  const lhPoint = new THREE.PointLight('#ffd27d', 1.2, 60, 1.6)
  lhPoint.position.y = 15.6
  lh.add(lhPoint)
  // 旋转双光束
  const beamPivot = new THREE.Group()
  beamPivot.position.y = 15.6
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#ffe29c',
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const beamA = new THREE.Mesh(new THREE.ConeGeometry(3.4, 42, 16, 1, true), beamMat)
  beamA.rotation.z = -Math.PI / 2
  beamA.position.x = 21
  const beamB = new THREE.Mesh(new THREE.ConeGeometry(3.4, 42, 16, 1, true), beamMat)
  beamB.rotation.z = Math.PI / 2
  beamB.position.x = -21
  beamPivot.add(beamA, beamB)
  lh.add(beamPivot)
  g.add(lh)

  let lighthouseOn = false
  ctx.registerInteractive(lh, {
    encounterId: 'lighthouse',
    focusPoint: new THREE.Vector3(20, 15.5, 34),
    onClick: () => {
      lighthouseOn = true
      lanternGlass.emissiveIntensity = 1.0
      lanternHalo.material.opacity = 0.85
      lhPoint.intensity = 3.2
      beamMat.opacity = 0.22
      ctx.discoverEncounter('lighthouse')
      return { label: '灯塔光束扫过峡湾，像有人在黑夜里为你掌灯', sfx: 'lamp' }
    },
  })

  // 渔村木屋排（沿岸 x -26..26，6 座暖窗木屋）
  const cabinWoodMat = createMat('#3e3129', { map: ctx.textures.weatheredWoodTex, roughness: 0.8 })
  const cabinRoofMat = createMat('#8c3a34', { roughness: 0.6 })
  const cabinWinMat = createMat('#ffe4a6', { emissive: '#ff9e38', emissiveIntensity: 1.3 })
  const cabinSnowMat = createMat('#edf5ff', { roughness: 0.72 })
  const cabinRand = createSeededRandIceland(773)
  for (let i = 0; i < 6; i += 1) {
    const cx = -25 + i * 10.5
    const cz = 9 + cabinRand() * 3
    const cabin = new THREE.Group()
    cabin.position.set(cx, 0.35, cz)
    cabin.rotation.y = (cabinRand() - 0.5) * 0.3
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.6, 5.4), cabinWoodMat)
    body.position.y = 1.8
    body.castShadow = true
    body.receiveShadow = true
    const roofA = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 6.0), cabinRoofMat)
    roofA.position.set(-1.9, 4.0, 0)
    roofA.rotation.z = 0.5
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 6.0), cabinRoofMat)
    roofB.position.set(1.9, 4.0, 0)
    roofB.rotation.z = -0.5
    const snowEaveA = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 6.1), cabinSnowMat)
    snowEaveA.position.set(-2.0, 4.25, 0)
    snowEaveA.rotation.z = 0.5
    const snowEaveB = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 6.1), cabinSnowMat)
    snowEaveB.position.set(2.0, 4.25, 0)
    snowEaveB.rotation.z = -0.5
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.2), createMat('#5e4030', { roughness: 0.72 }))
    door.position.set(0, 1.05, 2.75)
    const winL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.16), cabinWinMat)
    winL.position.set(-2.1, 2.0, 2.72)
    const winR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.16), cabinWinMat)
    winR.position.set(2.1, 2.0, 2.72)
    const glow = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 5.5, 0.4)
    glow.position.set(0, 1.8, 2.6)
    cabin.add(body, roofA, roofB, snowEaveA, snowEaveB, door, winL, winR, glow)
    g.add(cabin)
  }

  // 玄武岩柱群（岬角边，2-5m 六棱柱）
  const basaltMats = [
    createMat('#1e2731', { roughness: 0.92, flatShading: true }),
    createMat('#293441', { roughness: 0.9, flatShading: true }),
    createMat('#354251', { roughness: 0.88, flatShading: true }),
  ]
  const basaltRand = createSeededRandIceland(411)
  for (let i = 0; i < 26; i += 1) {
    const a = -Math.PI * 0.15 + basaltRand() * Math.PI * 0.75
    const rad = 13 + basaltRand() * 7
    const bx = 20 + Math.cos(a - Math.PI / 2) * rad
    const bz = 30 + Math.sin(a - Math.PI / 2) * rad * 0.7
    const h = 1.4 + basaltRand() * 3.6
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, h, 6), basaltMats[i % 3])
    col.position.set(bx, 0.35 + h * 0.5, bz)
    col.rotation.y = (i % 6) * (Math.PI / 6)
    col.castShadow = true
    col.receiveShadow = true
    g.add(col)
  }

  // 石子路（沿海岸东西向）
  const pathMat = createMat('#4a4f46', { roughness: 0.96 })
  const path = new THREE.Mesh(new THREE.BoxGeometry(120, 0.12, 3.4), pathMat)
  path.position.set(0, 0.42, 16)
  path.receiveShadow = true
  g.add(path)

  // 码头（木栈桥伸入峡湾）+ 系缆桩
  const dockMat = createMat('#4c3c30', { map: ctx.textures.weatheredWoodTex, roughness: 0.82 })
  const dock = new THREE.Group()
  dock.name = 'fjord-dock'
  const dockDeck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 18), dockMat)
  dockDeck.position.set(-2, 0.3, 28)
  dockDeck.receiveShadow = true
  dockDeck.userData.foregroundDeck = true
  dock.add(dockDeck)
  for (let p = 0; p < 4; p += 1) {
    for (const sx of [-1.9, 1.9]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 8), dockMat)
      piling.position.set(-2 + sx, -0.6, 20.5 + p * 5)
      dock.add(piling)
    }
    if (p % 2 === 0) {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10), createMat('#303a42', { metalness: 0.7, roughness: 0.4 }))
      bollard.position.set(-2, 0.66, 21.5 + p * 5)
      dock.add(bollard)
    }
  }
  g.add(dock)

  // 岸边浮冰群（部分搁浅在护岸，部分漂在湾里）
  const iceMat = createMat('#b8f1ff', {
    emissive: '#38a6cc',
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.9,
    roughness: 0.16,
    flatShading: true,
  })
  const floeMat = createMat('#dcf7ff', {
    emissive: '#4cb6d8',
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.94,
    roughness: 0.24,
    flatShading: true,
  })
  const icebergs: { grp: THREE.Group; baseY: number; phase: number }[] = []
  const bergSpecs: [number, number, number, number][] = [
    [8, 30, 1.6, 1.3],
    [-8, 38, 2.0, 1.5],
    [14, 52, 2.6, 1.7],
    [-16, 60, 2.2, 1.4],
    [4, 74, 3.0, 1.8],
    [-6, 88, 2.4, 1.5],
    [26, 12, 1.4, 1.0],
    [-30, 15, 1.7, 1.1],
  ]
  bergSpecs.forEach(([bx, bz, sc, hs], idx) => {
    const berg = new THREE.Group()
    berg.position.set(bx, idx < 2 ? 0.4 : -0.82, bz)
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(1.5 * sc, 1.8 * sc, 0.3 * sc, 7), floeMat)
    shelf.position.y = 0.1 * sc
    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * sc, 0), iceMat)
    crystal.scale.set(1.2, hs * 1.2, 0.9)
    crystal.position.y = 0.5 * sc
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6 * sc, 2.0 * sc * hs, 5), iceMat)
    spire.position.set(0.5 * sc, 1.0 * sc, -0.2 * sc)
    spire.rotation.z = -0.2
    berg.add(shelf, crystal, spire)
    g.add(berg)
    icebergs.push({ grp: berg, baseY: berg.position.y, phase: idx * 1.65 })
    if (idx === 6) {
      ctx.registerInteractive(berg, {
        encounterId: 'floes',
        focusPoint: new THREE.Vector3(bx, 1.4, bz),
        onClick: () => {
          water.setRipple(bx, bz)
          water.setBio(0.85)
          floeMat.emissiveIntensity = 0.85
          iceMat.emissiveIntensity = 1.1
          ctx.discoverEncounter('floes')
          return { label: '浮冰深处亮起蓝泪，冰海把星星冻进了心里', sfx: 'snow' }
        },
      })
    } else {
      ctx.registerInteractive(berg, {
        focusPoint: new THREE.Vector3(bx, 1.0, bz),
        onClick: () => {
          water.setRipple(bx, bz)
          return { label: '轻触冰川浮冰 · 蓝白冰晶在峡湾里折射极光', sfx: 'snow' }
        },
      })
    }
  })

  // 极光天幕（双层 GLSL 光帘，悬于峡湾上空——天空现象，非笔触）
  const auroraUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.42 },
  }
  const createAuroraMaterial = (phaseOffset: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: auroraUniforms.uTime,
        uIntensity: auroraUniforms.uIntensity,
        uPhase: { value: phaseOffset },
      },
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPhase;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float arch = -(p.x * p.x) * 0.075;
          float wave1 = sin(p.x * 0.95 + uTime * 0.85 + uPhase) * 0.52;
          float wave2 = cos(p.x * 1.85 - uTime * 0.55 + uPhase * 1.7) * 0.24;
          p.z += arch + wave1 + wave2;
          p.y += sin(p.x * 0.65 + uTime * 0.4 + uPhase) * 0.22;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPhase;
        varying vec2 vUv;
        void main() {
          float rays1 = sin(vUv.x * 34.0 + uTime * 1.35 + uPhase) * 0.5 + 0.5;
          float rays2 = sin(vUv.x * 68.0 - uTime * 1.9 + uPhase * 2.0) * 0.5 + 0.5;
          float shimmer = 0.45 + 0.42 * pow(rays1, 1.6) + 0.28 * pow(rays2, 2.2);
          float fadeX = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
          float fadeBot = smoothstep(0.0, 0.24, vUv.y);
          float fadeTop = smoothstep(1.0, 0.18, vUv.y);
          vec3 emerald = vec3(0.14, 0.98, 0.66);
          vec3 cyan = vec3(0.20, 0.84, 0.98);
          vec3 violet = vec3(0.68, 0.30, 0.98);
          vec3 col = mix(emerald, cyan, smoothstep(0.15, 0.55, vUv.y));
          col = mix(col, violet, smoothstep(0.48, 0.95, vUv.y));
          float alpha = fadeX * fadeBot * fadeTop * shimmer * clamp(uIntensity, 0.0, 1.8) * 0.58;
          gl_FragColor = vec4(col * (0.85 + uIntensity * 0.38), alpha);
        }
      `,
    })
  const auroraMain = new THREE.Mesh(new THREE.PlaneGeometry(190, 64, 64, 14), createAuroraMaterial(0))
  auroraMain.position.set(0, 66, 130)
  const auroraBack = new THREE.Mesh(new THREE.PlaneGeometry(160, 52, 48, 10), createAuroraMaterial(2.2))
  auroraBack.position.set(10, 76, 120)
  g.add(auroraMain, auroraBack)

  // 极地石碑（近距离唤醒极光）
  const runeStone = new THREE.Group()
  runeStone.position.set(-6, 0.35, 17)
  const obelisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.62, 2.6, 6),
    createMat('#2a384c', { roughness: 0.7, flatShading: true }),
  )
  obelisk.position.y = 1.3
  const runeCoreMat = createMat('#8ef8d8', { emissive: '#3ef0b8', emissiveIntensity: 0.9 })
  const runeCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), runeCoreMat)
  runeCrystal.position.y = 3.1
  const runeHalo = makeGlowSprite(ctx.textures.glowHalo, '#6ff2c8', 3.0, 0.5)
  runeHalo.position.y = 3.1
  runeStone.add(obelisk, runeCrystal, runeHalo)
  g.add(runeStone)

  let auroraTarget = 0.42
  ctx.registerInteractive(runeStone, {
    encounterId: 'aurora',
    focusPoint: new THREE.Vector3(-6, 3.4, 17),
    onClick: () => {
      auroraTarget = Math.max(auroraTarget, 1.3)
      runeCoreMat.emissiveIntensity = 2.0
      runeHalo.material.opacity = 0.9
      ctx.discoverEncounter('aurora')
      return { label: '绿紫绸带在天穹起舞，整片夜空开始呼吸', sfx: 'star' as const }
    },
  })
  ctx.registerInteractive(auroraMain, {
    encounterId: 'aurora',
    focusPoint: new THREE.Vector3(0, 60, 130),
    onClick: () => {
      auroraTarget = Math.max(auroraTarget, 1.3)
      runeCoreMat.emissiveIntensity = 2.0
      ctx.discoverEncounter('aurora')
      return { label: '绿紫绸带在天穹起舞，整片夜空开始呼吸', sfx: 'star' as const }
    },
  })

  // 远北冰川舌（峡湾尽头，蓝色冰瀑 + 浮冰架）
  const glacierTongue = new THREE.Group()
  glacierTongue.name = 'glacier-tongue'
  const glacierIceMat = createMat('#cfeafa', {
    emissive: '#3f9fd0',
    emissiveIntensity: 0.4,
    roughness: 0.24,
    flatShading: true,
  })
  const glacierField = new THREE.Mesh(new THREE.BoxGeometry(90, 6, 26), glacierIceMat)
  glacierField.position.set(0, 2.2, 185)
  glacierTongue.add(glacierField)
  for (let i = 0; i < 9; i += 1) {
    const colH = 10 + (i % 3) * 5
    const col = new THREE.Mesh(new THREE.BoxGeometry(8, colH, 9), glacierIceMat)
    col.position.set(-34 + i * 8.5, colH / 2 + 2, 168 - (i % 2) * 4)
    col.rotation.y = (i % 3) * 0.12
    glacierTongue.add(col)
  }
  g.add(glacierTongue)

  // 冰川蓝洞（第 5 段奇遇，搁浅在东侧岸边）
  const blueCave = new THREE.Group()
  blueCave.position.set(32, 0.35, 14)
  const caveArch = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.5, 8, 20, Math.PI), glacierIceMat)
  const caveCoreMat = createMat('#9feaf8', { emissive: '#25c2f2', emissiveIntensity: 1.2, roughness: 0.2 })
  const caveCore = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), caveCoreMat)
  caveCore.position.y = 0.5
  const caveHalo = makeGlowSprite(ctx.textures.glowHalo, '#5fd2f4', 5.5, 0.6)
  caveHalo.position.y = 1.0
  blueCave.add(caveArch, caveCore, caveHalo)
  g.add(blueCave)

  ctx.registerInteractive(blueCave, {
    encounterId: 'glacier',
    focusPoint: new THREE.Vector3(32, 2.4, 14),
    onClick: () => {
      caveCoreMat.emissiveIntensity = 2.4
      caveHalo.material.opacity = 0.95
      glacierIceMat.emissiveIntensity = 0.85
      water.setBio(0.55)
      ctx.discoverEncounter('glacier')
      return { label: '冰川最深处亮起蓝洞，千年心事冻成了琥珀', sfx: 'snow' }
    },
  })

  // 座头鲸（峡湾巡游 + 跃水奇观）
  const whaleGroup = new THREE.Group()
  const whaleMat = createMat('#213856', { emissive: '#1a5570', emissiveIntensity: 0.28, roughness: 0.28, metalness: 0.14 })
  const bellyMat = createMat('#c2e4ef', { emissive: '#58c8dc', emissiveIntensity: 0.24, roughness: 0.34 })
  const whaleSpine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, -0.4, 0),
    new THREE.Vector3(-2.4, 0.2, 0),
    new THREE.Vector3(0.1, 0.6, 0),
    new THREE.Vector3(2.5, 0.4, 0),
    new THREE.Vector3(4.2, 0, 0),
  ])
  const torsoGeo = new THREE.TubeGeometry(whaleSpine, 24, 1.3, 16, false)
  const tPos = torsoGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < tPos.count; i += 1) {
    const px = tPos.getX(i)
    const py = tPos.getY(i)
    const pz = tPos.getZ(i)
    const tt = THREE.MathUtils.clamp((px + 4.5) / 8.7, 0, 1)
    const radialScale = Math.sin(Math.pow(tt, 0.72) * Math.PI) * 0.96 + 0.12
    const spineY = Math.sin(tt * Math.PI) * 0.55
    tPos.setXYZ(i, px, spineY + (py - spineY) * radialScale * 0.92, pz * radialScale * 0.78)
  }
  torsoGeo.computeVertexNormals()
  const whaleBody = new THREE.Mesh(torsoGeo, whaleMat)
  whaleGroup.add(whaleBody)
  const rostrum = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10), whaleMat)
  rostrum.scale.set(1.38, 0.68, 0.76)
  rostrum.position.set(3.5, 0.05, 0)
  whaleGroup.add(rostrum)
  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 3.8), bellyMat)
    pec.position.set(1.0, -0.2, side * 1.9)
    pec.rotation.set(side * 0.24, side * -0.48, 0.16)
    whaleGroup.add(pec)
    const fluke = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 2.2), whaleMat)
    fluke.position.set(-4.9, -0.32, side * 1.0)
    fluke.rotation.y = side * 0.46
    whaleGroup.add(fluke)
  }
  const whaleGlow = makeGlowSprite(ctx.textures.glowHalo, '#72f2e4', 6.5, 0.32)
  whaleGlow.position.set(0.4, 0.8, 0)
  whaleGroup.add(whaleGlow)
  g.add(whaleGroup)

  const splashCrown = new THREE.Group()
  const foamMat = createMat('#e6f9ff', {
    emissive: '#7ae8f5',
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.85,
    roughness: 0.3,
    flatShading: true,
  })
  const foamPlumes: THREE.Mesh[] = []
  for (let f = 0; f < 14; f += 1) {
    const a = (f / 14) * Math.PI * 2
    const h = 1.1 + (f % 3) * 0.6
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.42, h, 5), foamMat)
    plume.position.set(Math.cos(a) * 2.4, h * 0.4, Math.sin(a) * 2.4)
    plume.rotation.z = -Math.cos(a) * 0.42
    plume.rotation.x = Math.sin(a) * 0.42
    splashCrown.add(plume)
    foamPlumes.push(plume)
  }
  const foamRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.24, 7, 24), foamMat)
  foamRing.rotation.x = Math.PI / 2
  splashCrown.add(foamRing)
  g.add(splashCrown)

  const rippleRings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; delay: number }[] = []
  for (let i = 0; i < 3; i += 1) {
    const rMat = new THREE.MeshBasicMaterial({
      color: i === 1 ? '#b294ff' : '#78f5e6',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const rMesh = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.5, 36), rMat)
    rMesh.rotation.x = -Math.PI / 2
    rMesh.visible = false
    g.add(rMesh)
    rippleRings.push({ mesh: rMesh, mat: rMat, delay: i * 0.34 })
  }

  const WHALE_HOME = new THREE.Vector3(-4, -0.9, 58)
  let breachTimer = -1
  let breachSplashFired = false
  const launchWhaleBreach = () => {
    breachTimer = 0
    breachSplashFired = false
    water.setRipple(WHALE_HOME.x, WHALE_HOME.z)
    water.setBio(0.68)
    rippleRings.forEach((r) => {
      r.mesh.position.set(WHALE_HOME.x, -0.8, WHALE_HOME.z)
      r.mesh.visible = true
    })
  }

  ctx.registerInteractive(whaleGroup, {
    encounterId: 'whale',
    focusPoint: new THREE.Vector3(WHALE_HOME.x, 2.2, WHALE_HOME.z),
    onClick: () => {
      launchWhaleBreach()
      ctx.discoverEncounter('whale')
      return { label: '座头鲸破开冰海跃水而出 · 漾起极光荧光波环', sfx: 'ripple' }
    },
  })

  // 年轮星晕（圆环光圈，非放射星芒）
  const haloTex = buildStarHaloTexture()
  ctx.addDisposeHook?.(() => haloTex.dispose())
  const starHalos = buildStarHalos(g, haloTex, ctx.textures.glowHalo, [
    { pos: [-52, 58, -128], scale: 11, rings: 2, color: '#e4ecfa' },
    { pos: [34, 64, -122], scale: 12, rings: 3, color: '#eef0fa' },
    { pos: [66, 46, -118], scale: 9.5, rings: 2, color: '#e4ecf8' },
    { pos: [-70, 44, -120], scale: 9, rings: 2, color: '#e6f0fa' },
  ])

  // 觉醒终局：极光耀斑 + 升空极光星尘
  const moteCount = 48
  const motePos = new Float32Array(moteCount * 3)
  const moteCol = new Float32Array(moteCount * 3)
  const motePalette = [new THREE.Color('#5ef7be'), new THREE.Color('#70d6ff'), new THREE.Color('#b678ff')]
  for (let i = 0; i < moteCount; i += 1) {
    motePos[i * 3] = (Math.random() - 0.5) * 40
    motePos[i * 3 + 1] = Math.random() * 26
    motePos[i * 3 + 2] = 20 + Math.random() * 60
    const c = motePalette[i % motePalette.length]
    moteCol[i * 3] = c.r
    moteCol[i * 3 + 1] = c.g
    moteCol[i * 3 + 2] = c.b
  }
  const moteGeo = new THREE.BufferGeometry()
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3))
  const moteMat = new THREE.PointsMaterial({
    size: 0.32,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const auroraMotes = new THREE.Points(moteGeo, moteMat)
  auroraMotes.visible = false
  g.add(auroraMotes)

  let flareActive = false
  ctx.setFinaleTrigger(() => {
    flareActive = true
    auroraTarget = 1.75
    auroraMotes.visible = true
    water.setBio(1)
    launchWhaleBreach()
  })

  let currentNightFactor = 0.9
  ctx.addTimeHook?.((_hour, nightFactor) => {
    currentNightFactor = nightFactor
  })
  ctx.addMoodHook((mood) => {
    currentNightFactor = mood === 'night' ? 0.92 : mood === 'dusk' ? 0.55 : 0.2
    lhPoint.intensity = lighthouseOn ? (mood === 'dawn' ? 2.0 : 3.0) : mood === 'night' ? 1.4 : 0.9
  })

  ctx.addTick((t, dt) => {
    auroraUniforms.uTime.value = t
    auroraUniforms.uIntensity.value += (auroraTarget - auroraUniforms.uIntensity.value) * Math.min(1, dt * 2.4)
    starHalos.update(t, dt, currentNightFactor)

    beamPivot.rotation.y += dt * (lighthouseOn ? 1.15 : 0.42)
    fresnelCore.rotation.y += dt * (lighthouseOn ? 1.15 : 0.42)
    runeCrystal.rotation.y = t * 1.1

    icebergs.forEach((b) => {
      b.grp.position.y = b.baseY + Math.sin(t * 1.35 + b.phase) * 0.14
      b.grp.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.03
    })

    const splashIntensity = breachTimer >= 0 ? 0.85 + Math.sin((breachTimer / 3.4) * Math.PI) * 0.9 : 0.38
    splashCrown.position.set(whaleGroup.position.x, -0.85, whaleGroup.position.z)
    splashCrown.scale.setScalar(splashIntensity)
    foamMat.opacity = breachTimer >= 0 ? 0.85 : 0.36
    foamPlumes.forEach((fp, idx) => {
      fp.scale.y = 0.85 + 0.25 * Math.sin(t * 4.2 + idx * 0.9)
    })

    if (breachTimer >= 0) {
      breachTimer += dt
      const dur = 3.4
      if (breachTimer >= dur) {
        breachTimer = -1
        rippleRings.forEach((r) => {
          r.mesh.visible = false
        })
      } else {
        const u = breachTimer / dur
        const leap = Math.sin(u * Math.PI)
        whaleGroup.position.set(
          WHALE_HOME.x + (u - 0.5) * 6.5,
          -1.2 + leap * 7.5,
          WHALE_HOME.z + Math.sin(u * Math.PI * 2) * 2.2,
        )
        whaleGroup.rotation.z = (0.5 - u) * 1.62
        whaleGroup.rotation.y = Math.sin(u * Math.PI) * 0.35
        if (u > 0.72 && !breachSplashFired) {
          breachSplashFired = true
          water.setRipple(whaleGroup.position.x, whaleGroup.position.z)
        }
        rippleRings.forEach((r) => {
          const local = (breachTimer - r.delay) / 1.85
          if (local > 0 && local < 1) {
            r.mesh.visible = true
            const s = 0.8 + local * 3.1
            r.mesh.scale.setScalar(s)
            r.mat.opacity = Math.sin(local * Math.PI) * 0.72
          } else {
            r.mesh.visible = false
          }
        })
      }
    } else {
      const patrol = t * 0.45
      whaleGroup.position.set(
        WHALE_HOME.x + Math.sin(patrol) * 3.2,
        -1.0 + Math.sin(t * 1.65) * 0.5,
        WHALE_HOME.z + Math.cos(patrol) * 1.4,
      )
      whaleGroup.rotation.z = Math.cos(t * 1.65) * 0.16
      whaleGroup.rotation.y = Math.cos(patrol) >= 0 ? 0.15 : Math.PI - 0.15
    }

    if (flareActive) {
      moteMat.opacity = Math.min(0.5, moteMat.opacity + dt * 0.3)
      const attr = moteGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < moteCount; i += 1) {
        let y = attr.getY(i) + dt * (1.6 + (i % 5) * 0.5)
        if (y > 30) y = 0.4
        attr.setY(i, y)
        attr.setX(i, attr.getX(i) + Math.sin(t * 0.9 + i) * dt * 0.8)
      }
      attr.needsUpdate = true
    }
  })

  // 漫步地形采样器：沿岸村道 + 码头 + 石岬 + 护岸步道
  ctx.setWalkHeightSampler?.((x, z) => {
    if (x >= -58 && x <= 58 && z >= -42 && z <= 18.2) return 0.42
    if (Math.abs(x + 2) <= 2.4 && z >= 18.2 && z <= 37) return 0.42
    if (x >= 11 && x <= 29 && z >= 18.2 && z <= 33) return 0.5
    return null
  })

  // 漫步防护栏（护岸内侧留出观景口）
  const railMat = createMat('#6a5342', { map: ctx.textures.weatheredWoodTex, roughness: 0.82 })
  const railPostMat = createMat('#4f3d30', { map: ctx.textures.weatheredWoodTex, roughness: 0.86 })
  const addRailSpan = (x0: number, z0: number, x1: number, z1: number) => {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    if (len < 0.2) return
    const angle = Math.atan2(dx, dz)
    const cx = (x0 + x1) * 0.5
    const cz = (z0 + z1) * 0.5
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, len), railMat)
    topRail.position.set(cx, 1.1, cz)
    topRail.rotation.y = angle
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, len), railMat)
    midRail.position.set(cx, 0.78, cz)
    midRail.rotation.y = angle
    g.add(topRail, midRail)
    const posts = Math.max(2, Math.round(len / 2.2))
    for (let i = 0; i <= posts; i += 1) {
      const t = i / posts
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 0.14), railPostMat)
      post.position.set(x0 + dx * t, 0.8, z0 + dz * t)
      g.add(post)
    }
  }
  addRailSpan(-58, 18.6, -6.5, 18.6)
  addRailSpan(-1.5, 18.6, 11, 18.6)
  addRailSpan(33, 18.6, 58, 18.6)

  enableShadows(g, true, true)
  water.mesh.castShadow = false
  beamA.castShadow = false
  beamB.castShadow = false
  auroraMain.castShadow = false
  auroraBack.castShadow = false
  auroraMotes.castShadow = false
}

export { buildKyoto } from './cities/kyoto'

/**
 * 9. 地心深处 · 落日六号耐压舱
 * 建筑：炽热铁镍熔岩对流海、剖面球形钛金耐压舱「SUNSET-06」、三道倾斜旋转金色中微子环、舱内全息草原野花投影
 * 唤醒：3/3 后爆发地核 360 GPa 金色双搏心跳冲击波与全息草原金光微粒
 */
export function buildCore(ctx: DioramaBuilderCtx) {
  buildSculptedPlinth(ctx, {
    topColor: '#1b141d',
    sideColor: '#2a1f28',
    stoneColor: '#17141b',
    skipPlaza: true,
    horizonStyle: 'cavern',
    horizonAccent: '#ffba66',
    horizonVariant: 'core',
  })
  buildForegroundDeck(ctx, {
    kind: 'stone',
    x: 0.35,
    width: 3.6,
    shoreZ: 2.0,
    frontZ: 4.5,
    color: '#353943',
    edgeColor: '#1d2731',
    rail: 'metal',
  })

  const g = new THREE.Group()
  ctx.group.add(g)
  ctx.setFramingView?.({ pos: [1.2, 2.5, 8.2], look: [0, 3.2, -0.5], fov: 50 })

  const pTex = createPainterlyTextures()
  const disposableGeos: THREE.BufferGeometry[] = []
  const disposableMats: THREE.Material[] = []
  ctx.addDisposeHook?.(() => {
    pTex.dispose()
    disposableGeos.forEach((geo) => geo.dispose())
    disposableMats.forEach((mat) => mat.dispose())
  })

  // 1. 坚固的钛金观景栈桥护栏与延展平台（防止 Walk Mode 悬空断层）
  const catwalkPostMat = createMat('#2f3946', { metalness: 0.78, roughness: 0.34 })
  const catwalkRailMat = createMat('#667486', { metalness: 0.82, roughness: 0.28 })
  const catwalkBeaconMat = createMat('#ffcf78', { emissive: '#ff962e', emissiveIntensity: 1.35 })
  const catwalkDeckMat = createMat('#262b35', { metalness: 0.55, roughness: 0.58 })
  const obsidianRockMat = new THREE.MeshStandardMaterial({
    color: '#281d26',
    roughness: 0.88,
    metalness: 0.14,
  })
  disposableMats.push(obsidianRockMat)

  const catwalkApron = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 4.5), catwalkDeckMat)
  catwalkApron.position.set(0.35, 0.04, 6.75)
  g.add(catwalkApron)

  const addCatwalkRailSpan = (x0: number, z0: number, x1: number, z1: number, height = 0.68, baseY = 0.13) => {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    if (len < 0.15) return
    const angle = Math.atan2(dx, dz)
    const cx = (x0 + x1) * 0.5
    const cz = (z0 + z1) * 0.5
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, len), catwalkRailMat)
    topBar.position.set(cx, baseY + height, cz)
    topBar.rotation.y = angle
    const midBar = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.032, len), catwalkRailMat)
    midBar.position.set(cx, baseY + height * 0.54, cz)
    midBar.rotation.y = angle
    const kickPlate = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, len), catwalkPostMat)
    kickPlate.position.set(cx, baseY + 0.045, cz)
    kickPlate.rotation.y = angle
    g.add(topBar, midBar, kickPlate)

    const stanchionCount = Math.max(2, Math.round(len / 0.85))
    for (let i = 0; i <= stanchionCount; i += 1) {
      const t = i / stanchionCount
      const px = x0 + dx * t
      const pz = z0 + dz * t
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, height, 0.075), catwalkPostMat)
      post.position.set(px, baseY + height * 0.5, pz)
      g.add(post)
      if (i % 2 === 0) {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.036, 0.048), catwalkBeaconMat)
        marker.position.set(px, baseY + height + 0.035, pz)
        g.add(marker)
      }
    }
  }
  // 观景平台三面坚固工业护栏（前方护栏略低以保持 Walk Mode 球舱视野通透）
  addCatwalkRailSpan(-1.45, 2.0, 2.15, 2.0, 0.54)
  addCatwalkRailSpan(-1.45, 2.0, -1.45, 3.8, 0.68)
  addCatwalkRailSpan(2.15, 2.0, 2.15, 3.8, 0.68)
  addCatwalkRailSpan(-2.45, 4.5, -2.45, 8.95, 0.72, 1.15)
  addCatwalkRailSpan(3.15, 4.5, 3.15, 8.95, 0.72, 1.15)
  addCatwalkRailSpan(-2.45, 8.95, 3.15, 8.95, 0.72, 1.15)

  // 架空钛金观景栈道：登舱台阶 + 抬升平台（漫步在熔岩海之上的工业步道）
  const boardingStep = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.64, 0.7), catwalkDeckMat)
  boardingStep.position.set(0.35, 0.32, 4.15)
  boardingStep.receiveShadow = true
  g.add(boardingStep)

  const apronTopY = 1.15
  const catwalkApronElevated = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 4.5), catwalkDeckMat)
  catwalkApronElevated.position.set(0.35, apronTopY - 0.09, 6.75)
  catwalkApronElevated.receiveShadow = true
  g.add(catwalkApronElevated)
  for (const cx of [-2.2, -0.9, 0.35, 1.6, 2.9]) {
    for (const cz of [5.1, 6.75, 8.4]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, apronTopY - 0.18, 8), catwalkPostMat)
      column.position.set(cx, (apronTopY - 0.18) * 0.5, cz)
      g.add(column)
    }
  }

  // 漫步地形采样器：检修甲板 0.13 → 登舱台阶 0.64 → 架空栈道 1.15 → 环形外环栈道 1.15
  ctx.setWalkHeightSampler?.((x, z) => {
    if (x >= -2.45 && x <= 3.15 && z >= 4.5 && z <= 9.0) return apronTopY - 0.02
    if (x >= -2.45 && x <= 3.15 && z >= 3.8 && z < 4.5) return 0.64
    if (x >= -1.45 && x <= 2.15 && z >= 2.0 && z < 3.8) return 0.13
    // 环形外环栈道（×2 扩图）：围绕耐压舱的钛金观测环
    const rr = Math.hypot(x, z + 0.15)
    if (rr >= 5.55 && rr <= 7.35) return apronTopY - 0.02
    return null
  })

  // 环形外环观测栈道（×2 扩图）：围绕球舱的钛金观测环 + 支撑柱 + 环形护栏 + 观测舱
  const outerRing = new THREE.Group()
  outerRing.name = 'outer-observation-ring'
  const ringSegments = 14
  for (let i = 0; i < ringSegments; i += 1) {
    const a = (i / ringSegments) * Math.PI * 2
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.18, 3.1),
      catwalkDeckMat,
    )
    seg.position.set(Math.cos(a) * 6.45, apronTopY - 0.09, -0.15 + Math.sin(a) * 6.45)
    seg.rotation.y = -a + Math.PI / 2
    outerRing.add(seg)
    // 支撑柱（插入岩浆海）
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, apronTopY - 0.18, 8),
      catwalkPostMat,
    )
    column.position.set(Math.cos(a) * 6.45, (apronTopY - 0.18) * 0.5, -0.15 + Math.sin(a) * 6.45)
    outerRing.add(column)
    // 内外护栏立柱与琥珀信标
    if (i % 2 === 0) {
      for (const side of [-1.15, 1.15]) {
        const px = Math.cos(a) * (6.45 + side)
        const pz = -0.15 + Math.sin(a) * (6.45 + side)
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.66, 0.07), catwalkPostMat)
        post.position.set(px, apronTopY + 0.3, pz)
        outerRing.add(post)
        if (i % 4 === 0) {
          const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), catwalkBeaconMat)
          beacon.position.set(px, apronTopY + 0.66, pz)
          outerRing.add(beacon)
        }
      }
    }
  }
  // 环形护栏横杆（内外两圈细管）
  const railRingMat = createMat('#667486', { metalness: 0.82, roughness: 0.28 })
  for (const rr of [5.35, 7.55]) {
    const railRing = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.032, 6, 64), railRingMat)
    railRing.rotation.x = Math.PI / 2
    railRing.position.set(0, apronTopY + 0.62, -0.15)
    outerRing.add(railRing)
  }
  g.add(outerRing)

  // 外环观测舱：测微子望远镜 + 中微子计数屏（第 5 段奇遇触发点）
  const obsPod = new THREE.Group()
  obsPod.name = 'outer-observatory-pod'
  obsPod.position.set(-6.45, apronTopY, -0.15)
  const podBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.22, 10), catwalkDeckMat)
  podBase.position.y = 0.11
  const telescopeBody = new THREE.Group()
  telescopeBody.position.y = 0.62
  const scopeMount = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.55, 10), catwalkPostMat)
  scopeMount.position.y = 0.1
  const scopeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.09, 0.85, 12),
    createMat('#d4b26a', { metalness: 0.82, roughness: 0.24 }),
  )
  scopeTube.rotation.z = Math.PI / 2.6
  scopeTube.rotation.x = 0.35
  scopeTube.position.set(0.18, 0.42, 0.12)
  const scopeLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    createMat('#8ef2de', { emissive: '#3cd8c4', emissiveIntensity: 1.35 }),
  )
  scopeLens.position.set(-0.24, 0.72, 0.24)
  const scopeHalo = makeGlowSprite(ctx.textures.glowHalo, '#6fe8d8', 1.3, 0.55)
  scopeHalo.position.set(-0.24, 0.72, 0.24)
  telescopeBody.add(scopeMount, scopeTube, scopeLens, scopeHalo)
  const counterScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.34, 0.03),
    createMat('#8ef2de', { emissive: '#2cc2b0', emissiveIntensity: 1.0 }),
  )
  counterScreen.position.set(-0.55, 0.5, 0.1)
  counterScreen.rotation.y = 0.6
  obsPod.add(podBase, telescopeBody, counterScreen)
  g.add(obsPod)

  // 奇遇：外环观测台——望远镜对准地核，中微子计数爆发
  ctx.registerInteractive(obsPod, {
    encounterId: 'observatory',
    focusPoint: new THREE.Vector3(-6.45, apronTopY + 1.0, -0.15),
    onClick: () => {
      scopeLens.material.emissiveIntensity = 2.6
      scopeHalo.material.opacity = 0.95
      counterScreen.material.emissiveIntensity = 2.4
      resonanceBoost = Math.max(resonanceBoost, 1.6)
      ctx.setWaterBio(0.7)
      ctx.discoverEncounter('observatory')
      return { label: '望远镜对准地核，中微子计数器替她数着星星', sfx: 'star' }
    },
  })

  // 栈桥底部工字钢桁架与四角琥珀警示灯塔（Amber Warning Beacons）
  for (const bx of [-1.25, 0.35, 1.95]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 4.4), catwalkPostMat)
    beam.position.set(bx, 0.04, 6.75)
    g.add(beam)
  }
  const warningBeacons: { mat: THREE.MeshStandardMaterial; halo: THREE.Sprite; phase: number }[] = []
  const warnCoords: [number, number][] = [
    [-1.45, 2.0],
    [2.15, 2.0],
    [-2.45, 4.5],
    [3.15, 4.5],
  ]
  warnCoords.forEach(([wx, wz], idx) => {
    const wMat = createMat('#ffcf70', { emissive: '#ff8a18', emissiveIntensity: 1.5 })
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.08, 10), catwalkPostMat)
    housing.position.set(wx, 0.85, wz)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), wMat)
    dome.position.set(wx, 0.91, wz)
    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.1, 8, 1, true),
      new THREE.MeshStandardMaterial({ color: '#2a313c', metalness: 0.8, roughness: 0.3, wireframe: true }),
    )
    cage.position.set(wx, 0.91, wz)
    const wHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffa438', 0.62, 0.55)
    wHalo.position.set(wx, 0.92, wz)
    g.add(housing, dome, cage, wHalo)
    warningBeacons.push({ mat: wMat, halo: wHalo, phase: idx * 1.4 })
  })

  // 环绕岩浆海的锯齿黑曜石晶洞尖柱群（Faceted Obsidian / Crystal Geode Spires）与发光岩浆对流裂隙
  const obsidianSpireMat = createMat('#18111c', { roughness: 0.36, metalness: 0.28, flatShading: true })
  const geodeCrystalMat = createMat('#ffba66', {
    emissive: '#ff7d1a',
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.88,
    roughness: 0.14,
    flatShading: true,
  })
  const fissureGlowMat = createMat('#ff9430', { emissive: '#ff6614', emissiveIntensity: 1.35 })

  const geodeSpireSpecs: [number, number, number, number, number][] = [
    [-4.3, -2.6, 0.78, 3.8, 0.14],
    [-3.4, -3.5, 0.64, 2.9, -0.18],
    [-4.8, 0.4, 0.72, 3.2, 0.12],
    [4.4, -2.5, 0.82, 4.0, -0.15],
    [3.5, -3.6, 0.66, 2.8, 0.16],
    [4.9, 0.6, 0.7, 3.1, -0.12],
    [-2.4, -4.6, 0.74, 3.5, 0.08],
    [2.5, -4.5, 0.76, 3.6, -0.1],
  ]
  geodeSpireSpecs.forEach(([sx, sz, rad, h, tilt], idx) => {
    const spireGrp = new THREE.Group()
    spireGrp.position.set(sx, -0.02, sz)
    spireGrp.rotation.z = tilt
    spireGrp.rotation.y = idx * 0.75
    const mainSpire = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), obsidianSpireMat)
    mainSpire.position.y = h * 0.5
    const subSpire = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.55, h * 0.62, 5), obsidianSpireMat)
    subSpire.position.set(rad * 0.45, h * 0.3, rad * 0.25)
    subSpire.rotation.z = -0.28
    spireGrp.add(mainSpire, subSpire)

    // 嵌入晶洞侧面的发光水晶簇
    for (let c = 0; c < 4; c += 1) {
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.11 + (c % 2) * 0.05, 0.46 + (c % 3) * 0.18, 5),
        geodeCrystalMat,
      )
      crystal.position.set(
        (c % 2 === 0 ? -1 : 1) * rad * 0.36,
        0.55 + c * 0.42,
        rad * 0.32,
      )
      crystal.rotation.set(0.45, c * 0.8, (c % 2 === 0 ? 1 : -1) * 0.42)
      spireGrp.add(crystal)
    }
    g.add(spireGrp)
  })

  // 岩浆海周缘的玄武岩熔壳台地与发光对流裂隙（Magma Convection Fissures）
  const crustPlates: [number, number, number, number][] = [
    [-3.1, -1.3, 1.5, 0.4],
    [3.2, -1.1, 1.6, -0.5],
    [-3.3, 1.4, 1.3, 0.9],
    [3.4, 1.5, 1.4, -0.8],
  ]
  crustPlates.forEach(([px, pz, sc, rot]) => {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.82, sc, 0.18, 7), obsidianRockMat)
    plate.position.set(px, 0.02, pz)
    plate.rotation.y = rot
    const fissureA = new THREE.Mesh(new THREE.BoxGeometry(sc * 1.15, 0.04, 0.075), fissureGlowMat)
    fissureA.position.set(px, 0.11, pz)
    fissureA.rotation.y = rot + 0.35
    const fissureB = new THREE.Mesh(new THREE.BoxGeometry(sc * 0.78, 0.04, 0.06), fissureGlowMat)
    fissureB.position.set(px + 0.12, 0.11, pz - 0.08)
    fissureB.rotation.y = rot - 0.65
    g.add(plate, fissureA, fissureB)
  })

  // 平台外侧黑曜石熔岩礁石群
  const randCoreRock = createSeededRand(5501)
  for (let i = 0; i < 12; i += 1) {
    const side = i < 6 ? -1 : 1
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + randCoreRock() * 0.45, 0), obsidianRockMat)
    rock.scale.set(1.3, 0.72, 1.1)
    rock.position.set(side * (3.5 + randCoreRock() * 2.4), 0.12, 2.4 + (i % 6) * 1.15)
    rock.rotation.set(randCoreRock() * 0.5, randCoreRock() * Math.PI, randCoreRock() * 0.5)
    g.add(rock)
  }

  // 前景耐压观景台近景：低矮检修盖与实体舱压表，不遮挡球舱剖面
  const deckServiceMat = createMat('#46515e', { metalness: 0.76, roughness: 0.34 })
  const deckInsetMat = createMat('#151d27', { metalness: 0.42, roughness: 0.62 })
  const deckBoltMat = createMat('#a5afb8', { metalness: 0.82, roughness: 0.26 })
  const serviceHatch = new THREE.Group()
  serviceHatch.position.set(-0.82, 0.13, 3.05)
  const hatchInset = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.018, 0.46), deckInsetMat)
  hatchInset.position.y = 0.009
  const hatchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.025, 0.38), deckServiceMat)
  hatchPlate.position.y = 0.028
  serviceHatch.add(hatchInset, hatchPlate)
  for (const hx of [-0.23, 0.23]) {
    for (const hz of [-0.15, 0.15]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 6), deckBoltMat)
      bolt.position.set(hx, 0.047, hz)
      serviceHatch.add(bolt)
    }
  }
  g.add(serviceHatch)

  const pressureGauge = new THREE.Group()
  pressureGauge.position.set(2.13, 0.52, 2.72)
  const gaugeCase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.065, 20), deckServiceMat)
  gaugeCase.rotation.x = Math.PI / 2
  const gaugeFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.041, 24),
    createMat('#d4d0bd', { roughness: 0.72 }),
  )
  gaugeFace.position.z = 0.036
  const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.038, 0.008), deckInsetMat)
  gaugeNeedle.position.set(0.012, 0.014, 0.043)
  gaugeNeedle.rotation.z = -0.55
  pressureGauge.add(gaugeCase, gaugeFace, gaugeNeedle)
  g.add(pressureGauge)

  // 自定义 GLSL 熔融铁镍对流岩浆海
  const lavaUniforms = {
    uTime: { value: 0 },
    uPulsePos: { value: new THREE.Vector2(0, 0) },
    uPulseAge: { value: 8 },
    uEnergy: { value: 0.38 },
    uFogColor: { value: new THREE.Color('#3c1b1b') },
    uFadeRadius: { value: 56 },
  }
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: lavaUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uPulsePos;
      uniform float uPulseAge;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float swell = sin(p.x * 1.6 + uTime * 1.2) * cos(p.z * 1.5 - uTime * 0.9) * 0.055;
        vec4 w0 = modelMatrix * vec4(p, 1.0);
        float d = length(w0.xz - uPulsePos);
        float wave = sin((d - uPulseAge * 3.2) * 10.0) * exp(-abs(d - uPulseAge * 3.2) * 2.4) * exp(-uPulseAge * 1.1) * 0.07;
        p.y += swell + wave;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uPulsePos;
      uniform float uPulseAge;
      uniform float uEnergy;
      uniform vec3 uFogColor;
      uniform float uFadeRadius;
      varying vec3 vWorld;

      void main() {
        vec2 p = vWorld.xz * 0.72;
        float f1 = sin(p.x * 2.2 + uTime * 0.55 + cos(p.y * 2.1 - uTime * 0.42));
        float f2 = cos(p.y * 2.8 - uTime * 0.48 + sin(p.x * 2.6 + uTime * 0.6));
        float f3 = sin((p.x + p.y) * 3.6 + uTime * 0.72);
        float conv = clamp((f1 * 0.42 + f2 * 0.38 + f3 * 0.2) * 0.5 + 0.5, 0.0, 1.0);

        float crack = smoothstep(0.32, 0.86, conv);
        float hotCore = smoothstep(0.66, 0.98, conv + uEnergy * 0.16);

        vec3 crust = vec3(0.09, 0.05, 0.07);
        vec3 magma = vec3(0.84, 0.25, 0.06);
        vec3 gold = vec3(1.0, 0.68, 0.22);
        vec3 whiteHot = vec3(1.0, 0.94, 0.76);

        vec3 col = mix(crust, magma, crack);
        col = mix(col, gold, hotCore * (0.72 + uEnergy * 0.35));
        col += whiteHot * pow(hotCore, 3.0) * (0.45 + uEnergy * 0.65);

        float d = length(vWorld.xz - uPulsePos);
        float shock = smoothstep(0.32, 0.0, abs(d - uPulseAge * 3.2)) * exp(-uPulseAge * 1.15);
        col += vec3(1.0, 0.86, 0.5) * shock * 0.95;

        float radialGlow = 1.0 - smoothstep(0.6, 3.8, length(vWorld.xz));
        col += vec3(0.35, 0.14, 0.04) * radialGlow * (0.5 + uEnergy * 0.6);

        float horizonFade = smoothstep(22.0, uFadeRadius, length(vWorld.xz));
        col = mix(col, uFogColor, horizonFade);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const lavaGeo = new THREE.PlaneGeometry(66, 66, 72, 72)
  lavaGeo.rotateX(-Math.PI / 2)
  const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat)
  lavaMesh.position.y = -0.04
  lavaMesh.receiveShadow = true
  g.add(lavaMesh)

  ctx.bindWater(
    (rx, rz) => {
      lavaUniforms.uPulsePos.value.set(rx, rz)
      lavaUniforms.uPulseAge.value = 0
    },
    (bio) => {
      lavaUniforms.uEnergy.value = Math.max(0.38, bio)
    },
    (fogHex) => {
      lavaUniforms.uFogColor.value.set(fogHex)
    },
  )
  // 奇遇：熔岩心跳 —— 走近熔融铁镍海轻点岩流，聆听行星最深处的呼吸
  ctx.registerInteractive(lavaMesh, {
    encounterId: 'lava',
    focusPoint: new THREE.Vector3(-2.4, 0.3, -2.2),
    onClick: (pt) => {
      const ripplePoint = pt ? ctx.group.worldToLocal(pt.clone()) : null
      ctx.triggerRipple(ripplePoint?.x ?? 0, ripplePoint?.z ?? 0)
      coreEnergyTarget = Math.max(coreEnergyTarget, 0.78)
      resonanceBoost = Math.max(resonanceBoost, 1.4)
      ctx.discoverEncounter('lava')
      return { label: '岩浆翻涌如潮汐，这是行星最深处的呼吸', sfx: 'ripple' }
    },
  })

  // 65 颗缓慢上升的岩浆余烬
  const emberCount = 65
  const emberPos = new Float32Array(emberCount * 3)
  const emberCol = new Float32Array(emberCount * 3)
  const emberSpd = new Float32Array(emberCount)
  const emberPalette = [new THREE.Color('#ff8830'), new THREE.Color('#ffd076'), new THREE.Color('#fff2c4')]
  for (let i = 0; i < emberCount; i += 1) {
    emberPos[i * 3] = (Math.random() - 0.5) * 6.4
    emberPos[i * 3 + 1] = Math.random() * 5.2
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 6.4
    emberSpd[i] = 0.45 + Math.random() * 0.8
    const c = emberPalette[i % emberPalette.length]
    emberCol[i * 3] = c.r
    emberCol[i * 3 + 1] = c.g
    emberCol[i * 3 + 2] = c.b
  }
  const emberGeo = new THREE.BufferGeometry()
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
  emberGeo.setAttribute('color', new THREE.BufferAttribute(emberCol, 3))
  const emberMat = new THREE.PointsMaterial({
    size: 0.075,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const embers = new THREE.Points(emberGeo, emberMat)
  g.add(embers)

  // 「落日六号 SUNSET-06」剖面球形钛金深地耐压舱（悬浮于熔岩海上方）
  const vesselGroup = new THREE.Group()
  vesselGroup.position.set(0, 1.85, -0.15)

  const titaniumOuter = createMat('#5a677d', {
    metalness: 0.78,
    roughness: 0.28,
    side: THREE.DoubleSide,
  })
  const titaniumInner = createMat('#273246', {
    metalness: 0.62,
    roughness: 0.42,
    side: THREE.BackSide,
  })
  const brassHullMat = createMat('#e5b974', {
    emissive: '#b56e20',
    emissiveIntensity: 0.28,
    metalness: 0.82,
    roughness: 0.24,
  })

  // 正面向 +Z 敞开的球面剖面壳体（phi=PI/2 处开口 ±0.82 rad，完整展露舱内全息草原！）
  const phiStart = Math.PI * 0.5 + 0.82
  const phiLength = Math.PI * 2 - 1.64
  const outerHull = new THREE.Mesh(
    new THREE.SphereGeometry(1.52, 32, 24, phiStart, phiLength, 0.12, Math.PI * 0.86),
    titaniumOuter,
  )
  const innerHull = new THREE.Mesh(
    new THREE.SphereGeometry(1.44, 28, 20, phiStart, phiLength, 0.14, Math.PI * 0.82),
    titaniumInner,
  )
  vesselGroup.add(outerHull, innerHull)

  // 剖面舱口深凹环形耐压视窗框（Recessed Circular Viewport）+ 铆接赤道环 + 外部结构加强肋
  const viewportOuterFlange = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.072, 12, 36), brassHullMat)
  viewportOuterFlange.position.z = 1.0
  const viewportRecessCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.06, 0.18, 32, 1, true),
    createMat('#2a3444', { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }),
  )
  viewportRecessCollar.rotation.x = Math.PI / 2
  viewportRecessCollar.position.z = 0.94
  const viewportInnerRim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.036, 10, 36), titaniumOuter)
  viewportInnerRim.position.z = 0.87
  vesselGroup.add(viewportOuterFlange, viewportRecessCollar, viewportInnerRim)

  const rivetMat = createMat('#f2cf8d', { metalness: 0.86, roughness: 0.22 })
  for (let b = 0; b < 16; b += 1) {
    const a = (b / 16) * Math.PI * 2
    const flangeBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6), rivetMat)
    flangeBolt.rotation.x = Math.PI / 2
    flangeBolt.position.set(Math.cos(a) * 1.16, Math.sin(a) * 1.16, 1.06)
    vesselGroup.add(flangeBolt)
  }

  // 铆接赤道耐压环（Riveted Equatorial Collar）
  const eqBand = new THREE.Mesh(
    new THREE.CylinderGeometry(1.56, 1.56, 0.16, 40, 1, true, phiStart, phiLength),
    titaniumOuter,
  )
  const eqBelt = new THREE.Mesh(new THREE.TorusGeometry(1.57, 0.042, 8, 40, phiLength), brassHullMat)
  eqBelt.rotation.x = Math.PI / 2
  eqBelt.rotation.z = -phiStart
  vesselGroup.add(eqBand, eqBelt)
  for (let rv = 0; rv < 24; rv += 1) {
    const a = phiStart + (rv / 23) * phiLength
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), rivetMat)
    rivet.position.set(Math.sin(a) * 1.58, 0.055, Math.cos(a) * 1.58)
    const rivetLow = rivet.clone()
    rivetLow.position.y = -0.055
    vesselGroup.add(rivet, rivetLow)
  }

  // 外部经向结构加强肋（External Structural Ribs）
  for (const ribAngle of [-2.4, -1.65, 1.65, 2.4]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.54, 0.036, 8, 28, Math.PI * 0.84), titaniumOuter)
    rib.rotation.y = ribAngle
    rib.rotation.z = -Math.PI * 0.42
    vesselGroup.add(rib)
  }

  // 关节机械臂（Articulated Robotic Manipulator Arms）
  const armJointMat = createMat('#d49a4c', { metalness: 0.82, roughness: 0.28 })
  const manipulatorArms: { shoulder: THREE.Group; forearm: THREE.Group; side: number }[] = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 1.38, -0.52, 0.48)
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 12), titaniumOuter)
    mount.rotation.z = side * 0.5
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.11), titaniumOuter)
    upperArm.position.set(side * 0.12, -0.24, 0.16)
    upperArm.rotation.set(0.55, 0, side * -0.25)
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), armJointMat)
    elbow.position.set(side * 0.18, -0.46, 0.32)

    const forearmGrp = new THREE.Group()
    forearmGrp.position.copy(elbow.position)
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.062, 0.48, 10), titaniumOuter)
    forearm.rotation.x = Math.PI * 0.42
    forearm.position.set(0, -0.06, 0.22)
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), armJointMat)
    wrist.position.set(0, -0.11, 0.44)
    forearmGrp.add(forearm, wrist)
    for (const clawAngle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 4), armJointMat)
      claw.rotation.x = Math.PI * 0.48
      claw.position.set(Math.cos(clawAngle) * 0.045, -0.12 + Math.sin(clawAngle) * 0.045, 0.54)
      forearmGrp.add(claw)
    }
    shoulder.add(mount, upperArm, elbow, forearmGrp)
    vesselGroup.add(shoulder)
    manipulatorArms.push({ shoulder, forearm: forearmGrp, side })
  }

  // 前下方钨合金螺旋钻头锥（Front Tungsten Drill Cone）
  const drillTurret = new THREE.Group()
  drillTurret.position.set(0, -1.24, 0.92)
  drillTurret.rotation.x = 0.45
  const drillCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 16), titaniumOuter)
  const drillPivot = new THREE.Group()
  drillPivot.position.y = -0.12
  const tungstenMat = createMat('#475263', { metalness: 0.9, roughness: 0.22 })
  const drillTipMat = createMat('#ffba66', { emissive: '#ff7b24', emissiveIntensity: 0.9, metalness: 0.8 })
  const drillCone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 16), tungstenMat)
  drillCone.rotation.x = Math.PI
  drillCone.position.y = -0.36
  drillPivot.add(drillCone)
  for (let fl = 0; fl < 4; fl += 1) {
    const r = 0.25 - fl * 0.052
    const flute = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 6, 18), brassHullMat)
    flute.rotation.x = Math.PI / 2 + 0.18
    flute.position.y = -0.14 - fl * 0.14
    drillPivot.add(flute)
  }
  const drillTip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 12), drillTipMat)
  drillTip.rotation.x = Math.PI
  drillTip.position.y = -0.74
  drillPivot.add(drillTip)
  drillTurret.add(drillCollar, drillPivot)
  vesselGroup.add(drillTurret)

  const dorsalHatch = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.24, 14), titaniumOuter)
  dorsalHatch.position.y = 1.5
  vesselGroup.add(dorsalHatch)

  // 舱内开放式观察甲板 + 发光控制台 + 真实比例（1.68m）地心领航员
  const cabinDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.26, 1.12, 0.1, 24),
    createMat('#344258', { metalness: 0.55, roughness: 0.45 }),
  )
  cabinDeck.position.set(0, -0.56, -0.05)
  vesselGroup.add(cabinDeck)

  const deckGlowRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.14, 0.022, 6, 32),
    createMat('#ffd890', { emissive: '#ff9d3b', emissiveIntensity: 1.2 }),
  )
  deckGlowRing.rotation.x = Math.PI / 2
  deckGlowRing.position.set(0, -0.5, -0.05)
  vesselGroup.add(deckGlowRing)

  const consoleBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.52, 0.28, 16),
    createMat('#2a364c', { metalness: 0.65, roughness: 0.34 }),
  )
  consoleBase.position.set(0, -0.38, 0.08)
  const consolePadMat = createMat('#8ef2de', { emissive: '#3cd8c4', emissiveIntensity: 1.15 })
  const consolePad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.04, 16), consolePadMat)
  consolePad.position.set(0, -0.23, 0.08)
  vesselGroup.add(consoleBase, consolePad)

  const cabinLight = new THREE.PointLight('#ffd696', 2.4, 7.5, 1.6)
  cabinLight.position.set(0, 0.65, 0.25)
  vesselGroup.add(cabinLight)

  const pilot = createMiniPerson('#dfe6f0', '#ffbe66', { hatHex: '#f2c28b' })
  pilot.position.set(-0.68, -0.51, -0.18)
  pilot.rotation.y = 0.85
  vesselGroup.add(pilot)
  ctx.registerInteractive(pilot, {
    focusPoint: new THREE.Vector3(-0.68, 1.65, -0.33),
    onClick: () => ({
      label: '林微（落日六号）：不管下潜到多深，只要一朵全息野花还亮着，地面就没有远去。',
      sfx: 'star',
    }),
  })

  // 目标 1：钛金球舱外侧 4 枚琥珀中微子信标 + 顶部发射光束
  const beaconNodes: { mat: THREE.MeshStandardMaterial; halo: THREE.Sprite }[] = []
  const beaconCoords: [number, number, number][] = [
    [0, 1.72, 0],
    [-1.62, 0.08, 0],
    [1.62, 0.08, 0],
    [0, -1.62, 0],
  ]
  const beaconGroup = new THREE.Group()
  beaconCoords.forEach(([bx, by, bz]) => {
    const bMat = createMat('#ffcf78', { emissive: '#ff8a24', emissiveIntensity: 0.48, roughness: 0.2 })
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), bMat)
    crystal.position.set(bx, by, bz)
    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffa844', 1.05, 0.28)
    halo.position.set(bx, by, bz)
    beaconGroup.add(crystal, halo)
    beaconNodes.push({ mat: bMat, halo })
  })

  const dorsalBeamMat = new THREE.MeshBasicMaterial({
    color: '#ffbe66',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const dorsalBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.24, 3.6, 14, 1, true), dorsalBeamMat)
  dorsalBeam.position.y = 3.45
  beaconGroup.add(dorsalBeam)
  vesselGroup.add(beaconGroup)

  const igniteBeacons = () => {
    beaconNodes.forEach((b) => {
      b.mat.emissiveIntensity = 2.1
      b.halo.material.opacity = 0.92
    })
    dorsalBeamMat.opacity = 0.36
    ctx.discoverEncounter('beacon')
    return { label: '点亮落日六号钛金球舱外四枚琥珀信标', sfx: 'lamp' as const }
  }
  ctx.registerInteractive(beaconGroup, {
    encounterId: 'beacon',
    focusPoint: new THREE.Vector3(0, 3.55, -0.15),
    onClick: igniteBeacons,
  })
  ctx.registerInteractive(outerHull, {
    encounterId: 'beacon',
    focusPoint: new THREE.Vector3(0, 2.3, -0.15),
    onClick: igniteBeacons,
  })

  // 目标 2：舱内 3D 全息金色草原野花投影
  const holoGroup = new THREE.Group()
  holoGroup.position.set(0, -0.2, 0.08)

  const holoBeamMat = new THREE.MeshBasicMaterial({
    color: '#ffd98a',
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const holoCone = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.88, 20, 1, true), holoBeamMat)
  holoCone.rotation.x = Math.PI
  holoCone.position.y = 0.44
  holoGroup.add(holoCone)

  const flowerPivot = new THREE.Group()
  flowerPivot.position.y = 0.12
  flowerPivot.scale.setScalar(0.58)

  const stemMat = createMat('#8ef5b4', {
    emissive: '#3fe090',
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.86,
  })
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.05, 0.34, 0.02),
    new THREE.Vector3(0, 0.72, 0),
  ])
  flowerPivot.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.022, 6, false), stemMat))

  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), stemMat)
    leaf.scale.set(1.65, 0.25, 0.55)
    leaf.position.set(side * 0.14, 0.32 + side * 0.05, 0)
    leaf.rotation.z = side * 0.45
    flowerPivot.add(leaf)
  }

  const petalHoloMat = createMat('#ffe49e', {
    emissive: '#ffba48',
    emissiveIntensity: 1.45,
    transparent: true,
    opacity: 0.9,
  })
  const blossomHead = new THREE.Group()
  blossomHead.position.y = 0.76
  for (let p = 0; p < 8; p += 1) {
    const a = (p / 8) * Math.PI * 2
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), petalHoloMat)
    petal.scale.set(0.65, 0.28, 1.55)
    petal.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16)
    petal.rotation.y = -a + Math.PI / 2
    petal.rotation.x = 0.35
    blossomHead.add(petal)
  }
  const corePollen = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 10),
    createMat('#fff8dc', { emissive: '#ffd264', emissiveIntensity: 1.9 }),
  )
  blossomHead.add(corePollen)
  flowerPivot.add(blossomHead)

  // 环绕主野花的全息草原穹顶、起伏草坡、摇曳微风小树与发光野花群（Holographic Grassland Dome）
  const holoDomeMat = new THREE.MeshBasicMaterial({
    color: '#7ef2c8',
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
  })
  disposableMats.push(holoDomeMat)
  const holoDomeShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    holoDomeMat,
  )
  holoDomeShell.position.y = 0.04
  const holoDomeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.014, 6, 32),
    createMat('#96f8d4', { emissive: '#42e8a8', emissiveIntensity: 1.3 }),
  )
  holoDomeRing.rotation.x = Math.PI / 2
  holoDomeRing.position.y = 0.04

  // 起伏全息草坡（Rolling Meadow Hills）
  const meadowHillMat = createMat('#5ae098', {
    emissive: '#28a866',
    emissiveIntensity: 0.72,
    transparent: true,
    opacity: 0.78,
  })
  const hillSpecs: [number, number, number, number, number][] = [
    [0, 0.04, 0, 0.62, 0.14],
    [-0.24, 0.05, -0.14, 0.34, 0.18],
    [0.26, 0.05, 0.1, 0.3, 0.16],
  ]
  const miniMeadowRing = new THREE.Group()
  hillSpecs.forEach(([hx, hy, hz, r, h]) => {
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      meadowHillMat,
    )
    hill.scale.set(1, h / r, 1)
    hill.position.set(hx, hy, hz)
    miniMeadowRing.add(hill)
  })

  // 草原草坡上的微风小树（Tiny Wind-Tree）
  const windTreePivot = new THREE.Group()
  windTreePivot.position.set(-0.28, 0.12, -0.14)
  const treeTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.024, 0.24, 6),
    createMat('#d4b488', { emissive: '#886030', emissiveIntensity: 0.6 }),
  )
  treeTrunk.position.y = 0.12
  treeTrunk.rotation.z = -0.1
  const treeCrownMat = createMat('#8ef5b4', {
    emissive: '#4ce692',
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.88,
  })
  const crownA = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), treeCrownMat)
  crownA.position.set(0.02, 0.28, 0)
  const crownB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), treeCrownMat)
  crownB.position.set(-0.05, 0.24, 0.04)
  windTreePivot.add(treeTrunk, crownA, crownB)
  miniMeadowRing.add(windTreePivot)

  // 散落草坡的发光野花与草叶（Glowing Wildflowers）
  for (let m = 0; m < 10; m += 1) {
    const a = (m / 10) * Math.PI * 2
    const rad = 0.28 + (m % 3) * 0.11
    const fx = Math.cos(a) * rad
    const fz = Math.sin(a) * rad
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.18, 5), stemMat)
    blade.position.set(fx, 0.12, fz)
    const bud = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), petalHoloMat)
    bud.position.set(fx, 0.22, fz)
    miniMeadowRing.add(blade, bud)
  }
  flowerPivot.add(holoDomeShell, holoDomeRing, miniMeadowRing)

  // 2. 发光全息草原野花微粒（Glowing Holographic Wildflower Meadow Particles）
  const M_PARTICLE_COUNT = 84
  const mParticlePos = new Float32Array(M_PARTICLE_COUNT * 3)
  const mParticleCol = new Float32Array(M_PARTICLE_COUNT * 3)
  const mParticlePhase = new Float32Array(M_PARTICLE_COUNT)
  const mParticleRad = new Float32Array(M_PARTICLE_COUNT)
  const mParticleBaseY = new Float32Array(M_PARTICLE_COUNT)
  const randMeadow = createSeededRand(2026)
  const meadowPalette = [new THREE.Color('#ffe69c'), new THREE.Color('#8ff5b8'), new THREE.Color('#ffd068')]
  for (let i = 0; i < M_PARTICLE_COUNT; i += 1) {
    const ang = randMeadow() * Math.PI * 2
    const rad = 0.16 + randMeadow() * 0.62
    const py = 0.08 + randMeadow() * 1.15
    mParticlePhase[i] = ang
    mParticleRad[i] = rad
    mParticleBaseY[i] = py
    mParticlePos[i * 3] = Math.cos(ang) * rad
    mParticlePos[i * 3 + 1] = py
    mParticlePos[i * 3 + 2] = Math.sin(ang) * rad
    const c = meadowPalette[i % meadowPalette.length]
    mParticleCol[i * 3] = c.r
    mParticleCol[i * 3 + 1] = c.g
    mParticleCol[i * 3 + 2] = c.b
  }
  const mParticleGeo = new THREE.BufferGeometry()
  mParticleGeo.setAttribute('position', new THREE.BufferAttribute(mParticlePos, 3))
  mParticleGeo.setAttribute('color', new THREE.BufferAttribute(mParticleCol, 3))
  const mParticleMat = new THREE.PointsMaterial({
    map: ctx.textures.glowHalo,
    size: 0.095,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  disposableGeos.push(mParticleGeo)
  disposableMats.push(mParticleMat)
  const meadowParticles = new THREE.Points(mParticleGeo, mParticleMat)
  holoGroup.add(meadowParticles)

  const flowerHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffd98a', 1.45, 0.45)
  flowerHalo.position.y = 0.72
  flowerPivot.add(flowerHalo)

  holoGroup.add(flowerPivot)
  vesselGroup.add(holoGroup)

  let holoTargetScale = 0.58
  const expandHologram = () => {
    holoTargetScale = 1.15
    holoBeamMat.opacity = 0.3
    petalHoloMat.emissiveIntensity = 1.95
    flowerHalo.material.opacity = 0.88
    consolePadMat.emissiveIntensity = 1.9
    ctx.discoverEncounter('holo')
    return { label: '展开舱内全息金色草原野花投影 · 替她留住人间微风', sfx: 'star' as const }
  }
  ctx.registerInteractive(holoGroup, {
    encounterId: 'holo',
    focusPoint: new THREE.Vector3(0, 1.95, -0.05),
    onClick: expandHologram,
  })
  ctx.registerInteractive(consoleBase, {
    encounterId: 'holo',
    focusPoint: new THREE.Vector3(0, 1.72, -0.05),
    onClick: expandHologram,
  })

  // 目标 3：三道倾斜旋转金色中微子环 + 360 GPa 地核金色心跳冲击波
  const ringSpecs: [number, number, number, number, number][] = [
    [2.02, 0.042, 0.52, 0.22, 0.55],
    [2.44, 0.036, -0.44, 0.58, -0.42],
    [2.86, 0.03, 0.26, -0.62, 0.32],
  ]
  const neutrinoRings: { grp: THREE.Group; mat: THREE.MeshStandardMaterial; haloMat: THREE.MeshBasicMaterial; speed: number }[] = []
  const ringsRoot = new THREE.Group()

  ringSpecs.forEach(([rad, tube, rx, rz, spd], idx) => {
    const rg = new THREE.Group()
    rg.rotation.set(rx, idx * 0.9, rz)
    const rMat = createMat('#f4c882', {
      emissive: '#d87e20',
      emissiveIntensity: 0.45,
      metalness: 0.85,
      roughness: 0.2,
    })
    rg.add(new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 10, 48), rMat))
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#ffd480',
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    disposableMats.push(haloMat)
    rg.add(new THREE.Mesh(new THREE.TorusGeometry(rad, tube * 2.1, 8, 48), haloMat))
    const nodeMat = createMat('#fff0c8', { emissive: '#ffaa38', emissiveIntensity: 1.5 })
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2
      const nx = Math.cos(a) * rad
      const ny = Math.sin(a) * rad
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), nodeMat)
      node.position.set(nx, ny, 0)
      const nodeGlow = makeGlowSprite(ctx.textures.glowHalo, '#ffcf78', 0.56, 0.62)
      nodeGlow.position.set(nx, ny, 0)
      rg.add(node, nodeGlow)
    }
    ringsRoot.add(rg)
    neutrinoRings.push({ grp: rg, mat: rMat, haloMat, speed: spd })
  })
  vesselGroup.add(ringsRoot)
  g.add(vesselGroup)



  // 地核金色双搏心跳冲击波（球壳 + 赤道等离子波环）
  const shockWaves: { ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial; sphere: THREE.Mesh; sphereMat: THREE.MeshBasicMaterial; delay: number }[] = []
  for (let i = 0; i < 2; i += 1) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: i === 0 ? '#ffd884' : '#ff9c44',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.065, 10, 48), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 1.85, -0.15)
    ring.visible = false

    const sphereMat = new THREE.MeshBasicMaterial({
      color: '#ffca72',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18), sphereMat)
    sphere.position.set(0, 1.85, -0.15)
    sphere.visible = false

    g.add(ring, sphere)
    shockWaves.push({ ring, ringMat, sphere, sphereMat, delay: i * 0.42 })
  }

  let resonanceBoost = 0
  let shockTimer = -1
  let coreEnergyTarget = 0.38
  const fireCoreResonance = () => {
    resonanceBoost = 2.8
    shockTimer = 0
    coreEnergyTarget = 0.92
    neutrinoRings.forEach((r) => {
      r.mat.emissiveIntensity = 1.4
      r.haloMat.opacity = 0.62
    })
    ctx.triggerRipple(0, 0)
    shockWaves.forEach((w) => {
      w.ring.visible = true
      w.sphere.visible = true
    })
    ctx.discoverEncounter('resonance')
    return { label: '启动地核 360 GPa 金色心跳共振 · 中微子环全频对齐', sfx: 'celebrate' as const }
  }
  ctx.registerInteractive(ringsRoot, {
    encounterId: 'resonance',
    focusPoint: new THREE.Vector3(2.15, 2.05, -0.15),
    onClick: fireCoreResonance,
  })

  ctx.setFinaleTrigger(() => {
    resonanceBoost = 4.0
    shockTimer = 0
    coreEnergyTarget = 1.15
    holoTargetScale = 1.24
    ctx.triggerRipple(0, 0)
    ctx.setWaterBio(1.15)
    shockWaves.forEach((w) => {
      w.ring.visible = true
      w.sphere.visible = true
    })
  })

  ctx.addTick((t, dt) => {
    lavaUniforms.uTime.value = t
    lavaUniforms.uPulseAge.value = Math.min(10, lavaUniforms.uPulseAge.value + dt)
    lavaUniforms.uEnergy.value += (coreEnergyTarget - lavaUniforms.uEnergy.value) * Math.min(1, dt * 2.2)

    vesselGroup.position.y = 1.85 + Math.sin(t * 1.15) * 0.085
    resonanceBoost = Math.max(0, resonanceBoost - dt * 0.72)

    drillPivot.rotation.y += dt * (2.4 + resonanceBoost * 3.5)
    manipulatorArms.forEach((arm, idx) => {
      arm.shoulder.rotation.x = Math.sin(t * 0.9 + idx * 1.6) * 0.08
      arm.forearm.rotation.x = Math.sin(t * 1.3 + idx * 2.1) * 0.14
    })
    warningBeacons.forEach((wb) => {
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.4 + wb.phase)
      wb.mat.emissiveIntensity = 0.7 + pulse * 1.35
      wb.halo.material.opacity = 0.25 + pulse * 0.55
    })
    fissureGlowMat.emissiveIntensity = 0.95 + Math.sin(t * 2.1) * 0.28 + resonanceBoost * 0.35
    windTreePivot.rotation.z = Math.sin(t * 2.2) * 0.12
    windTreePivot.rotation.x = Math.cos(t * 1.7) * 0.06

    neutrinoRings.forEach((r, idx) => {
      const mul = 1 + resonanceBoost * 1.25
      r.grp.rotation.z += dt * r.speed * mul
      r.grp.rotation.y += dt * (idx % 2 === 0 ? 0.24 : -0.2) * mul
    })

    const curS = flowerPivot.scale.x
    const nextS = curS + (holoTargetScale - curS) * Math.min(1, dt * 4.2)
    flowerPivot.scale.setScalar(nextS)
    flowerPivot.rotation.y = t * 0.65
    blossomHead.rotation.z = Math.sin(t * 1.8) * 0.08

    const meadowExpand = THREE.MathUtils.clamp((nextS - 0.58) / 0.6, 0, 1.2)
    mParticleMat.opacity = 0.52 + meadowExpand * 0.36
    const mpAttr = mParticleGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < M_PARTICLE_COUNT; i += 1) {
      const ang = mParticlePhase[i] + t * (0.42 + (i % 3) * 0.14)
      const rad = mParticleRad[i] * (0.72 + meadowExpand * 0.45)
      const py = ((mParticleBaseY[i] + t * 0.24) % 1.28) + 0.04
      mpAttr.setXYZ(i, Math.cos(ang) * rad, py, Math.sin(ang) * rad)
    }
    mpAttr.needsUpdate = true



    // 上升岩浆余烬
    const eAttr = emberGeo.attributes.position as THREE.BufferAttribute
    const updraft = 1 + resonanceBoost * 0.85
    for (let i = 0; i < emberCount; i += 1) {
      let y = eAttr.getY(i) + dt * emberSpd[i] * updraft
      if (y > 5.4) y = 0.02
      const x = eAttr.getX(i) + Math.sin(t * 1.4 + i) * dt * 0.22
      const z = eAttr.getZ(i) + Math.cos(t * 1.2 + i) * dt * 0.22
      eAttr.setXYZ(i, x, y, z)
    }
    eAttr.needsUpdate = true

    // 360 GPa 金色双搏心跳冲击波
    if (shockTimer >= 0) {
      shockTimer += dt
      const dur = 2.8
      if (shockTimer >= dur) {
        shockTimer = -1
        shockWaves.forEach((w) => {
          w.ring.visible = false
          w.sphere.visible = false
        })
      } else {
        shockWaves.forEach((w) => {
          const local = (shockTimer - w.delay) / 1.95
          if (local > 0 && local < 1) {
            w.ring.visible = true
            w.sphere.visible = true
            const ease = 1 - Math.pow(1 - local, 2.2)
            w.ring.scale.setScalar(1.0 + ease * 4.2)
            w.ringMat.opacity = (1 - local) * 0.92
            w.sphere.scale.setScalar(1.55 + ease * 3.5)
            w.sphereMat.opacity = Math.sin(local * Math.PI) * 0.26
          } else {
            w.ring.visible = false
            w.sphere.visible = false
          }
        })
      }
    }
  })

  ctx.addMoodHook((mood) => {
    cabinLight.intensity = mood === 'night' ? 2.9 : mood === 'dawn' ? 2.1 : 2.5
  })

  enableShadows(g, true, true)
  lavaMesh.castShadow = false
  embers.castShadow = false
  holoCone.castShadow = false
  dorsalBeam.castShadow = false
  meadowParticles.castShadow = false
}
