// src/components/ScreenHeader.tsx
// 서브 화면 공통 헤더 (채팅 헤더와 동일 스타일)
import { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  onBack: () => void
  right?: ReactNode
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <button type="button" onClick={onBack} className="screen-header-back" aria-label="뒤로">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="screen-header-title">{title}</h1>
      {right ?? <span className="screen-header-spacer" aria-hidden="true" />}
    </header>
  )
}
