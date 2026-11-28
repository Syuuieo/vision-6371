import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { createPerimeterFacadeTextures } from './cityKit'
import type { HaussmannTextures } from './parisAssets'

/** Russian Baroque Central-Street building for Harbin with stucco pilasters, arched shopfronts, corner onion cupola & snow-topped roof. */
export function createHarbinBaroqueBuilding(
  opts: {
    width?: number
    depth?: number
    floors?: number
    wallTint?: string
    domeTint?: string
    hasCornerCupola?: boolean
  } = {},
): THREE.Group {
  const width = opts.width ?? 17
  const depth = opts.depth ?? 13
  const floors = opts.floors ?? 3
  const groundH = 3.8
  const upperH = floors * 3.1
  const roofH = 2.8

  const group = new THREE.Group()
  group.name = 'harbin-baroque-building'

  const tex = createPerimeterFacadeTextures()
  const wallMat = tex
    ? new THREE.MeshStandardMaterial({
        color: opts.wallTint ?? '#8fa692',
        map: tex.map,
        emissive: new THREE.Color('#ffbe66'),
        emissiveMap: tex.emissiveMap,
        emissiveIntensity: 0.72,
        roughness: 0.82,
      })
    : createMat(opts.wallTint ?? '#8fa692', { roughness: 0.85 })

  const stuccoMat = createMat('#ece7dc', { roughness: 0.76 })
  const roofMat = createMat('#2f3844', { roughness: 0.62 })
  const snowMat = createMat('#e8f1f8', { roughness: 0.92 })
  const shopMat = createMat('#2b2024', { roughness: 0.6 })
  const shopWindowMat = createMat('#ffcf84', {
    emissive: '#ffaa4a',
    emissiveIntensity: 0.85,
    roughness: 0.22,
  })
  const domeMat = createMat(opts.domeTint ?? '#2d6d5c', { roughness: 0.38, metalness: 0.42 })
  const goldMat = createMat('#d8b268', { roughness: 0.28, metalness: 0.8 })

  // Ground-floor arched Central Street shopfront
  const ground = new THREE.Mesh(new THREE.BoxGeometry(width, groundH, depth), shopMat)
  ground.position.y = groundH / 2
  group.add(ground)

  const arches = Math.max(2, Math.floor(width / 4.4))
  for (let i = 0; i < arches; i += 1) {
    const ax = -width / 2 + 2.2 + i * ((width - 4.4) / Math.max(1, arches - 1))
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.4, depth + 0.12), shopWindowMat)
    win.position.set(arches === 1 ? 0 : ax, 1.55, 0)
    const archTrim = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.32, depth + 0.25), stuccoMat)
    archTrim.position.set(arches === 1 ? 0 : ax, 2.9, 0)
    group.add(win, archTrim)
  }

  // Upper stuccoed Baroque body
  const upper = new THREE.Mesh(new THREE.BoxGeometry(width, upperH, depth), wallMat)
  upper.position.y = groundH + upperH / 2
  group.add(upper)

  // White stucco corner pilasters & cornice bands
  for (const sx of [-width / 2 + 0.2, 0, width / 2 - 0.2]) {
    const pilaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, upperH + 0.2, depth + 0.24),
      stuccoMat,
    )
    pilaster.position.set(sx, groundH + upperH / 2, 0)
    group.add(pilaster)
  }
  for (const cy of [groundH + 0.15, groundH + upperH]) {
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.38, depth + 0.6), stuccoMat)
    cornice.position.y = cy
    group.add(cornice)
  }

  // Sloped Mansard roof + snow blanket cap
  const roofGeo = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.84, Math.SQRT1_2, roofH, 4)
  roofGeo.rotateY(Math.PI / 4)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.scale.set(width + 0.3, 1, depth + 0.3)
  roof.position.y = groundH + upperH + roofH / 2
  const snowCap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.28, depth * 0.72), snowMat)
  snowCap.position.y = groundH + upperH + roofH + 0.08
  group.add(roof, snowCap)

  // Signature Baroque corner turret cupola
  if (opts.hasCornerCupola) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 2.4, 12), stuccoMat)
    drum.position.set(-width * 0.32, groundH + upperH + roofH + 1.0, depth * 0.28)
    const domePts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10
      const r = Math.sin(Math.pow(t, 0.68) * Math.PI) * 1.55 * (1 - 0.15 * t)
      domePts.push(new THREE.Vector2(Math.max(0.03, r), t * 2.4))
    }
    const cupola = new THREE.Mesh(new THREE.LatheGeometry(domePts, 16), domeMat)
    cupola.position.set(-width * 0.32, groundH + upperH + roofH + 2.1, depth * 0.28)
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.4, 8), goldMat)
    spire.position.set(-width * 0.32, groundH + upperH + roofH + 5.0, depth * 0.28)
    group.add(drum, cupola, spire)
  }

  return group
}

/** Iconic Shanghai Bund Peace Hotel & Neoclassical Granite Heritage Building. */
export function createBundPeaceHotel(textures: HaussmannTextures): THREE.Group {
  const hotel = new THREE.Group()
  hotel.name = 'bund-peace-hotel'

  const graniteMat = new THREE.MeshStandardMaterial({
    color: '#d4c9b6',
    map: textures.facadeMap,
    emissive: new THREE.Color('#ffbe6b'),
    emissiveMap: textures.facadeEmissive,
    emissiveIntensity: 0.72,
    bumpMap: textures.facadeBump,
    bumpScale: 0.06,
    roughness: 0.78,
  })
  const baseMat = createMat('#5c5852', { roughness: 0.85 })
  const trimMat = createMat('#e5dccb', { roughness: 0.72 })
  const copperMat = createMat('#2e6c5e', { roughness: 0.36, metalness: 0.48 })
  const goldMat = createMat('#e6be6c', { emissive: '#c48f36', emissiveIntensity: 0.45, roughness: 0.28 })
  const shopWindowMat = createMat('#ffd38a', { emissive: '#ffb050', emissiveIntensity: 0.9 })

  // Ground-floor arched arcade
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(22, 4.4, 15), baseMat)
  plinth.position.y = 2.2
  hotel.add(plinth)
  for (let i = -2; i <= 2; i += 1) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 15.16), shopWindowMat)
    win.position.set(i * 4.0, 1.9, 0)
    hotel.add(win)
  }

  // Main stepped Art-Deco granite body
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(21, 16, 14), graniteMat)
  mainBody.position.y = 4.4 + 8
  hotel.add(mainBody)

  const setback = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 11), graniteMat)
  setback.position.y = 4.4 + 16 + 3
  hotel.add(setback)

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(21.8, 0.5, 14.8), trimMat)
  cornice.position.y = 20.4
  hotel.add(cornice)

  // Signature emerald-copper Peace Hotel pyramid spire!
  const pyramid = new THREE.Mesh(new THREE.ConeGeometry(6.8, 10.5, 4), copperMat)
  pyramid.rotation.y = Math.PI / 4
  pyramid.position.y = 4.4 + 16 + 6 + 5.25
  const spireRing = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.45, 11.6), goldMat)
  spireRing.position.y = 4.4 + 16 + 6
  hotel.add(pyramid, spireRing)

  return hotel
}

/** Steaming Iceland Blue Lagoon geothermal hot-spring pool ringed with volcanic basalt boulders. */
export function createGeothermalPool(glowTex: THREE.Texture): THREE.Group {
  const pool = new THREE.Group()
  pool.name = 'iceland-geothermal-lagoon'

  const basinMat = createMat('#1f262e', { roughness: 0.92, flatShading: true })
  const lagoonMat = createMat('#66e8f2', {
    emissive: '#38c8df',
    emissiveIntensity: 0.72,
    roughness: 0.15,
    metalness: 0.1,
  })
  const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.2, 0.25, 24), lagoonMat)
  waterDisc.position.y = 0.08
  pool.add(waterDisc)

  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2
    const r = 5.4 + (i % 3) * 0.45
    const boulder = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.95 + (i % 3) * 0.3, 0),
      basinMat,
    )
    boulder.position.set(Math.cos(angle) * r, 0.32, Math.sin(angle) * r * 0.78)
    boulder.scale.set(1.2, 0.65, 1.0)
    pool.add(boulder)
  }

  for (const [sx, sz] of [[-1.5, 0.5], [1.6, -0.8], [0, 1.2]]) {
    const steam = makeGlowSprite(glowTex, '#c8f8ff', 6.5, 0.24)
    steam.position.set(sx, 1.4, sz)
    pool.add(steam)
  }

  const pt = new THREE.PointLight('#64ebff', 2.4, 16, 1.6)
  pt.position.set(0, 1.5, 0)
  pool.add(pt)

  return pool
}

/** Moored Nordic wooden fishing boat with warm deck lantern for Iceland harbor. */
export function createNordicHarborBoat(glowTex: THREE.Texture): THREE.Group {
  const boat = new THREE.Group()
  boat.name = 'iceland-nordic-boat'
  const hullMat = createMat('#4a2d22', { roughness: 0.78 })
  const trimMat = createMat('#d8cfc0', { roughness: 0.7 })
  const deckMat = createMat('#6e513a', { roughness: 0.82 })
  const lanternMat = createMat('#ffe09c', { emissive: '#ffab44', emissiveIntensity: 1.1 })

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.9, 9.5, 8), hullMat)
  hull.rotation.z = Math.PI / 2
  hull.scale.z = 0.65
  hull.position.y = 0.25
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.7), trimMat)
  cabin.position.set(-0.6, 1.1, 0)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.9), deckMat)
  roof.position.set(-0.6, 1.85, 0)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), deckMat)
  mast.position.set(1.4, 2.2, 0)
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lanternMat)
  lantern.position.set(1.4, 3.6, 0)
  const halo = makeGlowSprite(glowTex, '#ffd080', 2.4, 0.42)
  halo.position.set(1.4, 3.6, 0)
  boat.add(hull, cabin, roof, mast, lantern, halo)
  return boat
}

/** Ornate Bai carved wooden archway (白族牌坊门楼) with upturned eaves & hanging red lanterns. */
export function createBaiGatehouse(glowTex: THREE.Texture): THREE.Group {
  const gate = new THREE.Group()
  gate.name = 'bai-village-archway'
  const pillarMat = createMat('#5c3c28', { roughness: 0.8 })
  const wallMat = createMat('#e8e4da', { roughness: 0.88 })
  const roofMat = createMat('#39464d', { roughness: 0.72 })
  const lanternMat = createMat('#ff5c38', { emissive: '#ff3d1f', emissiveIntensity: 1.1 })

  for (const px of [-3.2, 3.2]) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), wallMat)
    plinth.position.set(px, 0.3, 0)
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.8, 8), pillarMat)
    col.position.set(px, 2.7, 0)
    gate.add(plinth, col)
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.85, 0.65), wallMat)
  lintel.position.set(0, 4.3, 0)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.5, 4), roofMat)
  roof.rotation.y = Math.PI / 4
  roof.scale.set(1.3, 1, 0.42)
  roof.position.set(0, 5.4, 0)
  gate.add(lintel, roof)

  for (const lx of [-2.4, 2.4]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lanternMat)
    lantern.position.set(lx, 3.55, 0.35)
    const halo = makeGlowSprite(glowTex, '#ff7744', 2.4, 0.42)
    halo.position.set(lx, 3.55, 0.35)
    gate.add(lantern, halo)
  }

  return gate
}

/** Crisp architectural glass curtain-wall CanvasTexture for Lujiazui skyscrapers (replaces streaky barcode texture). */
export function createGlassSkyscraperTexture() {
  if (typeof document === 'undefined') return null
  const cCanvas = document.createElement('canvas')
  cCanvas.width = 256
  cCanvas.height = 512
  const eCanvas = document.createElement('canvas')
  eCanvas.width = 256
  eCanvas.height = 512
  const cCtx = cCanvas.getContext('2d')!
  const eCtx = eCanvas.getContext('2d')!

  cCtx.fillStyle = '#0d1b2e'
  cCtx.fillRect(0, 0, 256, 512)
  eCtx.fillStyle = '#000000'
  eCtx.fillRect(0, 0, 256, 512)

  const cols = 8
  const rows = 24
  const cw = 256 / cols
  const rh = 512 / rows
  for (let r = 0; r < rows; r += 1) {
    // Structural floor spandrel
    cCtx.fillStyle = '#182b44'
    cCtx.fillRect(0, r * rh, 256, 4)
    for (let c = 0; c < cols; c += 1) {
      const h = ((r * 17 + c * 31) % 19)
      const px = c * cw + 3
      const py = r * rh + 5
      const pw = cw - 6
      const ph = rh - 7
      if (h < 5) {
        cCtx.fillStyle = '#ffd796'
        cCtx.fillRect(px, py, pw, ph)
        eCtx.fillStyle = '#f5be6b'
        eCtx.fillRect(px, py, pw, ph)
      } else if (h === 6 || h === 7) {
        cCtx.fillStyle = '#7fc2eb'
        cCtx.fillRect(px, py, pw, ph)
        eCtx.fillStyle = '#4f9dd1'
        eCtx.fillRect(px, py, pw, ph)
      } else {
        cCtx.fillStyle = '#132640'
        cCtx.fillRect(px, py, pw, ph)
      }
    }
  }

  // Crisp vertical steel mullions
  cCtx.fillStyle = '#091220'
  eCtx.fillStyle = '#000000'
  for (let c = 0; c < cols; c += 1) {
    cCtx.fillRect(c * cw, 0, 2.5, 512)
    eCtx.fillRect(c * cw, 0, 2.5, 512)
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
