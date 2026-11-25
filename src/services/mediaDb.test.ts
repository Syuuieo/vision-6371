import { describe, expect, it } from 'vitest'
import { deleteMediaByPrefix, getMedia, putMedia } from './mediaDb'

function installFakeIndexedDb(store: Map<string, string>) {
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    transaction: () => {
      const tx: {
        oncomplete: (() => void) | null
        onerror: (() => void) | null
        onabort: (() => void) | null
        objectStore: () => unknown
      } = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => ({
          put: (value: string, key: string) => {
            store.set(key, value)
            queueMicrotask(() => tx.oncomplete?.())
          },
          get: (key: string) => {
            const req: { result?: unknown; onsuccess: (() => void) | null; onerror: null } = {
              result: undefined,
              onsuccess: null,
              onerror: null,
            }
            queueMicrotask(() => {
              req.result = store.get(key)
              req.onsuccess?.()
            })
            return req
          },
          openCursor: (range?: { lower: string; upper: string }) => {
            const keys = Array.from(store.keys())
              .filter((k) => !range || (k >= range.lower && k < range.upper))
              .sort()
            let index = 0
            const req: { result: unknown; onsuccess: (() => void) | null } = {
              result: null,
              onsuccess: null,
            }
            const advance = () => {
              if (index >= keys.length) {
                req.result = null
                req.onsuccess?.()
                tx.oncomplete?.()
                return
              }
              const key = keys[index++]
              req.result = {
                key,
                delete: () => {
                  store.delete(key)
                },
                continue: () => {
                  queueMicrotask(advance)
                },
              }
              req.onsuccess?.()
            }
            queueMicrotask(advance)
            return req
          },
        }),
      }
      return tx
    },
  }

  Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: {
      bound: (lower: string, upper: string) => ({ lower, upper }),
    },
    configurable: true,
  })

  Object.defineProperty(globalThis, 'window', {
    value: {
      indexedDB: {
        open: () => {
          const req: { result: unknown; onsuccess: (() => void) | null; onupgradeneeded: null; onerror: null; onblocked: null } = {
            result: fakeDb,
            onsuccess: null,
            onupgradeneeded: null,
            onerror: null,
            onblocked: null,
          }
          queueMicrotask(() => req.onsuccess?.())
          return req
        },
      },
    },
    configurable: true,
  })
}

describe('mediaDb', () => {
  it('deleteMediaByPrefix removes matching album entries while keeping vision voices', async () => {
    const store = new Map<string, string>()
    installFakeIndexedDb(store)

    await putMedia('album:frame-1', 'data:image/jpeg;base64,AAA')
    await putMedia('album:frame-2', 'data:image/jpeg;base64,BBB')
    await putMedia('vision-voice:VR9999', 'data:audio/webm;base64,CCC')

    await deleteMediaByPrefix('album:')

    expect(await getMedia('album:frame-1')).toBeNull()
    expect(await getMedia('album:frame-2')).toBeNull()
    expect(await getMedia('vision-voice:VR9999')).toBe('data:audio/webm;base64,CCC')
  })
})
