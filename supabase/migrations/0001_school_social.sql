-- 학교 별점·조회수 기능 (계획: _refs/학교_별점_조회수_구현계획.md 3-2)
--
-- Supabase SQL Editor에서 1회 실행한다. v1은 Supabase Auth를 쓰지 않고
-- 클라이언트가 생성한 localStorage client_id(uuid)로만 사용자를 구분한다 — 흥미 중심
-- 기능이라 위조를 감수한다(추후 익명 로그인으로 교체, 계획 9번).

-- ─────────────── 별점 ───────────────

-- (client_id, school_code) 당 1행. 재투표는 rate_school() 이 갱신.
create table if not exists public.school_ratings (
  client_id   uuid        not null,
  school_code text        not null,
  rating      smallint    not null check (rating between 1 and 5),
  updated_at  timestamptz not null default now(),
  primary key (client_id, school_code)
);

alter table public.school_ratings enable row level security;

-- 집계는 누구나 읽기 가능. 개별 행 insert/update/delete 정책은 두지 않는다
-- → 테이블 직접 쓰기는 전부 막히고, 아래 rate_school() RPC(security definer)로만 가능.
drop policy if exists "read all ratings" on public.school_ratings;
create policy "read all ratings" on public.school_ratings for select using (true);

-- 학교별 평균 별점 + 참여자 수
create or replace view public.school_rating_stats
with (security_invoker = true) as
select school_code,
       round(avg(rating)::numeric, 2) as avg_rating,
       count(*)::int                  as rating_count
from public.school_ratings
group by school_code;

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

drop policy if exists "read all views" on public.school_views;
create policy "read all views" on public.school_views for select using (true);
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
