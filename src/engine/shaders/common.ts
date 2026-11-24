/**
 * 全场景统一 GLSL 着色器积木（Petalwake 架构 ×《视界 6371》24 小时科幻光影）。
 *
 * 地面、草叶、野花、湖水、群山、岩石、树冠均引用同一组函数与全局 Uniform，
 * 从结构上杜绝“草地像贴片、水面不反射体云、远景和天际线断层”等问题。
 */

export const GLSL_NOISE = /* glsl */ `
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate3(vec3 x) { return clamp(x, 0.0, 1.0); }
float remap(float v, float a, float b) { return clamp((v - a) / max(b - a, 1e-4), 0.0, 1.0); }

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
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

vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
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

const mat2 ROT2 = mat2(0.8, -0.6, 0.6, 0.8);

float fbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 2; i++) {
    s += a * vnoise(p);
    p = ROT2 * p * 2.03;
    a *= 0.5;
  }
  return s / 0.75;
}

float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = ROT2 * p * 2.03;
    a *= 0.5;
  }
  return s / 0.875;
}

float fbm4(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = ROT2 * p * 2.03;
    a *= 0.5;
  }
  return s / 0.9375;
}
`

export const GLSL_NOISE_TEX = /* glsl */ `
uniform sampler2D uNoiseTex;
vec4 ntex(vec2 p) {
  return texture2D(uNoiseTex, p / 256.0);
}
`

export const GLSL_ATMOSPHERE = /* glsl */ `
uniform vec3 uCamPos;
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

// 三段式解析天空穹散射辐射：天顶 -> 中层 -> 地平线 + 日光前向晕散 + 背日深蓝
vec3 skyBase(vec3 d) {
  float y = max(d.y, 0.0);
  float mu = dot(d, normalize(uSunDir));
  float hz = pow(1.0 - y, 4.4);
  vec3 c = mix(uSkyMid, uSkyZenith, pow(y, 0.64));
  c = mix(c, uSkyHorizon, hz);
  float m = max(mu, 0.0);
  float glow = (pow(m, 6.0) * 0.22 + pow(m, 38.0) * 0.26 + pow(m, 420.0) * 1.1) * (0.5 + 0.85 * hz);
  c += uSunHalo * glow * (0.28 + 0.72 * uSunPower);
  c *= 1.0 - 0.14 * pow(max(-mu, 0.0), 2.0) * (1.0 - hz) * (1.0 - uGalaxy * 0.6);
  return c;
}

// 统一高度雾与空气透视：近处锐利，中远景依海拔淡入天空基色并与 FogExp2 匹配
vec3 applyAtmosphere(vec3 col, vec3 P) {
  vec3 v = P - uCamPos;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);

  if (uFog.z > 0.5) {
    float uf = 1.0 - exp(-uFog.x * dist);
    return mix(col, uFogColor, saturate(uf));
  }

  float exp2Fog = 1.0 - exp(-uFog.x * uFog.x * dist * dist);
  float heightEase = exp(-max(P.y - uCamPos.y * 0.4, 0.0) * uFog.y);
  float aerial = saturate(1.0 - exp(-max(dist - 14.0, 0.0) * 0.0042)) * mix(0.65, 1.0, heightEase);
  vec3 ext = exp(-aerial * vec3(0.56, 0.86, 1.24));

  vec3 sampleDir = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.5 + 0.032, dir.z));
  vec3 skyScatter = skyBase(sampleDir);
  vec3 haze = mix(uFogColor, skyScatter, 0.62 * (1.0 - uGalaxy * 0.42));

  vec3 aerialCol = col * ext + haze * (vec3(1.0) - ext);
  return mix(aerialCol, haze, exp2Fog * 0.72);
}
`

export const GLSL_CLOUD_SHADOW = /* glsl */ `
float cloudShadow(vec2 xz, float time) {
  vec2 p = xz * 0.0115 + vec2(time * 0.009, time * 0.0042);
  float n = fbm2(p * 1.8 + 3.7);
  float s = mix(0.60, 1.0, smoothstep(0.32, 0.68, n));
  return mix(s, 1.0, saturate(uGalaxy * 0.92));
}
`

export const GLSL_TERRAIN_LOOKUP = /* glsl */ `
uniform sampler2D uHeightTex;
uniform sampler2D uSplatTex;
uniform vec4 uHeightRect;

vec2 worldHeightUV(vec2 xz) {
  return clamp((xz - uHeightRect.xy) * uHeightRect.w, 0.0, 1.0);
}

float decodeHeight(vec4 p) {
  return -20.0 + ((p.r * 65280.0 + p.g * 255.0) / 65535.0) * 40.0;
}

float terrainH(vec2 xz) {
  return decodeHeight(texture2D(uHeightTex, worldHeightUV(xz)));
}

float clearMaskAt(vec2 xz) {
  return texture2D(uHeightTex, worldHeightUV(xz)).b;
}

float shoreDistAt(vec2 xz) {
  float raw = texture2D(uHeightTex, worldHeightUV(xz)).a;
  return (raw * 2.0 - 1.0) * 28.0;
}

vec3 terrainN(vec2 xz) {
  float stepM = 1.15;
  float hl = terrainH(xz - vec2(stepM, 0.0));
  float hr = terrainH(xz + vec2(stepM, 0.0));
  float hd = terrainH(xz - vec2(0.0, stepM));
  float hu = terrainH(xz + vec2(0.0, stepM));
  return normalize(vec3(hl - hr, 2.0 * stepM, hd - hu));
}
`

export const GLSL_MEADOW = /* glsl */ `
// 草原色斑：地形地面与草叶共用同一条色相轨迹，从根本上消除远景拼接色差
vec3 meadowTint(vec2 xz, float wet) {
  float a = vnoise(xz * 0.014 + 11.0);
  float b = vnoise(xz * 0.052 - 5.0);
  float c = vnoise(xz * 0.19 + 2.0);
  vec3 lush = vec3(0.11, 0.25, 0.08);
  vec3 fresh = vec3(0.20, 0.34, 0.11);
  vec3 dry = vec3(0.38, 0.36, 0.14);
  vec3 col = mix(lush, fresh, smoothstep(0.22, 0.78, a * 0.6 + b * 0.4));
  col = mix(col, dry, smoothstep(0.38, 0.80, b * 0.5 + c * 0.5) * (1.0 - wet) * 0.78);
  col = mix(col, lush * 0.88, saturate(wet) * 0.62);
  return col;
}

const float SP1 = 0.28;
const float SP2 = 0.58;
const float SP3 = 0.82;

vec3 flowerPetal(float s, float r) {
  vec3 ivoryA = vec3(0.92, 0.89, 0.79);
  vec3 ivoryB = vec3(0.99, 0.96, 0.88);
  vec3 goldA = vec3(0.92, 0.70, 0.26);
  vec3 goldB = vec3(0.99, 0.85, 0.46);
  vec3 lavA = vec3(0.64, 0.62, 0.88);
  vec3 lavB = vec3(0.84, 0.80, 0.97);
  vec3 roseA = vec3(0.89, 0.60, 0.54);
  vec3 roseB = vec3(0.98, 0.78, 0.70);
  if (s < SP1) return mix(ivoryA, ivoryB, r);
  if (s < SP2) return mix(goldA, goldB, r);
  if (s < SP3) return mix(lavA, lavB, r);
  return mix(roseA, roseB, r);
}

// x: 花瓣数, y: 花心半径, z: 花冠尺寸, w: 茎高
vec4 flowerShape(float s) {
  if (s < SP1) return vec4(10.0, 0.30, 0.86, 0.82);
  if (s < SP2) return vec4(5.0, 0.24, 0.82, 0.76);
  if (s < SP3) return vec4(6.0, 0.22, 0.84, 0.92);
  return vec4(5.0, 0.26, 0.96, 0.88);
}

// 远景地面混合花色，让远山花海无缝化作柔和色晕
vec3 flowerMean(float s) {
  vec3 c = mix(vec3(0.94, 0.91, 0.82), vec3(0.95, 0.76, 0.34), smoothstep(SP1 - 0.04, SP1 + 0.04, s));
  c = mix(c, vec3(0.74, 0.70, 0.92), smoothstep(SP2 - 0.04, SP2 + 0.04, s));
  c = mix(c, vec3(0.92, 0.68, 0.62), smoothstep(SP3 - 0.04, SP3 + 0.04, s));
  return c;
}
`

export const GLSL_WIND_WAKE = /* glsl */ `
uniform vec4 uWind;
uniform sampler2D uWakeTex;
uniform vec4 uWake;

// 行进阵风锋面（与 CPU 风带、落花粒子完全同步）
float windGust(vec2 xz, float t) {
  vec2 d = uWind.xy;
  vec2 a = vec2(dot(xz, d), dot(xz, vec2(-d.y, d.x)));
  float g1 = texture2D(uNoiseTex, vec2(a.x - t * 6.5, a.y * 0.45) / 256.0 * 1.4).r;
  float g2 = texture2D(uNoiseTex, vec2(a.x - t * 10.5, a.y * 0.6) / 256.0 * 3.8 + 0.31).g;
  return smoothstep(0.28, 0.78, g1 * 0.7 + g2 * 0.3);
}

vec3 sampleWake(vec2 xz) {
  if (uWake.w < 0.5) return vec3(0.0);
  vec2 uv = (xz - uWake.xy) * uWake.z + 0.5;
  if (uv.x <= 0.01 || uv.x >= 0.99 || uv.y <= 0.01 || uv.y >= 0.99) return vec3(0.0);
  vec2 edge = min(uv, 1.0 - uv);
  float border = smoothstep(0.01, 0.08, min(edge.x, edge.y));
  vec4 raw = texture2D(uWakeTex, uv);
  vec2 lean = (raw.rg * 255.0 - 128.0) / 127.0;
  float mag = length(lean);
  if (mag > 1.0) lean /= mag;
  return vec3(lean * border, saturate(raw.b) * border);
}
`

export const GLSL_CLOUD_LOOKUP = /* glsl */ `
uniform sampler2D uCloudTex;
uniform float uCloudReady;

vec4 sampleClouds(vec3 d, float time) {
  if (uCloudReady < 0.01 || d.y < -0.01) return vec4(0.0);
  float az = atan(d.z, d.x) * 0.15915494 + 0.5 + time * 0.00038;
  float el = asin(clamp(d.y, 0.0, 1.0)) * 0.63661977;
  return texture2D(uCloudTex, vec2(az, sqrt(clamp(el, 0.0, 1.0))));
}

vec3 shadeCloudDeck(vec3 skyCol, vec3 d, float time) {
  vec4 cl = sampleClouds(d, time);
  float cov = cl.r;
  float hf = cl.g;
  float topLight = cl.b;
  float cir = cl.a;
  float cloudFade = smoothstep(0.0, 0.12, d.y) * uCloudReady * (1.0 - uGalaxy * 0.86);
  if (cloudFade <= 0.002) return skyCol;

  float mu = dot(d, normalize(uSunDir));
  float g2 = 0.74 * 0.74;
  float hgPhase = (1.0 - g2) / (12.566 * pow(max(1.0 + g2 - 2.0 * 0.74 * mu, 0.02), 1.5));
  float sunRim = 0.72 + 1.35 * hgPhase;

  vec3 cloudShadowCol = mix(uSkyZenith * 0.85, uSkyHorizon * 0.76, 0.56);
  vec3 cloudLitCol = mix(uSkyHorizon * 1.06, uSunColor * 0.92, 0.56) * sunRim;
  vec3 cloudCol = mix(cloudShadowCol, cloudLitCol, smoothstep(0.14, 0.88, hf * 0.64 + topLight * 0.44));
  vec3 outCol = mix(skyCol, cloudCol, cov * 0.85 * cloudFade);

  vec3 cirCol = mix(uSkyHorizon, uSunColor, 0.42 + 0.45 * pow(max(mu, 0.0), 4.0));
  return mix(outCol, cirCol, cir * 0.44 * cloudFade);
}
`

export const GLSL_TONEMAP = /* glsl */ `
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 acesFilm(vec3 c) {
  const mat3 inM = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  const mat3 outM = mat3(
    1.60475, -0.10208, -0.00327,
    -0.53108, 1.10813, -0.07276,
    -0.07367, -0.00605, 1.07602
  );
  c = inM * c;
  c = RRTAndODTFit(c);
  c = outM * c;
  return clamp(c, 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`
