import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 서버 전역 일일 API 예산 게이트 — 카카오 API별로 무료 쿼터가 달라(계획:
 * _refs/카카오_API_쿼터.md) 종류별로 따로 센다. Supabase `api_budget` 테이블 +
 * `reserve_api_budget` RPC(supabase/migrations/0003_api_budget_per_type.sql)를 씀.
 *
 * route-ranking.ts(길찾기)·kakao-geocode.ts(주소·키워드 검색)가 공유.
 */
export type ApiBudgetType = 'directions' | 'geocode_address' | 'geocode_keyword';

/** KST 기준 날짜 문자열 — 예산은 한국 자정에 리셋. */
export function kstDay(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * n건을 원자적으로 예약한다. true = 예약 성공(오늘 누적이 limit 이내), false = 한도 초과
 * 또는 RPC 자체 실패(네트워크 오류 등 — 이 경우도 안전하게 "예약 실패"로 처리해 호출을 막는다).
 * 실패분 되돌릴 땐 n에 음수를 넣어 다시 호출(호출 쪽에서 ±500 범위로 클램프할 것 — RPC가 그 밖은 예외를 던짐).
 */
export async function reserveApiBudget(
  supabase: SupabaseClient,
  apiType: ApiBudgetType,
  n: number,
  limit: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('reserve_api_budget', {
    p_day: kstDay(),
    p_api_type: apiType,
    p_n: n,
    p_limit: limit,
  });
  if (error) {
    console.error(`reserve_api_budget(${apiType}) 실패`, error);
    return false;
  }
  return data !== null;
}
