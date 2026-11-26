import { useEffect, useState } from 'react'
import { voicePlayer, type VoiceMode, type VoiceSnapshot } from '../../audio/voicePlayer'
import { TRUTH } from '../../data/narrative'
import type {
  DialogueChoice,
  EasterEggMeta,
  Phase,
  PrologueQuote,
  QuoteKey,
} from '../../types/sensor'

interface NarrativeModalsProps {
  phase: Phase
  quote: { key: QuoteKey; data: PrologueQuote } | null
  quoteCollapsed: boolean
  selectedChoice: DialogueChoice | null
  activeQuoteVoiceId: string | null
  activeQuoteVoiceMode: VoiceMode
  voiceState: VoiceSnapshot
  lore: EasterEggMeta | null
  attenuating: boolean
  calmMotion?: boolean
  showVoiceControl?: boolean
  meadowShot: { image: string; placeName: string; hour: number } | null
  meadowNote: string
  meadowSaved: boolean
  meadowQuickNotes: readonly string[]
  formatClockHour: (hour: number) => string
  onToggleQuoteCollapse: () => void
  onPickChoice: (choice: DialogueChoice) => void
  onContinueQuote: () => void
  onProceedDescent?: () => void
  onCloseLore: () => void
  onCloseMeadowShot: () => void
  onMeadowNoteChange: (val: string) => void
  onConfirmSaveMeadowShot: () => void
  onGoDiorama: () => void
}

interface TruthRevealOverlayProps {
  calmMotion: boolean
  onProceedDescent?: () => void
}

function TruthRevealOverlay({ calmMotion, onProceedDescent }: TruthRevealOverlayProps) {
  const [revealProgress, setRevealProgress] = useState(() => (calmMotion ? 1 : 0))

  useEffect(() => {
    if (calmMotion) return
    let rafId = 0
    const durationMs = 1650
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setRevealProgress(eased)
      if (t < 1) {
        rafId = requestAnimationFrame(step)
      }
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [calmMotion])

  const effectiveProgress = calmMotion ? 1 : revealProgress
  const displayDepth = (6371.4 * effectiveProgress).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const displayTemp = Math.round(18 + 5382 * effectiveProgress).toLocaleString('en-US')
  const displayPressure = (0.1 + 359.9 * Math.pow(effectiveProgress, 1.3)).toFixed(1)

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]">
      <div className="attenuation-overlay" />
      <div className="chromatic-stress relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="glitch-text font-mono text-[10px] tracking-[0.28em] text-[#ffb18a] sm:text-[11.5px]">
          {TRUTH.tag} <span className="mx-2 text-white/25">//</span> DEPTH UNSEALED
        </div>
        <div className="hud-value mt-4 flex items-baseline gap-2 text-[#ffd0bd]">
          <span className="text-[clamp(54px,10vw,104px)] font-light leading-none text-glow-ember">
            {displayDepth}
          </span>
          <span className="text-[11px] tracking-[0.24em] text-white/45">{TRUTH.unit}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.34em] text-[#ff8f70]">{TRUTH.subtitle}</div>
        <div className="mt-6 space-y-1.5">
          {TRUTH.lines.map((line, index) => (
            <p
              key={line}
              className="quote-line font-serif text-[15px] font-normal leading-[1.9] tracking-[0.08em] text-white/82"
              style={{ animationDelay: `${0.12 + index * 0.2}s` }}
            >
              {line}
            </p>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="rounded-full border border-[#ff795a]/35 bg-[#ff5a3c]/[0.08] px-3 py-1 font-mono text-[9.5px] tracking-[0.16em] text-[#ffad96]">
            外部压强 {displayPressure} GPa · {displayTemp}°C // NEURAL OVERRIDE
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.2em] text-white/38">{TRUTH.vessel}</span>
        </div>
        {onProceedDescent && (
          <div className="pointer-events-auto mt-7 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onProceedDescent}
              className="btn-primary !border-ember/60 !bg-[#ff9468] !text-[#1a0a06]"
            >
              立即随信号下坠 ›
            </button>
            <span className="font-serif text-[11.5px] text-white/48">
              等待旁白结束自动俯冲，或轻点提前穿透地核
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function NarrativeModals({
  phase,
  quote,
  quoteCollapsed,
  selectedChoice,
  activeQuoteVoiceId,
  activeQuoteVoiceMode,
  voiceState,
  lore,
  attenuating,
  calmMotion = false,
  showVoiceControl = true,
  meadowShot,
  meadowNote,
  meadowSaved,
  meadowQuickNotes,
  formatClockHour,
  onToggleQuoteCollapse,
  onPickChoice,
  onContinueQuote,
  onProceedDescent,
  onCloseLore,
  onCloseMeadowShot,
  onMeadowNoteChange,
  onConfirmSaveMeadowShot,
  onGoDiorama,
}: NarrativeModalsProps) {
  return (
    <>
      {meadowShot && (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-[#030712]/72 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="定格草原留影"
          onClick={onCloseMeadowShot}
        >
          <div
            className="cinema-surface animate-fade-up w-full max-w-[560px] rounded-[28px] p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="hud-label text-signal/85">MEADOW KEEPSAKE · 草原留影</div>
                <h3 className="mt-1 font-serif text-[19px] font-normal tracking-[0.06em] text-[#fff8ee]">
                  {meadowShot.placeName} · {formatClockHour(meadowShot.hour)}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseMeadowShot}
                className="rounded-full border border-white/14 px-3 py-1 font-serif text-[11.5px] text-white/70 transition hover:border-signal/50 hover:text-signal"
              >
                收起 ×
              </button>
            </div>

            <div className="mt-3.5 overflow-hidden rounded-2xl border border-white/14 bg-black/40">
              <img
                src={meadowShot.image}
                alt={meadowShot.placeName}
                className="aspect-video w-full object-cover"
              />
            </div>

            <label className="mt-4 block">
              <span className="font-serif text-[12.5px] tracking-[0.06em] text-signal/90">
                写一句带进纪念册的风声附言
              </span>
              <textarea
                value={meadowNote}
                onChange={(e) => onMeadowNoteChange(e.target.value)}
                rows={2}
                maxLength={140}
                placeholder={`在${meadowShot.placeName}替你定格了一阵地面上的风。`}
                className="mt-2 w-full resize-none rounded-2xl border border-white/14 bg-[#070e1f]/75 px-3.5 py-2 font-serif text-[13px] leading-[1.7] text-[#fff8ee] outline-none placeholder:text-white/35 focus:border-signal/60"
              />
            </label>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {meadowQuickNotes.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onMeadowNoteChange(preset)}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 font-serif text-[11px] text-white/68 transition hover:border-signal/45 hover:text-signal"
                >
                  {preset.slice(0, 14)}…
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
              <button type="button" onClick={onCloseMeadowShot} className="btn-ghost">
                继续漫步
              </button>
              {meadowSaved ? (
                <button type="button" onClick={onGoDiorama} className="btn-primary">
                  去纪念册查看 ›
                </button>
              ) : (
                <button type="button" onClick={onConfirmSaveMeadowShot} className="btn-primary">
                  收进纪念册
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {quote && phase !== 'descending' && phase !== 'core_pulse' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[36] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6">
          <div
            className={`cinema-surface pointer-events-auto animate-fade-up no-scrollbar relative w-full max-w-[660px] overflow-y-auto rounded-[26px] p-5 sm:p-7 ${
              quoteCollapsed ? '' : 'max-h-[45dvh]'
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 w-px"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(242,194,139,0.65), transparent)' }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-serif text-[12px] tracking-[0.1em] text-signal/85">{quote.data.eyebrow}</span>
              <span className="flex items-center gap-2">
                {activeQuoteVoiceId && (
                  <button
                    type="button"
                    onClick={() => {
                      void voicePlayer.unlock()
                      void voicePlayer.toggle(activeQuoteVoiceId, activeQuoteVoiceMode)
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/[0.08] px-2.5 py-1 font-serif text-[11.5px] text-signal/95 transition hover:border-signal/60 hover:bg-signal/[0.16]"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-signal ${
                        voiceState.playingId === activeQuoteVoiceId || voiceState.loadingId === activeQuoteVoiceId
                          ? 'animate-[blinkDot_1.2s_ease-in-out_infinite]'
                          : 'opacity-60'
                      }`}
                    />
                    <span>
                      {voiceState.playingId === activeQuoteVoiceId
                        ? '林微 · 播音中'
                        : voiceState.loadingId === activeQuoteVoiceId
                          ? '载入语音…'
                          : '林微的声音 · 重听'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleQuoteCollapse}
                  aria-expanded={!quoteCollapsed}
                  className="flex items-center gap-1 rounded-full border border-white/16 px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-[#fff8ee]"
                >
                  <span>{quoteCollapsed ? '展开对话' : '看风景'}</span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={quoteCollapsed ? '' : 'rotate-180'}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </span>
            </div>

            {!quoteCollapsed && (
              <>
                {quote.data.clue && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1 font-serif text-[11.5px] text-[#ffd4c4]">
                    <span className="cinema-gem h-1.5 w-1.5 bg-ember" />
                    {quote.data.clue.label}
                  </div>
                )}

                <div className="mt-3.5 space-y-1.5">
                  {quote.data.lines.map((line, index) => (
                    <p
                      key={line}
                      className="quote-line font-serif text-[15.5px] font-normal leading-[1.9] tracking-[0.05em] text-[#fff8ee] sm:text-[17px]"
                      style={{ animationDelay: `${0.1 + index * 0.14}s` }}
                    >
                      {line}
                    </p>
                  ))}
                </div>

                {quote.data.choices && quote.data.choices.length > 0 && !selectedChoice && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    {quote.data.question && (
                      <p className="mb-3 font-serif text-[13.5px] tracking-[0.05em] text-signal/90">
                        {quote.data.question}
                      </p>
                    )}
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {quote.data.choices.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => onPickChoice(choice)}
                          className="rounded-2xl border border-signal/28 bg-signal/[0.06] px-4 py-3 text-left font-serif text-[13px] leading-[1.65] tracking-[0.04em] text-[#fff8ee]/92 transition hover:border-signal/65 hover:bg-signal/[0.14]"
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedChoice && (
                  <div className="mt-4 border-l-2 border-signal/60 pl-4">
                    <div className="font-serif text-[12px] tracking-[0.06em] text-signal/85">
                      你回应：{selectedChoice.label}
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedChoice.reply.map((line, index) => (
                        <p
                          key={line}
                          className="quote-line font-serif text-[15px] font-normal leading-[1.85] tracking-[0.05em] text-[#fff2dc]"
                          style={{ animationDelay: `${0.06 + index * 0.14}s` }}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {(!quote.data.choices?.length || selectedChoice) && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-white/48">{quote.data.signature}</span>
                    <button type="button" className="btn-primary !px-5 !py-2.5 !text-[11px]" onClick={onContinueQuote}>
                      {quote.data.nextLabel ?? '继续'}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {lore && (
        <div className="fixed inset-0 z-[38] flex items-center justify-center bg-[#030712]/48 px-4 backdrop-blur-sm">
          <div className="cinema-surface animate-fade-up relative w-full max-w-[520px] overflow-hidden rounded-[26px] p-6 text-center sm:p-8">
            <div
              className="mx-auto mb-4 flex h-10 w-10 rotate-45 items-center justify-center rounded-[8px] border"
              style={{ borderColor: `${lore.accent}60`, background: `${lore.accent}14` }}
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: lore.accent, boxShadow: `0 0 14px ${lore.accent}` }}
              />
            </div>
            <div className="hud-label !text-[9px]">{lore.kicker}</div>
            <h3 className="mt-2 font-serif text-[22px] font-normal tracking-[0.08em] text-white/92">{lore.title}</h3>
            <div className="mt-4 space-y-1.5">
              {lore.lines.map((line, index) => (
                <p
                  key={line}
                  className="quote-line font-serif text-[14.5px] font-normal leading-[1.95] tracking-[0.05em] text-white/70"
                  style={{ animationDelay: `${index * 0.14}s` }}
                >
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-4 font-mono text-[10px] tracking-[0.18em] text-white/38">{lore.signature}</div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {showVoiceControl && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    void voicePlayer.unlock()
                    void voicePlayer.toggle(`egg-${lore.id}`, lore.id === 'tablet' ? 'clear' : 'headset')
                  }}
                >
                  {voiceState.playingId === `egg-${lore.id}` ? '暂停语音' : '重听回声'}
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={onCloseLore}
              >
                收好这段回声
              </button>
            </div>
          </div>
        </div>
      )}

      {attenuating && (
        <TruthRevealOverlay calmMotion={calmMotion} onProceedDescent={onProceedDescent} />
      )}
    </>
  )
}
