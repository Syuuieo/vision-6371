import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface RapanuiPalette {
  tuff: THREE.MeshStandardMaterial
  basalt: THREE.MeshStandardMaterial
  scoria: THREE.MeshStandardMaterial
  coralEye: THREE.MeshStandardMaterial
  obsidian: THREE.MeshStandardMaterial
  flame: THREE.MeshStandardMaterial
}

export function createRapanuiPalette(textures: DioramaTextures): RapanuiPalette {
  return {
    tuff: applyPbrSet(
      createMat('#766e62', { roughness: 0.9, bumpMap: textures.darkStoneTex, bumpScale: 0.055 }),
      'cobble',
      2,
      3,
    ),
    basalt: applyPbrSet(
      createMat('#343940', { roughness: 0.86, bumpMap: textures.darkStoneTex, bumpScale: 0.045 }),
      'slate',
      3,
      2,
    ),
    scoria: createMat('#7a3e30', { roughness: 0.94, bumpMap: textures.plasterBump, bumpScale: 0.06 }),
    coralEye: createMat('#f4efe4', { emissive: '#ffdfaa', emissiveIntensity: 0.14, roughness: 0.3 }),
    obsidian: createMat('#12151a', { roughness: 0.18, metalness: 0.35 }),
    flame: createMat('#ffc068', { emissive: '#ff7024', emissiveIntensity: 1.25, roughness: 0.4 }),
  }
}

/** 1:1 拉帕努伊摩艾巨石像 (Sculpted volcanic tuff monolith with broad shoulders, heavy brow, aquiline nose, folded hands & weathered Pukao disc). */
export function createMoaiStatue(
  palette: RapanuiPalette,
  glowTex: THREE.Texture,
  height = 8.4,
  hasPukao = true,
) {
  const moai = new THREE.Group()
  moai.name = 'rapanui-moai-monolith'

  const s = height / 8.4

  // Broad rectangular sculpted basalt torso tapering upward + folded arms/hands across belly
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22 * s, 1.56 * s, 3.85 * s, 8),
    palette.tuff,
  )
  torso.scale.set(1.32, 1, 0.72)
  torso.position.y = 1.92 * s
  moai.add(torso)

  const chestRidge = new THREE.Mesh(new THREE.BoxGeometry(2.55 * s, 1.35 * s, 1.28 * s), palette.tuff)
  chestRidge.position.set(0, 2.75 * s, 0.28 * s)
  moai.add(chestRidge)

  for (const side of [-1, 1]) {
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(1.05 * s, 0.36 * s, 0.38 * s), palette.tuff)
    forearm.position.set(side * 0.64 * s, 1.05 * s, 0.98 * s)
    forearm.rotation.z = side * -0.16
    moai.add(forearm)
  }

  // Iconic elongated angular Moai head + pronounced jawline
  const headGroup = new THREE.Group()
  headGroup.position.set(0, 5.55 * s, 0.06 * s)
  headGroup.rotation.x = -0.05

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(2.12 * s, 3.85 * s, 1.75 * s), palette.tuff)
  headGroup.add(cranium)

  // Deeply overhanging brow ridge casting dramatic socket shadows
  const brow = new THREE.Mesh(new THREE.BoxGeometry(2.26 * s, 0.62 * s, 0.72 * s), palette.tuff)
  brow.position.set(0, 1.24 * s, 0.94 * s)
  brow.rotation.x = 0.14
  headGroup.add(brow)

  // Sculpted long aquiline nose + flared nostrils
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.44 * s, 2.0 * s, 4), palette.tuff)
  nose.rotation.y = Math.PI / 4
  nose.rotation.x = -0.18
  nose.position.set(0, 0.16 * s, 1.08 * s)
  const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.82 * s, 0.38 * s, 0.52 * s), palette.tuff)
  noseTip.position.set(0, -0.54 * s, 1.18 * s)
  headGroup.add(nose, noseTip)

  // Pursed austere lips & protruding chin edge
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.12 * s, 0.24 * s, 0.34 * s), palette.tuff)
  mouth.position.set(0, -1.1 * s, 0.98 * s)
  const chin = new THREE.Mesh(new THREE.BoxGeometry(1.88 * s, 0.64 * s, 0.48 * s), palette.tuff)
  chin.position.set(0, -1.62 * s, 0.85 * s)
  headGroup.add(mouth, chin)

  // Elongated pendant carved ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 1.9 * s, 0.56 * s), palette.tuff)
    ear.position.set(side * 1.15 * s, 0.05 * s, -0.05 * s)
    headGroup.add(ear)
  }

  // White coral & dark obsidian inset sacred eyes (Makamaka)
  const eyeMats: THREE.MeshStandardMaterial[] = []
  const eyeHalos: THREE.Sprite[] = []
  for (const side of [-1, 1]) {
    const scleraMat = palette.coralEye.clone()
    const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.46 * s, 0.28 * s, 0.12 * s), scleraMat)
    sclera.position.set(side * 0.52 * s, 0.72 * s, 0.87 * s)
    const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.14 * s, 8), palette.obsidian)
    pupil.rotation.x = Math.PI / 2
    pupil.position.set(side * 0.52 * s, 0.72 * s, 0.91 * s)
    const halo = makeGlowSprite(glowTex, '#ffe6b4', 1.9 * s, 0.0)
    halo.position.set(side * 0.52 * s, 0.72 * s, 1.05 * s)
    headGroup.add(sclera, pupil, halo)
    eyeMats.push(scleraMat)
    eyeHalos.push(halo)
  }

  // Authentic wide, weathered red scoria Pukao drum topknot (not a tall narrow cylinder hat)
  if (hasPukao) {
    const pukao = new THREE.Mesh(new THREE.CylinderGeometry(1.02 * s, 1.12 * s, 0.92 * s, 14), palette.scoria)
    pukao.position.set(0, 2.34 * s, -0.05 * s)
    const ridgeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.68 * s, 0.9 * s, 0.24 * s, 12), palette.scoria)
    ridgeCap.position.set(0, 2.86 * s, -0.05 * s)
    headGroup.add(pukao, ridgeCap)
  }

  moai.add(headGroup)
  return { moai, eyeMats, eyeHalos }
}

/** 1:1 阿胡通加里基海岸仪式石台 + 9 尊并肩摩艾巨石阵. */
export function createAhuTongarikiPlatform(palette: RapanuiPalette, glowTex: THREE.Texture) {
  const grp = new THREE.Group()
  grp.name = 'rapanui-ahu-tongariki'

  // Central basalt ceremonial stone seawall terrace (62 m wide) + sloped stone ramp apron
  const mainWall = new THREE.Mesh(new THREE.BoxGeometry(62, 2.8, 8.6), palette.basalt)
  mainWall.position.y = 1.4
  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(60, 0.45, 7.6), palette.tuff)
  upperDeck.position.y = 2.95
  const lowerApron = new THREE.Mesh(new THREE.BoxGeometry(66, 1.15, 13.5), palette.basalt)
  lowerApron.position.set(0, 0.55, 4.2)
  grp.add(mainWall, upperDeck, lowerApron)

  // Fitted megalithic wing masonry flanks
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(18, 1.8, 6.2), palette.basalt)
    wing.position.set(side * 39.5, 0.9, 0)
    grp.add(wing)
  }

  const eyeMats: THREE.MeshStandardMaterial[] = []
  const eyeHalos: THREE.Sprite[] = []
  const specs: [number, number, boolean][] = [
    [-25.5, 7.6, false],
    [-19.2, 8.8, true],
    [-12.8, 8.2, false],
    [-6.4, 9.6, true],
    [0, 10.6, true],
    [6.4, 9.3, false],
    [12.8, 8.7, true],
    [19.2, 8.0, false],
    [25.5, 7.5, true],
  ]

  for (const [mx, mh, hasPukao] of specs) {
    const { moai, eyeMats: em, eyeHalos: eh } = createMoaiStatue(palette, glowTex, mh, hasPukao)
    moai.position.set(mx, 3.1, 0)
    grp.add(moai)
    eyeMats.push(...em)
    eyeHalos.push(...eh)
  }

  return { ahu: grp, eyeMats, eyeHalos }
}

/** Foreground Tangata Manu (Birdman) volcanic stone fire altar circle + basalt torch steles. */
export function createBirdmanAltar(palette: RapanuiPalette, glowTex: THREE.Texture) {
  const altar = new THREE.Group()
  altar.name = 'rapanui-birdman-altar'
  const halos: THREE.Sprite[] = []
  const flames: THREE.Mesh[] = []

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.1, 0.55, 16), palette.basalt)
  ring.position.y = 0.275
  const hearth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.65, 12), palette.scoria)
  hearth.position.y = 0.55
  const centerFire = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), palette.flame)
  centerFire.position.y = 1.15
  const cHalo = makeGlowSprite(glowTex, '#ffb254', 7.5, 0.34)
  cHalo.position.y = 1.4
  altar.add(ring, hearth, centerFire, cHalo)
  flames.push(centerFire)
  halos.push(cHalo)

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const stele = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.3, 0.45), palette.basalt)
    stele.position.set(Math.cos(a) * 3.1, 1.15, Math.sin(a) * 3.1)
    stele.rotation.y = -a
    const torch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), palette.flame)
    torch.position.set(Math.cos(a) * 3.1, 2.52, Math.sin(a) * 3.1)
    const halo = makeGlowSprite(glowTex, '#ffbe66', 4.2, 0.24)
    halo.position.copy(torch.position)
    altar.add(stele, torch, halo)
    flames.push(torch)
    halos.push(halo)
  }

  return { altar, flames, halos }
}

/** Rano Raraku Volcanic Tuff Crater Ridge strictly west of Ahu Tongariki (zero overlap with center platform or sea). */
export function createRanoRarakuQuarry(palette: RapanuiPalette, glowTex: THREE.Texture) {
  const quarry = new THREE.Group()
  quarry.name = 'horizon-mountains'
  quarry.userData.horizonVariant = 'rapanui'

  const WIDTH = 115
  const DEPTH = 105
  const CENTER_X = -102
  const CENTER_Z = -6
  const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, 56, 48)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const grassCol = new THREE.Color('#445632')
  const tuffCol = new THREE.Color('#665c4a')
  const rimCol = new THREE.Color('#7d6f56')
  const cTmp = new THREE.Color()

  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i)
    const vz = pos.getZ(i)
    const fallX = Math.max(0, 1 - Math.pow(Math.abs(vx) / (WIDTH * 0.47), 2.2))
    const fallZ = Math.max(0, 1 - Math.pow(Math.abs(vz) / (DEPTH * 0.47), 2.2))

    const dCrater = Math.hypot(vx / 32, vz / 30)
    const mainPeak = Math.max(0, 1 - dCrater * 0.88) * 42
    const serration = Math.abs(Math.sin(vx * 0.08 + vz * 0.06)) * 8.5 + Math.abs(Math.cos(vx * 0.14 - vz * 0.11)) * 4.5
    const h = (mainPeak + serration * Math.max(0, 1 - dCrater)) * fallX * fallZ - (1 - fallX * fallZ) * 1.6
    pos.setY(i, h)

    if (h > 24) cTmp.copy(tuffCol).lerp(rimCol, Math.min(1, (h - 24) / 16))
    else cTmp.copy(grassCol).lerp(tuffCol, Math.max(0, Math.min(1, h / 24)))
    col[i * 3] = cTmp.r
    col[i * 3 + 1] = cTmp.g
    col[i * 3 + 2] = cTmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const slopeMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }),
  )
  slopeMesh.position.set(CENTER_X, -0.3, CENTER_Z)
  quarry.add(slopeMesh)

  // Tilted half-buried Moai quarry heads emerging cleanly on the Rano Raraku east flank (x = -58..-72)
  for (const [qx, qy, qz, rx, rz, ry] of [
    [-58, 4.5, -18, -0.22, 0.14, 1.05],
    [-64, 8.2, -10, -0.16, -0.18, 0.85],
    [-56, 3.8, -2, 0.18, 0.12, 1.15],
    [-68, 10.5, -24, -0.24, 0.08, 0.92],
  ] as [number, number, number, number, number, number][]) {
    const { moai } = createMoaiStatue(palette, glowTex, 7.6, false)
    moai.position.set(qx, qy - 2.4, qz)
    moai.rotation.set(rx, ry, rz)
    quarry.add(moai)
  }

  return quarry
}
