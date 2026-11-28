import { voicePlayer, type VoiceSnapshot } from '../../audio/voicePlayer'
import { FINAL_CAPTION, FINAL_LINES, TRUTH } from '../../data/narrative'
import type { ModuleId, Phase } from '../../types/sensor'
import type { MemoryFrame } from '../../utils/memoryStripExport'

interface EndingSequenceOverlayProps {
  phase: Phase
  introBeat: number
  introBeatsTotal: number
  currentIntroBeat: {
    speaker: string
    timeLabel: string
    text: string
    sub?: string
  }
  currentDescentCaption: {
    layer: string
    line: string
  }
  depthKm: number
  signal: number
  voiceState: VoiceSnapshot
  epilogueNote: string | null
  wishNote: string | null
  memories: MemoryFrame[]
  exportingRoll: boolean
  showVoiceControl?: boolean
  coreBursting?: boolean
  flashSafe?: boolean
  onAdvanceIntro: () => void
  onSkipIntro: () => void
  onExitToRitual: () => void
  onRespondCoreHeartbeat: () => void
  onNavigate: (module: ModuleId) => void
  onExportRoll: () => void
  onRestart: () => void
}

export function EndingSequenceOverlay({
  phase,
  introBeat,
  introBeatsTotal,
  currentIntroBeat,
  currentDescentCaption,
  depthKm,
  signal,
  voiceState,
  epilogueNote,
  wishNote,
  memories,
  exportingRoll,
  showVoiceControl = true,
  coreBursting = false,
  flashSafe = false,
  onAdvanceIntro,
  onSkipIntro,
  onExitToRitual,
  onRespondCoreHeartbeat,
  onNavigate,
  onExportRoll,
  onRestart,
}: EndingSequenceOverlayProps) {
  return (
    <>
      {phase === 'intro_call' && (
        <div
          className="fixed inset-x-0 bottom-0 z-[42] flex cursor-pointer flex-col items-center px-4 pb-[max(1.4rem,env(safe-area-inset-bottom))] sm:pb-8"
          onClick={onAdvanceIntro}
        >
          <div
            key={introBeat}
            className="cinema-caption cinema-surface w-full max-w-[660px] rounded-[26px] px-6 py-5 sm:px-8 sm:py-6"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-serif text-[12px] tracking-[0.08em] text-signal">
                <span className="h-2 w-2 rounded-full bg-signal animate-[blinkDot_1.8s_ease-in-out_infinite]" />
                <span>{currentIntroBeat.speaker}</span>
              </div>
              <div className="flex items-center gap-2">
                {showVoiceControl && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void voicePlayer.unlock()
                      void voicePlayer.toggle(`intro-${introBeat}`, introBeat === 0 ? 'clear' : 'headset')
                    }}
                    aria-label="播音或重听开场语音"
                    className="flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/[0.08] px-2.5 py-0.5 font-serif text-[11px] text-signal transition hover:border-signal/60 hover:bg-signal/[0.15]"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-signal ${
                        voiceState.playingId === `intro-${introBeat}` || voiceState.loadingId === `intro-${introBeat}`
                          ? 'animate-[blinkDot_1.2s_ease-in-out_infinite]'
                          : 'opacity-55'
                      }`}
                    />
                    <span>
                      {voiceState.playingId === `intro-${introBeat}`
                        ? '播音中 · 暂停'
                        : voiceState.loadingId === `intro-${introBeat}`
                          ? '载入中'
                          : '重听语音'}
                    </span>
                  </button>
                )}
                <span className="font-mono text-[10.5px] text-white/45">
                  {currentIntroBeat.timeLabel} · {introBeat + 1}/{introBeatsTotal}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSkipIntro()
                  }}
                  className="rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-0.5 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
                >
                  跳过 ›
                </button>
              </div>
            </div>
            <p className="mt-3 font-serif text-[16px] font-normal leading-[1.85] tracking-[0.04em] text-[#fff8ee] sm:text-[18px]">
              {currentIntroBeat.text}
            </p>
            {currentIntroBeat.sub && (
              <p className="mt-2 font-serif text-[12.5px] leading-[1.7] text-white/58">
                {currentIntroBeat.sub}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: introBeatsTotal }, (_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === introBeat ? 'w-5 bg-signal' : idx < introBeat ? 'w-1.5 bg-signal/50' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onExitToRitual()
                  }}
                  className="font-serif text-[11.5px] text-white/50 transition hover:text-white/85"
                >
                  回到封面
                </button>
                <span className="font-serif text-[12px] tracking-[0.08em] text-signal/90">
                  {introBeat < introBeatsTotal - 1 ? '轻点继续 ›' : '戴好眼镜 · 看清这片晨雾 ›'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'descending' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center px-4 pb-[max(1.4rem,env(safe-area-inset-bottom))]">
          <div
            key={currentDescentCaption.layer}
            className="cinema-caption mb-4 max-w-[36rem] rounded-full border border-ember/25 bg-[#120b0d]/68 px-5 py-2 text-center backdrop-blur-md"
          >
            <div className="font-mono text-[9.5px] tracking-[0.24em] text-ember">{currentDescentCaption.layer}</div>
            <p className="mt-0.5 font-serif text-[13px] tracking-[0.04em] text-[#ffe8d6]">
              {currentDescentCaption.line}
            </p>
          </div>
          <div className="hud-value flex items-baseline gap-2 text-[#ffd9b8] text-glow-ember">
            <span className="text-[clamp(40px,7vw,64px)] font-light leading-none">
              {depthKm.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-[11px] tracking-[0.24em] text-white/45">KM</span>
          </div>
          <div className="mt-2 h-[2px] w-52 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember/50 via-ember to-[#ffe4c2] transition-[width] duration-200"
              style={{ width: `${Math.min(100, (depthKm / 6371.4) * 100)}%` }}
            />
          </div>
          {(() => {
            const ratio = Math.min(1, Math.max(0, depthKm / 6371.4))
            const liveTemp = Math.round(18 + ratio * 5382)
            const livePressure = (0.0001 + Math.pow(ratio, 1.35) * 359.9999).toFixed(1)
            return (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[9.5px] tracking-[0.2em] text-[#ffad96]/85">
                <span>TEMP {liveTemp.toLocaleString('en-US')}°C</span>
                <span className="text-white/25">·</span>
                <span>PRESSURE {livePressure} GPa</span>
                <span className="text-white/25">·</span>
                <span>SIGNAL {(signal * 100).toFixed(0)}%</span>
              </div>
            )
          })()}
        </div>
      )}

      {phase === 'core_pulse' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[44] flex flex-col items-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
          {coreBursting && !flashSafe && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_52%,rgba(255,214,145,0.28),rgba(242,140,92,0.1)_44%,transparent_72%)] transition-opacity duration-700"
            />
          )}
          <div className="cinema-caption flex flex-col items-center">
            <p className="max-w-[32rem] font-serif text-[14.5px] leading-[1.85] tracking-[0.05em] text-[#fff0dc]/92">
              {coreBursting
                ? '已收到你的心跳——「落日六号」中微子信标全频共鸣中，正把人间星光送进地心深处…'
                : '6,371.4 公里深处，落日六号的琥珀色信标仍在铁镍海里一下一下闪亮。'}
            </p>
            <button
              type="button"
              disabled={coreBursting}
              onClick={onRespondCoreHeartbeat}
              className={`btn-primary pointer-events-auto relative mt-5 transition-all ${
                coreBursting ? 'scale-105 brightness-110' : ''
              }`}
            >
              <span
                className={`breathe-ring pointer-events-none absolute -inset-2 rounded-full border ${
                  coreBursting ? 'border-signal shadow-[0_0_28px_rgba(242,194,139,0.85)]' : 'border-signal/55'
                }`}
              />
              <span className="h-2 w-2 rounded-full bg-[#170f07]" />
              <span>{coreBursting ? '中微子心跳同步中…' : '回应她的心跳 · 同步落日六号'}</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'epilogue' && (
        <div className="pointer-events-none fixed inset-0 z-[46] flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-t from-[#091122] via-[#091122]/80 to-transparent" />
          <div className="ending-rise no-scrollbar relative mx-auto max-h-dvh w-full max-w-[780px] overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-20 text-center">
            <div className="mx-auto mb-4 flex w-max items-center gap-2 rounded-full border border-signal/35 bg-signal/10 px-3.5 py-1.5 font-serif text-[11.5px] tracking-[0.08em] text-signal">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-[blinkDot_2s_ease-in-out_infinite]" />
              <span>地心深处 · 落日六号信标仍在同频闪烁</span>
            </div>
            <div className="hud-value text-[clamp(48px,8.5vw,92px)] font-light leading-none tracking-[0.04em] text-[#fff8ee]">
              {TRUTH.depth}
              <span className="ml-2 font-mono text-[12px] tracking-[0.22em] text-white/55">{TRUTH.unit}</span>
            </div>
            <div className="mt-1 font-mono text-[10.5px] tracking-[0.26em] text-ember">{TRUTH.subtitle}</div>
            <div className="mt-4 space-y-1">
              {FINAL_LINES.map((line) => (
                <p key={line} className="font-serif text-[15px] font-normal leading-[2] tracking-[0.08em] text-white/88 sm:text-[17px]">
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-3 font-serif text-[12px] tracking-[0.08em] text-white/60">{FINAL_CAPTION}</p>
            {(epilogueNote || wishNote) && (
              <div className="mx-auto mt-3 max-w-[32rem] space-y-1">
                {epilogueNote && (
                  <p className="font-serif text-[14px] italic tracking-[0.05em] text-signal">{epilogueNote}</p>
                )}
                {wishNote && (
                  <p className="font-serif text-[12.5px] tracking-[0.04em] text-white/68">石拱心愿：{wishNote}</p>
                )}
              </div>
            )}

            {memories.length > 0 && (
              <div className="cinema-surface-soft pointer-events-auto mx-auto mt-5 flex max-w-[540px] flex-col items-center gap-2.5 rounded-2xl p-3">
                <div className="flex w-full items-center justify-between px-1 font-serif text-[12px] text-signal">
                  <span>落日六号 · 草原一日胶片实拍</span>
                  <span className="text-white/60">{memories.length} 帧可带往第 03 章</span>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
                  {memories.map((frame) => (
                    <div
                      key={frame.act}
                      className="overflow-hidden rounded-lg border border-white/12 bg-black/40"
                      title={`${frame.act} · ${frame.title}`}
                    >
                      <img
                        src={frame.dataUrl}
                        alt={frame.title}
                        className="aspect-video w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pointer-events-auto mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button type="button" className="btn-primary" onClick={() => onNavigate('radio')}>
                带上她的眼睛 · 进入行星电台
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="btn-ghost" onClick={() => onNavigate('post')}>
                去第 03 章 · 寄回一片风景
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {memories.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onExportRoll}
                  disabled={exportingRoll}
                >
                  {exportingRoll ? '胶片冲洗中…' : `下载胶片 (${memories.length} 帧)`}
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={onRestart}>
                重新开始今天
              </button>
              <button type="button" className="btn-ghost" onClick={onExitToRitual}>
                回到封面
              </button>
            </div>
            <p className="mt-5 font-mono text-[10px] tracking-[0.16em] text-white/45">
              灵感致敬 · 刘慈欣《带上她的眼睛》 · 故事台词均为原创
            </p>
          </div>
        </div>
      )}
    </>
  )
}
