import * as THREE from 'three'
import {
  buildSceneTerrain,
  createMat,
  enableShadows,
  makeGlowSprite,
} from './materials'
import { buildStarHaloTexture, buildStarHalos } from './painterlyEngine'
import type { DioramaBuilderCtx } from './types'

export { buildGiza } from './cities/giza'

/**
 * 5. 哈尔滨 · 初雪教堂广场
 * 建筑：红砖纹理圣索菲亚教堂、LatheGeometry 车床轮廓大/小绿洋葱穹顶、彩绘玫瑰花窗、锻铁双臂路灯、冰灯柱
 * 唤醒：3/3 后放飞盘旋雪鸽并升起柔绿北国极光带
 */

function createSeededRandHarbin(seedInit: number) {
  let seed = seedInit
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** 圣索菲亚教堂（真实米尺度：主体 26m + 洋葱穹顶到 36m） */
function createSophiaCathedral(
  brickMat: THREE.Material,
  trimMat: THREE.Material,
  domeGreenMat: THREE.Material,
  goldMat: THREE.Material,
  winMat: THREE.Material,
) {
  const church = new THREE.Group()
  // 十字形主体
  const nave = new THREE.Mesh(new THREE.BoxGeometry(22, 15, 13), brickMat)
  nave.position.y = 7.5
  nave.castShadow = true
  nave.receiveShadow = true
  church.add(nave)
  const transept = new THREE.Mesh(new THREE.BoxGeometry(13, 13, 22), brickMat)
  transept.position.y = 6.5
  transept.castShadow = true
  transept.receiveShadow = true
  church.add(transept)
  // 线脚与拱窗（主体四周）
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(23.2, 0.8, 14.2), trimMat)
  cornice.position.y = 15.2
  church.add(cornice)
  const corniceT = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.8, 23.2), trimMat)
  corniceT.position.y = 14.4
  church.add(corniceT)
  for (let r = 0; r < 3; r += 1) {
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.24), winMat)
      win.position.set(-7 + r * 7, 6 + r * 0.2, side * 6.62)
      church.add(win)
      const win2 = win.clone()
      win2.rotation.y = Math.PI / 2
      win2.position.set(side * 6.62, 6 + r * 0.2, -7 + r * 7)
      church.add(win2)
    }
  }
  // 中央大洋葱穹顶（孔雀绿）
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 8.2, 4.2, 16), trimMat)
  drum.position.y = 17.2
  church.add(drum)
  const domePoints: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12
    domePoints.push(
      new THREE.Vector2(
        Math.sin(t * Math.PI * 0.9) * 7.4,
        19.2 + Math.sin(t * Math.PI) * 6.2 + t * 4.5,
      ),
    )
  }
  const onion = new THREE.Mesh(new THREE.LatheGeometry(domePoints, 20), domeGreenMat)
  onion.castShadow = true
  church.add(onion)
  const cross = new THREE.Group()
  const crossV = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.6, 8), goldMat)
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.18), goldMat)
  crossH.position.y = 0.5
  cross.add(crossV, crossH)
  cross.position.y = 31.4
  church.add(cross)
  // 四角小洋葱顶
  for (const [cx, cz] of [
    [-9.5, -9.5],
    [9.5, -9.5],
    [-9.5, 9.5],
    [9.5, 9.5],
  ] as [number, number][]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5.0, 16, 5.0), brickMat)
    tower.position.set(cx, 8, cz)
    tower.castShadow = true
    church.add(tower)
    const smallDrum = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 2.0, 12), trimMat)
    smallDrum.position.set(cx, 17.0, cz)
    church.add(smallDrum)
    const smallDomePoints: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8
      smallDomePoints.push(
        new THREE.Vector2(
          Math.sin(t * Math.PI * 0.9) * 2.5,
          18.0 + Math.sin(t * Math.PI) * 2.4 + t * 1.6,
        ),
      )
    }
    const smallDome = new THREE.Mesh(new THREE.LatheGeometry(smallDomePoints, 14), domeGreenMat)
    smallDome.position.set(cx, 0, cz)
    smallDome.castShadow = true
    church.add(smallDome)
    const smallCross = cross.clone()
    smallCross.position.set(cx, 23.6, cz)
    smallCross.scale.setScalar(0.7)
    church.add(smallCross)
  }
  // 玫瑰窗（正立面）
  const rose = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    createMat('#ffdf9c', { emissive: '#ff9c3b', emissiveIntensity: 0.5, side: THREE.DoubleSide }),
  )
  rose.position.set(0, 11.5, 11.56)
  church.add(rose)
  // 门廊
  const porch = new THREE.Mesh(new THREE.BoxGeometry(7.2, 5.2, 3.4), brickMat)
  porch.position.set(0, 2.6, 7.8)
  porch.castShadow = true
  church.add(porch)
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.7, 4.4), trimMat)
  porchRoof.position.set(0, 5.5, 7.8)
  church.add(porchRoof)
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 0.3), createMat('#5e4030', { roughness: 0.7 }))
  door.position.set(0, 1.8, 9.5)
  church.add(door)
  return { church, rose }
}

/**
 * 哈尔滨 · 初雪教堂广场（1:1 原生尺度 · 写实场景重做）
 * 教堂嵌入真实街区：44m 石板广场 + 四周砖石建筑群 + 雪覆街道 + 冰灯街市 + 冰湖公园
 * 五段「场景奇遇」：玫瑰花窗 / 洋葱穹顶钟声 / 冰灯街市 / 北国绿极光 / 冰湖舞会
 */
export function buildHarbinV3(ctx: DioramaBuilderCtx) {
  const g = new THREE.Group()
  ctx.group.add(g)
  ctx.setFramingView?.({ pos: [0, 22, 44], look: [0, 12, -10], fov: 48 })

  const rng = createSeededRandHarbin(1901)
  const brickMat = createMat('#96574a', { map: ctx.textures.brickTex, bumpMap: ctx.textures.brickBump, roughness: 0.86 })
  const trimMat = createMat('#cfc4b4', { roughness: 0.8 })
  const domeGreenMat = createMat('#2e6e5e', { roughness: 0.42, metalness: 0.35 })
  const goldMat = createMat('#d9b26f', { metalness: 0.8, roughness: 0.28, emissive: '#8a6420', emissiveIntensity: 0.3 })
  const winMat = createMat('#ffdf9c', { emissive: '#ff9c3b', emissiveIntensity: 0.75 })
  const snowMat = createMat('#eef4fc', { roughness: 0.85 })

  // 连续雪城地形（z -205..205）
  buildSceneTerrain(ctx, {
    size: 420,
    color: '#dfe7f0',
    patchColor: '#eef3fa',
    flatRadius: 130,
    relief: 2.4,
    x: 0,
    z: 0,
    plaza: { w: 44, d: 44, topY: 0.32, color: '#9aa2ab' },
  })

  // 教堂（广场北侧居中）
  const cathedral = createSophiaCathedral(brickMat, trimMat, domeGreenMat, goldMat, winMat)
  cathedral.church.position.set(0, 0.32, -10)
  g.add(cathedral.church)

  // 玫瑰花窗奇遇
  ctx.registerInteractive(cathedral.rose, {
    encounterId: 'rose',
    focusPoint: new THREE.Vector3(0, 11.8, 12.2),
    onClick: () => {
      cathedral.rose.material.emissiveIntensity = 2.2
      winMat.emissiveIntensity = 1.3
      ctx.discoverEncounter('rose')
      return { label: '玫瑰窗亮起的刹那，整座教堂变成一盏琉璃灯', sfx: 'lamp' as const }
    },
  })

  // 洋葱穹顶钟声奇遇（主穹顶触发 + 雪鸽群飞舞）
  const doveGrp = new THREE.Group()
  doveGrp.visible = false
  const doves: THREE.Mesh[] = []
  const doveMat = createMat('#ffffff', { emissive: '#cfe6ff', emissiveIntensity: 0.55 })
  for (let i = 0; i < 6; i += 1) {
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 4), doveMat)
    d.rotation.x = Math.PI / 2
    doveGrp.add(d)
    doves.push(d)
  }
  g.add(doveGrp)
  const mainDomeHit = new THREE.Mesh(
    new THREE.SphereGeometry(8.2, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  )
  mainDomeHit.position.set(0, 24, -10)
  g.add(mainDomeHit)
  ctx.registerInteractive(mainDomeHit, {
    encounterId: 'bell',
    focusPoint: new THREE.Vector3(0, 28, -10),
    onClick: () => {
      doveGrp.visible = true
      ctx.discoverEncounter('bell')
      return { label: '钟声一圈圈荡开，成群白鸽替雪夜飞了起来', sfx: 'celebrate' as const }
    },
  })

  // 街区建筑（广场四周 2-3 排，砖石 + 窗光 + 雪顶）
  const blockRand = createSeededRandHarbin(77)
  const addBlock = (bx: number, bz: number, w: number, d: number, h: number) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMat)
    body.position.set(bx, 0.32 + h / 2, bz)
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)
    const snowCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8), snowMat)
    snowCap.position.set(bx, 0.32 + h + 0.25, bz)
    g.add(snowCap)
    const rows = Math.max(2, Math.floor(h / 3.8))
    const cols = Math.max(2, Math.floor(w / 3.4))
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (rng() > 0.55) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.2), winMat)
          win.position.set(bx - w * 0.4 + (c + 0.5) * (w * 0.8 / cols), 2.4 + r * (h * 0.75 / rows), bz + d / 2 + 0.08)
          g.add(win)
        }
      }
    }
  }
  // 北侧两排（教堂背后）与东西两排
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 6; i += 1) {
      addBlock(-52 + i * 21 + blockRand() * 3, -46 - row * 20 - blockRand() * 4, 15 + blockRand() * 6, 13, 12 + blockRand() * 9)
    }
  }
  for (let row = 0; row < 2; row += 1) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        addBlock(side * (44 + row * 22 + blockRand() * 4), -30 + i * 24 + blockRand() * 4, 13, 17 + blockRand() * 5, 11 + blockRand() * 10)
      }
    }
  }
  // 南侧两排（广场入口正后方）
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 6; i += 1) {
      addBlock(-52 + i * 21 + blockRand() * 3, 40 + row * 20 + blockRand() * 4, 15 + blockRand() * 6, 13, 11 + blockRand() * 9)
    }
  }

  // 广场雪灯柱（四周 8 盏俄式铁艺灯）
  const lampIronMat = createMat('#222b38', { metalness: 0.68, roughness: 0.4 })
  const lampBulbMat = createMat('#ffe6b0', { emissive: '#ffaa48', emissiveIntensity: 1.4 })
  const lamps: { bulbMat: THREE.MeshStandardMaterial }[] = []
  for (const [lx, lz] of [
    [-17, -17],
    [17, -17],
    [-17, 17],
    [17, 17],
    [-17, 0],
    [17, 0],
    [0, -17],
    [0, 17],
  ] as [number, number][]) {
    const lamp = new THREE.Group()
    lamp.position.set(lx, 0.32, lz)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.66, 0.5, 8), lampIronMat)
    base.position.y = 0.25
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 8), lampIronMat)
    shaft.position.y = 2.8
    shaft.castShadow = true
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.38, 0.85, 6), lampBulbMat.clone())
    lantern.position.y = 5.5
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 6), lampIronMat)
    cap.position.y = 6.2
    const halo = makeGlowSprite(ctx.textures.glowHalo, '#ffbe6b', 5.5, 0.55)
    halo.position.y = 5.5
    lamp.add(base, shaft, lantern, cap, halo)
    g.add(lamp)
    lamps.push({ bulbMat: lantern.material as THREE.MeshStandardMaterial })
  }

  // 冰灯街市（广场东侧一排冰雕：晶莹冰砖城堡拱门）
  const iceMat = createMat('#cfeefc', {
    emissive: '#3fa8d0',
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.88,
    roughness: 0.2,
    flatShading: true,
  })
  const iceMarket = new THREE.Group()
  iceMarket.name = 'ice-lantern-market'
  for (let i = 0; i < 5; i += 1) {
    const h = 3.2 + (i % 3) * 1.4
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 2.2), iceMat)
    block.position.set(16 + i * 3.2, 0.32 + h / 2, -2 + (i % 2) * 3)
    block.castShadow = true
    iceMarket.add(block)
  }
  const iceArch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 8, 18, Math.PI), iceMat)
  iceArch.position.set(16 + 5 * 3.2 - 2, 0.32, 2)
  iceMarket.add(iceArch)
  g.add(iceMarket)
  ctx.registerInteractive(iceMarket, {
    encounterId: 'lamps',
    focusPoint: new THREE.Vector3(20, 3.4, 0),
    onClick: () => {
      iceMat.emissiveIntensity = 1.35
      lamps.forEach((l) => {
        l.bulbMat.emissiveIntensity = 2.0
      })
      ctx.discoverEncounter('lamps')
      return { label: '冰灯一盏盏亮透，雪地上长出一排小月亮', sfx: 'lamp' as const }
    },
  })

  // 极光天幕（北天上空）
  const auroraUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.1 },
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
        p.z += sin(p.x * 1.4 + uTime * 1.6) * 1.4;
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
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(200, 66, 30, 8), auroraMat)
  aurora.position.set(0, 66, -120)
  g.add(aurora)
  const auroraWisp = new THREE.Mesh(new THREE.PlaneGeometry(120, 40, 20, 6), auroraMat)
  auroraWisp.position.set(-30, 44, -150)
  auroraWisp.scale.setScalar(0.9)
  g.add(auroraWisp)
  ctx.registerInteractive(auroraWisp, {
    encounterId: 'aurora',
    focusPoint: new THREE.Vector3(-30, 44, -150),
    onClick: () => {
      auroraUniforms.uOpacity.value = 0.62
      ctx.discoverEncounter('aurora')
      return { label: '柔绿极光缓缓垂落，雪原安静得像被天空抱住', sfx: 'star' as const }
    },
  })

  // 冰湖公园（教堂后西北）：椭圆形冰湖 + 滑冰人 + 环湖串灯
  const pond = new THREE.Group()
  pond.name = 'skating-pond'
  pond.position.set(-30, 0.33, -32)
  const pondIce = new THREE.Mesh(
    new THREE.CircleGeometry(11, 30),
    createMat('#cfeaf6', { emissive: '#4f9cc8', emissiveIntensity: 0.35, roughness: 0.16, metalness: 0.1 }),
  )
  pondIce.rotation.x = -Math.PI / 2
  pondIce.scale.set(1.35, 1, 1)
  pond.add(pondIce)
  const skateStreakMat = createMat('#eaf6ff', { emissive: '#8fd4f0', emissiveIntensity: 0.55, roughness: 0.3 })
  for (let s = 0; s < 5; s += 1) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4 + s * 1.4, 0.05, 5, 30, Math.PI * 0.9), skateStreakMat)
    arc.rotation.x = -Math.PI / 2
    arc.rotation.z = s * 1.3
    pond.add(arc)
  }
  const pondStringMats: THREE.MeshBasicMaterial[] = []
  for (let s = 0; s < 14; s += 1) {
    const a = (s / 14) * Math.PI * 2
    const bulbMat = new THREE.MeshBasicMaterial({
      color: '#ffd88c',
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), bulbMat)
    bulb.position.set(Math.cos(a) * 13.5, 1.6 + Math.sin(a * 3) * 0.3, Math.sin(a) * 10.5)
    pond.add(bulb)
    pondStringMats.push(bulbMat)
  }
  const skaters: { person: THREE.Group; radius: number; speed: number; phase: number }[] = []
  for (let i = 0; i < 2; i += 1) {
    const skater = new THREE.Group()
    const bodyMat = createMat(i === 0 ? '#26334c' : '#3c2a3e', { roughness: 0.8 })
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.15, 8), bodyMat)
    torso.position.y = 1.0
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), createMat('#d8b49a', { roughness: 0.7 }))
    head.position.y = 1.85
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), createMat(i === 0 ? '#c94a40' : '#3e5a8c', { roughness: 0.7 }))
    hat.position.y = 2.0
    skater.add(torso, head, hat)
    pond.add(skater)
    skaters.push({ person: skater, radius: 3.4 + i * 2.2, speed: 0.7 + i * 0.24, phase: i * 2.4 })
  }
  g.add(pond)
  ctx.registerInteractive(pond, {
    encounterId: 'skating',
    focusPoint: new THREE.Vector3(-30, 1.2, -32),
    onClick: () => {
      skateStreakMat.emissiveIntensity = 1.3
      pondIce.material.emissiveIntensity = 0.75
      pondStringMats.forEach((m) => {
        m.opacity = 0.95
      })
      skaters.forEach((s) => {
        s.speed = Math.max(s.speed, 1.9)
      })
      ctx.discoverEncounter('skating')
      return { label: '冰刀划出银色圆弧，笑声把零下七度焐得很暖', sfx: 'snow' }
    },
  })

  // 雪松与雪堆（街道与广场点缀）
  const pineMat = createMat('#26402e', { roughness: 0.95, flatShading: true })
  for (const [px, pz, ps] of [
    [-26, 26, 1.2],
    [26, 26, 1.35],
    [-38, -6, 1.4],
    [38, -2, 1.2],
    [-30, 12, 1.1],
    [30, 14, 1.3],
    [-44, 30, 1.2],
    [44, 32, 1.15],
  ] as [number, number, number][]) {
    const pine = new THREE.Group()
    pine.position.set(px, 0.3, pz)
    for (let tier = 0; tier < 3; tier += 1) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((1.6 - tier * 0.4) * ps, 1.8 * ps, 7), pineMat)
      cone.position.y = (1.2 + tier * 1.2) * ps
      const snowRing = new THREE.Mesh(new THREE.ConeGeometry((1.6 - tier * 0.4) * ps * 0.9, 0.4 * ps, 7), snowMat)
      snowRing.position.y = (1.2 + tier * 1.2 + 0.72) * ps
      pine.add(cone, snowRing)
    }
    g.add(pine)
  }

  // 年轮星晕（圆环光圈）
  const haloTex = buildStarHaloTexture()
  ctx.addDisposeHook?.(() => haloTex.dispose())
  const starHalos = buildStarHalos(g, haloTex, ctx.textures.glowHalo, [
    { pos: [-56, 58, -128], scale: 11, rings: 2, color: '#e4ecfa' },
    { pos: [40, 64, -122], scale: 12, rings: 3, color: '#e8f0fc' },
    { pos: [70, 46, -118], scale: 9.5, rings: 2, color: '#e0e8f6' },
    { pos: [-74, 44, -120], scale: 9, rings: 2, color: '#e4f0fa' },
  ])

  // 觉醒终局：极光全面点亮 + 钟声雪鸽 + 冰灯全亮
  ctx.setFinaleTrigger(() => {
    auroraUniforms.uOpacity.value = 0.72
    doveGrp.visible = true
    iceMat.emissiveIntensity = 1.35
    lamps.forEach((l) => {
      l.bulbMat.emissiveIntensity = 2.0
    })
    winMat.emissiveIntensity = 1.3
  })

  let currentNightFactor = 0.92
  ctx.addTimeHook?.((_hour, nightFactor) => {
    currentNightFactor = nightFactor
  })
  ctx.addMoodHook((mood) => {
    currentNightFactor = mood === 'night' ? 0.92 : mood === 'dusk' ? 0.5 : 0.16
  })

  ctx.addTick((t, dt) => {
    auroraUniforms.uTime.value = t
    starHalos.update(t, dt, currentNightFactor)
    if (doveGrp.visible) {
      doves.forEach((d, idx) => {
        const a = t * 1.15 + (idx / doves.length) * Math.PI * 2
        d.position.set(Math.cos(a) * 12, 26 + Math.sin(t * 2 + idx) * 1.6, -10 + Math.sin(a) * 10)
        d.rotation.y = -a
      })
    }
    skaters.forEach((s) => {
      const a = t * s.speed + s.phase
      s.person.position.set(Math.cos(a) * s.radius, 0.36, Math.sin(a) * s.radius * 0.76)
      s.person.rotation.y = -a + Math.PI / 2
      s.person.position.y = 0.36 + Math.abs(Math.sin(a * 3)) * 0.06
    })
  })

  // 漫步地形采样器：广场全境 + 四向街道 + 冰湖公园 + 街区间隙
  ctx.setWalkHeightSampler?.((x, z) => {
    if (Math.abs(x) <= 22 && Math.abs(z) <= 22) return 0.32
    if (Math.abs(x) <= 4.5 && Math.abs(z) <= 58) return 0.32
    if (Math.abs(z) <= 4.5 && Math.abs(x) <= 58) return 0.32
    if (x >= -44 && x <= -16 && z >= -45 && z <= -19) return 0.3
    if (Math.abs(x) >= 22 && Math.abs(x) <= 36 && Math.abs(z) <= 40) return 0.3
    return null
  })

  enableShadows(g, true, true)
}

export { buildGeorgia } from './cities/georgia'
