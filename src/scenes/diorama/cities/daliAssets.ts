import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'

/** Builds a dense-eave square or octagonal Chongsheng Pagoda with overhanging slate tiers & warm arched niches. */
function buildDenseEavePagoda(
  height: number,
  baseWidth: number,
  tiers: number,
  octagonal: boolean,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  goldMat: THREE.Material,
  nicheMat: THREE.Material,
): THREE.Group {
  const pagoda = new THREE.Group()
  const tierH = (height * 0.86) / tiers

  // Stone lotus plinth
  const plinth = new THREE.Mesh(
    octagonal
      ? new THREE.CylinderGeometry(baseWidth * 0.62, baseWidth * 0.68, 2.2, 8)
      : new THREE.BoxGeometry(baseWidth * 1.18, 2.2, baseWidth * 1.18),
    wallMat,
  )
  plinth.position.y = 1.1
  pagoda.add(plinth)

  for (let t = 0; t < tiers; t += 1) {
    const frac = t / tiers
    const w = baseWidth * (1 - frac * 0.56)
    const y0 = 2.2 + t * tierH

    const core = new THREE.Mesh(
      octagonal
        ? new THREE.CylinderGeometry(w * 0.54, w * 0.58, tierH * 0.92, 8)
        : new THREE.BoxGeometry(w, tierH * 0.92, w),
      wallMat,
    )
    core.position.y = y0 + tierH * 0.46
    pagoda.add(core)

    // Wide overhanging upturned dark slate eave
    const eave = new THREE.Mesh(
      octagonal
        ? new THREE.CylinderGeometry(w * 0.52, w * 0.84, 0.72, 8)
        : new THREE.ConeGeometry(w * 0.86, 0.85, 4),
      roofMat,
    )
    if (!octagonal) eave.rotation.y = Math.PI / 4
    eave.position.y = y0 + tierH * 0.96
    pagoda.add(eave)

    // Warm backlit Buddha niche on front face of alternating tiers
    if (t % 2 === 0 && t < tiers - 1) {
      const niche = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.24, tierH * 0.52, 0.14),
        nicheMat,
      )
      niche.position.set(0, y0 + tierH * 0.45, (octagonal ? w * 0.56 : w * 0.5) + 0.04)
      pagoda.add(niche)
    }
  }

  // Golden gourd-and-spire finial
  const finialBase = 2.2 + tiers * tierH
  const orb = new THREE.Mesh(new THREE.SphereGeometry(baseWidth * 0.14, 10, 8), goldMat)
  orb.position.y = finialBase + 0.6
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(baseWidth * 0.12, height * 0.13, 10),
    goldMat,
  )
  spire.position.y = finialBase + height * 0.065 + 0.6
  pagoda.add(orb, spire)

  return pagoda
}

/** 崇圣寺三塔: 16-tier square Qianxun Pagoda + twin 10-tier octagonal side pagodas on stone temple stairs. */
export function createChongshengThreePagodas() {
  const group = new THREE.Group()
  group.name = 'chongsheng-three-pagodas'
  group.userData.heightsMeters = [56, 36, 36]

  const wallMat = createMat('#e5e0d4', { roughness: 0.86 })
  const roofMat = createMat('#343f46', { roughness: 0.72 })
  const stoneMat = createMat('#697178', { roughness: 0.88 })
  const goldMat = createMat('#e0b660', { roughness: 0.28, metalness: 0.78 })
  const nicheMat = createMat('#ffd386', { emissive: '#ffaa44', emissiveIntensity: 0.85 })

  // Temple courtyard terrace + grand stone steps descending into the foothills
  const upperTerrace = new THREE.Mesh(new THREE.BoxGeometry(42, 2.4, 18), stoneMat)
  upperTerrace.position.y = 1.2
  group.add(upperTerrace)
  for (let s = 0; s < 5; s += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 2.2), stoneMat)
    step.position.set(0, 2.0 - s * 0.45, 9.5 + s * 1.6)
    group.add(step)
  }

  const centerPagoda = buildDenseEavePagoda(56, 8.2, 16, false, wallMat, roofMat, goldMat, nicheMat)
  centerPagoda.position.set(0, 2.4, -1)
  const westPagoda = buildDenseEavePagoda(36, 5.4, 10, true, wallMat, roofMat, goldMat, nicheMat)
  westPagoda.position.set(-13.5, 2.4, 1.5)
  const eastPagoda = buildDenseEavePagoda(36, 5.4, 10, true, wallMat, roofMat, goldMat, nicheMat)
  eastPagoda.position.set(13.5, 2.4, 1.5)

  group.add(centerPagoda, westPagoda, eastPagoda)
  return group
}

/** High-detail Bai "Three-Wing & Screen-Wall" (三坊一照壁) courtyard with timber balcony, painted eaves & red lanterns. */
export function createOrnateBaiCourtyard(
  glowTex: THREE.Texture,
  opts: { width?: number; depth?: number; lanternMat?: THREE.MeshStandardMaterial } = {},
): THREE.Group {
  const width = opts.width ?? 15
  const depth = opts.depth ?? 12
  const group = new THREE.Group()
  group.name = 'bai-sanfang-yizhaobi'

  const wallMat = createMat('#ece8de', { roughness: 0.88 })
  const trimMat = createMat('#7a8488', { roughness: 0.82 })
  const roofMat = createMat('#344248', { roughness: 0.72 })
  const woodMat = createMat('#5a3924', { roughness: 0.78 })
  const latticeMat = createMat('#ffd994', { emissive: '#ffaa44', emissiveIntensity: 0.82 })
  const lanternMat = opts.lanternMat ?? createMat('#ff5d38', { emissive: '#ff3f1f', emissiveIntensity: 1.0 })
  const pavingMat = createMat('#676d68', { roughness: 0.9 })

  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), pavingMat)
  floor.position.set(0, 0.08, depth / 2)
  group.add(floor)

  const buildWing = (w: number, h: number, d: number, x: number, z: number, rotY = 0) => {
    const wing = new THREE.Group()
    wing.position.set(x, 0, z)
    wing.rotation.y = rotY
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
    body.position.y = h / 2
    wing.add(body)

    // Ink-wash eaves cornice band
    const frieze = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.45, d + 0.3), trimMat)
    frieze.position.y = h - 0.3
    wing.add(frieze)

    // Upturned pitched slate gable roof + ridge beam
    const roofGeo = new THREE.CylinderGeometry(0.12, Math.SQRT1_2, 1.8, 4)
    roofGeo.rotateY(Math.PI / 4)
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.scale.set(w + 1.2, 1, d + 1.1)
    roof.position.y = h + 0.9
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.24, 0.24), trimMat)
    ridge.position.y = h + 1.75
    wing.add(roof, ridge)

    // Two-story timber veranda & warm lattice windows facing courtyard
    const verandaDepth = 0.7
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.14, verandaDepth), woodMat)
    deck.position.set(0, h * 0.48, d / 2 + verandaDepth / 2)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.55, 0.08), woodMat)
    rail.position.set(0, h * 0.48 + 0.32, d / 2 + verandaDepth - 0.05)
    wing.add(deck, rail)

    for (const fy of [1.5, h * 0.48 + 1.2]) {
      for (let i = -1; i <= 1; i += 1) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, 1.35, 0.1), latticeMat)
        win.position.set(i * w * 0.26, fy, d / 2 + 0.05)
        wing.add(win)
      }
    }

    for (const lx of [-w * 0.34, w * 0.34]) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), lanternMat)
      lantern.position.set(lx, h - 0.75, d / 2 + 0.65)
      wing.add(lantern)
    }

    group.add(wing)
  }

  // Main rear hall (正房) + East & West side wings (东西厢房)
  buildWing(width * 0.66, 6.4, depth * 0.34, 0, depth * 0.78, Math.PI)
  buildWing(depth * 0.5, 4.8, width * 0.22, -width * 0.38, depth * 0.44, Math.PI / 2)
  buildWing(depth * 0.5, 4.8, width * 0.22, width * 0.38, depth * 0.44, -Math.PI / 2)

  // Front Bai whitewashed Screen Wall (照壁) + slate gable cap + red gate lanterns
  const screenWall = new THREE.Mesh(new THREE.BoxGeometry(width * 0.54, 3.6, 0.55), wallMat)
  screenWall.position.set(0, 1.8, 0.35)
  const screenCap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.4, 0.85), roofMat)
  screenCap.position.set(0, 3.7, 0.35)
  const screenInlay = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, 1.8, 0.6), trimMat)
  screenInlay.position.set(0, 2.0, 0.35)
  const halo = makeGlowSprite(glowTex, '#ff8548', 3.4, 0.28)
  halo.position.set(0, 2.8, 1.0)
  group.add(screenWall, screenCap, screenInlay, halo)

  return group
}

/** Lakeside Bai Double-Eave Octagonal Tea Pavilion (洱海望月水榭). */
export function createErhaiPavilion(glowTex: THREE.Texture) {
  const pav = new THREE.Group()
  pav.name = 'erhai-octagonal-pavilion'
  const woodMat = createMat('#5e3824', { roughness: 0.78 })
  const roofMat = createMat('#2f3d44', { roughness: 0.7 })
  const stoneMat = createMat('#8a908d', { roughness: 0.88 })
  const goldMat = createMat('#dfba6c', { roughness: 0.3, metalness: 0.72 })
  const lanternMat = createMat('#ff944d', { emissive: '#ff6f28', emissiveIntensity: 0.95 })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.2, 1.85, 8), stoneMat)
  base.position.y = -0.925
  pav.add(base)

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.1, 10), woodMat)
    col.position.set(Math.cos(a) * 4.5, 2.05, Math.sin(a) * 4.5)
    pav.add(col)
  }

  const lowerRoof = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 6.4, 1.6, 8), roofMat)
  lowerRoof.position.y = 4.6
  const upperDrum = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 1.2, 8), woodMat)
  upperDrum.position.y = 5.6
  const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.0, 8), roofMat)
  upperRoof.position.y = 7.0
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), goldMat)
  finial.position.y = 8.1
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), lanternMat)
  lantern.position.y = 3.55
  const glow = makeGlowSprite(glowTex, '#ffae5a', 5.2, 0.45)
  glow.position.y = 3.55
  const pt = new THREE.PointLight('#ffac5c', 2.4, 18, 1.6)
  pt.position.y = 3.4
  pav.add(lowerRoof, upperDrum, upperRoof, finial, lantern, glow, pt)

  return { pav, lanternMat, pt }
}

/** Cluster of Erhai lakeshore cattail reeds. */
export function createShoreReedClump(seed = 1): THREE.Group {
  const clump = new THREE.Group()
  const reedMat = createMat('#435c3e', { roughness: 0.9 })
  const headMat = createMat('#5b412c', { roughness: 0.92 })
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + seed
    const h = 1.4 + (i % 3) * 0.45
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, h, 5), reedMat)
    stalk.position.set(Math.cos(angle) * 0.35, h / 2, Math.sin(angle) * 0.35)
    stalk.rotation.z = Math.cos(angle) * 0.14
    const cattail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.35, 6), headMat)
    cattail.position.set(Math.cos(angle) * 0.42, h - 0.12, Math.sin(angle) * 0.42)
    clump.add(stalk, cattail)
  }
  return clump
}
