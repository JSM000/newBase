'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { getClientId, markCommentReported } from '@/lib/school-social-client';
import { EMPTY_SOCIAL_ENTRY, SOCIAL_KEY, type SocialMap } from './use-school-social';

/**
 * 학교별 댓글 (supabase/migrations/0005_school_comments.sql).
 *
 * 로그인이 없어 "닉네임 + 삭제용 비밀번호" 방식. 읽기·쓰기·삭제 전부 브라우저 → Supabase RPC 직접 호출.
 * 댓글 목록은 CDN 캐시(/api/school-social)를 거치지 않으므로 쓰기 후 바로 invalidate 해도
 * 방금 쓴 값이 그대로 돌아온다. 반면 댓글 "수"는 별점·즐겨찾기 수처럼 /api/school-social 집계에
 * 들어 있어(s-maxage=60), 거기는 invalidate 대신 ±1 낙관적 반영만 한다(use-school-social.ts의
 * useSyncFavorite와 같은 이유 — 바로 refetch하면 CDN의 오래된 값이 덮어씀).
 */

export interface SchoolComment {
  id: number;
  nickname: string;
  body: string;
  created_at: string;
  /** 이 브라우저(client_id)가 쓴 댓글 — 비밀번호 없이 삭제 가능 */
  is_mine: boolean;
}

const PAGE_SIZE = 30;

export const COMMENT_LIMITS = {
  nicknameMax: 20,
  bodyMax: 500,
  passwordMin: 4,
  passwordMax: 32,
} as const;

const commentsKey = (schoolCode: string) => ['school-comments', schoolCode] as const;

/** RPC 예외 메시지 코드(마이그레이션 참고) → 사용자 문구 */
export function commentErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  if (msg.includes('contains_pii'))
    return '전화번호·주민등록번호·이메일·계좌번호 등 개인정보가 포함되어 등록할 수 없습니다.';
  if (msg.includes('rate_limited')) return '잠시 후 다시 작성해 주세요. (연속 작성 제한)';
  if (msg.includes('daily_limited')) return '오늘 할 수 있는 횟수를 넘었습니다. 내일 다시 시도해 주세요.';
  if (msg.includes('invalid_body')) return `댓글은 1~${COMMENT_LIMITS.bodyMax}자로 입력해 주세요.`;
  if (msg.includes('invalid_nickname')) return `닉네임은 ${COMMENT_LIMITS.nicknameMax}자 이하로 입력해 주세요.`;
  if (msg.includes('invalid_password'))
    return `비밀번호는 ${COMMENT_LIMITS.passwordMin}~${COMMENT_LIMITS.passwordMax}자로 입력해 주세요.`;
  return '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

export function useSchoolComments(schoolCode: string | null) {
  return useInfiniteQuery({
    queryKey: commentsKey(schoolCode ?? ''),
    enabled: isSupabaseConfigured && Boolean(schoolCode),
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const supabase = getSupabase();
      if (!supabase || !schoolCode) return [] as SchoolComment[];
      const { data, error } = await supabase.rpc('list_school_comments', {
        p_school_code: schoolCode,
        p_client_id: getClientId() || null,
        p_before_id: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as SchoolComment[];
    },
    // 한 페이지가 꽉 찼으면 더 있을 수 있음 → 마지막 댓글 id 이전부터 이어서
    getNextPageParam: (last) => (last.length === PAGE_SIZE ? last[last.length - 1].id : undefined),
  });
}

/** 목록은 다시 불러오고, 소셜 집계의 댓글 수는 delta만큼 낙관적으로 반영한다. */
function useRefreshAfterChange() {
  const qc = useQueryClient();
  return (schoolCode: string, delta: 1 | -1) => {
    qc.invalidateQueries({ queryKey: commentsKey(schoolCode) });
    qc.setQueryData<SocialMap>(SOCIAL_KEY, (cur) => {
      if (!cur) return cur;
      const e = cur[schoolCode] ?? EMPTY_SOCIAL_ENTRY;
      return { ...cur, [schoolCode]: { ...e, commentCount: Math.max(0, e.commentCount + delta) } };
    });
  };
}

export function useAddComment(schoolCode: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async (input: { nickname: string; body: string; password: string }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase 미설정');
      const { error } = await supabase.rpc('add_school_comment', {
        p_client_id: getClientId(),
        p_school_code: schoolCode,
        p_nickname: input.nickname,
        p_body: input.body,
        p_password: input.password,
      });
      if (error) throw error;
    },
    onSuccess: () => refresh(schoolCode, 1),
  });
}

export function useDeleteComment(schoolCode: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    /** 지웠으면 true, 비밀번호가 틀렸거나 이미 지워졌으면 false */
    mutationFn: async (input: { commentId: number; password?: string }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase 미설정');
      const { data, error } = await supabase.rpc('delete_school_comment', {
        p_comment_id: input.commentId,
        p_client_id: getClientId() || null,
        p_password: input.password ?? null,
      });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: (deleted) => {
      if (deleted) refresh(schoolCode, -1);
    },
  });
}

export type CommentReportReason = 'privacy' | 'abuse' | 'other';
export type CommentReportResult = 'reported' | 'already' | 'hidden' | 'not_found';

export const REPORT_REASON_LABEL: Record<CommentReportReason, string> = {
  privacy: '개인정보 노출',
  abuse: '비방·욕설',
  other: '기타',
};

/** 신고. 서로 다른 신고자 5명 이상이면 서버가 자동으로 숨긴다(0006 마이그레이션). */
export function useReportComment(schoolCode: string) {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async (input: { commentId: number; reason: CommentReportReason }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase 미설정');
      const { data, error } = await supabase.rpc('report_school_comment', {
        p_comment_id: input.commentId,
        p_client_id: getClientId(),
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as CommentReportResult;
    },
    onSuccess: (result, input) => {
      if (result === 'reported' || result === 'already' || result === 'hidden') {
        markCommentReported(input.commentId);
      }
      // 이번 신고로 숨겨졌으면 목록에서 빠지고 댓글 수도 하나 줄어든다
      if (result === 'hidden') refresh(schoolCode, -1);
    },
  });
}
