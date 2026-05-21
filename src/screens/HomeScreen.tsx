import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { MoodChip } from '../components/MoodChip'
import { useStatus, Condition } from '../hooks/useStatus'
import { useApp } from '../context/AppContext'

type Screen = 'home' | 'chat' | 'diary' | 'more'

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void
}

const CONDITION_EMOJI: Record<Condition, string> = { good: '😊', normal: '😐', tired: '😴' }
const CONDITIONS: Condition[] = ['good', 'normal', 'tired']
const MOOD_TAGS = ['설렘', '평온', '힘듦', '보고싶어']

const NAV_ITEMS: { icon: string; label: string; screen: Screen }[] = [
  { icon: 'chat', label: '채팅', screen: 'chat' },
  { icon: 'calendar_month', label: '기념일', screen: 'more' },
  { icon: 'auto_stories', label: '교환일기', screen: 'diary' },
  { icon: 'featured_play_list', label: '컨텐츠', screen: 'more' },
  { icon: 'photo_library', label: '사진첩', screen: 'more' },
  { icon: 'history', label: '히스토리', screen: 'more' },
]

function timeAgo(ts: number | null): string {
  if (!ts) return '방금 전'
  try { return formatDistanceToNow(ts, { addSuffix: true, locale: ko }) }
  catch { return '방금 전' }
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { uid, coupleId, myNickname, partnerNickname, partnerUid } = useApp()
  const { myStatus, partnerStatus, updateMyStatus } = useStatus(coupleId, uid, partnerUid)

  const [editMsg, setEditMsg] = useState(myStatus.message)
  const [isEditingMsg, setIsEditingMsg] = useState(false)

  // 메시지 편집 완료 시 저장
  const handleMsgBlur = () => {
    setIsEditingMsg(false)
    updateMyStatus({ ...myStatus, message: editMsg })
  }

  const toggleCondition = (c: Condition) => {
    updateMyStatus({ ...myStatus, condition: c })
  }

  const toggleMood = (tag: string) => {
    const has = myStatus.mood.includes(tag)
    const next = has ? myStatus.mood.filter((t) => t !== tag) : [...myStatus.mood, tag]
    updateMyStatus({ ...myStatus, mood: next })
  }

  // 외부 업데이트 시 editMsg 동기화
  useEffect(() => {
    if (!isEditingMsg) setEditMsg(myStatus.message)
  }, [myStatus.message, isEditingMsg])

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'

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
          {/* 내 카드 — 인터랙티브 */}
          <div className="bg-[#F5F2EB] rounded-xl p-md shadow-sm flex flex-col items-center text-center space-y-sm border-2 border-primary-container">
            <div className="flex items-center gap-xs">
              <span className="font-label-md text-label-md text-on-surface">{myName}</span>
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>

            {/* 컨디션 이모지 토글 */}
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

            {/* 기분 태그 토글 */}
            <div className="flex flex-wrap justify-center gap-xs">
              {MOOD_TAGS.map((tag) => (
                <button key={tag} onClick={() => toggleMood(tag)}>
                  <MoodChip label={tag} active={myStatus.mood.includes(tag)} />
                </button>
              ))}
            </div>

            {/* 한줄 메시지 */}
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

          {/* 파트너 카드 — 읽기 전용 */}
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

        {/* D-day card */}
        <section className="relative overflow-hidden rounded-xl bg-surface-container-highest p-lg h-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary-container/20" />
          <div className="relative z-10">
            <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest mb-xs">Today's memory</p>
            <h3 className="font-headline-md text-headline-md text-on-surface">함께한 지 1,245일째</h3>
          </div>
        </section>
      </main>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  )
}
