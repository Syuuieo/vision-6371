import * as THREE from 'three'
import {
  LAKE,
  ROAM_CENTER,
  SHARED_UNIFORMS,
  WORLD_TRAILS,
  distanceToSegmentSq2D,
  heightAt,
  normalAt,
  shared,
  smoothstep,
} from '../core/ctx'
import {
  GLSL_ATMOSPHERE,
  GLSL_CLOUD_SHADOW,
  GLSL_MEADOW,
  GLSL_NOISE,
  GLSL_NOISE_TEX,
  GLSL_TERRAIN_LOOKUP,
  GLSL_WIND_WAKE,
} from '../shaders/common'

export interface ClearZone {
  x: number
  z: number
  radius: number
}

/**
 * 统一草原地形、远景群山轮廓与边界雾。
 *
 * 借鉴 Petalwake `terrain.js`：
 * - 从同一张 512×512 烘焙纹理提供高程(RG)、障碍净空(B) 与岸线距离(A)；
 * - 生成 512×512 `uSplatTex` 分布图，使地形上的远景花潮、湿地岸滩、
 *   碎石陡坡、阵风高光、云影与三维草花海在光影与色相上 100% 统一。
 */
export class TerrainWorld {
  readonly terrainMesh: THREE.Mesh
  private readonly terrainMat: THREE.ShaderMaterial
  private readonly mountainMats: THREE.ShaderMaterial[] = []
  private readonly mistMat: THREE.ShaderMaterial
  private heightTex: THREE.DataTexture | null = null
  private splatTex: THREE.DataTexture | null = null

  constructor(surfaceGroup: THREE.Group, roamRadius: number, lowDetail: boolean) {
    const { mesh, material } = this.buildTerrainMesh(lowDetail)
    this.terrainMesh = mesh
    this.terrainMat = material
    surfaceGroup.add(mesh)

    this.buildMountains(surfaceGroup)
    this.mistMat = this.buildMistBoundary(surfaceGroup, roamRadius)
  }

  /** 在所有地标与彩蛋放置完成后烘焙精确的高度、净空遮罩与花海分布图 */
  bakeFields(clearZones: ClearZone[], lowDetail = false) {
    const resolution = lowDetail ? 512 : 768
    const span = 600
    const origin = { x: -span / 2, z: -42 - span / 2 }
    const texel = span / resolution
    const heightData = new Uint8Array(resolution * resolution * 4)
    const splatData = new Uint8Array(resolution * resolution * 4)
    const nVec = new THREE.Vector3()

    const fractNoise = (x: number, z: number) => {
      const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
      return s - Math.floor(s)
    }

    const smoothNoise = (x: number, z: number) => {
      const ix = Math.floor(x)
      const iz = Math.floor(z)
      const fx = x - ix
      const fz = z - iz
      const ux = fx * fx * (3 - 2 * fx)
      const uz = fz * fz * (3 - 2 * fz)
      const a = fractNoise(ix, iz)
      const b = fractNoise(ix + 1, iz)
      const c = fractNoise(ix, iz + 1)
      const d = fractNoise(ix + 1, iz + 1)
      return (a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz
    }

    for (let j = 0; j < resolution; j += 1) {
      const z = origin.z + ((j + 0.5) / resolution) * span
      for (let i = 0; i < resolution; i += 1) {
        const x = origin.x + ((i + 0.5) / resolution) * span
        const y = heightAt(x, z)
        normalAt(x, z, nVec, 0.9)
        const slope = 1 - nVec.y

        const encoded = Math.round(Math.min(1, Math.max(0, (y + 20) / 40)) * 65535)
        const offset = (j * resolution + i) * 4
        heightData[offset] = Math.floor(encoded / 256)
        heightData[offset + 1] = encoded % 256

        const lakeDX = (x - LAKE.x) / (LAKE.rx * 1.03)
        const lakeDZ = (z - LAKE.z) / (LAKE.rz * 1.03)
        const lakeEllip = Math.sqrt(lakeDX * lakeDX + lakeDZ * lakeDZ)
        const inWater = y < LAKE.y + 0.32
        const shoreGlow = Math.max(0, 1 - smoothstep(0.45, 0.95, y - LAKE.y))
        let trailClear = 0
        if (!inWater) {
          for (const trail of WORLD_TRAILS) {
            const pts = trail.points
            for (let s = 0; s < pts.length - 1; s += 1) {
              const dSq = distanceToSegmentSq2D(
                x,
                z,
                pts[s][0],
                pts[s][1],
                pts[s + 1][0],
                pts[s + 1][1],
              )
              const w = trail.width
              if (dSq < w * w * 1.9) {
                const dist = Math.sqrt(dSq)
                trailClear = Math.max(trailClear, 1 - smoothstep(w * 0.48, w * 1.18, dist))
              }
            }
          }
        }
        heightData[offset + 2] = inWater
          ? 255
          : Math.max(Math.round(shoreGlow * 140), Math.round(trailClear * 205))

        // A 通道编码到湖面的有符号距离 [-28m, +28m]
        const approxShoreDist = (lakeEllip - 1) * 58
        const signed = Math.max(-28, Math.min(28, approxShoreDist))
        heightData[offset + 3] = Math.round(((signed / 28) * 0.5 + 0.5) * 255)

        // Splat 通道：R 野花聚落密度, G 物种分区, B 近湖湿润度, A 坡岩度
        const patch = smoothNoise(x * 0.048 + 3.7, z * 0.048 - 5.2)
        const species = smoothNoise(x * 0.025 + 11.4, z * 0.025 + 2.8)
        const wet = 1 - smoothstep(0.2, 4.2, y - LAKE.y)
        const rock = smoothstep(0.11, 0.29, slope)

        splatData[offset] = inWater
          ? 0
          : Math.round(smoothstep(0.32, 0.78, patch) * (1 - rock) * 255)
        splatData[offset + 1] = Math.round(species * 255)
        splatData[offset + 2] = Math.round(wet * 255)
        splatData[offset + 3] = Math.round(rock * 255)
      }
    }

    const stampClear = (x: number, z: number, radius: number) => {
      const minX = Math.max(0, Math.floor((x - radius - origin.x) / texel))
      const maxX = Math.min(resolution - 1, Math.ceil((x + radius - origin.x) / texel))
      const minZ = Math.max(0, Math.floor((z - radius - origin.z) / texel))
      const maxZ = Math.min(resolution - 1, Math.ceil((z + radius - origin.z) / texel))
      for (let j = minZ; j <= maxZ; j += 1) {
        const wz = origin.z + ((j + 0.5) / resolution) * span
        for (let i = minX; i <= maxX; i += 1) {
          const wx = origin.x + ((i + 0.5) / resolution) * span
          const d = Math.hypot(wx - x, wz - z)
          if (d >= radius) continue
          const falloff = Math.pow(1 - d / radius, 1.8) * 255
          const offset = (j * resolution + i) * 4
          heightData[offset + 2] = Math.max(heightData[offset + 2], Math.round(falloff))
          splatData[offset] = Math.min(splatData[offset], Math.round((1 - falloff / 255) * 255))
        }
      }
    }

    for (const zone of clearZones) {
      stampClear(zone.x, zone.z, zone.radius)
    }

    const hTex = new THREE.DataTexture(
      heightData,
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    )
    hTex.minFilter = THREE.LinearFilter
    hTex.magFilter = THREE.LinearFilter
    hTex.wrapS = THREE.ClampToEdgeWrapping
    hTex.wrapT = THREE.ClampToEdgeWrapping
    hTex.needsUpdate = true

    const sTex = new THREE.DataTexture(
      splatData,
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    )
    sTex.minFilter = THREE.LinearFilter
    sTex.magFilter = THREE.LinearFilter
    sTex.wrapS = THREE.ClampToEdgeWrapping
    sTex.wrapT = THREE.ClampToEdgeWrapping
    sTex.needsUpdate = true

    this.heightTex?.dispose()
    this.splatTex?.dispose()
    this.heightTex = hTex
    this.splatTex = sTex

    SHARED_UNIFORMS.uHeightTex.value = hTex
    SHARED_UNIFORMS.uSplatTex.value = sTex
    SHARED_UNIFORMS.uHeightRect.value.set(origin.x, origin.z, span, 1 / span)
  }

  private buildTerrainMesh(lowDetail: boolean) {
    const half = 520
    const centerZ = -42
    const segments = lowDetail ? 140 : 210
    const stride = segments + 1
    const warp = (t: number) => {
      const a = Math.abs(t)
      return Math.sign(t) * (0.12 * a + 0.88 * a * a * a) * half
    }

    const positions = new Float32Array(stride * stride * 3)
    const normals = new Float32Array(stride * stride * 3)
    const indices: number[] = []
    const tmpN = new THREE.Vector3()

    for (let iz = 0; iz < stride; iz += 1) {
      const z = centerZ + warp((iz / segments) * 2 - 1)
      for (let ix = 0; ix < stride; ix += 1) {
        const x = warp((ix / segments) * 2 - 1)
        const y = heightAt(x, z)
        normalAt(x, z, tmpN, 0.9)
        const i = iz * stride + ix
        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = z
        normals[i * 3] = tmpN.x
        normals[i * 3 + 1] = tmpN.y
        normals[i * 3 + 2] = tmpN.z
      }
    }
    for (let iz = 0; iz < segments; iz += 1) {
      for (let ix = 0; ix < segments; ix += 1) {
        const a = iz * stride + ix
        const b = a + 1
        const c = a + stride
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setIndex(indices)

    const material = new THREE.ShaderMaterial({
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
          'uHeightTex',
          'uSplatTex',
          'uHeightRect',
          'uNoiseTex',
          'uWind',
          'uWakeTex',
          'uWake',
          'uGrassTip',
          'uWaterY',
        ),
      },
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.name = 'terrain-meadow'
    return { mesh, material }
  }

  private buildMountains(surfaceGroup: THREE.Group) {
    const makeRidge = (
      radius: number,
      base: number,
      amplitude: number,
      valleyHex: string,
      slopeHex: string,
      peakHex: string,
      seed: number,
    ) => {
      const segments = 260
      const rows = 4
      const positions: number[] = []
      const colors: number[] = []
      const uvs: number[] = []
      const indices: number[] = []
      const cValley = new THREE.Color(valleyHex)
      const cSlope = new THREE.Color(slopeHex)
      const cPeak = new THREE.Color(peakHex)
      const tmp = new THREE.Color()

      for (let i = 0; i < segments; i += 1) {
        const theta = (i / segments) * Math.PI * 2
        const warp = Math.sin(theta * 3 + seed) * 0.55 + Math.cos(theta * 5 - seed * 1.4) * 0.35
        const t = theta + warp * 0.08
        const f1 = Math.sin(t * 2 + seed) * 0.42 + 0.5
        const f2 = Math.abs(Math.sin(t * 7 - seed * 2.1)) * 0.34
        const f3 = Math.max(0, Math.sin(t * 17 + seed * 3.7)) * 0.16
        const f4 = Math.sin(t * 31 - seed * 5.2) * 0.06
        const ridgeProfile = f1 + f2 + f3 + f4
        const peakY = base + ridgeProfile * amplitude
        const valleyY = -42
        const x = Math.cos(theta) * radius
        const z = Math.sin(theta) * radius - 42

        for (let r = 0; r <= rows; r += 1) {
          const v = r / rows
          const y = valleyY + (peakY - valleyY) * Math.pow(v, 0.92)
          const rShift = (1 - v) * 28
          positions.push(x + Math.cos(theta) * rShift, y, z + Math.sin(theta) * rShift)
          uvs.push(i / segments, v)
          if (v < 0.45) tmp.copy(cValley).lerp(cSlope, v / 0.45)
          else tmp.copy(cSlope).lerp(cPeak, (v - 0.45) / 0.55)
          colors.push(tmp.r, tmp.g, tmp.b)
        }
      }

      const rowStride = rows + 1
      for (let i = 0; i < segments; i += 1) {
        const next = (i + 1) % segments
        for (let r = 0; r < rows; r += 1) {
          const a = i * rowStride + r
          const b = next * rowStride + r
          const c = a + 1
          const d = b + 1
          indices.push(a, b, c, b, d, c)
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      const material = new THREE.ShaderMaterial({
        uniforms: shared(
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
        ),
        vertexShader: MOUNTAIN_VERT,
        fragmentShader: MOUNTAIN_FRAG,
        side: THREE.DoubleSide,
      })
      this.mountainMats.push(material)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      surfaceGroup.add(mesh)
    }

    makeRidge(620, 32, 74, '#24344d', '#3c4e6b', '#767582', 1.7)
    makeRidge(420, 22, 48, '#192838', '#2c4450', '#58686c', 3.4)
    makeRidge(310, 12, 28, '#111d26', '#1f3336', '#3d4d46', 6.1)
  }

  private buildMistBoundary(surfaceGroup: THREE.Group, roamRadius: number) {
    const geometry = new THREE.CylinderGeometry(roamRadius + 4, roamRadius + 8, 28, 96, 1, true)
    const material = new THREE.ShaderMaterial({
      uniforms: shared('uTime', 'uFogColor', 'uSkyHorizon', 'uGalaxy'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying float vH;
        varying vec2 vXZ;
        void main() {
          vH = uv.y;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vXZ = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor;
        uniform vec3 uSkyHorizon;
        uniform float uTime;
        uniform float uGalaxy;
        varying float vH;
        varying vec2 vXZ;
        void main() {
          float drift = 0.5 + 0.5 * sin(vXZ.x * 0.045 + vXZ.y * 0.037 + uTime * 0.16);
          float body = smoothstep(1.0, 0.14, vH);
          vec3 col = mix(uFogColor, uSkyHorizon, 0.35 * (1.0 - uGalaxy));
          gl_FragColor = vec4(col, body * (0.24 + 0.28 * drift));
        }
      `,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(ROAM_CENTER.x, 6, ROAM_CENTER.z)
    mesh.frustumCulled = false
    mesh.renderOrder = 2
    surfaceGroup.add(mesh)
    return material
  }

  dispose() {
    this.heightTex?.dispose()
    this.heightTex = null
    this.splatTex?.dispose()
    this.splatTex = null
    this.terrainMat.dispose()
    this.mistMat.dispose()
    for (const mat of this.mountainMats) mat.dispose()
  }
}

const TERRAIN_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const TERRAIN_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vNormal;
uniform float uTime;
uniform float uGrassTip;
uniform float uWaterY;

${GLSL_NOISE}
${GLSL_NOISE_TEX}
${GLSL_ATMOSPHERE}
${GLSL_CLOUD_SHADOW}
${GLSL_TERRAIN_LOOKUP}
${GLSL_MEADOW}
${GLSL_WIND_WAKE}

void main() {
  vec3 P = vWorld;
  vec3 N = normalize(vNormal);
  vec2 uv = worldHeightUV(P.xz);
  vec4 sp = texture2D(uSplatTex, uv);
  float flowers = sp.r;
  float species = sp.g;
  float wet = sp.b;
  float rockW = sp.a;
  float dist = length(P - uCamPos);
  float nearK = 1.0 - smoothstep(28.0, 128.0, dist);

  vec4 nzA = ntex(P.xz * 1.4);
  vec4 nzB = ntex(P.xz * 7.5);
  vec4 nzC = ntex(P.xz * 26.0);

  // 草甸底色：与近景三维草叶共用同一函数，远景叠合风浪阵风与野花漫反射
  vec3 tint = meadowTint(P.xz, wet);
  float mott = nzA.r * 0.45 + nzB.g * 0.35 + nzC.b * 0.2;
  vec3 swardNear = tint * (0.64 + 0.36 * mott);
  vec3 swardFar = tint * mix(0.88, 1.32, mott) * uGrassTip;
  vec3 meadowCol = mix(swardFar, swardNear, nearK);

  // 远景花田色晕（近处由三维 GPU 野花接管，40~160 米渐渐融入地表花毯）
  float flowerMask = flowers * smoothstep(26.0, 96.0, dist) * (0.55 + 0.55 * nzB.b);
  meadowCol = mix(meadowCol, flowerMean(species) * 0.62, saturate(flowerMask));

  // 远近踏青小径与净空地面土色过渡
  float clearMask = texture2D(uHeightTex, worldHeightUV(P.xz)).b;
  float dryLand = smoothstep(0.42, 1.05, P.y - uWaterY);
  float trailMask = smoothstep(0.28, 0.78, clearMask) * dryLand;
  vec3 trailCol = mix(vec3(0.27, 0.23, 0.17), vec3(0.19, 0.17, 0.13), nzC.g) * (0.86 + 0.28 * nzA.r);
  meadowCol = mix(meadowCol, trailCol, trailMask * 0.88);

  // 湖畔湿润砂砾过渡带
  float shoreH = smoothstep(1.3, -0.4, P.y - uWaterY + (nzA.b - 0.5) * 0.45);
  vec3 beachCol = mix(vec3(0.28, 0.24, 0.18), vec3(0.09, 0.13, 0.12), saturate(wet + 0.35));
  beachCol *= 0.82 + 0.36 * nzC.r;
  vec3 alb = mix(meadowCol, beachCol, shoreH);

  // 陡坡花岗岩与苔藓分层质感
  if (rockW > 0.02) {
    float strata = sin(P.y * 2.4 + nzA.r * 3.5) * 0.5 + 0.5;
    vec3 cliff = mix(vec3(0.14, 0.17, 0.19), vec3(0.25, 0.28, 0.27), strata * 0.65 + nzB.a * 0.35);
    float moss = smoothstep(0.42, 0.72, nzB.r) * (1.0 - rockW * 0.5);
    cliff = mix(cliff, vec3(0.16, 0.24, 0.12), moss * 0.6);
    alb = mix(alb, cliff, smoothstep(0.02, 0.72, rockW));
  }

  // 远距离草原阵风反光涟漪
  float gust = windGust(P.xz, uTime);
  alb += tint * gust * (1.0 - rockW) * (1.0 - shoreH) * 0.24 * (1.0 - nearK * 0.4);

  // 微法线扰动
  vec3 nw = normalize(N + vec3((nzC.r - 0.5) * 0.18, 0.0, (nzC.g - 0.5) * 0.18));
  float cs = cloudShadow(P.xz, uTime);
  float ndl = saturate(dot(nw, normalize(uSunDir)) * 0.78 + 0.22);
  vec3 hemi = mix(uAmbGround, uAmbSky, nw.y * 0.5 + 0.5);
  vec3 col = alb * (uSunColor * ndl * cs + hemi * 1.12);

  col = applyAtmosphere(col, P);
  gl_FragColor = vec4(col, 1.0);
}
`

const MOUNTAIN_VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vEl;
void main() {
  vColor = color;
  vEl = uv.y;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const MOUNTAIN_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vEl;

${GLSL_NOISE}
${GLSL_ATMOSPHERE}

void main() {
  vec3 N = normalize(vNormal);
  vec3 S = normalize(uSunDir);
  float ndl = saturate(dot(N, S) * 0.55 + 0.45);
  vec3 lit = vColor * (uAmbSky * 0.95 + uSunColor * ndl * 0.48);
  float ridgeRim = smoothstep(0.65, 1.0, vEl) * pow(saturate(dot(normalize(vWorld - uCamPos), S)), 4.0);
  lit += uSunHalo * ridgeRim * 0.26 * uSunPower * (1.0 - uGalaxy * 0.85);
  vec3 col = applyAtmosphere(lit, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`
