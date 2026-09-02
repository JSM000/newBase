/**
 * 지도에서 마커 색상으로 시각화할 수 있는 "표시 지표" 정의 + 상세 패널 필드 그룹.
 *
 * 계획 문서 _refs/학교통계_지도_구현계획.md 의 2-1(점수 참고) / 2-2(근무여건 참고) 구분을
 * 저장 구조가 아니라 여기(프론트 표시 단계)에서 매핑한다.
 *
 * bucket 경계값(thresholds)은 524개 학교 분포를 보고 잡은 1차값이며,
 * 실제 분포 확인 후 조정 가능(계획 4-4 미해결 항목).
 */

import type { School } from '@/types/school-stats';

export type IndicatorCategory = 'score' | 'work';

/**
 * 구간별 색상 (낮음 -> 높음). 5단계.
 * 카카오맵 파스텔톤 배경과 대비되도록 채도를 높였고, dataviz 스킬의 validate_palette.js로
 * 인접 구간 간 색약 구분성(CVD ΔE)·명도밴드·채도하한 기준을 통과시킨 값.
 */
export const BUCKET_COLORS = ['#0891b2', '#22c55e', '#a16207', '#fb923c', '#b91c1c'] as const;
export const NO_DATA_COLOR = '#c7ccd1';

export interface Indicator {
  key: string;
  label: string;
  /** 값을 꺼내는 함수 (없으면 null) */
  accessor: (s: School) => number | null;
  unit?: string;
  category: IndicatorCategory;
  /** Tier2 간접 추정치면 true — UI에 "추정치" 표기 */
  estimated?: boolean;
  /** null일 때 사유가 담긴 School 필드 */
  excludedReasonField?: keyof School;
  /**
   * 구간 경계값. 오름차순 4개 -> 5개 구간.
   * 값 < t[0] -> 0, t[0] <= 값 < t[1] -> 1, ..., 값 >= t[3] -> 4
   */
  thresholds: [number, number, number, number];
  /** 값이 낮을수록 "부담이 큰" 지표면 true (색상 의미 반전은 하지 않고 설명만 뒤집음) */
  lowerIsHeavier?: boolean;
  description: string;
  format?: (v: number) => string;
}

const num = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export const INDICATORS: Indicator[] = [
  // ─────────────── 2-1 전보 점수 관련 참고 지표 ───────────────
  {
    key: 'homeroomClassCount',
    label: '학급수 (담임 자리)',
    accessor: (s) => num(s.homeroomClassCount),
    unit: '학급',
    category: 'score',
    excludedReasonField: 'schoolStatusExcludedReason',
    thresholds: [6, 12, 24, 36],
    description:
      '학급수 = 담임 배정 가능 자리 수. 담임(월 0.02점) 확보 가능성을 가늠. 학년수(초 6)보다 작으면 복식학급 가능성.',
  },
  {
    key: 'specialClassCount',
    label: '특수학급 수',
    accessor: (s) => num(s.specialClassCount),
    unit: '학급',
    category: 'score',
    excludedReasonField: 'schoolStatusExcludedReason',
    thresholds: [1, 2, 3, 5],
    description: '특수통합학급 담임(월 0.01점) 자리. 통합교육 업무 부담과도 연결.',
  },
  {
    key: 'deputyPrincipalTeacherCount',
    label: '보직(부장)교사 수',
    accessor: (s) => num(s.deputyPrincipalTeacherCount),
    unit: '명',
    category: 'score',
    excludedReasonField: 'teacherStatusExcludedReason',
    thresholds: [3, 5, 8, 12],
    description: '보직교사(계) = 부장교사 자리 수. 부장교사 실적점(월 0.02~0.03점) 확보 가능성.',
  },
  {
    key: 'specialistSubjectTeacherEstimate',
    label: '교과전담 규모 (추정)',
    accessor: (s) => num(s.specialistSubjectTeacherEstimate),
    unit: '명',
    category: 'score',
    estimated: true,
    excludedReasonField: 'subjectTeacherExcludedReason',
    thresholds: [1, 2, 4, 6],
    description:
      'Tier2 추정치. 초등부 과목별 교원수 합으로 교과전담(월 0.03점) 운영 규모만 짐작(명시 필드 없음). 초등학교만 값이 있음.',
  },

  // ─────────────── 2-2 근무 난이도·편의성 참고 지표 ───────────────
  {
    key: 'studentCountTotal',
    label: '전체 학생수',
    accessor: (s) => num(s.studentCountTotal),
    unit: '명',
    category: 'work',
    excludedReasonField: 'schoolStatusExcludedReason',
    thresholds: [60, 200, 500, 900],
    description: '학교 규모. 소규모교는 업무 다중분장, 대규모교는 학생·민원 절대량이 큼.',
  },
  {
    key: 'avgStudentsPerClass',
    label: '학급당 학생수',
    accessor: (s) => num(s.avgStudentsPerClass),
    unit: '명',
    category: 'work',
    excludedReasonField: 'schoolStatusExcludedReason',
    thresholds: [10, 18, 24, 28],
    description: '과밀학급 여부. 값이 클수록 담임 업무·생활지도 부담 증가.',
  },
  {
    key: 'avgWeeklyTeachingHoursPerTeacher',
    label: '교사 1인당 주당 수업시수',
    accessor: (s) => num(s.avgWeeklyTeachingHoursPerTeacher),
    unit: '시간',
    category: 'work',
    excludedReasonField: 'teachingHoursExcludedReason',
    thresholds: [18, 20, 22, 24],
    description: '값이 클수록 수업 부담이 큼.',
  },
  {
    key: 'contractTeacherCount',
    label: '기간제교사 수',
    accessor: (s) => num(s.contractTeacherCount),
    unit: '명',
    category: 'work',
    excludedReasonField: 'teacherStatusExcludedReason',
    thresholds: [1, 3, 6, 10],
    description: '정교사 인력 안정성 참고. 기간제 비중이 크면 업무 연속성·분장 부담이 커질 수 있음.',
  },
  {
    key: 'teacherOnLeaveCount',
    label: '휴직교원 수',
    accessor: (s) => num(s.teacherOnLeaveCount),
    unit: '명',
    category: 'work',
    excludedReasonField: 'teacherStatusExcludedReason',
    thresholds: [1, 3, 5, 8],
    description: '인력 공백 규모 참고.',
  },
  {
    key: 'specialClassStudentCount',
    label: '특수학급 학생수',
    accessor: (s) => num(s.specialClassStudentCount),
    unit: '명',
    category: 'work',
    excludedReasonField: 'schoolStatusExcludedReason',
    thresholds: [1, 8, 15, 25],
    description: '통합교육 관련 업무량 참고.',
  },
  {
    key: 'transferChurnRate',
    label: '전입출 학생 비율',
    accessor: (s) => {
      const total = num(s.studentCountTotal);
      const churn =
        (num(s.transferInStudentCount) ?? 0) + (num(s.transferOutStudentCount) ?? 0);
      if (total === null || total === 0) return null;
      if (s.transferInStudentCount === null && s.transferOutStudentCount === null) return null;
      return (churn / total) * 100;
    },
    unit: '%',
    category: 'work',
    excludedReasonField: 'transferStudentExcludedReason',
    thresholds: [3, 7, 12, 20],
    description: '(전입+전출) / 전체 학생수. 전입출이 잦으면 학급 운영·기록 업무가 늘어남.',
    format: (v) => v.toFixed(1),
  },
  {
    key: 'supportStaffCount',
    label: '행정 지원인력 (일반직+공무직)',
    accessor: (s) => {
      if (s.generalStaffCount === null && s.eduSupportStaffCount === null) return null;
      return (num(s.generalStaffCount) ?? 0) + (num(s.eduSupportStaffCount) ?? 0);
    },
    unit: '명',
    category: 'work',
    excludedReasonField: 'staffExcludedReason',
    thresholds: [5, 9, 14, 20],
    lowerIsHeavier: true,
    description: '일반직 + 교육공무직 인원. 많을수록 교사가 행정업무를 덜 떠안을 가능성.',
  },
  {
    key: 'scholarshipSupportRate',
    label: '장학·학비지원 학생 비율',
    accessor: (s) => {
      const total = num(s.studentCountTotal);
      if (total === null || total === 0) return null;
      if (s.scholarshipRecipientCount === null && s.tuitionSupportRecipientCount === null)
        return null;
      const cnt =
        (num(s.scholarshipRecipientCount) ?? 0) + (num(s.tuitionSupportRecipientCount) ?? 0);
      return (cnt / total) * 100;
    },
    unit: '%',
    category: 'work',
    estimated: true,
    excludedReasonField: 'scholarshipExcludedReason',
    thresholds: [3, 8, 15, 25],
    description:
      'Tier2 추정치. (장학금 + 학비지원 인원) / 전체 학생수로 저소득층 비율을 짐작 — 복지·생활지도 업무량 참고.',
    format: (v) => v.toFixed(1),
  },
];

export const INDICATOR_BY_KEY: Record<string, Indicator> = Object.fromEntries(
  INDICATORS.map((i) => [i.key, i]),
);

export const DEFAULT_INDICATOR_KEY = 'studentCountTotal';

/** 값 -> 구간 인덱스(0~4). 값이 null이면 null. */
export function bucketIndex(indicator: Indicator, value: number | null): number | null {
  if (value === null) return null;
  const t = indicator.thresholds;
  if (value < t[0]) return 0;
  if (value < t[1]) return 1;
  if (value < t[2]) return 2;
  if (value < t[3]) return 3;
  return 4;
}

export function bucketColor(indicator: Indicator, value: number | null): string {
  const idx = bucketIndex(indicator, value);
  return idx === null ? NO_DATA_COLOR : BUCKET_COLORS[idx];
}

/** 범례에 쓸 구간 라벨 (예: "< 60", "60 ~ 200", ..., "900 이상") */
export function bucketLabels(indicator: Indicator): string[] {
  const [a, b, c, d] = indicator.thresholds;
  return [`< ${a}`, `${a} ~ ${b}`, `${b} ~ ${c}`, `${c} ~ ${d}`, `${d} 이상`];
}

// ─────────────── 상세 패널 필드 그룹 ───────────────

export interface DetailField {
  label: string;
  render: (s: School) => string;
  /** 값이 null일 때 볼 사유 필드 */
  excludedReasonField?: keyof School;
  estimated?: boolean;
}

const yn = (v: boolean | null): string => (v === null ? '—' : v ? '있음' : '없음');
const n = (v: number | null, unit = ''): string => (v === null ? '—' : `${v}${unit}`);
const ymd = (v: string | null): string =>
  v && v.length === 8 ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)}` : '—';

export interface DetailGroup {
  title: string;
  category: IndicatorCategory;
  fields: DetailField[];
}

export const DETAIL_GROUPS: DetailGroup[] = [
  {
    title: '전보 점수 참고',
    category: 'score',
    fields: [
      {
        label: '학급수 (담임 자리)',
        render: (s) => n(s.homeroomClassCount, ' 학급'),
        excludedReasonField: 'schoolStatusExcludedReason',
      },
      {
        label: '특수학급',
        render: (s) =>
          s.specialClassCount === null
            ? '—'
            : `${s.specialClassCount} 학급 · 학생 ${s.specialClassStudentCount ?? 0}명`,
        excludedReasonField: 'schoolStatusExcludedReason',
      },
      {
        label: '보직(부장)교사',
        render: (s) => n(s.deputyPrincipalTeacherCount, ' 명'),
        excludedReasonField: 'teacherStatusExcludedReason',
      },
      {
        label: '교과전담 규모 (추정)',
        render: (s) => n(s.specialistSubjectTeacherEstimate, ' 명'),
        excludedReasonField: 'subjectTeacherExcludedReason',
        estimated: true,
      },
      {
        label: '복식학급 가능성 (추정)',
        render: (s) => {
          if (s.homeroomClassCount === null) return '—';
          if (s.schulKndCode !== '02') return '해당 없음 (초등만)';
          return s.homeroomClassCount < 6
            ? `가능성 있음 (학급 ${s.homeroomClassCount} < 학년 6)`
            : '낮음';
        },
        excludedReasonField: 'schoolStatusExcludedReason',
        estimated: true,
      },
    ],
  },
  {
    title: '근무 여건 참고',
    category: 'work',
    fields: [
      {
        label: '학생수 / 학급당',
        render: (s) =>
          s.studentCountTotal === null
            ? '—'
            : `${s.studentCountTotal}명 · 학급당 ${s.avgStudentsPerClass ?? '—'}명`,
        excludedReasonField: 'schoolStatusExcludedReason',
      },
      {
        label: '교사 1인당 주당 수업시수',
        render: (s) => n(s.avgWeeklyTeachingHoursPerTeacher, ' 시간'),
        excludedReasonField: 'teachingHoursExcludedReason',
      },
      {
        label: '전체 교원수',
        render: (s) => n(s.teacherCountTotal, ' 명'),
        excludedReasonField: 'teacherStatusExcludedReason',
      },
      {
        label: '기간제 · 강사 · 휴직',
        render: (s) =>
          s.teacherStatusExcludedReason
            ? '—'
            : `기간제 ${s.contractTeacherCount ?? 0} · 강사 ${s.instructorCount ?? 0} · 휴직 ${s.teacherOnLeaveCount ?? 0}`,
        excludedReasonField: 'teacherStatusExcludedReason',
      },
      {
        label: '보건 · 영양 · 사서교사',
        render: (s) =>
          s.teacherStatusExcludedReason
            ? '—'
            : `보건 ${yn((s.healthTeacherCount ?? 0) > 0)} · 영양 ${yn((s.nutritionTeacherCount ?? 0) > 0)} · 사서 ${yn((s.librarianTeacherCount ?? 0) > 0)}`,
        excludedReasonField: 'teacherStatusExcludedReason',
      },
      {
        label: '전입 · 전출 학생수',
        render: (s) =>
          s.transferInStudentCount === null && s.transferOutStudentCount === null
            ? '—'
            : `전입 ${s.transferInStudentCount ?? 0} · 전출 ${s.transferOutStudentCount ?? 0}`,
        excludedReasonField: 'transferStudentExcludedReason',
      },
      {
        label: '행정 지원인력',
        render: (s) =>
          s.generalStaffCount === null && s.eduSupportStaffCount === null
            ? '—'
            : `일반직 ${s.generalStaffCount ?? 0} · 공무직 ${s.eduSupportStaffCount ?? 0}`,
        excludedReasonField: 'staffExcludedReason',
      },
      {
        label: '상담 지원체계',
        render: (s) =>
          s.counselingExcludedReason
            ? '—'
            : `내부상담 ${yn(s.hasInnerCounselor)} · 외부상담 ${yn(s.hasOuterCounselor)} · Wee클래스 ${yn(s.hasWeeClass)}`,
        excludedReasonField: 'counselingExcludedReason',
      },
      {
        label: '급식 배식 장소',
        render: (s) => {
          if (s.mealExcludedReason) return '—';
          if (s.mealPlaceCafeteria && s.mealPlaceClassroom) return '식당 + 교실';
          if (s.mealPlaceCafeteria) return '식당';
          if (s.mealPlaceClassroom) return '교실';
          return '—';
        },
        excludedReasonField: 'mealExcludedReason',
      },
      {
        label: '시설안전 점검',
        render: (s) => {
          if (s.facilitySafetyExcludedReason) return '—';
          if (s.facilitySafetyAllOk === null) return '—';
          const date = ymd(s.facilitySafetyLatestCheckDate);
          return s.facilitySafetyAllOk
            ? `이상 없음 (최근 ${date})`
            : `이상 ${s.facilitySafetyIssueCount ?? 0}건 — ${s.facilitySafetyIssueLedgerNames || '대장 미상'} (최근 ${date})`;
        },
        excludedReasonField: 'facilitySafetyExcludedReason',
      },
      {
        label: '교원지원공간 · 체육관 · 강당',
        render: (s) =>
          `지원공간 ${n(s.teacherSupportSpaceCount)} · 체육관 ${n(s.gymnasiumCount)} · 강당 ${n(s.auditoriumCount)}`,
        excludedReasonField: 'facilitiesExcludedReason',
      },
      {
        label: '장학 · 학비지원 학생수 (추정 참고)',
        render: (s) =>
          s.scholarshipRecipientCount === null && s.tuitionSupportRecipientCount === null
            ? '—'
            : `장학 ${s.scholarshipRecipientCount ?? 0} · 학비지원 ${s.tuitionSupportRecipientCount ?? 0}`,
        excludedReasonField: 'scholarshipExcludedReason',
        estimated: true,
      },
    ],
  },
];
