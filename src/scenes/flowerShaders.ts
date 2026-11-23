// 相机跟随的 GPU 野花：与草地共用同一套世界锚定分环、高度图与清除遮罩。
// 花冠用极坐标切片画出五瓣锯齿与暖金花心，远处按距离抽稀。

export const FLOWER_VERT = /* glsl */ `
  attribute float aPart;
  attribute vec2 aLocal;
  attribute vec2 aCell;
  attribute vec3 aSeed;
  uniform float uTime;
  uniform vec2 uCamXZ;
  uniform float uCell;
  uniform float uRadius;
  uniform vec4 uFade;
  uniform sampler2D uHeightTex;
  uniform vec2 uHeightOrigin;
  uniform float uHeightSpan;
  uniform float uWaterY;
  uniform sampler2D uWakeTex;
  uniform vec2 uWakeOrigin;
  uniform float uWakeSpan;
  varying float vPart;
  varying vec2 vLocal;
  varying float vRand;
  varying vec3 vWorld;
  varying float vView;

  

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  void main() {
    vPart = aPart;
    vLocal = aLocal;
    vRand = aSeed.x;

    vec2 cellIndex = floor(uCamXZ / uCell) + aCell;
    vec2 jitter = hash2(cellIndex + aSeed.xy * 37.0);
    vec2 wrapped = (cellIndex + jitter) * uCell - uCamXZ;
    wrapped -= uRadius * 2.0 * round(wrapped / (uRadius * 2.0));
    vec2 xz = uCamXZ + wrapped;
    float dist = length(wrapped);
    float keep = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
    // 远处抽稀：只留一部分实例，避免远环糊成一片
    keep *= step(fract(aSeed.z * 91.7), mix(1.0, 0.45, smoothstep(uFade.y, uFade.z, dist)));
    if (keep <= 0.02) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec4 packed = texture2D(uHeightTex, clamp((xz - uHeightOrigin) / uHeightSpan, 0.0, 1.0));
    float ground = -20.0 + ((packed.r * 65280.0 + packed.g * 255.0) / 65535.0) * 40.0;
    float cleared = smoothstep(0.28, 0.82, packed.b);
    if (cleared > 0.9 || ground < uWaterY) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    float h = (0.24 + fract(aSeed.x * 5.31) * 0.3) * keep;
    float sway = sin(uTime * 1.7 + aSeed.y * 31.4 + xz.x * 0.2) * 0.04 * h;
    vec2 wuv = (xz - uWakeOrigin) / uWakeSpan;
    vec2 wpush = (texture2D(uWakeTex, clamp(wuv, 0.0, 1.0)).rg - 0.5) * 2.0;

    vec3 local = vec3(aLocal.x, aPart > 0.5 ? h : position.y * h, aLocal.y);
    float yaw = aSeed.y * 6.2831853;
    float cs = cos(yaw);
    float sn = sin(yaw);
    local.xz = mat2(cs, -sn, sn, cs) * local.xz;
    vec3 world = vec3(xz.x + local.x + sway + wpush.x * 0.3, ground + local.y, xz.y + local.z + wpush.y * 0.3);

    vWorld = world;
    vView = keep;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`

export const FLOWER_FRAG = /* glsl */ `
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform float uSunPower;
  uniform float uGalaxy;
  varying float vPart;
  varying vec2 vLocal;
  varying float vRand;
  varying vec3 vWorld;
  varying float vView;

  void main() {
    // 主花之外的一层柔光，夜里随银河量压暗
    float daylight = 1.0 - smoothstep(0.3, 0.8, uGalaxy);
    vec3 col;
    if (vPart < 0.5) {
      col = mix(vec3(0.09, 0.16, 0.07), vec3(0.2, 0.32, 0.12), vRand);
      col = col * uAmbient * 1.2 + col * uSunColor * 0.35 * daylight;
    } else {
      float r = length(vLocal);
      float petal = 0.5 + 0.5 * cos(atan(vLocal.y, vLocal.x) * 5.0);
      petal = smoothstep(0.08, 0.72, r - petal * 0.16);
      vec3 head = mix(vec3(0.98, 0.92, 0.78), vec3(1.0, 0.82, 0.66), vRand);
      vec3 heart = vec3(1.0, 0.82, 0.42);
      col = mix(heart, head, smoothstep(0.12, 0.34, r));
      float vein = 0.82 + 0.18 * cos(atan(vLocal.y, vLocal.x) * 10.0);
      col *= vein;
      col = col * (0.55 + 0.65 * uSunPower * daylight) * (1.0 - 0.35 * petal * r);
      col += uSunColor * pow(max(vLocal.y * 0.5 + 0.5, 0.0), 3.0) * 0.12 * uSunPower * daylight;
    }
    gl_FragColor = vec4(col * mix(0.75, 1.0, vView), 1.0);
  }
`
