import type { GeocodeCandidate } from '@/types/commute';
import { getServiceSupabase } from './supabase-server';
import { reserveApiBudget } from './api-budget';

/**
 * 주소 → 좌표 후보 목록 (카카오 로컬 REST, 서버 전용).
 *
 * 캐시 없음(v1) — 매 검색마다 카카오를 호출한다. 남용은 클라 30초 재검색 제한(후보 조회 시점에
 * 기록) + 아래 서버 일일 예산(api_budget, 계획: _refs/카카오_API_쿼터.md)으로 막는다.
 * 주소검색·키워드검색은 길찾기(directions)와 무료한도·단가가 달라 예산도 따로 센다.
 *
 * 주소검색 결과가 있으면 그것만 후보로 쓰고, 없을 때만(건물명 등) 키워드검색으로 폴백한다.
 * (둘 다 항상 호출하면 지오코딩 쿼터가 2배로 나가므로, 실패했을 때만 폴백 — 계획 그대로 유지.)
 * 카카오 응답을 그대로 신뢰하지 않고, 사용자가 후보 중 하나를 직접 골라 확정하게 한다
 * (동/읍/면 단위 같은 부정확한 매칭을 1등으로 자동 채택하던 v1의 한계 보완).
 */

const REST_KEY = process.env.KAKAO_REST_API_KEY;
const ADDRESS_URL = 'https://dapi.kakao.com/v2/local/search/address.json';
const KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const CANDIDATE_SIZE = 5;

// 무료한도(주소·키워드 각 100,000/일)의 90%.
const ADDRESS_DAILY_BUDGET = Number(process.env.GEOCODE_ADDRESS_DAILY_BUDGET) || 90_000;
const KEYWORD_DAILY_BUDGET = Number(process.env.GEOCODE_KEYWORD_DAILY_BUDGET) || 90_000;
const BUDGET_ROLLBACK_LIMIT = 2_000_000_000;

/**
 * 지오코딩을 지금 쓸 수 없는 이유. 라우트 핸들러가 구분해서 응답 메시지를 고른다.
 *   not_configured — Supabase 예산 게이트 자체가 설정 안 됨(이 기능 전체가 이미 그 상태로는
 *     동작 불가 — route-ranking.ts도 Supabase 필수라 여기만 예외로 열어둘 이유가 없다)
 *   over_budget    — 오늘 주소검색 무료한도 소진(안전마진 90%)
 */
export class GeocodeUnavailableError extends Error {
  constructor(public reason: 'not_configured' | 'over_budget') {
    super(
      reason === 'not_configured'
        ? '주소 검색 기능이 아직 설정되지 않았습니다.'
        : '오늘 주소 검색 요청량이 많아 잠시 제한됩니다. 내일 다시 시도해 주세요.',
    );
  }
}

interface AddressDoc {
  address_name: string;
  address_type: string;
  x: string; // lng
  y: string; // lat
  road_address?: { address_name: string } | null;
}

interface KeywordDoc {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // lng
  y: string; // lat
}

async function callKakao<T>(url: string, query: string): Promise<T[]> {
  if (!REST_KEY) throw new Error('KAKAO_REST_API_KEY 미설정');

  const u = new URL(url);
  u.searchParams.set('query', query);
  u.searchParams.set('size', String(CANDIDATE_SIZE));

  const res = await fetch(u, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`지오코딩 실패 (${res.status})`);

  const json = (await res.json()) as { documents?: T[] };
  return json.documents ?? [];
}

function toCandidate(lat: number, lng: number): { lat: number; lng: number } | null {
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function geocodeCandidates(rawQuery: string): Promise<GeocodeCandidate[]> {
  const query = rawQuery.trim().replace(/\s+/g, ' ');
  if (!query) return [];

  const supabase = getServiceSupabase();
  if (!supabase) throw new GeocodeUnavailableError('not_configured');

  // 주소검색은 매 요청 항상 1회 나가므로 여기서 먼저 예약 — 실패하면 카카오를 아예 호출하지 않는다.
  if (!(await reserveApiBudget(supabase, 'geocode_address', 1, ADDRESS_DAILY_BUDGET))) {
    throw new GeocodeUnavailableError('over_budget');
  }
  let addressDocs: AddressDoc[];
  try {
    addressDocs = await callKakao<AddressDoc>(ADDRESS_URL, query);
  } catch (e) {
    await reserveApiBudget(supabase, 'geocode_address', -1, BUDGET_ROLLBACK_LIMIT);
    throw e;
  }
  if (addressDocs.length > 0) {
    const out: GeocodeCandidate[] = [];
    for (const doc of addressDocs) {
      const pos = toCandidate(Number(doc.y), Number(doc.x));
      if (!pos) continue;
      out.push({
        label: doc.road_address?.address_name ?? doc.address_name,
        roadAddress: doc.road_address?.address_name ?? null,
        addressType: doc.address_type,
        source: 'address',
        ...pos,
      });
    }
    return out;
  }

  // 주소 검색이 0건일 때만 키워드(건물명·상호명 등) 검색으로 폴백 — 호출 2배 방지.
  // 이 폴백은 예산이 없어도 하드 에러로 안 띄운다 — 그냥 "못 찾음"으로 조용히 빈 목록 반환.
  if (!(await reserveApiBudget(supabase, 'geocode_keyword', 1, KEYWORD_DAILY_BUDGET))) {
    return [];
  }
  let keywordDocs: KeywordDoc[];
  try {
    keywordDocs = await callKakao<KeywordDoc>(KEYWORD_URL, query);
  } catch (e) {
    await reserveApiBudget(supabase, 'geocode_keyword', -1, BUDGET_ROLLBACK_LIMIT);
    throw e;
  }
  const out: GeocodeCandidate[] = [];
  for (const doc of keywordDocs) {
    const pos = toCandidate(Number(doc.y), Number(doc.x));
    if (!pos) continue;
    out.push({
      label: doc.place_name,
      roadAddress: doc.road_address_name || doc.address_name || null,
      addressType: 'KEYWORD',
      source: 'keyword',
      ...pos,
    });
  }
  return out;
}
