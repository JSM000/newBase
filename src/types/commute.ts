/**
 * 집→학교 소요시간 순위 기능의 클라이언트↔서버 공유 타입.
 * 계획: _refs/학교_소요시간_순위_구현계획.md
 */

import type { SchulKndCode } from './school-stats';
import type { OwnershipFilter } from '@/lib/school-region';

export interface GeocodeRequest {
  address: string;
}

/** 주소 검색 후보 하나. 사용자가 목록에서 직접 골라 출발지를 확정한다. */
export interface GeocodeCandidate {
  /** 목록에 보여줄 대표 문구 (도로명 주소 또는 장소명) */
  label: string;
  /** 도로명 주소 — 없으면 null (지역명 매칭 등) */
  roadAddress: string | null;
  /** 카카오 매칭 정확도 구분값 — REGION(동 단위)·ROAD·REGION_ADDR·ROAD_ADDR 또는 'KEYWORD'(장소명 검색) */
  addressType: string;
  source: 'address' | 'keyword';
  lat: number;
  lng: number;
}

export interface GeocodeResponse {
  candidates: GeocodeCandidate[];
}

export interface RouteRankingRequest {
  /** 후보 목록에서 사용자가 고른 출발지 좌표 — 서버는 여기서 다시 지오코딩하지 않는다. */
  origin: { lat: number; lng: number };
  schulKndCode: SchulKndCode;
  sigungu: string;
  /** 설립구분 — 필터바와 동일 기준('all'이면 전체) */
  ownership: OwnershipFilter;
  /** 이미 실측한 학교 수 — "나머지도 계산"에서 다음 배치를 이어 계산 */
  offset?: number;
}

export interface RankedSchoolResult {
  schulCode: string;
  schulNm: string;
  address: string | null;
  position: { lat: number; lng: number };
  /** 직선거리(km) — 항상 있음 */
  straightKm: number;
  /** 자동차 소요시간(초) — 실측된 학교만 */
  durationSec: number | null;
  /** 자동차 도로거리(m) — 실측된 학교만 */
  distanceM: number | null;
  /** 경로 폴리라인 [lng, lat][] — 실측된 학교만. 클릭 시 지도에 그림 */
  path: [number, number][] | null;
}

export interface RouteRankingResponse {
  origin: { lat: number; lng: number };
  results: RankedSchoolResult[];
  /** 누적 실측 대상 수(정렬 전 직선거리 상위 N) */
  measuredCount: number;
  /** 대상 학교 총수 */
  totalCount: number;
  /** 아직 실측 안 한 학교 수 ("나머지도 계산" 버튼용) */
  remainingCount: number;
  /** 일일 한도 초과로 이번 배치를 계산하지 못함 */
  overBudget: boolean;
}
