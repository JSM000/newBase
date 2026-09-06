'use client';

/**
 * 브라우저 로컬 상태 헬퍼 (계획: _refs/학교_별점_조회수_구현계획.md 3-5).
 *
 * - client_id: localStorage. 사용자 구분용(위조 가능, 흥미 중심이라 감수).
 * - 내 별점: localStorage. 위젯이 "내 평가"를 서버 왕복 없이 표시하는 용도.
 * - 조회수 중복 제거: sessionStorage. 같은 세션에 같은 학교를 다시 열어도 +1 안 함.
 *
 * 모든 접근은 try/catch — 시크릿창·스토리지 차단 환경에서도 앱이 죽지 않게 한다.
 */

const CLIENT_ID_KEY = 'school-social:client-id';
const MY_RATINGS_KEY = 'school-social:my-ratings';
const VIEWED_SESSION_KEY = 'school-social:viewed-session';

export function getClientId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function getMyRatings(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MY_RATINGS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function setMyRating(schoolCode: string, rating: number): void {
  try {
    const all = getMyRatings();
    all[schoolCode] = rating;
    localStorage.setItem(MY_RATINGS_KEY, JSON.stringify(all));
  } catch {
    /* 스토리지 불가 — 무시 */
  }
}

function readViewedSession(): string[] {
  try {
    const raw = sessionStorage.getItem(VIEWED_SESSION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasViewedThisSession(schoolCode: string): boolean {
  return readViewedSession().includes(schoolCode);
}

export function markViewedThisSession(schoolCode: string): void {
  try {
    const list = readViewedSession();
    if (!list.includes(schoolCode)) {
      list.push(schoolCode);
      sessionStorage.setItem(VIEWED_SESSION_KEY, JSON.stringify(list));
    }
  } catch {
    /* 스토리지 불가 — 무시 */
  }
}
