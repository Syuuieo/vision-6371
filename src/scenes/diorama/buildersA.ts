import * as THREE from 'three'
import {
  buildSculptedPlinth,
  createMat,
  createMiniCar,
  createMiniFish,
  createMiniPerson,
  enableShadows,
  makeGlowSprite,
} from './materials'
import type { DioramaBuilderCtx } from './types'

/**
 * 1. 上海外滩 · 黄浦暮色
 * 建筑：百年钟楼建筑群（柱廊+时钟指针+铜尖顶）、三脚架东方明珠、双层江轮+蒸汽、4 盏复古柱灯
 * 唤醒：3/3 后绽放 3D 黄浦江夜空烟花
 */
export function buildShanghai(ctx: DioramaBuilderCtx) {
  const { water } = buildSculptedPlinth(ctx, {
    topColor: '#d9ccb9',
    sideColor: '#485a79',
    stoneColor: '#27354d',
    waterShallow: '#2f829c',
    waterDeep: '#133b56',
    waterSplitZ: 0.25,
  })

  const g = new THREE.Group()
  ctx.group.add(g)

  // 江岸石板大道与石栏杆
  const promenade = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.22, 3.65),
    createMat('#ded1be', { roughness: 0.78, bumpMap: ctx.textures.plasterBump }),
  )
  promenade.position.set(0, 0.12, -1.7)
  g.add(promenade)

  for (let px = -3.1; px <= 3.1; px += 0.62) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.28, 8),
      createMat('#cfc2af', { roughness: 0.75 }),
    )
    post.position.set(px, 0.34, 0.02)
    g.add(post)
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.055, 0.08), createMat('#dfd3c2'))
  rail.position.set(0, 0.46, 0.02)
  g.add(rail)

  // 海关百年钟楼与两侧万国列柱
  const bundGroup = new THREE.Group()
  bundGroup.position.set(-1.65, 0.23, -1.75)

  const wingMat = createMat('#d4b898', { roughness: 0.72, bumpMap: ctx.textures.plasterBump })
  const trimMat = createMat('#ece1cf', { roughness: 0.62 })
  const copperMat = createMat('#4f787d', { roughness: 0.45, metalness: 0.25 })

  const baseBuilding = new THREE.Mesh(new THREE.BoxGeometry(2.65, 1.55, 1.55), wingMat)
  baseBuilding.position.y = 0.78
  bundGroup.add(baseBuilding)

  // 底层 4 根古典廊柱 + 拱形门窗
  for (let i = 0; i < 5; i += 1) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.45, 10), trimMat)
    col.position.set(-1.05 + i * 0.525, 0.72, 0.79)
    bundGroup.add(col)
  }
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.16, 1.68), trimMat)
  cornice.position.y = 1.62
  bundGroup.add(cornice)

  // 钟楼塔身与铜锥顶
  const towerLower = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.25, 1.04), wingMat)
  towerLower.position.y = 2.3
  bundGroup.add(towerLower)
  const towerUpper = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.85, 0.84), trimMat)
  towerUpper.position.y = 3.28
  bundGroup.add(towerUpper)

  const clockRoof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.08, 4), copperMat)
  clockRoof.rotation.y = Math.PI / 4
  clockRoof.position.y = 4.22
  bundGroup.add(clockRoof)
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.42, 8), createMat('#e5c17d', { metalness: 0.7 }))
  finial.position.y = 4.92
  bundGroup.add(finial)

  // 钟表盘与旋转指针
  const clockFaceMat = createMat('#ffe9b8', { emissive: '#ffbc60', emissiveIntensity: 0.9 })
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 24), clockFaceMat)
  clockFace.rotation.x = Math.PI / 2
  clockFace.position.set(0, 2.52, 0.54)
  bundGroup.add(clockFace)

  const clockRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.032, 8, 24),
    createMat('#c99a54', { metalness: 0.65, roughness: 0.35 }),
  )
  clockRing.position.set(0, 2.52, 0.56)
  bundGroup.add(clockRing)

  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), createMat('#2a221d'))
  hourHand.position.set(0, 2.57, 0.59)
  bundGroup.add(hourHand)
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.22, 0.02), createMat('#2a221d'))
  minuteHand.position.set(0, 2.52, 0.6)
  bundGroup.add(minuteHand)

  // 外滩窗口暖光点缀
  for (let i = -2; i <= 2; i += 1) {
    if (i === 0) continue
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.44, 0.06),
      createMat('#ffd690', { emissive: '#ffa640', emissiveIntensity: 0.8 }),
    )
    w.position.set(i * 0.45, 0.96, 0.79)
    bundGroup.add(w)
  }

  let clockSpinBoost = 0
  ctx.registerInteractive(clockFace, {
    goalId: 'clock',
    focusPoint: new THREE.Vector3(-1.65, 2.5, -1.2),
    onClick: () => {
      clockSpinBoost = 2.6
      clockFaceMat.emissiveIntensity = 1.65
      ctx.completeGoal('clock')
      return { label: '海关大钟鸣响整点报时', sfx: 'horn' }
    },
  })
  ctx.addTick((t, dt) => {
    clockSpinBoost = Math.max(0, clockSpinBoost - dt * 1.1)
    minuteHand.rotation.z = -(t * 0.35 + clockSpinBoost * 3.8)
    hourHand.rotation.z = -(t * 0.06 + clockSpinBoost * 0.5)
  })
  g.add(bundGroup)

  // 右侧三脚架支撑东方明珠风格电视塔
  const pearlGroup = new THREE.Group()
  pearlGroup.position.set(1.75, 0.23, -1.75)

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.18, 0.28, 12), trimMat)
  pedestal.position.y = 0.14
  pearlGroup.add(pedestal)

  // 3 根斜撑巨腿 + 中心立柱
  const towerSteel = createMat('#e5d8dc', { roughness: 0.38, metalness: 0.28 })
  for (let k = 0; k < 3; k += 1) {
    const ang = (k * Math.PI * 2) / 3 + 0.4
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 0.85, 0.18, Math.sin(ang) * 0.85),
      new THREE.Vector3(Math.cos(ang) * 0.45, 0.9, Math.sin(ang) * 0.45),
      new THREE.Vector3(Math.cos(ang) * 0.12, 1.55, Math.sin(ang) * 0.12),
    ])
    pearlGroup.add(new THREE.Mesh(new THREE.TubeGeometry(legCurve, 12, 0.085, 8, false), towerSteel))
  }
  for (let s = 0; s < 3; s += 1) {
    const ang = (s * Math.PI * 2) / 3 + 0.4
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 3.1, 10), towerSteel)
    col.position.set(Math.cos(ang) * 0.14, 1.8, Math.sin(ang) * 0.14)
    pearlGroup.add(col)
  }

  const lowerOrbMat = createMat('#f6a6bc', { emissive: '#eb658f', emissiveIntensity: 0.72, roughness: 0.25 })
  const lowerOrb = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 18), lowerOrbMat)
  lowerOrb.position.y = 1.65
  pearlGroup.add(lowerOrb)

  const collarMat = createMat('#ffd498', { emissive: '#ff9648', emissiveIntensity: 0.85 })
  const lowerCollar = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 10, 28), collarMat)
  lowerCollar.rotation.x = Math.PI / 2
  lowerCollar.position.y = 1.65
  pearlGroup.add(lowerCollar)

  const upperOrbMat = createMat('#ffd096', { emissive: '#ff9044', emissiveIntensity: 0.78, roughness: 0.24 })
  const upperOrb = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 16), upperOrbMat)
  upperOrb.position.y = 3.35
  pearlGroup.add(upperOrb)

  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.5, 12), towerSteel)
  capsule.position.y = 4.02
  pearlGroup.add(capsule)
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.045, 1.05, 8),
    createMat('#fff1d6', { emissive: '#ffcf88', emissiveIntensity: 0.7 }),
  )
  spire.position.y = 4.78
  pearlGroup.add(spire)

  const pearlGlow = makeGlowSprite(ctx.textures.glowHalo, '#ff98b6', 2.4, 0.45)
  pearlGlow.position.y = 1.65
  pearlGroup.add(pearlGlow)

  const pearlLight = new THREE.PointLight('#ff9fb8', 1.4, 7.5, 2)
  pearlLight.position.set(1.75, 2.2, -1.2)
  g.add(pearlLight)

  const pearlPalettes = [
    ['#f6a6bc', '#eb658f', '#ffd096', '#ff9044'],
    ['#8ae2ff', '#32b8ff', '#ffd68c', '#ff9640'],
    ['#ffd994', '#ffaa38', '#f598ff', '#cf5cff'],
  ]
  let pearlMode = 0
  ctx.registerInteractive(lowerOrb, {
    goalId: 'pearl',
    focusPoint: new THREE.Vector3(1.75, 2.4, -1.75),
    onClick: () => {
      pearlMode = (pearlMode + 1) % pearlPalettes.length
      const [c1, e1, c2, e2] = pearlPalettes[pearlMode]
      lowerOrbMat.color.set(c1)
      lowerOrbMat.emissive.set(e1)
      lowerOrbMat.emissiveIntensity = 1.45
      upperOrbMat.color.set(c2)
      upperOrbMat.emissive.set(e2)
      upperOrbMat.emissiveIntensity = 1.55
      pearlGlow.material.color.set(e1)
      pearlGlow.material.opacity = 0.72
      pearlLight.color.set(e1)
      pearlLight.intensity = 2.4
      ctx.completeGoal('pearl')
      return { label: '切换外滩明珠双球璀璨霓虹', sfx: 'lamp' }
    },
  })
  g.add(pearlGroup)

  // 4 盏沿江铸铁双耳路灯（需全部点亮达成 lamps 目标）
  const litSet = new Set<number>([0, 2])
  for (let i = 0; i < 4; i += 1) {
    const lx = -2.55 + i * 1.7
    const lampGroup = new THREE.Group()
    lampGroup.position.set(lx, 0.23, -0.05)

    const poleMat = createMat('#34435e', { metalness: 0.45, roughness: 0.45 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 1.12, 8), poleMat)
    pole.position.y = 0.56
    lampGroup.add(pole)
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), poleMat)
    cross.position.y = 1.08
    lampGroup.add(cross)

    const startLit = litSet.has(i)
    const lampMat = createMat('#ffe4a8', {
      emissive: '#ffaa44',
      emissiveIntensity: startLit ? 1.45 : 0.14,
    })
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), lampMat)
    globe.position.y = 1.18
    lampGroup.add(globe)

    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 0.95, startLit ? 0.65 : 0.05)
    halo.position.y = 1.18
    lampGroup.add(halo)

    ctx.registerInteractive(globe, {
      goalId: 'lamps',
      focusPoint: new THREE.Vector3(lx, 1.2, -0.05),
      onClick: () => {
        if (litSet.has(i)) {
          litSet.delete(i)
        } else {
          litSet.add(i)
        }
        const nowLit = litSet.has(i)
        lampMat.emissiveIntensity = nowLit ? 1.55 : 0.12
        halo.material.opacity = nowLit ? 0.72 : 0.04
        if (litSet.size >= 4) ctx.completeGoal('lamps')
        return {
          label: nowLit ? `点亮沿江路灯 (${litSet.size}/4)` : `调暗一盏江灯 (${litSet.size}/4)`,
          sfx: 'lamp',
        }
      },
    })
    g.add(lampGroup)
  }

  // 双层黄浦江轮（斜面船艏 + 暖灯舱房 + 冒烟烟囱）
  const ferry = new THREE.Group()
  ferry.position.set(0, 0.02, 1.95)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.24, 0.52), createMat('#f0e5d7'))
  ferry.add(hull)
  const prow = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.44, 4), createMat('#d46c5c'))
  prow.rotation.z = -Math.PI / 2
  prow.rotation.x = Math.PI / 4
  prow.scale.set(0.65, 1, 0.92)
  prow.position.set(0.95, 0.02, 0)
  ferry.add(prow)

  const deckMat = createMat('#ffe4ad', { emissive: '#ffaa44', emissiveIntensity: 0.85 })
  const cabin1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.38), deckMat)
  cabin1.position.set(-0.06, 0.22, 0)
  ferry.add(cabin1)
  const cabin2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.28), createMat('#f7efe3'))
  cabin2.position.set(0.02, 0.39, 0)
  ferry.add(cabin2)
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.24, 10), createMat('#344864'))
  funnel.position.set(-0.24, 0.52, 0)
  ferry.add(funnel)

  // 蒸汽烟团
  const puffs: THREE.Mesh[] = []
  const puffMat = createMat('#f2f6ff', { transparent: true, opacity: 0.55 })
  for (let p = 0; p < 3; p += 1) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), puffMat)
    ferry.add(puff)
    puffs.push(puff)
  }

  let ferryBoost = 0
  ctx.registerInteractive(hull, {
    goalId: 'pearl',
    focusPoint: new THREE.Vector3(0, 0.35, 1.95),
    onClick: (pt) => {
      ferryBoost = 1.6
      ctx.triggerRipple(pt?.x ?? ferry.position.x, pt?.z ?? 1.95)
      ctx.completeGoal('pearl')
      return { label: '黄浦江轮鸣笛破浪驶过', sfx: 'horn' }
    },
  })
  g.add(ferry)

  if (water) {
    ctx.registerInteractive(water.mesh, {
      onClick: (pt) => {
        ctx.triggerRipple(pt?.x ?? 0, pt?.z ?? 1.8)
        return { label: '轻拨黄浦江面晚潮涟漪', sfx: 'ripple' }
      },
    })
  }

  // 终局奇境：3D 外滩烟花粒子群
  const fwCount = 120
  const fwPos = new Float32Array(fwCount * 3)
  const fwCol = new Float32Array(fwCount * 3)
  const fwVel: THREE.Vector3[] = []
  const palette = [new THREE.Color('#ffd08a'), new THREE.Color('#ff8aa6'), new THREE.Color('#8be2ff')]
  for (let i = 0; i < fwCount; i += 1) {
    fwVel.push(new THREE.Vector3())
    const c = palette[i % palette.length]
    fwCol[i * 3] = c.r
    fwCol[i * 3 + 1] = c.g
    fwCol[i * 3 + 2] = c.b
  }
  const fwGeo = new THREE.BufferGeometry()
  fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3))
  fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3))
  const fwMat = new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const fwPoints = new THREE.Points(fwGeo, fwMat)
  fwPoints.visible = false
  g.add(fwPoints)

  let fwTimer = -1
  const launchFireworks = () => {
    fwTimer = 0
    fwPoints.visible = true
    const centers: [number, number, number][] = [
      [-1.1, 4.3, -0.5],
      [1.0, 4.8, -0.8],
      [0.1, 5.2, 0.2],
    ]
    for (let i = 0; i < fwCount; i += 1) {
      const c = centers[i % centers.length]
      fwPos[i * 3] = c[0]
      fwPos[i * 3 + 1] = c[1]
      fwPos[i * 3 + 2] = c[2]
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const spd = 1.2 + Math.random() * 1.9
      fwVel[i].set(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.cos(phi) * spd * 0.9 + 0.5,
        Math.sin(phi) * Math.sin(theta) * spd,
      )
    }
    ;(fwGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  }
  ctx.setFinaleTrigger(launchFireworks)

  ctx.addTick((t, dt) => {
    ferryBoost = Math.max(0, ferryBoost - dt * 0.55)
    const phase = t * (0.36 + ferryBoost * 0.35)
    ferry.position.x = Math.sin(phase) * 2.25
    ferry.rotation.y = Math.cos(phase) >= 0 ? 0 : Math.PI
    ferry.position.y = 0.02 + Math.sin(t * 2.3) * 0.025

    puffs.forEach((p, idx) => {
      const cycle = ((t * 0.9 + idx * 0.33) % 1)
      p.position.set(-0.24 - cycle * 0.45, 0.65 + cycle * 0.55, Math.sin(t * 2 + idx) * 0.05)
      const s = 0.6 + cycle * 1.35
      p.scale.setScalar(s)
    })

    if (fwTimer >= 0) {
      fwTimer += dt
      const dur = 3.6
      if (fwTimer >= dur) {
        fwTimer = -1
        fwPoints.visible = false
      } else {
        const attr = fwGeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < fwCount; i += 1) {
          fwVel[i].y -= dt * 0.72
          fwVel[i].multiplyScalar(1 - dt * 0.45)
          attr.setXYZ(
            i,
            attr.getX(i) + fwVel[i].x * dt,
            attr.getY(i) + fwVel[i].y * dt,
            attr.getZ(i) + fwVel[i].z * dt,
          )
        }
        attr.needsUpdate = true
        fwMat.opacity = Math.max(0, 1 - Math.pow(fwTimer / dur, 1.35))
      }
    }
  })

  ctx.addMoodHook((mood) => {
    pearlLight.intensity = mood === 'dawn' ? 0.65 : mood === 'night' ? 2.1 : 1.4
  })

  // 外滩沿江漫步游客（点击弹出城市生活短笺）
  const walkers: { grp: THREE.Group; baseZ: number; dir: number; speed: number; range: number; originX: number }[] = []
  const walkerSpecs: [number, number, string, string, string][] = [
    [-1.4, -0.42, '#486a98', '#ffd89e', '外滩游人：江风吹过石栏杆，黄浦江边的夜晚比白昼更温柔。'],
    [0.6, -0.58, '#c96f63', '#fff0d6', '外滩游人：刚刚敲响的海关钟声里，游人正仰头等着对岸灯火全亮。'],
    [1.1, -0.36, '#4f8c7a', '#ffcf8a', '外滩游人：有人举着手机拍下东方明珠，也替不能来的人看了一遍江景。'],
    [-2.4, -0.68, '#7a5c88', '#ffd6a4', '外滩游人：街头艺人拉起大提琴，脚步声和浪声叠在一起。'],
  ]
  walkerSpecs.forEach(([wx, wz, coat, scarf, note], idx) => {
    const p = createMiniPerson(coat, scarf)
    p.position.set(wx, 0.23, wz)
    g.add(p)
    walkers.push({ grp: p, baseZ: wz, dir: idx % 2 === 0 ? 1 : -1, speed: 0.24 + idx * 0.04, range: 1.05, originX: wx })
    ctx.registerInteractive(p, {
      focusPoint: new THREE.Vector3(wx, 0.5, wz),
      onClick: () => ({ label: note, sfx: 'star' }),
    })
  })

  // 跃出黄浦江水面的银鱼
  const riverFish = [createMiniFish('#9be2ff'), createMiniFish('#ffd59a')]
  riverFish.forEach((f, idx) => {
    f.visible = false
    g.add(f)
    ctx.registerInteractive(f, {
      onClick: () => ({ label: '江鱼跃出水面荡起碎金波光！', sfx: 'ripple' }),
    })
    ctx.addTick((t) => {
      const cycle = (t * 0.42 + idx * 0.5) % 2.6
      const show = cycle < 0.9
      f.visible = show
      if (show) {
        const u = cycle / 0.9
        const fx = -1.6 + idx * 2.5 + u * 0.7
        const fy = -0.14 + Math.sin(u * Math.PI) * 0.52
        f.position.set(fx, fy, 1.35 + idx * 0.85)
        f.rotation.z = (0.5 - u) * 1.45
      }
    })
  })

  ctx.addTick((t) => {
    walkers.forEach((w, idx) => {
      const x = w.originX + Math.sin(t * w.speed + idx * 1.4) * w.range
      const vx = Math.cos(t * w.speed + idx * 1.4)
      w.grp.position.set(x, 0.23 + Math.abs(Math.sin(t * 5.2 + idx)) * 0.025, w.baseZ)
      w.grp.rotation.y = vx >= 0 ? Math.PI / 2 : -Math.PI / 2
    })
  })

  enableShadows(g, true, true)
  fwPoints.castShadow = false
}

/**
 * 2. 南京 · 晚雨图书馆
 * 建筑：红砖纹理主馆 + 古典四柱门廊 + 阶梯雨廊 + 铰链天窗 + 2 株曲干金叶梧桐 + 庭院发光书卷台
 * 唤醒：3/3 后从书卷台盘旋升起发光纸鹤光羽
 */
export function buildLibrary(ctx: DioramaBuilderCtx) {
  buildSculptedPlinth(ctx, {
    topColor: '#505b6d',
    sideColor: '#48526e',
    stoneColor: '#252f44',
  })

  const g = new THREE.Group()
  ctx.group.add(g)

  // 湿润青石广场反光水洼
  const courtyard = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.12, 6.8),
    createMat('#566174', { roughness: 0.42, metalness: 0.12, bumpMap: ctx.textures.plasterBump }),
  )
  courtyard.position.y = 0.08
  g.add(courtyard)

  const puddleMat = createMat('#7aa3c8', { roughness: 0.12, metalness: 0.45, transparent: true, opacity: 0.42 })
  for (const [px, pz, pr] of [[-1.1, 2.25, 0.72], [1.45, 2.05, 0.56]] as const) {
    const puddle = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 1.05, 0.02, 16), puddleMat)
    puddle.scale.set(1.3, 1, 0.85)
    puddle.position.set(px, 0.15, pz)
    g.add(puddle)
  }

  // 主馆台基、石阶与四柱古典门廊
  const podium = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.34, 3.15), createMat('#d8cfc2', { roughness: 0.7 }))
  podium.position.set(0, 0.28, -0.75)
  g.add(podium)

  for (let s = 0; s < 3; s += 1) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.8 - s * 0.18, 0.12, 0.42),
      createMat('#ddd4c8'),
    )
    step.position.set(0, 0.18 + s * 0.09, 1.15 - s * 0.2)
    g.add(step)
  }

  const wallMat = createMat('#b8685c', {
    map: ctx.textures.brickTex,
    bumpMap: ctx.textures.brickBump,
    bumpScale: 0.045,
    roughness: 0.76,
  })
  const building = new THREE.Mesh(new THREE.BoxGeometry(4.55, 2.55, 2.35), wallMat)
  building.position.set(0, 1.72, -0.82)
  g.add(building)

  // 古典门廊四立柱 + 山花门楣
  const stoneTrim = createMat('#eae0d0', { roughness: 0.6, bumpMap: ctx.textures.plasterBump })
  for (const cx of [-0.95, -0.35, 0.35, 0.95]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 2.1, 12), stoneTrim)
    pillar.position.set(cx, 1.48, 0.62)
    g.add(pillar)
  }
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.62, 3), stoneTrim)
  pediment.rotation.y = Math.PI
  pediment.scale.set(1.15, 1, 0.42)
  pediment.position.set(0, 2.86, 0.56)
  g.add(pediment)

  const roofBase = new THREE.Mesh(new THREE.BoxGeometry(4.92, 0.22, 2.75), stoneTrim)
  roofBase.position.set(0, 3.06, -0.82)
  g.add(roofBase)

  const slateMat = createMat('#3a506e', { roughness: 0.58 })
  const roofPitch = new THREE.Mesh(new THREE.ConeGeometry(3.05, 1.02, 4), slateMat)
  roofPitch.rotation.y = Math.PI / 4
  roofPitch.scale.set(1.22, 1, 0.66)
  roofPitch.position.set(0, 3.66, -0.82)
  g.add(roofPitch)

  // 铰链式可开启玻璃天窗
  const skylightGroup = new THREE.Group()
  skylightGroup.position.set(0, 3.82, -0.82)
  const frameMat = createMat('#d4c2a6')
  const glassMat = createMat('#ffe4ab', {
    emissive: '#ffb658',
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.85,
  })
  const skyFrame = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.92), frameMat)
  const skyGlass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.74), glassMat)
  skylightGroup.add(skyFrame, skyGlass)
  const skyLight = new THREE.PointLight('#ffca7a', 0.8, 7, 2)
  skyLight.position.set(0, 0.5, 0)
  skylightGroup.add(skyLight)
  g.add(skylightGroup)

  let skylightOpen = false
  ctx.registerInteractive(skyGlass, {
    goalId: 'skylight',
    focusPoint: new THREE.Vector3(0, 3.9, -0.82),
    onClick: () => {
      skylightOpen = !skylightOpen
      glassMat.emissiveIntensity = skylightOpen ? 1.55 : 0.45
      skyLight.intensity = skylightOpen ? 2.6 : 0.8
      if (skylightOpen) ctx.completeGoal('skylight')
      return {
        label: skylightOpen ? '掀开玻璃天窗 · 暖光倾泻入雨夜' : '轻掩图书馆玻璃天窗',
        sfx: 'lamp',
      }
    },
  })

  // 8 扇带木窗格的自习拱窗（至少点亮 5 扇唤醒 windows 目标）
  const litWindows = new Set<number>([0, 2, 5])
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const idx = row * 4 + col
      const wx = -1.62 + col * 1.08
      const wy = 1.2 + row * 1.08
      const initLit = litWindows.has(idx)
      const wMat = createMat(initLit ? '#ffe5ad' : '#3a4a64', {
        emissive: '#ffaa44',
        emissiveIntensity: initLit ? 1.15 : 0.08,
      })
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.12), wMat)
      win.position.set(wx, wy, 0.37)
      g.add(win)

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.08), stoneTrim)
      frame.position.set(wx, wy, 0.33)
      g.add(frame)

      ctx.registerInteractive(win, {
        goalId: 'windows',
        focusPoint: new THREE.Vector3(wx, wy, 0.5),
        onClick: () => {
          if (litWindows.has(idx)) litWindows.delete(idx)
          else litWindows.add(idx)
          const on = litWindows.has(idx)
          wMat.color.set(on ? '#ffe5ad' : '#3a4a64')
          wMat.emissiveIntensity = on ? 1.45 : 0.06
          if (litWindows.size >= 5) ctx.completeGoal('windows')
          return {
            label: on ? `亮起自习室窗灯 (${litWindows.size}/8)` : `调暗一扇窗灯 (${litWindows.size}/8)`,
            sfx: 'lamp',
          }
        },
      })
    }
  }

  // 庭院中央：发光石刻翻开书卷台
  const bookPedestal = new THREE.Group()
  bookPedestal.position.set(0, 0.16, 2.2)
  const bookPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.56, 8), stoneTrim)
  bookPlinth.position.y = 0.28
  bookPedestal.add(bookPlinth)
  const pageMat = createMat('#fff0d2', { emissive: '#ffba64', emissiveIntensity: 0.75 })
  const leftPage = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.52), pageMat)
  leftPage.position.set(-0.2, 0.6, 0)
  leftPage.rotation.z = 0.22
  const rightPage = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.52), pageMat)
  rightPage.position.set(0.2, 0.6, 0)
  rightPage.rotation.z = -0.22
  bookPedestal.add(leftPage, rightPage)
  const bookGlow = makeGlowSprite(ctx.textures.glowHalo, '#ffd38a', 1.35, 0.55)
  bookGlow.position.y = 0.78
  bookPedestal.add(bookGlow)
  g.add(bookPedestal)

  ctx.registerInteractive(bookPedestal, {
    goalId: 'book',
    focusPoint: new THREE.Vector3(0, 0.85, 2.2),
    onClick: () => {
      pageMat.emissiveIntensity = 1.65
      bookGlow.material.opacity = 0.85
      ctx.completeGoal('book')
      return { label: '轻翻庭院石雕书页 · 纸墨余温亮起', sfx: 'star' }
    },
  })

  // 两棵真实多枝曲干秋金梧桐
  const leafShakeHooks: ((t: number) => void)[] = []
  let treeShakeBoost = 0
  for (const [tx, tz, flip] of [[-2.55, 1.35, 1], [2.55, 1.3, -1]] as const) {
    const tree = new THREE.Group()
    tree.position.set(tx, 0.14, tz)
    const bark = createMat('#664838', { roughness: 0.9 })
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1 * flip, 0.65, 0.06),
      new THREE.Vector3(-0.06 * flip, 1.35, -0.04),
    ])
    tree.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 10, 0.11, 8, false), bark))

    const foliage = new THREE.Group()
    foliage.position.set(-0.04 * flip, 1.55, 0)
    const crownSpecs: [number, number, number, number, string][] = [
      [0, 0.25, 0, 0.65, '#e8ae54'],
      [-0.45, -0.05, 0.22, 0.5, '#f0be6a'],
      [0.44, 0.02, -0.2, 0.52, '#db9444'],
      [0.08, 0.62, 0.1, 0.45, '#f2ca7e'],
    ]
    for (const [cx, cy, cz, cr, cHex] of crownSpecs) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(cr, 1), createMat(cHex, { roughness: 0.82 }))
      puff.position.set(cx, cy, cz)
      foliage.add(puff)
    }
    tree.add(foliage)
    g.add(tree)

    ctx.registerInteractive(foliage, {
      goalId: 'book',
      focusPoint: new THREE.Vector3(tx, 1.75, tz),
      onClick: () => {
        treeShakeBoost = 1.8
        ctx.completeGoal('book')
        return { label: '轻摇晚秋梧桐枝干 · 落叶纷飞', sfx: 'snow' }
      },
    })

    leafShakeHooks.push((t) => {
      foliage.rotation.z = Math.sin(t * 1.4 + tx) * (0.04 + treeShakeBoost * 0.08)
      foliage.rotation.x = Math.cos(t * 1.1 + tz) * (0.03 + treeShakeBoost * 0.05)
    })
  }

  // 细雨粒子层
  const rainCount = 150
  const rainPos = new Float32Array(rainCount * 3)
  for (let i = 0; i < rainCount; i += 1) {
    rainPos[i * 3] = (Math.random() - 0.5) * 7.2
    rainPos[i * 3 + 1] = Math.random() * 5.8
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 7.2
  }
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  const rainMat = new THREE.PointsMaterial({ color: '#b4d8ff', size: 0.06, transparent: true, opacity: 0.5 })
  const rainPts = new THREE.Points(rainGeo, rainMat)
  g.add(rainPts)

  // 终局奇境：从书卷台盘旋升起的金光纸鹤
  const craneGroup = new THREE.Group()
  craneGroup.visible = false
  const cranes: { grp: THREE.Group; lw: THREE.Mesh; rw: THREE.Mesh; offset: number }[] = []
  const craneMat = createMat('#ffe7b8', { emissive: '#ffbe64', emissiveIntensity: 1.25 })
  for (let i = 0; i < 8; i += 1) {
    const cg = new THREE.Group()
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), craneMat)
    body.rotation.x = Math.PI / 2
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.09), craneMat)
    lw.position.set(-0.08, 0, 0)
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.09), craneMat)
    rw.position.set(0.08, 0, 0)
    cg.add(body, lw, rw)
    craneGroup.add(cg)
    cranes.push({ grp: cg, lw, rw, offset: (i / 8) * Math.PI * 2 })
  }
  g.add(craneGroup)

  let craneTimer = -1
  ctx.setFinaleTrigger(() => {
    craneTimer = 0
    craneGroup.visible = true
  })

  ctx.addTick((t, dt) => {
    treeShakeBoost = Math.max(0, treeShakeBoost - dt * 0.85)
    for (const h of leafShakeHooks) h(t)

    const targetAngle = skylightOpen ? 0.42 : 0
    skylightGroup.rotation.x += (targetAngle - skylightGroup.rotation.x) * Math.min(1, dt * 5)

    const attr = rainGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < rainCount; i += 1) {
      let y = attr.getY(i) - dt * 4.9
      if (y < 0.14) y = 5.6
      attr.setY(i, y)
    }
    attr.needsUpdate = true

    if (craneTimer >= 0) {
      craneTimer += dt
      const dur = 5.5
      if (craneTimer >= dur) {
        craneTimer = -1
        craneGroup.visible = false
      } else {
        cranes.forEach((c) => {
          const prog = Math.min(1, craneTimer / dur)
          const a = c.offset + craneTimer * 1.45
          const rad = 0.45 + prog * 1.65
          c.grp.position.set(
            Math.cos(a) * rad,
            0.85 + prog * 3.8 + Math.sin(craneTimer * 2.5 + c.offset) * 0.14,
            2.1 + Math.sin(a) * rad * 0.75,
          )
          c.grp.rotation.y = -a
          const flap = Math.sin(craneTimer * 9 + c.offset) * 0.45
          c.lw.rotation.z = flap
          c.rw.rotation.z = -flap
        })
      }
    }
  })

  // 庭院看书人与打伞归客
  const reader = createMiniPerson('#5a7a9e', '#ffe0a8', { book: true })
  reader.position.set(-0.92, 0.14, 2.28)
  reader.rotation.y = 0.65
  g.add(reader)
  ctx.registerInteractive(reader, {
    focusPoint: new THREE.Vector3(-0.92, 0.45, 2.28),
    onClick: () => ({ label: '馆前读者：雨夜自习室的灯刚亮起来，树下刚好能读完一章。', sfx: 'star' }),
  })

  const umbrellaWalker = createMiniPerson('#c46e68', '#fff2d8', { umbrella: '#e8b658' })
  umbrellaWalker.position.set(1.1, 0.14, 2.45)
  g.add(umbrellaWalker)
  ctx.registerInteractive(umbrellaWalker, {
    focusPoint: new THREE.Vector3(1.1, 0.45, 2.45),
    onClick: () => ({ label: '打伞归客：伞檐敲着金陵微雨，落叶踩上去沙沙作响。', sfx: 'lamp' }),
  })
  ctx.addTick((t) => {
    const wx = Math.sin(t * 0.34) * 1.65
    umbrellaWalker.position.set(wx, 0.14 + Math.abs(Math.sin(t * 4.6)) * 0.022, 2.55)
    umbrellaWalker.rotation.y = Math.cos(t * 0.34) >= 0 ? Math.PI / 2 : -Math.PI / 2
  })

  enableShadows(g, true, true)
  rainPts.castShadow = false
}

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
      goalId: 'opera',
      focusPoint: new THREE.Vector3(-0.7, 1.25, -1.7),
      onClick: () => {
        vividIdx = (vividIdx + 1) % vividColors.length
        const [col, em] = vividColors[vividIdx]
        shellMat.color.set(col)
        shellMat.emissive.set(em)
        shellMat.emissiveIntensity = vividIdx === 0 ? 0.2 : 0.68
        ctx.completeGoal('opera')
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
    goalId: 'bridge',
    focusPoint: new THREE.Vector3(1.65, 1.8, -0.55),
    onClick: () => {
      bridgeLit = !bridgeLit
      bridgeBulbMat.emissiveIntensity = bridgeLit ? 1.8 : 0.15
      ctx.completeGoal('bridge')
      return { label: bridgeLit ? '点亮悉尼海港钢拱大桥灯串' : '调暗大桥霓虹灯串', sfx: 'lamp' }
    },
  })
  g.add(bridgeGroup)

  // 盛夏游艇（斜桅主帆+三角前帆）
  const boat = new THREE.Group()
  boat.position.set(-0.6, 0.02, 1.85)
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
  for (const [bx, bz, col] of [[-2.1, 1.35, '#ff785a'], [2.05, 2.25, '#ffd468']] as const) {
    const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.34, 8), createMat(col, { emissive: col, emissiveIntensity: 0.35 }))
    buoy.position.set(bx, 0.08, bz)
    g.add(buoy)
    ctx.registerInteractive(buoy, {
      goalId: 'buoys',
      focusPoint: new THREE.Vector3(bx, 0.3, bz),
      onClick: () => {
        sailSpeed = 1.9
        ctx.triggerRipple(bx, bz)
        ctx.completeGoal('buoys')
        return { label: '盛夏海风鼓满风帆穿行海港', sfx: 'ripple' }
      },
    })
  }

  let sailSpeed = 0
  ctx.registerInteractive(hull, {
    goalId: 'buoys',
    focusPoint: new THREE.Vector3(0, 0.5, 1.85),
    onClick: (pt) => {
      sailSpeed = 2.0
      ctx.triggerRipple(pt?.x ?? boat.position.x, pt?.z ?? 1.85)
      ctx.completeGoal('buoys')
      return { label: '白帆乘风加速滑过蔚蓝港湾', sfx: 'ripple' }
    },
  })

  if (water) {
    ctx.registerInteractive(water.mesh, {
      goalId: 'buoys',
      onClick: (pt) => {
        sailSpeed = 1.35
        ctx.triggerRipple(pt?.x ?? 0, pt?.z ?? 1.6)
        ctx.completeGoal('buoys')
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
    sailSpeed = Math.max(0, sailSpeed - dt * 0.55)
    const phase = t * (0.4 + sailSpeed * 0.45)
    boat.position.x = Math.cos(phase) * 2.15
    boat.rotation.y = Math.sin(phase) >= 0 ? Math.PI : 0
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
          d.position.set(-1.35 + localT * 2.7, -0.25 + arc * 1.15, 1.35 + idx * 0.65)
          d.rotation.z = (0.5 - localT) * 1.4
        })
      }
    }
  })

  // 滨海游人 & 海湾飞鱼
  const sydneyWalkers = [
    createMiniPerson('#ff9a76', '#ffffff', { hatHex: '#f5d484' }),
    createMiniPerson('#4ca6c8', '#ffe4b4'),
  ]
  sydneyWalkers.forEach((sw, idx) => {
    sw.position.set(-1.35 + idx * 1.45, 0.42, -0.45)
    g.add(sw)
    ctx.registerInteractive(sw, {
      focusPoint: new THREE.Vector3(-1.35 + idx * 1.45, 0.75, -0.45),
      onClick: () => ({
        label: idx === 0 ? '港湾旅人：太阳伞和海盐味的风一起泡在悉尼盛夏里。' : '歌剧院游人：听完午后音乐会的人正站在阶梯上看白帆船。',
        sfx: 'ripple',
      }),
    })
  })

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
        f.position.set(-1.9 + idx * 2.8 + u * 0.65, -0.12 + Math.sin(u * Math.PI) * 0.56, 1.3 + idx * 0.7)
        f.rotation.z = (0.5 - u) * 1.5
      }
    })
  })

  enableShadows(g, true, true)
}
