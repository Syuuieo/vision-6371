import * as THREE from 'three'
import type { DioramaBuilderCtx, DioramaMood, DioramaTextures } from './types'

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return [canvas, canvas.getContext('2d')]
}

export function createDioramaTextures(): DioramaTextures {
  // 1. 建筑石膏/石材微颗粒凹凸贴图
  const [pCanvas, pCtx] = createCanvas(128, 128)
  if (pCtx) {
    pCtx.fillStyle = '#808080'
    pCtx.fillRect(0, 0, 128, 128)
    let seed = 104729
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < 1600; i += 1) {
      const v = Math.floor(110 + rand() * 38)
      pCtx.fillStyle = `rgb(${v},${v},${v})`
      pCtx.fillRect(rand() * 128, rand() * 128, 1 + rand() * 2.5, 1 + rand() * 2.5)
    }
  }
  const plasterBump = new THREE.CanvasTexture(pCanvas)
  plasterBump.wrapS = THREE.RepeatWrapping
  plasterBump.wrapT = THREE.RepeatWrapping
  plasterBump.repeat.set(3, 3)

  // 2. 细腻砖石漫反射 + 凹凸贴图（南京红砖馆 & 哈尔滨圣索菲亚）
  const [bCanvas, bCtx] = createCanvas(256, 256)
  const [bbCanvas, bbCtx] = createCanvas(256, 256)
  if (bCtx && bbCtx) {
    bCtx.fillStyle = '#b46e62'
    bCtx.fillRect(0, 0, 256, 256)
    bbCtx.fillStyle = '#525252'
    bbCtx.fillRect(0, 0, 256, 256)
    const rows = 12
    const cols = 6
    const rh = 256 / rows
    const cw = 256 / cols
    let seed = 7919
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let r = 0; r < rows; r += 1) {
      const offset = r % 2 === 0 ? 0 : cw * 0.5
      for (let c = -1; c <= cols; c += 1) {
        const bx = c * cw + offset + 1.5
        const by = r * rh + 1.5
        const bw = cw - 3
        const bh = rh - 3
        const shade = rand()
        const cr = Math.floor(168 + shade * 28)
        const cg = Math.floor(94 + shade * 22)
        const cb = Math.floor(82 + shade * 18)
        bCtx.fillStyle = `rgb(${cr},${cg},${cb})`
        bCtx.fillRect(bx, by, bw, bh)
        const bumpV = Math.floor(175 + shade * 65)
        bbCtx.fillStyle = `rgb(${bumpV},${bumpV},${bumpV})`
        bbCtx.fillRect(bx, by, bw, bh)
      }
    }
  }
  const brickTex = new THREE.CanvasTexture(bCanvas)
  brickTex.colorSpace = THREE.SRGBColorSpace
  brickTex.wrapS = THREE.RepeatWrapping
  brickTex.wrapT = THREE.RepeatWrapping
  brickTex.repeat.set(2.4, 2.2)

  const brickBump = new THREE.CanvasTexture(bbCanvas)
  brickBump.wrapS = THREE.RepeatWrapping
  brickBump.wrapT = THREE.RepeatWrapping
  brickBump.repeat.set(2.4, 2.2)

  // 3. 柔和径向灯晕精灵贴图
  const [gCanvas, gCtx] = createCanvas(128, 128)
  if (gCtx) {
    const grad = gCtx.createRadialGradient(64, 64, 2, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.28, 'rgba(255,255,255,0.68)')
    grad.addColorStop(0.64, 'rgba(255,255,255,0.18)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    gCtx.fillStyle = grad
    gCtx.fillRect(0, 0, 128, 128)
  }
  const glowHalo = new THREE.CanvasTexture(gCanvas)
  glowHalo.colorSpace = THREE.SRGBColorSpace

  return { plasterBump, brickTex, brickBump, glowHalo }
}

export function disposeDioramaTextures(tex: DioramaTextures) {
  tex.plasterBump.dispose()
  tex.brickTex.dispose()
  tex.brickBump.dispose()
  tex.glowHalo.dispose()
}

export function createMat(
  color: string,
  options: {
    emissive?: string
    emissiveIntensity?: number
    roughness?: number
    metalness?: number
    transparent?: boolean
    opacity?: number
    side?: THREE.Side
    flatShading?: boolean
    map?: THREE.Texture
    bumpMap?: THREE.Texture
    bumpScale?: number
    depthWrite?: boolean
  } = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: options.emissiveIntensity ?? 0,
    roughness: options.roughness ?? 0.68,
    metalness: options.metalness ?? 0.08,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    flatShading: options.flatShading ?? false,
    map: options.map,
    bumpMap: options.bumpMap,
    bumpScale: options.bumpScale ?? (options.bumpMap ? 0.035 : 0),
    depthWrite: options.depthWrite ?? true,
  })
}

export function enableShadows(root: THREE.Object3D, cast = true, receive = true) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = cast
      obj.receiveShadow = receive
    }
  })
}

export function makeGlowSprite(
  glowTex: THREE.Texture,
  color: string,
  scale = 0.85,
  opacity = 0.72,
): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(scale, scale, 1)
  return sprite
}

export function createGoalBeacon(glowTex: THREE.Texture, color: string) {
  const g = new THREE.Group()
  g.visible = false

  const ringGeo = new THREE.RingGeometry(0.28, 0.36, 32)
  ringGeo.rotateX(-Math.PI / 2)
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  g.add(ring)

  const glow = makeGlowSprite(glowTex, color, 1.05, 0.75)
  glow.position.y = 0.16
  g.add(glow)

  return g
}

export interface SkyDomeHandle {
  mesh: THREE.Mesh
  uniforms: {
    uZenith: { value: THREE.Color }
    uMid: { value: THREE.Color }
    uHorizon: { value: THREE.Color }
    uSunDir: { value: THREE.Vector3 }
    uSunCol: { value: THREE.Color }
    uStars: { value: number }
    uTime: { value: number }
  }
}

export function createDioramaSkyDome(): SkyDomeHandle {
  const uniforms = {
    uZenith: { value: new THREE.Color('#132445') },
    uMid: { value: new THREE.Color('#2d4870') },
    uHorizon: { value: new THREE.Color('#d89b72') },
    uSunDir: { value: new THREE.Vector3(-0.4, 0.25, -0.88).normalize() },
    uSunCol: { value: new THREE.Color('#ffcf96') },
    uStars: { value: 0.25 },
    uTime: { value: 0 },
  }

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform float uStars;
      uniform float uTime;
      varying vec3 vDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 sky = mix(uHorizon, uMid, smoothstep(0.32, 0.62, h));
        sky = mix(sky, uZenith, smoothstep(0.58, 0.94, h));

        float sunMu = max(0.0, dot(d, normalize(uSunDir)));
        float sunGlow = pow(sunMu, 6.0) * 0.24 + pow(sunMu, 42.0) * 0.42 + smoothstep(0.9965, 0.9992, sunMu) * 0.85;
        sky += uSunCol * sunGlow;

        if (uStars > 0.01 && up > 0.04) {
          vec3 grid = floor(d * 135.0);
          float r = hash31(grid);
          if (r > 0.989) {
            vec3 cellCenter = normalize(grid + 0.5);
            float dist = length(d - cellCenter) * 135.0;
            float star = smoothstep(0.36, 0.04, dist);
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + r * 62.0);
            sky += vec3(0.88, 0.94, 1.0) * star * twinkle * uStars * smoothstep(0.04, 0.3, up);
          }
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  })

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(52, 36, 24), mat)
  mesh.renderOrder = -10
  return { mesh, uniforms }
}

export interface WaterUniforms {
  uTime: { value: number }
  uDeepCol: { value: THREE.Color }
  uShallowCol: { value: THREE.Color }
  uSunCol: { value: THREE.Color }
  uSunDir: { value: THREE.Vector3 }
  uRipplePos: { value: THREE.Vector2 }
  uRippleAge: { value: number }
  uBio: { value: number }
}

export function createDioramaWaterMaterial(
  shallowHex: string,
  deepHex: string,
): { material: THREE.ShaderMaterial; uniforms: WaterUniforms } {
  const uniforms: WaterUniforms = {
    uTime: { value: 0 },
    uDeepCol: { value: new THREE.Color(deepHex) },
    uShallowCol: { value: new THREE.Color(shallowHex) },
    uSunCol: { value: new THREE.Color('#ffd3a0') },
    uSunDir: { value: new THREE.Vector3(-0.4, 0.3, -0.85).normalize() },
    uRipplePos: { value: new THREE.Vector2(0, 1.6) },
    uRippleAge: { value: 8 },
    uBio: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uRipplePos;
      uniform float uRippleAge;
      varying vec3 vWorld;
      varying vec2 vLocal;

      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 2.2 + uTime * 1.9) * 0.024;
        float w2 = cos(p.z * 2.8 - uTime * 1.45) * 0.02;
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        float dClick = length(worldPos.xz - uRipplePos);
        float ring = sin((dClick - uRippleAge * 2.8) * 14.0)
          * exp(-abs(dClick - uRippleAge * 2.8) * 3.2)
          * exp(-uRippleAge * 1.4) * 0.045;
        p.y += w1 + w2 + ring;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vLocal = uv;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeepCol;
      uniform vec3 uShallowCol;
      uniform vec3 uSunCol;
      uniform vec3 uSunDir;
      uniform vec2 uRipplePos;
      uniform float uRippleAge;
      uniform float uBio;
      varying vec3 vWorld;
      varying vec2 vLocal;

      void main() {
        vec2 p = vWorld.xz;
        float nx = cos(p.x * 3.1 + uTime * 2.0) * 0.14 + sin((p.x + p.y) * 5.2 - uTime * 1.7) * 0.08;
        float nz = sin(p.y * 3.4 - uTime * 1.6) * 0.14 + cos((p.x - p.y) * 4.7 + uTime * 2.1) * 0.08;

        float dClick = length(p - uRipplePos);
        float clickWave = smoothstep(0.18, 0.0, abs(dClick - uRippleAge * 2.8)) * exp(-uRippleAge * 1.35);

        vec3 N = normalize(vec3(nx, 1.0, nz));
        vec3 V = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.2);

        float edgeDist = min(min(vLocal.x, 1.0 - vLocal.x), min(vLocal.y, 1.0 - vLocal.y));
        float shallow = 1.0 - smoothstep(0.0, 0.24, edgeDist);
        vec3 waterCol = mix(uDeepCol, uShallowCol, shallow * 0.72 + 0.15);

        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);
        float spec = pow(max(0.0, dot(N, H)), 64.0) * 0.72;

        float foam = smoothstep(0.075, 0.0, edgeDist) * (0.45 + 0.35 * sin(p.x * 7.0 + uTime * 2.4));
        waterCol += fresnel * mix(uShallowCol, uSunCol, 0.45) * 0.55;
        waterCol += uSunCol * spec;
        waterCol += vec3(0.88, 0.96, 1.0) * (foam * 0.36 + clickWave * 0.45);

        if (uBio > 0.01) {
          float sparkle = sin(p.x * 6.4 + uTime * 2.3) * cos(p.y * 5.8 - uTime * 1.9);
          float glowBand = smoothstep(0.2, 0.85, sparkle * 0.5 + 0.5);
          waterCol += vec3(0.24, 0.92, 0.88) * (glowBand * 0.48 + clickWave * 0.7) * uBio;
        }

        gl_FragColor = vec4(waterCol, 0.9);
      }
    `,
  })

  return { material, uniforms }
}

export interface PlinthWaterHandle {
  mesh: THREE.Mesh
  uniforms: WaterUniforms
}

export function buildSculptedPlinth(
  ctx: DioramaBuilderCtx,
  options: {
    topColor: string
    sideColor: string
    stoneColor?: string
    waterShallow?: string
    waterDeep?: string
    waterSplitZ?: number
  },
): { water: PlinthWaterHandle | null } {
  const base = new THREE.Group()
  const bump = ctx.textures.plasterBump
  const stoneHex = options.stoneColor ?? '#28364f'

  // 倒锥切面浮岛崖底
  const cliff = new THREE.Mesh(
    new THREE.CylinderGeometry(4.35, 1.45, 2.05, 8),
    createMat(stoneHex, { roughness: 0.92, flatShading: true }),
  )
  cliff.rotation.y = Math.PI / 8
  cliff.position.y = -1.42
  base.add(cliff)

  const midSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(7.05, 0.52, 7.05),
    createMat(options.sideColor, { roughness: 0.78, bumpMap: bump }),
  )
  midSkirt.position.y = -0.38
  base.add(midSkirt)

  // 四枚悬浮微缩碎石点缀岛底纵深
  const shardGeo = new THREE.IcosahedronGeometry(0.32, 0)
  const shardMat = createMat(stoneHex, { roughness: 0.9, flatShading: true })
  const shardSpecs: [number, number, number, number][] = [
    [-2.5, -2.05, 2.2, 0.9],
    [2.7, -2.2, 1.9, 0.75],
    [-2.2, -2.45, -2.4, 0.68],
    [2.3, -1.95, -2.5, 0.82],
  ]
  shardSpecs.forEach(([sx, sy, sz, sc], idx) => {
    const s = new THREE.Mesh(shardGeo, shardMat)
    s.position.set(sx, sy, sz)
    s.scale.set(sc, sc * 1.4, sc)
    s.rotation.set(idx * 0.4, idx, 0.3)
    base.add(s)
    ctx.addTick((t) => {
      s.position.y = sy + Math.sin(t * 1.15 + idx * 1.7) * 0.08
    })
  })

  if (options.waterShallow && options.waterDeep) {
    const splitZ = options.waterSplitZ ?? 0.25
    const landDepth = splitZ - -3.65
    const landCenterZ = -3.65 + landDepth * 0.5
    const topLand = new THREE.Mesh(
      new THREE.BoxGeometry(7.35, 0.26, landDepth),
      createMat(options.topColor, { roughness: 0.74, bumpMap: bump }),
    )
    topLand.position.set(0, -0.02, landCenterZ)
    base.add(topLand)

    // 沿岸青石护沿
    const quayEdge = new THREE.Mesh(
      new THREE.BoxGeometry(7.38, 0.3, 0.22),
      createMat('#d4cabd', { roughness: 0.7, bumpMap: bump }),
    )
    quayEdge.position.set(0, 0.02, splitZ)
    base.add(quayEdge)

    // 水池外围矮石框（左、右、前壁，围出沉降式海水槽）
    const waterDepth = 3.65 - splitZ
    const waterCenterZ = splitZ + waterDepth * 0.5
    const rimMat = createMat(options.sideColor, { roughness: 0.75, bumpMap: bump })
    for (const sx of [-3.58, 3.58]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, waterDepth), rimMat)
      sideWall.position.set(sx, -0.01, waterCenterZ)
      base.add(sideWall)
    }
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(7.36, 0.24, 0.2), rimMat)
    frontWall.position.set(0, -0.01, 3.55)
    base.add(frontWall)

    // 系船铜柱与码头石阶
    const bollardMat = createMat('#c99a5b', { roughness: 0.35, metalness: 0.72 })
    for (const bx of [-2.4, 0, 2.4]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.22, 8), bollardMat)
      b.position.set(bx, 0.24, splitZ)
      base.add(b)
    }

    // 实时 GLSL 波纹水面
    const waterGeo = new THREE.PlaneGeometry(7.02, waterDepth - 0.14, 48, 28)
    waterGeo.rotateX(-Math.PI / 2)
    const { material: waterMat, uniforms } = createDioramaWaterMaterial(
      options.waterShallow,
      options.waterDeep,
    )
    const waterMesh = new THREE.Mesh(waterGeo, waterMat)
    waterMesh.position.set(0, -0.08, waterCenterZ - 0.04)
    waterMesh.receiveShadow = true
    base.add(waterMesh)

    ctx.bindWater(
      (rx, rz) => {
        uniforms.uRipplePos.value.set(rx, rz)
        uniforms.uRippleAge.value = 0
      },
      (bio) => {
        uniforms.uBio.value = bio
      },
    )

    ctx.addTick((t, dt) => {
      uniforms.uTime.value = t
      uniforms.uRippleAge.value = Math.min(10, uniforms.uRippleAge.value + dt)
    })

    ctx.addMoodHook((mood: DioramaMood) => {
      uniforms.uSunCol.value.set(
        mood === 'dawn' ? '#ffe0ae' : mood === 'night' ? '#88b6ff' : '#ffb87c',
      )
    })

    enableShadows(base, true, true)
    waterMesh.castShadow = false
    ctx.group.add(base)
    return { water: { mesh: waterMesh, uniforms } }
  }

  const topDeck = new THREE.Mesh(
    new THREE.BoxGeometry(7.35, 0.26, 7.35),
    createMat(options.topColor, { roughness: 0.74, bumpMap: bump }),
  )
  topDeck.position.y = -0.02
  base.add(topDeck)

  enableShadows(base, true, true)
  ctx.group.add(base)
  return { water: null }
}

/** 立体微缩小人偶（带斗篷、围巾/伞或书卷装饰） */
export function createMiniPerson(
  coatHex: string,
  accentHex = '#ffd6a4',
  opts: { umbrella?: string; book?: boolean; hatHex?: string } = {},
) {
  const grp = new THREE.Group()
  const coatMat = createMat(coatHex, { roughness: 0.72 })
  const skinMat = createMat('#f4d2b8', { roughness: 0.65 })

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.11, 0.28, 10), coatMat)
  body.position.y = 0.15
  grp.add(body)

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.062, 0.022, 6, 12),
    createMat(accentHex, { roughness: 0.7 }),
  )
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = 0.285
  grp.add(scarf)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), skinMat)
  head.position.y = 0.35
  grp.add(head)

  if (opts.hatHex) {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.09, 8), createMat(opts.hatHex))
    hat.position.y = 0.42
    grp.add(hat)
  }

  if (opts.book) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.025, 0.08),
      createMat('#fff0d2', { emissive: '#ffbe64', emissiveIntensity: 0.55 }),
    )
    book.position.set(0, 0.22, 0.11)
    book.rotation.x = 0.35
    grp.add(book)
  }

  if (opts.umbrella) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), createMat('#d8dce6'))
    shaft.position.set(0.07, 0.36, 0.04)
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.11, 8),
      createMat(opts.umbrella, { roughness: 0.55, side: THREE.DoubleSide }),
    )
    canopy.position.set(0.07, 0.52, 0.04)
    grp.add(shaft, canopy)
  }

  return grp
}

/** 微缩汽车（带暖光前大灯与红尾灯，用于悉尼海港大桥车流） */
export function createMiniCar(bodyHex: string) {
  const car = new THREE.Group()
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.14), createMat(bodyHex, { roughness: 0.4 }))
  chassis.position.y = 0.06
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.065, 0.12), createMat('#dbe8f6', { roughness: 0.25 }))
  cabin.position.set(-0.01, 0.125, 0)
  car.add(chassis, cabin)

  const wheelMat = createMat('#202630')
  for (const [wx, wz] of [[-0.08, -0.07], [0.08, -0.07], [-0.08, 0.07], [0.08, 0.07]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 8), wheelMat)
    w.rotation.x = Math.PI / 2
    w.position.set(wx, 0.028, wz)
    car.add(w)
  }

  const headMat = createMat('#fff3c4', { emissive: '#ffcf6e', emissiveIntensity: 1.4 })
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.1), headMat)
  head.position.set(0.142, 0.06, 0)
  const tailMat = createMat('#ff7a6b', { emissive: '#ff483b', emissiveIntensity: 1.2 })
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.1), tailMat)
  tail.position.set(-0.142, 0.06, 0)
  car.add(head, tail)

  return car
}

/** 跃水小鱼 */
export function createMiniFish(colorHex: string) {
  const fish = new THREE.Group()
  const mat = createMat(colorHex, { emissive: colorHex, emissiveIntensity: 0.28, roughness: 0.25 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), mat)
  body.scale.set(1.65, 0.85, 0.72)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 4), mat)
  tail.rotation.z = -Math.PI / 2
  tail.position.x = -0.12
  fish.add(body, tail)
  return fish
}

