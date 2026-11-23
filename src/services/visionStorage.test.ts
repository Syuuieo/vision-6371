import { describe, expect, it } from 'vitest'
import { fitLocalBudget } from './visionApi'
import type { StoredVision, VisionPacket } from '../types/vision'

function packetOf(code: string, imageSize: number): VisionPacket {
  return {
    id: code,
    title: code,
    sender: '我',
    city: '南京',
    image: 'data:image/png;base64,' + 'A'.repeat(imageSize),
    particles: 'none',
    ambience: 'none',
    voice: null,
    tempC: 12,
    windLevel: 1,
    scentTag: '',
    focus: [],
    createdAt: 0,
  }
}

function entryOf(code: string, imageSize: number, savedAt: number): StoredVision {
  return { code, packet: packetOf(code, imageSize), savedAt, visibility: 'public', hearts: 0, echoes: [] }
}

const budgetOf = (list: StoredVision[]) => JSON.stringify(list).length

describe('fitLocalBudget', () => {
  it('keeps a small list untouched', () => {
    const list = [entryOf('A', 200, 3), entryOf('B', 200, 2), entryOf('C', 200, 1)]
    expect(fitLocalBudget(list)).toEqual(list)
  })

  it('drops the oldest entries until the list fits the budget', () => {
    const list = Array.from({ length: 6 }, (_, index) => entryOf(`K${index}`, 1_000_000, 6 - index))
    const fitted = fitLocalBudget(list)
    expect(fitted.length).toBeLessThan(list.length)
    expect(fitted.length).toBeGreaterThan(0)
    expect(budgetOf(fitted)).toBeLessThanOrEqual(3_600_000)
    expect(fitted[0].code).toBe('K0')
    expect(list[fitted.length].code).toBe(`K${fitted.length}`)
  })

  it('keeps a lone oversized entry by swapping in a placeholder image', () => {
    const list = [entryOf('BIG', 4_600_000, 1)]
    const fitted = fitLocalBudget(list)
    expect(fitted).toHaveLength(1)
    expect(fitted[0].code).toBe('BIG')
    expect(fitted[0].packet.image.length).toBeLessThan(200)
    expect(budgetOf(fitted)).toBeLessThan(2000)
  })

  it('never exceeds the local cap of 24 entries', () => {
    const list = Array.from({ length: 40 }, (_, index) => entryOf(`S${index}`, 10, 40 - index))
    expect(fitLocalBudget(list)).toHaveLength(24)
  })
})
