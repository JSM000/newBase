'use client';

import { useDeferredValue, useRef, useState } from 'react';
import { Flag, MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  COMMENT_LIMITS,
  REPORT_REASON_LABEL,
  commentErrorMessage,
  useAddComment,
  useDeleteComment,
  useReportComment,
  useSchoolComments,
  type CommentReportReason,
  type SchoolComment,
} from '@/hooks/use-school-comments';
import {
  getReportedCommentIds,
  getSavedNickname,
  setSavedNickname,
} from '@/lib/school-social-client';
import {
  describePiiKinds,
  detectPii,
  hasBlockingPii,
  looksLikeRealName,
  maskPii,
} from '@/lib/pii-detect';

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
  // 비밀번호 없이 등록을 누르면 띄우는 경고 — 버튼은 막지 않고, 누른 시점에 안내 후 등록만 막는다.
  const [passwordWarning, setPasswordWarning] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // 개인정보 검출 — 입력할 때마다 바로 돌리되(정규식이라 가벼움) 타이핑을 막지 않게 deferred 값으로.
  // 등록 버튼 판정은 지연 없이 현재 값으로 한 번 더 검사한다(아래 submit).
  const deferredBody = useDeferredValue(body);
  const deferredNickname = useDeferredValue(nickname);
  const bodyMatches = detectPii(deferredBody);
  const nicknameMatches = detectPii(deferredNickname);
  const allMatches = [...bodyMatches, ...nicknameMatches];
  const blocked = hasBlockingPii(allMatches);
  const warned = !blocked && allMatches.length > 0;
  const realNameNickname = !blocked && looksLikeRealName(deferredNickname);

  const trimmedBody = body.trim();
  const passwordOk =
    password.length >= COMMENT_LIMITS.passwordMin && password.length <= COMMENT_LIMITS.passwordMax;
  // 비밀번호는 버튼 활성 조건에서 뺀다 — 눌렀을 때 submit에서 경고하고 막는다.
  const canSubmit = trimmedBody.length > 0 && !blocked && !addComment.isPending;

  /** 차단 등급(전화·주민번호 등)만 ●●●로 바꿔 입력칸에 반영 — 사용자가 확인한 뒤 등록한다. */
  function maskBlocked() {
    setBody((b) => maskPii(b, detectPii(b), 'block'));
    setNickname((n) => maskPii(n, detectPii(n), 'block'));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (!passwordOk) {
      setPasswordWarning(true);
      passwordInputRef.current?.focus();
      return;
    }
    const now = [...detectPii(trimmedBody), ...detectPii(nickname)];
    if (hasBlockingPii(now)) return;
    if (
      now.length > 0 &&
      !window.confirm(
        `${describePiiKinds(now, 'warn')}이(가) 포함된 것 같아요.\n특정인을 알아볼 수 있는 내용이면 지워 주세요.\n\n그대로 등록할까요?`,
      )
    ) {
      return;
    }
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
          ref={passwordInputRef}
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            // 조건을 채우면 경고를 바로 거둔다
            if (e.target.value.length >= COMMENT_LIMITS.passwordMin) setPasswordWarning(false);
          }}
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
      {blocked && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
          <span>
            {describePiiKinds(allMatches, 'block')}(으)로 보이는 내용이 있어 등록할 수 없습니다.
          </span>
          <button
            type="button"
            onClick={maskBlocked}
            className="shrink-0 font-semibold underline-offset-2 hover:underline"
          >
            가리기
          </button>
        </div>
      )}
      {warned && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
          {describePiiKinds(allMatches, 'warn')}이(가) 포함된 것 같아요. 특정인을 알아볼 수 있으면 지워
          주세요.
        </p>
      )}
      {passwordWarning && !passwordOk && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
          댓글을 등록하려면 삭제용 비밀번호({COMMENT_LIMITS.passwordMin}~{COMMENT_LIMITS.passwordMax}자)를
          입력해야 합니다.
        </p>
      )}
      {realNameNickname && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
          닉네임은 실명 대신 별명을 권장해요.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-snug text-zinc-400">
          이름·전화번호·주소 등 다른 사람을 알아볼 수 있는 정보는 쓰지 마세요. 개인정보가 담긴 댓글은
          등록되지 않거나 신고로 숨겨질 수 있습니다.
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
  const reportComment = useReportComment(schoolCode);
  // lazy 초기화 — 댓글 목록은 클라이언트에서 불러온 뒤에만 렌더되므로 hydration 불일치 없음
  const [reported, setReported] = useState(() => getReportedCommentIds().includes(comment.id));
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
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

  function report(reason: CommentReportReason) {
    setReportMsg(null);
    reportComment.mutate(
      { commentId: comment.id, reason },
      {
        onSuccess: (result) => {
          setReportOpen(false);
          if (result === 'not_found') {
            setReportMsg('이미 삭제되었거나 숨겨진 댓글입니다.');
            return;
          }
          setReported(true);
          setReportMsg(
            result === 'hidden'
              ? '신고가 누적되어 이 댓글은 숨겨집니다.'
              : result === 'already'
                ? '이미 신고한 댓글입니다.'
                : '신고가 접수되었습니다.',
          );
        },
        onError: (err) => setReportMsg(commentErrorMessage(err)),
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
        <div className="flex shrink-0 items-center">
          {!comment.is_mine && (
            <button
              type="button"
              onClick={() => setReportOpen((v) => !v)}
              disabled={reported || reportComment.isPending}
              className="flex items-center gap-0.5 rounded p-1 text-[11px] text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-zinc-300"
              aria-label="댓글 신고"
              title={reported ? '신고함' : '신고'}
            >
              <Flag className="h-3.5 w-3.5" />
              {reported && <span>신고함</span>}
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteClick}
            disabled={deleteComment.isPending}
            className="rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
            aria-label="댓글 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
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
      {reportOpen && !reported && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-zinc-50 px-2 py-1.5">
          <span className="text-[11px] text-zinc-500">신고 사유</span>
          {(Object.keys(REPORT_REASON_LABEL) as CommentReportReason[]).map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => report(reason)}
              disabled={reportComment.isPending}
              className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              {REPORT_REASON_LABEL[reason]}
            </button>
          ))}
        </div>
      )}
      {reportMsg && <p className="mt-1 text-[11px] text-zinc-500">{reportMsg}</p>}
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
