// src/screens/ApprovalPendingScreen.tsx
// 관리자 승인 전 신규 사용자를 대기 상태로 안내한다.
import { useSession } from '../context/SessionContext'

export function ApprovalPendingScreen() {
  const { user, signOut } = useSession()

  return (
    <div className="screen flex min-h-screen flex-col items-center justify-center bg-background px-margin-mobile text-center text-on-surface">
      <div className="hc-readable-box w-full max-w-sm rounded-2xl bg-surface p-xl shadow-sm">
        <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary">
          <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
        </div>
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">
          관리자 승인 대기 중
        </h1>
        <p className="mt-md font-body-md text-body-md leading-relaxed text-on-surface-variant">
          회원가입은 완료됐지만 아직 이용 승인이 나지 않았어요.
          관리자 승인 후 Tether를 사용할 수 있습니다.
        </p>
        <p className="mt-md rounded-xl border border-outline-variant/40 p-md font-label-sm text-label-sm text-on-surface-variant">
          {user?.email ?? user?.uid ?? '현재 계정'}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-lg min-h-[50px] w-full rounded-full border border-outline-variant px-lg font-label-md text-label-md text-on-surface"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
