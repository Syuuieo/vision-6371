import { describe, expect, it } from 'vitest'
import {
  ROAM_MUSIC_CYCLE,
  ROAM_MUSIC_TRACKS,
  getRoamTrackMeta,
  resolveTrackForHour,
} from './roamMusic'

describe('roamMusic', () => {
  it('maps 24-hour solar hours to the three atmospheric light-music suites', () => {
    expect(resolveTrackForHour(6.5)).toBe('breeze')
    expect(resolveTrackForHour(11.4)).toBe('breeze')
    expect(resolveTrackForHour(12.5)).toBe('kalimba')
    expect(resolveTrackForHour(17.2)).toBe('kalimba')
    expect(resolveTrackForHour(18.2)).toBe('nocturne')
    expect(resolveTrackForHour(23.5)).toBe('nocturne')
    expect(resolveTrackForHour(2.0)).toBe('nocturne')
    expect(resolveTrackForHour(-1)).toBe('nocturne')
    expect(resolveTrackForHour(30.5)).toBe('breeze')
  })

  it('exposes complete metadata for all suites and preference cycle', () => {
    expect(ROAM_MUSIC_TRACKS).toHaveLength(3)
    expect(ROAM_MUSIC_CYCLE).toEqual(['auto', 'breeze', 'kalimba', 'nocturne', 'off'])
    for (const track of ROAM_MUSIC_TRACKS) {
      expect(getRoamTrackMeta(track.id).title).toBe(track.title)
      expect(track.tempoMs).toBeGreaterThan(260)
    }
  })
})
