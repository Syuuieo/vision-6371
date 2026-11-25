export const DIORAMA_DEFAULT_DISTANCE = 14.2
export const DIORAMA_MIN_DISTANCE = 8.8
export const DIORAMA_MAX_DISTANCE = 21.5

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function computeDioramaFraming(aspect: number, baseDistance: number) {
  const safeAspect = Math.max(0.35, Number.isFinite(aspect) ? aspect : 16 / 9)
  // 宽屏采用 40° 舒展广角；竖屏/窄屏适度拓宽垂直 FOV 并按视口纵横比自动拉远机位，保证整座微缩岛完整入镜
  const fov = safeAspect < 1.25 ? clamp(40 + (1.25 - safeAspect) * 12, 40, 48) : 40
  const refHalfW = Math.tan(((40 * Math.PI) / 180) * 0.5) * 1.18
  const curHalfW = Math.tan(((fov * Math.PI) / 180) * 0.5) * safeAspect
  const distanceScale = curHalfW < refHalfW ? clamp(refHalfW / curHalfW, 1, 1.95) : 1
  const effectiveDistance = clamp(baseDistance * distanceScale, DIORAMA_MIN_DISTANCE, 36)
  return { fov, distanceScale, effectiveDistance }
}

export function computeCaptureDistance(baseDistance: number) {
  return clamp(baseDistance * 1.06, 10.5, 22.5)
}
