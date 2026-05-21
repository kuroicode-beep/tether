import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { useFontScale } from '../hooks/useFontScale'
import { useBiometric } from '../hooks/useBiometric'
import { usePinAuth } from '../hooks/usePinAuth'
import { useApp } from '../context/AppContext'

interface SettingsScreenProps {
  onBack: () => void
  onChangePin?: () => void
  onDisconnect?: () => void
}

type FontScale = 'S' | 'M' | 'L' | 'XL'
const FONT_SCALES: FontScale[] = ['S', 'M', 'L', 'XL']

const PREVIEW_SIZES: Record<FontScale, string> = {
  S: '12px',
  M: '16px',
  L: '20px',
  XL: '24px',
}

export function SettingsScreen({ onBack, onChangePin, onDisconnect }: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const { scale, setScale } = useFontScale()
  const bio = useBiometric()
  const { clearPin } = usePinAuth()
  const { disconnect } = useApp()
  const [bioEnabled, setBioEnabled] = useState(() => bio.isRegistered())
  const [bioLoading, setBioLoading] = useState(false)

  const handleBioToggle = async () => {
    if (bioLoading) return
    setBioLoading(true)
    if (bioEnabled) {
      bio.unregister()
      setBioEnabled(false)
    } else {
      const ok = await bio.register()
      if (ok) setBioEnabled(true)
    }
    setBioLoading(false)
  }

  const handleChangePin = () => {
    clearPin()
    onChangePin?.()
  }

  const handleDisconnect = () => {
    disconnect()
    onDisconnect?.()
  }

  return (
    <div className="bg-background text-on-background min-h-screen pb-xxl">
      {/* Header */}
      <header className="w-full top-0 sticky z-40 bg-surface flex justify-between items-center px-margin-mobile py-sm">
        <div className="flex items-center gap-md">
          <button
            onClick={onBack}
            className="material-symbols-outlined text-primary hover:bg-surface-container rounded-full p-xs transition-colors duration-200"
          >
            arrow_back
          </button>
          <h1 className="font-headline-md text-headline-md font-semibold text-primary">Settings</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">person</span>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-margin-mobile mt-lg">
        {/* Appearance */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Appearance
          </h2>
          <div className="bg-surface-container rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(49,98,72,0.04)' }}>
            {/* Theme */}
            <div className="flex items-center justify-between p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">palette</span>
                <span className="font-body-md text-body-md">Theme Selection</span>
              </div>
              <div className="flex gap-sm">
                <button
                  onClick={() => setTheme('sage')}
                  className={`w-10 h-10 rounded-full border-2 bg-[#4A7B5F] flex items-center justify-center transition-transform active:scale-90 ${
                    theme === 'sage' ? 'border-primary' : 'border-outline-variant'
                  }`}
                >
                  {theme === 'sage' && (
                    <span
                      className="material-symbols-outlined text-white text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTheme('high-contrast')}
                  className={`w-10 h-10 rounded-full border-2 bg-[#1f1b13] transition-transform active:scale-90 ${
                    theme === 'high-contrast' ? 'border-primary' : 'border-outline-variant'
                  }`}
                >
                  {theme === 'high-contrast' && (
                    <span
                      className="material-symbols-outlined text-white text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div className="p-md bg-surface-container-low/50">
              <div className="flex items-center gap-md mb-md">
                <span className="material-symbols-outlined text-secondary">format_size</span>
                <span className="font-body-md text-body-md">Text Size</span>
              </div>
              <div className="bg-surface-container-highest p-1 rounded-lg flex justify-between">
                {FONT_SCALES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`flex-1 py-xs text-label-sm font-label-sm font-bold transition-colors ${
                      scale === s ? 'bg-white shadow-sm rounded-md' : ''
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-md p-lg bg-surface-container-lowest rounded-xl border border-outline-variant/10 text-center transition-all duration-300">
                <p
                  className="text-primary font-medium"
                  style={{ fontSize: PREVIEW_SIZES[scale] }}
                >
                  안녕, 오늘 뭐해? 💕
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Notifications
          </h2>
          <div className="bg-surface-container rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(49,98,72,0.04)' }}>
            {[
              { icon: 'chat_bubble', label: '메시지', defaultOn: true },
              { icon: 'favorite', label: '상태 변경', defaultOn: true },
              { icon: 'auto_stories', label: '교환일기', defaultOn: false },
            ].map(({ icon, label, defaultOn }, i, arr) => (
              <div
                key={label}
                className={`flex items-center justify-between p-md ${i < arr.length - 1 ? 'border-b border-outline-variant/20' : ''}`}
              >
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-secondary">{icon}</span>
                  <span className="font-body-md text-body-md">{label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={defaultOn}
                    className="sr-only toggle-checkbox"
                    onChange={() => {}}
                  />
                  <div className={`toggle-label w-11 h-6 rounded-full transition-colors relative ${defaultOn ? 'bg-[#4A7B5F]' : 'bg-outline-variant'}`}>
                    <div className={`toggle-dot absolute top-0.5 bg-white w-5 h-5 rounded-full transition-transform ${defaultOn ? 'left-[22px]' : 'left-0.5'}`} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Security
          </h2>
          <div className="bg-surface-container rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(49,98,72,0.04)' }}>
            <button
              onClick={handleChangePin}
              className="w-full flex items-center justify-between p-md border-b border-outline-variant/20 hover:bg-surface-container-highest transition-colors text-left"
            >
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">lock</span>
                <span className="font-body-md text-body-md">PIN 변경</span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </button>
            {bio.isSupported() && (
              <div className="flex items-center justify-between p-md">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-secondary">fingerprint</span>
                  <span className="font-body-md text-body-md">생체인증</span>
                </div>
                <button
                  onClick={handleBioToggle}
                  disabled={bioLoading}
                  className="relative inline-flex items-center cursor-pointer disabled:opacity-50"
                  aria-label="생체인증 토글"
                >
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${bioEnabled ? 'bg-[#4A7B5F]' : 'bg-outline-variant'}`}>
                    <div className={`absolute top-0.5 bg-white w-5 h-5 rounded-full transition-transform ${bioEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </div>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Misc */}
        <section className="mb-xxl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Misc
          </h2>
          <div className="bg-surface-container rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(49,98,72,0.04)' }}>
            <div className="flex items-center justify-between p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">info</span>
                <span className="font-body-md text-body-md">App info</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">v 0.1.0</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-between p-md hover:bg-error-container/10 transition-colors text-left group"
            >
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-error">link_off</span>
                <span className="font-body-md text-body-md text-error font-semibold">연결 해제</span>
              </div>
              <span className="material-symbols-outlined text-error/40 group-hover:text-error transition-colors">
                warning
              </span>
            </button>
          </div>
          <p className="text-center text-label-sm font-label-sm text-on-surface-variant mt-lg opacity-60">
            Created with love for you and your partner.
          </p>
        </section>
      </main>
    </div>
  )
}
