import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'

/** Detailed Russian-Byzantine St. Sophia Cathedral with kokoshnik arches, brick portico, belfry towers & green onion domes. */
export function createOrnateSophiaCathedral(
  brickMat: THREE.Material,
  trimMat: THREE.Material,
  snowMat: THREE.Material,
) {
  const church = new THREE.Group()
  church.name = 'saint-sophia-cathedral'

  const domeGreenMat = createMat('#276857', { roughness: 0.36, metalness: 0.44 })
  const goldMat = createMat('#e0b862', { roughness: 0.28, metalness: 0.82 })
  const winMat = createMat('#ffd994', { emissive: '#ffaa44', emissiveIntensity: 0.72 })
  const darkIronMat = createMat('#20262e', { roughness: 0.46, metalness: 0.68 })
  const oakDoorMat = createMat('#4e2d1d', { roughness: 0.78 })

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    church.add(m)
    return m
  }

  // Greek-cross red-brick basilica nave + white stone foundation plinth & snow cornices
  box(23.5, 1.4, 15.5, 0, 0.7, 0, trimMat)
  box(15.5, 1.4, 23.5, 0, 0.7, 0, trimMat)
  box(22, 14.5, 14, 0, 8.2, 0, brickMat)
  box(14, 13.5, 22, 0, 7.7, 0, brickMat)
  box(22.8, 0.65, 14.8, 0, 15.6, 0, trimMat)
  box(14.8, 0.65, 22.8, 0, 14.6, 0, trimMat)
  box(22.4, 0.35, 14.4, 0, 16.05, 0, snowMat)

  // Arched Byzantine window mold shape
  const archShape = new THREE.Shape()
  archShape.moveTo(-0.72, -1.5)
  archShape.lineTo(0.72, -1.5)
  archShape.lineTo(0.72, 0.55)
  archShape.absarc(0, 0.55, 0.72, 0, Math.PI, false)
  archShape.lineTo(-0.72, -1.5)
  const archGeo = new THREE.ShapeGeometry(archShape, 12)

  // White brick Kokoshnik decorative scalloped arches under the roofline
  for (const sx of [-4.2, 0, 4.2]) {
    const kokoshnik = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.5, 14, 1, false, 0, Math.PI), trimMat)
    kokoshnik.rotation.z = Math.PI / 2
    kokoshnik.rotation.y = Math.PI / 2
    kokoshnik.position.set(sx, 16.1, 7.1)
    const backK = kokoshnik.clone()
    backK.position.z = -7.1
    church.add(kokoshnik, backK)
  }

  // Grand arched red-brick south portico entrance + recessed oak sanctuary doors + colonnade
  box(8.8, 6.2, 3.6, 0, 3.1, 10.6, brickMat)
  box(9.4, 0.55, 4.0, 0, 6.3, 10.6, trimMat)
  const porticoRoof = new THREE.Mesh(new THREE.ConeGeometry(6.6, 2.2, 4), domeGreenMat)
  porticoRoof.rotation.y = Math.PI / 4
  porticoRoof.scale.set(1.1, 1, 0.52)
  porticoRoof.position.set(0, 7.6, 10.6)
  church.add(porticoRoof)
  box(2.6, 3.8, 0.25, 0, 2.0, 12.4, oakDoorMat)
  const portalArch = new THREE.Mesh(archGeo, winMat)
  portalArch.scale.set(1.3, 0.9, 1)
  portalArch.position.set(0, 4.6, 12.44)
  church.add(portalArch)
  for (const cx of [-3.4, -1.9, 1.9, 3.4]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.2, 10), trimMat)
    col.position.set(cx, 2.6, 12.35)
    church.add(col)
  }

  // Facade lancet windows on 4 arms
  for (const side of [-1, 1]) {
    for (const colOffset of [-5.2, 0, 5.2]) {
      for (const rowY of [5.8, 9.6]) {
        const wFront = new THREE.Mesh(archGeo, winMat)
        wFront.position.set(colOffset, rowY, side * 11.08)
        wFront.rotation.y = side < 0 ? Math.PI : 0
        const wSide = wFront.clone()
        wSide.position.set(side * 11.08, rowY, colOffset)
        wSide.rotation.y = (side * Math.PI) / 2
        church.add(wFront, wSide)
      }
    }
  }

  // Central octagonal drum + 16 clerestory arch windows + golden-ribbed green onion dome
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 7.8, 4.6, 20), trimMat)
  drum.position.y = 17.8
  church.add(drum)
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2
    const dw = new THREE.Mesh(archGeo, winMat)
    dw.scale.setScalar(0.68)
    dw.position.set(Math.sin(angle) * 7.5, 17.8, Math.cos(angle) * 7.5)
    dw.rotation.y = angle
    church.add(dw)
  }

  const domePts: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16
    const r = Math.sin(Math.pow(t, 0.66) * Math.PI) * 7.6 * (1 - 0.14 * t)
    domePts.push(new THREE.Vector2(Math.max(0.04, r), 20.0 + t * 10.8))
  }
  const onion = new THREE.Mesh(new THREE.LatheGeometry(domePts, 28), domeGreenMat)
  onion.castShadow = true
  church.add(onion)
  for (let rib = 0; rib < 12; rib += 1) {
    const angle = (rib / 12) * Math.PI * 2
    const pts = domePts.map((p) => new THREE.Vector3(Math.sin(angle) * (p.x + 0.08), p.y, Math.cos(angle) * (p.x + 0.08)))
    const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.055, 4, false), goldMat)
    church.add(ribMesh)
  }

  const cross = new THREE.Group()
  const crossV = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.6, 8), goldMat)
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.16), goldMat)
  crossH.position.y = 0.55
  cross.add(crossV, crossH)
  cross.position.y = 32.0
  church.add(cross)

  // Four corner bell-towers with arched belfries & matching green onion cupolas
  for (const [cx, cz] of [
    [-8.6, -8.6],
    [8.6, -8.6],
    [-8.6, 8.6],
    [8.6, 8.6],
  ] as [number, number][]) {
    box(4.6, 16.5, 4.6, cx, 8.25, cz, brickMat)
    const belfry = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 2.2, 12), trimMat)
    belfry.position.set(cx, 17.6, cz)
    church.add(belfry)
    const smallPts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10
      const r = Math.sin(Math.pow(t, 0.68) * Math.PI) * 2.55 * (1 - 0.15 * t)
      smallPts.push(new THREE.Vector2(Math.max(0.03, r), 18.6 + t * 3.8))
    }
    const sOnion = new THREE.Mesh(new THREE.LatheGeometry(smallPts, 18), domeGreenMat)
    sOnion.position.set(cx, 0, cz)
    const sCross = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 6), goldMat)
    sCross.position.set(cx, 23.1, cz)
    church.add(sOnion, sCross)
  }

  // Interactive Stained-Glass Rose Window with crisp iron tracery spokes
  const roseMat = createMat('#e08e45', {
    emissive: '#d87628',
    emissiveIntensity: 0.48,
    side: THREE.DoubleSide,
  })
  const rose = new THREE.Mesh(new THREE.CircleGeometry(2.45, 32), roseMat)
  rose.name = 'rose-window'
  rose.position.set(0, 12.1, 11.12)
  const tracery = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.8, 32), darkIronMat)
  tracery.position.set(0, 12.1, 11.14)
  church.add(rose, tracery)
  for (let s = 0; s < 12; s += 1) {
    const a = (s / 12) * Math.PI * 2
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.4, 0.08), darkIronMat)
    bar.position.set(Math.sin(a) * 1.2, 12.1 + Math.cos(a) * 1.2, 11.16)
    bar.rotation.z = -a
    church.add(bar)
  }

  return { church, rose, roseMat }
}

/** Ornate Russian cast-iron octagonal snow-domed music gazebo (replaces flat gallery scaffold). */
export function createRussianMusicGazebo(glowTex: THREE.Texture) {
  const gazebo = new THREE.Group()
  gazebo.name = 'russian-music-gazebo'

  const graniteMat = createMat('#7b828a', { roughness: 0.85 })
  const ironMat = createMat('#1f262e', { roughness: 0.38, metalness: 0.78 })
  const domeMat = createMat('#276857', { roughness: 0.4, metalness: 0.42 })
  const snowMat = createMat('#e4eff8', { roughness: 0.92 })
  const lanternMat = createMat('#ffdc9a', { emissive: '#ffae4d', emissiveIntensity: 1.0 })

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 0.75, 8), graniteMat)
  plinth.position.y = 0.375
  gazebo.add(plinth)

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.8, 8), ironMat)
    col.position.set(Math.cos(a) * 4.3, 2.65, Math.sin(a) * 4.3)
    gazebo.add(col)
  }

  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.9, 0.35, 8), ironMat)
  cornice.position.y = 4.65
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), domeMat)
  dome.position.y = 4.8
  const snowCap = new THREE.Mesh(new THREE.SphereGeometry(4.56, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), snowMat)
  snowCap.position.y = 4.86
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.8, 8), lanternMat)
  spire.position.y = 7.75
  const chandelier = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), lanternMat)
  chandelier.position.y = 3.9
  const halo = makeGlowSprite(glowTex, '#ffd188', 5.5, 0.45)
  halo.position.y = 3.9
  const pt = new THREE.PointLight('#ffc778', 2.4, 18, 1.6)
  pt.position.y = 3.8
  gazebo.add(cornice, dome, snowCap, spire, chandelier, halo, pt)

  return { gazebo, lanternMat }
}

/** Cozy Harbin winter market wooden kiosk (热红酒雪夜木屋亭). */
export function createWinterMarketKiosk(glowTex: THREE.Texture): THREE.Group {
  const kiosk = new THREE.Group()
  kiosk.name = 'harbin-winter-kiosk'
  const logMat = createMat('#5c3c27', { roughness: 0.85 })
  const roofMat = createMat('#34404a', { roughness: 0.68 })
  const snowMat = createMat('#e8f1f8', { roughness: 0.92 })
  const winMat = createMat('#ffd58e', { emissive: '#ffaa44', emissiveIntensity: 0.92 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 3.2), logMat)
  body.position.y = 1.4
  kiosk.add(body)
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.24, 3.8), roofMat)
    roof.position.set(side * 1.2, 3.25, 0)
    roof.rotation.z = -side * 0.48
    const snow = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.14, 3.85), snowMat)
    snow.position.set(side * 1.25, 3.42, 0)
    snow.rotation.z = -side * 0.48
    kiosk.add(roof, snow)
  }
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.12), winMat)
  win.position.set(0, 1.6, 1.64)
  const halo = makeGlowSprite(glowTex, '#ffc676', 3.4, 0.3)
  halo.position.set(0, 1.6, 2.0)
  kiosk.add(win, halo)
  return kiosk
}

/** Soft organic layered snowy pine tree (replaces crude sharp triangle cones). */
export function createSnowyPineTree(scale = 1): THREE.Group {
  const tree = new THREE.Group()
  const trunkMat = createMat('#4a3728', { roughness: 0.94 })
  const needleMat = createMat('#253f2f', { roughness: 0.92, flatShading: true })
  const snowMat = createMat('#dde8f2', { roughness: 0.92 })

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.38 * scale, 3.2 * scale, 8), trunkMat)
  trunk.position.y = 1.6 * scale
  tree.add(trunk)

  for (let tier = 0; tier < 4; tier += 1) {
    const t = tier / 4
    const r = (2.4 - t * 1.25) * scale
    const y = (2.6 + tier * 1.55) * scale
    const bough = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), needleMat)
    bough.position.y = y
    bough.scale.set(1.0, 0.62, 1.0)
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.85, 1), snowMat)
    cap.position.y = y + 0.35 * scale
    cap.scale.set(0.95, 0.38, 0.95)
    tree.add(bough, cap)
  }
  return tree
}
