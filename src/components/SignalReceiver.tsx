import { useCallback, useEffect, useState } from 'react'
import { AmbientMixer } from '../audio/ambientMixer'
import { getRadioSignal } from '../services/visionApi'
import type { RadioSignal, VisionEcho } from '../types/vision'
import { WIND_LABELS } from '../types/vision'
import { citySignature } from '../data/citySignature'
import { SignalViewer } from './SignalViewer'

interface SignalReceiverProps {
  code: string
  muted: boolean
  onEnterRadio: (code?: string) => void
  onEnterPost: () => void
  onRecordCity?: (city: string) => void
}

export function SignalReceiver({ code, muted, onEnterRadio, onEnterPost, onRecordCity }: SignalReceiverProps) {
  const [loaded, setLoaded] = useState<{ code: string; signal: RadioSignal | null } | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [mixer] = useState(() => new AmbientMixer())

  const loading = loaded === null || loaded.code !== code
  const signal = loaded && loaded.code === code ? loaded.signal : null

  useEffect(() => {
    mixer.revive()
    return () => mixer.dispose()
  }, [mixer])

  useEffect(() => {
    let alive = true
    void getRadioSignal(code).then((result) => {
      if (!alive) return
      setLoaded({ code, signal: result })
    })
    return () => {
      alive = false
    }
  }, [code])

  const handleOpenViewer = () => {
    if (!signal) return
    mixer.revive()
    mixer.setMuted(muted)
    mixer.setKind(signal.packet.ambience)
    mixer.setVolume(0.55)
    mixer.setActive(true)
    void mixer.ensure()
    onRecordCity?.(signal.packet.city)
    setViewerOpen(true)
  }

  const handleHeartsChange = useCallback((targetCode: string, hearts: number) => {
    setLoaded((current) =>
      current && current.signal && current.signal.code === targetCode
        ? { ...current, signal: { ...current.signal, hearts } }
        : current,
    )
  }, [])

  const handleEchoesChange = useCallback((targetCode: string, echoes: VisionEcho[]) => {
    setLoaded((current) =>
      current && current.signal && current.signal.code === targetCode
        ? { ...current, signal: { ...current.signal, echoes } }
        : current,
    )
  }, [])

  const packet = signal?.packet
  const wind = packet ? WIND_LABELS[Math.min(3, Math.max(0, Math.round(packet.windLevel)))] : '微风'
  const weather = (packet && citySignature(packet.city)?.weather) || wind

  return (
    <main
      className="no-scrollbar relative z-10 h-dvh w-full overflow-y-auto overflow-x-hidden"
      style={{
        background: 'linear-gradient(180deg, #0b1630 0%, #122347 48%, #091122 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 62% 28%, rgba(92, 162, 240, 0.2), transparent 72%), radial-gradient(45% 40% at 18% 82%, rgba(242, 194, 139, 0.12), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1180px] flex-col justify-center px-4 pb-8 pt-[78px] sm:px-6 sm:pt-[96px] lg:min-h-dvh">
        {loading && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-24 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-signal/25 animate-[pulseRing_2.6s_ease-out_infinite]" />
              <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_24px_rgba(242,194,139,0.9)] animate-[blinkSoft_1.8s_ease-in-out_infinite]" />
            </div>
            <div className="mt-5 font-serif text-[15px] tracking-[0.08em] text-[#fff8ee]">
              正在拆开这封来自地表的风景…
            </div>
          </div>
        )}

        {!loading && !signal && (
          <div className="animate-fade-up mx-auto max-w-[520px] rounded-[28px] border border-white/14 bg-[#0d172e]/75 p-7 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-ember/35 bg-ember/10">
              <span className="h-2.5 w-2.5 rounded-full bg-ember" />
            </div>
            <h1 className="mt-5 font-serif text-[clamp(24px,4vw,34px)] font-light leading-tight tracking-[0.06em] text-[#fff8ee]">
              这封视野在半路散开了
            </h1>
            <p className="mt-3 font-serif text-[13.5px] leading-[1.9] text-white/70">
              分享链接可能不完整，或这帧风景只保留在了原设备。
              <br />
              地球表面电台里还有很多双眼睛，正在等另一位旅人借用。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-full bg-signal px-6 py-2.5 font-serif text-[13px] font-medium text-[#170f07] transition hover:brightness-105"
                onClick={() => onEnterRadio()}
              >
                去地球表面电台
              </button>
              <button
                type="button"
                className="rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 font-serif text-[13px] text-[#fff8ee] transition hover:border-signal/60"
                onClick={onEnterPost}
              >
                寄出我的视野
              </button>
            </div>
          </div>
        )}

        {!loading && signal && packet && (
          <div className="animate-fade-up grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:gap-6">
            <div className="relative min-h-[42dvh] overflow-hidden rounded-[28px] border border-white/14 bg-[#0c1834] shadow-[0_36px_110px_-40px_rgba(3,8,22,0.9)] lg:min-h-[58dvh]">
              <img
                src={packet.image}
                alt={packet.title}
                className="h-full min-h-[42dvh] w-full object-cover lg:min-h-[58dvh]"
                draggable={false}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#091122] via-[#091122]/20 to-transparent" />

              <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-[#0b152c]/65 px-3.5 py-1.5 font-serif text-[12px] text-[#fff8ee] backdrop-blur-md">
                {packet.city} · {packet.tempC}°C · {weather}
              </div>

              <div className="absolute inset-x-5 bottom-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-signal/40 bg-[#0b152c]/72 px-3 py-1 font-serif text-[11.5px] text-signal backdrop-blur-md">
                    {packet.focus.length} 处目光留言
                  </span>
                  <span className="rounded-full border border-white/18 bg-[#0b152c]/72 px-3 py-1 font-serif text-[11.5px] text-white/85 backdrop-blur-md">
                    {packet.voice ? '含现场原声' : '安静的风景'}
                  </span>
                </div>
                <h2 className="mt-2.5 font-serif text-[clamp(20px,2.5vw,28px)] font-light leading-tight tracking-[0.05em] text-[#fff8ee]">
                  {packet.title}
                </h2>
              </div>
            </div>

            <div className="flex flex-col justify-center rounded-[28px] border border-white/12 bg-[#0d172e]/74 px-6 py-7 shadow-2xl backdrop-blur-xl sm:px-8 sm:py-9">
              <div className="font-serif text-[12.5px] tracking-[0.12em] text-signal/90">
                来自 {packet.city} 的明信片
              </div>
              <h1 className="mt-3 font-serif text-[clamp(28px,4.4vw,44px)] font-light leading-[1.18] tracking-[0.06em] text-[#fff8ee]">
                你收到一双眼睛
              </h1>
              <p className="mt-4 font-serif text-[14.5px] font-light leading-[1.95] tracking-[0.04em] text-white/78 sm:text-[15.5px]">
                来自 <span className="text-signal">{packet.city}</span> 的{' '}
                <span className="text-[#fff8ee]">{packet.sender}</span>，把 {weather}、{packet.tempC}°C
                {packet.scentTag ? `、${packet.scentTag}` : ''} 与 {packet.focus.length} 处想指给你看的目光，放进了这封视窗。
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="font-serif text-[12px] text-white/60">同频心跳</div>
                  <div className="hud-value mt-1 text-[18px] text-signal">{signal.hearts.toLocaleString('zh-CN')}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="font-serif text-[12px] text-white/60">回声留言</div>
                  <div className="hud-value mt-1 text-[18px] text-[#fff8ee]">{signal.echoes.length} 条</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenViewer}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-signal py-3.5 font-serif text-[15px] font-medium tracking-[0.08em] text-[#170f07] shadow-[0_12px_34px_-8px_rgba(242,194,139,0.7)] transition hover:brightness-105 active:scale-[0.99]"
              >
                戴上 TA 的眼睛
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>

              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  className="rounded-full border border-white/18 bg-white/[0.04] px-4 py-2 font-serif text-[12.5px] text-white/85 transition hover:border-signal/55"
                  onClick={() => onEnterRadio(signal.code)}
                >
                  去地球表面电台
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/18 bg-white/[0.04] px-4 py-2 font-serif text-[12.5px] text-white/85 transition hover:border-signal/55"
                  onClick={onEnterPost}
                >
                  我也寄出视野
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {viewerOpen && signal && (
        <SignalViewer
          key={signal.code}
          signal={signal}
          muted={muted}
          externalMixer={mixer}
          onHeartsChange={handleHeartsChange}
          onEchoesChange={handleEchoesChange}
          onCityResonate={onRecordCity}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </main>
  )
}
