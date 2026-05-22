import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { MoodChip } from '../components/MoodChip'
import { AnniversaryCard } from '../components/AnniversaryCard'
import { useStatus, Condition } from '../hooks/useStatus'
import { useApp } from '../context/AppContext'

interface HomeScreenProps {
  onNavigate: (screen: string) => void
}

const CONDITION_EMOJI: Record<Condition, string> = { good: '😊', normal: '😐', tired: '😴' }
const CONDITIONS: Condition[] = ['good', 'normal', 'tired']
const MOOD_TAGS = ['설렘', '평온', '힘듦', '보고싶어']

const NAV_ITEMS: { icon: string; label: string; screen: string }[] = [
  { icon: 'chat',              label: '채팅',     screen: 'chat' },
  { icon: 'calendar_month',   label: '기념일',   screen: 'anniversary' },
  { icon: 'auto_stories',     label: '교환일기', screen: 'diary' },
  { icon: 'featured_play_list', label: '컨텐츠', screen: 'contents' },
  { icon: 'photo_library',    label: '사진첩',   screen: 'photo' },
  { icon: 'history',          label: '히스토리', screen: 'history' },
]

function timeAgo(ts: number | null): string {
  if (!ts) return '방금 전'
  try { return formatDistanceToNow(ts, { addSuffix: true, locale: ko }) }
  catch { return '방금 전' }
}

// 기본 시작 날짜 (startDate 없을 때 처음 만난 날 설정 UI를 보여줌)
function parseStartDate(iso: string | null): Date {
  if (!iso) return new Date('2023-01-01') // 데모 기본값
  return new Date(iso)
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { uid, coupleId, myNickname, partnerNickname, partnerUid, startDate, setStartDate } = useApp()
  const { myStatus, partnerStatus, updateMyStatus } = useStatus(coupleId, uid, partnerUid)

  const [editMsg, setEditMsg] = useState(myStatus.message)
  const [isEditingMsg, setIsEditingMsg] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateInput, setDateInput] = useState(() =>
    startDate ?? new Date('2023-01-01').toISOString().split('T')[0],
  )

  const handleMsgBlur = () => {
    setIsEditingMsg(false)
    updateMyStatus({ ...myStatus, message: editMsg })
  }

  const toggleCondition = (c: Condition) => updateMyStatus({ ...myStatus, condition: c })

  const toggleMood = (tag: string) => {
    const has = myStatus.mood.includes(tag)
    const next = has ? myStatus.mood.filter((t) => t !== tag) : [...myStatus.mood, tag]
    updateMyStatus({ ...myStatus, mood: next })
  }

  useEffect(() => {
    if (!isEditingMsg) setEditMsg(myStatus.message)
  }, [myStatus.message, isEditingMsg])

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'
  const computedStartDate = parseStartDate(startDate)

  return (
    <div className="min-h-screen text-on-surface pb-32">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-surface flex justify-between items-center px-margin-mobile py-sm z-50">
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">Tether</h1>
        <button
          className="p-xs hover:bg-surface-container transition-colors duration-200 rounded-full"
          onClick={() => onNavigate('more')}
        >
          <span className="material-symbols-outlined text-primary">settings</span>
        </button>
      </header>

      <main className="max-w-md mx-auto px-margin-mobile space-y-lg pt-lg">
        {/* Status Cards */}
        <section className="grid grid-cols-2 gap-gutter">
          {/* 내 카드 */}
          <div className="bg-[#F5F2EB] rounded-xl p-md shadow-sm flex flex-col items-center text-center space-y-sm border-2 border-primary-container">
            <div className="flex items-center gap-xs">
              <span className="font-label-md text-label-md text-on-surface">{myName}</span>
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
            <div className="flex justify-around w-full py-xs">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCondition(c)}
                  className={`text-xl p-xs transition-all ${myStatus.condition === c ? 'scale-110' : 'grayscale opacity-50 hover:grayscale-0 hover:opacity-80'}`}
                >
                  {CONDITION_EMOJI[c]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-xs">
              {MOOD_TAGS.map((tag) => (
                <button key={tag} onClick={() => toggleMood(tag)}>
                  <MoodChip label={tag} active={myStatus.mood.includes(tag)} />
                </button>
              ))}
            </div>
            {isEditingMsg ? (
              <input
                autoFocus
                value={editMsg}
                onChange={(e) => setEditMsg(e.target.value.slice(0, 30))}
                onBlur={handleMsgBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleMsgBlur()}
                maxLength={30}
                className="w-full text-center font-label-md text-label-md text-on-surface-variant bg-transparent border-b border-primary/40 outline-none h-10 text-[12px]"
              />
            ) : (
              <button
                onClick={() => setIsEditingMsg(true)}
                className="font-label-md text-on-surface-variant leading-tight h-10 flex items-center text-center w-full justify-center text-[12px] hover:text-on-surface transition-colors"
              >
                {myStatus.message || <span className="opacity-40">한줄 메시지...</span>}
              </button>
            )}
            <span className="font-label-sm text-[10px] text-outline-variant">{timeAgo(myStatus.updatedAt)}</span>
          </div>

          {/* 파트너 카드 */}
          <div className="bg-[#F5F2EB] rounded-xl p-md shadow-sm flex flex-col items-center text-center space-y-sm border border-transparent">
            <div className="flex items-center gap-xs">
              <span className="font-label-md text-label-md text-on-surface">{partnerName}</span>
              <div className="w-2 h-2 rounded-full bg-outline-variant" />
            </div>
            <div className="flex justify-around w-full py-xs">
              <div className="text-xl p-xs">{CONDITION_EMOJI[partnerStatus.condition]}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-xs">
              {(partnerStatus.mood.length > 0 ? partnerStatus.mood : ['—']).map((tag) => (
                <MoodChip key={tag} label={tag} active={tag !== '—'} />
              ))}
            </div>
            <p className="font-label-md text-on-surface-variant leading-tight h-10 flex items-center text-center text-[12px]">
              {partnerStatus.message || '아직 메시지가 없어요'}
            </p>
            <span className="font-label-sm text-[10px] text-outline-variant">{timeAgo(partnerStatus.updatedAt)}</span>
          </div>
        </section>

        {/* Tether Line */}
        <div className="py-sm">
          <div className="h-1 w-full bg-gradient-to-r from-primary to-primary-container rounded-full opacity-30" />
        </div>

        {/* Quick Nav Grid */}
        <section className="bg-[#F5F2EB] rounded-xl p-lg shadow-sm">
          <div className="grid grid-cols-3 gap-y-xl gap-x-gutter">
            {NAV_ITEMS.map(({ icon, label, screen }) => (
              <button
                key={label}
                onClick={() => onNavigate(screen)}
                className="flex flex-col items-center gap-xs group"
              >
                <div className="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* D-day 기념일 카드 */}
        <div>
          <AnniversaryCard startDate={computedStartDate} />
          {/* 처음 만난 날 설정 */}
          {!startDate && (
            <button
              onClick={() => setShowDatePicker(true)}
              className="w-full mt-sm font-label-sm text-label-sm text-on-surface-variant/60 hover:text-primary transition-colors"
            >
              처음 만난 날을 설정해보세요 📅
            </button>
          )}
          {showDatePicker && (
            <div className="mt-sm flex gap-sm items-center">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="flex-1 bg-surface-container rounded-xl px-md py-sm font-body-md text-body-md text-on-surface outline-none"
              />
              <button
                onClick={() => { setStartDate(dateInput); setShowDatePicker(false) }}
                className="px-lg py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md active:scale-95 transition-transform"
              >
                저장
              </button>
            </div>
          )}
        </div>
      </main>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  )
}
