// src/screens/MaintenanceScreen.tsx
// 서비스 점검 중 안내 — 관리자가 점검 모드를 켠 동안 다른 사용자에게 보이는 화면.
// 이 화면이 떠 있는 동안에는 앱의 어떤 데이터도 불러오지 않는다.
import { APP_VERSION_LABEL } from '../lib/appVersion'
import { useSession } from '../context/useSession'

interface MaintenanceScreenProps {
  message: string
}

export function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  const { signOut } = useSession()

  return (
    <div className="screen flex min-h-screen flex-col items-center justify-center bg-background px-margin-mobile text-center text-on-surface">
      <div className="hc-readable-box w-full max-w-sm rounded-2xl bg-surface p-xl shadow-sm">
        <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary">
          <span className="material-symbols-outlined text-3xl">construction</span>
        </div>
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">
          서비스 점검 중
        </h1>
        {/* 관리자가 적은 안내 문구를 줄바꿈 그대로 보여준다 */}
        <p className="mt-md whitespace-pre-line font-body-md text-body-md leading-relaxed text-on-surface-variant">
          {message}
        </p>
        <p className="mt-lg rounded-xl border border-outline-variant/40 p-md font-label-sm text-label-sm text-on-surface-variant">
          점검이 끝나면 이 화면은 자동으로 사라져요.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-lg min-h-[50px] w-full rounded-full border border-outline-variant px-lg font-label-md text-label-md text-on-surface"
        >
          로그아웃
        </button>
        <p className="mt-lg font-label-sm text-label-sm text-on-surface-variant opacity-60">
          Tether {APP_VERSION_LABEL}
        </p>
      </div>
    </div>
  )
}
