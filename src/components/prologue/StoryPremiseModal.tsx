import { BRIEFING_CARDS } from '../../data/narrative'

interface StoryPremiseModalProps {
  open: boolean
  mode: 'browse' | 'first_entry'
  onClose: () => void
  onEnter: () => void
  onSkipAndEnter: () => void
}

export function StoryPremiseModal({
  open,
  mode,
  onClose,
  onEnter,
  onSkipAndEnter,
}: StoryPremiseModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#040814]/80 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="故事前情 · 带上她的眼睛"
      onClick={onClose}
    >
      <div
        className="cinema-surface animate-fade-up no-scrollbar max-h-[88dvh] w-full max-w-[680px] overflow-y-auto rounded-[28px] p-5 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
              <span className="hud-label text-signal/85">STORY PREMISE · 序幕背景</span>
            </div>
            <h2 className="mt-1.5 font-serif text-[21px] font-normal tracking-[0.06em] text-[#fff8ee] sm:text-[24px]">
              致敬刘慈欣《带上她的眼睛》
            </h2>
            <p className="mt-1.5 font-serif text-[13px] leading-[1.75] text-white/65">
              不知道原著也能立刻上手：你将在草原开启一次“替别人休假”的感官之旅。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭故事前情"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition hover:border-signal/55 hover:text-signal"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {BRIEFING_CARDS.map((card) => (
            <div
              key={card.tag}
              className="rounded-2xl border border-white/12 bg-white/[0.03] p-4"
            >
              <div className="font-mono text-[10px] tracking-[0.14em] text-signal/85">
                {card.tag}
              </div>
              <h3 className="mt-1.5 font-serif text-[14.5px] font-normal text-[#fff8ee]">
                {card.title}
              </h3>
              <p className="mt-2 font-serif text-[12px] leading-[1.75] text-white/68">
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-signal/25 bg-signal/[0.06] px-4 py-3 font-serif text-[12.5px] leading-[1.8] text-white/82">
          <span className="text-signal">游玩指引：</span>
          睁眼后先走进闪烁微光的<strong>草原电话亭</strong>接起林微的电话，戴上传感脑机即可听声寻迹；随后轻触野花、湖风、晚雨与星空，揭开 6,371.4 公里深处的秘密。
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          {mode === 'first_entry' ? (
            <>
              <button
                type="button"
                onClick={onSkipAndEnter}
                className="btn-ghost"
              >
                我读过原著，直接跳过
              </button>
              <button
                type="button"
                onClick={onEnter}
                className="btn-primary"
              >
                读完了 · 进入草原接听电话
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="btn-ghost">
                返回封面
              </button>
              <button type="button" onClick={onEnter} className="btn-primary">
                进入草原接听电话
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
