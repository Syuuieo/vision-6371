import { describe, expect, it } from 'vitest'
import { getCityVoiceId, voicePlayer } from './voicePlayer'

describe('voicePlayer', () => {
  it('maps domestic cities to pre-recorded mp3 slugs and returns null for overseas cities', () => {
    expect(getCityVoiceId('上海')).toBe('city-shanghai')
    expect(getCityVoiceId('西藏 · 拉萨')).toBe('city-lhasa')
    expect(getCityVoiceId('悉尼')).toBeNull()
    expect(getCityVoiceId('雷克雅未克')).toBeNull()
    expect(getCityVoiceId('')).toBeNull()
  })

  it('falls back gracefully in toggleWhisper when SpeechSynthesis is unavailable', async () => {
    const ok = await voicePlayer.toggleWhisper('whisper-悉尼', '“悉尼海风真温柔。”', null)
    expect(ok).toBe(false)
    expect(voicePlayer.getSnapshot()).toEqual({ playingId: null, loadingId: null })
  })
})
