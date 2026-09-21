import { NextRequest, NextResponse } from 'next/server';
import { geocodeCandidates, GeocodeUnavailableError } from '@/lib/kakao-geocode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 주소 → 후보 목록. 길찾기(directions)와는 무료한도·단가가 달라 예산(api_budget)을
 * 종류별로 따로 센다(계획: _refs/카카오_API_쿼터.md) — kakao-geocode.ts가 처리.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad('요청 형식이 올바르지 않습니다.');
  }

  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!address) return bad('주소를 입력해 주세요.');

  if (!process.env.KAKAO_REST_API_KEY) {
    return bad('주소 검색 기능이 아직 설정되지 않았습니다.', 503);
  }

  try {
    const candidates = await geocodeCandidates(address);
    return NextResponse.json({ candidates }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof GeocodeUnavailableError) {
      return bad(e.message, e.reason === 'over_budget' ? 429 : 503);
    }
    console.error('geocodeCandidates 실패', e);
    return bad('주소 검색 중 오류가 발생했습니다.', 500);
  }
}
