import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Soundscape } from './audio/soundscape'
import { voicePlayer } from './audio/voicePlayer'
import { SettingsDrawer } from './components/SettingsDrawer'
import { TopNav } from './components/TopNav'
import { markVisitDay } from './services/journey'
import {
  prefersReducedMotion,
  resetSettings,
  updateSettings,
  useSettings,
} from './services/settings'
import type { ModuleId, Phase } from './types/sensor'
import {
  getCityWhisper,
  loadStoryRelay,
  saveStoryRelay,
  type StoryRelayState,
} from './utils/storyRelay'

const PrologueExperience = lazy(() =>
  import('./components/PrologueExperience').then((m) => ({ default: m.PrologueExperience })),
)
const RadioExperience = lazy(() =>
  import('./components/RadioExperience').then((m) => ({ default: m.RadioExperience })),
)
const PostVisionStudio = lazy(() =>
  import('./components/PostVisionStudio').then((m) => ({ default: m.PostVisionStudio })),
)
const SignalReceiver = lazy(() =>
  import('./components/SignalReceiver').then((m) => ({ default: m.SignalReceiver })),
)

function ChannelLoading() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-[#070b14] px-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-signal/20 animate-[pulseRing_2.6s_ease-out_infinite]" />
        <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_20px_rgba(242,194,139,0.85)] animate-[blinkDot_1.8s_ease-in-out_infinite]" />
      </div>
      <div className="mt-5 font-mono text-[10px] tracking-[0.28em] text-signal/75">
        TUNING NEUTRINO CHANNEL
      </div>
      <div className="mt-2 font-serif text-[13px] font-light tracking-[0.08em] text-white/65">
        正在接通传感频段…
      </div>
    </div>
  )
}

function readSignalCode() {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('signal')?.trim() ?? ''
  return /^[A-Za-z0-9]{2,24}$/.test(raw) ? raw.toUpperCase() : null
}

function removeSignalFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('signal')) return
  url.searchParams.delete('signal')
  window.history.replaceState({}, '', url)
}

export default function App() {
  const settings = useSettings()
  const [sound] = useState(() => new Soundscape())
  const [module, setModule] = useState<ModuleId>(() => (readSignalCode() ? 'radio' : 'prologue'))
  const [navHistory, setNavHistory] = useState<ModuleId[]>([])
  const [prologuePhase, setProloguePhase] = useState<Phase>('ritual')
  const [prologueExitTick, setPrologueExitTick] = useState(0)
  const [muted, setMuted] = useState(false)
  const [signalCode, setSignalCode] = useState<string | null>(readSignalCode)
  const [radioFocusCode, setRadioFocusCode] = useState<string | null>(null)
  const [radioAutoOpen, setRadioAutoOpen] = useState(false)
  const [relay, setRelay] = useState<StoryRelayState>(() => loadStoryRelay())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [systemReducedMotion, setSystemReducedMotion] = useState(prefersReducedMotion)

  const updateRelay = useCallback((patch: Partial<StoryRelayState>) => {
    setRelay((prev) => {
      const next: StoryRelayState = {
        ...prev,
        ...patch,
        cluesFound: patch.cluesFound
          ? [...new Set(patch.cluesFound)].slice(0, 8)
          : prev.cluesFound,
        relayedCities: patch.relayedCities
          ? [...new Set(patch.relayedCities)].slice(0, 24)
          : prev.relayedCities,
        memories: patch.memories ? patch.memories.slice(-6) : prev.memories,
      }
      saveStoryRelay(next)
      return next
    })
  }, [])

  const recordCityRelay = useCallback((city: string) => {
    const clean = city.trim()
    if (!clean) return
    setRelay((prev) => {
      const nextCities = prev.relayedCities.includes(clean)
        ? prev.relayedCities
        : [...prev.relayedCities, clean].slice(0, 24)
      const nextWhisper = getCityWhisper(clean)
      if (nextCities === prev.relayedCities && prev.lastCityWhisper === nextWhisper) return prev
      const next: StoryRelayState = {
        ...prev,
        relayedCities: nextCities,
        lastCityWhisper: nextWhisper,
      }
      saveStoryRelay(next)
      return next
    })
  }, [])

  useEffect(() => {
    markVisitDay()
  }, [])

  useEffect(() => {
    sound.setActive(module === 'prologue' && !signalCode)
    voicePlayer.stop()
  }, [module, signalCode, sound])

  useEffect(() => {
    voicePlayer.setMuted(muted)
  }, [muted])

  useEffect(() => {
    return () => {
      sound.dispose()
      voicePlayer.stop()
    }
  }, [sound])

  useEffect(() => {
    sound.setMasterVolume(settings.masterVolume)
    sound.setAmbienceVolume(settings.ambienceVolume)
    sound.setSfxVolume(settings.sfxVolume)
  }, [sound, settings.masterVolume, settings.ambienceVolume, settings.sfxVolume])

  useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setSystemReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const calmMotion = settings.reducedMotion || systemReducedMotion

  const clearSignal = () => {
    removeSignalFromUrl()
    setSignalCode(null)
  }

  const navigate = (next: ModuleId) => {
    clearSignal()
    setRadioFocusCode(null)
    setRadioAutoOpen(false)
    if (next !== module) {
      setNavHistory((prev) => [...prev, module].slice(-8))
    }
    setModule(next)
  }

  const goHome = () => {
    clearSignal()
    setRadioFocusCode(null)
    setRadioAutoOpen(false)
    setNavHistory([])
    setModule('prologue')
    setPrologueExitTick((tick) => tick + 1)
  }

  const goBack = () => {
    if (signalCode) {
      clearSignal()
      return
    }
    if (module !== 'prologue') {
      if (navHistory.length > 0) {
        const previous = navHistory[navHistory.length - 1]
        setNavHistory((prev) => prev.slice(0, -1))
        setRadioFocusCode(null)
        setRadioAutoOpen(false)
        setModule(previous)
      } else {
        setRadioFocusCode(null)
        setRadioAutoOpen(false)
        setModule('prologue')
      }
      return
    }
    if (prologuePhase !== 'ritual') {
      setPrologueExitTick((tick) => tick + 1)
    }
  }

  const enterRadio = (code?: string, autoOpen = false) => {
    clearSignal()
    setRadioFocusCode(code ?? null)
    setRadioAutoOpen(Boolean(code && autoOpen))
    if (module !== 'radio') {
      setNavHistory((prev) => [...prev, module].slice(-8))
    }
    setModule('radio')
  }

  const enterPost = () => {
    clearSignal()
    if (module !== 'post') {
      setNavHistory((prev) => [...prev, module].slice(-8))
    }
    setModule('post')
  }

  const toggleSound = async () => {
    const next = !muted
    if (!next) {
      try {
        await sound.unlock()
        await voicePlayer.unlock()
      } catch {
        /* browser may keep audio suspended until a later gesture */
      }
    }
    sound.setMuted(next)
    voicePlayer.setMuted(next)
    setMuted(next)
  }

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-[#070b14] text-[#eef1f8]"
      data-motion={calmMotion ? 'calm' : 'full'}
      data-flash-safe={settings.flashSafe || calmMotion ? 'on' : 'off'}
    >
      <Suspense fallback={<ChannelLoading />}>
        {signalCode ? (
          <SignalReceiver
            key={signalCode}
            code={signalCode}
            muted={muted}
            onEnterRadio={enterRadio}
            onEnterPost={enterPost}
            onRecordCity={recordCityRelay}
          />
        ) : (
          <>
            {module === 'prologue' && (
              <PrologueExperience
                sound={sound}
                active
                onNavigate={navigate}
                relay={relay}
                onRelayUpdate={updateRelay}
                onPhaseChange={setProloguePhase}
                onListenEcho={(code) => enterRadio(code, true)}
                flashSafe={settings.flashSafe}
                onToggleFlashSafe={() =>
                  updateSettings({ flashSafe: !settings.flashSafe, flashNoticeSeen: true })
                }
                exitSignal={prologueExitTick}
              />
            )}
            {module === 'radio' && (
              <RadioExperience
                muted={muted}
                focusCode={radioFocusCode}
                autoOpenFocus={radioAutoOpen}
                relay={relay}
                onRecordCity={recordCityRelay}
                onBack={goBack}
                onCompose={() => navigate('post')}
              />
            )}
            {module === 'post' && (
              <PostVisionStudio
                muted={muted}
                relay={relay}
                onRelayCity={recordCityRelay}
                onBack={goBack}
                onOpenRadio={(code) => enterRadio(code, false)}
              />
            )}
          </>
        )}
      </Suspense>

      <TopNav
        module={module}
        onModuleChange={navigate}
        muted={muted}
        onToggleSound={toggleSound}
        onOpenSettings={() => setSettingsOpen(true)}
        canGoBack={Boolean(signalCode) || module !== 'prologue' || prologuePhase !== 'ritual'}
        onBack={goBack}
        onGoHome={goHome}
      />
      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        relay={relay}
        systemReducedMotion={systemReducedMotion}
        onChange={updateSettings}
        onReset={resetSettings}
        onClose={() => setSettingsOpen(false)}
      />
      <div className="grain-overlay" aria-hidden="true" />
    </div>
  )
}