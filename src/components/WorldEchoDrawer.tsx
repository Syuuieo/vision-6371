import { useEffect, useState } from 'react'
import { getRadioSignal, sendRadioHeartbeat } from '../services/visionApi'
import type { RadioSignal, VisionEcho } from '../types/vision'

interface WorldEchoDrawerProps {
  code: string | null
  title: string
  muted: boolean
}

interface EchoData {
  code: string
  signal: RadioSignal | null
  hearts: number
  echoes: VisionEcho[]
}

function formatEchoTime(timestamp: number) {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}.${day} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function WorldEchoDrawer({ code, title, muted }: WorldEchoDrawerProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<EchoData | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let alive = true
    void getRadioSignal(code).then((signal) => {
      if (!alive) return
      setData({
        code,
        signal,
        hearts: signal?.hearts ?? 0,
        echoes: signal?.echoes ?? [],
      })
    })
    return () => {
      alive = false
    }
  }, [code])

  const current = data?.code === code ? data : null
  const hearts = current?.hearts ?? 0
  const echoes = current?.echoes ?? []
  const loading = Boolean(code && !current)

  const applyHeartbeat = (nextHearts: number, nextEchoes: VisionEcho[]) => {
    setData((previous) => ({
      code: code ?? '',
      signal: previous?.signal ?? null,
      hearts: nextHearts,
      echoes: [...nextEchoes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12),
    }))
  }

  const sendHeartbeat = async (withMessage: boolean) => {
    if (!code || !current?.signal || busy) return
    const cleanMessage = withMessage ? message.trim().slice(0, 120) : ''
    if (withMessage && !cleanMessage) {
      setNotice('先写一句想寄给这座奇境的回声')
      return
    }
    setBusy(true)
    setNotice(null)
    const result = await sendRadioHeartbeat(code, cleanMessage || undefined, hearts)
    applyHeartbeat(result.hearts, result.echoes)
    if (cleanMessage) setMessage('')
    setNotice(cleanMessage ? '回声已沿中微子信道寄出' : '同频心跳已送达')
    setBusy(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-2 rounded-full border border-signal/35 bg-[#060a14]/65 px-4 py-2 font-serif text-[12px] tracking-[0.06em] text-[#fff8ee] shadow-[0_12px_36px_-18px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition hover:border-signal/70 hover:bg-[#060a14]/82"
        aria-label={`展开 ${title} 的回声`}
      >
        <span className="text-signal">♥</span>
        <span>同频心跳 {hearts.toLocaleString('zh-CN')}</span>
        <span className="h-3 w-px bg-signal/30" aria-hidden="true" />
        <span className="text-white/65">展开回声 ({echoes.length})</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-[#02050c]/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={`${title} 的回声`} onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-full max-w-[430px] flex-col border-l border-signal/25 bg-[#060a14]/85 px-5 pb-16 pt-6 shadow-[-24px_0_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:px-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-signal/80">RESONANCE ARCHIVE</p>
                <h2 className="mt-2 font-serif text-[22px] font-normal tracking-[0.1em] text-[#fff8ee]">奇境回声</h2>
                <p className="mt-1 font-serif text-[12px] tracking-[0.04em] text-white/55">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] font-serif text-[15px] text-white/70 transition hover:border-signal/55 hover:text-signal"
                aria-label="收起回声"
              >
                ×
              </button>
            </div>

            <div className="my-5 h-px bg-gradient-to-r from-signal/55 via-signal/15 to-transparent" />

            <button
              type="button"
              disabled={!current?.signal || busy}
              onClick={() => void sendHeartbeat(false)}
              className="flex min-h-12 items-center justify-between rounded-2xl border border-signal/30 bg-signal/[0.08] px-4 text-left transition hover:border-signal/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="font-serif text-[13px] tracking-[0.06em] text-[#fff8ee]">送出同频心跳</span>
              <span className="font-mono text-[12px] text-signal">♥ {hearts.toLocaleString('zh-CN')}</span>
            </button>

            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="font-serif text-[13px] tracking-[0.08em] text-white/80">陌生人留下的回声</h3>
              <span className="font-mono text-[10px] tracking-[0.12em] text-white/40">{echoes.length} 条</span>
            </div>

            <div className="studio-scroll mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {loading ? (
                <p className="py-8 text-center font-serif text-[12px] tracking-[0.06em] text-white/45">正在接通地表信道…</p>
              ) : echoes.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-9 text-center font-serif text-[12.5px] leading-7 text-white/50">
                  {current?.signal ? '还没有回声。让这座奇境知道，你曾经走过。' : '这座奇境暂时没有可连接的公网风信。'}
                </p>
              ) : (
                echoes.map((echo) => (
                  <article key={echo.id} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5">
                    <p className="font-serif text-[13px] leading-7 tracking-[0.025em] text-[#fff8ee]/88">{echo.message}</p>
                    <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-white/38">{formatEchoTime(echo.createdAt)}</p>
                  </article>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-signal/20 pt-5">
              <label className="block font-serif text-[12px] tracking-[0.06em] text-signal/90" htmlFor="world-echo-message">写一句回声</label>
              <textarea
                id="world-echo-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={120}
                rows={3}
                placeholder={muted ? '声音已静音，文字回声仍可寄出' : '把此刻的心情，寄给下一位走到这里的人…'}
                className="mt-2 w-full resize-none rounded-2xl border border-white/14 bg-[#070e1f]/75 px-3.5 py-3 font-serif text-[13px] leading-6 text-[#fff8ee] outline-none placeholder:text-white/30 focus:border-signal/60"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] text-white/35">{message.length}/120</span>
                <button
                  type="button"
                  disabled={!current?.signal || busy}
                  onClick={() => void sendHeartbeat(true)}
                  className="min-h-11 rounded-full bg-signal px-5 font-serif text-[12px] font-medium tracking-[0.06em] text-[#170f07] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? '寄送中…' : '寄出回声'}
                </button>
              </div>
              {notice && <p className="mt-3 font-serif text-[11.5px] tracking-[0.04em] text-signal/85">{notice}</p>}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
