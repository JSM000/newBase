import { NextResponse } from 'next/server';

// 제거됨 — 경로 폴리라인은 이제 `/api/route-ranking` 응답에 인라인으로 포함된다.
// `src/app/api/route-path/` 디렉터리 삭제 가능.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { error: '이 엔드포인트는 제거됐습니다.' },
    { status: 410 },
  );
}
