'use client';

/**
 * 소요시간 순위 검색의 클라이언트 재검색 제한 (계획 7).
 *
 * "검색 1회 후 30초간 재검색 차단" — localStorage 에 마지막 검색 시각을 남긴다.
 * 서버와 무관한 가벼운 UX 제한(스토리지 지우면 우회 가능). 실제 요금 방어선은 서버 `api_budget`.
 */

const KEY = 'commute:last-search-at';
export const COOLDOWN_MS = 30 * 1000;

/** 남은 쿨다운(ms). 0이면 지금 검색 가능. */
export function cooldownRemainingMs(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const last = Number(localStorage.getItem(KEY) ?? 0);
    if (!last) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  } catch {
    return 0;
  }
}

/** 검색 성공 시각 기록 — 이 시점부터 30초 쿨다운. */
export function markSearched(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* 스토리지 불가 — 무시 */
  }
}
