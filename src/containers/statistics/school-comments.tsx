'use client';

import { useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  COMMENT_LIMITS,
  commentErrorMessage,
  useAddComment,
  useDeleteComment,
  useSchoolComments,
  type SchoolComment,
} from '@/hooks/use-school-comments';
import { getSavedNickname, setSavedNickname } from '@/lib/school-social-client';

/** "방금 전" / "5분 전" / "3시간 전" / "2026. 10. 2." */
function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return d.toLocaleDateString('ko-KR');
}

/** 댓글 입력 폼 — 상세 패널이 스크롤 영역 밖(사이드바 아래쪽)에 고정해서 렌더한다. */
export function SchoolCommentForm({ schoolCode }: { schoolCode: string }) {
  const addComment = useAddComment(schoolCode);
  // lazy 초기화 — 댓글 폼은 학교 선택 후에만 렌더되므로 hydration 불일치 없음(myRatings와 같은 패턴)
  const [nickname, setNickname] = useState(getSavedNickname);
  const [password, setPassword] = useState('');
  const [body, setBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedBody = body.trim();
  const passwordOk =
    password.length >= COMMENT_LIMITS.passwordMin && password.length <= COMMENT_LIMITS.passwordMax;
  const canSubmit = trimmedBody.length > 0 && passwordOk && !addComment.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMsg(null);
    addComment.mutate(
      { nickname: nickname.trim(), body: trimmedBody, password },
      {
        onSuccess: () => {
          setSavedNickname(nickname.trim());
          setBody('');
          setPassword('');
        },
        onError: (err) => setErrorMsg(commentErrorMessage(err)),
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-zinc-200 bg-zinc-50 p-3">
      <div className="flex gap-2">
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={COMMENT_LIMITS.nicknameMax}
          placeholder="닉네임 (선택)"
          aria-label="닉네임"
          className="h-9 bg-white text-xs"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={COMMENT_LIMITS.passwordMax}
          placeholder={`삭제용 비밀번호 (${COMMENT_LIMITS.passwordMin}자 이상)`}
          aria-label="삭제용 비밀번호"
          autoComplete="new-password"
          className="h-9 bg-white text-xs"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={COMMENT_LIMITS.bodyMax}
        rows={3}
        placeholder="이 학교에 대한 이야기를 남겨 주세요."
        aria-label="댓글 내용"
        className="w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-snug text-zinc-400">
          이름·연락처 등 개인정보와 특정인 비방은 남기지 마세요.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-zinc-400">
            {body.length}/{COMMENT_LIMITS.bodyMax}
          </span>
          <Button type="submit" size="sm" disabled={!canSubmit} className="h-8 px-3 text-xs">
            {addComment.isPending ? '등록 중…' : '등록'}
          </Button>
        </div>
      </div>
      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
    </form>
  );
}

function CommentItem({ comment, schoolCode }: { comment: SchoolComment; schoolCode: string }) {
  const deleteComment = useDeleteComment(schoolCode);
  // 남의 브라우저에서 쓴 댓글(is_mine=false)은 비밀번호 입력칸을 펼쳐서 지운다.
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function remove(withPassword?: string) {
    setErrorMsg(null);
    deleteComment.mutate(
      { commentId: comment.id, password: withPassword },
      {
        onSuccess: (deleted) => {
          if (!deleted) setErrorMsg('비밀번호가 맞지 않습니다.');
        },
        onError: (err) => setErrorMsg(commentErrorMessage(err)),
      },
    );
  }

  function onDeleteClick() {
    if (comment.is_mine) {
      if (window.confirm('이 댓글을 삭제할까요?')) remove();
      return;
    }
    setAskPassword((v) => !v);
  }

  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-xs font-semibold text-zinc-700">{comment.nickname}</span>
          {comment.is_mine && (
            <span className="shrink-0 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">내 댓글</span>
          )}
          <span className="shrink-0 text-[11px] text-zinc-400">{formatCommentTime(comment.created_at)}</span>
        </div>
        <button
          type="button"
          onClick={onDeleteClick}
          disabled={deleteComment.isPending}
          className="shrink-0 rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
          aria-label="댓글 삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
        {comment.body}
      </p>
      {askPassword && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password) remove(password);
          }}
          className="mt-2 flex gap-2"
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={COMMENT_LIMITS.passwordMax}
            placeholder="작성 시 입력한 비밀번호"
            aria-label="삭제 비밀번호"
            autoComplete="off"
            className="h-8 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!password || deleteComment.isPending}
            className="h-8 shrink-0 px-3 text-xs"
          >
            삭제
          </Button>
        </form>
      )}
      {errorMsg && <p className="mt-1 text-xs text-red-600">{errorMsg}</p>}
    </li>
  );
}

/**
 * 학교 상세 > 커뮤니티 탭의 댓글 목록. 로그인 없이 닉네임 + 삭제용 비밀번호 방식.
 * 입력 폼(SchoolCommentForm)은 스크롤과 무관하게 사이드바 아래에 고정되도록 패널이 따로 렌더한다.
 */
export function SchoolComments({ schoolCode }: { schoolCode: string }) {
  const query = useSchoolComments(schoolCode);
  const comments = query.data?.pages.flat() ?? [];

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <MessageCircle className="h-3.5 w-3.5" />
        댓글
      </h3>

      {query.isLoading ? (
        <p className="py-6 text-center text-xs text-zinc-400">댓글 불러오는 중…</p>
      ) : query.isError ? (
        <p className="py-6 text-center text-xs text-red-600">댓글을 불러오지 못했습니다.</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-400">첫 댓글을 남겨 보세요.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-zinc-100">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} schoolCode={schoolCode} />
            ))}
          </ul>
          {query.hasNextPage && (
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="mt-1 w-full rounded-md py-2 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
            >
              {query.isFetchingNextPage ? '불러오는 중…' : '댓글 더 보기'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
