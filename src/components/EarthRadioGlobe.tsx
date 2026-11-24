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
}

export interface EarthRadioGlobeHandle {
  focusCity: (cityId: string) => void
}

interface EarthRadioGlobeProps {
  beacons: GlobeBeacon[]
  selectedId: string | null
  onSelect: (beacon: GlobeBeacon) => void
  className?: string
}

interface MarkerApi {
  beacon: GlobeBeacon
  group: THREE.Group
  hit: THREE.Mesh
  halo: THREE.Sprite
  ring: THREE.Mesh
  label: THREE.Sprite
  labelMaterial: THREE.SpriteMaterial
  phase: number
}

const GLOBE_RADIUS = 1.56

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
    // 1. Luminous cerulean-to-turquoise ocean gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h)
    oceanGrad.addColorStop(0, '#164b82')
    oceanGrad.addColorStop(0.24, '#2173b0')
    oceanGrad.addColorStop(0.5, '#2d8cc2')
    oceanGrad.addColorStop(0.76, '#2173b0')
    oceanGrad.addColorStop(1, '#164b82')
    ctx.fillStyle = oceanGrad
    ctx.fillRect(0, 0, w, h)

    // Soft ocean sunlit shimmer & subtle celestial atlas lines
    const sunOcean = ctx.createRadialGradient(w * 0.78, h * 0.34, 40, w * 0.78, h * 0.34, 620)
    sunOcean.addColorStop(0, 'rgba(130, 224, 244, 0.24)')
    sunOcean.addColorStop(0.6, 'rgba(72, 166, 218, 0.1)')
    sunOcean.addColorStop(1, 'rgba(22, 75, 130, 0)')
    ctx.fillStyle = sunOcean
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(190, 232, 255, 0.08)'
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
    landGrad.addColorStop(0, '#5a9978')
    landGrad.addColorStop(0.32, '#529274')
    landGrad.addColorStop(0.55, '#cca96e')
    landGrad.addColorStop(0.78, '#529274')
    landGrad.addColorStop(1, '#689e82')

    for (const poly of continents) {
      drawSmoothPolygon(ctx, poly, w, h)
      ctx.save()
      ctx.shadowColor = 'rgba(130, 232, 238, 0.36)'
      ctx.shadowBlur = 18
      ctx.fillStyle = landGrad
      ctx.fill()
      ctx.restore()

      ctx.strokeStyle = 'rgba(130, 232, 238, 0.42)'
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
      [115, 31, 140, 88, 'rgba(255, 224, 158, 0.22)'],
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
    northIce.addColorStop(0, '#e4f1ff')
    northIce.addColorStop(0.65, 'rgba(228, 241, 255, 0.52)')
    northIce.addColorStop(1, 'rgba(228, 241, 255, 0)')
    ctx.fillStyle = northIce
    ctx.fillRect(0, 0, w, h * 0.085)

    const southIce = ctx.createLinearGradient(0, h * 0.89, 0, h)
    southIce.addColorStop(0, 'rgba(228, 241, 255, 0)')
    southIce.addColorStop(0.35, 'rgba(228, 241, 255, 0.72)')
    southIce.addColorStop(1, '#e4f1ff')
    ctx.fillStyle = southIce
    ctx.fillRect(0, h * 0.89, w, h * 0.11)
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

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormal;
  void main() {
    float edge = pow(clamp(0.78 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.4);
    gl_FragColor = vec4(uColor, edge * 0.88);
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
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vProgress;
  varying float vOffset;

  void main() {
    float head = fract(uTime * 0.115 + vOffset);
    float delta = abs(vProgress - head);
    delta = min(delta, 1.0 - delta);
    float pulse = smoothstep(0.055, 0.0, delta);
    float bead = smoothstep(0.88, 1.0, fract(vProgress * 9.0 - uTime * 0.42 + vOffset * 2.0));
    float base = 0.055 + bead * 0.18;
    float alpha = base + pulse * 0.86;
    vec3 color = mix(uColorA, uColorB, smoothstep(0.1, 0.9, vProgress));
    gl_FragColor = vec4(color * (1.0 + pulse * 1.8), alpha);
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

function makeLabelTexture(text: string, accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = 'rgba(11, 22, 46, 0.84)'
    ctx.beginPath()
    ctx.roundRect(56, 12, 144, 40, 20)
    ctx.fill()
    ctx.strokeStyle = 'rgba(242, 194, 139, 0.52)'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.font = '500 23px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 33)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
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

function buildBeaconPin(_city: string, accentHex: number): THREE.Group {
  const root = new THREE.Group()
  // Align +Y radial pin outward along surface normal (+Z)
  root.rotation.x = Math.PI / 2

  const spireMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c6,
    emissive: accentHex,
    emissiveIntensity: 0.28,
    roughness: 0.35,
    metalness: 0.45,
  })
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.016, 0.15, 10), spireMat)
  spire.position.y = 0.075
  root.add(spire)

  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfff8eb,
    emissive: accentHex,
    emissiveIntensity: 0.72,
    roughness: 0.22,
    metalness: 0.25,
  })
  const starTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), starMat)
  starTip.position.y = 0.165
  root.add(starTip)

  const haloRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.044, 0.0032, 8, 28),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  haloRing.position.y = 0.165
  haloRing.rotation.set(Math.PI / 3, 0, Math.PI / 6)
  root.add(haloRing)

  return root
}

const LABEL_OFFSETS: Record<string, [number, number, number]> = {
  哈尔滨: [0.2, 0.1, 0.2],
  北京: [-0.22, 0.1, 0.22],
  青岛: [0.24, 0.08, 0.2],
  西安: [-0.22, 0.06, 0.22],
  上海: [0.3, 0.01, 0.2],
  南京: [0.24, 0.14, 0.2],
  杭州: [0.26, -0.14, 0.2],
  武汉: [0.02, -0.16, 0.24],
  成都: [-0.24, -0.04, 0.2],
  拉萨: [-0.26, 0.06, 0.2],
  大理: [-0.22, -0.15, 0.2],
  三亚: [0.2, -0.14, 0.2],
  悉尼: [0.24, -0.06, 0.22],
  夏威夷: [0.22, 0.08, 0.22],
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
  function EarthRadioGlobe({ beacons, selectedId, onSelect, className }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const selectedRef = useRef(selectedId)
    const beaconsRef = useRef(beacons)
    const selectRef = useRef(onSelect)
    const apiRef = useRef<{ focus: (id: string) => boolean } | null>(null)
    const [webglFailed, setWebglFailed] = useState(false)

    selectedRef.current = selectedId
    beaconsRef.current = beacons
    selectRef.current = onSelect

    const beaconKey = useMemo(
      () => beacons.map((beacon) => `${beacon.id}:${beacon.heat}:${beacon.origin}`).join('|'),
      [beacons],
    )

    useImperativeHandle(
      ref,
      () => ({
        focusCity(cityId: string) {
          apiRef.current?.focus(cityId)
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
      renderer.domElement.setAttribute('aria-label', '可拖拽旋转的地球表面电台全息地球')
      renderer.domElement.setAttribute('role', 'img')
      host.appendChild(renderer.domElement)

      const root = new THREE.Group()
      scene.add(root)

      const sunLight = new THREE.DirectionalLight(0xfff5e2, 2.55)
      sunLight.position.set(5, 3.5, 6.2)
      scene.add(sunLight)
      const rimFill = new THREE.DirectionalLight(0x7cb8ff, 1.15)
      rimFill.position.set(-6, -2.5, 4)
      scene.add(rimFill)
      scene.add(new THREE.HemisphereLight(0xc2e4ff, 0x2c568e, 1.55))
      scene.add(new THREE.AmbientLight(0x7aa4da, 0.92))

      const globe = new THREE.Group()
      globe.quaternion.copy(targetQuaternionFor(12, 122))
      root.add(globe)

      const glowTexture = makeGlowTexture()
      const earthTexture = makeEarthTexture()
      const cloudTexture = makeCloudTexture()

      const surfaceMaterial = new THREE.MeshStandardMaterial({
        map: earthTexture,
        roughness: 0.72,
        metalness: 0.05,
      })
      const surface = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64), surfaceMaterial)
      surface.rotation.y = -Math.PI / 2
      globe.add(surface)

      const cloudMaterial = new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        roughness: 1,
      })
      const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.016, 64, 48), cloudMaterial)
      cloudMesh.rotation.y = -Math.PI / 2
      globe.add(cloudMesh)

      const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x7cbcff) } },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.15, 72, 48), atmosphereMaterial)
      root.add(atmosphere)

      const outerHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0x3b72c8,
          transparent: true,
          opacity: 0.36,
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
        const group = new THREE.Group()
        group.position.copy(position)
        group.lookAt(position.clone().multiplyScalar(2))
        globe.add(group)

        const hotColor = beacon.heat > 260 ? 0xffb36b : beacon.origin === 'cloud' ? 0x9ad0ff : 0xf2c28b
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: hotColor,
            transparent: true,
            opacity: 0.36,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        halo.scale.setScalar(0.13)
        group.add(halo)

        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.014, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0.94 }),
        )
        core.position.z = 0.002
        group.add(core)

        const beaconPin = buildBeaconPin(beacon.label, hotColor)
        group.add(beaconPin)

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.042, 0.052, 40),
          new THREE.MeshBasicMaterial({
            color: hotColor,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        ring.position.z = 0.001
        group.add(ring)

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.21, 12, 12),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        hit.position.z = 0.1
        hit.userData.beaconId = beacon.id
        group.add(hit)
        hitMeshes.push(hit)

        const labelMaterial = new THREE.SpriteMaterial({
          map: makeLabelTexture(beacon.label, 'rgba(255, 244, 224, 0.96)'),
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        })
        const label = new THREE.Sprite(labelMaterial)
        label.scale.set(0.38, 0.095, 1)
        const [lx, ly, lz] = labelOffsetFor(beacon.label)
        label.position.set(lx, ly, lz)
        group.add(label)

        markers.push({
          beacon,
          group,
          hit,
          halo,
          ring,
          label,
          labelMaterial,
          phase: (index / Math.max(1, activeBeacons.length)) * Math.PI * 2,
        })
      })

      let arcLine: THREE.LineSegments | null = null
      let arcMaterial: THREE.ShaderMaterial | null = null
      if (activeBeacons.length > 1) {
        const positions: number[] = []
        const progresses: number[] = []
        const offsets: number[] = []
        const maxArcs = Math.min(18, activeBeacons.length * 2)
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
        const hits = raycaster.intersectObjects(hitMeshes, false)
        return hits.length ? String(hits[0].object.userData.beaconId ?? '') : ''
      }

      const focus = (cityId: string) => {
        const beacon = activeBeacons.find((item) => item.id === cityId)
        if (!beacon) return false
        focusTarget = targetQuaternionFor(beacon.lat, beacon.lon)
        autoPauseUntil = performance.now() + 9200
        return true
      }
      apiRef.current = { focus }

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

      renderer.domElement.style.cursor = 'grab'
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      renderer.domElement.addEventListener('pointercancel', onPointerUp)
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
      const resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(host)
      onResize()

      const worldUp = new THREE.Vector3(0, 1, 0)
      const clock = new THREE.Clock()
      const tempQuat = new THREE.Quaternion()

      const renderLoop = () => {
        if (disposed) return
        const dt = Math.min(0.05, clock.getDelta())
        const elapsed = clock.elapsedTime
        cloudMesh.rotation.y += dt * 0.012
        if (arcMaterial) arcMaterial.uniforms.uTime.value = elapsed

        if (focusTarget) {
          const step = 1 - Math.pow(0.0015, dt)
          globe.quaternion.slerp(focusTarget, step)
          if (globe.quaternion.angleTo(focusTarget) < 0.004) {
            globe.quaternion.copy(focusTarget)
            focusTarget = null
          }
        } else if (!pointer.down && performance.now() > autoPauseUntil) {
          tempQuat.setFromAxisAngle(worldUp, dt * 0.115)
          globe.quaternion.premultiply(tempQuat)
        }

        zoom += (targetZoom - zoom) * Math.min(1, dt * 5.4)
        camera.position.z += (baseZ * zoom - camera.position.z) * Math.min(1, dt * 6)
        starField.rotation.y += dt * 0.004
        outerHalo.material.opacity = 0.3 + Math.sin(elapsed * 0.7) * 0.08

        markers.forEach((marker) => {
          const selected = selectedRef.current === marker.beacon.id
          const breathe = 0.5 + 0.5 * Math.sin(elapsed * 1.35 + marker.phase)
          const haloMaterial = marker.halo.material
          haloMaterial.opacity = selected ? 0.45 : 0.28 + breathe * 0.16
          marker.halo.scale.setScalar((selected ? 0.16 : 0.12) + breathe * 0.03)
          const ringMaterial = marker.ring.material as THREE.MeshBasicMaterial
          ringMaterial.opacity = 0.35 + breathe * 0.32 + (selected ? 0.24 : 0)
          marker.ring.scale.setScalar(0.86 + breathe * 0.28)
          marker.labelMaterial.opacity = selected ? 0.98 : marker.beacon.origin === 'cloud' ? 0.92 : 0.88
          const world = marker.group.getWorldPosition(new THREE.Vector3()).normalize()
          marker.label.visible = world.z > -0.34
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
        renderer.domElement.removeEventListener('pointerup', onPointerUp)
        renderer.domElement.removeEventListener('pointercancel', onPointerUp)
        renderer.domElement.removeEventListener('wheel', onWheel)
        apiRef.current = null
        disposeObject(scene)
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