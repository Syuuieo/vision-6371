import { describe, expect, it } from 'vitest'
import {
  DIORAMA_DEFAULT_DISTANCE,
  computeCaptureDistance,
  computeDioramaFraming,
} from './framing'

describe('diorama framing', () => {
  it('uses wide 40deg FOV without distance boost on desktop 16:9 screens', () => {
    const res = computeDioramaFraming(16 / 9, DIORAMA_DEFAULT_DISTANCE)
    expect(res.fov).toBe(40)
    expect(res.distanceScale).toBe(1)
    expect(res.effectiveDistance).toBe(DIORAMA_DEFAULT_DISTANCE)
  })

  it('expands FOV and pulls camera back on narrow mobile portrait screens', () => {
    const aspect = 390 / 844
    const res = computeDioramaFraming(aspect, DIORAMA_DEFAULT_DISTANCE)
    expect(res.fov).toBe(48)
    expect(res.distanceScale).toBeGreaterThan(1.7)
    expect(res.effectiveDistance).toBeLessThanOrEqual(36)

    const visibleWidth =
      2 * res.effectiveDistance * Math.tan(((res.fov * Math.PI) / 180) * 0.5) * aspect
    expect(visibleWidth).toBeGreaterThanOrEqual(10)
  })

  it('keeps wide preset and 16:9 capture distance safely inside the sky dome', () => {
    const wide = computeDioramaFraming(390 / 844, 18.2)
    expect(wide.effectiveDistance).toBeLessThan(40)
    expect(computeCaptureDistance(DIORAMA_DEFAULT_DISTANCE)).toBeCloseTo(15.052, 2)
  })
})
