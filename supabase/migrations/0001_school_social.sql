-- 학교 별점·조회수 기능 (계획: _refs/학교_별점_조회수_구현계획.md 3-2)
--
-- Supabase SQL Editor에서 실행한다. 재실행해도 안전(idempotent) — 이미 한 번
-- 실행했다면 이 파일 전체를 그대로 다시 붙여넣어 Run 하면 된다(데이터 유지).
--
-- v1은 Supabase Auth를 쓰지 않고 클라이언트가 생성한 localStorage client_id(uuid)로만
-- 사용자를 구분한다 — 흥미 중심 기능이라 위조를 감수한다(추후 익명 로그인, 계획 9번).
--
-- 권한 원칙:
--   - anon 은 집계(school_rating_stats 뷰)와 조회수(school_views)만 SELECT 가능.
--   - school_ratings 원본 행에는 client_id 가 있으므로 anon 에게 직접 노출하지 않는다.
--   - 쓰기는 전부 SECURITY DEFINER RPC(rate_school / bump_school_view)로만.
--   - Supabase는 SQL로 만든 객체에 anon 권한을 자동 부여하지 않을 수 있어 GRANT를 명시한다.

-- ─────────────── 별점 ───────────────

create table if not exists public.school_ratings (
  client_id   uuid        not null,
  school_code text        not null,
  rating      smallint    not null check (rating between 1 and 5),
  updated_at  timestamptz not null default now(),
  primary key (client_id, school_code)
);

alter table public.school_ratings enable row level security;

-- 원본 행 직접 접근은 전부 차단 (정책 없음 + anon 권한 회수).
drop policy if exists "read all ratings" on public.school_ratings;
revoke all on public.school_ratings from anon, authenticated;

-- 학교별 평균 별점 + 참여자 수.
-- security_invoker 미지정 = 뷰 소유자(postgres) 권한으로 실행 → anon 은 이 집계 결과만
-- 볼 수 있고 원본 school_ratings 행에는 접근 불가. (Supabase 린터가 security definer
-- 뷰를 경고하지만, 집계만 노출하는 의도된 패턴이다.)
drop view if exists public.school_rating_stats;
create view public.school_rating_stats as
select school_code,
       round(avg(rating)::numeric, 2) as avg_rating,
       count(*)::int                  as rating_count
from public.school_ratings
group by school_code;

grant select on public.school_rating_stats to anon, authenticated;

-- 별점 등록/갱신
create or replace function public.rate_school(
  p_client_id   uuid,
  p_school_code text,
  p_rating      smallint
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.school_ratings (client_id, school_code, rating)
  values (p_client_id, p_school_code, p_rating)
  on conflict (client_id, school_code)
  do update set rating = excluded.rating, updated_at = now();
$$;

revoke all on function public.rate_school(uuid, text, smallint) from public;
grant execute on function public.rate_school(uuid, text, smallint) to anon;

-- ─────────────── 조회수 ───────────────

create table if not exists public.school_views (
  school_code text        primary key,
  view_count  bigint      not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.school_views enable row level security;

-- 조회수는 학교별 카운터 하나뿐이라 그대로 공개.
drop policy if exists "read all views" on public.school_views;
create policy "read all views" on public.school_views for select using (true);
grant select on public.school_views to anon, authenticated;
-- 직접 쓰기 정책 없음 → bump_school_view() RPC로만 증가.

-- 조회수 원자적 +1 (없으면 1로 생성)
create or replace function public.bump_school_view(p_school_code text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.school_views (school_code, view_count)
  values (p_school_code, 1)
  on conflict (school_code)
  do update set view_count = school_views.view_count + 1, updated_at = now();
$$;

revoke all on function public.bump_school_view(text) from public;
grant execute on function public.bump_school_view(text) to anon;
