import { useRef, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { FONT_FAMILY_OPTIONS, FONT_SCALE_OPTIONS, type FontScale, useFontScale } from '../hooks/useFontScale'
import { APP_VERSION_LABEL } from '../lib/appVersion'
import { useBiometric } from '../hooks/useBiometric'
import { usePinAuth } from '../hooks/usePinAuth'
import { useApp } from '../context/AppContext'
import { canRequestPushPermission, usePushNotification, NotificationSettings } from '../hooks/usePushNotification'
import { useSession } from '../context/SessionContext'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { disconnectCouple, updateUserNickname, updateUserProfilePhoto } from '../lib/coupleAuth'

interface SettingsScreenProps {
  onBack: () => void
  onChangePin?: () => void
  onDisconnect?: () => void
  onOpenAnniversary?: () => void
}

const PREVIEW_SIZES: Record<FontScale, string> = {
  S: '14px',
  M: '16px',
  L: '20px',
}

// ── 연결 해제 확인 다이얼로그 ────────────────────────────────────────────────
interface ConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  error?: string
}

function DisconnectConfirmDialog({ onConfirm, onCancel, loading, error }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-margin-mobile">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-xl">
        <div className="flex flex-col items-center text-center gap-md mb-xl">
          <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              link_off
            </span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-xs">연결 해제</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              정말 연결을 해제할까요?<br />
              채팅·일기·사진 데이터는 유지되지만<br />
              상대방과의 실시간 연결이 끊깁니다.
            </p>
            {error && <p className="mt-sm font-label-sm text-label-sm text-error">{error}</p>}
          </div>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-md rounded-full border border-outline-variant font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-md rounded-full bg-error text-on-error font-label-md text-label-md active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? '해제 중...' : '연결 해제'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsScreen({ onBack, onChangePin, onDisconnect, onOpenAnniversary }: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const { scale, setScale, fontFamily, setFontFamily } = useFontScale()
  const bio = useBiometric()
  const { clearPin } = usePinAuth()
  const {
    uid, myNickname, partnerNickname, myPhotoUrl, startDate,
    disconnect, setStartDate, setMyNickname, setPartnerNickname, setMyPhotoUrl,
  } = useApp()
  const { user, linkGoogle, isGoogleLinked } = useSession()
  const push = usePushNotification(uid)

  const [bioEnabled, setBioEnabled] = useState(() => bio.isRegistered())
  const [bioLoading, setBioLoading] = useState(false)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => push.loadSettings())
  const [pushGranted, setPushGranted] = useState(() => push.isGranted())
  const [googleLinking, setGoogleLinking] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState('')

  // 커플 정보 편집
  const [editingMyNick, setEditingMyNick] = useState(false)
  const [myNickInput, setMyNickInput] = useState(myNickname)
  const [editingPartnerNick, setEditingPartnerNick] = useState(false)
  const [partnerNickInput, setPartnerNickInput] = useState(partnerNickname)
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState(() => startDate ?? new Date().toISOString().split('T')[0])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)

  // 연결 해제 확인 다이얼로그
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)

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

  const handleDisconnectConfirm = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    setDisconnectError('')
    try {
      await disconnectCouple()
      setShowDisconnectDialog(false)
      disconnect()
      onDisconnect?.()
    } catch (err) {
      console.warn('[SettingsScreen] disconnect couple failed', err)
      setDisconnectError('연결 해제에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleNotifToggle = async (key: keyof NotificationSettings) => {
    const next = { ...notifSettings, [key]: !notifSettings[key] }
    setNotifSettings(next)
    await push.saveSettings(next)
  }

  const handleRequestPush = async () => {
    if (!canRequestPushPermission()) return
    const result = await push.requestPermission()
    if (result === 'granted') setPushGranted(true)
  }

  const handleGoogleLink = async () => {
    setGoogleLinking(true)
    setGoogleError('')
    try {
      await linkGoogle()
    } catch {
      setGoogleError('Google 계정 연결을 완료하지 못했어요.')
    } finally {
      setGoogleLinking(false)
    }
  }

  const handleSaveMyNick = async () => {
    const trimmed = myNickInput.trim()
    if (trimmed) {
      setMyNickname(trimmed)
      if (uid) {
        try {
          await updateUserNickname(uid, trimmed)
        } catch (err) {
          console.warn('[SettingsScreen] update nickname failed', err)
        }
      }
    } else {
      setMyNickInput(myNickname)
    }
    setEditingMyNick(false)
  }

  const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !uid || photoUploading) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('이미지 파일만 업로드할 수 있어요.')
      return
    }

    setPhotoUploading(true)
    setPhotoError('')
    try {
      const nextUrl = await updateUserProfilePhoto(uid, file)
      setMyPhotoUrl(nextUrl)
    } catch (err) {
      console.warn('[SettingsScreen] profile photo upload failed', err)
      setPhotoError('프로필 사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleSavePartnerNick = () => {
    const trimmed = partnerNickInput.trim()
    if (trimmed) setPartnerNickname(trimmed)
    else setPartnerNickInput(partnerNickname)
    setEditingPartnerNick(false)
  }

  const handleSaveDate = () => {
    if (dateInput) setStartDate(dateInput)
    setEditingDate(false)
  }

  return (
    <SubScreen>
      <ScreenHeader
        title="설정"
        onBack={onBack}
        right={(
          <ProfileAvatar src={myPhotoUrl} name={myNickname} size="md" />
        )}
      />

      <main className="sub-screen-body w-full px-margin-mobile py-lg pb-xxl">

        {/* 커플 정보 */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            커플 정보
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between gap-md p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md min-w-0">
                <ProfileAvatar src={myPhotoUrl} name={myNickname} size="lg" />
                <div className="min-w-0">
                  <p className="font-body-md text-body-md text-on-surface">프로필 사진</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    채팅과 게시글에 표시돼요
                  </p>
                  {photoError && (
                    <p className="font-label-sm text-label-sm text-error mt-xs">{photoError}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => profilePhotoInputRef.current?.click()}
                disabled={photoUploading || !uid}
                className="min-h-[50px] px-md rounded-full bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-50 active:scale-95 transition-transform"
              >
                {photoUploading ? '업로드 중' : '변경'}
              </button>
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePhotoChange}
              />
            </div>

            {/* 내 닉네임 */}
            <div className="flex items-center justify-between p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">person</span>
                <span className="font-body-md text-body-md">내 닉네임</span>
              </div>
              {editingMyNick ? (
                <div className="flex items-center gap-sm">
                  <input
                    autoFocus
                    value={myNickInput}
                    onChange={(e) => setMyNickInput(e.target.value.slice(0, 12))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMyNick(); if (e.key === 'Escape') setEditingMyNick(false) }}
                    className="w-28 bg-surface-container-highest rounded-lg px-sm py-xs font-body-md text-body-md text-on-surface outline-none text-right"
                  />
                  <button onClick={handleSaveMyNick} className="text-primary">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setMyNickInput(myNickname); setEditingMyNick(true) }}
                  className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="font-label-md text-label-md">{myNickname || '미설정'}</span>
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              )}
            </div>

            {/* 파트너 닉네임 */}
            <div className="flex items-center justify-between p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">favorite</span>
                <span className="font-body-md text-body-md">파트너 닉네임</span>
              </div>
              {editingPartnerNick ? (
                <div className="flex items-center gap-sm">
                  <input
                    autoFocus
                    value={partnerNickInput}
                    onChange={(e) => setPartnerNickInput(e.target.value.slice(0, 12))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePartnerNick(); if (e.key === 'Escape') setEditingPartnerNick(false) }}
                    className="w-28 bg-surface-container-highest rounded-lg px-sm py-xs font-body-md text-body-md text-on-surface outline-none text-right"
                  />
                  <button onClick={handleSavePartnerNick} className="text-primary">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setPartnerNickInput(partnerNickname); setEditingPartnerNick(true) }}
                  className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="font-label-md text-label-md">{partnerNickname || '미설정'}</span>
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              )}
            </div>

            {/* 처음 만난 날 */}
            <div className="flex items-center justify-between p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">calendar_heart</span>
                <span className="font-body-md text-body-md">처음 만난 날</span>
              </div>
              {editingDate ? (
                <div className="flex items-center gap-sm">
                  <input
                    type="date"
                    autoFocus
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDate(); if (e.key === 'Escape') setEditingDate(false) }}
                    className="bg-surface-container-highest rounded-lg px-sm py-xs font-body-sm text-body-sm text-on-surface outline-none"
                  />
                  <button onClick={handleSaveDate} className="text-primary">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setDateInput(startDate ?? new Date().toISOString().split('T')[0]); setEditingDate(true) }}
                  className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="font-label-md text-label-md">{startDate ?? '미설정'}</span>
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              )}
            </div>

            <button
              onClick={onOpenAnniversary}
              className="w-full flex items-center justify-between p-md hover:bg-surface-container-highest transition-colors text-left"
            >
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">calendar_month</span>
                <span className="font-body-md text-body-md">기념일 관리</span>
              </div>
              <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Account
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
            {isGoogleLinked ? (
              <div className="flex items-center justify-between p-md">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <div>
                    <p className="font-body-md text-body-md text-on-surface">Google 계정 연결됨</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{user?.email ?? '이 계정으로 동기화 중'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGoogleLink}
                disabled={googleLinking}
                className="w-full flex items-center justify-between gap-md p-md hover:bg-surface-container-highest transition-colors text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-secondary">sync</span>
                  <div>
                    <p className="font-body-md text-body-md text-on-surface">Google 계정 연결</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      어떤 기기에서든 동일 데이터로 접속할 수 있어요
                    </p>
                    {googleError && <p className="font-label-sm text-label-sm text-error mt-xs">{googleError}</p>}
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
              </button>
            )}
          </div>
        </section>

        {/* Appearance */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Appearance
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
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
                <span className="font-body-md text-body-md">폰트 크기</span>
              </div>
              <div className="settings-font-scale bg-surface-container-highest p-1 rounded-lg flex justify-between">
                {FONT_SCALE_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setScale(id)}
                    className={`settings-font-scale-option flex-1 py-xs text-label-sm font-label-sm font-bold transition-colors ${
                      scale === id ? 'settings-font-scale-option--active bg-white shadow-sm rounded-md' : ''
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="mt-md p-lg rounded-xl border text-center transition-all duration-300"
                style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
              >
                <p
                  className="text-primary font-medium"
                  style={{ fontSize: PREVIEW_SIZES[scale], fontFamily: 'var(--app-font-family)' }}
                >
                  안녕, 오늘 뭐해? 💕
                </p>
              </div>
            </div>

            {/* Font Family */}
            <div className="p-md border-t border-outline-variant/20">
              <div className="flex items-center gap-md mb-md">
                <span className="material-symbols-outlined text-secondary">text_fields</span>
                <span className="font-body-md text-body-md">폰트 선택</span>
              </div>
              <div className="grid grid-cols-1 gap-sm">
                {FONT_FAMILY_OPTIONS.map((option) => {
                  const selected = fontFamily === option.id
                  return (
                  <button
                    key={option.id}
                    onClick={() => setFontFamily(option.id)}
                    aria-pressed={selected}
                    className={`settings-font-option min-h-[50px] rounded-xl border px-md py-sm text-left transition-colors flex items-center gap-sm ${
                      selected
                        ? 'settings-font-option--active border-primary bg-primary-container/20 text-primary'
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface'
                    }`}
                    style={{ fontFamily: option.css }}
                  >
                    <span className="font-body-md text-body-md flex-1">{option.label}</span>
                    <span className="text-label-sm font-label-sm opacity-70">안녕, 오늘 뭐해?</span>
                    {selected && (
                      <span className="settings-font-option-check material-symbols-outlined shrink-0 text-primary" aria-hidden="true">
                        check_circle
                      </span>
                    )}
                  </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Notifications
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
            {/* 권한 미허용 배너 */}
            {!pushGranted && canRequestPushPermission() && (
              <button
                onClick={handleRequestPush}
                className="w-full flex items-center gap-md p-md border-b border-outline-variant/20 bg-secondary-container/30 hover:bg-secondary-container/50 transition-colors text-left min-h-[50px]"
              >
                <span className="material-symbols-outlined text-secondary">notifications_off</span>
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-on-surface">알림이 꺼져 있어요</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">탭해서 허용하기</p>
                </div>
                <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
              </button>
            )}
            {(
              [
                { icon: 'chat_bubble', label: '메시지', key: 'message' as const },
                { icon: 'favorite', label: '상태 변경', key: 'status' as const },
                { icon: 'auto_stories', label: '교환일기', key: 'diary' as const },
              ] as const
            ).map(({ icon, label, key }, i, arr) => {
              const on = notifSettings[key]
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-md ${i < arr.length - 1 ? 'border-b border-outline-variant/20' : ''}`}
                >
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-secondary">{icon}</span>
                    <span className="font-body-md text-body-md">{label}</span>
                  </div>
                  <button
                    onClick={() => handleNotifToggle(key)}
                    className="relative inline-flex items-center cursor-pointer min-w-[50px] min-h-[50px] justify-end"
                    aria-label={`${label} 알림 토글`}
                  >
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${on ? 'bg-[#4A7B5F]' : 'bg-outline-variant'}`}>
                      <div className={`absolute top-0.5 bg-white w-5 h-5 rounded-full transition-transform ${on ? 'left-[22px]' : 'left-0.5'}`} />
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Security */}
        <section className="mb-xl">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
            Security
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
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
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between p-md border-b border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-secondary">info</span>
                <span className="font-body-md text-body-md">App info</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{APP_VERSION_LABEL}</span>
            </div>
            <button
              onClick={() => setShowDisconnectDialog(true)}
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

      {/* 연결 해제 확인 다이얼로그 */}
      {showDisconnectDialog && (
        <DisconnectConfirmDialog
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setShowDisconnectDialog(false)}
          loading={disconnecting}
          error={disconnectError}
        />
      )}
    </SubScreen>
  )
}
