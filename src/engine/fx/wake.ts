import * as THREE from 'three'
import { SHARED_UNIFORMS } from '../core/ctx'

/**
 * 持久草原尾迹场（双缓冲世界像素对齐 Ping-Pong Texture，借鉴 Petalwake `fx/wake.js`）。
 *
 * 在玩家周围 72m×72m 按纹素整格吸附对齐的 256×256 缓冲中，写入脚步路径与
 * 指针轻抚轨迹的倾倒向量 (RG, 中性 128/255=0) 与踩压程度 (B)，约 1.5s 自然回弹。
 */
export class WakeField {
  private readonly renderer: THREE.WebGLRenderer
  private readonly size = 256
  private readonly extent = 72
  private readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  private readonly clearMat: THREE.ShaderMaterial
  private readonly updateMat: THREE.ShaderMaterial
  private readonly quad: THREE.Mesh
  private readonly scene = new THREE.Scene()
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  private outIdx = 0
  private centerX = 0
  private centerZ = 0
  private hasPlayerPrev = false
  private prevPlayerX = 0
  private prevPlayerZ = 0
  private hasCursorPrev = false
  private prevCursorX = 999
  private prevCursorZ = 999
  private initializedCenter = false
  private disposed = false

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    const opts: THREE.RenderTargetOptions = {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    }

    this.targets = [
      new THREE.WebGLRenderTarget(this.size, this.size, opts),
      new THREE.WebGLRenderTarget(this.size, this.size, opts),
    ]

    const tri = new THREE.BufferGeometry()
    tri.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    )

    const quadVert = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `

    this.clearMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        precision highp float;
        void main() {
          gl_FragColor = vec4(128.0 / 255.0, 128.0 / 255.0, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })

    this.updateMat = new THREE.ShaderMaterial({
      uniforms: {
        tPrev: { value: this.targets[0].texture },
        uShift: { value: new THREE.Vector2() },
        uCenter: { value: new THREE.Vector2() },
        uExtent: { value: this.extent },
        uDecay: { value: 0.96 },
        uSegA: { value: new THREE.Vector4() },
        uParamsA: { value: new THREE.Vector4(1.65, 0.94, 0.65, 0) },
        uSegB: { value: new THREE.Vector4() },
        uParamsB: { value: new THREE.Vector4(2.15, 0.86, 0.42, 0) },
      },
      vertexShader: quadVert,
      fragmentShader: WAKE_UPDATE_FRAG,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })

    this.quad = new THREE.Mesh(tri, this.clearMat)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
    this.reset()
  }

  reset() {
    if (this.disposed) return
    const r = this.renderer
    const prevTarget = r.getRenderTarget()
    const prevAutoClear = r.autoClear

    this.quad.material = this.clearMat
    r.autoClear = false
    for (const target of this.targets) {
      r.setRenderTarget(target)
      r.render(this.scene, this.cam)
    }

    r.setRenderTarget(prevTarget)
    r.autoClear = prevAutoClear
    this.hasPlayerPrev = false
    this.hasCursorPrev = false
    this.initializedCenter = false
    SHARED_UNIFORMS.uWakeTex.value = this.targets[this.outIdx].texture
    SHARED_UNIFORMS.uWake.value.w = 0
  }

  update(
    dt: number,
    active: boolean,
    playerX: number,
    playerZ: number,
    cursorX: number,
    cursorZ: number,
    cursorActive: boolean,
  ) {
    if (this.disposed) return
    if (!active) {
      SHARED_UNIFORMS.uWake.value.w = 0
      return
    }

    const texelWorld = this.extent / this.size
    const nextCX = Math.round(playerX / texelWorld) * texelWorld
    const nextCZ = Math.round(playerZ / texelWorld) * texelWorld

    const prevCX = this.initializedCenter ? this.centerX : nextCX
    const prevCZ = this.initializedCenter ? this.centerZ : nextCZ
    this.initializedCenter = true

    const shiftX = (nextCX - prevCX) / this.extent
    const shiftZ = (nextCZ - prevCZ) / this.extent
    this.centerX = nextCX
    this.centerZ = nextCZ

    const u = this.updateMat.uniforms
    u.uShift.value.set(shiftX, shiftZ)
    u.uCenter.value.set(nextCX, nextCZ)
    u.uDecay.value = Math.exp(-Math.max(0.001, dt) / 1.5)

    if (!this.hasPlayerPrev) {
      this.prevPlayerX = playerX
      this.prevPlayerZ = playerZ
      this.hasPlayerPrev = true
    }
    const pJump = Math.hypot(playerX - this.prevPlayerX, playerZ - this.prevPlayerZ)
    u.uSegA.value.set(
      pJump > 10 ? playerX : this.prevPlayerX,
      pJump > 10 ? playerZ : this.prevPlayerZ,
      playerX,
      playerZ,
    )
    u.uParamsA.value.set(1.68, 0.94, 0.65, 1)
    this.prevPlayerX = playerX
    this.prevPlayerZ = playerZ

    if (cursorActive && cursorX < 450 && cursorZ < 450) {
      if (!this.hasCursorPrev) {
        this.prevCursorX = cursorX
        this.prevCursorZ = cursorZ
        this.hasCursorPrev = true
      }
      const cJump = Math.hypot(cursorX - this.prevCursorX, cursorZ - this.prevCursorZ)
      u.uSegB.value.set(
        cJump > 12 ? cursorX : this.prevCursorX,
        cJump > 12 ? cursorZ : this.prevCursorZ,
        cursorX,
        cursorZ,
      )
      u.uParamsB.value.set(2.15, 0.85, 0.42, 1)
      this.prevCursorX = cursorX
      this.prevCursorZ = cursorZ
    } else {
      this.hasCursorPrev = false
      u.uParamsB.value.w = 0
    }

    const read = this.targets[this.outIdx]
    const write = this.targets[1 - this.outIdx]
    u.tPrev.value = read.texture

    const r = this.renderer
    const prevTarget = r.getRenderTarget()
    const prevAutoClear = r.autoClear

    this.quad.material = this.updateMat
    r.autoClear = false
    r.setRenderTarget(write)
    r.render(this.scene, this.cam)

    r.setRenderTarget(prevTarget)
    r.autoClear = prevAutoClear
    this.outIdx = 1 - this.outIdx

    SHARED_UNIFORMS.uWakeTex.value = this.targets[this.outIdx].texture
    SHARED_UNIFORMS.uWake.value.set(this.centerX, this.centerZ, 1 / this.extent, 1)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.quad.geometry.dispose()
    this.clearMat.dispose()
    this.updateMat.dispose()
    this.targets[0].dispose()
    this.targets[1].dispose()
    this.scene.clear()
  }
}

const WAKE_UPDATE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tPrev;
uniform vec2 uShift;
uniform vec2 uCenter;
uniform float uExtent;
uniform float uDecay;
uniform vec4 uSegA;
uniform vec4 uParamsA;
uniform vec4 uSegB;
uniform vec4 uParamsB;

void stampSegment(vec2 worldXZ, vec4 seg, vec4 params, inout vec2 lean, inout float crush) {
  if (params.w < 0.5) return;
  vec2 a = seg.xy;
  vec2 b = seg.zw;
  vec2 ab = b - a;
  float len2 = dot(ab, ab);
  float t = len2 > 1e-6 ? clamp(dot(worldXZ - a, ab) / len2, 0.0, 1.0) : 0.0;
  vec2 closest = a + ab * t;
  vec2 diff = worldXZ - closest;
  float dist = length(diff);
  float radius = params.x;
  if (dist >= radius) return;

  float k = 1.0 - dist / radius;
  float w = pow(k, 1.35) * params.y;
  vec2 side = dist > 0.001 ? diff / dist : vec2(0.0, 1.0);
  vec2 forward = len2 > 1e-6 ? normalize(ab) : vec2(0.0);
  vec2 push = normalize(side + forward * 0.25 + vec2(1e-5)) * w;

  float magPush = length(push);
  float magCur = length(lean);
  if (magPush >= magCur) {
    lean = mix(lean, push, 0.72);
  } else {
    lean += push * 0.25;
  }
  crush = max(crush, k * params.z);
}

void main() {
  vec2 prevUv = vUv + uShift;
  vec2 lean = vec2(0.0);
  float crush = 0.0;

  if (prevUv.x > 0.0 && prevUv.x < 1.0 && prevUv.y > 0.0 && prevUv.y < 1.0) {
    vec4 s = texture2D(tPrev, prevUv);
    lean = ((s.rg * 255.0 - 128.0) / 127.0) * uDecay;
    crush = s.b * uDecay;
    if (length(lean) < 0.012) lean = vec2(0.0);
    if (crush < 0.01) crush = 0.0;
  }

  vec2 worldXZ = uCenter + (vUv - 0.5) * uExtent;
  stampSegment(worldXZ, uSegA, uParamsA, lean, crush);
  stampSegment(worldXZ, uSegB, uParamsB, lean, crush);

  float mag = length(lean);
  if (mag > 1.0) lean /= mag;

  vec2 rg = (lean * 127.0 + 128.0) / 255.0;
  gl_FragColor = vec4(clamp(rg, 0.0, 1.0), clamp(crush, 0.0, 1.0), 1.0);
}
`
