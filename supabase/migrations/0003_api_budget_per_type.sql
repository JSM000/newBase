-- api_budget을 API 종류별로 분리 (계획: _refs/카카오_API_쿼터.md)
--
-- 0002는 day만 키였음 — 길찾기(directions) 전용이라 그걸로 충분했음. 이제 지오코딩(주소·키워드
-- 검색)도 같은 방식으로 서버 쿼터를 걸려는데, 이 셋은 무료한도·단가가 전부 달라서
-- (길찾기 10,000/일·8원, 주소 100,000/일·0.5원, 키워드 100,000/일·2원) 하나의 카운터로 합치면
-- 서로 다른 API 소진량이 뒤섞여 부정확하다. day 옆에 api_type을 추가해 종류별로 따로 센다.
--
-- Supabase SQL Editor에서 실행한다. 재실행해도 안전(idempotent).

alter table public.api_budget
  add column if not exists api_type text not null default 'directions';

-- 기존 PK(day)를 (day, api_type)로 교체 — idempotent(이미 바뀐 상태로 재실행해도 안전).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'api_budget_pkey' and conrelid = 'public.api_budget'::regclass
  ) then
    alter table public.api_budget drop constraint api_budget_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'api_budget_pkey_day_type' and conrelid = 'public.api_budget'::regclass
  ) then
    alter table public.api_budget add constraint api_budget_pkey_day_type primary key (day, api_type);
  end if;
end $$;

-- 이후 신규 insert는 항상 api_type을 명시하게 default 제거.
alter table public.api_budget alter column api_type drop default;

-- api_type을 코드가 실제로 쓰는 3개 값으로 고정 — 오타(예: 'geocode_adress')가 새 카운터로
-- 조용히 분리돼 그 API에 한도가 사실상 안 걸리는 사고를 막는다. 종류가 늘면 이 제약도 같이 넓힐 것.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'api_budget_api_type_check' and conrelid = 'public.api_budget'::regclass
  ) then
    alter table public.api_budget
      add constraint api_budget_api_type_check
      check (api_type in ('directions', 'geocode_address', 'geocode_keyword'));
  end if;
end $$;

-- 함수 시그니처가 바뀌므로(date,int,int) -> (date,text,int,int) 옛 버전을 먼저 지운다.
drop function if exists public.reserve_api_budget(date, int, int);

create or replace function public.reserve_api_budget(p_day date, p_api_type text, p_n int, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  -- p_n=0 이나 절댓값 500 초과는 거부. 음수는 허용 — 실패한 호출분을 되돌리는 롤백 경로가
  -- 음수 p_n(+큰 p_limit)으로 이 함수를 재호출한다(route-ranking.ts BUDGET_ROLLBACK_LIMIT 참고).
  -- used가 음수로 내려가는 것 자체는 테이블의 api_budget_used_nonneg CHECK가 막는다.
  if p_n = 0 or abs(p_n) > 500 then
    raise exception 'reserve_api_budget: p_n out of range (%)', p_n;
  end if;
  if p_limit <= 0 then
    raise exception 'reserve_api_budget: p_limit must be positive (%)', p_limit;
  end if;
  if p_api_type is null or length(trim(p_api_type)) = 0 then
    raise exception 'reserve_api_budget: p_api_type required';
  end if;

  insert into public.api_budget (day, api_type, used)
  select p_day, p_api_type, p_n where p_n <= p_limit
  on conflict (day, api_type) do update
    set used = api_budget.used + p_n
    where api_budget.used + p_n <= p_limit
  returning used into v_used;
  return v_used;
end;
$$;

revoke all on function public.reserve_api_budget(date, text, int, int) from public, anon, authenticated;
grant execute on function public.reserve_api_budget(date, text, int, int) to service_role;

-- api_type 값 목록(코드에서 쓰는 문자열 그대로, 위 CHECK 제약과 일치시킬 것):
--   'directions'      길찾기(route-ranking.ts)
--   'geocode_address'  주소 검색(kakao-geocode.ts)
--   'geocode_keyword'  키워드 검색 폴백(kakao-geocode.ts)
