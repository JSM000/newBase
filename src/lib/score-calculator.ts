import {
  ParsedFile,
  UserInputs,
  CalculationResult,
  AwardScoreDetail,
  ResearchScoreDetail,
  TrainingYearDetail,
  REFERENCE_DATE,
  FIVE_YEAR_START,
  AWARD_NEIS_CUTOFF,
  PERF_NEIS_CUTOFF,
} from '@/types/score';

function countMonths(start: Date, end: Date): number {
  if (start >= end) return 0;
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  let total = years * 12 + months;
  if (days >= 15) total += 1;
  return Math.max(0, total);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}`);
}

function isWithin5Years(dateStr: string): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return d >= FIVE_YEAR_START && d <= REFERENCE_DATE;
}

function isBeforeCutoff(dateStr: string, cutoff: Date): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return d <= cutoff;
}

const AWARD_SCORE_MAP: Record<string, number> = {
  '훈장': 1.25,
  '포장': 1.25,
  '모범공무원': 1.25,
  '대통령표창': 1.00,
  '국무총리표창': 0.75,
  '장관표창': 0.50,
  '교육감표창': 0.25,
  '교육장표창': 0.125,
  '직속기관장표창': 0.125,
  '교육장상장': 0.125,
};

function getAwardScore(grade: string): number {
  for (const [key, val] of Object.entries(AWARD_SCORE_MAP)) {
    if (grade.includes(key)) return val;
  }
  return 0;
}

const REGIONAL_BONUS_MAP: Record<string, number> = {
  'none': 0,
  'cliff_ga': 0.095,
  'cliff_na': 0.080,
  'cliff_da': 0.065,
  'cliff_ra': 0.050,
  'remote': 0.025,
  'special': 0.50,
};

function getSchoolYear(dateStr: string): number {
  const d = parseDate(dateStr);
  if (!d) return 0;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 3 ? year : year - 1;
}

function getResearchBaseScore(levelType: 'national' | 'provincial', grade: number): number {
  if (levelType === 'national') {
    return [0, 1.00, 0.75, 0.50][grade] ?? 0;
  } else {
    return [0, 0.50, 0.375, 0.25][grade] ?? 0;
  }
}

function getResearchDiscount(count: number): number {
  if (count <= 1) return 1.0;
  if (count === 2) return 0.7;
  if (count === 3) return 0.5;
  return 0.3;
}

export function calculateScore(parsed: ParsedFile, inputs: UserInputs): CalculationResult {

  const schoolCareer = parsed.career
    .filter(c => c.school && (c.school.includes('초등학교') || c.school.includes('유치원')))
    .sort((a, b) => {
      const da = parseDate(a.startDate)?.getTime() ?? 0;
      const db = parseDate(b.startDate)?.getTime() ?? 0;
      return da - db;
    });

  let currentSchool = parsed.schoolName || '';
  let currentSchoolStartDate: Date | null = null;

  if (schoolCareer.length > 0) {
    const lastSchool = schoolCareer[schoolCareer.length - 1].school;
    currentSchool = lastSchool || currentSchool;
    const firstEntry = schoolCareer.find(c => c.school === lastSchool);
    if (firstEntry) currentSchoolStartDate = parseDate(firstEntry.startDate);
  }

  let careerMonths = 0;
  for (const c of schoolCareer) {
    const start = parseDate(c.startDate);
    const end = c.endDate ? parseDate(c.endDate) : REFERENCE_DATE;
    if (!start || !end) continue;
    const adjStart = start < FIVE_YEAR_START ? FIVE_YEAR_START : start;
    const adjEnd = end > REFERENCE_DATE ? REFERENCE_DATE : end;
    careerMonths += countMonths(adjStart, adjEnd);
  }
  const careerScore = Math.min(careerMonths, 60);

  const currentSchoolStart = currentSchoolStartDate && currentSchoolStartDate > FIVE_YEAR_START
    ? currentSchoolStartDate
    : FIVE_YEAR_START;
  const currentSchoolMonths = countMonths(currentSchoolStart, REFERENCE_DATE);
  const regionalBonusPerMonth = REGIONAL_BONUS_MAP[inputs.schoolZone] ?? 0;
  const regionalBonusScore = parseFloat((regionalBonusPerMonth * currentSchoolMonths).toFixed(4));

  const preferentialBonusPerMonth = inputs.preferentialBonus !== 'none' ? 0.025 : 0;
  const preferentialBonusMonths = inputs.preferentialBonusMonths;
  const preferentialBonusScore = parseFloat((preferentialBonusPerMonth * preferentialBonusMonths).toFixed(4));

  const awardDetails: AwardScoreDetail[] = [];
  const awardsInWindow = parsed.awards
    .filter(a => isWithin5Years(a.date) && isBeforeCutoff(a.date, AWARD_NEIS_CUTOFF))
    .map(a => ({ award: a, score: getAwardScore(a.grade), year: parseInt(a.date.substring(0, 4)) }))
    .filter(a => a.score > 0)
    .sort((a, b) => a.year - b.year || b.score - a.score);

  const usedYears = new Set<number>();
  let usedCount = 0;
  for (const a of awardsInWindow) {
    const used = !usedYears.has(a.year) && usedCount < 2;
    awardDetails.push({
      year: a.year,
      award: a.award,
      score: a.score,
      used,
      reason: used ? `${a.year}년 최상위 적용` : usedYears.has(a.year) ? `${a.year}년 이미 최상위 포상 적용됨` : '포상 최대 2개 초과',
    });
    if (used) { usedYears.add(a.year); usedCount++; }
  }

  parsed.awards
    .filter(a => isWithin5Years(a.date) && isBeforeCutoff(a.date, AWARD_NEIS_CUTOFF) && getAwardScore(a.grade) === 0)
    .forEach(a => {
      awardDetails.push({
        year: parseInt(a.date.substring(0, 4)),
        award: a,
        score: 0,
        used: false,
        reason: '점수 대상 훈격 아님 (상장 등)',
      });
    });

  const awardScore = parseFloat(awardDetails.filter(d => d.used).reduce((s, d) => s + d.score, 0).toFixed(4));

  const researchDetails: ResearchScoreDetail[] = [];
  const researchInWindow = parsed.research
    .filter(r => isWithin5Years(r.awardDate) && isBeforeCutoff(r.awardDate, AWARD_NEIS_CUTOFF));

  const usedResearchYears = new Set<number>();
  let usedResearchCount = 0;

  for (const r of researchInWindow.sort((a, b) => {
    const scoreA = getResearchBaseScore(a.levelType, a.grade) * getResearchDiscount(a.researcherCount);
    const scoreB = getResearchBaseScore(b.levelType, b.grade) * getResearchDiscount(b.researcherCount);
    return scoreB - scoreA;
  })) {
    const year = parseInt(r.awardDate.substring(0, 4));
    const base = getResearchBaseScore(r.levelType, r.grade);
    const discount = getResearchDiscount(r.researcherCount);
    const final = parseFloat((base * discount).toFixed(4));
    const used = !usedResearchYears.has(year) && usedResearchCount < 2;
    researchDetails.push({
      research: r,
      baseScore: base,
      discountRate: discount,
      finalScore: final,
      used,
      reason: used
        ? `${year}년 최상위 적용 (${r.researcherCount}인 공동 ${Math.round(discount * 100)}할)`
        : usedResearchYears.has(year) ? `${year}년 이미 최상위 연구실적 적용됨` : '연구실적 최대 2개 초과',
    });
    if (used) { usedResearchYears.add(year); usedResearchCount++; }
  }

  const researchScore = parseFloat(researchDetails.filter(d => d.used).reduce((s, d) => s + d.finalScore, 0).toFixed(4));

  let degreeScore = 0;
  let degreeType = '';
  const validDegrees = parsed.degrees.filter(d =>
    d.completionDate ? isBeforeCutoff(d.completionDate, AWARD_NEIS_CUTOFF) : true
  );
  if (validDegrees.some(d => d.degree === '박사')) { degreeScore = 2.0; degreeType = '박사학위'; }
  else if (validDegrees.some(d => d.degree === '석사')) { degreeScore = 1.0; degreeType = '석사학위'; }

  const SCHOOL_YEARS = [2021, 2022, 2023, 2024, 2025];
  const trainingByYear: TrainingYearDetail[] = [];

  for (const sy of SCHOOL_YEARS) {
    const syStart = new Date(`${sy}-03-01`);
    const syQualCutoff = new Date(`${sy}-12-31`);
    const syEnd = new Date(`${sy + 1}-02-28`);

    const relevantTraining = parsed.training.filter(t => {
      if (t.type !== '직무연수' || !t.workRelated) return false;
      const endD = parseDate(t.endDate);
      const regD = parseDate(t.registrationDate) ?? endD;
      if (!endD) return false;
      return endD >= syStart && endD <= syEnd && (regD ? regD <= syQualCutoff : endD <= syQualCutoff);
    });

    const totalMinutes = relevantTraining.reduce((s, t) => s + t.durationMinutes, 0);
    const qualifies = totalMinutes >= 60 * 60;
    const score = qualifies ? 0.5 : 0;

    trainingByYear.push({
      schoolYear: sy,
      totalMinutes,
      qualifies,
      score,
      entries: relevantTraining.map(t => t.name || `${t.startDate}~${t.endDate}`),
    });
  }

  const trainingScore = Math.min(
    parseFloat(trainingByYear.filter(y => y.qualifies).reduce((s, y) => s + y.score, 0).toFixed(1)),
    2.5
  );

  let subjectClassMonths = 0;
  for (const s of parsed.supplementary.filter(s => s.type === 'subject_class')) {
    const start = parseDate(s.startDate);
    const end = parseDate(s.endDate);
    if (!start || !end) continue;
    const cutoff = new Date('2022-02-28');
    const validStart = start > cutoff ? start : (s.isAdminTeam ? start : null);
    if (!validStart) continue;
    const adjustedStart = validStart < FIVE_YEAR_START ? FIVE_YEAR_START : validStart;
    const adjustedEnd = end > PERF_NEIS_CUTOFF ? PERF_NEIS_CUTOFF : end;
    subjectClassMonths += countMonths(adjustedStart, adjustedEnd);
  }
  const subjectClassScoreRaw = parseFloat((subjectClassMonths * 0.03).toFixed(4));

  let headTeacherMonths = 0;
  const headTeacherEntries = parsed.career.filter(c =>
    c.appointmentType === '보직교사' || c.rank?.includes('부장교사')
  );
  for (const h of headTeacherEntries) {
    const start = parseDate(h.startDate);
    const end = h.endDate ? parseDate(h.endDate) : REFERENCE_DATE;
    if (!start || !end) continue;
    const headStart = inputs.headTeacherSchoolZone === 'urban'
      ? new Date('2019-03-01')
      : new Date('2020-03-01');
    const adjustedStart = start < headStart ? headStart : start;
    const fiveYearAdjStart = adjustedStart < FIVE_YEAR_START ? FIVE_YEAR_START : adjustedStart;
    const adjustedEnd = end > PERF_NEIS_CUTOFF ? PERF_NEIS_CUTOFF : end;
    headTeacherMonths += countMonths(fiveYearAdjStart, adjustedEnd);
  }

  let headTeacherMonthlyRate = 0;
  if (inputs.headTeacherSchoolZone === 'urban') {
    headTeacherMonthlyRate = 0.03;
  } else if (inputs.headTeacherSchoolZone === 'rural_large' && inputs.headTeacherClassCount >= 18) {
    headTeacherMonthlyRate = 0.02;
  }
  const headTeacherScoreRaw = parseFloat((headTeacherMonths * headTeacherMonthlyRate).toFixed(4));

  let subjectClassScore = 0;
  let headTeacherScore = 0;
  let conflictResolution = '';
  if (subjectClassScoreRaw > 0 && headTeacherScoreRaw > 0) {
    if (subjectClassScoreRaw >= headTeacherScoreRaw) {
      subjectClassScore = subjectClassScoreRaw;
      conflictResolution = `교과전담(${subjectClassScoreRaw}점) > 부장교사(${headTeacherScoreRaw}점) → 교과전담 적용`;
    } else {
      headTeacherScore = headTeacherScoreRaw;
      conflictResolution = `부장교사(${headTeacherScoreRaw}점) > 교과전담(${subjectClassScoreRaw}점) → 부장교사 적용`;
    }
  } else {
    subjectClassScore = subjectClassScoreRaw;
    headTeacherScore = headTeacherScoreRaw;
  }

  const HOMEROOM_START = new Date('2022-03-01');
  let homeroomMonths = 0;

  for (const s of parsed.supplementary.filter(s => s.type === 'homeroom')) {
    const start = parseDate(s.startDate);
    const end = parseDate(s.endDate);
    if (!start || !end) continue;
    const adjStart = start < HOMEROOM_START ? HOMEROOM_START : start;
    const adjStart2 = adjStart < FIVE_YEAR_START ? FIVE_YEAR_START : adjStart;
    const adjEnd = end > PERF_NEIS_CUTOFF ? PERF_NEIS_CUTOFF : end;
    homeroomMonths += countMonths(adjStart2, adjEnd);
  }
  const homeroomFromSupp = new Set(parsed.supplementary.filter(s => s.type === 'homeroom').map(s => s.startDate));
  for (const c of parsed.career.filter(c => c.appointmentType === '담임교사')) {
    if (homeroomFromSupp.has(c.startDate)) continue;
    const start = parseDate(c.startDate);
    const end = c.endDate ? parseDate(c.endDate) : REFERENCE_DATE;
    if (!start || !end) continue;
    const adjStart = start < HOMEROOM_START ? HOMEROOM_START : start;
    const adjStart2 = adjStart < FIVE_YEAR_START ? FIVE_YEAR_START : adjStart;
    const adjEnd = end > PERF_NEIS_CUTOFF ? PERF_NEIS_CUTOFF : end;
    homeroomMonths += countMonths(adjStart2, adjEnd);
  }
  const homeroomScore = parseFloat((homeroomMonths * 0.02).toFixed(4));

  const SPECIAL_ED_START = new Date('2022-03-01');
  let specialEdMonths = 0;
  for (const s of parsed.supplementary.filter(s => s.type === 'special_ed')) {
    const start = parseDate(s.startDate);
    const end = parseDate(s.endDate);
    if (!start || !end) continue;
    const adjStart = start < SPECIAL_ED_START ? SPECIAL_ED_START : start;
    const adjStart2 = adjStart < FIVE_YEAR_START ? FIVE_YEAR_START : adjStart;
    const adjEnd = end > PERF_NEIS_CUTOFF ? PERF_NEIS_CUTOFF : end;
    specialEdMonths += countMonths(adjStart2, adjEnd);
  }
  const specialEdScore = parseFloat((specialEdMonths * 0.01).toFixed(4));

  const MULTIGRADE_START = new Date('2003-03-01');
  let multigradeMonths = 0;
  for (const s of parsed.supplementary.filter(s => s.type === 'multigrade')) {
    const start = parseDate(s.startDate);
    const end = parseDate(s.endDate);
    if (!start || !end) continue;
    const adjStart = start < MULTIGRADE_START ? MULTIGRADE_START : start;
    const adjStart2 = adjStart < FIVE_YEAR_START ? FIVE_YEAR_START : adjStart;
    const adjEnd = end > PERF_NEIS_CUTOFF ? PERF_NEIS_CUTOFF : end;
    multigradeMonths += countMonths(adjStart2, adjEnd);
  }
  const multigradeScore = parseFloat((multigradeMonths * 0.03).toFixed(4));

  const totalCareer = careerScore;
  const totalBonus = parseFloat((regionalBonusScore + preferentialBonusScore).toFixed(4));
  const totalPerformance = parseFloat((
    awardScore + researchScore + degreeScore + trainingScore +
    subjectClassScore + headTeacherScore + homeroomScore +
    specialEdScore + multigradeScore
  ).toFixed(4));
  const grandTotal = parseFloat((totalCareer + totalBonus + totalPerformance).toFixed(4));

  return {
    careerMonths,
    currentSchool,
    currentSchoolStart: currentSchoolStartDate?.toISOString().substring(0, 10) ?? '',
    careerScore,
    regionalBonusPerMonth,
    regionalBonusMonths: currentSchoolMonths,
    regionalBonusScore,
    preferentialBonusPerMonth,
    preferentialBonusMonths,
    preferentialBonusScore,
    awardDetails,
    awardScore,
    researchDetails,
    researchScore,
    degreeScore,
    degreeType,
    trainingByYear,
    trainingScore,
    subjectClassMonths,
    subjectClassScore,
    homeroomMonths,
    homeroomScore,
    headTeacherMonths,
    headTeacherScore,
    conflictResolution,
    specialEdMonths,
    specialEdScore,
    multigradeMonths,
    multigradeScore,
    totalCareer,
    totalBonus,
    totalPerformance,
    grandTotal,
  };
}
