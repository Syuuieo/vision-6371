import * as THREE from 'three'

export type PbrSetName = 'cobble' | 'limestone' | 'snow' | 'slate' | 'grass'

interface CachedPbrSet {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

const cache = new Map<PbrSetName, CachedPbrSet>()
let loader: THREE.TextureLoader | null = null

function getSet(name: PbrSetName): CachedPbrSet | null {
  if (typeof window === 'undefined') return null
  const existing = cache.get(name)
  if (existing) return existing
  if (!loader) loader = new THREE.TextureLoader()

  const loadTex = (file: string, srgb: boolean) => {
    const tex = loader!.load(`/textures/pbr/${name}/${file}.jpg`)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const entry: CachedPbrSet = {
    map: loadTex('diffuse', true),
    normalMap: loadTex('nor_gl', false),
    roughnessMap: loadTex('rough', false),
  }
  cache.set(name, entry)
  return entry
}

/**
 * Applies a cached PolyHaven 1K CC0 PBR texture set (diffuse + normal + roughness)
 * onto a MeshStandardMaterial with custom tiling. Safe no-op in Node/Vitest.
 */
export function applyPbrSet(
  material: THREE.MeshStandardMaterial,
  setName: PbrSetName,
  repeatX = 1,
  repeatY = 1,
  options: { useDiffuse?: boolean; normalScale?: number } = {},
) {
  const set = getSet(setName)
  if (!set) return material

  const cloneWithRepeat = (base: THREE.Texture, srgb: boolean) => {
    const t = base.clone()
    t.repeat.set(repeatX, repeatY)
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    return t
  }

  if (options.useDiffuse !== false) {
    material.map = cloneWithRepeat(set.map, true)
  }
  material.normalMap = cloneWithRepeat(set.normalMap, false)
  material.normalScale.setScalar(options.normalScale ?? 0.65)
  material.roughnessMap = cloneWithRepeat(set.roughnessMap, false)
  material.needsUpdate = true
  return material
}
