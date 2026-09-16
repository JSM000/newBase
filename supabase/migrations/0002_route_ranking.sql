-- 집→학교 소요시간 순위 기능 — 서버 전역 일일 API 예산 (계획: _refs/학교_소요시간_순위_구현계획.md 5)
--
-- Supabase SQL Editor에서 실행한다. 재실행해도 안전(idempotent).
--
-- v1은 결과·주소 캐시를 두지 않는다(과한 인프라). 남용/요금 방어는:
--   · 서버: 아래 api_budget 로 전역 일일 길찾기 호출 상한
--   · 클라: 검색 1회 후 30초간 재검색 차단 (localStorage, 서버와 무관)
--
-- api_budget 은 서버 라우트 전용 — env `SUPABASE_SECRET_KEY` 에 Supabase 대시보드 > API Keys 의
-- **Secret key**(`sb_secret_...`)만 넣어 접속한다. Secret key 는 Postgres `service_role` 역할로
-- 매핑돼 RLS 를 우회한다. (RLS 는 켜두되 정책 없음 → anon/authenticated 키로는 접근 거부.)

create table if not exists public.api_budget (
  day  date primary key,
  used int  not null default 0
    constraint api_budget_used_nonneg check (used >= 0)
);

alter table public.api_budget enable row level security;

-- 이미 만들어진 테이블(이전 버전 마이그레이션 실행분 — CHECK 에 이름이 없던 버전)에도
-- 이름 있는 CHECK 를 보강 — idempotent. conrelid 로 이 테이블 소속인지까지 확인해
-- 다른 테이블의 동명 제약과 혼동하지 않는다.
-- used 가 음수가 되면 `used + p_n <= p_limit` 가 항상 참이 돼 예산 게이트가 조용히 무력화되므로,
-- 그 방향을 DB 레벨에서 원천 차단한다.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'api_budget_used_nonneg'
      and conrelid = 'public.api_budget'::regclass
  ) then
    alter table public.api_budget
      add constraint api_budget_used_nonneg check (used >= 0);
  end if;
end $$;

-- 예산을 원자적으로 예약한다.
--   반환값 있음 = 예약 성공 (반환값 = 예약 후 누적 사용량)
--   반환값 NULL = 한도 초과 (아무것도 반영 안 됨)
--   예외 = p_n 범위 밖(서버 버그) 또는 used 가 음수로 갈 상황(CHECK 위반) → 카운터 불변, 서버가 로그
-- 롤백(호출 실패분 되돌리기)은 p_n 에 음수, p_limit 에 큰 수를 넣어 호출한다.
create or replace function public.reserve_api_budget(p_day date, p_n int, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  -- 한 요청이 예약/롤백하는 건수는 배치 크기(≤ ROUTE_MAX_PER_QUERY) 수준.
  -- 말도 안 되는 값(예: 롤백 버그로 -1000000)은 여기서 즉시 거부한다.
  if p_n = 0 or abs(p_n) > 500 then
    raise exception 'reserve_api_budget: p_n out of range (%)', p_n;
  end if;

  insert into public.api_budget (day, used)
  select p_day, p_n where p_n <= p_limit
  on conflict (day) do update
    set used = api_budget.used + p_n
    where api_budget.used + p_n <= p_limit
  returning used into v_used;
  return v_used;
end;
$$;

-- anon/authenticated(공개 anon 키로 접근 가능한 역할)가 이 함수를 직접 호출해 예산을
-- 고갈시키지 못하게 PUBLIC 실행 권한을 회수하고, 서버용 service_role 에만 부여한다.
-- (PUBLIC 회수 후엔 service_role 도 명시적 grant 가 있어야 실행 가능 — bypassrls 는 함수
--  실행 권한과 무관.)
revoke all on function public.reserve_api_budget(date, int, int) from public, anon, authenticated;
grant execute on function public.reserve_api_budget(date, int, int) to service_role;

-- 오래된 행 정리는 불필요(하루 1행, 1년 365행). 원하면:
--   delete from public.api_budget where day < current_date - 90;
