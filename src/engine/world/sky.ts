import * as THREE from 'three'
import { SHARED_UNIFORMS, shared } from '../core/ctx'
import { GLSL_ATMOSPHERE, GLSL_CLOUD_LOOKUP, GLSL_NOISE } from '../shaders/common'

interface ConstellationStar {
  core: THREE.Mesh
  halo: THREE.Sprite
  hit: THREE.Mesh
  index: number
  picked: boolean
  phase: number
}

/**
 * 全景射线天空 + 体积云着色 + 银河 + 繁星 + 第七幕互动星座 + 暮色流星。
 *
 * 采用 Petalwake 全屏 NDC 逆投影天空盒写法，不产生球面网格畸变，且保持
 * depthWrite=false 以便深度缓冲中的远景保留为 uFar，使后处理圣光准确识别天际轮廓。
 */
export class SkyWorld {
  readonly skyGroup = new THREE.Group()
  readonly constellationGroup = new THREE.Group()
  readonly meteorGroup = new THREE.Group()

  private readonly skyMaterial: THREE.ShaderMaterial
  private readonly starMaterial: THREE.ShaderMaterial
  private readonly starBoost = { value: 1 }
  private readonly pixelUniform = { value: 1 }
  private readonly glowTexture: THREE.Texture

  private constellationStars: ConstellationStar[] = []
  private constellationLines: THREE.Mesh[] = []
  private constellationActive = false
  private constellationPicked = 0
  private constellationOrder: number[] = []

  private meteorHead: THREE.Sprite | null = null
  private meteorCore: THREE.Sprite | null = null
  private meteorTail: THREE.Line | null = null
  private meteorStreak: THREE.Mesh | null = null
  private meteorStreakMat: THREE.ShaderMaterial | null = null
  private meteorActive = false
  meteorRunning = false
  private meteorIsWish = false
  private meteorDuration = 1.5
  private meteorCooldown = 7
  private meteorProgress = 0
  private readonly meteorStart = new THREE.Vector3()
  private readonly meteorEnd = new THREE.Vector3()

  constructor(
    surfaceGroup: THREE.Group,
    pickables: THREE.Object3D[],
    glowTexture: THREE.Texture,
    lowDetail: boolean,
    pixelRatio: number,
  ) {
    this.glowTexture = glowTexture
    this.pixelUniform.value = pixelRatio
    surfaceGroup.add(this.skyGroup)

    // 1. 全屏射线天空
    const tri = new THREE.BufferGeometry()
    tri.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    )

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...shared(
          'uTime',
          'uCamPos',
          'uSunDir',
          'uSunColor',
          'uSunPower',
          'uSkyZenith',
          'uSkyMid',
          'uSkyHorizon',
          'uSunHalo',
          'uAmbSky',
          'uAmbGround',
          'uFogColor',
          'uFog',
          'uGalaxy',
          'uGalaxyBoost',
          'uCloudTex',
          'uCloudReady',
        ),
        uProjInv: { value: new THREE.Vector2(1, 1) },
        uCamWorld: { value: new THREE.Matrix4() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vNdc;
        void main() {
          vNdc = position.xy;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: SKY_FRAG,
      depthTest: false,
      depthWrite: false,
    })

    const skyMesh = new THREE.Mesh(tri, this.skyMaterial)
    skyMesh.frustumCulled = false
    skyMesh.renderOrder = -1000
    skyMesh.onBeforeRender = (_r, _s, camera) => {
      const u = this.skyMaterial.uniforms
      u.uProjInv.value.set(
        1 / camera.projectionMatrix.elements[0],
        1 / camera.projectionMatrix.elements[5],
      )
      u.uCamWorld.value.copy(camera.matrixWorld)
      this.skyMaterial.uniformsNeedUpdate = true
    }
    this.skyGroup.add(skyMesh)

    // 2. 繁星穹顶
    this.starMaterial = this.buildStars(lowDetail)

    // 3. 互动星座与流星挂载到地表空间，由地表遮挡判断自然生效
    this.constellationGroup.visible = false
    surfaceGroup.add(this.constellationGroup)
    this.buildMeteor(surfaceGroup, pickables)
  }

  private buildStars(lowDetail: boolean) {
    const count = lowDetail ? 2000 : 4200
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const bandNormal = new THREE.Vector3(0.32, 0.62, 0.72).normalize()
    const color = new THREE.Color()

    for (let i = 0; i < count; i += 1) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize()
      if (i % 3 === 0) {
        const d = dir.dot(bandNormal)
        dir.addScaledVector(bandNormal, -d * 0.82).normalize()
        dir.y = Math.abs(dir.y) * 0.9 + 0.02
        dir.normalize()
      }
      dir.multiplyScalar(760)
      positions[i * 3] = dir.x
      positions[i * 3 + 1] = dir.y
      positions[i * 3 + 2] = dir.z

      const tint = Math.random()
      if (tint > 0.86) color.set('#ffd7ad')
      else if (tint > 0.72) color.set('#bcd4ff')
      else color.set('#eef4ff')
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      sizes[i] = 0.65 + Math.pow(Math.random(), 2.5) * 3.5
      phases[i] = Math.random() * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared('uTime', 'uStars'),
        uBoost: this.starBoost,
        uPixel: this.pixelUniform,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixel;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float twinkle = 0.62 + 0.38 * sin(uTime * (0.7 + fract(aPhase) * 1.9) + aPhase * 6.283);
          gl_PointSize = aSize * uPixel * (1300.0 / max(1.0, -mv.z));
          vAlpha = twinkle;
          vColor = aColor;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStars;
        uniform float uBoost;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          float flare = (1.0 - smoothstep(0.0, 0.5, abs(p.x) * 9.0)) * (1.0 - smoothstep(0.0, 0.5, abs(p.y) * 2.4));
          float alpha = (core * 0.85 + flare * 0.32) * vAlpha * uStars * uBoost;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = -990
    this.skyGroup.add(points)
    return material
  }

  private buildMeteor(surfaceGroup: THREE.Group, pickables: THREE.Object3D[]) {
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#dce9ff',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    head.scale.setScalar(4.4)
    this.meteorGroup.add(head)
    this.meteorHead = head

    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: '#ffffff',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    core.scale.setScalar(2.0)
    this.meteorGroup.add(core)
    this.meteorCore = core

    const tailGeometry = new THREE.BufferGeometry()
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const tail = new THREE.Line(
      tailGeometry,
      new THREE.LineBasicMaterial({
        color: '#cfe0ff',
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.meteorGroup.add(tail)

    const streakGeo = new THREE.ConeGeometry(1, 1, 8, 1, true)
    streakGeo.translate(0, 0.5, 0)
    const streakMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#cfe0ff') },
        uOpacity: { value: 0.45 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float fade = pow(1.0 - vUv.y, 1.85);
          vec3 col = mix(vec3(1.0, 0.99, 0.95), uColor, clamp(vUv.y * 1.4, 0.0, 1.0));
          float alpha = fade * uOpacity;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
    const streak = new THREE.Mesh(streakGeo, streakMat)
    streak.frustumCulled = false
    this.meteorGroup.add(streak)
    this.meteorStreak = streak
    this.meteorStreakMat = streakMat

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(9.5, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    hit.userData.pick = 'meteor'
    this.meteorGroup.add(hit)
    pickables.push(hit)
    this.meteorGroup.visible = false
    this.meteorTail = tail
    surfaceGroup.add(this.meteorGroup)
  }

  setPixelRatio(pixelRatio: number) {
    this.pixelUniform.value = pixelRatio
  }

  setMeteorActive(active: boolean) {
    this.meteorActive = active
    if (!active && !this.meteorIsWish) this.hideMeteor()
  }

  hideMeteor() {
    this.meteorRunning = false
    this.meteorIsWish = false
    this.meteorGroup.visible = false
    this.meteorCooldown = 9 + Math.random() * 8
  }

  launchWishMeteor(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld()
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up)
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0)
    else right.normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()

    const side = Math.random() > 0.5 ? 1 : -1
    const start = camera.position
      .clone()
      .addScaledVector(forward, 190)
      .addScaledVector(right, -side * (38 + Math.random() * 18))
      .addScaledVector(up, 34 + Math.random() * 16)
    start.y = Math.max(start.y, camera.position.y + 24)

    const end = start
      .clone()
      .addScaledVector(right, side * (95 + Math.random() * 35))
      .addScaledVector(up, -22 - Math.random() * 14)

    this.meteorStart.copy(start)
    this.meteorEnd.copy(end)
    this.meteorProgress = 0
    this.meteorDuration = 1.6
    this.meteorIsWish = true
    this.meteorRunning = true
    this.meteorGroup.visible = true
    this.meteorGroup.position.copy(start)

    this.configureMeteorVisuals(start, end, true)
    this.applyMeteorEnvelope(0.2)

    SHARED_UNIFORMS.uGalaxyBoost.value = Math.max(SHARED_UNIFORMS.uGalaxyBoost.value, 0.45)
    this.starBoost.value = Math.max(this.starBoost.value, 1.38)
  }

  private configureMeteorVisuals(start: THREE.Vector3, end: THREE.Vector3, isWish: boolean) {
    const tailDirection = start.clone().sub(end).normalize()
    const tailLen = isWish ? 36 : 26

    if (this.meteorHead) {
      const mat = this.meteorHead.material as THREE.SpriteMaterial
      mat.color.set(isWish ? '#fff2cc' : '#dce9ff')
      this.meteorHead.scale.setScalar(isWish ? 7.8 : 4.4)
    }
    if (this.meteorCore) {
      const mat = this.meteorCore.material as THREE.SpriteMaterial
      mat.color.set('#ffffff')
      this.meteorCore.scale.setScalar(isWish ? 3.4 : 2.0)
    }
    if (this.meteorTail) {
      const mat = this.meteorTail.material as THREE.LineBasicMaterial
      mat.color.set(isWish ? '#ffe9b5' : '#cfe0ff')
      const attribute = this.meteorTail.geometry.attributes.position as THREE.BufferAttribute
      attribute.setXYZ(0, 0, 0, 0)
      attribute.setXYZ(1, tailDirection.x * tailLen, tailDirection.y * tailLen, tailDirection.z * tailLen)
      attribute.needsUpdate = true
    }
    if (this.meteorStreak && this.meteorStreakMat) {
      this.meteorStreakMat.uniforms.uColor.value.set(isWish ? '#ffe3a3' : '#cfe0ff')
      const radius = isWish ? 1.15 : 0.55
      this.meteorStreak.scale.set(radius, tailLen * 1.06, radius)
      this.meteorStreak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tailDirection)
    }
  }

  private applyMeteorEnvelope(env: number) {
    const isWish = this.meteorIsWish
    if (this.meteorHead) {
      ;(this.meteorHead.material as THREE.SpriteMaterial).opacity = (isWish ? 1.0 : 0.95) * env
    }
    if (this.meteorCore) {
      ;(this.meteorCore.material as THREE.SpriteMaterial).opacity = (isWish ? 1.0 : 0.85) * env
    }
    if (this.meteorTail) {
      ;(this.meteorTail.material as THREE.LineBasicMaterial).opacity = (isWish ? 0.95 : 0.65) * env
    }
    if (this.meteorStreakMat) {
      this.meteorStreakMat.uniforms.uOpacity.value = (isWish ? 0.86 : 0.45) * env
    }
  }

  boostGalaxy() {
    SHARED_UNIFORMS.uGalaxyBoost.value = 0.9
    this.starBoost.value = 1.25
  }

  setConstellationActive(
    active: boolean,
    camera: THREE.PerspectiveCamera,
    pickables: THREE.Object3D[],
  ) {
    if (!active) {
      this.clearConstellation(pickables)
      this.constellationActive = false
      this.constellationGroup.visible = false
      return
    }
    if (this.constellationActive) return
    this.constellationActive = true
    this.clearConstellation(pickables)
    this.createConstellationStars(camera, pickables)
    this.constellationGroup.visible = true
    this.meteorActive = true
  }

  private clearConstellation(pickables: THREE.Object3D[]) {
    for (const line of this.constellationLines) {
      this.constellationGroup.remove(line)
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    }
    this.constellationLines = []
    for (const star of this.constellationStars) {
      this.constellationGroup.remove(star.core, star.halo, star.hit)
      star.core.geometry.dispose()
      ;(star.core.material as THREE.Material).dispose()
      ;(star.halo.material as THREE.Material).dispose()
      ;(star.hit.material as THREE.Material).dispose()
      const idx = pickables.indexOf(star.hit)
      if (idx >= 0) pickables.splice(idx, 1)
    }
    this.constellationStars = []
    this.constellationPicked = 0
    this.constellationOrder = []
  }

  private createConstellationStars(camera: THREE.PerspectiveCamera, pickables: THREE.Object3D[]) {
    this.constellationGroup.visible = true
    camera.updateMatrixWorld()
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    const base = camera.position.clone().addScaledVector(forward, 175)
    const offsets = [
      new THREE.Vector3(-42, 16, 0),
      new THREE.Vector3(40, -3, 0),
      new THREE.Vector3(0, 58, 0),
    ]
    const colors = ['#ffe4b5', '#cfe1ff', '#ffd2df']
    offsets.forEach((offset, index) => {
      const position = base
        .clone()
        .addScaledVector(right, offset.x)
        .addScaledVector(up, offset.y)
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 12, 10),
        new THREE.MeshBasicMaterial({ color: colors[index] }),
      )
      core.position.copy(position)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: colors[index],
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      halo.position.copy(position)
      halo.scale.setScalar(8)
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(7.5, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      hit.position.copy(position)
      hit.userData.pick = `star${index + 1}`
      this.constellationGroup.add(core, halo, hit)
      pickables.push(hit)
      this.constellationStars.push({
        core,
        halo,
        hit,
        index,
        picked: false,
        phase: Math.random() * Math.PI * 2,
      })
    })
  }

  isStarPicked(object: THREE.Object3D): boolean {
    if (!this.constellationActive) return true
    const star = this.constellationStars.find((item) => item.hit === object)
    return Boolean(star?.picked)
  }

  connectConstellation(index: number, onComplete?: () => void) {
    if (!this.constellationActive) return
    const star = this.constellationStars.find((item) => item.index === index)
    if (!star || star.picked) return
    star.picked = true
    this.constellationPicked += 1
    star.halo.scale.setScalar(9.5)
    ;(star.halo.material as THREE.SpriteMaterial).opacity = 1
    const previousIndex = this.constellationOrder[this.constellationOrder.length - 1]
    if (previousIndex !== undefined) {
      const previous = this.constellationStars.find((item) => item.index === previousIndex)
      if (previous) this.drawLine(previous.core.position, star.core.position)
    }
    this.constellationOrder.push(index)
    if (this.constellationPicked >= this.constellationStars.length && this.constellationStars.length >= 3) {
      const first = this.constellationStars.find((item) => item.index === this.constellationOrder[0])
      if (first) this.drawLine(star.core.position, first.core.position)
      this.boostGalaxy()
      onComplete?.()
    }
  }

  autoCompleteConstellation(onComplete?: () => void) {
    if (!this.constellationActive) return
    for (const star of this.constellationStars) {
      if (!star.picked) this.connectConstellation(star.index, onComplete)
    }
  }

  private drawLine(from: THREE.Vector3, to: THREE.Vector3) {
    const direction = to.clone().sub(from)
    const length = direction.length()
    if (length < 0.001) return
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, length, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#cfe1ff',
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    mesh.position.copy(from).add(to).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    this.constellationGroup.add(mesh)
    this.constellationLines.push(mesh)
  }

  update(dt: number, elapsed: number, camera: THREE.PerspectiveCamera) {
    this.skyGroup.position.copy(camera.position)
    SHARED_UNIFORMS.uGalaxyBoost.value = Math.max(0, SHARED_UNIFORMS.uGalaxyBoost.value - dt * 0.12)
    this.starBoost.value = Math.max(1, this.starBoost.value - dt * 0.25)

    if (this.constellationActive) {
      for (const star of this.constellationStars) {
        const twinkle = 0.82 + 0.18 * Math.sin(elapsed * 1.8 + star.phase)
        ;(star.halo.material as THREE.SpriteMaterial).opacity = (star.picked ? 1 : 0.7) * twinkle
        star.halo.scale.setScalar((star.picked ? 9.5 : 8) * twinkle)
        star.core.scale.setScalar(twinkle)
      }
    }

    if (this.meteorRunning) {
      this.meteorProgress = Math.min(1, this.meteorProgress + dt / this.meteorDuration)
      const p = this.meteorProgress
      this.meteorGroup.position.copy(this.meteorStart).lerp(this.meteorEnd, p)
      const fadeIn = Math.min(1, p / 0.12)
      const fadeOut = 1 - Math.max(0, (p - 0.72) / 0.28)
      this.applyMeteorEnvelope(fadeIn * fadeOut)
      if (this.meteorProgress >= 1) this.hideMeteor()
    } else if (this.meteorActive) {
      this.meteorCooldown -= dt
      if (this.meteorCooldown <= 0) this.launchMeteor(camera)
    }
  }

  private launchMeteor(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld()
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    const start = camera.position
      .clone()
      .addScaledVector(forward, 240)
      .addScaledVector(right, (Math.random() - 0.5) * 80)
      .addScaledVector(up, 15 + Math.random() * 40)
    const side = Math.random() > 0.5 ? 1 : -1
    const end = start
      .clone()
      .addScaledVector(right, side * (80 + Math.random() * 70))
      .addScaledVector(up, -10 - Math.random() * 30)
    this.meteorStart.copy(start)
    this.meteorEnd.copy(end)
    this.meteorProgress = 0
    this.meteorDuration = 1.5
    this.meteorIsWish = false
    this.meteorRunning = true
    this.meteorGroup.visible = true
    this.meteorGroup.position.copy(start)
    this.configureMeteorVisuals(start, end, false)
    this.applyMeteorEnvelope(0.2)
  }

  resetToSurface(pickables: THREE.Object3D[]) {
    this.clearConstellation(pickables)
    this.constellationActive = false
    this.constellationGroup.visible = false
    this.meteorActive = false
    this.hideMeteor()
    SHARED_UNIFORMS.uGalaxyBoost.value = 0
    this.starBoost.value = 1
  }

  dispose() {
    this.skyMaterial.dispose()
    this.starMaterial.dispose()
    this.meteorStreakMat?.dispose()
  }
}

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vNdc;
uniform float uTime;
uniform vec2 uProjInv;
uniform mat4 uCamWorld;
uniform float uGalaxyBoost;

${GLSL_NOISE}
${GLSL_ATMOSPHERE}
${GLSL_CLOUD_LOOKUP}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm3d(vec3 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amp * noise3(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec3 dir = normalize(mat3(uCamWorld) * vec3(vNdc * uProjInv, -1.0));
  vec3 col = skyBase(dir);

  // 高动态太阳圆盘与日冕（Bloom 自动泛出柔和光晕）
  vec3 sunDir = normalize(uSunDir);
  float sd = max(dot(dir, sunDir), 0.0);
  float disc = smoothstep(0.99965, 0.99992, sd);
  float corona = pow(sd, 1600.0) * 1.4;
  col += uSunColor * (disc * 8.5 + corona) * uSunPower * (1.0 - uGalaxy * 0.72);

  // 体积积云与高空卷云
  col = shadeCloudDeck(col, dir, uTime);

  // 深夜专属银河带与暗尘埃带
  if (uGalaxy > 0.01) {
    vec3 bandNormal = normalize(vec3(0.32, 0.62, 0.72));
    float band = 1.0 - smoothstep(0.0, 0.36, abs(dot(dir, bandNormal)));
    float core = 1.0 - smoothstep(0.0, 0.14, abs(dot(dir, bandNormal)));
    float dust = fbm3d(dir * 7.0 + vec3(2.0, 1.0, 0.0));
    float dust2 = fbm3d(dir * 19.0 + vec3(5.0));
    float gmask = smoothstep(-0.04, 0.32, dir.y);
    vec3 galaxy = vec3(0.46, 0.54, 0.88) * band * (0.08 + dust * 0.54) * (0.68 + uGalaxyBoost * 0.52);
    galaxy += vec3(0.36, 0.44, 0.82) * core * dust2 * 0.24 * (0.55 + uGalaxyBoost * 0.42);
    galaxy -= vec3(0.025, 0.022, 0.045) * band * smoothstep(0.35, 0.8, dust2) * 1.1;
    col += max(galaxy, vec3(0.0)) * uGalaxy * gmask * 0.75;
  }

  float below = smoothstep(0.0, -0.1, dir.y);
  col = mix(col, uSkyHorizon * 0.38, below);
  gl_FragColor = vec4(col, 1.0);
}
`
