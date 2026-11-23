import * as THREE from 'three'

// 256×256 的踩踏尾迹：128/255 为中性，ping-pong 双缓冲，
// 每帧写入玩家与指针在地面上的线段，约 1.4 秒自然回弹。

const SPAN = 220
const CENTER = { x: 0, z: -42 }

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uPrev;
  uniform vec2 uPlayer;
  uniform vec2 uPrevPlayer;
  uniform vec2 uCursor;
  uniform vec2 uPrevCursor;
  uniform float uActive;
  uniform float uOriginZ;
  uniform float uSpan;
  varying vec2 vUv;

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 world = vec2(vUv.x, vUv.y) * uSpan + vec2(-uSpan * 0.5, uOriginZ);
    vec4 prev = texture2D(uPrev, vUv);
    vec2 push = (prev.rg - 0.5) * 2.0;
    push *= 0.978;
    if (abs(push.x) < 0.004) push.x = 0.0;
    if (abs(push.y) < 0.004) push.y = 0.0;

    if (uActive > 0.5) {
      float dPlayer = segDist(world, uPrevPlayer, uPlayer);
      float dCursor = segDist(world, uPrevCursor, uCursor);
      vec2 dirPlayer = normalize(world - (uPrevPlayer + uPlayer) * 0.5 + vec2(0.001));
      vec2 dirCursor = normalize(world - (uPrevCursor + uCursor) * 0.5 + vec2(0.001));
      push += dirPlayer * exp(-dPlayer * dPlayer * 3.2) * 0.55;
      push += dirCursor * exp(-dCursor * dCursor * 5.0) * 0.4;
    }

    push = clamp(push, vec2(-1.0), vec2(1.0));
    gl_FragColor = vec4(push * 0.5 + 0.5, 0.0, 1.0);
  }
`

export class WakeField {
  private targets: THREE.WebGLRenderTarget[]
  private quad: THREE.Mesh
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material: THREE.ShaderMaterial
  private index = 0
  private prevPlayer = new THREE.Vector2(9999, 9999)
  private prevCursor = new THREE.Vector2(9999, 9999)
  private hasPrev = false

  readonly originZ = CENTER.z - SPAN / 2
  readonly span = SPAN

  constructor() {
    const make = () =>
      new THREE.WebGLRenderTarget(256, 256, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      })
    this.targets = [make(), make()]
    for (const target of this.targets) {
      const renderer = target as unknown as { texture: THREE.Texture }
      renderer.texture.needsUpdate = true
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uPlayer: { value: new THREE.Vector2(9999, 9999) },
        uPrevPlayer: { value: new THREE.Vector2(9999, 9999) },
        uCursor: { value: new THREE.Vector2(9999, 9999) },
        uPrevCursor: { value: new THREE.Vector2(9999, 9999) },
        uActive: { value: 0 },
        uOriginZ: { value: this.originZ },
        uSpan: { value: SPAN },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }

  get texture(): THREE.Texture {
    return this.targets[this.index].texture
  }

  update(
    renderer: THREE.WebGLRenderer,
    player: THREE.Vector2,
    cursor: THREE.Vector2,
    active: boolean,
  ) {
    const next = (this.index + 1) % 2
    const uniforms = this.material.uniforms
    uniforms.uPrev.value = this.targets[this.index].texture
    uniforms.uPlayer.value.copy(player)
    uniforms.uCursor.value.copy(cursor)
    if (!this.hasPrev) {
      this.prevPlayer.copy(player)
      this.prevCursor.copy(cursor)
      this.hasPrev = true
    }
    uniforms.uPrevPlayer.value.copy(this.prevPlayer)
    uniforms.uPrevCursor.value.copy(this.prevCursor)
    uniforms.uActive.value = active ? 1 : 0

    const previousTarget = renderer.getRenderTarget()
    renderer.setRenderTarget(this.targets[next])
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(previousTarget)

    this.prevPlayer.copy(player)
    this.prevCursor.copy(cursor)
    this.index = next
  }

  dispose() {
    this.targets.forEach((target) => target.dispose())
    this.material.dispose()
    this.quad.geometry.dispose()
  }
}
