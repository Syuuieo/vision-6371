import { useSyncExternalStore } from 'react'
import { seedBrief, seedSignalCodes } from '../data/seedRadioVisions'
import { getCityWhisper, type StoryRelayState } from '../utils/storyRelay'

export interface JourneyState {
  actsSeen: number[]
  eggsFound: string[]
  heartbeats: number
  echoesLeft: number
  visionsSent: number
  visitDays: string[]
  echoReadDay: string | null
}

const STORAGE_KEY = 'vision6371:journey:v1'
const MAX_VISIT_DAYS = 90

const DEFAULT_JOURNEY: JourneyState = {
  actsSeen: [],
  eggsFound: [],
  heartbeats: 0,
  echoesLeft: 0,
  visionsSent: 0,
  visitDays: [],
  echoReadDay: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))].slice(0, max)
}

function counter(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function normalize(raw: unknown): JourneyState {
  if (!isRecord(raw)) return DEFAULT_JOURNEY
  return {
    actsSeen: Array.isArray(raw.actsSeen)
      ? [...new Set(raw.actsSeen.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 8))].sort(
          (a, b) => a - b,
        )
      : [],
    eggsFound: strings(raw.eggsFound, 8),
    heartbeats: counter(raw.heartbeats),
    echoesLeft: counter(raw.echoesLeft),
    visionsSent: counter(raw.visionsSent),
    visitDays: strings(raw.visitDays, MAX_VISIT_DAYS),
    echoReadDay: typeof raw.echoReadDay === 'string' ? raw.echoReadDay : null,
  }
}

function load(): JourneyState {
  if (typeof window === 'undefined') return DEFAULT_JOURNEY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalize(JSON.parse(raw)) : DEFAULT_JOURNEY
  } catch {
    return DEFAULT_JOURNEY
  }
}

let current: JourneyState = load()
const listeners = new Set<() => void>()

function commit(next: JourneyState) {
  current = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage disabled or full */
    }
  }
  listeners.forEach((listener) => listener())
}

export function getJourney(): JourneyState {
  return current
}

export function subscribeJourney(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useJourney(): JourneyState {
  return useSyncExternalStore(subscribeJourney, getJourney, getJourney)
}

export function todayKey(now = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function markVisitDay(day = todayKey()) {
  if (current.visitDays.includes(day)) return
  commit({ ...current, visitDays: [...current.visitDays, day].slice(-MAX_VISIT_DAYS) })
}

export function markActSeen(act: number) {
  if (!Number.isInteger(act) || act < 1 || act > 8 || current.actsSeen.includes(act)) return
  commit({ ...current, actsSeen: [...current.actsSeen, act].sort((a, b) => a - b) })
}

export function markEggFound(id: string) {
  if (current.eggsFound.includes(id)) return
  commit({ ...current, eggsFound: [...current.eggsFound, id].slice(0, 8) })
}

export function countHeartbeat() {
  commit({ ...current, heartbeats: current.heartbeats + 1 })
}

export function countEcho() {
  commit({ ...current, echoesLeft: current.echoesLeft + 1 })
}

export function countVisionSent() {
  commit({ ...current, visionsSent: current.visionsSent + 1 })
}

export function markEchoRead(day: string) {
  if (current.echoReadDay === day) return
  commit({ ...current, echoReadDay: day })
}

export interface Milestone {
  id: string
  title: string
  hint: string
  done: boolean
  progress: string
}

export function milestones(journey: JourneyState, relay: StoryRelayState): Milestone[] {
  const acts = journey.actsSeen.length
  const eggs = journey.eggsFound.length
  const cities = relay.relayedCities.length
  const days = journey.visitDays.length
  return [
    {
      id: 'first-light',
      title: '戴上她的眼睛',
      hint: '进入序章的第一幕',
      done: acts >= 1,
      progress: acts >= 1 ? '已完成' : '未开始',
    },
    {
      id: 'eight-acts',
      title: '走完八幕',
      hint: '把草原的一天从拂晓走到夜里',
      done: acts >= 8,
      progress: `${acts} / 8 幕`,
    },
    {
      id: 'deep-core',
      title: '抵达地心',
      hint: '完成终幕俯冲，听见 6371 公里外的回答',
      done: relay.completedPrologue,
      progress: relay.completedPrologue ? '已完成' : '未抵达',
    },
    {
      id: 'eggs',
      title: '拾齐三枚彩蛋',
      hint: '漂流瓶、三角石碑与流星',
      done: eggs >= 3,
      progress: `${eggs} / 3 枚`,
    },
    {
      id: 'heartbeat',
      title: '第一次心跳',
      hint: '在电台里长按，把心跳送给一份视野',
      done: journey.heartbeats >= 1,
      progress: `${journey.heartbeats} 次`,
    },
    {
      id: 'echo',
      title: '留下一句回声',
      hint: '给某份视野写一句话',
      done: journey.echoesLeft >= 1,
      progress: `${journey.echoesLeft} 句`,
    },
    {
      id: 'send',
      title: '寄出一份视野',
      hint: '在工坊里拍下此刻，寄给地心',
      done: journey.visionsSent >= 1,
      progress: `${journey.visionsSent} 份`,
    },
    {
      id: 'cities',
      title: '走过三座城',
      hint: '收听或寄出三座不同城市的视野',
      done: cities >= 3,
      progress: `${cities} / 3 城`,
    },
    {
      id: 'return',
      title: '三天回访',
      hint: '在不同的三天回到这里',
      done: days >= 3,
      progress: `${days} / 3 天`,
    },
  ]
}

export interface DailyEcho {
  day: string
  label: string
  code: string
  city: string
  title: string
  whisper: string
}

export function dailyEcho(day = todayKey()): DailyEcho | null {
  const codes = seedSignalCodes()
  if (codes.length === 0) return null
  const [year, month, date] = day.split('-').map(Number)
  const index = Math.floor(Date.UTC(year, month - 1, date) / 86_400_000)
  const code = codes[((index % codes.length) + codes.length) % codes.length]
  const brief = seedBrief(code)
  if (!brief) return null
  return {
    day,
    label: `${month} 月 ${date} 日`,
    code,
    city: brief.city,
    title: brief.title,
    whisper: getCityWhisper(brief.city),
  }
}