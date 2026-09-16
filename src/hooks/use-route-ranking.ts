'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  RouteRankingRequest,
  RouteRankingResponse,
} from '@/types/commute';

async function postRanking(
  body: RouteRankingRequest,
): Promise<RouteRankingResponse> {
  const res = await fetch('/api/route-ranking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '요청 실패');
  return data as RouteRankingResponse;
}

/**
 * 소요시간 순위 계산. 경로 폴리라인은 응답에 포함되므로 별도 조회 훅이 없다.
 * "나머지도 계산"은 같은 입력에 `offset`만 올려 다시 호출하고, 컨테이너가 결과를 병합한다.
 */
export function useRouteRanking() {
  return useMutation({ mutationFn: postRanking });
}
