import * as XLSX from 'xlsx';
import {
  ParsedFile,
  CareerEntry,
  AwardEntry,
  ResearchEntry,
  TrainingEntry,
  DegreeEntry,
  SupplementaryEntry,
} from '@/types/score';

type Row = (string | number | boolean)[];

function cell(row: Row, col: number): string {
  return String(row?.[col] ?? '').trim();
}

function parseKorDate(s: string): string | null {
  if (!s) return null;
  const clean = s.replace(/[~()\s]/g, '');
  const m = clean.match(/(\d{4})[.\-]+(\d{1,2})[.\-]+(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function parseMinutes(s: string): number {
  let min = 0;
  const h = s.match(/(\d+)시간/);
  const m = s.match(/(\d+)분/);
  if (h) min += parseInt(h[1]) * 60;
  if (m) min += parseInt(m[1]);
  return min;
}

function findSection(data: Row[], pattern: RegExp): number {
  return data.findIndex(row => pattern.test(String(row[0] ?? '')));
}

function parseTraining(data: Row[], sectionStart: number, sectionEnd: number): TrainingEntry[] {
  const TYPES = new Set(['직무연수', '기타연수', '자격연수']);
  const entries: TrainingEntry[] = [];

  for (let i = sectionStart; i < sectionEnd; ) {
    const r = data[i];
    const id = cell(r, 0);
    const type = cell(r, 30);

    if (id && TYPES.has(type)) {
      const startDate = parseKorDate(cell(r, 34)) ?? '';
      const workRelated = cell(r, 48) === 'Y';
      const registrationDate = parseKorDate(cell(r, 63)) ?? '';
      const name = cell(r, 7);
      const institution = cell(r, 19);

      const endDate = parseKorDate(cell(data[i + 1], 34)) ?? '';
      const durationMinutes = parseMinutes(cell(data[i + 3], 34));

      entries.push({
        id,
        name,
        institution,
        type: type as '직무연수' | '기타연수' | '자격연수',
        startDate,
        endDate,
        durationMinutes,
        workRelated,
        registrationDate,
      });
      i += 4;
    } else {
      i++;
    }
  }

  return entries;
}

function parseAwards(data: Row[], sectionStart: number, sectionEnd: number): AwardEntry[] {
  const entries: AwardEntry[] = [];
  for (let i = sectionStart; i < sectionEnd; i++) {
    const r = data[i];
    const dateRaw = cell(r, 0);
    if (!dateRaw.match(/^\d{4}\.\d{2}\.\d{2}$/)) continue;
    const date = parseKorDate(dateRaw) ?? dateRaw;
    const grade = cell(r, 8);
    const name = cell(r, 27);
    const agency = cell(r, 59);
    if (grade) entries.push({ date, grade, name, agency });
  }
  return entries;
}

function parseCareer(data: Row[], sectionStart: number, sectionEnd: number): CareerEntry[] {
  const entries: CareerEntry[] = [];
  for (let i = sectionStart; i < sectionEnd; i++) {
    const r = data[i];
    const period = cell(r, 0);
    if (!period.match(/^\d{4}\.\d{2}\.\d{2}/)) continue;

    const parts = period.split('~');
    const startDate = parseKorDate(parts[0]) ?? '';
    const endDate = parts[1]?.trim() ? (parseKorDate(parts[1]) ?? null) : null;

    const appointmentType = cell(r, 10);
    const rank = cell(r, 24);
    const department = cell(r, 38);
    const agencyCol = cell(r, 61);

    let school = '';
    if (agencyCol.match(/(?:초등학교|유치원)$/)) {
      school = agencyCol;
    } else {
      const schoolMatch = department.match(/([가-힣]+(?:초등학교|유치원))$/);
      school = schoolMatch ? schoolMatch[1] : agencyCol;
    }

    entries.push({ startDate, endDate, appointmentType, rank, department, school });
  }
  return entries;
}

function parseResearch(data: Row[], sectionStart: number, sectionEnd: number): ResearchEntry[] {
  const entries: ResearchEntry[] = [];
  for (let i = sectionStart; i < sectionEnd; i++) {
    const r = data[i];
    const titleAgency = cell(r, 0);
    if (!titleAgency || titleAgency.startsWith('연구주제')) continue;

    const periodRaw = cell(r, 31);
    const gradeRaw = cell(r, 41);
    const awardDate = parseKorDate(cell(r, 56)) ?? '';
    const researcherCount = parseInt(String(r[68] ?? '1')) || 1;

    const tildeParts = titleAgency.split('~');
    const title = tildeParts[0]?.trim() ?? '';

    const periodParts = periodRaw.split('~');
    const startDate = parseKorDate(periodParts[0]) ?? '';
    const endDate = parseKorDate(periodParts[1]) ?? '';

    const levelType: 'national' | 'provincial' = gradeRaw.includes('전국') ? 'national' : 'provincial';
    const gradeMatch = gradeRaw.match(/(\d+)등급/);
    const grade = gradeMatch ? parseInt(gradeMatch[1]) : 1;

    entries.push({ title, startDate, endDate, levelType, grade, awardDate, researcherCount });
  }
  return entries;
}

function parseDegrees(data: Row[], sectionStart: number, sectionEnd: number): DegreeEntry[] {
  const entries: DegreeEntry[] = [];
  for (let i = sectionStart; i < sectionEnd; i++) {
    const r = data[i];
    const schoolName = cell(r, 0);
    if (!schoolName || schoolName === '조회된 데이터가 없습니다.' || schoolName.startsWith('학교명')) continue;

    const major = cell(r, 8);
    const degreeRaw = cell(r, 23);
    const completionDate = parseKorDate(cell(r, 51)) ?? '';

    let degree: '박사' | '석사' | null = null;
    if (degreeRaw.includes('박사')) degree = '박사';
    else if (degreeRaw.includes('석사')) degree = '석사';
    if (!degree) continue;

    entries.push({ school: schoolName, major, degree, completionDate });
  }
  return entries;
}

function parseSupplementary(data: Row[], sectionStart: number, sectionEnd: number): SupplementaryEntry[] {
  const entries: SupplementaryEntry[] = [];
  for (let i = sectionStart; i < sectionEnd; i++) {
    const r = data[i];
    const line = cell(r, 0);
    if (!line || !line.includes('(')) continue;

    if (line.startsWith('교과전담') || line.startsWith('기초학력전담') || line.startsWith('한국어학급')) {
      const dateM = line.match(/(\d{4})[. ]+(\d{1,2})[. ]+(\d{1,2})[. ]*[~～]\s*(\d{4})[. ]+(\d{1,2})[. ]+(\d{1,2})/);
      if (dateM) {
        const start = `${dateM[1]}-${dateM[2].padStart(2,'0')}-${dateM[3].padStart(2,'0')}`;
        const end = `${dateM[4]}-${dateM[5].padStart(2,'0')}-${dateM[6].padStart(2,'0')}`;
        const isAdminTeam = line.includes('교무업무지원팀') || line.includes('교무행정');
        const schoolM = line.match(/[,，]\s*([가-힣]+(?:초등학교|유치원|초))\s*\)?/);
        entries.push({ type: 'subject_class', startDate: start, endDate: end, detail: line, school: schoolM ? schoolM[1] : '', isAdminTeam });
      }
    } else if (line.startsWith('담임교사')) {
      const dateM = line.match(/(\d{4}[. ]\d{1,2}[. ]\d{1,2})[. ]*[~～]\s*(\d{4}[. ]\d{1,2}[. ]\d{1,2})/);
      if (dateM) {
        const schoolM = line.match(/([가-힣]+(?:초등학교|유치원))\s*\)?$/);
        entries.push({ type: 'homeroom', startDate: parseKorDate(dateM[1]) ?? '', endDate: parseKorDate(dateM[2]) ?? '', detail: line, school: schoolM ? schoolM[1] : '', isAdminTeam: false });
      }
    } else if (line.startsWith('복식')) {
      const dateM = line.match(/(\d{4}[. ]\d{1,2}[. ]\d{1,2})[. ]*[~～]\s*(\d{4}[. ]\d{1,2}[. ]\d{1,2})/);
      if (dateM) {
        entries.push({ type: 'multigrade', startDate: parseKorDate(dateM[1]) ?? '', endDate: parseKorDate(dateM[2]) ?? '', detail: line, school: '', isAdminTeam: false });
      }
    } else if (line.startsWith('특수통합') || line.includes('통합학급')) {
      const dateM = line.match(/(\d{4}[. ]\d{1,2}[. ]\d{1,2})[. ]*[~～]\s*(\d{4}[. ]\d{1,2}[. ]\d{1,2})/);
      if (dateM) {
        entries.push({ type: 'special_ed', startDate: parseKorDate(dateM[1]) ?? '', endDate: parseKorDate(dateM[2]) ?? '', detail: line, school: '', isAdminTeam: false });
      }
    }
  }
  return entries;
}

export function parseExcelBuffer(buffer: Buffer): ParsedFile {
  const errors: string[] = [];
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as Row[];

  const sec = {
    training:      findSection(data, /^7\.\s*연\s*수\s*이\s*수/),
    nationalVisit: findSection(data, /^8\.\s*국외시찰/),
    awards:        findSection(data, /^9\.\s*포/),
    discipline:    findSection(data, /^10\.\s*징/),
    research:      findSection(data, /^11\.\s*연구실적/),
    bonus:         findSection(data, /^12\.\s*가\s*산\s*점/),
    career:        findSection(data, /^16\.\s*경/),
    supplementary: findSection(data, /^17\.\s*보충기재/),
    degree:        findSection(data, /^18\.\s*대학원/),
    credential:    findSection(data, /^19\.\s*자격취득/),
  };

  const trainingDataStart = sec.training >= 0 ? sec.training + 4 : -1;
  const trainingDataEnd   = sec.nationalVisit >= 0 ? sec.nationalVisit : data.length;

  let training: TrainingEntry[] = [];
  try {
    if (trainingDataStart >= 0) training = parseTraining(data, trainingDataStart, trainingDataEnd);
  } catch (e) { errors.push(`연수이수 파싱 오류: ${e}`); }

  let awards: AwardEntry[] = [];
  try {
    if (sec.awards >= 0) awards = parseAwards(data, sec.awards, sec.discipline >= 0 ? sec.discipline : data.length);
  } catch (e) { errors.push(`포상 파싱 오류: ${e}`); }

  let research: ResearchEntry[] = [];
  try {
    const researchEnd = sec.bonus >= 0 ? sec.bonus : (sec.career >= 0 ? sec.career : data.length);
    if (sec.research >= 0) research = parseResearch(data, sec.research, researchEnd);
  } catch (e) { errors.push(`연구실적 파싱 오류: ${e}`); }

  let career: CareerEntry[] = [];
  try {
    if (sec.career >= 0) career = parseCareer(data, sec.career, sec.supplementary >= 0 ? sec.supplementary : data.length);
  } catch (e) { errors.push(`경력 파싱 오류: ${e}`); }

  let supplementary: SupplementaryEntry[] = [];
  try {
    if (sec.supplementary >= 0) supplementary = parseSupplementary(data, sec.supplementary, sec.degree >= 0 ? sec.degree : data.length);
  } catch (e) { errors.push(`보충기재 파싱 오류: ${e}`); }

  let degrees: DegreeEntry[] = [];
  try {
    if (sec.degree >= 0) degrees = parseDegrees(data, sec.degree, sec.credential >= 0 ? sec.credential : data.length);
  } catch (e) { errors.push(`학위 파싱 오류: ${e}`); }

  const schoolEntry = [...career].reverse().find(c => c.school.match(/(?:초등학교|유치원)$/));
  const schoolName = schoolEntry?.school ?? '';

  return {
    schoolName,
    teacherName: '',
    career,
    awards,
    research,
    training,
    degrees,
    supplementary,
    rawSections: {},
    parseErrors: errors,
  };
}
