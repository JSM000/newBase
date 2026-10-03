-- 작성자가 직접 지운 댓글은 바로 실제로 삭제한다 (0005의 soft delete 변경).
--
-- Supabase SQL Editor에서 실행한다. 0006 다음에 실행. 재실행해도 안전(idempotent).
--
-- 보관 원칙:
--   - 작성자 삭제(같은 브라우저 또는 비밀번호) → 행 자체를 delete. 본문·IP 해시·비밀번호 해시가 남지 않는다.
--     그 댓글에 쌓인 신고 기록도 FK(on delete cascade)로 같이 지워진다.
--   - 신고 누적 자동 숨김(hidden_reason='reports')·관리자 숨김('admin') → 지금처럼 deleted_at 만 채워 보관.
--     오신고 복구와 분쟁 대응용. 보관 기한·자동 정리는 두지 않는다(필요해지면 관리자가 직접 정리).
--
-- 바뀌는 점: 작성 횟수 제한(30초 1개·하루 30개·IP 10분 10개)은 school_comments 행 수로 세므로,
-- 지운 댓글은 더 이상 이 계산에 들어가지 않는다.

-- 삭제 — 같은 client_id 이거나 비밀번호가 맞으면 행을 지운다. 지웠으면 true, 아니면 false.
-- 이미 숨겨진(신고·관리자) 댓글은 작성자도 지울 수 없다(deleted_at is null 조건) — 숨김 기록 보존.
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
  delete from public.school_comments c
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

-- 이 마이그레이션 전에 작성자가 지워서 soft delete 로 남아 있던 행 정리.
-- hidden_reason 이 비어 있는 숨김 행 = 작성자 삭제(0006 이후 신고·관리자 숨김은 hidden_reason 이 채워짐).
delete from public.school_comments
where deleted_at is not null
  and hidden_reason is null;
