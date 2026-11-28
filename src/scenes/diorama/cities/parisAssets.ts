import * as THREE from 'three'
import { createMat, makeGlowSprite } from '../materials'
import { applyPbrSet } from '../pbrMaterials'

export interface HaussmannTextures {
  facadeMap: THREE.CanvasTexture | null
  facadeEmissive: THREE.CanvasTexture | null
  facadeBump: THREE.CanvasTexture | null
  mansardMap: THREE.CanvasTexture | null
  groundCobbleMap: THREE.CanvasTexture | null
  lawnMap: THREE.CanvasTexture | null
  dispose: () => void
}

function makeCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function toTexture(
  canvas: HTMLCanvasElement | null,
  repeatX: number,
  repeatY: number,
  srgb = true,
): THREE.CanvasTexture | null {
  if (!canvas) return null
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Creates cached PBR CanvasTextures for Parisian Haussmann facades, mansard roofs, cobblestones & lawns. */
export function createParisianTextures(): HaussmannTextures {
  const disposable: THREE.Texture[] = []

  // 1. Haussmann limestone facade (512x512) + warm window emissive + ashlar bump
  const facCanvas = makeCanvas(512, 512)
  const emCanvas = makeCanvas(512, 512)
  const bumpCanvas = makeCanvas(512, 512)

  if (facCanvas && emCanvas && bumpCanvas) {
    const fCtx = facCanvas.getContext('2d')!
    const eCtx = emCanvas.getContext('2d')!
    const bCtx = bumpCanvas.getContext('2d')!

    // Base warm cream limestone
    fCtx.fillStyle = '#d7cab3'
    fCtx.fillRect(0, 0, 512, 512)
    eCtx.fillStyle = '#000000'
    eCtx.fillRect(0, 0, 512, 512)
    bCtx.fillStyle = '#909090'
    bCtx.fillRect(0, 0, 512, 512)

    // Subtle limestone block variation & ashlar joints
    for (let y = 0; y < 512; y += 32) {
      fCtx.fillStyle = 'rgba(130, 114, 92, 0.22)'
      fCtx.fillRect(0, y, 512, 2)
      bCtx.fillStyle = '#606060'
      bCtx.fillRect(0, y, 512, 2)
      const offset = (y / 32) % 2 === 0 ? 0 : 32
      for (let x = offset; x < 512; x += 64) {
        fCtx.fillStyle = 'rgba(120, 105, 85, 0.14)'
        fCtx.fillRect(x, y, 1.5, 32)
        bCtx.fillStyle = '#707070'
        bCtx.fillRect(x, y, 1.5, 32)
      }
    }

    // 4 stories of tall Parisian French windows (4 columns x 4 rows)
    const cols = 4
    const rows = 4
    const colW = 512 / cols
    const rowH = 512 / rows
    for (let r = 0; r < rows; r += 1) {
      // Cornice band at top of each floor
      fCtx.fillStyle = '#e4dac7'
      fCtx.fillRect(0, r * rowH, 512, 10)
      fCtx.fillStyle = 'rgba(85, 72, 58, 0.35)'
      fCtx.fillRect(0, r * rowH + 10, 512, 3)
      bCtx.fillStyle = '#c8c8c8'
      bCtx.fillRect(0, r * rowH, 512, 10)

      for (let c = 0; c < cols; c += 1) {
        const wx = c * colW + 34
        const wy = r * rowH + 26
        const ww = 60
        const wh = 86

        // Window limestone surround
        fCtx.fillStyle = '#e6decb'
        fCtx.fillRect(wx - 5, wy - 5, ww + 10, wh + 8)
        bCtx.fillStyle = '#b4b4b4'
        bCtx.fillRect(wx - 5, wy - 5, ww + 10, wh + 8)

        // Recessed window interior
        const lit = ((r * 7 + c * 13) % 5) !== 0
        fCtx.fillStyle = lit ? '#ffcf86' : '#2a3140'
        fCtx.fillRect(wx, wy, ww, wh)
        bCtx.fillStyle = '#383838'
        bCtx.fillRect(wx, wy, ww, wh)

        if (lit) {
          const grad = eCtx.createLinearGradient(wx, wy, wx, wy + wh)
          grad.addColorStop(0, '#ffd48e')
          grad.addColorStop(1, '#e89b48')
          eCtx.fillStyle = grad
          eCtx.fillRect(wx, wy, ww, wh)
        }

        // Dark French window frame & mullions
        fCtx.fillStyle = '#25262b'
        fCtx.fillRect(wx + ww / 2 - 2, wy, 4, wh)
        fCtx.fillRect(wx, wy + wh * 0.34, ww, 3)
        fCtx.fillRect(wx, wy + wh * 0.67, ww, 3)
        eCtx.fillStyle = '#181410'
        eCtx.fillRect(wx + ww / 2 - 2, wy, 4, wh)
        eCtx.fillRect(wx, wy + wh * 0.34, ww, 3)
        eCtx.fillRect(wx, wy + wh * 0.67, ww, 3)

        // Wrought-iron Juliet balcony grille at bottom of window
        fCtx.fillStyle = '#1c1e22'
        fCtx.fillRect(wx - 2, wy + wh - 24, ww + 4, 3)
        for (let bx = wx; bx <= wx + ww; bx += 7) {
          fCtx.fillRect(bx, wy + wh - 24, 2, 24)
        }
      }
    }
  }

  // 2. Zinc/Slate Mansard roof texture (256x256)
  const mansardCanvas = makeCanvas(256, 256)
  if (mansardCanvas) {
    const mCtx = mansardCanvas.getContext('2d')!
    mCtx.fillStyle = '#303946'
    mCtx.fillRect(0, 0, 256, 256)
    for (let x = 0; x < 256; x += 16) {
      mCtx.fillStyle = 'rgba(20, 24, 32, 0.45)'
      mCtx.fillRect(x, 0, 2, 256)
      mCtx.fillStyle = 'rgba(130, 148, 170, 0.16)'
      mCtx.fillRect(x + 2, 0, 2, 256)
    }
    for (let y = 0; y < 256; y += 24) {
      mCtx.fillStyle = 'rgba(18, 22, 28, 0.25)'
      mCtx.fillRect(0, y, 256, 1.5)
    }
  }

  // 3. Parisian cobblestone / granite quai pavement (256x256)
  const cobbleCanvas = makeCanvas(256, 256)
  if (cobbleCanvas) {
    const cCtx = cobbleCanvas.getContext('2d')!
    cCtx.fillStyle = '#5c5856'
    cCtx.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 16) {
      const shift = (y / 16) % 2 === 0 ? 0 : 12
      for (let x = -12 + shift; x < 256; x += 24) {
        const shade = 78 + ((x * 13 + y * 7) % 26)
        cCtx.fillStyle = `rgb(${shade + 4}, ${shade}, ${shade - 2})`
        cCtx.fillRect(x + 1, y + 1, 22, 14)
      }
    }
  }

  // 4. Champ de Mars manicured park lawn (256x256)
  const lawnCanvas = makeCanvas(256, 256)
  if (lawnCanvas) {
    const lCtx = lawnCanvas.getContext('2d')!
    lCtx.fillStyle = '#2d452c'
    lCtx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 650; i += 1) {
      const gx = (i * 73) % 256
      const gy = (i * 137) % 256
      lCtx.fillStyle = i % 2 === 0 ? 'rgba(68, 102, 58, 0.35)' : 'rgba(32, 52, 32, 0.35)'
      lCtx.fillRect(gx, gy, 3, 5)
    }
  }

  const facadeMap = toTexture(facCanvas, 1, 1, true)
  const facadeEmissive = toTexture(emCanvas, 1, 1, true)
  const facadeBump = toTexture(bumpCanvas, 1, 1, false)
  const mansardMap = toTexture(mansardCanvas, 3, 1, true)
  const groundCobbleMap = toTexture(cobbleCanvas, 26, 26, true)
  const lawnMap = toTexture(lawnCanvas, 10, 14, true)

  for (const t of [facadeMap, facadeEmissive, facadeBump, mansardMap, groundCobbleMap, lawnMap]) {
    if (t) disposable.push(t)
  }

  return {
    facadeMap,
    facadeEmissive,
    facadeBump,
    mansardMap,
    groundCobbleMap,
    lawnMap,
    dispose: () => {
      for (const t of disposable) t.dispose()
    },
  }
}

export interface HaussmannBuildingOpts {
  width?: number
  depth?: number
  floors?: number
  tint?: string
  storefrontColor?: string
  hasCafeAwning?: boolean
}

/** Builds a detailed Parisian Haussmann limestone block with ground-floor bistro, cornices, wrought-iron balconies, mansard roof, dormers & chimneys. */
export function createHaussmannBuilding(
  textures: HaussmannTextures,
  opts: HaussmannBuildingOpts = {},
): THREE.Group {
  const width = opts.width ?? 16
  const depth = opts.depth ?? 13
  const floors = opts.floors ?? 4
  const floorHeight = 3.2
  const groundHeight = 3.8
  const upperHeight = floors * floorHeight
  const mansardHeight = 3.4

  const group = new THREE.Group()
  group.name = 'haussmann-building'

  const limestoneMat = new THREE.MeshStandardMaterial({
    color: opts.tint ?? '#e2d7c4',
    map: textures.facadeMap,
    emissive: new THREE.Color('#ffbd6b'),
    emissiveMap: textures.facadeEmissive,
    emissiveIntensity: 0.72,
    bumpMap: textures.facadeBump,
    bumpScale: 0.08,
    roughness: 0.82,
    metalness: 0.04,
  })

  const trimMat = createMat('#e5dccb', { roughness: 0.78 })
  const ironMat = createMat('#1b1d22', { roughness: 0.45, metalness: 0.72 })
  const storefrontMat = createMat(opts.storefrontColor ?? '#2f1e22', { roughness: 0.58 })
  const shopWindowMat = createMat('#ffd48a', {
    emissive: '#ffb258',
    emissiveIntensity: 0.95,
    roughness: 0.2,
  })
  const mansardMat = applyPbrSet(
    new THREE.MeshStandardMaterial({
      color: '#3a4454',
      map: textures.mansardMap,
      roughness: 0.62,
      metalness: 0.25,
    }),
    'slate',
    3,
    1,
    { useDiffuse: false, normalScale: 0.55 },
  )

  // Ground floor storefront plinth
  const groundBody = new THREE.Mesh(
    new THREE.BoxGeometry(width, groundHeight, depth),
    storefrontMat,
  )
  groundBody.position.y = groundHeight / 2
  groundBody.castShadow = true
  groundBody.receiveShadow = true
  group.add(groundBody)

  // Glowing ground-floor shop/café display windows on front & back
  const paneCount = Math.max(2, Math.floor(width / 4.5))
  const paneW = (width - 2.2) / paneCount - 0.6
  for (const side of [-1, 1]) {
    const zFace = side * (depth / 2 + 0.04)
    for (let i = 0; i < paneCount; i += 1) {
      const px = -width / 2 + 1.4 + i * ((width - 2.2) / paneCount) + paneW / 2
      const pane = new THREE.Mesh(new THREE.BoxGeometry(paneW, 2.3, 0.08), shopWindowMat)
      pane.position.set(px, 1.55, zFace)
      group.add(pane)
    }
    if (opts.hasCafeAwning && side === 1) {
      const awningMat = createMat('#7a242c', { roughness: 0.88 })
      const awning = new THREE.Mesh(new THREE.BoxGeometry(width - 1.2, 0.14, 1.8), awningMat)
      awning.position.set(0, 2.95, depth / 2 + 0.85)
      awning.rotation.x = 0.28
      awning.castShadow = true
      group.add(awning)
    }
  }

  // Upper Haussmann limestone floors
  const upperBody = new THREE.Mesh(
    new THREE.BoxGeometry(width, upperHeight, depth),
    limestoneMat,
  )
  upperBody.position.y = groundHeight + upperHeight / 2
  upperBody.castShadow = true
  upperBody.receiveShadow = true
  group.add(upperBody)

  // Classic Haussmann protruding limestone cornice + continuous wrought-iron 2nd & top-floor balconies
  for (const balconyY of [groundHeight + 0.12, groundHeight + floorHeight * (floors - 1) + 0.12, groundHeight + upperHeight]) {
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.45, 0.24, depth + 0.45),
      trimMat,
    )
    ledge.position.y = balconyY
    ledge.castShadow = true
    group.add(ledge)

    if (balconyY < groundHeight + upperHeight) {
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(width + 0.35, 0.55, 0.06),
          ironMat,
        )
        rail.position.set(0, balconyY + 0.38, side * (depth / 2 + 0.22))
        group.add(rail)
      }
    }
  }

  // Sloped Mansard Roof (4-sided tapered prism)
  const mansardGeo = new THREE.CylinderGeometry(
    Math.SQRT1_2 * 0.86,
    Math.SQRT1_2,
    mansardHeight,
    4,
  )
  mansardGeo.rotateY(Math.PI / 4)
  const mansard = new THREE.Mesh(mansardGeo, mansardMat)
  mansard.scale.set(width + 0.3, 1, depth + 0.3)
  mansard.position.y = groundHeight + upperHeight + mansardHeight / 2
  mansard.castShadow = true
  mansard.receiveShadow = true
  group.add(mansard)

  // Attic dormer windows (lucarnes) along front & back of mansard roof
  const dormerCount = Math.max(2, Math.floor(width / 4.2))
  for (const side of [-1, 1]) {
    for (let i = 0; i < dormerCount; i += 1) {
      const dx = -width * 0.34 + (dormerCount === 1 ? 0 : (i / (dormerCount - 1)) * width * 0.68)
      const dormer = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.35, 1.1), trimMat)
      dormer.position.set(dx, groundHeight + upperHeight + 1.1, side * (depth * 0.46))
      const dormerPane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.1), shopWindowMat)
      dormerPane.position.set(dx, groundHeight + upperHeight + 1.05, side * (depth * 0.46 + 0.52))
      group.add(dormer, dormerPane)
    }
  }

  // Terracotta Parisian chimney stacks
  const chimneyMat = createMat('#b86b52', { roughness: 0.88 })
  for (const cx of [-width * 0.28, width * 0.28]) {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 0.7), trimMat)
    stack.position.set(cx, groundHeight + upperHeight + mansardHeight + 0.55, 0)
    group.add(stack)
    for (const potOffset of [-0.35, 0.35]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.65, 8), chimneyMat)
      pot.position.set(cx + potOffset, groundHeight + upperHeight + mansardHeight + 1.55, 0)
      group.add(pot)
    }
  }

  return group
}

/** Builds an organic multi-canopy Parisian Plane Tree (Platanus) instead of a cartoon ball tree. */
export function createParisianPlaneTree(scale = 1): THREE.Group {
  const tree = new THREE.Group()
  const barkMat = createMat('#6a6255', { roughness: 0.94 })
  const leafMat = createMat('#344830', { roughness: 0.86 })
  const leafLightMat = createMat('#3f5738', { roughness: 0.84 })

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.34 * scale, 4.4 * scale, 8),
    barkMat,
  )
  trunk.position.y = 2.2 * scale
  trunk.castShadow = true
  tree.add(trunk)

  // Three diverging main boughs
  for (const [bx, bz, rx, rz] of [
    [0.45, 0.25, 0.24, -0.35],
    [-0.4, 0.3, 0.28, 0.32],
    [0.05, -0.45, -0.32, 0.05],
  ] as const) {
    const bough = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, 2.2 * scale, 6),
      barkMat,
    )
    bough.position.set(bx * scale, 4.4 * scale, bz * scale)
    bough.rotation.set(rx, 0, rz)
    bough.castShadow = true
    tree.add(bough)
  }

  // Organic layered foliage clusters
  const clusters: Array<[number, number, number, number, boolean]> = [
    [0, 6.2, 0, 1.9, true],
    [-1.1, 5.5, 0.6, 1.45, false],
    [1.15, 5.6, 0.4, 1.5, true],
    [0.2, 5.7, -1.1, 1.4, false],
    [-0.5, 6.9, -0.3, 1.35, true],
  ]
  for (const [cx, cy, cz, r, isLight] of clusters) {
    const puff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r * scale, 1),
      isLight ? leafLightMat : leafMat,
    )
    puff.position.set(cx * scale, cy * scale, cz * scale)
    puff.scale.set(1.12, 0.78, 1.05)
    puff.castShadow = true
    puff.receiveShadow = true
    tree.add(puff)
  }

  return tree
}

/** Builds a classic Parisian cast-iron double-arm streetlamp with warm frosted globes & PointLight. */
export function createParisianLamp(glowTexture: THREE.Texture, addPointLight = true) {
  const lamp = new THREE.Group()
  const ironMat = createMat('#1d2321', { roughness: 0.42, metalness: 0.75 })
  const globeMat = createMat('#fff0ca', {
    emissive: '#ffc46b',
    emissiveIntensity: 1.6,
    roughness: 0.22,
  })

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.7, 8), ironMat)
  pedestal.position.y = 0.35
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 3.6, 8), ironMat)
  post.position.y = 2.5
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), ironMat)
  crossbar.position.y = 4.25
  lamp.add(pedestal, post, crossbar)

  for (const side of [-0.52, 0.52]) {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), globeMat)
    globe.position.set(side, 4.46, 0)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 8), ironMat)
    cap.position.set(side, 4.66, 0)
    const halo = makeGlowSprite(glowTexture, '#ffd48a', 2.4, 0.55)
    halo.position.set(side, 4.46, 0)
    lamp.add(globe, cap, halo)
  }

  if (addPointLight) {
    const pt = new THREE.PointLight('#ffc878', 2.2, 18, 1.6)
    pt.position.set(0, 4.3, 0)
    lamp.add(pt)
  }

  return { lamp, globeMat }
}

/** Builds a classic green Parisian Bouquiniste riverside bookstall. */
export function createBouquinisteStall(glowTexture: THREE.Texture) {
  const stall = new THREE.Group()
  const greenBoxMat = createMat('#223b2c', { roughness: 0.58, metalness: 0.25 })
  const woodMat = createMat('#6e4a2f', { roughness: 0.82 })
  const lampMat = createMat('#ffe4ad', {
    emissive: '#ffbd64',
    emissiveIntensity: 0.45,
    roughness: 0.25,
  })

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.15, 1.1), greenBoxMat)
  base.position.y = 0.575
  base.castShadow = true
  const lid = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.08, 1.15), greenBoxMat)
  lid.position.set(0, 1.65, -0.35)
  lid.rotation.x = -0.82
  const tray = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.9), woodMat)
  tray.position.set(0, 1.18, 0)
  stall.add(base, lid, tray)

  const bookColors = ['#8c3734', '#2e516e', '#b88c3e', '#435e3e', '#744b66']
  for (let i = 0; i < 10; i += 1) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.3, 0.42),
      createMat(bookColors[i % bookColors.length], { roughness: 0.88 }),
    )
    book.position.set(-1.25 + i * 0.27, 1.36, 0.08)
    stall.add(book)
  }

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat)
  bulb.position.set(0, 1.95, -0.05)
  const halo = makeGlowSprite(glowTexture, '#ffd58f', 1.4, 0.22)
  halo.position.set(0, 1.95, -0.05)
  stall.add(bulb, halo)

  return { stall, lampMat }
}

/** Builds a classic Parisian Davioud park bench. */
export function createParisianBench(): THREE.Group {
  const bench = new THREE.Group()
  const woodMat = createMat('#6a452a', { roughness: 0.78 })
  const ironMat = createMat('#203329', { roughness: 0.48, metalness: 0.65 })

  for (let i = 0; i < 4; i += 1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.14), woodMat)
    slat.position.set(0, 0.46, -0.22 + i * 0.15)
    slat.castShadow = true
    bench.add(slat)
  }
  for (let i = 0; i < 3; i += 1) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.06), woodMat)
    back.position.set(0, 0.68 + i * 0.16, 0.3)
    back.castShadow = true
    bench.add(back)
  }
  for (const x of [-0.85, 0.85]) {
    const frontLeg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.08), ironMat)
    frontLeg.position.set(x, 0.23, -0.2)
    const backLeg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.92, 0.08), ironMat)
    backLeg.position.set(x, 0.46, 0.28)
    bench.add(frontLeg, backLeg)
  }
  return bench
}

/** Builds a small Parisian sidewalk bistro table & two chairs for café terraces. */
export function createParisianBistroSet(): THREE.Group {
  const set = new THREE.Group()
  const ironMat = createMat('#1e2226', { roughness: 0.45, metalness: 0.7 })
  const topMat = createMat('#e5ddd0', { roughness: 0.4 })
  const seatMat = createMat('#6e2b30', { roughness: 0.78 })

  const tablePed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.16, 0.72, 8), ironMat)
  tablePed.position.y = 0.36
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), topMat)
  tableTop.position.y = 0.74
  set.add(tablePed, tableTop)

  for (const sx of [-0.62, 0.62]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6), ironMat)
    leg.position.set(sx, 0.22, 0)
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), seatMat)
    seat.position.set(sx, 0.46, 0)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.34), seatMat)
    back.position.set(sx + (sx > 0 ? 0.18 : -0.18), 0.68, 0)
    set.add(leg, seat, back)
  }
  return set
}
