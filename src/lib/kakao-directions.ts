import type { LatLng } from './route-origin';

/**
 * 카카오모빌리티 자동차 길찾기 (1:1, REST, 서버 전용). 계획 4-1 / 4-5.
 *
 * - full 응답을 받아 소요시간·거리 + 경로 폴리라인까지 추출한다 (`summary=true` 로 빼도
 *   과금은 동일하므로, 어차피 한 번 부를 거 경로까지 저장한다 — 계획 2-4).
 * - 폴리라인은 tolerance ≈ 55m 로 단순화 + 좌표 소수 5자리로 저장 용량을 억제한다.
 */

const REST_KEY = process.env.KAKAO_REST_API_KEY;
const DIRECTIONS_URL = 'https://apis-navi.kakaomobility.com/v1/directions';

/** [lng, lat] 쌍의 배열 (지도 폴리라인 그리기용). */
export type PolylinePath = [number, number][];

export interface DirectionsResult {
  durationSec: number;
  distanceM: number;
  path: PolylinePath;
}

interface KakaoRoute {
  result_code: number;
  result_msg?: string;
  summary?: { distance: number; duration: number };
  sections?: { roads?: { vertexes?: number[] }[] }[];
}

const round5 = (n: number): number => Math.round(n * 1e5) / 1e5;

export async function fetchCarRoute(
  origin: LatLng,
  dest: LatLng,
): Promise<DirectionsResult | null> {
  if (!REST_KEY) throw new Error('KAKAO_REST_API_KEY 미설정');

  const url = new URL(DIRECTIONS_URL);
  url.searchParams.set('origin', `${origin.lng},${origin.lat}`);
  url.searchParams.set('destination', `${dest.lng},${dest.lat}`);
  url.searchParams.set('priority', 'RECOMMEND');
  url.searchParams.set('road_details', 'false');

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${REST_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null; // 타임아웃·네트워크 오류 → 이 학교는 결과에서 제외
  }
  if (!res.ok) return null;

  const json = (await res.json()) as { routes?: KakaoRoute[] };
  const route = json.routes?.[0];
  if (!route || route.result_code !== 0 || !route.summary) return null;

  const raw: PolylinePath = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const v = road.vertexes ?? [];
      for (let i = 0; i + 1 < v.length; i += 2) {
        raw.push([v[i], v[i + 1]]);
      }
    }
  }

  const path = simplifyPath(raw, 0.0005).map(
    ([lng, lat]) => [round5(lng), round5(lat)] as [number, number],
  );

  return {
    durationSec: route.summary.duration,
    distanceM: route.summary.distance,
    path,
  };
}

/** 점→선분 수직거리의 제곱 (경위도를 평면으로 근사 — 표시용 단순화엔 충분). */
function segDistSq(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas–Peucker 단순화. tolerance 는 경위도 도(度) 단위 (0.0005 ≈ 55m). */
export function simplifyPath(points: PolylinePath, tolerance: number): PolylinePath {
  if (points.length <= 2) return points;
  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxSq = sqTol;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const sq = segDistSq(points[i], points[first], points[last]);
      if (sq > maxSq) {
        maxSq = sq;
        idx = i;
      }
    }
    if (idx !== -1) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}
