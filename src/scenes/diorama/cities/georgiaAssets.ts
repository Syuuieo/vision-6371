import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface GeorgiaPalette {
  tuffStone: THREE.MeshStandardMaterial
  slateRoof: THREE.MeshStandardMaterial
  granite: THREE.MeshStandardMaterial
  brass: THREE.MeshStandardMaterial
  candleGlow: THREE.MeshStandardMaterial
  fireEmber: THREE.MeshStandardMaterial
}

export function createGeorgiaPalette(textures: DioramaTextures): GeorgiaPalette {
  return {
    tuffStone: applyPbrSet(
      createMat('#b8ab98', { roughness: 0.86, bumpMap: textures.darkStoneTex, bumpScale: 0.045 }),
      'limestone',
      3,
      3,
    ),
    slateRoof: applyPbrSet(
      createMat('#2a313a', { roughness: 0.62, metalness: 0.08 }),
      'slate',
      3,
      3,
    ),
    granite: applyPbrSet(
      createMat('#646a70', { roughness: 0.9, bumpMap: textures.darkStoneTex, bumpScale: 0.05 }),
      'cobble',
      3,
      2,
    ),
    brass: createMat('#eab95a', { roughness: 0.28, metalness: 0.82 }),
    candleGlow: createMat('#ffd994', { emissive: '#ff9634', emissiveIntensity: 0.64, roughness: 0.38 }),
    fireEmber: createMat('#ffba62', { emissive: '#ff6c22', emissiveIntensity: 1.2, roughness: 0.45 }),
  }
}

/** 1:1 格鲁吉亚圣三一石砌修道院与独立钟楼 (Gergeti-style cross-in-square stone basilica + conical drum spire + arched bell tower). */
export function createTrinitySanctuary(palette: GeorgiaPalette, glowTex: THREE.Texture) {
  const sanctuary = new THREE.Group()
  sanctuary.name = 'georgia-trinity-sanctuary'
  const halos: THREE.Sprite[] = []

  // Dressed stone terrace platform
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(19, 1.4, 15.5), palette.granite)
  plinth.position.y = 0.7
  sanctuary.add(plinth)

  // Cross-in-square church nave & transept volumes
  const nave = new THREE.Mesh(new THREE.BoxGeometry(13.5, 7.6, 8.2), palette.tuffStone)
  nave.position.y = 5.2
  const transept = new THREE.Mesh(new THREE.BoxGeometry(7.8, 8.2, 12.0), palette.tuffStone)
  transept.position.y = 5.5
  sanctuary.add(nave, transept)

  // Gabled slate roofs over cross arms
  const addGableCap = (w: number, d: number, y: number, rotY = 0) => {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.68, 2.4, 4), palette.slateRoof)
    cap.rotation.y = Math.PI / 4 + rotY
    cap.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d))
    cap.position.y = y
    sanctuary.add(cap)
  }
  addGableCap(14.6, 9.2, 10.1)
  addGableCap(8.6, 13.0, 10.6)

  // Narrow glowing stained arched lancet windows
  const winGlows: THREE.Mesh[] = []
  for (const [wx, wy, wz, ry] of [
    [-2.4, 5.8, 6.08, 0],
    [2.4, 5.8, 6.08, 0],
    [0, 6.0, -6.08, Math.PI],
    [6.82, 5.8, 0, Math.PI / 2],
    [-6.82, 5.8, 0, -Math.PI / 2],
  ] as [number, number, number, number][]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.5, 0.25), palette.candleGlow)
    w.position.set(wx, wy, wz)
    w.rotation.y = ry
    sanctuary.add(w)
    winGlows.push(w)
  }

  // Tall 12-faceted central stone drum + iconic steep conical slate spire + Georgian Grapevine Cross
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.55, 6.2, 12), palette.tuffStone)
  drum.position.y = 12.6
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.4, 0.25), palette.candleGlow)
    slit.position.set(Math.cos(a) * 2.46, 12.8, Math.sin(a) * 2.46)
    slit.rotation.y = -a + Math.PI / 2
    sanctuary.add(slit)
    winGlows.push(slit)
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.95, 5.6, 12), palette.slateRoof)
  spire.position.y = 18.4
  const crossV = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), palette.brass)
  crossV.position.y = 22.0
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.14), palette.brass)
  crossH.position.y = 22.3
  crossH.rotation.z = 0.08 // subtle St. Nino curved arms nod
  sanctuary.add(drum, spire, crossV, crossH)

  // Detached stone Bell Tower beside sanctuary + iron sanctuary fire brazier
  const bTower = new THREE.Group()
  bTower.position.set(-12.2, 0, 2.8)
  const bBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.2, 4.2), palette.granite)
  bBase.position.y = 2.6
  bTower.add(bBase)
  for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]] as const) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.8, 8), palette.tuffStone)
    col.position.set(px, 7.1, pz)
    bTower.add(col)
  }
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.1, 10), palette.brass)
  bell.position.y = 7.4
  const bRoof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 2.8, 4), palette.slateRoof)
  bRoof.rotation.y = Math.PI / 4
  bRoof.position.y = 10.3
  bTower.add(bell, bRoof)

  // Sanctuary fire brazier bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.45, 0.8, 10), palette.slateRoof)
  bowl.position.set(-4.2, 1.8, 7.6)
  const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), palette.fireEmber)
  flame.position.set(-4.2, 2.45, 7.6)
  const halo = makeGlowSprite(glowTex, '#ffb658', 8.5, 0.34)
  halo.position.set(-4.2, 2.8, 7.6)
  halos.push(halo)

  const mainHalo = makeGlowSprite(glowTex, '#ffd08a', 14, 0.2)
  mainHalo.position.set(0, 7.2, 0)
  halos.push(mainHalo)

  sanctuary.add(bTower, bowl, flame, halo, mainHalo)
  return { sanctuary, halos, flame }
}

/** 1:1 斯瓦涅季古石碉楼 (Tapered medieval Svaneti Koshki stone watchtower with machicolation crown). */
export function createSvanWatchtower(palette: GeorgiaPalette, glowTex: THREE.Texture, height = 18.5) {
  const tower = new THREE.Group()
  tower.name = 'georgia-svan-watchtower'

  const baseW = 4.6
  const topW = 3.55
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(topW * 0.707, baseW * 0.707, height, 4),
    palette.granite,
  )
  shaft.rotation.y = Math.PI / 4
  shaft.position.y = height * 0.5
  tower.add(shaft)

  // Corbelled machicolation stone crown gallery
  const crown = new THREE.Mesh(new THREE.BoxGeometry(topW + 0.8, 2.1, topW + 0.8), palette.tuffStone)
  crown.position.y = height + 0.8
  const roof = new THREE.Mesh(new THREE.ConeGeometry((topW + 1.2) * 0.72, 2.6, 4), palette.slateRoof)
  roof.rotation.y = Math.PI / 4
  roof.position.y = height + 3.1
  tower.add(crown, roof)

  const winMat = palette.candleGlow
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, topW + 0.92), winMat)
  win.position.y = height + 0.75
  const winSide = new THREE.Mesh(new THREE.BoxGeometry(topW + 0.92, 1.35, 1.1), winMat)
  winSide.position.y = height + 0.75
  const halo = makeGlowSprite(glowTex, '#ffbe66', 6.5, 0.22)
  halo.position.y = height + 1.0
  tower.add(win, winSide, halo)

  return { tower, halo }
}

/** 1:1 格鲁吉亚十字圣碑 (Carved granite mountain prayer cross stele). */
export function createGeorgianCrossPillar(palette: GeorgiaPalette) {
  const grp = new THREE.Group()
  grp.name = 'georgia-stone-cross'
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.6), palette.granite)
  plinth.position.y = 0.35
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.4, 0.28), palette.tuffStone)
  stem.position.y = 1.9
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.36, 0.26), palette.tuffStone)
  bar.position.y = 2.45
  grp.add(plinth, stem, bar)
  return grp
}

/** 1:1 高加索乌什巴双子圣剑雪峰 (Dramatic twin razor-spire Ushba granite-and-ice massif, rising ~112 m). */
export function createSwordTwinPeaks(glowTex: THREE.Texture) {
  const massif = new THREE.Group()
  massif.name = 'horizon-mountains'
  massif.userData.horizonVariant = 'georgia'

  const WIDTH = 380
  const DEPTH = 185
  const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, 128, 64)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)

  const screeCol = new THREE.Color('#2c3932')
  const graniteCol = new THREE.Color('#4d5863')
  const iceSnowCol = new THREE.Color('#e8eff6')
  const alpenglowCol = new THREE.Color('#ffd6c4')
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i)
    const vz = pos.getZ(i)
    const fallZ = Math.max(0, 1 - Math.pow(Math.abs(vz) / (DEPTH * 0.48), 2.2))
    const fallX = Math.max(0, 1 - Math.pow(Math.abs(vx) / (WIDTH * 0.48), 2.4))

    // Left North Sword Spire (tall dramatic blade at x = -28, z = -12)
    const dLeft = Math.hypot((vx + 28) / 24, (vz + 8) / 26)
    const spireLeft = Math.max(0, (1 - Math.pow(dLeft, 0.72))) * 106

    // Right South Sword Spire (twin blade across glacial col at x = +20, z = 2)
    const dRight = Math.hypot((vx - 20) / 22, (vz - 2) / 24)
    const spireRight = Math.max(0, (1 - Math.pow(dRight, 0.74))) * 94

    // Connecting icy saddle col ridge + flanking Caucasus serrated shoulders
    const colRidge = Math.exp(-Math.pow((vx + 4) / 30, 2) - Math.pow((vz + 3) / 14, 2)) * 56
    const flanks =
      Math.exp(-Math.pow(vz / 38, 2)) *
      (Math.abs(Math.sin(vx * 0.042 + 0.6) * Math.cos(vz * 0.055)) * 42 +
        Math.abs(Math.sin(vx * 0.095 - 1.1)) * 18)

    const ridgeSeration = Math.abs(Math.sin(vx * 0.14 + vz * 0.11)) * 6.5 * Math.exp(-Math.pow(vx / 110, 2))
    const rawH = Math.max(spireLeft, spireRight, colRidge, flanks) + ridgeSeration
    const h = rawH * fallZ * fallX - (1 - fallZ * fallX) * 1.6
    pos.setY(i, h)

    if (h > 64) {
      tmp.copy(iceSnowCol).lerp(alpenglowCol, Math.min(1, (h - 64) / 36))
    } else if (h > 26) {
      tmp.copy(graniteCol).lerp(iceSnowCol, Math.min(1, (h - 26) / 28))
    } else {
      tmp.copy(screeCol).lerp(graniteCol, Math.max(0, Math.min(1, h / 26)))
    }
    col[i * 3] = tmp.r
    col[i * 3 + 1] = tmp.g
    col[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()

  const peakMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
  )
  peakMesh.position.set(0, -0.5, -148)
  massif.add(peakMesh)

  // Glowing Alpenglow crown halo nestled between the Twin Sword Spires
  const peakHalo = makeGlowSprite(glowTex, '#ffd1b8', 110, 0.24)
  peakHalo.position.set(-4, 78, -146)
  massif.add(peakHalo)

  return { massif, peakHalo }
}

/** 1:1 迪德戈里圣剑碑 (Colossal Didgori monumental medieval bronze-iron broadsword plunged vertically into the mountain ridge). */
export function createColossalSword(
  palette: GeorgiaPalette,
  glowTex: THREE.Texture,
  height = 22,
  tiltX = 0,
  tiltZ = 0,
) {
  const sword = new THREE.Group()
  sword.name = 'georgia-didgori-giant-sword'

  const steelMat = createMat('#565e68', { roughness: 0.28, metalness: 0.82 })
  const fullerMat = createMat('#c99c52', { roughness: 0.34, metalness: 0.78 })
  const runeGlowMat = createMat('#ffd38c', { emissive: '#ff9634', emissiveIntensity: 0.45, roughness: 0.32 })

  const bladeH = height * 0.72
  const bladeW = height * 0.068
  const guardY = bladeH

  // Four-sided diamond beveled broadsword blade plunging deep into hillside earth
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(bladeW * 0.65, bladeW * 0.95, bladeH, 4), steelMat)
  blade.rotation.y = Math.PI / 4
  blade.scale.set(1.0, 1, 0.34)
  blade.position.y = bladeH * 0.5 - 0.6
  sword.add(blade)

  // Central bronze fuller spine & glowing rune strip running up the blade axis
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(bladeW * 0.24, bladeH * 0.92, bladeW * 0.46), fullerMat)
  fuller.position.y = bladeH * 0.48
  const runeLine = new THREE.Mesh(new THREE.BoxGeometry(bladeW * 0.12, bladeH * 0.68, bladeW * 0.5), runeGlowMat)
  runeLine.position.y = bladeH * 0.54
  sword.add(fuller, runeLine)

  // Sculpted wide curved Georgian crossguard + central embossed bronze boss
  const guardW = height * 0.23
  const guard = new THREE.Mesh(new THREE.BoxGeometry(guardW, bladeW * 0.62, bladeW * 0.65), palette.brass)
  guard.position.y = guardY
  for (const side of [-1, 1]) {
    const quillon = new THREE.Mesh(new THREE.ConeGeometry(bladeW * 0.36, guardW * 0.18, 6), palette.brass)
    quillon.rotation.z = side * -Math.PI / 2
    quillon.position.set(side * (guardW * 0.54), guardY + 0.08, 0)
    sword.add(quillon)
  }
  const boss = new THREE.Mesh(new THREE.SphereGeometry(bladeW * 0.5, 10, 8), palette.brass)
  boss.scale.set(1, 1, 0.65)
  boss.position.y = guardY
  sword.add(guard, boss)

  // Fluted hilt grip & multifaceted octagonal pommel crown
  const gripH = height * 0.16
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(bladeW * 0.26, bladeW * 0.34, gripH, 8), steelMat)
  grip.position.y = guardY + gripH * 0.5
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(bladeW * 0.56, 0), palette.brass)
  pommel.position.y = guardY + gripH + bladeW * 0.42
  const halo = makeGlowSprite(glowTex, '#ffd086', height * 0.45, 0.14)
  halo.position.y = guardY
  sword.add(grip, pommel, halo)

  sword.rotation.set(tiltX, 0, tiltZ)
  return { sword, runeGlowMat, halo }
}
