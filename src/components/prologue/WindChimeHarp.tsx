import { useCallback, useEffect, useRef, useState } from 'react'

export type ChimeTimbre = 'bell' | 'piano'

export interface WindChimeHarpProps {
  open: boolean
  onClose: () => void
  onPlayNote: (noteIndex: number, freq: number, colorHex: string, timbre: ChimeTimbre) => void
  docked?: boolean
}

interface HarpNote {
  index: number
  pitch: string
  freq: number
  solfege: string
  octave: 'low' | 'mid' | 'high'
  keyLabel: string
  code: string
  colorHex: string
}

interface AutoMelody {
  id: 'morning_dew' | 'windpost_echo' | 'starry_sunset'
  title: string
  notes: readonly { note: number; delayMs: number }[]
}

const HARP_NOTES: readonly HarpNote[] = [
  { index: 0, pitch: 'C4', freq: 261.63, solfege: '1', octave: 'low', keyLabel: 'A', code: 'KeyA', colorHex: '#8ec8ff' },
  { index: 1, pitch: 'D4', freq: 293.66, solfege: '2', octave: 'low', keyLabel: 'S', code: 'KeyS', colorHex: '#99cdff' },
  { index: 2, pitch: 'E4', freq: 329.63, solfege: '3', octave: 'low', keyLabel: 'D', code: 'KeyD', colorHex: '#a7d3ff' },
  { index: 3, pitch: 'G4', freq: 392.0, solfege: '5', octave: 'low', keyLabel: 'F', code: 'KeyF', colorHex: '#b9d7f8' },
  { index: 4, pitch: 'A4', freq: 440.0, solfege: '6', octave: 'low', keyLabel: 'G', code: 'KeyG', colorHex: '#d0d2e2' },
  { index: 5, pitch: 'C5', freq: 523.25, solfege: '1', octave: 'mid', keyLabel: 'H', code: 'KeyH', colorHex: '#e2cab6' },
  { index: 6, pitch: 'D5', freq: 587.33, solfege: '2', octave: 'mid', keyLabel: 'J', code: 'KeyJ', colorHex: '#ecc59c' },
  { index: 7, pitch: 'E5', freq: 659.25, solfege: '3', octave: 'mid', keyLabel: 'K', code: 'KeyK', colorHex: '#f2c28b' },
  { index: 8, pitch: 'F5', freq: 698.46, solfege: '4', octave: 'mid', keyLabel: 'L', code: 'KeyL', colorHex: '#f6cb9a' },
  { index: 9, pitch: 'G5', freq: 783.99, solfege: '5', octave: 'mid', keyLabel: 'Q', code: 'KeyQ', colorHex: '#fad4aa' },
  { index: 10, pitch: 'A5', freq: 880.0, solfege: '6', octave: 'mid', keyLabel: 'W', code: 'KeyW', colorHex: '#ffe2bd' },
  { index: 11, pitch: 'B5', freq: 987.77, solfege: '7', octave: 'mid', keyLabel: 'E', code: 'KeyE', colorHex: '#f4ddb8' },
  { index: 12, pitch: 'C6', freq: 1046.5, solfege: '1', octave: 'high', keyLabel: 'R', code: 'KeyR', colorHex: '#e3d9d6' },
  { index: 13, pitch: 'D6', freq: 1174.66, solfege: '2', octave: 'high', keyLabel: 'T', code: 'KeyT', colorHex: '#d3d6ec' },
  { index: 14, pitch: 'E6', freq: 1318.51, solfege: '3', octave: 'high', keyLabel: 'Y', code: 'KeyY', colorHex: '#c4d4ff' },
]

const NOTE_BY_CODE = new Map<string, HarpNote>(HARP_NOTES.map((item) => [item.code, item]))

const AUTO_MELODIES: readonly AutoMelody[] = [
  {
    id: 'morning_dew',
    title: '草原晨露',
    notes: [
      { note: 5, delayMs: 0 },
      { note: 7, delayMs: 360 },
      { note: 9, delayMs: 720 },
      { note: 12, delayMs: 1120 },
      { note: 10, delayMs: 1580 },
      { note: 9, delayMs: 1960 },
      { note: 7, delayMs: 2380 },
      { note: 6, delayMs: 2900 },
      { note: 7, delayMs: 3260 },
      { note: 9, delayMs: 3640 },
      { note: 14, delayMs: 4080 },
      { note: 13, delayMs: 4540 },
      { note: 12, delayMs: 4940 },
      { note: 9, delayMs: 5400 },
      { note: 7, delayMs: 5860 },
      { note: 5, delayMs: 6360 },
    ],
  },
  {
    id: 'windpost_echo',
    title: '风信回声',
    notes: [
      { note: 2, delayMs: 0 },
      { note: 4, delayMs: 340 },
      { note: 5, delayMs: 680 },
      { note: 7, delayMs: 1040 },
      { note: 10, delayMs: 1480 },
      { note: 9, delayMs: 1960 },
      { note: 7, delayMs: 2340 },
      { note: 5, delayMs: 2840 },
      { note: 3, delayMs: 3320 },
      { note: 5, delayMs: 3660 },
      { note: 6, delayMs: 4020 },
      { note: 9, delayMs: 4440 },
      { note: 11, delayMs: 4880 },
      { note: 12, delayMs: 5340 },
      { note: 9, delayMs: 5820 },
      { note: 7, delayMs: 6260 },
      { note: 5, delayMs: 6800 },
    ],
  },
  {
    id: 'starry_sunset',
    title: '星夜落日',
    notes: [
      { note: 14, delayMs: 0 },
      { note: 12, delayMs: 440 },
      { note: 10, delayMs: 880 },
      { note: 9, delayMs: 1320 },
      { note: 7, delayMs: 1860 },
      { note: 8, delayMs: 2320 },
      { note: 7, delayMs: 2740 },
      { note: 6, delayMs: 3180 },
      { note: 5, delayMs: 3720 },
      { note: 4, delayMs: 4220 },
      { note: 3, delayMs: 4680 },
      { note: 5, delayMs: 5140 },
      { note: 9, delayMs: 5620 },
      { note: 12, delayMs: 6140 },
      { note: 7, delayMs: 6680 },
      { note: 5, delayMs: 7260 },
    ],
  },
]

interface LitKeyState {
  nonce: number
  active: boolean
}

export function WindChimeHarp({ open, onClose, onPlayNote, docked = true }: WindChimeHarpProps) {
  const [timbre, setTimbre] = useState<ChimeTimbre>('bell')
  const [playingMelodyId, setPlayingMelodyId] = useState<AutoMelody['id'] | null>(null)
  const [melodyActiveNote, setMelodyActiveNote] = useState<number | null>(null)
  const [litKeys, setLitKeys] = useState<Record<number, LitKeyState>>({})

  const onPlayNoteRef = useRef(onPlayNote)
  const timbreRef = useRef<ChimeTimbre>(timbre)
  const melodyTimersRef = useRef<number[]>([])
  const keyTimersRef = useRef<Map<number, number>>(new Map())
  const pulseNonceRef = useRef(1)

  useEffect(() => {
    onPlayNoteRef.current = onPlayNote
  }, [onPlayNote])

  useEffect(() => {
    timbreRef.current = timbre
  }, [timbre])

  const clearMelodyTimers = useCallback(() => {
    melodyTimersRef.current.forEach((id) => window.clearTimeout(id))
    melodyTimersRef.current = []
  }, [])

  const clearAllTimers = useCallback(() => {
    clearMelodyTimers()
    keyTimersRef.current.forEach((id) => window.clearTimeout(id))
    keyTimersRef.current.clear()
  }, [clearMelodyTimers])

  useEffect(() => {
    if (!open) {
      clearAllTimers()
    }
    return () => {
      clearAllTimers()
    }
  }, [open, clearAllTimers])

  const flashKey = useCallback((noteIndex: number) => {
    const prevTimer = keyTimersRef.current.get(noteIndex)
    if (prevTimer !== undefined) {
      window.clearTimeout(prevTimer)
    }
    const nonce = pulseNonceRef.current++
    setLitKeys((prev) => ({
      ...prev,
      [noteIndex]: { nonce, active: true },
    }))
    const timer = window.setTimeout(() => {
      keyTimersRef.current.delete(noteIndex)
      setLitKeys((prev) => {
        const cur = prev[noteIndex]
        if (!cur || cur.nonce !== nonce) return prev
        return { ...prev, [noteIndex]: { nonce: cur.nonce, active: false } }
      })
    }, 520)
    keyTimersRef.current.set(noteIndex, timer)
  }, [])

  const triggerNote = useCallback(
    (note: HarpNote) => {
      flashKey(note.index)
      onPlayNoteRef.current(note.index, note.freq, note.colorHex, timbreRef.current)
    },
    [flashKey],
  )

  const stopMelody = useCallback(() => {
    clearMelodyTimers()
    setPlayingMelodyId(null)
    setMelodyActiveNote(null)
  }, [clearMelodyTimers])

  const toggleMelody = useCallback(
    (melody: AutoMelody) => {
      if (playingMelodyId === melody.id) {
        stopMelody()
        return
      }
      clearMelodyTimers()
      setPlayingMelodyId(melody.id)
      setMelodyActiveNote(null)

      let lastDelay = 0
      melody.notes.forEach((step) => {
        lastDelay = Math.max(lastDelay, step.delayMs)
        const timer = window.setTimeout(() => {
          const note = HARP_NOTES[step.note]
          if (!note) return
          setMelodyActiveNote(note.index)
          triggerNote(note)
        }, step.delayMs)
        melodyTimersRef.current.push(timer)
      })

      const endTimer = window.setTimeout(() => {
        melodyTimersRef.current = []
        setPlayingMelodyId(null)
        setMelodyActiveNote(null)
      }, lastDelay + 620)
      melodyTimersRef.current.push(endTimer)
    },
    [clearMelodyTimers, playingMelodyId, stopMelody, triggerNote],
  )

  const handleClose = useCallback(() => {
    clearAllTimers()
    setPlayingMelodyId(null)
    setMelodyActiveNote(null)
    onClose()
  }, [clearAllTimers, onClose])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      if (event.code === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        handleClose()
        return
      }
      const note = NOTE_BY_CODE.get(event.code)
      if (!note) return
      event.preventDefault()
      event.stopImmediatePropagation()
      triggerNote(note)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, handleClose, triggerNote])

  if (!open) return null

  const card = (
    <section
      aria-label="草原风铃琴 · 15 键"
      className="cinema-surface pointer-events-auto relative w-full max-w-[680px] overflow-hidden rounded-[24px] border-white/16 px-3.5 py-3 shadow-[0_24px_70px_-24px_rgba(3,8,24,0.92)] sm:px-4 sm:py-3.5"
    >
      {/* Poetic twilight-to-gold luminous top hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, #8ec8ff 18%, #f2c28b 52%, #ffe2bd 72%, #c4d4ff 88%, transparent)',
        }}
      />

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="cinema-gem h-2 w-2 bg-signal shadow-[0_0_10px_rgba(242,194,139,0.9)]" />
          <span className="font-serif text-[13px] font-medium tracking-[0.06em] text-[#fff8ee]">
            草原风铃琴
          </span>
          <span className="hidden font-mono text-[10px] tracking-[0.12em] text-white/45 sm:inline">
            15 KEYS · A–Y
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Timbre toggle */}
          <div
            role="group"
            aria-label="切换音色"
            className="flex items-center rounded-full border border-white/14 bg-[#070f21]/65 p-0.5"
          >
            <button
              type="button"
              onClick={() => setTimbre('bell')}
              aria-pressed={timbre === 'bell'}
              className={`rounded-full px-2.5 py-0.5 font-serif text-[11px] transition ${
                timbre === 'bell'
                  ? 'bg-signal text-[#170f07] font-medium shadow-[0_0_10px_rgba(242,194,139,0.55)]'
                  : 'text-white/65 hover:text-[#fff8ee]'
              }`}
            >
              风铃
            </button>
            <button
              type="button"
              onClick={() => setTimbre('piano')}
              aria-pressed={timbre === 'piano'}
              className={`rounded-full px-2.5 py-0.5 font-serif text-[11px] transition ${
                timbre === 'piano'
                  ? 'bg-signal text-[#170f07] font-medium shadow-[0_0_10px_rgba(242,194,139,0.55)]'
                  : 'text-white/65 hover:text-[#fff8ee]'
              }`}
            >
              钢琴
            </button>
          </div>

          <span className="hidden h-3.5 w-px bg-white/14 sm:inline-block" />

          {/* 3 auto-play melodies */}
          <div className="flex flex-wrap items-center gap-1">
            {AUTO_MELODIES.map((melody) => {
              const isPlaying = playingMelodyId === melody.id
              return (
                <button
                  key={melody.id}
                  type="button"
                  onClick={() => toggleMelody(melody)}
                  aria-pressed={isPlaying}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-serif text-[11px] transition active:scale-95 ${
                    isPlaying
                      ? 'border-signal/75 bg-signal/22 text-signal shadow-[0_0_14px_rgba(242,194,139,0.32)]'
                      : 'border-white/12 bg-white/[0.04] text-white/74 hover:border-signal/45 hover:bg-signal/10 hover:text-[#fff8ee]'
                  }`}
                >
                  <span className="text-[9.5px] leading-none">{isPlaying ? '■' : '♪'}</span>
                  <span>{melody.title}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="收起草原风铃琴"
            className="ml-0.5 rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-0.5 font-serif text-[11px] text-white/68 transition hover:border-signal/50 hover:text-signal active:scale-95"
          >
            收起
          </button>
        </div>
      </div>

      {/* 15 Wind Chime Keys */}
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))] sm:gap-1">
        {HARP_NOTES.map((note) => {
          const lit = litKeys[note.index]
          const isActive = Boolean(lit?.active) || melodyActiveNote === note.index
          const rippleNonce = lit?.nonce ?? 0
          return (
            <button
              key={note.pitch}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault()
                triggerNote(note)
              }}
              aria-label={`弹奏 ${note.pitch}（键位 ${note.keyLabel}）`}
              className="group relative flex h-[66px] select-none flex-col items-center justify-between overflow-hidden rounded-xl border px-1 py-1.5 transition-all duration-150 sm:h-[78px]"
              style={{
                borderColor: isActive ? `${note.colorHex}` : 'rgba(255, 255, 255, 0.13)',
                background: isActive
                  ? `linear-gradient(180deg, ${note.colorHex}40 0%, ${note.colorHex}18 65%, rgba(10,18,36,0.65) 100%)`
                  : `linear-gradient(180deg, ${note.colorHex}16 0%, rgba(12, 22, 44, 0.56) 100%)`,
                boxShadow: isActive
                  ? `0 0 20px -2px ${note.colorHex}85, inset 0 1px 0 rgba(255,255,255,0.45)`
                  : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                transform: isActive ? 'translateY(-3px) scale(1.03)' : undefined,
              }}
            >
              {/* Luminous expanding ripple on trigger */}
              {rippleNonce > 0 && (
                <span
                  key={rippleNonce}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 rounded-full border-2 ripple-burst"
                  style={{
                    borderColor: note.colorHex,
                    boxShadow: `0 0 16px ${note.colorHex}`,
                  }}
                />
              )}

              {/* Chime hanging bead */}
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full transition-transform duration-150 group-hover:scale-125"
                style={{
                  backgroundColor: note.colorHex,
                  boxShadow: isActive ? `0 0 10px ${note.colorHex}` : `0 0 5px ${note.colorHex}90`,
                }}
              />

              {/* Solfège + octave dot */}
              <div className="relative flex flex-col items-center leading-none">
                {note.octave === 'high' && (
                  <span
                    className="mb-0.5 h-1 w-1 rounded-full"
                    style={{ backgroundColor: isActive ? '#ffffff' : note.colorHex }}
                  />
                )}
                <span
                  className="font-serif text-[14px] font-medium transition-colors"
                  style={{ color: isActive ? '#ffffff' : '#fff8ee' }}
                >
                  {note.solfege}
                </span>
                {note.octave === 'low' && (
                  <span
                    className="mt-0.5 h-1 w-1 rounded-full"
                    style={{ backgroundColor: isActive ? '#ffffff' : note.colorHex }}
                  />
                )}
                <span className="mt-0.5 font-mono text-[8.5px] text-white/42">{note.pitch}</span>
              </div>

              {/* Keyboard hint */}
              <span
                className="rounded px-1 font-mono text-[9.5px] leading-[1.35] transition-colors"
                style={{
                  color: isActive ? '#170f07' : 'rgba(255,255,255,0.68)',
                  backgroundColor: isActive ? note.colorHex : 'rgba(255,255,255,0.08)',
                }}
              >
                {note.keyLabel}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )

  if (!docked) return card

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-[35] flex justify-center sm:bottom-[86px]">
      {card}
    </div>
  )
}
