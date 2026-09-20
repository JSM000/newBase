import type { ParsedFile } from './score';

export type TransferPreference = 'external' | 'internal';

/**
 * 유치원·초등학교는 점수 계산기(UserInputs.teacherType)와도 맞물리고, 중·고등학교는
 * 통계지도 필터 자동 채움에만 쓰인다(점수 계산기는 현재 유초등만 구현돼 있어 해당 없음 —
 * 중고등 계산 로직은 추후 구현 예정, CLAUDE.md 참고).
 */
export type SchoolLevel = 'kindergarten' | 'elementary' | 'middle' | 'high';

export interface SavedParsedFile {
  data: ParsedFile;
  savedAt: string; // ISO — 자동 삭제 기준 시각
}

export interface UserSettings {
  /** 근무 중인 시·군·구 (school-region.ts의 CHUNGBUK_SIGUNGU_ORDER 중 하나). null = 아직 선택 안 함(placeholder) */
  currentSigungu: string | null;
  /** null = 아직 선택 안 함(placeholder) */
  transferPreference: TransferPreference | null;
  /** 관외전보 고려 중일 때 이동을 희망하는 시·군 — 통계지도 길찾기의 검색 대상 지역으로 쓰인다 */
  desiredSigungu: string | null;
  /** 거주지 좌표만 저장 — 상세 주소 문자열은 저장하지 않는다 */
  homeCoords: { lat: number; lng: number } | null;
  /** null = 아직 선택 안 함(placeholder) */
  schoolLevel: SchoolLevel | null;
  savedParsedFile: SavedParsedFile | null;
  savedAt: string | null; // 마지막 저장 시각 — RETENTION_DAYS 자동 삭제 기준
}
