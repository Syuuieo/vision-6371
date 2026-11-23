// 草地与野花共用的程序化噪声、簇生与云影片段。
// 只写算法结构（值噪声 / 多尺度色斑 / 云影漂移），全部由 SKY_KEYS 的昼夜量驱动。

export const MEADOW_NOISE = /* glsl */ `
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float hash1(vec2 p) {
    return fract(sin(dot(p, vec2(41.17, 289.3))) * 43758.5453);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash1(i);
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm2(vec2 p) {
    return vnoise(p) * 0.62 + vnoise(p * 2.17 + 13.7) * 0.26 + vnoise(p * 4.31 + 41.1) * 0.12;
  }
`

// 云影：两层缓慢漂移的噪声，白天压暗太阳直射，夜里随 uGalaxy 归零。
export const CLOUD_SHADOW = /* glsl */ `
  float cloudShadow(vec2 xz, float t, float daylight) {
    float a = fbm2(xz * 0.0125 + vec2(t * 0.0072, t * 0.0041));
    float b = fbm2(xz * 0.0321 - vec2(t * 0.0115, t * 0.0058));
    float shade = smoothstep(0.24, 0.62, a * 0.72 + b * 0.38);
    return mix(1.0, 0.74 + 0.26 * shade, daylight);
  }
`

// 多尺度草原色斑：宏观冷暖、中观湿润、微观叶片扰动。
export const MEADOW_TINT = /* glsl */ `
  vec3 meadowTint(vec2 xz, float seed, float moisture) {
    float macro = fbm2(xz * 0.021 + 5.3);
    float meso = fbm2(xz * 0.089 + 21.7);
    float micro = vnoise(xz * 0.43 + seed * 13.0);
    vec3 cool = vec3(0.62, 0.86, 0.52);
    vec3 warm = vec3(0.96, 0.86, 0.56);
    vec3 wet = vec3(0.42, 0.72, 0.46);
    vec3 col = mix(cool, warm, smoothstep(0.35, 0.72, macro));
    col = mix(col, wet, smoothstep(0.45, 0.85, meso) * moisture);
    return col * (0.9 + 0.2 * micro);
  }
`
