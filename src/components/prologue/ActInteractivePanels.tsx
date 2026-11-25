import type { PanelKind } from '../../types/sensor'
import { CalibrationDial } from '../CalibrationDial'

interface ActInteractivePanelsProps {
  panel: PanelKind
  quoteOpen: boolean
  focusProgress: number
  tuning: number
  inZone: boolean
  windHint: boolean
  blowCharge: number
  ruinPulses: number
  rainCatches: number
  rainTarget: number
  fireflyCount: number
  fireflyTarget: number
  constellationCount: number
  constellationHint: boolean
  onDismiss: () => void
  onUpdateFocus: (next: number) => void
  onStartFocusHold: () => void
  onStopFocusHold: () => void
  onChangeTuning: (next: number) => void
  onAutoAlign: () => void
  onStartBlowHold: () => void
  onReleaseBlowHold: () => void
  onTriggerRuinPulse: (x?: number, y?: number) => void
  onCatchRainDrop: (idx: number | undefined, x: number, y: number) => void
  onWakeFirefly: (x: number, y: number) => void
  onAutoConnect: () => void
}

export function ActInteractivePanels({
  panel,
  quoteOpen,
  focusProgress,
  tuning,
  inZone,
  windHint,
  blowCharge,
  ruinPulses,
  rainCatches,
  rainTarget,
  fireflyCount,
  fireflyTarget,
  constellationCount,
  constellationHint,
  onDismiss,
  onUpdateFocus,
  onStartFocusHold,
  onStopFocusHold,
  onChangeTuning,
  onAutoAlign,
  onStartBlowHold,
  onReleaseBlowHold,
  onTriggerRuinPulse,
  onCatchRainDrop,
  onWakeFirefly,
  onAutoConnect,
}: ActInteractivePanelsProps) {
  if (quoteOpen || panel === 'none') return null

  return (
    <>
      {panel === 'focus' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[540px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 I 幕 · 06:40 · 晨雾对焦</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.08em] text-[#fff8ee]">
              替她看清第一朵花
            </h2>
            <p className="mx-auto mt-2 max-w-[25rem] font-serif text-[13px] font-normal leading-[1.85] text-white/70">
              镜片上还蒙着草原清晨的露雾。拖动下方对焦滑轨，或长按光学环直到视野清晰。
            </p>

            <div className="mt-4 flex items-center gap-3 px-2">
              <span className="font-mono text-[10px] tracking-[0.1em] text-white/50">FOG</span>
              <div className="relative flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#a88762] to-[#fff0d4] transition-[width] duration-75"
                    style={{ width: `${Math.round(focusProgress * 100)}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={focusProgress}
                  onChange={(event) => onUpdateFocus(Number(event.target.value))}
                  aria-label="传感眼镜光学焦距"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              <span className="w-10 text-right font-mono text-[11px] text-signal">
                {Math.round(focusProgress * 100)}%
              </span>
            </div>

            <button
              type="button"
              onPointerDown={onStartFocusHold}
              onPointerUp={onStopFocusHold}
              onPointerLeave={onStopFocusHold}
              onPointerCancel={onStopFocusHold}
              className="btn-primary mt-5 select-none"
            >
              按住光学对焦环 · 散开晨雾
            </button>
          </div>
        </div>
      )}

      {panel === 'wind' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
          <div className="cinema-surface pointer-events-auto animate-fade-up no-scrollbar relative max-h-[calc(100dvh-5rem)] w-full max-w-[720px] overflow-y-auto rounded-[26px] p-4 sm:max-h-none sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="-mb-10 -mt-4 scale-[0.78] rounded-full bg-[#091122]/75 p-1 sm:m-0 sm:scale-100">
                <CalibrationDial value={tuning} inZone={inZone} onChange={onChangeTuning} />
              </div>
              <div className="flex-1 pb-2 text-center sm:pb-0 sm:text-left">
                <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 II 幕 · 09:30 · 湖畔风声</div>
                <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.08em] text-[#fff8ee]">湖畔的风声</h2>
                <p className="mt-2 font-serif text-[13px] font-normal leading-[1.9] tracking-[0.04em] text-white/70">
                  水声先落了下来。现在转动刻度环，对准金色共振带，让草原的长风穿过耳机。
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 font-serif text-[12px] sm:justify-start">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${inZone ? 'bg-signal animate-[blinkDot_1s_ease-in-out_infinite]' : 'bg-white/30'}`}
                  />
                  <span className={inZone ? 'text-signal' : 'text-white/55'}>
                    {inZone ? '已进入共振区间 · 保持 0.7 秒' : '正在杂音中寻找风声…'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
                  <button type="button" className="btn-ghost" onClick={onAutoAlign}>
                    自动对齐
                  </button>
                  {windHint && (
                    <span className="font-serif text-[11.5px] text-signal/75 animate-[blinkSoft_2s_ease-in-out_infinite]">
                      卡住了？点一下自动对齐
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {panel === 'dandelion' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 III 幕 · 13:15 · 孤树山坡</div>
            <h2 className="mt-1.5 font-serif text-[23px] font-normal tracking-[0.1em] text-[#fff8ee]">孤树下的蒲公英</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-normal leading-[1.9] tracking-[0.04em] text-white/70">
              树梢木风铃还在轻轻作响。按住（或轻点）按钮汇聚午后暖风，把白色绒毛送向湖谷。
            </p>
            <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffd9a3] to-[#fff5d6] transition-[width] duration-75"
                style={{ width: `${blowCharge}%` }}
              />
            </div>
            <button
              type="button"
              className="btn-primary mt-5 select-none"
              onPointerDown={onStartBlowHold}
              onPointerUp={onReleaseBlowHold}
              onPointerLeave={onReleaseBlowHold}
              onPointerCancel={onReleaseBlowHold}
            >
              长按聚风 · 吹散蒲公英
            </button>
            <p className="mt-3 font-serif text-[12px] text-white/55">
              {blowCharge > 0 ? `正在凝聚午后暖风 ${Math.round(blowCharge)}%` : '松开即会顺风飘起'}
            </p>
          </div>
        </div>
      )}

      {panel === 'ruin' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 IV 幕 · 15:50 · 山腰石拱</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.1em] text-[#fff8ee]">唤醒古老石拱</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-normal leading-[1.85] text-white/70">
              石拱正中央的刻石微弱发亮。轻点下方呼吸共鸣环三次（或按空格键），听山谷替她应答。
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    index < ruinPulses
                      ? 'bg-signal shadow-[0_0_12px_rgba(242,194,139,0.95)]'
                      : 'border border-white/25 bg-white/[0.04]'
                  }`}
                />
              ))}
              <span className="ml-1 font-mono text-[11px] text-signal">{ruinPulses}/3</span>
            </div>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={(event) => onTriggerRuinPulse(event.clientX, event.clientY)}
                className="relative flex h-20 w-20 items-center justify-center rounded-full border border-signal/60 bg-signal/15 font-serif text-[13px] text-[#fff8ee] shadow-[0_0_28px_rgba(242,194,139,0.35)] transition hover:scale-105 active:scale-95"
              >
                <span className="breathe-ring pointer-events-none absolute -inset-3 rounded-full border border-signal/45" />
                <span>呼唤</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === 'rain' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 V 幕 · 18:10 · 黄昏晚雨</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.1em] text-[#fff8ee]">点住空中飘落的雨滴</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-normal leading-[1.85] text-white/70">
              点击画面上缓缓落下的光亮雨点，把四年后的第一场雨传进她的耳机里。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              {Array.from({ length: rainTarget }, (_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    index < rainCatches
                      ? 'bg-[#b9d2ff] shadow-[0_0_12px_rgba(185,210,255,0.9)]'
                      : 'border border-white/20 bg-white/[0.03]'
                  }`}
                />
              ))}
              <span className="ml-2 font-mono text-[11px] tracking-[0.14em] text-white/65">
                {rainCatches}/{rainTarget}
              </span>
            </div>
            <button
              type="button"
              className="btn-ghost mt-4"
              onClick={(event) => onCatchRainDrop(undefined, event.clientX, event.clientY)}
            >
              直接伸手接住一滴
            </button>
          </div>
        </div>
      )}

      {panel === 'fireflies' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[520px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 VI 幕 · 19:45 · 轻舟守夜</div>
            <h2 className="mt-1.5 font-serif text-[22px] font-normal tracking-[0.1em] text-[#fff8ee]">轻点暮色，唤来流萤</h2>
            <p className="mx-auto mt-2 max-w-[24rem] font-serif text-[13px] font-normal leading-[1.85] text-white/70">
              轻点上方湖畔木船周围的任意角落，每一处触碰都会升起一簇流萤。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: fireflyTarget }, (_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    index < fireflyCount
                      ? 'bg-signal shadow-[0_0_12px_rgba(242,194,139,0.9)]'
                      : 'border border-white/20 bg-white/[0.03]'
                  }`}
                />
              ))}
              <span className="ml-2 font-mono text-[10.5px] tracking-[0.16em] text-white/60">
                {fireflyCount}/{fireflyTarget}
              </span>
            </div>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={(event) => onWakeFirefly(event.clientX, event.clientY - 120)}
            >
              在船畔唤醒一簇流萤 ({fireflyCount}/{fireflyTarget})
            </button>
          </div>
        </div>
      )}

      {panel === 'constellation' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="cinema-surface pointer-events-auto animate-fade-up relative w-full max-w-[540px] rounded-[26px] p-5 text-center sm:p-6">
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-1 font-serif text-[11px] text-white/70 transition hover:border-signal/55 hover:text-signal"
            >
              收起 ×
            </button>
            <div className="font-serif text-[12px] tracking-[0.12em] text-signal/85">第 VII 幕 · 22:30 · 专属星河</div>
            <h2 className="mt-1.5 font-serif text-[23px] font-normal tracking-[0.1em] text-[#fff8ee]">亲手连起夜空三颗星</h2>
            <p className="mx-auto mt-2 max-w-[25rem] font-serif text-[13px] font-normal leading-[1.9] tracking-[0.04em] text-white/70">
              夜空中亮着三颗最温柔的星。依次点亮它们，在信号熄灭前连起属于你们的星座。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] transition-all duration-500 ${
                    index < constellationCount
                      ? 'border-signal/60 bg-signal/20 text-signal shadow-[0_0_14px_rgba(242,194,139,0.45)]'
                      : 'border-white/20 text-white/55'
                  }`}
                >
                  {index + 1}
                </span>
              ))}
              <span className="ml-1 font-mono text-[11px] tracking-[0.14em] text-white/60">{constellationCount}/3</span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" className="btn-ghost" onClick={onAutoConnect}>
                帮我连上这三颗星
              </button>
              {constellationHint && (
                <span className="font-serif text-[11.5px] text-signal/80 animate-[blinkSoft_2s_ease-in-out_infinite]">
                  找不到星点？点左键交给它
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
