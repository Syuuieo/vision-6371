import { useEffect, useRef, useState } from 'react'
import { APP_VERSION, CHANGELOG } from '../data/changelog'
import { clearAlbum, getAlbumCount } from '../services/albumStorage'
import { milestones, useJourney } from '../services/journey'
import type { QualityTier, VisionSettings } from '../services/settings'
import { localSignalCount } from '../services/localVisionStats'
import type { StoryRelayState } from '../utils/storyRelay'

interface SettingsDrawerProps {
  open: boolean
  settings: VisionSettings
  relay: StoryRelayState
  systemReducedMotion: boolean
  onChange: (patch: Partial<VisionSettings>) => void
  onReset: () => void
  onClose: () => void
  onOpenAdmin?: () => void
}

const QUALITY_OPTIONS: { id: QualityTier; label: string; hint: string }[] = [
  { id: 'auto', label: '自动', hint: '按设备性能选择' },
  { id: 'full', label: '全开', hint: '最高像素比与粒子量' },
  { id: 'lite', label: '省电', hint: '降低像素比与粒子量' },
]

function VolumeRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
}) {
  const percent = Math.round(value * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-[13px] tracking-[0.04em] text-white/85">{label}</span>
        <span className="hud-value text-[11px] text-signal/85">{percent}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="settings-range mt-2 w-full"
      />
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-white/40">{hint}</p>}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-signal/40"
    >
      <span className="min-w-0">
        <span className="block font-serif text-[13px] tracking-[0.04em] text-white/85">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? 'border-signal/60 bg-signal/28' : 'border-white/18 bg-white/[0.06]'
        }`}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
            checked ? 'left-[calc(100%-1.25rem)] bg-signal' : 'left-1 bg-white/55'
          }`}
        />
      </span>
    </button>
  )
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="hud-label text-signal/70">{index}</span>
      <span className="font-serif text-[14px] tracking-[0.1em] text-[#fff6ea]">{title}</span>
      <span className="cinema-rule-cool ml-1 flex-1" />
    </div>
  )
}

export function SettingsDrawer({
  open,
  settings,
  relay,
  systemReducedMotion,
  onChange,
  onReset,
  onClose,
  onOpenAdmin,
}: SettingsDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const journey = useJourney()
  const [clearArmed, setClearArmed] = useState(false)
  const [clearedNote, setClearedNote] = useState<string | null>(null)

  const handleClose = () => {
    setClearArmed(false)
    setClearedNote(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setClearArmed(false)
        setClearedNote(null)
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const albumCount = getAlbumCount()
  const localVisions = localSignalCount()
  const badges = milestones(journey, relay)
  const earned = badges.filter((badge) => badge.done).length

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#04070f]/74 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="设置与关于"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div className="cinema-surface no-scrollbar max-h-[calc(100dvh-2.5rem)] w-full max-w-[560px] overflow-y-auto rounded-[26px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="hud-label text-signal/75">SETTINGS · 风信</div>
            <h2 className="mt-1.5 font-serif text-[19px] font-normal tracking-[0.08em] text-[#fff6ea]">
              设置与关于
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            aria-label="关闭设置"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/75 transition hover:border-signal/55 hover:text-signal"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <section className="mt-5 space-y-4">
          <SectionTitle index="01" title="声音" />
          <VolumeRow
            label="主音量"
            value={settings.masterVolume}
            onChange={(value) => onChange({ masterVolume: value })}
          />
          <VolumeRow
            label="环境声"
            hint="序章音景与视野环境声的整体比例，仍受工坊内滑杆微调。"
            value={settings.ambienceVolume}
            onChange={(value) => onChange({ ambienceVolume: value })}
          />
          <VolumeRow
            label="人声"
            hint="林微与序章语音配音，以及电台与视野里的现场录音回放。"
            value={settings.voiceVolume}
            onChange={(value) => onChange({ voiceVolume: value })}
          />
          <VolumeRow
            label="心跳与音效"
            value={settings.sfxVolume}
            onChange={(value) => onChange({ sfxVolume: value })}
          />
        </section>

        <section className="mt-6 space-y-3">
          <SectionTitle index="02" title="画面" />
          <div className="flex gap-1.5 rounded-full border border-white/12 bg-white/[0.03] p-1">
            {QUALITY_OPTIONS.map((option) => {
              const active = settings.quality === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChange({ quality: option.id })}
                  aria-pressed={active}
                  className={`flex-1 rounded-full px-3 py-2 font-serif text-[12.5px] tracking-[0.06em] transition ${
                    active
                      ? 'bg-signal font-medium text-[#170f07]'
                      : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-white/45">
            {QUALITY_OPTIONS.find((option) => option.id === settings.quality)?.hint}
            ｜像素精度立即生效，粒子密度在下次进入序章时生效。
          </p>
        </section>

        <section className="mt-6 space-y-2.5">
          <SectionTitle index="03" title="动效与光敏" />
          <ToggleRow
            label="减弱动效"
            hint="停止漂浮、呼吸、颗粒与入场动画，保留全部内容与交互。"
            checked={settings.reducedMotion || systemReducedMotion}
            onChange={(next) => onChange({ reducedMotion: next })}
          />
          {systemReducedMotion && (
            <p className="text-[11px] leading-relaxed text-signal/70">
              系统已开启「减弱动效」，此开关始终生效。
            </p>
          )}
          <ToggleRow
            label="闪烁抑制"
            hint="把全屏闪光、雪花抖动与色差 glitch 降为静态低亮度，适合光敏性体质。"
            checked={settings.flashSafe}
            onChange={(next) => onChange({ flashSafe: next })}
          />
          <ToggleRow
            label="视野随指针轻微视差"
            hint="开启后，电台视野会随指针轻微偏移；容易晕车或眩晕的话保持关闭更舒服。"
            checked={settings.parallax}
            onChange={(next) => onChange({ parallax: next })}
          />
        </section>

        <section className="mt-6 space-y-3">
          <SectionTitle index="04" title="旅程" />
          <p className="text-[11px] leading-relaxed text-white/45">
            这台设备上已点亮 {earned} / {badges.length} 枚印记，只保存在本机，不上传。
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-2xl border px-3.5 py-3 ${
                  badge.done
                    ? 'border-signal/35 bg-signal/[0.07]'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-serif text-[13px] tracking-[0.04em] ${
                      badge.done ? 'text-[#fff6ea]' : 'text-white/50'
                    }`}
                  >
                    {badge.title}
                  </span>
                  <span
                    className={`hud-value shrink-0 text-[10px] ${
                      badge.done ? 'text-signal/85' : 'text-white/35'
                    }`}
                  >
                    {badge.progress}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40">{badge.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-serif text-[12.5px] text-[#fff6ea]">本机存储</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  纪念册 {albumCount} 帧 · 本机封存视野 {localVisions} 条（大图优先转存 IndexedDB）
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {clearArmed ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setClearArmed(false)}
                      className="rounded-full border border-white/16 px-2.5 py-1 font-serif text-[11px] text-white/65 hover:text-white"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          window.localStorage.removeItem('vision6371_drift_inbox_v1')
                        } catch {
                          /* ignore */
                        }
                        clearAlbum()
                        setClearArmed(false)
                        setClearedNote('已清空本机纪念册与缓存')
                      }}
                      className="rounded-full border border-ember/55 bg-ember/15 px-3 py-1 font-serif text-[11px] text-[#ffb9ac] hover:bg-ember/25"
                    >
                      确认清空
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={albumCount === 0}
                    onClick={() => setClearArmed(true)}
                    className="rounded-full border border-white/15 px-3 py-1 font-serif text-[11px] text-white/70 transition hover:border-ember/50 hover:text-[#ffb9ac] disabled:opacity-40"
                  >
                    清空本机纪念册
                  </button>
                )}
              </div>
            </div>
            {clearedNote && (
              <div className="mt-2 font-serif text-[11.5px] text-signal">{clearedNote}</div>
            )}
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <SectionTitle index="05" title="关于" />
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-serif text-[15px] tracking-[0.08em] text-[#fff6ea]">
                风信 · Windpost
              </div>
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="rounded-full border border-white/12 px-2.5 py-0.5 font-serif text-[11px] text-white/48 transition hover:border-signal/45 hover:text-signal"
                >
                  站长后台
                </button>
              )}
            </div>
            <div className="hud-value mt-1 text-[11px] text-signal/80">版本 {APP_VERSION}</div>
            <p className="mt-3 text-[12px] leading-relaxed text-white/60">
              灵感致敬 · 刘慈欣《带上她的眼睛》。故事、台词与视觉均为原创，仅借用「带上她的眼睛」这一意象。
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              云端可用时，视野与心跳同步到 Qoder Sites；不可用时静默使用本地演示数据，不会向访客弹出错误。
            </p>
          </div>

          <div className="space-y-3">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[13px] tracking-[0.06em] text-white/85">
                    {entry.version} · {entry.title}
                  </span>
                  <span className="hud-value shrink-0 text-[10px] text-white/40">{entry.date}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {entry.items.map((item) => (
                    <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-white/55">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5">
          <button type="button" onClick={onReset} className="btn-ghost">
            恢复默认
          </button>
          <button type="button" onClick={handleClose} className="btn-primary">
            完成
          </button>
        </div>
      </div>
    </div>
  )
}