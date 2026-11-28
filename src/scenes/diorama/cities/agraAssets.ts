import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface TajPalette {
  marble: THREE.MeshStandardMaterial
  marbleTrim: THREE.MeshStandardMaterial
  sandstone: THREE.MeshStandardMaterial
  brass: THREE.MeshStandardMaterial
  darkRecess: THREE.MeshStandardMaterial
  warmGlow: THREE.MeshStandardMaterial
  diyaGlow: THREE.MeshStandardMaterial
}

export function createTajPalette(textures: DioramaTextures): TajPalette {
  return {
    marble: createMat('#f4ece2', {
      roughness: 0.3,
      metalness: 0.04,
      bumpMap: textures.plasterBump,
      bumpScale: 0.015,
    }),
    marbleTrim: createMat('#d8cbb9', {
      roughness: 0.45,
      metalness: 0.08,
      bumpMap: textures.plasterBump,
      bumpScale: 0.025,
    }),
    sandstone: applyPbrSet(
      createMat('#9c4a38', {
        roughness: 0.82,
        map: textures.brickTex,
        bumpMap: textures.brickBump,
        bumpScale: 0.04,
      }),
      'cobble',
      4,
      3,
    ),
    brass: createMat('#ebb95a', { roughness: 0.24, metalness: 0.85, emissive: '#a67222', emissiveIntensity: 0.2 }),
    darkRecess: createMat('#3d322c', { roughness: 0.88 }),
    warmGlow: createMat('#ffe0ab', { emissive: '#ffa44a', emissiveIntensity: 0.52, roughness: 0.36 }),
    diyaGlow: createMat('#ffd98c', { emissive: '#ff9632', emissiveIntensity: 0.85, roughness: 0.3 }),
  }
}

/** Shared Mughal pointed ogee Pishtaq iwan portal geometry (extruded frame with pointed arch cutout). */
function createMughalArchGeometry(width: number, height: number, depth: number) {
  const hw = width * 0.5
  const aw = width * 0.31
  const springY = height * 0.52
  const apexY = height * 0.82

  const shape = new THREE.Shape()
  shape.moveTo(-hw, 0)
  shape.lineTo(-aw, 0)
  shape.lineTo(-aw, springY)
  shape.quadraticCurveTo(-aw * 0.92, apexY * 0.88, 0, apexY)
  shape.quadraticCurveTo(aw * 0.92, apexY * 0.88, aw, springY)
  shape.lineTo(aw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(hw, height)
  shape.lineTo(-hw, height)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 10,
  })
  geo.translate(0, 0, -depth * 0.5)
  return geo
}

/** Mughal lotus bulbous onion dome + kalasha brass finial. */
function createOnionDome(radius: number, height: number, marbleMat: THREE.Material, brassMat: THREE.Material) {
  const dome = new THREE.Group()
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(radius * 0.92, 0),
    new THREE.Vector2(radius * 0.94, height * 0.22), // cylindrical drum
    new THREE.Vector2(radius * 1.1, height * 0.42), // iconic bulbous swell
    new THREE.Vector2(radius * 1.02, height * 0.62),
    new THREE.Vector2(radius * 0.68, height * 0.82),
    new THREE.Vector2(radius * 0.24, height * 0.95), // inverted lotus neck
    new THREE.Vector2(0.02, height),
  ]
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), marbleMat)
  dome.add(body)

  const lotusRing = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.26, height * 0.14, 12), marbleMat)
  lotusRing.rotation.x = Math.PI
  lotusRing.position.y = height * 0.97
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, height * 0.36, 10), brassMat)
  spire.position.y = height * 1.15
  const pot1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.11, 10, 8), brassMat)
  pot1.position.y = height * 1.06
  const pot2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.08, 10, 8), brassMat)
  pot2.position.y = height * 1.16
  dome.add(lotusRing, spire, pot1, pot2)
  return dome
}

/** Octagonal Chhatri open-pillar cupola pavilion. */
function createChhatri(radius: number, legH: number, palette: TajPalette) {
  const chhatri = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.05, radius * 1.08, 0.35, 8), palette.marble)
  base.position.y = 0.175
  chhatri.add(base)

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, legH, 8), palette.marble)
    p.position.set(Math.cos(a) * radius * 0.82, 0.35 + legH * 0.5, Math.sin(a) * radius * 0.82)
    chhatri.add(p)
  }
  const eave = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.24, 0.7, 8), palette.marbleTrim)
  eave.position.y = 0.35 + legH + 0.15
  const cupola = createOnionDome(radius * 0.82, radius * 1.35, palette.marble, palette.brass)
  cupola.position.y = 0.35 + legH + 0.35
  chhatri.add(eave, cupola)
  return chhatri
}

/** 1:1 白大理石三层八角宣礼塔 (Slender cylindrical white marble minaret with 3 balconies & crowning chhatri cupola). */
export function createTajMinaret(palette: TajPalette, glowTex: THREE.Texture) {
  const minaret = new THREE.Group()
  minaret.name = 'taj-mahal-minaret'

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 1.6, 8), palette.marble)
  plinth.position.y = 0.8
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 2.25, 25.5, 18), palette.marble)
  shaft.position.y = 14.35
  minaret.add(plinth, shaft)

  for (const by of [9.6, 18.0, 26.2]) {
    const t = by / 26.2
    const r = THREE.MathUtils.lerp(2.25, 1.48, t)
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.72, r + 0.42, 0.75, 16), palette.marbleTrim)
    balcony.position.y = by
    minaret.add(balcony)
  }

  const galleryGlow = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12), palette.warmGlow)
  galleryGlow.position.y = 28.0
  const crown = createChhatri(1.9, 3.2, palette)
  crown.position.y = 26.55
  const halo = makeGlowSprite(glowTex, '#ffd592', 7.5, 0.24)
  halo.position.y = 28.6
  minaret.add(galleryGlow, crown, halo)

  return { minaret, halo }
}

/** 1:1 泰姬陵主陵 (Makrana white marble plinth + central Pishtaq portal, 4 corner chhatris & lotus onion dome). */
export function createTajMausoleum(palette: TajPalette, glowTex: THREE.Texture) {
  const taj = new THREE.Group()
  taj.name = 'taj-mahal-mausoleum-1to1'
  const halos: THREE.Sprite[] = []

  // Outer red sandstone base platform (92 × 74 m)
  const sandPlatform = new THREE.Mesh(new THREE.BoxGeometry(92, 1.8, 74), palette.sandstone)
  sandPlatform.position.y = 0.9
  taj.add(sandPlatform)

  // Elevated Makrana gleaming white marble main plinth (66 × 66 m, y = 4.6 m top surface)
  const marblePlinth = new THREE.Mesh(new THREE.BoxGeometry(66, 3.4, 66), palette.marble)
  marblePlinth.position.y = 3.5
  const plinthTrim = new THREE.Mesh(new THREE.BoxGeometry(66.6, 0.45, 66.6), palette.marbleTrim)
  plinthTrim.position.y = 5.0
  taj.add(marblePlinth, plinthTrim)

  // South front grand stair steps up to the marble terrace
  for (let s = 0; s < 10; s += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.42, 1.05), palette.marbleTrim)
    step.position.set(0, 1.8 + s * 0.34, 37.5 - s * 0.5)
    taj.add(step)
  }

  const PLINTH_TOP = 5.2

  // Main chamfered octagonal sanctuary cube (35 × 35 m, height 21 m)
  const coreBody = new THREE.Mesh(new THREE.BoxGeometry(31.5, 20.5, 31.5), palette.marble)
  coreBody.position.y = PLINTH_TOP + 10.25
  const roofParapet = new THREE.Mesh(new THREE.BoxGeometry(34.8, 0.85, 34.8), palette.marbleTrim)
  roofParapet.position.y = PLINTH_TOP + 20.8
  taj.add(coreBody, roofParapet)

  // Chamfer diagonal corner walls with arched niches
  const chamferDiagGeo = createMughalArchGeometry(6.8, 18.2, 2.2)
  for (const [cx, cz, ry] of [
    [-14.8, 14.8, -Math.PI / 4],
    [14.8, 14.8, Math.PI / 4],
    [-14.8, -14.8, -Math.PI * 0.75],
    [14.8, -14.8, Math.PI * 0.75],
  ] as [number, number, number][]) {
    const corner = new THREE.Mesh(chamferDiagGeo, palette.marble)
    corner.position.set(cx, PLINTH_TOP, cz)
    corner.rotation.y = ry
    const insetGlow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 12.0, 0.6), palette.warmGlow)
    insetGlow.position.set(cx * 0.94, PLINTH_TOP + 7.2, cz * 0.94)
    insetGlow.rotation.y = ry
    taj.add(corner, insetGlow)
  }

  // 4 Grand Cardinal Pishtaq Iwans (deep recessed vaulted alcoves + pietre dure frieze bands + double stacked niches)
  const mainPishtaqGeo = createMughalArchGeometry(14.5, 23.2, 2.8)
  const sideNicheGeo = createMughalArchGeometry(6.6, 9.2, 1.5)
  const inlayBlue = createMat('#2f5d78', { roughness: 0.45, metalness: 0.12 })
  const inlayRed = createMat('#9c4434', { roughness: 0.55 })

  for (let d = 0; d < 4; d += 1) {
    const rotY = (d * Math.PI) / 2
    const face = new THREE.Group()
    face.rotation.y = rotY

    const pishtaq = new THREE.Mesh(mainPishtaqGeo, palette.marble)
    pishtaq.position.set(0, PLINTH_TOP, 16.5)

    // Deep recessed shadowed vault + carved inner lower sanctuary door & jali transom
    const iwanBack = new THREE.Mesh(new THREE.BoxGeometry(9.4, 18.8, 0.7), palette.darkRecess)
    iwanBack.position.set(0, PLINTH_TOP + 9.4, 14.9)
    const innerPortalFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 8.6, 0.9), palette.marbleTrim)
    innerPortalFrame.position.set(0, PLINTH_TOP + 4.3, 15.2)
    const innerDoorGlow = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6.2, 0.6), palette.warmGlow)
    innerDoorGlow.position.set(0, PLINTH_TOP + 3.1, 15.5)
    face.add(pishtaq, iwanBack, innerPortalFrame, innerDoorGlow)

    // Pietra Dura floral inlay border strips around main Pishtaq frame
    for (const bx of [-6.4, 6.4]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 22.0, 0.14), inlayBlue)
      strip.position.set(bx, PLINTH_TOP + 11.2, 17.92)
      face.add(strip)
    }
    const topFrieze = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.34, 0.14), inlayRed)
    topFrieze.position.set(0, PLINTH_TOP + 22.4, 17.92)
    face.add(topFrieze)

    // Left/Right flanking two-story pointed niche arches with deep shadowed interiors
    for (const sx of [-10.2, 10.2]) {
      for (const ny of [0, 9.8]) {
        const niche = new THREE.Mesh(sideNicheGeo, palette.marble)
        niche.position.set(sx, PLINTH_TOP + ny, 16.2)
        const nShadow = new THREE.Mesh(new THREE.BoxGeometry(4.1, 7.2, 0.45), palette.darkRecess)
        nShadow.position.set(sx, PLINTH_TOP + ny + 3.6, 15.4)
        const nGlow = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.8, 0.3), palette.warmGlow)
        nGlow.position.set(sx, PLINTH_TOP + ny + 2.4, 15.55)
        face.add(niche, nShadow, nGlow)
      }
      // Slender Pishtaq flanking guldasta pinnacle needle
      const pinnacle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 25.5, 8), palette.marbleTrim)
      pinnacle.position.set(sx * 0.72, PLINTH_TOP + 12.75, 17.6)
      const capOrb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), palette.brass)
      capOrb.position.set(sx * 0.72, PLINTH_TOP + 25.8, 17.6)
      face.add(pinnacle, capOrb)
    }

    // Perimeter marble dado & cornice railing along the 66×66 m terrace edge
    for (let b = -3; b <= 3; b += 1) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.05, 0.65), palette.marble)
      post.position.set(b * 8.2, PLINTH_TOP + 0.5, 32.5)
      if (b < 3) {
        const span = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.32, 0.3), palette.marbleTrim)
        span.position.set(b * 8.2 + 4.1, PLINTH_TOP + 0.75, 32.5)
        face.add(span)
      }
      face.add(post)
    }

    const halo = makeGlowSprite(glowTex, '#ffd592', 14, 0.2)
    halo.position.set(0, PLINTH_TOP + 6.5, 17.0)
    face.add(halo)
    halos.push(halo)

    taj.add(face)
  }

  // Hero Bulging Makrana Onion Lotus Dome (radius 10.8 m, height 22 m) + Inlaid Drum Ring + 4 Corner Chhatris
  const ROOF_Y = PLINTH_TOP + 21.1
  const mainDome = createOnionDome(10.8, 22.8, palette.marble, palette.brass)
  mainDome.position.y = ROOF_Y
  const drumBand = new THREE.Mesh(new THREE.CylinderGeometry(10.25, 10.25, 0.65, 28), inlayBlue)
  drumBand.position.y = ROOF_Y + 3.6
  const domeHalo = makeGlowSprite(glowTex, '#ffe2af', 28, 0.16)
  domeHalo.position.y = ROOF_Y + 12
  halos.push(domeHalo)
  taj.add(mainDome, drumBand, domeHalo)

  for (const [cx, cz] of [[-11.8, -11.8], [11.8, -11.8], [-11.8, 11.8], [11.8, 11.8]] as [number, number][]) {
    const ch = createChhatri(3.2, 4.4, palette)
    ch.position.set(cx, ROOF_Y, cz)
    taj.add(ch)
  }

  // 4 Symmetrical White Marble Minarets at Plinth Corners
  const minaretHalos: THREE.Sprite[] = []
  for (const [mx, mz] of [[-28.5, -28.5], [28.5, -28.5], [-28.5, 28.5], [28.5, 28.5]] as [number, number][]) {
    const { minaret, halo } = createTajMinaret(palette, glowTex)
    minaret.position.set(mx, PLINTH_TOP - 0.1, mz)
    taj.add(minaret)
    minaretHalos.push(halo)
  }

  return { taj, plinthTop: PLINTH_TOP, mainHalos: halos, minaretHalos }
}

/** Symmetric Red Sandstone Mosque (Masjid) / Guest House (Jawab) flanking the white marble Taj Mahal. */
export function createSandstonePavilion(palette: TajPalette, glowTex: THREE.Texture) {
  const grp = new THREE.Group()
  grp.name = 'taj-sandstone-mosque'

  const base = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 34), palette.sandstone)
  base.position.y = 1.1
  const hall = new THREE.Mesh(new THREE.BoxGeometry(15.5, 11.2, 30), palette.sandstone)
  hall.position.y = 7.8
  const trim = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.85, 30.6), palette.marble)
  trim.position.y = 13.6
  grp.add(base, hall, trim)

  const archGeo = createMughalArchGeometry(7.2, 9.8, 1.4)
  for (const az of [-9.5, 0, 9.5]) {
    const portal = new THREE.Mesh(archGeo, palette.sandstone)
    portal.scale.setScalar(az === 0 ? 1.15 : 0.82)
    portal.rotation.y = Math.PI / 2
    portal.position.set(8.2, 2.2, az)
    const portalGlow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 4.4), palette.warmGlow)
    portalGlow.position.set(7.6, 5.4, az)
    grp.add(portal, portalGlow)
  }

  for (const [dz, dr, dh] of [[-8.5, 3.2, 6.2], [0, 4.4, 8.6], [8.5, 3.2, 6.2]] as [number, number, number][]) {
    const d = createOnionDome(dr, dh, palette.marble, palette.brass)
    d.position.set(0, 13.9, dz)
    grp.add(d)
  }

  const halo = makeGlowSprite(glowTex, '#ffc676', 14, 0.22)
  halo.position.set(6, 7.5, 0)
  grp.add(halo)

  return { pavilion: grp, halo }
}

/** Yamuna River Mughal Wooden Skiff for rideAnchor. */
export function createYamunaSkiff(palette: TajPalette, glowTex: THREE.Texture) {
  const boat = new THREE.Group()
  boat.name = 'taj-yamuna-royal-skiff'

  const timber = createMat('#4b3224', { roughness: 0.85 })
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.78, 10.5, 8), timber)
  hull.rotation.z = Math.PI / 2
  hull.scale.z = 0.62
  hull.position.y = 0.28
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.16, 1.55), palette.marbleTrim)
  deck.position.y = 0.76
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.15, 4), palette.sandstone)
  canopy.rotation.y = Math.PI / 4
  canopy.position.set(-0.4, 2.65, 0)
  for (const [px, pz] of [[-1.1, -0.55], [0.3, -0.55], [-1.1, 0.55], [0.3, 0.55]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.45, 6), palette.brass)
    post.position.set(px, 1.55, pz)
    boat.add(post)
  }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.36, 8), palette.diyaGlow)
  lamp.position.set(3.2, 1.25, 0)
  const wake = makeGlowSprite(glowTex, '#ffd080', 5.2, 0.26)
  wake.position.set(3.2, 1.25, 0)

  boat.add(hull, deck, canopy, lamp, wake)
  return { boat, wake }
}
