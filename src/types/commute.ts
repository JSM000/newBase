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
  /**
   * 즐겨찾기 학교 코드 목록 — 1개 이상 주어지면 "즐겨찾기만" 모드. 아래
   * schulKndCode/sigungu/ownership 대신 이 코드들을 그대로 대상으로 삼는다(즐겨찾기는
   * 여러 시·군·학교급에 걸칠 수 있어서 그 필터들과 같이 쓸 수 없다 — 계획:
   * _refs/즐겨찾기_구현계획/04_필터지도연동.md B).
   */
  favoriteCodes?: string[];
  /** 즐겨찾기 모드가 아닐 때 필수 */
  schulKndCode?: SchulKndCode;
  sigungu?: string;
  /** 설립구분 — 필터바와 동일 기준('all'이면 전체). 즐겨찾기 모드가 아닐 때 필수 */
  ownership?: OwnershipFilter;
  /** 이미 실측한(시도한) 학교 수 — "나머지도 계산"에서 다음 배치를 이어 계산 */
  offset?: number;
  /**
   * 주어지면 offset 기반 배치 대신 이 학교들만 다시 시도한다 — "계산 실패" 학교 재시도 전용.
   * offset(진행 위치)은 건드리지 않는다. 즐겨찾기 모드든 아니든 동일하게 동작.
   */
  retryCodes?: string[];
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
  /**
   * true면 "시도는 했지만"(이번 배치 또는 재시도 대상에 포함) 경로를 못 구함 — 레이트리밋·
   * 타임아웃·실제로 경로 없음 등. false면 아직 시도 전("대기")이거나 성공. durationSec===null과
   * 함께 봐야 구분된다: durationSec null + failed false = 대기, null + failed true = 실패.
   */
  failed: boolean;
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
