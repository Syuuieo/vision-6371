import type { CardFrameMeta, LocalStampMeta } from '../../data/mailboxData'

interface LetterCardPreviewProps {
  activeFrame: CardFrameMeta
  activeStamp: LocalStampMeta
  city: string
  tempC: number
  letterWeather: string
  image: string
  title: string
  cssFilter: string
  selectedSticker: string
  letterBody: string
  sender: string
}

export function LetterCardPreview({
  activeFrame,
  activeStamp,
  city,
  tempC,
  letterWeather,
  image,
  title,
  cssFilter,
  selectedSticker,
  letterBody,
  sender,
}: LetterCardPreviewProps) {
  return (
    <div className="relative z-20 flex w-full justify-center bg-[#060c1a]/82 px-3 py-3.5 backdrop-blur-md sm:p-4 lg:absolute lg:inset-0 lg:overflow-y-auto">
      <div
        className={
          'relative my-auto w-full max-w-[490px] rounded-[24px] border-2 p-4 shadow-2xl sm:p-5 ' +
          activeFrame.borderClass +
          ' ' +
          activeFrame.bgClass +
          ' ' +
          activeFrame.textClass
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-signal/85">
              POSTCARD · {city || '某座城'}
            </div>
            <div className="mt-0.5 font-serif text-[15px] tracking-[0.04em]">
              {city || '地球某处'} {tempC}°C · {letterWeather || '微风'}
            </div>
          </div>
          <div
            className="flex flex-col items-center rounded-xl border-2 border-dashed px-2.5 py-1.5 text-center"
            style={{ borderColor: activeStamp.accent }}
          >
            <span className="text-[14px] leading-none">{activeStamp.motif}</span>
            <span className="mt-1 font-serif text-[10px]">{activeStamp.title}</span>
            <span className="font-mono text-[9px] text-signal/85">{activeStamp.denom}</span>
          </div>
        </div>
        <div className="relative mt-3 overflow-hidden rounded-xl border border-white/15">
          <img
            src={image}
            alt={title}
            className="aspect-video w-full object-cover"
            style={cssFilter ? { filter: cssFilter } : undefined}
            draggable={false}
          />
          {selectedSticker && (
            <span className="absolute bottom-2 left-2 rounded-full bg-[#070e1f]/75 px-2.5 py-0.5 font-serif text-[10.5px] text-signal backdrop-blur-sm">
              {selectedSticker}
            </span>
          )}
        </div>
        <p className="mt-3 font-serif text-[13px] leading-[1.8]">
          “{letterBody.trim() || '把这一刻的天色与风声折进信封寄给你。'}”
        </p>
        <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 font-serif text-[11.5px] text-white/65">
          <span className="truncate">{title}</span>
          <span className="shrink-0 text-signal">署名：{sender || '我'}</span>
        </div>
      </div>
    </div>
  )
}
