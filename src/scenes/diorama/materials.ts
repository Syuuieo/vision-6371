import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import type { DioramaSceneId } from '../../services/albumStorage'
import type {
  DioramaBuilderCtx,
  DioramaHorizonStyle,
  DioramaMood,
  DioramaTextures,
} from './types'

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

  // 4. 做旧油画木栈桥纹理（纵向多色木板 + 柔和木纹 + 深色缝隙）
  const [wCanvas, wCtx] = createCanvas(512, 512)
  if (wCtx) {
    const plankColors = ['#4a3e35', '#5a4a3c', '#3f3a34', '#635040', '#47443a', '#524438']
    const plankCount = 10
    const pw = 512 / plankCount
    let wSeed = 31337
    const wRand = () => {
      wSeed = (wSeed * 16807) % 2147483647
      return (wSeed - 1) / 2147483646
    }
    for (let i = 0; i < plankCount; i += 1) {
      const px = i * pw
      wCtx.fillStyle = plankColors[(i + Math.floor(wRand() * 3)) % plankColors.length]
      wCtx.fillRect(px, 0, pw, 512)
      for (let s = 0; s < 36; s += 1) {
        const gx = px + 3 + wRand() * (pw - 6)
        const gy = wRand() * 512
        const gh = 48 + wRand() * 140
        wCtx.fillStyle = wRand() > 0.5 ? 'rgba(255,232,205,0.06)' : 'rgba(18,14,12,0.11)'
        wCtx.fillRect(gx, gy, 1.2 + wRand() * 2, gh)
      }
      wCtx.fillStyle = '#1c1714'
      wCtx.fillRect(px, 0, 2.2, 512)
    }
  }
  const weatheredWoodTex = new THREE.CanvasTexture(wCanvas)
  weatheredWoodTex.colorSpace = THREE.SRGBColorSpace
  weatheredWoodTex.wrapS = THREE.RepeatWrapping
  weatheredWoodTex.wrapT = THREE.RepeatWrapping

  // 5. 湿润深青石堤岸板岩纹理
  const [sCanvas, sCtx] = createCanvas(512, 512)
  if (sCtx) {
    sCtx.fillStyle = '#383d47'
    sCtx.fillRect(0, 0, 512, 512)
    let sSeed = 9187
    const sRand = () => {
      sSeed = (sSeed * 16807) % 2147483647
      return (sSeed - 1) / 2147483646
    }
    const rows = 4
    const cols = 4
    const rh = 512 / rows
    const cw = 512 / cols
    for (let r = 0; r < rows; r += 1) {
      const offset = r % 2 === 0 ? 0 : cw * 0.5
      for (let c = -1; c <= cols; c += 1) {
        const shade = Math.floor(52 + sRand() * 22)
        sCtx.fillStyle = `rgb(${shade},${shade + 4},${shade + 12})`
        sCtx.fillRect(c * cw + offset + 2, r * rh + 2, cw - 4, rh - 4)
      }
    }
    for (let i = 0; i < 1800; i += 1) {
      const v = Math.floor(38 + sRand() * 44)
      sCtx.fillStyle = `rgba(${v},${v + 3},${v + 8},0.28)`
      sCtx.fillRect(sRand() * 512, sRand() * 512, 1.5 + sRand() * 2, 1.5 + sRand() * 2)
    }
  }
  const darkStoneTex = new THREE.CanvasTexture(sCanvas)
  darkStoneTex.colorSpace = THREE.SRGBColorSpace
  darkStoneTex.wrapS = THREE.RepeatWrapping
  darkStoneTex.wrapT = THREE.RepeatWrapping

  // 6. 高密度玻璃幕墙立面贴图与夜间点亮窗格贴图（512×1024）
  const [fCanvas, fCtx] = createCanvas(512, 1024)
  const [eCanvas, eCtx] = createCanvas(512, 1024)
  if (fCtx && eCtx) {
    fCtx.fillStyle = '#1b273d'
    fCtx.fillRect(0, 0, 512, 1024)
    eCtx.fillStyle = '#000000'
    eCtx.fillRect(0, 0, 512, 1024)

    const cols = 24
    const rows = 56
    const cw = 512 / cols
    const rh = 1024 / rows
    let winSeed = 54321
    const winRand = () => {
      winSeed = (winSeed * 16807) % 2147483647
      return (winSeed - 1) / 2147483646
    }

    for (let r = 0; r < rows; r += 1) {
      const floorActive = winRand() > 0.22
      const floorWarmth = winRand()
      for (let c = 0; c < cols; c += 1) {
        const wx = c * cw + 2.2
        const wy = r * rh + 3.2
        const ww = cw - 4.4
        const wh = rh - 5.4
        const shade = winRand()
        fCtx.fillStyle = shade > 0.5 ? '#263652' : '#1f2d45'
        fCtx.fillRect(wx, wy, ww, wh)

        if (r === 1 || r === 2) {
          eCtx.fillStyle = 'rgba(255, 224, 174, 0.72)'
          eCtx.fillRect(wx, wy, ww, wh)
        } else if (floorActive && winRand() < 0.38) {
          const litCol =
            floorWarmth > 0.65
              ? 'rgba(255, 214, 146, 0.92)'
              : floorWarmth > 0.25
                ? 'rgba(255, 232, 194, 0.85)'
                : 'rgba(186, 218, 255, 0.65)'
          eCtx.fillStyle = litCol
          eCtx.fillRect(wx, wy, ww, wh)
        }
      }
      fCtx.fillStyle = '#131c2d'
      fCtx.fillRect(0, r * rh, 512, 2.2)
    }
  }
  const skyscraperFacadeTex = new THREE.CanvasTexture(fCanvas)
  skyscraperFacadeTex.colorSpace = THREE.SRGBColorSpace
  skyscraperFacadeTex.wrapS = THREE.RepeatWrapping
  skyscraperFacadeTex.wrapT = THREE.RepeatWrapping

  const skyscraperEmissiveTex = new THREE.CanvasTexture(eCanvas)
  skyscraperEmissiveTex.colorSpace = THREE.SRGBColorSpace
  skyscraperEmissiveTex.wrapS = THREE.RepeatWrapping
  skyscraperEmissiveTex.wrapT = THREE.RepeatWrapping

  return {
    plasterBump,
    brickTex,
    brickBump,
    glowHalo,
    weatheredWoodTex,
    darkStoneTex,
    skyscraperFacadeTex,
    skyscraperEmissiveTex,
  }
}

export function disposeDioramaTextures(tex: DioramaTextures) {
  tex.plasterBump.dispose()
  tex.brickTex.dispose()
  tex.brickBump.dispose()
  tex.glowHalo.dispose()
  tex.weatheredWoodTex.dispose()
  tex.darkStoneTex.dispose()
  tex.skyscraperFacadeTex.dispose()
  tex.skyscraperEmissiveTex.dispose()
}

export function createMat(
  color: string | THREE.Color,
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
    ...(options.map ? { map: options.map } : {}),
    ...(options.bumpMap ? { bumpMap: options.bumpMap, bumpScale: options.bumpScale ?? 0.035 } : {}),
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

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
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
        for (int i = 0; i < 4; i++) {
          v += a * noise2(p);
          p = p * 2.03 + vec2(17.1, 31.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 mistCol = mix(uHorizon, uSunCol, 0.22);
        vec3 sky = mix(uHorizon, mistCol, smoothstep(-0.02, 0.14, d.y));
        sky = mix(sky, uMid, smoothstep(0.10, 0.42, up));
        sky = mix(sky, uZenith, smoothstep(0.38, 0.88, up));

        float sunMu = max(0.0, dot(d, normalize(uSunDir)));
        float sunGlow = pow(sunMu, 7.0) * 0.24 + pow(sunMu, 36.0) * 0.42;
        float sunDisc = smoothstep(0.9986, 0.9994, sunMu) * 1.25;
        float daySunVis = 1.0 - smoothstep(0.35, 0.85, uStars);
        sky += uSunCol * (sunGlow + sunDisc) * daySunVis;

        // 印象派油画笔触云带
        if (d.y > 0.015) {
          vec2 cloudUv = vec2(
            d.x / (abs(d.y) + 0.18) * 1.4 + uTime * 0.012,
            d.z / (abs(d.y) + 0.18) * 2.2
          );
          float cNoise = fbm(cloudUv);
          float cloudMask = smoothstep(0.46, 0.78, cNoise) * smoothstep(0.015, 0.16, d.y) * smoothstep(0.85, 0.25, d.y);
          vec3 cloudCol = mix(uMid, uSunCol, sunGlow * 0.65 + 0.25);
          sky = mix(sky, cloudCol, cloudMask * 0.44);
        }

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

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(220, 48, 32), mat)
  mesh.renderOrder = -10
  return { mesh, uniforms }
}

export interface WaterUniforms {
  uTime: { value: number }
  uDeepCol: { value: THREE.Color }
  uShallowCol: { value: THREE.Color }
  uSunCol: { value: THREE.Color }
  uSunDir: { value: THREE.Vector3 }
  uHorizonCol: { value: THREE.Color }
  uFogColor: { value: THREE.Color }
  uFadeRadius: { value: number }
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
    uSunDir: { value: new THREE.Vector3(0.06, 0.115, -0.99).normalize() },
    uHorizonCol: { value: new THREE.Color('#d89b72') },
    uFogColor: { value: new THREE.Color('#d89b72') },
    uFadeRadius: { value: 56 },
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

      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.48 + uTime * 1.25) * 0.025;
        float w2 = cos(p.z * 0.62 - uTime * 1.05) * 0.022;
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        float dClick = length(worldPos.xz - uRipplePos);
        float ring = sin((dClick - uRippleAge * 5.6) * 5.2)
          * exp(-abs(dClick - uRippleAge * 5.6) * 0.9)
          * exp(-uRippleAge * 1.35) * 0.05;
        p.y += w1 + w2 + ring;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeepCol;
      uniform vec3 uShallowCol;
      uniform vec3 uSunCol;
      uniform vec3 uSunDir;
      uniform vec3 uHorizonCol;
      uniform vec3 uFogColor;
      uniform float uFadeRadius;
      uniform vec2 uRipplePos;
      uniform float uRippleAge;
      uniform float uBio;
      varying vec3 vWorld;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.23);
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

      float fbm2(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise2(p);
          p = p * 2.07 + vec2(13.7, 29.3);
          a *= 0.5;
        }
        return v;
      }

      float waterHeight(vec2 p) {
        return fbm2(p * 0.24 + vec2(uTime * 0.14, -uTime * 0.18))
          + 0.45 * noise2(p * 0.85 + vec2(-uTime * 0.22, uTime * 0.26))
          + 0.2 * noise2(p * 2.1 + vec2(uTime * 0.35, -uTime * 0.32));
      }

      void main() {
        vec2 p = vWorld.xz;
        float eps = 0.18;
        float h0 = waterHeight(p);
        float hx = waterHeight(p + vec2(eps, 0.0));
        float hz = waterHeight(p + vec2(0.0, eps));

        float dClick = length(p - uRipplePos);
        float clickWave = smoothstep(0.45, 0.0, abs(dClick - uRippleAge * 5.6)) * exp(-uRippleAge * 1.3);

        vec3 N = normalize(vec3((h0 - hx) * 0.55, 1.0, (h0 - hz) * 0.55));
        vec3 V = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.2);

        vec3 waterCol = mix(uDeepCol, uShallowCol, 0.22 + clamp(h0 * 0.14, 0.0, 0.18));
        vec3 skyRefl = mix(uShallowCol, uHorizonCol, 0.48);
        waterCol = mix(waterCol, skyRefl, fresnel * 0.65);

        float horizonFade = smoothstep(38.0, uFadeRadius, length(vWorld.xz));

        // 有机 fBM 碎波垂直太阳/月光光柱倒影（无机械横杠）
        vec2 viewDirXZ = normalize(vWorld.xz - cameraPosition.xz + vec2(0.0001));
        vec2 sunDirXZ = normalize(uSunDir.xz + vec2(0.0001));
        float align = max(0.0, dot(viewDirXZ, sunDirXZ));
        float crest = smoothstep(0.38, 0.76, h0 * 0.65 + (h0 - hz) * 1.4);
        float pillarBroad = pow(align, 20.0) * 0.26;
        float pillarCore = pow(align, 115.0) * crest * 1.15;
        waterCol += uSunCol * (pillarBroad + pillarCore) * (1.0 - horizonFade * 0.72);

        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);
        float spec = pow(max(0.0, dot(N, H)), 64.0) * 0.4;
        waterCol += uSunCol * spec * (1.0 - horizonFade);

        waterCol = mix(waterCol, uFogColor, horizonFade);
        waterCol += vec3(0.88, 0.96, 1.0) * clickWave * 0.42;

        if (uBio > 0.01) {
          float bioNoise = fbm2(p * 0.55 + vec2(uTime * 0.25, -uTime * 0.2))
            * noise2(p * 1.35 + vec2(-uTime * 0.3, uTime * 0.28));
          float glowBand = smoothstep(0.24, 0.58, bioNoise);
          waterCol += vec3(0.24, 0.92, 0.88) * (glowBand * 0.42 + clickWave * 0.65) * uBio;
        }

        gl_FragColor = vec4(waterCol, 0.96);
      }
    `,
  })

  return { material, uniforms }
}

export interface ReflectorWaterUniforms {
  uTime: { value: number }
  uDeepCol: { value: THREE.Color }
  uShallowCol: { value: THREE.Color }
  uSunCol: { value: THREE.Color }
  uSunDir: { value: THREE.Vector3 }
  uFogColor: { value: THREE.Color }
  uFadeRadius: { value: number }
  uRipplePos: { value: THREE.Vector2 }
  uRippleAge: { value: number }
  uBio: { value: number }
  uRainIntensity: { value: number }
}

/**
 * 真实 3D 平面镜面反射水面（Reflector）：
 * 1:1 实时倒映场景内所有 3D 实体建筑、铁塔、钢桁架桥、游船与烟花，并结合 3-octave fBM 有机波纹扰动与雨滴涟漪产生真实视差！
 */
export function createReflectorWater(
  width: number,
  depth: number,
  options: { deepHex: string; shallowHex: string; fadeRadius?: number },
): { mesh: THREE.Mesh; uniforms: ReflectorWaterUniforms } {
  const uniforms: ReflectorWaterUniforms = {
    uTime: { value: 0 },
    uDeepCol: { value: new THREE.Color(options.deepHex) },
    uShallowCol: { value: new THREE.Color(options.shallowHex) },
    uSunCol: { value: new THREE.Color('#ff8a5b') },
    uSunDir: { value: new THREE.Vector3(-0.04, 0.115, -0.99).normalize() },
    uFogColor: { value: new THREE.Color('#e8b49c') },
    uFadeRadius: { value: options.fadeRadius ?? 155 },
    uRipplePos: { value: new THREE.Vector2(0, -10) },
    uRippleAge: { value: 8 },
    uBio: { value: 0 },
    uRainIntensity: { value: 0 },
  }

  const geo = new THREE.PlaneGeometry(width, depth)

  if (typeof window === 'undefined') {
    const mat = new THREE.MeshStandardMaterial({ color: options.deepHex, roughness: 0.25, metalness: 0.6 })
    const fallback = new THREE.Mesh(geo, mat)
    return { mesh: fallback, uniforms }
  }

  const shader = {
    uniforms: {
      color: { value: new THREE.Color(0x8899aa) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      ...uniforms,
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;

      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorld = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec3 uDeepCol;
      uniform vec3 uShallowCol;
      uniform vec3 uSunCol;
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform float uFadeRadius;
      uniform vec2 uRipplePos;
      uniform float uRippleAge;
      uniform float uBio;
      uniform float uRainIntensity;
      varying vec4 vUv;
      varying vec3 vWorld;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      vec2 hash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      float rainCellLayer(vec2 p, float t) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        vec2 rnd = hash22(cell);
        float age = fract(t * 0.85 + rnd.x);
        vec2 center = 0.25 + 0.5 * rnd;
        float dist = length(f - center);
        float radius = age * 0.46;
        float wave = sin((dist - radius) * 34.0) * exp(-abs(dist - radius) * 10.0) * (1.0 - age);
        return wave * smoothstep(0.48, 0.06, dist);
      }

      float rainRipples(vec2 p, float t) {
        return rainCellLayer(p * 0.65, t) + rainCellLayer(p * 1.15 + vec2(4.3, 7.1), t * 1.13) * 0.7;
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

      float fbm2(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise2(p);
          p = p * 2.07 + vec2(13.7, 29.3);
          a *= 0.5;
        }
        return v;
      }

      float waterHeight(vec2 p) {
        return fbm2(p * 0.28 + vec2(uTime * 0.14, -uTime * 0.18))
          + 0.45 * noise2(p * 0.92 + vec2(-uTime * 0.22, uTime * 0.26))
          + 0.2 * noise2(p * 2.25 + vec2(uTime * 0.35, -uTime * 0.32));
      }

      void main() {
        vec2 p = vWorld.xz;
        float eps = 0.18;
        float h0 = waterHeight(p);
        float hx = waterHeight(p + vec2(eps, 0.0));
        float hz = waterHeight(p + vec2(0.0, eps));
        float dx = h0 - hx;
        float dz = h0 - hz;

        float dClick = length(p - uRipplePos);
        float clickWave = smoothstep(0.55, 0.0, abs(dClick - uRippleAge * 5.8)) * exp(-uRippleAge * 1.25);

        float rainWave = 0.0;
        if (uRainIntensity > 0.01) {
          rainWave = rainRipples(p, uTime) * uRainIntensity;
        }

        vec3 N = normalize(vec3(dx * 0.58 + rainWave * 0.16, 1.0, dz * 0.58 + clickWave * 0.16 + rainWave * 0.16));
        vec3 V = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.8);

        vec2 projUv = vUv.xy / max(0.0001, vUv.w);
        vec2 reflUv = clamp(
          projUv + vec2(dx, dz) * 0.018 + vec2(rainWave * 0.014, clickWave * 0.012 + rainWave * 0.014),
          0.002,
          0.998
        );
        vec3 reflCol = texture2D(tDiffuse, reflUv).rgb;

        vec3 baseWater = mix(uDeepCol, uShallowCol, 0.24 + clamp(h0 * 0.14, 0.0, 0.18));
        float reflWeight = clamp(0.46 + fresnel * 0.46, 0.0, 0.90);
        vec3 waterCol = mix(baseWater, reflCol, reflWeight);

        // 垂直太阳/月光有机碎波光柱
        vec2 viewDirXZ = normalize(vWorld.xz - cameraPosition.xz + vec2(0.0001));
        vec2 sunDirXZ = normalize(uSunDir.xz + vec2(0.0001));
        float align = max(0.0, dot(viewDirXZ, sunDirXZ));
        float crest = smoothstep(0.36, 0.76, h0 * 0.65 + dz * 1.4);
        float horizonFade = smoothstep(48.0, uFadeRadius, length(vWorld.xz));
        waterCol += uSunCol * (pow(align, 22.0) * 0.22 + pow(align, 120.0) * crest * 0.95) * (1.0 - horizonFade * 0.72);

        waterCol = mix(waterCol, uFogColor, horizonFade);
        waterCol += vec3(0.88, 0.96, 1.0) * (clickWave * 0.4 + max(0.0, rainWave) * 0.22 * (1.0 - horizonFade));

        if (uBio > 0.01) {
          float bioNoise = fbm2(p * 0.55 + vec2(uTime * 0.25, -uTime * 0.2))
            * noise2(p * 1.35 + vec2(-uTime * 0.3, uTime * 0.28));
          float bioGlow = smoothstep(0.24, 0.58, bioNoise);
          waterCol += vec3(0.24, 0.92, 0.88) * (bioGlow * 0.42 + clickWave * 0.65) * uBio;
        }

        gl_FragColor = vec4(waterCol, 1.0);
      }
    `,
  }

  const reflector = new Reflector(geo, {
    clipBias: 0.003,
    textureWidth: 512,
    textureHeight: 512,
    color: 0x8899aa,
    shader,
  })
  const reflUniforms = (reflector.material as THREE.ShaderMaterial).uniforms
  for (const key of Object.keys(uniforms) as (keyof ReflectorWaterUniforms)[]) {
    reflUniforms[key] = uniforms[key]
  }
  return { mesh: reflector, uniforms }
}

/**
 * 浦东摩天楼动态建筑流光材质（克制暖金/琥珀/青蓝建筑光带，随夜色渐亮并 1:1 倒映入镜面江水）
 */
export function createDynamicFacadeMaterial(
  facadeTex?: THREE.Texture,
  emissiveTex?: THREE.Texture,
): {
  material: THREE.MeshStandardMaterial
  uniforms: { uTime: { value: number }; uNightFactor: { value: number } }
} {
  const uniforms = {
    uTime: { value: 0 },
    uNightFactor: { value: 0.28 },
  }
  const material = new THREE.MeshStandardMaterial({
    ...(facadeTex ? { map: facadeTex } : { color: '#212e46' }),
    ...(emissiveTex
      ? { emissiveMap: emissiveTex, emissive: new THREE.Color('#ffd394'), emissiveIntensity: 0.88 }
      : {}),
    roughness: 0.28,
    metalness: 0.48,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFacadeTime = uniforms.uTime
    shader.uniforms.uNightFactor = uniforms.uNightFactor
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFacadeWorldPos;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vFacadeWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFacadeTime;
        uniform float uNightFactor;
        varying vec3 vFacadeWorldPos;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float waveA = sin(vFacadeWorldPos.y * 0.22 - uFacadeTime * 0.65 + vFacadeWorldPos.x * 0.08);
        float waveB = cos(vFacadeWorldPos.x * 0.12 + uFacadeTime * 0.45 + vFacadeWorldPos.y * 0.14);
        float band = smoothstep(0.62, 0.98, waveA * 0.5 + 0.5) * 0.55 + smoothstep(0.75, 0.99, waveB * 0.5 + 0.5) * 0.45;
        vec3 sweepCol = mix(vec3(1.0, 0.80, 0.52), vec3(0.45, 0.82, 1.0), smoothstep(-0.4, 0.6, sin(uFacadeTime * 0.18 + vFacadeWorldPos.x * 0.05)));
        totalEmissiveRadiance *= (0.35 + 0.95 * uNightFactor);
        totalEmissiveRadiance += sweepCol * band * (0.12 + 0.34 * uNightFactor);`,
      )
  }
  material.customProgramCacheKey = () => 'dynamic-facade-v1'
  return { material, uniforms }
}

/**
 * 高空 3D 体积流动积云海（y = 34~54m，r = 95~155m，随天光染霞并倒映水面）
 */
export function buildVolumetricCloudSea(ctx: DioramaBuilderCtx) {
  const clouds = new THREE.Group()
  clouds.name = 'volumetric-cloud-sea'
  const cloudMat = createMat('#f4dcd0', {
    transparent: true,
    opacity: 0.32,
    roughness: 0.95,
    depthWrite: false,
  })
  const puffGeo = new THREE.IcosahedronGeometry(3.2, 2)

  for (let i = 0; i < 16; i += 1) {
    const ang = -Math.PI * 0.88 + (i / 15) * Math.PI * 1.76
    const rad = 98 + (i % 3) * 22
    const cx = Math.sin(ang) * rad
    const cz = -Math.cos(ang) * rad * 0.88 - 18
    const cy = 34 + (i % 4) * 5.2
    const cluster = new THREE.Group()
    cluster.position.set(cx, cy, cz)

    for (let p = 0; p < 4; p += 1) {
      const puff = new THREE.Mesh(puffGeo, cloudMat)
      puff.position.set((p - 1.5) * 4.2, (p % 2) * 1.3, ((p * 7) % 3 - 1) * 1.8)
      const sx = 2.4 + (p % 2) * 0.85
      puff.scale.set(sx, 0.72, 1.35)
      puff.castShadow = false
      puff.receiveShadow = false
      cluster.add(puff)
    }

    clouds.add(cluster)
    const baseX = cx
    const speed = 0.22 + (i % 3) * 0.08
    ctx.addTick((t) => {
      cluster.position.x = baseX + Math.sin(t * 0.045 * speed + i * 1.3) * 8.5
    })
  }

  ctx.addMoodHook((mood) => {
    cloudMat.color.set(mood === 'dawn' ? '#f7dfd4' : mood === 'night' ? '#3b4e73' : '#f2c4ae')
    cloudMat.opacity = mood === 'night' ? 0.18 : 0.32
  })

  ctx.group.add(clouds)
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
    skipPlaza?: boolean
    horizonStyle?: DioramaHorizonStyle
    horizonAccent?: string
    horizonVariant?: DioramaSceneId
  },
): { water: PlinthWaterHandle | null } {
  const base = new THREE.Group()
  base.name = 'open-horizon-ground'
  if (options.horizonStyle) {
    buildHorizonRing(ctx, options.horizonStyle, options.horizonAccent ?? options.topColor, options.horizonVariant)
  }
  const bump = ctx.textures.plasterBump
  const stoneHex = options.stoneColor ?? '#28364f'
  const groundMat = createMat(options.topColor, { roughness: 0.86, bumpMap: bump })
  const outerGroundColor = new THREE.Color(options.topColor)
    .lerp(new THREE.Color(options.sideColor), 0.16)
    .getStyle()

  const outerGroundGeo = new THREE.PlaneGeometry(66, 66)
  outerGroundGeo.rotateX(-Math.PI / 2)
  const outerGroundMat = createMat(outerGroundColor, { roughness: 0.96, bumpMap: bump })
  if (!options.waterShallow || !options.waterDeep) {
    outerGroundMat.transparent = true
    outerGroundMat.depthWrite = false
    outerGroundMat.onBeforeCompile = (shader) => {
      shader.vertexShader = `varying vec3 vHorizonWorld;\n${shader.vertexShader}`
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
      shader.fragmentShader = `varying vec3 vHorizonWorld;\n${shader.fragmentShader}`
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'diffuseColor.a *= 1.0 - smoothstep(22.0, 56.0, length(vHorizonWorld.xz));\n#include <opaque_fragment>',
      )
    }
    outerGroundMat.customProgramCacheKey = () => 'open-horizon-ground-v1'
  }
  const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat)
  outerGround.position.y = options.waterShallow && options.waterDeep ? -0.18 : -0.055
  outerGround.receiveShadow = true
  base.add(outerGround)

  if (options.waterShallow && options.waterDeep) {
    const splitZ = options.waterSplitZ ?? 0.25
    const quay = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.22, 9),
      groundMat,
    )
    quay.position.set(0, 0.015, splitZ - 4.5)
    base.add(quay)

    const rearGround = new THREE.Mesh(
      new THREE.BoxGeometry(48, 0.12, 28),
      createMat(outerGroundColor, { roughness: 0.94, bumpMap: bump }),
    )
    rearGround.position.set(0, -0.075, splitZ - 14)
    base.add(rearGround)

    const quayEdge = new THREE.Mesh(
      new THREE.BoxGeometry(16.1, 0.26, 0.24),
      createMat('#d4cabd', { roughness: 0.76, bumpMap: bump }),
    )
    quayEdge.position.set(0, 0.055, splitZ)
    base.add(quayEdge)

    const stepMat = createMat(stoneHex, { roughness: 0.82, bumpMap: bump })
    for (let i = 0; i < 3; i += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.12, 0.48), stepMat)
      step.position.set(0, -0.015 - i * 0.075, splitZ + 0.28 + i * 0.42)
      base.add(step)
    }

    const bollardMat = createMat('#c99a5b', { roughness: 0.35, metalness: 0.72 })
    for (const bx of [-6, -3, 0, 3, 6]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.26, 8), bollardMat)
      b.position.set(bx, 0.3, splitZ)
      base.add(b)
    }

    const waterGeo = new THREE.PlaneGeometry(66, 66, 72, 72)
    waterGeo.rotateX(-Math.PI / 2)
    const { material: waterMat, uniforms } = createDioramaWaterMaterial(
      options.waterShallow,
      options.waterDeep,
    )
    const waterMesh = new THREE.Mesh(waterGeo, waterMat)
    waterMesh.position.y = -0.1
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
      (fogHex) => {
        uniforms.uFogColor.value.set(fogHex)
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
    outerGround.castShadow = false
    rearGround.castShadow = false
    waterMesh.castShadow = false
    ctx.group.add(base)
    return { water: { mesh: waterMesh, uniforms } }
  }

  if (!options.skipPlaza) {
    const plaza = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.2, 10),
      groundMat,
    )
    plaza.position.y = 0.005
    base.add(plaza)
  }

  enableShadows(base, true, true)
  outerGround.castShadow = false
  ctx.group.add(base)
  return { water: null }
}

export interface ForegroundDeckOptions {
  kind?: 'wood' | 'stone'
  x?: number
  width?: number
  shoreZ?: number
  frontZ?: number
  color?: string
  edgeColor?: string
  rail?: 'wood' | 'metal' | 'stone'
}

export function buildForegroundDeck(ctx: DioramaBuilderCtx, options: ForegroundDeckOptions = {}) {
  const deck = new THREE.Group()
  deck.name = 'foreground-standing-deck'
  deck.userData.foregroundDeck = true
  const kind = options.kind ?? 'wood'
  const x = options.x ?? 0
  const width = options.width ?? 5.4
  const shoreZ = options.shoreZ ?? 0.25
  const frontZ = options.frontZ ?? 4.35
  const depth = Math.max(1.2, frontZ - shoreZ)
  const centerZ = shoreZ + depth * 0.5
  const baseColor = options.color ?? (kind === 'wood' ? '#8a6244' : '#a9a79f')
  const edgeColor = options.edgeColor ?? (kind === 'wood' ? '#5c4232' : '#767b7c')
  const base = new THREE.Color(baseColor)
  const tones = [0.92, 1, 1.08].map((value) => {
    const color = base.clone()
    color.multiplyScalar(value)
    return createMat(color, { roughness: kind === 'wood' ? 0.78 : 0.9, bumpMap: ctx.textures.plasterBump })
  })
  const edgeMat = createMat(edgeColor, {
    roughness: kind === 'wood' ? 0.72 : 0.86,
    metalness: options.rail === 'metal' ? 0.58 : 0.04,
    bumpMap: ctx.textures.plasterBump,
  })
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const batches = new Map<THREE.Material, THREE.Matrix4[]>()
  const slabPosition = new THREE.Vector3()
  const slabScale = new THREE.Vector3()
  const identityQuat = new THREE.Quaternion()

  const addSlab = (sx: number, sy: number, sz: number, px: number, py: number, pz: number, material: THREE.Material) => {
    slabPosition.set(px, py, pz)
    slabScale.set(sx, sy, sz)
    const matrix = new THREE.Matrix4().compose(slabPosition, identityQuat, slabScale)
    const batch = batches.get(material) ?? []
    batch.push(matrix)
    batches.set(material, batch)
  }

  if (kind === 'wood') {
    const plankCount = Math.max(10, Math.round(width / 0.3))
    const plankWidth = width / plankCount
    for (let i = 0; i < plankCount; i += 1) {
      addSlab(
        plankWidth - 0.018,
        0.11,
        depth,
        x - width / 2 + plankWidth * (i + 0.5),
        0.075,
        centerZ,
        tones[i % tones.length],
      )
    }
    for (let z = shoreZ + 0.45; z < frontZ; z += 1.15) {
      addSlab(width + 0.12, 0.13, 0.16, x, -0.035, z, edgeMat)
    }
    for (const side of [-1, 1]) {
      for (let z = shoreZ + 0.35; z <= frontZ - 0.2; z += 1.15) {
        addSlab(0.13, 0.5, 0.13, x + side * (width / 2 - 0.08), 0.29, z, edgeMat)
      }
      addSlab(0.1, 0.1, depth - 0.15, x + side * (width / 2 - 0.08), 0.5, centerZ, edgeMat)
      addSlab(0.07, 0.07, depth - 0.15, x + side * (width / 2 - 0.08), 0.3, centerZ, edgeMat)
    }
  } else {
    const columns = Math.max(4, Math.round(width / 0.85))
    const rows = Math.max(2, Math.round(depth / 0.9))
    const slabW = width / columns
    const slabD = depth / rows
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        addSlab(
          slabW - 0.022,
          0.12,
          slabD - 0.022,
          x - width / 2 + slabW * (column + 0.5),
          0.07,
          shoreZ + slabD * (row + 0.5),
          tones[(row + column) % tones.length],
        )
      }
    }
    for (const side of [-1, 1]) {
      addSlab(0.2, 0.42, depth, x + side * (width / 2 - 0.02), 0.25, centerZ, edgeMat)
      for (let z = shoreZ + 0.5; z <= frontZ - 0.2; z += 1.4) {
        addSlab(0.28, 0.58, 0.28, x + side * (width / 2 - 0.02), 0.33, z, edgeMat)
      }
    }
  }

  for (const [material, matrices] of batches) {
    const mesh = new THREE.InstancedMesh(unitBox, material, matrices.length)
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    deck.add(mesh)
  }

  enableShadows(deck, true, true)
  ctx.group.add(deck)
  return deck
}

export function buildHorizonRing(
  ctx: DioramaBuilderCtx,
  style: DioramaHorizonStyle,
  accentHex: string,
  variant?: DioramaSceneId,
) {
  const ring = new THREE.Group()
  ring.name = `horizon-${style}`
  ring.userData.horizonStyle = style
  ring.userData.horizonVariant = variant ?? null
  const accent = new THREE.Color(accentHex)
  const nearColor = accent.clone().lerp(new THREE.Color('#5f7180'), 0.76)
  const midColor = nearColor.clone().lerp(new THREE.Color('#93a1aa'), 0.42)
  const farColor = midColor.clone().lerp(new THREE.Color('#b7c0c4'), 0.56)
  const nearMat = createMat(nearColor, { roughness: 0.96, flatShading: true })
  const midMat = createMat(midColor, { roughness: 0.96, flatShading: true })
  const farMat = createMat(farColor, { roughness: 0.96, flatShading: true })
  const matrix = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  let seed = 1907 + style.length * 97
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const addInstances = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    place: (index: number) => { position: THREE.Vector3; scale: THREE.Vector3; rotation?: number },
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    for (let i = 0; i < count; i += 1) {
      const spec = place(i)
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotation ?? 0)
      matrix.compose(spec.position, quat, spec.scale)
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = false
    mesh.receiveShadow = false
    ring.add(mesh)
    return mesh
  }

  if (style === 'skyline') {
    const skylineSpecs: { position: THREE.Vector3; scale: THREE.Vector3; rotation: number }[] = []
    for (let i = 0; i < 44; i += 1) {
      const a = (i / 44) * Math.PI * 2 + rand() * 0.08
      const r = 22 + rand() * 4
      const h = 4 + rand() * 8
      skylineSpecs.push({
        position: new THREE.Vector3(Math.sin(a) * r, h / 2 - 0.15, Math.cos(a) * r),
        scale: new THREE.Vector3(1.5 + rand() * 2.1, h, 1.8 + rand() * 2.2),
        rotation: a,
      })
    }
    addInstances(new THREE.BoxGeometry(1, 1, 1), nearMat, skylineSpecs.length, (i) => skylineSpecs[i])
    if (variant === 'paris') {
      addInstances(new THREE.ConeGeometry(1, 1, 4), midMat, skylineSpecs.length, (i) => {
        const spec = skylineSpecs[i]
        return {
          position: new THREE.Vector3(spec.position.x, spec.scale.y - 0.02, spec.position.z),
          scale: new THREE.Vector3(spec.scale.x * 0.82, 0.55 + rand() * 0.25, spec.scale.z * 0.82),
          rotation: spec.rotation + Math.PI / 4,
        }
      })
    }
    const windowMat = new THREE.MeshBasicMaterial({
      color: '#e7c895',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
    addInstances(new THREE.PlaneGeometry(0.12, 0.2), windowMat, 28, (i) => {
      const a = (i / 28) * Math.PI * 2 + rand() * 0.14
      const r = 21.7
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 1.5 + rand() * 6, Math.cos(a) * r),
        scale: new THREE.Vector3(1, 1, 1),
        rotation: a + Math.PI,
      }
    })
  } else if (style === 'mountains') {
    const layers = [
      { count: 22, radius: 21, mat: nearMat, height: 5.5 },
      { count: 18, radius: 26, mat: midMat, height: 8 },
      { count: 14, radius: 30, mat: farMat, height: 10.5 },
    ]
    for (const layer of layers) {
      addInstances(new THREE.ConeGeometry(1, 1, 5), layer.mat, layer.count, (i) => {
        const a = (i / layer.count) * Math.PI * 2 + rand() * 0.18
        const r = layer.radius + rand() * 2
        const h = layer.height * (0.62 + rand() * 0.65)
        return {
          position: new THREE.Vector3(Math.sin(a) * r, h / 2 - 0.3, Math.cos(a) * r),
          scale: new THREE.Vector3(4.5 + rand() * 3.5, h, 4 + rand() * 3),
          rotation: rand() * Math.PI,
        }
      })
    }
  } else if (style === 'islands') {
    addInstances(new THREE.ConeGeometry(1, 1, 7), nearMat, 12, (i) => {
      const a = (i / 12) * Math.PI * 2 + rand() * 0.2
      const r = 23 + rand() * 5
      const h = 1.8 + rand() * 4.2
      return {
        position: new THREE.Vector3(Math.sin(a) * r, h / 2 - 0.45, Math.cos(a) * r),
        scale: new THREE.Vector3(3 + rand() * 3, h, 2.5 + rand() * 3),
        rotation: rand() * Math.PI,
      }
    })
    addInstances(new THREE.ConeGeometry(1, 1, 6), farMat, 9, (i) => {
      const a = (i / 9) * Math.PI * 2 + 0.24
      const r = 29 + rand() * 2
      const h = 2 + rand() * 3
      return {
        position: new THREE.Vector3(Math.sin(a) * r, h / 2 - 0.6, Math.cos(a) * r),
        scale: new THREE.Vector3(4 + rand() * 2, h, 3 + rand() * 2),
        rotation: rand() * Math.PI,
      }
    })
  } else if (style === 'snowhills') {
    addInstances(new THREE.SphereGeometry(1, 12, 6), farMat, 18, (i) => {
      const a = (i / 18) * Math.PI * 2
      const r = 24 + rand() * 4
      return {
        position: new THREE.Vector3(Math.sin(a) * r, -0.7, Math.cos(a) * r),
        scale: new THREE.Vector3(4 + rand() * 3, 1.4 + rand() * 2, 3.5 + rand() * 2),
        rotation: rand() * Math.PI,
      }
    })
    addInstances(new THREE.ConeGeometry(0.5, 2.4, 6), nearMat, 38, (i) => {
      const a = (i / 38) * Math.PI * 2 + rand() * 0.14
      const r = 19 + rand() * 8
      const s = 0.7 + rand() * 0.7
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 0.8 * s, Math.cos(a) * r),
        scale: new THREE.Vector3(s, s, s),
        rotation: rand() * Math.PI,
      }
    })
  } else if (style === 'courtyard_trees') {
    addInstances(new THREE.BoxGeometry(4.6, 1.8, 0.28), nearMat, 34, (i) => {
      const a = (i / 34) * Math.PI * 2
      const r = 24
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 0.75, Math.cos(a) * r),
        scale: new THREE.Vector3(1, 1, 1),
        rotation: a,
      }
    })
    addInstances(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6), nearMat, 28, (i) => {
      const a = (i / 28) * Math.PI * 2 + rand() * 0.12
      const r = 21 + rand() * 4
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 1, Math.cos(a) * r),
        scale: new THREE.Vector3(1, 1, 1),
      }
    })
    addInstances(new THREE.IcosahedronGeometry(1, 1), midMat, 28, (i) => {
      const a = (i / 28) * Math.PI * 2 + rand() * 0.12
      const r = 21 + rand() * 4
      const s = 1.2 + rand() * 0.8
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 3.1, Math.cos(a) * r),
        scale: new THREE.Vector3(s, s * 0.85, s),
        rotation: rand() * Math.PI,
      }
    })
  } else {
    addInstances(new THREE.CylinderGeometry(1.1, 1.7, 1, 6), nearMat, 26, (i) => {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.08
      const r = 25 + rand() * 3
      const h = 7 + rand() * 7
      return {
        position: new THREE.Vector3(Math.sin(a) * r, h / 2 - 0.2, Math.cos(a) * r),
        scale: new THREE.Vector3(0.8 + rand() * 0.8, h, 0.8 + rand() * 0.8),
        rotation: rand() * Math.PI,
      }
    })
    const cavernDome = new THREE.Mesh(
      new THREE.SphereGeometry(29, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      createMat('#171a20', { roughness: 1, side: THREE.BackSide, flatShading: true }),
    )
    cavernDome.position.y = -0.4
    ring.add(cavernDome)
    const fissureMat = createMat('#6f2818', {
      emissive: '#a33c1d',
      emissiveIntensity: 0.32,
      roughness: 1,
    })
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      const fissure = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4 + rand() * 3, 0.12), fissureMat)
      fissure.position.set(Math.sin(a) * 24.5, 4.5, Math.cos(a) * 24.5)
      fissure.rotation.z = (rand() - 0.5) * 0.5
      ring.add(fissure)
    }
  }

  if (variant === 'rome') {
    addInstances(new THREE.SphereGeometry(1, 12, 6), midMat, 7, (i) => {
      const a = (i / 7) * Math.PI * 2 + 0.3
      const r = 20 + rand() * 2
      return {
        position: new THREE.Vector3(Math.sin(a) * r, -0.4, Math.cos(a) * r),
        scale: new THREE.Vector3(4 + rand() * 2, 1.5 + rand() * 1.2, 3 + rand() * 2),
        rotation: rand() * Math.PI,
      }
    })
  } else if (variant === 'griffith') {
    addInstances(new THREE.ConeGeometry(1, 1, 7), midMat, 11, (i) => {
      const a = (i / 11) * Math.PI * 2 + 0.2
      const r = 27 + rand() * 2
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 0.15, Math.cos(a) * r),
        scale: new THREE.Vector3(4 + rand() * 2, 1.1 + rand() * 0.8, 3 + rand() * 2),
        rotation: rand() * Math.PI,
      }
    })
  } else if (variant === 'harbin') {
    addInstances(new THREE.BoxGeometry(1, 1, 1), nearMat, 18, (i) => {
      const a = (i / 18) * Math.PI * 2 + 0.12
      const r = 20 + rand() * 2
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 0.55, Math.cos(a) * r),
        scale: new THREE.Vector3(1.3 + rand(), 1.1 + rand() * 0.5, 1 + rand() * 0.7),
        rotation: a,
      }
    })
    addInstances(new THREE.ConeGeometry(1, 1, 4), farMat, 18, (i) => {
      const a = (i / 18) * Math.PI * 2 + 0.12
      const r = 20.5
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 1.35, Math.cos(a) * r),
        scale: new THREE.Vector3(1.8, 0.65, 1.6),
        rotation: a + Math.PI / 4,
      }
    })
  } else if (variant === 'kyoto') {
    addInstances(new THREE.BoxGeometry(1, 1, 1), nearMat, 10, (i) => {
      const a = (i / 10) * Math.PI * 2 + 0.16
      const r = 20 + rand()
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 0.5, Math.cos(a) * r),
        scale: new THREE.Vector3(2.1, 1, 1.5),
        rotation: a,
      }
    })
    addInstances(new THREE.ConeGeometry(1, 1, 4), midMat, 10, (i) => {
      const a = (i / 10) * Math.PI * 2 + 0.16
      const r = 20.5
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 1.18, Math.cos(a) * r),
        scale: new THREE.Vector3(3, 0.42, 2.2),
        rotation: a + Math.PI / 4,
      }
    })
  } else if (variant === 'giza') {
    addInstances(new THREE.CylinderGeometry(0.06, 0.11, 2.8, 6), nearMat, 15, (i) => {
      const a = (i / 15) * Math.PI * 2 + 0.2
      const r = 24 + rand() * 2
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 1.25, Math.cos(a) * r),
        scale: new THREE.Vector3(1, 1, 1),
        rotation: (rand() - 0.5) * 0.18,
      }
    })
    addInstances(new THREE.IcosahedronGeometry(1, 0), midMat, 15, (i) => {
      const a = (i / 15) * Math.PI * 2 + 0.2
      const r = 24.5
      return {
        position: new THREE.Vector3(Math.sin(a) * r, 2.7, Math.cos(a) * r),
        scale: new THREE.Vector3(1.15, 0.28, 1.15),
        rotation: rand() * Math.PI,
      }
    })
  }

  ctx.group.add(ring)
  return ring
}

/** 真实比例环境人物剪影，总高 0.70 局部单位（世界 1.68m）。 */
export function createMiniPerson(
  coatHex: string,
  accentHex = '#ffd6a4',
  opts: { umbrella?: string; book?: boolean; hatHex?: string } = {},
) {
  const grp = new THREE.Group()
  grp.name = 'human-scale-silhouette'
  const coatMat = createMat(coatHex, { roughness: 0.82 })
  const skinMat = createMat('#f4d2b8', { roughness: 0.78 })
  const darkMat = createMat('#303640', { roughness: 0.9 })

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.27, 8), darkMat)
    leg.position.set(side * 0.052, 0.15, 0)
    grp.add(leg)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.29, 8), coatMat)
    arm.position.set(side * 0.115, 0.41, 0)
    arm.rotation.z = side * 0.08
    grp.add(arm)
  }

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.29, 10), coatMat)
  body.position.y = 0.4
  grp.add(body)

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.064, 0.018, 6, 12),
    createMat(accentHex, { roughness: 0.88 }),
  )
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = 0.535
  grp.add(scarf)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.073, 12, 10), skinMat)
  head.position.y = 0.62
  grp.add(head)

  if (opts.hatHex) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.045, 10), createMat(opts.hatHex))
    hat.position.y = 0.695
    grp.add(hat)
  }

  if (opts.book) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.035, 0.11),
      createMat('#fff0d2', { roughness: 0.8 }),
    )
    book.position.set(0.11, 0.43, 0.09)
    book.rotation.x = 0.35
    grp.add(book)
  }

  grp.updateMatrixWorld(true)
  const height = new THREE.Box3().setFromObject(grp).getSize(new THREE.Vector3()).y
  grp.scale.setScalar(0.7 / Math.max(0.001, height))
  grp.userData.realScaleHeight = 0.7

  if (opts.umbrella) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.72, 6), createMat('#d8dce6'))
    shaft.position.set(0.13, 0.48, 0.04)
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.31, 0.13, 12),
      createMat(opts.umbrella, { roughness: 0.62, side: THREE.DoubleSide }),
    )
    canopy.position.set(0.13, 0.84, 0.04)
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


// ---------------------------------------------------------------------------
// 油画笔触地面 v2：马赛克笔触地面纹理 + 实例化厚涂植被笔刷
// ---------------------------------------------------------------------------

const dummyM = new THREE.Object3D()

export interface StrokeGroundPalette {
  /** 马赛克色块色板（深→浅），8 色左右 */
  mosaic: string[]
  /** 植被笔刷色板（草叶/花丛/雪堆），可空则不种植被 */
  flora?: string[]
  /** 植被中的亮点点缀色（萤火虫般的小亮片），可空 */
  sparkle?: string
}

export interface StrokeGroundHandle {
  group: THREE.Group
  groundMesh: THREE.Mesh
  floraMesh: THREE.InstancedMesh | null
  texture: THREE.CanvasTexture
  /** 让植被随风摇摆（sway 0~1） */
  update: (elapsed: number, dt: number, sway: number) => void
}

/**
 * 程序化油画笔触马赛克地面纹理：几百片横向厚涂色块铺满画布，
 * 用于代替素色大平面，让脚下地面本身就是一幅未干油画。
 */
export function createStrokeGroundTexture(palette: StrokeGroundPalette, size = 512): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    // 非 DOM 环境（单测）回退：空纹理即可满足几何装配
    const fallback = new THREE.CanvasTexture()
    fallback.colorSpace = THREE.SRGBColorSpace
    fallback.wrapS = THREE.RepeatWrapping
    fallback.wrapT = THREE.RepeatWrapping
    return fallback
  }
  const [canvas, ctx] = createCanvas(size, size)
  if (ctx) {
    ctx.fillStyle = palette.mosaic[0]
    ctx.fillRect(0, 0, size, size)
    let seed = 6421
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    const strokes = Math.round(size * 2.4)
    for (let i = 0; i < strokes; i += 1) {
      const x = rand() * size
      const y = rand() * size
      const w = size * (0.03 + rand() * 0.1)
      const h = size * (0.008 + rand() * 0.026)
      const ang = (rand() - 0.5) * 0.5 + (y / size - 0.5) * 0.3
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(ang)
      ctx.fillStyle = palette.mosaic[Math.floor(rand() * palette.mosaic.length)]
      ctx.globalAlpha = 0.4 + rand() * 0.5
      ctx.beginPath()
      ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    if (palette.sparkle) {
      ctx.fillStyle = palette.sparkle
      for (let i = 0; i < 130; i += 1) {
        ctx.globalAlpha = 0.25 + rand() * 0.6
        ctx.fillRect(rand() * size, rand() * size, 1.6 + rand() * 2.2, 1.2 + rand() * 1.6)
      }
    }
    ctx.globalAlpha = 1
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

export interface PainterlyGroundOptions {
  /** 覆盖范围（宽，默认 64） */
  size?: number
  /** 地面 y 高度（默认 0.005） */
  y?: number
  /** 纹理重复次数（默认 7） */
  repeat?: number
  /** 植被笔刷数量（默认 0 = 不种） */
  floraCount?: number
  /** 植被覆盖半径（默认 24） */
  floraRadius?: number
  /** 植被高度（默认 0.42，漫步时约齐腰） */
  floraHeight?: number
  /** 是否接收阴影（默认 true） */
  shadows?: boolean
  /** 植被排布密度衰减（0=均匀，1=越远越稀） */
  floraFalloff?: number
}

/**
 * 油画笔触地面：马赛克纹理大平面 + 实例化厚涂植被笔刷（草叶/花丛/雪堆）。
 * 叠在 buildSculptedPlinth 的素色地面之上，让漫步时脚下也是流动油画。
 */
export function buildPainterlyGround(
  ctx: DioramaBuilderCtx,
  palette: StrokeGroundPalette,
  options: PainterlyGroundOptions = {},
): StrokeGroundHandle {
  const group = new THREE.Group()
  group.name = 'painterly-stroke-ground'
  const size = options.size ?? 64
  const y = options.y ?? 0.005
  const repeat = options.repeat ?? 7
  const texture = createStrokeGroundTexture(palette)
  texture.repeat.set(repeat, repeat)

  const groundGeo = new THREE.PlaneGeometry(size, size)
  groundGeo.rotateX(-Math.PI / 2)
  const groundMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.94,
    metalness: 0.02,
    transparent: true,
    depthWrite: false,
  })
  // 远处淡出融入地平线雾色
  groundMat.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vGroundWorld;\n${shader.vertexShader}`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = `varying vec3 vGroundWorld;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'diffuseColor.a *= 1.0 - smoothstep(20.0, 30.0, length(vGroundWorld.xz));\n#include <opaque_fragment>',
    )
  }
  groundMat.customProgramCacheKey = () => 'painterly-stroke-ground-v1'
  const groundMesh = new THREE.Mesh(groundGeo, groundMat)
  groundMesh.position.y = y
  groundMesh.receiveShadow = options.shadows ?? true
  groundMesh.castShadow = false
  group.add(groundMesh)

  // 实例化厚涂植被笔刷（竖立笔触，随风摆动）
  let floraMesh: THREE.InstancedMesh | null = null
  const floraCount = options.floraCount ?? 0
  let floraBase: Float32Array | null = null
  let floraPhase: Float32Array | null = null
  if (floraCount > 0 && palette.flora && palette.flora.length > 0) {
    const floraRadius = options.floraRadius ?? 24
    const floraHeight = options.floraHeight ?? 0.42
    const bladeGeo = new THREE.PlaneGeometry(0.16, floraHeight)
    bladeGeo.translate(0, floraHeight * 0.5, 0)
    const bladeMat = new THREE.MeshBasicMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
      color: '#ffffff',
    })
    floraMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, floraCount)
    floraMesh.frustumCulled = false
    floraBase = new Float32Array(floraCount * 3)
    floraPhase = new Float32Array(floraCount)
    let seed = 911
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    const floraColor = new THREE.Color()
    const falloff = options.floraFalloff ?? 0.4
    for (let i = 0; i < floraCount; i += 1) {
      const ang = rand() * Math.PI * 2
      const rad = Math.sqrt(rand()) * floraRadius * (1 - falloff * rand() * 0.4)
      const fx = Math.sin(ang) * rad
      const fz = Math.cos(ang) * rad
      const fh = 0.62 + rand() * 0.78
      floraBase![i * 3] = fx
      floraBase![i * 3 + 1] = y
      floraBase![i * 3 + 2] = fz
      floraPhase![i] = rand() * Math.PI * 2
      dummyM.position.set(fx, y, fz)
      dummyM.rotation.set((rand() - 0.5) * 0.24, rand() * Math.PI, (rand() - 0.5) * 0.2)
      dummyM.scale.set(0.8 + rand() * 0.9, fh, 1)
      dummyM.updateMatrix()
      floraMesh.setMatrixAt(i, dummyM.matrix)
      floraColor.set(palette.flora[Math.floor(rand() * palette.flora.length)])
      if (palette.sparkle && rand() > 0.86) floraColor.set(palette.sparkle)
      floraMesh.setColorAt(i, floraColor)
    }
    floraMesh.instanceMatrix.needsUpdate = true
    if (floraMesh.instanceColor) floraMesh.instanceColor.needsUpdate = true
    group.add(floraMesh)
  }

  ctx.group.add(group)
  ctx.addDisposeHook?.(() => {
    texture.dispose()
    groundGeo.dispose()
    groundMat.dispose()
    if (floraMesh) {
      floraMesh.geometry.dispose()
      ;(floraMesh.material as THREE.Material).dispose()
    }
  })

  return {
    group,
    groundMesh,
    floraMesh,
    texture,
    update: (elapsed, _dt, sway) => {
      if (!floraMesh || !floraBase || !floraPhase) return
      for (let i = 0; i < floraCount; i += 1) {
        const fx = floraBase[i * 3]
        const fy = floraBase[i * 3 + 1]
        const fz = floraBase[i * 3 + 2]
        const phase = floraPhase[i]
        const tilt = Math.sin(elapsed * 1.35 + phase) * (0.1 + sway * 0.42)
        dummyM.position.set(fx, fy, fz)
        dummyM.rotation.set(tilt, phase, tilt * 0.7)
        dummyM.scale.set(1, 1, 1)
        dummyM.updateMatrix()
        floraMesh.setMatrixAt(i, dummyM.matrix)
      }
      floraMesh.instanceMatrix.needsUpdate = true
    },
  }
}

// ---------------------------------------------------------------------------
// 写实场景组件 v3：连续地形 + 镜面反射水面（6 精选世界「去画改景」地基）
// ---------------------------------------------------------------------------

export interface SceneTerrainOptions {
  /** 地形边长（默认 400，边缘融入雾色与天际） */
  size?: number
  /** 地表基色 */
  color?: string
  /** 地表扰动副色（随机色块微扰，写实地面颗粒感） */
  patchColor?: string
  /** 中心平整半径（内不做起伏，默认 90） */
  flatRadius?: number
  /** 边缘起伏强度（默认 3.5） */
  relief?: number
  /** 中央广场板（宽/深/顶面高度/颜色，可选） */
  plaza?: { w: number; d: number; topY?: number; color?: string }
  /** 地形中心偏移 */
  x?: number
  z?: number
  /** 是否接收阴影（默认 true） */
  shadows?: boolean
}

export interface SceneTerrainHandle {
  group: THREE.Group
  groundMesh: THREE.Mesh
  plaza: THREE.Mesh | null
}

/**
 * 连续写实地形：一大块 400×400 地面，中心平坦供漫步与建筑，
 * 边缘轻微起伏 + 顶点色微扰直通雾色天际——替代浮空展台。
 */
export function buildSceneTerrain(
  ctx: DioramaBuilderCtx,
  options: SceneTerrainOptions = {},
): SceneTerrainHandle {
  const group = new THREE.Group()
  group.name = 'scene-terrain'
  const size = options.size ?? 400
  const flatRadius = options.flatRadius ?? 90
  const relief = options.relief ?? 3.5

  const geo = new THREE.PlaneGeometry(size, size, 110, 110)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const base = new THREE.Color(options.color ?? '#3d4438')
  const patch = new THREE.Color(options.patchColor ?? base).lerp(base, 0.001)
  let seed = 42143
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const work = new THREE.Color()
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const edge = THREE.MathUtils.smoothstep(r, flatRadius, size * 0.5)
    const bump =
      (Math.sin(x * 0.055 + Math.sin(z * 0.041) * 2.2) * Math.cos(z * 0.047 + Math.sin(x * 0.033)) * 0.5 +
        Math.sin(x * 0.021 + z * 0.017) * 0.5) *
      relief *
      edge
    pos.setY(i, bump)
    const tint = 0.82 + rand() * 0.3
    work.copy(base).lerp(patch, rand() * 0.35).multiplyScalar(tint)
    colors[i * 3] = work.r
    colors[i * 3 + 1] = work.g
    colors[i * 3 + 2] = work.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const groundMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.02,
  })
  const groundMesh = new THREE.Mesh(geo, groundMat)
  groundMesh.receiveShadow = options.shadows ?? true
  groundMesh.castShadow = false
  group.position.set(options.x ?? 0, 0, options.z ?? 0)
  group.add(groundMesh)

  let plaza: THREE.Mesh | null = null
  if (options.plaza) {
    const topY = options.plaza.topY ?? 0.35
    plaza = new THREE.Mesh(
      new THREE.BoxGeometry(options.plaza.w, 0.55, options.plaza.d),
      createMat(options.plaza.color ?? '#7c7f86', { roughness: 0.9, bumpMap: ctx.textures.plasterBump }),
    )
    plaza.position.y = topY - 0.275
    plaza.receiveShadow = true
    plaza.castShadow = false
    plaza.userData.foregroundDeck = true
    group.add(plaza)
  }

  ctx.group.add(group)
  ctx.addDisposeHook?.(() => {
    geo.dispose()
    groundMat.dispose()
  })
  return { group, groundMesh, plaza }
}

export interface SceneWaterOptions {
  /** 水面长宽 */
  width: number
  depth: number
  /** 水面高度（默认 -0.8） */
  y?: number
  /** 中心偏移 */
  x?: number
  z?: number
  deepHex?: string
  shallowHex?: string
  /** 远处融入雾色的半径（默认 170） */
  fadeRadius?: number
  /** 镜面反射（真实倒映建筑与灯光；false 时用低配 fBM 水面） */
  reflective?: boolean
}

export interface SceneWaterHandle {
  group: THREE.Group
  mesh: THREE.Mesh
  reflective: boolean
  uniforms: ReflectorWaterUniforms | WaterUniforms
  setRipple: (x: number, z: number) => void
  setBio: (bio: number) => void
}

/**
 * 写实水面：优先真实镜面反射（实时倒映城市灯光/铁塔/月色），
 * 低配环境回退到 fBM 法线波纹水面。远端融入雾色。
 */
export function buildSceneWater(
  ctx: DioramaBuilderCtx,
  options: SceneWaterOptions,
): SceneWaterHandle {
  const group = new THREE.Group()
  group.name = 'scene-water'
  const y = options.y ?? -0.8
  const fadeRadius = options.fadeRadius ?? 170
  const wantReflective = options.reflective ?? true
  const deepHex = options.deepHex ?? '#0e2438'
  const shallowHex = options.shallowHex ?? '#2e5a78'

  let mesh: THREE.Mesh | null = null
  let reflective = false
  let uniforms: ReflectorWaterUniforms | WaterUniforms | null = null

  if (wantReflective && typeof window !== 'undefined') {
    try {
      const { mesh: reflMesh, uniforms: reflUniforms } = createReflectorWater(options.width, options.depth, {
        deepHex,
        shallowHex,
        fadeRadius,
      })
      reflMesh.rotation.x = -Math.PI / 2
      reflMesh.position.set(options.x ?? 0, y, options.z ?? 0)
      reflMesh.receiveShadow = false
      group.add(reflMesh)
      mesh = reflMesh
      uniforms = reflUniforms
      reflective = true
      ctx.addTick((t, dt) => {
        reflUniforms.uTime.value = t
        reflUniforms.uRippleAge.value = Math.min(10, reflUniforms.uRippleAge.value + dt)
      })
      // 场景切换时释放反射渲染目标，避免 GPU 内存累积
      ctx.addDisposeHook?.(() => {
        const refl = reflMesh as unknown as { getRenderTarget?: () => THREE.WebGLRenderTarget }
        const rt = refl.getRenderTarget?.()
        rt?.dispose()
        const mats = reflMesh.material as THREE.Material | THREE.Material[]
        if (Array.isArray(mats)) mats.forEach((m) => m.dispose())
        else mats.dispose()
      })
    } catch {
      reflective = false
    }
  }

  if (!reflective) {
    const { material, uniforms: fbmUniforms } = createDioramaWaterMaterial(shallowHex, deepHex)
    fbmUniforms.uFadeRadius.value = fadeRadius
    const geo = new THREE.PlaneGeometry(options.width, options.depth, 64, 64)
    geo.rotateX(-Math.PI / 2)
    const fbmMesh = new THREE.Mesh(geo, material)
    fbmMesh.position.set(options.x ?? 0, y, options.z ?? 0)
    group.add(fbmMesh)
    mesh = fbmMesh
    uniforms = fbmUniforms
    ctx.addTick((t, dt) => {
      fbmUniforms.uTime.value = t
      fbmUniforms.uRippleAge.value = Math.min(10, fbmUniforms.uRippleAge.value + dt)
    })
  }

  const waterMesh = mesh as THREE.Mesh
  const waterUniforms = uniforms as ReflectorWaterUniforms
  ctx.group.add(group)
  ctx.addDisposeHook?.(() => {
    waterMesh.geometry.dispose()
  })

  const setRipple = (x: number, z: number) => {
    waterUniforms.uRipplePos.value.set(x, z)
    waterUniforms.uRippleAge.value = 0
  }
  const setBio = (bio: number) => {
    waterUniforms.uBio.value = bio
  }

  ctx.addMoodHook((mood: DioramaMood) => {
    waterUniforms.uSunCol.value.set(
      mood === 'dawn' ? '#ffe0ae' : mood === 'night' ? '#88b6ff' : '#ffb87c',
    )
  })

  return { group, mesh: waterMesh, reflective, uniforms: waterUniforms, setRipple, setBio }
}
