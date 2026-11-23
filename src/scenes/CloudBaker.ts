import * as THREE from 'three'

/**
 * 分片体云烘焙器（适配《视界 6371》24 小时动态昼夜光照）
 *
 * 借鉴 Petalwake 的 Worley + 分数布朗运动光线步进云层体积算法，
 * 分 16 条水平切片在启动后前数帧内静默完成，避免首帧卡顿。
 *
 * 仅将与光照方向无关的体积密度、云体高度、顶层透光与高空卷云
 * 烘焙进 RGBA8 贴图（兼容 100% 桌面与移动端 WebGL 驱动），具体受光色温
 * （晨雾金、暮色珊瑚、午夜深靛）在天空球 Shader 中每帧实时着色。
 */
export class CloudBaker {
  private readonly renderer: THREE.WebGLRenderer
  private readonly width: number
  private readonly height: number
  private readonly strips = 16
  private readonly target: THREE.WebGLRenderTarget
  private readonly material: THREE.ShaderMaterial
  private readonly quad: THREE.Mesh
  private readonly scene = new THREE.Scene()
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private cursor = 0
  private _done = false
  private disposed = false

  constructor(renderer: THREE.WebGLRenderer, width = 1024, height = 256, steps = 40) {
    this.renderer = renderer
    this.width = width
    this.height = height

    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    })

    const tri = new THREE.BufferGeometry()
    tri.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    )

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSeed: { value: new THREE.Vector3(17.4, 6.2, 83.9) },
        uCoverage: { value: 0.44 },
        uSteps: { value: steps },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: CLOUD_BAKE_FRAG,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })

    this.quad = new THREE.Mesh(tri, this.material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }

  get texture(): THREE.Texture {
    return this.target.texture
  }

  get done(): boolean {
    return this._done
  }

  get progress(): number {
    return this._done ? 1 : this.cursor / this.strips
  }

  /** 每帧烘焙至多 n 条水平切片，返回总进度 0..1 */
  step(stripsPerFrame = 2): number {
    if (this._done || this.disposed) return 1

    const r = this.renderer
    const prevTarget = r.getRenderTarget()
    const prevAutoClear = r.autoClear

    r.autoClear = false
    this.target.scissorTest = true

    const stripH = this.height / this.strips
    for (let i = 0; i < stripsPerFrame && this.cursor < this.strips; i += 1, this.cursor += 1) {
      const y0 = Math.floor(this.cursor * stripH)
      const y1 = Math.floor((this.cursor + 1) * stripH)
      this.target.scissor.set(0, y0, this.width, Math.max(1, y1 - y0))
      r.setRenderTarget(this.target)
      r.render(this.scene, this.cam)
    }

    this.target.scissorTest = false
    r.setRenderTarget(prevTarget)
    r.autoClear = prevAutoClear

    if (this.cursor >= this.strips) {
      this._done = true
    }
    return this.cursor / this.strips
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.quad.geometry.dispose()
    this.material.dispose()
    this.target.dispose()
    this.scene.clear()
  }
}

const CLOUD_BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uSeed;
uniform float uCoverage;
uniform float uSteps;

const float RP = 520000.0;
const float H0 = 1350.0;
const float H1 = 4650.0;
const float SIGMA = 0.044;

float h13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 h33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vn2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x),
    mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float vn3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(h13(i), h13(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(h13(i + vec3(0.0, 1.0, 0.0)), h13(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(h13(i + vec3(0.0, 0.0, 1.0)), h13(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(h13(i + vec3(0.0, 1.0, 1.0)), h13(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

float fbm2d(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vn2(p);
    p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03;
    a *= 0.5;
  }
  return s / 0.9375;
}

float worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d = 1.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = h33(i + g);
        vec3 r = g + o - f;
        d = min(d, dot(r, r));
      }
    }
  }
  return 1.0 - sqrt(d);
}

float rm(float v, float a, float b) {
  return clamp((v - a) / max(b - a, 0.0001), 0.0, 1.0);
}

float coverageAt(vec2 xz) {
  vec2 q = xz / 21000.0 + uSeed.xy;
  q += 0.42 * vec2(vn2(q * 1.9 + 3.1), vn2(q * 1.9 - 7.3)) - 0.21;
  float c = fbm2d(q);
  return smoothstep(0.62 - uCoverage * 0.42, 0.86 - uCoverage * 0.30, c);
}

float density(vec3 p, float alt, int lod) {
  float hf = (alt - H0) / (H1 - H0);
  if (hf <= 0.0 || hf >= 1.0) return 0.0;
  float cov = coverageAt(p.xz);
  if (cov < 0.01) return 0.0;

  float topN = vn2(p.xz / 3400.0 + uSeed.yz);
  float top = mix(0.24, 1.0, pow(topN, 1.4) * (0.35 + 0.65 * cov));
  float prof = smoothstep(0.0, 0.055, hf) * (1.0 - smoothstep(top * 0.42, top, hf));

  vec3 q = p / 2350.0 + vec3(0.0, uSeed.z, 0.0);
  q.y *= 1.25;
  float shape = worley(q) * 0.62 + vn3(q * 2.15 + 5.0) * 0.26 + vn3(q * 4.3) * 0.12;
  float base = rm(shape, 1.0 - cov * prof * 0.92, 1.0);
  if (base <= 0.0) return 0.0;
  if (lod == 0) {
    float det = vn3(q * 6.5 + 2.0) * 0.65 + vn3(q * 12.0) * 0.35;
    base = rm(base, det * 0.38, 1.0);
  }
  return base * mix(0.75, 1.25, hf);
}

vec2 shell(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  float az = (vUv.x - 0.5) * 6.2831853;
  float el = vUv.y * vUv.y * 1.5707963;
  vec3 rd = vec3(cos(az) * cos(el), sin(el), sin(az) * cos(el));
  vec3 C = vec3(0.0, -RP, 0.0);
  vec3 ro = vec3(0.0, 80.0, 0.0);

  float T = 1.0;
  float accAlt = 0.0;
  float accLight = 0.0;
  float accWeight = 0.0;
  vec3 lightDir = normalize(vec3(0.24, 0.94, -0.24));

  float t0 = shell(ro - C, rd, RP + H0).y;
  float t1 = shell(ro - C, rd, RP + H1).y;
  if (t0 > 0.0 && t1 > t0) {
    t1 = min(t1, t0 + 46000.0);
    int totalSteps = int(uSteps);
    float dt = (t1 - t0) / uSteps;
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float t = t0 + dt * jitter;

    for (int i = 0; i < 64; i++) {
      if (i >= totalSteps) break;
      vec3 p = ro + rd * t;
      float alt = length(p - C) - RP;
      float d = density(p, alt, 0);
      if (d > 0.002) {
        float od = 0.0;
        float ls = 120.0;
        vec3 lp = p;
        for (int j = 0; j < 4; j++) {
          lp += lightDir * ls;
          float la = length(lp - C) - RP;
          od += density(lp, la, 1) * ls;
          ls *= 1.85;
        }
        float hf = clamp((alt - H0) / (H1 - H0), 0.0, 1.0);
        float beer = max(exp(-od * SIGMA), 0.58 * exp(-od * SIGMA * 0.24));
        float powder = 1.0 - exp(-d * 90.0 * SIGMA * 2.0);
        float topLit = beer * mix(0.95, powder, 0.35);

        float fogT = exp(-t * 2.2e-5);
        float a = 1.0 - exp(-d * SIGMA * dt);
        float w = T * a * mix(0.65, 1.0, fogT);

        accAlt += w * hf;
        accLight += w * topLit;
        accWeight += w;

        T *= 1.0 - a;
        if (T < 0.015) break;
      }
      t += dt;
    }
  }

  float cumulusCov = clamp(1.0 - T, 0.0, 1.0);
  float normW = max(accWeight, 0.0001);
  float avgAlt = cumulusCov > 0.002 ? clamp(accAlt / normW, 0.0, 1.0) : 0.5;
  float avgLight = cumulusCov > 0.002 ? clamp(accLight / normW, 0.0, 1.0) : 0.8;

  float cirrus = 0.0;
  float tc = shell(ro - C, rd, RP + 9400.0).y;
  if (tc > 0.0) {
    vec3 p = ro + rd * tc;
    vec2 q = p.xz / 9000.0 + uSeed.zx;
    q = mat2(0.82, 0.57, -0.57, 0.82) * q;
    q += 0.5 * vec2(vn2(q * 0.7 + 2.0), vn2(q * 0.7 - 5.0));
    float streak = fbm2d(vec2(q.x * 0.55, q.y * 3.2));
    float sheet = fbm2d(q * 0.33 + 9.0);
    cirrus = smoothstep(0.50, 0.85, streak) * smoothstep(0.42, 0.70, sheet);
    cirrus *= 0.62 * exp(-tc * 1.2e-5);
  }

  float hz = smoothstep(0.0, 0.04, rd.y);
  gl_FragColor = vec4(
    cumulusCov * hz,
    avgAlt,
    avgLight,
    clamp(cirrus * hz, 0.0, 1.0)
  );
}
`
