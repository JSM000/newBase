-- 학교별 댓글 (통계지도 학교 상세 > 커뮤니티 탭).
--
-- Supabase SQL Editor에서 실행한다. 재실행해도 안전(idempotent).
--
-- 로그인이 없으므로 익명 게시판에서 흔히 쓰는 "닉네임 + 비밀번호" 방식을 쓴다.
--   - 작성: 닉네임(없으면 '익명') + 삭제용 비밀번호. 비밀번호는 bcrypt 해시로만 저장.
--   - 삭제: 같은 브라우저(client_id 일치)면 바로, 다른 기기·스토리지를 지운 뒤라면 비밀번호로.
--   - 수정은 없음 — 지우고 다시 쓰면 된다(익명 댓글에서 수정은 남용 소지가 커서 뺐다).
--
-- 권한 원칙 (0001·0004와 동일):
--   - school_comments 원본 행에는 client_id·비밀번호 해시·IP 해시가 있으므로 anon 에게 직접 노출하지 않는다.
--   - 읽기·쓰기·삭제는 전부 SECURITY DEFINER RPC로만.
--
-- 도배 방지 (로그인이 없어 완벽하진 않음 — client_id는 위조 가능하므로 IP 해시 기준도 같이 건다):
--   - 같은 client_id: 30초에 1개, 하루 30개
--   - 같은 IP: 10분에 10개 (IP 원문은 저장하지 않고 SHA-256 해시만, 도배 제한 용도로만 사용)
-- 부적절한 댓글은 Supabase 대시보드에서 deleted_at 을 채워 숨긴다(soft delete).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.school_comments (
  id            bigint generated always as identity primary key,
  school_code   text        not null check (school_code ~ '^[A-Z][0-9]{9}$'),
  client_id     uuid        not null,
  ip_hash       text,
  nickname      text        not null check (char_length(nickname) between 1 and 20),
  body          text        not null check (char_length(body) between 1 and 500),
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists school_comments_school_idx
  on public.school_comments (school_code, created_at desc)
  where deleted_at is null;
create index if not exists school_comments_client_idx
  on public.school_comments (client_id, created_at desc);
create index if not exists school_comments_ip_idx
  on public.school_comments (ip_hash, created_at desc);

alter table public.school_comments enable row level security;

-- 원본 행 직접 접근은 전부 차단 (정책 없음 + anon 권한 회수).
revoke all on public.school_comments from anon, authenticated;

-- PostgREST가 넘겨주는 요청 헤더에서 클라이언트 IP를 꺼내 해시한다. 헤더가 없으면 null(IP 제한 생략).
create or replace function public._request_ip_hash()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  if v_headers is null then
    return null;
  end if;
  v_ip := coalesce(
    v_headers ->> 'cf-connecting-ip',
    trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1))
  );
  if v_ip is null or v_ip = '' then
    return null;
  end if;
  return encode(extensions.digest(v_ip, 'sha256'), 'hex');
end;
$$;

revoke all on function public._request_ip_hash() from public;

-- 목록 — 최신순. is_mine: 이 브라우저(client_id)가 쓴 댓글인지(삭제 버튼 표시용). client_id 자체는 돌려주지 않는다.
-- p_before_id 를 주면 그보다 오래된 것만(더 보기).
drop function if exists public.list_school_comments(text, uuid, bigint, int);
create function public.list_school_comments(
  p_school_code text,
  p_client_id   uuid,
  p_before_id   bigint default null,
  p_limit       int    default 30
)
returns table (id bigint, nickname text, body text, created_at timestamptz, is_mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.body, c.created_at, (c.client_id = p_client_id) as is_mine
  from public.school_comments c
  where c.school_code = p_school_code
    and c.deleted_at is null
    and (p_before_id is null or c.id < p_before_id)
  order by c.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function public.list_school_comments(text, uuid, bigint, int) from public;
grant execute on function public.list_school_comments(text, uuid, bigint, int) to anon;

-- 학교별 댓글 수 — 별점·조회수·즐겨찾기 수와 함께 /api/school-social 이 한 번에 집계해 내려준다
-- (상세 헤더·커뮤니티 탭 라벨·지도 표시 지표·학교 비교표 공용). school_favorite_stats 와 같은 방식.
drop function if exists public.count_school_comments(text);
drop view if exists public.school_comment_stats;
create view public.school_comment_stats as
select school_code,
       count(*)::int as comment_count
from public.school_comments
where deleted_at is null
group by school_code;

grant select on public.school_comment_stats to anon, authenticated;

-- 작성. 검증 실패·도배 제한은 아래 메시지 코드로 예외를 던진다(클라이언트가 문구로 바꿔 보여줌):
--   invalid_school / invalid_nickname / invalid_body / invalid_password / rate_limited / daily_limited
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

-- 삭제(soft delete). 같은 client_id 이거나 비밀번호가 맞으면 지운다. 지웠으면 true, 아니면 false.
-- ※ 0007_hard_delete_own_comments.sql 에서 "작성자 삭제는 행을 실제로 지움"으로 바뀌었다.
--   이 파일을 다시 실행했다면 0007 도 다시 실행할 것(안 그러면 soft delete 로 되돌아감).
drop function if exists public.delete_school_comment(bigint, uuid, text);
create function public.delete_school_comment(
  p_comment_id bigint,
  p_client_id  uuid,
  p_password   text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.school_comments c
  set deleted_at = now()
  where c.id = p_comment_id
    and c.deleted_at is null
    and (
      c.client_id = p_client_id
      or (p_password is not null and c.password_hash = extensions.crypt(p_password, c.password_hash))
    );
  return found;
end;
$$;

revoke all on function public.delete_school_comment(bigint, uuid, text) from public;
grant execute on function public.delete_school_comment(bigint, uuid, text) to anon;
