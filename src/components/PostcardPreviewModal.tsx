import { useEffect, useMemo, useRef, useState } from 'react'
import type { VisionPacket } from '../types/vision'
import {
  POSTCARD_THEMES,
  POSTCARD_TONES,
  type PostcardTheme,
  type PostcardTone,
  renderPostcardBlob,
} from '../utils/postcardExport'

interface PostcardPreviewModalProps {
  open: boolean
  packet: VisionPacket
  shareCode?: string
  initialTheme?: PostcardTheme
  initialTone?: PostcardTone
  whisperText?: string
  onClose: () => void
  onToast?: (message: string) => void
}

interface RenderedCard {
  key: string
  url: string
  blob: Blob
  code: string
}

export function PostcardPreviewModal({
  open,
  packet,
  shareCode,
  initialTheme = 'twilight',
  initialTone = 'natural',
  whisperText,
  onClose,
  onToast,
}: PostcardPreviewModalProps) {
  const [theme, setTheme] = useState<PostcardTheme>(initialTheme)
  const [tone, setTone] = useState<PostcardTone>(initialTone)
  const [showWhisper, setShowWhisper] = useState(true)
  const [showStamp, setShowStamp] = useState(true)
  const [rendered, setRendered] = useState<RenderedCard | null>(null)
  const [renderError, setRenderError] = useState<{ key: string; message: string } | null>(null)
  const [copying, setCopying] = useState(false)
  const [sharing, setSharing] = useState(false)
  const seqRef = useRef(0)

  const focusSignature = useMemo(
    () => packet.focus.map((f) => `${f.id}:${f.x.toFixed(3)}:${f.y.toFixed(3)}:${f.note}`).join('|'),
    [packet.focus],
  )

  const renderKey = useMemo(
    () =>
      [
        theme,
        tone,
        showWhisper ? 'w1' : 'w0',
        showStamp ? 's1' : 's0',
        shareCode ?? '',
        whisperText ?? '',
        packet.id,
        packet.title,
        packet.sender,
        packet.city,
        packet.tempC,
        packet.windLevel,
        packet.scentTag,
        packet.ambience,
        packet.stampId ?? '',
        packet.frameId ?? '',
        packet.sticker ?? '',
        packet.weather ?? '',
        packet.letter ?? '',
        packet.voice ? 'v1' : 'v0',
        packet.createdAt,
        packet.image.slice(0, 80),
        packet.image.length,
        focusSignature,
      ].join('::'),
    [
      theme,
      tone,
      showWhisper,
      showStamp,
      shareCode,
      whisperText,
      packet.id,
      packet.title,
      packet.sender,
      packet.city,
      packet.tempC,
      packet.windLevel,
      packet.scentTag,
      packet.ambience,
      packet.stampId,
      packet.frameId,
      packet.sticker,
      packet.weather,
      packet.letter,
      packet.voice,
      packet.createdAt,
      packet.image,
      focusSignature,
    ],
  )

  useEffect(() => {
    if (!open) return
    const seq = ++seqRef.current
    let alive = true
    void renderPostcardBlob(packet, {
      theme,
      tone,
      showWhisper,
      showStamp,
      shareCode,
      whisperText,
    })
      .then((result) => {
        if (!alive || seq !== seqRef.current) return
        const url = URL.createObjectURL(result.blob)
        setRendered({
          key: renderKey,
          url,
          blob: result.blob,
          code: result.code,
        })
      })
      .catch((error) => {
        if (!alive || seq !== seqRef.current) return
        setRenderError({
          key: renderKey,
          message: error instanceof Error ? error.message : '明信片生成失败',
        })
      })
    return () => {
      alive = false
    }
  }, [open, renderKey, packet, theme, tone, showWhisper, showStamp, shareCode, whisperText])

  useEffect(() => {
    const urlToRevoke = rendered?.url
    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke)
    }
  }, [rendered?.url])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const activeCard = rendered
  const busy = activeCard?.key !== renderKey && renderError?.key !== renderKey
  const errorText = renderError?.key === renderKey ? renderError.message : null

  const canCopyImage =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  const canSystemShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'

  const handleDownload = () => {
    if (!activeCard) return
    const anchor = document.createElement('a')
    anchor.href = activeCard.url
    anchor.download = `windpost-postcard-${activeCard.code}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    onToast?.(`明信片已下载 · ${activeCard.code.toUpperCase()}`)
  }

  const handleCopy = async () => {
    if (!activeCard || copying || !canCopyImage) return
    setCopying(true)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': activeCard.blob })])
      onToast?.('明信片图片已复制，可直接粘贴到微信 / 聊天窗口')
    } catch {
      onToast?.('当前浏览器不支持复制图片，请直接下载或长按保存')
    } finally {
      setCopying(false)
    }
  }

  const handleShare = async () => {
    if (!activeCard || sharing || !canSystemShare) return
    const file = new File([activeCard.blob], `windpost-postcard-${activeCard.code}.png`, {
      type: 'image/png',
    })
    try {
      if (!navigator.canShare({ files: [file] })) {
        onToast?.('当前环境不支持直接分享图片文件，请下载或长按保存')
        return
      }
      setSharing(true)
      await navigator.share({
        files: [file],
        title: `${packet.title} · 风信 Windpost`,
        text: `来自 ${packet.city} 的明信片 · 带上她的眼睛，替她再看一次世界`,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      onToast?.('系统分享已取消，可直接下载或长按图片保存')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050a16]/84 px-3 py-4 backdrop-blur-md sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="明信片冲印台"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[94dvh] w-full max-w-[980px] flex-col overflow-hidden rounded-[28px] border border-white/14 bg-[#0d172e]/96 shadow-[0_36px_110px_-30px_rgba(2,6,18,0.95)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-signal/78">POSTCARD PRINT LAB</div>
            <h2 className="mt-0.5 font-serif text-[17px] font-normal tracking-[0.06em] text-[#fff8ee] sm:text-[19px]">
              冲印专属明信片
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭明信片预览"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/75 transition hover:border-signal/60 hover:text-signal"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_320px] md:overflow-hidden">
          {/* 实时明信片画布预览 */}
          <div className="relative flex min-h-[340px] flex-col items-center justify-center bg-[#070e1f] p-4 sm:p-6 md:min-h-0 md:overflow-y-auto">
            {activeCard ? (
              <div className="relative flex max-h-full max-w-full flex-col items-center">
                <img
                  src={activeCard.url}
                  alt={`${packet.title} 明信片`}
                  className="max-h-[60dvh] w-auto rounded-xl border border-white/10 object-contain shadow-[0_24px_70px_-20px_rgba(0,0,0,0.92)] select-auto md:max-h-[70dvh]"
                  style={{ WebkitTouchCallout: 'default' }}
                />
                {busy && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[#070e1f]/55 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 rounded-full border border-signal/35 bg-[#0d172e]/90 px-4 py-1.5 font-serif text-[12px] text-signal">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-signal/30 border-t-signal" />
                      正在重新显影…
                    </div>
                  </div>
                )}
              </div>
            ) : errorText ? (
              <div className="rounded-2xl border border-ember/35 bg-ember/10 px-5 py-4 text-center font-serif text-[13px] text-[#ffd4c4]">
                {errorText}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-signal/25 border-t-signal" />
                <div className="mt-3 font-serif text-[13px] tracking-[0.06em] text-white/75">
                  正在显影明信片…
                </div>
              </div>
            )}
            <p className="mt-3 text-center font-sans text-[11px] text-white/45">
              1800 × 2300 高清 PNG · 微信或手机浏览器可直接长按图片保存到相册
            </p>
          </div>

          {/* 版式、色调与印章定制栏 */}
          <aside className="flex shrink-0 flex-col justify-between gap-4 border-t border-white/10 bg-[#0c162d]/85 p-4 sm:p-5 md:border-l md:border-t-0 md:overflow-y-auto">
            <div className="space-y-4">
              <div>
                <div className="font-serif text-[12.5px] tracking-[0.04em] text-white/75">选择明信片版式</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {POSTCARD_THEMES.map((item) => {
                    const active = theme === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-signal/70 bg-signal/16 text-[#fff8ee] shadow-[0_8px_20px_-10px_rgba(242,194,139,0.6)]'
                            : 'border-white/12 bg-white/[0.03] text-white/68 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        <div className="font-serif text-[12.5px] font-medium">{item.label}</div>
                        <div className="mt-0.5 text-[10.5px] text-white/48">{item.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="font-serif text-[12.5px] tracking-[0.04em] text-white/75">暗房色调滤镜</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {POSTCARD_TONES.map((item) => {
                    const active = tone === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTone(item.id)}
                        className={`rounded-xl border px-2.5 py-2 font-serif text-[12px] transition ${
                          active
                            ? 'border-signal/65 bg-signal/15 text-[#fff8ee]'
                            : 'border-white/12 bg-white/[0.03] text-white/65 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="font-serif text-[12.5px] tracking-[0.04em] text-white/75">明信片元素</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={showStamp}
                    onClick={() => setShowStamp((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-serif text-[12px] transition ${
                      showStamp
                        ? 'border-signal/60 bg-signal/15 text-signal'
                        : 'border-white/12 bg-white/[0.03] text-white/60 hover:border-white/30'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${showStamp ? 'bg-signal' : 'bg-white/35'}`} />
                    地心航空邮戳
                  </button>
                  {Boolean(whisperText?.trim()) && (
                    <button
                      type="button"
                      aria-pressed={showWhisper}
                      onClick={() => setShowWhisper((v) => !v)}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-serif text-[12px] transition ${
                        showWhisper
                          ? 'border-signal/60 bg-signal/15 text-signal'
                          : 'border-white/12 bg-white/[0.03] text-white/60 hover:border-white/30'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${showWhisper ? 'bg-signal' : 'bg-white/35'}`} />
                      林微低语
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!activeCard}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-signal py-3 font-serif text-[13.5px] font-medium text-[#170f07] shadow-[0_10px_28px_-8px_rgba(242,194,139,0.7)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 17v2a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                下载高清明信片 (PNG)
              </button>

              {(canCopyImage || canSystemShare) && (
                <div className="grid grid-cols-2 gap-2">
                  {canCopyImage && (
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      disabled={!activeCard || copying}
                      className={`rounded-full border border-white/18 bg-white/[0.04] px-3 py-2 font-serif text-[12px] text-white/85 transition hover:border-signal/55 hover:text-signal disabled:opacity-50 ${
                        canSystemShare ? '' : 'col-span-2'
                      }`}
                    >
                      {copying ? '复制中…' : '复制图片'}
                    </button>
                  )}
                  {canSystemShare && (
                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      disabled={!activeCard || sharing}
                      className={`rounded-full border border-white/18 bg-white/[0.04] px-3 py-2 font-serif text-[12px] text-white/85 transition hover:border-signal/55 hover:text-signal disabled:opacity-50 ${
                        canCopyImage ? '' : 'col-span-2'
                      }`}
                    >
                      {sharing ? '调起分享…' : '系统分享'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
