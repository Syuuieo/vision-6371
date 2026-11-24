import * as THREE from 'three'
import { clamp, easeInCubic, easeInOutCubic, easeInOutSine } from '../core/ctx'
import type { DescentEvent } from '../../types/sensor'

/**
 * 第八幕：地壳隧道、地幔岩浆与 6,371.4 KM「落日六号」地心失事舱世界。
 */
export class UndergroundWorld {
  readonly group = new THREE.Group()
  private readonly magmaGroup = new THREE.Group()
  private readonly coreGroup = new THREE.Group()
  private readonly dustMote: { points: THREE.Points; uniforms: Record<string, THREE.IUniform> }
  private readonly magmaSparks: { points: THREE.Points; uniforms: Record<string, THREE.IUniform> }
  private readonly magmaUniforms: Record<string, THREE.IUniform>
  private readonly backdropUniform: { value: number }
  private readonly warpStreams: THREE.Group
  private readonly coreAccretion: THREE.Group
  private readonly coreSparks: THREE.Points
  private readonly vehicle: THREE.Group
  private readonly vehicleCommsRing: THREE.Object3D
  private readonly vehicleBeacon: { mesh: THREE.Mesh; glow: THREE.Sprite; light: THREE.PointLight }
  private readonly pixelUniform = { value: 1 }

  active = false
  arrived = false
  private time = 0
  private readonly startPos = new THREE.Vector3()
  private readonly startLook = new THREE.Vector3()
  private startFov = 55
  private breached = false
  private mantle = false
  private core = false
  private lastTick = -1

  readonly fogColor = new THREE.Color('#0a0d12')
  fogDensity = 0.03

  constructor(scene: THREE.Scene, glowTexture: THREE.Texture, pixelRatio: number) {
    this.pixelUniform.value = pixelRatio
    this.group.visible = false
    scene.add(this.group)

    // 1. 地壳深井岩壁
    const rockCanvas = document.createElement('canvas')
    rockCanvas.width = 512
    rockCanvas.height = 1024
    const rockCtx = rockCanvas.getContext('2d')
    if (rockCtx) {
      rockCtx.fillStyle = '#0b0e13'
      rockCtx.fillRect(0, 0, 512, 1024)
      for (let i = 0; i < 260; i += 1) {
        const x = Math.random() * 512
        const y = Math.random() * 1024
        const w = 1 + Math.random() * 7
        const h = 30 + Math.random() * 280
        const shade = Math.random()
        rockCtx.fillStyle =
          shade > 0.72
            ? 'rgba(74, 82, 92, 0.16)'
            : shade > 0.4
              ? 'rgba(28, 34, 42, 0.5)'
              : 'rgba(2, 4, 6, 0.6)'
        rockCtx.fillRect(x, y, w, h)
      }
      for (let i = 0; i < 80; i += 1) {
        rockCtx.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.5)' : 'rgba(96, 88, 78, 0.12)'
        rockCtx.lineWidth = 0.6 + Math.random() * 1.4
        rockCtx.beginPath()
        let x = Math.random() * 512
        let y = Math.random() * 1024
        rockCtx.moveTo(x, y)
        for (let k = 0; k < 5; k += 1) {
          x += (Math.random() - 0.5) * 30
          y += Math.random() * 40
          rockCtx.lineTo(x, y)
        }
        rockCtx.stroke()
      }
    }
    const rockTexture = new THREE.CanvasTexture(rockCanvas)
    rockTexture.colorSpace = THREE.SRGBColorSpace
    rockTexture.wrapS = THREE.RepeatWrapping
    rockTexture.wrapT = THREE.RepeatWrapping
    rockTexture.repeat.set(3, 3)

    const tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 5.6, 118, 36, 24, true),
      new THREE.MeshBasicMaterial({ map: rockTexture, side: THREE.BackSide, fog: true }),
    )
    tunnel.position.set(0, -56, 0)
    this.group.add(tunnel)

    const shaftGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#7a563e',
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    shaftGlow.scale.setScalar(4)
    shaftGlow.position.set(0, -108, 0)
    this.group.add(shaftGlow)

    const shardMat = new THREE.MeshBasicMaterial({ color: '#04060a' })
    for (let i = 0; i < 14; i += 1) {
      const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 1.1, 0), shardMat)
      const angle = Math.random() * Math.PI * 2
      const radius = 2.6 + Math.random() * 2.4
      shard.position.set(Math.cos(angle) * radius, -18 - Math.random() * 90, Math.sin(angle) * radius)
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      this.group.add(shard)
    }

    this.dustMote = this.createMoteField(900, 14, 22, '#8a9aa2', 0.9, 14, false)
    this.dustMote.points.position.set(0, -20, 0)
    this.group.add(this.dustMote.points)

    // 2. 地幔高温岩浆段
    this.magmaUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } }
    const magmaShell = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 150, 40, 30, true),
      new THREE.ShaderMaterial({
        uniforms: this.magmaUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float x = vUv.x * 6.283;
            float flow = sin(vUv.y * 90.0 - uTime * 6.0 + sin(x * 7.0) * 0.9) * 0.5 + 0.5;
            float band = smoothstep(0.35, 1.0, flow);
            float streak = pow(0.5 + 0.5 * sin(x * 22.0 + uTime * 0.7 + sin(vUv.y * 30.0 + uTime * 4.0) * 1.4), 6.0);
            vec3 col = mix(vec3(0.07, 0.006, 0.001), vec3(1.0, 0.24, 0.03), band);
            col += vec3(1.0, 0.5, 0.08) * streak * 0.35;
            gl_FragColor = vec4(col, (0.08 + band * 0.24 + streak * 0.12) * uOpacity);
          }
        `,
      }),
    )
    magmaShell.position.set(0, -130, 0)
    this.magmaGroup.add(magmaShell)

    const mShardMat = new THREE.MeshBasicMaterial({ color: '#0b0503' })
    for (let i = 0; i < 16; i += 1) {
      const shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 1.2, 0), mShardMat)
      const angle = Math.random() * Math.PI * 2
      const radius = 4.6 + Math.random() * 2.2
      shard.position.set(Math.cos(angle) * radius, -58 - Math.random() * 150, Math.sin(angle) * radius)
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      this.magmaGroup.add(shard)
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ff7a2a',
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (let i = 0; i < 12; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.075, 6, 64), ringMat)
      ring.rotation.x = Math.random() * 0.4
      ring.rotation.y = Math.random() * 0.4
      ring.position.set(0, -62 - i * 12.5, 0)
      this.magmaGroup.add(ring)
    }

    this.magmaSparks = this.createMoteField(600, 9, 20, '#ff9a4a', 1.8, 16, true)
    this.magmaSparks.points.position.set(0, -160, 0)
    this.magmaGroup.add(this.magmaSparks.points)

    const endGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#ff8a3c',
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    endGlow.scale.setScalar(22)
    endGlow.position.set(0, -252, 0)
    this.magmaGroup.add(endGlow)

    this.warpStreams = new THREE.Group()
    const goldFil = new THREE.MeshBasicMaterial({
      color: '#f2c28b',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const blueFil = new THREE.MeshBasicMaterial({
      color: '#8ab8ff',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (let i = 0; i < 36; i += 1) {
      const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.16
      const radius = 4.2 + Math.random() * 2.6
      const fil = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 22 + Math.random() * 26, 0.035),
        i % 2 === 0 ? goldFil : blueFil,
      )
      fil.position.set(Math.cos(angle) * radius, -60 - Math.random() * 175, Math.sin(angle) * radius)
      this.warpStreams.add(fil)
    }
    this.magmaGroup.add(this.warpStreams)
    this.magmaGroup.visible = false
    this.group.add(this.magmaGroup)

    // 3. 地心空腔与「落日六号」
    this.backdropUniform = { value: 0 }
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 170),
      new THREE.ShaderMaterial({
        uniforms: { uTime: this.backdropUniform },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            p.x *= 2.4;
            float d = length(p);
            float glow = (1.0 - smoothstep(0.0, 0.55, d)) * 0.32;
            float veins = sin(vUv.x * 34.0 + sin(vUv.y * 7.0 + uTime * 0.2) * 2.0) * 0.5 + 0.5;
            veins *= 1.0 - smoothstep(0.08, 0.5, d);
            vec3 col = mix(vec3(0.02, 0.003, 0.002), vec3(0.62, 0.13, 0.03), glow);
            col += vec3(1.0, 0.32, 0.08) * veins * 0.035;
            gl_FragColor = vec4(col, glow * 0.55);
          }
        `,
      }),
    )
    backdrop.position.set(0, -292, -130)
    this.coreGroup.add(backdrop)

    const accretion = new THREE.Group()
    accretion.position.set(0, -292, -34)
    const disk1 = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.22, 10, 96),
      new THREE.MeshBasicMaterial({
        color: '#ffae5c',
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    disk1.rotation.set(Math.PI / 2 - 0.28, 0.16, 0)
    accretion.add(disk1)
    const disk2 = new THREE.Mesh(
      new THREE.TorusGeometry(23, 0.14, 8, 96),
      new THREE.MeshBasicMaterial({
        color: '#ffd9a0',
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    disk2.rotation.set(Math.PI / 2 - 0.24, -0.18, 0)
    accretion.add(disk2)
    const lensRing = new THREE.Mesh(
      new THREE.TorusGeometry(19.5, 0.16, 8, 96),
      new THREE.MeshBasicMaterial({
        color: '#ff8f4a',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    lensRing.rotation.set(0.06, 0.1, 0)
    accretion.add(lensRing)
    this.coreAccretion = accretion
    this.coreGroup.add(accretion)

    const coreHaze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#ff5a1e',
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    coreHaze.scale.setScalar(130)
    coreHaze.position.set(0, -296, -92)
    this.coreGroup.add(coreHaze)

    const emberPositions = new Float32Array(200 * 3)
    for (let i = 0; i < 200; i += 1) {
      emberPositions[i * 3] = (Math.random() - 0.5) * 90
      emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 60
      emberPositions[i * 3 + 2] = -20 - Math.random() * 110
    }
    const emberGeo = new THREE.BufferGeometry()
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
    this.coreSparks = new THREE.Points(
      emberGeo,
      new THREE.PointsMaterial({
        color: '#ff8a4a',
        size: 0.08,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    )
    this.coreSparks.position.set(0, -292, 0)
    this.coreGroup.add(this.coreSparks)

    const builtShip = this.buildVehicle(glowTexture)
    this.vehicle = builtShip.ship
    this.vehicleCommsRing = builtShip.commsRing
    this.vehicleBeacon = builtShip.beacon
    this.coreGroup.add(this.vehicle)
    this.coreGroup.visible = false
    this.group.add(this.coreGroup)
  }

  private buildVehicle(glowTexture: THREE.Texture) {
    // 硬科幻深地航行器「落日六号 SUNSET-06」：球形耐压钛金主舱 + 隔热肋骨 + 温暖观测舷窗 + 双层陀螺中微子通讯环 + 三向稳定桁架
    const ship = new THREE.Group()
    ship.position.set(0, -290.5, -40)
    ship.scale.setScalar(1.48)
    ship.rotation.set(0.16, 0.56, -0.05)

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: '#9aa8bd',
      emissive: new THREE.Color('#3b2116'),
      emissiveIntensity: 0.34,
      metalness: 0.32,
      roughness: 0.42,
    })
    const armorMat = new THREE.MeshStandardMaterial({
      color: '#5a667a',
      emissive: new THREE.Color('#28160f'),
      emissiveIntensity: 0.28,
      metalness: 0.42,
      roughness: 0.46,
    })
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#f2c28b',
      emissive: new THREE.Color('#d98438'),
      emissiveIntensity: 0.55,
      metalness: 0.52,
      roughness: 0.28,
    })
    const thermalGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffba72',
      emissive: new THREE.Color('#ff7b2e'),
      emissiveIntensity: 0.92,
      metalness: 0.2,
      roughness: 0.24,
    })

    // 1. 球形多面体钛合金耐压核心舱
    const coreSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(2.02, 2), titaniumMat)
    ship.add(coreSphere)

    // 赤道装甲加固腰带 + 6 道纵向热盾加强肋
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(2.14, 2.14, 0.52, 24), armorMat)
    ship.add(belt)
    const beltTrimTop = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.055, 10, 48), goldMat)
    beltTrimTop.rotation.x = Math.PI / 2
    beltTrimTop.position.y = 0.27
    ship.add(beltTrimTop)
    const beltTrimBot = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.055, 10, 48), goldMat)
    beltTrimBot.rotation.x = Math.PI / 2
    beltTrimBot.position.y = -0.27
    ship.add(beltTrimBot)

    for (let i = 0; i < 6; i += 1) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(2.04, 0.065, 8, 40), armorMat)
      rib.rotation.y = (i / 6) * Math.PI
      ship.add(rib)
    }

    // 2. 温暖点亮的六边形全景观测舷窗（象征铁镍海洋深处亮灯的座舱）
    const viewportGroup = new THREE.Group()
    viewportGroup.position.set(0.32, 0.36, 1.88)
    viewportGroup.rotation.set(-0.16, 0.16, 0)
    const frameOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 0.34, 6), armorMat)
    frameOuter.rotation.x = Math.PI / 2
    viewportGroup.add(frameOuter)
    const frameGold = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 8, 6), goldMat)
    frameGold.position.z = 0.15
    viewportGroup.add(frameGold)
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.76, 0.12, 6),
      new THREE.MeshStandardMaterial({
        color: '#ffe8bd',
        emissive: new THREE.Color('#ffaa44'),
        emissiveIntensity: 1.25,
        roughness: 0.12,
        metalness: 0.1,
      }),
    )
    glass.rotation.x = Math.PI / 2
    glass.position.z = 0.14
    viewportGroup.add(glass)
    const cabinGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#ffcc7a',
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    cabinGlow.scale.setScalar(3.4)
    cabinGlow.position.z = 0.35
    viewportGroup.add(cabinGlow)
    ship.add(viewportGroup)

    // 3. 底部热熔减震盘 & 顶部雷达观测塔
    const lowerCap = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.08, 0.56, 12), armorMat)
    lowerCap.position.y = -1.92
    ship.add(lowerCap)
    const lowerGlow = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.075, 10, 32), thermalGlowMat)
    lowerGlow.rotation.x = Math.PI / 2
    lowerGlow.position.y = -2.18
    ship.add(lowerGlow)

    const dorsalTower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.78, 0.85, 8), armorMat)
    dorsalTower.position.y = 2.15
    ship.add(dorsalTower)
    const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 1.35, 8), titaniumMat)
    antennaMast.position.y = 3.08
    ship.add(antennaMast)

    // 4. 三向深地稳定桁架与外置推进舱（打破尖锥单调轮廓）
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 6
      const armGroup = new THREE.Group()
      armGroup.rotation.y = angle

      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 1.35), armorMat)
      strut.position.set(0, -0.35, 2.45)
      strut.rotation.x = 0.25
      armGroup.add(strut)

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.48, 10), titaniumMat)
      pod.position.set(0, -0.58, 3.08)
      pod.rotation.x = 0.14
      armGroup.add(pod)

      const podRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 24), thermalGlowMat)
      podRing.rotation.x = Math.PI / 2 + 0.14
      podRing.position.set(0, -1.22, 3.16)
      armGroup.add(podRing)

      ship.add(armGroup)
    }

    // 5. 双层星仪陀螺中微子通讯环（动态缓慢旋转）
    const commsRing = new THREE.Group()
    const outerGimbal = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.085, 12, 72), goldMat)
    outerGimbal.rotation.x = Math.PI / 2 - 0.32
    commsRing.add(outerGimbal)
    const innerGimbal = new THREE.Mesh(new THREE.TorusGeometry(2.86, 0.055, 10, 64), titaniumMat)
    innerGimbal.rotation.set(0.42, 0.25, 0.55)
    commsRing.add(innerGimbal)
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2
      const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), thermalGlowMat)
      dot.position.set(Math.cos(a) * 3.45, Math.sin(a) * 3.45, 0)
      outerGimbal.add(dot)
    }
    ship.add(commsRing)

    // 6. 顶置中微子琥珀信标与多向立体塑形灯光（彻底杜绝纯黑剪影）
    const beaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 14),
      new THREE.MeshBasicMaterial({ color: '#ffe09c' }),
    )
    beaconMesh.position.set(0, 3.78, 0)
    ship.add(beaconMesh)

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#ffc266',
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    glow.scale.setScalar(2.1)
    glow.position.copy(beaconMesh.position)
    ship.add(glow)

    const light = new THREE.PointLight(0xffbe68, 24, 48, 1.6)
    light.position.copy(beaconMesh.position)
    ship.add(light)

    const hemi = new THREE.HemisphereLight(0xaad2ff, 0xff6e2e, 1.45)
    ship.add(hemi)
    const keyWarm = new THREE.PointLight(0xffcb82, 42, 68, 1.5)
    keyWarm.position.set(8, 6, 11)
    ship.add(keyWarm)
    const underMagma = new THREE.PointLight(0xff5a22, 34, 58, 1.6)
    underMagma.position.set(-4, -9, 6)
    ship.add(underMagma)
    const rimCool = new THREE.PointLight(0x88b8ff, 26, 64, 1.6)
    rimCool.position.set(-10, 5, -6)
    ship.add(rimCool)

    return { ship, commsRing, beacon: { mesh: beaconMesh, glow, light } }
  }

  private createMoteField(
    count: number,
    radius: number,
    height: number,
    color: string,
    sizeBase: number,
    speed: number,
    additive: boolean,
  ) {
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSpeed: { value: speed },
      uPixel: this.pixelUniform,
      uColor: { value: new THREE.Color(color) },
    }
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = (Math.random() - 0.5) * height
      positions[i * 3 + 2] = Math.sin(angle) * r
      seeds[i] = Math.random()
      sizes[i] = sizeBase * (0.5 + Math.random())
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uSpeed;
        uniform float uPixel;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * uSpeed * (0.4 + aSeed), ${height.toFixed(1)}) - ${(height / 2).toFixed(1)};
          p.x += sin(uTime * 0.7 + aSeed * 20.0) * 0.7;
          p.z += cos(uTime * 0.6 + aSeed * 17.0) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(aSize * uPixel * (320.0 / max(1.0, -mv.z)), 40.0 * uPixel);
          vAlpha = 0.35 + 0.65 * aSeed;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float ax = 1.0 - smoothstep(0.02, 0.13, abs(p.x));
          float ay = 1.0 - smoothstep(0.3, 0.5, abs(p.y));
          gl_FragColor = vec4(uColor, ax * ay * vAlpha * uOpacity);
        }
      `,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    return { points, uniforms: material.uniforms }
  }

  setPixelRatio(pixelRatio: number) {
    this.pixelUniform.value = pixelRatio
  }

  triggerDescent(camPos: THREE.Vector3, lookCurrent: THREE.Vector3, fov: number) {
    if (this.active) return
    this.active = true
    this.time = 0
    this.startPos.copy(camPos)
    this.startLook.copy(lookCurrent)
    this.startFov = fov
    this.breached = false
    this.mantle = false
    this.core = false
    this.arrived = false
    this.lastTick = -1
    this.group.visible = false
  }

  resetToSurface() {
    this.active = false
    this.time = 0
    this.arrived = false
    this.group.visible = false
    this.magmaGroup.visible = false
    this.coreGroup.visible = false
    this.magmaUniforms.uOpacity.value = 0
    this.dustMote.uniforms.uOpacity.value = 0
    this.magmaSparks.uniforms.uOpacity.value = 0
  }

  update(
    dt: number,
    elapsed: number,
    surfaceGroup: THREE.Group,
    skyGroup: THREE.Group,
    scene: THREE.Scene,
    camPos: THREE.Vector3,
    lookCurrent: THREE.Vector3,
    applyCamera: (pos: THREE.Vector3, look: THREE.Vector3, fov: number) => void,
    onEvent?: (event: DescentEvent) => void,
  ) {
    this.vehicle.position.y = -290.5 + Math.sin(elapsed * 0.4) * 0.32
    this.vehicle.rotation.y = 0.82 + Math.sin(elapsed * 0.17) * 0.07
    this.vehicle.rotation.z = 0.04 + Math.sin(elapsed * 0.23) * 0.02
    this.vehicleCommsRing.rotation.z += dt * 0.45
    this.magmaGroup.rotation.y = elapsed * 0.025
    this.warpStreams.rotation.y = elapsed * 0.38
    this.coreAccretion.rotation.z = elapsed * 0.04
    this.coreAccretion.rotation.y = Math.sin(elapsed * 0.15) * 0.08
    const blink = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * 1.7), 6)
    ;(this.vehicleBeacon.glow.material as THREE.SpriteMaterial).opacity = blink
    this.vehicleBeacon.glow.scale.setScalar(1.0 + blink * 1.1)
    this.vehicleBeacon.light.intensity = 4 + blink * 10
    this.vehicleBeacon.mesh.scale.setScalar(0.9 + blink * 0.22)
    this.coreSparks.rotation.y = elapsed * 0.02
    this.dustMote.uniforms.uTime.value = elapsed
    this.magmaSparks.uniforms.uTime.value = elapsed
    this.magmaUniforms.uTime.value = elapsed
    this.backdropUniform.value = elapsed

    if (!this.active) return
    if (this.arrived) {
      const hoverX = Math.sin(elapsed * 0.12) * 1.6
      const hoverY = -291.6 + Math.cos(elapsed * 0.1) * 0.35
      camPos.set(hoverX, hoverY, 9)
      lookCurrent.set(0, -293.6, -40)
      applyCamera(camPos, lookCurrent, 50)
      return
    }

    this.time += dt
    const t = this.time

    if (!this.breached && t >= 2.42) {
      this.breached = true
      surfaceGroup.visible = false
      skyGroup.visible = false
      this.group.visible = true
      scene.background = new THREE.Color('#05070a')
      this.fogColor.set('#0b0e13')
      this.fogDensity = 0.012
      this.dustMote.uniforms.uOpacity.value = 0.55
      onEvent?.({ type: 'breach' })
    }
    if (!this.mantle && t >= 4.25) {
      this.mantle = true
      this.magmaGroup.visible = true
      this.magmaUniforms.uOpacity.value = 0.72
      this.magmaSparks.uniforms.uOpacity.value = 0.85
      scene.background = new THREE.Color('#140402')
      this.fogColor.set('#1f0703')
      this.fogDensity = 0.009
      onEvent?.({ type: 'mantle' })
    }
    if (!this.core && t >= 6.85) {
      this.core = true
      this.coreGroup.visible = true
      this.magmaGroup.visible = false
      this.dustMote.uniforms.uOpacity.value = 0.12
      scene.background = new THREE.Color('#0d0302')
      this.fogColor.set('#160604')
      this.fogDensity = 0.0048
      onEvent?.({ type: 'core' })
    }

    if (t >= 9.15 && !this.arrived) {
      this.arrived = true
      camPos.set(0, -291.6, 9)
      lookCurrent.set(0, -293.6, -40)
      applyCamera(camPos, lookCurrent, 50)
      onEvent?.({ type: 'arrive' })
      return
    }

    const progress = clamp(t / 9.15, 0, 1)
    if (t - this.lastTick > 0.12) {
      this.lastTick = t
      onEvent?.({ type: 'tick', progress })
    }

    const rise = this.startPos.clone().add(new THREE.Vector3(0, 17, 2))
    const riseLook = new THREE.Vector3(0, this.startPos.y - 6, -28)
    const dive = new THREE.Vector3(0, -15, 1)
    const diveLook = new THREE.Vector3(0, -80, 0)
    const rock = new THREE.Vector3(0, -110, 0)
    const rockLook = new THREE.Vector3(0, -190, 0)
    const magma = new THREE.Vector3(0, -238, 0)
    const magmaLook = new THREE.Vector3(0, -300, 0)
    const core = new THREE.Vector3(0, -291.6, 9)
    const coreLook = new THREE.Vector3(0, -293.6, -40)

    let pos: THREE.Vector3
    let look: THREE.Vector3
    let fov = this.startFov

    if (t < 1.4) {
      const k = easeInOutCubic(t / 1.4)
      pos = this.startPos.clone().lerp(rise, k)
      look = this.startLook.clone().lerp(riseLook, k)
      fov = this.startFov + (52 - this.startFov) * k
    } else if (t < 2.6) {
      const k = easeInCubic((t - 1.4) / 1.2)
      pos = rise.clone().lerp(dive, k)
      look = riseLook.clone().lerp(diveLook, k)
      fov = 52 + 4 * k
    } else if (t < 4.7) {
      const k = (t - 2.6) / 2.1
      pos = dive.clone().lerp(rock, easeInOutSine(k))
      look = diveLook.clone().lerp(rockLook, k)
      fov = 56
    } else if (t < 6.7) {
      const k = (t - 4.7) / 2
      pos = rock.clone().lerp(magma, easeInOutSine(k))
      look = rockLook.clone().lerp(magmaLook, k)
      fov = 56
    } else {
      const k = easeInOutCubic((t - 6.7) / 2.45)
      pos = magma.clone().lerp(core, k)
      look = magmaLook.clone().lerp(coreLook, k)
      fov = 56 + (52 - 56) * k
    }

    if (t > 2.9 && t < 6.8) {
      const sway = Math.sin((t - 2.9) * 0.8)
      pos.x += sway * 1.15
      pos.z += Math.cos((t - 2.9) * 0.62) * 0.9
      look.x += sway * 2.6
      look.z -= 9
    }

    this.fogDensity = this.core ? 0.005 : this.mantle ? 0.009 : 0.012
    this.dustMote.points.position.set(pos.x, pos.y, pos.z)
    this.magmaSparks.points.position.set(pos.x, pos.y, pos.z)
    applyCamera(pos, look, fov)
  }
}
