'use client';

/**
 * 재검색 쿨다운 — "검색 1회 후 일정 시간 재검색 차단"을 localStorage에 마지막 시각을
 * 남겨 구현한다. 서버와 무관한 가벼운 UX 제한(스토리지 지우면 우회 가능). 실제 요금
 * 방어선은 서버 `api_budget`.
 *
 * 주소 검색(지오코딩)과 길찾기(소요시간 계산, confirmSearch/loadMore)는 서로 다른 API·예산이라
 * 쿨다운도 독립적으로 둔다 — 하나로 합치면 "주소 검색하자마자 계산하기가 못 눌림" 같은 혼란이
 * 생긴다. 길찾기 쪽이 더 비싼 자원이라 쿨다운도 더 길다(10초 vs 1분).
 */

const ADDRESS_COOLDOWN_MS = 10 * 1000;
const RANKING_COOLDOWN_MS = 60 * 1000;

const CONFIG = {
  address: { key: 'commute:last-search-at', ms: ADDRESS_COOLDOWN_MS },
  ranking: { key: 'commute:last-ranking-at', ms: RANKING_COOLDOWN_MS },
} as const;

type CooldownKind = keyof typeof CONFIG;

function remainingMs(kind: CooldownKind): number {
  if (typeof window === 'undefined') return 0;
  try {
    const { key, ms } = CONFIG[kind];
    const last = Number(localStorage.getItem(key) ?? 0);
    if (!last) return 0;
    return Math.max(0, ms - (Date.now() - last));
  } catch {
    return 0;
  }
}

function markNow(kind: CooldownKind): void {
  try {
    localStorage.setItem(CONFIG[kind].key, String(Date.now()));
  } catch {
    /* 스토리지 불가 — 무시 */
  }
}

/** 주소 검색(지오코딩) 쿨다운 — 남은 ms, 0이면 지금 검색 가능. */
export function cooldownRemainingMs(): number {
  return remainingMs('address');
}

/** 주소 검색 성공 시각 기록 — 이 시점부터 10초 쿨다운. */
export function markSearched(): void {
  markNow('address');
}

/** 길찾기(소요시간 계산) 쿨다운 — 남은 ms, 0이면 지금 계산 가능. 주소 검색과는 독립적. */
export function rankingCooldownRemainingMs(): number {
  return remainingMs('ranking');
}

/** 길찾기 실행(confirmSearch/loadMore) 성공 시각 기록 — 이 시점부터 1분 쿨다운. */
export function markRankingSearched(): void {
  markNow('ranking');
}
