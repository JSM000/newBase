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

// 한 번에 150곳까지 쏘다 보니(route-ranking-constants.ts) 동시 요청이 몰려 카카오 쪽
// 레이트리밋(429)·일시 과부하(5xx)·타임아웃에 걸리는 경우가 생겼다 — 재시도 없이 바로
// "경로 없음" 처리하면 실제로는 뚫을 수 있는 학교까지 영구적으로 직선거리만 남는다
// (실측: 청주시 초등 99곳 중 29곳이 한 번에 실패). 일시적 오류만 짧게 재시도한다.
// 재시도를 1번으로 제한한 이유: 각 시도가 최대 8초(타임아웃)라, 재시도를 늘릴수록 그 학교
// 하나 때문에 전체 요청(최대 150곳)이 서버 타임아웃에 가까워질 worst-case가 커진다.
const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestDirections(
  url: URL,
): Promise<{ json: { routes?: KakaoRoute[] } } | { retryable: boolean }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${REST_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { retryable: true }; // 타임아웃·네트워크 오류 — 재시도 가치 있음
  }
  if (res.status === 429 || res.status >= 500) return { retryable: true };
  if (!res.ok) return { retryable: false }; // 4xx(인증 등) — 재시도해도 소용없음
  return { json: (await res.json()) as { routes?: KakaoRoute[] } };
}

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

  let result = await requestDirections(url);
  if ('retryable' in result && result.retryable) {
    await sleep(RETRY_DELAY_MS);
    result = await requestDirections(url);
  }
  if ('retryable' in result) return null; // 재시도 소진 — 이 학교는 결과에서 제외(직선거리만 표시)

  const route = result.json.routes?.[0];
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
