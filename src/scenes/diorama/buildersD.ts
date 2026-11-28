import * as THREE from 'three'
import {
  buildSceneTerrain,
  buildSceneWater,
  createMat,
  enableShadows,
  makeGlowSprite,
} from './materials'
import {
  buildStarryConstellation,
} from './painterlyEngine'
import type { DioramaBuilderCtx, DioramaMood } from './types'

export { buildRome } from './cities/rome'

function createSeededRandParis(seedInit: number) {
  let seed = seedInit
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** 简易四脚格构铁塔（重建版埃菲尔，h 米） */
function createEiffelTowerV3(mat: THREE.Material, h: number, glowTex: THREE.Texture) {
  const tower = new THREE.Group()
  const four = 4
  const baseW = h * 0.36
  const addBeam = (p1: THREE.Vector3, p2: THREE.Vector3, r: number) => {
    const dir = new THREE.Vector3().subVectors(p2, p1)
    const len = dir.length()
    if (len < 0.05) return
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat)
    strut.position.copy(p1).addScaledVector(dir, 0.5)
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    tower.add(strut)
  }
  const levels = [0, 0.28, 0.52, 0.74, 1]
  const widthAt = (t: number) => baseW * (1 - t) * (1 - t * 0.72)
  for (let l = 0; l < levels.length - 1; l += 1) {
    const t0 = levels[l]
    const t1 = levels[l + 1]
    const y0 = t0 * h
    const y1 = t1 * h
    const w0 = widthAt(t0)
    const w1 = widthAt(t1)
    for (let i = 0; i < four; i += 1) {
      const a = (i / four) * Math.PI * 2 + Math.PI / 4
      const p0 = new THREE.Vector3(Math.cos(a) * w0 * 0.7, y0, Math.sin(a) * w0 * 0.7)
      const p1 = new THREE.Vector3(Math.cos(a) * w1 * 0.7, y1, Math.sin(a) * w1 * 0.7)
      addBeam(p0, p1, 0.55)
      const aNext = (((i + 1) % four) / four) * Math.PI * 2 + Math.PI / 4
      const pn0 = new THREE.Vector3(Math.cos(aNext) * w0 * 0.7, y0, Math.sin(aNext) * w0 * 0.7)
      const pn1 = new THREE.Vector3(Math.cos(aNext) * w1 * 0.7, y1, Math.sin(aNext) * w1 * 0.7)
      addBeam(p0, pn0, 0.3)
      addBeam(p1, pn1, 0.3)
      addBeam(p1, pn0, 0.24)
    }
  }
  const shaftH = h * 0.62
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.05, h * 0.09, h - shaftH, 8), mat)
  shaft.position.y = shaftH + (h - shaftH) / 2
  tower.add(shaft)
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, h * 0.1, 6), mat)
  spire.position.y = h + h * 0.05
  tower.add(spire)
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 8),
    createMat('#fff3cf', { emissive: '#ffca70', emissiveIntensity: 2.2 }),
  )
  beacon.position.y = h + 2.4
  tower.add(beacon)
  const beaconHalo = makeGlowSprite(glowTex, '#ffdf9c', 30, 0.7)
  beaconHalo.position.y = h + 2.4
  tower.add(beaconHalo)
  return { tower, beacon }
}

/** 奥斯曼建筑（真实米尺度，含门厅/老虎窗/阳台） */
function createHaussmannV3(
  w: number,
  h: number,
  d: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  winMat: THREE.Material,
  rng: () => number,
) {
  const house = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
  body.position.y = h / 2
  body.castShadow = true
  body.receiveShadow = true
  house.add(body)
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.8, d + 1.2), roofMat)
  cornice.position.y = h + 0.4
  house.add(cornice)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.18, d * 0.94), roofMat)
  roof.position.y = h + h * 0.09 + 0.8
  roof.castShadow = true
  house.add(roof)
  const rows = Math.max(2, Math.floor(h / 3.6))
  const cols = Math.max(2, Math.floor(w / 3.2))
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const wx = -w * 0.42 + (c + 0.5) * (w * 0.84 / cols)
      const wy = 1.6 + r * (h * 0.8 / rows)
      if (wy > h - 1.4) continue
      const lit = rng() > 0.42
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 2.0, 0.18),
        lit ? winMat : createMat('#3a3742', { roughness: 0.7 }),
      )
      win.position.set(wx, wy, d / 2 + 0.06)
      house.add(win)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.3), roofMat)
      rail.position.set(wx, wy - 1.05, d / 2 + 0.2)
      house.add(rail)
      const winB = win.clone()
      winB.position.z = -d / 2 - 0.06
      winB.rotation.y = Math.PI
      house.add(winB)
    }
  }
  return house
}

export function buildParisV3(ctx: DioramaBuilderCtx) {
  const g = new THREE.Group()
  ctx.group.add(g)
  ctx.setFramingView?.({ pos: [6, 8, 44], look: [-14, 14, -30], fov: 50 })

  const rng = createSeededRandParis(20250)
  const wallMat = createMat('#c8bfae', { roughness: 0.86, bumpMap: ctx.textures.plasterBump })
  const roofMat = createMat('#3c414f', { roughness: 0.62, metalness: 0.16 })
  const winMat = createMat('#ffdca1', { emissive: '#ffb967', emissiveIntensity: 0.85 })
  const stoneMat = createMat('#a8a3a5', { roughness: 0.88, bumpMap: ctx.textures.plasterBump })
  const pavementMat = createMat('#6e6a72', { roughness: 0.94 })
  const towerMat = createMat('#716678', { roughness: 0.34, metalness: 0.68 })
  const lampPoleMat = createMat('#353845', { roughness: 0.42, metalness: 0.62 })
  const lampBulbMat = createMat('#ffe2a8', { emissive: '#ffaa44', emissiveIntensity: 1.5 })

  // 南北两岸连续地形（塞纳河 z -30..30）
  buildSceneTerrain(ctx, {
    size: 420,
    color: '#5c5a5e',
    patchColor: '#66636a',
    flatRadius: 130,
    relief: 2.0,
    x: 0,
    z: 130,
    plaza: { w: 26, d: 16, topY: 0.35, color: '#8d8994' },
  })
  buildSceneTerrain(ctx, {
    size: 420,
    color: '#58565c',
    patchColor: '#626067',
    flatRadius: 130,
    relief: 2.0,
    x: 0,
    z: -130,
    plaza: { w: 26, d: 14, topY: 0.35, color: '#89858f' },
  })

  // 塞纳河镜面水面
  const water = buildSceneWater(ctx, {
    width: 420,
    depth: 60,
    x: 0,
    z: 0,
    y: -1.1,
    deepHex: '#101c33',
    shallowHex: '#25455e',
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
      water.setRipple(lp?.x ?? 0, lp?.z ?? 0)
      return { label: '轻点塞纳河暮色水面 · 紫粉天光碎成金波', sfx: 'ripple' }
    },
  })

  // 石砌堤岸与台阶（两岸沿河）
  const quayMat = createMat('#8d8994', { roughness: 0.9, bumpMap: ctx.textures.plasterBump })
  for (const side of [1, -1]) {
    const quayWall = new THREE.Mesh(new THREE.BoxGeometry(340, 1.6, 1.8), quayMat)
    quayWall.position.set(0, -0.3, side * 29.2)
    g.add(quayWall)
    const quayEdge = new THREE.Mesh(new THREE.BoxGeometry(340, 0.3, 3.2), quayMat)
    quayEdge.position.set(0, 0.28, side * 30.8)
    quayEdge.receiveShadow = true
    quayEdge.userData.foregroundDeck = true
    g.add(quayEdge)
  }

  // 沿河煤气路灯（灯光实时倒映水面）
  const lamps: { grp: THREE.Group; bulbMat: THREE.MeshStandardMaterial }[] = []
  for (let i = 0; i < 14; i += 1) {
    const lx = -91 + i * 14
    for (const side of [1, -1]) {
      const lamp = new THREE.Group()
      lamp.position.set(lx, 0.35, side * 32.4)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 5.4, 8), lampPoleMat)
      pole.position.y = 2.7
      pole.castShadow = true
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 12, Math.PI), lampPoleMat)
      arm.position.y = 5.3
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), lampBulbMat.clone())
      bulb.position.y = 5.1
      const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 4.6, 0.55)
      halo.position.y = 5.1
      lamp.add(pole, arm, bulb, halo)
      g.add(lamp)
      lamps.push({ grp: lamp, bulbMat: bulb.material as THREE.MeshStandardMaterial })
    }
  }

  // 北岸（右岸）奥斯曼街区：沿 z 42..78 两排
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 13; i += 1) {
      const bx = -92 + i * 14.6 + rng() * 2
      const bz = 46 + row * 16 + rng() * 3
      const w = 10.5 + rng() * 3
      const h = 15 + rng() * 7
      const house = createHaussmannV3(w, h, 12.5, wallMat, roofMat, winMat, rng)
      house.position.set(bx, 0.35, bz)
      g.add(house)
    }
  }
  // 南岸街区（z -46..-78），铁塔立于西南战神广场
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 12; i += 1) {
      const bx = -80 + i * 14.6 + rng() * 2
      const bz = -46 - row * 16 - rng() * 3
      if (bx < -66 && bz > -62) continue
      const w = 10.5 + rng() * 3
      const h = 15 + rng() * 7
      const house = createHaussmannV3(w, h, 12.5, wallMat, roofMat, winMat, rng)
      house.position.set(bx, 0.35, bz)
      g.add(house)
    }
  }

  // 埃菲尔铁塔（100m，战神广场西南）
  const eiffel = createEiffelTowerV3(towerMat, 100, ctx.textures.glowHalo)
  eiffel.tower.position.set(-42, 0.35, -62)
  eiffel.tower.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  g.add(eiffel.tower)

  let towerLit = false
  const champagneMat = createMat('#ffe5aa', { emissive: '#ffc96f', emissiveIntensity: 0.3 })
  ctx.registerInteractive(eiffel.tower, {
    encounterId: 'tower',
    focusPoint: new THREE.Vector3(-42, 46, -62),
    onClick: () => {
      towerLit = true
      champagneMat.emissiveIntensity = 2.2
      eiffel.beacon.material.emissiveIntensity = 3.0
      ctx.discoverEncounter('tower')
      return { label: '铁塔香槟星火逐层点亮 · 塔尖灯塔扫过暮色', sfx: 'star' as const }
    },
  })

  // 三孔石桥（跨河可走通两岸，z 0 处）
  const bridge = new THREE.Group()
  bridge.name = 'seine-stone-bridge'
  const bridgeWidth = 10
  for (let i = 0; i < 3; i += 1) {
    const az = -20 + i * 20
    const arch = new THREE.Mesh(new THREE.TorusGeometry(9, 1.1, 10, 26, Math.PI), stoneMat)
    arch.position.set(0, -0.6, az)
    arch.rotation.y = Math.PI / 2
    bridge.add(arch)
  }
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(bridgeWidth, 0.7, 68), stoneMat)
  bridgeDeck.position.set(0, 0.35, 0)
  bridgeDeck.receiveShadow = true
  bridgeDeck.userData.foregroundDeck = true
  bridge.add(bridgeDeck)
  for (const sx of [-bridgeWidth / 2 + 0.3, bridgeWidth / 2 - 0.3]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 68), stoneMat)
    parapet.position.set(sx, 1.0, 0)
    bridge.add(parapet)
    for (let p = 0; p < 7; p += 1) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), stoneMat)
      post.position.set(sx, 1.35, -30 + p * 10)
      bridge.add(post)
      if (p % 2 === 0) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampBulbMat)
        lamp.position.set(sx, 2.3, -30 + p * 10)
        const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 4.0, 0.5)
        halo.position.set(sx, 2.3, -30 + p * 10)
        bridge.add(lamp, halo)
      }
    }
  }
  g.add(bridge)

  ctx.registerInteractive(bridge, {
    encounterId: 'bridge',
    focusPoint: new THREE.Vector3(0, 2.4, 0),
    onClick: () => {
      lamps.forEach((l) => {
        l.bulbMat.emissiveIntensity = 2.0
      })
      winMat.emissiveIntensity = 1.3
      water.setBio(0.4)
      ctx.discoverEncounter('bridge')
      return { label: '塞纳石拱桥与两岸暖灯在紫粉天色里苏醒', sfx: 'lamp' as const }
    },
  })

  // 西岱岛（河心岛，双塔教堂 + 树 + 灯）+ 石拱小桥连接右岸
  const island = new THREE.Group()
  island.name = 'cite-island'
  const islandBase = new THREE.Mesh(new THREE.BoxGeometry(56, 1.4, 20), quayMat)
  islandBase.position.set(-62, -0.6, 0)
  islandBase.receiveShadow = true
  island.add(islandBase)
  const islandTop = new THREE.Mesh(new THREE.BoxGeometry(54, 0.3, 18), pavementMat)
  islandTop.position.set(-62, 0.2, 0)
  islandTop.receiveShadow = true
  islandTop.userData.foregroundDeck = true
  island.add(islandTop)
  const towerMat2 = createMat('#6e6a78', { roughness: 0.88, flatShading: true })
  for (const tx of [-72, -52]) {
    const twinTower = new THREE.Mesh(new THREE.BoxGeometry(5.4, 26, 5.4), towerMat2)
    twinTower.position.set(tx, 13.2, -2)
    twinTower.castShadow = true
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.8, 8.5, 8), towerMat2)
    spire.position.set(tx, 30.4, -2)
    island.add(twinTower, spire)
  }
  const nave = new THREE.Mesh(new THREE.BoxGeometry(22, 15, 9), towerMat2)
  nave.position.set(-62, 7.5, -3)
  island.add(nave)
  const islandTreeMat = createMat('#1e2c1c', { roughness: 0.95, flatShading: true })
  for (const [tx, tz, ts] of [
    [-52, 5, 1],
    [-74, 5, 1.2],
    [-62, 6.5, 0.9],
  ] as [number, number, number][]) {
    const tree = new THREE.Group()
    tree.position.set(tx, 0.35, tz)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * ts, 0.7 * ts, 8 * ts, 6), islandTreeMat)
    trunk.position.y = 4 * ts
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4 * ts, 1), islandTreeMat)
    crown.position.y = 9.5 * ts
    crown.scale.set(1.3, 0.9, 1.15)
    tree.add(trunk, crown)
    island.add(tree)
  }
  const islandLampBulb = createMat('#ffe2a8', { emissive: '#ffaa44', emissiveIntensity: 0.4 })
  const islandLamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), islandLampBulb)
  islandLamp.position.set(-50, 4.6, 6)
  const islandLampHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 6, 0.5)
  islandLampHalo.position.set(-50, 4.6, 6)
  island.add(islandLamp, islandLampHalo)
  g.add(island)

  // 河心岛小桥（右岸 → 岛）
  const footbridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.55, 5.5), stoneMat)
  footbridgeDeck.position.set(-38, 0.35, 2)
  footbridgeDeck.receiveShadow = true
  island.add(footbridgeDeck)

  ctx.registerInteractive(island, {
    encounterId: 'island',
    focusPoint: new THREE.Vector3(-50, 4.8, 6),
    onClick: () => {
      islandLampBulb.emissiveIntensity = 2.2
      islandLampHalo.material.opacity = 0.9
      water.setBio(0.3)
      ctx.discoverEncounter('island')
      return { label: '河心岛的灯亮起，两行柳影替塞纳河写了首短诗', sfx: 'lamp' as const }
    },
  })

  // 左岸书摊（绿箱）
  const bookstallMat = createMat('#2f5232', { roughness: 0.8 })
  for (const bx of [-14, -9]) {
    const stall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 1.6), bookstallMat)
    stall.position.set(bx, 1.05, 30.2)
    stall.castShadow = true
    g.add(stall)
    const books = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.3), createMat('#d8cfae', { roughness: 0.9 }))
    books.position.set(bx, 1.85, 30.2)
    g.add(books)
    ctx.registerInteractive(stall, {
      encounterId: 'books',
      focusPoint: new THREE.Vector3(bx, 2.2, 30.2),
      onClick: () => {
        winMat.emissiveIntensity = Math.max(winMat.emissiveIntensity, 1.2)
        ctx.discoverEncounter('books')
        return { label: '左岸旧书摊的灯亮了，半个巴黎的诗都住在绿箱子里', sfx: 'lamp' as const }
      },
    })
  }

  // 玻璃顶观光游船（河上缓行）
  const boat = new THREE.Group()
  const hull = new THREE.Mesh(new THREE.BoxGeometry(24, 1.8, 6), createMat('#1b2230', { roughness: 0.6 }))
  hull.position.y = 0.4
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(16, 2.6, 4.6), createMat('#d8cfc0', { roughness: 0.7 }))
  cabin.position.y = 2.0
  const boatWin = new THREE.Mesh(
    new THREE.BoxGeometry(15, 1.0, 4.7),
    createMat('#ffe2a8', { emissive: '#ffaa44', emissiveIntensity: 1.1 }),
  )
  boatWin.position.y = 2.0
  boat.add(hull, cabin, boatWin)
  boat.position.set(-8, -1.0, 8)
  g.add(boat)
  ctx.setRideAnchor?.(() => {
    boat.updateMatrixWorld()
    return { pos: boat.localToWorld(new THREE.Vector3(0, 3.4, 0)) }
  })
  ctx.registerInteractive(boat, {
    encounterId: 'boat',
    focusPoint: new THREE.Vector3(-8, 2.4, 8),
    onClick: () => {
      ctx.discoverEncounter('boat')
      return { label: '塞纳玻璃顶游船启航 · 晚霞水面拖出一条金波', sfx: 'ripple' as const }
    },
  })

  // 夜空：星空穹顶 + 星座连线（圆星光）
  const constellation = buildStarryConstellation(g, ctx.textures.glowHalo, ctx.textures.glowHalo)
  const skyHitPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 90),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  )
  skyHitPlane.position.set(0, 52, -108)
  g.add(skyHitPlane)
  ctx.registerInteractive(skyHitPlane, {
    encounterId: 'tower',
    focusPoint: new THREE.Vector3(-12, 46, -100),
    onClick: () => {
      constellation.triggerBigDipper()
      towerLit = true
      champagneMat.emissiveIntensity = 2.2
      ctx.discoverEncounter('tower')
      return { label: '北斗星流连成银线，铁塔香槟星火同频点亮', sfx: 'star' }
    },
  })

  let currentNightFactor = 0.85
  ctx.addTimeHook?.((_hour, nightFactor) => {
    currentNightFactor = nightFactor
  })
  ctx.addMoodHook((mood: DioramaMood) => {
    currentNightFactor = mood === 'night' ? 0.94 : mood === 'dawn' ? 0.28 : 0.76
    winMat.emissiveIntensity = mood === 'night' ? 1.0 : 0.85
  })

  ctx.addTick((t, dt) => {
    constellation.update(t, dt, currentNightFactor)
    boat.position.x = -8 + Math.sin(t * 0.14) * 26
    boat.position.y = -1.0 + Math.sin(t * 1.45) * 0.12
    boat.rotation.z = Math.sin(t * 1.2) * 0.014
    if (towerLit) {
      eiffel.beacon.material.emissiveIntensity = 2.6 + Math.sin(t * 3.4) * 0.5
    }
  })

  // 漫步地形采样器：两岸堤岸/街道 + 石桥 + 西岱岛
  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(z) >= 28 && Math.abs(z) <= 44 && Math.abs(x) <= 96) return 0.35
    if (Math.abs(x) <= 5 && Math.abs(z) <= 34) return 0.42
    if (x >= -88 && x <= -36 && Math.abs(z) <= 9.5) return 0.3
    if (Math.abs(x) <= 42 && z >= 34 && z <= 40) return 0.35
    return null
  })

  enableShadows(g, true, true)
  water.mesh.castShadow = false
}


function createSeededRandDali(seedInit: number) {
  let seed = seedInit
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** 白族院落（真实米尺度：三坊一照壁 + 悬檐 + 照壁） */
function createBaiCourtyardV3(
  w: number,
  d: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  ridgeMat: THREE.Material,
  winMat: THREE.Material,
  rng: () => number,
) {
  const yard = new THREE.Group()
  const bodyW = w
  const bodyD = d
  // 正房（北楼）
  const main = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.5, 6.4, bodyD * 0.36), wallMat)
  main.position.set(0, 3.2, -bodyD * 0.3)
  main.castShadow = true
  main.receiveShadow = true
  yard.add(main)
  const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.58, 0.6, bodyD * 0.42), roofMat)
  mainRoof.position.set(0, 6.7, -bodyD * 0.3)
  mainRoof.castShadow = true
  yard.add(mainRoof)
  const mainRidge = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.5, 0.5, 0.5), ridgeMat)
  mainRidge.position.set(0, 7.1, -bodyD * 0.3)
  yard.add(mainRidge)
  // 东西厢房
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.24, 4.8, bodyD * 0.44), wallMat)
    wing.position.set(side * bodyW * 0.4, 2.4, 0)
    wing.castShadow = true
    wing.receiveShadow = true
    yard.add(wing)
    const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.3, 0.5, bodyD * 0.5), roofMat)
    wingRoof.position.set(side * bodyW * 0.4, 5.1, 0)
    yard.add(wingRoof)
  }
  // 照壁（南墙）
  const screen = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.6, 5.2, 0.6), wallMat)
  screen.position.set(0, 2.6, bodyD * 0.42)
  screen.castShadow = true
  yard.add(screen)
  const screenCap = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.66, 0.5, 0.8), ridgeMat)
  screenCap.position.set(0, 5.4, bodyD * 0.42)
  yard.add(screenCap)
  // 门窗（暖光）
  for (let i = 0; i < 3; i += 1) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.14), winMat)
    win.position.set(-bodyW * 0.16 + i * bodyW * 0.16, 2.6, -bodyD * 0.3 + bodyD * 0.18 + 0.02)
    yard.add(win)
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.16), winMat)
  door.position.set(bodyW * 0.28, 1.3, bodyD * 0.42 - 0.36)
  yard.add(door)
  // 檐下灯笼
  const lanternMat = createMat('#ff944d', { emissive: '#ff6f28', emissiveIntensity: 0.9 })
  for (const lx of [-bodyW * 0.36, bodyW * 0.36]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lanternMat.clone())
    lantern.position.set(lx, 3.6, -bodyD * 0.12)
    yard.add(lantern)
  }
  void rng
  return yard
}

/** 崇圣寺三塔（真实米尺度：千寻塔 60m + 两配塔 38m） */
function createThreePagodasV3(bodyMat: THREE.Material, roofMat: THREE.Material, goldMat: THREE.Material) {
  const group = new THREE.Group()
  const makePagoda = (h: number, baseW: number, tiers: number, x: number) => {
    const pagoda = new THREE.Group()
    for (let t = 0; t < tiers; t += 1) {
      const tw = baseW * (1 - (t / tiers) * 0.55)
      const th = (h / tiers) * 0.86
      const body = new THREE.Mesh(new THREE.BoxGeometry(tw, th, tw), bodyMat)
      body.position.set(x, th / 2 + (t * h) / tiers, 0)
      body.castShadow = true
      pagoda.add(body)
      const eave = new THREE.Mesh(new THREE.BoxGeometry(tw * 1.14, 0.5, tw * 1.14), roofMat)
      eave.position.set(x, (t * h) / tiers + th, 0)
      pagoda.add(eave)
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(baseW * 0.18, h * 0.09, 6), goldMat)
    tip.position.set(x, h + h * 0.045, 0)
    pagoda.add(tip)
    return pagoda
  }
  group.add(makePagoda(60, 9, 13, 0))
  group.add(makePagoda(38, 6.4, 9, -13.5))
  group.add(makePagoda(38, 6.4, 9, 13.5))
  return group
}

/**
 * 大理 · 洱海苍山明月（1:1 原生尺度 · 写实场景重做）
 * 洱海大片镜面水 + 湖畔白族村落 + 环湖路 + 湖心长堤亭 + 苍山地形雪线 + 三塔
 * 五段「场景奇遇」：苍山月升 / 白族灯火 / 渔舟星月 / 栈桥涟漪 / 湖心亭望月
 */
export function buildDaliV3(ctx: DioramaBuilderCtx) {
  const g = new THREE.Group()
  ctx.group.add(g)
  ctx.setFramingView?.({ pos: [4, 8, 30], look: [2, 8, 70], fov: 50 })

  const rng = createSeededRandDali(9161)
  const wallMat = createMat('#e8e2d2', { roughness: 0.86, bumpMap: ctx.textures.plasterBump })
  const roofMat = createMat('#46575b', { roughness: 0.72 })
  const ridgeMat = createMat('#344146', { roughness: 0.68 })
  const goldMat = createMat('#d9b26f', { roughness: 0.35, metalness: 0.52 })
  const woodMat = createMat('#80614b', { roughness: 0.86 })
  const warmWindowMat = createMat('#ffe0a0', { emissive: '#ffbd68', emissiveIntensity: 0.55 })
  const stoneMat = createMat('#87928b', { roughness: 0.92 })
  const mountainMats = [
    createMat('#496c76', { roughness: 0.96, flatShading: true }),
    createMat('#3a5d69', { roughness: 0.96, flatShading: true }),
    createMat('#2f4d5b', { roughness: 0.96, flatShading: true }),
  ]
  const snowMat = createMat('#d4e3e8', { roughness: 0.88, flatShading: true })
  const pagodaBodyMat = createMat('#e8dfd0', { roughness: 0.84, bumpMap: ctx.textures.plasterBump })

  // 湖畔连续地形（村庄台地 z -200..40）
  buildSceneTerrain(ctx, {
    size: 420,
    color: '#3d4f42',
    patchColor: '#465c4b',
    flatRadius: 120,
    relief: 2.6,
    x: 0,
    z: -80,
    plaza: { w: 30, d: 14, topY: 0.35, color: '#6e7268' },
  })
  // 苍山山体（北侧隆起地形 + 雪线山群）
  buildSceneTerrain(ctx, {
    size: 420,
    color: '#31463c',
    patchColor: '#3a5245',
    flatRadius: 40,
    relief: 26,
    x: 0,
    z: 180,
  })

  // 洱海镜面水面（z 40..225 南侧大片）
  const water = buildSceneWater(ctx, {
    width: 420,
    depth: 185,
    x: 0,
    z: 132.5,
    y: -1.0,
    deepHex: '#0e2337',
    shallowHex: '#28516a',
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
    encounterId: 'pier',
    focusPoint: new THREE.Vector3(6, 0.3, 55),
    onClick: (pt) => {
      const lp = pt ? ctx.group.worldToLocal(pt.clone()) : null
      water.setRipple(lp?.x ?? 6, lp?.z ?? 55)
      water.setBio(0.5)
      ctx.discoverEncounter('pier')
      return { label: '涟漪一圈圈荡向月亮，洱海的银光路越来越宽', sfx: 'ripple' }
    },
  })

  // 湖岸石堤与滨湖步道（z 38..44）
  const shoreWall = new THREE.Mesh(new THREE.BoxGeometry(200, 1.8, 1.8), stoneMat)
  shoreWall.position.set(0, -0.35, 39.4)
  g.add(shoreWall)
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(200, 0.3, 5.6), createMat('#6e6f66', { roughness: 0.94 }))
  boardwalk.position.set(0, 0.3, 41.5)
  boardwalk.receiveShadow = true
  boardwalk.userData.foregroundDeck = true
  g.add(boardwalk)

  // 白族村落（z -10..-52，两排院落）
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 6; i += 1) {
      const bx = -62 + i * 24 + rng() * 4
      const bz = -14 - row * 22 - rng() * 4
      const yard = createBaiCourtyardV3(16 + rng() * 5, 12 + rng() * 3, wallMat, roofMat, ridgeMat, warmWindowMat, rng)
      yard.position.set(bx, 0.35, bz)
      yard.rotation.y = (rng() - 0.5) * 0.24
      g.add(yard)
    }
  }

  // 三塔（山坡上，z -52 处平台）
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(44, 3.2, 16), stoneMat)
  terrace.position.set(-58, 1.9, -52)
  terrace.receiveShadow = true
  g.add(terrace)
  const pagodas = createThreePagodasV3(pagodaBodyMat, roofMat, goldMat)
  pagodas.position.set(-58, 3.4, -52)
  pagodas.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  g.add(pagodas)

  // 苍山雪峰群（北侧地平，雪线以上留白）
  const peakRand = createSeededRandDali(614)
  for (let i = 0; i < 9; i += 1) {
    const px = -95 + i * 24
    const h = 90 + peakRand() * 70
    const peak = new THREE.Mesh(new THREE.ConeGeometry(34 + peakRand() * 14, h, 6), mountainMats[i % 3])
    peak.position.set(px, h / 2 - 4, -118 - peakRand() * 22)
    peak.scale.set(1.15, 1, 0.64)
    peak.rotation.y = i * 0.7
    g.add(peak)
    if (h > 120) {
      const snow = new THREE.Mesh(new THREE.ConeGeometry(11, h * 0.24, 6), snowMat)
      snow.position.set(px, h * 0.82, peak.position.z)
      snow.scale.set(1.15, 1, 0.64)
      snow.rotation.y = peak.rotation.y
      g.add(snow)
    }
  }

  // 环湖路灯
  const lampPoleMat = createMat('#3b3f45', { roughness: 0.5, metalness: 0.5 })
  const lampBulbMat = createMat('#ffe0a0', { emissive: '#ff9c3b', emissiveIntensity: 0.8 })
  const lamps: { bulbMat: THREE.MeshStandardMaterial }[] = []
  for (let i = 0; i < 10; i += 1) {
    const lx = -80 + i * 18
    const lamp = new THREE.Group()
    lamp.position.set(lx, 0.35, 45.4)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.6, 8), lampPoleMat)
    pole.position.y = 2.3
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampBulbMat.clone())
    bulb.position.y = 4.7
    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 4.0, 0.5)
    halo.position.y = 4.7
    lamp.add(pole, bulb, halo)
    g.add(lamp)
    lamps.push({ bulbMat: bulb.material as THREE.MeshStandardMaterial })
  }

  // 满月（洱海上空 + 柔和光环）
  const moonMat = createMat('#fff0cf', { emissive: '#ffe6b0', emissiveIntensity: 1.25, roughness: 0.92 })
  const moon = new THREE.Group()
  moon.position.set(10, 62, 168)
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 24), moonMat)
  moon.add(moonDisc)
  const moonHalo = makeGlowSprite(ctx.textures.glowHalo, '#e5edf0', 52, 0.4)
  moon.add(moonHalo)
  g.add(moon)
  let moonRaised = false
  ctx.registerInteractive(moon, {
    encounterId: 'moon',
    focusPoint: new THREE.Vector3(10, 60, 165),
    onClick: () => {
      moonRaised = true
      moonMat.emissiveIntensity = 1.6
      moonHalo.material.opacity = 0.6
      ctx.discoverEncounter('moon')
      return { label: '满月越过雪线，月光在湖面铺成一条长路', sfx: 'star' as const }
    },
  })

  // 湖心长堤（石堤从湖岸探入洱海）+ 湖心亭
  const causeway = new THREE.Group()
  causeway.name = 'erhai-causeway'
  const causewayBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 62), stoneMat)
  causewayBody.position.set(10, -0.4, 68)
  causewayBody.receiveShadow = true
  causewayBody.userData.foregroundDeck = true
  causeway.add(causewayBody)
  for (let p = 0; p < 5; p += 1) {
    for (const sx of [-2.0, 2.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), woodMat)
      post.position.set(10 + sx, 0.62, 46 + p * 11)
      causeway.add(post)
      if (p % 2 === 0) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lampBulbMat.clone())
        lamp.position.set(10 + sx, 1.15, 46 + p * 11)
        causeway.add(lamp)
      }
    }
  }
  // 六角湖心亭（两层檐）
  const pavilion = new THREE.Group()
  pavilion.position.set(10, 0.35, 96)
  const pavBase = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 1.0, 6), stoneMat)
  pavBase.position.y = 0.5
  pavilion.add(pavBase)
  for (let px = 0; px < 6; px += 1) {
    const a = (px / 6) * Math.PI * 2 + Math.PI / 6
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 5.6, 8), woodMat)
    col.position.set(Math.cos(a) * 4.0, 3.8, Math.sin(a) * 4.0)
    pavilion.add(col)
  }
  const pavRoofLow = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.9, 6), roofMat)
  pavRoofLow.position.y = 7.0
  const pavRoofTop = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 6), roofMat)
  pavRoofTop.position.y = 8.9
  const pavFinial = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 10, 8),
    createMat('#ffd890', { emissive: '#ffaa44', emissiveIntensity: 1.6 }),
  )
  pavFinial.position.y = 10.2
  const pavLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 10, 8),
    createMat('#ffe2a8', { emissive: '#ff8c2b', emissiveIntensity: 0.9 }),
  )
  pavLantern.position.y = 5.0
  const pavHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffc46b', 6.5, 0.42)
  pavHalo.position.y = 5.0
  pavilion.add(pavRoofLow, pavRoofTop, pavFinial, pavLantern, pavHalo)
  causeway.add(pavilion)
  g.add(causeway)

  ctx.registerInteractive(pavilion, {
    encounterId: 'pavilion',
    focusPoint: new THREE.Vector3(10, 4.5, 96),
    onClick: () => {
      pavLantern.material.emissiveIntensity = 2.2
      pavHalo.material.opacity = 0.9
      pavFinial.material.emissiveIntensity = 2.4
      moonRaised = true
      moonMat.emissiveIntensity = 1.6
      water.setBio(0.4)
      ctx.discoverEncounter('pavilion')
      return { label: '湖心亭的灯亮起，月亮离人间只隔一层水', sfx: 'lamp' as const }
    },
  })

  // 白族院落灯火（第 2 段奇遇：点亮任一院落）
  const courtyardGroup = new THREE.Group()
  const firstYardPos = new THREE.Vector3(-62, 2, -14)
  ctx.registerInteractive(courtyardGroup, {
    encounterId: 'lanterns',
    focusPoint: firstYardPos,
    onClick: () => {
      warmWindowMat.emissiveIntensity = 1.5
      lamps.forEach((l) => {
        l.bulbMat.emissiveIntensity = 1.8
      })
      ctx.discoverEncounter('lanterns')
      return { label: '白族院落次第亮灯，炊烟与暖光一起有了归处', sfx: 'lamp' as const }
    },
  })
  g.add(courtyardGroup)

  // 渔舟（鸬鹚渔船，湖面缓行）
  const boat = new THREE.Group()
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.1, 2.2), woodMat)
  hull.position.y = 0.2
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 3.4, 10, 1, true, 0, Math.PI),
    createMat('#5c5547', { roughness: 0.9, side: THREE.DoubleSide }),
  )
  canopy.position.set(-1.6, 1.1, 0)
  canopy.rotation.z = Math.PI / 2
  const bowLanternMat = createMat('#ff944d', { emissive: '#ff6f28', emissiveIntensity: 1.1 })
  const bowLantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bowLanternMat)
  bowLantern.position.set(3.4, 0.9, 0)
  const bowHalo = makeGlowSprite(ctx.textures.glowHalo, '#ff9c5c', 3.4, 0.55)
  bowHalo.position.set(3.4, 0.9, 0)
  boat.add(hull, canopy, bowLantern, bowHalo)
  boat.position.set(-16, -0.95, 66)
  g.add(boat)
  ctx.registerInteractive(boat, {
    encounterId: 'boat',
    focusPoint: new THREE.Vector3(-16, 1.4, 66),
    onClick: () => {
      bowLanternMat.emissiveIntensity = 1.8
      ctx.setWaterBio(0.35)
      ctx.discoverEncounter('boat')
      return { label: '洱海渔舟轻荡 · 船头渔火与星月倒影碎成细银涟漪', sfx: 'ripple' as const }
    },
  })
  ctx.setRideAnchor?.(() => {
    boat.updateMatrixWorld()
    return { pos: boat.localToWorld(new THREE.Vector3(0, 2.6, 0)) }
  })

  // 夜空：星空穹顶 + 星座
  const constellation = buildStarryConstellation(g, ctx.textures.glowHalo, ctx.textures.glowHalo)
  const skyHitPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 90),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  )
  skyHitPlane.position.set(0, 52, 205)
  g.add(skyHitPlane)
  ctx.registerInteractive(skyHitPlane, {
    encounterId: 'moon',
    focusPoint: new THREE.Vector3(10, 60, 165),
    onClick: () => {
      constellation.triggerBigDipper()
      moonRaised = true
      moonMat.emissiveIntensity = 1.6
      ctx.discoverEncounter('moon')
      return { label: '北斗星流连成银线，满月越过雪线', sfx: 'star' }
    },
  })

  let currentNightFactor = 0.86
  ctx.addTimeHook?.((_hour, nightFactor) => {
    currentNightFactor = nightFactor
  })
  ctx.addMoodHook((mood: DioramaMood) => {
    currentNightFactor = mood === 'night' ? 0.95 : mood === 'dawn' ? 0.28 : 0.78
    moonMat.emissiveIntensity = mood === 'night' ? 1.55 : mood === 'dawn' ? 0.7 : 1.15
    warmWindowMat.emissiveIntensity = mood === 'night' ? 0.85 : 0.55
  })

  ctx.addTick((t, dt) => {
    constellation.update(t, dt, currentNightFactor)
    boat.position.x = -16 + Math.sin(t * 0.13) * 9
    boat.position.z = 66 + Math.sin(t * 0.19 + 1.2) * 5
    boat.position.y = -0.95 + Math.sin(t * 1.28) * 0.1
    boat.rotation.z = Math.sin(t * 1.05) * 0.025
    if (moonRaised) {
      moon.position.y = 62 + Math.sin(t * 0.4) * 0.8
    }
  })

  // 漫步地形采样器：滨湖步道 + 环湖路 + 湖心长堤 + 村落小径
  ctx.setWalkHeightSampler?.((x, z) => {
    if (z >= 38 && z <= 45 && Math.abs(x) <= 100) return 0.35
    if (x >= 7.9 && x <= 12.1 && z >= 40 && z <= 98) return 0.4
    if (Math.abs(x - 10) <= 3.4 && z >= 92 && z <= 100) return 0.4
    if (z >= -4 && z <= 32 && Math.abs(x) <= 96) return 0.35
    return null
  })

  enableShadows(g, true, true)
  water.mesh.castShadow = false
}
