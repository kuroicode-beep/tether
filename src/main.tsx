import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import { bootstrapFontScale } from './hooks/useFontScale'
import { purgeStaleFirestoreCacheOnce } from './lib/firebase'
import App from './App'

bootstrapFontScale()

// 오래된 Firestore 캐시 정리 중이면 reload가 예약된 상태라 렌더하지 않는다
void purgeStaleFirestoreCacheOnce().then((reloading) => {
  if (reloading) return
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
