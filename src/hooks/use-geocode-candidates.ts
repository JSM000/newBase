'use client';

import { useMutation } from '@tanstack/react-query';
import type { GeocodeRequest, GeocodeResponse } from '@/types/commute';

async function postGeocode(body: GeocodeRequest): Promise<GeocodeResponse> {
  const res = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '요청 실패');
  return data as GeocodeResponse;
}

/** 주소 → 후보 목록 조회. 사용자가 이 중 하나를 골라야 실제 길찾기(useRouteRanking)가 시작된다. */
export function useGeocodeCandidates() {
  return useMutation({ mutationFn: postGeocode });
}
