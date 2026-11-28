import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAlbum,
  clearDioramaStamps,
  deleteAlbumEntry,
  inferAlbumSceneId,
  loadAlbum,
  loadDioramaStamps,
  markDioramaStamp,
  saveAlbumEntry,
  subscribeAlbum,
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
    sceneId: 'agra',
    sceneTitle: '阿格拉 · 泰姬陵破晓',
    city: '阿格拉',
    mood: 'dawn',
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
    expect(markDioramaStamp('agra')).toEqual(['agra'])
    expect(markDioramaStamp('agra')).toEqual(['agra'])
    expect(markDioramaStamp('georgia')).toEqual(['agra', 'georgia'])
    expect(markDioramaStamp('iceland')).toEqual(['agra', 'georgia', 'iceland'])
    expect(markDioramaStamp('kyoto')).toEqual(['agra', 'georgia', 'iceland', 'kyoto'])
    expect(markDioramaStamp('core')).toEqual(['agra', 'georgia', 'iceland', 'kyoto', 'core'])
    expect(markDioramaStamp('rome')).toEqual(['agra', 'georgia', 'iceland', 'kyoto', 'core', 'rome'])
    expect(markDioramaStamp('paris')).toEqual(['agra', 'georgia', 'iceland', 'kyoto', 'core', 'rome', 'paris'])
    expect(markDioramaStamp('dali')).toEqual(['agra', 'georgia', 'iceland', 'kyoto', 'core', 'rome', 'paris', 'dali'])
    expect(loadDioramaStamps()).toEqual(['agra', 'georgia', 'iceland', 'kyoto', 'core', 'rome', 'paris', 'dali'])
  })

  it('infers accurate album categories from city or preset', () => {
    expect(inferAlbumSceneId('阿格拉')).toBe('agra')
    expect(inferAlbumSceneId('泰姬陵', 'agra')).toBe('agra')
    expect(inferAlbumSceneId('悉尼')).toBe('sydney')
    expect(inferAlbumSceneId('格鲁吉亚 · 圣剑双峰', 'georgia')).toBe('georgia')
    expect(inferAlbumSceneId('哈尔滨')).toBe('harbin')
    expect(inferAlbumSceneId('雷克雅未克')).toBe('iceland')
    expect(inferAlbumSceneId('冰岛 · 极光峡湾')).toBe('iceland')
    expect(inferAlbumSceneId('京都')).toBe('kyoto')
    expect(inferAlbumSceneId('罗马 · 斗兽场')).toBe('rome')
    expect(inferAlbumSceneId('斗兽场', 'rome')).toBe('rome')
    expect(inferAlbumSceneId('巴黎 · 塞纳河')).toBe('paris')
    expect(inferAlbumSceneId('埃菲尔铁塔', 'paris')).toBe('paris')
    expect(inferAlbumSceneId('大理 · 洱海苍山')).toBe('dali')
    expect(inferAlbumSceneId('洱海', 'dali')).toBe('dali')
    expect(inferAlbumSceneId('落日六号')).toBe('core')
    expect(inferAlbumSceneId('地心深处', 'sunset')).toBe('core')
    expect(inferAlbumSceneId('大草原', 'meadow')).toBe('meadow')
    expect(inferAlbumSceneId('开普敦')).toBe('postcard')
  })

  it('preserves album entries by offloading large images when inline budget is exceeded', () => {
    const bigImage = 'data:image/jpeg;base64,' + 'A'.repeat(420_000)
    saveAlbumEntry({ ...makeEntry('big-1'), image: bigImage })
    saveAlbumEntry({ ...makeEntry('big-2'), image: bigImage })
    saveAlbumEntry({ ...makeEntry('big-3'), image: bigImage })

    const raw = window.localStorage.getItem('vision6371_keepsake_album_v1')
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw!) as AlbumEntry[]
    expect(stored).toHaveLength(3)
    expect(stored.some((item) => item.image.startsWith('idb:album:'))).toBe(true)

    // 同步读取仍可通过内存映射完整水合出原图
    const loaded = loadAlbum()
    expect(loaded).toHaveLength(3)
    expect(loaded.every((item) => item.image === bigImage)).toBe(true)
  })

  it('preserves cold-start idb-offloaded entries when saving a new entry', () => {
    const coldEntry: AlbumEntry = {
      ...makeEntry('cold-1', '刷新前的旧照片'),
      image: 'idb:album:cold-1',
    }
    window.localStorage.setItem('vision6371_keepsake_album_v1', JSON.stringify([coldEntry]))

    saveAlbumEntry(makeEntry('fresh-2', '重启后的新照片'))

    const raw = window.localStorage.getItem('vision6371_keepsake_album_v1')
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw!) as AlbumEntry[]
    expect(stored.map((item) => item.id)).toEqual(['fresh-2', 'cold-1'])
  })

  it('notifies subscribers on save, update, delete, and clearAlbum until unsubscribed', () => {
    let calls = 0
    const unsub = subscribeAlbum(() => {
      calls += 1
    })

    saveAlbumEntry(makeEntry('sub-1'))
    expect(calls).toBe(1)

    updateAlbumNote('sub-1', '实时同步留言')
    expect(calls).toBe(2)

    deleteAlbumEntry('sub-1')
    expect(calls).toBe(3)

    clearAlbum()
    expect(calls).toBe(4)

    unsub()
    saveAlbumEntry(makeEntry('sub-2'))
    expect(calls).toBe(4)
  })
})
