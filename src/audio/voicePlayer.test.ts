import { describe, expect, it } from 'vitest'
import { voicePlayer } from './voicePlayer'

describe('voicePlayer', () => {
  it('starts idle and safely handles empty ids or missing AudioContext', async () => {
    expect(voicePlayer.getSnapshot()).toEqual({ playingId: null, loadingId: null })
    await expect(voicePlayer.play('')).resolves.toBe(false)
    await expect(voicePlayer.preload('')).resolves.toBeNull()
    expect(voicePlayer.getSnapshot()).toEqual({ playingId: null, loadingId: null })
  })

  it('supports stop and mute calls cleanly without throwing when uninitialized', () => {
    voicePlayer.setMuted(true)
    voicePlayer.stop()
    voicePlayer.setMuted(false)
    expect(voicePlayer.getSnapshot()).toEqual({ playingId: null, loadingId: null })
  })
})
