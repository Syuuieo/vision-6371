#!/usr/bin/env node
/**
 * Batch-synthesize Windpost (风信) voiceovers via Aliyun DashScope Qwen-TTS
 * (`qwen3-tts-flash`) and encode them as 96 kbps mono `.mp3` files under `public/voice/`.
 *
 * Usage:
 *   $env:DASHSCOPE_API_KEY="sk-..."
 *   node scripts/generate-voices.mjs [--skip-existing] [--only=id1,id2] [--concurrency=2]
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mp3Encoder } from '@breezystack/lamejs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const GUIDE_PATH = path.join(ROOT_DIR, 'VOICE_SCRIPT_GUIDE.md')
const STORY_RELAY_PATH = path.join(ROOT_DIR, 'src', 'utils', 'storyRelay.ts')
const VOICE_PLAYER_PATH = path.join(ROOT_DIR, 'src', 'audio', 'voicePlayer.ts')
const OUT_DIR = path.join(ROOT_DIR, 'public', 'voice')

const DASHSCOPE_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const TTS_MODEL = 'qwen3-tts-flash'
const MP3_KBPS = 96
const MIN_MP3_BYTES = 4096
const RETRY_DELAYS_MS = [1500, 3000, 6000, 12000]

const CITY_WHISPER_INSTRUCTIONS =
  '温柔怀念、轻声讲述，像远方电台里老朋友在耳边低语，语速舒缓自然。'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stripQuotesAndMarkdown(raw) {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[“”"]/g, '')
    .trim()
}

function mapRoleToVoice(role) {
  if (role.includes('陈舟')) return 'Ethan'
  if (role.includes('旁白')) return 'Kai'
  return 'Serena'
}

function parseArgs(argv) {
  let skipExisting = false
  let concurrency = 2
  let only = null

  for (const arg of argv) {
    if (arg === '--skip-existing') {
      skipExisting = true
    } else if (arg.startsWith('--only=')) {
      const items = arg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      only = new Set(items)
    } else if (arg.startsWith('--concurrency=')) {
      const parsed = Number.parseInt(arg.slice('--concurrency='.length), 10)
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 8) {
        throw new Error(`Invalid --concurrency value: ${arg}`)
      }
      concurrency = parsed
    } else {
      throw new Error(`Unknown CLI flag: ${arg}`)
    }
  }

  return { skipExisting, concurrency, only }
}

function parsePrologueScript(markdown) {
  const jobs = []
  const rowPattern = /^\|\s*`([^`]+)`\s*\|\s*`(public\/voice\/[^`]+\.mp3)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm

  for (const match of markdown.matchAll(rowPattern)) {
    const [, id, relPath, roleRaw, emotionRaw, textRaw] = match
    const role = roleRaw.trim()
    const instructions = stripQuotesAndMarkdown(emotionRaw)
    const text = stripQuotesAndMarkdown(textRaw)
    if (!id || !text) continue

    jobs.push({
      id: id.trim(),
      outPath: path.join(ROOT_DIR, relPath),
      voice: mapRoleToVoice(role),
      instructions,
      text,
    })
  }

  return jobs
}

function parseObjectBlock(source, exportName) {
  const pattern = new RegExp(`export const ${exportName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`)
  const match = source.match(pattern)
  if (!match) {
    throw new Error(`Unable to locate ${exportName} in source file`)
  }
  const map = {}
  const entryPattern = /^\s*([^\s:]+)\s*:\s*'([^']+)'\s*,?\s*$/gm
  for (const entry of match[1].matchAll(entryPattern)) {
    map[entry[1].trim()] = entry[2].trim()
  }
  return map
}

function buildCityJobs(voicePlayerSrc, storyRelaySrc) {
  const citySlugs = parseObjectBlock(voicePlayerSrc, 'CITY_VOICE_SLUGS')
  const cityWhispers = parseObjectBlock(storyRelaySrc, 'CITY_LINWEI_WHISPERS')
  const jobs = []

  for (const [city, slug] of Object.entries(citySlugs)) {
    const rawLine = cityWhispers[city]
    if (!rawLine) {
      throw new Error(`Missing Lin Wei whisper line for domestic city: ${city}`)
    }
    const id = `city-${slug}`
    jobs.push({
      id,
      outPath: path.join(OUT_DIR, `${id}.mp3`),
      voice: 'Serena',
      instructions: CITY_WHISPER_INSTRUCTIONS,
      text: stripQuotesAndMarkdown(rawLine),
    })
  }

  return jobs
}

function parseWavPcm(wavBuffer) {
  if (wavBuffer.length < 44) {
    throw new Error(`WAV buffer too small: ${wavBuffer.length} bytes`)
  }
  if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF' || wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Downloaded audio is not a valid RIFF/WAVE file')
  }

  let channels = 0
  let sampleRate = 0
  let bitsPerSample = 0
  let dataOffset = -1
  let dataSize = 0
  let offset = 12

  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4)
    const chunkSize = wavBuffer.readUInt32LE(offset + 4)
    const bodyStart = offset + 8
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      const audioFormat = wavBuffer.readUInt16LE(bodyStart)
      if (audioFormat !== 1) {
        throw new Error(`Unsupported WAV format code ${audioFormat}; expected PCM (1)`)
      }
      channels = wavBuffer.readUInt16LE(bodyStart + 2)
      sampleRate = wavBuffer.readUInt32LE(bodyStart + 4)
      bitsPerSample = wavBuffer.readUInt16LE(bodyStart + 14)
    } else if (chunkId === 'data') {
      dataOffset = bodyStart
      dataSize = Math.min(chunkSize, wavBuffer.length - bodyStart)
      break
    }
    offset = bodyStart + chunkSize + (chunkSize % 2)
  }

  if (!channels || !sampleRate || bitsPerSample !== 16 || dataOffset < 0 || dataSize <= 0) {
    throw new Error(
      `Invalid WAV PCM metadata (ch=${channels}, sr=${sampleRate}, bits=${bitsPerSample}, data=${dataSize})`,
    )
  }

  const sampleCount = Math.floor(dataSize / 2)
  const samples = new Int16Array(sampleCount)
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = wavBuffer.readInt16LE(dataOffset + i * 2)
  }

  return { channels, sampleRate, samples }
}

function encodeMonoOrStereoMp3({ channels, sampleRate, samples }) {
  const encoder = new Mp3Encoder(channels, sampleRate, MP3_KBPS)
  const blockSize = 1152
  const chunks = []

  if (channels === 1) {
    for (let i = 0; i < samples.length; i += blockSize) {
      const slice = samples.subarray(i, i + blockSize)
      const encoded = encoder.encodeBuffer(slice)
      if (encoded.length > 0) {
        chunks.push(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength))
      }
    }
  } else if (channels === 2) {
    const frames = Math.floor(samples.length / 2)
    const left = new Int16Array(frames)
    const right = new Int16Array(frames)
    for (let i = 0; i < frames; i += 1) {
      left[i] = samples[i * 2]
      right[i] = samples[i * 2 + 1]
    }
    for (let i = 0; i < frames; i += blockSize) {
      const encoded = encoder.encodeBuffer(
        left.subarray(i, i + blockSize),
        right.subarray(i, i + blockSize),
      )
      if (encoded.length > 0) {
        chunks.push(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength))
      }
    }
  } else {
    throw new Error(`Unsupported channel count: ${channels}`)
  }

  const flushed = encoder.flush()
  if (flushed.length > 0) {
    chunks.push(Buffer.from(flushed.buffer, flushed.byteOffset, flushed.byteLength))
  }

  return Buffer.concat(chunks)
}

function hasValidMp3Header(buf) {
  if (buf.length < 4) return false
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0
}

async function fetchWithRetry(url, options, label) {
  let lastError = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(25000),
      })
      if (res.status === 429 || res.status >= 500) {
        const errText = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} on ${label}: ${errText.slice(0, 240)}`)
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        const fatal = new Error(`Non-retryable HTTP ${res.status} on ${label}: ${errText.slice(0, 320)}`)
        fatal.nonRetryable = true
        throw fatal
      }
      return res
    } catch (err) {
      lastError = err
      if (err && typeof err === 'object' && 'nonRetryable' in err && err.nonRetryable) {
        throw err
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        const waitMs = RETRY_DELAYS_MS[attempt]
        console.warn(`[retry ${attempt + 1}/${RETRY_DELAYS_MS.length}] ${label}: waiting ${waitMs}ms`)
        await sleep(waitMs)
      }
    }
  }

  throw lastError
}

async function synthesizeJob(job, apiKey) {
  const res = await fetchWithRetry(
    DASHSCOPE_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: {
          text: job.text,
          voice: job.voice,
          language_type: 'Chinese',
          instructions: job.instructions,
        },
      }),
    },
    `TTS ${job.id}`,
  )

  const payload = await res.json()
  const audioUrl = payload?.output?.audio?.url
  if (typeof audioUrl !== 'string' || !audioUrl) {
    throw new Error(`Missing output.audio.url for ${job.id}: ${JSON.stringify(payload).slice(0, 240)}`)
  }

  const audioRes = await fetchWithRetry(audioUrl, { method: 'GET' }, `WAV download ${job.id}`)
  const wavBuf = Buffer.from(await audioRes.arrayBuffer())
  const pcm = parseWavPcm(wavBuf)
  const mp3Buf = encodeMonoOrStereoMp3(pcm)

  if (mp3Buf.length <= MIN_MP3_BYTES || !hasValidMp3Header(mp3Buf)) {
    throw new Error(`Encoded MP3 failed integrity check for ${job.id} (${mp3Buf.length} bytes)`)
  }

  const tmpPath = `${job.outPath}.tmp`
  await fs.writeFile(tmpPath, mp3Buf)
  await fs.rename(tmpPath, job.outPath)

  return mp3Buf.length
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey) {
    console.error('Error: DASHSCOPE_API_KEY environment variable is required.')
    process.exit(1)
  }

  const { skipExisting, concurrency, only } = parseArgs(process.argv.slice(2))
  const [guideMd, storyRelaySrc, voicePlayerSrc] = await Promise.all([
    fs.readFile(GUIDE_PATH, 'utf8'),
    fs.readFile(STORY_RELAY_PATH, 'utf8'),
    fs.readFile(VOICE_PLAYER_PATH, 'utf8'),
  ])

  const prologueJobs = parsePrologueScript(guideMd)
  const cityJobs = buildCityJobs(voicePlayerSrc, storyRelaySrc)
  const allJobs = [...prologueJobs, ...cityJobs]

  if (prologueJobs.length !== 28 || cityJobs.length !== 20 || allJobs.length !== 48) {
    throw new Error(
      `Expected 28 prologue + 20 city = 48 jobs, got ${prologueJobs.length} + ${cityJobs.length} = ${allJobs.length}`,
    )
  }

  const selectedJobs = only ? allJobs.filter((job) => only.has(job.id)) : allJobs
  if (selectedJobs.length === 0) {
    throw new Error('No matching voice jobs selected.')
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  console.log(
    `Queued ${selectedJobs.length}/${allJobs.length} voiceover jobs (model=${TTS_MODEL}, concurrency=${concurrency})`,
  )

  let cursor = 0
  let completed = 0
  let skipped = 0
  const failures = []

  async function worker() {
    while (cursor < selectedJobs.length) {
      const idx = cursor
      cursor += 1
      const job = selectedJobs[idx]

      if (skipExisting && (await fileExists(job.outPath))) {
        skipped += 1
        console.log(`[skip ${idx + 1}/${selectedJobs.length}] ${job.id}`)
        continue
      }

      try {
        const bytes = await synthesizeJob(job, apiKey)
        completed += 1
        console.log(
          `[ok ${idx + 1}/${selectedJobs.length}] ${job.id}.mp3 (${job.voice}, ${(bytes / 1024).toFixed(1)} KB)`,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failures.push({ id: job.id, message })
        console.error(`[fail ${idx + 1}/${selectedJobs.length}] ${job.id}: ${message}`)
      }

      await sleep(250)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, selectedJobs.length) }, () => worker()))

  console.log(`Done: synthesized=${completed}, skipped=${skipped}, failed=${failures.length}`)
  if (failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
