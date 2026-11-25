const DB_NAME = 'vision6371_media_v1'
const STORE_NAME = 'media'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase | null> | null = null

export function isMediaDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isMediaDbAvailable()) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }
      request.onerror = () => {
        dbPromise = null
        resolve(null)
      }
      request.onblocked = () => {
        resolve(null)
      }
    } catch {
      dbPromise = null
      resolve(null)
    }
  })

  return dbPromise
}

export async function putMedia(key: string, value: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function getMedia(key: string): Promise<string | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => {
        resolve(typeof req.result === 'string' ? req.result : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function deleteMedia(key: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearMedia(): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function deleteMediaByPrefix(prefix: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const range =
        typeof IDBKeyRange !== 'undefined'
          ? IDBKeyRange.bound(prefix, `${prefix}\uffff`, false, true)
          : undefined
      const req = store.openCursor(range)
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
          cursor.delete()
        }
        cursor.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
