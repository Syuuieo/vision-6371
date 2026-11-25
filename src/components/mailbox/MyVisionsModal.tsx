import { useEffect, useRef } from 'react'
import { buildShareLink, type MyVision } from '../../services/visionApi'

interface MyVisionsModalProps {
  open: boolean
  items: MyVision[]
  confirmCode: string | null
  deleting: string | null
  onClose: () => void
  onCopyLink: (link: string) => void
  onOpenRadio: (code: string) => void
  onArmDelete: (code: string | null) => void
  onConfirmDelete: (code: string) => void
}

export function MyVisionsModal({
  open,
  items,
  confirmCode,
  deleting,
  onClose,
  onCopyLink,
  onOpenRadio,
  onArmDelete,
  onConfirmDelete,
}: MyVisionsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[78] flex items-center justify-center bg-[#060c1a]/80 px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="我寄出的视野"
      onClick={onClose}
    >
      <div
        className="no-scrollbar max-h-[86dvh] w-full max-w-[560px] overflow-y-auto rounded-[28px] border border-white/15 bg-[#0d1832]/95 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.24em] text-signal/75">MY VISIONS</div>
            <h2 className="mt-1.5 font-serif text-[18px] font-normal tracking-[0.06em] text-[#fff6ea]">
              我寄出的视野
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/18 px-3.5 py-1.5 font-serif text-[12px] text-white/75 transition hover:border-signal/55 hover:text-signal"
          >
            关闭
          </button>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/45">
          这里只列出这台设备寄出过的视野。撤回会同时删掉电台上的那一份；若此刻连不上云端，就只清本机，不会弹出错误。
        </p>

        {items.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center font-serif text-[13px] text-white/50">
            还没有寄出过视野。挑一片风景，寄给地心试试。
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {items.map((item) => (
              <div
                key={item.code}
                className="rounded-2xl border border-white/12 bg-white/[0.03] p-3"
              >
                <div className="flex gap-3">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="h-[56px] w-[84px] shrink-0 rounded-xl border border-white/12 object-cover"
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-[13.5px] text-[#fff8ee]">{item.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-white/50">
                      {item.city} · {item.hearts} 次共鸣 · {new Date(item.savedAt).toLocaleDateString('zh-CN')}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-white/55">
                        {item.code}
                      </span>
                      <span className="rounded-full border border-signal/30 px-2 py-0.5 text-[10px] text-signal/80">
                        {item.visibility === 'private' ? '仅凭链接' : '公开'}
                      </span>
                      <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-white/45">
                        {item.onCloud ? '已在电台' : '仅本机'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onCopyLink(buildShareLink(item.code))}
                    className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/75 transition hover:border-signal/55 hover:text-signal"
                  >
                    复制链接
                  </button>
                  {item.visibility === 'public' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenRadio(item.code)
                      }}
                      className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/75 transition hover:border-signal/55 hover:text-signal"
                    >
                      打开
                    </button>
                  )}
                  {item.deletable ? (
                    confirmCode === item.code ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onArmDelete(null)}
                          className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/60 transition hover:border-white/40"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => onConfirmDelete(item.code)}
                          disabled={deleting === item.code}
                          className="rounded-full border border-[#ff9b8a]/50 bg-[#ff9b8a]/12 px-3 py-1.5 font-serif text-[11.5px] text-[#ffb9ac] transition hover:bg-[#ff9b8a]/22 disabled:cursor-wait disabled:opacity-60"
                        >
                          {deleting === item.code ? '撤回中…' : '确认撤回'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onArmDelete(item.code)}
                        className="rounded-full border border-white/18 px-3 py-1.5 font-serif text-[11.5px] text-white/60 transition hover:border-[#ff9b8a]/55 hover:text-[#ffb9ac]"
                      >
                        撤回
                      </button>
                    )
                  ) : (
                    <span className="px-1 text-[10.5px] leading-relaxed text-white/35">
                      这份寄出于旧版本，没有撤回凭证
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
