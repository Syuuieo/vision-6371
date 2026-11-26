export interface VisorPulse {
  id: number
  kind: 'boot' | 'scan' | 'core'
  title: string
  subtitle: string
  hint?: string
}

interface NeuralVisorOverlayProps {
  pulse: VisorPulse | null
}

export function NeuralVisorOverlay({ pulse }: NeuralVisorOverlayProps) {
  if (!pulse) return null
  const isCore = pulse.kind === 'core'
  const accentText = isCore ? 'text-[#ff9c80]' : 'text-[#7ce8ff]'
  const accentBorder = isCore ? 'border-[#ff7b5c]/65' : 'border-[#67e8f9]/65'
  const sweepGradient = isCore
    ? 'linear-gradient(180deg, transparent 0%, rgba(255, 110, 72, 0.28) 50%, rgba(255, 160, 120, 0.85) 51%, transparent 100%)'
    : 'linear-gradient(180deg, transparent 0%, rgba(103, 232, 249, 0.22) 50%, rgba(186, 248, 255, 0.85) 51%, transparent 100%)'

  return (
    <div
      key={pulse.id}
      className="visor-pulse-root pointer-events-none fixed inset-0 z-[41] overflow-hidden"
      aria-hidden="true"
    >
      {/* 四角脑机传感光学框 */}
      <div className="absolute inset-4 sm:inset-7">
        <span className={`absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 ${accentBorder}`} />
        <span className={`absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 ${accentBorder}`} />
        <span className={`absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 ${accentBorder}`} />
        <span className={`absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 ${accentBorder}`} />
      </div>

      {/* 纵向扫描激光线（配合 flashSafe / reducedMotion 在 CSS 自动退化为静态微光） */}
      <div
        className="visor-scan-beam absolute inset-x-0 h-28"
        style={{ background: sweepGradient }}
      />

      {/* 声波环扩散（类似脑机声波探测脉冲） */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span
          className={`visor-sonar-ring block h-44 w-44 rounded-full border ${
            isCore ? 'border-[#ff7b5c]/55' : 'border-[#67e8f9]/55'
          }`}
        />
      </div>

      {/* 顶部赛博系统状态横幅 */}
      <div className="absolute inset-x-4 top-[92px] flex justify-center sm:top-[84px]">
        <div
          className={`rounded-2xl border bg-[#060d1c]/82 px-5 py-2.5 text-center backdrop-blur-md shadow-2xl ${
            isCore ? 'border-[#ff7b5c]/50' : 'border-[#67e8f9]/45'
          }`}
        >
          <div className={`font-mono text-[10px] tracking-[0.24em] ${accentText}`}>
            {pulse.subtitle}
          </div>
          <div className="mt-0.5 font-serif text-[14.5px] font-normal tracking-[0.1em] text-[#fff8ee]">
            {pulse.title}
          </div>
          {pulse.hint && (
            <div className="mt-1 font-serif text-[11.5px] text-white/75">{pulse.hint}</div>
          )}
        </div>
      </div>
    </div>
  )
}
