import { describe, expect, it } from 'vitest'
import { CITY_SIGNATURES, citySignature, signatureFor } from './citySignature'

const CITIES = [
  '北京',
  '哈尔滨',
  '三亚',
  '青岛',
  '大理',
  '武汉',
  '拉萨',
  '上海',
  '成都',
  '西安',
  '杭州',
  '南京',
  '悉尼',
  '夏威夷',
  '雷克雅未克',
  '开普敦',
  '京都',
  '巴黎',
]

describe('citySignature', () => {
  it('covers all eighteen global cities', () => {
    for (const city of CITIES) {
      expect(CITY_SIGNATURES[city], city).toBeTruthy()
    }
  })

  it('gives every city a distinct weather word', () => {
    const weathers = CITIES.map((city) => CITY_SIGNATURES[city].weather)
    expect(new Set(weathers).size).toBe(CITIES.length)
  })

  it('gives every city a distinct verb', () => {
    const verbs = CITIES.map((city) => CITY_SIGNATURES[city].verb)
    expect(new Set(verbs).size).toBe(CITIES.length)
  })

  it('keeps replies short enough for the bubble', () => {
    for (const city of CITIES) {
      const { reply } = CITY_SIGNATURES[city]
      expect(reply.length).toBeGreaterThan(10)
      expect(reply.length).toBeLessThan(80)
    }
  })

  it('returns null for unknown cities and a usable fallback', () => {
    expect(citySignature('不存在的城市')).toBeNull()
    const fallback = signatureFor('不存在的城市', 'ocean')
    expect(fallback.weather).toBe('')
    expect(fallback.effect).toBe('ripple')
    expect(fallback.verb.length).toBeGreaterThan(0)
    expect(fallback.reply.length).toBeGreaterThan(0)
  })

  it('prefers the city table over the ambience fallback', () => {
    expect(signatureFor('南京', 'wind').effect).toBe('drizzle')
    expect(signatureFor('三亚', 'wind').weather).toBe('闷热无风')
    expect(signatureFor('悉尼', 'wind').weather).toBe('南半球盛夏')
  })
})
