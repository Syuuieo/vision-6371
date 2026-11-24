import * as THREE from 'three'
import { LAKE, SHARED_UNIFORMS, shared } from '../core/ctx'
import {
  GLSL_ATMOSPHERE,
  GLSL_CLOUD_LOOKUP,
  GLSL_CLOUD_SHADOW,
  GLSL_NOISE,
  GLSL_NOISE_TEX,
  GLSL_TERRAIN_LOOKUP,
} from '../shaders/common'

const MAX_RIPPLES = 8

function makeWaveNormalTexture(): THREE.DataTexture {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  let seed = 99
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const comps: { kx: number; ky: number; a: number; p: number; g: number }[] = []
  for (let i = 0; i < 42; i += 1) {
    const kx = Math.round((rnd() * 2 - 1) * 18)
    const ky = Math.round((rnd() * 2 - 1) * 18)
    const kk = Math.hypot(kx, ky)
    if (kk < 2) continue
    comps.push({ kx, ky, a: Math.pow(kk, -1.52), p: rnd() * 6.283, g: i % 2 })
  }
  const h1 = new Float32Array(size * size)
  const hx = new Float32Array(size * size)
  const hy = new Float32Array(size * size)
  const h2 = new Float32Array(size * size)
  const tau = (2 * Math.PI) / size
  for (const c of comps) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const ph = (c.kx * x + c.ky * y) * tau + c.p
        const s = Math.sin(ph)
        const co = Math.cos(ph)
        const idx = y * size + x
        if (c.g === 0) {
          h1[idx] += c.a * s
          hx[idx] += c.a * c.kx * co
          hy[idx] += c.a * c.ky * co
        } else {
          h2[idx] += c.a * s
          hx[idx] += 0.48 * c.a * c.kx * co
          hy[idx] += 0.48 * c.a * c.ky * co
        }
      }
    }
  }
  const maxAbs = (arr: Float32Array) => {
    let m = 1e-4
    for (let i = 0; i < arr.length; i += 1) m = Math.max(m, Math.abs(arr[i]))
    return m
  }
  const mH = maxAbs(h1)
  const mS = Math.max(maxAbs(hx), maxAbs(hy))
  const mH2 = maxAbs(h2)
  for (let i = 0; i < size * size; i += 1) {
    data[i * 4] = Math.round(127.5 + 127.5 * (hx[i] / mS))
    data[i * 4 + 1] = Math.round(127.5 + 127.5 * (hy[i] / mS))
    data[i * 4 + 2] = Math.round(127.5 + 127.5 * (h1[i] / mH))
    data[i * 4 + 3] = Math.round(127.5 + 127.5 * (h2[i] / mH2))
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

interface SurfaceRing {
  mesh: THREE.Mesh
  age: number
  delay: number
  strength: number
}

/**
 * 物理感高原湖泊（参考 Petalwake `world/water.js`）：
 * - 浅水透明度 + 解析水底焦散 + 水体消光吸收 + GGX 日月高光路
 * - 实时菲涅尔倒映天空与体积积云 (`shadeCloudDeck`)
 * - 湖岸温和白沫边 + 第二幕湖畔轻划 GPU 涟漪交互 (`uRipples` + 光圈)
 */
export class LakeWater {
  private readonly material: THREE.ShaderMaterial
  private readonly rippleTex: THREE.DataTexture
  private readonly rippleArray: THREE.Vector4[] = Array.from(
    { length: MAX_RIPPLES },
    () => new THREE.Vector4(0, 0, 99, 0),
  )
  private rippleCursor = 0
  private readonly ringGroup = new THREE.Group()
  private readonly rings: SurfaceRing[] = []

  constructor(surfaceGroup: THREE.Group, pickables: THREE.Object3D[]) {
    this.rippleTex = makeWaveNormalTexture()

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared(
          'uTime',
          'uCamPos',
          'uSunDir',
          'uSunColor',
          'uSunPower',
          'uSkyZenith',
          'uSkyMid',
          'uSkyHorizon',
          'uSunHalo',
          'uAmbSky',
          'uAmbGround',
          'uFogColor',
          'uFog',
          'uGalaxy',
          'uWaterDeep',
          'uHeightTex',
          'uSplatTex',
          'uHeightRect',
          'uNoiseTex',
          'uCloudTex',
          'uCloudReady',
        ),
        uRipple: { value: this.rippleTex },
        uRipples: { value: this.rippleArray },
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
    })

    // 使用细密圆盘以支持湖心涌浪与浅滩折射
    const geometry = new THREE.CircleGeometry(1, 96)
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.rotation.x = -Math.PI / 2
    mesh.scale.set(LAKE.rx * 1.12, LAKE.rz * 1.12, 1)
    mesh.position.set(LAKE.x, LAKE.y, LAKE.z)
    mesh.frustumCulled = false
    mesh.userData.pick = 'lake'
    pickables.push(mesh)
    surfaceGroup.add(mesh)
    surfaceGroup.add(this.ringGroup)
  }

  spawnRipple(point: THREE.Vector3, strength = 1) {
    this.rippleArray[this.rippleCursor].set(point.x, point.z, 0, strength)
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES

    for (let i = 0; i < 3; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: '#c8efe2',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), material)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(point.x, LAKE.y + 0.04, point.z)
      ring.scale.setScalar(0.5)
      this.ringGroup.add(ring)
      this.rings.push({ mesh: ring, age: 0, delay: i * 0.12, strength })
    }
    if (this.rings.length > 36) {
      const old = this.rings.splice(0, this.rings.length - 36)
      for (const r of old) {
        this.ringGroup.remove(r.mesh)
        r.mesh.geometry.dispose()
        ;(r.mesh.material as THREE.Material).dispose()
      }
    }
  }

  clearRipples() {
    for (const r of this.rippleArray) r.set(0, 0, 99, 0)
    for (const r of this.rings) {
      this.ringGroup.remove(r.mesh)
      r.mesh.geometry.dispose()
      ;(r.mesh.material as THREE.Material).dispose()
    }
    this.rings.length = 0
  }

  update(dt: number) {
    for (const r of this.rippleArray) {
      if (r.z < 12) r.z += dt
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i]
      r.age += dt
      const local = r.age - r.delay
      if (local < 0) continue
      const t = local / 1.7
      if (t >= 1) {
        this.ringGroup.remove(r.mesh)
        r.mesh.geometry.dispose()
        ;(r.mesh.material as THREE.Material).dispose()
        this.rings.splice(i, 1)
        continue
      }
      r.mesh.scale.setScalar(0.6 + t * 3.4 * r.strength)
      ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.42 * r.strength
    }
  }

  dispose() {
    this.clearRipples()
    this.rippleTex.dispose()
    this.material.dispose()
    void SHARED_UNIFORMS
  }
}

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const WATER_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime;
uniform vec3 uWaterDeep;
uniform sampler2D uRipple;
uniform vec4 uRipples[8];

${GLSL_NOISE}
${GLSL_NOISE_TEX}
${GLSL_ATMOSPHERE}
${GLSL_CLOUD_SHADOW}
${GLSL_TERRAIN_LOOKUP}
${GLSL_CLOUD_LOOKUP}

void main() {
  vec3 P = vWorld;
  vec3 toCam = uCamPos - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 0.001);

  float shoreD = shoreDistAt(P.xz);
  if (shoreD > 2.4) discard;

  // 多尺度风生波纹 + 交互触水同心波偏折法线
  vec2 wDir = vec2(0.36, 0.93);
  vec4 r1 = texture2D(uRipple, P.xz / 14.0 + wDir * uTime * 0.025);
  vec4 r2 = texture2D(uRipple, P.xz.yx / 5.4 - wDir.yx * uTime * 0.036 + 0.4);
  vec4 r3 = texture2D(uRipple, P.xz / 37.0 + vec2(-0.3, 0.8) * uTime * 0.015 + 0.7);
  vec2 rip = (r1.xy - 0.5) * 0.55 + (r2.yx - 0.5) * 0.42 + (r3.xy - 0.5) * 0.45;
  float rippleFade = 1.0 / (1.0 + dist * 0.004);

  vec2 clickSlope = vec2(0.0);
  float clickRing = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 rp = uRipples[i];
    if (rp.z > 0.0 && rp.z < 2.2) {
      vec2 dv = P.xz - rp.xy;
      float d = length(dv);
      float front = rp.z * 3.8;
      float wave = exp(-pow(d - front, 2.0) * 1.4) * (1.0 - rp.z / 2.2) * rp.w;
      vec2 dir = d > 0.001 ? dv / d : vec2(0.0);
      clickSlope += dir * sin((d - front) * 5.0) * wave * 0.25;
      clickRing += wave * 0.28;
    }
  }

  vec3 N = normalize(vec3(rip.x * rippleFade * 0.14 + clickSlope.x, 1.0, rip.y * rippleFade * 0.14 + clickSlope.y));

  // 水下浅滩折射与焦散
  vec2 refr = P.xz - N.xz * 1.4;
  float bedH = terrainH(refr);
  float depth = max(P.y - bedH, 0.0);
  float cs = cloudShadow(P.xz, uTime);

  vec2 cuv = refr * 0.28 + N.xz * 0.55;
  float ca = texture2D(uRipple, cuv + vec2(uTime * 0.035, 0.0)).b;
  float cb = texture2D(uRipple, cuv * 1.37 - vec2(0.0, uTime * 0.041)).a;
  float caust = pow(saturate(1.0 - abs(ca - cb) * 2.2), 4.5) * 1.35 * exp(-depth * 0.35);

  vec3 bedCol = vec3(0.32, 0.28, 0.21) * (0.65 + 0.35 * ntex(refr * 1.8).r);
  vec3 bedLit = bedCol * (uSunColor * 0.28 * cs * (0.6 + caust) + uAmbSky * 0.52);

  float pathLen = depth * (1.0 + 1.0 / max(V.y, 0.3)) * 0.45;
  vec3 absorb = exp(-pathLen * vec3(0.55, 0.20, 0.14));
  vec3 shallowTint = mix(vec3(0.06, 0.24, 0.22), uWaterDeep, saturate(1.0 - exp(-depth * 0.32)));
  vec3 scatter = shallowTint * (uSunColor * 0.22 * cs + uAmbSky * 0.55 + vec3(0.02, 0.04, 0.04));
  vec3 body = bedLit * absorb + scatter * (vec3(1.0) - absorb * 0.85);

  // 反射天空穹 + 实时体云倒影
  float ndv = saturate(dot(N, V));
  float fresnel = 0.03 + 0.97 * pow(1.0 - ndv, 4.2);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.015;
  R = normalize(R);
  vec3 reflSky = shadeCloudDeck(skyBase(R), R, uTime);
  vec3 col = mix(body, reflSky, clamp(fresnel * 0.88 + 0.12, 0.0, 1.0));

  // GGX 日月光芒波光粼粼
  vec3 S = normalize(uSunDir);
  vec3 H = normalize(S + V);
  float ndh = saturate(dot(N, H));
  float spec = pow(ndh, 320.0) * 3.8 + pow(ndh, 28.0) * 0.22;
  col += uSunColor * spec * uSunPower * cs * 0.65;

  // 温柔湖岸涌浪泡沫线
  float foamNoise = ntex(P.xz * 4.5 + vec2(uTime * 0.08, -uTime * 0.06)).r;
  float shoreBand = exp(-max(depth, 0.0) * 2.8) * (1.0 - smoothstep(-0.3, 1.8, shoreD));
  float rippleBand = 0.5 + 0.5 * sin(depth * 7.0 - uTime * 1.4 + foamNoise * 3.0);
  float foam = saturate(shoreBand * smoothstep(0.32, 0.72, foamNoise + rippleBand * 0.32) * 0.85 + clickRing);
  vec3 foamCol = mix(uAmbSky, uSunColor * 0.45 + vec3(0.75), 0.55) * (0.45 + 0.55 * cs);
  col = mix(col, foamCol, foam * 0.75);

  col = applyAtmosphere(col, P);
  gl_FragColor = vec4(col, 1.0);
}
`
