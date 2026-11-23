import type { MemoryFrame } from './memoryStripExport'

export interface StoryRelayState {
  completedPrologue: boolean
  promise: string | null
  wish: string | null
  cluesFound: string[]
  memories: MemoryFrame[]
  relayedCities: string[]
  lastCityWhisper: string | null
}

const STORAGE_KEY = 'vision6371_story_relay_v1'

export const DEFAULT_STORY_RELAY: StoryRelayState = {
  completedPrologue: false,
  promise: null,
  wish: null,
  cluesFound: [],
  memories: [],
  relayedCities: [],
  lastCityWhisper: null,
}

export const CITY_LINWEI_WHISPERS: Record<string, string> = {
  北京: '“地磁测绘训练那年，我在北五环外的霜风里数过整夜的灯。”',
  上海: '“外滩钟声落进江雾时，高架上的车灯像两条不肯熄灭的河。”',
  广州: '“如果早知道十年再也闻不到热风，我会再喝一碗滚烫的夜茶。”',
  深圳: '“夜班归航的时候，整座海湾的霓虹都在玻璃窗下发亮。”',
  成都: '“茶馆檐下的雨停了没？哪怕只是竹叶晃动的一点声响也好。”',
  杭州: '“西湖早春的雾气很轻，连柳梢沾湿了都听不见一点机械响。”',
  南京: '“梧桐落叶踩上去发脆的时候，地面上的秋天原来有这么长。”',
  西安: '“城墙根的风绕过砖缝，大概和六千公里外的地层同样古老。”',
  武汉: '“江轮汽笛响起来那一刻，岸上的风像长了一整片羽毛。”',
  青岛: '“海盐落在睫毛上有点咸，比舱壁上冷凝的水珠自由太多了。”',
  大理: '“苍山的云会贴着水面低低地走，原来天空真的可以那么宽。”',
  哈尔滨: '“零下二十度的雪片落进掌心之前，地球还是冰凉又清澈的。”',
  三亚: '“赤道边的浪声一遍一遍推上岸，把地心深处的寂静也拍松了。”',
  拉萨: '“风马旗抖动的那几秒，连我这里的传感器都以为天空触手可及。”',
}

export function getCityWhisper(city: string): string {
  return (
    CITY_LINWEI_WHISPERS[city] ??
    `“原来「${city}」此刻正有这样的光与风。替我多看两秒吧。”`
  )
}

export function loadStoryRelay(): StoryRelayState {
  if (typeof window === 'undefined') return DEFAULT_STORY_RELAY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STORY_RELAY
    const parsed = JSON.parse(raw) as Partial<StoryRelayState>
    return {
      completedPrologue: Boolean(parsed.completedPrologue),
      promise: typeof parsed.promise === 'string' ? parsed.promise : null,
      wish: typeof parsed.wish === 'string' ? parsed.wish : null,
      cluesFound: Array.isArray(parsed.cluesFound)
        ? parsed.cluesFound.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : [],
      memories: Array.isArray(parsed.memories)
        ? parsed.memories
            .filter(
              (item): item is MemoryFrame =>
                Boolean(item) &&
                typeof item.act === 'string' &&
                typeof item.title === 'string' &&
                typeof item.dataUrl === 'string',
            )
            .slice(-6)
        : [],
      relayedCities: Array.isArray(parsed.relayedCities)
        ? parsed.relayedCities.filter((item): item is string => typeof item === 'string').slice(0, 24)
        : [],
      lastCityWhisper: typeof parsed.lastCityWhisper === 'string' ? parsed.lastCityWhisper : null,
    }
  } catch {
    return DEFAULT_STORY_RELAY
  }
}

export function saveStoryRelay(state: StoryRelayState): void {
  if (typeof window === 'undefined') return
  const normalized: StoryRelayState = {
    completedPrologue: Boolean(state.completedPrologue),
    promise: state.promise,
    wish: state.wish,
    cluesFound: [...new Set(state.cluesFound)].slice(0, 8),
    memories: state.memories.slice(-6),
    relayedCities: [...new Set(state.relayedCities)].slice(0, 24),
    lastCityWhisper: state.lastCityWhisper,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...normalized,
          memories: [],
        }),
      )
    } catch {
      /* storage disabled or completely full */
    }
  }
}
