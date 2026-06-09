# Tether — 프로젝트 문서 (`docs/`)

Cursor·Codex·핸드오프 문서는 **Notion이 아닌 이 디렉터리**에 Markdown으로 저장한다.

## 문서 종류

| 종류 | 파일명 패턴 | 작성자 |
|------|------------|--------|
| 작업지시문 | `implementation-work-instructions-YYYY-MM-DD.md` | 기획 / Claude Code |
| 엔지니어링 리뷰 | `engineering-review-YYYY-MM-DD.md` | Claude Code |
| **Cursor 완료보고서** | `cursor-completion-YYYY-MM-DD-[작업명].md` | **Cursor (필수)** |
| Codex 검증보고서 | `codex-verification-YYYY-MM-DD-[작업명].md` | Codex |
| 핸드오프 | `cursor-handoff-YYYY-MM-DD-[주제].md` | Cursor |

## Cursor 완료보고서 — 필수

코드·설정·문서 변경 작업이 끝나면 **반드시** 완료보고서를 작성한다.  
템플릿: [`cursor-completion-report-template.md`](./cursor-completion-report-template.md)

## 추적 흐름

```
작업지시문 → Cursor 완료보고서 → Codex 검증보고서 → 다음 작업지시문
```

모든 단계는 `docs/`에서 Git으로 추적 가능해야 한다.
