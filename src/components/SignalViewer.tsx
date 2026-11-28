import { useEffect, useMemo, useRef, useState } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import { signatureFor, type SignatureEffect } from '../data/citySignature'
import { LOCAL_STAMPS } from '../data/mailboxData'
import { countEcho, countHeartbeat } from '../services/journey'
import { deleteMyVision, ownsLocalVision, sendRadioHeartbeat } from '../services/visionApi'
import type { RadioSignal, VisionEcho } from '../types/vision'
import { WIND_LABELS } from '../types/vision'
import { getCityWhisper } from '../utils/storyRelay'
import { PostcardPreviewModal } from './PostcardPreviewModal'
import { VisionViewport3D } from './VisionViewport3D'

interface SignalViewerProps {
  signal: RadioSignal
  muted: boolean
  onClose: () => void
  onHeartsChange?: (code: string, hearts: number) => void
  onEchoesChange?: (code: string, echoes: VisionEcho[]) => void
  onCityResonate?: (city: string) => void
  onStep?: (delta: number) => void
  onDeleted?: (code: string) => void
  position?: { index: number; total: number }
  externalMixer?: AmbientMixer
}

function echoClock(timestamp: number) {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}.${day} ${hour}:${minute}`
}

function mergeEchoes(base: VisionEcho[], incoming: VisionEcho[]) {
  const seen = new Set<string>()
  return [...base, ...incoming].filter((echo) => {
    if (seen.has(echo.id)) return false
    seen.add(echo.id)
    return true
  })
}

function liveStoryForInteract(city: string, kind: 'lamp' | 'star' | 'ripple' | 'snow'): string {
  const c = city.trim()
  if (c.includes('悉尼')) {
    return kind === 'ripple'
      ? '悉尼港实况：海湾正有渡轮与帆船穿过，28°C 的海风推开一层层白浪。'
      : '悉尼海港大桥实况：桥上车流与霓虹依次亮起，熙熙攘攘穿过盛夏傍晚。'
  }
  if (c.includes('夏威夷')) {
    return kind === 'ripple'
      ? '夏威夷椰林实况：珊瑚鱼跃出蓝绿浅海，岸边椰树摇下一阵清甜海风。'
      : '夏威夷栈桥实况：晚霞把火山崖染成橘红，沙滩上的椰林灯一盏盏亮起。'
  }
  if (c.includes('哈尔滨')) {
    return '哈尔滨街头实况：零下七度的初雪飘过红砖穹顶，行人呵出的白雾映着暖黄路灯。'
  }
  if (c.includes('南京') || c.includes('图书馆')) {
    return '南京自习室实况：窗边正有人轻轻翻动书页，玻璃外滴着细密温柔的晚雨。'
  }
  if (c.includes('上海')) {
    return '上海外滩实况：江岸人群熙攘走过石栏杆，对岸灯光秀随海关大钟一起亮起。'
  }
  if (c.includes('拉萨') || c.includes('西藏')) {
    return '西藏高原实况：零下几度的晴朗夜空干净透明，头顶银河正一颗接一颗点亮。'
  }
  const defaults: Record<typeof kind, string> = {
    lamp: `${c || '城市'}实况：几扇窗前刚亮起暖灯，有人正端着热茶看向街灯。`,
    star: `${c || '夜空'}实况：天边划过微弱星辉，远处依然有旅人抬头望向同一个方向。`,
    ripple: `${c || '海岸'}实况：风推着浪花拍岸，能听见海鸥与船只汽笛混在空气里。`,
    snow: `${c || '街头'}实况：细雪与落叶安静穿过路灯暖晕，整条街道都慢了下来。`,
  }
  return defaults[kind]
}

export function SignalViewer({
  signal,
  muted,
  onClose,
  onHeartsChange,
  onEchoesChange,
  onCityResonate,
  onStep,
  onDeleted,
  position,
  externalMixer,
}: SignalViewerProps) {
  const [internalMixer] = useState(() => externalMixer ?? new AmbientMixer())
  const mixer = externalMixer ?? internalMixer
  const [hearts, setHearts] = useState(signal.hearts)
  const [echoes, setEchoes] = useState<VisionEcho[]>(signal.echoes)
  const echoesRef = useRef<VisionEcho[]>(signal.echoes)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [beating, setBeating] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [radioOn, setRadioOn] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const [own] = useState(() => ownsLocalVision(signal.code))
  const [withdrawArmed, setWithdrawArmed] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [moment, setMoment] = useState<{ kind: SignatureEffect; tick: number } | null>(null)
  const momentTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (momentTimer.current !== null) window.clearTimeout(momentTimer.current)
    }
  }, [])
  const [postcardOpen, setPostcardOpen] = useState(false)

  const packet = signal.packet
  const whisperText = getCityWhisper(packet.city)
  const wind = WIND_LABELS[Math.min(3, Math.max(0, Math.round(packet.windLevel)))]
  const signature = signatureFor(packet.city, packet.ambience)
  const weather = signature.weather || wind
  const recentEchoes = useMemo(
    () => [...echoes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12),
    [echoes],
  )

  const showToast = (text: string) => {
    setToast(text)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    mixer.revive()
    return () => {
      if (externalMixer) {
        externalMixer.stopVoice()
        externalMixer.setActive(false)
      } else {
        mixer.dispose()
      }
    }
  }, [mixer, externalMixer])

  useEffect(() => {
    mixer.setMuted(muted)
  }, [mixer, muted])

  useEffect(() => {
    mixer.setKind(packet.ambience)
    mixer.setVolume(0.55)
    mixer.setActive(soundOn)
    if (soundOn) void mixer.ensure()
  }, [mixer, packet.ambience, soundOn])

  useEffect(() => {
    if (!soundOn || !radioOn) {
      mixer.stopStation()
      return
    }
    mixer.startStation(packet.city)
    return () => mixer.stopStation()
  }, [mixer, packet.city, soundOn, radioOn])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (postcardOpen) return
      const target = event.target as HTMLElement | null
      const editing = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable),
      )
      if (event.key === 'Escape') {
        if (editing) {
          target?.blur()
          return
        }
        onClose()
        return
      }
      if (editing || !onStep) return
      if (event.key === 'ArrowLeft') onStep(-1)
      if (event.key === 'ArrowRight') onStep(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep, postcardOpen])

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    onCityResonate?.(signal.packet.city)
  }, [signal.code, signal.packet.city, onCityResonate])

  const applyResult = (nextHearts: number, nextEchoes: VisionEcho[]) => {
    const merged = mergeEchoes(echoesRef.current, nextEchoes)
    echoesRef.current = merged
    setHearts(nextHearts)
    setEchoes(merged)
    onHeartsChange?.(signal.code, nextHearts)
    onEchoesChange?.(signal.code, merged)
  }

  const handleHeartbeat = () => {
    const bpm = mixer.playHeartbeat()
    onCityResonate?.(packet.city)
    if (!beating) {
      setBeating(true)
      countHeartbeat()
      void sendRadioHeartbeat(signal.code, undefined, hearts).then((result) => {
        applyResult(result.hearts, result.echoes)
        setBeating(false)
        showToast(`同频心跳已送达 · 第 ${result.hearts.toLocaleString('zh-CN')} 次共鸣`)
      })
    }
    return bpm
  }

  const handleReply = () => {
    const text = message.trim()
    if (!text || sending) return
    setSending(true)
    countEcho()
    void sendRadioHeartbeat(signal.code, text, hearts).then((result) => {
      applyResult(result.hearts, result.echoes)
      setSending(false)
      setMessage('')
      showToast('回声已留在这片风景里')
    })
  }

  const handlePlayVoice = async () => {
    if (!packet.voice) return
    if (muted) {
      showToast('全局静音中 · 请先开启声音')
      return
    }
    setSoundOn(true)
    const ok = await mixer.playVoice(packet.voice)
    showToast(ok ? '正在回放现场原声…' : '原声暂时无法解码')
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    if (next) void mixer.ensure()
  }

  const withdrawMine = async () => {
    if (withdrawing) return
    setWithdrawing(true)
    await deleteMyVision(signal.code)
    onDeleted?.(signal.code)
    onClose()
  }

  const triggerMoment = () => {
    setMoment((current) => ({ kind: signature.effect, tick: (current?.tick ?? 0) + 1 }))
    try {
      navigator.vibrate?.([18, 36, 24])
    } catch {
      /* 设备不支持震动 */
    }
    if (momentTimer.current !== null) window.clearTimeout(momentTimer.current)
    momentTimer.current = window.setTimeout(() => setMoment(null), 5600)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#091122] pt-[58px] text-[#fff8ee] sm:pt-[68px]"
      role="dialog"
      aria-modal="true"
      aria-label={`接收来自${packet.city}的视野`}
    >
      <header className="flex shrink-0 items-center gap-1.5 border-y border-white/10 bg-[#070e1f]/86 px-2.5 py-2 backdrop-blur-xl sm:gap-3 sm:px-5 sm:py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 font-serif text-[12px] text-white/85 transition hover:border-signal/60 hover:text-signal sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-[12.5px]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sm:hidden">返回</span>
          <span className="hidden sm:inline">返回电台</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/12 px-2 py-0.5 font-mono text-[9.5px] tracking-[0.12em] text-emerald-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-[blinkDot_1.6s_ease-in-out_infinite]" />
            LIVE 实况
          </span>
          <div className="truncate font-serif text-[14px] tracking-[0.04em] text-[#fff8ee] sm:text-[16px]">
            {packet.title}
          </div>
        </div>

        {onStep && position && position.total > 1 && (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/14 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="上一份视野"
              title="上一份视野（←）"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 transition hover:bg-white/[0.08] hover:text-signal"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="whitespace-nowrap px-1 font-mono text-[10.5px] text-white/55">
              {position.index}/{position.total}
            </span>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="下一份视野"
              title="下一份视野（→）"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 transition hover:bg-white/[0.08] hover:text-signal"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {own && (
            <button
              type="button"
              onClick={() => {
                if (!withdrawArmed) {
                  setWithdrawArmed(true)
                  showToast('再点一次，就把它从电台撤回')
                  window.setTimeout(() => setWithdrawArmed(false), 4000)
                  return
                }
                void withdrawMine()
              }}
              disabled={withdrawing}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 font-serif text-[12px] transition disabled:cursor-wait disabled:opacity-60 ${
                withdrawArmed
                  ? 'border-[#ff9b8a]/55 bg-[#ff9b8a]/15 text-[#ffb9ac]'
                  : 'border-white/14 bg-white/[0.04] text-white/60 hover:border-[#ff9b8a]/50 hover:text-[#ffb9ac]'
              }`}
            >
              {withdrawing ? '撤回中…' : withdrawArmed ? '确认撤回' : '撤回'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setRadioOn((current) => !current)}
            aria-pressed={radioOn && soundOn}
            aria-label="城市电台配乐"
            title="城市电台配乐"
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 font-serif text-[12px] transition ${
              radioOn && soundOn
                ? 'border-sky-300/45 bg-sky-300/12 text-sky-200'
                : 'border-white/14 bg-white/[0.04] text-white/55 hover:border-white/30'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="6.6" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16.6" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="hidden sm:inline">{radioOn && soundOn ? '电台配乐' : '静音配乐'}</span>
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 font-serif text-[12px] transition ${
              soundOn && !muted
                ? 'border-signal/45 bg-signal/15 text-signal'
                : 'border-white/14 bg-white/[0.04] text-white/60 hover:border-white/30'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 9.5v5h3.4L12 18.5v-13L7.4 9.5H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              {soundOn && !muted ? (
                <path d="M15.5 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M16 9.5l4 5M20 9.5l-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
            <span className="hidden sm:inline">{muted ? '已静音' : soundOn ? '声音开' : '静音'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanelOpen((current) => !current)}
            aria-pressed={panelOpen}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 font-serif text-[12px] text-white/85 transition hover:border-signal/60 hover:text-signal sm:h-9 sm:px-3.5"
          >
            {panelOpen ? (
              <>
                <span className="sm:hidden">收起</span>
                <span className="hidden sm:inline">收起回声</span>
              </>
            ) : (
              `回声 ${echoes.length}`
            )}
          </button>
        </div>
      </header>

      <div
        className={`grid min-h-0 flex-1 ${
          panelOpen
            ? 'grid-rows-[minmax(280px,52dvh)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_minmax(340px,26vw)] lg:grid-cols-[minmax(0,1fr)_390px]'
            : 'grid-rows-1'
        }`}
      >
        <section className="relative min-h-0 overflow-hidden border-b border-white/10 md:border-b-0 md:border-r">
          <VisionViewport3D
            packet={packet}
            mode="preview"
            onAddFocus={() => undefined}
            onHeartbeat={handleHeartbeat}
            onPlayVoice={() => void handlePlayVoice()}
            onSceneInteract={(kind) => {
              if (soundOn && !muted) {
                void mixer.ensure()
                mixer.playInteractionSfx(kind)
              }
              showToast(liveStoryForInteract(packet.city, kind))
            }}
          />
          {moment && (
            <div
              key={moment.tick}
              className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center px-4 pt-16"
            >
              <div
                className={`absolute inset-0 overflow-hidden fx-${moment.kind}`}
                aria-hidden="true"
              >
                {moment.kind === 'ripple' && (
                  <>
                    <span />
                    <span />
                    <span />
                  </>
                )}
                {moment.kind === 'starlight' &&
                  [
                    [22, 30, 0],
                    [38, 22, 0.22],
                    [56, 27, 0.44],
                    [71, 35, 0.66],
                    [47, 16, 0.88],
                    [64, 44, 1.1],
                    [31, 41, 1.32],
                  ].map(([left, top, delay]) => (
                    <i
                      key={`${left}-${top}`}
                      style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
                    />
                  ))}
                {moment.kind === 'drizzle' &&
                  [8, 20, 31, 42, 55, 66, 78, 90].map((left, index) => (
                    <span
                      key={left}
                      style={{ left: `${left}%`, animationDelay: `${index * 0.14}s` }}
                    />
                  ))}
              </div>
              <p className="animate-fade-in cinema-surface relative max-w-[92%] rounded-2xl border-signal/35 px-3.5 py-2.5 font-serif text-[12.5px] leading-[1.85] text-[#fff8ee]">
                <span className="text-signal">林微</span> · {signature.reply}
              </p>
            </div>
          )}
        </section>

        {panelOpen && (
          <aside className="studio-scroll flex min-h-0 flex-col overflow-y-auto bg-gradient-to-b from-[#0d172e]/95 to-[#091122]">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-serif text-[16px] text-[#fff8ee]">{packet.sender}</div>
                  <div className="mt-1 font-sans text-[12px] text-white/62">
                    {packet.city} · {packet.tempC}°C · {packet.weather?.trim() || weather}
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl border border-signal/35 bg-signal/12 px-3.5 py-2 text-right">
                  <div className="font-serif text-[11px] text-signal/85">同频心跳</div>
                  <div className="hud-value mt-0.5 text-[20px] leading-none text-signal">
                    {hearts.toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
              {packet.letter?.trim() && (
                <div className="mt-3 rounded-2xl border border-signal/28 bg-[#0b152c]/70 px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-serif text-[11px] tracking-[0.06em] text-signal">
                      寄信人的短笺
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {packet.sticker?.trim() && (
                        <span className="rounded-full border border-white/14 bg-white/[0.04] px-2 py-0.5 font-serif text-[10.5px] text-signal/90">
                          {packet.sticker.trim()}
                        </span>
                      )}
                      {(() => {
                        const st = LOCAL_STAMPS.find((s) => s.id === packet.stampId)
                        return st ? (
                          <span className="rounded-full border border-signal/35 bg-signal/10 px-2 py-0.5 font-serif text-[10.5px] text-[#fff6ea]">
                            {st.motif} {st.title}
                          </span>
                        ) : null
                      })()}
                    </div>
                  </div>
                  <p className="mt-1.5 font-serif text-[12.5px] leading-[1.8] text-[#fff8ee]/92">
                    “{packet.letter.trim()}”
                  </p>
                </div>
              )}
              <p className="mt-3 font-serif text-[12.5px] leading-[1.85] text-white/70">
                {packet.focus.length > 0
                  ? `她在这片视野里停过 ${packet.focus.length} 次，点击画面上的光点可以读她的细语。`
                  : '她把当时的光与风留在了这帧风景里，长按画面下方可送出同频心跳。'}
              </p>

              <button
                type="button"
                onClick={triggerMoment}
                className="mt-3 w-full rounded-2xl border border-signal/30 bg-signal/[0.07] px-3.5 py-2.5 text-left transition hover:border-signal/55 hover:bg-signal/[0.13]"
              >
                <span className="block font-mono text-[9.5px] tracking-[0.22em] text-signal/60">
                  ONE THING FOR HER
                </span>
                <span className="mt-1 block font-serif text-[13px] tracking-[0.04em] text-signal">
                  替她{signature.verb}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">
                  做一件事，她会告诉你她的感受。
                </span>
              </button>
              <div className="mt-3 rounded-2xl border border-signal/25 bg-signal/[0.06] px-3.5 py-2.5">
                <div className="font-serif text-[11px] tracking-[0.06em] text-signal">来自地心的回响 · 林微</div>
                <p className="mt-1.5 font-serif text-[12.5px] leading-[1.75] text-[#fff2dc]/92">
                  {whisperText}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPostcardOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-signal/32 bg-signal/[0.06] px-3.5 py-2.5 font-serif text-[12.5px] text-signal transition hover:border-signal/60 hover:bg-signal/14"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 15l3.5-3.5 3 3 2.5-2.5 2.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                将这片视野冲印成明信片
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="font-serif text-[14px] text-[#fff8ee]">同频回声</span>
                <span className="font-sans text-[12px] text-white/50">{echoes.length} 条留言</span>
              </div>

              <div className="mt-3 space-y-2.5" aria-live="polite">
                {recentEchoes.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center font-serif text-[12.5px] leading-[1.85] text-white/55">
                    还没有人在这里说话。
                    <br />
                    写下一句，让它穿过地壳留在她的视野里。
                  </div>
                )}
                {recentEchoes.map((echo) => (
                  <article
                    key={echo.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 transition hover:border-signal/35"
                  >
                    <p className="font-serif text-[13px] font-normal leading-[1.8] text-[#fff8ee]/90">
                      {echo.message}
                    </p>
                    <div className="mt-1.5 text-right font-sans text-[11px] text-white/42">
                      {echoClock(echo.createdAt)}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-auto pt-5 pb-16">
                <label className="font-serif text-[12.5px] text-white/72" htmlFor="echo-message">
                  写一句回声
                </label>
                <textarea
                  id="echo-message"
                  value={message}
                  maxLength={120}
                  rows={3}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="告诉她，你在这一刻看见了什么…"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-[#081022]/80 px-3.5 py-2.5 font-serif text-[13px] leading-[1.75] text-[#fff8ee] outline-none transition placeholder:text-white/30 focus:border-signal/60"
                />
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="font-sans text-[11.5px] text-white/48">{message.length} / 120</span>
                  <button
                    type="button"
                    onClick={handleReply}
                    disabled={!message.trim() || sending}
                    className="rounded-full bg-signal px-5 py-2 font-serif text-[12.5px] font-medium text-[#170f07] shadow-[0_8px_22px_-6px_rgba(242,194,139,0.65)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {sending ? '正在寄出…' : '寄出回声 · 心跳 +1'}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-[95] w-[min(88vw,460px)] -translate-x-1/2">
          <div className="animate-fade-in rounded-full border border-signal/35 bg-[#0d172e]/95 px-4 py-2.5 text-center font-serif text-[12.5px] text-[#fff8ee] shadow-2xl backdrop-blur-md">
            {toast}
          </div>
        </div>
      )}

      {postcardOpen && (
        <PostcardPreviewModal
          open
          packet={packet}
          shareCode={signal.code}
          whisperText={getCityWhisper(packet.city)}
          onClose={() => setPostcardOpen(false)}
          onToast={showToast}
        />
      )}
    </div>
  )
}
