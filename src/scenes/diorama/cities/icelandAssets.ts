import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'

/** 哈尔格林姆斯风格阶梯玄武岩管风琴灯塔 (Hallgrímskirkja-inspired Stepped Basalt Cliff Lighthouse). */
export function createHallgrimurCliffLighthouse(glowTex: THREE.Texture) {
  const lh = new THREE.Group()
  lh.name = 'red-white-lighthouse'

  const concreteMat = createMat('#cfd7e0', { roughness: 0.72, metalness: 0.08 })
  const basaltWallMat = createMat('#485564', { roughness: 0.84, metalness: 0.12 })
  const darkIronMat = createMat('#1f2630', { roughness: 0.38, metalness: 0.76 })
  const doorGlowMat = createMat('#ffd38a', { emissive: '#ffab48', emissiveIntensity: 1.0 })
  const lanternMat = createMat('#fff0c4', {
    emissive: '#ffc464',
    emissiveIntensity: 1.15,
    roughness: 0.18,
  })

  // Symmetrical stepped basalt organ columns flanking the central tower
  const pipeHeights = [4.5, 6.2, 8.0, 10.2, 12.6, 15.2, 12.6, 10.2, 8.0, 6.2, 4.5]
  const stepW = 0.72
  pipeHeights.forEach((h, idx) => {
    const offset = (idx - 5) * stepW
    const depth = idx === 5 ? 3.2 : 2.4 - Math.abs(idx - 5) * 0.18
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(stepW * 0.92, h, depth),
      Math.abs(idx - 5) <= 1 ? concreteMat : basaltWallMat,
    )
    col.position.set(offset, h / 2, -Math.abs(idx - 5) * 0.12)
    col.castShadow = true
    col.receiveShadow = true
    lh.add(col)
  })

  // Illuminated Gothic arched chapel portal at the base
  const portal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.6, 0.25), doorGlowMat)
  portal.position.set(0, 1.9, 1.68)
  const portalFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.0, 0.2), darkIronMat)
  portalFrame.position.set(0, 2.0, 1.56)
  lh.add(portal, portalFrame)

  // Glowing observation gallery + rotating Fresnel beacon lantern atop the central spire (y = 15.2)
  const galleryDeck = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 1.95, 0.35, 16), darkIronMat)
  galleryDeck.position.y = 15.35
  const lanternRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 1.75, 12), lanternMat)
  lanternRoom.position.y = 16.4
  const copperCap = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.9, 12), darkIronMat)
  copperCap.position.y = 18.2
  const spireTip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.8, 8), darkIronMat)
  spireTip.position.y = 19.8
  lh.add(galleryDeck, lanternRoom, copperCap, spireTip)

  const halo = makeGlowSprite(glowTex, '#ffd588', 7.5, 0.55)
  halo.position.y = 16.5
  const lampLight = new THREE.PointLight('#ffd27d', 2.2, 55, 1.5)
  lampLight.position.y = 16.5
  lh.add(halo, lampLight)

  // Subtle volumetric rotating dual beam (lightweight translucent additive cones aimed out over water only)
  const beamPivot = new THREE.Group()
  beamPivot.position.y = 16.5
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#ffe4a8',
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const fresnel = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), lanternMat)
  beamPivot.add(fresnel)
  lh.add(beamPivot)

  return { lh, lanternMat, halo, lampLight, beamPivot, beamMat, fresnel }
}

/** Nordic A-Frame black-timber cabin with full-height glowing glass gable wall. */
export function createIcelandicAFrameCabin(glowTex: THREE.Texture): THREE.Group {
  const cabin = new THREE.Group()
  cabin.name = 'iceland-aframe-cabin'

  const timberMat = createMat('#20252d', { roughness: 0.82 })
  const deckMat = createMat('#5d4736', { roughness: 0.86 })
  const snowMat = createMat('#dce8f4', { roughness: 0.9 })
  const warmGlassMat = createMat('#ffd692', {
    emissive: '#ffaa44',
    emissiveIntensity: 0.85,
    roughness: 0.18,
  })

  // Timber terrace deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 8.4), deckMat)
  deck.position.y = 0.18
  cabin.add(deck)

  // Steep A-frame triangular prism roof walls
  const roofGeo = new THREE.ConeGeometry(4.4, 7.6, 3)
  roofGeo.rotateY(Math.PI / 6)
  // Build clean 2 pitched roof panels for crisp A-frame silhouette
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 7.2), timberMat)
    panel.position.set(side * 1.45, 2.55, -0.3)
    panel.rotation.z = -side * 1.06
    panel.castShadow = true
    const snow = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.14, 7.25), snowMat)
    snow.position.set(side * 1.56, 2.66, -0.3)
    snow.rotation.z = -side * 1.06
    cabin.add(panel, snow)
  }

  // Full-height glowing glass gable front + steel mullions
  const glassShape = new THREE.Shape()
  glassShape.moveTo(-2.7, 0.35)
  glassShape.lineTo(2.7, 0.35)
  glassShape.lineTo(0, 4.85)
  glassShape.closePath()
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), warmGlassMat)
  glass.position.z = 3.22
  cabin.add(glass)

  for (const mx of [-1.2, 0, 1.2]) {
    const mullionH = mx === 0 ? 4.4 : 2.6
    const mul = new THREE.Mesh(new THREE.BoxGeometry(0.1, mullionH, 0.12), timberMat)
    mul.position.set(mx, 0.35 + mullionH / 2, 3.26)
    cabin.add(mul)
  }
  const transom = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.12), timberMat)
  transom.position.set(0, 2.45, 3.26)
  cabin.add(transom)

  const glow = makeGlowSprite(glowTex, '#ffbe6b', 4.5, 0.28)
  glow.position.set(0, 2.2, 3.9)
  cabin.add(glow)

  return cabin
}

/** Traditional Icelandic turf-roofed black-timber cottage (Torfbæir) nestled into coastal slopes. */
export function createIcelandicTurfCottage(glowTex: THREE.Texture, wallTint = '#232830'): THREE.Group {
  const group = new THREE.Group()
  group.name = 'iceland-turf-cottage'

  const wallMat = createMat(wallTint, { roughness: 0.85 })
  const turfMat = createMat('#344c36', { roughness: 0.94 })
  const snowMat = createMat('#dce8f4', { roughness: 0.92 })
  const trimMat = createMat('#dde3eb', { roughness: 0.72 })
  const windowMat = createMat('#ffdc9a', { emissive: '#ffaa44', emissiveIntensity: 0.78 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(7.8, 3.2, 5.4), wallMat)
  body.position.y = 1.6
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.42, 6.0), turfMat)
    roof.position.set(side * 2.0, 3.85, 0)
    roof.rotation.z = -side * 0.46
    const snow = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.16, 5.9), snowMat)
    snow.position.set(side * 2.0, 4.12, 0)
    snow.rotation.z = -side * 0.46
    group.add(roof, snow)
  }

  for (const wx of [-2.2, 2.2]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.15, 0.14), trimMat)
    frame.position.set(wx, 1.7, 2.72)
    const pane = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.86, 0.18), windowMat)
    pane.position.set(wx, 1.7, 2.74)
    group.add(frame, pane)
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.18), trimMat)
  door.position.set(0, 1.05, 2.72)
  const glow = makeGlowSprite(glowTex, '#ffbd68', 2.6, 0.2)
  glow.position.set(2.2, 1.7, 3.1)
  group.add(door, glow)

  return group
}

/** Crystalline Jökulsárlón glacial iceberg with translucent cyan sub-surface glow. */
export function createGlacialIceberg(scale = 1, seed = 1): THREE.Group {
  const berg = new THREE.Group()
  berg.name = 'jokulsarlon-iceberg'

  const iceMat = createMat('#8be2f8', {
    emissive: '#1e6e96',
    emissiveIntensity: 0.42,
    roughness: 0.18,
    metalness: 0.15,
    flatShading: true,
  })
  const coreGeo = new THREE.DodecahedronGeometry(3.2 * scale, 1)
  const pos = coreGeo.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i)
    const vy = pos.getY(i)
    const vz = pos.getZ(i)
    const jag = 0.72 + 0.45 * Math.abs(Math.sin(vx * 0.9 + seed) * Math.cos(vz * 0.8 - seed))
    pos.setXYZ(i, vx * jag, vy > 0 ? vy * (0.85 + 0.5 * jag) : vy * 0.4, vz * jag)
  }
  coreGeo.computeVertexNormals()
  const main = new THREE.Mesh(coreGeo, iceMat)
  main.position.y = 0.4 * scale
  berg.add(main)

  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.4 * scale, 3.8 * scale, 5), iceMat)
  spire.position.set(-1.1 * scale, 1.8 * scale, 0.4 * scale)
  spire.rotation.z = 0.24
  berg.add(spire)

  return berg
}

/** Multi-segment sculpted Humpback Whale with pectoral fins & tail fluke. */
export function createSculptedWhale(): THREE.Group {
  const whale = new THREE.Group()
  whale.name = 'humpback-whale'
  const skinMat = createMat('#1f2f3f', { roughness: 0.48, metalness: 0.14 })
  const bellyMat = createMat('#8aa4b8', { roughness: 0.62 })

  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 5.2, 8, 16), skinMat)
  spine.rotation.z = Math.PI / 2
  spine.scale.set(1.0, 0.86, 0.92)
  whale.add(spine)

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 4.2, 6, 12), bellyMat)
  belly.rotation.z = Math.PI / 2
  belly.position.y = -0.26
  whale.add(belly)

  for (const side of [-1, 1]) {
    const flipper = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 3.6), skinMat)
    flipper.position.set(0.4, -0.35, side * 1.9)
    flipper.rotation.y = side * 0.42
    flipper.rotation.x = side * 0.12
    whale.add(flipper)
  }

  const fluke = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 3.2), skinMat)
  fluke.position.set(-3.4, 0.15, 0)
  fluke.rotation.z = 0.14
  whale.add(fluke)

  return whale
}
