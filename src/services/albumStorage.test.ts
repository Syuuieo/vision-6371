import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAlbum,
  clearDioramaStamps,
  deleteAlbumEntry,
  loadAlbum,
  loadDioramaStamps,
  markDioramaStamp,
  saveAlbumEntry,
  updateAlbumNote,
  type AlbumEntry,
} from './albumStorage'

function createMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

function makeEntry(id: string, note = '留给此刻的留言'): AlbumEntry {
  return {
    id,
    sceneId: 'shanghai',
    sceneTitle: '上海外滩 · 黄浦暮色',
    city: '上海',
    mood: 'dusk',
    image: 'data:image/jpeg;base64,/9j/4AAQ',
    note,
    interactions: 3,
    createdAt: 1732435200000,
    promiseQuote: '替你多看两眼',
  }
}

describe('albumStorage', () => {
  beforeEach(() => {
    const localStorage = createMemoryStorage()
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
    })
    clearAlbum()
    clearDioramaStamps()
  })

  it('saves, loads, and updates personal notes', () => {
    saveAlbumEntry(makeEntry('e1', '第一页留言'))
    saveAlbumEntry(makeEntry('e2', '第二页留言'))
    const loaded = loadAlbum()
    expect(loaded.map((e) => e.id)).toEqual(['e2', 'e1'])

    updateAlbumNote('e1', '改写后的温暖留言')
    expect(loadAlbum().find((e) => e.id === 'e1')?.note).toBe('改写后的温暖留言')
  })

  it('deletes entries cleanly', () => {
    saveAlbumEntry(makeEntry('e1'))
    saveAlbumEntry(makeEntry('e2'))
    const remaining = deleteAlbumEntry('e2')
    expect(remaining.map((e) => e.id)).toEqual(['e1'])
    expect(loadAlbum().length).toBe(1)
  })

  it('supports dawn mood, awakened seal metadata, and diorama stamps', () => {
    const entry: AlbumEntry = {
      ...makeEntry('dawn-1', '晨光里的风帆与海豚'),
      sceneId: 'sydney',
      mood: 'dawn',
      awakened: true,
      stampTitle: '盛夏扬帆印记',
    }
    saveAlbumEntry(entry)
    const [saved] = loadAlbum()
    expect(saved.mood).toBe('dawn')
    expect(saved.awakened).toBe(true)
    expect(saved.stampTitle).toBe('盛夏扬帆印记')

    expect(loadDioramaStamps()).toEqual([])
    expect(markDioramaStamp('shanghai')).toEqual(['shanghai'])
    expect(markDioramaStamp('shanghai')).toEqual(['shanghai'])
    expect(markDioramaStamp('observatory')).toEqual(['shanghai', 'observatory'])
  })
})
