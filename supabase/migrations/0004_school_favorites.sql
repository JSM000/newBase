-- 학교 즐겨찾기 횟수 집계 (계획: _refs/즐겨찾기_구현계획/00_개요.md — "즐겨찾기된 횟수를
-- 별점처럼 수집해서 참고 지표로 사용"). 0001_school_social.sql의 school_ratings와 동일한
-- 구조·권한 원칙을 그대로 따른다.
--
-- Supabase SQL Editor에서 실행한다. 재실행해도 안전(idempotent).
--
-- 권한 원칙:
--   - anon 은 집계(school_favorite_stats 뷰)만 SELECT 가능.
--   - school_favorites 원본 행에는 client_id 가 있으므로 anon 에게 직접 노출하지 않는다.
--   - 쓰기는 전부 SECURITY DEFINER RPC(add_school_favorite / remove_school_favorite)로만.
--
-- 별점(school_ratings)과 다른 점: 즐겨찾기는 on/off 토글이라 "값을 바꾸는" 게 아니라
-- "행을 추가/삭제"한다 — remove 시 그냥 delete. 이래야 집계(count)가 "지금 몇 명이
-- 즐겨찾기 중인지"를 그대로 반영한다(해제하면 그 학교의 카운트도 바로 줄어듦).

create table if not exists public.school_favorites (
  client_id   uuid        not null,
  school_code text        not null,
  created_at  timestamptz not null default now(),
  primary key (client_id, school_code)
);

alter table public.school_favorites enable row level security;

-- 원본 행 직접 접근은 전부 차단 (정책 없음 + anon 권한 회수).
revoke all on public.school_favorites from anon, authenticated;

-- 학교별 즐겨찾기 수.
drop view if exists public.school_favorite_stats;
create view public.school_favorite_stats as
select school_code,
       count(*)::int as favorite_count
from public.school_favorites
group by school_code;

grant select on public.school_favorite_stats to anon, authenticated;

-- 즐겨찾기 추가 — 이미 있으면 아무것도 안 함(멱등).
create or replace function public.add_school_favorite(
  p_client_id   uuid,
  p_school_code text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.school_favorites (client_id, school_code)
  values (p_client_id, p_school_code)
  on conflict (client_id, school_code) do nothing;
$$;

revoke all on function public.add_school_favorite(uuid, text) from public;
grant execute on function public.add_school_favorite(uuid, text) to anon;

-- 즐겨찾기 해제 — 없어도 에러 없이 그냥 넘어감(멱등).
create or replace function public.remove_school_favorite(
  p_client_id   uuid,
  p_school_code text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.school_favorites
  where client_id = p_client_id and school_code = p_school_code;
$$;

revoke all on function public.remove_school_favorite(uuid, text) from public;
grant execute on function public.remove_school_favorite(uuid, text) to anon;
