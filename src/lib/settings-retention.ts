/** 로컬 설정 보관 기간 — 20일 뒤 전체 자동 삭제 (계획: _refs/개인정보_로컬설정_구현계획/06_자동삭제.md) */
export const RETENTION_DAYS = 20;

export function getExpiresAt(savedAt: string): Date {
  return new Date(new Date(savedAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function isExpired(savedAt: string): boolean {
  return Date.now() > getExpiresAt(savedAt).getTime();
}
