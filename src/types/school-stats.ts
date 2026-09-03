/**
 * public/data/chungbuk-schools-render.json 스키마 (프론트가 실제로 fetch하는 최적화 파일).
 * 원본(chungbuk-schools.json)에서 프론트가 안 쓰는 필드/source 메타를 제거해 이 모양으로 만든다.
 * 수집 스크립트: scripts/collect-school-stats.mjs (원본) → scripts/build-schools-dataset.mjs (최적화)
 * 계획 문서: _refs/학교통계_지도_구현계획.md
 */

export interface SchoolPosition {
  lat: number;
  lng: number;
}

/** 학교급 코드: 02 초등 / 03 중등 / 04 고등 (유치원은 학교알리미 schulKndCode에 없음) */
export type SchulKndCode = '02' | '03' | '04';

export interface School {
  // --- 학교기본정보(0) ---
  schulCode: string;
  schulNm: string;
  schulKndCode: SchulKndCode;
  fondScCode: string | null; // "공립" / "사립" 등
  eduSupportOfficeNm: string | null; // 예: "충청북도청주교육지원청"
  adrcdNm: string | null; // 예: "충청북도 청주시 흥덕구"
  address: string | null;
  roadAddress: string | null;
  foundedYmd: string | null; // YYYYMMDD
  position: SchoolPosition | null;

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

  // --- 파생 지표 (여러 데이터셋 병합 후 collect-school-stats.mjs의 DERIVED_FIELDS가 계산) ---
  transferChurnRate: number | null; // (전입+전출) / 전체학생수 * 100
  supportStaffCount: number | null; // 일반직 + 교육공무직
  scholarshipSupportRate: number | null; // (장학금+학비지원) / 전체학생수 * 100

  // --- 파생 필드: 지도 행정구역 클러스터링용 소속명 (adrcdNm/address 파싱 결과, collect-school-stats.mjs가 계산) ---
  sigunguName: string | null; // 시·군 (예: "청주시", "단양군")
  subRegionName: string | null; // 구/읍/면/동 (예: "흥덕구", "가덕면")
}

export interface ChungbukSchoolsData {
  generatedAt: string;
  sourceGeneratedAt: string;
  count: number;
  schools: School[];
}
