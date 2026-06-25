// src/hooks/useStatusOptions.ts
// 상태 태그와 빠른 상태 메시지 옵션을 Firestore 설정과 기본값으로 병합한다.
import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export const DEFAULT_STATUS_TAGS = [
  '설렘', '평온', '힘듦', '보고싶어', '행복', '기쁨', '고마움', '슬픔', '우울', '화남',
  '바쁨', '혼자만의 시간', '공부중', '독서중',
  '집중중', '노는중', '삐짐', '질투중', '멍함', '눈치보는중', '욕구불만', '예민함',
  '생리중', '외로움', '기다림', '충만함',
]

export const DEFAULT_QUICK_STATUS_MESSAGES = [
  '바쁨',
  '혼자만의 시간',
  '공부중',
  '독서중',
]

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80)
}

function unique(items: string[]): string[] {
  return [...new Set(items)]
}

export function useStatusOptions() {
  const [extraTags, setExtraTags] = useState<string[]>([])

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'adminConfig', 'statusOptions'),
      (snap) => {
        const data = snap.data() ?? {}
        setExtraTags(sanitizeList(data.extraTags))
      },
      (error) => {
        console.warn('[useStatusOptions] config listener failed', error)
        setExtraTags([])
      },
    )
    return () => unsub()
  }, [])

  return useMemo(() => ({
    tags: unique([...DEFAULT_STATUS_TAGS, ...extraTags]),
    quickMessages: DEFAULT_QUICK_STATUS_MESSAGES,
  }), [extraTags])
}
