import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { citySignature } from '../data/citySignature'
import { getSettings } from '../services/settings'
import type { FocusPoint, ParticleKind, StudioMode, VisionPacket } from '../types/vision'

export type SceneInteractKind = 'lamp' | 'star' | 'ripple' | 'snow'

interface SceneSpark {
  id: number
  x: number
  y: number
  kind: SceneInteractKind
}

interface VisionViewport3DProps {
  packet: VisionPacket
  mode: StudioMode
  paused?: boolean
  onAddFocus: (x: number, y: number) => void
  onSelectFocus?: (id: string | null) => void
  onHeartbeat: () => number | void
  onPlayVoice?: () => void
  onSceneInteract?: (kind: SceneInteractKind) => void
  photoFilterCss?: string
}

function detectInteractFlavor(packet: VisionPacket): { kind: SceneInteractKind; action: string; counter: string } {
  const text = `${packet.title} ${packet.city} ${packet.scentTag}`
  if (packet.ambience === 'library' || /图书|自习|书页/.test(text)) {
    return { kind: 'lamp', action: '轻点窗格亮起一盏灯', counter: '已点亮灯火' }
  }
  if (packet.ambience === 'night' || /星|极光|拉萨|雷克雅未克|观星|银河/.test(text)) {
    return { kind: 'star', action: '轻点夜空观测一颗星', counter: '已观测星点' }
  }
  if (packet.particles === 'snow' || packet.ambience === 'snow' || /雪|哈尔滨/.test(text)) {
    return { kind: 'snow', action: '轻点画面扬起一片雪', counter: '已唤起雪花' }
  }
  return { kind: 'ripple', action: '轻点画面荡起一道光波', counter: '已荡起涟漪' }
}

const HEARTBEAT_ECHOS = [
  '远方有人的心跳，刚好和你慢了半拍',
  '这一下同频，穿过了六千三百公里',
  '耳机里的余温，替你把此刻留了下来',
  '有人在同一秒，和你一起屏住了呼吸',
  '地心深处，似乎也轻轻回了一拍',
]

interface SceneApi {
  setPhoto: (url: string) => void
  setParticles: (kind: ParticleKind) => void
  setFocus: (focus: FocusPoint[]) => void
  setMode: (mode: StudioMode) => void
  setHoldLevel: (level: number) => void
  setPaused: (paused: boolean) => void
  triggerPulse: () => void
}

const FOV = 40
const CAMERA_Z = 5.4
const HOLD_MS = 900

const PARTICLE_CONFIG: Record<
  Exclude<ParticleKind, 'none'>,
  { color: string; kind: number; desktop: number; mobile: number; opacity: number }
> = {
  rain: { color: '#b8d8ea', kind: 1, desktop: 1500, mobile: 700, opacity: 0.55 },
  firefly: { color: '#ffd68a', kind: 2, desktop: 110, mobile: 60, opacity: 0.9 },
  snow: { color: '#fff8ee', kind: 3, desktop: 380, mobile: 200, opacity: 0.8 },
  dust: { color: '#ffe8c6', kind: 4, desktop: 240, mobile: 130, opacity: 0.62 },
}

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  uniform vec2 uView;
  uniform int uKind;
  uniform float uPulse;
  varying float vAlpha;
  varying float vGlow;

  void main() {
    vec3 seed = position;
    float t = uTime;
    vec3 p = vec3(0.0);
    float alpha = 0.0;

    if (uKind == 1) {
      p.x = (fract(seed.x * 17.13) - 0.5) * uView.x * 1.14 + sin(t * 0.35 + seed.y * 30.0) * 0.05;
      p.y = fract(fract(seed.y * 31.7) - t * (0.10 + seed.z * 0.07)) * (uView.y * 1.18) - uView.y * 0.59;
      p.z = 0.42 + fract(seed.z * 7.7) * 1.0;
      alpha = 0.2 + 0.42 * fract(seed.z * 11.0);
    } else if (uKind == 2) {
      p.x = (fract(seed.x * 23.3) - 0.5) * uView.x * 0.94 + sin(t * (0.22 + seed.y * 0.18) + seed.z * 41.0) * 0.22;
      p.y = (fract(seed.y * 41.9) - 0.5) * uView.y * 0.9 + cos(t * (0.17 + seed.z * 0.16) + seed.x * 33.0) * 0.17;
      p.z = 0.55 + fract(seed.z * 5.3) * 0.85;
      alpha = pow(0.5 + 0.5 * sin(t * (1.1 + seed.x * 1.4) + seed.y * 20.0), 2.6);
    } else if (uKind == 3) {
      p.x = (fract(seed.x * 11.7) - 0.5) * uView.x * 1.08 + sin(t * 0.3 + seed.y * 22.0) * 0.13;
      p.y = fract(fract(seed.y * 13.1) - t * (0.03 + seed.z * 0.035)) * (uView.y * 1.16) - uView.y * 0.58;
      p.z = 0.38 + fract(seed.z * 9.1) * 0.95;
      alpha = 0.5 + 0.35 * sin(t * 0.6 + seed.x * 12.0);
    } else {
      p.x = (fract(seed.x * 19.7) - 0.5) * uView.x * 1.02 + sin(t * 0.16 + seed.y * 24.0) * 0.09;
      p.y = (fract(seed.y * 27.1) - 0.5) * uView.y * 0.94 + cos(t * 0.13 + seed.z * 18.0) * 0.07;
      p.z = 0.46 + fract(seed.z * 6.0) * 0.8;
      alpha = 0.16 + 0.5 * pow(0.5 + 0.5 * sin(t * 0.45 + seed.x * 30.0), 3.0);
    }

    float glow = 0.0;
    if (uPulse > 0.001 && uPulse < 1.0) {
      float d = length(p.xy);
      float ring = exp(-pow((d - uPulse * 3.1) * 3.6, 2.0));
      glow = ring * (1.0 - uPulse) * 2.2;
      alpha = min(1.0, alpha + glow * 0.28);
    }

    float size = 0.8 + 0.5 * fract(seed.x * 7.0);
    float base = uKind == 1 ? 6.0 : uKind == 2 ? 30.0 : uKind == 3 ? 11.0 : 9.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * base * size * (4.6 / max(1.0, -mv.z));
    vAlpha = alpha;
    vGlow = glow;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform int uKind;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float a = 0.0;
    if (uKind == 1) {
      float dx = abs(uv.x);
      float dy = abs(uv.y);
      a = (1.0 - smoothstep(0.015, 0.1, dx)) * (1.0 - smoothstep(0.28, 0.5, dy));
    } else {
      float d = length(uv);
      a = smoothstep(0.5, 0.04, d);
      a *= a;
    }
    vec3 color = uColor * (1.0 + vGlow * 2.4);
    float alpha = a * vAlpha * uOpacity;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.22, 'rgba(255,255,255,0.65)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.16)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function VisionViewport3D({
  packet,
  mode,
  paused = false,
  onAddFocus,
  onSelectFocus,
  onHeartbeat,
  onPlayVoice,
  onSceneInteract,
  photoFilterCss,
}: VisionViewport3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const packetRef = useRef(packet)
  packetRef.current = packet
  const photoFilterRef = useRef(photoFilterCss)
  photoFilterRef.current = photoFilterCss
  const addFocusRef = useRef(onAddFocus)
  addFocusRef.current = onAddFocus
  const selectFocusRef = useRef(onSelectFocus)
  selectFocusRef.current = onSelectFocus
  const heartbeatRef = useRef(onHeartbeat)
  heartbeatRef.current = onHeartbeat

  const gyroDeltaRef = useRef({ x: 0, y: 0 })
  const [gyroState, setGyroState] = useState<'idle' | 'on' | 'denied'>('idle')
  const [isCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )

  const [imageReady, setImageReady] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hold, setHold] = useState(0)
  const [heartbeatAt, setHeartbeatAt] = useState(0)
  const [sent, setSent] = useState(false)
  const [heartbeatEcho, setHeartbeatEcho] = useState<{ bpm: number; text: string } | null>(null)
  const [sparks, setSparks] = useState<SceneSpark[]>([])
  const [playPropsInEdit, setPlayPropsInEdit] = useState(false)
  const sparkIdRef = useRef(1)
  const playPropsRef = useRef(false)
  const interactCbRef = useRef(onSceneInteract)
  const sentTimerRef = useRef<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const holdStartRef = useRef(0)
  const holdingRef = useRef(false)
  const vibStageRef = useRef(0)

  const flavor = detectInteractFlavor(packet)
  const flavorRef = useRef(flavor)

  useEffect(() => {
    interactCbRef.current = onSceneInteract
  }, [onSceneInteract])

  useEffect(() => {
    flavorRef.current = flavor
  }, [flavor])

  useEffect(() => {
    playPropsRef.current = playPropsInEdit
  }, [playPropsInEdit])

  useEffect(() => {
    setSparks([])
  }, [packet.id])

  const selected = selectedId ? packet.focus.find((point) => point.id === selectedId) ?? null : null

  useEffect(() => {
    if (selectedId && !packet.focus.some((point) => point.id === selectedId)) {
      setSelectedId(null)
    }
  }, [packet.focus, selectedId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      setImageReady(true)
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x091122)
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
    camera.position.set(0, 0, CAMERA_Z)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.setClearColor(0x091122, 1)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'pan-y'
    renderer.domElement.style.filter = photoFilterRef.current || 'none'
    canvasRef.current = renderer.domElement
    host.appendChild(renderer.domElement)

    const plateGeometry = new THREE.PlaneGeometry(1, 1, 72, 44)
    {
      const positions = plateGeometry.attributes.position
      for (let i = 0; i < positions.count; i += 1) {
        const nx = positions.getX(i) * 2
        const ny = positions.getY(i) * 2
        positions.setZ(i, -0.5 * (nx * nx * 0.72 + ny * ny * 0.28))
      }
      positions.needsUpdate = true
      plateGeometry.computeVertexNormals()
    }
    const plateMaterial = new THREE.MeshBasicMaterial({ color: 0x0d1832 })
    const plate = new THREE.Mesh(plateGeometry, plateMaterial)
    scene.add(plate)

    const glowTexture = makeGlowTexture()

    let plateW = 1
    let plateH = 1
    let viewW = 1
    let viewH = 1
    let loadedUrl = ''
    let modeLive: StudioMode = mode
    let pausedLive = pausedRef.current
    let contextLostLive = false
    let focusLive: FocusPoint[] = packetRef.current.focus
    let elapsed = 0
    let pulseStart = -10
    let holdTarget = 0
    let holdSmooth = 0
    let pointerX = 0
    let pointerY = 0
    let smoothX = 0
    let parallaxMix = 0
    let smoothY = 0
    let hoveredId: string | null = null

    let particlePoints: THREE.Points | null = null
    let particleGeometry: THREE.BufferGeometry | null = null
    let particleMaterial: THREE.ShaderMaterial | null = null
    let particleUniforms: {
      uTime: { value: number }
      uPixel: { value: number }
      uView: { value: THREE.Vector2 }
      uKind: { value: number }
      uPulse: { value: number }
    } | null = null

    const beaconGroup = new THREE.Group()
    scene.add(beaconGroup)

    interface BeaconNode {
      group: THREE.Group
      sprite: THREE.Sprite
      ring: THREE.Mesh
      core: THREE.Sprite
      hit: THREE.Mesh
      id: string
      seed: number
    }
    let beaconNodes: BeaconNode[] = []

    const clockObj = new THREE.Clock()
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()

    function surfaceZ(xWorld: number, yWorld: number) {
      const nx = xWorld / (plateW / 2)
      const ny = yWorld / (plateH / 2)
      return -0.5 * (nx * nx * 0.72 + ny * ny * 0.28)
    }

    function focusWorld(point: FocusPoint) {
      const x = (point.x - 0.5) * viewW
      const y = (0.5 - point.y) * viewH
      return new THREE.Vector3(x, y, surfaceZ(x, y) + 0.07)
    }

    function disposeBeacons() {
      beaconNodes.forEach((node) => {
        node.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            const material = child.material
            if (Array.isArray(material)) material.forEach((item) => item.dispose())
            else material.dispose()
          }
          if (child instanceof THREE.Sprite) {
            child.material.dispose()
          }
        })
        beaconGroup.remove(node.group)
      })
      beaconNodes = []
    }

    function rebuildBeacons(focus: FocusPoint[]) {
      disposeBeacons()
      focus.slice(0, 3).forEach((point, index) => {
        const group = new THREE.Group()
        group.position.copy(focusWorld(point))

        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xffd99a,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        halo.scale.setScalar(0.62)

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.082, 0.094, 64),
          new THREE.MeshBasicMaterial({
            color: 0xffe4b8,
            transparent: true,
            opacity: 0.62,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )

        const core = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xfff5e4,
            transparent: true,
            opacity: 0.96,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        core.scale.setScalar(0.16)

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 8, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        )
        hit.userData.focusId = point.id

        group.add(halo)
        group.add(ring)
        group.add(core)
        group.add(hit)
        beaconGroup.add(group)
        beaconNodes.push({ group, sprite: halo, ring, core, hit, id: point.id, seed: index * 2.1 })
      })
    }

    function fitTexture() {
      const texture = plateMaterial.map
      if (!texture || !texture.image) return
      const image = texture.image as {
        width?: number
        height?: number
        naturalWidth?: number
        naturalHeight?: number
      }
      const iw = image.naturalWidth || image.width || 0
      const ih = image.naturalHeight || image.height || 0
      if (!iw || !ih) return
      const imageAspect = iw / ih
      const plateAspect = plateW / plateH
      texture.repeat.set(1, 1)
      texture.offset.set(0, 0)
      if (imageAspect > plateAspect) {
        const ratio = plateAspect / imageAspect
        texture.repeat.x = ratio
        texture.offset.x = (1 - ratio) / 2
      } else {
        const ratio = imageAspect / plateAspect
        texture.repeat.y = ratio
        texture.offset.y = (1 - ratio) / 2
      }
      texture.needsUpdate = true
    }

    function applySize() {
      const rect = host!.getBoundingClientRect()
      const width = Math.max(2, Math.round(rect.width))
      const height = Math.max(2, Math.round(rect.height))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()

      viewH = 2 * Math.tan((FOV / 2) * (Math.PI / 180)) * CAMERA_Z
      viewW = viewH * camera.aspect
      plateW = viewW * 1.07
      plateH = viewH * 1.07
      plate.scale.set(plateW, plateH, 1)
      fitTexture()
      rebuildBeacons(focusLive)
      if (particleUniforms) particleUniforms.uView.value.set(viewW * 1.08, viewH * 1.08)
    }

    const initialTextureUrl = packetRef.current.image
    function setPhoto(url: string) {
      if (!url || url === loadedUrl) {
        if (!disposed) setImageReady(true)
        return
      }
      loadedUrl = url
      const img = new Image()
      img.decoding = 'async'
      if (!url.startsWith('data:') && !url.startsWith('blob:')) {
        img.crossOrigin = 'anonymous'
      }
      img.onload = () => {
        if (disposed || loadedUrl !== url) return
        const texture = new THREE.Texture(img)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.generateMipmaps = false
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.needsUpdate = true
        plateMaterial.map?.dispose()
        plateMaterial.map = texture
        plateMaterial.color.setHex(0xffffff)
        plateMaterial.needsUpdate = true
        fitTexture()
        setImageReady(true)
      }
      img.onerror = () => {
        if (!disposed) setImageReady(true)
      }
      img.src = url
    }

    function setParticles(kind: ParticleKind) {
      if (particlePoints) {
        scene.remove(particlePoints)
        particleGeometry?.dispose()
        particleMaterial?.dispose()
        particlePoints = null
        particleGeometry = null
        particleMaterial = null
        particleUniforms = null
      }
      if (kind === 'none') return
      const config = PARTICLE_CONFIG[kind]
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const count = coarse ? config.mobile : config.desktop
      const geometry = new THREE.BufferGeometry()
      const seeds = new Float32Array(count * 3)
      for (let i = 0; i < count * 3; i += 1) seeds[i] = Math.random()
      geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3))
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100)

      const uniforms = {
        uTime: { value: 0 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uView: { value: new THREE.Vector2(viewW * 1.08, viewH * 1.08) },
        uKind: { value: config.kind },
        uPulse: { value: 0 },
      }

      const material = new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          uColor: { value: new THREE.Color(config.color) },
          uOpacity: { value: config.opacity },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      })

      const points = new THREE.Points(geometry, material)
      points.frustumCulled = false
      scene.add(points)
      particlePoints = points
      particleGeometry = geometry
      particleMaterial = material
      particleUniforms = uniforms
    }

    function setMode(next: StudioMode) {
      modeLive = next
      if (next !== 'preview') setSelectedId(null)
    }

    function setHoldLevel(level: number) {
      holdTarget = clamp(level, 0, 1)
    }

    function triggerPulse() {
      pulseStart = elapsed
      if (particleUniforms) particleUniforms.uPulse.value = 0.001
    }

    function setPaused(next: boolean) {
      pausedLive = next
      if (disposed) return
      if (next || contextLostLive) {
        renderer.setAnimationLoop(null)
      } else {
        clockObj.getDelta()
        renderer.setAnimationLoop(animation)
      }
    }

    apiRef.current = {
      setPhoto,
      setParticles,
      setFocus: (focus) => {
        focusLive = focus
        rebuildBeacons(focus)
      },
      setMode,
      setHoldLevel,
      setPaused,
      triggerPulse,
    }

    function updatePointer(event: PointerEvent) {
      const rect = host!.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointerX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
      pointerY = clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -1, 1)
    }

    function raycastFocus(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      pointerNdc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      )
      raycaster.setFromCamera(pointerNdc, camera)
      const meshes = beaconNodes.map((node) => node.hit)
      const hits = raycaster.intersectObjects(meshes, false)
      if (!hits.length) return null
      const id = hits[0].object.userData.focusId as string | undefined
      return id ?? null
    }

    function onPointerMove(event: PointerEvent) {
      updatePointer(event)
      const hover = raycastFocus(event.clientX, event.clientY)
      hoveredId = hover
      host!.style.cursor = hover ? 'pointer' : modeLive === 'edit' ? 'crosshair' : 'default'
    }

    let downX = 0
    let downY = 0
    let downTime = 0

    function onCanvasPointerDown(event: PointerEvent) {
      downX = event.clientX
      downY = event.clientY
      downTime = performance.now()
      updatePointer(event)
    }

    function onCanvasPointerUp(event: PointerEvent) {
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY)
      if (moved > 9 || performance.now() - downTime > 1200) return
      const hitId = raycastFocus(event.clientX, event.clientY)
      if (hitId) {
        if (modeLive === 'preview') {
          setSelectedId(hitId)
          selectFocusRef.current?.(hitId)
        }
        return
      }
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const x = clamp((event.clientX - rect.left) / rect.width, 0.04, 0.96)
      const y = clamp((event.clientY - rect.top) / rect.height, 0.06, 0.94)
      if (modeLive === 'edit' && !playPropsRef.current) {
        addFocusRef.current(x, y)
      } else {
        if (modeLive === 'preview') {
          setSelectedId(null)
          selectFocusRef.current?.(null)
        }
        const kind = flavorRef.current.kind
        const id = sparkIdRef.current++
        setSparks((prev) => [...prev.slice(-11), { id, x, y, kind }])
        interactCbRef.current?.(kind)
        try {
          navigator.vibrate?.(12)
        } catch {
          /* ignore */
        }
      }
    }

    function onPointerLeave() {
      pointerX = 0
      pointerY = 0
      hoveredId = null
      host!.style.cursor = modeLive === 'edit' ? 'crosshair' : 'default'
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!disposed) applySize()
    })
    resizeObserver.observe(host)

    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLostLive = true
      renderer.setAnimationLoop(null)
      if (!disposed) setContextLost(true)
    }

    const onContextRestored = () => {
      contextLostLive = false
      if (!disposed) setContextLost(false)
      if (!disposed && !pausedLive) {
        clockObj.getDelta()
        renderer.setAnimationLoop(animation)
      }
    }

    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown)
    renderer.domElement.addEventListener('pointerup', onCanvasPointerUp)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)

    setPhoto(initialTextureUrl)
    setParticles(packetRef.current.particles)
    applySize()
    host!.style.cursor = modeRefCursor()

    function modeRefCursor() {
      return modeLive === 'edit' ? 'crosshair' : 'default'
    }

    const animation = () => {
      const delta = clockObj.getDelta()
      elapsed += delta

      const gyro = gyroDeltaRef.current
      const targetX = clamp(pointerX + gyro.x * 0.85, -1, 1)
      const targetY = clamp(pointerY + gyro.y * 0.85, -1, 1)
      const smooth = 1 - Math.pow(0.0018, Math.min(delta, 0.05))
      smoothX += (targetX - smoothX) * smooth
      smoothY += (targetY - smoothY) * smooth

      const wantParallax = getSettings().parallax
      const calm = getSettings().reducedMotion
      parallaxMix += ((wantParallax ? 1 : 0) - parallaxMix) * (1 - Math.pow(0.02, Math.min(delta, 0.05)))
      holdSmooth += (holdTarget - holdSmooth) * (1 - Math.exp(-Math.min(delta, 0.05) * 8))
      const pulseWave = pulseStart >= 0 ? Math.max(0, 1 - (elapsed - pulseStart) / 1.4) : 0
      const resonanceZoom = calm ? 0 : holdSmooth * 0.46 + Math.sin(pulseWave * Math.PI) * 0.2
      camera.position.x = smoothX * 0.14 * parallaxMix + gyro.x * 0.16
      camera.position.y = smoothY * 0.1 * parallaxMix + gyro.y * 0.12
      camera.position.z = CAMERA_Z - resonanceZoom
      camera.lookAt(0, 0, 0)
      plate.position.y = Math.sin(elapsed * 0.45) * 0.003

      beaconNodes.forEach((node) => {
        const breathe = 0.5 + 0.5 * Math.sin(elapsed * 1.5 + node.seed)
        const hover = hoveredId === node.id ? 1.35 : 1
        const preview = modeLive === 'preview' ? 1 : 0.78
        node.sprite.scale.setScalar((0.5 + 0.16 * breathe) * hover * preview)
        node.sprite.material.opacity = (0.32 + 0.36 * breathe) * preview * (hoveredId === node.id ? 1.25 : 1)
        node.ring.scale.setScalar((1 + 0.22 * breathe) * hover)
        node.ring.quaternion.copy(camera.quaternion)
        const ringMaterial = node.ring.material as THREE.MeshBasicMaterial
        ringMaterial.opacity = (0.28 + 0.34 * breathe) * preview
        node.core.scale.setScalar((0.13 + 0.03 * breathe) * hover)
      })

      if (particleUniforms && particleMaterial) {
        particleUniforms.uTime.value = elapsed
        particleUniforms.uPixel.value = Math.min(window.devicePixelRatio || 1, 2)
        if (holdSmooth > 0.02) {
          particleUniforms.uPulse.value = clamp(0.18 + holdSmooth * 0.55, 0.02, 0.82)
        } else if (pulseStart >= 0) {
          const pulse = clamp((elapsed - pulseStart) / 1.8, 0, 1)
          particleUniforms.uPulse.value = pulse >= 1 ? 0 : pulse
        } else {
          particleUniforms.uPulse.value = 0
        }
      }

      renderer.render(scene, camera)
    }
    if (!pausedLive) {
      renderer.setAnimationLoop(animation)
    }

    return () => {
      disposed = true
      canvasRef.current = null
      apiRef.current = null
      renderer.setAnimationLoop(null)
      resizeObserver.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown)
      renderer.domElement.removeEventListener('pointerup', onCanvasPointerUp)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
      disposeBeacons()
      if (particlePoints) {
        scene.remove(particlePoints)
        particleGeometry?.dispose()
        particleMaterial?.dispose()
      }
      plateMaterial.map?.dispose()
      plateMaterial.dispose()
      plateGeometry.dispose()
      glowTexture.dispose()
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    apiRef.current?.setPhoto(packet.image)
  }, [packet.image])

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.filter = photoFilterCss || 'none'
    }
  }, [photoFilterCss])

  useEffect(() => {
    apiRef.current?.setParticles(packet.particles)
  }, [packet.particles])

  useEffect(() => {
    apiRef.current?.setFocus(packet.focus)
  }, [packet.focus])

  useEffect(() => {
    apiRef.current?.setMode(mode)
  }, [mode])

  useEffect(() => {
    apiRef.current?.setPaused(paused)
  }, [paused])

  useEffect(() => {
    if (gyroState !== 'on') {
      gyroDeltaRef.current = { x: 0, y: 0 }
      return
    }
    const handler = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0
      const beta = event.beta ?? 0
      gyroDeltaRef.current = {
        x: clamp(gamma / 24, -1, 1),
        y: clamp((beta - 52) / 30, -1, 1),
      }
    }
    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [gyroState])

  useEffect(() => {
    return () => {
      if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current)
      if (holdTimerRef.current !== null) window.clearInterval(holdTimerRef.current)
    }
  }, [])

  const enableGyro = async () => {
    if (gyroState === 'on') {
      setGyroState('idle')
      return
    }
    const orientation = window.DeviceOrientationEvent as unknown as
      | { requestPermission?: () => Promise<string> }
      | undefined
    try {
      if (orientation?.requestPermission) {
        const result = await orientation.requestPermission()
        if (result !== 'granted') {
          setGyroState('denied')
          return
        }
      }
      setGyroState('on')
    } catch {
      setGyroState('denied')
    }
  }

  const fireHeartbeat = () => {
    holdingRef.current = false
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHold(0)
    apiRef.current?.setHoldLevel(0)
    setHeartbeatAt(Date.now())
    setSent(true)
    apiRef.current?.triggerPulse()
    const maybeBpm = heartbeatRef.current()
    const bpm = typeof maybeBpm === 'number' ? maybeBpm : 62 + Math.floor(Math.random() * 17)
    const text = HEARTBEAT_ECHOS[Math.floor(Math.random() * HEARTBEAT_ECHOS.length)]
    setHeartbeatEcho({ bpm, text })
    if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current)
    sentTimerRef.current = window.setTimeout(() => {
      setSent(false)
      setHeartbeatEcho(null)
    }, 3000)
    try {
      navigator.vibrate?.([38, 60, 90])
    } catch {
      /* vibration unsupported */
    }
  }

  const beginHold = () => {
    if (holdingRef.current) return
    holdingRef.current = true
    holdStartRef.current = performance.now()
    vibStageRef.current = 0
    setHold(0.001)
    apiRef.current?.setHoldLevel(0.08)
    try {
      navigator.vibrate?.(12)
    } catch {
      /* ignore */
    }
    if (holdTimerRef.current !== null) window.clearInterval(holdTimerRef.current)
    holdTimerRef.current = window.setInterval(() => {
      if (!holdingRef.current) return
      const progress = clamp((performance.now() - holdStartRef.current) / HOLD_MS, 0, 1)
      setHold(progress)
      apiRef.current?.setHoldLevel(progress)
      if (progress > 0.28 && vibStageRef.current < 1) {
        vibStageRef.current = 1
        try { navigator.vibrate?.(18) } catch { /* ignore */ }
      } else if (progress > 0.62 && vibStageRef.current < 2) {
        vibStageRef.current = 2
        try { navigator.vibrate?.(28) } catch { /* ignore */ }
      }
      if (progress >= 1) fireHeartbeat()
    }, 35)
  }

  const endHold = () => {
    if (!holdingRef.current) return
    holdingRef.current = false
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHold(0)
    apiRef.current?.setHoldLevel(0)
  }

  const canGyro = isCoarse && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  const focusCount = packet.focus.length
  const windText = ['无风', '微风', '清风', '长风'][clamp(Math.round(packet.windLevel), 0, 3)]
  const weatherText = citySignature(packet.city)?.weather || windText

  return (
    <div ref={hostRef} className="group relative h-full w-full select-none overflow-hidden bg-[#0a1226]">
      {contextLost && (
        <img
          src={packet.image}
          alt={packet.title}
          className="absolute inset-0 z-[1] h-full w-full object-cover"
          style={photoFilterCss ? { filter: photoFilterCss } : undefined}
          draggable={false}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 46%, transparent 45%, rgba(6,11,24,0.42) 92%), linear-gradient(180deg, rgba(6,11,24,0.38), transparent 24%, transparent 72%, rgba(6,11,24,0.58))',
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-4 top-4 max-w-[66%] rounded-full border border-white/14 bg-[#0b152c]/62 px-3.5 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-2 font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_8px_rgba(242,194,139,0.9)]" />
            <span className="truncate">
              {packet.city || '此刻'} · {packet.tempC}°C · {weatherText}
              {packet.scentTag ? ` · ${packet.scentTag}` : ''}
            </span>
          </div>
        </div>

        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          {canGyro && (
            <button
              type="button"
              onClick={enableGyro}
              className={`pointer-events-auto rounded-full border px-3 py-1.5 font-serif text-[11.5px] tracking-[0.04em] backdrop-blur-md transition ${
                gyroState === 'on'
                  ? 'border-signal/65 bg-signal/20 text-[#fff8ee]'
                  : 'border-white/15 bg-[#0b152c]/62 text-white/78 hover:border-signal/50 hover:text-signal'
              }`}
            >
              {gyroState === 'on' ? '陀螺仪已开' : gyroState === 'denied' ? '未开启陀螺仪' : '陀螺仪'}
            </button>
          )}
          {mode === 'preview' && packet.voice && onPlayVoice && (
            <button
              type="button"
              onClick={onPlayVoice}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0b152c]/65 px-3 py-1.5 font-serif text-[11.5px] tracking-[0.04em] text-[#fff8ee]/90 backdrop-blur-md transition hover:border-signal/55 hover:text-signal"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 9.5v5h3.4L12 18.5v-13L7.4 9.5H4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M15.5 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              现场原声
            </button>
          )}
        </div>
      </div>

      {!imageReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a1226]">
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-signal/25 border-t-signal/90" />
            <div className="mt-3 font-serif text-[13px] tracking-[0.08em] text-white/75">
              正在展开这片风景…
            </div>
          </div>
        </div>
      )}

      {/* 交互场景彩蛋层：点亮窗灯 / 连起观测星点 / 雪花与光波 */}
      {sparks.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden="true">
          {flavor.kind === 'star' && sparks.length >= 2 && (
            <svg className="absolute inset-0 h-full w-full">
              {sparks.slice(1).map((pt, idx) => {
                const prev = sparks[idx]
                return (
                  <line
                    key={pt.id}
                    x1={`${prev.x * 100}%`}
                    y1={`${prev.y * 100}%`}
                    x2={`${pt.x * 100}%`}
                    y2={`${pt.y * 100}%`}
                    stroke="rgba(210, 232, 255, 0.52)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                )
              })}
            </svg>
          )}
          {sparks.map((sp) => (
            <div
              key={sp.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 animate-fade-in"
              style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
            >
              {sp.kind === 'lamp' && (
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-[#ffd285]/40 blur-md" />
                  <span className="h-3.5 w-5 rounded-[3px] border border-[#ffe8ba]/80 bg-[#ffd994] shadow-[0_0_24px_8px_rgba(255,206,120,0.68)]" />
                </span>
              )}
              {sp.kind === 'star' && (
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span className="h-2 w-2 rotate-45 bg-[#eef6ff] shadow-[0_0_16px_5px_rgba(182,220,255,0.88)]" />
                  <span className="absolute h-5 w-px bg-white/65" />
                  <span className="absolute h-px w-5 bg-white/65" />
                </span>
              )}
              {sp.kind === 'snow' && (
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span className="h-3 w-3 rounded-full bg-white/90 shadow-[0_0_20px_7px_rgba(216,240,255,0.75)]" />
                </span>
              )}
              {sp.kind === 'ripple' && (
                <span className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-signal/70 animate-[pulseRing_2.4s_ease-out_infinite]" />
                  <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_14px_rgba(242,194,139,0.9)]" />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 长按共鸣时的实时场景光环呼吸反馈 */}
      {hold > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="rounded-full border border-signal/60 transition-transform duration-75"
            style={{
              width: `${120 + hold * 340}px`,
              height: `${120 + hold * 340}px`,
              opacity: 0.24 + hold * 0.55,
              boxShadow: `0 0 ${28 + hold * 56}px rgba(242, 194, 139, ${0.25 + hold * 0.4})`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(242, 194, 139, ${hold * 0.22}), transparent 66%)`,
            }}
          />
        </div>
      )}

      {sparks.length > 0 && (
        <div className="pointer-events-auto absolute bottom-16 right-4 z-20 flex items-center gap-2 rounded-full border border-signal/35 bg-[#081022]/75 px-3 py-1 font-serif text-[11px] text-signal backdrop-blur-md">
          <span>
            {flavor.counter} {sparks.length}
          </span>
          <button
            type="button"
            onClick={() => setSparks([])}
            className="text-white/55 transition hover:text-white"
            aria-label="清空互动光点"
          >
            清空
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-wrap items-center justify-center gap-2 px-4">
          <div className="rounded-full border border-white/15 bg-[#0b152c]/78 px-3.5 py-1.5 font-serif text-[12px] tracking-[0.04em] text-[#fff8ee]/90 shadow-lg backdrop-blur-md">
            {playPropsInEdit
              ? flavor.action
              : focusCount >= 3
                ? '已贴满 3 条留言 · 可在下方修改或删除'
                : '轻点画面任意处，贴上一句想留下的话'}
          </div>
          <button
            type="button"
            onClick={() => setPlayPropsInEdit((v) => !v)}
            className={`pointer-events-auto rounded-full border px-3 py-1.5 font-serif text-[11.5px] tracking-[0.04em] backdrop-blur-md transition ${
              playPropsInEdit
                ? 'border-signal bg-signal text-[#170f07] font-medium'
                : 'border-signal/40 bg-[#0b152c]/78 text-signal hover:bg-signal/16'
            }`}
          >
            {playPropsInEdit ? '切回贴留言' : `场景互动 · ${flavor.kind === 'lamp' ? '点窗灯' : flavor.kind === 'star' ? '观星' : flavor.kind === 'snow' ? '扬雪' : '起波纹'}`}
          </button>
        </div>
      )}

      {mode === 'preview' && selected && (
        <div className="pointer-events-auto absolute bottom-[84px] left-1/2 z-20 w-[min(430px,88%)] -translate-x-1/2">
          <div className="relative rounded-2xl border border-white/14 bg-[#0b152c]/82 px-4 py-3.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="flex items-center justify-between font-serif text-[11.5px] text-signal/90">
              <span>第 {packet.focus.indexOf(selected) + 1} 处目光 · 她停在这里</span>
              <button
                type="button"
                className="pointer-events-auto -mr-1 -mt-1 flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setSelectedId(null)
                  selectFocusRef.current?.(null)
                }}
                aria-label="关闭细语"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="mt-2 font-serif text-[14px] font-normal leading-[1.85] tracking-[0.04em] text-[#fff8ee]/92">
              {selected.note.trim() || '她在这里停了一会儿，没有说话。'}
            </p>
            <div className="mt-2 text-right font-serif text-[11px] tracking-[0.1em] text-white/48">
              来自 {packet.city || '地表'} 的此刻
            </div>
          </div>
        </div>
      )}

      {mode === 'preview' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="relative">
            {heartbeatAt > 0 && (
              <span
                key={heartbeatAt}
                className="pointer-events-none absolute -inset-3 rounded-full border border-signal/55 heartbeat-halo"
              />
            )}
            <button
              type="button"
              onPointerDown={(event) => {
                if (event.button !== 0 && event.pointerType === 'mouse') return
                event.preventDefault()
                beginHold()
              }}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              onContextMenu={(event) => event.preventDefault()}
              className="pointer-events-auto relative flex h-11 select-none items-center overflow-hidden rounded-full p-[1.5px] transition-transform active:scale-[0.985]"
              style={{
                background:
                  hold > 0
                    ? `conic-gradient(rgba(242,194,139,0.95) ${hold * 360}deg, rgba(255,255,255,0.12) 0deg)`
                    : 'linear-gradient(120deg, rgba(242,194,139,0.72), rgba(138,184,255,0.5))',
                touchAction: 'none',
              }}
              aria-label="长按发送同频心跳"
            >
              <span className="relative flex h-full items-center gap-2 rounded-full bg-[#0b152c]/92 px-5 font-serif text-[12.5px] tracking-[0.06em] text-[#fff8ee]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-signal">
                  <path
                    d="M3 12h4l2-6 4 12 2.5-7.5L17 12h4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {sent ? '同频心跳 · 已送达' : hold > 0 ? '正在同步心跳…' : '长按发送同频心跳'}
              </span>
            </button>
            {sent && heartbeatEcho && (
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-signal/40 bg-[#0b152c]/92 px-3.5 py-1.5 font-serif text-[11.5px] tracking-[0.04em] text-signal shadow-xl backdrop-blur-md animate-fade-in">
                {heartbeatEcho.bpm} BPM · {heartbeatEcho.text}
              </span>
            )}
          </div>
        </div>
      )}

      {heartbeatAt > 0 && (
        <span key={`wave-${heartbeatAt}`} className="pointer-events-none absolute inset-0 z-[5] vision-heartbeat-flash" />
      )}
    </div>
  )
}