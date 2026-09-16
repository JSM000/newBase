import type { School, SchulKndCode } from '@/types/school-stats';
import type { SchoolZonePoint, ZoneLevel } from '@/types/school-zones';

/**
 * 학교통계(학교알리미 schulCode)와 학구도(한국교육시설안전원 학교ID)는 코드 체계가 달라
 * 직접 조인이 안 된다 — 학교명+학교급으로 매칭하고, 동명 학교가 여럿이면 좌표가 가장 가까운
 * 쪽을 고른다. 계획: _refs/학구도_지도_구현계획.md §5.
 */
const ZONE_LEVEL_BY_SCHUL_KND: Record<SchulKndCode, ZoneLevel> = {
  '02': '초등학교',
  '03': '중학교',
  '04': '고등학교',
};

/** 학교급별로 이름→후보점 인덱스를 미리 만들어두면 학교 하나당 O(1)에 가깝게 찾는다. */
export function buildSchoolZonePointIndex(
  points: SchoolZonePoint[],
): Map<string, SchoolZonePoint[]> {
  const index = new Map<string, SchoolZonePoint[]>();
  for (const p of points) {
    const key = `${p.level}|${p.name}`;
    const list = index.get(key);
    if (list) list.push(p);
    else index.set(key, [p]);
  }
  return index;
}

/**
 * 학교통계(학교알리미)는 흔한 학교명을 접두어 없이 쓰고("대성초등학교"), 학구도(안전원)는
 * 전국 동명교 구분을 위해 지역명을 붙이는 경우가 있다("청주대성초등학교") — 실측 결과 정확히
 * 일치하는 이름이 없는 학교의 대부분이 이 패턴(약 480곳 중 46곳, ~9%). 정확히 일치하는 이름이
 * 없을 때만 "학구도 이름이 학교통계 이름으로 끝나는지"로 한 번 더 찾는다.
 */
export function matchSchoolZonePoint(
  school: School,
  points: SchoolZonePoint[],
  index: Map<string, SchoolZonePoint[]>,
): SchoolZonePoint | null {
  const level = ZONE_LEVEL_BY_SCHUL_KND[school.schulKndCode];
  const exact = index.get(`${level}|${school.schulNm}`);
  const candidates =
    exact && exact.length > 0
      ? exact
      : points.filter((p) => p.level === level && p.name.length > school.schulNm.length && p.name.endsWith(school.schulNm));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (!school.position) return candidates[0];

  let best = candidates[0];
  let bestDist = Infinity;
  for (const c of candidates) {
    const dLat = c.lat - school.position.lat;
    const dLng = c.lng - school.position.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}
