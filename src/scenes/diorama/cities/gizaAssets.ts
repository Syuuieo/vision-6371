import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface GizaPalette {
  limestone: THREE.MeshStandardMaterial
  pyramidCasing: THREE.MeshStandardMaterial
  smoothCasing: THREE.MeshStandardMaterial
  sandstone: THREE.MeshStandardMaterial
  granite: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  lapis: THREE.MeshStandardMaterial
  ember: THREE.MeshStandardMaterial
  runeGlow: THREE.MeshStandardMaterial
  palmTrunk: THREE.MeshStandardMaterial
  palmFrond: THREE.MeshStandardMaterial
}

function makeSeededRand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function createFallbackTex(r: number, g: number, b: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  tex.needsUpdate = true
  return tex
}

/** Procedural Egyptian weathered ashlar limestone block texture for Giza monuments. */
function createLimestoneMasonryTexture(): THREE.Texture {
  if (typeof document === 'undefined') return createFallbackTex(205, 170, 116)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const rand = makeSeededRand(299792)
    ctx.fillStyle = '#cda974'
    ctx.fillRect(0, 0, 512, 512)

    const rows = 16
    const rowH = 512 / rows
    for (let r = 0; r < rows; r += 1) {
      const y = r * rowH
      const offset = (r % 2) * 32
      let x = -offset
      while (x < 512) {
        const w = 44 + Math.floor(rand() * 34)
        const shade = (rand() - 0.5) * 26
        const rr = Math.min(240, Math.max(150, Math.round(212 + shade)))
        const gg = Math.min(220, Math.max(120, Math.round(174 + shade * 0.85)))
        const bb = Math.min(185, Math.max(85, Math.round(118 + shade * 0.65)))
        ctx.fillStyle = `rgb(${rr},${gg},${bb})`
        ctx.fillRect(x + 1, y + 1, w - 2, rowH - 2)

        // Subtle wind-eroded grain specks
        for (let k = 0; k < 6; k += 1) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(110,78,45,0.16)' : 'rgba(255,236,198,0.14)'
          ctx.fillRect(x + 3 + rand() * (w - 6), y + 3 + rand() * (rowH - 6), 3 + rand() * 5, 2)
        }
        x += w
      }
      // Horizontal course shadow seam
      ctx.fillStyle = 'rgba(92, 66, 38, 0.34)'
      ctx.fillRect(0, y, 512, 2)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.repeat.set(3, 3)
  return tex
}

/** Procedural Aswan pink granite & carved hieroglyphic central register for obelisks. */
function createObeliskHieroglyphTexture(): THREE.Texture {
  if (typeof document === 'undefined') return createFallbackTex(156, 114, 88)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const rand = makeSeededRand(1859)
    ctx.fillStyle = '#9c7258'
    ctx.fillRect(0, 0, 256, 1024)

    // Granite mineral flecks
    for (let i = 0; i < 2400; i += 1) {
      const pick = rand()
      ctx.fillStyle =
        pick < 0.34
          ? 'rgba(54,34,26,0.22)'
          : pick < 0.68
            ? 'rgba(218,166,132,0.2)'
            : 'rgba(164,108,82,0.22)'
      ctx.fillRect(rand() * 256, rand() * 1024, 2 + rand() * 3, 2 + rand() * 3)
    }

    // Recessed center vertical hieroglyphic register
    ctx.fillStyle = 'rgba(58, 38, 28, 0.32)'
    ctx.fillRect(88, 48, 80, 928)
    ctx.strokeStyle = 'rgba(214, 174, 102, 0.65)'
    ctx.lineWidth = 4
    ctx.strokeRect(92, 52, 72, 920)

    // Engraved Egyptian cartouches & symbols along the register
    ctx.fillStyle = 'rgba(222, 182, 104, 0.72)'
    ctx.strokeStyle = 'rgba(42, 26, 18, 0.7)'
    ctx.lineWidth = 2
    for (let y = 84; y < 940; y += 54) {
      const kind = Math.floor(rand() * 4)
      if (kind === 0) {
        // Oval royal cartouche
        ctx.beginPath()
        ctx.roundRect(108, y, 40, 34, 14)
        ctx.stroke()
        ctx.fillRect(122, y + 8, 12, 18)
      } else if (kind === 1) {
        // Ankh / scarab motif
        ctx.beginPath()
        ctx.arc(128, y + 10, 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillRect(116, y + 20, 24, 5)
        ctx.fillRect(125, y + 18, 6, 18)
      } else if (kind === 2) {
        // Sun disk & horizon wings
        ctx.beginPath()
        ctx.arc(128, y + 16, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(102, y + 28, 52, 4)
      } else {
        // Twin reed / falcon glyphs
        ctx.fillRect(110, y + 4, 8, 28)
        ctx.fillRect(126, y + 4, 20, 8)
        ctx.fillRect(126, y + 18, 14, 12)
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createGizaPalette(textures: DioramaTextures): GizaPalette {
  const masonryTex = createLimestoneMasonryTexture()
  const obeliskTex = createObeliskHieroglyphTexture()

  return {
    limestone: applyPbrSet(
      createMat('#d4b686', {
        map: masonryTex,
        roughness: 0.9,
        bumpMap: masonryTex,
        bumpScale: 0.08,
      }),
      'limestone',
      2,
      2,
    ),
    pyramidCasing: createMat('#d8ba8a', {
      map: masonryTex,
      roughness: 0.88,
      bumpMap: masonryTex,
      bumpScale: 0.09,
    }),
    smoothCasing: createMat('#ecdfc7', {
      roughness: 0.46,
      metalness: 0.03,
      bumpMap: textures.plasterBump,
      bumpScale: 0.015,
    }),
    sandstone: applyPbrSet(
      createMat('#c59862', { roughness: 0.91, bumpMap: textures.darkStoneTex, bumpScale: 0.045 }),
      'cobble',
      3,
      3,
    ),
    granite: createMat('#b3846a', {
      map: obeliskTex,
      roughness: 0.72,
      metalness: 0.08,
      bumpMap: obeliskTex,
      bumpScale: 0.03,
      emissive: '#8f5f24',
      emissiveIntensity: 0.06,
    }),
    gold: createMat('#eab94e', {
      roughness: 0.24,
      metalness: 0.88,
      emissive: '#946214',
      emissiveIntensity: 0.16,
    }),
    lapis: createMat('#203b5e', { roughness: 0.5, metalness: 0.16 }),
    ember: createMat('#ffbc58', { emissive: '#ff6c1c', emissiveIntensity: 1.35, roughness: 0.35 }),
    runeGlow: createMat('#d8a64c', {
      emissive: '#ffb84d',
      emissiveIntensity: 0.22,
      roughness: 0.38,
      metalness: 0.42,
    }),
    palmTrunk: createMat('#7a5b3e', { roughness: 0.95, bumpMap: textures.darkStoneTex, bumpScale: 0.06 }),
    palmFrond: createMat('#4b6c39', { roughness: 0.82, side: THREE.DoubleSide }),
  }
}

/**
 * 1:1 吉萨金字塔
 * Crisp 4-sided pyramid geometry with layered fine stepped limestone courses,
 * textured ashlar blocks, optional Khafre Tura smooth limestone cap, and gilded Pyramidion.
 */
export function createSteppedPyramid(
  palette: GizaPalette,
  glowTex: THREE.Texture,
  baseSize: number,
  height: number,
  hasSmoothCap = false,
) {
  const pyr = new THREE.Group()
  pyr.name = 'giza-great-pyramid'

  // True sharp-arrised 4-sided pyramid core (flat-shaded per face for strong sunlit/shadow face contrast)
  const coreRadius = baseSize * 0.7071
  const coreGeo = new THREE.ConeGeometry(coreRadius, height * 0.985, 4, 1)
  coreGeo.rotateY(Math.PI / 4)
  const coreMat = palette.pyramidCasing.clone()
  coreMat.flatShading = true
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.position.y = height * 0.985 * 0.5
  pyr.add(core)

  // Fine stepped limestone masonry ledges wrapping the slopes so edges show stepped stone strata
  const courses = Math.max(14, Math.round(height * 0.58))
  const maxStep = hasSmoothCap ? Math.floor(courses * 0.71) : courses - 2
  for (let i = 0; i < maxStep; i += 1) {
    const u = i / courses
    const w = baseSize * (1 - u) * 1.008
    const stepH = (height / courses) * 0.92
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, stepH, w), palette.pyramidCasing)
    slab.position.y = (i + 0.46) * (height / courses)
    pyr.add(slab)
  }

  // Smooth cream-ivory Tura limestone casing preserved on Khafre's upper 28%
  if (hasSmoothCap) {
    const capFrac = 0.705
    const capH = height * (1 - capFrac) * 0.98
    const capR = coreRadius * (1 - capFrac) * 1.015
    const capGeo = new THREE.ConeGeometry(capR, capH, 4)
    capGeo.rotateY(Math.PI / 4)
    const capMat = palette.smoothCasing.clone()
    capMat.flatShading = true
    const cap = new THREE.Mesh(capGeo, capMat)
    cap.position.y = height * capFrac + capH * 0.5
    pyr.add(cap)
  }

  // Subtle gilded Electrum Pyramidion capstone (small & refined, no blown-out haze)
  const tipH = height * 0.068
  const tipR = coreRadius * 0.068 * 1.04
  const tipGeo = new THREE.ConeGeometry(tipR, tipH, 4)
  tipGeo.rotateY(Math.PI / 4)
  const tip = new THREE.Mesh(tipGeo, palette.gold)
  tip.position.y = height - tipH * 0.45

  // Kept invisible at sunset until pyramid encounter awakens or deep night
  const halo = makeGlowSprite(glowTex, '#ffd584', baseSize * 0.24, 0.0)
  halo.position.y = height + 0.8
  pyr.add(tip, halo)

  return { pyramid: pyr, halo }
}

/**
 * 1:1 狮身人面像（斯芬克斯）
 * Sculpted crouching lion body with folded haunches, curled tail, outstretched paws,
 * flared Nemes headdress, weathered Pharaoh face, Dream Stele, and Horus fire brazier.
 */
export function createGreatSphinx(palette: GizaPalette, glowTex: THREE.Texture) {
  const sphinx = new THREE.Group()
  sphinx.name = 'giza-great-sphinx'

  // Weathered bedrock limestone sanctuary platform
  const bed = new THREE.Mesh(new THREE.BoxGeometry(10.8, 1.3, 25.5), palette.sandstone)
  bed.position.y = 0.65
  sphinx.add(bed)

  // Sculpted lion ribcage & arched spine
  const chest = new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.6, 8.2), palette.limestone)
  chest.position.set(0, 3.55, 0.2)
  const midBack = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.0, 6.8), palette.limestone)
  midBack.position.set(0, 3.25, -5.2)

  // Muscular crouching hindquarters & folded thighs
  const rump = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.95, 5.2, 10), palette.limestone)
  rump.rotation.z = Math.PI / 2
  rump.position.set(0, 3.3, -9.2)
  for (const side of [-1, 1]) {
    const haunch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.9, 5.8), palette.limestone)
    haunch.position.set(side * 2.5, 2.55, -7.8)
    const rearPaw = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.1, 3.2), palette.limestone)
    rearPaw.position.set(side * 2.75, 1.7, -4.6)
    sphinx.add(haunch, rearPaw)
  }

  // Curled lion tail sweeping around the right haunch
  const tailSegA = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.2, 8), palette.limestone)
  tailSegA.rotation.x = Math.PI / 2
  tailSegA.rotation.z = 0.35
  tailSegA.position.set(2.9, 1.9, -9.6)
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), palette.limestone)
  tailTip.position.set(3.5, 1.9, -7.5)
  sphinx.add(chest, midBack, rump, tailSegA, tailTip)

  // Extended crouching forepaws framing the Dream Stele
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 3.4), palette.limestone)
    shoulder.position.set(side * 2.25, 2.8, 4.0)
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.65, 7.6), palette.limestone)
    forearm.position.set(side * 2.15, 2.05, 8.2)
    const paw = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.15, 2.3), palette.limestone)
    paw.position.set(side * 2.15, 1.75, 12.1)
    sphinx.add(shoulder, forearm, paw)
  }

  // Dream Stele (red granite slab between the paws) + bronze Horus Brazier
  const stele = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.1, 0.55), palette.granite)
  stele.position.set(0, 2.85, 5.4)
  const steleTop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.55, 12, 1, false, 0, Math.PI), palette.granite)
  steleTop.rotation.z = Math.PI / 2
  steleTop.rotation.y = Math.PI / 2
  steleTop.position.set(0, 4.4, 5.4)

  const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.52, 1.05, 12), palette.lapis)
  brazier.position.set(0, 1.85, 9.2)
  const fire = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 0), palette.ember)
  fire.position.set(0, 2.6, 9.2)
  const fireHalo = makeGlowSprite(glowTex, '#ffae4c', 5.2, 0.22)
  fireHalo.position.set(0, 2.85, 9.2)
  sphinx.add(stele, steleTop, brazier, fire, fireHalo)

  // Sculpted Royal Pharaoh Head, Flared Nemes Lappets, Crown & Chin Beard
  const headGrp = new THREE.Group()
  headGrp.position.set(0, 7.25, 3.3)

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.25, 2.5, 10), palette.limestone)
  neck.position.y = -1.25

  // Flared Nemes headdress hood
  const nemes = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 3.25, 4.1, 6), palette.limestone)
  nemes.scale.set(1.22, 1, 0.86)
  nemes.position.set(0, 0.55, -0.35)

  // Left & right Nemes chest lappets draped forward onto shoulders
  for (const side of [-1, 1]) {
    const lappet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.6, 1.35), palette.limestone)
    lappet.rotation.z = side * -0.14
    lappet.rotation.x = -0.16
    lappet.position.set(side * 1.65, -0.85, 0.55)
    headGrp.add(lappet)
  }

  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.42, 6), palette.lapis)
  band.scale.set(1.23, 1, 0.87)
  band.position.set(0, 2.08, -0.35)

  // Carved face, cheekbones, weathered nose & royal beard base
  const face = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.95, 2.1), palette.limestone)
  face.position.set(0, 0.35, 0.78)
  const brow = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.42, 0.5), palette.limestone)
  brow.position.set(0, 1.18, 1.72)
  const cheek = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.45), palette.limestone)
  cheek.position.set(0, 0.25, 1.68)
  const chinBeard = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.25, 0.65), palette.sandstone)
  chinBeard.position.set(0, -1.2, 1.55)
  const uraeus = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 6), palette.gold)
  uraeus.position.set(0, 2.5, 1.48)

  headGrp.add(neck, nemes, band, face, brow, cheek, chinBeard, uraeus)
  sphinx.add(headGrp)

  return { sphinx, fire, fireHalo }
}

/**
 * 1:1 古埃及玫瑰花岗岩方尖碑
 * Refined tapering Aswan granite obelisk with carved hieroglyphic texture and gilded pyramidion tip
 * (no blown-out white neon light strips).
 */
export function createEgyptianObelisk(palette: GizaPalette, glowTex: THREE.Texture, height = 10.5) {
  const ob = new THREE.Group()
  ob.name = 'giza-obelisk'

  const baseLower = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.95, 2.7), palette.sandstone)
  baseLower.position.y = 0.475
  const baseUpper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.65, 2.05), palette.sandstone)
  baseUpper.position.y = 1.275

  const shaftH = height - 2.9
  const shaftGeo = new THREE.CylinderGeometry(0.46, 0.86, shaftH, 4)
  shaftGeo.rotateY(Math.PI / 4)
  const shaft = new THREE.Mesh(shaftGeo, palette.granite)
  shaft.position.y = 1.6 + shaftH * 0.5

  // Subtle inset gold-trimmed central relief bead (stays understated warm bronze at dusk)
  const inlayA = new THREE.Mesh(new THREE.BoxGeometry(0.14, shaftH * 0.72, 1.06), palette.runeGlow)
  inlayA.position.y = 1.6 + shaftH * 0.5
  const inlayB = new THREE.Mesh(new THREE.BoxGeometry(1.06, shaftH * 0.72, 0.14), palette.runeGlow)
  inlayB.position.y = 1.6 + shaftH * 0.5

  const tipGeo = new THREE.ConeGeometry(0.46, 1.35, 4)
  tipGeo.rotateY(Math.PI / 4)
  const tip = new THREE.Mesh(tipGeo, palette.gold)
  tip.position.y = height - 0.65

  const halo = makeGlowSprite(glowTex, '#ffd588', 2.8, 0.0)
  halo.position.y = height - 0.2
  ob.add(baseLower, baseUpper, shaft, inlayA, inlayB, tip, halo)

  return { obelisk: ob, halo }
}

/** 1:1 尼罗河椰枣树 (Curved ringed trunk + feathery arched palm frond crown & golden date clusters). */
export function createDatePalm(palette: GizaPalette, height = 7.4, leanAngle = 0.14) {
  const palm = new THREE.Group()
  palm.name = 'giza-date-palm'

  const segs = 7
  const segH = height / segs
  let curX = 0
  let curY = 0
  for (let i = 0; i < segs; i += 1) {
    const t = i / segs
    const rBot = THREE.MathUtils.lerp(0.32, 0.16, t)
    const rTop = THREE.MathUtils.lerp(0.28, 0.15, t)
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH * 1.12, 7), palette.palmTrunk)
    const angle = leanAngle * (0.4 + t * 0.9)
    seg.rotation.z = -angle
    curX += Math.sin(angle) * segH * 0.82
    curY += Math.cos(angle) * segH
    seg.position.set(curX, curY - segH * 0.5, 0)
    palm.add(seg)
  }

  const crown = new THREE.Group()
  crown.position.set(curX, curY, 0)

  // Golden date clusters beneath fronds
  for (let d = 0; d < 3; d += 1) {
    const a = (d * Math.PI * 2) / 3
    const dates = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 5), palette.gold)
    dates.rotation.x = Math.PI
    dates.position.set(Math.cos(a) * 0.35, -0.45, Math.sin(a) * 0.35)
    crown.add(dates)
  }

  // Arched segmented palm fronds
  const frondCount = 11
  for (let f = 0; f < frondCount; f += 1) {
    const yaw = (f / frondCount) * Math.PI * 2 + (f % 2) * 0.15
    const pitch = f % 3 === 0 ? 0.32 : 0.62
    const fGrp = new THREE.Group()
    fGrp.rotation.y = yaw

    const bladeA = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 2.2, 2, 3), palette.palmFrond)
    bladeA.rotation.x = Math.PI / 2 - pitch
    bladeA.position.set(0, Math.sin(pitch) * 0.95, Math.cos(pitch) * 1.05)

    const bladeB = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.9, 3), palette.palmFrond)
    bladeB.rotation.x = Math.PI / 2 + 0.25
    bladeB.scale.set(1.2, 1, 0.2)
    bladeB.position.set(0, Math.sin(pitch) * 1.45 - 0.38, Math.cos(pitch) * 2.0 + 0.72)

    fGrp.add(bladeA, bladeB)
    crown.add(fGrp)
  }

  palm.add(crown)
  return palm
}

/** 古埃及莲花柱石柱（替代现代白色围栏的谷庙砂岩立柱）。 */
export function createLotusPillar(palette: GizaPalette, height = 3.8) {
  const col = new THREE.Group()
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 1.15), palette.sandstone)
  plinth.position.y = 0.21
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, height - 1.15, 10), palette.sandstone)
  shaft.position.y = 0.42 + (height - 1.15) * 0.5
  const neckBand = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 10), palette.lapis)
  neckBand.position.y = height - 0.82
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.34, 0.72, 8), palette.sandstone)
  capital.position.y = height - 0.36
  col.add(plinth, shaft, neckBand, capital)
  return col
}
