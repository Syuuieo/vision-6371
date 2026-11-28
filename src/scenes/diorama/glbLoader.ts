import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { DioramaBuilderCtx } from './types'

let sharedLoader: GLTFLoader | null = null
const templateCache = new Map<string, Promise<THREE.Group>>()

function getGlbLoader(): GLTFLoader {
  if (!sharedLoader) {
    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    loader.setDRACOLoader(draco)
    sharedLoader = loader
  }
  return sharedLoader
}

/**
 * 异步加载并缓存 GLB 模板（自动在 Vitest/Node 无 DOM 环境下安全降级）。
 */
export function loadGlbTemplate(url: string): Promise<THREE.Group> {
  if (typeof window === 'undefined') {
    return Promise.resolve(new THREE.Group())
  }
  const existing = templateCache.get(url)
  if (existing) return existing

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    getGlbLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene || new THREE.Group()
        resolve(root)
      },
      undefined,
      (err) => {
        templateCache.delete(url)
        reject(err)
      },
    )
  })
  templateCache.set(url, promise)
  return promise
}

export interface PlaceGlbOptions {
  pos?: [number, number, number]
  rotY?: number
  targetHeight?: number
  scale?: number
  ground?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  onLoaded?: (instance: THREE.Group) => void
}

/**
 * 异步放置 GLB 实体到指定父节点：自动等比缩放到 targetHeight 并贴地对齐，切换场景时自动取消挂载。
 */
export function placeGlbModel(
  ctx: DioramaBuilderCtx,
  parent: THREE.Object3D,
  url: string,
  opts: PlaceGlbOptions = {},
): THREE.Group {
  const anchor = new THREE.Group()
  if (opts.pos) anchor.position.set(...opts.pos)
  if (opts.rotY !== undefined) anchor.rotation.y = opts.rotY
  parent.add(anchor)

  if (typeof window === 'undefined') {
    return anchor
  }

  let disposed = false
  ctx.addDisposeHook?.(() => {
    disposed = true
  })

  void loadGlbTemplate(url)
    .then((template) => {
      if (disposed) return
      const instance = template.clone(true)

      if (opts.targetHeight && opts.targetHeight > 0) {
        const box = new THREE.Box3().setFromObject(instance)
        const h = box.max.y - box.min.y
        if (h > 0.0001) {
          instance.scale.setScalar(opts.targetHeight / h)
        }
      } else if (opts.scale !== undefined) {
        instance.scale.setScalar(opts.scale)
      }

      if (opts.ground !== false) {
        instance.updateMatrixWorld(true)
        const groundedBox = new THREE.Box3().setFromObject(instance)
        if (Number.isFinite(groundedBox.min.y)) {
          instance.position.y -= groundedBox.min.y
        }
      }

      const cast = opts.castShadow ?? true
      const receive = opts.receiveShadow ?? true
      instance.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = cast
          obj.receiveShadow = receive
        }
      })

      anchor.add(instance)
      opts.onLoaded?.(instance)
    })
    .catch(() => {
      /* ignore failed optional model load */
    })

  return anchor
}
