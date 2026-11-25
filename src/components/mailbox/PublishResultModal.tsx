import { citySignature } from '../../data/citySignature'
import { windLabel } from '../../data/presetVisions'
import type { PublishResult } from '../../types/vision'

interface PublishResultModalProps {
  result: PublishResult
  copied: boolean
  onClose: () => void
  onCopyLink: () => void
  onOpenPostcard: () => void
  onOpenRadio: (code: string) => void
}

export function PublishResultModal({
  result,
  copied,
  onClose,
  onCopyLink,
  onOpenPostcard,
  onOpenRadio,
}: PublishResultModalProps) {
  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-[#060c1a]/80 px-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-[28px] border border-white/15 bg-[#0d1832]/95 p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex gap-4">
          <img
            src={result.signal.packet.image}
            alt={result.signal.packet.title}
            className="h-[88px] w-[132px] shrink-0 rounded-2xl border border-white/12 object-cover"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-[17px] text-[#fff8ee]">
              {result.signal.packet.title}
            </div>
            <div className="mt-1 font-sans text-[12px] text-white/65">
              {result.signal.packet.city} · {result.signal.packet.tempC}°C ·{' '}
              {result.signal.packet.weather?.trim() ||
                citySignature(result.signal.packet.city)?.weather ||
                windLabel(result.signal.packet.windLevel)}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-signal/35 bg-signal/12 px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-signal">
              信号编号 {result.code}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/12 bg-[#081022]/85 p-3">
          <div className="font-serif text-[12px] text-white/65">
            分享链接 · 把这双眼睛交给想分享的人
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={result.link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-[#060c1a] px-3 py-2 font-mono text-[11.5px] text-signal outline-none"
              aria-label="分享链接"
            />
            <button
              type="button"
              onClick={onCopyLink}
              className="shrink-0 rounded-xl border border-signal/40 bg-signal/15 px-3.5 py-2 font-serif text-[12px] text-signal transition hover:bg-signal/25"
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        <p className="mt-4 font-serif text-[13px] leading-[1.85] text-white/75">
          {result.visibility === 'private'
            ? '这是一枚私密视界，只有拿到这条链接的人才能打开它。'
            : result.source === 'cloud'
              ? `它已经点亮在 ${result.signal.packet.city} 的地图上，任何人打开电台都能借用这一秒的风景。`
              : '这枚视界已保存在当前设备，分享链接同样可以打开查看。'}
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-white/18 px-4 py-2 font-serif text-[12.5px] text-white/80 transition hover:border-white/40"
            onClick={onClose}
          >
            继续编辑
          </button>
          <button
            type="button"
            className="rounded-full border border-white/18 px-4 py-2 font-serif text-[12.5px] text-white/80 transition hover:border-signal/60"
            onClick={() => {
              onClose()
              onOpenPostcard()
            }}
          >
            冲印明信片
          </button>
          {result.visibility === 'public' && (
            <button
              type="button"
              className="rounded-full bg-signal px-5 py-2 font-serif text-[12.5px] font-medium text-[#170f07] transition hover:brightness-105"
              onClick={() => {
                onClose()
                onOpenRadio(result.code)
              }}
            >
              去电台看看
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
