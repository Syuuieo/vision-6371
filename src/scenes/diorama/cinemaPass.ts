import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

export interface CinemaGodRayUniforms {
  tDiffuse: { value: THREE.Texture | null }
  uSunScreenPos: { value: THREE.Vector2 }
  uSunVisibility: { value: number }
  uGodRayIntensity: { value: number }
  uSunColor: { value: THREE.Color }
  uVignette: { value: number }
  uTime: { value: number }
  uGrain: { value: number }
}

/**
 * 35mm IMAX 屏幕空间体积丁达尔光束 + 电影冷暖分离 + 柔和暗角与微颗粒后期通道
 */
export function createCinemaGodRayPass(): {
  pass: ShaderPass
  uniforms: CinemaGodRayUniforms
} {
  const uniforms: CinemaGodRayUniforms = {
    tDiffuse: { value: null },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.56) },
    uSunVisibility: { value: 0.75 },
    uGodRayIntensity: { value: 0.28 },
    uSunColor: { value: new THREE.Color('#ff9d6c') },
    uVignette: { value: 0.24 },
    uTime: { value: 0 },
    uGrain: { value: 0.012 },
  }

  const shader = {
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uSunScreenPos;
      uniform float uSunVisibility;
      uniform float uGodRayIntensity;
      uniform vec3 uSunColor;
      uniform float uVignette;
      uniform float uTime;
      uniform float uGrain;
      varying vec2 vUv;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec4 baseTex = texture2D(tDiffuse, vUv);
        vec3 col = baseTex.rgb;

        if (uSunVisibility > 0.01 && uGodRayIntensity > 0.005) {
          vec2 delta = (vUv - uSunScreenPos) * (0.72 / 20.0);
          vec2 coord = vUv;
          float decay = 1.0;
          float rayAccum = 0.0;
          for (int i = 0; i < 20; i++) {
            coord -= delta;
            vec2 clampedCoord = clamp(coord, 0.002, 0.998);
            vec3 samp = texture2D(tDiffuse, clampedCoord).rgb;
            float lum = dot(samp, vec3(0.299, 0.587, 0.114));
            float bright = smoothstep(0.68, 1.02, lum);
            rayAccum += bright * decay * 0.068;
            decay *= 0.93;
          }
          float sunDist = length(vUv - uSunScreenPos);
          float falloff = smoothstep(1.15, 0.06, sunDist);
          col += uSunColor * rayAccum * falloff * uGodRayIntensity * uSunVisibility;
        }

        // 克制 35mm 电影冷暖色分离（暗部微青蓝，高光微暖金）
        float baseLum = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 shadowTint = vec3(0.08, 0.15, 0.25);
        vec3 highlightTint = vec3(1.0, 0.91, 0.80);
        col = mix(col, mix(col, shadowTint, 0.12), (1.0 - smoothstep(0.0, 0.36, baseLum)) * 0.32);
        col = mix(col, col * highlightTint, smoothstep(0.55, 1.0, baseLum) * 0.14);

        // 柔和胶片暗角
        float distFromCenter = length(vUv - 0.5) * 1.414;
        float vig = smoothstep(0.98, 0.34, distFromCenter);
        col *= mix(1.0 - uVignette, 1.0, vig);

        // 微弱胶片颗粒
        float grain = (hash12(vUv * 820.0 + fract(uTime * 17.3)) - 0.5) * uGrain;
        col += grain;

        gl_FragColor = vec4(max(col, vec3(0.0)), baseTex.a);
      }
    `,
  }

  const pass = new ShaderPass(shader)
  return { pass, uniforms }
}

export interface SolarProfile {
  hour: number
  sunDir: [number, number, number]
  sunElev: number
  nightFactor: number
  godRayStrength: number
  zenith: string
  mid: string
  horizon: string
  sun: string
  key: string
  fill: string
  hemiTop: string
  hemiBot: string
  keyInt: number
  hemiInt: number
  stars: number
}

interface SolarKeyframe {
  hour: number
  azimuth: number
  elev: number
  nightFactor: number
  godRayStrength: number
  zenith: string
  mid: string
  horizon: string
  sun: string
  key: string
  fill: string
  hemiTop: string
  hemiBot: string
  keyInt: number
  hemiInt: number
  stars: number
}

const SOLAR_KEYFRAMES: readonly SolarKeyframe[] = [
  {
    hour: 5.0,
    azimuth: 0.14,
    elev: 0.06,
    nightFactor: 0.55,
    godRayStrength: 0.22,
    zenith: '#182b4d',
    mid: '#52688c',
    horizon: '#cfa09c',
    sun: '#ff9674',
    key: '#ffd1b6',
    fill: '#6f92c8',
    hemiTop: '#b8cbe8',
    hemiBot: '#24304a',
    keyInt: 1.5,
    hemiInt: 0.92,
    stars: 0.28,
  },
  {
    hour: 6.3,
    azimuth: 0.1,
    elev: 0.11,
    nightFactor: 0.15,
    godRayStrength: 0.34,
    zenith: '#3c5e86',
    mid: '#94a6c0',
    horizon: '#eed2c4',
    sun: '#ff7d56',
    key: '#ffe2c6',
    fill: '#92b8e6',
    hemiTop: '#e6effc',
    hemiBot: '#34445e',
    keyInt: 2.1,
    hemiInt: 1.12,
    stars: 0.0,
  },
  {
    hour: 10.5,
    azimuth: 0.28,
    elev: 0.52,
    nightFactor: 0.0,
    godRayStrength: 0.18,
    zenith: '#215898',
    mid: '#6ba4d6',
    horizon: '#dceaf6',
    sun: '#fff2d8',
    key: '#fff6e4',
    fill: '#9cc8f4',
    hemiTop: '#eaf4ff',
    hemiBot: '#3b4e68',
    keyInt: 2.45,
    hemiInt: 1.24,
    stars: 0.0,
  },
  {
    hour: 15.5,
    azimuth: -0.22,
    elev: 0.42,
    nightFactor: 0.0,
    godRayStrength: 0.24,
    zenith: '#274d80',
    mid: '#6e94be',
    horizon: '#f0cfa8',
    sun: '#ffe0a8',
    key: '#ffe6be',
    fill: '#8cb6e8',
    hemiTop: '#e2ecfb',
    hemiBot: '#35455e',
    keyInt: 2.25,
    hemiInt: 1.14,
    stars: 0.0,
  },
  {
    hour: 18.1,
    azimuth: -0.04,
    elev: 0.115,
    nightFactor: 0.28,
    godRayStrength: 0.36,
    zenith: '#232c4c',
    mid: '#6c5c7c',
    horizon: '#e8b49c',
    sun: '#ff6e48',
    key: '#ffc69c',
    fill: '#7094ce',
    hemiTop: '#cad6f2',
    hemiBot: '#222d46',
    keyInt: 1.95,
    hemiInt: 0.98,
    stars: 0.18,
  },
  {
    hour: 19.6,
    azimuth: -0.08,
    elev: 0.05,
    nightFactor: 0.84,
    godRayStrength: 0.03,
    zenith: '#061844',
    mid: '#0e3078',
    horizon: '#173d88',
    sun: '#edd29c',
    key: '#a6c4f6',
    fill: '#4d78c8',
    hemiTop: '#8db4f2',
    hemiBot: '#182644',
    keyInt: 1.44,
    hemiInt: 0.88,
    stars: 0.82,
  },
  {
    hour: 23.5,
    azimuth: -0.04,
    elev: 0.16,
    nightFactor: 1.0,
    godRayStrength: 0.02,
    zenith: '#05153d',
    mid: '#0c2a6c',
    horizon: '#14387e',
    sun: '#f4e6a8',
    key: '#b6cff8',
    fill: '#4d78ca',
    hemiTop: '#92b8f6',
    hemiBot: '#152340',
    keyInt: 1.36,
    hemiInt: 0.84,
    stars: 0.98,
  },
]

const cA = new THREE.Color()
const cB = new THREE.Color()

function lerpHex(hexA: string, hexB: string, t: number): string {
  cA.set(hexA)
  cB.set(hexB)
  cA.lerp(cB, t)
  return `#${cA.getHexString()}`
}

/**
 * 24 小时连续太阳轨迹与天光色板插值（5.0 ~ 23.5）
 */
export function computeSolarProfile(rawHour: number): SolarProfile {
  const hour = Math.min(23.5, Math.max(5.0, Number.isFinite(rawHour) ? rawHour : 18.1))
  let a = SOLAR_KEYFRAMES[0]
  let b = SOLAR_KEYFRAMES[SOLAR_KEYFRAMES.length - 1]
  for (let i = 0; i < SOLAR_KEYFRAMES.length - 1; i += 1) {
    if (hour >= SOLAR_KEYFRAMES[i].hour && hour <= SOLAR_KEYFRAMES[i + 1].hour) {
      a = SOLAR_KEYFRAMES[i]
      b = SOLAR_KEYFRAMES[i + 1]
      break
    }
  }
  const span = Math.max(0.0001, b.hour - a.hour)
  const rawT = Math.min(1, Math.max(0, (hour - a.hour) / span))
  const t = rawT * rawT * (3 - 2 * rawT)

  const az = a.azimuth + (b.azimuth - a.azimuth) * t
  const elev = a.elev + (b.elev - a.elev) * t
  const horiz = Math.sqrt(Math.max(0.05, 1 - elev * elev))
  const sx = Math.sin(az) * horiz
  const sz = -Math.cos(az) * horiz
  const len = Math.max(0.0001, Math.hypot(sx, elev, sz))

  return {
    hour,
    sunDir: [sx / len, elev / len, sz / len],
    sunElev: elev,
    nightFactor: a.nightFactor + (b.nightFactor - a.nightFactor) * t,
    godRayStrength: a.godRayStrength + (b.godRayStrength - a.godRayStrength) * t,
    zenith: lerpHex(a.zenith, b.zenith, t),
    mid: lerpHex(a.mid, b.mid, t),
    horizon: lerpHex(a.horizon, b.horizon, t),
    sun: lerpHex(a.sun, b.sun, t),
    key: lerpHex(a.key, b.key, t),
    fill: lerpHex(a.fill, b.fill, t),
    hemiTop: lerpHex(a.hemiTop, b.hemiTop, t),
    hemiBot: lerpHex(a.hemiBot, b.hemiBot, t),
    keyInt: a.keyInt + (b.keyInt - a.keyInt) * t,
    hemiInt: a.hemiInt + (b.hemiInt - a.hemiInt) * t,
    stars: a.stars + (b.stars - a.stars) * t,
  }
}
