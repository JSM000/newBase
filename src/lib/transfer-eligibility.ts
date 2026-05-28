import { CalculationResult, REFERENCE_DATE } from '@/types/score';

export interface TransferEligibilityInputs {
  currentSchoolExcludedMonths: number; // 현임교 공제 개월수 (일반파견·휴직)
  dongMonths: number;                  // 동지역 누적 근무 개월수
  eupMyeonMonths: number;              // 읍면지역 누적 근무 개월수
  isLeavePlanned: boolean;             // 2026.3.1. 휴직·파견 예정
  isRetirementSoon: boolean;           // 정년 잔여 1년 미만
}

export const defaultEligibilityInputs: TransferEligibilityInputs = {
  currentSchoolExcludedMonths: 0,
  dongMonths: 0,
  eupMyeonMonths: 0,
  isLeavePlanned: false,
  isRetirementSoon: false,
};

export type TransferType =
  | 'school_expiry'   // 학교만기
  | 'regional_expiry' // 지역만기
  | 'voluntary'       // 일반희망
  | 'too_early'       // 신청 불가 (2년 미만)
  | 'ineligible';     // 전보 불가

export interface TransferEligibilityResult {
  // 학교만기
  currentSchoolTotalMonths: number;
  currentSchoolAdjustedMonths: number;
  isSchoolExpiry: boolean;

  // 지역만기
  dongMonths: number;
  eupMyeonMonths: number;
  totalCheongjuMonths: number;
  isDongExpiry: boolean;
  isEupMyeonExpiry: boolean;
  isTotalExpiry: boolean;
  isRegionalExpiry: boolean;

  // 일반희망
  isVoluntaryEligible: boolean;

  // 전보불가
  isIneligible: boolean;
  ineligibleReasons: string[];

  // 최종 결과
  types: TransferType[];
  summary: string;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}`);
}

function countMonths(start: Date, end: Date): number {
  if (start >= end) return 0;
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  let total = years * 12 + months;
  if (days >= 15) total += 1;
  return Math.max(0, total);
}

export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months}개월`;
  if (rem === 0) return `${years}년`;
  return `${years}년 ${rem}개월`;
}

export function calculateTransferEligibility(
  result: CalculationResult,
  inputs: TransferEligibilityInputs,
): TransferEligibilityResult {
  // ── 전보불가 ──────────────────────────────────────────────────
  const ineligibleReasons: string[] = [];
  if (inputs.isLeavePlanned) ineligibleReasons.push('2026.3.1. 휴직·파견 예정');
  if (inputs.isRetirementSoon) ineligibleReasons.push('정년 잔여 1년 미만');
  const isIneligible = ineligibleReasons.length > 0;

  // ── 학교만기 ──────────────────────────────────────────────────
  // currentSchoolStart는 FIVE_YEAR_START 클리핑 없이 실제 부임일
  const schoolStartDate = parseDate(result.currentSchoolStart);
  const currentSchoolTotalMonths = schoolStartDate
    ? countMonths(schoolStartDate, REFERENCE_DATE)
    : 0;
  const currentSchoolAdjustedMonths = Math.max(
    0,
    currentSchoolTotalMonths - inputs.currentSchoolExcludedMonths,
  );
  const isSchoolExpiry = currentSchoolAdjustedMonths >= 60; // 5년 이상

  // ── 지역만기 ──────────────────────────────────────────────────
  const { dongMonths, eupMyeonMonths } = inputs;
  const totalCheongjuMonths = dongMonths + eupMyeonMonths;
  const isDongExpiry = dongMonths > 96;           // 동지역 8년 초과
  const isEupMyeonExpiry = eupMyeonMonths > 120;  // 읍면지역 10년 초과
  const isTotalExpiry = totalCheongjuMonths > 156; // 통산 13년 초과
  const isRegionalExpiry = isDongExpiry || isEupMyeonExpiry || isTotalExpiry;

  // ── 일반희망 ──────────────────────────────────────────────────
  const isVoluntaryEligible = currentSchoolAdjustedMonths >= 24; // 2년 이상

  // ── 최종 유형 결정 ────────────────────────────────────────────
  const types: TransferType[] = [];
  if (isIneligible) {
    types.push('ineligible');
  } else {
    if (isSchoolExpiry) types.push('school_expiry');
    if (isRegionalExpiry) types.push('regional_expiry');
    if (types.length === 0) {
      types.push(isVoluntaryEligible ? 'voluntary' : 'too_early');
    }
  }

  // ── 요약 문자열 ───────────────────────────────────────────────
  let summary: string;
  if (isIneligible) {
    summary = `전보 불가 — ${ineligibleReasons.join(', ')}`;
  } else if (isSchoolExpiry && isRegionalExpiry) {
    summary = '학교만기 + 지역만기 (전보 필수)';
  } else if (isSchoolExpiry) {
    summary = '학교만기 (전보 필수)';
  } else if (isRegionalExpiry) {
    summary = '지역만기 (전보 필수)';
  } else if (isVoluntaryEligible) {
    summary = '일반희망 신청 가능';
  } else {
    summary = `전보 신청 불가 — 현임교 ${formatMonths(currentSchoolAdjustedMonths)} (2년 미만)`;
  }

  return {
    currentSchoolTotalMonths,
    currentSchoolAdjustedMonths,
    isSchoolExpiry,
    dongMonths,
    eupMyeonMonths,
    totalCheongjuMonths,
    isDongExpiry,
    isEupMyeonExpiry,
    isTotalExpiry,
    isRegionalExpiry,
    isVoluntaryEligible,
    isIneligible,
    ineligibleReasons,
    types,
    summary,
  };
}
