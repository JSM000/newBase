// 기준일: 2026.2.28 / 5년 시작: 2021.3.1
export const REFERENCE_DATE = new Date('2026-02-28');
export const FIVE_YEAR_START = new Date('2021-03-01');
export const AWARD_NEIS_CUTOFF = new Date('2025-12-31');
export const PERF_NEIS_CUTOFF = new Date('2026-02-28');

export interface CareerEntry {
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  appointmentType: string;
  rank: string;
  department: string;
  school: string;
}

export interface AwardEntry {
  date: string;
  grade: string;
  name: string;
  agency: string;
}

export interface ResearchEntry {
  title: string;
  startDate: string;
  endDate: string;
  levelType: 'national' | 'provincial';
  grade: number;
  awardDate: string;
  researcherCount: number;
}

export interface TrainingEntry {
  id: string;
  name: string;
  institution: string;
  type: '직무연수' | '기타연수' | '자격연수';
  startDate: string;
  endDate: string;
  durationMinutes: number;
  workRelated: boolean;
  registrationDate: string;
  yearCumulative?: number; // NEIS 연도별연수시간누계 (분 단위)
}

export interface DegreeEntry {
  school: string;
  major: string;
  degree: '박사' | '석사';
  completionDate: string;
}

export interface SupplementaryEntry {
  type: 'subject_class' | 'homeroom' | 'special_ed' | 'multigrade' | 'other';
  startDate: string;
  endDate: string;
  detail: string;
  school: string;
  isAdminTeam: boolean;
}

export interface ParsedFile {
  schoolName: string;
  career: CareerEntry[];
  awards: AwardEntry[];
  research: ResearchEntry[];
  training: TrainingEntry[];
  degrees: DegreeEntry[];
  supplementary: SupplementaryEntry[];
  parseErrors: string[];
}

export type SchoolZoneType =
  | 'none'
  | 'cliff_ga'   // 벽지 가급지 0.095
  | 'cliff_na'   // 벽지 나급지 0.080
  | 'cliff_da'   // 벽지 다급지 0.065
  | 'cliff_ra'   // 벽지 라급지 0.050
  | 'remote'     // 오지 0.025
  | 'special';   // 북일초·서촌초 0.50

export type PreferentialBonusType =
  | 'none'
  | 'veteran'          // 국가유공자 봉양
  | 'elderly_parent'   // 75세 이상 노부모
  | 'disabled_family'  // 장애 심한 가족
  | 'three_children'   // 18세 이하 3자녀
  | 'second_child';    // 둘째 자녀 출산 (1회)

export type SportsRank = 'gold' | 'silver' | 'bronze';

export interface SportsAwardInput {
  year: number;
  rank: SportsRank;
}

// 보건교사·영양교사·사서교사·전문상담교사 등 특수직군 한정 실적점.
// 학급수·배치 조건 등 인사기록카드에 없는 정보가 필요해 수동 입력으로 처리.
export type SpecialRoleType =
  | 'none'
  | 'itinerant_health_special'      // 사. 순회교사(보건·특수) 월 0.01
  | 'admin_itinerant_before2024'    // 차. 교육행정기관 특수순회·전문상담순회(~2024.2.29) 월 0.03
  | 'admin_itinerant_after2024'     // 차. 교육행정기관 특수순회·전문상담순회(2024.3.1~) 월 0.04
  | 'admin_health_nutrition'        // 차. 교육행정기관 보건·영양교사(2025.3.1~) 월 0.02
  | 'meal_joint_mgmt'               // 아-가. 학교급식 공동관리 월 0.02
  | 'meal_joint_cook'               // 아-나. 학교급식 공동조리 월 0.01
  | 'meal_36plus'                   // 아-다. 36학급이상 급식학교 월 0.01
  | 'meal_45plus'                   // 아-라. 45학급이상 급식학교 월 0.02
  | 'meal_combined_under20'         // 아-마. 초중통합학교 20학급미만 월 0.01
  | 'meal_combined_over20'          // 아-바. 초중통합학교 20학급이상 월 0.02
  | 'health_25to37'                 // 하-가. 25~37학급 월 0.01
  | 'health_38plus'                 // 하-나. 38학급이상·1000명이상 월 0.02
  | 'health_combined_under20'       // 하-다. 초중통합학교 20학급미만 월 0.01
  | 'health_combined_over20'        // 하-라. 초중통합학교 20학급이상 월 0.02
  | 'unfavorable_region_librarian'; // 카. 비선호지역(제천·영동·단양) 사서교사 월 0.03

export interface UserInputs {
  teacherType: 'elementary' | 'kindergarten';
  schoolZone: SchoolZoneType;
  preferentialBonus: PreferentialBonusType;
  preferentialBonusMonths: number;
  headTeacherSchoolZone: 'urban' | 'rural_large' | 'rural_small';
  sportsAwards: SportsAwardInput[];
  specialRoleType: SpecialRoleType;
  specialRoleMonths: number;
}

export interface AwardScoreDetail {
  year: number;
  award: AwardEntry;
  score: number;
  used: boolean;
  reason: string;
}

export interface ResearchScoreDetail {
  research: ResearchEntry;
  baseScore: number;
  discountRate: number;
  finalScore: number;
  used: boolean;
  reason: string;
}

export interface TrainingYearDetail {
  schoolYear: number;
  totalMinutes: number;
  qualifies: boolean;
  score: number;
  entries: string[];
}

export interface CalculationResult {
  careerMonths: number;
  currentSchool: string;
  currentSchoolStart: string;
  careerScore: number;

  regionalBonusPerMonth: number;
  regionalBonusMonths: number;
  regionalBonusScore: number;

  preferentialBonusPerMonth: number;
  preferentialBonusMonths: number;
  preferentialBonusScore: number;

  awardDetails: AwardScoreDetail[];
  awardScore: number;

  researchDetails: ResearchScoreDetail[];
  researchScore: number;

  degreeScore: number;
  degreeType: string;

  trainingByYear: TrainingYearDetail[];
  trainingScore: number;

  subjectClassMonths: number;
  subjectClassScore: number;

  homeroomMonths: number;
  homeroomScore: number;

  headTeacherMonths: number;
  headTeacherScore: number;

  conflictResolution: string;

  specialEdMonths: number;
  specialEdScore: number;

  multigradeMonths: number;
  multigradeScore: number;

  sportsDetails: { year: number; rank: SportsRank; score: number; used: boolean; reason: string }[];
  sportsScore: number;

  kindergartenSupportMonths: number;
  kindergartenSupportScore: number;

  specialRoleScore: number;
  specialRoleLabel: string;

  totalCareer: number;
  totalBonus: number;
  totalPerformance: number;
  grandTotal: number;
}
