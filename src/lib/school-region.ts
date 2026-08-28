import type { School } from '@/types/school-stats';

/**
 * adrcdNm(예: "충청북도 청주시 흥덕구", "충청북도 단양군")에서 시·군 단위를 뽑는다.
 * 청주시는 하위에 구가 있지만 시·군 필터 단위는 "청주시"로 통일.
 */
export function sigunguOf(school: School): string | null {
  const src = school.adrcdNm ?? school.address ?? '';
  const token = src.split(/\s+/).find((t) => /(시|군)$/.test(t) && t !== '충청북도');
  return token ?? null;
}

/** 충북 11개 시·군 표시 순서 (청주 먼저, 나머지 가나다) */
export const CHUNGBUK_SIGUNGU_ORDER = [
  '청주시',
  '충주시',
  '제천시',
  '괴산군',
  '단양군',
  '보은군',
  '영동군',
  '옥천군',
  '음성군',
  '증평군',
  '진천군',
];

export function sortSigungu(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const ia = CHUNGBUK_SIGUNGU_ORDER.indexOf(a);
    const ib = CHUNGBUK_SIGUNGU_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'ko');
  });
}

export const SCHOOL_LEVEL_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '02', label: '초등학교' },
  { value: '03', label: '중학교' },
  { value: '04', label: '고등학교' },
] as const;

export type SchoolLevelFilter = (typeof SCHOOL_LEVEL_OPTIONS)[number]['value'];
