import { describe, expect, it } from 'vitest'
import { WORLD_DISCOVERIES, sunArc } from '../data/prologueWorldMeta'
import {
  SEED_RADIO_BRIEFS,
  isSeedCode as lightIsSeedCode,
  seedBrief as lightSeedBrief,
  seedSignalCodes as lightSeedSignalCodes,
} from '../data/seedRadioBriefs'
import {
  isSeedCode as fullIsSeedCode,
  seedBrief as fullSeedBrief,
  seedSignalCodes,
} from '../data/seedRadioVisions'
import { dailyEcho, milestones, todayKey, type JourneyState } from './journey'
import type { StoryRelayState } from '../utils/storyRelay'

const EMPTY_JOURNEY: JourneyState = {
  actsSeen: [],
  eggsFound: [],
  heartbeats: 0,
  echoesLeft: 0,
  visionsSent: 0,
  visitDays: [],
  echoReadDay: null,
}

const EMPTY_RELAY: StoryRelayState = {
  completedPrologue: false,
  promise: '',
  wish: '',
  cluesFound: [],
  memories: [],
  relayedCities: [],
  lastCityWhisper: '',
}

describe('todayKey', () => {
  it('zero-pads month and day in local time', () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('dailyEcho', () => {
  it('is deterministic for the same day', () => {
    const first = dailyEcho('2026-11-23')
    const second = dailyEcho('2026-11-23')
    expect(first).not.toBeNull()
    expect(second).toEqual(first)
  })

  it('rotates one seed per day and repeats every seed cycle', () => {
    const codes = seedSignalCodes()
    const seen: string[] = []
    for (let offset = 0; offset < codes.length; offset += 1) {
      const day = new Date(Date.UTC(2026, 10, 1 + offset)).toISOString().slice(0, 10)
      const echo = dailyEcho(day)
      expect(echo).not.toBeNull()
      seen.push(echo!.code)
    }
    expect(new Set(seen).size).toBe(codes.length)
  })

  it('keeps the label and whisper readable', () => {
    const echo = dailyEcho('2026-11-03')
    expect(echo).not.toBeNull()
    expect(echo!.label).toBe('11 月 3 日')
    expect(echo!.city.length).toBeGreaterThan(0)
    expect(echo!.title.length).toBeGreaterThan(0)
    expect(echo!.whisper.length).toBeGreaterThan(0)
  })
})

describe('milestones', () => {
  it('ships nine unique badges', () => {
    const badges = milestones(EMPTY_JOURNEY, EMPTY_RELAY)
    expect(badges).toHaveLength(9)
    expect(new Set(badges.map((badge) => badge.id)).size).toBe(9)
    expect(badges.every((badge) => badge.done)).toBe(false)
  })

  it('counts a full run as complete', () => {
    const journey: JourneyState = {
      ...EMPTY_JOURNEY,
      actsSeen: [1, 2, 3, 4, 5, 6, 7, 8],
      eggsFound: ['bottle', 'tablet', 'meteor'],
      heartbeats: 2,
      echoesLeft: 1,
      visionsSent: 3,
      visitDays: ['2026-11-21', '2026-11-22', '2026-11-23'],
    }
    const relay: StoryRelayState = { ...EMPTY_RELAY, completedPrologue: true, relayedCities: ['南京', '北京', '大理'] }
    const badges = milestones(journey, relay)
    expect(badges.every((badge) => badge.done)).toBe(true)
    expect(badges.find((badge) => badge.id === 'eight-acts')?.progress).toBe('8 / 8 幕')
  })

  it('reports partial progress before completion', () => {
    const journey: JourneyState = { ...EMPTY_JOURNEY, actsSeen: [1, 2, 3] }
    const badges = milestones(journey, EMPTY_RELAY)
    expect(badges.find((badge) => badge.id === 'eight-acts')?.progress).toBe('3 / 8 幕')
    expect(badges.find((badge) => badge.id === 'first-light')?.done).toBe(true)
  })
})

describe('seedRadioBriefs parity', () => {
  it('stays in exact sync with seedRadioVisions metadata', () => {
    expect(lightSeedSignalCodes()).toEqual(seedSignalCodes())
    expect(SEED_RADIO_BRIEFS.length).toBe(18)
    for (const brief of SEED_RADIO_BRIEFS) {
      expect(lightSeedBrief(brief.code)).toEqual(fullSeedBrief(brief.code))
      expect(lightIsSeedCode(brief.code)).toBe(fullIsSeedCode(brief.code))
    }
  })
})

describe('prologueWorldMeta', () => {
  it('computes pure-math sunArc and preserves five world landmarks', () => {
    expect(WORLD_DISCOVERIES).toHaveLength(5)
    expect(sunArc(12.25).daylight).toBe(true)
    expect(sunArc(12.25).altitude).toBeGreaterThan(0.9)
    expect(sunArc(23).daylight).toBe(false)
  })
})
