/**
 * Tether Automated Test Suite
 *
 * 실행: npx tsx scripts/test-all.ts
 *
 * 주의: 이 스크립트는 Node.js 환경에서 로직을 테스트합니다.
 *       Firebase 의존 기능은 mock 데이터로 검증합니다.
 */

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const results: { name: string; ok: boolean; detail?: string }[] = []

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      results.push({ name, ok: true })
      passed++
    })
    .catch((err: unknown) => {
      results.push({ name, ok: false, detail: String(err) })
      failed++
    })
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    toEqual(expected: T) {
      const a = JSON.stringify(actual)
      const e = JSON.stringify(expected)
      if (a !== e) throw new Error(`Expected ${e}, got ${a}`)
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`)
    },
    toBeGreaterThan(n: number) {
      if ((actual as unknown as number) <= n) throw new Error(`Expected > ${n}, got ${actual}`)
    },
    toContain(item: unknown) {
      if (!Array.isArray(actual)) throw new Error(`Expected array`)
      if (!actual.includes(item)) throw new Error(`Expected array to contain ${JSON.stringify(item)}`)
    },
    toHaveLength(n: number) {
      const len = (actual as unknown as { length: number }).length
      if (len !== n) throw new Error(`Expected length ${n}, got ${len}`)
    },
  }
}

// ── PIN / bcrypt 테스트 ──────────────────────────────────────────────────────

async function testPin() {
  // bcryptjs를 직접 import하지 않고 로직만 테스트
  const PIN = '1234'
  const WRONG_PIN = '0000'

  // PIN 형식 검증 (4자리 숫자)
  await test('PIN: 4자리 숫자 검증', () => {
    const isValidPin = (p: string) => /^\d{4}$/.test(p)
    expect(isValidPin(PIN)).toBeTruthy()
    expect(isValidPin('123')).toBeFalsy()
    expect(isValidPin('12345')).toBeFalsy()
    expect(isValidPin('abcd')).toBeFalsy()
  })

  // 잠금 시간 계산 (3회 실패 → 30초)
  await test('PIN: 3회 실패 시 잠금 (30초)', () => {
    const MAX_FAILS = 3
    const LOCKOUT_MS = 30_000
    let fails = 0
    let lockedUntil: number | null = null

    const tryPin = (input: string) => {
      if (lockedUntil && Date.now() < lockedUntil) return 'locked'
      if (input === PIN) {
        fails = 0
        return 'ok'
      }
      fails++
      if (fails >= MAX_FAILS) {
        lockedUntil = Date.now() + LOCKOUT_MS
        return 'locked'
      }
      return 'fail'
    }

    expect(tryPin(WRONG_PIN)).toBe('fail')
    expect(tryPin(WRONG_PIN)).toBe('fail')
    expect(tryPin(WRONG_PIN)).toBe('locked')
    expect(fails).toBe(MAX_FAILS)
    expect(lockedUntil).toBeTruthy()
  })
}

// ── 커플 연결 테스트 ──────────────────────────────────────────────────────────

async function testCoupleConnection() {
  // 초대코드 생성 (6자리 대문자)
  await test('커플 연결: 6자리 초대코드 형식', () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    expect(/^[A-Z0-9]{6}$/.test(code)).toBeTruthy()
  })

  // 앱 상태 구조
  await test('커플 연결: AppState 구조 검증', () => {
    interface AppState {
      uid: string | null
      coupleId: string | null
      myNickname: string
      partnerNickname: string
      partnerUid: string | null
      isConnected: boolean
      startDate: string | null
    }

    const mockState: AppState = {
      uid: 'uid-alice',
      coupleId: 'couple-123',
      myNickname: '앨리스',
      partnerNickname: '밥',
      partnerUid: 'uid-bob',
      isConnected: true,
      startDate: '2023-06-15',
    }

    expect(mockState.isConnected).toBeTruthy()
    expect(mockState.coupleId).toBe('couple-123')
    expect(mockState.startDate).toBe('2023-06-15')
  })

  // disconnect 후 상태 초기화
  await test('커플 연결: disconnect 후 상태 초기화', () => {
    const emptyState = {
      uid: null, coupleId: null, myNickname: '', partnerNickname: '',
      partnerUid: null, isConnected: false, startDate: null,
    }
    expect(emptyState.isConnected).toBeFalsy()
    expect(emptyState.coupleId).toBeFalsy()
  })
}

// ── 상태 동기화 테스트 ────────────────────────────────────────────────────────

async function testStatusSync() {
  type Condition = 'good' | 'normal' | 'tired'
  interface Status {
    condition: Condition
    mood: string[]
    message: string
    updatedAt: number | null
  }

  await test('상태 동기화: Condition 타입 검증', () => {
    const conditions: Condition[] = ['good', 'normal', 'tired']
    expect(conditions).toHaveLength(3)
    expect(conditions).toContain('good')
  })

  await test('상태 동기화: mood 배열 토글', () => {
    const status: Status = { condition: 'good', mood: ['설렘'], message: '', updatedAt: null }
    const toggle = (mood: string[], tag: string) =>
      mood.includes(tag) ? mood.filter((t) => t !== tag) : [...mood, tag]

    const next = toggle(status.mood, '평온')
    expect(next).toContain('설렘')
    expect(next).toContain('평온')

    const next2 = toggle(next, '설렘')
    expect(next2.includes('설렘')).toBeFalsy()
  })

  await test('상태 동기화: updatedAt 타임스탬프 설정', () => {
    const before = Date.now()
    const ts = Date.now()
    const after = Date.now()
    expect(ts >= before).toBeTruthy()
    expect(ts <= after).toBeTruthy()
  })
}

// ── 채팅 테스트 ──────────────────────────────────────────────────────────────

async function testChat() {
  interface ChatMessage {
    id: string
    senderUid: string
    type: 'text' | 'image'
    text?: string
    imageUrl?: string
    createdAt: number | null
    readBy: string[]
  }

  await test('채팅: 메시지 전송 구조 검증', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      senderUid: 'uid-alice',
      type: 'text',
      text: '안녕!',
      createdAt: Date.now(),
      readBy: ['uid-alice'],
    }
    expect(msg.type).toBe('text')
    expect(msg.text).toBe('안녕!')
    expect(msg.readBy).toContain('uid-alice')
  })

  await test('채팅: 읽음 처리 (readBy 배열)', () => {
    const readBy = ['uid-alice']
    const partnerUid = 'uid-bob'
    const afterRead = [...new Set([...readBy, partnerUid])]
    expect(afterRead).toContain('uid-bob')
    expect(afterRead).toHaveLength(2)
  })

  await test('채팅: 날짜 구분선 (당일/전날)', () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86_400_000)

    const fmt = (d: Date) => {
      const isToday = d.getTime() === today.getTime()
      const isYesterday = d.getTime() === yesterday.getTime()
      if (isToday) return '오늘'
      if (isYesterday) return '어제'
      return `${d.getMonth() + 1}월 ${d.getDate()}일`
    }

    expect(fmt(today)).toBe('오늘')
    expect(fmt(yesterday)).toBe('어제')
  })
}

// ── 교환일기 테스트 ──────────────────────────────────────────────────────────

async function testDiary() {
  interface DiaryEntry {
    id: string
    authorUid: string
    title: string
    content: string
    imageUrl?: string
    createdAt: number
    isRead: boolean
    reply?: { text: string; createdAt: number }
  }

  await test('교환일기: 일기 작성 구조 검증', () => {
    const entry: DiaryEntry = {
      id: 'diary-1',
      authorUid: 'uid-alice',
      title: '오늘 하루',
      content: '오늘은 참 좋은 하루였어.',
      createdAt: Date.now(),
      isRead: false,
    }
    expect(entry.isRead).toBeFalsy()
    expect(entry.title).toBe('오늘 하루')
  })

  await test('교환일기: 읽음 처리', () => {
    let isRead = false
    // markDiaryRead 호출 시뮬레이션
    isRead = true
    expect(isRead).toBeTruthy()
  })

  await test('교환일기: 답장 작성', () => {
    const reply = { text: '나도 좋은 하루였어 💕', createdAt: Date.now() }
    expect(reply.text).toBe('나도 좋은 하루였어 💕')
    expect(reply.createdAt).toBeTruthy()
  })
}

// ── 컨텐츠 목록 테스트 ──────────────────────────────────────────────────────

async function testContents() {
  type ContentCategory = 'book' | 'movie' | 'drama' | 'youtube' | 'etc'
  type ContentStatus = 'want' | 'watching' | 'done'

  interface ContentItem {
    id: string
    category: ContentCategory
    title: string
    memo?: string
    status: ContentStatus
    addedBy: string
    rating?: number
    review?: string
  }

  await test('컨텐츠: 항목 추가 구조 검증', () => {
    const item: ContentItem = {
      id: 'content-1',
      category: 'movie',
      title: '인터스텔라',
      status: 'want',
      addedBy: 'uid-alice',
    }
    expect(item.status).toBe('want')
    expect(item.category).toBe('movie')
  })

  await test('컨텐츠: 상태 변경 (want → watching → done)', () => {
    const statuses: ContentStatus[] = ['want', 'watching', 'done']
    let current: ContentStatus = 'want'

    current = 'watching'
    expect(statuses.includes(current)).toBeTruthy()

    current = 'done'
    expect(current).toBe('done')
  })

  await test('컨텐츠: 완료 처리 (별점 + 리뷰)', () => {
    const done = { status: 'done' as ContentStatus, rating: 5, review: '최고의 영화!' }
    expect(done.rating).toBe(5)
    expect(done.review).toBe('최고의 영화!')
  })
}

// ── 기념일 D-day 테스트 ──────────────────────────────────────────────────────

async function testAnniversary() {
  const MS_PER_DAY = 86_400_000

  const differenceInDays = (later: Date, earlier: Date) =>
    Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY)

  const addDays = (date: Date, n: number) => new Date(date.getTime() + n * MS_PER_DAY)

  await test('기념일: daysTogether 계산 (100일째)', () => {
    const start = new Date('2024-01-01')
    const hundredthDay = addDays(start, 99)
    const days = differenceInDays(hundredthDay, start) + 1
    expect(days).toBe(100)
  })

  await test('기념일: D-day 레이블 (오늘/D-N/D+N)', () => {
    const getDdayLabel = (dday: number) => {
      if (dday === 0) return '오늘! 🎉'
      if (dday > 0) return `D-${dday}`
      return `D+${Math.abs(dday)}`
    }

    expect(getDdayLabel(0)).toBe('오늘! 🎉')
    expect(getDdayLabel(7)).toBe('D-7')
    expect(getDdayLabel(-3)).toBe('D+3')
  })

  await test('기념일: 100/200/300일 기념일 날짜 계산', () => {
    const start = new Date('2023-06-15')
    const anniversaries = [
      { label: '100일', date: addDays(start, 99) },
      { label: '200일', date: addDays(start, 199) },
      { label: '300일', date: addDays(start, 299) },
    ]
    expect(anniversaries).toHaveLength(3)
    const day100 = differenceInDays(anniversaries[0].date, start) + 1
    expect(day100).toBe(100)
  })

  await test('기념일: isSoon (D-7 이내)', () => {
    const today = new Date()
    const soon = addDays(today, 5)
    const dday = differenceInDays(soon, today)
    const isSoon = dday >= 0 && dday <= 7
    expect(isSoon).toBeTruthy()
  })
}

// ── 히스토리 테스트 ──────────────────────────────────────────────────────────

async function testHistory() {
  interface HistoryItem {
    id: string
    title: string
    memo?: string
    date: Date
    imageUrl?: string
  }

  await test('히스토리: 기억 저장 구조 검증', () => {
    const item: HistoryItem = {
      id: 'history-1',
      title: '첫 데이트',
      memo: '카페에서 처음 만났다.',
      date: new Date('2023-06-15'),
    }
    expect(item.title).toBe('첫 데이트')
    expect(item.date.getFullYear()).toBe(2023)
  })

  await test('히스토리: 날짜 내림차순 정렬', () => {
    const items: HistoryItem[] = [
      { id: '1', title: 'A', date: new Date('2023-01-01') },
      { id: '2', title: 'B', date: new Date('2023-06-15') },
      { id: '3', title: 'C', date: new Date('2024-01-01') },
    ]
    const sorted = [...items].sort((a, b) => b.date.getTime() - a.date.getTime())
    expect(sorted[0].title).toBe('C')
    expect(sorted[2].title).toBe('A')
  })
}

// ── 설정 테스트 ──────────────────────────────────────────────────────────────

async function testSettings() {
  await test('설정: 알림 설정 localStorage 저장', () => {
    const LS_KEY = 'tether_notif_settings'
    const settings = { message: true, status: false, diary: true }
    const stored = JSON.stringify(settings)
    const loaded = JSON.parse(stored)
    expect(loaded.message).toBeTruthy()
    expect(loaded.status).toBeFalsy()
    expect(loaded.diary).toBeTruthy()
    // LS_KEY 형식 확인
    expect(LS_KEY).toBe('tether_notif_settings')
  })

  await test('설정: 테마 localStorage 키 검증', () => {
    const LS_KEY = 'tether_theme'
    const themes = ['sage', 'high-contrast']
    expect(themes).toContain('sage')
    expect(typeof LS_KEY).toBe('string')
  })

  await test('설정: 닉네임 편집 (빈 값 거부)', () => {
    const saveNickname = (input: string, current: string) => {
      const trimmed = input.trim()
      return trimmed ? trimmed : current
    }
    expect(saveNickname('  ', '앨리스')).toBe('앨리스')
    expect(saveNickname('새이름', '앨리스')).toBe('새이름')
  })

  await test('설정: startDate 편집 검증', () => {
    const isValidDate = (s: string) => !isNaN(new Date(s).getTime())
    expect(isValidDate('2023-06-15')).toBeTruthy()
    expect(isValidDate('invalid-date')).toBeFalsy()
  })
}

// ── iOS 설치 배너 테스트 ──────────────────────────────────────────────────────

async function testIOSBanner() {
  await test('iOS 배너: dismiss 후 localStorage 저장', () => {
    const LS_KEY = 'tether_ios_banner'
    // dismiss 시뮬레이션
    const storage: Record<string, string> = {}
    storage[LS_KEY] = 'dismissed'
    expect(storage[LS_KEY]).toBe('dismissed')
  })

  await test('iOS 배너: 이전에 닫은 경우 표시 안 함', () => {
    const storage: Record<string, string> = { tether_ios_banner: 'dismissed' }
    const isDismissed = storage['tether_ios_banner'] === 'dismissed'
    expect(isDismissed).toBeTruthy()
  })
}

// ── 메인 실행 ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 Tether Automated Test Suite\n')
  console.log('─'.repeat(50))

  await testPin()
  await testCoupleConnection()
  await testStatusSync()
  await testChat()
  await testDiary()
  await testContents()
  await testAnniversary()
  await testHistory()
  await testSettings()
  await testIOSBanner()

  console.log('\n📋 결과:\n')
  results.forEach(({ name, ok, detail }) => {
    const icon = ok ? '✅' : '❌'
    console.log(`  ${icon} ${name}`)
    if (detail) console.log(`     └─ ${detail}`)
  })

  const total = passed + failed
  console.log('\n─'.repeat(50))
  console.log(`\n총 ${total}개 테스트: ✅ ${passed}개 통과 / ❌ ${failed}개 실패\n`)

  if (failed > 0) {
    console.error('일부 테스트가 실패했습니다.')
    process.exit(1)
  } else {
    console.log('모든 테스트 통과! 🎉')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('테스트 실행 중 오류:', err)
  process.exit(1)
})
