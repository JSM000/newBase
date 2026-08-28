/**
 * public/data/chungbuk-schools.json 스키마.
 * 수집 스크립트: scripts/collect-school-stats.mjs
 * 계획 문서: _refs/학교통계_지도_구현계획.md
 */

export interface SchoolPosition {
  lat: number;
  lng: number;
}

/** 학교알리미 시트(엔드포인트) 하나에 대한 메타. 원본 API 필드명 매핑을 그대로 실어둠. */
export interface SchoolStatsDataset {
  apiType: string;
  name: string;
  fields: string[];
  /** 이 데이터셋 필드가 null일 때 사유를 담고 있는 필드명 (공시제외 등) */
  excludedReasonField: string | null;
  /** 저장 필드명 -> 원본 API 필드명 (여러 필드를 합친 경우 배열) */
  fieldSource: Record<string, string | string[]> | null;
}

export interface SchoolStatsSource {
  api: string;
  datasets: SchoolStatsDataset[];
  sidoCode: string;
  sidoName: string;
  sggCodes: string[];
  schulKndCodes: string[];
}

/** 학교급 코드: 02 초등 / 03 중등 / 04 고등 (유치원은 학교알리미 schulKndCode에 없음) */
export type SchulKndCode = '02' | '03' | '04';

export interface School {
  // --- 학교기본정보(0) ---
  schulCode: string;
  schulNm: string;
  schulKndCode: SchulKndCode;
  schulKndNm: string;
  fondScCode: string | null; // "공립" / "사립" 등
  sidoOfficeNm: string | null;
  eduSupportOfficeNm: string | null; // 예: "충청북도청주교육지원청"
  adrcdNm: string | null; // 예: "충청북도 청주시 흥덕구"
  lctnScCode: string | null; // 소재지구분코드
  address: string | null;
  detailAddress: string | null;
  roadAddress: string | null;
  zipCode: string | null;
  foundedYmd: string | null; // YYYYMMDD
  position: SchoolPosition | null;
  tel: string | null;
  homepage: string | null;
  isBranchSchool: boolean;
  isClosed: boolean;
  isSuspended: boolean;

  // --- 학교 현황(62) ---
  homeroomClassCount: number | null; // 학급수계 = 담임 자리 수
  studentCountTotal: number | null;
  avgStudentsPerClass: number | null;
  specialClassCount: number | null; // 특수학급 학급수
  specialClassStudentCount: number | null;
  schoolStatusExcludedReason: string | null;

  // --- 직위별 교원 현황(22) ---
  deputyPrincipalTeacherCount: number | null; // 보직교사(계) = 부장교사 자리 수
  teacherCountTotal: number | null;
  contractTeacherCount: number | null; // 기간제교사
  instructorCount: number | null; // 강사
  teacherOnLeaveCount: number | null; // 휴직교원수
  healthTeacherCount: number | null;
  nutritionTeacherCount: number | null;
  librarianTeacherCount: number | null;
  teacherStatusExcludedReason: string | null;

  // --- 표시과목별 교원 현황(24) ---
  specialistSubjectTeacherEstimate: number | null; // 초등 전용, Tier2 교과전담 규모 추정
  specialistSubjectTeacherBySubject: Record<string, number> | null;
  subjectTeacherExcludedReason: string | null;
  subjectTeacherSecondaryExcludedReason: string | null;

  // --- 수업일수 및 수업시수 현황(08) ---
  avgWeeklyTeachingHoursPerTeacher: number | null;
  teachingHoursExcludedReason: string | null;

  // --- 전·출입 및 학업중단 학생 수(10) ---
  transferInStudentCount: number | null;
  transferOutStudentCount: number | null;
  transferStudentExcludedReason: string | null;

  // --- 대상별 학교폭력 예방교육 실적(94) ---
  bullyingPreventionInstructorCount: number | null;
  bullyingPreventionExcludedReason: string | null;

  // --- 직원 현황(68) ---
  generalStaffCount: number | null; // 일반직
  eduSupportStaffCount: number | null; // 교육공무직
  staffExcludedReason: string | null;

  // --- 학생·학부모 상담계획 및 실시 현황(61) ---
  hasInnerCounselor: boolean | null;
  hasOuterCounselor: boolean | null;
  hasWeeClass: boolean | null;
  counselingExcludedReason: string | null;

  // --- 급식 실시 현황(34) ---
  mealPlaceCafeteria: boolean | null;
  mealPlaceClassroom: boolean | null;
  mealExcludedReason: string | null;

  // --- 시설안전 점검 현황(44) ---
  facilitySafetyAllOk: boolean | null;
  facilitySafetyIssueCount: number | null;
  facilitySafetyIssueLedgerNames: string | null;
  facilitySafetyLatestCheckDate: string | null; // YYYYMMDD
  facilitySafetyExcludedReason: string | null;

  // --- 교사(校舍) 현황(17) ---
  teacherSupportSpaceCount: number | null;
  teacherSupportSpaceExcludedReason: string | null;

  // --- 학생교육활동에 필요한 지원시설 현황(18) ---
  gymnasiumCount: number | null;
  auditoriumCount: number | null;
  facilitiesExcludedReason: string | null;

  // --- 장학금 수혜 현황(55) ---
  scholarshipRecipientCount: number | null;
  tuitionSupportRecipientCount: number | null;
  scholarshipExcludedReason: string | null;
}

export interface ChungbukSchoolsData {
  generatedAt: string;
  source: SchoolStatsSource;
  count: number;
  schools: School[];
}
