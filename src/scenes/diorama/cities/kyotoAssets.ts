import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface KyotoPalette {
  vermilion: THREE.MeshStandardMaterial
  cedar: THREE.MeshStandardMaterial
  darkTimber: THREE.MeshStandardMaterial
  slateRoof: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  brass: THREE.MeshStandardMaterial
  shoji: THREE.MeshStandardMaterial
  warmFire: THREE.MeshStandardMaterial
  bronze: THREE.MeshStandardMaterial
}

export function createKyotoPalette(textures: DioramaTextures): KyotoPalette {
  return {
    vermilion: createMat('#b83328', { roughness: 0.48, bumpMap: textures.weatheredWoodTex, bumpScale: 0.025 }),
    cedar: createMat('#6a4532', { roughness: 0.78, map: textures.weatheredWoodTex, bumpMap: textures.weatheredWoodTex, bumpScale: 0.04 }),
    darkTimber: createMat('#2e231f', { roughness: 0.82, bumpMap: textures.weatheredWoodTex, bumpScale: 0.03 }),
    slateRoof: applyPbrSet(createMat('#2a323c', { roughness: 0.58, metalness: 0.08 }), 'slate', 4, 4),
    stone: applyPbrSet(createMat('#9b9b94', { roughness: 0.88, bumpMap: textures.darkStoneTex, bumpScale: 0.035 }), 'limestone', 3, 3),
    brass: createMat('#e5be6b', { roughness: 0.28, metalness: 0.8, emissive: '#b8832e', emissiveIntensity: 0.22 }),
    shoji: createMat('#ffe0ab', { emissive: '#ff9e42', emissiveIntensity: 0.56, roughness: 0.45 }),
    warmFire: createMat('#ffd99a', { emissive: '#ff9c3b', emissiveIntensity: 0.38, roughness: 0.35 }),
    bronze: createMat('#435e54', { emissive: '#2f453b', emissiveIntensity: 0.16, metalness: 0.66, roughness: 0.34 }),
  }
}

function addUpturnedTimberRoof(
  parent: THREE.Object3D,
  palette: KyotoPalette,
  width: number,
  depth: number,
  height: number,
  y: number,
  hangBells = false,
) {
  const g = new THREE.Group()
  g.position.y = y

  const underEave = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, 0.22, depth * 0.92),
    palette.darkTimber,
  )
  underEave.position.y = -0.08
  g.add(underEave)

  const bw = width * 0.5
  const bd = depth * 0.5
  const tw = bw * 0.38
  const td = bd * 0.38
  const verts = new Float32Array([
    -bw, 0, -bd, bw, 0, -bd, bw, 0, bd, -bw, 0, bd,
    -tw, height, -td, tw, height, -td, tw, height, td, -tw, height, td,
  ])
  const idx = [
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
    4, 7, 6, 4, 6, 5,
    0, 1, 2, 0, 2, 3,
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const hip = new THREE.Mesh(geo, palette.slateRoof)
  g.add(hip)

  // Upturned corner ridge brackets & optional corner wind-bells
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 4), palette.slateRoof)
    tip.position.set(cx * bw * 0.98, 0.18, cz * bd * 0.98)
    tip.rotation.y = Math.PI / 4
    tip.rotation.z = -cx * 0.68
    tip.rotation.x = cz * 0.68
    g.add(tip)

    if (hangBells) {
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 6), palette.brass)
      bell.position.set(cx * bw * 0.96, -0.18, cz * bd * 0.96)
      g.add(bell)
    }
  }

  parent.add(g)
  return g
}

/** 1:1 五重飞檐古木塔 (28 m 5-tier Yasaka/Higashiyama wooden pagoda with balconies, shoji screens & bronze sōrin spire). */
export function createFiveTierPagoda(palette: KyotoPalette, glowTex: THREE.Texture) {
  const pagoda = new THREE.Group()
  pagoda.name = 'kyoto-five-tier-pagoda'
  const halos: THREE.Sprite[] = []

  // Two-stepped dressed granite foundation terrace
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.9, 11.6), palette.stone)
  base1.position.y = 0.45
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.8, 9.6), palette.stone)
  base2.position.y = 1.3
  pagoda.add(base1, base2)

  const tiers = [
    { bodyW: 6.4, bodyH: 3.6, eaveW: 9.8, eaveH: 1.5 },
    { bodyW: 5.5, bodyH: 3.1, eaveW: 8.6, eaveH: 1.35 },
    { bodyW: 4.7, bodyH: 2.7, eaveW: 7.5, eaveH: 1.2 },
    { bodyW: 4.0, bodyH: 2.35, eaveW: 6.5, eaveH: 1.08 },
    { bodyW: 3.3, bodyH: 2.1, eaveW: 5.8, eaveH: 1.45 },
  ] as const

  let y = 1.7
  for (let i = 0; i < tiers.length; i += 1) {
    const t = tiers[i]
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(t.bodyW * 0.72, t.bodyH, t.bodyW * 0.72),
      palette.shoji,
    )
    core.position.y = y + t.bodyH / 2
    pagoda.add(core)

    // Exterior vermilion veranda balcony & corner columns
    const verandaW = t.bodyW + 0.95
    const floor = new THREE.Mesh(new THREE.BoxGeometry(verandaW, 0.16, verandaW), palette.darkTimber)
    floor.position.y = y + 0.08
    pagoda.add(floor)

    const railH = 0.52
    for (const side of [-1, 1]) {
      const rX = new THREE.Mesh(new THREE.BoxGeometry(verandaW, 0.08, 0.08), palette.vermilion)
      rX.position.set(0, y + railH, side * (verandaW / 2 - 0.06))
      const rZ = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, verandaW), palette.vermilion)
      rZ.position.set(side * (verandaW / 2 - 0.06), y + railH, 0)
      pagoda.add(rX, rZ)
    }

    const colSpan = t.bodyW * 0.44
    for (const sx of [-colSpan, -colSpan * 0.34, colSpan * 0.34, colSpan]) {
      for (const sz of [-colSpan, colSpan]) {
        const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, t.bodyH, 8), palette.vermilion)
        c1.position.set(sx, y + t.bodyH / 2, sz)
        pagoda.add(c1)
      }
      for (const sz of [-colSpan * 0.34, colSpan * 0.34]) {
        if (Math.abs(sx) === colSpan) {
          const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, t.bodyH, 8), palette.vermilion)
          c2.position.set(sx, y + t.bodyH / 2, sz)
          pagoda.add(c2)
        }
      }
    }

    addUpturnedTimberRoof(pagoda, palette, t.eaveW, t.eaveW, t.eaveH, y + t.bodyH, true)

    const halo = makeGlowSprite(glowTex, '#ffca7a', t.eaveW * 1.35, 0.18)
    halo.position.y = y + t.bodyH * 0.55
    pagoda.add(halo)
    halos.push(halo)

    y += t.bodyH + t.eaveH * 0.56
  }

  // Nine-ring bronze sōrin spire (九轮相轮刹)
  const dewBasin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), palette.brass)
  dewBasin.position.y = y + 0.9
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 6.2, 10), palette.brass)
  mast.position.y = y + 4.1
  pagoda.add(dewBasin, mast)
  for (let r = 0; r < 7; r += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36 - r * 0.032, 0.045, 6, 16), palette.brass)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y + 2.2 + r * 0.44
    pagoda.add(ring)
  }
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), palette.brass)
  jewel.position.y = y + 7.15
  pagoda.add(jewel)

  return { pagoda, halos }
}

/** 1:1 古寺本堂与缘侧风铃 (Main hall with engawa wooden veranda, shoji lattice & gently swaying fūrin wind chimes). */
export function createTempleMainHall(palette: KyotoPalette) {
  const hall = new THREE.Group()
  hall.name = 'kyoto-temple-hondo'

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.85, 11.5), palette.stone)
  plinth.position.y = 0.425
  const engawaDeck = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.25, 10.6), palette.cedar)
  engawaDeck.position.y = 0.975
  hall.add(plinth, engawaDeck)

  // Front stone access steps
  for (let s = 0; s < 3; s += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.28, 0.55), palette.stone)
    step.position.set(0, 0.14 + s * 0.28, 6.4 - s * 0.48)
    hall.add(step)
  }

  // Main warm sanctuary & timber columns
  const inner = new THREE.Mesh(new THREE.BoxGeometry(13.8, 4.2, 7.2), palette.shoji)
  inner.position.y = 3.2
  hall.add(inner)

  for (let ix = -3; ix <= 3; ix += 1) {
    for (const sz of [-4.4, 4.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 4.6, 8), palette.vermilion)
      col.position.set(ix * 2.5, 3.4, sz)
      hall.add(col)
    }
    if (ix < 3) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.1, 7.45), palette.darkTimber)
      mullion.position.set(ix * 2.5 + 1.25, 3.15, 0)
      hall.add(mullion)
    }
  }

  addUpturnedTimberRoof(hall, palette, 20.4, 13.6, 3.8, 5.6, true)

  // Ridge cap & golden end finials (chigi / shachihoko accents)
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 0.42), palette.slateRoof)
  ridge.position.y = 9.45
  hall.add(ridge)
  for (const rx of [-4.15, 4.15]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.65, 6), palette.brass)
    fin.position.set(rx, 9.75, 0)
    hall.add(fin)
  }

  // Hanging glass-and-paper fūrin wind chimes along the front eave
  const chimes: THREE.Group[] = []
  const chimeMat = createMat('#ffd4df', { emissive: '#ff96b0', emissiveIntensity: 0.45, roughness: 0.2, transparent: true, opacity: 0.88 })
  const stripMat = createMat('#fff0f5', { emissive: '#ffc2d4', emissiveIntensity: 0.3, side: THREE.DoubleSide })
  for (const cx of [-6.0, -2.5, 2.5, 6.0]) {
    const ch = new THREE.Group()
    ch.position.set(cx, 5.4, 5.95)
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 5), palette.darkTimber)
    cord.position.y = -0.22
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.72), chimeMat)
    bell.position.y = -0.5
    const tanzaku = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.015), stripMat)
    tanzaku.position.y = -0.92
    ch.add(cord, bell, tanzaku)
    hall.add(ch)
    chimes.push(ch)
  }

  return { hall, chimes }
}

/** 1:1 弯曲弧形千本鸟居石阶步道与石灯笼群. */
export function createSenbonToriiPath(palette: KyotoPalette, glowTex: THREE.Texture) {
  const group = new THREE.Group()
  group.name = 'kyoto-senbon-torii-corridor'

  const pathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-19.5, 1.15, -23.5),
    new THREE.Vector3(-23.5, 2.35, -30.5),
    new THREE.Vector3(-26.5, 3.85, -38.5),
    new THREE.Vector3(-28.0, 5.65, -46.5),
    new THREE.Vector3(-26.8, 7.65, -54.5),
  ])

  const gateCount = 15
  for (let i = 0; i < gateCount; i += 1) {
    const u = i / (gateCount - 1)
    const pt = pathCurve.getPoint(u)
    const tan = pathCurve.getTangent(u)

    const gate = new THREE.Group()
    gate.position.copy(pt)
    gate.rotation.y = Math.atan2(tan.x, tan.z)

    const stairSlab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 2.35), palette.stone)
    stairSlab.position.y = -0.68
    gate.add(stairSlab)

    for (const sx of [-1.45, 1.45]) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 10), palette.darkTimber)
      ped.position.set(sx, 0.275, 0)
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 10), palette.vermilion)
      col.position.set(sx, 2.25, 0)
      gate.add(ped, col)
    }
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.24, 0.24), palette.vermilion)
    nuki.position.y = 3.35
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.26, 0.36), palette.vermilion)
    kasagi.position.y = 4.05
    const cap = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.16, 0.42), palette.darkTimber)
    cap.position.y = 4.24
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.62, 0.16), palette.brass)
    plaque.position.y = 3.68
    gate.add(nuki, kasagi, cap, plaque)
    group.add(gate)
  }

  // Flanking stone tōrō lanterns & hillside summit shrine (Hokora) at path end
  const summitEnd = pathCurve.getPoint(1)
  const summitDir = pathCurve.getTangent(1)
  const summitShrine = new THREE.Group()
  summitShrine.position.set(summitEnd.x + summitDir.x * 3.8, summitEnd.y + 0.1, summitEnd.z + summitDir.z * 3.8)
  summitShrine.rotation.y = Math.atan2(-summitDir.x, -summitDir.z)
  const shBase = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.4, 5.4), palette.stone)
  shBase.position.y = -0.45
  const shCore = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.3, 2.6), palette.shoji)
  shCore.position.y = 1.4
  const shFrame = new THREE.Mesh(new THREE.BoxGeometry(3.45, 2.45, 2.85), palette.vermilion)
  shFrame.position.y = 1.4
  shFrame.scale.set(0.92, 1.0, 0.72)
  summitShrine.add(shBase, shFrame, shCore)
  addUpturnedTimberRoof(summitShrine, palette, 4.8, 4.2, 1.65, 2.65, true)
  group.add(summitShrine)

  const lanterns: { firebox: THREE.Mesh; mat: THREE.MeshStandardMaterial; halo: THREE.Sprite }[] = []
  const lanternCoords: [number, number, number][] = [
    [-7.8, 0.65, 7.6],
    [6.4, 0.65, 7.6],
    [-2.4, 1.15, -22.2],
    [2.4, 1.15, -22.2],
    [-16.2, 1.15, -22.4],
    [7.2, 1.15, -27.5],
    [16.8, 1.15, -27.5],
    [-21.2, 2.35, -30.5],
    [summitShrine.position.x - 2.2, summitEnd.y + 0.25, summitShrine.position.z + 1.8],
    [summitShrine.position.x + 2.2, summitEnd.y + 0.25, summitShrine.position.z + 1.8],
  ]
  const lanternsGroup = new THREE.Group()
  lanternsGroup.name = 'kyoto-stone-lanterns'
  for (const [lx, ly, lz] of lanternCoords) {
    const lg = new THREE.Group()
    lg.position.set(lx, ly, lz)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 0.42, 6), palette.stone)
    base.position.y = 0.21
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.05, 6), palette.stone)
    post.position.y = 0.94
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.18, 6), palette.stone)
    cap.position.y = 1.54
    const fMat = palette.warmFire.clone()
    const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.44), fMat)
    firebox.position.y = 1.85
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.48, 6), palette.stone)
    roof.position.y = 2.3
    const halo = makeGlowSprite(glowTex, '#ffbe66', 2.4, 0.18)
    halo.position.y = 1.86
    lg.add(base, post, cap, firebox, roof, halo)
    lanternsGroup.add(lg)
    lanterns.push({ firebox, mat: fMat, halo })
  }

  const getPathHeight = (x: number, z: number): number | null => {
    for (let s = 0; s <= 24; s += 1) {
      const pt = pathCurve.getPoint(s / 24)
      if (Math.hypot(x - pt.x, z - pt.z) <= 2.3) return pt.y
    }
    return null
  }

  return { toriiGroup: group, lanternsGroup, lanterns, getPathHeight }
}

/** 1:1 苍劲垂枝古樱树 (Multi-branch curved bark trunk + feathered irregular blossom clusters + fine weeping sakura twigs). */
export function createWeepingSakura(seedInit: number, scale = 1.0) {
  let seed = seedInit
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const tree = new THREE.Group()
  tree.name = 'kyoto-weeping-sakura'

  const barkMat = createMat('#3c2b26', { roughness: 0.92 })
  const bloomMats = [
    createMat('#ffbfd4', { emissive: '#c85c82', emissiveIntensity: 0.14, roughness: 0.84, flatShading: true }),
    createMat('#ffdfe9', { emissive: '#d86e92', emissiveIntensity: 0.12, roughness: 0.82, flatShading: true }),
    createMat('#f493b2', { emissive: '#b84c72', emissiveIntensity: 0.16, roughness: 0.86, flatShading: true }),
    createMat('#fff1f5', { emissive: '#d27c98', emissiveIntensity: 0.1, roughness: 0.8, flatShading: true }),
  ]

  // Main gnarled crooked trunk
  const lean = (rand() - 0.5) * 1.4
  const trunkPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.4, 1.8 * scale, (rand() - 0.5) * 0.4),
    new THREE.Vector3(lean * 0.9, 3.6 * scale, (rand() - 0.5) * 0.7),
    new THREE.Vector3(lean * 1.2, 5.1 * scale, (rand() - 0.5) * 0.6),
  ]
  const trunkGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 14, 0.34 * scale, 8, false)
  tree.add(new THREE.Mesh(trunkGeo, barkMat))

  const canopy = new THREE.Group()
  canopy.position.set(lean * 1.15, 4.95 * scale, 0)

  const addBlossomSpray = (cx: number, cy: number, cz: number, spread: number, count: number) => {
    for (let k = 0; k < count; k += 1) {
      const a = rand() * Math.PI * 2
      const d = Math.pow(rand(), 0.6) * spread
      const rad = (0.34 + rand() * 0.36) * scale
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 0), bloomMats[(k + Math.floor(rand() * 4)) % bloomMats.length])
      puff.position.set(
        cx + Math.cos(a) * d,
        cy + (rand() - 0.35) * spread * 0.55,
        cz + Math.sin(a) * d,
      )
      puff.rotation.set(rand() * 3, rand() * 3, rand() * 3)
      puff.scale.set(1.25 + rand() * 0.35, 0.72 + rand() * 0.28, 1.15 + rand() * 0.3)
      canopy.add(puff)
    }
  }

  // Radial twisting primary boughs + tiered airy blossom sprays + delicate drooping blossom twigs
  const boughCount = 6
  for (let b = 0; b < boughCount; b += 1) {
    const a = (b / boughCount) * Math.PI * 2 + (rand() - 0.5) * 0.38
    const reach = (2.8 + rand() * 1.6) * scale
    const rise = (0.9 + rand() * 1.3) * scale
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * reach * 0.52, rise * 0.75, Math.sin(a) * reach * 0.52),
      new THREE.Vector3(Math.cos(a) * reach, rise * 0.42, Math.sin(a) * reach),
    ])
    canopy.add(new THREE.Mesh(new THREE.TubeGeometry(bCurve, 10, 0.11 * scale, 6, false), barkMat))

    const mid = bCurve.getPoint(0.55)
    const tip = bCurve.getPoint(0.95)
    addBlossomSpray(mid.x, mid.y + 0.35 * scale, mid.z, 1.05 * scale, 7)
    addBlossomSpray(tip.x, tip.y + 0.25 * scale, tip.z, 1.25 * scale, 9)

    // Delicate slender weeping twigs dotted with small staggered blossom buds
    for (let w = 0; w < 3; w += 1) {
      const origin = bCurve.getPoint(0.58 + w * 0.18)
      const ox = origin.x + (rand() - 0.5) * 0.75 * scale
      const oz = origin.z + (rand() - 0.5) * 0.75 * scale
      const hangLen = (1.35 + rand() * 1.15) * scale
      const twigCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ox, origin.y, oz),
        new THREE.Vector3(ox * 1.04, origin.y - hangLen * 0.55, oz * 1.04),
        new THREE.Vector3(ox * 1.02 + (rand() - 0.5) * 0.18, origin.y - hangLen, oz * 1.02),
      ])
      canopy.add(new THREE.Mesh(new THREE.TubeGeometry(twigCurve, 6, 0.024 * scale, 4, false), barkMat))
      for (let d = 1; d <= 4; d += 1) {
        const dp = twigCurve.getPoint(d / 4.2)
        const bud = new THREE.Mesh(
          new THREE.IcosahedronGeometry((0.18 - d * 0.025) * scale, 0),
          bloomMats[(b + w + d) % bloomMats.length],
        )
        bud.position.set(dp.x + (rand() - 0.5) * 0.12 * scale, dp.y, dp.z + (rand() - 0.5) * 0.12 * scale)
        bud.rotation.set(rand() * 3, rand() * 3, 0)
        bud.scale.set(1.15, 0.9, 1.15)
        canopy.add(bud)
      }
    }
  }

  // Summit crown spray
  addBlossomSpray(0, 1.45 * scale, 0, 1.55 * scale, 11)

  tree.add(canopy)
  return { tree, canopy }
}

/** 1:1 古寺钟楼与青铜梵钟 (Shōrō timber bell pavilion + LatheGeometry bronze bonshō + swinging wooden striker). */
export function createBellPavilion(palette: KyotoPalette) {
  const pav = new THREE.Group()
  pav.name = 'kyoto-bell-pavilion'

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.8, 5.6), palette.stone)
  base.position.y = 0.4
  pav.add(base)

  for (const [px, pz] of [[-1.95, -1.95], [1.95, -1.95], [-1.95, 1.95], [1.95, 1.95]] as const) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.6, 8), palette.vermilion)
    col.position.set(px, 3.1, pz)
    pav.add(col)
  }
  addUpturnedTimberRoof(pav, palette, 7.2, 7.2, 2.2, 5.4, true)

  // Suspended bronze bell
  const swingPivot = new THREE.Group()
  swingPivot.position.set(0, 5.1, 0)
  const bellPts = [
    new THREE.Vector2(0.08, 0),
    new THREE.Vector2(0.56, -0.25),
    new THREE.Vector2(0.76, -0.82),
    new THREE.Vector2(0.84, -1.85),
    new THREE.Vector2(0.98, -2.55),
    new THREE.Vector2(0.84, -2.55),
  ]
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 20), palette.bronze)
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.055, 8, 22), palette.brass)
  band.rotation.x = Math.PI / 2
  band.position.y = -1.48
  swingPivot.add(bell, band)
  pav.add(swingPivot)

  // Suspended cedar battering beam (撞钟木 / shumoku)
  const striker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.5, 8), palette.cedar)
  striker.rotation.z = Math.PI / 2
  striker.position.set(1.55, 3.1, 0)
  pav.add(striker)

  return { bellPavilion: pav, bellSwingPivot: swingPivot, striker }
}

/** 1:1 朱红弧形跨池木拱桥 (Walkable parabolic bridge deck matching height sampler). */
export function createVermilionArchBridge(palette: KyotoPalette, startZ: number, endZ: number, baseHeightY: number, farHeightY: number, archHeight: number) {
  const bridge = new THREE.Group()
  bridge.name = 'kyoto-vermilion-arch-bridge'

  const deckW = 3.2
  const planks = 26
  const leftPts: THREE.Vector3[] = []
  const rightPts: THREE.Vector3[] = []

  const getDeckY = (u: number) => {
    const base = THREE.MathUtils.lerp(baseHeightY, farHeightY, u)
    return base + Math.sin(u * Math.PI) * archHeight
  }

  for (let i = 0; i <= planks; i += 1) {
    const u = i / planks
    const z = THREE.MathUtils.lerp(startZ, endZ, u)
    const y = getDeckY(u)
    const slope = ((farHeightY - baseHeightY) + Math.cos(u * Math.PI) * Math.PI * archHeight) / (startZ - endZ)

    const plank = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.16, 1.05), palette.cedar)
    plank.position.set(0, y - 0.08, z)
    plank.rotation.x = Math.atan(slope)
    bridge.add(plank)

    for (const side of [-1, 1]) {
      const rx = side * (deckW * 0.46)
      const pt = new THREE.Vector3(rx, y + 0.92, z)
      if (side < 0) leftPts.push(pt)
      else rightPts.push(pt)

      if (i % 3 === 0) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.02, 8), palette.vermilion)
        post.position.set(rx, y + 0.48, z)
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), palette.brass)
        finial.position.set(rx, y + 1.04, z)
        bridge.add(post, finial)
      }
    }
  }

  for (const pts of [leftPts, rightPts]) {
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.065, 8, false),
      palette.vermilion,
    )
    bridge.add(rail)
  }

  // Timber support bents grounded beneath bridge into the pond bed
  for (const u of [0.22, 0.5, 0.78]) {
    const z = THREE.MathUtils.lerp(startZ, endZ, u)
    const y = getDeckY(u)
    for (const side of [-1.25, 1.25]) {
      const pierH = y + 1.4
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, pierH, 8), palette.darkTimber)
      pier.position.set(side, (y - 1.4) / 2, z)
      bridge.add(pier)
    }
  }

  return { bridge, getDeckY }
}

/** Near-shore granite water basin (蹲踞 / Tsukubai) with bamboo water ladle. */
export function createStoneChozuya(palette: KyotoPalette) {
  const grp = new THREE.Group()
  grp.name = 'kyoto-stone-tsukubai'
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.44, 0.68, 14), palette.stone)
  basin.position.y = 0.34
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 8, 20), palette.stone)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.68
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 20),
    createMat('#2a4e52', { roughness: 0.14, metalness: 0.22 }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.65
  const bambooMat = createMat('#89945a', { roughness: 0.65 })
  const ladleStick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 6), bambooMat)
  ladleStick.rotation.z = Math.PI / 2 - 0.14
  ladleStick.position.set(0.08, 0.75, 0.04)
  const ladleCup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.16, 10), bambooMat)
  ladleCup.position.set(-0.32, 0.72, 0.04)
  grp.add(basin, rim, water, ladleStick, ladleCup)
  return grp
}

/** 1:1 东山苍翠杉柏木 (Layered dark emerald cedar tree for surrounding temple woods & torii mountain slope). */
export function createKyotoCedar(height = 9.5, toneShift = 0) {
  const cedar = new THREE.Group()
  cedar.name = 'kyoto-hillside-cedar'
  const trunkMat = createMat('#3b2a22', { roughness: 0.94 })
  const foliageHex = toneShift % 3 === 0 ? '#1f3a2e' : toneShift % 3 === 1 ? '#264434' : '#1b3127'
  const foliageMat = createMat(foliageHex, { roughness: 0.9, flatShading: true })

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.28, height * 0.48, 7),
    trunkMat,
  )
  trunk.position.y = height * 0.24
  cedar.add(trunk)

  const tiers = 4
  for (let i = 0; i < tiers; i += 1) {
    const u = i / (tiers - 1)
    const rad = height * (0.28 - u * 0.14)
    const coneH = height * (0.36 - u * 0.08)
    const tier = new THREE.Mesh(new THREE.ConeGeometry(rad, coneH, 7), foliageMat)
    tier.position.y = height * (0.34 + u * 0.52)
    tier.rotation.y = (i * 0.9 + toneShift * 0.7)
    cedar.add(tier)
  }
  return cedar
}

/** 1:1 岚山修竹丛 (Clustered green bamboo culms with segmented nodes & feathery leaf crowns). */
export function createBambooClump(seedInit = 1, scale = 1.0) {
  let seed = seedInit
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const clump = new THREE.Group()
  clump.name = 'kyoto-bamboo-clump'
  const culmMat = createMat('#4b6c42', { roughness: 0.52 })
  const leafMat = createMat('#3b5d38', { roughness: 0.85, flatShading: true })

  for (let i = 0; i < 6; i += 1) {
    const h = (4.8 + rand() * 3.4) * scale
    const ox = (rand() - 0.5) * 1.1 * scale
    const oz = (rand() - 0.5) * 1.1 * scale
    const tiltX = (rand() - 0.5) * 0.12
    const tiltZ = (rand() - 0.5) * 0.12
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * scale, 0.08 * scale, h, 6), culmMat)
    stalk.position.set(ox, h * 0.5, oz)
    stalk.rotation.set(tiltX, 0, tiltZ)
    const topLeaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68 * scale, 0), leafMat)
    topLeaf.position.set(ox + tiltZ * h * 0.5, h * 0.94, oz + tiltX * h * 0.5)
    topLeaf.scale.set(1.3, 0.65, 1.3)
    clump.add(stalk, topLeaf)
  }
  return clump
}
