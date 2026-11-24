import { useEffect } from 'react'
import { EASTER_EGGS, QUOTES } from '../data/narrative'
import type { ActId, EggId } from '../types/sensor'
import type { MemoryFrame } from '../utils/memoryStripExport'

interface FieldJournalModalProps {
  open: boolean
  cluesFound: string[]
  eggsFound: EggId[]
  memories?: MemoryFrame[]
  act?: ActId
  onClose: () => void
}

const CLUE_ENTRIES = [
  {
    id: 'no-weather',
    actLabel: '第 I 幕 · 06:40',
    label: QUOTES.flower.clue?.label ?? '线索 I · “窗外没有天气”',
    excerpt: QUOTES.flower.lines[1],
    hint: '拨开清晨大雾，对焦草甸第一朵金红野花',
  },
  {
    id: 'hull-groan',
    actLabel: '第 II 幕 · 09:30',
    label: QUOTES.wind.clue?.label ?? '线索 II · “深处传来金属低鸣”',
    excerpt: QUOTES.wind.lines[0],
    hint: '行至碧湖浅滩，轻划湖面或调谐风声频段',
  },
  {
    id: 'no-direction',
    actLabel: '第 III 幕 · 13:15',
    label: QUOTES.dandelion.clue?.label ?? '线索 III · “船舱里没有上下”',
    excerpt: QUOTES.dandelion.lines[1],
    hint: '走上正午孤树山坡，吹散满坡蒲公英',
  },
  {
    id: 'neutrino-12',
    actLabel: '第 VI 幕 · 19:45',
    label: QUOTES.fireflies.clue?.label ?? '线索 IV · “中微子信标余量 12%”',
    excerpt: QUOTES.fireflies.lines[0],
    hint: '暮色降临时靠近渡口木舟，点亮草叶间的流萤',
  },
] as const

const EGG_HINTS: Record<EggId, string> = {
  bottle: '湖畔渡口下游浅滩边，留意水面微光漂浮的玻璃瓶',
  tablet: '山腰石拱圣所一侧斜坡上，寻访野花环绕的风化石碑',
  meteor: '第 VII 幕 22:30 入夜后仰望天穹，点住划过星海的流星',
}

export function FieldJournalModal({
  open,
  cluesFound,
  eggsFound,
  memories = [],
  act,
  onClose,
}: FieldJournalModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-[#030712]/58 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="草原传感观测手账"
      onClick={onClose}
    >
      <div
        className="cinema-surface animate-fade-up no-scrollbar relative max-h-[86dvh] w-full max-w-[660px] overflow-y-auto rounded-[26px] p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_12px_rgba(242,194,139,0.9)]" />
              <span className="hud-label text-signal/85">FIELD JOURNAL · 传感观测手账</span>
            </div>
            <h2 className="mt-1.5 font-serif text-[21px] font-light tracking-[0.08em] text-[#fff8ee] sm:text-[23px]">
              替她收好的风声与异常回响
            </h2>
            <p className="mt-1 font-serif text-[12px] tracking-[0.04em] text-white/58">
              {act ? `当前第 ${act} 幕 · ` : ''}已捕获叙事伏笔 {cluesFound.length}/4 · 草原奇物 {eggsFound.length}/3
              {memories.length > 0 ? ` · 胶片 ${memories.length} 帧` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭观测手账"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/14 bg-white/[0.05] px-3 py-1.5 font-serif text-[12px] text-white/75 transition hover:border-signal/55 hover:text-signal"
          >
            <span className="cinema-kbd">ESC</span>
            <span>收起</span>
          </button>
        </div>

        <div className="cinema-rule my-4" />

        {/* 4 枚地核异常叙事线索 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-[13px] tracking-[0.12em] text-signal/90">
              异常通联伏笔 ({cluesFound.length}/4)
            </h3>
            <span className="font-mono text-[10px] tracking-[0.16em] text-white/38">SUNSET-06 LOG</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {CLUE_ENTRIES.map((clue) => {
              const found = cluesFound.includes(clue.id)
              return (
                <div
                  key={clue.id}
                  className={`rounded-2xl border p-3.5 transition ${
                    found
                      ? 'border-signal/35 bg-signal/[0.06]'
                      : 'border-white/10 bg-white/[0.025]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`cinema-gem h-2 w-2 ${
                          found
                            ? 'bg-signal shadow-[0_0_10px_rgba(242,194,139,0.85)]'
                            : 'border border-white/35 bg-transparent'
                        }`}
                      />
                      <span className="font-mono text-[10px] tracking-[0.12em] text-white/48">{clue.actLabel}</span>
                    </div>
                    <span className={`font-serif text-[10.5px] ${found ? 'text-signal/85' : 'text-white/35'}`}>
                      {found ? '已记录' : '待发现'}
                    </span>
                  </div>
                  <p className={`mt-2 font-serif text-[13px] tracking-[0.04em] ${found ? 'text-[#fff8ee]' : 'text-white/55'}`}>
                    {found ? clue.label : '未解封通联片段'}
                  </p>
                  <p className={`mt-1.5 font-serif text-[12px] leading-[1.7] ${found ? 'text-white/74' : 'text-white/42'}`}>
                    {found ? clue.excerpt : clue.hint}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <div className="cinema-rule-cool my-5" />

        {/* 3 枚草原隐藏彩蛋 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-[13px] tracking-[0.12em] text-signal/90">
              草原遗留奇物 ({eggsFound.length}/3)
            </h3>
            <span className="font-mono text-[10px] tracking-[0.16em] text-white/38">EASTER ECHOES</span>
          </div>
          <div className="space-y-2.5">
            {(['bottle', 'tablet', 'meteor'] as const).map((id) => {
              const found = eggsFound.includes(id)
              const egg = EASTER_EGGS[id]
              return (
                <div
                  key={id}
                  className={`rounded-2xl border p-3.5 transition ${
                    found
                      ? 'border-white/18 bg-white/[0.045]'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`cinema-gem h-2.5 w-2.5 ${found ? '' : 'border border-white/30 bg-transparent'}`}
                        style={
                          found
                            ? { backgroundColor: egg.accent, boxShadow: `0 0 12px ${egg.accent}` }
                            : undefined
                        }
                      />
                      <span className="font-serif text-[13.5px] tracking-[0.05em] text-[#fff8ee]">
                        {found ? egg.title : egg.kicker}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.12em] text-white/45">
                      {found ? 'COLLECTED' : 'UNSEEN'}
                    </span>
                  </div>
                  {found ? (
                    <div className="mt-2 space-y-1 pl-5">
                      {egg.lines.map((line) => (
                        <p key={line} className="font-serif text-[12.5px] leading-[1.75] text-white/75">
                          {line}
                        </p>
                      ))}
                      <p className="pt-1 font-mono text-[10px] tracking-[0.14em] text-white/42">{egg.signature}</p>
                    </div>
                  ) : (
                    <p className="mt-1.5 pl-5 font-serif text-[12px] leading-[1.7] text-white/45">
                      方位提示：{EGG_HINTS[id]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 已定格的记忆胶片 */}
        {memories.length > 0 && (
          <>
            <div className="cinema-rule-cool my-5" />
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="font-serif text-[13px] tracking-[0.12em] text-signal/90">
                  今日已显影胶片 ({memories.length} 帧)
                </h3>
                <span className="font-serif text-[11px] text-white/45">可带往第 03 章制作明信片</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {memories.map((frame) => (
                  <div
                    key={`${frame.act}-${frame.title}`}
                    className="overflow-hidden rounded-lg border border-white/14 bg-black/40"
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
            </section>
          </>
        )}
      </div>
    </div>
  )
}
