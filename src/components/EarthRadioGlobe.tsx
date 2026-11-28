import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'

export interface GlobeBeacon {
  id: string
  label: string
  lat: number
  lon: number
  heat: number
  origin: 'cloud' | 'local' | 'seed'
  featured?: boolean
  accent?: string
}

export interface EarthRadioGlobeHandle {
  focusCity: (cityId: string) => void
  triggerGlobalPulse: () => void
}

interface EarthRadioGlobeProps {
  beacons: GlobeBeacon[]
  selectedId: string | null
  onSelect: (beacon: GlobeBeacon) => void
  onHover?: (beacon: GlobeBeacon | null) => void
  cutaway?: boolean
  onSelectCore?: () => void
  className?: string
}

interface MarkerApi {
  beacon: GlobeBeacon
  group: THREE.Group
  pin: THREE.Group
  orbitalRing: THREE.Mesh
  localDir: THREE.Vector3
  hit: THREE.Mesh
  halo: THREE.Sprite
  ring: THREE.Mesh
  label: THREE.Sprite
  labelMaterial: THREE.SpriteMaterial
  phase: number
  hoverScale: number
}

const GLOBE_RADIUS = 1.56
const PULSE_DURATION = 1.8
const SUN_DIRECTION = new THREE.Vector3(0.91, 0.24, 0.34).normalize()

function drawSmoothPolygon(
  ctx: CanvasRenderingContext2D,
  coords: [number, number][],
  w: number,
  h: number,
) {
  if (coords.length < 3) return
  const points = coords.map(([lon, lat]): [number, number] => [
    ((lon + 180) / 360) * w,
    ((90 - lat) / 180) * h,
  ])
  ctx.beginPath()
  const firstMidX = (points[points.length - 1][0] + points[0][0]) / 2
  const firstMidY = (points[points.length - 1][1] + points[0][1]) / 2
  ctx.moveTo(firstMidX, firstMidY)
  for (let i = 0; i < points.length; i += 1) {
    const curr = points[i]
    const next = points[(i + 1) % points.length]
    const midX = (curr[0] + next[0]) / 2
    const midY = (curr[1] + next[1]) / 2
    ctx.quadraticCurveTo(curr[0], curr[1], midX, midY)
  }
  ctx.closePath()
}

function makeEarthTexture() {
  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // 1. Vibrant cerulean-to-ocean-turquoise gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h)
    oceanGrad.addColorStop(0, '#12467c')
    oceanGrad.addColorStop(0.22, '#1d72b2')
    oceanGrad.addColorStop(0.42, '#2494c8')
    oceanGrad.addColorStop(0.5, '#29a4cf')
    oceanGrad.addColorStop(0.58, '#2494c8')
    oceanGrad.addColorStop(0.78, '#1d72b2')
    oceanGrad.addColorStop(1, '#12467c')
    ctx.fillStyle = oceanGrad
    ctx.fillRect(0, 0, w, h)

    // Soft ocean sunlit turquoise currents & subtle celestial atlas lines
    const sunOcean = ctx.createRadialGradient(w * 0.78, h * 0.36, 40, w * 0.78, h * 0.36, 660)
    sunOcean.addColorStop(0, 'rgba(116, 236, 248, 0.3)')
    sunOcean.addColorStop(0.55, 'rgba(64, 182, 226, 0.14)')
    sunOcean.addColorStop(1, 'rgba(22, 75, 130, 0)')
    ctx.fillStyle = sunOcean
    ctx.fillRect(0, 0, w, h)

    const southCurrent = ctx.createRadialGradient(w * 0.88, h * 0.66, 30, w * 0.88, h * 0.66, 480)
    southCurrent.addColorStop(0, 'rgba(92, 224, 234, 0.24)')
    southCurrent.addColorStop(1, 'rgba(22, 75, 130, 0)')
    ctx.fillStyle = southCurrent
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(196, 238, 255, 0.08)'
    ctx.lineWidth = 1
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = ((lon + 180) / 360) * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * h
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // 2. Stylized world continent polygons (lon, lat)
    const continents: [number, number][][] = [
      // Eurasia + India + SE Asia + East China / Bohai / Manchuria / Siberia
      [
        [-9, 36], [-9, 43], [-2, 44], [2, 51], [8, 55], [5, 61], [15, 69],
        [28, 71], [45, 68], [72, 73], [104, 77], [135, 71], [174, 66],
        [162, 59], [156, 51], [142, 54], [136, 44], [129, 35], [126, 38],
        [124, 40], [120, 39], [122, 37], [120, 35], [122, 31], [120, 28],
        [116, 23], [110, 20], [108, 17], [109, 11], [104, 2], [100, 12],
        [96, 16], [90, 22], [81, 13], [77, 8], [72, 20], [66, 25],
        [57, 25], [48, 29], [59, 22], [53, 16], [43, 13], [34, 29],
        [32, 31], [25, 36], [16, 38], [12, 44], [4, 43],
      ],
      // UK & Ireland
      [[-6, 50], [-5, 58], [0, 58], [1, 52], [-3, 50]],
      // Japan (Kyushu - Honshu - Hokkaido arc)
      [[130, 31], [131, 34], [136, 35], [140, 36], [141, 41], [145, 44], [141, 45], [139, 40], [135, 36], [130, 33]],
      // Taiwan & Hainan
      [[120.2, 22], [120.8, 25.2], [121.9, 24.8], [121.2, 22.1]],
      [[108.7, 18.4], [109.5, 20.0], [110.8, 19.6], [109.7, 18.2]],
      // Sumatra / Java / Borneo / Philippines
      [[95, 5], [105, -6], [114, -8], [105, -1], [98, 3]],
      [[109, -3], [118, -3], [118, 6], [112, 3]],
      [[120, 18], [123, 14], [126, 7], [122, 7], [120, 14]],
      // Africa
      [
        [-17, 15], [-16, 25], [-6, 36], [10, 37], [24, 32], [33, 31],
        [43, 12], [51, 12], [41, -2], [40, -15], [33, -26], [20, -35],
        [15, -26], [12, -12], [9, 4], [2, 6], [-8, 5], [-15, 11],
      ],
      // Madagascar
      [[44, -25], [47, -14], [50, -16], [47, -25]],
      // Australia & New Zealand
      [[114, -22], [122, -17], [131, -12], [136, -15], [142, -11], [150, -22], [153, -29], [148, -38], [138, -36], [126, -33], [115, -34]],
      [[167, -46], [172, -41], [178, -38], [175, -42]],
      // North & Central America
      [
        [-168, 66], [-162, 55], [-145, 60], [-130, 54], [-124, 42], [-115, 31],
        [-105, 20], [-92, 15], [-84, 9], [-78, 9], [-83, 15], [-90, 21],
        [-97, 26], [-89, 30], [-82, 25], [-80, 32], [-70, 42], [-60, 46],
        [-54, 52], [-65, 61], [-80, 63], [-95, 69], [-125, 71], [-155, 71],
      ],
      // Greenland & Iceland & Hawaii
      [[-52, 60], [-44, 60], [-20, 74], [-28, 82], [-58, 80], [-56, 68]],
      [[-24, 64], [-14, 64], [-15, 66.5], [-23, 66.2]],
      [[-160, 21.5], [-155.2, 19.3], [-154.8, 20.3], [-158.8, 22.1]],
      // South America
      [
        [-78, 9], [-72, 12], [-61, 10], [-49, 1], [-35, -6], [-39, -18],
        [-48, -28], [-58, -39], [-66, -54], [-74, -52], [-73, -38], [-71, -18],
        [-81, -5], [-79, 2],
      ],
    ]

    const landGrad = ctx.createLinearGradient(0, h * 0.14, 0, h * 0.88)
    landGrad.addColorStop(0, '#5ea17e')
    landGrad.addColorStop(0.32, '#539978')
    landGrad.addColorStop(0.55, '#d2b074')
    landGrad.addColorStop(0.78, '#539978')
    landGrad.addColorStop(1, '#6aa387')

    for (const poly of continents) {
      drawSmoothPolygon(ctx, poly, w, h)
      ctx.save()
      ctx.shadowColor = 'rgba(116, 238, 244, 0.44)'
      ctx.shadowBlur = 22
      ctx.fillStyle = landGrad
      ctx.fill()
      ctx.restore()

      ctx.strokeStyle = 'rgba(136, 240, 246, 0.48)'
      ctx.lineWidth = 3.5
      ctx.stroke()
    }

    // Warm sunlit plateau & highland accents (Tibetan Plateau, Rockies, Andes, Sahara, Mongolia)
    const plateaus: [number, number, number, number, string][] = [
      [88, 33, 140, 62, 'rgba(224, 184, 118, 0.48)'],
      [104, 42, 120, 48, 'rgba(218, 178, 112, 0.35)'],
      [16, 22, 210, 64, 'rgba(228, 188, 122, 0.44)'],
      [-110, 42, 90, 95, 'rgba(216, 175, 110, 0.34)'],
      [-68, -22, 48, 115, 'rgba(218, 178, 112, 0.36)'],
      [115, 31, 140, 88, 'rgba(255, 224, 158, 0.24)'],
    ]
    for (const [lon, lat, rx, ry, color] of plateaus) {
      const cx = ((lon + 180) / 360) * w
      const cy = ((90 - lat) / 180) * h
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(rx, ry))
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(204, 169, 110, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Polar ice shelves
    const northIce = ctx.createLinearGradient(0, 0, 0, h * 0.085)
    northIce.addColorStop(0, '#e6f3ff')
    northIce.addColorStop(0.65, 'rgba(230, 243, 255, 0.55)')
    northIce.addColorStop(1, 'rgba(230, 243, 255, 0)')
    ctx.fillStyle = northIce
    ctx.fillRect(0, 0, w, h * 0.085)

    const southIce = ctx.createLinearGradient(0, h * 0.89, 0, h)
    southIce.addColorStop(0, 'rgba(230, 243, 255, 0)')
    southIce.addColorStop(0.35, 'rgba(230, 243, 255, 0.72)')
    southIce.addColorStop(1, '#e6f3ff')
    ctx.fillStyle = southIce
    ctx.fillRect(0, h * 0.89, w, h * 0.11)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeNightLightsTexture() {
  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'

    let seed = 637105
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    const project = (lon: number, lat: number): [number, number] => [
      ((lon + 180) / 360) * w,
      ((90 - lat) / 180) * h,
    ]

    const drawGlowDot = (x: number, y: number, radius: number, intensity: number) => {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      grad.addColorStop(0, `rgba(255, 244, 206, ${Math.min(1, intensity)})`)
      grad.addColorStop(0.28, `rgba(255, 204, 118, ${Math.min(1, intensity * 0.76)})`)
      grad.addColorStop(0.65, `rgba(232, 138, 48, ${Math.min(1, intensity * 0.28)})`)
      grad.addColorStop(1, 'rgba(232, 138, 48, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // [lon, lat, spreadPx, dotCount, strength]
    const hubs: [number, number, number, number, number][] = [
      // East China, North China, Pearl River & Inland hubs
      [121.5, 31.2, 24, 52, 0.95], // Shanghai / Yangtze Delta
      [118.8, 32.0, 18, 34, 0.8], // Nanjing
      [120.2, 30.2, 16, 30, 0.78], // Hangzhou
      [116.4, 39.9, 25, 54, 0.96], // Beijing / Tianjin
      [120.4, 36.1, 16, 28, 0.76], // Qingdao / Shandong
      [113.4, 22.8, 22, 48, 0.92], // Guangzhou / Shenzhen / Hong Kong
      [121.5, 25.0, 11, 22, 0.78], // Taipei
      [114.3, 30.6, 17, 32, 0.78], // Wuhan
      [108.9, 34.3, 15, 26, 0.72], // Xi'an
      [104.1, 30.6, 19, 36, 0.82], // Chengdu / Chongqing
      [126.6, 45.8, 15, 24, 0.7], // Harbin / NE China
      [123.4, 41.8, 16, 26, 0.72], // Shenyang
      [100.2, 25.6, 10, 16, 0.56], // Dali / Yunnan
      [109.5, 18.3, 9, 14, 0.58], // Sanya
      [91.1, 29.6, 8, 12, 0.5], // Lhasa
      // Japan & Korea
      [139.7, 35.7, 22, 50, 0.98], // Tokyo / Kanto
      [135.7, 35.0, 18, 40, 0.9], // Kyoto / Osaka / Kansai
      [130.4, 33.6, 12, 20, 0.72], // Fukuoka
      [141.3, 43.1, 10, 15, 0.6], // Sapporo
      [127.0, 37.6, 16, 34, 0.88], // Seoul
      // South & Southeast Asia
      [103.8, 1.35, 13, 24, 0.84], // Singapore
      [100.5, 13.8, 15, 26, 0.74], // Bangkok
      [121.0, 14.6, 13, 22, 0.74], // Manila
      [106.8, -6.2, 16, 28, 0.76], // Jakarta / Java
      [77.2, 28.6, 26, 48, 0.86], // Delhi / Indo-Gangetic plain
      [72.9, 19.1, 18, 34, 0.82], // Mumbai
      [77.6, 13.0, 16, 26, 0.72], // Bengaluru
      // Europe & North Atlantic
      [2.35, 48.86, 24, 52, 0.96], // Paris
      [-0.1, 51.5, 22, 46, 0.94], // London / UK
      [5.8, 51.3, 22, 46, 0.9], // Benelux / Rhine-Ruhr
      [9.2, 45.5, 20, 42, 0.88], // Milan / Northern Italy
      [12.5, 41.9, 15, 26, 0.76], // Rome
      [-3.7, 40.4, 16, 28, 0.78], // Madrid
      [2.2, 41.4, 13, 22, 0.74], // Barcelona
      [13.4, 52.5, 18, 32, 0.8], // Berlin
      [18.1, 59.3, 12, 20, 0.68], // Stockholm
      [37.6, 55.8, 22, 42, 0.86], // Moscow
      [29.0, 41.0, 17, 32, 0.82], // Istanbul
      [-21.9, 64.1, 9, 14, 0.66], // Reykjavik
      // Middle East & Africa
      [31.2, 30.0, 18, 38, 0.88], // Cairo / Nile Delta
      [55.3, 25.3, 15, 28, 0.84], // Dubai / Persian Gulf
      [3.4, 6.5, 14, 22, 0.68], // Lagos
      [28.0, -26.2, 16, 28, 0.74], // Johannesburg
      [18.4, -33.9, 13, 24, 0.78], // Cape Town
      // Oceania & Pacific
      [151.2, -33.9, 16, 32, 0.86], // Sydney
      [145.0, -37.8, 14, 24, 0.76], // Melbourne
      [153.0, -27.5, 11, 18, 0.68], // Brisbane
      [115.9, -31.9, 10, 14, 0.6], // Perth
      [174.8, -36.8, 10, 15, 0.64], // Auckland
      [-157.8, 21.3, 10, 18, 0.78], // Hawaii / Honolulu
      // Americas
      [-74.0, 40.7, 26, 56, 0.98], // New York / Northeast corridor
      [-77.0, 38.9, 18, 32, 0.84], // Washington DC
      [-80.2, 25.8, 16, 28, 0.8], // Miami / Florida
      [-87.6, 41.9, 24, 46, 0.88], // Chicago / Great Lakes
      [-79.4, 43.7, 17, 30, 0.82], // Toronto
      [-96.8, 32.8, 22, 38, 0.82], // Dallas / Houston
      [-118.2, 34.0, 20, 42, 0.92], // Los Angeles
      [-122.4, 37.8, 16, 32, 0.84], // San Francisco Bay
      [-122.3, 47.6, 13, 22, 0.74], // Seattle
      [-99.1, 19.4, 18, 34, 0.84], // Mexico City
      [-46.6, -23.5, 20, 40, 0.88], // Sao Paulo
      [-43.2, -22.9, 14, 24, 0.78], // Rio de Janeiro
      [-58.4, -34.6, 17, 30, 0.82], // Buenos Aires
      [-70.7, -33.4, 12, 20, 0.7], // Santiago
      [-74.1, 4.7, 12, 18, 0.66], // Bogota
    ]

    // Subtle illuminated transport corridors between major neighboring metros
    const corridors: [[number, number], [number, number]][] = [
      [[116.4, 39.9], [121.5, 31.2]],
      [[121.5, 31.2], [113.4, 22.8]],
      [[114.3, 30.6], [104.1, 30.6]],
      [[135.7, 35.0], [139.7, 35.7]],
      [[-0.1, 51.5], [2.35, 48.86]],
      [[2.35, 48.86], [9.2, 45.5]],
      [[5.8, 51.3], [13.4, 52.5]],
      [[31.2, 30.0], [32.6, 25.7]],
      [[-71.1, 42.3], [-77.0, 38.9]],
      [[-74.0, 40.7], [-87.6, 41.9]],
      [[-122.4, 37.8], [-118.2, 34.0]],
      [[-46.6, -23.5], [-43.2, -22.9]],
    ]

    for (const [[lonA, latA], [lonB, latB]] of corridors) {
      const [x1, y1] = project(lonA, latA)
      const [x2, y2] = project(lonB, latB)
      const steps = 14
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps
        const px = x1 + (x2 - x1) * t + (rand() - 0.5) * 6
        const py = y1 + (y2 - y1) * t + (rand() - 0.5) * 5
        drawGlowDot(px, py, 2.2 + rand() * 3.4, 0.24 + rand() * 0.22)
      }
    }

    for (const [lon, lat, spread, count, strength] of hubs) {
      const [cx, cy] = project(lon, lat)
      // Central metropolis core glow
      drawGlowDot(cx, cy, Math.max(5.5, spread * 0.45), strength * 0.92)
      drawGlowDot(cx, cy, Math.max(2.6, spread * 0.19), Math.min(1, strength * 1.1))
      // Satellite suburbs and sparkling urban web
      for (let i = 0; i < count; i += 1) {
        const angle = rand() * Math.PI * 2
        const dist = Math.pow(rand(), 1.55) * spread
        const ox = cx + Math.cos(angle) * dist * 1.18
        const oy = cy + Math.sin(angle) * dist * 0.86
        const dotR = 1.2 + rand() * 3.6
        const dotStrength = (0.28 + rand() * 0.62) * strength * (1 - (dist / (spread + 1)) * 0.48)
        drawGlowDot(ox, oy, dotR, dotStrength)
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeCloudTexture() {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, w, h)
    let seed = 4217
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < 95; i += 1) {
      const cx = rand() * w
      const cy = h * 0.14 + rand() * h * 0.72
      const rx = 38 + rand() * 88
      const ry = 10 + rand() * 24
      const alpha = 0.08 + rand() * 0.16
      const drawAt = (ox: number) => {
        const g = ctx.createRadialGradient(ox, cy, rx * 0.1, ox, cy, rx)
        g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
        g.addColorStop(0.55, `rgba(240, 248, 255, ${alpha * 0.55})`)
        g.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(ox, cy, rx, ry, (rand() - 0.5) * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }
      drawAt(cx)
      if (cx < rx) drawAt(cx + w)
      if (cx > w - rx) drawAt(cx - w)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vLocalDir;

  void main() {
    vUv = uv;
    // Surface mesh is rotated by -PI/2 around Y inside globe group; align vLocalDir with globe axes
    vLocalDir = normalize(vec3(-position.z, position.y, position.x));
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    vec4 mvPos = viewMatrix * worldPos;
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uPulseProgress;
  uniform float uPulseStrength;
  uniform float uCutaway;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vLocalDir;

  void main() {
    if (uCutaway > 0.01) {
      float cutX = mix(1.05, 0.02, uCutaway);
      float cutY = mix(1.05, -0.15, uCutaway);
      float cutZ = mix(1.05, 0.02, uCutaway);
      if (vLocalDir.x > cutX && vLocalDir.y > cutY && vLocalDir.z > cutZ) {
        discard;
      }
    }

    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 viewN = normalize(vViewNormal);
    vec3 viewV = normalize(-vViewPos);

    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    vec3 nightLights = texture2D(uNightMap, vUv).rgb;

    float ndl = dot(N, L);
    float dayMix = smoothstep(-0.18, 0.24, ndl);
    float nightMix = smoothstep(0.16, -0.26, ndl);
    float terminator = exp(-pow((ndl + 0.02) / 0.17, 2.0));

    // Vibrant sunlit hemisphere with turquoise ocean sheen
    float diffuse = 0.24 + 0.92 * max(ndl, 0.0);
    vec3 dayCol = dayTex * vec3(1.04, 1.08, 1.12) * diffuse;

    float oceanMask = smoothstep(0.03, 0.16, dayTex.b - max(dayTex.r, dayTex.g * 0.85));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 30.0) * oceanMask * dayMix;
    dayCol += vec3(0.45, 0.86, 1.0) * spec * 0.42;

    // Luminous midnight-indigo shadow side + twinkling golden metropolitan clusters
    vec3 nightBase = dayTex * vec3(0.06, 0.11, 0.22) + vec3(0.008, 0.018, 0.045);
    float twinkle = 0.92 + 0.08 * sin(uTime * 2.4 + vUv.x * 95.0 + vUv.y * 55.0);
    vec3 cityGlow = nightLights * vec3(1.48, 1.12, 0.62) * nightMix * twinkle * (1.55 + uPulseStrength * 0.7);

    // Warm sunset amber scattering along the day/night terminator
    vec3 twilightGlow = vec3(0.95, 0.56, 0.28) * terminator * 0.14;

    vec3 color = mix(nightBase, dayCol, dayMix) + cityGlow + twilightGlow;

    // Subtle front-side orbital Fresnel atmosphere scattering
    float fresnel = pow(1.0 - max(dot(viewN, viewV), 0.0), 3.15);
    vec3 skyRim = mix(vec3(0.18, 0.56, 0.96), vec3(0.95, 0.72, 0.42), smoothstep(0.1, 0.9, ndl) * 0.36);
    color += skyRim * fresnel * (0.28 + 0.52 * smoothstep(-0.35, 0.6, ndl));

    // Global Core Heartbeat mantle sweep across the globe surface
    if (uPulseStrength > 0.001) {
      float latCoord = abs(vLocalDir.y);
      float band = exp(-pow((latCoord - uPulseProgress * 1.18) / 0.1, 2.0));
      float innerHalo = exp(-pow((latCoord - max(0.0, uPulseProgress - 0.16) * 1.18) / 0.14, 2.0)) * 0.45;
      color += vec3(0.96, 0.72, 0.34) * (band + innerHalo) * uPulseStrength * 0.58;
    }

    // Incandescent magma rim along the X-ray cutaway border
    if (uCutaway > 0.01) {
      float cutX = mix(1.05, 0.02, uCutaway);
      float cutY = mix(1.05, -0.15, uCutaway);
      float cutZ = mix(1.05, 0.02, uCutaway);
      float dX = vLocalDir.x - cutX;
      float dY = vLocalDir.y - cutY;
      float dZ = vLocalDir.z - cutZ;
      float edgeDist = 1.0;
      if (dY > -0.05 && dZ > -0.05) edgeDist = min(edgeDist, abs(dX));
      if (dX > -0.05 && dZ > -0.05) edgeDist = min(edgeDist, abs(dY));
      if (dX > -0.05 && dY > -0.05) edgeDist = min(edgeDist, abs(dZ));
      float rim = (1.0 - smoothstep(0.0, 0.052, edgeDist)) * smoothstep(0.05, 0.35, uCutaway);
      float rimPulse = 0.88 + 0.12 * sin(uTime * 3.1 + (vLocalDir.x + vLocalDir.y + vLocalDir.z) * 14.0);
      color += vec3(1.24, 0.52, 0.18) * rim * rimPulse * 1.45;
    }

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

const CLOUD_VERTEX = /* glsl */ `
  uniform float uRotY;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vGlobeDir;

  void main() {
    vUv = uv;
    float c = cos(uRotY);
    float s = sin(uRotY);
    vec3 p = normalize(position);
    vGlobeDir = normalize(vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c));
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDir;
  uniform float uCutaway;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vGlobeDir;

  void main() {
    if (uCutaway > 0.01) {
      float cutX = mix(1.05, 0.02, uCutaway);
      float cutY = mix(1.05, -0.15, uCutaway);
      float cutZ = mix(1.05, 0.02, uCutaway);
      if (vGlobeDir.x > cutX && vGlobeDir.y > cutY && vGlobeDir.z > cutZ) {
        discard;
      }
    }
    vec4 tex = texture2D(uCloudMap, vUv);
    float ndl = dot(normalize(vWorldNormal), normalize(uSunDir));
    float light = 0.36 + 0.72 * smoothstep(-0.25, 0.55, ndl);
    vec3 col = mix(vec3(0.55, 0.72, 0.96), vec3(1.0, 0.98, 0.94), smoothstep(-0.15, 0.45, ndl)) * light;
    gl_FragColor = vec4(col, tex.a * 0.35);
    #include <colorspace_fragment>
  }
`

const CORE_SHELL_VERTEX = /* glsl */ `
  varying vec3 vLocalDir;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  void main() {
    vLocalDir = normalize(position);
    vViewNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`

const INNER_CRUST_FRAGMENT = /* glsl */ `
  uniform float uCutaway;
  varying vec3 vLocalDir;

  void main() {
    if (uCutaway > 0.01) {
      float cutX = mix(1.05, 0.02, uCutaway);
      float cutY = mix(1.05, -0.15, uCutaway);
      float cutZ = mix(1.05, 0.02, uCutaway);
      if (vLocalDir.x > cutX && vLocalDir.y > cutY && vLocalDir.z > cutZ) {
        discard;
      }
    }
    vec3 basalt = vec3(0.08, 0.035, 0.045);
    gl_FragColor = vec4(basalt, 1.0);
  }
`

const MANTLE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vLocalDir;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  void main() {
    if (vLocalDir.x > 0.02 && vLocalDir.y > -0.15 && vLocalDir.z > 0.02) {
      discard;
    }
    vec3 p = vLocalDir * 6.4;
    float swirl1 = sin(p.x * 1.8 + uTime * 0.65) * cos(p.y * 2.1 - uTime * 0.5) * sin(p.z * 1.9 + uTime * 0.4);
    float swirl2 = sin((p.x - p.z) * 3.1 - uTime * 0.9) * cos((p.y + p.x) * 2.7 + uTime * 0.7);
    float magma = clamp(0.5 + 0.34 * swirl1 + 0.24 * swirl2, 0.0, 1.0);

    vec3 deepCrust = vec3(0.32, 0.06, 0.04);
    vec3 vermilion = vec3(0.86, 0.24, 0.08);
    vec3 moltenAmber = vec3(1.0, 0.68, 0.24);
    vec3 col = mix(deepCrust, vermilion, smoothstep(0.18, 0.66, magma));
    col = mix(col, moltenAmber, smoothstep(0.62, 0.94, magma));

    vec3 viewV = normalize(-vViewPos);
    float rim = pow(1.0 - abs(dot(normalize(vViewNormal), viewV)), 2.2);
    col += vec3(1.0, 0.52, 0.18) * rim * 0.55;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const OUTER_CORE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vLocalDir;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  void main() {
    if (vLocalDir.x > 0.02 && vLocalDir.y > -0.15 && vLocalDir.z > 0.02) {
      discard;
    }
    vec3 p = vLocalDir * 7.8;
    float flow = sin(p.x * 2.4 + uTime * 1.15) * cos(p.z * 2.4 - uTime * 0.95)
               + 0.55 * sin((p.y * 3.2 + p.x * 1.8) + uTime * 1.4);
    float heat = clamp(0.54 + 0.32 * flow, 0.0, 1.0);

    vec3 liquidGold = mix(vec3(0.84, 0.38, 0.08), vec3(1.0, 0.76, 0.32), smoothstep(0.15, 0.75, heat));
    liquidGold = mix(liquidGold, vec3(1.0, 0.94, 0.72), smoothstep(0.72, 0.98, heat));

    vec3 viewV = normalize(-vViewPos);
    float rim = pow(1.0 - abs(dot(normalize(vViewNormal), viewV)), 2.0);
    liquidGold += vec3(1.0, 0.85, 0.5) * rim * 0.42;

    gl_FragColor = vec4(liquidGold, 1.0);
    #include <colorspace_fragment>
  }
`

const INNER_CORE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vLocalDir;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;

  void main() {
    float pulse = 0.92 + 0.08 * sin(uTime * 2.6 + vLocalDir.y * 5.0);
    vec3 viewV = normalize(-vViewPos);
    float facing = clamp(abs(dot(normalize(vViewNormal), viewV)), 0.0, 1.0);
    vec3 coreCol = mix(vec3(1.0, 0.74, 0.32), vec3(1.0, 0.98, 0.88), pow(facing, 0.65)) * pulse;
    gl_FragColor = vec4(coreCol * 1.18, 1.0);
    #include <colorspace_fragment>
  }
`

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uPulseBoost;

  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPos;

  void main() {
    vec3 viewDir = normalize(-vViewPos);
    // BackSide shell at 1.075R: backFacing = 0 at outer silhouette, ~0.367 right at Earth horizon
    float backFacing = clamp(dot(-normalize(vNormal), viewDir), 0.0, 1.0);
    float limb = smoothstep(0.0, 0.37, backFacing);
    float fresnel = pow(limb, 2.25);

    float sunAlign = dot(normalize(vWorldNormal), normalize(uSunDir));
    vec3 cyanGlow = vec3(0.32, 0.72, 1.0);
    vec3 warmAmber = vec3(0.949, 0.761, 0.545); // #f2c28b
    vec3 color = mix(cyanGlow, warmAmber, smoothstep(0.1, 0.92, sunAlign) * 0.42);
    color = mix(color, warmAmber * 1.12, uPulseBoost * 0.45);

    float sunEnvelope = 0.48 + 0.62 * smoothstep(-0.45, 0.68, sunAlign);
    float alpha = fresnel * sunEnvelope * (0.9 + uPulseBoost * 0.34);
    gl_FragColor = vec4(color * (1.06 + fresnel * 0.42 + uPulseBoost * 0.35), alpha);
  }
`

const PULSE_RING_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PULSE_RING_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;

  varying vec2 vPos;

  void main() {
    float r = length(vPos);
    float crest = exp(-pow((r - 0.93) / 0.045, 2.0));
    float wake = smoothstep(0.76, 0.94, r) * (1.0 - smoothstep(0.94, 1.0, r)) * 0.52;
    float angle = atan(vPos.y, vPos.x);
    float shimmer = 0.86 + 0.14 * sin(angle * 10.0 - uTime * 5.2);
    float alpha = (crest + wake) * shimmer * uOpacity;
    gl_FragColor = vec4(uColor * (1.15 + crest * 0.85), alpha);
  }
`

const ARC_VERTEX = /* glsl */ `
  attribute float aProgress;
  attribute float aOffset;
  varying float vProgress;
  varying float vOffset;
  void main() {
    vProgress = aProgress;
    vOffset = aOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ARC_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uBoost;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vProgress;
  varying float vOffset;

  void main() {
    float head = fract(uTime * 0.072 + vOffset);
    float delta = abs(vProgress - head);
    delta = min(delta, 1.0 - delta);
    float pulse = smoothstep(0.038 + uBoost * 0.022, 0.0, delta);
    float bead = smoothstep(0.92 - uBoost * 0.05, 1.0, fract(vProgress * 9.0 - uTime * 0.28 + vOffset * 2.0));
    float base = 0.028 + bead * 0.09 + uBoost * 0.06;
    float alpha = clamp(base + pulse * (0.56 + uBoost * 0.08), 0.0, 1.0);
    vec3 color = mix(uColorA, uColorB, smoothstep(0.1, 0.9, vProgress));
    color = mix(color, vec3(1.0, 0.88, 0.62), uBoost * 0.32);
    gl_FragColor = vec4(color * (1.0 + pulse * 0.72 + uBoost * 0.36), alpha);
  }
`

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function latLonToVector(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(lat)
  const lambda = THREE.MathUtils.degToRad(lon)
  const cosLat = Math.cos(phi)
  return new THREE.Vector3(
    cosLat * Math.sin(lambda) * radius,
    Math.sin(phi) * radius,
    cosLat * Math.cos(lambda) * radius,
  )
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.86)')
    gradient.addColorStop(0.44, 'rgba(255,255,255,0.24)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeLabelTexture(text: string, accent: string, featured = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    const displayText = featured ? `✦ ${text}` : text
    ctx.font = featured
      ? '600 22px "PingFang SC", "Microsoft YaHei", sans-serif'
      : '500 20px "PingFang SC", "Microsoft YaHei", sans-serif'
    const textWidth = ctx.measureText(displayText).width
    const pillW = Math.min(240, Math.max(120, textWidth + 38))
    const pillX = (256 - pillW) / 2
    ctx.fillStyle = featured ? 'rgba(9, 17, 36, 0.92)' : 'rgba(11, 22, 46, 0.78)'
    ctx.beginPath()
    ctx.roundRect(pillX, 12, pillW, 40, 20)
    ctx.fill()
    ctx.strokeStyle = featured ? 'rgba(242, 194, 139, 0.85)' : 'rgba(170, 206, 255, 0.38)'
    ctx.lineWidth = featured ? 1.8 : 1.2
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(displayText, 128, 33)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function makeCoreLabelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 96)
    ctx.fillStyle = 'rgba(10, 8, 16, 0.86)'
    ctx.beginPath()
    ctx.roundRect(22, 14, 468, 68, 34)
    ctx.fill()
    ctx.strokeStyle = 'rgba(242, 194, 139, 0.72)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#f2c28b'
    ctx.beginPath()
    ctx.arc(54, 48, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff5e2'
    ctx.font = '500 26px "SFMono-Regular", "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('6,371.4 KM · 落日六号', 268, 49)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function makeStrataTexture() {
  const w = 512
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Horizontal axis u = radial distance r / GLOBE_RADIUS (0 -> center, 1 -> crust)
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0.0, '#fff9e6')
    grad.addColorStop(0.24, '#ffe19e')
    grad.addColorStop(0.26, '#ffb94e')
    grad.addColorStop(0.42, '#e88224')
    grad.addColorStop(0.51, '#c94f16')
    grad.addColorStop(0.53, '#9e2612')
    grad.addColorStop(0.68, '#bd3414')
    grad.addColorStop(0.79, '#6b1810')
    grad.addColorStop(0.81, '#441212')
    grad.addColorStop(0.93, '#220f15')
    grad.addColorStop(0.96, '#141926')
    grad.addColorStop(0.988, '#d97834')
    grad.addColorStop(1.0, '#ffe3a8')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Painterly magma convection veins & geological mineral grain
    let seed = 637122
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    for (let i = 0; i < 65; i += 1) {
      const rx = w * (0.28 + rand() * 0.62)
      const ry = rand() * h
      const radX = 12 + rand() * 34
      const radY = 18 + rand() * 54
      const isOuterCore = rx < w * 0.52
      const g = ctx.createRadialGradient(rx, ry, 1, rx, ry, Math.max(radX, radY))
      if (isOuterCore) {
        g.addColorStop(0, 'rgba(255, 232, 160, 0.24)')
        g.addColorStop(1, 'rgba(255, 160, 48, 0)')
      } else {
        g.addColorStop(0, 'rgba(255, 118, 46, 0.22)')
        g.addColorStop(1, 'rgba(92, 18, 12, 0)')
      }
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(rx, ry, radX, radY, (rand() - 0.5) * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Crisp museum-grade hairline geological strata boundaries (Inner Core / Outer Core / Lower Mantle / Moho)
    const boundaries: [number, string, number][] = [
      [0.25, 'rgba(255, 250, 224, 0.78)', 2.4],
      [0.52, 'rgba(255, 206, 122, 0.65)', 2.0],
      [0.80, 'rgba(255, 134, 68, 0.55)', 1.8],
      [0.95, 'rgba(242, 194, 139, 0.42)', 1.4],
    ]
    for (const [frac, stroke, lw] of boundaries) {
      const x = frac * w
      ctx.strokeStyle = stroke
      ctx.lineWidth = lw
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeCutawayWedgeGeometry(plane: 'xy' | 'yz' | 'xz', radius: number): THREE.BufferGeometry {
  const cutX = 0.02 * radius
  const cutY = -0.15 * radius
  const cutZ = 0.02 * radius
  const outerR = radius * 0.988

  const planeOffset = plane === 'xy' ? cutZ : plane === 'yz' ? cutX : cutY
  const u0 = plane === 'xy' ? cutX : plane === 'yz' ? cutZ : cutX
  const v0 = plane === 'xy' ? cutY : plane === 'yz' ? cutY : cutZ
  const maxCircleR2 = Math.max(0.01, outerR * outerR - planeOffset * planeOffset)

  const angleSegs = 40
  const radialSegs = 22
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const nx = plane === 'yz' ? 1 : 0
  const ny = plane === 'xz' ? 1 : 0
  const nz = plane === 'xy' ? 1 : 0

  for (let ai = 0; ai <= angleSegs; ai += 1) {
    const aFrac = ai / angleSegs
    const angle = aFrac * (Math.PI / 2)
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    // Solve (u0 + t*ca)^2 + (v0 + t*sa)^2 = maxCircleR2
    const b = u0 * ca + v0 * sa
    const c = u0 * u0 + v0 * v0 - maxCircleR2
    const tMax = Math.max(0, -b + Math.sqrt(Math.max(0, b * b - c)))

    for (let ri = 0; ri <= radialSegs; ri += 1) {
      const rFrac = ri / radialSegs
      const t = rFrac * tMax
      const u = u0 + t * ca
      const v = v0 + t * sa
      let x = 0
      let y = 0
      let z = 0
      if (plane === 'xy') {
        x = u
        y = v
        z = planeOffset
      } else if (plane === 'yz') {
        x = planeOffset
        y = v
        z = u
      } else {
        x = u
        y = planeOffset
        z = v
      }
      positions.push(x, y, z)
      normals.push(nx, ny, nz)
      const distNorm = Math.min(1, Math.hypot(x, y, z) / radius)
      uvs.push(distNorm, aFrac)
    }
  }

  const stride = radialSegs + 1
  for (let ai = 0; ai < angleSegs; ai += 1) {
    for (let ri = 0; ri < radialSegs; ri += 1) {
      const a = ai * stride + ri
      const b = (ai + 1) * stride + ri
      const c = (ai + 1) * stride + (ri + 1)
      const d = ai * stride + (ri + 1)
      indices.push(a, b, d, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry?.dispose()
      const material = object.material
      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((item) => {
        if (!item) return
        const record = item as THREE.Material & { map?: THREE.Texture | null }
        record.map?.dispose()
        item.dispose()
      })
    } else if (object instanceof THREE.Sprite) {
      object.material.map?.dispose()
      object.material.dispose()
    }
  })
}

function targetQuaternionFor(lat: number, lon: number) {
  const pitch = THREE.MathUtils.degToRad(lat)
  const yaw = THREE.MathUtils.degToRad(-lon)
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  return qx.multiply(qy)
}

function buildBeaconPin(_city: string, accentHex: number, featured = false): { root: THREE.Group; orbitalRing: THREE.Mesh } {
  const root = new THREE.Group()
  // Align +Y radial pin outward along surface normal (+Z)
  root.rotation.x = Math.PI / 2

  const spireHeight = featured ? 0.19 : 0.115
  const spireMat = new THREE.MeshStandardMaterial({
    color: featured ? 0xfff0d4 : 0xdce9ff,
    emissive: accentHex,
    emissiveIntensity: featured ? 0.45 : 0.2,
    roughness: 0.3,
    metalness: 0.45,
  })
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(featured ? 0.008 : 0.005, featured ? 0.017 : 0.011, spireHeight, 10),
    spireMat,
  )
  spire.position.y = spireHeight * 0.5
  root.add(spire)

  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfff8eb,
    emissive: accentHex,
    emissiveIntensity: featured ? 0.92 : 0.55,
    roughness: 0.2,
    metalness: 0.25,
  })
  const starTip = new THREE.Mesh(new THREE.OctahedronGeometry(featured ? 0.036 : 0.022, 0), starMat)
  starTip.position.y = spireHeight + 0.018
  root.add(starTip)

  const orbitalRing = new THREE.Mesh(
    new THREE.TorusGeometry(featured ? 0.052 : 0.032, featured ? 0.0038 : 0.0024, 8, 28),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: featured ? 0.78 : 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  orbitalRing.position.y = spireHeight + 0.018
  orbitalRing.rotation.set(Math.PI / 3, 0, Math.PI / 6)
  root.add(orbitalRing)

  return { root, orbitalRing }
}

const LABEL_OFFSETS: Record<string, [number, number, number]> = {
  哈尔滨: [0.2, 0.1, 0.2],
  北京: [-0.22, 0.1, 0.22],
  青岛: [0.24, 0.08, 0.2],
  西安: [-0.22, 0.06, 0.22],
  阿格拉: [0.24, 0.04, 0.2],
  复活节岛: [-0.22, -0.06, 0.22],
  杭州: [0.26, -0.14, 0.2],
  罗马: [-0.18, -0.1, 0.22],
  成都: [-0.24, -0.04, 0.2],
  拉萨: [-0.26, 0.06, 0.2],
  大理: [-0.22, -0.15, 0.2],
  格鲁吉亚: [-0.24, 0.08, 0.22],
  三亚: [0.2, -0.14, 0.2],
  悉尼: [0.24, -0.06, 0.22],
  吉萨: [0.22, 0.08, 0.22],
  雷克雅未克: [0.24, 0.08, 0.22],
  开普敦: [0.24, -0.08, 0.22],
  京都: [0.26, 0.08, 0.22],
  巴黎: [-0.22, 0.1, 0.22],
}

function labelOffsetFor(city: string): [number, number, number] {
  for (const [key, offset] of Object.entries(LABEL_OFFSETS)) {
    if (city.includes(key)) return offset
  }
  return [0.22, 0.1, 0.22]
}

export const EarthRadioGlobe = forwardRef<EarthRadioGlobeHandle, EarthRadioGlobeProps>(
  function EarthRadioGlobe(
    { beacons, selectedId, onSelect, onHover, cutaway = false, onSelectCore, className },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null)
    const selectedRef = useRef(selectedId)
    const beaconsRef = useRef(beacons)
    const selectRef = useRef(onSelect)
    const hoverRef = useRef(onHover)
    const cutawayRef = useRef(cutaway)
    const selectCoreRef = useRef(onSelectCore)
    const apiRef = useRef<{
      focus: (id: string) => boolean
      pulse: () => void
      focusCutaway: () => void
    } | null>(null)
    const [webglFailed, setWebglFailed] = useState(false)

    useEffect(() => {
      selectedRef.current = selectedId
      beaconsRef.current = beacons
      selectRef.current = onSelect
      hoverRef.current = onHover
      selectCoreRef.current = onSelectCore
    }, [beacons, onHover, onSelect, onSelectCore, selectedId])

    useEffect(() => {
      const wasCutaway = cutawayRef.current
      cutawayRef.current = cutaway
      if (cutaway && !wasCutaway) {
        apiRef.current?.focusCutaway()
      }
    }, [cutaway])

    const beaconKey = useMemo(
      () =>
        beacons
          .map((beacon) => `${beacon.id}:${beacon.heat}:${beacon.origin}:${beacon.featured ? '1' : '0'}`)
          .join('|'),
      [beacons],
    )

    useImperativeHandle(
      ref,
      () => ({
        focusCity(cityId: string) {
          apiRef.current?.focus(cityId)
        },
        triggerGlobalPulse() {
          apiRef.current?.pulse()
        },
      }),
      [],
    )

    useEffect(() => {
      const host = hostRef.current
      if (!host || beaconKey === '__none__') return
      const activeBeacons = beaconsRef.current

      let renderer: THREE.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      } catch {
        setWebglFailed(true)
        return
      }
      setWebglFailed(false)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor(0x000000, 0)
      renderer.domElement.style.position = 'absolute'
      renderer.domElement.style.inset = '0'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      renderer.domElement.style.touchAction = 'none'
      renderer.domElement.setAttribute('aria-label', '可拖拽旋转的行星电台全息地球')
      renderer.domElement.setAttribute('role', 'img')
      host.appendChild(renderer.domElement)

      const root = new THREE.Group()
      scene.add(root)

      const sunLight = new THREE.DirectionalLight(0xfff5e2, 2.55)
      sunLight.position.copy(SUN_DIRECTION).multiplyScalar(9.5)
      scene.add(sunLight)
      const rimFill = new THREE.DirectionalLight(0x7cb8ff, 1.05)
      rimFill.position.set(-6, -2.5, 4)
      scene.add(rimFill)
      scene.add(new THREE.HemisphereLight(0xc2e4ff, 0x204274, 1.35))
      scene.add(new THREE.AmbientLight(0x6c96cc, 0.78))

      const globe = new THREE.Group()
      globe.quaternion.copy(cutawayRef.current ? targetQuaternionFor(18, 42) : targetQuaternionFor(12, 122))
      root.add(globe)

      const glowTexture = makeGlowTexture()
      const earthTexture = makeEarthTexture()
      const nightLightsTexture = makeNightLightsTexture()
      const cloudTexture = makeCloudTexture()
      const strataTexture = makeStrataTexture()
      const coreLabelTexture = makeCoreLabelTexture()

      const surfaceMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uDayMap: { value: earthTexture },
          uNightMap: { value: nightLightsTexture },
          uSunDir: { value: SUN_DIRECTION.clone() },
          uTime: { value: 0 },
          uPulseProgress: { value: 0 },
          uPulseStrength: { value: 0 },
          uCutaway: { value: cutawayRef.current ? 1 : 0 },
        },
        vertexShader: EARTH_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
      })
      const surface = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64), surfaceMaterial)
      surface.rotation.y = -Math.PI / 2
      globe.add(surface)

      const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uCloudMap: { value: cloudTexture },
          uSunDir: { value: SUN_DIRECTION.clone() },
          uCutaway: { value: cutawayRef.current ? 1 : 0 },
          uRotY: { value: -Math.PI / 2 },
        },
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
      })
      const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.016, 64, 48), cloudMaterial)
      cloudMesh.rotation.y = -Math.PI / 2
      globe.add(cloudMesh)

      // 3D Earth 1/4 X-Ray Core Cutaway Assembly
      const cutawayGroup = new THREE.Group()
      cutawayGroup.visible = cutawayRef.current
      globe.add(cutawayGroup)

      // Inner dark crust shell (BackSide)
      const innerCrustMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uCutaway: { value: cutawayRef.current ? 1 : 0 },
        },
        vertexShader: CORE_SHELL_VERTEX,
        fragmentShader: INNER_CRUST_FRAGMENT,
        side: THREE.BackSide,
      })
      const innerCrustMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 0.985, 64, 48),
        innerCrustMaterial,
      )
      cutawayGroup.add(innerCrustMesh)

      // Glowing Lower Mantle (animated magma convection)
      const mantleMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: CORE_SHELL_VERTEX,
        fragmentShader: MANTLE_FRAGMENT,
        side: THREE.DoubleSide,
      })
      const lowerMantleMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 0.8, 64, 48),
        mantleMaterial,
      )
      cutawayGroup.add(lowerMantleMesh)

      // Incandescent Liquid Iron-Nickel Outer Core
      const outerCoreMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: CORE_SHELL_VERTEX,
        fragmentShader: OUTER_CORE_FRAGMENT,
        side: THREE.DoubleSide,
      })
      const outerCoreMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 0.52, 56, 40),
        outerCoreMaterial,
      )
      cutawayGroup.add(outerCoreMesh)

      // Radiant Solid Inner Core
      const innerCoreMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: CORE_SHELL_VERTEX,
        fragmentShader: INNER_CORE_FRAGMENT,
      })
      const innerCoreMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 0.25, 48, 32),
        innerCoreMaterial,
      )
      cutawayGroup.add(innerCoreMesh)

      const innerCoreGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffd27a,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      innerCoreGlow.scale.setScalar(GLOBE_RADIUS * 1.05)
      cutawayGroup.add(innerCoreGlow)

      // 3 Orthogonal Cutaway Cross-Section Wedges (XY, YZ, XZ) with concentric strata texture
      const wedgeMaterial = new THREE.MeshBasicMaterial({
        map: strataTexture,
        side: THREE.DoubleSide,
      })
      const wedgeXY = new THREE.Mesh(makeCutawayWedgeGeometry('xy', GLOBE_RADIUS), wedgeMaterial)
      const wedgeYZ = new THREE.Mesh(makeCutawayWedgeGeometry('yz', GLOBE_RADIUS), wedgeMaterial)
      const wedgeXZ = new THREE.Mesh(makeCutawayWedgeGeometry('xz', GLOBE_RADIUS), wedgeMaterial)
      cutawayGroup.add(wedgeXY, wedgeYZ, wedgeXZ)

      // Clickable Glowing「落日六号 SUNSET-06」Core Sanctuary
      const sunsetSanctuary = new THREE.Group()
      sunsetSanctuary.position.set(0.28, 0.1, 0.28)
      cutawayGroup.add(sunsetSanctuary)

      const capsuleBody = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 24, 20),
        new THREE.MeshStandardMaterial({
          color: 0xffe8c2,
          emissive: 0xffa64d,
          emissiveIntensity: 1.05,
          roughness: 0.24,
          metalness: 0.65,
        }),
      )
      sunsetSanctuary.add(capsuleBody)

      const neutrinoRingA = new THREE.Mesh(
        new THREE.TorusGeometry(0.145, 0.006, 12, 56),
        new THREE.MeshBasicMaterial({
          color: 0xffdf9e,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      neutrinoRingA.rotation.set(Math.PI * 0.34, Math.PI * 0.22, 0)
      sunsetSanctuary.add(neutrinoRingA)

      const neutrinoRingB = new THREE.Mesh(
        new THREE.TorusGeometry(0.195, 0.0045, 12, 56),
        new THREE.MeshBasicMaterial({
          color: 0xffa252,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      neutrinoRingB.rotation.set(-Math.PI * 0.28, Math.PI * 0.48, Math.PI * 0.16)
      sunsetSanctuary.add(neutrinoRingB)

      const sanctuaryGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffd088,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      sanctuaryGlow.scale.setScalar(0.56)
      sunsetSanctuary.add(sanctuaryGlow)

      const sanctuaryLabel = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: coreLabelTexture,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        }),
      )
      sanctuaryLabel.scale.set(0.86, 0.16, 1)
      sanctuaryLabel.position.set(0.24, 0.24, 0.22)
      sunsetSanctuary.add(sanctuaryLabel)

      const coreHitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 14, 14),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      coreHitMesh.userData.coreClick = true
      sunsetSanctuary.add(coreHitMesh)

      // Fresnel Atmospheric Glow Shell (GLOBE_RADIUS * 1.075, BackSide, additive)
      const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uSunDir: { value: SUN_DIRECTION.clone() },
          uPulseBoost: { value: 0 },
        },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.075, 72, 48), atmosphereMaterial)
      root.add(atmosphere)

      // Dual Global Core Heartbeat Shockwave Rings
      const pulseRingGeo = new THREE.RingGeometry(0.76, 1.0, 96)
      const primaryPulseMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xf6c989) },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: PULSE_RING_VERTEX,
        fragmentShader: PULSE_RING_FRAGMENT,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
      const primaryPulseRing = new THREE.Mesh(pulseRingGeo, primaryPulseMaterial)
      primaryPulseRing.rotation.set(Math.PI * 0.42, 0.08, -0.18)
      primaryPulseRing.visible = false
      root.add(primaryPulseRing)

      const secondaryPulseMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x88d4ff) },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: PULSE_RING_VERTEX,
        fragmentShader: PULSE_RING_FRAGMENT,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
      const secondaryPulseRing = new THREE.Mesh(pulseRingGeo.clone(), secondaryPulseMaterial)
      secondaryPulseRing.rotation.set(Math.PI * 0.56, -0.24, 0.34)
      secondaryPulseRing.visible = false
      root.add(secondaryPulseRing)

      const outerHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0x3b72c8,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      outerHalo.scale.setScalar(GLOBE_RADIUS * 4.2)
      outerHalo.position.z = -0.6
      root.add(outerHalo)

      const starGeometry = new THREE.BufferGeometry()
      const starCount = 1500
      const starPositions = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i += 1) {
        const radius = 6 + Math.random() * 16
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(Math.random() * 2 - 1)
        starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
        starPositions[i * 3 + 1] = radius * Math.cos(phi)
        starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
      }
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
      const starMaterial = new THREE.PointsMaterial({
        color: 0xdce6ff,
        size: 0.035,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.64,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const starField = new THREE.Points(starGeometry, starMaterial)
      scene.add(starField)

      const markers: MarkerApi[] = []
      const hitMeshes: THREE.Mesh[] = []

      activeBeacons.forEach((beacon, index) => {
        const position = latLonToVector(beacon.lat, beacon.lon, GLOBE_RADIUS * 1.004)
        const localDir = position.clone().normalize()
        const group = new THREE.Group()
        group.position.copy(position)
        group.lookAt(position.clone().multiplyScalar(2))
        globe.add(group)

        const featured = Boolean(beacon.featured)
        const accentHex = beacon.accent
          ? Number.parseInt(beacon.accent.replace('#', ''), 16)
          : beacon.heat > 260
            ? 0xffb36b
            : beacon.origin === 'cloud'
              ? 0x9ad0ff
              : 0xf2c28b
        const hotColor = Number.isFinite(accentHex) ? accentHex : 0xf2c28b
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: hotColor,
            transparent: true,
            opacity: featured ? 0.48 : 0.24,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        halo.scale.setScalar(featured ? 0.16 : 0.1)
        group.add(halo)

        const core = new THREE.Mesh(
          new THREE.SphereGeometry(featured ? 0.017 : 0.011, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: featured ? 0.98 : 0.85 }),
        )
        core.position.z = 0.002
        group.add(core)

        const { root: beaconPin, orbitalRing } = buildBeaconPin(beacon.label, hotColor, featured)
        group.add(beaconPin)

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(featured ? 0.048 : 0.032, featured ? 0.06 : 0.04, 40),
          new THREE.MeshBasicMaterial({
            color: hotColor,
            transparent: true,
            opacity: featured ? 0.68 : 0.36,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        ring.position.z = 0.001
        group.add(ring)

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(featured ? 0.23 : 0.18, 12, 12),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        hit.position.z = 0.1
        hit.userData.beaconId = beacon.id
        group.add(hit)
        hitMeshes.push(hit)

        const labelMaterial = new THREE.SpriteMaterial({
          map: makeLabelTexture(
            beacon.label,
            featured ? 'rgba(255, 248, 232, 0.98)' : 'rgba(224, 236, 255, 0.92)',
            featured,
          ),
          transparent: true,
          opacity: featured ? 0.94 : 0.82,
          depthWrite: false,
        })
        const label = new THREE.Sprite(labelMaterial)
        label.scale.set(featured ? 0.42 : 0.34, featured ? 0.105 : 0.085, 1)
        const [lx, ly, lz] = labelOffsetFor(beacon.label)
        label.position.set(lx, ly, lz)
        group.add(label)

        markers.push({
          beacon,
          group,
          pin: beaconPin,
          orbitalRing,
          localDir,
          hit,
          halo,
          ring,
          label,
          labelMaterial,
          phase: (index / Math.max(1, activeBeacons.length)) * Math.PI * 2,
          hoverScale: 1,
        })
      })

      let arcLine: THREE.LineSegments | null = null
      let arcMaterial: THREE.ShaderMaterial | null = null
      if (activeBeacons.length > 1) {
        const positions: number[] = []
        const progresses: number[] = []
        const offsets: number[] = []
        const maxArcs = Math.min(10, activeBeacons.length * 2)
        for (let i = 0; i < maxArcs; i += 1) {
          const a = activeBeacons[i % activeBeacons.length]
          const b = activeBeacons[(i * 3 + 4 + (i % 4)) % activeBeacons.length]
          if (a.id === b.id) continue
          const start = latLonToVector(a.lat, a.lon, GLOBE_RADIUS * 1.012)
          const end = latLonToVector(b.lat, b.lon, GLOBE_RADIUS * 1.012)
          const distance = start.distanceTo(end)
          const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS * (1.14 + distance * 0.14))
          const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
          const points = curve.getPoints(56)
          const offset = (i * 0.137) % 1
          for (let j = 0; j < points.length - 1; j += 1) {
            const p1 = points[j]
            const p2 = points[j + 1]
            positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
            const t1 = j / (points.length - 1)
            const t2 = (j + 1) / (points.length - 1)
            progresses.push(t1, t2)
            offsets.push(offset, offset)
          }
        }
        if (positions.length) {
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
          geometry.setAttribute('aProgress', new THREE.Float32BufferAttribute(progresses, 1))
          geometry.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsets, 1))
          arcMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uBoost: { value: 0 },
              uColorA: { value: new THREE.Color(0xf2c28b) },
              uColorB: { value: new THREE.Color(0x8ab8ff) },
            },
            vertexShader: ARC_VERTEX,
            fragmentShader: ARC_FRAGMENT,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
          arcLine = new THREE.LineSegments(geometry, arcMaterial)
          globe.add(arcLine)
        }
      }

      let baseZ = 4.75
      let zoom = 1
      let targetZoom = 1
      let autoPauseUntil = 0
      let focusTarget: THREE.Quaternion | null = null
      let disposed = false
      let pulseStart = -999
      let pulseQueued = false
      let arcPhase = 0
      let cutawayVal = cutawayRef.current ? 1 : 0

      const pointer = { down: false, id: -1, lastX: 0, lastY: 0, moved: 0 }
      const activePointers = new Map<number, { x: number; y: number }>()
      let pinchStart = 0
      let pinchZoom = 1

      const raycaster = new THREE.Raycaster()
      const pointerNdc = new THREE.Vector2()
      let hoverId: string | null = null

      const pick = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointerNdc, camera)
        if (cutawayVal > 0.35) {
          const coreHits = raycaster.intersectObject(coreHitMesh, false)
          if (coreHits.length && coreHits[0].object.userData.coreClick) {
            return '__core__'
          }
        }
        const visibleHits = hitMeshes.filter((mesh) => mesh.parent?.visible !== false)
        const hits = raycaster.intersectObjects(visibleHits, false)
        return hits.length ? String(hits[0].object.userData.beaconId ?? '') : ''
      }

      const focus = (cityId: string) => {
        const beacon = activeBeacons.find((item) => item.id === cityId)
        if (!beacon) return false
        focusTarget = targetQuaternionFor(beacon.lat, beacon.lon)
        autoPauseUntil = performance.now() + 9200
        return true
      }

      const focusCutaway = () => {
        focusTarget = targetQuaternionFor(18, 42)
        autoPauseUntil = performance.now() + 14000
      }

      const pulse = () => {
        pulseQueued = true
      }

      apiRef.current = { focus, pulse, focusCutaway }

      const onPointerDown = (event: PointerEvent) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (activePointers.size === 2) {
          const [a, b] = [...activePointers.values()]
          pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
          pinchZoom = targetZoom
          return
        }
        pointer.down = true
        pointer.id = event.pointerId
        pointer.lastX = event.clientX
        pointer.lastY = event.clientY
        pointer.moved = 0
        renderer.domElement.setPointerCapture?.(event.pointerId)
        renderer.domElement.style.cursor = 'grabbing'
        focusTarget = null
        autoPauseUntil = performance.now() + 2400
      }

      const onPointerMove = (event: PointerEvent) => {
        if (activePointers.has(event.pointerId)) {
          activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }
        if (activePointers.size === 2 && pinchStart > 0) {
          const [a, b] = [...activePointers.values()]
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          targetZoom = clamp(pinchZoom * (pinchStart / Math.max(1, distance)), 0.72, 1.32)
          return
        }
        if (pointer.down && event.pointerId === pointer.id) {
          const dx = event.clientX - pointer.lastX
          const dy = event.clientY - pointer.lastY
          pointer.lastX = event.clientX
          pointer.lastY = event.clientY
          pointer.moved += Math.abs(dx) + Math.abs(dy)
          const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.006)
          const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.005)
          globe.quaternion.premultiply(yaw).premultiply(pitch)
          return
        }
        const hit = pick(event.clientX, event.clientY)
        if (hit !== hoverId) {
          hoverId = hit
          renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
          const hoveredBeacon =
            hit && hit !== '__core__' ? activeBeacons.find((item) => item.id === hit) ?? null : null
          hoverRef.current?.(hoveredBeacon)
        }
      }

      const onPointerLeave = () => {
        if (hoverId !== null) {
          hoverId = null
          hoverRef.current?.(null)
        }
      }

      const onPointerUp = (event: PointerEvent) => {
        activePointers.delete(event.pointerId)
        if (activePointers.size < 2) pinchStart = 0
        if (!pointer.down || event.pointerId !== pointer.id) return
        pointer.down = false
        renderer.domElement.releasePointerCapture?.(event.pointerId)
        renderer.domElement.style.cursor = pick(event.clientX, event.clientY) ? 'pointer' : 'grab'
        if (pointer.moved < 7) {
          const id = pick(event.clientX, event.clientY)
          if (id === '__core__') {
            selectCoreRef.current?.()
            return
          }
          if (id) {
            const beacon = activeBeacons.find((item) => item.id === id)
            if (beacon) {
              focus(beacon.id)
              selectRef.current(beacon)
            }
          }
        }
      }

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        targetZoom = clamp(targetZoom + Math.sign(event.deltaY) * 0.045, 0.72, 1.32)
      }

      const onResize = () => {
        const width = Math.max(1, host.clientWidth)
        const height = Math.max(1, host.clientHeight)
        const aspect = width / height
        baseZ = aspect < 0.82 ? 5.8 : aspect < 1.15 ? 5.15 : 4.72
        camera.aspect = aspect
        camera.position.z = baseZ * zoom
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
      }

      const onContextLost = (event: Event) => {
        event.preventDefault()
        setWebglFailed(true)
      }
      const onContextRestored = () => {
        setWebglFailed(false)
      }

      renderer.domElement.style.cursor = 'grab'
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerleave', onPointerLeave)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      renderer.domElement.addEventListener('pointercancel', onPointerUp)
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
      renderer.domElement.addEventListener('webglcontextlost', onContextLost)
      renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)
      const resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(host)
      onResize()

      const worldUp = new THREE.Vector3(0, 1, 0)
      const timer = new THREE.Timer()
      const tempQuat = new THREE.Quaternion()
      const tempPos = new THREE.Vector3()

      const renderLoop = () => {
        if (disposed) return
        timer.update()
        const dt = Math.min(0.05, timer.getDelta())
        const elapsed = timer.getElapsed()
        cloudMesh.rotation.y += dt * 0.012
        cloudMaterial.uniforms.uRotY.value = cloudMesh.rotation.y
        surfaceMaterial.uniforms.uTime.value = elapsed

        const targetCut = cutawayRef.current ? 1 : 0
        cutawayVal += (targetCut - cutawayVal) * Math.min(1, dt * 4.5)
        if (Math.abs(targetCut - cutawayVal) < 0.001) cutawayVal = targetCut

        surfaceMaterial.uniforms.uCutaway.value = cutawayVal
        cloudMaterial.uniforms.uCutaway.value = cutawayVal
        innerCrustMaterial.uniforms.uCutaway.value = cutawayVal

        cutawayGroup.visible = cutawayVal > 0.02
        if (cutawayGroup.visible) {
          const coreScale = 0.42 + 0.58 * Math.min(1, cutawayVal * 1.08)
          cutawayGroup.scale.setScalar(coreScale)
          mantleMaterial.uniforms.uTime.value = elapsed
          outerCoreMaterial.uniforms.uTime.value = elapsed
          innerCoreMaterial.uniforms.uTime.value = elapsed
          neutrinoRingA.rotation.z += dt * 0.72
          neutrinoRingA.rotation.x += dt * 0.28
          neutrinoRingB.rotation.y -= dt * 0.95
          neutrinoRingB.rotation.z -= dt * 0.34
          const corePulse = 0.85 + 0.15 * Math.sin(elapsed * 2.8)
          sanctuaryGlow.scale.setScalar((hoverId === '__core__' ? 0.68 : 0.54) * corePulse)
          innerCoreGlow.material.opacity = 0.65 + 0.16 * Math.sin(elapsed * 2.2)
        }

        if (pulseQueued) {
          pulseQueued = false
          pulseStart = elapsed
        }
        const pulseAge = elapsed - pulseStart
        const pulseActive = pulseAge >= 0 && pulseAge < PULSE_DURATION
        const pulseT = pulseActive ? pulseAge / PULSE_DURATION : 0
        const pulseBoost = pulseActive ? Math.sin(pulseT * Math.PI) : 0

        surfaceMaterial.uniforms.uPulseProgress.value = pulseT
        surfaceMaterial.uniforms.uPulseStrength.value = pulseBoost
        atmosphereMaterial.uniforms.uPulseBoost.value = pulseBoost

        if (pulseActive) {
          const easeOut = 1 - Math.pow(1 - pulseT, 3)
          primaryPulseRing.visible = true
          primaryPulseRing.scale.setScalar(GLOBE_RADIUS * (1.02 + easeOut * 1.24))
          primaryPulseRing.rotation.z = -0.18 + pulseT * 0.42
          primaryPulseMaterial.uniforms.uOpacity.value = Math.sin(pulseT * Math.PI) * (1 - pulseT * 0.25) * 0.92
          primaryPulseMaterial.uniforms.uTime.value = elapsed

          const p2 = clamp((pulseT - 0.14) / 0.86, 0, 1)
          if (p2 > 0) {
            const easeOut2 = 1 - Math.pow(1 - p2, 3)
            secondaryPulseRing.visible = true
            secondaryPulseRing.scale.setScalar(GLOBE_RADIUS * (1.02 + easeOut2 * 0.98))
            secondaryPulseRing.rotation.z = 0.34 - p2 * 0.36
            secondaryPulseMaterial.uniforms.uOpacity.value = Math.sin(p2 * Math.PI) * (1 - p2 * 0.3) * 0.72
            secondaryPulseMaterial.uniforms.uTime.value = elapsed
          } else {
            secondaryPulseRing.visible = false
          }
        } else {
          primaryPulseRing.visible = false
          secondaryPulseRing.visible = false
        }

        arcPhase += dt * (0.7 + pulseBoost * 1.8)
        if (arcMaterial) {
          arcMaterial.uniforms.uTime.value = arcPhase
          arcMaterial.uniforms.uBoost.value = pulseBoost
        }

        if (focusTarget) {
          const step = 1 - Math.pow(0.0015, dt)
          globe.quaternion.slerp(focusTarget, step)
          if (globe.quaternion.angleTo(focusTarget) < 0.004) {
            globe.quaternion.copy(focusTarget)
            focusTarget = null
          }
        } else if (!pointer.down && performance.now() > autoPauseUntil) {
          tempQuat.setFromAxisAngle(worldUp, dt * (cutawayRef.current ? 0.045 : 0.115))
          globe.quaternion.premultiply(tempQuat)
        }

        zoom += (targetZoom - zoom) * Math.min(1, dt * 5.4)
        camera.position.z += (baseZ * zoom - camera.position.z) * Math.min(1, dt * 6)
        starField.rotation.y += dt * 0.004
        outerHalo.material.opacity = 0.28 + Math.sin(elapsed * 0.7) * 0.07 + pulseBoost * 0.22

        const cutX = 1.05 + (0.02 - 1.05) * cutawayVal
        const cutY = 1.05 + (-0.15 - 1.05) * cutawayVal
        const cutZ = 1.05 + (0.02 - 1.05) * cutawayVal

        markers.forEach((marker) => {
          const insideCutOctant =
            cutawayVal > 0.2 &&
            marker.localDir.x > cutX - 0.02 &&
            marker.localDir.y > cutY - 0.02 &&
            marker.localDir.z > cutZ - 0.02
          marker.group.visible = !insideCutOctant
          if (insideCutOctant) return

          const featured = Boolean(marker.beacon.featured)
          const selected = selectedRef.current === marker.beacon.id
          const hovered = hoverId === marker.beacon.id
          const active = selected || hovered
          const targetHoverScale = active ? 1.26 : 1.0
          marker.hoverScale += (targetHoverScale - marker.hoverScale) * Math.min(1, dt * 11)
          marker.pin.scale.setScalar(marker.hoverScale)
          marker.orbitalRing.rotation.z += dt * (featured ? 0.95 : 0.45)

          const breathe = 0.5 + 0.5 * Math.sin(elapsed * 1.35 + marker.phase)
          const haloMaterial = marker.halo.material
          haloMaterial.opacity = Math.min(
            0.98,
            (active ? 0.64 : featured ? 0.38 + breathe * 0.18 : 0.2 + breathe * 0.12) + pulseBoost * 0.46,
          )
          marker.halo.scale.setScalar(
            ((active ? 0.2 : featured ? 0.15 : 0.1) + breathe * 0.03) * (1 + pulseBoost * 0.72),
          )
          const ringMaterial = marker.ring.material as THREE.MeshBasicMaterial
          ringMaterial.opacity = Math.min(
            0.98,
            (active ? 0.78 : featured ? 0.46 + breathe * 0.3 : 0.24 + breathe * 0.2) + pulseBoost * 0.42,
          )
          marker.ring.scale.setScalar((featured ? 0.96 : 0.78) + breathe * 0.26 + (active ? 0.18 : 0) + pulseBoost * 0.48)
          marker.labelMaterial.opacity = active ? 1 : featured ? 0.94 : 0.84
          const labelScaleBoost = 1 + (marker.hoverScale - 1) * 0.55
          marker.label.scale.set(
            (featured ? 0.42 : 0.34) * labelScaleBoost,
            (featured ? 0.105 : 0.085) * labelScaleBoost,
            1,
          )
          const world = marker.group.getWorldPosition(tempPos).normalize()
          // Show curated 3D world labels cleanly on front hemisphere; reveal non-curated labels on hover/selection to prevent clutter
          marker.label.visible = featured ? world.z > -0.22 : active && world.z > -0.34
          marker.ring.visible = world.z > -0.16
        })

        renderer.render(scene, camera)
      }
      renderer.setAnimationLoop(renderLoop)

      return () => {
        disposed = true
        renderer.setAnimationLoop(null)
        resizeObserver.disconnect()
        renderer.domElement.removeEventListener('pointerdown', onPointerDown)
        renderer.domElement.removeEventListener('pointermove', onPointerMove)
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
        renderer.domElement.removeEventListener('pointerup', onPointerUp)
        renderer.domElement.removeEventListener('pointercancel', onPointerUp)
        renderer.domElement.removeEventListener('wheel', onWheel)
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
        apiRef.current = null
        disposeObject(scene)
        earthTexture.dispose()
        nightLightsTexture.dispose()
        cloudTexture.dispose()
        strataTexture.dispose()
        coreLabelTexture.dispose()
        glowTexture.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
      }
      // Rebuild marker geometry only when beacon identity, heat or origin changes.
    }, [beaconKey])

    return (
      <div className={`relative ${className ?? ''}`}>
        <div ref={hostRef} className="absolute inset-0" />
        {webglFailed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[62%] w-[62%] max-h-[520px] max-w-[520px] rounded-full border border-signal/15 bg-[radial-gradient(circle_at_38%_30%,rgba(242,194,139,0.14),rgba(9,16,32,0.92)_60%,rgba(7,11,20,0.98))]">
              <div className="absolute inset-[14%] rounded-full border border-signal/20" />
              <div className="absolute inset-[30%] rounded-full border border-white/8" />
              <div className="absolute inset-[46%] rounded-full border border-white/5" />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[76%] w-[76%] max-w-[760px] rounded-full border border-signal/[0.045]" />
        </div>
      </div>
    )
  },
)

EarthRadioGlobe.displayName = 'EarthRadioGlobe'
