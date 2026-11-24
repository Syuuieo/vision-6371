// 地球表面电台的公开接口：匿名可投递 / 接收，所有数据库访问都在函数内完成。
const MAX_BODY_BYTES = 9 * 1024 * 1024
const MAX_IMAGE_CHARS = 4_600_000
const MAX_VOICE_CHARS = 2_600_000
const MAX_THUMBNAIL_CHARS = 360_000
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PARTICLES = new Set(['rain', 'firefly', 'snow', 'dust', 'none'])
const AMBIENCES = new Set(['wind', 'rain', 'ocean', 'cicada', 'night', 'library', 'snow', 'city', 'none'])
const MAX_ECHOES = 24
const PUBLIC_BURST_WINDOW_MS = 10 * 60 * 1000
const PUBLIC_BURST_LIMIT = 40

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value, max, required = false) => typeof value === 'string'
  && value.length <= max
  && (!required || value.trim().length > 0)
  && !value.includes('\0')

function imageData(value, max) {
  return typeof value === 'string'
    && value.length > 32
    && value.length <= max
    && /^data:image\/(?:webp|jpeg|png);base64,/i.test(value)
}

function voiceData(value, max) {
  return typeof value === 'string'
    && value.length > 32
    && value.length <= max
    && /^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?;base64,/i.test(value)
}

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let code = ''
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return code
}

function makeOwnerToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let token = ''
  for (const byte of bytes) token += byte.toString(16).padStart(2, '0')
  return token
}

function cleanFocus(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 3).map((point, index) => {
    if (!isRecord(point)) return null
    const x = Number(point.x)
    const y = Number(point.y)
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null
    return {
      id: text(point.id, 64) ? point.id : `focus-${index + 1}`,
      x,
      y,
      note: text(point.note, 160) ? point.note : '',
    }
  }).filter(Boolean)
}

function cleanPacket(value) {
  if (!isRecord(value)) return null
  if (!text(value.title, 80, true) || !text(value.sender, 40, true) || !text(value.city, 30, true)) return null
  if (!imageData(value.image, MAX_IMAGE_CHARS)) return null
  if (!PARTICLES.has(value.particles) || !AMBIENCES.has(value.ambience)) return null
  const tempC = Number(value.tempC)
  const windLevel = Number(value.windLevel)
  if (!Number.isFinite(tempC) || tempC < -60 || tempC > 60) return null
  if (!Number.isInteger(windLevel) || windLevel < 0 || windLevel > 3) return null
  const voice = value.voice == null
    ? null
    : voiceData(value.voice, MAX_VOICE_CHARS) ? value.voice : null
  return {
    id: text(value.id, 64) ? value.id : crypto.randomUUID(),
    title: value.title.trim(),
    sender: value.sender.trim(),
    city: value.city.trim(),
    image: value.image,
    particles: value.particles,
    ambience: value.ambience,
    voice,
    tempC: Math.round(tempC),
    windLevel,
    scentTag: text(value.scentTag, 50) ? value.scentTag.trim() : '',
    focus: cleanFocus(value.focus),
    createdAt: Date.now(),
  }
}

function echoOf(row) {
  return {
    id: row.id,
    message: row.message,
    createdAt: Date.parse(row.created_at),
  }
}

function previewOf(row) {
  return {
    code: row.code,
    title: row.title,
    sender: row.sender,
    city: row.city,
    thumbnail: row.thumbnail,
    tempC: row.temp_c,
    windLevel: row.wind_level,
    scentTag: row.scent_tag,
    particles: row.particles,
    ambience: row.ambience,
    hasVoice: row.has_voice === true,
    hearts: row.hearts,
    visibility: 'public',
    origin: 'cloud',
    publishedAt: Date.parse(row.created_at),
  }
}

export function application({ db, BackendError }) {
  const fail = (code, status) => { throw new BackendError(code, status) }
  const rows = (result) => {
    if (result.error) fail(result.error.code, result.error.status)
    return result.data
  }

  async function input(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) fail('invalid_input', 400)
    const reader = request.body?.getReader()
    if (!reader) fail('invalid_input', 400)
    let size = 0
    const chunks = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > MAX_BODY_BYTES) {
          await reader.cancel()
          fail('payload_too_large', 413)
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      fail('invalid_input', 400)
    }
  }

  async function findVision(code) {
    const found = rows(await db.from('visions')
      .select('id,code,packet,hearts,visibility,created_at,owner_token')
      .eq('code', code)
      .limit(1))
    return found?.[0] ?? null
  }

  async function recentEchoes(visionId) {
    const found = rows(await db.from('vision_echoes')
      .select('id,message,created_at')
      .eq('vision_id', visionId)
      .order('created_at', { ascending: false })
      .limit(MAX_ECHOES))
    return (found ?? []).map(echoOf)
  }

  async function assertPublicQuota() {
    const recent = rows(await db.from('visions')
      .select('created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(PUBLIC_BURST_LIMIT))
    if (!recent || recent.length < PUBLIC_BURST_LIMIT) return
    const oldest = Date.parse(recent[recent.length - 1].created_at)
    if (Number.isFinite(oldest) && Date.now() - oldest < PUBLIC_BURST_WINDOW_MS) {
      fail('rate_limited', 429)
    }
  }

  async function createVision(body) {
    if (!isRecord(body)) fail('invalid_input', 400)
    const packet = cleanPacket(body.packet)
    if (!packet) fail('invalid_input', 400)
    const visibility = body.visibility === 'private' ? 'private' : 'public'
    if (visibility === 'public') await assertPublicQuota()
    let thumbnail
    if (body.thumbnail != null) {
      if (!imageData(body.thumbnail, MAX_THUMBNAIL_CHARS)) fail('invalid_input', 400)
      thumbnail = body.thumbnail
    } else if (packet.image.length <= MAX_THUMBNAIL_CHARS) {
      thumbnail = packet.image
    } else {
      fail('invalid_input', 400)
    }
    const ownerToken = makeOwnerToken()
    const record = {
      title: packet.title,
      sender: packet.sender,
      city: packet.city,
      thumbnail,
      particles: packet.particles,
      ambience: packet.ambience,
      has_voice: packet.voice !== null,
      temp_c: packet.tempC,
      wind_level: packet.windLevel,
      scent_tag: packet.scentTag,
      visibility,
      hearts: 0,
      created_at: new Date().toISOString(),
      packet,
      owner_token: ownerToken,
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = makeCode()
      const inserted = rows(await db.from('visions')
        .insertIfAbsent({ ...record, code }, { onConflict: 'code' })
        .select('code,created_at'))
      if (inserted?.length) return { code, publishedAt: Date.parse(inserted[0].created_at), ownerToken }
    }
    fail('code_unavailable', 503)
  }

  return async (ctx) => {
    const request = ctx.request
    const pathname = new URL(request.url).pathname
    const match = pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/)
    if (!match) fail('not_found', 404)
    const path = match[1] || '/'

    if (path === '/api/health' && request.method === 'GET') {
      return json({ ok: true })
    }

    if (path === '/api/visions' && request.method === 'GET') {
      const url = new URL(request.url)
      const sort = url.searchParams.get('sort') === 'hot' ? 'hot' : 'new'
      const limit = Math.min(48, Math.max(1, Number(url.searchParams.get('limit')) || 32))
      let query = db.from('visions')
        .select('code,title,sender,city,thumbnail,particles,ambience,has_voice,temp_c,wind_level,scent_tag,hearts,created_at')
        .eq('visibility', 'public')
      query = sort === 'hot'
        ? query.order('hearts', { ascending: false }).order('created_at', { ascending: false })
        : query.order('created_at', { ascending: false })
      const found = rows(await query.limit(limit))
      return json({ items: (found ?? []).map(previewOf) })
    }

    if (path === '/api/visions' && request.method === 'POST') {
      const result = await createVision(await input(request))
      return json(result, 201)
    }

    const heartbeat = path.match(/^\/api\/visions\/([A-Za-z0-9]{6})\/heartbeat$/)
    if (heartbeat && request.method === 'POST' && /^[A-Z2-9]{6}$/.test(heartbeat[1].toUpperCase())) {
      const body = await input(request)
      const message = body?.message == null ? '' : body.message
      if (message !== '' && (typeof message !== 'string' || !message.trim() || message.trim().length > 120)) {
        fail('invalid_input', 400)
      }
      const code = heartbeat[1].toUpperCase()
      const vision = await findVision(code)
      if (!vision) fail('not_found', 404)
      let hearts = vision.hearts
      let written = false
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (!Number.isSafeInteger(hearts) || hearts < 0 || hearts >= 2147483647) fail('write_conflict', 409)
        const updated = rows(await db.from('visions')
          .update({ hearts: hearts + 1 })
          .eq('id', vision.id)
          .eq('hearts', hearts)
          .select('hearts'))
        if (updated?.length) {
          hearts = updated[0].hearts
          written = true
          break
        }
        const again = await findVision(code)
        if (!again) fail('not_found', 404)
        hearts = again.hearts
      }
      if (!written) fail('write_conflict', 409)
      if (message.trim()) {
        rows(await db.from('vision_echoes').insert({
          vision_id: vision.id,
          message: message.trim(),
          created_at: new Date().toISOString(),
        }))
      }
      return json({ hearts, echoes: await recentEchoes(vision.id) })
    }

    const signal = path.match(/^\/api\/visions\/([A-Za-z0-9]{6})$/)
    if (signal && /^[A-Z2-9]{6}$/.test(signal[1].toUpperCase())) {
      const code = signal[1].toUpperCase()

      if (request.method === 'DELETE') {
        const token = request.headers.get('x-owner-token') ?? ''
        if (!/^[0-9a-f]{48}$/.test(token)) fail('invalid_input', 400)
        const vision = await findVision(code)
        if (!vision) return json({ deleted: true, code })
        if (!vision.owner_token || vision.owner_token !== token) fail('forbidden', 403)
        rows(await db.from('vision_echoes').delete().eq('vision_id', vision.id).select('id'))
        const removed = rows(await db.from('visions').delete().eq('id', vision.id).select('id'))
        if (!removed?.length) fail('write_conflict', 409)
        return json({ deleted: true, code })
      }

      if (request.method === 'GET') {
        const vision = await findVision(code)
        if (!vision) fail('not_found', 404)
        return json({
          code: vision.code,
          packet: vision.packet,
          hearts: vision.hearts,
          echoes: await recentEchoes(vision.id),
          visibility: vision.visibility === 'private' ? 'private' : 'public',
          origin: 'cloud',
          publishedAt: Date.parse(vision.created_at),
        })
      }
    }

    fail('not_found', 404)
  }
}