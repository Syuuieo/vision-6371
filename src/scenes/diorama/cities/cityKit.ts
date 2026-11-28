import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import type { DioramaBuilderCtx, DioramaTextures } from '../types'

export type CityRailStyle = 'iron' | 'stone' | 'timber'
export type CityLampStyle = 'shanghai' | 'paris' | 'iceland' | 'dali' | 'harbin'
export type CityTuple = [number, number, number]

export interface CityRailSegment {
  from: CityTuple
  to: CityTuple
}

export interface CityBuildingSpec {
  pos: CityTuple
  size: CityTuple
  rotation?: number
  roof?: 'mansard' | 'gable' | 'flat'
  windows?: number
}

const UP = new THREE.Vector3(0, 1, 0)

function orientAlong(object: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  const direction = to.clone().sub(from)
  object.position.copy(from).add(to).multiplyScalar(0.5)
  object.quaternion.setFromUnitVectors(UP, direction.clone().normalize())
  return direction.length()
}

export function createCityPbrMaterials(textures: DioramaTextures) {
  const granite = createMat('#6f7477', {
    roughness: 0.82,
    metalness: 0.04,
    bumpMap: textures.darkStoneTex,
    bumpScale: 0.045,
  })
  const wood = createMat('#806046', {
    roughness: 0.8,
    bumpMap: textures.weatheredWoodTex,
    bumpScale: 0.055,
  })
  const stone = createMat('#b8ad99', {
    roughness: 0.9,
    bumpMap: textures.plasterBump,
    bumpScale: 0.04,
  })
  const brick = createMat('#a85f52', {
    map: textures.brickTex,
    bumpMap: textures.brickBump,
    bumpScale: 0.05,
    roughness: 0.88,
  })
  const iron = createMat('#252d34', { roughness: 0.42, metalness: 0.72 })
  const brass = createMat('#b58b4d', { roughness: 0.32, metalness: 0.78 })
  const glass = createMat('#ffdca1', {
    emissive: '#ffb85c',
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.12,
  })
  const snow = createMat('#e8f1f7', { roughness: 0.92 })

  const addWeatherHook = (ctx: DioramaBuilderCtx) => {
    ctx.addWeatherHook?.((weather, rainIntensity) => {
      const wet = weather === 'rain' ? Math.max(0.25, rainIntensity) : 0
      granite.roughness = 0.82 - wet * 0.46
      wood.roughness = 0.8 - wet * 0.28
      stone.roughness = 0.9 - wet * 0.32
      glass.roughness = 0.18 - wet * 0.08
    })
  }

  return { granite, wood, stone, brick, iron, brass, glass, snow, addWeatherHook }
}

export function buildContinuousRailing(
  parent: THREE.Object3D,
  segments: readonly CityRailSegment[],
  style: CityRailStyle,
) {
  const group = new THREE.Group()
  group.name = `continuous-railing-${style}`
  const material = createMat(
    style === 'stone' ? '#8d9293' : style === 'timber' ? '#6c503b' : '#27313a',
    {
      roughness: style === 'stone' ? 0.9 : 0.58,
      metalness: style === 'iron' ? 0.68 : 0.02,
    },
  )
  const capMaterial = style === 'iron'
    ? createMat('#b18b4f', { roughness: 0.34, metalness: 0.76 })
    : material
  const thickness = style === 'stone' ? 0.16 : style === 'timber' ? 0.1 : 0.055
  const height = style === 'stone' ? 0.92 : 1.05

  for (const segment of segments) {
    const from = new THREE.Vector3(...segment.from)
    const to = new THREE.Vector3(...segment.to)
    const length = from.distanceTo(to)
    if (length < 0.01) continue
    const postCount = Math.max(1, Math.ceil(length / (style === 'stone' ? 1.8 : 1.35)))
    for (let i = 0; i <= postCount; i += 1) {
      const t = i / postCount
      const base = from.clone().lerp(to, t)
      const post = new THREE.Mesh(
        style === 'stone'
          ? new THREE.BoxGeometry(thickness * 1.35, height, thickness * 1.35)
          : new THREE.CylinderGeometry(thickness * 0.72, thickness, height, 8),
        material,
      )
      post.position.copy(base)
      post.position.y += height / 2
      post.castShadow = true
      post.receiveShadow = true
      group.add(post)
      if (style === 'iron') {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(thickness * 1.25, 8, 6), capMaterial)
        cap.position.copy(post.position)
        cap.position.y += height / 2
        group.add(cap)
      }
    }
    for (const y of style === 'iron' ? [height * 0.52, height] : [height]) {
      const railFrom = from.clone()
      const railTo = to.clone()
      railFrom.y += y
      railTo.y += y
      const rail = new THREE.Mesh(
        style === 'stone'
          ? new THREE.BoxGeometry(thickness * 1.2, 1, thickness * 1.2)
          : new THREE.CylinderGeometry(thickness * 0.62, thickness * 0.62, 1, 8),
        y === height ? capMaterial : material,
      )
      const railLength = orientAlong(rail, railFrom, railTo)
      rail.scale.y = railLength
      rail.castShadow = true
      group.add(rail)
    }
  }

  parent.add(group)
  return group
}

export function buildStreetLampRow(
  parent: THREE.Object3D,
  textures: DioramaTextures,
  positions: readonly CityTuple[],
  style: CityLampStyle,
) {
  const group = new THREE.Group()
  group.name = `street-lamps-${style}`
  const poleMat = createMat(style === 'dali' ? '#5c4433' : '#26313a', {
    roughness: 0.48,
    metalness: style === 'dali' ? 0.05 : 0.66,
  })
  const lampMat = createMat('#ffe0a6', {
    emissive: '#ffb85c',
    emissiveIntensity: 0.85,
    roughness: 0.25,
    transparent: true,
    opacity: 0.92,
  })
  const height = style === 'paris' ? 4.2 : style === 'harbin' ? 3.8 : style === 'iceland' ? 3.6 : 4

  positions.forEach(([x, y, z]) => {
    const lamp = new THREE.Group()
    lamp.position.set(x, y, z)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.095, height, 10), poleMat)
    pole.position.y = height / 2
    lamp.add(pole)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.28, 10), poleMat)
    base.position.y = 0.14
    lamp.add(base)

    if (style === 'paris') {
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), poleMat)
        arm.rotation.z = Math.PI / 2
        arm.position.set(side * 0.26, height - 0.15, 0)
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.3, 6), lampMat)
        lantern.position.set(side * 0.52, height + 0.05, 0)
        lamp.add(arm, lantern)
      }
    } else if (style === 'harbin') {
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), poleMat)
      crossbar.rotation.z = Math.PI / 2
      crossbar.position.y = height - 0.1
      lamp.add(crossbar)
      for (const side of [-1, 1]) {
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.28, 6), lampMat)
        lantern.position.set(side * 0.48, height + 0.02, 0)
        lamp.add(lantern)
      }
    } else if (style === 'dali') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), poleMat)
      frame.position.y = height
      const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 12), lampMat)
      paper.position.y = height
      lamp.add(frame, paper)
    } else {
      const lantern = new THREE.Mesh(
        style === 'shanghai'
          ? new THREE.CylinderGeometry(0.13, 0.17, 0.34, 6)
          : new THREE.CylinderGeometry(0.12, 0.16, 0.32, 8),
        lampMat,
      )
      lantern.position.y = height
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 6), poleMat)
      roof.position.y = height + 0.24
      lamp.add(lantern, roof)
    }

    const glow = makeGlowSprite(textures.glowHalo, '#ffd18a', style === 'paris' ? 1.1 : 0.85, 0.22)
    glow.position.y = height + 0.05
    const light = new THREE.PointLight('#ffc477', 2.2, 8, 2)
    light.position.y = height
    lamp.add(glow, light)
    group.add(lamp)
  })

  parent.add(group)
  return group
}

export function createPerimeterFacadeTextures() {
  if (typeof document === 'undefined') return null
  const cCanvas = document.createElement('canvas')
  cCanvas.width = 256
  cCanvas.height = 256
  const eCanvas = document.createElement('canvas')
  eCanvas.width = 256
  eCanvas.height = 256
  const cCtx = cCanvas.getContext('2d')!
  const eCtx = eCanvas.getContext('2d')!

  cCtx.fillStyle = '#cfc3af'
  cCtx.fillRect(0, 0, 256, 256)
  eCtx.fillStyle = '#000000'
  eCtx.fillRect(0, 0, 256, 256)

  for (let y = 0; y < 256; y += 24) {
    cCtx.fillStyle = 'rgba(90, 78, 65, 0.2)'
    cCtx.fillRect(0, y, 256, 2)
  }

  const cols = 4
  const rows = 4
  const cw = 256 / cols
  const rh = 256 / rows
  for (let r = 0; r < rows; r += 1) {
    cCtx.fillStyle = '#ded4c2'
    cCtx.fillRect(0, r * rh, 256, 6)
    for (let c = 0; c < cols; c += 1) {
      const wx = c * cw + 14
      const wy = r * rh + 14
      const ww = 36
      const wh = 42
      const lit = ((r * 5 + c * 11) % 4) !== 0
      cCtx.fillStyle = '#e5dccb'
      cCtx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6)
      cCtx.fillStyle = lit ? '#ffd188' : '#252c38'
      cCtx.fillRect(wx, wy, ww, wh)
      if (lit) {
        eCtx.fillStyle = '#ffbe66'
        eCtx.fillRect(wx, wy, ww, wh)
      }
      cCtx.fillStyle = '#24262b'
      cCtx.fillRect(wx + ww / 2 - 1, wy, 2, wh)
      cCtx.fillRect(wx, wy + wh * 0.48, ww, 2)
      eCtx.fillStyle = '#181410'
      eCtx.fillRect(wx + ww / 2 - 1, wy, 2, wh)
      eCtx.fillRect(wx, wy + wh * 0.48, ww, 2)
    }
  }

  const map = new THREE.CanvasTexture(cCanvas)
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  const emissiveMap = new THREE.CanvasTexture(eCanvas)
  emissiveMap.wrapS = THREE.RepeatWrapping
  emissiveMap.wrapT = THREE.RepeatWrapping
  emissiveMap.colorSpace = THREE.SRGBColorSpace
  return { map, emissiveMap }
}

export function buildPerimeterBuildings(
  parent: THREE.Object3D,
  specs: readonly CityBuildingSpec[],
  materials: ReturnType<typeof createCityPbrMaterials>,
) {
  const group = new THREE.Group()
  group.name = 'perimeter-buildings'
  const facadeTex = createPerimeterFacadeTextures()
  const roofMat = createMat('#2f3845', { roughness: 0.65, metalness: 0.24 })
  const plinthMat = createMat('#69635b', { roughness: 0.9 })

  specs.forEach((spec, idx) => {
    const building = new THREE.Group()
    building.position.set(...spec.pos)
    building.rotation.y = spec.rotation ?? 0
    const [width, height, depth] = spec.size
    const repX = Math.max(1, Math.round(width / 10))
    const repY = Math.max(1, Math.round(height / 10))
    let bodyMat: THREE.Material = materials.stone
    if (facadeTex) {
      const mMap = facadeTex.map.clone()
      mMap.repeat.set(repX, repY)
      mMap.needsUpdate = true
      const eMap = facadeTex.emissiveMap.clone()
      eMap.repeat.set(repX, repY)
      eMap.needsUpdate = true
      bodyMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? '#dfd4c1' : '#d2c4ae',
        map: mMap,
        emissive: new THREE.Color('#ffbe6b'),
        emissiveMap: eMap,
        emissiveIntensity: 0.72,
        roughness: 0.84,
      })
    }

    const plinthH = Math.min(2.6, height * 0.22)
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.25, plinthH, depth + 0.25), plinthMat)
    plinth.position.y = plinthH / 2
    building.add(plinth)

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat)
    body.position.y = height / 2
    building.add(body)

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, 0.32, depth + 0.45), materials.stone)
    cornice.position.y = height - 0.15
    building.add(cornice)

    if (spec.roof === 'mansard') {
      const roofH = Math.min(3.2, height * 0.24)
      const roofGeo = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.84, Math.SQRT1_2, roofH, 4)
      roofGeo.rotateY(Math.PI / 4)
      const roof = new THREE.Mesh(roofGeo, roofMat)
      roof.scale.set(width + 0.2, 1, depth + 0.2)
      roof.position.y = height + roofH / 2
      building.add(roof)
    } else if (spec.roof === 'gable') {
      const roofH = Math.min(2.4, height * 0.2)
      const roofGeo = new THREE.CylinderGeometry(0.05, Math.SQRT1_2, roofH, 4)
      roofGeo.rotateY(Math.PI / 4)
      const roof = new THREE.Mesh(roofGeo, roofMat)
      roof.scale.set(width + 0.3, 1, depth + 0.3)
      roof.position.y = height + roofH / 2
      building.add(roof)
    }
    group.add(building)
  })

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false
      object.receiveShadow = true
    }
  })
  parent.add(group)
  return group
}

/** Creates a small flock of poetic gliding waterbirds with subtle wing-beat animation. */
export function createGlidingBirds(
  parent: THREE.Object3D,
  center: CityTuple,
  radius: number,
  count = 3,
  tint = '#e8eef5',
): (time: number) => void {
  const flock = new THREE.Group()
  flock.name = 'gliding-waterbirds'
  const birdMat = createMat(tint, { roughness: 0.75, side: THREE.DoubleSide })
  const wingGeo = new THREE.PlaneGeometry(0.45, 0.16)
  const birds: Array<{ root: THREE.Group; leftWing: THREE.Mesh; rightWing: THREE.Mesh; phase: number; r: number }> = []

  for (let i = 0; i < count; i += 1) {
    const root = new THREE.Group()
    const leftWing = new THREE.Mesh(wingGeo, birdMat)
    leftWing.position.x = -0.22
    const rightWing = new THREE.Mesh(wingGeo, birdMat)
    rightWing.position.x = 0.22
    root.add(leftWing, rightWing)
    flock.add(root)
    birds.push({
      root,
      leftWing,
      rightWing,
      phase: (i / count) * Math.PI * 2,
      r: radius * (0.75 + (i % 3) * 0.2),
    })
  }
  parent.add(flock)

  return (time: number) => {
    for (const b of birds) {
      const angle = time * 0.14 + b.phase
      b.root.position.set(
        center[0] + Math.cos(angle) * b.r,
        center[1] + Math.sin(time * 0.6 + b.phase) * 0.7,
        center[2] + Math.sin(angle) * b.r * 0.55,
      )
      b.root.rotation.y = -angle
      const flap = Math.sin(time * 4.5 + b.phase * 2) * 0.42
      b.leftWing.rotation.z = flap
      b.rightWing.rotation.z = -flap
    }
  }
}
