import { describe, expect, it } from 'vitest'
import { application } from '../../functions/routes.mjs'

class BackendError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

class FakeDb {
  constructor(tables = {}) {
    this.tables = { visions: [], vision_echoes: [], ...tables }
  }

  from(name) {
    const rows = (this.tables[name] ??= [])
    const query = {
      inserted: undefined,
      filters: [],
      orderBy: null,
      max: null,
      op: 'select',
      patch: null,
      select() {
        return this
      },
      eq(column, value) {
        this.filters.push([column, value])
        return this
      },
      order(column, options = {}) {
        this.orderBy = [column, options.ascending !== false]
        return this
      },
      limit(count) {
        this.max = count
        return this
      },
      insert(row) {
        rows.push({ ...row })
        this.inserted = [{ ...row }]
        return this
      },
      insertIfAbsent(row) {
        if (rows.some((entry) => entry.code === row.code)) {
          this.inserted = []
          return this
        }
        rows.push({ ...row })
        this.inserted = [{ ...row }]
        return this
      },
      update(patch) {
        this.op = 'update'
        this.patch = patch
        return this
      },
      delete() {
        this.op = 'delete'
        return this
      },
      matches(row) {
        return this.filters.every(([column, value]) => row[column] === value)
      },
      run() {
        if (this.inserted !== undefined) return this.inserted
        let matched = rows.filter((row) => this.matches(row))
        if (this.op === 'update') {
          matched.forEach((row) => Object.assign(row, this.patch))
          return matched.map((row) => ({ ...row }))
        }
        if (this.op === 'delete') {
          matched.forEach((row) => rows.splice(rows.indexOf(row), 1))
          return matched.map((row) => ({ ...row }))
        }
        if (this.orderBy) {
          const [column, ascending] = this.orderBy
          matched = [...matched].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1))
        }
        return (this.max == null ? matched : matched.slice(0, this.max)).map((row) => ({ ...row }))
      },
      then(resolve, reject) {
        try {
          resolve({ data: this.run() })
        } catch (error) {
          reject(error)
        }
      },
    }
    return query
  }
}

const VALID_TOKEN = 'a'.repeat(48)
const IMAGE = 'data:image/png;base64,' + 'A'.repeat(40)

function visionRow(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'ABC234',
    packet: { title: '测试', sender: '我', city: '南京' },
    hearts: 0,
    visibility: 'public',
    created_at: new Date().toISOString(),
    owner_token: VALID_TOKEN,
    ...overrides,
  }
}

function setup(tables) {
  const db = new FakeDb(tables)
  const app = application({ db, BackendError })
  return { app, db }
}

function call(app, path, init) {
  return app({ request: new Request(`https://site.test/functions/v1/app${path}`, init) })
}

function deletion(app, code, token) {
  return call(app, `/api/visions/${code}`, {
    method: 'DELETE',
    headers: token === undefined ? {} : { 'x-owner-token': token },
  })
}

describe('DELETE /api/visions/:code', () => {
  it('rejects a missing or malformed ownership token', async () => {
    const { app } = setup({ visions: [visionRow()] })
    await expect(deletion(app, 'ABC234')).rejects.toMatchObject({ code: 'invalid_input', status: 400 })
    await expect(deletion(app, 'ABC234', 'abc')).rejects.toMatchObject({ code: 'invalid_input', status: 400 })
  })

  it('refuses a mismatched token', async () => {
    const { app } = setup({ visions: [visionRow()] })
    await expect(deletion(app, 'ABC234', 'b'.repeat(48))).rejects.toMatchObject({ code: 'forbidden', status: 403 })
  })

  it('refuses legacy rows that never had a token', async () => {
    const { app } = setup({ visions: [visionRow({ owner_token: null })] })
    await expect(deletion(app, 'ABC234', VALID_TOKEN)).rejects.toMatchObject({ code: 'forbidden', status: 403 })
  })

  it('deletes the vision and its echoes for the owner', async () => {
    const { app, db } = setup({
      visions: [visionRow()],
      vision_echoes: [
        { id: 'e1', vision_id: '11111111-1111-4111-8111-111111111111', message: '留一句', created_at: new Date().toISOString() },
        { id: 'e2', vision_id: 'other', message: '别人的', created_at: new Date().toISOString() },
      ],
    })
    const response = await deletion(app, 'ABC234', VALID_TOKEN)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true, code: 'ABC234' })
    expect(db.tables.visions).toHaveLength(0)
    expect(db.tables.vision_echoes).toHaveLength(1)
    expect(db.tables.vision_echoes[0].id).toBe('e2')
  })

  it('is idempotent for codes that are already gone', async () => {
    const { app } = setup()
    const response = await deletion(app, 'ABC234', VALID_TOKEN)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true, code: 'ABC234' })
  })
})

describe('POST + GET ownership handling', () => {
  const packet = {
    title: '测试风景',
    sender: '我',
    city: '南京',
    image: IMAGE,
    particles: 'none',
    ambience: 'none',
    tempC: 12,
    windLevel: 1,
    scentTag: '',
    focus: [],
  }

  it('returns an owner token once and never exposes it on reads', async () => {
    const { app } = setup()
    const created = await call(app, '/api/visions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packet, thumbnail: IMAGE, visibility: 'public' }),
    })
    expect(created.status).toBe(201)
    const payload = await created.json()
    expect(payload.ownerToken).toMatch(/^[0-9a-f]{48}$/)

    const read = await call(app, `/api/visions/${payload.code}`, { method: 'GET' })
    expect(read.status).toBe(200)
    expect(JSON.stringify(await read.json())).not.toContain('owner')
  })

  it('throttles when the public burst window is full', async () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      visionRow({ code: `B${String(index).padStart(5, '0')}`, created_at: new Date().toISOString() }),
    )
    const { app } = setup({ visions: rows })
    await expect(
      call(app, '/api/visions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packet, thumbnail: IMAGE, visibility: 'public' }),
      }),
    ).rejects.toMatchObject({ code: 'rate_limited', status: 429 })
  })

  it('lets the same request through once the window has passed', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const rows = Array.from({ length: 40 }, (_, index) =>
      visionRow({ code: `C${String(index).padStart(5, '0')}`, created_at: old }),
    )
    const { app } = setup({ visions: rows })
    const response = await call(app, '/api/visions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packet, thumbnail: IMAGE, visibility: 'public' }),
    })
    expect(response.status).toBe(201)
  })
})
