import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * 학교 별점 집계 + 조회수를 한 번에 반환 (계획 _refs/학교_별점_조회수_구현계획.md 3-3).
 *
 * 반환: { [schulCode]: { avg: number | null, count: number, views: number } }
 *
 * 캐싱: Route Handler는 Next 데이터 캐시에는 안 담기지만(동적 실행), 응답의
 * `Cache-Control` 헤더는 그대로 CDN(Vercel Edge)에 전달된다. `s-maxage=60`이라
 * 요청이 들어왔을 때만, 캐시가 60초보다 오래됐으면 그때 1회 DB를 친다(크론 아님).
 * `force-static`은 쓰지 않는다 — 그러면 빌드 시점 값으로 고정됨.
 */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    // env 미설정 — 소셜 기능 비활성. 빈 맵을 주되 캐시는 하지 않는다.
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }

  const [ratingsRes, viewsRes] = await Promise.all([
    supabase
      .from('school_rating_stats')
      .select('school_code, avg_rating, rating_count'),
    supabase.from('school_views').select('school_code, view_count'),
  ]);

  if (ratingsRes.error || viewsRes.error) {
    console.error(
      'school-social 조회 실패',
      ratingsRes.error ?? viewsRes.error,
    );
    return NextResponse.json(
      { error: '집계를 불러오지 못했습니다.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const map: Record<
    string,
    { avg: number | null; count: number; views: number }
  > = {};

  for (const r of ratingsRes.data ?? []) {
    map[r.school_code] = {
      avg: r.avg_rating === null ? null : Number(r.avg_rating),
      count: r.rating_count ?? 0,
      views: 0,
    };
  }
  for (const v of viewsRes.data ?? []) {
    const e = map[v.school_code] ?? { avg: null, count: 0, views: 0 };
    e.views = Number(v.view_count ?? 0);
    map[v.school_code] = e;
  }

  return NextResponse.json(map, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
