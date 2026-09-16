/**
 * 직선거리 계산 + 소요시간 순위 정렬 (계획 4-2). 클라이언트·서버 공용 (외부 의존 없음).
 *
 * 출발 좌표는 격자 스냅 없이 지오코딩 실좌표를 그대로 쓴다(정확도 우선).
 */

import type { RankedSchoolResult } from '@/types/commute';

export interface LatLng {
  lat: number;
  lng: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** 두 좌표의 대략 직선거리(km). 학교 정렬·상위 N 선별·"직선거리" 표시값에 사용. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 소요시간 있는 학교를 시간 오름차순으로, 없는 학교는 뒤에 직선거리 오름차순으로.
 * 서버 응답 정렬 + 클라 "나머지 계산" 병합 후 재정렬에 공용으로 쓴다.
 */
export function compareByCommute(
  a: RankedSchoolResult,
  b: RankedSchoolResult,
): number {
  if (a.durationSec !== null && b.durationSec !== null) {
    return a.durationSec - b.durationSec;
  }
  if (a.durationSec !== null) return -1;
  if (b.durationSec !== null) return 1;
  return a.straightKm - b.straightKm;
}
