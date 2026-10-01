'use client';

/**
 * 길찾기(소요시간 순위) 검색 결과를 로컬에 캐시.
 *
 * 출발지(좌표)·도착지 조건(즐겨찾기 목록 또는 시·군/학교급/설립구분)이 완전히 같은 재검색이면
 * 카카오 길찾기 API(일일 예산이 있는 유료 자원)를 다시 쓰지 않고 저장된 결과를 그대로 쓴다.
 * commute-rate-limit.ts와 같은 패턴 — localStorage 접근은 항상 try/catch, SSR에선 no-op.
 */

import type { RouteRankingResponse } from '@/types/commute';
import type { OwnershipFilter } from './school-region';
import type { SchulKndCode } from '@/types/school-stats';

/** 길찾기 "도착지 조건" 식별자 — 캐시 키 구성과 요청 바디 구성에 공용으로 쓴다. */
export type CommuteDestination =
  | { kind: 'favorites'; favoriteCodes: string[] }
  | { kind: 'filter'; schulKndCode: SchulKndCode; sigungu: string; ownership: OwnershipFilter };

interface CacheEntry {
  result: RouteRankingResponse;
  savedAt: string;
}

const STORAGE_KEY = 'commute:result-cache';
/** 저장 항목 상한 — 넘으면 가장 오래된 것부터 비운다(경로 폴리라인까지 들어있어 용량이 꽤 나감). */
const MAX_ENTRIES = 20;

function destinationPart(d: CommuteDestination): string {
  return d.kind === 'favorites'
    ? `fav:${[...d.favoriteCodes].sort().join(',')}`
    : `filter:${d.schulKndCode}:${d.sigungu}:${d.ownership}`;
}

/**
 * 출발지+도착지 식별 키 — 캐시 조회·저장뿐 아니라, 통계 컨테이너가 "같은 조건으로 재검색인지
 * (이어서 병합) vs 조건이 바뀐 새 검색인지(교체)"를 판단할 때도 이 키로 비교한다.
 */
export function commuteRequestKey(
  origin: { lat: number; lng: number },
  destination: CommuteDestination,
): string {
  return `${origin.lat},${origin.lng}|${destinationPart(destination)}`;
}

function readAll(): Record<string, CacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

/** 출발지·도착지 조건이 완전히 같은 이전 검색 결과가 있으면 반환 — 없으면 null. */
export function loadCachedCommuteResult(
  origin: { lat: number; lng: number },
  destination: CommuteDestination,
): RouteRankingResponse | null {
  const all = readAll();
  return all[commuteRequestKey(origin, destination)]?.result ?? null;
}

/** 검색(또는 "나머지도 계산"으로 갱신된) 결과를 로컬에 저장 — 다음에 같은 조건으로 검색하면 API 없이 재사용. */
export function saveCachedCommuteResult(
  origin: { lat: number; lng: number },
  destination: CommuteDestination,
  result: RouteRankingResponse,
): void {
  if (typeof window === 'undefined') return;
  try {
    const all = readAll();
    const key = commuteRequestKey(origin, destination);
    all[key] = { result, savedAt: new Date().toISOString() };

    const entries = Object.entries(all);
    if (entries.length > MAX_ENTRIES) {
      entries
        .filter(([k]) => k !== key)
        .sort((a, b) => a[1].savedAt.localeCompare(b[1].savedAt))
        .slice(0, entries.length - MAX_ENTRIES)
        .forEach(([k]) => delete all[k]);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* 스토리지 불가·용량 초과 — 캐시 없이 계속 진행 */
  }
}
