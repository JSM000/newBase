import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 학교 별점·조회수용 Supabase 클라이언트 (계획: _refs/학교_별점_조회수_구현계획.md 3-1).
 *
 * - env(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_KEY)는 `.env`에 커밋하지 않는다.
 *   로컬: `NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_KEY=... npm run dev`
 *   배포: Vercel 환경변수
 * - KEY에는 브라우저 노출용 공개 키를 넣는다 — Supabase 대시보드의 `publishable`
 *   (`sb_publishable_...`) 또는 구형 프로젝트의 `anon` (`eyJ...`). 둘 다 RLS 적용을
 *   받고 로그인 안 한 요청은 Postgres `anon` 역할로 처리된다. `secret`/`service_role`
 *   키는 절대 쓰지 않는다.
 * - 두 값이 없으면 `isSupabaseConfigured === false` → 소셜 기능(별점 위젯·조회수)만 조용히
 *   비활성화되고 지도는 정상 동작한다.
 * - v1은 Supabase Auth 미사용(persistSession/autoRefreshToken false). 사용자 구분은
 *   localStorage client_id (src/lib/school-social-client.ts).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
