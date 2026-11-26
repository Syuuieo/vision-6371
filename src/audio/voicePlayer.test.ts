import { describe, expect, it } from 'vitest'
import { getCityVoiceId, voicePlayer } from './voicePlayer'

describe('voicePlayer', () => {
  it('maps domestic and preset global cities to pre-recorded mp3 slugs and returns null for unknown cities', () => {
    expect(getCityVoiceId('上海')).toBe('city-shanghai')
    expect(getCityVoiceId('西藏 · 拉萨')).toBe('city-lhasa')
    expect(getCityVoiceId('悉尼')).toBe('city-sydney')
    expect(getCityVoiceId('雷克雅未克')).toBe('city-reykjavik')
    expect(getCityVoiceId('未知小城')).toBeNull()
    expect(getCityVoiceId('')).toBeNull()
  })

  it('falls back gracefully in toggleWhisper when SpeechSynthesis is unavailable', async () => {
    const ok = await voicePlayer.toggleWhisper('whisper-未知小城', '“远方海风真温柔。”', null)
    expect(ok).toBe(false)
    expect(voicePlayer.getSnapshot()).toEqual({ playingId: null, loadingId: null })
  })
})
