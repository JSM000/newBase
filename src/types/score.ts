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
  teacherName: string;
  career: CareerEntry[];
  awards: AwardEntry[];
  research: ResearchEntry[];
  training: TrainingEntry[];
  degrees: DegreeEntry[];
  supplementary: SupplementaryEntry[];
  rawSections: Record<string, string>;
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

export interface UserInputs {
  teacherType: 'elementary' | 'kindergarten';
  schoolZone: SchoolZoneType;
  preferentialBonus: PreferentialBonusType;
  preferentialBonusMonths: number;
  headTeacherSchoolZone: 'urban' | 'rural_large' | 'rural_small';
  headTeacherClassCount: number;
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

  totalCareer: number;
  totalBonus: number;
  totalPerformance: number;
  grandTotal: number;
}
