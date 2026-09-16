import type { GeocodeCandidate } from '@/types/commute';

/**
 * 주소 → 좌표 후보 목록 (카카오 로컬 REST, 서버 전용).
 *
 * 캐시 없음(v1) — 매 검색마다 카카오를 호출한다. 남용은 클라 30초 재검색 제한(후보 조회 시점에
 * 기록)으로 막는다. 이 호출은 api_budget(길찾기 예산)과 무관 — 로컬 검색은 별도 쿼터.
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

  const addressDocs = await callKakao<AddressDoc>(ADDRESS_URL, query);
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
  const keywordDocs = await callKakao<KeywordDoc>(KEYWORD_URL, query);
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
