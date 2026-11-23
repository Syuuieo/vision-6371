import {
  AERIAL_PERSPECTIVE_GLSL,
  CLOUD_SHADOW_GLSL,
  MEADOW_COLOR_GLSL,
  MEADOW_NOISE_GLSL,
  WAKE_SAMPLE_GLSL,
} from './meadowShaders'

/**
 * 相机跟随 GPU 野花海着色器
 *
 * 借鉴 Petalwake 的程序化花冠切片、物种色漂移、远距自然抽稀与尾迹拨开效果；
 * 保留《视界 6371》第一幕主花 (-3.8, -8.5) 周围留白，接入昼夜太阳光照与高度雾。
 */
export const FLOWER_VERT = /* glsl */ `
attribute float aPart;
attribute vec2 aCell;
attribute vec3 aSeed;
uniform float uTime;
uniform float uWind;
uniform vec2 uCamXZ;
uniform vec3 uPlayerPos;
uniform vec3 uCursorPos;
uniform float uCell;
uniform float uRadius;
uniform vec4 uFade;
uniform sampler2D uHeightTex;
uniform vec2 uHeightOrigin;
uniform float uHeightSpan;
uniform float uWaterY;
uniform sampler2D uWakeTex;
uniform vec4 uWake;
uniform vec4 uClearStele;
varying float vPart;
varying vec2 vDisc;
varying vec3 vSeed;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDistFade;

${MEADOW_NOISE_GLSL}
${WAKE_SAMPLE_GLSL}

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
  // 草原花簇聚落与按距离平滑抽稀
  float patchDensity = vnoise(xz * 0.048 + vec2(3.7, -5.2));
  if (patchDensity < 0.34) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float rankKeep = step(aSeed.z, mix(1.0, 0.38, smoothstep(uFade.y, uFade.z, dist)));
  keep *= rankKeep;
  if (keep <= 0.02) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // 避开第一幕近景主花 (-3.8, -8.5) 及风化石碑
  if (length(xz - vec2(-3.8, -8.5)) < 2.4 || length(xz - uClearStele.xy) < uClearStele.z) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec4 packed = texture2D(uHeightTex, clamp((xz - uHeightOrigin) / uHeightSpan, 0.0, 1.0));
  float ground = -20.0 + ((packed.r * 65280.0 + packed.g * 255.0) / 65535.0) * 40.0;
  if (packed.b > 0.28 || ground < uWaterY) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float stemH = (0.34 + aSeed.x * 0.38) * keep;
  float headScale = (0.85 + aSeed.y * 0.55) * mix(0.85, 1.35, smoothstep(14.0, 52.0, dist)) * keep;

  vec3 local = position;
  if (aPart < 0.5) {
    local.y *= stemH;
    vDisc = vec2(0.0);
    vNormal = vec3(0.0, 1.0, 0.0);
  } else {
    // 花冠本地坐标：uv ∈ [0,1] 映射为 [-1,1] 花盘空间
    vDisc = uv * 2.0 - 1.0;
    float yaw = aSeed.y * 6.2831853;
    float tilt = 0.25 + aSeed.x * 0.35;
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
  float wave = sin(xz.x * 0.18 + xz.y * 0.14 + uTime * 2.1 + aSeed.z * 6.283);
  float gust = 0.5 + 0.5 * sin(xz.x * 0.021 - xz.y * 0.017 + uTime * 0.55);
  float sway = wave * (0.04 + 0.11 * uWind * gust) * swayFactor;

  vec3 wake = sampleWake(uWakeTex, uWake, xz);
  vec2 toPlayer = xz - uPlayerPos.xz;
  float pDist = length(toPlayer);
  float pPush = (1.0 - smoothstep(0.35, 2.1, pDist)) * (uWake.w > 0.5 ? 0.24 : 0.52);
  vec2 pDir = pDist > 0.001 ? toPlayer / pDist : vec2(0.0);

  vec2 toCursor = xz - uCursorPos.xz;
  float cDist = length(toCursor);
  float cPush = (1.0 - smoothstep(0.25, 2.3, cDist)) * (uWake.w > 0.5 ? 0.18 : 0.44);
  vec2 cDir = cDist > 0.001 ? toCursor / cDist : vec2(0.0);

  vec2 pushXZ = (wake.xy * 0.42 + pDir * pPush + cDir * cPush) * swayFactor;
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

export const FLOWER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform vec3 uAmbient;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uSunPower;
uniform float uGalaxy;
uniform vec3 uCamPos;
varying float vPart;
varying vec2 vDisc;
varying vec3 vSeed;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDistFade;

${MEADOW_NOISE_GLSL}
${CLOUD_SHADOW_GLSL}
${MEADOW_COLOR_GLSL}
${AERIAL_PERSPECTIVE_GLSL}

void main() {
  float shade = cloudShadow(vWorld.xz, uTime, uGalaxy);
  float daylight = 1.0 - smoothstep(0.35, 0.92, uGalaxy);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;

  vec3 alb;
  float glow = 0.0;

  if (vPart < 0.5) {
    alb = mix(vec3(0.11, 0.23, 0.08), vec3(0.18, 0.34, 0.12), vSeed.x);
  } else {
    float r = length(vDisc);
    float a = atan(vDisc.y, vDisc.x);
    float k = vSeed.z < 0.35 ? 5.0 : (vSeed.z < 0.7 ? 6.0 : 8.0);
    float pa = abs(fract(a * k / 6.2831853 + 0.5) - 0.5) * 2.0;
    float outline = mix(0.95, 0.42, pow(pa, k > 6.0 ? 1.4 : 2.1));
    outline *= 1.0 - 0.06 * cos(pa * 8.0);
    outline = mix(outline, 0.88, vDistFade);

    float fw = max(fwidth(r) * 1.4, 0.025);
    float alpha = smoothstep(outline, outline - max(fw, 0.16 * vDistFade), r);
    if (alpha < 0.05) discard;

    float eyeR = 0.26;
    float eye = smoothstep(eyeR, eyeR - 0.06, r);
    float species = vnoise(vWorld.xz * 0.055 + vec2(7.1, -3.4));
    vec3 petalBase = flowerSpeciesColor(species, vSeed.y);
    vec3 petal = petalBase * mix(0.78, 1.08, smoothstep(eyeR, 0.92, r));
    petal *= 1.0 - 0.14 * pow(pa, 2.5);
    petal *= 0.94 + 0.08 * sin(a * k * 2.0) * smoothstep(0.28, 0.85, r);

    vec3 eyeCol = mix(vec3(0.96, 0.68, 0.12), vec3(0.42, 0.24, 0.08), vSeed.x * 0.4);
    alb = mix(petal, eyeCol, eye);
    glow = 1.0 - eye;
  }

  float ndl = saturate(dot(N, normalize(uSunDir)) * 0.5 + 0.5);
  float back = pow(saturate(dot(V, -normalize(uSunDir)) * 0.5 + 0.5), 3.0) * glow;
  vec3 col = alb * uSunColor * (ndl * 0.85 + back * 0.72) * shade * (0.28 + 0.72 * daylight);
  col += alb * (uAmbient * 0.95 + vec3(0.05, 0.06, 0.09) * uGalaxy) * mix(0.75, 1.18, glow);

  col = applyAerialPerspective(
    col,
    vWorld,
    uCamPos,
    uFogColor,
    uFogDensity,
    uZenith,
    uHorizon,
    uSunDir,
    uSunColor,
    uGalaxy
  );

  gl_FragColor = vec4(col, 1.0);
}
`
