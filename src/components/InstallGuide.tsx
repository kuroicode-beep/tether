// src/components/InstallGuide.tsx
// 첫 화면의 설치 안내. 플랫폼별로 설치 → 알림 → 전원 관리 순서로 보여준다.
//
// 알림이 안 오는 원인은 대부분 앱 설치 방식이나 OS의 전원 절약 설정이었다.
// 그래서 설치법보다 알림·전원 설정에 무게를 뒀다.
import { useState } from 'react'

type Platform = 'ios' | 'android' | 'windows' | 'macos'

interface GuideStep {
  title: string
  items: string[]
  caution?: string
}

interface PlatformGuide {
  label: string
  icon: string
  install: GuideStep
  notification: GuideStep
  power: GuideStep
}

const GUIDES: Record<Platform, PlatformGuide> = {
  ios: {
    label: 'iPhone · iPad',
    icon: 'phone_iphone',
    install: {
      title: '설치',
      items: [
        'Safari로 이 페이지를 엽니다. (Chrome 등 다른 브라우저는 설치가 안 됩니다)',
        '아래 공유 버튼(↑)을 누릅니다.',
        '"홈 화면에 추가"를 선택하고 추가합니다.',
        '홈 화면에 생긴 Tether 아이콘으로 실행합니다.',
      ],
      caution: 'Safari 탭에서 그냥 쓰면 알림이 오지 않습니다. 반드시 홈 화면 아이콘으로 실행해주세요.',
    },
    notification: {
      title: '알림 설정',
      items: [
        '홈 화면 아이콘으로 앱을 실행합니다.',
        '앱 안에서 알림 허용을 묻는 창이 뜨면 "허용"을 누릅니다.',
        'iOS 설정 > 알림 > Tether에서 "알림 허용"이 켜져 있는지 확인합니다.',
        '잠금 화면·알림 센터·배너를 모두 켜두면 놓치지 않습니다.',
      ],
    },
    power: {
      title: '전원 관리',
      items: [
        'iOS 설정 > 일반 > 백그라운드 앱 새로 고침을 켭니다.',
        '저전력 모드에서는 알림이 늦게 올 수 있습니다.',
        '집중 모드(수면·업무 등)를 쓴다면 허용 앱에 Tether를 넣어주세요.',
      ],
      caution: '앱을 완전히 종료해도 알림은 옵니다. 다만 저전력 모드에서는 지연될 수 있습니다.',
    },
  },
  android: {
    label: 'Android',
    icon: 'android',
    install: {
      title: '설치',
      items: [
        'Chrome으로 이 페이지를 엽니다.',
        '주소창 오른쪽 메뉴(⋮)를 누릅니다.',
        '"앱 설치" 또는 "홈 화면에 추가"를 선택합니다.',
        '홈 화면에 생긴 Tether 아이콘으로 실행합니다.',
      ],
    },
    notification: {
      title: '알림 설정',
      items: [
        '앱을 실행하고 알림 허용을 묻는 창에서 "허용"을 누릅니다.',
        '설정 > 앱 > Tether > 알림에서 허용 상태를 확인합니다.',
        '방해 금지 모드를 쓴다면 예외 앱으로 추가해주세요.',
      ],
    },
    power: {
      title: '전원 관리 (중요)',
      items: [
        '설정 > 앱 > Tether > 배터리로 들어갑니다.',
        '"제한 없음" 또는 "최적화 안 함"으로 바꿉니다.',
        '삼성 기기는 설정 > 배터리 > 백그라운드 사용 제한에서 Tether를 빼주세요.',
      ],
      caution: '배터리 최적화가 켜져 있으면 알림이 늦게 오거나 오지 않습니다. 안드로이드에서 가장 흔한 원인입니다.',
    },
  },
  windows: {
    label: 'Windows',
    icon: 'desktop_windows',
    install: {
      title: '설치',
      items: [
        'Chrome 또는 Edge로 이 페이지를 엽니다.',
        '주소창 오른쪽의 설치 아이콘(⊕)을 누릅니다.',
        '"설치"를 선택하면 독립 창으로 실행됩니다.',
        '작업 표시줄에 고정해두면 편합니다.',
      ],
    },
    notification: {
      title: '알림 설정',
      items: [
        '앱 실행 후 알림 허용을 묻는 창에서 "허용"을 누릅니다.',
        'Windows 설정 > 시스템 > 알림에서 브라우저(또는 Tether)가 켜져 있는지 확인합니다.',
        '집중 지원(방해 금지)이 켜져 있으면 알림이 숨겨집니다.',
      ],
      caution: '브라우저를 완전히 종료하면 알림이 오지 않습니다. 창을 닫아도 브라우저는 켜두세요.',
    },
    power: {
      title: '전원 관리',
      items: [
        '설정 > 시스템 > 전원 및 배터리에서 절전 모드를 확인합니다.',
        '절전 모드에서는 백그라운드 알림이 제한될 수 있습니다.',
        '노트북은 덮개를 닫으면 절전으로 들어가 알림이 멈춥니다.',
      ],
    },
  },
  macos: {
    label: 'Mac',
    icon: 'laptop_mac',
    install: {
      title: '설치',
      items: [
        'Safari 또는 Chrome으로 이 페이지를 엽니다.',
        'Safari는 공유 버튼 > "Dock에 추가"를 선택합니다.',
        'Chrome은 주소창 오른쪽 설치 아이콘을 누릅니다.',
        'Dock에 생긴 아이콘으로 실행합니다.',
      ],
    },
    notification: {
      title: '알림 설정',
      items: [
        '앱 실행 후 알림 허용을 묻는 창에서 "허용"을 누릅니다.',
        '시스템 설정 > 알림에서 브라우저(또는 Tether)를 켭니다.',
        '"알림 센터에 표시"와 "배너"를 함께 켜두면 좋습니다.',
      ],
    },
    power: {
      title: '전원 관리',
      items: [
        '집중 모드가 켜져 있으면 알림이 숨겨집니다. 허용 앱에 추가해주세요.',
        'Mac이 잠자기에 들어가면 알림이 깨어난 뒤에 도착합니다.',
        '시스템 설정 > 잠금 화면에서 잠자기 시간을 조절할 수 있습니다.',
      ],
    },
  },
}

// 접속한 기기에 맞는 안내를 먼저 펼쳐준다
function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'ios'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
  return 'windows'
}

function GuideSection({ step, tone }: { step: GuideStep; tone: 'install' | 'alert' | 'power' }) {
  const icon = tone === 'install' ? 'download' : tone === 'alert' ? 'notifications_active' : 'battery_charging_full'
  return (
    <section className="install-guide-section">
      <h4 className="install-guide-section-title">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        {step.title}
      </h4>
      <ol className="install-guide-list">
        {step.items.map((item, i) => (
          <li key={i} className="install-guide-item">
            <span className="install-guide-index">{i + 1}</span>
            <span className="install-guide-text">{item}</span>
          </li>
        ))}
      </ol>
      {step.caution && (
        <p className="install-guide-caution">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {step.caution}
        </p>
      )}
    </section>
  )
}

export function InstallGuide() {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>(detectPlatform)
  const guide = GUIDES[platform]

  return (
    <div className="install-guide">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="install-guide-toggle"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined" aria-hidden="true">install_mobile</span>
        <span className="install-guide-toggle-body">
          <span className="install-guide-toggle-title">설치 방법과 알림 설정</span>
          <span className="install-guide-toggle-sub">
            앱으로 설치해야 알림이 옵니다 · 기기별 안내
          </span>
        </span>
        <span className="material-symbols-outlined install-guide-chevron" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="install-guide-panel">
          <div className="install-guide-tabs" role="tablist" aria-label="기기 선택">
            {(Object.keys(GUIDES) as Platform[]).map((key) => {
              const selected = key === platform
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setPlatform(key)}
                  className={`install-guide-tab${selected ? ' install-guide-tab--active' : ''}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{GUIDES[key].icon}</span>
                  <span>{GUIDES[key].label}</span>
                  {selected && <span className="install-guide-tab-mark">선택됨</span>}
                </button>
              )
            })}
          </div>

          <GuideSection step={guide.install} tone="install" />
          <GuideSection step={guide.notification} tone="alert" />
          <GuideSection step={guide.power} tone="power" />
        </div>
      )}
    </div>
  )
}
