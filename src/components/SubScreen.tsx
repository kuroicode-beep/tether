// src/components/SubScreen.tsx
// 홈/설정 등 아래 화면이 비치지 않도록 전체를 덮는 서브 화면 레이아웃
import { ReactNode } from 'react'

interface SubScreenProps {
  children: ReactNode
  className?: string
}

export function SubScreen({ children, className = '' }: SubScreenProps) {
  return (
    <div className={`sub-screen ${className}`.trim()}>
      {children}
    </div>
  )
}
