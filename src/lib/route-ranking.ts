import type { School, ChungbukSchoolsData, SchulKndCode } from '@/types/school-stats';
import type {
  RankedSchoolResult,
  RouteRankingResponse,
} from '@/types/commute';
import schoolsRender from '../../public/data/chungbuk-schools-render.json';
import { getServiceSupabase } from './supabase-server';
import { reserveApiBudget } from './api-budget';
import { fetchCarRoute } from './kakao-directions';
import { haversineKm, compareByCommute, type LatLng } from './route-origin';
import { normalizeSigungu, type OwnershipFilter } from './school-region';

/**
 * 집→학교 소요시간 순위 계산 (계획 4-1).
 *
 *   haversine 정렬 → 직선거리 상위 N(=이번 배치) → 일일 예산 예약
 *   → 카카오 길찾기(경로 포함) → 정렬해 반환
 *
 * 지오코딩은 이 함수 밖(/api/geocode, kakao-geocode.ts)에서 미리 끝낸다 — 사용자가 후보 목록
 * 중 하나를 직접 골라 확정한 좌표(origin)를 그대로 받는다. 여기서 다시 지오코딩하지 않는다.
 *
 * v1은 결과 캐시가 없다 — 매 요청이 곧 카카오 호출이며, 남용은 클라 30초 제한 + api_budget 게이트로 막는다.
 * 경로 폴리라인은 응답에 인라인으로 실어 클라가 메모리에 들고 있게 한다(학교 클릭 시 재호출 없음).
 */

const ALL_SCHOOLS = (schoolsRender as ChungbukSchoolsData).schools;

const DAILY_BUDGET = Number(process.env.ROUTE_DAILY_BUDGET) || 9000; // 무료한도(10,000/일)의 90%
const MAX_PER_QUERY = Number(process.env.ROUTE_MAX_PER_QUERY) || 20;
const CONCURRENCY = 6;
const BUDGET_ROLLBACK_LIMIT = 2_000_000_000;

export type RankingError = { error: 'not_configured' };

interface RankingInput {
  /** 사용자가 후보 목록에서 고른 출발지 좌표 — 이미 확정됨, 여기선 지오코딩 안 함. */
  origin: LatLng;
  schulKndCode: SchulKndCode;
  sigungu: string;
  /** 설립구분 필터('all'이면 전체) — 지도·순위 표시와 같은 기준으로 대상을 좁힌다. */
  ownership: OwnershipFilter;
  offset: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function reserveBudget(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  n: number,
  limit = DAILY_BUDGET,
): Promise<boolean> {
  return reserveApiBudget(supabase, 'directions', n, limit);
}

/** 동시 실행 수를 제한하며 map. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

export async function computeRanking(
  input: RankingInput,
): Promise<RouteRankingResponse | RankingError> {
  const supabase = getServiceSupabase();
  if (!supabase || !process.env.KAKAO_REST_API_KEY) {
    return { error: 'not_configured' };
  }

  const origin = input.origin;

  // 대상 학교 = 선택 시군구·학교급·설립구분(지도 필터와 동일 기준), 좌표 있는 것. haversine 오름차순.
  // sigunguName은 괴산군/증평군을 그대로 갖고 있으므로 normalizeSigungu로 병합 단위와 비교한다.
  const targets = ALL_SCHOOLS.filter(
    (s: School) =>
      normalizeSigungu(s.sigunguName) === input.sigungu &&
      s.schulKndCode === input.schulKndCode &&
      (input.ownership === 'all' || s.fondScCode === input.ownership) &&
      s.position,
  )
    .map((s: School) => ({
      school: s,
      straightKm: haversineKm(origin, s.position!),
    }))
    .sort((a, b) => a.straightKm - b.straightKm);

  const to = Math.min(input.offset + MAX_PER_QUERY, targets.length);
  const batch = targets.slice(input.offset, to);

  let overBudget = false;
  const routed = new Map<
    string,
    { durationSec: number; distanceM: number; path: [number, number][] }
  >();

  if (batch.length > 0) {
    const reserved = await reserveBudget(supabase, batch.length);
    if (!reserved) {
      overBudget = true;
    } else {
      const computed = await mapPool(batch, CONCURRENCY, async (t) => ({
        code: t.school.schulCode,
        route: await fetchCarRoute(origin, t.school.position!),
      }));
      let failed = 0;
      for (const { code, route } of computed) {
        if (route) {
          routed.set(code, {
            durationSec: route.durationSec,
            distanceM: route.distanceM,
            path: route.path,
          });
        } else {
          failed++;
        }
      }
      if (failed > 0) {
        // 실패분 되돌리기. batch.length ≤ MAX_PER_QUERY 라 failed 도 그 이하지만,
        // RPC 의 p_n 범위 가드(±500)에 안 걸리게 한 번 더 클램프. 결과는 의도적으로 무시 —
        // 롤백이 실패해도 카운터가 살짝 부풀 뿐(실제보다 보수적)이라 안전하다.
        await reserveBudget(supabase, -Math.min(failed, 500), BUDGET_ROLLBACK_LIMIT);
      }
    }
  }

  const results: RankedSchoolResult[] = targets.map((t) => {
    const r = routed.get(t.school.schulCode);
    return {
      schulCode: t.school.schulCode,
      schulNm: t.school.schulNm,
      address: t.school.roadAddress ?? t.school.address,
      position: t.school.position!,
      straightKm: round2(t.straightKm),
      durationSec: r ? r.durationSec : null,
      distanceM: r ? r.distanceM : null,
      path: r ? r.path : null,
    };
  });

  results.sort(compareByCommute);

  return {
    origin,
    results,
    measuredCount: to,
    totalCount: targets.length,
    remainingCount: targets.length - to,
    overBudget,
  };
}
