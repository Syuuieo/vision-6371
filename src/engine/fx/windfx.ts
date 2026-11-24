import * as THREE from 'three'
import { LAKE, SHARED_UNIFORMS, clamp, heightAt, shared } from '../core/ctx'
import { GLSL_ATMOSPHERE, GLSL_NOISE } from '../shaders/common'

interface SkyBird {
  group: THREE.Group
  radius: number
  speed: number
  angle: number
  baseY: number
  phase: number
  wings: [THREE.Mesh, THREE.Mesh]
}

interface WindRibbon {
  mesh: THREE.Mesh
  geo: THREE.BufferGeometry
  points: number
  x0: number
  z0: number
  yOffset: number
  phase: number
  speed: number
}

/**
 * 动态风带、飘浮花瓣花粉、蒲公英、晚雨、流萤、飞鸟与指针游离微光（借鉴 Petalwake `fx/windfx.js`）。
 */
export class WindFX {
  private readonly noiseData: Uint8Array
  private readonly noiseSize: number
  private readonly pixelUniform = { value: 1 }

  private readonly ribbons: WindRibbon[] = []
  private readonly ribbonMat: THREE.ShaderMaterial

  private readonly pollenMat: THREE.ShaderMaterial
  private readonly pollenOpacity = { value: 0.75 }
  private readonly petalMat: THREE.ShaderMaterial
  private readonly petalOpacity = { value: 0 }
  private readonly petalBurst = { value: 0 }

  private readonly dandelion: {
    points: THREE.Points
    mat: THREE.ShaderMaterial
    positions: Float32Array
    velocities: Float32Array
    life: Float32Array
    active: boolean
  }

  private readonly fireflies: {
    points: THREE.Points
    mat: THREE.ShaderMaterial
    level: number
    target: number
  }

  private readonly rainGroup = new THREE.Group()
  private readonly rainMat: THREE.ShaderMaterial
  private rainIntensity = 0
  private rainTarget = 0

  private readonly hoverMotes: {
    points: THREE.Points
    mat: THREE.ShaderMaterial
    positions: Float32Array
    alphas: Float32Array
    life: Float32Array
    velocities: Float32Array
  }

  private readonly skyBirds: SkyBird[] = []
  private calmMotion = false

  constructor(
    surfaceGroup: THREE.Group,
    glowTexture: THREE.Texture,
    noiseData: Uint8Array,
    noiseSize: number,
    lowDetail: boolean,
    pixelRatio: number,
  ) {
    this.noiseData = noiseData
    this.noiseSize = noiseSize
    this.pixelUniform.value = pixelRatio

    this.ribbonMat = this.buildRibbons(surfaceGroup, lowDetail)
    this.pollenMat = this.buildPollen(surfaceGroup, lowDetail)
    this.petalMat = this.buildPetals(surfaceGroup)
    this.dandelion = this.buildDandelion(surfaceGroup, glowTexture, lowDetail)
    this.fireflies = this.buildFireflies(surfaceGroup, glowTexture, lowDetail)
    this.rainMat = this.buildRain(surfaceGroup, lowDetail)
    this.hoverMotes = this.buildHoverMotes(surfaceGroup)
    this.buildBirds(surfaceGroup, glowTexture)
  }

  setPixelRatio(pixelRatio: number) {
    this.pixelUniform.value = pixelRatio
  }

  setCalmMotion(calm: boolean) {
    this.calmMotion = calm
    for (const r of this.ribbons) r.mesh.visible = !calm
  }

  private sampleNoise(u: number, v: number, ch: number) {
    const s = this.noiseSize
    const d = this.noiseData
    let x = (u * s) % s
    let y = (v * s) % s
    if (x < 0) x += s
    if (y < 0) y += s
    const ix = x | 0
    const iy = y | 0
    const tx = x - ix
    const ty = y - iy
    const ix1 = (ix + 1) % s
    const iy1 = (iy + 1) % s
    const a = d[(iy * s + ix) * 4 + ch]
    const b = d[(iy * s + ix1) * 4 + ch]
    const c = d[(iy1 * s + ix) * 4 + ch]
    const e = d[(iy1 * s + ix1) * 4 + ch]
    return ((a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty) / 255
  }

  gustAt(x: number, z: number, time: number) {
    const w = SHARED_UNIFORMS.uWind.value
    const ax = x * w.x + z * w.y
    const ay = -x * w.y + z * w.x
    const g1 = this.sampleNoise(((ax - time * 6.5) * 1.4) / 256, (ay * 0.45 * 1.4) / 256, 0)
    const g2 = this.sampleNoise(((ax - time * 10.5) * 3.8) / 256 + 0.31, (ay * 0.6 * 3.8) / 256 + 0.31, 1)
    const g = g1 * 0.7 + g2 * 0.3
    const s = clamp((g - 0.28) / 0.5, 0, 1)
    return s * s * (3 - 2 * s)
  }

  private buildRibbons(surfaceGroup: THREE.Group, lowDetail: boolean) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared('uTime', 'uCamPos', 'uSunColor', 'uSkyHorizon', 'uFogColor', 'uFog', 'uGalaxy'),
        uBoost: { value: 0.35 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uBoost;
        varying vec2 vUv;
        varying vec3 vWorld;
        ${GLSL_NOISE}
        ${GLSL_ATMOSPHERE}
        void main() {
          float headTail = sin(vUv.x * 3.14159265);
          float edge = pow(sin(vUv.y * 3.14159265), 1.6);
          float pulse = 0.65 + 0.35 * sin(vUv.x * 8.0 - uTime * 3.4);
          float alpha = pow(headTail, 1.4) * edge * pulse * uBoost * (1.0 - uGalaxy * 0.55);
          if (alpha < 0.004) discard;
          vec3 tint = mix(vec3(0.86, 0.94, 0.98), uSunColor * 0.7 + vec3(0.45), 0.42);
          tint = applyAtmosphere(tint, vWorld);
          gl_FragColor = vec4(tint, alpha);
        }
      `,
    })

    const count = lowDetail ? 3 : 5
    const points = 26
    const anchors: [number, number, number][] = [
      [-14, -22, 1.9],
      [8, -32, 2.3],
      [20, -18, 2.6],
      [-26, -40, 2.1],
      [-4, -14, 1.6],
    ]

    for (let i = 0; i < count; i += 1) {
      const [x0, z0, yOffset] = anchors[i]
      const positions = new Float32Array(points * 2 * 3)
      const uvs = new Float32Array(points * 2 * 2)
      const indices: number[] = []
      for (let p = 0; p < points; p += 1) {
        const u = p / (points - 1)
        uvs[p * 4] = u
        uvs[p * 4 + 1] = 0
        uvs[p * 4 + 2] = u
        uvs[p * 4 + 3] = 1
        if (p < points - 1) {
          const a = p * 2
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geo.setIndex(indices)

      const mesh = new THREE.Mesh(geo, mat)
      mesh.frustumCulled = false
      mesh.renderOrder = 3
      surfaceGroup.add(mesh)

      this.ribbons.push({
        mesh,
        geo,
        points,
        x0,
        z0,
        yOffset,
        phase: i * 1.45,
        speed: 0.72 + i * 0.14,
      })
    }
    return mat
  }

  private buildPollen(surfaceGroup: THREE.Group, lowDetail: boolean) {
    const count = lowDetail ? 160 : 320
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    const palette = [new THREE.Color('#ffd9a0'), new THREE.Color('#bff5d6'), new THREE.Color('#fff2cc')]

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * 46
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 10
      const y = heightAt(x, z) + 0.3 + Math.random() * 3.4
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      const c = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      seeds[i] = Math.random()
      sizes[i] = 0.75 + Math.random() * 1.9
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: SHARED_UNIFORMS.uTime,
        uOpacity: this.pollenOpacity,
        uPixel: this.pixelUniform,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float t = uTime * (0.12 + aSeed * 0.22);
          p.x += sin(t * 1.3 + aSeed * 33.0) * 0.9;
          p.z += cos(t * 1.1 + aSeed * 21.0) * 0.9;
          p.y += sin(t * 1.8 + aSeed * 41.0) * 0.55;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (95.0 / max(1.0, -mv.z)), 7.0 * uPixel);
          vAlpha = 0.25 + 0.55 * (0.5 + 0.5 * sin(uTime * (0.7 + aSeed) + aSeed * 50.0));
          vColor = aColor;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.02, 0.5, d);
          gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    surfaceGroup.add(points)
    return material
  }

  private buildPetals(surfaceGroup: THREE.Group) {
    const count = 120
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 1.6
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0.8 + Math.random() * 1.2
      positions[i * 3 + 2] = Math.sin(angle) * radius
      seeds[i] = Math.random()
      sizes[i] = 0.7 + Math.random() * 1.5
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: SHARED_UNIFORMS.uTime,
        uOpacity: this.petalOpacity,
        uBurst: this.petalBurst,
        uPixel: this.pixelUniform,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        uniform float uBurst;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float speed = (0.12 + aSeed * 0.16) * (1.0 + uBurst * 1.5);
          float life = fract(uTime * speed + aSeed);
          p.y += life * (3.0 + uBurst * 3.0);
          p.x += sin((uTime + aSeed * 10.0) * 1.15) * life * (0.8 + uBurst);
          p.z += cos((uTime * 0.9 + aSeed * 7.0)) * life * (0.7 + uBurst);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (60.0 / max(1.0, -mv.z)), 12.0 * uPixel);
          vAlpha = (1.0 - life) * (0.55 + 0.45 * sin(aSeed * 40.0 + uTime));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.05, 0.5, d);
          gl_FragColor = vec4(1.0, 0.78, 0.58, a * vAlpha * uOpacity * 0.9);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.position.set(-3.8, heightAt(-3.8, -8.5), -8.5)
    points.frustumCulled = false
    surfaceGroup.add(points)
    return material
  }

  private buildDandelion(surfaceGroup: THREE.Group, glowTexture: THREE.Texture, lowDetail: boolean) {
    const count = lowDetail ? 110 : 180
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const life = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) sizes[i] = 10 + Math.random() * 14

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixel: this.pixelUniform,
        uMap: { value: glowTexture },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        uniform float uPixel;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPixel * (22.0 / max(1.0, -mv.z)), 2.0, 44.0 * uPixel);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vLife;
        void main() {
          if (vLife <= 0.01) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float alpha = tex.a * smoothstep(0.0, 0.35, vLife) * 0.92;
          gl_FragColor = vec4(vec3(1.0, 0.96, 0.84), alpha);
        }
      `,
    })

    const points = new THREE.Points(geometry, mat)
    points.frustumCulled = false
    points.visible = false
    surfaceGroup.add(points)
    return { points, mat, positions, velocities, life, active: false }
  }

  private buildFireflies(surfaceGroup: THREE.Group, glowTexture: THREE.Texture, lowDetail: boolean) {
    const count = lowDetail ? 85 : 140
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const x = -18 + Math.random() * 44
      const z = -44 + Math.random() * 34
      positions[i * 3] = x
      positions[i * 3 + 1] = Math.max(LAKE.y + 0.6, heightAt(x, z) + 0.45 + Math.random() * 2.6)
      positions[i * 3 + 2] = z
      phases[i] = Math.random() * Math.PI * 2
      sizes[i] = 12 + Math.random() * 14
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: SHARED_UNIFORMS.uTime,
        uLevel: { value: 0 },
        uPixel: this.pixelUniform,
        uMap: { value: glowTexture },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uLevel;
        uniform float uPixel;
        varying float vGlow;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.55 + aPhase) * 0.85;
          p.y += sin(uTime * 0.9 + aPhase * 1.7) * 0.45;
          p.z += cos(uTime * 0.48 + aPhase * 1.3) * 0.85;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 3.1), 2.0);
          vGlow = pulse * uLevel;
          gl_PointSize = clamp(aSize * uPixel * (26.0 / max(1.0, -mv.z)) * (0.65 + 0.55 * pulse), 2.0, 48.0 * uPixel);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vGlow;
        void main() {
          if (vGlow <= 0.01) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          vec3 col = mix(vec3(0.56, 0.96, 0.72), vec3(1.0, 0.92, 0.58), 0.35);
          gl_FragColor = vec4(col, tex.a * vGlow * 0.95);
        }
      `,
    })

    const points = new THREE.Points(geometry, mat)
    points.frustumCulled = false
    points.visible = false
    surfaceGroup.add(points)
    return { points, mat, level: 0, target: 0 }
  }

  private buildRain(surfaceGroup: THREE.Group, lowDetail: boolean) {
    const count = lowDetail ? 1100 : 2200
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 48
      positions[i * 3 + 1] = (Math.random() - 0.5) * 28
      positions[i * 3 + 2] = (Math.random() - 0.5) * 48
      seeds[i] = Math.random()
      sizes[i] = 0.8 + Math.random() * 1.4
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: SHARED_UNIFORMS.uTime,
        uOpacity: { value: 0 },
        uPixel: this.pixelUniform,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixel;
        varying float vAlpha;
        void main() {
          float fall = mod(position.y - uTime * 22.0 + aSeed * 28.0, 28.0) - 14.0;
          vec3 p = vec3(position.x + sin(uTime * 0.45 + aSeed * 30.0) * 0.7, fall, position.z);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (110.0 / max(1.0, -mv.z)), 5.5 * uPixel);
          vAlpha = 0.45 + 0.55 * aSeed;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float ax = 1.0 - smoothstep(0.02, 0.12, abs(p.x));
          float ay = 1.0 - smoothstep(0.2, 0.5, abs(p.y));
          gl_FragColor = vec4(0.78, 0.88, 1.0, ax * ay * vAlpha * uOpacity * 0.9);
        }
      `,
    })

    const points = new THREE.Points(geometry, mat)
    points.frustumCulled = false
    this.rainGroup.add(points)
    this.rainGroup.visible = false
    surfaceGroup.add(this.rainGroup)
    return mat
  }

  private buildHoverMotes(surfaceGroup: THREE.Group) {
    const count = 110
    const positions = new Float32Array(count * 3)
    const alphas = new Float32Array(count)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const palette = [
      new THREE.Color('#ffe2b0'),
      new THREE.Color('#b6f5d8'),
      new THREE.Color('#d4e5ff'),
      new THREE.Color('#ffd0df'),
    ]
    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 1] = -999
      sizes[i] = 1.1 + Math.random() * 1.9
      const c = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixel: this.pixelUniform },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        attribute vec3 aColor;
        uniform float uPixel;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * uPixel * (80.0 / max(1.0, -mv.z)), 8.0 * uPixel);
          vAlpha = aAlpha;
          vColor = aColor;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(vColor, a * vAlpha * 0.85);
        }
      `,
    })

    const points = new THREE.Points(geometry, mat)
    points.frustumCulled = false
    surfaceGroup.add(points)
    return {
      points,
      mat,
      positions,
      alphas,
      life: new Float32Array(count),
      velocities: new Float32Array(count),
    }
  }

  private buildBirds(surfaceGroup: THREE.Group, glowTexture: THREE.Texture) {
    const wingGeo = new THREE.PlaneGeometry(0.55, 0.22)
    wingGeo.translate(0.275, 0, 0)
    const wingMat = new THREE.MeshBasicMaterial({
      color: '#fff3dc',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    for (let i = 0; i < 5; i += 1) {
      const birdGroup = new THREE.Group()
      const leftWing = new THREE.Mesh(wingGeo, wingMat)
      leftWing.rotation.x = Math.PI / 2
      leftWing.rotation.y = Math.PI
      const rightWing = new THREE.Mesh(wingGeo, wingMat)
      rightWing.rotation.x = Math.PI / 2
      birdGroup.add(leftWing, rightWing)

      const birdGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: '#ffe6bd',
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      birdGlow.scale.setScalar(1.2)
      birdGroup.add(birdGlow)

      surfaceGroup.add(birdGroup)
      this.skyBirds.push({
        group: birdGroup,
        radius: 18 + i * 5.2,
        speed: 0.11 + (i % 3) * 0.03,
        angle: (i / 5) * Math.PI * 2,
        baseY: 14 + i * 2.6,
        phase: i * 1.4,
        wings: [leftWing, rightWing],
      })
    }
  }

  spawnHoverMotes(point: THREE.Vector3, amount = 4) {
    let spawned = 0
    for (let i = 0; i < this.hoverMotes.life.length && spawned < amount; i += 1) {
      if (this.hoverMotes.life[i] > 0.05) continue
      this.hoverMotes.life[i] = 0.7 + Math.random() * 0.55
      this.hoverMotes.velocities[i] = 0.22 + Math.random() * 0.5
      this.hoverMotes.positions[i * 3] = point.x + (Math.random() - 0.5) * 0.9
      this.hoverMotes.positions[i * 3 + 1] = point.y + 0.16 + Math.random() * 0.35
      this.hoverMotes.positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.9
      this.hoverMotes.alphas[i] = 0.85
      spawned += 1
    }
    if (spawned > 0) {
      const geo = this.hoverMotes.points.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAlpha.needsUpdate = true
    }
  }

  triggerHeroPetals() {
    this.petalBurst.value = 1
    this.petalOpacity.value = 1
  }

  blowDandelion(strength = 1) {
    const originA = new THREE.Vector3(3.2, heightAt(3.2, -17.5) + 1.45, -17.5)
    const originB = new THREE.Vector3(11.4, heightAt(11.4, -20.5) + 1.65, -20.5)
    const count = this.dandelion.life.length
    for (let i = 0; i < count; i += 1) {
      const origin = i % 2 === 0 ? originB : originA
      const spread = 3.2
      this.dandelion.positions[i * 3] = origin.x + (Math.random() - 0.5) * spread
      this.dandelion.positions[i * 3 + 1] = origin.y + (Math.random() - 0.35) * 1.2
      this.dandelion.positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread
      const drift = 0.65 + Math.random() * 0.95
      this.dandelion.velocities[i * 3] = (-2.6 - Math.random() * 2.4) * drift * strength
      this.dandelion.velocities[i * 3 + 1] = (0.7 + Math.random() * 1.4) * drift * strength
      this.dandelion.velocities[i * 3 + 2] = (-2.2 - Math.random() * 2.2) * drift * strength
      this.dandelion.life[i] = 0.75 + Math.random() * 0.55
    }
    this.dandelion.points.geometry.attributes.position.needsUpdate = true
    this.dandelion.points.geometry.attributes.aLife.needsUpdate = true
    this.dandelion.active = true
    this.dandelion.points.visible = true
  }

  startRain() {
    this.rainTarget = 1
    this.rainGroup.visible = true
  }

  stopRain() {
    this.rainTarget = 0
  }

  setFireflyLevel(level: number) {
    this.fireflies.target = clamp(level / 3, 0, 1)
    if (level > 0) this.fireflies.points.visible = true
  }

  hideForDescent() {
    this.rainTarget = 0
    this.setFireflyLevel(0)
    this.dandelion.active = false
    this.dandelion.points.visible = false
  }

  update(
    dt: number,
    elapsed: number,
    cameraPos: THREE.Vector3,
    windLevel: number,
    galaxy: number,
    speedNorm: number,
  ) {
    // 1. 风带轨迹随迎风速度与风力动态铺展
    if (!this.calmMotion) {
      const boostTarget = clamp(0.18 + (windLevel - 0.55) * 0.35 + speedNorm * 0.32, 0.16, 0.65)
      this.ribbonMat.uniforms.uBoost.value +=
        (boostTarget - this.ribbonMat.uniforms.uBoost.value) * Math.min(1, dt * 3)
      const wDirX = SHARED_UNIFORMS.uWind.value.x
      const wDirZ = SHARED_UNIFORMS.uWind.value.y
      const pX = -wDirZ
      const pZ = wDirX
      for (const r of this.ribbons) {
        if (!r.mesh.visible) continue
        const pos = r.geo.attributes.position as THREE.BufferAttribute
        const flow = elapsed * r.speed * (1 + speedNorm * 0.85) + r.phase
        for (let i = 0; i < r.points; i += 1) {
          const t = i / (r.points - 1)
          const along = (t - 0.5) * 28 + Math.sin(flow * 0.35) * 6
          const lateral = Math.sin(t * 4.5 - flow * 1.1 + r.phase) * (2.2 + t * 1.4)
          const cx = r.x0 + wDirX * along + pX * lateral
          const cz = r.z0 + wDirZ * along + pZ * lateral
          const cy = heightAt(cx, cz) + r.yOffset + Math.sin(t * 6.0 - flow * 1.4) * 0.55
          const halfW = (0.09 + 0.14 * Math.sin(t * Math.PI)) * (1 + speedNorm * 0.35)
          pos.setXYZ(i * 2, cx - pX * halfW, cy, cz - pZ * halfW)
          pos.setXYZ(i * 2 + 1, cx + pX * halfW, cy + 0.03, cz + pZ * halfW)
        }
        pos.needsUpdate = true
      }
    }

    // 2. 花粉与第一幕花瓣
    this.pollenOpacity.value = (0.4 + windLevel * 0.16) * (1 - galaxy * 0.72)
    this.petalOpacity.value = Math.min(1, this.petalOpacity.value + dt * 0.15 * this.petalBurst.value)

    // 3. 高空飞鸟
    for (const bird of this.skyBirds) {
      bird.angle += bird.speed * dt
      const bx = -12 + Math.cos(bird.angle) * bird.radius
      const bz = -36 + Math.sin(bird.angle) * bird.radius * 0.72
      const by = bird.baseY + Math.sin(elapsed * 0.8 + bird.phase) * 1.2
      bird.group.position.set(bx, by, bz)
      bird.group.rotation.y = -bird.angle
      const flap = Math.sin(elapsed * 5.2 + bird.phase) * 0.42
      bird.wings[0].rotation.z = flap
      bird.wings[1].rotation.z = -flap
    }

    // 4. 蒲公英种子
    if (this.dandelion.active) {
      let alive = false
      const count = this.dandelion.life.length
      for (let i = 0; i < count; i += 1) {
        if (this.dandelion.life[i] <= 0) continue
        alive = true
        this.dandelion.life[i] = Math.max(0, this.dandelion.life[i] - dt * 0.16)
        const sway = Math.sin(elapsed * 2.1 + i * 0.7) * 0.55
        this.dandelion.positions[i * 3] += (this.dandelion.velocities[i * 3] + sway) * dt
        this.dandelion.positions[i * 3 + 1] +=
          (this.dandelion.velocities[i * 3 + 1] + Math.cos(elapsed * 1.8 + i) * 0.28) * dt
        this.dandelion.positions[i * 3 + 2] += this.dandelion.velocities[i * 3 + 2] * dt
        this.dandelion.velocities[i * 3 + 1] *= 1 - dt * 0.18
      }
      this.dandelion.points.geometry.attributes.position.needsUpdate = true
      this.dandelion.points.geometry.attributes.aLife.needsUpdate = true
      if (!alive) {
        this.dandelion.active = false
        this.dandelion.points.visible = false
      }
    }

    // 5. 流萤
    this.fireflies.level += (this.fireflies.target - this.fireflies.level) * Math.min(1, dt * 1.8)
    this.fireflies.mat.uniforms.uLevel.value = this.fireflies.level
    if (this.fireflies.target === 0 && this.fireflies.level < 0.01) {
      this.fireflies.level = 0
      this.fireflies.points.visible = false
    }

    // 6. 暮雨
    if (this.rainGroup.visible || this.rainTarget > 0) {
      this.rainIntensity += (this.rainTarget - this.rainIntensity) * Math.min(1, dt * 1.8)
      this.rainMat.uniforms.uOpacity.value = this.rainIntensity
      this.rainGroup.position.set(cameraPos.x, cameraPos.y + 8, cameraPos.z)
      if (this.rainTarget === 0 && this.rainIntensity < 0.015) {
        this.rainIntensity = 0
        this.rainGroup.visible = false
      }
    }

    // 7. 拂草与交互微粒
    let changed = false
    for (let i = 0; i < this.hoverMotes.life.length; i += 1) {
      if (this.hoverMotes.life[i] <= 0) continue
      this.hoverMotes.life[i] = Math.max(0, this.hoverMotes.life[i] - dt * 0.55)
      this.hoverMotes.positions[i * 3 + 1] += this.hoverMotes.velocities[i] * dt
      this.hoverMotes.velocities[i] *= 1 - dt * 0.7
      this.hoverMotes.alphas[i] = this.hoverMotes.life[i] * 0.9
      changed = true
    }
    if (changed) {
      const geo = this.hoverMotes.points.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAlpha.needsUpdate = true
    }
  }

  resetToSurface() {
    this.rainTarget = 0
    this.rainIntensity = 0
    this.rainMat.uniforms.uOpacity.value = 0
    this.rainGroup.visible = false
    this.hoverMotes.life.fill(0)
    this.hoverMotes.alphas.fill(0)
    this.hoverMotes.points.geometry.attributes.aAlpha.needsUpdate = true
    this.dandelion.active = false
    this.dandelion.life.fill(0)
    this.dandelion.points.geometry.attributes.aLife.needsUpdate = true
    this.dandelion.points.visible = false
    this.fireflies.level = 0
    this.fireflies.target = 0
    this.fireflies.mat.uniforms.uLevel.value = 0
    this.fireflies.points.visible = false
    this.petalOpacity.value = 0
    this.petalBurst.value = 0
  }

  dispose() {
    this.ribbonMat.dispose()
    this.pollenMat.dispose()
    this.petalMat.dispose()
    this.dandelion.mat.dispose()
    this.fireflies.mat.dispose()
    this.rainMat.dispose()
    this.hoverMotes.mat.dispose()
  }
}
