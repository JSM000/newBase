import type { School } from '@/types/school-stats';

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

export interface SigunguGroup {
  name: string;
  schools: School[];
  /** 그룹 내 학교들의 평균 좌표 (지도에 클러스터 마커를 찍을 위치) */
  center: { lat: number; lng: number };
}

/** 좌표가 있는 학교들을 시·군 단위로 묶는다 (행정구역 기반 클러스터링용). */
export function groupSchoolsBySigungu(schools: School[]): SigunguGroup[] {
  const byName = new Map<string, School[]>();
  for (const school of schools) {
    if (!school.position) continue;
    const name = school.sigunguName;
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(school);
  }

  return [...byName.entries()].map(([name, list]) => {
    const lat = list.reduce((sum, s) => sum + s.position!.lat, 0) / list.length;
    const lng = list.reduce((sum, s) => sum + s.position!.lng, 0) / list.length;
    return { name, schools: list, center: { lat, lng } };
  });
}

export interface SubRegionGroup {
  sigungu: string;
  name: string;
  schools: School[];
  center: { lat: number; lng: number };
}

/** 좌표가 있는 학교들을 "시·군 + 구/읍/면/동" 단위로 묶는다 (2단계 클러스터링용). */
export function groupSchoolsBySubRegion(schools: School[]): SubRegionGroup[] {
  const byKey = new Map<string, School[]>();
  for (const school of schools) {
    if (!school.position) continue;
    const sigungu = school.sigunguName;
    const sub = school.subRegionName;
    if (!sigungu || !sub) continue;
    const key = `${sigungu}|${sub}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(school);
  }

  return [...byKey.entries()].map(([key, list]) => {
    const [sigungu, name] = key.split('|');
    const lat = list.reduce((sum, s) => sum + s.position!.lat, 0) / list.length;
    const lng = list.reduce((sum, s) => sum + s.position!.lng, 0) / list.length;
    return { sigungu, name, schools: list, center: { lat, lng } };
  });
}

export const SCHOOL_LEVEL_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '02', label: '초등학교' },
  { value: '03', label: '중학교' },
  { value: '04', label: '고등학교' },
] as const;

export type SchoolLevelFilter = (typeof SCHOOL_LEVEL_OPTIONS)[number]['value'];
