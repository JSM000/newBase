import { NextRequest, NextResponse } from 'next/server';
import { computeRanking } from '@/lib/route-ranking';
import { CHUNGBUK_SIGUNGU_ORDER, OWNERSHIP_OPTIONS } from '@/lib/school-region';
import type { SchulKndCode } from '@/types/school-stats';
import type { OwnershipFilter } from '@/lib/school-region';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEVELS = new Set<SchulKndCode>(['02', '03', '04']);
const OWNERSHIPS = new Set<OwnershipFilter>(OWNERSHIP_OPTIONS.map((o) => o.value));

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad('요청 형식이 올바르지 않습니다.');
  }

  const originRaw = body.origin as { lat?: unknown; lng?: unknown } | undefined;
  const originLat = typeof originRaw?.lat === 'number' ? originRaw.lat : NaN;
  const originLng = typeof originRaw?.lng === 'number' ? originRaw.lng : NaN;
  const schulKndCode = String(body.schulKndCode ?? '') as SchulKndCode;
  const sigungu = String(body.sigungu ?? '');
  const ownership = String(body.ownership ?? '') as OwnershipFilter;
  const offset =
    typeof body.offset === 'number' && Number.isFinite(body.offset)
      ? Math.max(0, Math.floor(body.offset))
      : 0;

  // 대한민국 영토 대략 범위 — 클라 변조·오류로 엉뚱한 좌표가 들어오는 걸 걸러낸다.
  const validOrigin =
    Number.isFinite(originLat) &&
    Number.isFinite(originLng) &&
    originLat >= 33 &&
    originLat <= 39 &&
    originLng >= 124 &&
    originLng <= 132;

  if (!validOrigin) return bad('출발지 좌표가 올바르지 않습니다. 주소를 다시 검색해 주세요.');
  if (!LEVELS.has(schulKndCode)) return bad('학교급을 선택해 주세요.');
  if (!CHUNGBUK_SIGUNGU_ORDER.includes(sigungu)) return bad('시·군을 선택해 주세요.');
  if (!OWNERSHIPS.has(ownership)) return bad('설립구분을 선택해 주세요.');

  const result = await computeRanking({
    origin: { lat: originLat, lng: originLng },
    schulKndCode,
    sigungu,
    ownership,
    offset,
  });

  if ('error' in result) {
    return bad('경로 계산 기능이 아직 설정되지 않았습니다.', 503);
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
