import { describe, expect, it } from 'vitest'
import { BreathDetector, computeBreathEnergy } from './breathDetector'

function makeSpectrum(
  bins: number,
  sampleRate: number,
  fill: (freqHz: number, index: number) => number,
): Uint8Array {
  const data = new Uint8Array(bins)
  const binHz = sampleRate / 2 / bins
  for (let i = 0; i < bins; i += 1) {
    const freqHz = i * binHz
    data[i] = Math.max(0, Math.min(255, Math.round(fill(freqHz, i))))
  }
  return data
}

describe('computeBreathEnergy', () => {
  const SAMPLE_RATE = 48_000
  const BINS = 256

  it('returns 0 for empty, invalid, or silent buffers', () => {
    expect(computeBreathEnergy(new Uint8Array(0), SAMPLE_RATE)).toBe(0)
    expect(computeBreathEnergy(new Uint8Array(BINS), 0)).toBe(0)
    expect(computeBreathEnergy(new Uint8Array(BINS), SAMPLE_RATE)).toBe(0)

    // Quiet ambient floor should remain 0
    const ambientFloor = new Uint8Array(BINS).fill(10)
    expect(computeBreathEnergy(ambientFloor, SAMPLE_RATE)).toBe(0)
  })

  it('suppresses pure low-frequency rumble and room hum (< 350 Hz)', () => {
    const pureRumble = makeSpectrum(BINS, SAMPLE_RATE, (hz) => {
      if (hz < 350) return 220
      return 18
    })
    expect(computeBreathEnergy(pureRumble, SAMPLE_RATE)).toBeLessThan(0.05)

    const heavyHumWithBleed = makeSpectrum(BINS, SAMPLE_RATE, (hz) => {
      if (hz < 350) return 235
      if (hz < 600) return 90
      if (hz >= 1200 && hz <= 5500) return 36
      return 12
    })
    expect(computeBreathEnergy(heavyHumWithBleed, SAMPLE_RATE)).toBeLessThan(0.08)
  })

  it('suppresses narrow tonal whistles that lack broadband turbulence', () => {
    const narrowWhistle = makeSpectrum(BINS, SAMPLE_RATE, (hz) => {
      if (hz >= 2600 && hz <= 2800) return 240
      return 4
    })
    expect(computeBreathEnergy(narrowWhistle, SAMPLE_RATE)).toBeLessThan(0.1)
  })

  it('produces strong normalized energy (> 0.45) for broadband turbulent blowing breath (1.2–5.5 kHz)', () => {
    const steadyBreath = makeSpectrum(BINS, SAMPLE_RATE, (hz) => {
      if (hz >= 1200 && hz <= 5500) return 155
      if (hz < 450) return 28
      return 24
    })
    const strongBreath = makeSpectrum(BINS, SAMPLE_RATE, (hz) => {
      if (hz >= 1200 && hz <= 5500) return 215
      if (hz < 450) return 42
      return 38
    })

    const steadyEnergy = computeBreathEnergy(steadyBreath, SAMPLE_RATE)
    const strongEnergy = computeBreathEnergy(strongBreath, SAMPLE_RATE)

    expect(steadyEnergy).toBeGreaterThan(0.45)
    expect(steadyEnergy).toBeLessThanOrEqual(1)
    expect(strongEnergy).toBeGreaterThan(steadyEnergy)
    expect(strongEnergy).toBeLessThanOrEqual(1)
  })
})

describe('BreathDetector', () => {
  it('starts inactive and stop() is idempotent when uninitialized', () => {
    const detector = new BreathDetector()
    expect(detector.active).toBe(false)
    expect(() => detector.stop()).not.toThrow()
    expect(() => detector.stop()).not.toThrow()
    expect(detector.active).toBe(false)
  })

  it('returns a graceful failure result when mediaDevices is unavailable', async () => {
    const detector = new BreathDetector()
    const result = await detector.start(() => {})
    expect(result.ok).toBe(false)
    expect(typeof result.reason).toBe('string')
    expect(detector.active).toBe(false)
  })
})
