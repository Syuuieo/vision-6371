import { describe, expect, it } from 'vitest'
import type { RadioSignalPreview, VisionOrigin } from '../types/vision'
import { resolveRadioEntry } from './radioEntry'

function preview(city: string, origin: VisionOrigin): RadioSignalPreview {
  return {
    code: 'ABCDEF',
    title: city,
    sender: '测试旅人',
    city,
    thumbnail: '',
    tempC: 20,
    windLevel: 0.5,
    scentTag: '风',
    particles: 'none',
    ambience: 'none',
    hasVoice: false,
    hearts: 0,
    visibility: 'public',
    origin,
    publishedAt: 1,
  }
}

describe('resolveRadioEntry', () => {
  it('sends the curated surface cities into their immersive diorama', () => {
    const expected: Record<string, string> = {
      阿格拉: 'agra',
      格鲁吉亚: 'georgia',
      复活节岛: 'rapanui',
      洛杉矶: 'griffith',
      吉萨: 'giza',
      罗马: 'rome',
      京都: 'kyoto',
      巴黎: 'paris',
      雷克雅未克: 'iceland',
      大理: 'dali',
      哈尔滨: 'harbin',
    }
    for (const [city, sceneId] of Object.entries(expected)) {
      expect(resolveRadioEntry(preview(city, 'seed'))).toEqual({ kind: 'world', sceneId })
    }
  })

  it('keeps real cloud and local photo posts in SignalViewer', () => {
    expect(resolveRadioEntry(preview('阿格拉', 'cloud'))).toEqual({ kind: 'signal' })
    expect(resolveRadioEntry(preview('洛杉矶', 'local'))).toEqual({ kind: 'signal' })
  })

  it('keeps legacy preset cities without a 3D world in SignalViewer', () => {
    expect(resolveRadioEntry(preview('北京', 'seed'))).toEqual({ kind: 'signal' })
    expect(resolveRadioEntry(preview('开普敦', 'seed'))).toEqual({ kind: 'signal' })
  })

  it('lets shared echo links force the real photo viewer', () => {
    expect(resolveRadioEntry(preview('阿格拉', 'seed'), true)).toEqual({ kind: 'signal' })
  })
})
