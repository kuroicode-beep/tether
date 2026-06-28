// src/screens/ReleaseLogScreen.tsx
// Shows release, update, and hotfix notes for the app.
import { useEffect, useMemo, useRef, useState } from 'react'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'
import { APP_VERSION_LABEL } from '../lib/appVersion'
import { useApp } from '../context/useApp'
import { useCoupleSession } from '../hooks/useCoupleSession'
import {
  useFeedbackReports,
  type FeedbackReport,
  type FeedbackReportType,
} from '../hooks/useFeedbackReports'

interface ReleaseLogScreenProps {
  onBack: () => void
}

type LogType = 'release' | 'update' | 'hotfix'

interface ReleaseLogEntry {
  id: string
  date: string
  type: LogType
  title: string
  detail?: string
}

interface LegacyFeedbackMemo {
  id: string
  type: FeedbackReportType
  text: string
  createdAt: string
}

const PAGE_SIZE = 8
const FEEDBACK_MEMO_KEY = 'tether_release_log_feedback_memos'
const FEEDBACK_MEMO_BACKUP_KEY = 'tether_release_log_feedback_memos_backup_v030'
const FEEDBACK_MEMO_MIGRATED_KEY = 'tether_release_log_feedback_memos_migrated_v030'

const TYPE_LABEL: Record<LogType, string> = {
  release: '릴리즈',
  update: '업데이트',
  hotfix: '핫픽스',
}

const TYPE_CLASS: Record<LogType, string> = {
  release: 'bg-primary text-on-primary',
  update: 'bg-secondary-container text-on-surface',
  hotfix: 'bg-error-container text-on-error-container',
}

const MEMO_TYPE_LABEL: Record<FeedbackReportType, string> = {
  improvement: '기능개선',
  bug: '버그',
}

const REPORT_STATUS_LABEL: Record<FeedbackReport['status'], string> = {
  open: '열림',
  done: '완료',
}

function formatReportDate(value: number | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function loadLegacyFeedbackMemos(): LegacyFeedbackMemo[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_MEMO_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is LegacyFeedbackMemo => (
      typeof item?.id === 'string'
      && (item.type === 'improvement' || item.type === 'bug')
      && typeof item.text === 'string'
      && typeof item.createdAt === 'string'
    ))
  } catch {
    return []
  }
}

const RELEASE_LOGS: ReleaseLogEntry[] = [
  {
    id: '2026-06-29-hotfix-v0-5-11-webpush-notification-payload',
    date: '2026.06.29',
    type: 'hotfix',
    title: 'Tether v0.5.11 핫픽스.',
    detail: '앱이 완전히 닫혀 있거나 브라우저가 Service Worker를 즉시 깨우지 못하는 상황에서도 알림 표시 경로가 살아 있도록 Functions 푸시 payload에 webpush.notification을 추가했습니다. 열린 앱에서는 기존처럼 내부 토스트/소리 중심으로 처리하고, 백그라운드/종료 상태에서는 브라우저와 OS 알림 표시를 우선합니다.',
  },
  {
    id: '2026-06-27-hotfix-v0-5-10-google-e2e-admin-seed',
    date: '2026.06.27',
    type: 'hotfix',
    title: 'Tether v0.5.10 핫픽스.',
    detail: 'Google 전용 가입 정책 이후 깨졌던 Firebase live E2E를 Admin SDK 시드 방식으로 재정리했습니다. 익명 가입 의존성을 제거하고, 비-Google user doc create 차단을 검증하며, 서비스 계정 환경변수 안내와 npm test:e2e:firebase 명령을 추가했습니다.',
  },
  {
    id: '2026-06-27-hotfix-v0-5-9-fast-refresh-cleanup',
    date: '2026.06.27',
    type: 'hotfix',
    title: 'Tether v0.5.9 핫픽스.',
    detail: 'Provider와 hook export를 분리해 Fast Refresh 구조 경고를 제거했습니다. App/Session/UnreadBadges/useAuth 주변 import 구조를 정리했고, npm run lint가 경고 없이 통과하도록 검증 게이트를 더 단단하게 만들었습니다.',
  },
  {
    id: '2026-06-27-hotfix-v0-5-8-lint-audit-gate',
    date: '2026.06.27',
    type: 'hotfix',
    title: 'Tether v0.5.8 핫픽스.',
    detail: '죽어 있던 lint 검증 게이트를 ESLint flat config로 복구했습니다. 파일 업로드 이름 정리 정규식의 lint 오류를 제거하고, 알림/플레이어 관련 hook 의존성을 정리했습니다. npm audit도 0 vulnerabilities 상태로 맞췄습니다.',
  },
  {
    id: '2026-06-27-hotfix-v0-5-7-status-tags-player-state',
    date: '2026.06.27',
    type: 'hotfix',
    title: 'Tether v0.5.7 핫픽스.',
    detail: '상태 편집창에서 빠른 상태 메시지 4개가 태그 목록과 중복 표시되던 문제를 정리했습니다. 같이듣기 상단 플레이어는 숨김/표시와 재생/중지 상태를 기기별로 저장해, 다시 접속해도 마지막 사용 상태를 유지합니다. 알림 중복 방지를 위한 서비스워커 메시지 처리 의존성도 보강했습니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-5-6-player-random-start-hidden-audio',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.5.6 핫픽스.',
    detail: '같이듣기 플레이어가 갱신 직후 첫 곡에 고정될 수 있는 흐름을 수정했습니다. 플레이어 첫 렌더부터 랜덤 곡으로 시작하며, 플레이어를 숨겨도 음악은 계속 재생됩니다. 홈 Log 옆 Player 버튼은 보이기/숨기기 토글로 동작합니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-5-5-random-repeat-player',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.5.5 핫픽스.',
    detail: '같이듣기 플레이어가 첫 곡만 반복되는 문제를 수정했습니다. 플레이리스트 적용 시 첫 곡부터 랜덤으로 시작하고, 곡 종료 또는 끝 구간 감지 시 전체 후보 중 다음 곡을 랜덤으로 골라 반복 재생합니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-5-4-listen-refresh-player',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.5.4 핫픽스.',
    detail: '같이듣기 메뉴에 플레이리스트 갱신 버튼을 추가했습니다. 선택한 곡 목록을 상단 플레이어에 즉시 다시 적용할 수 있고, 랜덤 반복 재생이 같은 곡만 반복되지 않도록 플레이어 반복 처리도 정리했습니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-5-3-library-file-index-listen-picker',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.5.3 핫픽스.',
    detail: '파일 자료실이 채팅 메시지 목록에만 의존하지 않도록 전용 files 인덱스를 추가했습니다. 같이듣기에는 업로드된 음악 전체 목록과 내 플레이리스트를 분리해, 음악 목록에서 직접 3곡을 추가/해제할 수 있게 정리했습니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-5-2-library-listen-split',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.5.2 핫픽스.',
    detail: '자료실과 같이듣기의 파일 분류를 다시 정리했습니다. 자료실에는 음악 파일을 제외한 문서·압축파일·기타 파일만 표시하고, 같이듣기에는 자료실에 쌓인 음악 파일만 모두 표시되도록 분리했습니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-5-1-visible-window-notification',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.5.1 핫픽스.',
    detail: 'PC에서 앱 창이 열려 있지만 포커스가 없을 때 윈도우 시스템 알림이 화면을 가리지 않도록 수정했습니다. 보이는 앱 창이 있으면 내부 토스트와 알림음만 사용하고, 실제로 앱이 hidden/minimized 상태일 때만 시스템 알림을 표시합니다.',
  },
  {
    id: '2026-06-26-update-v0-5-0-listen-together',
    date: '2026.06.26',
    type: 'update',
    title: 'Tether v0.5.0 업데이트.',
    detail: '자료실 음악 파일을 기반으로 한 같이듣기 메뉴를 추가했습니다. 커플이 각각 3곡씩 고르고, 상대방의 곡은 수정하지 못하되 한 곡만 내 재생 목록에서 제외할 수 있습니다. 선택된 4~6곡은 상단 플레이어에서 랜덤 반복 재생되며, 플레이어 숨김 버튼과 홈 Log 옆 Player 버튼으로 다시 보기를 지원합니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-12-library-theme-music-button',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.12 핫픽스.',
    detail: '자료실의 오디오 파일에도 메인테마로 지정 버튼을 추가했습니다. 채팅창과 동일하게 자료실에서 지정한 음악도 커플 공용 메인테마로 저장되어 두 사람에게 같은 곡이 표시됩니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-11-theme-music-initial-load',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.11 핫픽스.',
    detail: '메인테마 음악이 첫 접속 직후 비어 보일 수 있는 문제를 보강했습니다. Firestore 공용 설정이 도착하기 전에는 마지막 테마곡 캐시로 즉시 표시하고, 공용 설정이 도착하면 두 사람 모두 같은 마지막 곡으로 동기화됩니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-10-shared-theme-music',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.10 핫픽스.',
    detail: '메인테마 음악을 기기별 localStorage가 아니라 커플 공용 설정으로 동기화했습니다. 한 사람이 채팅 음악 파일을 메인테마로 지정하면 `couples` 문서에 저장되고, 두 사람 모두 마지막으로 지정된 같은 곡을 상단 플레이어에서 보게 됩니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-9-theme-music-player',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.9 핫픽스.',
    detail: '채팅창의 음악 파일에 메인테마로 지정 버튼을 추가했습니다. 선택한 음악은 앱 상단에 얇은 전역 플레이어로 표시되며, 제목 확인과 재생/일시정지, 닫기가 가능하고 반복 재생됩니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-8-pc-notification-dedupe',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.8 핫픽스.',
    detail: 'PC에서 알림이 두 번씩 뜰 수 있는 경로를 정리했습니다. 앱이 백그라운드/hidden 상태일 때는 서비스워커 알림만 사용하고, 메시지·일기·댓글·테스트 알림에 안정적인 notificationId를 넣어 같은 이벤트가 중복 토큰으로 도착해도 하나의 알림으로 교체되게 했습니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-7-diary-high-contrast',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.7 핫픽스.',
    detail: '교환일기 고대비 화면에서 댓글 미리보기와 읽음/답장완료 배지가 밝은 회색 배경에 흰 글씨로 표시되던 문제를 수정했습니다. 목록 댓글 박스와 상태 배지를 검은 배경·흰 글씨·흰 테두리 기준으로 고정했습니다.',
  },
  {
    id: '2026-06-26-hotfix-v0-4-6-chat-library-diary-fixes',
    date: '2026.06.26',
    type: 'hotfix',
    title: 'Tether v0.4.6 핫픽스.',
    detail: '채팅 읽음 전 표시가 묶인 메시지에서도 보이도록 수정하고, 채팅 진입 시 입력창 포커스를 보강했습니다. 설정 알림소리는 선택 즉시 미리듣기 되며, 자료실에는 검색과 내 파일 삭제 기능을 추가했습니다. m4a/mp3 등 오디오 파일 재생 판별과 md/txt 계열 파일 인코딩 메타데이터도 보강했고, 교환일기 댓글 저장 후 화면에 즉시 반영되게 했습니다.',
  },
  {
    id: '2026-06-25-hotfix-v0-4-5-chat-multi-file-paste',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Tether v0.4.5 핫픽스.',
    detail: '채팅창에서 여러 파일을 한 번에 선택하거나 드래그앤드랍해도 순차적으로 첨부할 수 있게 했습니다. 또한 Ctrl+V 붙여넣기로 클립보드의 이미지/파일을 채팅 첨부 미리보기로 가져올 수 있게 했습니다.',
  },
  {
    id: '2026-06-25-hotfix-v0-4-4-chat-drag-drop-upload',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Tether v0.4.4 핫픽스.',
    detail: '채팅창에 파일을 드래그앤드랍해서 첨부할 수 있게 했습니다. 드롭한 파일은 기존 파일 첨부와 같은 미리보기/전송 확인 화면을 거쳐 이미지, 음악, 문서, zip 파일을 업로드합니다.',
  },
  {
    id: '2026-06-25-hotfix-v0-4-3-notification-sounds',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Tether v0.4.3 핫픽스.',
    detail: '알림소리 설정에 반짝, 포근벨, 톡톡 3가지 새 알림음을 추가했습니다. 기존 물방울, 차임, 무음과 함께 선택할 수 있고 PWA 캐시에 포함되도록 빌드 설정도 반영했습니다.',
  },
  {
    id: '2026-06-25-hotfix-v0-4-2-partner-nickname-status-tags',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Tether v0.4.2 핫픽스.',
    detail: '설정에서 상대방 닉네임은 상대가 설정한 이름 그대로 읽기 전용으로 표시되게 바꾸고, 메인 상태 표시창의 상태 태그는 편집창 선택 스타일과 분리해 고대비 기준 검은 배경·흰 글씨·흰 라인으로 가독성을 유지하도록 수정했습니다.',
  },
  {
    id: '2026-06-25-hotfix-v0-4-1-separate-library-menus',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Tether v0.4.1 핫픽스.',
    detail: '자료실 안에 묶여 있던 링크공유와 데이트 레시피를 홈의 별도 메뉴로 분리했습니다. 자료실은 채팅 파일/음악 모음 전용, 링크공유는 즐겨찾기 공유 전용, 데이트 레시피는 음식 날짜 로그 전용 화면으로 동작합니다.',
  },
  {
    id: '2026-06-25-release-v0-4-0-library-content-chat',
    date: '2026.06.25',
    type: 'release',
    title: 'Tether v0.4.0 업데이트.',
    detail: '사진첩 코멘트 목록 표시, 콘텐츠 URL·이미지 첨부, 관리자 상태 태그 관리 정리, 편집창 상태 태그 선택 대비 강화, 자료실·링크공유·데이트 레시피 추가, 채팅 입력 포커스와 읽기 전 아이콘 표시를 반영했습니다.',
  },
  {
    id: '2026-06-25-hotfix-v0-3-2-chat-files-diary-log-signup',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Tether v0.3.2 핫픽스.',
    detail: '채팅 파일/음악 첨부, 교환일기 댓글 미리보기와 댓글 알림, 최근 활동 문구 개선, Google 전용 가입, 관리자 홈 링크, 실사용자 외 Firebase 테스트 데이터 정리를 반영했습니다.',
  },
  {
    id: '2026-06-25-update-release-version-log-rule',
    date: '2026.06.25',
    type: 'update',
    title: '버전 증가 규칙 및 Log 기록 원칙 적용.',
    detail: '모든 핫픽스와 업데이트는 Log에 기록합니다. 핫픽스/마이너 수정은 패치 버전 0.0.1 증가, 메인 업데이트는 마이너 버전 0.1.0 증가, 정식출시·대규모 리뉴얼은 메이저 버전 증가 규칙을 적용합니다.',
  },
  {
    id: '2026-06-25-hotfix-chat-file-attachments',
    date: '2026.06.25',
    type: 'hotfix',
    title: '채팅 파일·음악 첨부 추가.',
    detail: '채팅에서 zip, PDF, 문서, 표, 프레젠테이션, 텍스트, hwp/hwpx, csv/json 같은 일반 파일과 mp3/m4a 등 음악 파일을 보낼 수 있게 했습니다. 음악 파일은 말풍선 안에서 바로 재생되고, 일반 파일은 열기/다운로드로 연결됩니다.',
  },
  {
    id: '2026-06-25-hotfix-recent-feed-label',
    date: '2026.06.25',
    type: 'hotfix',
    title: '최근 활동 문구를 “님이”로 통일.',
    detail: '이름 뒤에 “가”가 고정되어 “요로가”, “유선가”처럼 보이던 문구를 “요로 님이”, “유선 님이” 형태로 통일했습니다.',
  },
  {
    id: '2026-06-25-hotfix-diary-reply-preview-notification',
    date: '2026.06.25',
    type: 'hotfix',
    title: '교환일기 댓글 미리보기와 댓글 알림 추가.',
    detail: '교환일기 첫 화면 카드에 댓글 작성자와 댓글 내용을 표시하고, 댓글이 처음 작성될 때 원글 작성자에게 교환일기 알림이 가도록 Cloud Function을 추가했습니다.',
  },
  {
    id: '2026-06-25-hotfix-admin-home-link',
    date: '2026.06.25',
    type: 'hotfix',
    title: '홈 화면 Log 옆 관리자 링크 추가.',
    detail: 'kuroicode@gmail.com으로 로그인했을 때만 홈 상단 Log 버튼 옆에 Admin 버튼이 보이도록 추가했습니다.',
  },
  {
    id: '2026-06-25-hotfix-google-only-signup',
    date: '2026.06.25',
    type: 'hotfix',
    title: '비회원·익명 가입 차단.',
    detail: '첫 가입 화면에서 닉네임만으로 시작하기를 제거하고 Google 로그인으로만 가입할 수 있게 했습니다. 기존 익명 세션은 자동 로그아웃되며, Firestore users 문서 생성도 Google 로그인 토큰으로 제한했습니다.',
  },
  {
    id: '2026-06-25-hotfix-firebase-user-cleanup',
    date: '2026.06.25',
    type: 'hotfix',
    title: 'Firebase 테스트 회원 데이터 정리.',
    detail: '실사용자 kuroicode@gmail.com, phumphum80@gmail.com 두 명만 남기고 Auth와 Firestore의 E2E 테스트 사용자, 공개 프로필, 테스트 커플, 초대 데이터를 정리했습니다.',
  },
  {
    id: '2026-06-25-update-v0-3-1-admin-status-sound',
    date: '2026.06.25',
    type: 'update',
    title: 'Tether v0.3.1 업데이트.',
    detail: 'kuroicode@gmail.com 전용 Admin 페이지를 추가하고, 회원가입 승인 대기/승인 처리, 회원 토큰 연결 상태와 리포트 로그 확인, 상태 태그·빠른 상태 메시지 추가/삭제, 알림소리 설정을 반영했습니다. 상태 아이콘도 토함·띠꺼움·놀람·당황·익살·메롱 계열을 확장했습니다.',
  },
  {
    id: '2026-06-25-release-v0-3-0-feedback-sync-accessibility',
    date: '2026.06.25',
    type: 'release',
    title: 'Tether v0.3.0 업데이트.',
    detail: 'Log 하단 기능개선/버그 리포트를 커플 간 실시간 동기화로 전환하고, 표시 상태·고대비 가독성·스크린 리더 레이블·Firestore 오프라인 캐시 기반을 보강했습니다.',
  },
  {
    id: '2026-06-22-hotfix-diary-reply-firestore-rules',
    date: '2026.06.22',
    type: 'hotfix',
    title: '교환일기 답장(댓글) 저장 불가 수정.',
    detail: 'Firestore 규칙이 상대방 reply 작성을 막고 있던 문제를 수정했습니다. 답장 실패 시 화면에 오류 문구를 표시합니다.',
  },
  {
    id: '2026-06-22-update-release-log-feedback-memos',
    date: '2026.06.22',
    type: 'update',
    title: 'Log 하단에 기능개선·버그 리포트 메모 추가.',
    detail: '업데이트 기록 아래에서 기능개선과 버그 리포트를 댓글처럼 적어둘 수 있는 로컬 메모 영역을 추가했습니다.',
  },
  {
    id: '2026-06-21-hotfix-ios-ime-send-guard-sound-cache-bust',
    date: '2026.06.21',
    type: 'hotfix',
    title: 'iOS 마지막 글자 중복 전송 2차 차단 및 알림음 캐시 우회.',
    detail: 'iPhone 한글 입력에서 문장 전송 직후 마지막 1-2글자만 따로 전송되는 패턴을 Firestore 전송 직전에서 차단했습니다. 알림음은 새 파일명 `/sounds/water-drop-20260621.wav`로 바꿔 기존 캐시를 타지 않게 했습니다.',
  },
  {
    id: '2026-06-21-hotfix-ios-chat-input-water-drop-sound',
    date: '2026.06.21',
    type: 'hotfix',
    title: 'iPhone 채팅 마지막 글자 중복 및 알림음 수정.',
    detail: 'iOS 한글 조합 입력에서 전송 후 마지막 글자가 입력창에 남아 한 번 더 보내지는 문제를 막기 위해 채팅 입력창을 textarea 기반으로 바꾸고, 알림음을 큰 물방울 떨어지는 소리로 교체했습니다.',
  },
  {
    id: '2026-06-21-hotfix-recovery-new-connection-actions',
    date: '2026.06.21',
    type: 'hotfix',
    title: '새 연결 복구 화면에 보내기/받기 선택 추가.',
    detail: '기존 연결 복구 실패 후 새 연결을 진행할 때 내 코드를 만들 수도 있고, 상대방에게 받은 코드를 바로 입력할 수도 있도록 버튼을 분리했습니다.',
  },
  {
    id: '2026-06-21-final-push-reconnect-icon-onboarding',
    date: '2026.06.21',
    type: 'hotfix',
    title: 'Tether 최종 업데이트 입니다.',
    detail: '재설치·재연결 시 알림 토큰을 강제로 새로 발급해 저장하도록 수정하고, iPhone PWA 백그라운드 알림을 Service Worker 직접 표시 방식으로 보강했습니다. 닉네임 시작 무한반복을 막고, 앱 아이콘을 새 잎사귀 아이콘으로 교체했습니다. 새로고침 후 홈 화면 앱에서 설정 > Notifications > 다시 등록을 누른 뒤 내 기기/상대방 테스트 알림으로 확인해주세요.',
  },
  {
    id: '2026-06-15-final-notification-apply-guide',
    date: '2026.06.15',
    type: 'update',
    title: '알림 최종 적용 방법.',
    detail: '앱을 새로고침한 뒤 설정 > Notifications > 다시 등록을 눌러 이 기기를 다시 등록해주세요. 그 다음 내 기기 테스트 알림으로 수신 여부를 확인하면 됩니다. Tether 최종 업데이트 입니다.',
  },
  {
    id: '2026-06-12-hotfix-push-diagnostics-v3',
    date: '2026.06.12',
    type: 'hotfix',
    title: '알림 진단 ping·토큰 상태 배너·복구 새 연결 화면 수정.',
    detail: 'debugPushPing callable, 홈/설정 토큰 만료 배너, 설정 테스트 알림 버튼을 추가했습니다. 복구 화면 새 연결 진행 시 초대 코드 화면으로 바로 이동합니다.',
  },
  {
    id: '2026-06-12-hotfix-push-token-resync-v2',
    date: '2026.06.12',
    type: 'hotfix',
    title: '알림 미수신 재발 — FCM 토큰 재동기화·Functions 진단 보강.',
    detail: 'SW 갱신/재연결/탭 복귀 시 FCM 토큰 자동 재등록, 설정의 알림 다시 등록 버튼, partner coupleId 검증 및 Functions 실패 로그를 추가했습니다.',
  },
  {
    id: '2026-06-12-release-v0-2-0',
    date: '2026.06.12',
    type: 'release',
    title: 'Tether v0.2.0 릴리즈.',
    detail: '고대비 가독성 박스 전면 적용, Log 페이지 페이징, 설정 폰트 선택 표시 개선, PWA 아이콘 브랜딩 정리, Google 복구·재연결 알림 안정화를 포함합니다.',
  },
  {
    id: '2026-06-12-hotfix-settings-font-selection-hc',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 설정 폰트 선택 표시 개선.',
    detail: '선택된 폰트와 크기를 체크 아이콘과 고대비 테두리로 명확히 구분할 수 있게 했습니다.',
  },
  {
    id: '2026-06-12-update-release-log-pagination',
    date: '2026.06.12',
    type: 'update',
    title: 'Log 페이지 페이징 추가.',
    detail: '업데이트 기록이 많아져 페이지 단위(8건)로 나눠 이전/다음 이동할 수 있게 했습니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-readable-box',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 가독성 박스 스타일 전체 적용.',
    detail: '검은 배경·흰 글씨·둥근 흰 보더를 고대비 기본 패턴으로 정하고, 채팅/히스토리 메시지·상태 태그·버튼·입력창·카드 등 전 화면에 일괄 적용했습니다.',
  },
  {
    id: '2026-06-12-hotfix-app-icon-branding-v2',
    date: '2026.06.12',
    type: 'hotfix',
    title: 'PWA 아이콘 브랜딩 재적용 및 maskable 아이콘 분리.',
    detail: '제공된 크림 배경 잎사귀 로고를 그대로 PNG/SVG로 재생성하고, Android maskable 크롭 문제를 막기 위해 any/maskable 아이콘을 분리했습니다.',
  },
  {
    id: '2026-06-12-hotfix-app-icon-branding',
    date: '2026.06.12',
    type: 'hotfix',
    title: '앱 아이콘 물음표(????) 표시 수정 및 잎사귀 브랜딩 적용.',
    detail: '한글 폰트 없이 생성되던 아이콘의 ???? ?? 깨짐을 제거하고, 크림 배경 잎사귀 Tether 로고로 192/512/180px 및 favicon을 다시 생성했습니다.',
  },
  {
    id: '2026-06-12-hotfix-reconnect-push-resync',
    date: '2026.06.12',
    type: 'hotfix',
    title: '재연결 후 알림 토큰 재동기화 보강.',
    detail: '같은 계정으로 커플을 다시 연결해도 새 coupleId 기준으로 FCM 토큰을 다시 저장하고, Functions 로그에서 토큰 수와 발송 성공/실패를 확인할 수 있게 했습니다.',
  },
  {
    id: '2026-06-12-hotfix-recovery-button-loading',
    date: '2026.06.12',
    type: 'hotfix',
    title: '복구 화면 새 연결 버튼 멈춤 및 글자 대비 수정.',
    detail: '기존 연결 확인과 새 연결 생성을 별도 로딩 상태로 분리하고, 타임아웃과 명확한 오류 문구를 추가했습니다.',
  },
  {
    id: '2026-06-12-update-leaf-app-icons',
    date: '2026.06.12',
    type: 'update',
    title: 'iOS/Android 앱 아이콘에 Tether 잎사귀 로고 적용.',
    detail: '홈 화면과 PWA manifest, favicon에 사용할 192/512/180px 아이콘과 SVG 아이콘을 잎사귀 로고 포함 버전으로 교체했습니다.',
  },
  {
    id: '2026-06-12-hotfix-google-recovery-cache',
    date: '2026.06.12',
    type: 'hotfix',
    title: 'Google 재로그인·새 연결 흐름 멈춤 수정.',
    detail: '연결 해제 후 남아 있던 로그인 준비 캐시가 복구/새 연결 흐름을 막지 않도록 제거했습니다.',
  },
  {
    id: '2026-06-12-hotfix-disconnect-couple',
    date: '2026.06.12',
    type: 'hotfix',
    title: '커플 연결 해제가 실제 계정 상태에 반영되도록 수정.',
    detail: '설정의 연결 해제가 로컬 캐시만 비우지 않고 Cloud Function을 통해 양쪽 users.coupleId를 해제하도록 보강했습니다.',
  },
  {
    id: '2026-06-12-hotfix-google-recovery-onboarding',
    date: '2026.06.12',
    type: 'hotfix',
    title: 'iOS 재설치 후 Google 로그인 복구 안내 흐름 추가.',
    detail: 'Google 로그인 후 커플 정보가 없을 때 바로 코드 입력으로 보내지 않고, 기존 연결 재확인/다른 Google 계정 로그인/새 연결 진행을 분리한 복구 안내 화면을 표시합니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-status-message-black',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 상태 메시지 박스 색상 수정.',
    detail: '상태 메시지를 검은 배경, 흰 글씨, 흰 보더, 둥근 모서리 박스로 다시 맞췄습니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-white-status-cards',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 상태 카드를 흰색 둥근 박스 중심으로 재정리.',
    detail: '상태 메시지와 태그를 흰색 둥근 박스+검정 글자로 단순화하고, 편집 선택 항목만 노란색으로 강조되게 정리했습니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-status-cleanup',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 상태 카드 편집 화면 색상 정리.',
    detail: '상태 카드 편집 모드의 회색 패널, 과한 흰 테두리, 칩 대비를 정리해 선택 항목만 노란색으로 명확하게 보이도록 보강했습니다.',
  },
  {
    id: '2026-06-12-update-font-settings-release-log',
    date: '2026.06.12',
    type: 'update',
    title: '폰트 크기·폰트 선택 설정과 Log 기록 정책을 추가.',
    detail: '설정에서 소/중/대 폰트 크기와 기본, 카페24동동체, 메이플스토리체, 나눔고딕 등 앱 폰트를 선택할 수 있게 했고, 앞으로 모든 수정사항을 Log 페이지에 남기도록 정리했습니다.',
  },
  {
    id: '2026-06-12-hotfix-status-high-contrast-notification',
    date: '2026.06.12',
    type: 'hotfix',
    title: '상태 카드 고대비·편집모드와 Android 알림 체감 보강.',
    detail: '상대방 상태를 위로 올리고, 내 상태는 편집 버튼을 눌렀을 때만 수정되도록 바꿨습니다. 고대비 상태 카드 색상을 정리하고 Android 알림 tag/vibration 옵션도 보강했습니다.',
  },
  {
    id: '2026-06-12-update-mobile-chat-status-diary-contents',
    date: '2026.06.12',
    type: 'update',
    title: '모바일 채팅, 상태, 교환일기, 콘텐츠 편집 UX 개선.',
    detail: '큰 종소리 알림음, iOS 채팅 스크롤 튐 완화, 채팅 상태 이모티콘 제거, 교환일기/콘텐츠 전체 수정, 상태 태그 추가, powered by 디또 문구를 반영했습니다.',
  },
  {
    id: '2026-06-11-hotfix-mobile-notification-silent',
    date: '2026.06.11',
    type: 'hotfix',
    title: '모바일 백그라운드 알림 무음 체감 핫픽스.',
    detail: 'Service Worker 백그라운드 알림을 non-silent로 고정해 Android PWA 알림이 조용한 알림처럼 내려가는 문제를 줄였습니다.',
  },
  {
    id: '2026-06-11-hotfix-notification-multidevice',
    date: '2026.06.11',
    type: 'hotfix',
    title: '기기별 Web Push 토큰 저장 및 멀티 디바이스 발송.',
    detail: 'PC와 스마트폰 토큰이 서로 덮어쓰지 않도록 기기별 FCM 토큰을 저장하고, Functions에서 모든 등록 기기에 알림을 발송하게 했습니다.',
  },
  {
    id: '2026-06-11-hotfix-chat-autoscroll',
    date: '2026.06.11',
    type: 'hotfix',
    title: '채팅 진입·전송·수신 자동 스크롤 핫픽스.',
    detail: '채팅 첫 진입, 메시지 전송, 상대 메시지 수신 시 마지막 대화가 보이도록 스크롤 기준을 마지막 메시지 ID 중심으로 보강했습니다.',
  },
  {
    id: '2026-06-09-release-stabilization-steps',
    date: '2026.06.09',
    type: 'release',
    title: 'Tether 안정화 Steps 2-6 자동 검증 및 배포 완료.',
    detail: '읽음 배지, Firestore/Storage ownership, optimistic sync, PWA 알림/접근성, 최종 E2E 검증과 Firebase Hosting 배포를 완료했습니다.',
  },
  {
    id: '2026-06-10-update-profile-photo-thumbnails',
    date: '2026.06.10',
    type: 'update',
    title: '프로필 사진 업로드 및 썸네일 표시 적용.',
    detail: '설정에서 프로필 사진을 업로드하고, 채팅 메시지와 일기/콘텐츠/사진첩 게시글 작성자 영역에 썸네일을 표시합니다.',
  },
  {
    id: '2026-06-10-release-rc-v0-1',
    date: '2026.06.10',
    type: 'release',
    title: 'Tether RC v0.1 완료.',
  },
  {
    id: '2026-06-10-update-history-status-timeline',
    date: '2026.06.10',
    type: 'update',
    title: '히스토리 메뉴 기능 의도대로 적용.',
    detail: '두 사람의 표정 아이콘, 태그, 상태 메시지를 시간 순으로 볼 수 있게 정리했습니다.',
  },
  {
    id: '2026-06-10-hotfix-home-status-usability',
    date: '2026.06.10',
    type: 'hotfix',
    title: '홈 사용성 및 상태 표시 핫픽스.',
    detail: '뒤로가기 동작, 닉네임 유지, 5단계 표정, 상태 태그, 최근 활동 표시를 보강했습니다.',
  },
  {
    id: '2026-06-10-hotfix-chat-image-album-status',
    date: '2026.06.10',
    type: 'hotfix',
    title: '채팅 이미지 표시 및 사진첩 보내기 핫픽스.',
    detail: '상대가 보낸 사진 표시, 채팅 사진의 사진첩 등록, 메시지 상태 표정 표시를 추가했습니다.',
  },
  {
    id: '2026-06-10-hotfix-high-contrast-photo-verify',
    date: '2026.06.10',
    type: 'hotfix',
    title: '고대비 상태 가독성 및 사진첩 검증 핫픽스.',
    detail: '고대비 테마의 상태 태그와 상태 메시지 대비를 보강하고, 사진첩 업로드 및 표시 검증을 강화했습니다.',
  },
]

export function ReleaseLogScreen({ onBack }: ReleaseLogScreenProps) {
  const [page, setPage] = useState(0)
  const [memoType, setMemoType] = useState<FeedbackReportType>('improvement')
  const [memoText, setMemoText] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null)
  const migrationStartedRef = useRef(false)
  const { uid, coupleId } = useCoupleSession()
  const { myNickname } = useApp()
  const {
    reports,
    loading: reportsLoading,
    saving: reportSaving,
    error: reportsError,
    addReport,
    deleteReport,
    toggleReportStatus,
  } = useFeedbackReports(coupleId, uid, myNickname)
  const totalPages = Math.max(1, Math.ceil(RELEASE_LOGS.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = useMemo(
    () => RELEASE_LOGS.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [safePage],
  )
  const rangeStart = safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min(RELEASE_LOGS.length, (safePage + 1) * PAGE_SIZE)
  const openReports = useMemo(
    () => reports.filter((report) => report.status !== 'done'),
    [reports],
  )

  useEffect(() => {
    if (!coupleId || !uid || reportsLoading || migrationStartedRef.current) return
    const markerKey = `${FEEDBACK_MEMO_MIGRATED_KEY}_${coupleId}`
    if (localStorage.getItem(markerKey) === 'true') return

    const legacyMemos = loadLegacyFeedbackMemos()
    if (legacyMemos.length === 0) {
      localStorage.setItem(markerKey, 'true')
      return
    }

    migrationStartedRef.current = true
    const existingClientIds = new Set(reports.map((report) => report.clientId).filter(Boolean))
    const targets = legacyMemos.filter((memo) => !existingClientIds.has(`legacy_feedback_${memo.id}`))

    if (targets.length === 0) {
      localStorage.setItem(FEEDBACK_MEMO_BACKUP_KEY, JSON.stringify(legacyMemos))
      localStorage.setItem(markerKey, 'true')
      localStorage.removeItem(FEEDBACK_MEMO_KEY)
      setMigrationMessage('이전 로컬 메모를 이미 커플 공유 리포트로 옮겼어요.')
      return
    }

    void Promise.all(targets.map((memo) => addReport(memo.type, memo.text, {
      clientId: `legacy_feedback_${memo.id}`,
      createdAt: new Date(memo.createdAt).getTime() || Date.now(),
    }))).then((results) => {
      if (results.every(Boolean)) {
        localStorage.setItem(FEEDBACK_MEMO_BACKUP_KEY, JSON.stringify(legacyMemos))
        localStorage.setItem(markerKey, 'true')
        localStorage.removeItem(FEEDBACK_MEMO_KEY)
        setMigrationMessage('이전 로컬 메모를 커플 공유 리포트로 옮겼어요.')
      } else {
        migrationStartedRef.current = false
        setMigrationMessage('이전 로컬 메모 일부를 옮기지 못했어요. 원본은 삭제하지 않았습니다.')
      }
    })
  }, [addReport, coupleId, reports, reportsLoading, uid])

  const handleAddMemo = async () => {
    const text = memoText.trim()
    if (!text) return
    const ok = await addReport(memoType, text)
    if (ok) setMemoText('')
  }

  const handleCopyOpenReports = async () => {
    const copyText = openReports
      .map((report, index) => {
        const typeLabel = MEMO_TYPE_LABEL[report.type]
        const dateText = formatReportDate(report.createdAt)
        const meta = [typeLabel, report.authorNickname, dateText].filter(Boolean).join(' · ')
        return `${index + 1}. ${meta}\n${report.text.trim()}`
      })
      .join('\n\n')

    if (!copyText) {
      setCopyMessage('복사할 미완료 리포트가 없어요.')
      return
    }

    try {
      await navigator.clipboard.writeText(copyText)
      setCopyMessage(`미완료 리포트 ${openReports.length}개를 복사했어요.`)
    } catch (error) {
      console.warn('[ReleaseLogScreen] copy feedback reports failed', error)
      setCopyMessage('복사하지 못했어요. 브라우저 권한을 확인해주세요.')
    }
  }

  return (
    <SubScreen>
      <ScreenHeader title="Log" onBack={onBack} />

      <main className="sub-screen-body w-full px-margin-mobile py-lg pb-32">
        <section className="mb-lg rounded-xl bg-[#F5F2EB] p-md shadow-sm">
          <h2 className="font-label-md text-label-md font-semibold text-on-surface">업데이트 기록</h2>
          <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
            릴리즈, 핫픽스, 기능 변경 기록을 날짜순으로 확인할 수 있어요. ({APP_VERSION_LABEL})
          </p>
        </section>

        <div className="space-y-md">
          {pageItems.map((entry) => (
            <article key={entry.id} className="rounded-xl bg-surface-container p-md shadow-sm">
              <div className="mb-sm flex flex-wrap items-center gap-xs">
                <span className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${TYPE_CLASS[entry.type]}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
                <time className="font-label-sm text-label-sm text-on-surface-variant">{entry.date}</time>
              </div>
              <h3 className="font-label-md text-label-md font-semibold text-on-surface">{entry.title}</h3>
              {entry.detail && (
                <p className="mt-xs font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                  {entry.detail}
                </p>
              )}
            </article>
          ))}
        </div>

        <nav
          className="release-log-pagination mt-xl flex items-center justify-between gap-sm rounded-xl bg-surface-container p-md"
          aria-label="업데이트 기록 페이지"
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage === 0}
            className="release-log-page-btn min-h-[50px] rounded-full border border-outline-variant px-md py-sm font-label-md text-label-md text-on-surface disabled:opacity-40"
          >
            이전
          </button>
          <p className="font-label-sm text-label-sm text-on-surface-variant text-center">
            {rangeStart}-{rangeEnd} / {RELEASE_LOGS.length}
            <span className="block text-on-surface">{safePage + 1} / {totalPages} 페이지</span>
          </p>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePage >= totalPages - 1}
            className="release-log-page-btn min-h-[50px] rounded-full border border-outline-variant px-md py-sm font-label-md text-label-md text-on-surface disabled:opacity-40"
          >
            다음
          </button>
        </nav>

        <section className="mt-xl hc-readable-box rounded-xl bg-surface-container p-md shadow-sm">
          <div className="mb-md">
            <h2 className="font-label-md text-label-md font-semibold text-on-surface">
              기능개선 / 버그 리포트 메모
            </h2>
            <p className="mt-xs font-label-sm text-label-sm leading-relaxed text-on-surface-variant">
              떠오른 개선점이나 버그를 댓글처럼 남겨둘 수 있어요. 같은 커플의 기기에 실시간으로 동기화됩니다.
            </p>
          </div>

          <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              완료되지 않은 리포트 {openReports.length}개가 복사 대상이에요.
            </p>
            <button
              type="button"
              onClick={() => void handleCopyOpenReports()}
              disabled={openReports.length === 0}
              className="hc-readable-box hc-readable-box--pill min-h-[50px] rounded-full border border-outline-variant px-md py-sm font-label-md text-label-md text-on-surface disabled:opacity-40"
            >
              전체 내용 복사
            </button>
          </div>

          {copyMessage && (
            <p className="mb-md hc-readable-box rounded-xl border border-outline-variant/50 bg-surface-container-low p-md font-label-sm text-label-sm text-on-surface">
              {copyMessage}
            </p>
          )}

          {!coupleId && (
            <p className="mb-md hc-readable-box rounded-xl border border-outline-variant/50 p-md font-label-sm text-label-sm text-on-surface-variant">
              커플 연결 후 리포트를 남길 수 있어요.
            </p>
          )}

          {migrationMessage && (
            <p className="mb-md hc-readable-box rounded-xl border border-outline-variant/50 bg-surface-container-low p-md font-label-sm text-label-sm text-on-surface">
              {migrationMessage}
            </p>
          )}

          {reportsError && (
            <p className="mb-md hc-readable-box rounded-xl border border-error/60 bg-error-container p-md font-label-sm text-label-sm text-on-error-container">
              {reportsError}
            </p>
          )}

          <div className="mb-sm grid grid-cols-2 gap-sm">
            {(['improvement', 'bug'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMemoType(type)}
                aria-pressed={memoType === type}
                className={`hc-readable-box hc-readable-box--pill min-h-[50px] rounded-full border px-md py-sm font-label-sm text-label-sm transition-colors ${
                  memoType === type
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant bg-surface-container-low text-on-surface'
                }`}
              >
                {MEMO_TYPE_LABEL[type]}
              </button>
            ))}
          </div>

          <textarea
            value={memoText}
            onChange={(event) => setMemoText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                void handleAddMemo()
              }
            }}
            placeholder="예: 알림 테스트 버튼을 더 잘 보이게 / 채팅에서 사진 전송 후 스크롤 확인 필요"
            rows={4}
            maxLength={500}
            disabled={!coupleId || reportSaving}
            className="hc-readable-box w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-container-low p-md font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
          />

          <div className="mt-sm flex items-center justify-between gap-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {memoText.length}/500
            </p>
            <button
              type="button"
              onClick={() => void handleAddMemo()}
              disabled={!coupleId || !memoText.trim() || reportSaving}
              className="hc-readable-box hc-readable-box--pill min-h-[50px] rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary disabled:opacity-40"
            >
              {reportSaving ? '저장 중...' : '메모 추가'}
            </button>
          </div>

          <div className="mt-lg space-y-sm">
            {reportsLoading ? (
              <p className="hc-readable-box rounded-xl border border-outline-variant/50 p-md text-center font-label-sm text-label-sm text-on-surface-variant">
                리포트를 불러오는 중...
              </p>
            ) : reports.length === 0 ? (
              <p className="hc-readable-box rounded-xl border border-dashed border-outline-variant/50 p-md text-center font-label-sm text-label-sm text-on-surface-variant">
                아직 남긴 리포트가 없어요.
              </p>
            ) : (
              reports.map((memo) => (
                <article key={memo.id} className="hc-readable-box rounded-xl border border-outline-variant/30 bg-surface-container-low p-md">
                  <div className="mb-xs flex items-center justify-between gap-sm">
                    <div className="flex flex-wrap items-center gap-xs">
                      <span className={`hc-readable-box hc-readable-box--pill rounded-full px-sm py-xs font-label-sm text-label-sm ${
                        memo.type === 'bug' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-surface'
                      }`}>
                        {MEMO_TYPE_LABEL[memo.type]}
                      </span>
                      <span className={`hc-readable-box hc-readable-box--pill rounded-full px-sm py-xs font-label-sm text-label-sm ${
                        memo.status === 'done' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                      }`}>
                        {REPORT_STATUS_LABEL[memo.status]}
                      </span>
                      <time className="font-label-sm text-label-sm text-on-surface-variant">
                        {formatReportDate(memo.createdAt)}
                      </time>
                      {memo.pending && (
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          동기화 중
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-xs">
                      <button
                        type="button"
                        onClick={() => void toggleReportStatus(memo)}
                        disabled={memo.pending}
                        className="hc-readable-box hc-readable-box--pill min-h-[50px] rounded-full border border-outline-variant px-sm font-label-sm text-label-sm text-on-surface disabled:opacity-40"
                      >
                        {memo.status === 'done' ? '다시 열기' : '완료 처리'}
                      </button>
                      {memo.authorUid === uid && (
                        <button
                          type="button"
                          onClick={() => void deleteReport(memo.id)}
                          disabled={memo.pending}
                          className="hc-readable-box hc-readable-box--circle min-h-[50px] min-w-[50px] rounded-full text-on-surface-variant disabled:opacity-40"
                          aria-label="리포트 삭제"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
                    {memo.authorNickname}
                  </p>
                  <p className="whitespace-pre-wrap break-words font-body-sm text-body-sm leading-relaxed text-on-surface">
                    {memo.text}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </SubScreen>
  )
}
