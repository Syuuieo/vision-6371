import * as THREE from 'three'
import {
  buildSculptedPlinth,
  createMat,
  createMiniFish,
  createMiniPerson,
  enableShadows,
  makeGlowSprite,
} from './materials'
import type { DioramaBuilderCtx } from './types'

/**
 * 4. 夏威夷 · 珊瑚日落湾
 * 建筑：层叠火山瀑布岬角 + 4 株弯曲羽叶椰树 + 涉水茅草屋与栈桥火把 + 弦外独木舟 + 可沉落夕阳
 * 唤醒：3/3 后点亮珊瑚夜光荧光海湾（uBio）并放飞热带暖天灯
 */
export function buildHawaii(ctx: DioramaBuilderCtx) {
  const { water } = buildSculptedPlinth(ctx, {
    topColor: '#e8c494',
    sideColor: '#7e5353',
    stoneColor: '#48333d',
    waterShallow: '#2bb0bb',
    waterDeep: '#125e74',
    waterSplitZ: -0.05,
  })

  const g = new THREE.Group()
  ctx.group.add(g)

  // 层叠珊瑚沙滩与火山崖壁
  const cliffGroup = new THREE.Group()
  cliffGroup.position.set(-1.75, 0.12, -1.68)
  const rock1 = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 2.35, 1.32, 7),
    createMat('#b8705e', { roughness: 0.9, flatShading: true }),
  )
  rock1.position.y = 0.62
  const rock2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 1.5, 1.15, 7),
    createMat('#568b60', { roughness: 0.85, flatShading: true }),
  )
  rock2.position.set(-0.22, 1.68, -0.15)
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 0.95, 6),
    createMat('#649c69', { roughness: 0.85, flatShading: true }),
  )
  peak.position.set(-0.26, 2.68, -0.18)
  cliffGroup.add(rock1, rock2, peak)

  // 热带瀑布水帘
  const fallMat = createMat('#92ecff', {
    emissive: '#42b8d8',
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.78,
  })
  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.65, 0.12), fallMat)
  fall.position.set(0.48, 0.85, 1.15)
  fall.rotation.x = 0.28
  cliffGroup.add(fall)
  g.add(cliffGroup)

  // 涉水木栈桥与茅草度假小屋
  const hut = new THREE.Group()
  hut.position.set(1.35, 0.24, -1.05)
  for (const [px, pz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]] as const) {
    const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.75, 8), createMat('#66422f'))
    piling.position.set(px, 0.25, pz)
    hut.add(piling)
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 1.56), createMat('#8c5d41'))
  deck.position.y = 0.56
  hut.add(deck)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.82, 1.04),
    createMat('#f4dfbf', { emissive: '#ff9c48', emissiveIntensity: 0.22 }),
  )
  cabin.position.y = 1.02
  hut.add(cabin)
  const thatch = new THREE.Mesh(
    new THREE.ConeGeometry(1.22, 0.82, 6),
    createMat('#9b6d44', { roughness: 0.92 }),
  )
  thatch.position.y = 1.82
  hut.add(thatch)
  g.add(hut)

  // 木质延展栈桥 + 3 盏可点燃热带火把盆
  const pier = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.11, 2.75), createMat('#8a5a40'))
  pier.position.set(0.7, 0.22, 1.25)
  g.add(pier)

  const torchLit = new Set<number>([0])
  const torchFlames: { mesh: THREE.Mesh; halo: THREE.Sprite; idx: number }[] = []
  for (let i = 0; i < 3; i += 1) {
    const tz = 0.35 + i * 0.88
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.78, 8), createMat('#573826'))
    post.position.set(1.08, 0.56, tz)
    g.add(post)

    const isLit = torchLit.has(i)
    const flameMat = createMat('#ffd078', {
      emissive: '#ff7d2c',
      emissiveIntensity: isLit ? 1.4 : 0.08,
    })
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), flameMat)
    flame.position.set(1.08, 1.02, tz)
    g.add(flame)

    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ff9848', 0.95, isLit ? 0.65 : 0.04)
    halo.position.set(1.08, 1.02, tz)
    g.add(halo)
    torchFlames.push({ mesh: flame, halo, idx: i })

    ctx.registerInteractive(flame, {
      goalId: 'torches',
      focusPoint: new THREE.Vector3(1.08, 1.02, tz),
      onClick: () => {
        if (torchLit.has(i)) torchLit.delete(i)
        else torchLit.add(i)
        const nowLit = torchLit.has(i)
        flameMat.emissiveIntensity = nowLit ? 1.55 : 0.08
        halo.material.opacity = nowLit ? 0.72 : 0.04
        if (torchLit.size >= 3) ctx.completeGoal('torches')
        return {
          label: nowLit ? `点燃热带火把 (${torchLit.size}/3)` : `轻熄一盏海湾火把 (${torchLit.size}/3)`,
          sfx: 'lamp',
        }
      },
    })
  }

  // 4 株特征鲜明的弯曲羽叶椰子树（8 片双段下垂羽叶 + 突出椰果簇 + 点击掉落椰子交互）
  const palmHooks: ((t: number, dt: number) => void)[] = []
  for (const [px, pz, leanX, leanZ] of [
    [-2.45, -0.25, 0.45, 0.25],
    [2.52, -0.45, -0.42, 0.24],
    [2.28, -2.2, -0.32, -0.15],
    [-0.45, -2.3, 0.18, 0.16],
  ] as const) {
    const palm = new THREE.Group()
    palm.position.set(px, 0.12, pz)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(leanX * 0.55, 1.08, leanZ * 0.5),
      new THREE.Vector3(leanX * 1.18, 2.25, leanZ),
    ])
    palm.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(trunkCurve, 14, 0.1, 8, false),
        createMat('#8c6147', { roughness: 0.88 }),
      ),
    )

    const crown = new THREE.Group()
    crown.position.set(leanX * 1.18, 2.25, leanZ)
    const frondMat = createMat('#46a462', { roughness: 0.68, side: THREE.DoubleSide })
    for (let f = 0; f < 8; f += 1) {
      const ang = (f / 8) * Math.PI * 2 + (px * 0.2)
      const fGrp = new THREE.Group()
      fGrp.rotation.y = ang
      const innerBlade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.68), frondMat)
      innerBlade.position.set(0, 0.05, 0.34)
      innerBlade.rotation.x = -0.22
      const tipBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.62), frondMat)
      tipBlade.position.set(0, -0.16, 0.88)
      tipBlade.rotation.x = 0.55
      fGrp.add(innerBlade, tipBlade)
      crown.add(fGrp)
    }
    const nutMat = createMat('#663e22', { roughness: 0.72 })
    for (let c = 0; c < 3; c += 1) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), nutMat)
      nut.position.set(Math.cos(c * 2.1) * 0.13, -0.09, Math.sin(c * 2.1) * 0.13)
      crown.add(nut)
    }
    palm.add(crown)
    g.add(palm)

    // 可掉落的物理椰子
    const fallingNut = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), nutMat)
    fallingNut.visible = false
    g.add(fallingNut)
    let dropAge = -1
    let shakeBoost = 0

    ctx.registerInteractive(crown, {
      focusPoint: new THREE.Vector3(px + leanX, 2.25, pz + leanZ),
      onClick: () => {
        dropAge = 0
        shakeBoost = 1.6
        fallingNut.visible = true
        return {
          label: '夏威夷椰林：啪嗒落下一颗清甜椰子，满满热带海岛风情！',
          sfx: 'ripple',
        }
      },
    })

    palmHooks.push((t, dt) => {
      shakeBoost = Math.max(0, shakeBoost - dt * 1.2)
      crown.rotation.z = Math.sin(t * 1.45 + px) * (0.075 + shakeBoost * 0.14)
      crown.rotation.x = Math.cos(t * 1.2 + pz) * (0.055 + shakeBoost * 0.1)
      if (dropAge >= 0) {
        dropAge += dt
        if (dropAge > 2.2) {
          dropAge = -1
          fallingNut.visible = false
        } else {
          const fallT = Math.min(1, dropAge / 0.55)
          const bounce = dropAge > 0.55 ? Math.abs(Math.sin((dropAge - 0.55) * 9)) * Math.exp(-(dropAge - 0.55) * 3) * 0.25 : 0
          fallingNut.position.set(
            px + leanX * 1.18 + Math.min(0.45, dropAge * 0.25),
            Math.max(0.2, 2.25 - fallT * fallT * 2.05 + bounce),
            pz + leanZ + Math.min(0.3, dropAge * 0.18),
          )
        }
      }
    })
  }

  // 可交互沉降热带夕阳
  const sunMat = createMat('#ffdb96', { emissive: '#ff8a48', emissiveIntensity: 1.15 })
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.76, 22, 16), sunMat)
  sun.position.set(1.65, 2.65, -2.55)
  const sunHalo = makeGlowSprite(ctx.textures.glowHalo, '#ff9852', 3.4, 0.62)
  sun.add(sunHalo)
  g.add(sun)

  let sunLowered = false
  ctx.registerInteractive(sun, {
    goalId: 'sunset',
    focusPoint: new THREE.Vector3(1.65, 2.3, -2.55),
    onClick: () => {
      sunLowered = !sunLowered
      sunMat.emissiveIntensity = sunLowered ? 1.65 : 1.15
      sunHalo.material.opacity = sunLowered ? 0.85 : 0.62
      if (sunLowered) ctx.completeGoal('sunset')
      return {
        label: sunLowered ? '沉降太平洋夕阳浸暖海面' : '抬升金色热带落日',
        sfx: 'lamp',
      }
    },
  })

  // 弦外木制独木舟
  const canoe = new THREE.Group()
  canoe.position.set(-1.35, 0.02, 1.85)
  const canoeHull = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.16, 0.28), createMat('#7e4b34'))
  const outrigger = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), createMat('#b5865a'))
  outrigger.rotation.z = Math.PI / 2
  outrigger.position.set(0, -0.01, 0.34)
  const spar1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.36), createMat('#b5865a'))
  spar1.position.set(-0.24, 0.05, 0.18)
  const spar2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.36), createMat('#b5865a'))
  spar2.position.set(0.24, 0.05, 0.18)
  canoe.add(canoeHull, outrigger, spar1, spar2)
  g.add(canoe)

  let canoePush = 0
  ctx.registerInteractive(canoeHull, {
    goalId: 'canoe',
    focusPoint: new THREE.Vector3(-1.35, 0.25, 1.85),
    onClick: (pt) => {
      canoePush = 1.8
      ctx.triggerRipple(pt?.x ?? canoe.position.x, pt?.z ?? 1.85)
      ctx.setWaterBio(Math.max(0.55, ctx.isGoalDone('canoe') ? 1 : 0.65))
      ctx.completeGoal('canoe')
      return { label: '推动弦外独木舟唤起荧光波纹', sfx: 'ripple' }
    },
  })

  if (water) {
    ctx.registerInteractive(water.mesh, {
      onClick: (pt) => {
        ctx.triggerRipple(pt?.x ?? 0, pt?.z ?? 1.6)
        return { label: '轻拍温暖珊瑚海湾水光', sfx: 'ripple' }
      },
    })
  }

  // 终局奇境：珊瑚夜光生物荧光海 + 飘升热带天灯
  const lanterns: { mesh: THREE.Mesh; offset: number; x: number; z: number }[] = []
  const lanternGrp = new THREE.Group()
  lanternGrp.visible = false
  const lMat = createMat('#ffcf84', { emissive: '#ff8a3c', emissiveIntensity: 1.5 })
  for (let i = 0; i < 12; i += 1) {
    const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.18, 8), lMat)
    const lx = -2.2 + (i % 6) * 0.9
    const lz = -0.8 + Math.floor(i / 6) * 2.2
    lanternGrp.add(lm)
    lanterns.push({ mesh: lm, offset: i * 0.45, x: lx, z: lz })
  }
  g.add(lanternGrp)

  let lanternTimer = -1
  ctx.setFinaleTrigger(() => {
    ctx.setWaterBio(1)
    lanternTimer = 0
    lanternGrp.visible = true
  })

  ctx.addTick((t, dt) => {
    canoePush = Math.max(0, canoePush - dt * 0.6)
    canoe.position.x = -1.25 + Math.sin(t * (0.45 + canoePush * 0.5)) * 1.45
    canoe.position.y = 0.02 + Math.sin(t * 2.2) * 0.025

    const targetSunY = sunLowered ? 1.85 : 2.65
    sun.position.y += (targetSunY - sun.position.y) * Math.min(1, dt * 4)

    for (const h of palmHooks) h(t, dt)
    torchFlames.forEach((f) => {
      if (torchLit.has(f.idx)) {
        const s = 0.92 + Math.sin(t * 8 + f.idx * 2) * 0.15
        f.mesh.scale.set(s, s * 1.2, s)
      }
    })

    if (lanternTimer >= 0) {
      lanternTimer += dt
      const dur = 6.0
      if (lanternTimer >= dur) {
        lanternTimer = -1
        lanternGrp.visible = false
      } else {
        lanterns.forEach((l) => {
          const prog = Math.min(1, lanternTimer / dur)
          l.mesh.position.set(
            l.x + Math.sin(t * 1.2 + l.offset) * 0.28,
            0.6 + prog * 4.5 + (l.offset % 1) * 0.5,
            l.z + Math.cos(t * 1.1 + l.offset) * 0.24,
          )
        })
      }
    }
  })

  // 夏威夷海湾度假旅人 & 珊瑚跃鱼群
  const hawaiiGuests: [number, number, number, string, string, string][] = [
    [0.52, 0.28, 1.55, '#ff8f70', '#fff4d4', '度假旅人：踩在木栈桥上吹海风，远处瀑布的水雾扑在脸上。'],
    [-0.58, 0.15, -0.65, '#46b8c4', '#ffd894', '沙滩游人：这里既有鸡蛋花香，又有喝不完的现剖冰椰汁。'],
    [1.45, 0.8, -0.35, '#e8b65a', '#ffffff', '木屋住客：落日把海面染成橘粉色时，栈桥上的火把会一支支亮起。'],
  ]
  hawaiiGuests.forEach(([gx, gy, gz, c1, c2, note]) => {
    const p = createMiniPerson(c1, c2)
    p.position.set(gx, gy, gz)
    g.add(p)
    ctx.registerInteractive(p, {
      focusPoint: new THREE.Vector3(gx, gy + 0.35, gz),
      onClick: () => ({ label: note, sfx: 'lamp' }),
    })
  })

  const reefFish = [createMiniFish('#ff9a62'), createMiniFish('#6ee2ef'), createMiniFish('#ffd568')]
  reefFish.forEach((f, idx) => {
    f.visible = false
    g.add(f)
    ctx.registerInteractive(f, {
      onClick: () => ({ label: '热带珊瑚鱼跃出蓝绿海湾！', sfx: 'ripple' }),
    })
    ctx.addTick((t) => {
      const cy = (t * 0.56 + idx * 0.72) % 2.4
      const show = cy < 0.78
      f.visible = show
      if (show) {
        const u = cy / 0.78
        f.position.set(-2.2 + idx * 1.85 + u * 0.65, -0.06 + Math.sin(u * Math.PI) * 0.58, 1.45 + (idx % 2) * 0.75)
        f.rotation.z = (0.5 - u) * 1.4
      }
    })
  })

  enableShadows(g, true, true)
}

/**
 * 5. 哈尔滨 · 初雪教堂广场
 * 建筑：红砖纹理圣索菲亚教堂、LatheGeometry 车床轮廓大/小绿洋葱穹顶、彩绘玫瑰花窗、锻铁双臂路灯、冰灯柱
 * 唤醒：3/3 后放飞盘旋雪鸽并升起柔绿北国极光带
 */
export function buildHarbin(ctx: DioramaBuilderCtx) {
  buildSculptedPlinth(ctx, {
    topColor: '#e8eff8',
    sideColor: '#667c9b',
    stoneColor: '#2d3f5a',
  })

  const g = new THREE.Group()
  ctx.group.add(g)

  // 圆石雪夜广场 + 厚雪堆边沿
  const snowPlaza = new THREE.Mesh(
    new THREE.BoxGeometry(6.85, 0.14, 6.85),
    createMat('#edf4fb', { roughness: 0.85, bumpMap: ctx.textures.plasterBump }),
  )
  snowPlaza.position.y = 0.09
  g.add(snowPlaza)

  const brickMat = createMat('#be7569', {
    map: ctx.textures.brickTex,
    bumpMap: ctx.textures.brickBump,
    bumpScale: 0.045,
    roughness: 0.78,
  })
  const trimMat = createMat('#efe6db', { roughness: 0.65 })
  const snowMat = createMat('#f7fbff', { roughness: 0.8 })

  const catGroup = new THREE.Group()
  catGroup.position.set(0, 0.16, -0.68)

  // 十字形红砖主堂 + 白色壁柱装饰
  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(2.85, 2.05, 2.65), brickMat)
  mainHall.position.y = 1.02
  catGroup.add(mainHall)

  const hallRoofSnow = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.14, 2.76), snowMat)
  hallRoofSnow.position.y = 2.08
  catGroup.add(hallRoofSnow)

  for (const bx of [-1.25, -0.62, 0.62, 1.25]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.98, 2.72), trimMat)
    pilaster.position.set(bx, 1.0, 0)
    catGroup.add(pilaster)
  }

  // 车床旋转轮廓正宗俄罗斯洋葱穹顶
  const makeOnionDome = (rad: number, height: number, domeHex: string) => {
    const pts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(rad * 0.75, height * 0.05),
      new THREE.Vector2(rad * 1.04, height * 0.34),
      new THREE.Vector2(rad * 0.86, height * 0.62),
      new THREE.Vector2(rad * 0.38, height * 0.84),
      new THREE.Vector2(rad * 0.12, height * 0.96),
      new THREE.Vector2(0.005, height * 1.08),
    ]
    return new THREE.Mesh(
      new THREE.LatheGeometry(pts, 18),
      createMat(domeHex, { emissive: '#1e4a3d', emissiveIntensity: 0.25, roughness: 0.36, metalness: 0.18 }),
    )
  }

  // 中央主鼓座与大洋葱顶
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.82, 1.25, 16), brickMat)
  drum.position.y = 2.68
  catGroup.add(drum)
  const drumTrim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 8, 24), trimMat)
  drumTrim.rotation.x = Math.PI / 2
  drumTrim.position.y = 3.24
  catGroup.add(drumTrim)

  const mainOnion = makeOnionDome(0.86, 1.48, '#46927c')
  mainOnion.position.y = 3.25
  catGroup.add(mainOnion)

  const goldMat = createMat('#f2c87d', { emissive: '#db923b', emissiveIntensity: 0.55, metalness: 0.68, roughness: 0.28 })
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), goldMat)
  crossV.position.y = 5.05
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), goldMat)
  crossH.position.y = 5.14
  catGroup.add(crossV, crossH)

  // 四隅小洋葱顶
  for (const [cx, cz] of [[-1.12, -1.0], [1.12, -1.0], [-1.12, 1.0], [1.12, 1.0]] as const) {
    const subDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.58, 12), trimMat)
    subDrum.position.set(cx, 2.38, cz)
    const subDome = makeOnionDome(0.38, 0.7, '#4e9b84')
    subDome.position.set(cx, 2.65, cz)
    catGroup.add(subDrum, subDome)
  }

  // 正立面彩色玫瑰花窗
  const roseMat = createMat('#ffcf84', { emissive: '#ff8e58', emissiveIntensity: 0.55 })
  const roseWin = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 16), roseMat)
  roseWin.rotation.x = Math.PI / 2
  roseWin.position.set(0, 1.38, 1.32)
  catGroup.add(roseWin)
  const roseRim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 20), trimMat)
  roseRim.position.set(0, 1.38, 1.38)
  catGroup.add(roseRim)

  const roseHalo = makeGlowSprite(ctx.textures.glowHalo, '#ffa268', 1.5, 0.45)
  roseHalo.position.set(0, 1.38, 1.5)
  catGroup.add(roseHalo)

  ctx.registerInteractive(roseWin, {
    goalId: 'rose',
    focusPoint: new THREE.Vector3(0, 1.5, 0.7),
    onClick: () => {
      roseMat.emissiveIntensity = 1.65
      roseHalo.material.opacity = 0.85
      ctx.completeGoal('rose')
      return { label: '唤亮正立面彩绘玫瑰花窗', sfx: 'lamp' }
    },
  })

  let snowSwirl = 0
  ctx.registerInteractive(mainOnion, {
    goalId: 'bell',
    focusPoint: new THREE.Vector3(0, 3.8, -0.68),
    onClick: () => {
      snowSwirl = 2.0
      ctx.completeGoal('bell')
      return { label: '圣索菲亚大穹顶钟声随雪飘响', sfx: 'snow' }
    },
  })
  g.add(catGroup)

  // 锻铁暖光雪夜路灯 + 两尊晶莹冰雕灯柱（点击任意达 lamps）
  const litLamps = new Set<number>()
  for (const [idx, lx, lz] of [[0, -2.2, 1.75], [1, 2.2, 1.75]] as const) {
    const lampGrp = new THREE.Group()
    lampGrp.position.set(lx, 0.16, lz)
    const iron = createMat('#34425a', { metalness: 0.45 })
    lampGrp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.065, 1.42, 8), iron).translateY(0.71))
    const bMat = createMat('#ffe4a8', { emissive: '#ffb048', emissiveIntensity: 0.65 })
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), bMat)
    bulb.position.y = 1.48
    lampGrp.add(bulb)
    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffc46e', 1.25, 0.45)
    halo.position.y = 1.48
    lampGrp.add(halo)

    ctx.registerInteractive(bulb, {
      goalId: 'lamps',
      focusPoint: new THREE.Vector3(lx, 1.5, lz),
      onClick: () => {
        litLamps.add(idx)
        bMat.emissiveIntensity = 1.65
        halo.material.opacity = 0.82
        if (litLamps.size >= 2) ctx.completeGoal('lamps')
        return { label: '点亮雪夜铁艺暖光路灯', sfx: 'lamp' }
      },
    })
    g.add(lampGrp)
  }

  for (const [idx, ix, iz] of [[2, -1.45, 2.35], [3, 1.45, 2.35]] as const) {
    const iceMat = createMat('#a8e2ff', {
      emissive: '#48b8f5',
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.85,
      roughness: 0.15,
    })
    const ice = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), iceMat)
    ice.scale.set(0.85, 1.65, 0.85)
    ice.position.set(ix, 0.56, iz)
    g.add(ice)
    ctx.registerInteractive(ice, {
      goalId: 'lamps',
      focusPoint: new THREE.Vector3(ix, 0.65, iz),
      onClick: () => {
        litLamps.add(idx)
        iceMat.emissiveIntensity = 1.35
        if (litLamps.size >= 2) ctx.completeGoal('lamps')
        return { label: '晶莹冰雕灯柱折射冰雪星芒', sfx: 'star' }
      },
    })
  }

  // 两棵覆雪红松
  for (const [px, pz] of [[-2.6, -1.55], [2.6, -1.5]] as const) {
    const tree = new THREE.Group()
    tree.position.set(px, 0.16, pz)
    tree.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.55, 7), createMat('#5c4034')).translateY(0.26))
    for (let l = 0; l < 3; l += 1) {
      const green = new THREE.Mesh(new THREE.ConeGeometry(0.68 - l * 0.14, 0.65, 8), createMat('#345d52'))
      green.position.y = 0.68 + l * 0.42
      const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.5 - l * 0.1, 0.25, 8), snowMat)
      snowCap.position.y = 0.86 + l * 0.42
      tree.add(green, snowCap)
    }
    g.add(tree)
  }

  // 细雪粒子层
  const snowCount = 190
  const snowPos = new Float32Array(snowCount * 3)
  for (let i = 0; i < snowCount; i += 1) {
    snowPos[i * 3] = (Math.random() - 0.5) * 7.6
    snowPos[i * 3 + 1] = Math.random() * 6.2
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 7.6
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  const snowPts = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({ color: '#f4f9ff', size: 0.1, transparent: true, opacity: 0.86 }),
  )
  g.add(snowPts)

  // 终局奇境：盘旋白鸽群 + 北极光波动光幕着色器
  const doveGrp = new THREE.Group()
  doveGrp.visible = false
  const doves: THREE.Mesh[] = []
  const doveMat = createMat('#ffffff', { emissive: '#cfe6ff', emissiveIntensity: 0.55 })
  for (let i = 0; i < 6; i += 1) {
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), doveMat)
    d.rotation.x = Math.PI / 2
    doveGrp.add(d)
    doves.push(d)
  }
  g.add(doveGrp)

  const auroraUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  }
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 1.4 + uTime * 1.6) * 0.45;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float curtain = sin(vUv.x * 12.0 + uTime * 1.4) * 0.5 + 0.5;
        float fadeX = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        float fadeY = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        vec3 col = mix(vec3(0.24, 0.92, 0.68), vec3(0.45, 0.68, 1.0), vUv.y);
        gl_FragColor = vec4(col * (0.65 + 0.45 * curtain), fadeX * fadeY * uOpacity);
      }
    `,
  })
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.8, 28, 6), auroraMat)
  aurora.position.set(0, 4.35, -3.15)
  aurora.visible = false
  g.add(aurora)

  let finaleActive = false
  ctx.setFinaleTrigger(() => {
    finaleActive = true
    doveGrp.visible = true
    aurora.visible = true
  })

  ctx.addTick((t, dt) => {
    snowSwirl = Math.max(0, snowSwirl - dt * 0.75)
    const attr = snowGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < snowCount; i += 1) {
      let y = attr.getY(i) - dt * (0.9 + snowSwirl * 1.4)
      if (y < 0.14) y = 6.2
      attr.setY(i, y)
      const x = attr.getX(i) + Math.sin(t * 1.1 + i) * dt * (0.28 + snowSwirl * 0.6)
      attr.setX(i, x > 3.8 ? -3.8 : x < -3.8 ? 3.8 : x)
    }
    attr.needsUpdate = true

    if (finaleActive) {
      auroraUniforms.uTime.value = t
      auroraUniforms.uOpacity.value = Math.min(0.62, auroraUniforms.uOpacity.value + dt * 0.45)
      doves.forEach((d, idx) => {
        const a = t * 1.15 + (idx / doves.length) * Math.PI * 2
        d.position.set(Math.cos(a) * 1.9, 3.8 + Math.sin(t * 2 + idx) * 0.25, -0.6 + Math.sin(a) * 1.65)
        d.rotation.y = -a
      })
    }
  })

  // 哈尔滨广场冬装旅人
  const harbinWalkers: [number, number, string, string, string][] = [
    [-0.95, 1.85, '#c85a5a', '#f6efe4', '雪夜旅人：零下七度的哈气变成暖白雾气，正好映着洋葱顶的金十字。'],
    [0.95, 1.95, '#466a98', '#ffd89e', '雪夜旅人：冰雕灯柱旁总有人在拍照，雪片落得很慢很轻。'],
    [-2.05, 0.75, '#78628c', '#ffe4b4', '雪夜旅人：整点钟声响过之后，圣索菲亚广场的白鸽就会扑棱着飞起。'],
  ]
  harbinWalkers.forEach(([wx, wz, coat, scarf, note], idx) => {
    const p = createMiniPerson(coat, scarf, { hatHex: coat })
    p.position.set(wx, 0.16, wz)
    g.add(p)
    ctx.registerInteractive(p, {
      focusPoint: new THREE.Vector3(wx, 0.45, wz),
      onClick: () => ({ label: note, sfx: 'snow' }),
    })
    ctx.addTick((t) => {
      const dx = Math.sin(t * 0.28 + idx * 1.7) * 0.55
      p.position.set(wx + dx, 0.16 + Math.abs(Math.sin(t * 4.2 + idx)) * 0.02, wz)
      p.rotation.y = Math.cos(t * 0.28 + idx * 1.7) >= 0 ? Math.PI / 2 : -Math.PI / 2
    })
  })

  enableShadows(g, true, true)
  snowPts.castShadow = false
  aurora.castShadow = false
}

/**
 * 6. 高山观星台 · 穹顶星海
 * 建筑：高原台阶悬崖螺旋石梯 + 星盘徽章地面 + 对开肋骨旋转穹顶 + 黄铜望远镜光束 + 三环黄铜浑仪 + 7 颗星晶
 * 唤醒：3/3 后天穹掠过金色流星雨
 */
export function buildObservatory(ctx: DioramaBuilderCtx) {
  buildSculptedPlinth(ctx, {
    topColor: '#3e5277',
    sideColor: '#243354',
    stoneColor: '#19243d',
  })

  const g = new THREE.Group()
  ctx.group.add(g)

  // 高原石台底座 + 螺旋石阶
  const plateau = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.75, 0.56, 12),
    createMat('#50658d', { roughness: 0.78, bumpMap: ctx.textures.plasterBump }),
  )
  plateau.position.set(-0.25, 0.34, -0.35)
  g.add(plateau)

  for (let s = 0; s < 6; s += 1) {
    const a = 0.7 + s * 0.28
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.34), createMat('#667ea8'))
    step.position.set(-0.25 + Math.cos(a) * 2.45, 0.16 + s * 0.1, -0.35 + Math.sin(a) * 2.45)
    step.rotation.y = -a + Math.PI / 2
    g.add(step)
  }

  // 天文台地面镶嵌发光黄铜星环
  const floorCompass = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 1.72, 32),
    createMat('#e4be7a', { emissive: '#c4964c', emissiveIntensity: 0.45, side: THREE.DoubleSide }),
  )
  floorCompass.rotation.x = -Math.PI / 2
  floorCompass.position.set(-0.25, 0.63, -0.35)
  g.add(floorCompass)

  // 圆筒台身 + 对开滑动穹顶与黄铜主镜 + 星束
  const rotunda = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.38, 1.48, 18),
    createMat('#dbe4ef', { roughness: 0.5, bumpMap: ctx.textures.plasterBump }),
  )
  rotunda.position.set(-0.25, 1.36, -0.35)
  g.add(rotunda)

  const domePivot = new THREE.Group()
  domePivot.position.set(-0.25, 2.1, -0.35)
  const domeMat = createMat('#eef5fc', { roughness: 0.36, metalness: 0.15, side: THREE.DoubleSide })
  const leftShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.24, 16, 12, Math.PI * 0.5, Math.PI, 0, Math.PI * 0.53),
    domeMat,
  )
  const rightShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.24, 16, 12, Math.PI * 1.5, Math.PI, 0, Math.PI * 0.53),
    domeMat,
  )
  domePivot.add(leftShell, rightShell)

  const brassMat = createMat('#e5b976', { emissive: '#b47e36', emissiveIntensity: 0.35, metalness: 0.72, roughness: 0.28 })
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.55, 14), brassMat)
  scope.position.set(0, 0.65, 0.72)
  scope.rotation.x = Math.PI / 3.2
  domePivot.add(scope)

  const beamMat = new THREE.MeshBasicMaterial({
    color: '#9cefd4',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const scopeBeam = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.6, 14, 1, true), beamMat)
  scopeBeam.position.set(0, 2.25, 2.05)
  scopeBeam.rotation.x = Math.PI / 3.2
  domePivot.add(scopeBeam)

  let domeOpen = false
  let domeTargetY = 0.25
  const toggleDome = () => {
    domeOpen = true
    domeTargetY += Math.PI / 3
    beamMat.opacity = 0.32
    ctx.completeGoal('dome')
    return { label: '打开天文台对开穹顶 · 投射测星光束', sfx: 'star' as const }
  }
  ctx.registerInteractive(leftShell, { goalId: 'dome', focusPoint: new THREE.Vector3(-0.25, 2.4, -0.35), onClick: toggleDome })
  ctx.registerInteractive(rightShell, { goalId: 'dome', focusPoint: new THREE.Vector3(-0.25, 2.4, -0.35), onClick: toggleDome })
  ctx.registerInteractive(scope, { goalId: 'dome', focusPoint: new THREE.Vector3(-0.25, 2.6, 0.2), onClick: toggleDome })
  g.add(domePivot)

  // 三轴旋转青铜浑天星仪
  const astro = new THREE.Group()
  astro.position.set(2.15, 1.05, 1.25)
  const astroBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.48, 0.9, 10), createMat('#4b5d80'))
  astroBase.position.y = -0.58
  astro.add(astroBase)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.032, 8, 28), brassMat)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.028, 8, 26), brassMat)
  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.024, 8, 24), brassMat)
  const coreSun = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 14, 12),
    createMat('#ffe29c', { emissive: '#ffaa44', emissiveIntensity: 1.3 }),
  )
  astro.add(ring1, ring2, ring3, coreSun)
  g.add(astro)

  let astroBoost = 0
  ctx.registerInteractive(ring1, {
    goalId: 'astrolabe',
    focusPoint: new THREE.Vector3(2.15, 1.05, 1.25),
    onClick: () => {
      astroBoost = 2.4
      ctx.completeGoal('astrolabe')
      return { label: '拨动高原青铜三环浑天仪对齐星轨', sfx: 'star' }
    },
  })

  // 7 颗可观测连接的立体星晶
  const starCoords: [number, number, number][] = [
    [-2.5, 3.6, -1.6],
    [-1.2, 4.3, -2.0],
    [0.2, 4.0, -2.3],
    [1.6, 4.5, -1.7],
    [2.6, 3.5, -1.0],
    [1.0, 3.1, -2.4],
    [-1.9, 2.8, 0.3],
  ]
  const pickedPts: THREE.Vector3[] = []
  let lineMesh: THREE.Line | null = null
  const lineMat = new THREE.LineBasicMaterial({ color: '#9cf2d4', transparent: true, opacity: 0.9 })

  starCoords.forEach(([sx, sy, sz], idx) => {
    const sMat = createMat('#fff4d2', { emissive: '#8ac8ff', emissiveIntensity: 0.65, flatShading: true })
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), sMat)
    star.position.set(sx, sy, sz)
    g.add(star)

    let picked = false
    ctx.registerInteractive(star, {
      goalId: 'stars',
      focusPoint: new THREE.Vector3(sx, sy, sz),
      onClick: () => {
        if (!picked) {
          picked = true
          sMat.emissive.set('#ffd278')
          sMat.emissiveIntensity = 1.75
          star.scale.setScalar(1.36)
          pickedPts.push(new THREE.Vector3(sx, sy, sz))
          domeTargetY = Math.atan2(sx + 0.25, sz + 0.35)
          if (pickedPts.length >= 2) {
            if (lineMesh) {
              g.remove(lineMesh)
              lineMesh.geometry.dispose()
            }
            lineMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pickedPts), lineMat)
            g.add(lineMesh)
          }
          if (pickedPts.length >= 4) ctx.completeGoal('stars')
        }
        return { label: `点亮第 ${pickedPts.length} 颗悬浮星晶 (${Math.min(pickedPts.length, 4)}/4)`, sfx: 'star' }
      },
    })

    ctx.addTick((t) => {
      star.rotation.y = t * 0.9 + idx
      star.position.y = sy + Math.sin(t * 1.45 + idx) * 0.12
    })
  })

  // 终局奇境：金色流星雨
  const meteorGroup = new THREE.Group()
  meteorGroup.visible = false
  const meteors: { mesh: THREE.Mesh; phase: number; ox: number; oy: number; oz: number }[] = []
  const mMat = createMat('#ffe7aa', { emissive: '#ffba52', emissiveIntensity: 1.8 })
  for (let i = 0; i < 10; i += 1) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.04, 1.35, 6), mMat)
    m.rotation.z = Math.PI / 3.4
    m.rotation.x = 0.2
    meteorGroup.add(m)
    meteors.push({
      mesh: m,
      phase: (i / 10) * 1.6,
      ox: -3.2 + (i % 5) * 1.65,
      oy: 5.5 + (i % 2) * 0.8,
      oz: -3.4 + Math.floor(i / 5) * 2.2,
    })
  }
  g.add(meteorGroup)

  let meteorTimer = -1
  ctx.setFinaleTrigger(() => {
    meteorTimer = 0
    meteorGroup.visible = true
  })

  ctx.addTick((t, dt) => {
    astroBoost = Math.max(0, astroBoost - dt * 0.9)
    ring1.rotation.y = t * (0.4 + astroBoost * 1.6)
    ring2.rotation.x = t * (0.55 + astroBoost * 1.9)
    ring3.rotation.z = t * (0.72 + astroBoost * 2.1)

    domePivot.rotation.y += (domeTargetY - domePivot.rotation.y) * Math.min(1, dt * 3.8)
    const split = domeOpen ? 0.24 : 0
    leftShell.rotation.z += (split - leftShell.rotation.z) * Math.min(1, dt * 5)
    rightShell.rotation.z += (-split - rightShell.rotation.z) * Math.min(1, dt * 5)

    if (meteorTimer >= 0) {
      meteorTimer += dt
      const dur = 4.8
      if (meteorTimer >= dur) {
        meteorTimer = -1
        meteorGroup.visible = false
      } else {
        meteors.forEach((m) => {
          const cycle = (meteorTimer * 0.85 + m.phase) % 1.2
          const show = cycle < 0.85
          m.mesh.visible = show
          m.mesh.position.set(m.ox + cycle * 4.5, m.oy - cycle * 3.2, m.oz + cycle * 1.4)
        })
      }
    }
  })

  // 高原露台观星者
  for (const [ax, ay, az, note] of [
    [1.35, 0.62, 1.35, '高原观星者：调整三环浑仪时，感觉整片高原的银河都在耳边流转。'],
    [-1.45, 0.62, 1.15, '高原观星者：就算发不出中微子信号，这里的星空也一直照着人间。'],
  ] as const) {
    const p = createMiniPerson('#3c527a', '#9cf2d4', { hatHex: '#4f6d9e' })
    p.position.set(ax, ay, az)
    g.add(p)
    ctx.registerInteractive(p, {
      focusPoint: new THREE.Vector3(ax, ay + 0.35, az),
      onClick: () => ({ label: note, sfx: 'star' }),
    })
  }

  enableShadows(g, true, true)
  scopeBeam.castShadow = false
}
