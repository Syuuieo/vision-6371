import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'
import type { DioramaTextures } from '../types'

export interface GriffithPalette {
  stucco: THREE.MeshStandardMaterial
  sandstone: THREE.MeshStandardMaterial
  hillEarth: THREE.MeshStandardMaterial
  copperDome: THREE.MeshStandardMaterial
  bronze: THREE.MeshStandardMaterial
  brass: THREE.MeshStandardMaterial
  windowWarm: THREE.MeshStandardMaterial
  iron: THREE.MeshStandardMaterial
  lampGlow: THREE.MeshStandardMaterial
  miaYellow: THREE.MeshStandardMaterial
  sebNavy: THREE.MeshStandardMaterial
  hairDark: THREE.MeshStandardMaterial
  skinTone: THREE.MeshStandardMaterial
  noteGold: THREE.MeshStandardMaterial
  pianoBlack: THREE.MeshStandardMaterial
  pianoIvory: THREE.MeshStandardMaterial
  hollywoodWhite: THREE.MeshStandardMaterial
}

export function createGriffithPalette(textures: DioramaTextures): GriffithPalette {
  return {
    stucco: createMat('#ece4d4', {
      roughness: 0.84,
      bumpMap: textures.plasterBump,
      bumpScale: 0.025,
    }),
    sandstone: applyPbrSet(
      createMat('#ccb79b', { roughness: 0.9, bumpMap: textures.darkStoneTex, bumpScale: 0.04 }),
      'limestone',
      3,
      3,
    ),
    hillEarth: createMat('#3a2e46', {
      roughness: 0.96,
      bumpMap: textures.plasterBump,
      bumpScale: 0.06,
    }),
    copperDome: createMat('#588c79', {
      roughness: 0.4,
      metalness: 0.54,
      emissive: '#1b3d3a',
      emissiveIntensity: 0.16,
    }),
    bronze: createMat('#5c452d', { roughness: 0.36, metalness: 0.78 }),
    brass: createMat('#e8c166', {
      roughness: 0.24,
      metalness: 0.88,
      emissive: '#8f6216',
      emissiveIntensity: 0.18,
    }),
    windowWarm: createMat('#ffd98c', {
      emissive: '#ffaa42',
      emissiveIntensity: 0.52,
      roughness: 0.34,
    }),
    iron: createMat('#20222c', { roughness: 0.46, metalness: 0.72 }),
    lampGlow: createMat('#ffe4a6', {
      emissive: '#ffbd54',
      emissiveIntensity: 1.4,
      roughness: 0.28,
    }),
    miaYellow: createMat('#f6cb38', {
      roughness: 0.56,
      emissive: '#946d0c',
      emissiveIntensity: 0.18,
    }),
    sebNavy: createMat('#1d2746', { roughness: 0.64, metalness: 0.06 }),
    hairDark: createMat('#2c1e1a', { roughness: 0.82 }),
    skinTone: createMat('#e5c4a8', { roughness: 0.86 }),
    noteGold: createMat('#ffe28a', {
      emissive: '#ff88d4',
      emissiveIntensity: 0.88,
      roughness: 0.28,
    }),
    pianoBlack: createMat('#161720', { roughness: 0.26, metalness: 0.42 }),
    pianoIvory: createMat('#efe7d6', { roughness: 0.6, emissive: '#a87d2e', emissiveIntensity: 0.08 }),
    hollywoodWhite: createMat('#f7f1e3', {
      emissive: '#ffe6b8',
      emissiveIntensity: 0.32,
      roughness: 0.72,
    }),
  }
}

/**
 * 1:1 格里菲斯天文台主体建筑
 * Art Deco 象牙白石壁与窗棂 + 青铜穹顶经纬肋条 + 稳固植根于山巅花岗岩峭壁基座（绝不悬空）.
 */
export function createGriffithObservatory(palette: GriffithPalette, glowTex: THREE.Texture) {
  const obs = new THREE.Group()
  obs.name = 'griffith-observatory'

  // Grounded Mount Hollywood rocky bluff bastion anchoring the plinth solidly down into the hill slope
  const cliffBastion = new THREE.Mesh(new THREE.CylinderGeometry(24, 34, 14, 14), palette.hillEarth)
  cliffBastion.position.set(0, -6.9, -1.5)
  const retainingWall = new THREE.Mesh(new THREE.BoxGeometry(44.5, 4.4, 24.5), palette.sandstone)
  retainingWall.position.set(0, 0.2, 0)
  const corniceDeck = new THREE.Mesh(new THREE.BoxGeometry(45.6, 0.45, 25.6), palette.stucco)
  corniceDeck.position.set(0, 2.35, 0)
  obs.add(cliffBastion, retainingWall, corniceDeck)

  // Grand central Samuel Oschin Planetarium drum & cornice bands
  const centralHall = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.6, 8.2, 24), palette.stucco)
  centralHall.position.set(0, 6.4, 0)
  const lowerTrim = new THREE.Mesh(new THREE.CylinderGeometry(9.72, 9.72, 0.42, 24), palette.sandstone)
  lowerTrim.position.set(0, 2.75, 0)
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 0.88, 24), palette.sandstone)
  collar.position.set(0, 10.3, 0)

  // Grand central verdigris copper Planetarium Dome with bronze rib seams
  const mainDome = new THREE.Mesh(
    new THREE.SphereGeometry(9.1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    palette.copperDome,
  )
  mainDome.position.set(0, 10.55, 0)
  for (let r = 0; r < 6; r += 1) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(9.12, 0.06, 6, 32, Math.PI), palette.bronze)
    rib.rotation.y = (r / 6) * Math.PI
    rib.position.set(0, 10.55, 0)
    obs.add(rib)
  }
  const apexSpire = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.2, 10), palette.brass)
  apexSpire.position.set(0, 20.15, 0)
  obs.add(centralHall, lowerTrim, collar, mainDome, apexSpire)

  // Fluted Art Deco pilasters & mullioned glowing windows around central rotunda
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.65, 7.6, 0.58), palette.stucco)
    pilaster.position.set(Math.sin(a) * 9.35, 6.3, Math.cos(a) * 9.35)
    pilaster.rotation.y = a
    obs.add(pilaster)

    if (Math.cos(a) > 0.2 || Math.abs(Math.sin(a)) > 0.45) {
      const wa = a + Math.PI / 12
      const wx = Math.sin(wa) * 9.2
      const wz = Math.cos(wa) * 9.2
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.18, 4.4, 0.25), palette.windowWarm)
      win.position.set(wx, 6.4, wz)
      win.rotation.y = wa
      const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.45, 0.3), palette.bronze)
      mullionV.position.set(wx, 6.4, wz)
      mullionV.rotation.y = wa
      const mullionH = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.3), palette.bronze)
      mullionH.position.set(wx, 6.5, wz)
      mullionH.rotation.y = wa
      obs.add(win, mullionV, mullionH)
    }
  }

  // Front Art Deco entrance portico + bronze doors + entrance stone steps
  const portico = new THREE.Mesh(new THREE.BoxGeometry(9.4, 7.2, 5.4), palette.stucco)
  portico.position.set(0, 5.9, 8.2)
  const porticoCornice = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.78, 5.8), palette.sandstone)
  porticoCornice.position.set(0, 9.7, 8.2)
  const doors = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.5, 0.4), palette.bronze)
  doors.position.set(0, 4.6, 10.85)
  const doorwayGlow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 0.45), palette.windowWarm)
  doorwayGlow.position.set(0, 7.55, 10.85)
  const frontStep = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.85, 3.2), palette.sandstone)
  frontStep.position.set(0, 2.6, 11.4)
  obs.add(portico, porticoCornice, doors, doorwayGlow, frontStep)

  // Symmetrical lateral Art Deco telescope wings & copper domes with mullions
  const wingHalos: THREE.Sprite[] = []
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12.5, 6.4, 8.4), palette.stucco)
    wing.position.set(side * 12.2, 5.5, 0.4)
    const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(13.0, 0.58, 8.9), palette.sandstone)
    wingRoof.position.set(side * 12.2, 8.85, 0.4)

    for (const wx of [-2.4, 0.8, 4.0]) {
      const px = side * (9.2 + wx)
      const wPane = new THREE.Mesh(new THREE.BoxGeometry(1.55, 3.3, 0.25), palette.windowWarm)
      wPane.position.set(px, 5.7, 4.62)
      const wMull = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.35, 0.3), palette.bronze)
      wMull.position.set(px, 5.7, 4.62)
      obs.add(wPane, wMull)
    }

    const pavilion = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 7.0, 8), palette.stucco)
    pavilion.position.set(side * 17.8, 5.8, 0.4)
    const domeRing = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.7, 0.52, 16), palette.sandstone)
    domeRing.position.set(side * 17.8, 9.4, 0.4)
    const sideDome = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      palette.copperDome,
    )
    sideDome.position.set(side * 17.8, 9.55, 0.4)

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 3.6, 10), palette.brass)
    scope.rotation.x = -0.68
    scope.rotation.z = side * -0.18
    scope.position.set(side * 18.1, 13.1, 2.5)

    const halo = makeGlowSprite(glowTex, '#92e2ff', 8.0, 0.06)
    halo.position.set(side * 17.8, 14.6, 0.4)
    wingHalos.push(halo)

    obs.add(wing, wingRoof, pavilion, domeRing, sideDome, scope, halo)
  }

  // Front Astronomers Monument Obelisk & Armillary Sphere with stepped base
  const monument = new THREE.Group()
  monument.position.set(0, 2.5, 16.2)
  const monPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 3.4), palette.sandstone)
  monPlinth.position.y = 0.225
  const monBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.65, 0.9, 6), palette.sandstone)
  monBase.position.y = 0.9
  const monSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.88, 6.2, 6), palette.stucco)
  monSpire.position.y = 4.35
  const armillaryOuter = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.065, 8, 22), palette.brass)
  armillaryOuter.position.y = 8.2
  const armillaryInner = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 20), palette.brass)
  armillaryInner.rotation.y = Math.PI / 2
  armillaryInner.position.y = 8.2
  monument.add(monPlinth, monBase, monSpire, armillaryOuter, armillaryInner)
  obs.add(monument)

  const mainHalo = makeGlowSprite(glowTex, '#ffbbec', 15, 0.1)
  mainHalo.position.set(0, 19.8, 0)
  obs.add(mainHalo)

  return { observatory: obs, mainHalo, wingHalos }
}

/** 《爱乐之城》「A Lovely Night」山坡复古黑铸铁双头路灯. */
export function createVintageStreetLamp(palette: GriffithPalette, glowTex: THREE.Texture) {
  const lamp = new THREE.Group()
  lamp.name = 'lala-streetlamp'

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.65, 8), palette.iron)
  base.position.y = 0.325
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.11, 4.1, 10), palette.iron)
  post.position.y = 2.7
  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), palette.iron)
  crossArm.position.y = 4.78

  const globes: THREE.Mesh[] = []
  const halos: THREE.Sprite[] = []
  for (const gx of [-0.52, 0.52]) {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 8), palette.iron)
    cap.position.set(gx, 5.14, 0)
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), palette.lampGlow)
    globe.position.set(gx, 4.94, 0)
    const halo = makeGlowSprite(glowTex, '#ffd584', 4.2, 0.28)
    halo.position.set(gx, 4.94, 0)
    lamp.add(cap, globe, halo)
    globes.push(globe)
    halos.push(halo)
  }

  lamp.add(base, post, crossArm)
  return { lamp, globes, halos }
}

/**
 * 1:1 《爱乐之城》米娅（明黄连衣裙）与塞巴斯蒂安（深蓝西装）双人华尔兹舞像
 * Smooth continuous neck/shoulder/waist anatomy, sculpted hair silhouettes, and embracing dance posture.
 */
export function createLaLaLandDancers(palette: GriffithPalette) {
  const pair = new THREE.Group()
  pair.name = 'lala-waltz-dancers'

  // Mia facing Sebastian slightly inward (waltz pose)
  const mia = new THREE.Group()
  mia.position.set(-0.38, 0, 0.08)
  mia.rotation.y = 0.45

  for (const lx of [-0.08, 0.08]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.52, 8), palette.skinTone)
    leg.position.set(lx, 0.26, lx > 0 ? 0.05 : -0.05)
    leg.rotation.x = lx > 0 ? -0.18 : 0.15
    mia.add(leg)
  }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.46, 0.68, 16), palette.miaYellow)
  skirt.position.y = 0.68
  const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.4, 12), palette.miaYellow)
  bodice.position.y = 1.18
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.14, 8), palette.skinTone)
  neckM.position.y = 1.42
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), palette.skinTone)
  headM.position.y = 1.54
  const hairM = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
    palette.hairDark,
  )
  hairM.rotation.x = -0.35
  hairM.position.set(0, 1.56, -0.02)
  // Raised & clasped waltz arms
  const armMLead = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.52, 8), palette.skinTone)
  armMLead.rotation.z = -1.18
  armMLead.position.set(0.24, 1.32, 0.08)
  const armMShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.48, 8), palette.skinTone)
  armMShoulder.rotation.z = 0.72
  armMShoulder.rotation.x = -0.45
  armMShoulder.position.set(0.14, 1.34, 0.16)
  mia.add(skirt, bodice, neckM, headM, hairM, armMLead, armMShoulder)

  // Sebastian facing Mia in tailored navy suit
  const seb = new THREE.Group()
  seb.position.set(0.38, 0, -0.08)
  seb.rotation.y = -2.68

  for (const lx of [-0.095, 0.095]) {
    const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.056, 0.86, 10), palette.sebNavy)
    trouser.position.set(lx, 0.43, lx > 0 ? 0.06 : -0.06)
    trouser.rotation.x = lx > 0 ? 0.14 : -0.14
    seb.add(trouser)
  }
  const hipsS = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.24, 12), palette.sebNavy)
  hipsS.position.y = 0.88
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.56, 12), palette.sebNavy)
  jacket.position.y = 1.2
  const neckS = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.14, 8), palette.skinTone)
  neckS.position.y = 1.52
  const headS = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), palette.skinTone)
  headS.position.y = 1.65
  const hairS = new THREE.Mesh(
    new THREE.SphereGeometry(0.128, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    palette.hairDark,
  )
  hairS.rotation.x = -0.32
  hairS.position.set(0, 1.67, -0.015)
  const armSLead = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.54, 8), palette.sebNavy)
  armSLead.rotation.z = 1.1
  armSLead.position.set(-0.26, 1.38, 0.08)
  const armSWaist = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.48, 8), palette.sebNavy)
  armSWaist.rotation.z = -0.68
  armSWaist.rotation.x = -0.55
  armSWaist.position.set(-0.14, 1.24, 0.18)
  seb.add(hipsS, jacket, neckS, headS, hairS, armSLead, armSWaist)

  pair.add(mia, seb)
  return pair
}

/** 1:1 古典黑色大三角钢琴（带撑杆、曲面琴尾与黑白相间琴键，点击轻响醒亮）. */
export function createJazzGrandPiano(palette: GriffithPalette) {
  const piano = new THREE.Group()
  piano.name = 'lala-grand-piano'

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.36, 1.85), palette.pianoBlack)
  body.position.set(0, 0.84, 0)
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.36, 16), palette.pianoBlack)
  tail.position.set(0.02, 0.84, -0.9)
  // Propped grand piano lid + brass prop stick
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.048, 1.82), palette.pianoBlack)
  lid.position.set(0.18, 1.34, -0.14)
  lid.rotation.z = 0.42
  const propStick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.72, 6), palette.brass)
  propStick.position.set(0.62, 1.3, 0.25)
  propStick.rotation.z = -0.12

  // Keybed with crisp individual ivory/ebony piano keys instead of a glowing white slab
  const keyBed = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 0.34), palette.pianoBlack)
  keyBed.position.set(0, 0.72, 0.98)
  const ivoryStrip = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.035, 0.22), palette.pianoIvory)
  ivoryStrip.position.set(0, 0.77, 1.02)
  piano.add(keyBed, ivoryStrip)
  for (let k = -5; k <= 5; k += 1) {
    if (k === -3 || k === 0 || k === 4) continue
    const sharp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.13), palette.pianoBlack)
    sharp.position.set(k * 0.115, 0.795, 0.97)
    piano.add(sharp)
  }

  for (const [lx, lz] of [[-0.66, 0.84], [0.66, 0.84], [0, -1.42]] as [number, number][]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.038, 0.68, 8), palette.pianoBlack)
    leg.position.set(lx, 0.34, lz)
    piano.add(leg)
  }

  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.4), palette.pianoBlack)
  bench.position.set(0, 0.48, 1.46)
  for (const bx of [-0.36, 0.36]) {
    for (const bz of [1.3, 1.62]) {
      const bLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.46, 6), palette.pianoBlack)
      bLeg.position.set(bx, 0.23, bz)
      piano.add(bLeg)
    }
  }

  piano.add(body, tail, lid, propStick, bench)
  return piano
}

/** 悬浮星图与爵士音符天穹（Planetarium 华尔兹投影）. */
export function createPlanetariumCanopy(palette: GriffithPalette) {
  const canopy = new THREE.Group()
  canopy.name = 'griffith-planetarium-canopy'

  const ringA = new THREE.Mesh(new THREE.TorusGeometry(13.5, 0.08, 8, 48), palette.brass)
  ringA.rotation.x = Math.PI / 2 - 0.24
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.07, 8, 42), palette.noteGold)
  ringB.rotation.x = Math.PI / 2 + 0.32
  ringB.rotation.y = 0.48
  canopy.add(ringA, ringB)

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), palette.noteGold)
    star.position.set(Math.cos(a) * 13.5, Math.sin(a) * 3.1, Math.sin(a) * 12.8)
    canopy.add(star)
  }

  return canopy
}

/** 远山李山顶「HOLLYWOOD」经典九字母山脊标牌. */
export function createHollywoodSign(palette: GriffithPalette) {
  const sign = new THREE.Group()
  sign.name = 'hollywood-hills-sign'

  const specs: Array<{ bars: Array<[number, number, number, number]> }> = [
    { bars: [[-0.8, 0, 0.45, 3.6], [0.8, 0, 0.45, 3.6], [0, 0, 1.6, 0.48]] }, // H
    { bars: [[-0.75, 0, 0.42, 3.6], [0.75, 0, 0.42, 3.6], [0, 1.55, 1.5, 0.45], [0, -1.55, 1.5, 0.45]] }, // O
    { bars: [[-0.6, 0, 0.45, 3.6], [0.1, -1.55, 1.6, 0.48]] }, // L
    { bars: [[-0.6, 0, 0.45, 3.6], [0.1, -1.55, 1.6, 0.48]] }, // L
    { bars: [[0, -0.7, 0.45, 2.2], [-0.55, 0.9, 0.45, 1.8], [0.55, 0.9, 0.45, 1.8]] }, // Y
    { bars: [[-0.9, 0, 0.4, 3.6], [0, -0.2, 0.4, 3.2], [0.9, 0, 0.4, 3.6], [-0.45, -1.55, 0.9, 0.42], [0.45, -1.55, 0.9, 0.42]] }, // W
    { bars: [[-0.75, 0, 0.42, 3.6], [0.75, 0, 0.42, 3.6], [0, 1.55, 1.5, 0.45], [0, -1.55, 1.5, 0.45]] }, // O
    { bars: [[-0.75, 0, 0.42, 3.6], [0.75, 0, 0.42, 3.6], [0, 1.55, 1.5, 0.45], [0, -1.55, 1.5, 0.45]] }, // O
    { bars: [[-0.75, 0, 0.45, 3.6], [0.65, 0, 0.42, 3.0], [0, 1.55, 1.4, 0.45], [0, -1.55, 1.4, 0.45]] }, // D
  ]

  specs.forEach((letter, idx) => {
    const lx = (idx - 4) * 3.1
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.18), palette.iron)
    truss.position.set(lx, -1.2, -0.35)
    sign.add(truss)
    for (const [bx, by, bw, bh] of letter.bars) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.24), palette.hollywoodWhite)
      m.position.set(lx + bx, by, 0)
      sign.add(m)
    }
  })

  return sign
}
