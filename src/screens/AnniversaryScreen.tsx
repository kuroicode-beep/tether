import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Anniversary,
  AnniversaryType,
  useAnniversaries,
} from '../hooks/useAnniversaries'
import { useApp } from '../context/AppContext'

interface AnniversaryScreenProps {
  onBack: () => void
}

type EditingMode = 'add' | 'edit'

const TYPE_OPTIONS: Array<{
  type: AnniversaryType
  label: string
  icon: string
  yearly: boolean
}> = [
  { type: 'first_met', label: '첫 만난 날', icon: 'favorite', yearly: false },
  { type: 'birthday_me', label: '내 생일', icon: 'cake', yearly: true },
  { type: 'birthday_partner', label: '상대방 생일', icon: 'celebration', yearly: true },
  { type: 'custom', label: '직접 입력', icon: 'auto_awesome', yearly: false },
]

const todayIso = () => new Date().toISOString().split('T')[0]

function formatDate(date: string) {
  try {
    return format(new Date(`${date}T00:00:00`), 'yyyy년 M월 d일 (EEE)', { locale: ko })
  } catch {
    return date
  }
}

interface EditSheetProps {
  mode: EditingMode
  initial?: Anniversary
  myName: string
  partnerName: string
  onSave: (data: Omit<Anniversary, 'id'> | Anniversary) => void
  onDelete?: (anniversary: Anniversary) => void
  onClose: () => void
}

function defaultLabel(type: AnniversaryType, myName: string, partnerName: string) {
  if (type === 'first_met') return '첫 만난 날'
  if (type === 'birthday_me') return `${myName} 생일`
  if (type === 'birthday_partner') return `${partnerName} 생일`
  return ''
}

function EditSheet({ mode, initial, myName, partnerName, onSave, onDelete, onClose }: EditSheetProps) {
  const [type, setType] = useState<AnniversaryType>(initial?.type ?? 'first_met')
  const selected = TYPE_OPTIONS.find((item) => item.type === type) ?? TYPE_OPTIONS[0]
  const [label, setLabel] = useState(initial?.label ?? defaultLabel(type, myName, partnerName))
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [isYearly, setIsYearly] = useState(initial?.isYearly ?? selected.yearly)

  const selectType = (nextType: AnniversaryType) => {
    const option = TYPE_OPTIONS.find((item) => item.type === nextType) ?? TYPE_OPTIONS[0]
    setType(nextType)
    setIsYearly(option.yearly)
    setLabel(defaultLabel(nextType, myName, partnerName))
  }

  const handleSave = () => {
    const nextLabel = label.trim() || defaultLabel(type, myName, partnerName) || '기념일'
    const payload = { type, label: nextLabel, date, isYearly }
    onSave(initial ? { ...payload, id: initial.id } : payload)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        className="app-fixed-x fixed bottom-0 z-50 rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--color-surface)' }}
      >
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
        <h2 className="font-headline-md text-headline-md text-on-surface mb-lg">
          {mode === 'add' ? '기념일 추가' : '기념일 수정'}
        </h2>

        <div className="grid grid-cols-2 gap-sm mb-lg">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => selectType(option.type)}
              className="rounded-xl p-md text-left border transition-colors"
              style={{
                background: type === option.type ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                borderColor: type === option.type ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            >
              <span className="material-symbols-outlined text-primary block mb-xs">{option.icon}</span>
              <span className="font-label-md text-label-md text-on-surface">{option.label}</span>
            </button>
          ))}
        </div>

        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">이름</label>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          disabled={type !== 'custom'}
          placeholder="기념일 이름"
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none mb-sm disabled:opacity-70"
        />

        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">날짜</label>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface outline-none mb-md"
        />

        <button
          onClick={() => setIsYearly((value) => !value)}
          className="w-full flex items-center justify-between rounded-xl px-lg py-md mb-lg"
          style={{ background: 'var(--color-surface-2)' }}
        >
          <span className="font-body-md text-body-md text-on-surface">매년 반복</span>
          <span
            className="relative inline-flex w-11 h-6 rounded-full transition-colors"
            style={{ background: isYearly ? 'var(--color-primary)' : 'var(--color-border)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: isYearly ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </span>
        </button>

        <div className="space-y-sm">
          <button
            onClick={handleSave}
            className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md active:scale-95 transition-transform"
          >
            저장
          </button>
          {initial && onDelete && (
            <button
              onClick={() => onDelete(initial)}
              className="w-full py-md font-label-md text-label-md text-error"
            >
              삭제
            </button>
          )}
          <button onClick={onClose} className="w-full py-md font-label-md text-label-md text-on-surface-variant">
            취소
          </button>
        </div>
      </div>
    </>
  )
}

export function AnniversaryScreen({ onBack }: AnniversaryScreenProps) {
  const { coupleId, myNickname, partnerNickname } = useApp()
  const {
    anniversaries,
    firstMet,
    upcoming,
    getDday,
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
  } = useAnniversaries(coupleId)
  const [editing, setEditing] = useState<{ mode: EditingMode; item?: Anniversary } | null>(null)

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'

  const hasItems = anniversaries.length > 0
  const shownUpcoming = useMemo(() => upcoming.slice(0, 12), [upcoming])

  const handleSave = async (data: Omit<Anniversary, 'id'> | Anniversary) => {
    if ('id' in data) await updateAnniversary(data)
    else await addAnniversary(data)
    setEditing(null)
  }

  const handleDelete = async (anniversary: Anniversary) => {
    await removeAnniversary(anniversary)
    setEditing(null)
  }

  return (
    <div
      className="min-h-screen pb-28"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      <header
        className="w-full top-0 sticky z-40 flex items-center gap-md px-margin-mobile py-sm"
        style={{ background: 'var(--color-surface)' }}
      >
        <button
          onClick={onBack}
          className="p-xs rounded-full hover:bg-surface-container transition-colors"
          style={{ color: 'var(--color-text)' }}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md font-semibold text-primary flex-1">기념일</h1>
        <button
          onClick={() => setEditing({ mode: 'add' })}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-sm active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </header>

      <main className="max-w-[600px] mx-auto px-margin-mobile pt-lg space-y-lg">
        {firstMet ? (
          <button
            onClick={() => setEditing({ mode: 'edit', item: firstMet })}
            className="w-full rounded-2xl p-xl text-left shadow-sm active:scale-[0.99] transition-transform"
            style={{ background: 'var(--color-surface)' }}
          >
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                favorite
              </span>
              <span className="font-label-md text-label-md text-primary font-semibold">첫 만난 날</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mb-xs">{formatDate(firstMet.date)}</p>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              함께한 지 {getDday(firstMet)} 🌿
            </h2>
          </button>
        ) : (
          <div className="rounded-2xl p-xl text-center shadow-sm" style={{ background: 'var(--color-surface)' }}>
            <span className="material-symbols-outlined text-[56px] text-primary/40 mb-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              calendar_heart
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">첫 만난 날을 입력해보세요 💕</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
              홈 화면에서 함께한 날을 바로 볼 수 있어요
            </p>
            <button
              onClick={() => setEditing({ mode: 'add' })}
              className="px-xl py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md active:scale-95 transition-transform"
            >
              첫 만난 날 입력
            </button>
          </div>
        )}

        {shownUpcoming.length > 0 && (
          <section>
            <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest px-sm mb-sm">
              Upcoming
            </h2>
            <div className="space-y-sm">
              {shownUpcoming.map(({ item, dday }) => (
                <button
                  key={item.id}
                  onClick={() => setEditing({ mode: 'edit', item })}
                  className="w-full rounded-xl p-md flex items-center gap-md text-left shadow-sm active:scale-[0.99] transition-transform"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-primary-dim)' }}
                  >
                    <span className="material-symbols-outlined text-primary">
                      {item.type === 'custom' ? 'auto_awesome' : 'cake'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-semibold truncate">{item.label}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{formatDate(item.date)}</p>
                  </div>
                  <span className={`font-label-md text-label-md font-bold ${dday >= 0 && dday <= 7 ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {getDday(item)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!hasItems && (
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
            생일, 여행, 첫 데이트 같은 날도 추가할 수 있어요.
          </p>
        )}
      </main>

      <button
        onClick={() => setEditing({ mode: 'add' })}
        className="app-fixed-fab fixed w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center active:scale-90 transition-transform"
        style={{ bottom: 'var(--fab-bottom-offset)' }}
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {editing && (
        <EditSheet
          mode={editing.mode}
          initial={editing.item}
          myName={myName}
          partnerName={partnerName}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
