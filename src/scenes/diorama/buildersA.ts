import * as THREE from 'three'
import {
  buildForegroundDeck,
  buildSculptedPlinth,
  createMat,
  createMiniCar,
  createMiniFish,
  enableShadows,
} from './materials'
import type { DioramaBuilderCtx } from './types'

const FOREGROUND_TOP_Y = 0.13

function createForegroundBench(slatHex: string, frameHex: string) {
  const bench = new THREE.Group()
  bench.name = 'foreground-bench'
  const slatMat = createMat(slatHex, { roughness: 0.76 })
  const frameMat = createMat(frameHex, { roughness: 0.48, metalness: 0.42 })
  for (const bx of [-0.27, 0.27]) {
    for (const bz of [-0.09, 0.09]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.045), frameMat)
      leg.position.set(bx, 0.1, bz)
      bench.add(leg)
    }
    const backPost = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.045), frameMat)
    backPost.position.set(bx, 0.3, 0.13)
    bench.add(backPost)
  }
  for (const sz of [-0.075, 0, 0.075]) {
    const seatSlat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 0.064), slatMat)
    seatSlat.position.set(0, 0.22, sz)
    bench.add(seatSlat)
  }
  for (const by of [0.34, 0.43]) {
    const backSlat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.065, 0.045), slatMat)
    backSlat.position.set(0, by, 0.145)
    backSlat.rotation.x = -0.08
    bench.add(backSlat)
  }
  return bench
}

function createForegroundBollard(metalHex: string, ropeHex: string) {
  const bollard = new THREE.Group()
  bollard.name = 'foreground-mooring-bollard'
  const metalMat = createMat(metalHex, { roughness: 0.42, metalness: 0.58 })
  const ropeMat = createMat(ropeHex, { roughness: 0.96 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.07, 12), metalMat)
  base.position.y = 0.035
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.27, 10), metalMat)
  stem.position.y = 0.19
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.065, 12), metalMat)
  cap.position.y = 0.345
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.31, 8), metalMat)
  crossbar.rotation.z = Math.PI / 2
  crossbar.position.y = 0.32
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 20), ropeMat)
  rope.rotation.x = Math.PI / 2
  rope.position.set(0.16, 0.055, 0.05)
  bollard.add(base, stem, cap, crossbar, rope)
  return bollard
}

export { buildRapanui } from './cities/rapanui'

/**
 * 3. 悉尼海港 · 南半球盛夏
 * 建筑：真实对称球壳切片风帆歌剧院 + 海港钢拱大桥（抛物线拱+吊杆+砂岩桥塔）+ 帆船与航标
 * 唤醒：3/3 后海豚跃出蔚蓝海湾
 */
export function buildSydney(ctx: DioramaBuilderCtx) {
  const { water } = buildSculptedPlinth(ctx, {
    topColor: '#efe1cc',
    sideColor: '#487694',
    stoneColor: '#254a66',
    waterShallow: '#39b2cc',
    waterDeep: '#185b82',
    waterSplitZ: -0.1,
    horizonStyle: 'skyline',
    horizonAccent: '#8ee0ec',
    horizonVariant: 'sydney',
  })
  buildForegroundDeck(ctx, {
    kind: 'wood',
    x: 0,
    width: 5.4,
    shoreZ: -0.1,
    frontZ: 4.35,
    color: '#b79a73',
    edgeColor: '#5f584b',
    rail: 'metal',
  })

  const g = new THREE.Group()
  ctx.group.add(g)

  // 花岗岩滨海台基与宏伟台阶
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(4.45, 0.36, 2.75),
    createMat('#e7d8c5', { roughness: 0.7, bumpMap: ctx.textures.plasterBump }),
  )
  podium.position.set(-0.7, 0.24, -1.65)
  g.add(podium)

  for (let st = 0; st < 3; st += 1) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 - st * 0.25, 0.1, 0.32),
      createMat('#efe3d2'),
    )
    step.position.set(-0.7, 0.12 + st * 0.08, -0.14 - st * 0.14)
    g.add(step)
  }

  // 悉尼歌剧院：弯曲球壳穹片 + 暖光玻璃幕墙
  const operaGroup = new THREE.Group()
  operaGroup.position.set(-0.72, 0.42, -1.72)

  const shellMat = createMat('#fff9f0', {
    emissive: '#ffd29e',
    emissiveIntensity: 0.18,
    roughness: 0.38,
    side: THREE.DoubleSide,
  })
  const glassMat = createMat('#ffcf86', {
    emissive: '#ff9644',
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.85,
  })

  const makeOperaShell = (x: number, z: number, scale: number, yaw: number, tilt: number) => {
    const sg = new THREE.Group()
    sg.position.set(x, 0, z)
    sg.rotation.set(tilt, yaw, 0)
    const geo = new THREE.SphereGeometry(scale, 18, 14, 0, Math.PI * 0.65, 0, Math.PI * 0.62)
    const mesh = new THREE.Mesh(geo, shellMat)
    mesh.scale.set(0.75, 1.38, 0.92)
    sg.add(mesh)

    const gWall = new THREE.Mesh(
      new THREE.CircleGeometry(scale * 0.72, 16, 0, Math.PI),
      glassMat,
    )
    gWall.position.set(scale * 0.12, 0.08, scale * 0.36)
    sg.add(gWall)
    return sg
  }

  const shells = [
    makeOperaShell(-1.25, 0.1, 1.15, -0.35, -0.16),
    makeOperaShell(-0.52, -0.12, 1.36, -0.2, -0.14),
    makeOperaShell(0.28, -0.05, 1.08, 0.15, -0.12),
    makeOperaShell(1.05, -0.18, 1.24, 0.35, -0.15),
    makeOperaShell(-0.18, 0.42, 0.88, -0.1, -0.18),
  ]
  shells.forEach((s) => operaGroup.add(s))

  const vividColors: [string, string][] = [
    ['#fff9f0', '#ffd29e'],
    ['#ffe0ea', '#ff6e9c'],
    ['#d8f6ff', '#4ac4ff'],
    ['#fff0c2', '#ffae44'],
  ]
  let vividIdx = 0
  shells.forEach((s) => {
    ctx.registerInteractive(s, {
      encounterId: 'opera',
      focusPoint: new THREE.Vector3(-0.7, 1.25, -1.7),
      onClick: () => {
        vividIdx = (vividIdx + 1) % vividColors.length
        const [col, em] = vividColors[vividIdx]
        shellMat.color.set(col)
        shellMat.emissive.set(em)
        shellMat.emissiveIntensity = vividIdx === 0 ? 0.2 : 0.68
        ctx.discoverEncounter('opera')
        return { label: '切换歌剧院贝壳盛夏幻彩光影', sfx: 'star' }
      },
    })
  })
  g.add(operaGroup)

  // 悉尼海港钢拱大桥（跨越右后方海湾）
  const bridgeGroup = new THREE.Group()
  bridgeGroup.position.set(1.65, 0.05, -0.55)
  bridgeGroup.rotation.y = -0.62

  const sandstone = createMat('#c9b59d', { roughness: 0.78 })
  for (const px of [-1.75, 1.75]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.95, 0.46), sandstone)
    pylon.position.set(px, 0.96, 0)
    bridgeGroup.add(pylon)
  }

  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.1, 0.38), createMat('#4b5d72', { metalness: 0.5 }))
  bridgeDeck.position.y = 0.72
  bridgeGroup.add(bridgeDeck)

  const steelMat = createMat('#5c7086', { metalness: 0.55, roughness: 0.42 })
  const upperArch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.75, 0.75, 0),
    new THREE.Vector3(-0.9, 1.75, 0),
    new THREE.Vector3(0, 2.08, 0),
    new THREE.Vector3(0.9, 1.75, 0),
    new THREE.Vector3(1.75, 0.75, 0),
  ])
  const lowerArch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.6, 0.65, 0),
    new THREE.Vector3(-0.85, 1.48, 0),
    new THREE.Vector3(0, 1.78, 0),
    new THREE.Vector3(0.85, 1.48, 0),
    new THREE.Vector3(1.6, 0.65, 0),
  ])
  const archMesh = new THREE.Mesh(new THREE.TubeGeometry(upperArch, 28, 0.055, 8, false), steelMat)
  const archInner = new THREE.Mesh(new THREE.TubeGeometry(lowerArch, 24, 0.04, 8, false), steelMat)
  bridgeGroup.add(archMesh, archInner)

  const hangerMat = createMat('#8ea4bc', { metalness: 0.5 })
  for (let hx = -1.2; hx <= 1.2; hx += 0.4) {
    const normX = hx / 1.75
    const topY = 0.75 + (1 - normX * normX) * 1.25
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Math.max(0.15, topY - 0.72), 6), hangerMat)
    hanger.position.set(hx, 0.72 + (topY - 0.72) * 0.5, 0)
    bridgeGroup.add(hanger)
  }

  const bridgeBulbMat = createMat('#ffe4a6', { emissive: '#ffb84d', emissiveIntensity: 0.15 })
  const bridgeBulbs: THREE.Mesh[] = []
  for (let i = 0; i <= 8; i += 1) {
    const pt = upperArch.getPoint(i / 8)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), bridgeBulbMat)
    bulb.position.copy(pt)
    bridgeGroup.add(bulb)
    bridgeBulbs.push(bulb)
  }

  // 悉尼海港大桥双向行驶车辆（点击弹出城市车流短笺 + 鸣笛声）
  const bridgeCars: { mesh: THREE.Group; laneZ: number; dir: number; offset: number; speed: number }[] = []
  for (const [idx, col, laneZ, dir, spd] of [
    [0, '#f4a862', -0.09, 1, 0.32],
    [1, '#78c6e8', 0.09, -1, 0.28],
    [2, '#f0786c', -0.09, 1, 0.36],
  ] as const) {
    const car = createMiniCar(col)
    car.position.set(0, 0.77, laneZ)
    if (dir < 0) car.rotation.y = Math.PI
    bridgeGroup.add(car)
    bridgeCars.push({ mesh: car, laneZ, dir, offset: idx * 1.15, speed: spd })
    ctx.registerInteractive(car, {
      focusPoint: new THREE.Vector3(1.65, 1.0, -0.55),
      onClick: () => ({
        label: '悉尼海港大桥：桥面上熙熙攘攘的车流正穿过南半球 28°C 的海风。',
        sfx: 'horn',
      }),
    })
  }
  ctx.addTick((t) => {
    bridgeCars.forEach((c) => {
      const span = 3.5
      const raw = ((t * c.speed + c.offset) % 1)
      const x = c.dir > 0 ? -span * 0.5 + raw * span : span * 0.5 - raw * span
      c.mesh.position.set(x, 0.77, c.laneZ)
    })
  })

  let bridgeLit = false
  ctx.registerInteractive(archMesh, {
    encounterId: 'bridge',
    focusPoint: new THREE.Vector3(1.65, 1.8, -0.55),
    onClick: () => {
      bridgeLit = !bridgeLit
      bridgeBulbMat.emissiveIntensity = bridgeLit ? 1.8 : 0.15
      ctx.discoverEncounter('bridge')
      return { label: bridgeLit ? '点亮悉尼海港钢拱大桥灯串' : '调暗大桥霓虹灯串', sfx: 'lamp' }
    },
  })
  g.add(bridgeGroup)

  // 盛夏游艇停在木平台前沿之外，保留加速、转向与涟漪互动
  const boat = new THREE.Group()
  boat.position.set(-0.6, 0.02, 4.8)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.2, 0.42), createMat('#ffffff'))
  const prow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4), createMat('#ffffff'))
  prow.rotation.z = -Math.PI / 2
  prow.rotation.x = Math.PI / 4
  prow.position.set(0.75, 0.02, 0)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.45, 6), createMat('#c99a5b'))
  mast.position.y = 0.75
  const mainSail = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 1.18, 3),
    createMat('#ff9070', { emissive: '#ff7048', emissiveIntensity: 0.2 }),
  )
  mainSail.position.set(-0.12, 0.82, 0)
  mainSail.rotation.y = Math.PI / 2
  boat.add(hull, prow, mast, mainSail)
  g.add(boat)

  // 两枚彩色航标浮筒
  let sailSpeed = 0
  let sailPhase = 1.85
  for (const [bx, bz, col] of [[-2.1, 4.65, '#ff785a'], [2.05, 5.15, '#ffd468']] as const) {
    const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.34, 8), createMat(col, { emissive: col, emissiveIntensity: 0.35 }))
    buoy.position.set(bx, 0.08, bz)
    g.add(buoy)
    ctx.registerInteractive(buoy, {
      encounterId: 'buoys',
      focusPoint: new THREE.Vector3(bx, 0.3, bz),
      onClick: () => {
        sailSpeed = Math.min(1.1, sailSpeed + 0.85)
        ctx.triggerRipple(bx, bz)
        ctx.discoverEncounter('buoys')
        return { label: '盛夏海风鼓满风帆穿行海港', sfx: 'ripple' }
      },
    })
  }

  ctx.registerInteractive(hull, {
    encounterId: 'buoys',
    focusPoint: new THREE.Vector3(0, 0.5, 4.8),
    onClick: (pt) => {
      sailSpeed = Math.min(1.2, sailSpeed + 0.95)
      const ripplePoint = pt ? ctx.group.worldToLocal(pt.clone()) : null
      ctx.triggerRipple(ripplePoint?.x ?? boat.position.x, ripplePoint?.z ?? 4.8)
      ctx.discoverEncounter('buoys')
      return { label: '白帆乘风加速滑过蔚蓝港湾', sfx: 'ripple' }
    },
  })

  if (water) {
    ctx.registerInteractive(water.mesh, {
      encounterId: 'buoys',
      onClick: (pt) => {
        sailSpeed = Math.min(0.9, sailSpeed + 0.65)
        const ripplePoint = pt ? ctx.group.worldToLocal(pt.clone()) : null
        ctx.triggerRipple(ripplePoint?.x ?? 0, ripplePoint?.z ?? 1.6)
        ctx.discoverEncounter('buoys')
        return { label: '海湾荡起清凉夏日波浪', sfx: 'ripple' }
      },
    })
  }

  // 终局奇境：跃出海面的成双海豚
  const dolphinGroup = new THREE.Group()
  dolphinGroup.visible = false
  const dMat = createMat('#8cc8e6', { emissive: '#387ea8', emissiveIntensity: 0.35, roughness: 0.22 })
  const makeDolphin = () => {
    const dg = new THREE.Group()
    const pts = [
      new THREE.Vector2(0.01, -0.35),
      new THREE.Vector2(0.08, -0.18),
      new THREE.Vector2(0.11, 0),
      new THREE.Vector2(0.07, 0.22),
      new THREE.Vector2(0.01, 0.38),
    ]
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), dMat)
    body.rotation.z = Math.PI / 2
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), dMat)
    fin.position.set(-0.02, 0.12, 0)
    fin.rotation.z = 0.35
    dg.add(body, fin)
    return dg
  }
  const dolphins = [makeDolphin(), makeDolphin()]
  dolphins.forEach((d) => dolphinGroup.add(d))
  g.add(dolphinGroup)

  let dolphinTimer = -1
  ctx.setFinaleTrigger(() => {
    dolphinTimer = 0
    dolphinGroup.visible = true
  })

  ctx.addTick((t, dt) => {
    sailSpeed = Math.max(0, sailSpeed - dt * 0.65)
    sailPhase += dt * (0.36 + sailSpeed * 0.28)
    boat.position.x = Math.cos(sailPhase) * 2.15
    boat.rotation.y = Math.sin(sailPhase) >= 0 ? Math.PI : 0
    boat.rotation.z = Math.sin(t * 2.2) * 0.065

    if (dolphinTimer >= 0) {
      dolphinTimer += dt
      const dur = 4.0
      if (dolphinTimer >= dur) {
        dolphinTimer = -1
        dolphinGroup.visible = false
      } else {
        dolphins.forEach((d, idx) => {
          const localT = Math.max(0, Math.min(1, (dolphinTimer - idx * 0.45) / 1.85))
          const arc = Math.sin(localT * Math.PI)
          d.visible = localT > 0 && localT < 1
          d.position.set(-1.35 + localT * 2.7, -0.25 + arc * 1.15, 4.55 + idx * 0.65)
          d.rotation.z = (0.5 - localT) * 1.4
        })
      }
    }
  })

  // 滨海游人改为实景长椅与系缆桩，原城市短笺和点击声继续可用
  const harbourProps = [
    createForegroundBench('#9c7b56', '#596570'),
    createForegroundBollard('#596570', '#d8c8a5'),
  ]
  harbourProps.forEach((prop, idx) => {
    const px = idx === 0 ? -1.45 : 1.35
    const pz = idx === 0 ? 1.25 : 1.0
    prop.position.set(px, FOREGROUND_TOP_Y, pz)
    g.add(prop)
    ctx.registerInteractive(prop, {
      focusPoint: new THREE.Vector3(px, 0.42, pz),
      onClick: () => ({
        label: idx === 0
          ? '港湾长椅：太阳伞和海盐味的风一起泡在悉尼盛夏里。'
          : '海港系缆桩：听完午后音乐会的人，把帆船轻轻系在栈桥边。',
        sfx: 'ripple',
      }),
    })
  })

  // 前景实景细节：侧栏救生圈与黄铜帆船系缆扣
  const lifeRing = new THREE.Group()
  lifeRing.name = 'foreground-life-ring'
  lifeRing.position.set(2.52, 0.47, 2.15)
  lifeRing.rotation.y = Math.PI / 2
  const lifeRingOrange = createMat('#e56f4f', { roughness: 0.62 })
  const lifeRingWhite = createMat('#f1ead8', { roughness: 0.68 })
  const lifeRingRope = createMat('#c8b48e', { roughness: 0.96 })
  const ringCore = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 24), lifeRingOrange)
  lifeRing.add(ringCore)
  for (let i = 0; i < 4; i += 1) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.041, 8, 10, Math.PI / 2), lifeRingWhite)
    band.rotation.z = i * Math.PI / 2
    band.position.z = 0.006
    lifeRing.add(band)
  }
  const ringLanyard = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 6, 28), lifeRingRope)
  lifeRing.add(ringLanyard)
  g.add(lifeRing)

  const deckCleat = new THREE.Group()
  deckCleat.position.set(-2.22, FOREGROUND_TOP_Y, 2.62)
  const cleatMat = createMat('#9b855d', { roughness: 0.34, metalness: 0.72 })
  const cleatBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.16), cleatMat)
  cleatBase.position.y = 0.018
  deckCleat.add(cleatBase)
  for (const cx of [-0.11, 0.11]) {
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.12, 8), cleatMat)
    horn.rotation.z = Math.PI / 2
    horn.position.set(cx, 0.075, 0)
    deckCleat.add(horn)
  }
  const cleatBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 8), cleatMat)
  cleatBar.rotation.z = Math.PI / 2
  cleatBar.position.y = 0.08
  deckCleat.add(cleatBar)
  g.add(deckCleat)

  const bayFish = [createMiniFish('#7de8ff'), createMiniFish('#ffd87a')]
  bayFish.forEach((f, idx) => {
    f.visible = false
    g.add(f)
    ctx.addTick((t) => {
      const cy = (t * 0.48 + idx * 1.1) % 2.8
      const show = cy < 0.85
      f.visible = show
      if (show) {
        const u = cy / 0.85
        f.position.set(-1.9 + idx * 2.8 + u * 0.65, -0.12 + Math.sin(u * Math.PI) * 0.56, 4.6 + idx * 0.7)
        f.rotation.z = (0.5 - u) * 1.5
      }
    })
  })

  enableShadows(g, true, true)
}
