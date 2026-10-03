-- 댓글 개인정보 서버 차단 + 신고 기능 (계획: _refs/개인정보_검출_구현계획/02_댓글.md).
--
-- Supabase SQL Editor에서 실행한다. 0005_school_comments.sql 다음에 실행. 재실행해도 안전(idempotent).
--
-- 1) _contains_blocked_pii: 주민등록번호·휴대전화·전화·이메일·계좌번호 패턴이 있으면 true.
--    브라우저(src/lib/pii-detect.ts의 'block' 규칙)와 같은 정규식이다 — 한쪽을 바꾸면 같이 바꿀 것.
--    브라우저 검사는 우회할 수 있으므로 add_school_comment 가 저장 전에 이걸로 한 번 더 막는다.
--    이름·주소·직위(경고 등급)는 오검출이 있어 서버에선 막지 않는다(화면에서 확인 후 등록 허용).
-- 2) 신고: 댓글마다 신고(개인정보/비방/기타). 서로 다른 신고자(IP 해시, 없으면 client_id 기준)가
--    5명 이상이면 자동으로 숨긴다(deleted_at + hidden_reason='reports'). 관리자는 대시보드에서
--    deleted_at·hidden_reason 을 비워 복구할 수 있다.

-- ── 1. 개인정보 패턴 ──
create or replace function public._contains_blocked_pii(p text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p, '') ~ '(?<![0-9-])[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])(\s*-\s*[1-8]([0-9]{6}|[*●xX]{6})|[1-8][0-9]{6})(?![0-9])'
      or coalesce(p, '') ~ '(?<![0-9A-Za-z-])01[016789][-. ]?[0-9]{3,4}[-. ]?[0-9]{4}(?![0-9])'
      or coalesce(p, '') ~ '(?<![0-9A-Za-z-])0(2|[3-6][1-5])[-. )] ?[0-9]{3,4}[-. ][0-9]{4}(?![0-9])'
      or coalesce(p, '') ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
      or coalesce(p, '') ~ '(국민|신한|우리|하나|농협|기업|SC제일|제일|씨티|카카오뱅크|카카오|토스뱅크|토스|케이뱅크|새마을금고|새마을|우체국|수협|신협|부산|대구|경남|광주|전북|제주|산업|계좌)(은행|번호)?\s*[:：]?\s*[0-9][0-9-]{8,18}[0-9]';
$$;

revoke all on function public._contains_blocked_pii(text) from public;

-- ── 2. 숨김 사유 컬럼 ──
alter table public.school_comments
  add column if not exists hidden_reason text;
-- null = 정상 또는 작성자 삭제, 'reports' = 신고 누적 자동 숨김, 'admin' = 관리자 숨김(대시보드에서 직접 기록)

-- ── 3. 작성 — 0005 버전에 개인정보 검사만 추가 ──
-- 예외 코드: invalid_school / invalid_nickname / invalid_body / invalid_password / contains_pii /
--            rate_limited / daily_limited
drop function if exists public.add_school_comment(uuid, text, text, text, text);
create function public.add_school_comment(
  p_client_id   uuid,
  p_school_code text,
  p_nickname    text,
  p_body        text,
  p_password    text
)
returns table (id bigint, nickname text, body text, created_at timestamptz, is_mine boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text := coalesce(nullif(trim(p_nickname), ''), '익명');
  v_body     text := trim(coalesce(p_body, ''));
  v_ip_hash  text := public._request_ip_hash();
  v_row      public.school_comments;
begin
  if p_client_id is null then
    raise exception 'invalid_client';
  end if;
  if p_school_code is null or p_school_code !~ '^[A-Z][0-9]{9}$' then
    raise exception 'invalid_school';
  end if;
  if char_length(v_nickname) > 20 then
    raise exception 'invalid_nickname';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'invalid_body';
  end if;
  if p_password is null or char_length(p_password) < 4 or char_length(p_password) > 32 then
    raise exception 'invalid_password';
  end if;
  if public._contains_blocked_pii(v_body) or public._contains_blocked_pii(v_nickname) then
    raise exception 'contains_pii';
  end if;

  if exists (
    select 1 from public.school_comments c
    where c.client_id = p_client_id and c.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'rate_limited';
  end if;
  if (
    select count(*) from public.school_comments c
    where c.client_id = p_client_id and c.created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'daily_limited';
  end if;
  if v_ip_hash is not null and (
    select count(*) from public.school_comments c
    where c.ip_hash = v_ip_hash and c.created_at > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.school_comments (school_code, client_id, ip_hash, nickname, body, password_hash)
  values (
    p_school_code, p_client_id, v_ip_hash, v_nickname, v_body,
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  )
  returning * into v_row;

  return query select v_row.id, v_row.nickname, v_row.body, v_row.created_at, true;
end;
$$;

revoke all on function public.add_school_comment(uuid, text, text, text, text) from public;
grant execute on function public.add_school_comment(uuid, text, text, text, text) to anon;

-- ── 4. 신고 ──
create table if not exists public.school_comment_reports (
  comment_id  bigint      not null references public.school_comments (id) on delete cascade,
  client_id   uuid        not null,
  ip_hash     text,
  reason      text        not null check (reason in ('privacy', 'abuse', 'other')),
  created_at  timestamptz not null default now(),
  primary key (comment_id, client_id)
);

create index if not exists school_comment_reports_client_idx
  on public.school_comment_reports (client_id, created_at desc);

alter table public.school_comment_reports enable row level security;
revoke all on public.school_comment_reports from anon, authenticated;

-- 반환: 'reported'(접수) / 'already'(이 브라우저가 이미 신고) / 'hidden'(이번 신고로 숨김 기준 도달) /
--       'not_found'(없거나 이미 숨겨진 댓글). 예외: invalid_reason / invalid_client / daily_limited
drop function if exists public.report_school_comment(bigint, uuid, text);
create function public.report_school_comment(
  p_comment_id bigint,
  p_client_id  uuid,
  p_reason     text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash   text := public._request_ip_hash();
  v_reporters int;
begin
  if p_client_id is null then
    raise exception 'invalid_client';
  end if;
  if p_reason is null or p_reason not in ('privacy', 'abuse', 'other') then
    raise exception 'invalid_reason';
  end if;
  if not exists (
    select 1 from public.school_comments c where c.id = p_comment_id and c.deleted_at is null
  ) then
    return 'not_found';
  end if;
  -- 신고 남용 방지: 브라우저당 하루 20건
  if (
    select count(*) from public.school_comment_reports r
    where r.client_id = p_client_id and r.created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'daily_limited';
  end if;

  insert into public.school_comment_reports (comment_id, client_id, ip_hash, reason)
  values (p_comment_id, p_client_id, v_ip_hash, p_reason)
  on conflict (comment_id, client_id) do nothing;
  if not found then
    return 'already';
  end if;

  -- 서로 다른 신고자 수 — 한 사람이 브라우저 ID만 바꿔 여러 번 신고하는 걸 줄이려고 IP 해시 기준,
  -- IP를 못 얻은 신고는 client_id 기준으로 센다.
  select count(distinct coalesce(r.ip_hash, r.client_id::text)) into v_reporters
  from public.school_comment_reports r
  where r.comment_id = p_comment_id;

  if v_reporters >= 5 then
    update public.school_comments c
    set deleted_at = now(), hidden_reason = 'reports'
    where c.id = p_comment_id and c.deleted_at is null;
    return 'hidden';
  end if;
  return 'reported';
end;
$$;

revoke all on function public.report_school_comment(bigint, uuid, text) from public;
grant execute on function public.report_school_comment(bigint, uuid, text) to anon;

-- ── 5. 이미 올라온 댓글 점검 (필요할 때 따로 실행) ──
-- 이 마이그레이션 전에 쓰인 댓글 중 차단 패턴에 걸리는 것의 id만 본다(원문은 조회하지 않음):
--
--   select id, school_code, created_at
--   from public.school_comments
--   where deleted_at is null
--     and (public._contains_blocked_pii(body) or public._contains_blocked_pii(nickname));
--
-- 숨기려면:
--   update public.school_comments set deleted_at = now(), hidden_reason = 'admin' where id in (...);
