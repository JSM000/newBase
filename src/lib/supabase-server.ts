import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 소요시간 순위 기능 전용 Supabase 서버 클라이언트 (계획: _refs/학교_소요시간_순위_구현계획.md 2-9).
 *
 * - 유일한 용도: 서버 전역 일일 예산 테이블 `api_budget` + `reserve_api_budget` RPC.
 *   (결과·주소 캐시는 v1에서 안 둔다.) RLS 정책이 없어 RLS 를 우회하는 이 키로만 접근 가능하다.
 * - `SUPABASE_SECRET_KEY` 에는 Supabase 대시보드의 **Secret key**(`sb_secret_...`)만 넣는다.
 *   구형 `service_role` JWT(`eyJ...`)나 publishable/anon 키는 사용하지 않는다.
 * - **절대** `NEXT_PUBLIC_` 접두어를 붙이지 않는다 → Next.js 가 클라이언트 번들에 넣지 않는다.
 *   서버(라우트 핸들러)에서만 import 할 것.
 * - URL 은 기존 `NEXT_PUBLIC_SUPABASE_URL` 재사용.
 */

if (typeof window !== 'undefined') {
  // 클라이언트 번들에 잘못 들어온 경우 즉시 터뜨려 눈에 띄게 한다 (키 값 자체는
  // NEXT_PUBLIC_ 이 아니라 브라우저에 전달되지 않지만, 이 모듈이 클라이언트에 섞이는 것 자체가 실수).
  throw new Error('supabase-server 는 서버에서만 import 할 수 있습니다.');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (secretKey && !secretKey.startsWith('sb_secret_')) {
  throw new Error(
    'SUPABASE_SECRET_KEY 에는 Supabase Secret key(sb_secret_...)를 넣으세요. ' +
      'publishable/anon 키나 구형 service_role JWT 는 사용하지 않습니다.',
  );
}

let client: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  if (!url || !secretKey) return null;
  if (!client) {
    client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
