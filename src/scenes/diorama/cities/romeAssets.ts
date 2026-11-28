import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface RomePalette {
  travertine: THREE.MeshStandardMaterial
  tuffBrick: THREE.MeshStandardMaterial
  marble: THREE.MeshStandardMaterial
  arenaSand: THREE.MeshStandardMaterial
  bronze: THREE.MeshStandardMaterial
  darkIron: THREE.MeshStandardMaterial
  archGlow: THREE.MeshStandardMaterial
  torchGlow: THREE.MeshStandardMaterial
}

export function createRomePalette(textures: DioramaTextures): RomePalette {
  return {
    travertine: applyPbrSet(
      createMat('#d9c4a3', { roughness: 0.84, bumpMap: textures.darkStoneTex, bumpScale: 0.04 }),
      'limestone',
      3,
      3,
    ),
    tuffBrick: applyPbrSet(
      createMat('#8b6d56', { roughness: 0.9, map: textures.brickTex, bumpMap: textures.brickBump, bumpScale: 0.045 }),
      'cobble',
      3,
      2,
    ),
    marble: createMat('#eae3d5', { roughness: 0.42, metalness: 0.06, bumpMap: textures.plasterBump, bumpScale: 0.02 }),
    arenaSand: createMat('#cfa874', { roughness: 0.95, bumpMap: textures.plasterBump, bumpScale: 0.05 }),
    bronze: createMat('#8a6838', { roughness: 0.34, metalness: 0.78 }),
    darkIron: createMat('#2b2826', { roughness: 0.48, metalness: 0.7 }),
    archGlow: createMat('#ffcf84', { emissive: '#ff9e3d', emissiveIntensity: 0.62, roughness: 0.4 }),
    torchGlow: createMat('#ffe09e', { emissive: '#ff9632', emissiveIntensity: 0.82, roughness: 0.3 }),
  }
}

/** Creates a shared 3D semicircular Roman arcade bay (piers + molded archivolt rim + curved voussoir arch extrude). */
function createRomanArchBayGeometry(bayWidth: number, bayHeight: number, depth: number) {
  const halfW = bayWidth * 0.5
  const archR = bayWidth * 0.33
  const springY = bayHeight - archR - 0.92

  const shape = new THREE.Shape()
  shape.moveTo(-halfW, 0)
  shape.lineTo(-archR, 0)
  shape.lineTo(-archR, springY)
  shape.absarc(0, springY, archR, Math.PI, 0, true)
  shape.lineTo(archR, 0)
  shape.lineTo(halfW, 0)
  shape.lineTo(halfW, bayHeight)
  shape.lineTo(-halfW, bayHeight)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 14,
  })
  geo.translate(0, 0, -depth * 0.5)
  return geo
}

/** 1:1 罗马弗拉维圆形剧场 / 斗兽场 (Precision double-ring elliptical Colosseum with Valadier buttresses, fluted engaged pilasters, velarium corbels, marble cavea & half-decked hypogeum). */
export function createColosseum(palette: RomePalette, glowTex: THREE.Texture) {
  const colosseum = new THREE.Group()
  colosseum.name = 'rome-colosseum-1to1'

  const OUTER_RX = 46
  const OUTER_RZ = 37
  const MID_RX = 40.5
  const MID_RZ = 32.6
  const INNER_RX = 24.8
  const INNER_RZ = 19.4
  const BAYS = 48
  const bayGlowHalos: THREE.Sprite[] = []
  const archBulbs: THREE.Mesh[] = []

  // Two-stepped travertine elliptical stylobate plaza apron
  const stylobateOuter = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.45, 56), palette.travertine)
  stylobateOuter.scale.set(OUTER_RX + 4.4, 1, OUTER_RZ + 4.4)
  stylobateOuter.position.y = 0.225
  const stylobateInner = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.45, 56), palette.travertine)
  stylobateInner.scale.set(OUTER_RX + 2.4, 1, OUTER_RZ + 2.4)
  stylobateInner.position.y = 0.58
  colosseum.add(stylobateOuter, stylobateInner)

  // Deep underground hypogeum pit + sand-covered wooden eastern half-stage reconstruction
  const pitFloor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 48), palette.tuffBrick)
  pitFloor.scale.set(INNER_RX + 0.4, 1, INNER_RZ + 0.4)
  pitFloor.position.y = 0.1
  colosseum.add(pitFloor)

  const stageDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.25, 32, 1, false, 0, Math.PI),
    palette.arenaSand,
  )
  stageDeck.scale.set(INNER_RX + 0.1, 1, INNER_RZ + 0.1)
  stageDeck.position.y = 1.68
  colosseum.add(stageDeck)

  // Exposed Hypogeum concentric & axial brick lift-shaft walls (western half)
  for (let w = -18; w <= -2; w += 4.2) {
    const zSpan = Math.sqrt(Math.max(0.05, 1 - (w / (INNER_RX - 2)) ** 2)) * (INNER_RZ - 2.2) * 1.8
    const axialWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.55, zSpan), palette.tuffBrick)
    axialWall.position.set(w, 0.92, 0)
    colosseum.add(axialWall)
  }
  for (const hz of [-8.5, -3.2, 3.2, 8.5]) {
    const crossWall = new THREE.Mesh(new THREE.BoxGeometry(19.5, 1.5, 0.55), palette.tuffBrick)
    crossWall.position.set(-10.2, 0.9, hz)
    colosseum.add(crossWall)
  }

  // White marble Imperial Podium Wall enclosing the Arena + bronze safety balustrade
  const podiumSegs = 44
  for (let i = 0; i < podiumSegs; i += 1) {
    const a0 = (i / podiumSegs) * Math.PI * 2
    const a1 = ((i + 1) / podiumSegs) * Math.PI * 2
    const mid = (a0 + a1) * 0.5
    const nx = Math.cos(mid)
    const nz = Math.sin(mid)
    if (nz > 0.88 && Math.abs(nx) < 0.28) continue
    const len = Math.hypot(Math.cos(a1) * INNER_RX - Math.cos(a0) * INNER_RX, Math.sin(a1) * INNER_RZ - Math.sin(a0) * INNER_RZ) * 1.06
    const pWall = new THREE.Mesh(new THREE.BoxGeometry(len, 2.8, 1.15), palette.marble)
    pWall.position.set(Math.cos(mid) * (INNER_RX + 0.6), 1.6, Math.sin(mid) * (INNER_RZ + 0.6))
    pWall.rotation.y = Math.atan2(nx / INNER_RX, nz / INNER_RZ) + Math.PI / 2
    colosseum.add(pWall)
  }

  // Tiered stepped cavea seating bowl (marble lower tier + tuff-brick upper seating + radial vomitoria stair ribs)
  const tierSpecs = [
    { rx: 27.0, rz: 21.4, y: 2.5, w: 3.3, h: 1.6, mat: palette.marble },
    { rx: 30.6, rz: 24.2, y: 4.5, w: 3.6, h: 2.2, mat: palette.travertine },
    { rx: 34.4, rz: 27.3, y: 7.0, w: 3.8, h: 2.6, mat: palette.tuffBrick },
    { rx: 38.2, rz: 30.4, y: 10.1, w: 4.0, h: 3.1, mat: palette.tuffBrick },
  ]
  for (const t of tierSpecs) {
    const segs = 42
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2
      const nx = Math.cos(a)
      const nz = Math.sin(a)
      if (nz > 0.88 && Math.abs(nx) < 0.3) continue
      const nextA = ((i + 1) / segs) * Math.PI * 2
      const midA = (a + nextA) * 0.5
      const px = Math.cos(midA) * t.rx
      const pz = Math.sin(midA) * t.rz
      const stepLen = Math.hypot(
        Math.cos(nextA) * t.rx - Math.cos(a) * t.rx,
        Math.sin(nextA) * t.rz - Math.sin(a) * t.rz,
      ) * 1.06
      const seatBlock = new THREE.Mesh(new THREE.BoxGeometry(stepLen, t.h, t.w), t.mat)
      seatBlock.position.set(px, t.y, pz)
      seatBlock.rotation.y = Math.atan2(Math.cos(midA) / t.rx, Math.sin(midA) / t.rz) + Math.PI / 2
      colosseum.add(seatBlock)
    }
  }

  // Shared outer & inner arcade geometries (tangent-scaled per elliptical bay for zero seam gaps!)
  const tierHeights = [7.4, 7.0, 6.8]
  const bayGeoCache = tierHeights.map((h) => createRomanArchBayGeometry(5.6, h, 2.2))
  const innerBayGeoCache = tierHeights.slice(0, 2).map((h) => createRomanArchBayGeometry(4.9, h, 1.5))
  const corniceGeo = new THREE.BoxGeometry(5.9, 0.72, 2.65)
  const sillGeo = new THREE.BoxGeometry(5.85, 0.36, 2.45)
  const atticWallGeo = new THREE.BoxGeometry(5.65, 6.4, 1.75)
  const atticRecessGeo = new THREE.BoxGeometry(2.2, 2.4, 1.88)
  const pilasterGeo = new THREE.CylinderGeometry(0.28, 0.33, 1, 10)
  const capRingGeo = new THREE.CylinderGeometry(0.46, 0.3, 0.42, 8)
  const basePlinthGeo = new THREE.BoxGeometry(0.86, 0.42, 0.86)
  const corbelGeo = new THREE.BoxGeometry(0.32, 0.62, 0.48)
  const velariumPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.35, 6)
  const lightBoxGeo = new THREE.BoxGeometry(2.6, 0.45, 0.85)
  const radialVaultGeo = new THREE.BoxGeometry(0.9, 1.1, 5.8)

  for (let i = 0; i < BAYS; i += 1) {
    const a = (i / BAYS) * Math.PI * 2
    const nextA = ((i + 1) / BAYS) * Math.PI * 2
    const midA = (a + nextA) * 0.5
    const x0 = Math.cos(a) * OUTER_RX
    const z0 = Math.sin(a) * OUTER_RZ
    const x1 = Math.cos(nextA) * OUTER_RX
    const z1 = Math.sin(nextA) * OUTER_RZ
    const bayArcLen = Math.hypot(x1 - x0, z1 - z0) * 1.02

    const x = Math.cos(midA) * OUTER_RX
    const z = Math.sin(midA) * OUTER_RZ
    const tx = -Math.sin(midA) * OUTER_RX
    const tz = Math.cos(midA) * OUTER_RZ
    const rotY = Math.atan2(tx, tz) - Math.PI / 2

    const mx = Math.cos(midA) * MID_RX
    const mz = Math.sin(midA) * MID_RZ
    const midArcLen = Math.hypot(
      Math.cos(nextA) * MID_RX - Math.cos(a) * MID_RX,
      Math.sin(nextA) * MID_RZ - Math.sin(a) * MID_RZ,
    ) * 1.03

    // Leave front-center southern grand entrance bay completely open to walk straight into Arena!
    const isFrontPortal = z > 32 && Math.abs(x) < 4.5

    // Classic diagonal ruined outer wall silhouette: full 4-story north/west crown, stepped 2/3-story south-east curve
    let maxStories = 4
    if (z > 6 && x > -14) {
      const intactFactor = Math.max(0, Math.min(1, (-x + 28) / 56))
      maxStories = intactFactor > 0.72 ? 3 : 2
    } else if (z > -4 && x > 26) {
      maxStories = 3
    }

    const bayGroup = new THREE.Group()
    bayGroup.position.set(x, 0.72, z)
    bayGroup.rotation.y = rotY
    const fitScaleX = bayArcLen / 5.6

    let curY = 0
    for (let s = 0; s < Math.min(3, maxStories); s += 1) {
      const th = tierHeights[s]
      if (!(isFrontPortal && s === 0)) {
        const archMesh = new THREE.Mesh(bayGeoCache[s], palette.travertine)
        archMesh.scale.x = fitScaleX
        archMesh.position.y = curY
        bayGroup.add(archMesh)

        const cornice = new THREE.Mesh(corniceGeo, palette.travertine)
        cornice.scale.x = fitScaleX
        cornice.position.y = curY + th
        const sill = new THREE.Mesh(sillGeo, palette.marble)
        sill.scale.x = fitScaleX
        sill.position.y = curY + th + 0.38
        bayGroup.add(cornice, sill)

        // Engaged classical column + stone pedestal + flared Doric/Ionic/Corinthian capital
        const colX = (bayArcLen * 0.5) - 0.1
        const pil = new THREE.Mesh(pilasterGeo, palette.travertine)
        pil.scale.y = th - 0.65
        pil.position.set(colX, curY + th * 0.5, 1.15)
        const cBase = new THREE.Mesh(basePlinthGeo, palette.marble)
        cBase.position.set(colX, curY + 0.21, 1.15)
        const cCap = new THREE.Mesh(capRingGeo, palette.marble)
        cCap.position.set(colX, curY + th - 0.22, 1.15)
        bayGroup.add(pil, cBase, cCap)

        // Radial barrel-vault rib bridging outer facade to inner ring
        if (s < 2 && i % 2 === 0) {
          const rib = new THREE.Mesh(radialVaultGeo, palette.tuffBrick)
          rib.position.set(colX, curY + th - 0.45, -3.0)
          bayGroup.add(rib)
        }

        // Warm arch uplight inside every open travertine arcade bay
        if (i % 2 === 0 && s < 2) {
          const bulb = new THREE.Mesh(lightBoxGeo, palette.archGlow)
          bulb.position.set(0, curY + 0.36, 0.1)
          bayGroup.add(bulb)
          archBulbs.push(bulb)

          if (i % 4 === 0 && s === 0) {
            const halo = makeGlowSprite(glowTex, '#ffba66', 6.8, 0.22)
            halo.position.set(0, curY + 3.2, 0.5)
            bayGroup.add(halo)
            bayGlowHalos.push(halo)
          }
        }
      }
      curY += th + 0.48
    }

    if (maxStories === 4) {
      const attic = new THREE.Mesh(atticWallGeo, palette.travertine)
      attic.scale.x = fitScaleX
      attic.position.y = curY + 3.2
      const topCornice = new THREE.Mesh(corniceGeo, palette.marble)
      topCornice.scale.x = fitScaleX
      topCornice.position.y = curY + 6.55
      bayGroup.add(attic, topCornice)

      // Recessed square window aperture + bronze clipeus shield + velarium mast corbel & timber pole
      if (i % 2 === 0) {
        const winRecess = new THREE.Mesh(atticRecessGeo, palette.tuffBrick)
        winRecess.position.set(0, curY + 2.8, 0.05)
        bayGroup.add(winRecess)
      } else {
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.24, 12), palette.bronze)
        shield.rotation.x = Math.PI / 2
        shield.position.set(0, curY + 3.1, 0.96)
        bayGroup.add(shield)
      }

      // Paired flat Corinthian attic pilasters + 3 velarium pole corbel sockets along top edge
      const pAtt = new THREE.Mesh(pilasterGeo, palette.marble)
      pAtt.scale.set(0.85, 6.1, 0.55)
      pAtt.position.set((bayArcLen * 0.5) - 0.12, curY + 3.1, 0.94)
      bayGroup.add(pAtt)
      for (const cx of [-bayArcLen * 0.28, 0, bayArcLen * 0.28]) {
        const corb = new THREE.Mesh(corbelGeo, palette.travertine)
        corb.position.set(cx, curY + 5.15, 0.98)
        bayGroup.add(corb)
        if (i % 3 === 0 && cx === 0) {
          const mast = new THREE.Mesh(velariumPoleGeo, palette.tuffBrick)
          mast.position.set(cx, curY + 6.3, 1.05)
          bayGroup.add(mast)
        }
      }
    }

    colosseum.add(bayGroup)

    // Concentric secondary inner arcade ring (creates authentic layered corridor shadow depth!)
    const innerGroup = new THREE.Group()
    innerGroup.position.set(mx, 0.72, mz)
    innerGroup.rotation.y = rotY
    const innerScaleX = midArcLen / 4.9
    let inY = 0
    for (let s = 0; s < Math.min(2, maxStories); s += 1) {
      if (!(isFrontPortal && s === 0)) {
        const inArch = new THREE.Mesh(innerBayGeoCache[s], palette.tuffBrick)
        inArch.scale.x = innerScaleX
        inArch.position.y = inY
        innerGroup.add(inArch)
      }
      inY += tierHeights[s] + 0.48
    }
    colosseum.add(innerGroup)
  }

  // Stepped brick & travertine triangular buttress piers (Speroni Valadier / Stern) supporting the broken outer ends
  for (const [bx, bz, rotY] of [
    [-16.5, 34.4, -0.36],
    [29.5, 28.0, 0.62],
  ] as [number, number, number][]) {
    const buttress = new THREE.Group()
    buttress.position.set(bx, 0.72, bz)
    buttress.rotation.y = rotY
    for (let step = 0; step < 3; step += 1) {
      const bw = 3.2 - step * 0.65
      const bh = (step + 1) * 7.2
      const pier = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 2.3), palette.tuffBrick)
      pier.position.set(step * 1.4, bh * 0.5, 0)
      buttress.add(pier)
    }
    colosseum.add(buttress)
  }

  return {
    colosseum,
    bayGlowHalos,
    archBulbs,
    outerRx: OUTER_RX,
    outerRz: OUTER_RZ,
    innerRx: INNER_RX,
    innerRz: INNER_RZ,
  }
}

/** 1:1 君士坦丁凯旋门 (Triple-bay Roman triumphal arch with projecting Corinthian columns, attic reliefs & warm torches). */
export function createArchOfConstantine(palette: RomePalette, glowTex: THREE.Texture) {
  const arch = new THREE.Group()
  arch.name = 'rome-arch-of-constantine'
  const halos: THREE.Sprite[] = []

  // Stepped marble plinth blocks framing center & side portals
  const pierSpecs = [
    [-6.6, 2.2],
    [-3.1, 2.1],
    [3.1, 2.1],
    [6.6, 2.2],
  ] as const
  for (const [px, pw] of pierSpecs) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(pw, 9.4, 4.6), palette.marble)
    pier.position.set(px, 4.7, 0)
    arch.add(pier)

    for (const side of [-1, 1]) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 0.95), palette.marble)
      ped.position.set(px, 1.0, side * 2.55)
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 6.8, 12), palette.travertine)
      col.position.set(px, 5.4, side * 2.55)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.65, 0.95), palette.marble)
      cap.position.set(px, 9.0, side * 2.55)
      arch.add(ped, col, cap)
    }
  }

  // Central vaulted lintel + twin side arch lintels
  const centerBridge = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.6, 4.6), palette.marble)
  centerBridge.position.set(0, 8.1, 0)
  const leftBridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 4.6), palette.marble)
  leftBridge.position.set(-4.85, 7.5, 0)
  const rightBridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 4.6), palette.marble)
  rightBridge.position.set(4.85, 7.5, 0)
  arch.add(centerBridge, leftBridge, rightBridge)

  // Sculpted Attic story + inscribed travertine frieze + bronze cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.85, 5.4), palette.marble)
  cornice.position.y = 9.75
  const attic = new THREE.Mesh(new THREE.BoxGeometry(15.6, 4.0, 4.7), palette.travertine)
  attic.position.y = 12.1
  const topCrown = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.65, 5.2), palette.marble)
  topCrown.position.y = 14.3
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.2, 4.9), palette.marble)
  plaque.position.y = 12.2
  arch.add(cornice, attic, topCrown, plaque)

  // Torchlight sconces & warm bronze glow halos flanking central passage
  for (const sx of [-3.6, 3.6]) {
    const sconce = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.55, 8), palette.torchGlow)
    sconce.position.set(sx, 3.2, -2.4)
    const halo = makeGlowSprite(glowTex, '#ffc46e', 4.6, 0.26)
    halo.position.set(sx, 3.5, -2.5)
    arch.add(sconce, halo)
    halos.push(halo)
  }

  return { arch, halos }
}

/** 1:1 罗马墨达苏丹斯锥形喷泉与倒影池框 (Meta Sudans ancient conical brick fountain surrounded by marble basin rim). */
export function createMetaSudansFountain(palette: RomePalette, glowTex: THREE.Texture) {
  const grp = new THREE.Group()
  grp.name = 'rome-meta-sudans-fountain'

  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.75, 24), palette.marble)
  baseRing.position.y = 0.2
  const brickCone = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.35, 5.4, 18), palette.tuffBrick)
  brickCone.position.y = 2.9
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8), palette.travertine)
  crown.position.y = 5.65
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), palette.torchGlow)
  orb.position.y = 6.2
  const halo = makeGlowSprite(glowTex, '#ffd188', 6.5, 0.24)
  halo.position.y = 5.9
  grp.add(baseRing, brickCone, crown, orb, halo)

  return { fountain: grp, orb, halo }
}

/** 1:1 罗马伞松 (Mediterranean Pinus pinea umbrella stone pine with tall reddish trunk & wide flat layered canopy). */
export function createRomanUmbrellaPine(seedInit: number, scale = 1.0) {
  let seed = seedInit
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const pine = new THREE.Group()
  pine.name = 'rome-umbrella-pine'

  const barkMat = createMat('#5c3d2e', { roughness: 0.92 })
  const needleMats = [
    createMat('#2a4b2d', { roughness: 0.86, flatShading: true }),
    createMat('#345836', { roughness: 0.84, flatShading: true }),
    createMat('#223e27', { roughness: 0.88, flatShading: true }),
  ]

  const h = (11.5 + rand() * 3.5) * scale
  const leanX = (rand() - 0.5) * 1.3 * scale
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leanX * 0.4, h * 0.45, (rand() - 0.5) * 0.4),
    new THREE.Vector3(leanX, h * 0.88, (rand() - 0.5) * 0.5),
  ])
  pine.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 12, 0.34 * scale, 8, false), barkMat))

  const canopyY = h * 0.88
  const crownGroup = new THREE.Group()
  crownGroup.position.set(leanX, canopyY, 0)

  for (let b = 0; b < 5; b += 1) {
    const a = (b / 5) * Math.PI * 2 + rand() * 0.5
    const dist = (2.0 + rand() * 1.2) * scale
    const pad = new THREE.Mesh(new THREE.IcosahedronGeometry((1.85 + rand() * 0.55) * scale, 0), needleMats[b % 3])
    pad.position.set(Math.cos(a) * dist, (rand() - 0.3) * 0.55 * scale, Math.sin(a) * dist)
    pad.scale.set(1.55, 0.48, 1.45)
    pad.rotation.y = rand() * 3
    crownGroup.add(pad)
  }
  const topPad = new THREE.Mesh(new THREE.IcosahedronGeometry(2.65 * scale, 0), needleMats[1])
  topPad.position.y = 0.75 * scale
  topPad.scale.set(1.7, 0.46, 1.65)
  crownGroup.add(topPad)

  pine.add(crownGroup)
  return pine
}

/** 1:1 地中海丝柏 (Slender dark columnar Mediterranean cypress). */
export function createRomanCypress(height = 11.0, idx = 0) {
  const cyp = new THREE.Group()
  cyp.name = 'rome-cypress'
  const trunkMat = createMat('#473026', { roughness: 0.92 })
  const leafMat = createMat(idx % 2 === 0 ? '#1f3626' : '#27422e', { roughness: 0.9, flatShading: true })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, height * 0.25, 6), trunkMat)
  trunk.position.y = height * 0.125
  const spire = new THREE.Mesh(new THREE.ConeGeometry(height * 0.135, height * 0.86, 8), leafMat)
  spire.position.y = height * 0.56
  cyp.add(trunk, spire)
  return cyp
}
