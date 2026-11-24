import * as THREE from 'three'
import { GLSL_TONEMAP } from '../shaders/common'
import { SHARED_UNIFORMS } from './ctx'

const TRI_GEO = (() => {
  const g = new THREE.BufferGeometry()
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  )
  return g
})()

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

function makePassMat(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  })
}

export interface PipelineParams {
  exposure: number
  bloom: number
  distortion: number
  fringe: number
  vignette: number
  rays: number
  saturation: number
  contrast: number
  speed: number
}

/**
 * 电影级 HDR 后处理管线（参考 Petalwake `core/pipeline.js`）。
 *
 * 链路：HDR SceneTarget (带 DepthTexture)
 *     → Jimenez 13-tap 降采样 + 3×3 tent 升采样 Bloom 金字塔
 *     → 深度遮挡屏幕空间圣光（God Rays）
 *     → 迎风疾行镜头呼吸畸变 / 边缘色散 / 暗角 / Stephen Hill ACES 色调映射 + IGN 去色带抖动。
 */
export class CinemaPipeline {
  private readonly renderer: THREE.WebGLRenderer
  readonly reversed: boolean
  private readonly supportsHalfFloat: boolean
  private readonly size = new THREE.Vector2(1, 1)
  private readonly quad: THREE.Mesh
  private readonly quadScene = new THREE.Scene()
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  private sceneRT: THREE.WebGLRenderTarget | null = null
  private bloomDown: THREE.WebGLRenderTarget[] = []
  private bloomUp: THREE.WebGLRenderTarget[] = []
  private raysRT: THREE.WebGLRenderTarget | null = null
  private depthTex: THREE.DepthTexture | null = null

  private readonly downMat: THREE.ShaderMaterial
  private readonly upMat: THREE.ShaderMaterial
  private readonly raysMat: THREE.ShaderMaterial
  private readonly finalMat: THREE.ShaderMaterial

  private lowDetail = false
  private calmMotion = false
  private readonly sunProj = new THREE.Vector3()
  private readonly camDir = new THREE.Vector3()

  readonly params: PipelineParams = {
    exposure: 1.0,
    bloom: 0.14,
    distortion: 0.045,
    fringe: 0.0009,
    vignette: 0.24,
    rays: 0.42,
    saturation: 1.08,
    contrast: 1.03,
    speed: 0,
  }

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.reversed = renderer.capabilities.reversedDepthBuffer === true
    this.supportsHalfFloat =
      renderer.capabilities.isWebGL2 &&
      (renderer.extensions.has('EXT_color_buffer_half_float') ||
        renderer.extensions.has('EXT_color_buffer_float'))

    this.downMat = makePassMat(DOWN_FRAG, {
      tColor: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uFirst: { value: 0 },
    })

    this.quad = new THREE.Mesh(TRI_GEO, this.downMat)
    this.quad.frustumCulled = false
    this.quadScene.add(this.quad)

    this.upMat = makePassMat(UP_FRAG, {
      tColor: { value: null },
      tAdd: { value: null },
      uTexel: { value: new THREE.Vector2() },
    })

    this.raysMat = makePassMat(RAYS_FRAG, {
      tColor: { value: null },
      tDepth: { value: null },
      uSun: { value: new THREE.Vector3() },
      uAspect: { value: 1 },
      uFar: { value: this.reversed ? 0 : 1 },
      uTime: SHARED_UNIFORMS.uTime,
    })

    this.finalMat = makePassMat(FINAL_FRAG, {
      tColor: { value: null },
      tBloom: { value: null },
      tRays: { value: null },
      uExposure: { value: 1 },
      uBloom: { value: 0.14 },
      uDistort: { value: 0.045 },
      uFringe: { value: 0.0009 },
      uVignette: { value: 0.24 },
      uRays: { value: 0.42 },
      uSunColor: SHARED_UNIFORMS.uSunColor,
      uSat: { value: 1.08 },
      uContrast: { value: 1.03 },
      uRes: { value: this.size },
      uTime: SHARED_UNIFORMS.uTime,
      uSpeed: { value: 0 },
    })
  }

  setQuality(lowDetail: boolean, calmMotion: boolean) {
    const changed = this.lowDetail !== lowDetail
    this.lowDetail = lowDetail
    this.calmMotion = calmMotion
    if (changed && this.size.x > 1 && this.size.y > 1) {
      const w = this.size.x
      const h = this.size.y
      this.size.set(0, 0)
      this.setSize(w, h, 1)
    }
  }

  setSize(cssW: number, cssH: number, pixelRatio: number) {
    const w = Math.max(8, Math.round(cssW * pixelRatio))
    const h = Math.max(8, Math.round(cssH * pixelRatio))
    if (w === this.size.x && h === this.size.y && this.sceneRT) return
    this.size.set(w, h)
    this.disposeTargets()

    const rtType = this.supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType
    const depth = new THREE.DepthTexture(w, h, THREE.FloatType)
    depth.format = THREE.DepthFormat
    this.depthTex = depth

    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: rtType,
      format: THREE.RGBAFormat,
      samples: this.supportsHalfFloat && !this.lowDetail ? 2 : 0,
      depthBuffer: true,
      depthTexture: depth,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    })

    const maxLevels = this.lowDetail ? 3 : 5
    let bw = Math.max(4, w >> 1)
    let bh = Math.max(4, h >> 1)
    for (let i = 0; i < maxLevels && bw > 4 && bh > 4; i += 1) {
      this.bloomDown.push(
        new THREE.WebGLRenderTarget(bw, bh, {
          type: rtType,
          format: THREE.RGBAFormat,
          depthBuffer: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          generateMipmaps: false,
        }),
      )
      bw >>= 1
      bh >>= 1
    }
    this.bloomUp = this.bloomDown.slice(0, -1).map((rt) => rt.clone())

    this.raysRT = new THREE.WebGLRenderTarget(Math.max(4, w >> 1), Math.max(4, h >> 1), {
      type: rtType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    })

    this.raysMat.uniforms.tDepth.value = depth
  }

  private blit(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.quadScene, this.quadCam)
  }

  render(world: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (!this.sceneRT || !this.raysRT) return
    const r = this.renderer
    const p = this.params

    // 1. 主世界 HDR 渲染
    r.setRenderTarget(this.sceneRT)
    r.render(world, camera)

    // 2. Jimenez 13-tap Bloom 金字塔
    let bloomTex: THREE.Texture = this.sceneRT.texture
    if (this.bloomDown.length >= 2) {
      let src = this.sceneRT.texture
      for (let i = 0; i < this.bloomDown.length; i += 1) {
        const rt = this.bloomDown[i]
        this.downMat.uniforms.tColor.value = src
        this.downMat.uniforms.uTexel.value.set(1 / (rt.width * 2), 1 / (rt.height * 2))
        this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0
        this.blit(this.downMat, rt)
        src = rt.texture
      }
      for (let i = this.bloomDown.length - 2; i >= 0; i -= 1) {
        const rt = this.bloomUp[i]
        this.upMat.uniforms.tColor.value = src
        this.upMat.uniforms.tAdd.value = this.bloomDown[i].texture
        this.upMat.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height)
        this.blit(this.upMat, rt)
        src = rt.texture
      }
      bloomTex = src
    }

    // 3. 深度遮挡屏幕空间圣光（省电档 / 减弱动效 / 夜晚关闭）
    const enableRays =
      !this.lowDetail &&
      !this.calmMotion &&
      SHARED_UNIFORMS.uSunPower.value > 0.16 &&
      SHARED_UNIFORMS.uFog.value.z < 0.5
    let raysStrength = 0
    if (enableRays) {
      const sun = this.sunProj
        .copy(SHARED_UNIFORMS.uSunDir.value)
        .multiplyScalar(1e5)
        .add(camera.position)
        .project(camera)
      camera.getWorldDirection(this.camDir)
      const facing = this.camDir.dot(SHARED_UNIFORMS.uSunDir.value)
      const alt = Math.max(0, Math.min(1, SHARED_UNIFORMS.uSunDir.value.y * 3.4))
      const rawGain = Math.max(0, (facing - 0.12) / 0.88) * alt
      if (rawGain > 0.002) {
        this.raysMat.uniforms.tColor.value = this.sceneRT.texture
        this.raysMat.uniforms.uSun.value.set(sun.x * 0.5 + 0.5, sun.y * 0.5 + 0.5, rawGain)
        this.raysMat.uniforms.uAspect.value = this.size.x / Math.max(1, this.size.y)
        this.blit(this.raysMat, this.raysRT)
        raysStrength = p.rays
      }
    }

    // 4. 镜头色散 / 呼吸畸变 / 暗角 / ACES / sRGB 输出到屏幕
    const f = this.finalMat.uniforms
    f.tColor.value = this.sceneRT.texture
    f.tBloom.value = bloomTex
    f.tRays.value = this.raysRT.texture
    f.uExposure.value = p.exposure
    f.uBloom.value = this.lowDetail ? p.bloom * 0.72 : p.bloom
    f.uDistort.value = this.calmMotion ? 0 : p.distortion
    f.uFringe.value = this.calmMotion ? 0 : p.fringe
    f.uVignette.value = p.vignette
    f.uRays.value = raysStrength
    f.uSat.value = p.saturation
    f.uContrast.value = p.contrast
    f.uSpeed.value = this.calmMotion ? 0 : p.speed
    this.blit(this.finalMat, null)
  }

  private disposeTargets() {
    this.sceneRT?.dispose()
    this.sceneRT = null
    this.raysRT?.dispose()
    this.raysRT = null
    this.depthTex?.dispose()
    this.depthTex = null
    for (const rt of this.bloomDown) rt.dispose()
    for (const rt of this.bloomUp) rt.dispose()
    this.bloomDown = []
    this.bloomUp = []
  }

  dispose() {
    this.disposeTargets()
    this.downMat.dispose()
    this.upMat.dispose()
    this.raysMat.dispose()
    this.finalMat.dispose()
    this.quadScene.clear()
  }
}

const DOWN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uFirst;

vec3 pre(vec3 c) {
  if (uFirst < 0.5) return c;
  if (any(isnan(c)) || any(isinf(c))) return vec3(0.0);
  c = clamp(c, vec3(0.0), vec3(40.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - 0.88, 0.0);
  float soft = k * k / (k + 0.9);
  return c * (soft / max(l, 1e-4)) + c * 0.035;
}

void main() {
  vec2 t = uTexel;
  vec3 a = pre(texture2D(tColor, vUv + t * vec2(-2.0, 2.0)).rgb);
  vec3 b = pre(texture2D(tColor, vUv + t * vec2(0.0, 2.0)).rgb);
  vec3 c = pre(texture2D(tColor, vUv + t * vec2(2.0, 2.0)).rgb);
  vec3 d = pre(texture2D(tColor, vUv + t * vec2(-2.0, 0.0)).rgb);
  vec3 e = pre(texture2D(tColor, vUv).rgb);
  vec3 f = pre(texture2D(tColor, vUv + t * vec2(2.0, 0.0)).rgb);
  vec3 g = pre(texture2D(tColor, vUv + t * vec2(-2.0, -2.0)).rgb);
  vec3 h = pre(texture2D(tColor, vUv + t * vec2(0.0, -2.0)).rgb);
  vec3 i = pre(texture2D(tColor, vUv + t * vec2(2.0, -2.0)).rgb);
  vec3 j = pre(texture2D(tColor, vUv + t * vec2(-1.0, 1.0)).rgb);
  vec3 k = pre(texture2D(tColor, vUv + t * vec2(1.0, 1.0)).rgb);
  vec3 l = pre(texture2D(tColor, vUv + t * vec2(-1.0, -1.0)).rgb);
  vec3 m = pre(texture2D(tColor, vUv + t * vec2(1.0, -1.0)).rgb);
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}
`

const UP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAdd;
uniform vec2 uTexel;

void main() {
  vec2 t = uTexel * 2.0;
  vec3 s = texture2D(tColor, vUv).rgb * 4.0;
  s += (
    texture2D(tColor, vUv + vec2(t.x, 0.0)).rgb +
    texture2D(tColor, vUv - vec2(t.x, 0.0)).rgb +
    texture2D(tColor, vUv + vec2(0.0, t.y)).rgb +
    texture2D(tColor, vUv - vec2(0.0, t.y)).rgb
  ) * 2.0;
  s +=
    texture2D(tColor, vUv + t).rgb +
    texture2D(tColor, vUv - t).rgb +
    texture2D(tColor, vUv + vec2(t.x, -t.y)).rgb +
    texture2D(tColor, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(s / 16.0 * 0.92 + texture2D(tAdd, vUv).rgb, 1.0);
}
`

const RAYS_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec3 uSun;
uniform float uAspect;
uniform float uFar;
uniform float uTime;

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  if (uSun.z <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec2 d = uSun.xy - vUv;
  vec2 da = vec2(d.x * uAspect, d.y);
  float dist = length(da);
  const int N = 24;
  vec2 stepv = d / float(N) * 0.85;
  float j = ign(gl_FragCoord.xy + fract(uTime * 0.37) * 37.0);
  vec2 uv = vUv + stepv * j;
  float acc = 0.0;
  float decay = 1.0;
  for (int i = 0; i < N; i++) {
    vec2 q = clamp(uv, 0.0, 1.0);
    float z = texture2D(tDepth, q).r;
    float sky = smoothstep(0.0005, 0.0, abs(z - uFar));
    vec3 c = texture2D(tColor, q).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    acc += sky * min(l, 5.0) * decay;
    decay *= 0.95;
    uv += stepv;
  }
  acc /= float(N);
  float fall = exp(-dist * 1.5);
  gl_FragColor = vec4(vec3(acc * fall * uSun.z), 1.0);
}
`

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tRays;
uniform float uExposure;
uniform float uBloom;
uniform float uDistort;
uniform float uFringe;
uniform float uVignette;
uniform float uRays;
uniform vec3 uSunColor;
uniform float uSat;
uniform float uContrast;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpeed;

${GLSL_TONEMAP}

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

vec2 lens(vec2 uv, float k) {
  if (k <= 0.0001) return uv;
  vec2 c = uv - 0.5;
  float asp = uRes.x / max(uRes.y, 1.0);
  vec2 q = c * vec2(asp, 1.0) / (0.5 * sqrt(asp * asp + 1.0));
  return 0.5 + c * (1.0 + k * dot(q, q)) / (1.0 + k);
}

void main() {
  float k = uDistort * (1.0 + 0.85 * uSpeed);
  vec2 uv = lens(vUv, k);
  vec2 c = vUv - 0.5;
  float asp = uRes.x / max(uRes.y, 1.0);
  float r = length(vec2(c.x * asp, c.y)) / (0.5 * length(vec2(asp, 1.0)));

  vec3 col;
  if (uFringe > 0.00001) {
    vec2 dir = c * uFringe * (0.4 + 1.8 * uSpeed) * (0.2 + r * r * 2.6);
    col.r = texture2D(tColor, clamp(lens(vUv + dir, k), 0.0, 1.0)).r;
    col.g = texture2D(tColor, clamp(uv, 0.0, 1.0)).g;
    col.b = texture2D(tColor, clamp(lens(vUv - dir, k), 0.0, 1.0)).b;
  } else {
    col = texture2D(tColor, clamp(uv, 0.0, 1.0)).rgb;
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);

  col += texture2D(tBloom, clamp(uv, 0.0, 1.0)).rgb * uBloom;
  if (uRays > 0.001) {
    col += texture2D(tRays, clamp(uv, 0.0, 1.0)).rgb * uRays * uSunColor * 0.08;
  }

  col *= uExposure;
  float v = 1.0 - uVignette * smoothstep(0.32, 1.18, r) * (0.75 + 0.25 * r);
  col *= v;

  col = acesFilm(col * 0.94);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  col += (l - 0.5) * vec3(0.012, 0.004, -0.016);
  col = clamp(col, 0.0, 1.0);
  col = toSRGB(col);
  col += (ign(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`
