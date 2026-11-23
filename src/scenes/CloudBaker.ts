import * as THREE from 'three'

// 16 条水平切片烘焙的体云：只存与光照无关的几何信息，
// 颜色留给天空着色器按当前日照实时计算（RGBA8，避免移动端浮点纹理兼容问题）。

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy
}

function fbm(x: number, y: number, octaves = 4) {
  let value = 0
  let amp = 0.5
  let fx = x
  let fy = y
  for (let i = 0; i < octaves; i += 1) {
    value += amp * valueNoise(fx, fy)
    fx = fx * 2.03 + 11.3
    fy = fy * 2.03 + 7.7
    amp *= 0.5
  }
  return value
}

export interface CloudFieldSize {
  width: number
  height: number
}

export function bakeCloudField({ width, height }: CloudFieldSize): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4)
  const slices = 16
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width
      let density = 0
      let cover = 0
      let top = 0
      for (let s = 0; s < slices; s += 1) {
        const h = (s + 0.5) / slices
        const warp = fbm(u * 3.1 + h * 1.7, v * 3.1 - h * 1.1, 3)
        const d = fbm(u * 2.4 + warp * 1.4, v * 5.6 + h * 2.3, 4)
        const band = Math.max(0, 1 - Math.abs(v - 0.5) * 2.1)
        const shaped = Math.max(0, d - 0.42) * 2.1 * band
        density += shaped
        cover = Math.max(cover, shaped)
        top += shaped * (1 - h)
      }
      density /= slices
      const cirrus = Math.max(0, fbm(u * 6.2 + 31.7, v * 1.8 + 4.3, 3) - 0.55) * 2.6
      const offset = (y * width + x) * 4
      data[offset] = Math.max(0, Math.min(255, Math.round(density * 300)))
      data[offset + 1] = Math.max(0, Math.min(255, Math.round(cover * 255)))
      data[offset + 2] = Math.max(0, Math.min(255, Math.round((top / slices) * 320)))
      data[offset + 3] = Math.max(0, Math.min(255, Math.round(cirrus * 180)))
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}
