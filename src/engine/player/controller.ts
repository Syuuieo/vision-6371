import * as THREE from 'three'
import {
  EYE_HEIGHT,
  SCENIC_BENCHES,
  WORLD_DISCOVERIES,
  type WorldDiscoveryId,
  LAKE,
  PLACES,
  ROAM_CENTER,
  SHARED_UNIFORMS,
  clamp,
  easeInOutCubic,
  getCameraPreset,
  heightAt,
} from '../core/ctx'
import type { FocusTarget, PickId } from '../../types/sensor'

export interface PlayerTelemetry {
  x: number
  z: number
  yaw: number
  speedNorm: number
  nearbyBench: { id: string; name: string; hint: string } | null
  seatedBenchId: string | null
  nearbyDiscovery: WorldDiscoveryId | null
}

export interface HoverTargetInfo {
  id: PickId
  x: number
  y: number
  distance: number
}

export interface ControllerCallbacks {
  onPick?: (id: PickId) => void
  onLakeRipple?: (point: THREE.Vector3, strength: number) => void
  onHoverTarget?: (info: HoverTargetInfo | null) => void
  onZoomChange?: (zoom: number) => void
  onPlaceChange?: (place: string) => void
  onTelemetry?: (telemetry: PlayerTelemetry) => void
  onBoundary?: () => void
  onWalkStart?: (point: THREE.Vector3) => void
  onSkyCall?: () => void
  onSkimChange?: (amount: number) => void
  onCursorMeadow?: (point: THREE.Vector3) => void
  isConstellationStarPicked: (obj: THREE.Object3D) => boolean
  isConstellationActive: () => boolean
  isMeteorRunning: () => boolean
  connectConstellation: (index: number) => void
  hideMeteor: () => void
  isSurfaceActive: () => boolean
}

/**
 * 第一人称「她的视界」漫步与镜头控制器（借鉴 Petalwake 顺滑惯性运动曲线）。
 *
 * - 支持键盘 WASD/方向键 + Shift 迎风疾行、点击地面行走、拖拽环顾与滚轮缩放；
 * - Shift 迎风滑步带来细腻速度惯性、微弱呼吸视野变化及 `speedNorm` 输出，
 *   联动风带宽度、管线边缘色散与草原摩擦微音效；
 * - 兼容触摸端双虚拟摇杆 (`setMoveAxis`, `setLookAxis`)。
 */
export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera
  private readonly canvas: HTMLCanvasElement
  private readonly pickables: THREE.Object3D[]
  private readonly terrainMesh: THREE.Mesh
  private readonly roamRadius: () => number
  private readonly cb: ControllerCallbacks

  readonly camPos = new THREE.Vector3()
  readonly lookCurrent = new THREE.Vector3()
  readonly cursorWorld = new THREE.Vector3(999, 999, 999)

  yaw = 0
  pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  fov = 55
  private fovTarget = 55
  private roll = 0

  private readonly velXZ = new THREE.Vector2()
  speedNorm = 0
  private walkPhase = 0
  private walkTarget: THREE.Vector3 | null = null
  private skimSmoothed = 0
  private skimReported = 0

  roamEnabled = false
  private readonly keys = new Set<string>()
  private readonly moveAxis = { x: 0, y: 0 }
  private readonly lookAxis = { x: 0, y: 0 }

  private flight: {
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromLook: THREE.Vector3
    toLook: THREE.Vector3
    fromFov: number
    toFov: number
    time: number
    duration: number
    ease: (t: number) => number
  } | null = null

  private readonly pointer = { down: false, id: -1, lastX: 0, lastY: 0, drag: 0 }
  private readonly raycaster = new THREE.Raycaster()
  private lastHoverCheck = 0
  private lastCursorCheck = 0
  private lastLakeHover = 0
  private lastPlaceCheck = 0
  private seatedBenchId: string | null = null
  private lastTelemetryAt = 0
  private lastTelemetryKey = ''
  private lastTelemetryYaw = 0
  private lastTelemetryX = 0
  private lastTelemetryZ = 0
  private lastBoundaryReport = 0
  private currentPlace = ''
  private prevCursorXZ = new THREE.Vector2(999, 999)
  private calmMotion = false

  constructor(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    pickables: THREE.Object3D[],
    terrainMesh: THREE.Mesh,
    roamRadius: () => number,
    callbacks: ControllerCallbacks,
  ) {
    this.camera = camera
    this.canvas = canvas
    this.pickables = pickables
    this.terrainMesh = terrainMesh
    this.roamRadius = roamRadius
    this.cb = callbacks
    this.attachEvents()
  }

  get isInFlight(): boolean {
    return this.flight !== null
  }

  setCalmMotion(calm: boolean) {
    this.calmMotion = calm
  }

  private inRoam(x: number, z: number): boolean {
    return Math.hypot(x - ROAM_CENTER.x, z - ROAM_CENTER.z) < this.roamRadius()
  }

  syncAngles() {
    const dir = this.lookCurrent.clone().sub(this.camPos)
    const length = dir.length()
    if (length < 0.001) return
    dir.divideScalar(length)
    this.targetYaw = Math.atan2(dir.x, -dir.z)
    this.targetPitch = Math.asin(clamp(dir.y, -0.95, 0.95))
    this.yaw = this.targetYaw
    this.pitch = this.targetPitch
  }

  setRoamEnabled(enabled: boolean) {
    this.roamEnabled = enabled
    if (!enabled) {
      this.keys.clear()
      this.moveAxis.x = 0
      this.moveAxis.y = 0
      this.lookAxis.x = 0
      this.lookAxis.y = 0
      this.walkTarget = null
      this.cb.onHoverTarget?.(null)
    }
  }

  setMoveAxis(x: number, y: number) {
    this.moveAxis.x = clamp(x, -1, 1)
    this.moveAxis.y = clamp(y, -1, 1)
    if (this.moveAxis.x !== 0 || this.moveAxis.y !== 0) this.walkTarget = null
  }

  setLookAxis(x: number, y: number) {
    this.lookAxis.x = clamp(x, -1, 1)
    this.lookAxis.y = clamp(y, -1, 1)
  }

  clearInputForDescent() {
    this.flight = null
    this.walkTarget = null
    this.seatedBenchId = null
    this.roamEnabled = false
    this.keys.clear()
    this.velXZ.set(0, 0)
    this.speedNorm = 0
    this.cb.onHoverTarget?.(null)
    this.emitSkim(0, true)
  }

  resetSurfaceState() {
    this.roamEnabled = false
    this.seatedBenchId = null
    this.keys.clear()
    this.walkTarget = null
    this.walkPhase = 0
    this.velXZ.set(0, 0)
    this.speedNorm = 0
    this.roll = 0
    this.cb.onHoverTarget?.(null)
    this.emitSkim(0, true)
    this.focusTarget('home', 0.02)
  }

  sitOnBench(benchId: string) {
    if (!this.cb.isSurfaceActive()) return
    const bench = SCENIC_BENCHES.find((b) => b.id === benchId)
    if (!bench) return
    this.seatedBenchId = bench.id
    this.walkTarget = null
    this.velXZ.set(0, 0)
    this.speedNorm = 0
    const benchY = heightAt(bench.x, bench.z) + 1.18
    const lookY = heightAt(bench.lookX, bench.lookZ) + 2.2
    const toPos = new THREE.Vector3(bench.x, benchY, bench.z)
    const toLook = new THREE.Vector3(bench.lookX, lookY, bench.lookZ)
    this.fovTarget = 46
    this.cb.onZoomChange?.(55 / this.fovTarget)
    this.flight = {
      fromPos: this.camPos.clone(),
      toPos,
      fromLook: this.lookCurrent.clone(),
      toLook,
      fromFov: this.fov,
      toFov: 46,
      time: 0,
      duration: 1.15,
      ease: easeInOutCubic,
    }
    this.emitTelemetry(true)
  }

  standFromBench() {
    if (!this.seatedBenchId) return
    this.seatedBenchId = null
    this.fovTarget = 55
    this.cb.onZoomChange?.(55 / this.fovTarget)
    this.emitTelemetry(true)
  }

  focusTarget(target: FocusTarget, duration = 2.3) {
    if (!this.cb.isSurfaceActive()) return
    this.seatedBenchId = null
    this.walkTarget = null
    const preset = getCameraPreset(target)
    this.fovTarget = preset.fov
    this.cb.onZoomChange?.(55 / this.fovTarget)
    if (duration <= 0.02) {
      this.flight = null
      this.velXZ.set(0, 0)
      this.speedNorm = 0
      this.camPos.copy(preset.pos)
      this.lookCurrent.copy(preset.look)
      this.fov = preset.fov
      this.syncAngles()
      this.applyCamera(this.camPos, this.lookCurrent, this.fov)
      return
    }
    this.flight = {
      fromPos: this.camPos.clone(),
      toPos: preset.pos.clone(),
      fromLook: this.lookCurrent.clone(),
      toLook: preset.look.clone(),
      fromFov: this.fov,
      toFov: preset.fov,
      time: 0,
      duration,
      ease: easeInOutCubic,
    }
  }

  applyCamera(pos: THREE.Vector3, look: THREE.Vector3, fov: number) {
    this.camera.position.copy(pos)
    this.camera.up.set(Math.sin(this.roll) * 0.04, 1, 0).normalize()
    this.camera.lookAt(look)
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    this.camera.updateMatrixWorld()
  }

  update(dt: number) {
    if (!this.cb.isSurfaceActive()) return

    let forwardInput = 0
    let rightInput = 0
    if (this.flight) {
      const f = this.flight
      f.time += dt
      const raw = clamp(f.time / f.duration, 0, 1)
      const k = f.ease(raw)
      this.camPos.lerpVectors(f.fromPos, f.toPos, k)
      this.lookCurrent.lerpVectors(f.fromLook, f.toLook, k)
      this.fov = f.fromFov + (f.toFov - f.fromFov) * k
      this.velXZ.set(0, 0)
      this.speedNorm = 0
      if (raw >= 1) {
        this.camPos.copy(f.toPos)
        this.lookCurrent.copy(f.toLook)
        this.fov = f.toFov
        this.flight = null
        this.syncAngles()
      }
    } else {
      if (this.roamEnabled) {
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forwardInput += 1
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forwardInput -= 1
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) rightInput += 1
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) rightInput -= 1
        forwardInput += this.moveAxis.y
        rightInput += this.moveAxis.x
      }

      const valid = (x: number, z: number) => this.inRoam(x, z) && heightAt(x, z) > LAKE.y + 0.28
      let desiredVx = 0
      let desiredVz = 0

      if (this.roamEnabled && (forwardInput !== 0 || rightInput !== 0)) {
        if (this.seatedBenchId) this.standFromBench()
        this.walkTarget = null
        const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw))
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw))
        const move = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(rightInput))
        if (move.lengthSq() >= 0.0001) {
          move.normalize()
          const fast = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
          const mag = Math.min(1, Math.hypot(forwardInput, rightInput))
          const baseSpeed = fast ? 9.6 : 3.45
          const hHere = heightAt(this.camPos.x, this.camPos.z)
          const hAhead = heightAt(this.camPos.x + move.x * 1.4, this.camPos.z + move.z * 1.4)
          const slopeDown = clamp((hHere - hAhead) / 1.4, -0.35, 0.45)
          const speed = baseSpeed * (1 + Math.max(0, slopeDown) * (fast ? 0.34 : 0.16)) * Math.max(0.35, mag)
          desiredVx = move.x * speed
          desiredVz = move.z * speed
        }
      } else if (this.roamEnabled && this.walkTarget) {
        if (this.seatedBenchId) this.standFromBench()
        const dx = this.walkTarget.x - this.camPos.x
        const dz = this.walkTarget.z - this.camPos.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.65) {
          this.walkTarget = null
        } else {
          desiredVx = (dx / dist) * 4.6
          desiredVz = (dz / dist) * 4.6
        }
      }

      // 丝滑惯性加速与收步阻尼（参考 Petalwake 惯性平滑手感）
      const hasInput = desiredVx !== 0 || desiredVz !== 0
      const accel = 1 - Math.exp(-dt * (hasInput ? 7.5 : 8.5))
      this.velXZ.x += (desiredVx - this.velXZ.x) * accel
      this.velXZ.y += (desiredVz - this.velXZ.y) * accel
      if (!hasInput && this.velXZ.lengthSq() < 0.001) this.velXZ.set(0, 0)

      const curSpeed = this.velXZ.length()
      this.speedNorm = clamp(curSpeed / 9.6, 0, 1)

      if (curSpeed > 0.02) {
        const stepX = this.velXZ.x * dt
        const stepZ = this.velXZ.y * dt
        const targetX = this.camPos.x + stepX
        const targetZ = this.camPos.z + stepZ
        let nextX = this.camPos.x
        let nextZ = this.camPos.z
        if (valid(targetX, targetZ)) {
          nextX = targetX
          nextZ = targetZ
        } else if (valid(targetX, this.camPos.z)) {
          nextX = targetX
        } else if (valid(this.camPos.x, targetZ)) {
          nextZ = targetZ
        }
        if (nextX === this.camPos.x && nextZ === this.camPos.z) {
          this.walkTarget = null
          this.velXZ.set(0, 0)
          if (!this.inRoam(targetX, targetZ)) this.reportBoundary()
        } else {
          this.camPos.x = nextX
          this.camPos.z = nextZ
          this.walkPhase += dt * (0.75 + this.speedNorm * 0.65)
          const bob = this.calmMotion ? 0 : Math.sin(this.walkPhase * 7.8) * (0.042 + this.speedNorm * 0.02)
          const targetY = heightAt(nextX, nextZ) + EYE_HEIGHT + bob
          this.camPos.y += (targetY - this.camPos.y) * Math.min(1, dt * 8)
        }
      } else {
        const restY = heightAt(this.camPos.x, this.camPos.z) + (this.seatedBenchId ? 1.18 : EYE_HEIGHT)
        this.camPos.y += (restY - this.camPos.y) * Math.min(1, dt * 5)
      }

      if (this.lookAxis.x !== 0 || this.lookAxis.y !== 0) {
        // 细腻非线性曲线，大幅降低转角灵敏度，确保漫游环顾从容不眩晕
        const curveX = Math.sign(this.lookAxis.x) * Math.pow(Math.abs(this.lookAxis.x), 1.45)
        const curveY = Math.sign(this.lookAxis.y) * Math.pow(Math.abs(this.lookAxis.y), 1.45)
        this.targetYaw += curveX * dt * 0.62
        this.targetPitch = clamp(this.targetPitch + curveY * dt * 0.45, -1.15, 1.28)
      }
      const damp = 1 - Math.exp(-dt * 4.8)
      this.yaw += (this.targetYaw - this.yaw) * damp
      this.pitch += (this.targetPitch - this.pitch) * damp

      const targetRoll = this.calmMotion ? 0 : clamp(-rightInput * 0.25 - (this.targetYaw - this.yaw) * 0.6, -1, 1)
      this.roll += (targetRoll - this.roll) * Math.min(1, dt * 6)

      const sprintFovLift = this.calmMotion ? 0 : this.speedNorm * 4.2
      this.fov += (this.fovTarget + sprintFovLift - this.fov) * damp

      const cosPitch = Math.cos(this.pitch)
      const dir = new THREE.Vector3(
        Math.sin(this.yaw) * cosPitch,
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * cosPitch,
      )
      this.lookCurrent.copy(this.camPos).addScaledVector(dir, 20)
    }

    this.applyCamera(this.camPos, this.lookCurrent, this.fov)
    this.updatePlace()
    this.emitTelemetry(false)

    // 掠草微音效：综合脚步速度 + 鼠标划草速度
    const cursorActive = this.cursorWorld.x < 450 && this.cursorWorld.z < 450 && !this.flight
    let cursorSpeed = 0
    if (cursorActive && this.prevCursorXZ.x < 450) {
      const jump = Math.hypot(
        this.cursorWorld.x - this.prevCursorXZ.x,
        this.cursorWorld.z - this.prevCursorXZ.y,
      )
      if (jump < 12) cursorSpeed = jump / Math.max(dt, 0.001)
    }
    this.prevCursorXZ.set(this.cursorWorld.x, this.cursorWorld.z)

    const skimTarget = this.flight
      ? 0
      : clamp(this.speedNorm * 0.95 + Math.min(0.45, cursorSpeed * 0.08), 0, 1)
    const skimRate = skimTarget > this.skimSmoothed ? 4.5 : 2.6
    this.skimSmoothed += (skimTarget - this.skimSmoothed) * Math.min(1, dt * skimRate)
    if (this.skimSmoothed < 0.01 && skimTarget === 0) this.skimSmoothed = 0
    this.emitSkim(this.skimSmoothed)

    SHARED_UNIFORMS.uPlayerPos.value.copy(this.camPos)
    const cursorUniform = SHARED_UNIFORMS.uCursorPos.value
    if (this.cursorWorld.x > 500 || cursorUniform.x > 500) {
      cursorUniform.copy(this.cursorWorld)
    } else {
      cursorUniform.lerp(this.cursorWorld, Math.min(1, dt * 12))
    }
  }

  private emitSkim(val: number, force = false) {
    if (force || Math.abs(val - this.skimReported) > 0.025 || (val === 0 && this.skimReported !== 0)) {
      this.skimReported = val
      this.cb.onSkimChange?.(val)
    }
  }

  private emitTelemetry(force: boolean) {
    if (!this.cb.onTelemetry) return
    const now = performance.now()
    const x = this.camPos.x
    const z = this.camPos.z

    let nearbyBench: { id: string; name: string; hint: string } | null = null
    let bestBenchDist = 3.8
    for (const bench of SCENIC_BENCHES) {
      const d = Math.hypot(x - bench.x, z - bench.z)
      if (d < bestBenchDist) {
        bestBenchDist = d
        nearbyBench = { id: bench.id, name: bench.name, hint: bench.hint }
      }
    }

    let nearbyDiscovery: WorldDiscoveryId | null = null
    for (const disc of WORLD_DISCOVERIES) {
      if (Math.hypot(x - disc.x, z - disc.z) <= disc.radius) {
        nearbyDiscovery = disc.id
        break
      }
    }

    const key = [nearbyBench?.id ?? '', this.seatedBenchId ?? '', nearbyDiscovery ?? ''].join('|')
    const moved =
      Math.hypot(x - this.lastTelemetryX, z - this.lastTelemetryZ) > 0.35 ||
      Math.abs(this.yaw - this.lastTelemetryYaw) > 0.015
    if (!force && key === this.lastTelemetryKey && (!moved || now - this.lastTelemetryAt < 65)) {
      return
    }

    this.lastTelemetryAt = now
    this.lastTelemetryKey = key
    this.lastTelemetryX = x
    this.lastTelemetryZ = z
    this.lastTelemetryYaw = this.yaw
    this.cb.onTelemetry({
      x,
      z,
      yaw: this.yaw,
      speedNorm: this.speedNorm,
      nearbyBench,
      seatedBenchId: this.seatedBenchId,
      nearbyDiscovery,
    })
  }

  private updatePlace() {
    const now = performance.now()
    if (now - this.lastPlaceCheck < 300) return
    this.lastPlaceCheck = now
    const { x, z } = this.camPos
    let name = '远脊草原'
    let best = Infinity
    for (const spot of PLACES) {
      const d = Math.hypot(x - spot.x, z - spot.z)
      if (d < spot.radius && d < best) {
        name = spot.name
        best = d
      }
    }
    if (name === '远脊草原') {
      const dx = (x - LAKE.x) / LAKE.rx
      const dz = (z - LAKE.z) / LAKE.rz
      if (Math.sqrt(dx * dx + dz * dz) < 1.45) name = '湖岸'
    }
    if (name !== this.currentPlace) {
      this.currentPlace = name
      this.cb.onPlaceChange?.(name)
    }
  }

  private reportBoundary() {
    const now = performance.now()
    if (now - this.lastBoundaryReport < 6000) return
    this.lastBoundaryReport = now
    this.cb.onBoundary?.()
  }

  private pickHit(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, false)
    for (const hit of hits) {
      const pick = hit.object.userData.pick as PickId | undefined
      if (!pick) continue
      if (pick === 'meteor' && !this.cb.isMeteorRunning()) continue
      if (pick === 'star1' || pick === 'star2' || pick === 'star3') {
        if (!this.cb.isConstellationActive()) continue
        if (this.cb.isConstellationStarPicked(hit.object)) continue
      }
      return { id: pick, point: hit.point.clone(), object: hit.object }
    }
    return null
  }

  private attachEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onWindowBlur)
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onWindowBlur)
  }

  private onWheel = (event: WheelEvent) => {
    if (!this.cb.isSurfaceActive() || this.flight || !this.roamEnabled) return
    event.preventDefault()
    this.fovTarget = clamp(this.fovTarget + event.deltaY * 0.032, 30, 74)
    this.cb.onZoomChange?.(55 / this.fovTarget)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return
    }
    if (event.code === 'Space' && !event.repeat && this.roamEnabled && this.cb.isSurfaceActive()) {
      event.preventDefault()
      this.cb.onSkyCall?.()
      return
    }
    if (!this.roamEnabled) return
    this.keys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }

  private onWindowBlur = () => {
    this.keys.clear()
    this.pointer.down = false
    this.cursorWorld.set(999, 999, 999)
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointer.down = true
    this.pointer.id = event.pointerId
    this.pointer.lastX = event.clientX
    this.pointer.lastY = event.clientY
    this.pointer.drag = 0
    this.cb.onHoverTarget?.(null)
    this.canvas.setPointerCapture(event.pointerId)
    this.canvas.style.cursor = 'grabbing'
  }

  private onPointerMove = (event: PointerEvent) => {
    if (this.pointer.down && !this.flight) {
      const dx = clamp(event.clientX - this.pointer.lastX, -36, 36)
      const dy = clamp(event.clientY - this.pointer.lastY, -36, 36)
      this.pointer.lastX = event.clientX
      this.pointer.lastY = event.clientY
      this.pointer.drag += Math.abs(dx) + Math.abs(dy)
      const isTouch = event.pointerType === 'touch'
      const yawSens = isTouch ? 0.00115 : 0.00135
      const pitchSens = isTouch ? 0.00095 : 0.0011
      this.targetYaw -= dx * yawSens
      this.targetPitch = clamp(this.targetPitch + dy * pitchSens, -1.15, 1.28)
      return
    }
    if (!this.cb.isSurfaceActive()) {
      this.canvas.style.cursor = 'default'
      this.cb.onHoverTarget?.(null)
      return
    }
    const hit = this.pickHit(event.clientX, event.clientY)
    this.canvas.style.cursor = hit ? 'pointer' : 'grab'
    if (hit) {
      this.cb.onHoverTarget?.({
        id: hit.id,
        x: event.clientX,
        y: event.clientY,
        distance: hit.point.distanceTo(this.camPos),
      })
    } else {
      this.cb.onHoverTarget?.(null)
    }

    const now = performance.now()
    if (hit?.id === 'lake') {
      this.cursorWorld.set(999, 999, 999)
      if (now - this.lastHoverCheck >= 85 && now - this.lastLakeHover > 260) {
        this.lastHoverCheck = now
        this.lastLakeHover = now
        this.cb.onLakeRipple?.(hit.point, 0.55)
      }
      return
    }
    if (hit) {
      this.cursorWorld.set(999, 999, 999)
      return
    }
    if (now - this.lastCursorCheck < 30) return
    this.lastCursorCheck = now
    const rect = this.canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
    const ground = this.raycaster.intersectObject(this.terrainMesh, false)[0]
    if (ground && ground.distance < 34 && ground.point.y > LAKE.y + 0.1) {
      this.cursorWorld.copy(ground.point)
      if (now - this.lastHoverCheck >= 85) {
        this.lastHoverCheck = now
        this.cb.onCursorMeadow?.(ground.point)
      }
    } else {
      this.cursorWorld.set(999, 999, 999)
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointer.down) return
    this.pointer.down = false
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }
    this.canvas.style.cursor = 'grab'
    if (this.pointer.drag < 8 && !this.flight && this.cb.isSurfaceActive()) {
      const hit = this.pickHit(event.clientX, event.clientY)
      if (!hit) {
        if (this.roamEnabled) {
          const rect = this.canvas.getBoundingClientRect()
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
          this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
          const ground = this.raycaster.intersectObject(this.terrainMesh, false)[0]
          if (
            ground &&
            ground.distance < 42 &&
            this.inRoam(ground.point.x, ground.point.z) &&
            heightAt(ground.point.x, ground.point.z) > LAKE.y + 0.25
          ) {
            this.walkTarget = ground.point.clone()
            this.cb.onWalkStart?.(this.walkTarget)
          }
        }
        return
      }
      if (hit.id === 'lake') {
        this.cb.onLakeRipple?.(hit.point, 1)
      } else if (hit.id === 'star1' || hit.id === 'star2' || hit.id === 'star3') {
        const index = Number(hit.id.slice(4)) - 1
        this.cb.connectConstellation(index)
      } else if (hit.id === 'meteor') {
        this.cb.hideMeteor()
      }
      this.cb.onPick?.(hit.id)
    }
  }

  private onPointerLeave = () => {
    this.pointer.down = false
    this.cursorWorld.set(999, 999, 999)
    this.cb.onHoverTarget?.(null)
    this.canvas.style.cursor = 'grab'
  }
}
