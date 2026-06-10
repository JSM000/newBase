@AGENTS.md

# 프로젝트 개요

교사 학교 전보(이동) 지원 사이트. 청주교육지원청 유치원·초등 교사 대상.

**최종 목표**: 전보 점수 계산 + 전보 대상 여부 판단 + 통계 데이터 확인

**현재 완성 범위**: 청주 → 관외 전보 점수 계산 기능

## 기술 스택

- Next.js 16 / React 19 / TypeScript
- Zustand (상태관리), TanStack Query v5, shadcn/ui, Tailwind CSS
- NEIS 인사기록카드 xlsx 파일 파싱 (`xlsx` 라이브러리)

## 주요 파일

| 역할 | 경로 |
|---|---|
| 점수 계산 로직 | `src/lib/score-calculator.ts` |
| 전보 대상 여부 판단 | `src/lib/transfer-eligibility.ts` |
| 엑셀 파싱 | `src/lib/excel-parser.ts`, `src/apis/excel/excel.ts` |
| 타입 정의 | `src/types/score.ts` |
| 전역 상태 | `src/store/use-score-store.ts` |
| 메인 컨테이너 | `src/containers/score-calculator/` |

## 점수 구조

```
총점 = 경력점 + 가산점 + 실적점
```

- 경력점: 현임교 근무 월 1점, 최근 5년(60개월) 이내, 최대 60점
- 가산점: 지역가산(벽지·오지·특수학교) + 우대가산(국가유공자봉양 등) 월 0.025점
- 실적점: 포상, 연구시범학교, 학위, 연구실적, 직무연수, 교과전담, 담임, 부장교사 등

기준일: **2026.2.28** / 평정기간: 2021.3.1 ~ 2026.2.28

## 참고 자료 (_refs/)

- `_refs/관외전보_점수계산_유초등.md` — 항목별 점수 계산 기준 (월점수, 상한, 중복규칙)
- `_refs/전보_대상여부_판단기준.md` — 학교만기·지역만기·일반희망 판단 기준
- `_refs/인사기록카드.xlsx` — 실제 NEIS 인사기록카드 예시 파일 (파싱 구조 참고용)
