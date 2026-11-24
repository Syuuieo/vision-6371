import * as THREE from 'three'
import { shared } from '../core/ctx'
import {
  GLSL_ATMOSPHERE,
  GLSL_CLOUD_SHADOW,
  GLSL_MEADOW,
  GLSL_NOISE,
  GLSL_NOISE_TEX,
  GLSL_TERRAIN_LOOKUP,
  GLSL_WIND_WAKE,
} from '../shaders/common'

/**
 * 相机跟随多层实例化草原 + GPU 花海（借鉴 Petalwake `world/meadow.js`）。
 *
 * - 3 圈世界锚定草叶分环（近 30m / 中 68m / 远 155m）与地形共用同一份
 *   `meadowTint`、`windGust`、`uSplatTex` 湿润度与 `clearMaskAt` 净空遮罩；
 * - 2 圈世界锚定 GPU 野花海（近 40m / 中 96m），在第一幕主花 (-3.8, -8.5)
 *   周围自动留出净空，用 `fwidth` 抗锯齿花瓣切片、植物物种色带、风摇与尾迹倾倒。
 */
export class MeadowWorld {
  private readonly materials: THREE.ShaderMaterial[] = []

  constructor(surfaceGroup: THREE.Group, lowDetail: boolean) {
    this.buildGrassShells(surfaceGroup, lowDetail)
    this.buildFlowerShells(surfaceGroup, lowDetail)
  }

  private createBladeGeometry(segments = 4) {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const width = 0.044
    const bladeCount = 3

    for (let blade = 0; blade < bladeCount; blade += 1) {
      const rotation = blade * (Math.PI / 2)
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const baseIndex = positions.length / 3
      for (let s = 0; s <= segments; s += 1) {
        const t = s / segments
        const halfW = width * (1 - t * 0.92) * (1 + 0.35 * Math.sin(t * Math.PI))
        const bend = t * t * 0.24
        for (const side of [-1, 1]) {
          const lx = halfW * side
          const ly = t
          const lz = bend + (side === 1 ? 0.004 : 0)
          positions.push(lx * cos - lz * sin, ly, lx * sin + lz * cos)
          uvs.push(side === -1 ? 0 : 1, t)
        }
      }
      for (let s = 0; s < segments; s += 1) {
        const a = baseIndex + s * 2
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    return geometry
  }

  private buildGrassShells(surfaceGroup: THREE.Group, lowDetail: boolean) {
    const sharedGrass = shared(
      'uTime',
      'uCamPos',
      'uCamXZ',
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
      'uGrassTip',
      'uHeightTex',
      'uSplatTex',
      'uHeightRect',
      'uNoiseTex',
      'uWind',
      'uWakeTex',
      'uWake',
      'uPlayerPos',
      'uCursorPos',
      'uClearStele',
      'uWaterY',
    )

    const shells = [
      { key: 'near', cell: 6, per: 74, radius: 30, fade: [-1, 0, 25, 30], segs: 4, quality: 0.56 },
      { key: 'mid', cell: 16, per: 50, radius: 68, fade: [20, 28, 58, 68], segs: 3, quality: 0.55 },
      { key: 'far', cell: 44, per: 34, radius: 155, fade: [54, 66, 130, 155], segs: 2, quality: 0.42 },
    ] as const

    for (const shell of shells) {
      const reach = Math.ceil(shell.radius / shell.cell)
      const cells: [number, number][] = []
      for (let cz = -reach; cz <= reach; cz += 1) {
        for (let cx = -reach; cx <= reach; cx += 1) {
          cells.push([cx, cz])
        }
      }
      const per = Math.max(1, Math.round(shell.per * (lowDetail ? shell.quality : 1)))
      const count = cells.length * per
      const geometry = this.createBladeGeometry(shell.segs)
      const aCell = new Float32Array(count * 2)
      const aSeed = new Float32Array(count * 3)
      const randoms = new Float32Array(count)
      let index = 0
      for (const [cx, cz] of cells) {
        for (let slot = 0; slot < per; slot += 1) {
          aCell[index * 2] = cx
          aCell[index * 2 + 1] = cz
          aSeed[index * 3] = Math.random()
          aSeed[index * 3 + 1] = Math.random()
          aSeed[index * 3 + 2] = Math.random()
          randoms[index] = Math.random()
          index += 1
        }
      }
      geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(randoms, 1))
      geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2))
      geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 3))

      const material = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedGrass,
          uCell: { value: shell.cell },
          uRadius: { value: shell.radius },
          uFade: { value: new THREE.Vector4(...shell.fade) },
        },
        side: THREE.DoubleSide,
        vertexShader: GRASS_VERT,
        fragmentShader: GRASS_FRAG,
      })
      this.materials.push(material)
      const mesh = new THREE.InstancedMesh(geometry, material, count)
      mesh.frustumCulled = false
      mesh.name = `grass-${shell.key}`
      surfaceGroup.add(mesh)
    }
  }

  private createWildflowerGeometry() {
    const positions: number[] = []
    const uvs: number[] = []
    const parts: number[] = []
    const indices: number[] = []

    // 细茎（aPart = 0）
    positions.push(-0.007, 0, 0, 0.007, 0, 0, -0.004, 1, 0, 0.004, 1, 0)
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    parts.push(0, 0, 0, 0)
    indices.push(0, 1, 2, 2, 1, 3)

    // 花盘四方片（aPart = 1，uv ∈ [0,1] -> [-1,1]）
    const r = 0.14
    const b = positions.length / 3
    positions.push(-r, 0, -r, r, 0, -r, r, 0, r, -r, 0, r)
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1)
    parts.push(1, 1, 1, 1)
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(parts, 1))
    geo.setIndex(indices)
    return geo
  }

  private buildFlowerShells(surfaceGroup: THREE.Group, lowDetail: boolean) {
    const sharedFlower = shared(
      'uTime',
      'uCamPos',
      'uCamXZ',
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
      'uPlayerPos',
      'uCursorPos',
      'uClearStele',
      'uWaterY',
    )

    const template = this.createWildflowerGeometry()
    const shells = [
      { key: 'near', cell: 8, per: 30, radius: 40, fade: [-1, 0, 32, 40], quality: 0.5 },
      { key: 'mid', cell: 18, per: 20, radius: 96, fade: [26, 36, 80, 96], quality: 0.45 },
    ] as const

    for (const shell of shells) {
      const reach = Math.ceil(shell.radius / shell.cell)
      const cells: [number, number][] = []
      for (let cz = -reach; cz <= reach; cz += 1) {
        for (let cx = -reach; cx <= reach; cx += 1) {
          if (Math.hypot(cx, cz) > reach) continue
          cells.push([cx, cz])
        }
      }
      const per = Math.max(1, Math.round(shell.per * (lowDetail ? shell.quality : 1)))
      const count = cells.length * per
      const aCell = new Float32Array(count * 2)
      const aSeed = new Float32Array(count * 3)
      let index = 0
      for (const [cx, cz] of cells) {
        for (let slot = 0; slot < per; slot += 1) {
          aCell[index * 2] = cx
          aCell[index * 2 + 1] = cz
          aSeed[index * 3] = Math.random()
          aSeed[index * 3 + 1] = Math.random()
          aSeed[index * 3 + 2] = Math.random()
          index += 1
        }
      }

      const geometry = template.clone()
      geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2))
      geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 3))

      const material = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedFlower,
          uCell: { value: shell.cell },
          uRadius: { value: shell.radius },
          uFade: { value: new THREE.Vector4(...shell.fade) },
        },
        side: THREE.DoubleSide,
        vertexShader: FLOWER_VERT,
        fragmentShader: FLOWER_FRAG,
      })
      this.materials.push(material)
      const mesh = new THREE.InstancedMesh(geometry, material, count)
      mesh.frustumCulled = false
      mesh.name = `flowers-${shell.key}`
      surfaceGroup.add(mesh)
    }
    template.dispose()
  }

  dispose() {
    for (const m of this.materials) m.dispose()
  }
}

const GRASS_VERT = /* glsl */ `
attribute float aRand;
attribute vec2 aCell;
attribute vec3 aSeed;
uniform float uTime;
uniform vec2 uCamXZ;
uniform vec3 uCamPos;
uniform vec3 uPlayerPos;
uniform vec3 uCursorPos;
uniform float uCell;
uniform float uRadius;
uniform vec4 uFade;
uniform float uWaterY;
uniform vec4 uClearStele;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunPower;
uniform vec3 uSkyZenith;
uniform vec3 uSkyMid;
uniform vec3 uSkyHorizon;
uniform vec3 uSunHalo;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uFogColor;
uniform vec4 uFog;
uniform float uGalaxy;

varying float vH;
varying float vClump;
varying float vGust;
varying float vWet;
varying float vRand;
varying vec2 vRootXZ;
varying vec3 vWorld;

${GLSL_NOISE}
${GLSL_NOISE_TEX}
${GLSL_TERRAIN_LOOKUP}
${GLSL_WIND_WAKE}

void main() {
  vH = uv.y;
  vRand = aRand;

  vec2 cellIndex = floor(uCamXZ / uCell) + aCell;
  vec2 jitter = hash22(cellIndex + aSeed.xy * 37.0);
  vec2 wrapped = (cellIndex + jitter) * uCell - uCamXZ;
  wrapped -= uRadius * 2.0 * floor(wrapped / (uRadius * 2.0) + 0.5);
  vec2 xz = uCamXZ + wrapped;
  float dist = length(wrapped);

  float keep = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
  if (keep <= 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  if (length(xz - uClearStele.xy) < uClearStele.z) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 hUV = worldHeightUV(xz);
  vec4 packed = texture2D(uHeightTex, hUV);
  float ground = decodeHeight(packed);
  float mask = 1.0 - smoothstep(0.18, 0.62, packed.b);
  if (mask <= 0.02 || ground < uWaterY + 0.45) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec4 sp = texture2D(uSplatTex, hUV);
  if (sp.a > 0.72) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec4 clumpRand = hash42(floor(xz / 0.75));
  vClump = clumpRand.x;
  vWet = sp.b;
  vRootXZ = xz;

  float slopeFade = 1.0 - smoothstep(0.25, 0.72, sp.a);
  float hgt = (0.38 + pow(fract(aSeed.x * 3.71), 1.5) * 1.05) * mix(0.76, 1.24, clumpRand.y) * keep * mask * slopeFade;
  float wid = (0.74 + fract(aSeed.y * 5.13) * 0.52) * keep;
  float yaw = aSeed.z * 6.2831853 + (clumpRand.z - 0.5) * 0.85;
  float cs = cos(yaw);
  float sn = sin(yaw);

  vec2 toCam = normalize(uCamPos.xz - xz + vec2(0.0001));
  vec2 camRight = vec2(-toCam.y, toCam.x);
  vec2 bladeAxis = normalize(mix(vec2(cs, sn), camRight, 0.36));
  vec2 bladeNormal = vec2(-bladeAxis.y, bladeAxis.x);

  vec3 p = position;
  p.xz *= wid;
  p.y *= hgt;
  vec3 rotated = vec3(
    bladeAxis.x * p.x + bladeNormal.x * p.z,
    p.y,
    bladeAxis.y * p.x + bladeNormal.y * p.z
  );

  vec3 world = vec3(xz.x + rotated.x, ground + rotated.y, xz.y + rotated.z);

  float gust = windGust(xz, uTime);
  vGust = gust;
  float wave = sin(xz.x * 0.16 + xz.y * 0.12 + uTime * 1.9 + aRand * 6.283);
  float amp = (0.045 + 0.17 * uWind.z * (0.4 + 0.85 * gust)) * (0.6 + aRand * 0.8);
  float bend = amp * vH * vH;
  world.x += (wave * 1.45 + uWind.x * gust * 1.2) * bend;
  world.z += (cos(xz.x * 0.1 + uTime * 1.3 + aRand * 4.0) + uWind.y * gust * 1.2) * bend;
  world.y -= bend * 0.36;

  vec3 wake = sampleWake(xz);
  vec2 toPlayer = world.xz - uPlayerPos.xz;
  float playerDist = length(toPlayer);
  float playerPush = (1.0 - smoothstep(0.35, 2.2, playerDist)) * (uWake.w > 0.5 ? 0.24 : 0.55);
  vec2 playerDir = playerDist > 0.001 ? toPlayer / playerDist : vec2(0.0);

  vec2 toCursor = world.xz - uCursorPos.xz;
  float cursorDist = length(toCursor);
  float cursorPush = (1.0 - smoothstep(0.25, 2.4, cursorDist)) * (uWake.w > 0.5 ? 0.2 : 0.48);
  vec2 cursorDir = cursorDist > 0.001 ? toCursor / cursorDist : vec2(0.0);

  float pushWeight = vH * vH;
  world.xz += (wake.xy * 0.58 + playerDir * playerPush + cursorDir * cursorPush) * pushWeight;
  world.y -= max(wake.z * 0.32, (playerPush + cursorPush) * 0.22) * pushWeight;

  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const GRASS_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uGrassTip;

varying float vH;
varying float vClump;
varying float vGust;
varying float vWet;
varying float vRand;
varying vec2 vRootXZ;
varying vec3 vWorld;

${GLSL_NOISE}
${GLSL_NOISE_TEX}
${GLSL_ATMOSPHERE}
${GLSL_CLOUD_SHADOW}
${GLSL_MEADOW}

void main() {
  vec3 tint = meadowTint(vRootXZ, vWet);
  vec3 rootCol = tint * mix(0.28, 0.45, vRand);
  vec3 tipCol = tint * mix(1.05, 1.62, vRand) * uGrassTip * mix(0.88, 1.16, vClump);
  float h = saturate(vH);
  vec3 col = mix(rootCol, tipCol, pow(h, 0.86));

  float cs = cloudShadow(vWorld.xz, uTime);
  float daylight = 1.0 - smoothstep(0.3, 0.88, uGalaxy);
  float lightAmt = 0.25 + 0.55 * h;
  col = col * mix(uAmbGround, uAmbSky, 0.35 + 0.55 * h) * 1.15 + col * uSunColor * lightAmt * 0.82 * cs;

  // 逆光草尖次表面透射 + 阵风波面光泽
  vec3 V = normalize(vWorld - uCamPos);
  float sss = pow(saturate(dot(V, normalize(uSunDir)) * 0.5 + 0.5), 3.0);
  col += uSunColor * sss * pow(h, 1.3) * uSunPower * 0.22 * daylight * cs;
  col += uSunColor * vGust * smoothstep(0.5, 1.0, h) * 0.055 * uSunPower * daylight * cs;

  col = applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`

const FLOWER_VERT = /* glsl */ `
attribute float aPart;
attribute vec2 aCell;
attribute vec3 aSeed;
uniform float uTime;
uniform vec2 uCamXZ;
uniform vec3 uCamPos;
uniform vec3 uPlayerPos;
uniform vec3 uCursorPos;
uniform float uCell;
uniform float uRadius;
uniform vec4 uFade;
uniform float uWaterY;
uniform vec4 uClearStele;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunPower;
uniform vec3 uSkyZenith;
uniform vec3 uSkyMid;
uniform vec3 uSkyHorizon;
uniform vec3 uSunHalo;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uFogColor;
uniform vec4 uFog;
uniform float uGalaxy;

varying float vPart;
varying vec2 vDisc;
varying vec3 vSeed;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vShape;
varying float vSpecies;
varying float vDistFade;

${GLSL_NOISE}
${GLSL_NOISE_TEX}
${GLSL_TERRAIN_LOOKUP}
${GLSL_MEADOW}
${GLSL_WIND_WAKE}

void main() {
  vPart = aPart;
  vSeed = aSeed;

  vec2 cellIndex = floor(uCamXZ / uCell) + aCell;
  vec2 jitter = hash22(cellIndex + aSeed.xy * 37.0);
  vec2 wrapped = (cellIndex + jitter) * uCell - uCamXZ;
  wrapped -= uRadius * 2.0 * floor(wrapped / (uRadius * 2.0) + 0.5);
  vec2 xz = uCamXZ + wrapped;
  float dist = length(wrapped);

  float keep = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
  float rankKeep = step(aSeed.z, mix(1.0, 0.36, smoothstep(uFade.y, uFade.z, dist)));
  keep *= rankKeep;
  if (keep <= 0.02) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // 第一幕交互主花 (-3.8, -8.5) 周围留白
  if (length(xz - vec2(-3.8, -8.5)) < 2.5 || length(xz - uClearStele.xy) < uClearStele.z) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 hUV = worldHeightUV(xz);
  vec4 packed = texture2D(uHeightTex, hUV);
  float ground = decodeHeight(packed);
  if (packed.b > 0.25 || ground < uWaterY + 0.55) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec4 sp = texture2D(uSplatTex, hUV);
  if (sp.r < 0.28 || sp.a > 0.45) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float species = sp.g;
  vec4 shape = flowerShape(species);
  vSpecies = species;
  vShape = shape;

  float stemH = (0.34 + aSeed.x * 0.34) * shape.w * keep;
  float headScale = (0.85 + aSeed.y * 0.48) * shape.z * mix(0.88, 1.38, smoothstep(14.0, 52.0, dist)) * keep;

  vec3 local = position;
  if (aPart < 0.5) {
    local.y *= stemH;
    vDisc = vec2(0.0);
    vNormal = vec3(0.0, 1.0, 0.0);
  } else {
    vDisc = uv * 2.0 - 1.0;
    float yaw = aSeed.y * 6.2831853;
    float tilt = 0.24 + aSeed.x * 0.32;
    float ct = cos(tilt);
    float st = sin(tilt);
    float cy = cos(yaw);
    float sy = sin(yaw);
    local.xz *= headScale;
    float ty = local.y * ct - local.z * st;
    float tz = local.y * st + local.z * ct;
    local = vec3(local.x * cy - tz * sy, ty + stemH, local.x * sy + tz * cy);
    vec3 n = vec3(0.0, ct, st);
    vNormal = normalize(vec3(n.x * cy - n.z * sy, n.y, n.x * sy + n.z * cy));
  }

  float swayFactor = aPart < 0.5 ? uv.y * uv.y : 1.0;
  float gust = windGust(xz, uTime);
  float wave = sin(xz.x * 0.18 + xz.y * 0.14 + uTime * 2.1 + aSeed.z * 6.283);
  float sway = (wave + gust * 0.55) * (0.04 + 0.11 * uWind.z) * swayFactor;

  vec3 wake = sampleWake(xz);
  vec2 toPlayer = xz - uPlayerPos.xz;
  float pDist = length(toPlayer);
  float pPush = (1.0 - smoothstep(0.35, 2.1, pDist)) * (uWake.w > 0.5 ? 0.24 : 0.52);
  vec2 pDir = pDist > 0.001 ? toPlayer / pDist : vec2(0.0);

  vec2 toCursor = xz - uCursorPos.xz;
  float cDist = length(toCursor);
  float cPush = (1.0 - smoothstep(0.25, 2.3, cDist)) * (uWake.w > 0.5 ? 0.18 : 0.44);
  vec2 cDir = cDist > 0.001 ? toCursor / cDist : vec2(0.0);

  vec2 pushXZ = (wake.xy * 0.45 + pDir * pPush + cDir * cPush) * swayFactor;
  float crushY = max(wake.z * 0.22, (pPush + cPush) * 0.14) * swayFactor;

  vec3 world = vec3(
    xz.x + local.x + sway + pushXZ.x,
    ground + local.y - crushY,
    xz.y + local.z + sway * 0.5 + pushXZ.y
  );

  vWorld = world;
  vDistFade = smoothstep(22.0, 72.0, dist);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FLOWER_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;

varying float vPart;
varying vec2 vDisc;
varying vec3 vSeed;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vShape;
varying float vSpecies;
varying float vDistFade;

${GLSL_NOISE}
${GLSL_ATMOSPHERE}
${GLSL_CLOUD_SHADOW}
${GLSL_MEADOW}

void main() {
  float cs = cloudShadow(vWorld.xz, uTime);
  float daylight = 1.0 - smoothstep(0.35, 0.92, uGalaxy);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;

  vec3 alb;
  float glow = 0.0;

  if (vPart < 0.5) {
    alb = mix(vec3(0.09, 0.21, 0.06), vec3(0.16, 0.30, 0.10), vSeed.x);
  } else {
    float r = length(vDisc);
    float a = atan(vDisc.y, vDisc.x);
    float k = vShape.x;
    float pa = abs(fract(a * k / 6.2831853 + 0.5) - 0.5) * 2.0;
    float outline = mix(0.96, 0.38, pow(pa, k > 8.0 ? 1.2 : 2.3));
    outline *= 1.0 - 0.06 * cos(pa * 9.0) * step(k, 8.5);
    outline = mix(outline, 0.88, vDistFade);

    float fw = max(fwidth(r) * 1.45, 0.025);
    float alpha = smoothstep(outline, outline - max(fw, 0.16 * vDistFade), r);
    if (alpha < 0.05) discard;

    float eyeR = vShape.y;
    float eye = smoothstep(eyeR, eyeR - 0.06, r);
    vec3 petalBase = flowerPetal(vSpecies, vSeed.y);
    vec3 petal = petalBase * mix(0.76, 1.08, smoothstep(eyeR, 0.94, r));
    petal *= 1.0 - 0.14 * pow(pa, 2.8);
    petal *= 0.94 + 0.08 * sin(a * k * 2.5) * smoothstep(0.28, 0.86, r);

    vec3 eyeCol = mix(vec3(0.95, 0.68, 0.10), vec3(0.32, 0.18, 0.06), vSeed.x * 0.35);
    alb = mix(petal, eyeCol, eye);
    glow = 1.0 - eye;
  }

  float ndl = saturate(dot(N, normalize(uSunDir)) * 0.5 + 0.5);
  float back = pow(saturate(dot(V, -normalize(uSunDir)) * 0.5 + 0.5), 3.0) * glow;
  vec3 col = alb * uSunColor * (ndl * 0.65 + back * 0.68) * cs * (0.28 + 0.72 * daylight);
  col += alb * (mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5) * 1.05 + vec3(0.04, 0.05, 0.08) * uGalaxy) * mix(0.78, 1.2, glow);

  col = applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`
