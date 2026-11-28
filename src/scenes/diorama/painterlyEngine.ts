import * as THREE from 'three'

export interface PainterlyTextures {
  brushStrokeTex: THREE.CanvasTexture
  starburstTex: THREE.CanvasTexture
  sandbarImpastoTex: THREE.CanvasTexture
  dispose: () => void
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement | undefined, CanvasRenderingContext2D | null] {
  if (typeof document === 'undefined') return [undefined, null]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return [canvas, canvas.getContext('2d')]
}

/**
 * 程序化生成 3D 厚涂油画纹理集（笔触刷痕 / 放射状星芒 / 河岸厚涂沙洲）
 */
export function createPainterlyTextures(): PainterlyTextures {
  // 1. 笔触刷痕纹理 (256x64)：带 28 条刷毛纤维、中间厚实两端羽化
  const [bCanvas, bCtx] = makeCanvas(256, 64)
  if (bCtx) {
    bCtx.clearRect(0, 0, 256, 64)
    let seed = 48271
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    // 底层浓厚油画笔腹
    const baseGrad = bCtx.createRadialGradient(128, 32, 12, 128, 32, 126)
    baseGrad.addColorStop(0, 'rgba(255,255,255,0.98)')
    baseGrad.addColorStop(0.62, 'rgba(248,250,255,0.86)')
    baseGrad.addColorStop(1, 'rgba(255,255,255,0)')
    bCtx.save()
    bCtx.translate(128, 32)
    bCtx.scale(1, 0.32)
    bCtx.fillStyle = baseGrad
    bCtx.beginPath()
    bCtx.arc(0, 0, 126, 0, Math.PI * 2)
    bCtx.fill()
    bCtx.restore()

    // 34 条浓厚刷毛纤维与厚涂高光棱
    for (let i = 0; i < 34; i += 1) {
      const y = 8 + (i / 33) * 48 + (rand() - 0.5) * 3.2
      const xStart = 6 + rand() * 28
      const xEnd = 250 - rand() * 28
      const thickness = 1.3 + rand() * 2.8
      const alpha = 0.45 + rand() * 0.5
      const bright = 220 + Math.floor(rand() * 35)
      bCtx.strokeStyle = `rgba(${bright},${bright},${Math.min(255, bright + 6)},${alpha.toFixed(2)})`
      bCtx.lineWidth = thickness
      bCtx.lineCap = 'round'
      bCtx.beginPath()
      bCtx.moveTo(xStart, y)
      const midY = y + (rand() - 0.5) * 4.5
      bCtx.quadraticCurveTo(128, midY, xEnd, y + (rand() - 0.5) * 2.5)
      bCtx.stroke()
    }
  }
  const brushStrokeTex = new THREE.CanvasTexture(bCanvas)
  brushStrokeTex.colorSpace = THREE.SRGBColorSpace
  brushStrokeTex.needsUpdate = true

  // 2. 梵高放射状星芒纹理 (256x256)：暖白核心 + 24 条尖锐油画放射光线 + 点彩光晕
  const [sCanvas, sCtx] = makeCanvas(256, 256)
  if (sCtx) {
    sCtx.clearRect(0, 0, 256, 256)
    const cx = 128
    const cy = 128
    let seed = 19381
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    const outerGlow = sCtx.createRadialGradient(cx, cy, 2, cx, cy, 118)
    outerGlow.addColorStop(0, 'rgba(255, 254, 244, 0.98)')
    outerGlow.addColorStop(0.11, 'rgba(255, 246, 198, 0.72)')
    outerGlow.addColorStop(0.28, 'rgba(206, 242, 198, 0.24)')
    outerGlow.addColorStop(0.62, 'rgba(130, 206, 224, 0.08)')
    outerGlow.addColorStop(1, 'rgba(90, 165, 225, 0)')
    sCtx.fillStyle = outerGlow
    sCtx.fillRect(0, 0, 256, 256)

    // 28 条尖锐油画放射光线
    for (let i = 0; i < 28; i += 1) {
      const ang = (i / 28) * Math.PI * 2 + (rand() - 0.5) * 0.1
      const len = 58 + rand() * 60
      const width = 1.6 + rand() * 2.8
      const grad = sCtx.createLinearGradient(
        cx,
        cy,
        cx + Math.cos(ang) * len,
        cy + Math.sin(ang) * len,
      )
      grad.addColorStop(0, 'rgba(255, 252, 228, 0.96)')
      grad.addColorStop(0.42, 'rgba(232, 248, 196, 0.65)')
      grad.addColorStop(1, 'rgba(165, 225, 222, 0)')
      sCtx.strokeStyle = grad
      sCtx.lineWidth = width
      sCtx.lineCap = 'round'
      sCtx.beginPath()
      sCtx.moveTo(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6)
      sCtx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len)
      sCtx.stroke()
    }

    // 梵高同心点彩光环（黄绿与青白点彩笔触）
    for (let p = 0; p < 48; p += 1) {
      const ang = (p / 48) * Math.PI * 2 + (rand() - 0.5) * 0.18
      const dist = 28 + (p % 3) * 18 + rand() * 14
      const px = cx + Math.cos(ang) * dist
      const py = cy + Math.sin(ang) * dist
      sCtx.save()
      sCtx.translate(px, py)
      sCtx.rotate(ang + Math.PI / 2)
      sCtx.fillStyle = p % 2 === 0 ? 'rgba(244, 250, 206, 0.62)' : 'rgba(176, 232, 228, 0.48)'
      sCtx.beginPath()
      sCtx.ellipse(0, 0, 4.2 + rand() * 3.5, 1.8 + rand() * 1.4, 0, 0, Math.PI * 2)
      sCtx.fill()
      sCtx.restore()
    }
  }
  const starburstTex = new THREE.CanvasTexture(sCanvas)
  starburstTex.colorSpace = THREE.SRGBColorSpace
  starburstTex.needsUpdate = true

  // 3. 河岸厚涂沙洲纹理 (512x512)：奶油赭石、鼠尾草绿、暖沙与钴蓝暗部色块
  const [mCanvas, mCtx] = makeCanvas(512, 512)
  if (mCtx) {
    mCtx.fillStyle = '#9aa884'
    mCtx.fillRect(0, 0, 512, 512)
    const palette = [
      '#d8d3a8',
      '#c5c294',
      '#8fa488',
      '#6d857c',
      '#e2dcba',
      '#7f8e6e',
      '#465e78',
      '#b9aa78',
    ]
    let seed = 8191
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < 620; i += 1) {
      const x = rand() * 512
      const y = rand() * 512
      const w = 18 + rand() * 44
      const h = 5 + rand() * 11
      const ang = (rand() - 0.5) * 0.55
      mCtx.save()
      mCtx.translate(x, y)
      mCtx.rotate(ang)
      mCtx.fillStyle = palette[Math.floor(rand() * palette.length)]
      mCtx.globalAlpha = 0.45 + rand() * 0.45
      mCtx.beginPath()
      mCtx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2)
      mCtx.fill()
      mCtx.restore()
    }
    mCtx.globalAlpha = 1
  }
  const sandbarImpastoTex = new THREE.CanvasTexture(mCanvas)
  sandbarImpastoTex.colorSpace = THREE.SRGBColorSpace
  sandbarImpastoTex.wrapS = THREE.RepeatWrapping
  sandbarImpastoTex.wrapT = THREE.RepeatWrapping
  sandbarImpastoTex.needsUpdate = true

  return {
    brushStrokeTex,
    starburstTex,
    sandbarImpastoTex,
    dispose: () => {
      brushStrokeTex.dispose()
      starburstTex.dispose()
      sandbarImpastoTex.dispose()
    },
  }
}

export interface PainterlySkyLayerHandle {
  group: THREE.Group
  instancedMesh: THREE.InstancedMesh
  update: (elapsed: number, dt: number, swirlBoost: number) => void
  setPalette: (nightFactor: number, hour: number) => void
}

const dummy0 = new THREE.Object3D()

export interface FlowFieldSkyHandle {
  group: THREE.Group
  instancedMesh: THREE.InstancedMesh
  update: (elapsed: number, dt: number, swirlBoost: number) => void
  setNightFactor: (nightFactor: number) => void
}

export interface FlowFieldSkyOptions {
  /** 笔触数量（默认 1600） */
  count?: number
  /** 漩涡中心（本地坐标，笔触绕其做差速公转） */
  swirlCenters?: [number, number, number][]
  /** 笔触色板（越靠前越深） */
  palette?: (string | THREE.Color)[]
  /** 亮色高光笔触占比（默认 0.09，取色板最后一个颜色） */
  highlightRatio?: number
  /** 天穹半径（默认 100） */
  radius?: number
  /** 前方（-z 画框方向）笔触聚集比例 0~1（默认 0.68） */
  frontBias?: number
  /** 差速公转基础角速度（默认 0.05） */
  flowSpeed?: number
}

/**
 * 流场油画天穹 v2：天空每一笔都沿同一组漩涡流场差速公转，
 * 漩涡中心可配置（大漩涡与它的双生涡），星夜时笔触发光、白昼时淡出。
 */
export function buildFlowFieldSky(
  parent: THREE.Object3D,
  brushTex: THREE.CanvasTexture,
  options: FlowFieldSkyOptions = {},
): FlowFieldSkyHandle {
  const group = new THREE.Group()
  group.name = 'flow-field-sky'

  const COUNT = options.count ?? 1600
  const RADIUS = options.radius ?? 100
  const FRONT_BIAS = options.frontBias ?? 0.68
  const FLOW_SPEED = options.flowSpeed ?? 0.05
  const swirlCenters = (options.swirlCenters ?? [
    [-16, 36, -92],
    [10, 42, -88],
    [30, 28, -84],
  ]).map((c) => new THREE.Vector3(...c))
  const palette = (options.palette ?? [
    '#061c4f',
    '#0b2d74',
    '#13429c',
    '#1f5bbf',
    '#3b7dd4',
    '#8cc2e6',
  ]).map((c) => new THREE.Color(c))
  const highlightRatio = options.highlightRatio ?? 0.09

  const geo = new THREE.PlaneGeometry(9.8, 2.3)
  const mat = new THREE.MeshBasicMaterial({
    map: brushTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  })
  const instancedMesh = new THREE.InstancedMesh(geo, mat, COUNT)
  instancedMesh.frustumCulled = false

  // 每片笔触绕最近漩涡中心的极坐标轨道参数
  const centerPos: THREE.Vector3[] = []
  const tangentU: THREE.Vector3[] = []
  const radialV: THREE.Vector3[] = []
  const orbitRadius = new Float32Array(COUNT)
  const orbitAngle = new Float32Array(COUNT)
  const orbitSpeed = new Float32Array(COUNT)
  const baseScale = new Float32Array(COUNT * 2)
  const bobPhase = new Float32Array(COUNT)
  const bobAmp = new Float32Array(COUNT)

  let seed = 31337
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const toCenter = new THREE.Vector3()
  const inPlane = new THREE.Vector3()
  const tangent = new THREE.Vector3()

  for (let i = 0; i < COUNT; i += 1) {
    const theta = i < COUNT * FRONT_BIAS ? (rand() - 0.5) * Math.PI * 1.3 : rand() * Math.PI * 2
    const elev = 0.02 + Math.pow(rand(), 0.76) * 0.84
    const radius = RADIUS * (0.92 + rand() * 0.18)
    const horiz = Math.cos(elev * Math.PI * 0.5) * radius
    const px = Math.sin(theta) * horiz
    const py = Math.sin(elev * Math.PI * 0.5) * radius + 2
    const pz = -Math.cos(theta) * horiz

    // 最近漩涡中心 → 在垂直于「中心→笔触」轴的平面内建立公转轨道
    let nearest = swirlCenters[0]
    let minDist = Infinity
    for (const c of swirlCenters) {
      const d = (px - c.x) ** 2 + (py - c.y) ** 2 + (pz - c.z) ** 2
      if (d < minDist) {
        minDist = d
        nearest = c
      }
    }
    toCenter.set(px - nearest.x, py - nearest.y, pz - nearest.z)
    inPlane.set(px, py, pz).normalize()
    tangent.crossVectors(inPlane, toCenter)
    if (tangent.lengthSq() < 0.001) tangent.set(1, 0.18, 0)
    tangent.normalize()
    const radial = new THREE.Vector3().crossVectors(tangent, inPlane).normalize()

    centerPos.push(nearest)
    tangentU.push(tangent.clone())
    radialV.push(radial)
    orbitRadius[i] = Math.sqrt(minDist)
    orbitAngle[i] = rand() * Math.PI * 2
    // 靠近漩涡中心转得更快：差速旋转让星流像真实涡旋
    orbitSpeed[i] = (0.42 + 1.25 / (1 + orbitRadius[i] * 0.022)) * (0.8 + rand() * 0.5)
    baseScale[i * 2] = 0.78 + rand() * 1.18
    baseScale[i * 2 + 1] = 0.72 + rand() * 0.92
    bobPhase[i] = rand() * Math.PI * 2
    bobAmp[i] = 0.35 + rand() * 0.75

    dummy0.position.set(px, py, pz)
    dummy0.lookAt(0, 8, 0)
    dummy0.rotateZ(Math.atan2(tangent.y, tangent.x) * 0.55 + (rand() - 0.5) * 0.32)
    dummy0.scale.set(baseScale[i * 2], baseScale[i * 2 + 1], 1)
    dummy0.updateMatrix()
    instancedMesh.setMatrixAt(i, dummy0.matrix)

    const isHighlight = rand() < highlightRatio
    const colIdx = isHighlight
      ? palette.length - 1
      : Math.min(palette.length - 2, Math.floor(rand() * (palette.length - 1)))
    instancedMesh.setColorAt(i, palette[colIdx])
  }
  instancedMesh.instanceMatrix.needsUpdate = true
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true

  group.add(instancedMesh)
  parent.add(group)

  const nightTint = new THREE.Color('#ffffff')
  const dayTint = new THREE.Color('#ffe0c0')
  const workColor = new THREE.Color()
  const tmpPos = new THREE.Vector3()
  let swirlAngle = 0
  let nightFactor = 0.95

  return {
    group,
    instancedMesh,
    update: (elapsed, dt, swirlBoost) => {
      swirlAngle += dt * FLOW_SPEED * (1 + swirlBoost * 5.5)
      for (let i = 0; i < COUNT; i += 1) {
        const a = orbitAngle[i] + swirlAngle * orbitSpeed[i]
        const r = orbitRadius[i]
        const c = centerPos[i]
        const u = tangentU[i]
        const v = radialV[i]
        const bob = Math.sin(elapsed * 0.4 + bobPhase[i]) * bobAmp[i]
        tmpPos.set(
          c.x + v.x * Math.cos(a) * r + u.x * Math.sin(a) * r,
          c.y + v.y * Math.cos(a) * r + u.y * Math.sin(a) * r + bob,
          c.z + v.z * Math.cos(a) * r + u.z * Math.sin(a) * r,
        )
        dummy0.position.copy(tmpPos)
        dummy0.lookAt(0, 8, 0)
        dummy0.rotateZ(Math.sin(elapsed * 0.3 + bobPhase[i]) * 0.16)
        dummy0.scale.set(baseScale[i * 2], baseScale[i * 2 + 1], 1)
        dummy0.updateMatrix()
        instancedMesh.setMatrixAt(i, dummy0.matrix)
      }
      instancedMesh.instanceMatrix.needsUpdate = true
    },
    setNightFactor: (nf) => {
      nightFactor = THREE.MathUtils.clamp(nf, 0, 1)
      workColor.copy(dayTint).lerp(nightTint, nightFactor)
      mat.color.copy(workColor)
      const dayFade = THREE.MathUtils.smoothstep(nightFactor, 0, 0.25)
      mat.opacity = THREE.MathUtils.lerp(0.07, 0.34, dayFade) + nightFactor * 0.58
    },
  }
}

/** 梵高「年轮」星晕纹理：同心环状厚涂笔刷光圈 */
export function buildStarHaloTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256)
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256)
    let seed = 4241
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    const cx = 128
    const cy = 128
    // 4 圈同心「年轮」，每圈由点彩短弧拼成
    for (let ring = 0; ring < 4; ring += 1) {
      const r = 26 + ring * 24
      const segments = 22 + ring * 7
      for (let s = 0; s < segments; s += 1) {
        const ang = (s / segments) * Math.PI * 2 + rand() * 0.22
        const len = 7 + rand() * 9
        const w = 2.1 + rand() * 2.2
        const alpha = (0.34 - ring * 0.055) * (0.7 + rand() * 0.6)
        const x0 = cx + Math.cos(ang) * (r - len * 0.5)
        const y0 = cy + Math.sin(ang) * (r - len * 0.5)
        const x1 = cx + Math.cos(ang) * (r + len * 0.5)
        const y1 = cy + Math.sin(ang) * (r + len * 0.5)
        ctx.strokeStyle =
          ring % 2 === 0
            ? `rgba(255, 246, 208, ${alpha.toFixed(3)})`
            : `rgba(196, 236, 226, ${alpha.toFixed(3)})`
        ctx.lineWidth = w
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }
    }
    const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, 30)
    core.addColorStop(0, 'rgba(255, 254, 244, 0.9)')
    core.addColorStop(0.5, 'rgba(255, 246, 205, 0.4)')
    core.addColorStop(1, 'rgba(255, 246, 205, 0)')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export interface StarHalosHandle {
  group: THREE.Group
  update: (elapsed: number, dt: number, nightFactor: number) => void
}

export interface StarHaloSpec {
  pos: [number, number, number]
  scale?: number
  rings?: number
  color?: string
}

/**
 * 「年轮」星晕：每颗亮星由 2-3 层缓慢反向旋转的同心环笔刷光圈 + 核心光点组成，
 * 如年轮层层晕开（对标参考馆「星晕层层如年轮」）。
 */
export function buildStarHalos(
  parent: THREE.Object3D,
  haloTex: THREE.CanvasTexture,
  glowTex: THREE.Texture,
  specs: StarHaloSpec[],
): StarHalosHandle {
  const group = new THREE.Group()
  group.name = 'star-halos'
  interface HaloRing {
    mesh: THREE.Mesh
    mat: THREE.MeshBasicMaterial
    speed: number
    baseScale: number
    phase: number
  }
  const rings: HaloRing[] = []
  const cores: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; base: number; phase: number }[] = []

  for (const spec of specs) {
    const scale = spec.scale ?? 7
    const ringCount = spec.rings ?? 2
    for (let r = 0; r < ringCount; r += 1) {
      const s = scale * (0.62 + r * 0.42)
      const mat = new THREE.MeshBasicMaterial({
        map: haloTex,
        color: spec.color ?? '#f4ecd0',
        transparent: true,
        opacity: 0.5 - r * 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2])
      mesh.scale.set(s, s, 1)
      mesh.rotation.z = r * 1.3 + spec.pos[0] * 0.13
      group.add(mesh)
      rings.push({
        mesh,
        mat,
        speed: (r % 2 === 0 ? 1 : -1) * (0.16 + r * 0.07),
        baseScale: s,
        phase: spec.pos[0] * 0.21 + r * 2.1,
      })
    }
    const coreMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#fffbe8',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const core = new THREE.Sprite(coreMat)
    core.position.set(spec.pos[0], spec.pos[1], spec.pos[2])
    core.scale.set(scale * 0.3, scale * 0.3, 1)
    group.add(core)
    cores.push({ sprite: core, mat: coreMat, base: scale * 0.3, phase: spec.pos[1] * 0.17 })
  }

  parent.add(group)

  return {
    group,
    update: (elapsed, _dt, nightFactor) => {
      const vis = THREE.MathUtils.clamp((nightFactor - 0.1) / 0.6, 0, 1)
      group.visible = vis > 0.02
      if (!group.visible) return
      for (const r of rings) {
        r.mesh.rotation.z += r.speed * 0.016
        const pulse = 1 + Math.sin(elapsed * 0.8 + r.phase) * 0.045
        r.mesh.scale.set(r.baseScale * pulse, r.baseScale * pulse, 1)
        r.mat.opacity = (0.5 - (r.baseScale / 40) * 0.4) * 0.5 * vis + 0.12 * vis
      }
      for (const c of cores) {
        const tw = 0.9 + Math.sin(elapsed * 2.1 + c.phase) * 0.1
        c.sprite.scale.set(c.base * tw, c.base * tw, 1)
        c.mat.opacity = 0.92 * vis
      }
    },
  }
}

/**
 * 3D 旋涡厚涂油画天穹层：660 片绕北斗与亮星缓缓旋流的实体油画笔触
 */
export function buildPainterlySkyLayer(
  parent: THREE.Object3D,
  brushTex: THREE.CanvasTexture,
): PainterlySkyLayerHandle {
  const group = new THREE.Group()
  group.name = 'painterly-sky-strokes'

  const COUNT = 1500
  const geo = new THREE.PlaneGeometry(9.6, 2.35)
  const mat = new THREE.MeshBasicMaterial({
    map: brushTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  })
  const instancedMesh = new THREE.InstancedMesh(geo, mat, COUNT)
  instancedMesh.frustumCulled = false

  const basePos = new Float32Array(COUNT * 3)
  const baseScale = new Float32Array(COUNT * 2)
  const swirlPhase = new Float32Array(COUNT)
  const swirlAxis = new Float32Array(COUNT * 3)

  const nightPalette = [
    new THREE.Color('#061c4f'),
    new THREE.Color('#0b2d74'),
    new THREE.Color('#13429c'),
    new THREE.Color('#1f5bbf'),
    new THREE.Color('#3b7dd4'),
    new THREE.Color('#8cc2e6'),
  ]

  let seed = 7331
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const dummy = new THREE.Object3D()
  const swirlCenters = [
    new THREE.Vector3(-18, 34, -90),
    new THREE.Vector3(6, 40, -92),
    new THREE.Vector3(28, 30, -86),
    new THREE.Vector3(-42, 28, -82),
  ]

  for (let i = 0; i < COUNT; i += 1) {
    // 主画框正前方密集铺满 1050 片旋涡笔触，其余覆盖完整上半球
    const theta =
      i < 1050
        ? (rand() - 0.5) * Math.PI * 1.24
        : rand() * Math.PI * 2
    const elev = 0.03 + Math.pow(rand(), 0.78) * 0.82
    const radius = 96 + rand() * 32
    const horiz = Math.cos(elev * Math.PI * 0.5) * radius
    const px = Math.sin(theta) * horiz
    const py = Math.sin(elev * Math.PI * 0.5) * radius + 2
    const pz = -Math.cos(theta) * horiz

    basePos[i * 3] = px
    basePos[i * 3 + 1] = py
    basePos[i * 3 + 2] = pz
    baseScale[i * 2] = 0.75 + rand() * 1.15
    baseScale[i * 2 + 1] = 0.75 + rand() * 0.9
    swirlPhase[i] = rand() * Math.PI * 2

    // 找最近的旋涡中心，沿切线方向排列笔触
    let nearest = swirlCenters[0]
    let minDist = Infinity
    for (const c of swirlCenters) {
      const d = (px - c.x) ** 2 + (py - c.y) ** 2 + (pz - c.z) ** 2
      if (d < minDist) {
        minDist = d
        nearest = c
      }
    }
    const radial = new THREE.Vector3(px, py, pz).normalize()
    const toCenter = new THREE.Vector3(px - nearest.x, py - nearest.y, pz - nearest.z)
    const tangent = new THREE.Vector3().crossVectors(radial, toCenter)
    if (tangent.lengthSq() < 0.001) tangent.set(1, 0.2, 0)
    tangent.normalize()

    swirlAxis[i * 3] = tangent.x
    swirlAxis[i * 3 + 1] = tangent.y
    swirlAxis[i * 3 + 2] = tangent.z

    dummy.position.set(px, py, pz)
    dummy.lookAt(0, 8, 0)
    const roll = Math.atan2(tangent.y, tangent.x)
    dummy.rotateZ(roll * 0.55 + (rand() - 0.5) * 0.35)
    dummy.scale.set(baseScale[i * 2], baseScale[i * 2 + 1], 1)
    dummy.updateMatrix()
    instancedMesh.setMatrixAt(i, dummy.matrix)

    const colIdx =
      rand() > 0.91
        ? 5
        : Math.min(4, Math.floor(rand() * 5))
    instancedMesh.setColorAt(i, nightPalette[colIdx])
  }
  instancedMesh.instanceMatrix.needsUpdate = true
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true

  group.add(instancedMesh)
  parent.add(group)

  const nightTint = new THREE.Color('#ffffff')
  const duskTint = new THREE.Color('#ffd4b4')
  const dawnTint = new THREE.Color('#f4d2e8')
  const workColor = new THREE.Color()

  let swirlAngle = 0

  return {
    group,
    instancedMesh,
    update: (elapsed, dt, swirlBoost) => {
      const speed = 0.045 + swirlBoost * 0.28
      swirlAngle += dt * speed
      for (let i = 0; i < COUNT; i += 1) {
        const px = basePos[i * 3]
        const py = basePos[i * 3 + 1]
        const pz = basePos[i * 3 + 2]
        const ph = swirlPhase[i] + swirlAngle
        const drift = Math.sin(ph) * (0.65 + swirlBoost * 1.4)
        dummy.position.set(
          px + swirlAxis[i * 3] * drift,
          py + swirlAxis[i * 3 + 1] * drift,
          pz + swirlAxis[i * 3 + 2] * drift,
        )
        dummy.lookAt(0, 8, 0)
        dummy.rotateZ(Math.sin(elapsed * 0.3 + ph) * 0.18)
        dummy.scale.set(baseScale[i * 2], baseScale[i * 2 + 1], 1)
        dummy.updateMatrix()
        instancedMesh.setMatrixAt(i, dummy.matrix)
      }
      instancedMesh.instanceMatrix.needsUpdate = true
    },
    setPalette: (nightFactor, hour) => {
      const isDawn = hour < 12.0
      const targetDay = isDawn ? dawnTint : duskTint
      const nf = THREE.MathUtils.clamp(nightFactor, 0, 1)
      workColor.copy(targetDay).lerp(nightTint, nf)
      mat.color.copy(workColor)
      // Fade brushstrokes cleanly toward 0.08 in bright morning/day (nightFactor < 0.25)
      const dayFade = THREE.MathUtils.smoothstep(nf, 0, 0.25)
      mat.opacity = THREE.MathUtils.lerp(0.08, 0.36, dayFade) + nf * 0.56
    },
  }
}

export interface StarryConstellationHandle {
  group: THREE.Group
  bigDipperStars: THREE.Vector3[]
  triggerBigDipper: () => void
  update: (elapsed: number, dt: number, nightFactor: number) => void
  getSwirlBoost: () => number
}

/**
 * 北斗七星放射星芒 + 发光星座连线 + 流星划过（对标《罗纳河上的星夜》天穹核心）
 */
export function buildStarryConstellation(
  parent: THREE.Object3D,
  starburstTex: THREE.CanvasTexture,
  glowTex: THREE.Texture,
): StarryConstellationHandle {
  const group = new THREE.Group()
  group.name = 'starry-constellation'

  // 北斗七星空间坐标（位于主画框左上方至中上方）
  const bigDipperStars = [
    new THREE.Vector3(-34, 41, -92), // 斗柄末端 摇光
    new THREE.Vector3(-25, 39, -91), // 开阳
    new THREE.Vector3(-17, 36, -90), // 玉衡
    new THREE.Vector3(-10, 32, -89), // 天权
    new THREE.Vector3(-11, 25, -88), // 斗魁 天玑
    new THREE.Vector3(-1, 24, -88), // 天璇
    new THREE.Vector3(2, 31, -89), // 天枢
  ]

  interface StarVisual {
    core: THREE.Sprite
    rays: THREE.Sprite
    baseScale: number
    phase: number
    isDipper: boolean
    dipperIdx: number
  }
  const stars: StarVisual[] = []

  const addStarburst = (
    pos: THREE.Vector3,
    scale: number,
    isDipper: boolean,
    dipperIdx: number,
    phase: number,
  ) => {
    const raysMat = new THREE.SpriteMaterial({
      map: starburstTex,
      color: isDipper ? '#eef9c8' : '#d8f2d8',
      transparent: true,
      opacity: isDipper ? 0.92 : 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const rays = new THREE.Sprite(raysMat)
    rays.position.copy(pos)
    rays.scale.set(scale, scale, 1)

    const coreMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#fffbe2',
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const core = new THREE.Sprite(coreMat)
    core.position.copy(pos)
    core.scale.set(scale * 0.26, scale * 0.26, 1)

    group.add(rays, core)
    stars.push({ core, rays, baseScale: scale, phase, isDipper, dipperIdx })
  }

  bigDipperStars.forEach((pos, idx) => {
    addStarburst(pos, idx === 6 || idx === 3 ? 10.2 : 8.2, true, idx, idx * 0.9)
  })

  // 其余散布天空的 10 颗放射星芒大星
  const extraStarCoords: [number, number, number, number][] = [
    [18, 38, -90, 9.2],
    [32, 33, -88, 10.2],
    [46, 26, -84, 8.2],
    [-46, 31, -85, 8.5],
    [-22, 47, -86, 7.6],
    [10, 46, -85, 7.4],
    [28, 22, -88, 6.8],
    [-38, 22, -88, 6.5],
    [56, 36, -78, 7.8],
    [-58, 38, -76, 7.5],
  ]
  extraStarCoords.forEach(([x, y, z, s], idx) => {
    addStarburst(new THREE.Vector3(x, y, z), s, false, -1, 2.0 + idx * 1.1)
  })

  // 240 颗闪烁背景星点
  const speckCount = 240
  const speckPos = new Float32Array(speckCount * 3)
  let seed = 9973
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < speckCount; i += 1) {
    const theta = i < 160 ? (rand() - 0.5) * Math.PI * 0.9 : rand() * Math.PI * 2
    const elev = 0.08 + rand() * 0.72
    const r = 96 + rand() * 24
    const h = Math.cos(elev * Math.PI * 0.5) * r
    speckPos[i * 3] = Math.sin(theta) * h
    speckPos[i * 3 + 1] = Math.sin(elev * Math.PI * 0.5) * r + 3
    speckPos[i * 3 + 2] = -Math.cos(theta) * h
  }
  const speckGeo = new THREE.BufferGeometry()
  speckGeo.setAttribute('position', new THREE.BufferAttribute(speckPos, 3))
  const speckMat = new THREE.PointsMaterial({
    map: glowTex,
    color: '#eef6ff',
    size: 1.05,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    sizeAttenuation: true,
  })
  const specks = new THREE.Points(speckGeo, speckMat)
  group.add(specks)

  // 6 条北斗七星发光连线（3D 细长发光柱，规避 WebGL 1px lineWidth 限制）
  const linkPairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ]
  const lineBeams: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; fullLen: number; p0: THREE.Vector3; dir: THREE.Vector3 }[] = []
  const upVec = new THREE.Vector3(0, 1, 0)
  for (const [iA, iB] of linkPairs) {
    const p0 = bigDipperStars[iA]
    const p1 = bigDipperStars[iB]
    const diff = new THREE.Vector3().subVectors(p1, p0)
    const len = diff.length()
    const dir = diff.clone().normalize()
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#fff6c6',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 6), beamMat)
    beam.quaternion.setFromUnitVectors(upVec, dir)
    beam.position.copy(p0)
    beam.scale.set(1, 0.001, 1)
    beam.visible = false
    group.add(beam)
    lineBeams.push({ mesh: beam, mat: beamMat, fullLen: len, p0, dir })
  }

  // 2 颗流星
  const meteors: { group: THREE.Group; active: boolean; age: number; start: THREE.Vector3; vel: THREE.Vector3 }[] = []
  for (let m = 0; m < 2; m += 1) {
    const mGroup = new THREE.Group()
    mGroup.visible = false
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#fffbe6',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    head.scale.set(2.4, 2.4, 1)
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.18, 9.5, 6),
      new THREE.MeshBasicMaterial({
        color: '#e8f7c4',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    tail.rotation.z = Math.PI / 2 - 0.36
    tail.position.set(-4.4, 1.6, 0)
    mGroup.add(head, tail)
    group.add(mGroup)
    meteors.push({
      group: mGroup,
      active: false,
      age: 0,
      start: new THREE.Vector3(-28 + m * 36, 46 - m * 4, -84),
      vel: new THREE.Vector3(28, -11, 2),
    })
  }

  parent.add(group)

  let dipperLit = false
  let dipperTimer = 0
  let swirlBoost = 0

  return {
    group,
    bigDipperStars,
    triggerBigDipper: () => {
      dipperLit = true
      dipperTimer = 0
      swirlBoost = 1.0
      meteors.forEach((met, idx) => {
        met.active = true
        met.age = -idx * 0.55
        met.group.visible = false
      })
    },
    getSwirlBoost: () => swirlBoost,
    update: (elapsed, dt, nightFactor) => {
      swirlBoost = Math.max(0, swirlBoost - dt * 0.35)
      if (dipperLit) dipperTimer += dt

      const starVis = THREE.MathUtils.clamp((nightFactor - 0.12) / 0.65, 0, 1)
      group.visible = starVis > 0.01
      if (!group.visible) return

      speckMat.opacity = (0.55 + Math.sin(elapsed * 1.4) * 0.12) * starVis

      for (const s of stars) {
        const pulse = 0.88 + 0.14 * Math.sin(elapsed * 2.1 + s.phase)
        let dipperMult = 1.0
        if (dipperLit && s.isDipper) {
          const reveal = THREE.MathUtils.clamp((dipperTimer - s.dipperIdx * 0.14) / 0.4, 0, 1)
          dipperMult = 1.0 + reveal * 0.45
        }
        const sc = s.baseScale * pulse * dipperMult
        s.rays.scale.set(sc, sc, 1)
        s.rays.material.rotation = elapsed * 0.12 + s.phase
        s.rays.material.opacity = (s.isDipper ? 0.92 : 0.78) * starVis
        s.core.scale.set(sc * 0.26, sc * 0.26, 1)
        s.core.material.opacity = 0.96 * starVis
      }

      if (dipperLit) {
        lineBeams.forEach((b, idx) => {
          const progress = THREE.MathUtils.clamp((dipperTimer - 0.25 - idx * 0.18) / 0.45, 0, 1)
          b.mesh.visible = progress > 0.01 && starVis > 0.05
          if (b.mesh.visible) {
            const curLen = Math.max(0.01, b.fullLen * progress)
            b.mesh.scale.set(1, curLen, 1)
            b.mesh.position.copy(b.p0).addScaledVector(b.dir, curLen * 0.5)
            b.mat.opacity = 0.82 * starVis
          }
        })
      }

      for (const met of meteors) {
        if (!met.active) continue
        met.age += dt
        if (met.age < 0) continue
        if (met.age > 1.45) {
          met.active = false
          met.group.visible = false
          continue
        }
        met.group.visible = true
        met.group.position.copy(met.start).addScaledVector(met.vel, met.age)
      }
    },
  }
}

export interface PainterlyRiverHandle {
  mesh: THREE.Mesh
  strokeInstanced: THREE.InstancedMesh
  uniforms: {
    uTime: { value: number }
    uFogColor: { value: THREE.Color }
    uSunCol: { value: THREE.Color }
    uSunDir: { value: THREE.Vector3 }
    uFadeRadius: { value: number }
    uRipplePos: { value: THREE.Vector2 }
    uRippleAge: { value: number }
    uBio: { value: number }
    uRainIntensity: { value: number }
    uNightFactor: { value: number }
    uLightBoost: { value: number }
    uWaveExcite: { value: number }
    uLightX: { value: number[] }
    uAccentStrength: { value: number }
    uAccentCol: { value: THREE.Color }
    uBandX: { value: number }
    uBandWidth: { value: number }
  }
  triggerRipplePulse: (x: number, z: number) => void
  setLightBoost: (target: number) => void
  setAccentBand: (strength: number) => void
  update: (elapsed: number, dt: number, nightFactor: number) => void
}

export interface PainterlyRiverOptions {
  /** 月光/碎金长路颜色（如满月银路、极光青带），默认关闭 */
  accentBandHex?: string
  /** 长路中心 x 坐标（默认 0） */
  bandX?: number
  /** 长路半宽（默认 7） */
  bandWidth?: number
  /** 初始长路强度 0~1（默认 0） */
  accentStrength?: number
}

/**
 * 3D 油画河面 + 540 片流动厚涂水波笔触 + 20 盏对岸灯火超长横向碎金倒影柱
 * v2：可叠加一条穿过水面的「月光/碎金长路」（accent band）
 */
export function buildPainterlyRiver(
  parent: THREE.Object3D,
  brushTex: THREE.CanvasTexture,
  lightPositionsX: number[],
  options: PainterlyRiverOptions = {},
): PainterlyRiverHandle {
  const paddedLights = Array.from({ length: 20 }, (_, i) => lightPositionsX[i] ?? -999)

  const uniforms = {
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color('#285296') },
    uSunCol: { value: new THREE.Color('#f4e6a8') },
    uSunDir: { value: new THREE.Vector3(-0.04, 0.16, -0.98).normalize() },
    uFadeRadius: { value: 155 },
    uRipplePos: { value: new THREE.Vector2(0, -14) },
    uRippleAge: { value: 99 },
    uBio: { value: 0.25 },
    uRainIntensity: { value: 0 },
    uNightFactor: { value: 0.94 },
    uLightBoost: { value: 0.92 },
    uWaveExcite: { value: 0 },
    uLightX: { value: paddedLights },
    uAccentStrength: { value: options.accentStrength ?? 0 },
    uAccentCol: { value: new THREE.Color(options.accentBandHex ?? '#dfe9ff') },
    uBandX: { value: options.bandX ?? 0 },
    uBandWidth: { value: options.bandWidth ?? 7 },
  }

  const waterMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFogColor;
      uniform vec3 uSunCol;
      uniform vec3 uSunDir;
      uniform float uFadeRadius;
      uniform vec2 uRipplePos;
      uniform float uRippleAge;
      uniform float uBio;
      uniform float uRainIntensity;
      uniform float uNightFactor;
      uniform float uLightBoost;
      uniform float uWaveExcite;
      uniform float uLightX[20];
      uniform float uAccentStrength;
      uniform vec3 uAccentCol;
      uniform float uBandX;
      uniform float uBandWidth;
      varying vec3 vWorld;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 41.23);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise2(p);
          p = p * 2.05 + vec2(13.4, 29.1);
          a *= 0.5;
        }
        return v;
      }

      float rainRipples(vec2 p, float t) {
        float acc = 0.0;
        for (int i = 0; i < 3; i++) {
          vec2 cell = floor(p * (1.2 + float(i) * 0.6));
          vec2 local = fract(p * (1.2 + float(i) * 0.6)) - 0.5;
          float h = hash21(cell + float(i) * 19.7);
          float phase = fract(t * 0.85 + h * 6.28);
          float r = phase * 0.52;
          float d = abs(length(local) - r);
          float ring = smoothstep(0.055, 0.0, d) * (1.0 - phase) * step(0.42, h);
          acc += ring;
        }
        return acc;
      }

      void main() {
        // 横向拉伸的油画水波质感
        vec2 flowUv = vec2(vWorld.x * 0.16 + uTime * 0.12, vWorld.z * 0.42 - uTime * 0.08);
        float wave = fbm(flowUv);
        float rib = sin(vWorld.z * 2.4 + wave * 5.2 + uTime * (1.5 + uWaveExcite * 2.6)) * 0.5 + 0.5;

        // 深普鲁士蓝 -> 深钴蓝 -> 暗碧青油画水色基底（强反差衬托碎金灯柱）
        vec3 nightDeep = vec3(0.02, 0.08, 0.24);
        vec3 nightMid  = vec3(0.05, 0.19, 0.42);
        vec3 nightTeal = vec3(0.08, 0.34, 0.46);
        vec3 dayBase   = mix(vec3(0.16, 0.36, 0.56), uFogColor * 0.88, 0.45);

        vec3 baseCol = mix(nightDeep, nightMid, smoothstep(0.25, 0.72, wave));
        baseCol = mix(baseCol, nightTeal, smoothstep(0.55, 0.92, rib) * 0.36);
        baseCol = mix(dayBase, baseCol, clamp(uNightFactor * 1.15, 0.0, 1.0));

        // 20 盏对岸煤气灯投射的超长横向碎金倒影柱（柱间深蓝分明）
        float bankZ = -62.0;
        float distFromBank = clamp((vWorld.z - bankZ) / 68.0, 0.0, 1.0);
        float colWidthBase = mix(0.55, 1.75, distFromBank);
        float horizonGlow = exp(-max(0.0, vWorld.z - bankZ) * 0.14);

        // 强对比横向撕裂破碎水波条纹
        float shred1 = smoothstep(0.28, 0.78, sin(vWorld.z * 3.4 + wave * 7.8 + uTime * (1.9 + uWaveExcite * 3.2)) * 0.5 + 0.5);
        float shred2 = smoothstep(0.34, 0.88, fbm(vec2(vWorld.x * 0.48, vWorld.z * 1.45 + uTime * 0.45)));
        float shredMask = mix(0.16, 1.28, shred1 * 0.65 + shred2 * 0.35);

        float pillarAcc = 0.0;
        for (int i = 0; i < 20; i++) {
          float lx = uLightX[i];
          float sway = sin(vWorld.z * 0.45 + float(i) * 1.3 + uTime * 1.4) * (0.28 + distFromBank * 0.72);
          float dx = abs(vWorld.x - (lx + sway));
          float w = colWidthBase * (0.85 + 0.25 * sin(float(i) * 2.1));
          float p = pow(exp(-(dx * dx) / (w * w)), 1.35);
          float lenFade = mix(1.0, 0.22, pow(distFromBank, 0.68));
          pillarAcc += p * lenFade;
        }

        float lightStrength = uLightBoost * (0.28 + uNightFactor * 0.96);
        vec3 goldCol = mix(vec3(1.0, 0.72, 0.24), vec3(1.0, 0.96, 0.78), clamp(pillarAcc * 0.65, 0.0, 1.0));
        vec3 col = baseCol;
        col += goldCol * clamp(pillarAcc, 0.0, 2.1) * shredMask * lightStrength;
        col += vec3(1.0, 0.82, 0.48) * horizonGlow * 0.46 * lightStrength;

        // 月光/碎金长路：一条穿过水面的柔光宽带，随水波撕裂流动
        if (uAccentStrength > 0.005) {
          float bandFall = exp(-pow((vWorld.x - uBandX) / max(1.0, uBandWidth), 2.0));
          float bandReach = smoothstep(-84.0, -18.0, vWorld.z) * smoothstep(16.0, 2.0, vWorld.z);
          float bandShred = mix(0.32, 1.15, shred1 * 0.6 + shred2 * 0.4);
          col += uAccentCol * bandFall * bandReach * bandShred * uAccentStrength * (0.3 + uNightFactor * 0.9);
        }

        // 交互点破水面的金色同心涟漪
        if (uRippleAge < 4.5) {
          float rDist = length(vWorld.xz - uRipplePos);
          float rFront = uRippleAge * 7.5;
          float rWave = sin((rDist - rFront) * 2.8) * exp(-abs(rDist - rFront) * 0.45) * exp(-uRippleAge * 0.65);
          col += vec3(1.0, 0.9, 0.55) * max(0.0, rWave) * 0.85;
        }
        if (uWaveExcite > 0.02) {
          float gRing = sin(length(vWorld.xz - vec2(0.0, -14.0)) * 1.4 - uTime * 5.2) * 0.5 + 0.5;
          col += vec3(0.95, 0.88, 0.52) * gRing * uWaveExcite * 0.25;
        }

        // 雨滴波纹
        if (uRainIntensity > 0.01) {
          float rr = rainRipples(vWorld.xz * 0.36, uTime);
          col += vec3(0.68, 0.82, 0.96) * rr * uRainIntensity * 0.55;
        }

        float horizonFade = smoothstep(uFadeRadius * 0.72, uFadeRadius, length(vWorld.xz));
        col = mix(col, uFogColor, horizonFade);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(280, 260, 1, 1), waterMat)
  mesh.name = 'open-horizon-ground'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, 0, -64)
  parent.add(mesh)

  // 440 片近景悬浮 3D 水面厚涂油画笔触片（让中景留给炽金灯柱倒影）
  const STROKE_COUNT = 440
  const strokeGeo = new THREE.PlaneGeometry(3.8, 0.56)
  strokeGeo.rotateX(-Math.PI / 2)
  const strokeMat = new THREE.MeshBasicMaterial({
    map: brushTex,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  })
  const strokeInstanced = new THREE.InstancedMesh(strokeGeo, strokeMat, STROKE_COUNT)
  strokeInstanced.frustumCulled = false

  const sBaseX = new Float32Array(STROKE_COUNT)
  const sBaseZ = new Float32Array(STROKE_COUNT)
  const sBaseY = new Float32Array(STROKE_COUNT)
  const sYaw = new Float32Array(STROKE_COUNT)
  const sScale = new Float32Array(STROKE_COUNT * 2)
  const sPhase = new Float32Array(STROKE_COUNT)

  const waterPalette = [
    new THREE.Color('#0a2868'), // 深普鲁士蓝
    new THREE.Color('#184c96'), // 钴蓝
    new THREE.Color('#166c80'), // 深青蓝
    new THREE.Color('#6aa892'), // 鼠尾草青绿
    new THREE.Color('#ced878'), // 芥末黄绿
    new THREE.Color('#fff0b0'), // 亮奶金碎金笔触
  ]

  let seed = 31991
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const dummy = new THREE.Object3D()

  for (let i = 0; i < STROKE_COUNT; i += 1) {
    // 集中铺满近前景 (z ∈ [-20, +14])，中景留白给 20 根碎金倒影柱
    const u = rand()
    const z = u < 0.78 ? 14 - rand() * 34 : -20 - rand() * 20
    const x = (rand() - 0.5) * (40 + Math.max(0, -z) * 0.85)
    const y = 0.04 + (i % 5) * 0.018
    const yaw = (rand() - 0.5) * 0.34
    const sx = 0.8 + rand() * 1.45
    const sz = 0.75 + rand() * 1.15

    sBaseX[i] = x
    sBaseZ[i] = z
    sBaseY[i] = y
    sYaw[i] = yaw
    sScale[i * 2] = sx
    sScale[i * 2 + 1] = sz
    sPhase[i] = rand() * Math.PI * 2

    dummy.position.set(x, y, z)
    dummy.rotation.set(0, yaw, 0)
    dummy.scale.set(sx, 1, sz)
    dummy.updateMatrix()
    strokeInstanced.setMatrixAt(i, dummy.matrix)

    // 靠近灯柱轨迹的笔触更容易带出亮奶金与黄绿反光
    let nearLight = false
    for (const lx of lightPositionsX) {
      if (Math.abs(x - lx) < 1.8) {
        nearLight = true
        break
      }
    }
    const cIdx =
      nearLight && rand() > 0.42
        ? rand() > 0.45
          ? 5
          : 4
        : Math.floor(rand() * 5)
    strokeInstanced.setColorAt(i, waterPalette[cIdx])
  }
  strokeInstanced.instanceMatrix.needsUpdate = true
  if (strokeInstanced.instanceColor) strokeInstanced.instanceColor.needsUpdate = true
  parent.add(strokeInstanced)

  let targetBoost = 0.92

  return {
    mesh,
    strokeInstanced,
    uniforms,
    triggerRipplePulse: (x, z) => {
      uniforms.uRipplePos.value.set(x, z)
      uniforms.uRippleAge.value = 0
      uniforms.uWaveExcite.value = 1.0
    },
    setLightBoost: (target) => {
      targetBoost = target
    },
    setAccentBand: (strength) => {
      uniforms.uAccentStrength.value = THREE.MathUtils.clamp(strength, 0, 1.4)
    },
    update: (elapsed, dt, nightFactor) => {
      uniforms.uTime.value = elapsed
      uniforms.uNightFactor.value = nightFactor
      if (uniforms.uRippleAge.value < 8) {
        uniforms.uRippleAge.value += dt
      }
      uniforms.uWaveExcite.value = Math.max(0, uniforms.uWaveExcite.value - dt * 0.42)
      uniforms.uLightBoost.value += (targetBoost - uniforms.uLightBoost.value) * Math.min(1, dt * 2.5)

      const amp = 0.025 + uniforms.uWaveExcite.value * 0.14
      const spd = 1.35 + uniforms.uWaveExcite.value * 3.2
      strokeMat.opacity = 0.42 + nightFactor * 0.42

      for (let i = 0; i < STROKE_COUNT; i += 1) {
        const ph = sPhase[i]
        const ox = Math.sin(elapsed * 0.65 + ph) * (0.28 + uniforms.uWaveExcite.value * 0.65)
        const oy = sBaseY[i] + Math.sin(elapsed * spd + ph) * amp
        const pitch = Math.sin(elapsed * spd + ph) * (0.04 + uniforms.uWaveExcite.value * 0.14)
        dummy.position.set(sBaseX[i] + ox, oy, sBaseZ[i])
        dummy.rotation.set(pitch, sYaw[i], 0)
        dummy.scale.set(sScale[i * 2], 1, sScale[i * 2 + 1])
        dummy.updateMatrix()
        strokeInstanced.setMatrixAt(i, dummy.matrix)
      }
      strokeInstanced.instanceMatrix.needsUpdate = true
    },
  }
}

export interface RiverLanternsHandle {
  group: THREE.Group
  release: () => void
  update: (elapsed: number, dt: number) => void
}

/**
 * 24 盏顺黄浦江水漂来的暖金河灯（目标二《燃亮江岸灯火》触发释放）
 */
export function buildRiverLanterns(
  parent: THREE.Object3D,
  glowTex: THREE.Texture,
): RiverLanternsHandle {
  const group = new THREE.Group()
  group.name = 'floating-river-lanterns'

  const COUNT = 24
  const baseMat = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.85 })
  const paperMat = new THREE.MeshBasicMaterial({ color: '#ffdf9a' })

  interface LanternSlot {
    grp: THREE.Group
    startX: number
    startZ: number
    speed: number
    phase: number
    delay: number
    progress: number
  }
  const slots: LanternSlot[] = []

  for (let i = 0; i < COUNT; i += 1) {
    const grp = new THREE.Group()
    grp.visible = false
    const wood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), baseMat)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), paperMat)
    body.position.y = 0.2
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#ffb85c',
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    halo.position.y = 0.24
    halo.scale.set(1.65, 1.65, 1)
    grp.add(wood, body, halo)
    group.add(grp)

    const spread = ((i / (COUNT - 1)) - 0.5) * 68
    slots.push({
      grp,
      startX: spread + Math.sin(i * 1.9) * 3.2,
      startZ: -54 - (i % 4) * 2.5,
      speed: 2.2 + (i % 5) * 0.32,
      phase: i * 0.77,
      delay: i * 0.16,
      progress: 0,
    })
  }
  parent.add(group)

  let active = false
  let releaseTimer = 0

  return {
    group,
    release: () => {
      active = true
      releaseTimer = 0
      for (const s of slots) {
        s.progress = 0
        s.grp.visible = false
      }
    },
    update: (elapsed, dt) => {
      if (!active) return
      releaseTimer += dt
      for (const s of slots) {
        if (releaseTimer < s.delay) continue
        s.grp.visible = true
        s.progress += dt * s.speed
        const z = s.startZ + s.progress
        if (z > 6) {
          s.progress = 0
        }
        const x = s.startX + Math.sin(elapsed * 0.65 + s.phase) * 1.4
        const y = 0.08 + Math.sin(elapsed * 2.2 + s.phase) * 0.035
        s.grp.position.set(x, y, s.startZ + s.progress)
        s.grp.rotation.y = elapsed * 0.3 + s.phase
      }
    },
  }
}

export interface StarlightWishHandle {
  group: THREE.Group
  trigger: () => void
  update: (elapsed: number, dt: number) => void
}

/**
 * 「让星光落入黄浦江」：180 颗星雨坠入江面，化作金色水面光环
 */
export function buildStarlightWishShower(
  parent: THREE.Object3D,
  glowTex: THREE.Texture,
): StarlightWishHandle {
  const group = new THREE.Group()
  group.name = 'starlight-wish-shower'

  const COUNT = 180
  const pos = new Float32Array(COUNT * 3)
  const velY = new Float32Array(COUNT)
  const startY = new Float32Array(COUNT)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    map: glowTex,
    color: '#ffe9a6',
    size: 1.55,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.visible = false
  group.add(points)

  const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; active: boolean }[] = []
  const ringGeo = new THREE.RingGeometry(0.4, 0.62, 32)
  ringGeo.rotateX(-Math.PI / 2)
  for (let r = 0; r < 12; r += 1) {
    const rMat = new THREE.MeshBasicMaterial({
      color: '#ffdf88',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, rMat)
    ring.visible = false
    group.add(ring)
    rings.push({ mesh: ring, mat: rMat, age: 0, active: false })
  }

  parent.add(group)

  let active = false
  let age = 0
  let ringCursor = 0

  return {
    group,
    trigger: () => {
      active = true
      age = 0
      points.visible = true
      for (let i = 0; i < COUNT; i += 1) {
        pos[i * 3] = (Math.random() - 0.5) * 76
        const sy = 22 + Math.random() * 28
        pos[i * 3 + 1] = sy
        startY[i] = sy
        pos[i * 3 + 2] = -6 - Math.random() * 52
        velY[i] = 7.5 + Math.random() * 6.5
      }
      ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    },
    update: (_elapsed, dt) => {
      if (!active) return
      age += dt
      const fadeOut = age > 4.8 ? Math.max(0, 1 - (age - 4.8) / 1.4) : 1
      mat.opacity = 0.92 * fadeOut

      for (let i = 0; i < COUNT; i += 1) {
        pos[i * 3 + 1] -= velY[i] * dt
        if (pos[i * 3 + 1] <= 0.08) {
          if (age < 4.5 && i % 8 === 0) {
            const slot = rings[ringCursor % rings.length]
            ringCursor += 1
            slot.active = true
            slot.age = 0
            slot.mesh.visible = true
            slot.mesh.position.set(pos[i * 3], 0.1, pos[i * 3 + 2])
            slot.mesh.scale.setScalar(0.5)
          }
          pos[i * 3 + 1] = age < 4.5 ? startY[i] : -5
        }
      }
      ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true

      let anyRing = false
      for (const r of rings) {
        if (!r.active) continue
        anyRing = true
        r.age += dt
        if (r.age > 1.35) {
          r.active = false
          r.mesh.visible = false
          continue
        }
        const t = r.age / 1.35
        r.mesh.scale.setScalar(0.5 + t * 4.2)
        r.mat.opacity = (1 - t) * 0.78
      }

      if (fadeOut <= 0 && !anyRing) {
        active = false
        points.visible = false
      }
    },
  }
}
