import * as THREE from 'three'
import { buildSceneWater, createMat, enableShadows } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaBuilderCtx } from '../types'
import { buildContinuousRailing, buildStreetLampRow, createGlidingBirds, type CityRailSegment } from './cityKit'
import {
  createGlacialIceberg,
  createHallgrimurCliffLighthouse,
  createIcelandicAFrameCabin,
  createIcelandicTurfCottage,
  createSculptedWhale,
} from './icelandAssets'
import { createGeothermalPool, createNordicHarborBoat } from './radicalAssets'

/**
 * 冰岛 · 雷克雅未克极光峡湾（从零彻底重构，1:1 原生米制）：
 * - 半环形玄武岩峡湾环抱 400 × 260 m 镜面冰河湖，对岸远立“教会山 (Kirkjufell)”阶梯山脊；
 * - 左前伸入海湾的玄武岩海岬上耸立哈尔格林姆斯风格阶梯管风琴灯塔（无悬空铁架子）；
 * - 岸边错落点缀黑木 A 字落地玻璃屋、传统草皮顶小屋与冒白气的蓝湖地热温泉；
 * - 湾内游弋高细节座头鲸与透蓝杰古沙龙冰川浮冰。
 */
export function buildIcelandCity(ctx: DioramaBuilderCtx) {
  const g = new THREE.Group()
  g.name = 'reykjavik-aurora-fjord'
  ctx.group.add(g)

  const WATER_Y = -0.9
  const WALK_Y = 0.65
  const SHORE_Y = 0.35
  const CAPE = { x: -26, z: 24, deckY: 2.2 }
  const WHALE_HOME = { x: 14, z: 54 }
  const BOARDWALK = { minX: -32, maxX: 32, minZ: 7, maxZ: 20 }

  ctx.setFramingView?.({ pos: [18, 5.5, 16], look: [-16, 7, 45], fov: 58 })

  // -------------------------------------------------------------------------
  // 1. 远岸“教会山 (Kirkjufell)”与冰岛冰雪峡湾连续山脊（彻底替代绿锥假山）
  // -------------------------------------------------------------------------
  const horizonMountains = new THREE.Group()
  horizonMountains.name = 'horizon-mountains'
  horizonMountains.userData.horizonVariant = 'iceland'

  const ridgeGeo = new THREE.PlaneGeometry(480, 150, 108, 30)
  ridgeGeo.rotateX(-Math.PI / 2)
  const rPos = ridgeGeo.attributes.position
  const rCol = new Float32Array(rPos.count * 3)
  const basaltCol = new THREE.Color('#19222d')
  const mossCol = new THREE.Color('#273d40')
  const snowCol = new THREE.Color('#dce8f4')
  const tmpC = new THREE.Color()

  for (let i = 0; i < rPos.count; i += 1) {
    const vx = rPos.getX(i)
    const vz = rPos.getZ(i)
    const falloff = Math.max(0, 1 - Math.abs(vz) / 72)
    // Dramatic Kirkjufell-style stepped cone peak near x = -45 + flanking ridges
    const kirkjuDist = Math.hypot((vx + 42) * 0.9, vz * 1.15)
    const kirkjufell = Math.max(0, 62 - kirkjuDist * 1.15)
    const stepped = Math.floor(kirkjufell / 7) * 7 * 0.25 + kirkjufell * 0.75
    const ridge1 = Math.abs(Math.sin(vx * 0.025 + 0.4) * Math.cos(vz * 0.045)) * 46
    const ridge2 = Math.abs(Math.sin(vx * 0.062 - 0.9) * Math.sin(vz * 0.075 + 0.5)) * 24
    const h = Math.max(0, Math.max(stepped, (ridge1 + ridge2) * Math.pow(falloff, 0.75)) - 2)
    rPos.setY(i, h)

    if (h > 28) {
      tmpC.copy(mossCol).lerp(snowCol, Math.min(1, (h - 28) / 14))
    } else {
      tmpC.copy(basaltCol).lerp(mossCol, Math.min(1, h / 22))
    }
    rCol[i * 3] = tmpC.r
    rCol[i * 3 + 1] = tmpC.g
    rCol[i * 3 + 2] = tmpC.b
  }
  ridgeGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3))
  ridgeGeo.computeVertexNormals()
  const farRidge = new THREE.Mesh(
    ridgeGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }),
  )
  farRidge.position.set(0, -1.5, 224)
  horizonMountains.add(farRidge)
  g.add(horizonMountains)

  // -------------------------------------------------------------------------
  // 2. 起伏玄武岩苔原雪岸（z = -180 .. +12，自然曲线海岸 + 后方起坡）
  // -------------------------------------------------------------------------
  const snowMat = applyPbrSet(createMat('#dbe6f0', { roughness: 0.92 }), 'snow', 28, 12)
  const coastGeo = new THREE.PlaneGeometry(440, 190, 100, 40)
  coastGeo.rotateX(-Math.PI / 2)
  const cPos = coastGeo.attributes.position
  const cCol = new Float32Array(cPos.count * 3)
  const shoreBasalt = new THREE.Color('#27303a')
  const tundraMoss = new THREE.Color('#3a4a3f')
  const snowDrift = new THREE.Color('#d8e4ef')

  for (let i = 0; i < cPos.count; i += 1) {
    const vx = cPos.getX(i)
    const vz = cPos.getZ(i) // -95..+95 relative to z = -78 => world z = -173..+17
    const worldZ = vz - 78
    // Crescent bay: shoreline curves softly backward at far left/right and pokes out around x = -26 cape
    const capeBulge = Math.exp(-Math.pow((vx + 26) / 18, 2)) * 9
    const bayCurve = 5 + 3.5 * Math.sin(vx * 0.038) + capeBulge - Math.max(0, Math.abs(vx) - 48) * 0.25
    let y = SHORE_Y
    if (worldZ > bayCurve) {
      y = WATER_Y - 0.6 - Math.min(2.2, (worldZ - bayCurve) * 0.16)
    } else if (worldZ < -32) {
      const hill = (-32 - worldZ) * 0.14 + Math.abs(Math.sin(vx * 0.045 + worldZ * 0.02)) * 4.5
      y = SHORE_Y + Math.min(18, hill)
    } else {
      y = SHORE_Y + Math.max(0, Math.sin(vx * 0.08) * Math.cos(worldZ * 0.09) * 0.28)
    }
    cPos.setY(i, y)

    if (worldZ > bayCurve - 2.5) {
      tmpC.copy(shoreBasalt)
    } else if (y > 2.2) {
      tmpC.copy(tundraMoss).lerp(snowDrift, Math.min(1, (y - 2.2) / 4))
    } else {
      tmpC.copy(tundraMoss).lerp(snowDrift, 0.52)
    }
    cCol[i * 3] = tmpC.r
    cCol[i * 3 + 1] = tmpC.g
    cCol[i * 3 + 2] = tmpC.b
  }
  coastGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3))
  coastGeo.computeVertexNormals()
  const coastMesh = new THREE.Mesh(
    coastGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
  )
  coastMesh.name = 'open-horizon-ground'
  coastMesh.position.set(0, 0, -78)
  coastMesh.receiveShadow = true
  g.add(coastMesh)

  // -------------------------------------------------------------------------
  // 3. 镜面冰河湖与峡湾水面（420 × 260 m）
  // -------------------------------------------------------------------------
  const water = buildSceneWater(ctx, {
    width: 420,
    depth: 260,
    x: 0,
    z: 132,
    y: WATER_Y,
    deepHex: '#071928',
    shallowHex: '#154258',
    fadeRadius: 210,
    reflective: true,
  })
  water.mesh.name = 'mirror-fjord-420x260'
  water.mesh.userData.widthMetres = 420
  water.mesh.userData.depthMetres = 260
  ctx.bindWater(
    (x, z) => water.setRipple(x, z),
    (bio) => water.setBio(bio),
    (fogHex, sunHex, sunDir) => {
      const u = water.uniforms
      u.uFogColor.value.set(fogHex)
      if (sunHex) u.uSunCol.value.set(sunHex)
      if (sunDir) u.uSunDir.value.set(sunDir[0], sunDir[1], sunDir[2]).normalize()
    },
  )
  ctx.registerInteractive(water.mesh, {
    onClick: (point) => {
      const local = point ? ctx.group.worldToLocal(point.clone()) : null
      water.setRipple(local?.x ?? 0, local?.z ?? 54)
      return { label: '轻拨镜面峡湾 · 极光在水面碎成流动的绸', sfx: 'ripple' }
    },
  })

  // -------------------------------------------------------------------------
  // 4. 滨海木栈道前沿（64 × 13 m，topY = 0.65 m）与码头长灯
  // -------------------------------------------------------------------------
  const woodMat = createMat('#664c38', {
    map: ctx.textures.weatheredWoodTex,
    roughness: 0.84,
    bumpMap: ctx.textures.weatheredWoodTex,
    bumpScale: 0.045,
  })
  const boardwalk = new THREE.Group()
  boardwalk.name = 'waterfront-boardwalk-64m'
  boardwalk.userData.foregroundDeck = true
  const bwSlab = new THREE.Mesh(new THREE.BoxGeometry(64, 0.3, 13), woodMat)
  bwSlab.position.set(0, WALK_Y - 0.15, 13.5)
  bwSlab.receiveShadow = true
  boardwalk.add(bwSlab)
  for (let x = -30; x <= 30; x += 4) {
    for (const z of [7.4, 19.6]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), woodMat)
      pile.position.set(x, -0.3, z)
      boardwalk.add(pile)
    }
  }
  g.add(boardwalk)

  const railSegments: CityRailSegment[] = [
    { from: [-32, WALK_Y, 20], to: [-24.5, WALK_Y, 20] },
    { from: [-19.5, WALK_Y, 20], to: [32, WALK_Y, 20] },
    { from: [32, WALK_Y, 7], to: [32, WALK_Y, 20] },
    { from: [-32, WALK_Y, 7], to: [-32, WALK_Y, 20] },
  ]
  buildStreetLampRow(
    g,
    ctx.textures,
    [
      [-28, WALK_Y, 18.8],
      [-10, WALK_Y, 18.8],
      [10, WALK_Y, 18.8],
      [28, WALK_Y, 18.8],
    ],
    'iceland',
  )

  // -------------------------------------------------------------------------
  // 5. 左前玄武岩海岬 + 哈尔格林姆斯阶梯管风琴灯塔（奇遇 lighthouse）
  // -------------------------------------------------------------------------
  const basaltMat = createMat('#252e38', { roughness: 0.9, flatShading: true })
  const basaltLightMat = createMat('#34404d', { roughness: 0.88, flatShading: true })

  // Organic multi-tier basalt headland extending from shore into the fjord
  const headland = new THREE.Group()
  headland.name = 'lighthouse-basalt-headland'
  const capeBase = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 13.5, 3.2, 9), basaltMat)
  capeBase.position.set(CAPE.x, 0.6, CAPE.z)
  const capeSnow = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 9.6, 0.25, 9), snowMat)
  capeSnow.position.set(CAPE.x, CAPE.deckY - 0.12, CAPE.z)
  headland.add(capeBase, capeSnow)

  // Reynisfjara hexagonal basalt column cluster flanking the headland & west coast
  let seed = 881
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < 36; i += 1) {
    const side = i < 20 ? -1 : 1
    const bx = side < 0 ? -36 - (i % 5) * 2.2 + (rand() - 0.5) * 0.8 : 44 + ((i - 20) % 4) * 2.4
    const bz = side < 0 ? 12 + Math.floor(i / 5) * 4.2 : -18 + Math.floor((i - 20) / 4) * 5.2
    const h = 3.2 + rand() * 5.6
    const r = 0.95 + rand() * 0.65
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.86, r, h, 6),
      i % 2 === 0 ? basaltMat : basaltLightMat,
    )
    col.position.set(bx, SHORE_Y + h / 2 - 0.4, bz)
    col.rotation.y = (i % 6) * (Math.PI / 6)
    col.castShadow = true
    headland.add(col)
  }
  g.add(headland)

  // Clean wide timber jetty connecting boardwalk [-22, 0.65, 20] up onto the cape deck [-23, 2.2, 23]
  const jettyLen = Math.hypot(3.2, 3.8)
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.26, jettyLen), woodMat)
  jetty.position.set(-22, (WALK_Y + CAPE.deckY) / 2 - 0.13, 20.5)
  jetty.rotation.x = -Math.atan2(CAPE.deckY - WALK_Y, 4.2)
  jetty.receiveShadow = true
  g.add(jetty)
  railSegments.push(
    { from: [-23.5, WALK_Y, 19.2], to: [-23.5, CAPE.deckY, 22.8] },
    { from: [-20.5, WALK_Y, 19.2], to: [-20.5, CAPE.deckY, 22.8] },
  )
  buildContinuousRailing(g, railSegments, 'iron')

  const { lh, lanternMat, halo, lampLight, beamPivot, beamMat, fresnel } = createHallgrimurCliffLighthouse(
    ctx.textures.glowHalo,
  )
  lh.position.set(CAPE.x, CAPE.deckY, CAPE.z)
  lh.rotation.y = 0.55
  g.add(lh)

  let lighthouseOn = ctx.isEncounterDone('lighthouse')
  const awakenLighthouse = () => {
    lighthouseOn = true
    lanternMat.emissiveIntensity = 1.6
    halo.material.opacity = 0.88
    lampLight.intensity = 3.4
    beamMat.opacity = 0.16
  }
  if (lighthouseOn) awakenLighthouse()
  ctx.registerInteractive(lh, {
    encounterId: 'lighthouse',
    focusPoint: new THREE.Vector3(CAPE.x, CAPE.deckY + 12, CAPE.z),
    onClick: () => {
      awakenLighthouse()
      ctx.discoverEncounter('lighthouse')
      return { label: '玄武岩灯塔穿透极夜，光晕洒向冰河湖面', sfx: 'lamp' }
    },
  })

  // -------------------------------------------------------------------------
  // 6. 极光海湾村落：黑木 A 字落地玻璃屋 + 传统草皮顶小屋 + 冒白气的蓝湖热泉
  // -------------------------------------------------------------------------
  for (const [ax, az, rot] of [
    [16, -2, -0.22],
    [32, -8, -0.35],
    [-10, -10, 0.18],
  ] as [number, number, number][]) {
    const aFrame = createIcelandicAFrameCabin(ctx.textures.glowHalo)
    aFrame.position.set(ax, SHORE_Y, az)
    aFrame.rotation.y = rot
    g.add(aFrame)
  }

  for (const [tx, tz, rot, tint] of [
    [-26, -16, 0.2, '#22272f'],
    [2, -24, -0.08, '#5e2722'],
    [26, -24, -0.26, '#273846'],
    [-14, -34, 0.14, '#22272f'],
  ] as [number, number, number, string][]) {
    const cottage = createIcelandicTurfCottage(ctx.textures.glowHalo, tint)
    cottage.position.set(tx, SHORE_Y + 0.15, tz)
    cottage.rotation.y = rot
    g.add(cottage)
  }

  const geothermalPool = createGeothermalPool(ctx.textures.glowHalo)
  geothermalPool.position.set(6, SHORE_Y + 0.05, -10)
  g.add(geothermalPool)

  // Moored Nordic wooden boats floating gently in the harbor bay
  const boatA = createNordicHarborBoat(ctx.textures.glowHalo)
  boatA.position.set(16, WATER_Y + 0.12, 24)
  boatA.rotation.y = 0.4
  const boatB = createNordicHarborBoat(ctx.textures.glowHalo)
  boatB.position.set(28, WATER_Y + 0.12, 20)
  boatB.rotation.y = -0.35
  g.add(boatA, boatB)

  // -------------------------------------------------------------------------
  // 7. 极光天幕与冰川浮冰、座头鲸跃水（奇遇 aurora + whale）
  // -------------------------------------------------------------------------
  const auroraUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: ctx.isEncounterDone('aurora') ? 1.35 : 0.48 },
    uNight: { value: 0.9 },
  }
  const makeAuroraGeometry = (width: number, height: number, phase: number) => {
    const cols = 64
    const rows = 10
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    for (let r = 0; r <= rows; r += 1) {
      const v = r / rows
      for (let c = 0; c <= cols; c += 1) {
        const u = c / cols
        const x = (u - 0.5) * width
        const arch = -x * x * 0.0014
        const fold = Math.sin(u * Math.PI * 6 + phase) * 3.2 * Math.sin(v * Math.PI)
        positions.push(x, arch + v * height, fold)
        uvs.push(u, v)
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const a = r * (cols + 1) + c
        const b = a + cols + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }
  const auroraVertex = /* glsl */ `
    uniform float uTime;
    uniform float uPhase;
    varying vec2 vUv;
    varying float vFold;
    void main() {
      vUv = uv;
      vec3 p = position;
      float curtain = sin(p.x * 0.095 + uTime * 0.55 + uPhase) * 3.0;
      curtain += sin(p.x * 0.21 - uTime * 0.34 + uPhase * 1.7) * 1.4;
      p.z += curtain * (0.35 + uv.y * 0.65);
      p.y += sin(p.x * 0.055 + uTime * 0.3 + uPhase) * 1.1;
      vFold = 0.75 + 0.25 * sin(uv.x * 37.7 + uTime * 0.4);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `
  const auroraFragment = /* glsl */ `
    uniform float uTime;
    uniform float uIntensity;
    uniform float uNight;
    uniform float uPhase;
    varying vec2 vUv;
    varying float vFold;
    void main() {
      float rays = sin(vUv.x * 110.0 + uTime * 1.1 + uPhase) * 0.5 + 0.5;
      rays = pow(rays, 2.0) * 0.55 + 0.45;
      float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
      float vertical = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
      vec3 green = vec3(0.12, 0.98, 0.58);
      vec3 cyan = vec3(0.16, 0.86, 0.98);
      vec3 violet = vec3(0.66, 0.28, 0.98);
      vec3 color = mix(green, cyan, smoothstep(0.0, 0.45, vUv.y));
      color = mix(color, violet, smoothstep(0.48, 1.0, vUv.y));
      float alpha = edge * vertical * rays * vFold * uIntensity * uNight * 0.52;
      gl_FragColor = vec4(color, alpha);
    }
  `
  const auroraLayers = [
    { width: 260, height: 50, phase: 0, pos: [-8, 56, 178] },
    { width: 220, height: 42, phase: 2.2, pos: [12, 70, 198] },
    { width: 280, height: 58, phase: 4.1, pos: [-16, 46, 218] },
  ].map((layer) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...auroraUniforms, uPhase: { value: layer.phase } },
      vertexShader: auroraVertex,
      fragmentShader: auroraFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(makeAuroraGeometry(layer.width, layer.height, layer.phase), material)
    mesh.position.set(layer.pos[0], layer.pos[1], layer.pos[2])
    mesh.rotation.y = 0.08 * layer.phase
    g.add(mesh)
    return mesh
  })

  let auroraTarget = ctx.isEncounterDone('aurora') ? 1.55 : 0.48
  const awakenAurora = () => {
    auroraTarget = 1.65
    water.setBio(0.75)
  }
  const auroraBox = new THREE.Mesh(
    new THREE.BoxGeometry(220, 60, 40),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  auroraBox.position.set(0, 65, 190)
  g.add(auroraBox)
  ctx.registerInteractive(auroraBox, {
    encounterId: 'aurora',
    focusPoint: new THREE.Vector3(-8, 62, 180),
    onClick: () => {
      awakenAurora()
      ctx.discoverEncounter('aurora')
      return { label: '绿紫极光绸带在冰湾上空舒展开来', sfx: 'star' }
    },
  })

  // Translucent crystalline Jökulsárlón glacial icebergs floating in the bay
  const floes: { group: THREE.Group; baseY: number; phase: number }[] = []
  for (const [fx, fz, scale, seedVal] of [
    [-4, 42, 1.15, 1],
    [28, 48, 1.35, 3],
    [-46, 62, 1.5, 5],
    [44, 68, 1.25, 7],
    [4, 78, 1.6, 9],
  ] as [number, number, number, number][]) {
    const berg = createGlacialIceberg(scale, seedVal)
    berg.position.set(fx, WATER_Y - 0.1, fz)
    g.add(berg)
    floes.push({ group: berg, baseY: WATER_Y - 0.1, phase: seedVal * 0.9 })
  }

  // Sculpted Humpback Whale + ripple rings
  const whale = createSculptedWhale()
  whale.position.set(WHALE_HOME.x, WATER_Y + 0.15, WHALE_HOME.z)
  g.add(whale)
  const rippleRings: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; delay: number }[] = []
  for (let i = 0; i < 3; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: '#7ef2d4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    g.add(mesh)
    rippleRings.push({ mesh, material, delay: i * 0.4 })
  }

  let breachTimer = -1
  let breachSplashFired = false
  const launchWhaleBreach = () => {
    breachTimer = 0
    breachSplashFired = false
  }
  ctx.registerInteractive(whale, {
    encounterId: 'whale',
    focusPoint: new THREE.Vector3(WHALE_HOME.x, 2.0, WHALE_HOME.z),
    onClick: () => {
      launchWhaleBreach()
      ctx.discoverEncounter('whale')
      return { label: '座头鲸破开冰海跃水而出 · 漾起极光荧光波环', sfx: 'ripple' }
    },
  })

  ctx.setFinaleTrigger(() => {
    awakenLighthouse()
    awakenAurora()
    launchWhaleBreach()
    water.setBio(1.0)
  })

  // -------------------------------------------------------------------------
  // 8. 漫步与观景契约（确保 spawn 站稳 0.65 m，[100, 0] 在峡湾水域返回 null）
  // -------------------------------------------------------------------------
  ctx.setWalkHeightSampler?.((x, z) => {
    if (x >= BOARDWALK.minX && x <= BOARDWALK.maxX && z >= BOARDWALK.minZ && z <= BOARDWALK.maxZ) {
      return WALK_Y
    }
    if (Math.hypot(x - CAPE.x, z - CAPE.z) <= 9.5) return CAPE.deckY
    if (x >= -24 && x <= -20 && z >= 19 && z <= 23) {
      const t = THREE.MathUtils.clamp((z - 19) / 4, 0, 1)
      return THREE.MathUtils.lerp(WALK_Y, CAPE.deckY, t)
    }
    if (x >= -52 && x <= 52 && z >= -52 && z <= 7) return SHORE_Y
    return null
  })

  ctx.setVantageAnchor?.({
    label: '灯塔海岬 · 极光冰湾',
    pos: [CAPE.x + 2.4, CAPE.deckY + 1.65, CAPE.z + 1.5],
    yaw: Math.PI,
    pitch: -0.05,
  })

  let nightFactor = 0.9
  ctx.addTimeHook?.((_hour, factor) => {
    nightFactor = factor
  })
  ctx.addMoodHook((mood) => {
    nightFactor = mood === 'night' ? 0.92 : mood === 'dusk' ? 0.55 : 0.2
    lampLight.intensity = lighthouseOn ? 3.4 : mood === 'night' ? 2.0 : 1.2
  })

  const tickBirds = createGlidingBirds(g, [-4, 13, 44], 28, 3)

  ctx.addTick((time, dt) => {
    tickBirds(time)
    boatA.position.y = WATER_Y + 0.12 + Math.sin(time * 1.2) * 0.07
    boatA.rotation.z = Math.sin(time * 0.9) * 0.03
    boatB.position.y = WATER_Y + 0.12 + Math.cos(time * 1.1) * 0.07
    boatB.rotation.z = Math.cos(time * 0.85) * 0.03

    auroraUniforms.uTime.value = time
    auroraUniforms.uIntensity.value += (auroraTarget - auroraUniforms.uIntensity.value) * Math.min(1, dt * 2.4)
    auroraUniforms.uNight.value = nightFactor
    beamPivot.rotation.y += dt * (lighthouseOn ? 1.15 : 0.42)
    fresnel.rotation.y += dt * (lighthouseOn ? 1.15 : 0.42)

    for (const floe of floes) {
      floe.group.position.y = floe.baseY + Math.sin(time * 1.3 + floe.phase) * 0.12
      floe.group.rotation.z = Math.sin(time * 0.85 + floe.phase) * 0.025
    }

    if (breachTimer >= 0) {
      breachTimer += dt
      const duration = 3.4
      if (breachTimer >= duration) {
        breachTimer = -1
        rippleRings.forEach((ring) => { ring.mesh.visible = false })
      } else {
        const progress = breachTimer / duration
        const leap = Math.sin(progress * Math.PI)
        whale.position.set(
          WHALE_HOME.x + (progress - 0.5) * 6.5,
          WATER_Y - 0.3 + leap * 7.2,
          WHALE_HOME.z + Math.sin(progress * Math.PI * 2) * 2.0,
        )
        whale.rotation.z = (0.5 - progress) * 1.55
        if (progress > 0.72 && !breachSplashFired) {
          breachSplashFired = true
          water.setRipple(whale.position.x, whale.position.z)
        }
        for (const ring of rippleRings) {
          const local = (breachTimer - ring.delay) / 1.85
          ring.mesh.visible = local > 0 && local < 1
          if (ring.mesh.visible) {
            ring.mesh.position.set(WHALE_HOME.x, WATER_Y + 0.1, WHALE_HOME.z)
            ring.mesh.scale.setScalar(0.8 + local * 3.1)
            ring.material.opacity = Math.sin(local * Math.PI) * 0.72
          }
        }
      }
    } else {
      const patrol = time * 0.45
      whale.position.set(
        WHALE_HOME.x + Math.sin(patrol) * 3.2,
        WATER_Y + 0.12 + Math.sin(time * 1.65) * 0.45,
        WHALE_HOME.z + Math.cos(patrol) * 1.4,
      )
      whale.rotation.z = Math.cos(time * 1.65) * 0.14
      whale.rotation.y = Math.cos(patrol) >= 0 ? 0.15 : Math.PI - 0.15
    }
  })

  enableShadows(g, true, true)
  water.mesh.castShadow = false
  coastMesh.castShadow = false
  for (const aurora of auroraLayers) aurora.castShadow = false
  halo.castShadow = false
}
