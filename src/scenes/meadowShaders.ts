/**
 * 序章草原与野花共享的 GLSL 片段库
 *
 * 借鉴 Petalwake 的纯粹程序化渲染思路（多尺度色斑、云影漂移、次表面透光、
 * 高度雾空气透视、持久倒伏通道采样），并将色温与光照完全接入《视界 6371》
 * 的 24 小时昼夜弧线（uZenith / uHorizon / uSunColor / uSunDir / uGalaxy）。
 */

export const MEADOW_NOISE_GLSL = /* glsl */ `
float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm2(vec2 p) {
  return 0.65 * vnoise(p) + 0.35 * vnoise(p * 2.07 + 13.7);
}
`

export const CLOUD_SHADOW_GLSL = /* glsl */ `
float cloudShadow(vec2 xz, float time, float galaxy) {
  vec2 q = xz * 0.0115 + vec2(time * 0.0085, time * 0.0038);
  float c = 0.62 * vnoise(q) + 0.38 * vnoise(q * 2.13 + vec2(7.4, -3.1));
  float shade = mix(0.64, 1.0, smoothstep(0.36, 0.68, c));
  return mix(shade, 1.0, saturate(galaxy * 0.92));
}
`

export const AERIAL_PERSPECTIVE_GLSL = /* glsl */ `
vec3 applyAerialPerspective(
  vec3 col,
  vec3 worldPos,
  vec3 camPos,
  vec3 fogColor,
  float fogDensity,
  vec3 zenith,
  vec3 horizon,
  vec3 sunDir,
  vec3 sunColor,
  float galaxy
) {
  vec3 delta = worldPos - camPos;
  float dist = length(delta);
  vec3 rd = delta / max(dist, 0.001);

  float expFog = 1.0 - exp(-fogDensity * fogDensity * dist * dist);
  float aerial = saturate(1.0 - exp(-max(dist - 12.0, 0.0) * 0.0046));
  float heightEase = exp(-max(worldPos.y - 1.5, 0.0) * 0.04);

  float skyLift = smoothstep(-0.02, 0.34, max(rd.y, 0.0));
  vec3 skyBase = mix(horizon, zenith * 0.88, skyLift * 0.52);
  vec3 hazeColor = mix(fogColor, skyBase, 0.56 * (1.0 - galaxy * 0.45));

  float forwardSun = pow(max(dot(rd, normalize(sunDir)), 0.0), 5.0) * (1.0 - galaxy * 0.88);
  hazeColor += sunColor * forwardSun * 0.22;

  float blendAmt = clamp(max(expFog, aerial * 0.48 * heightEase + expFog * 0.65), 0.0, 0.95);
  return mix(col, hazeColor, blendAmt);
}
`

export const MEADOW_COLOR_GLSL = /* glsl */ `
vec3 meadowTint(vec2 xz, float shoreMoisture) {
  float macro = vnoise(xz * 0.017 + vec2(4.2, -2.8));
  float medium = vnoise(xz * 0.075 + vec2(-9.1, 6.3));
  float fine = vnoise(xz * 0.23 + vec2(1.7, 11.4));

  vec3 freshEmerald = vec3(0.68, 1.02, 0.58);
  vec3 warmOchre = vec3(1.06, 0.94, 0.56);
  vec3 mistySage = vec3(0.58, 0.86, 0.72);
  vec3 dampShore = vec3(0.46, 0.74, 0.56);

  vec3 tint = mix(freshEmerald, warmOchre, smoothstep(0.32, 0.78, macro));
  tint = mix(tint, mistySage, smoothstep(0.45, 0.86, medium) * 0.48);
  tint *= 0.88 + 0.24 * fine;
  return mix(tint, dampShore, saturate(shoreMoisture) * 0.52);
}

vec3 flowerSpeciesColor(float species, float randVal) {
  vec3 c;
  if (species < 0.28) {
    c = mix(vec3(0.92, 0.89, 0.79), vec3(1.0, 0.96, 0.88), randVal);
  } else if (species < 0.58) {
    c = mix(vec3(0.92, 0.70, 0.28), vec3(1.0, 0.85, 0.46), randVal);
  } else if (species < 0.82) {
    c = mix(vec3(0.68, 0.66, 0.90), vec3(0.84, 0.80, 0.98), randVal);
  } else {
    c = mix(vec3(0.90, 0.62, 0.56), vec3(0.99, 0.78, 0.70), randVal);
  }
  return c;
}
`

export const WAKE_SAMPLE_GLSL = /* glsl */ `
vec3 sampleWake(sampler2D wakeTex, vec4 wakeRect, vec2 xz) {
  if (wakeRect.w < 0.5) return vec3(0.0);
  vec2 uv = (xz - wakeRect.xy) * wakeRect.z + 0.5;
  if (uv.x <= 0.01 || uv.x >= 0.99 || uv.y <= 0.01 || uv.y >= 0.99) {
    return vec3(0.0);
  }
  vec2 edge = min(uv, 1.0 - uv);
  float border = smoothstep(0.01, 0.08, min(edge.x, edge.y));
  vec4 raw = texture2D(wakeTex, uv);
  vec2 lean = (raw.rg * 255.0 - 128.0) / 127.0;
  float mag = length(lean);
  if (mag > 1.0) lean /= mag;
  float crush = saturate(raw.b);
  return vec3(lean * border, crush * border);
}
`
