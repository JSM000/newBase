'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  getClientId,
  getMyRatings,
  hasViewedThisSession,
  markViewedThisSession,
  setMyRating,
} from '@/lib/school-social-client';

/**
 * 학교 소셜 데이터(별점 집계 + 조회수) — 계획 _refs/학교_별점_조회수_구현계획.md 3-3/3-4.
 *
 * - 읽기: `/api/school-social` (CDN 캐시 s-maxage=60). useQuery staleTime 60초.
 * - 쓰기: 브라우저 → Supabase RPC 직접 호출 + 낙관적 업데이트.
 */

export interface SocialEntry {
  avg: number | null;
  count: number;
  views: number;
}
export type SocialMap = Record<string, SocialEntry>;

const SOCIAL_KEY = ['school-social'] as const;
const EMPTY: SocialEntry = { avg: null, count: 0, views: 0 };

async function fetchSocial(): Promise<SocialMap> {
  const res = await fetch('/api/school-social');
  if (!res.ok) {
    throw new Error(`별점·조회수 데이터를 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

export function useSchoolSocial() {
  return useQuery({
    queryKey: SOCIAL_KEY,
    queryFn: fetchSocial,
    staleTime: 60_000,
    enabled: isSupabaseConfigured,
  });
}

/** 별점 등록/갱신. 낙관적으로 평균·참여자 수를 미리 반영한다. */
export function useRateSchool() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      schoolCode,
      rating,
    }: {
      schoolCode: string;
      rating: number;
    }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase 미설정');
      const { error } = await supabase.rpc('rate_school', {
        p_client_id: getClientId(),
        p_school_code: schoolCode,
        p_rating: rating,
      });
      if (error) throw error;
    },

    onMutate: async ({ schoolCode, rating }) => {
      await qc.cancelQueries({ queryKey: SOCIAL_KEY });
      const prev = qc.getQueryData<SocialMap>(SOCIAL_KEY);
      const prevRating = getMyRatings()[schoolCode] ?? null;

      qc.setQueryData<SocialMap>(SOCIAL_KEY, (cur) => {
        const map: SocialMap = { ...(cur ?? {}) };
        const e = map[schoolCode] ?? EMPTY;
        let sum = (e.avg ?? 0) * e.count;
        let count = e.count;
        if (prevRating === null) {
          sum += rating;
          count += 1;
        } else {
          sum += rating - prevRating;
        }
        map[schoolCode] = {
          ...e,
          count,
          avg: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
        };
        return map;
      });

      // 위젯의 "내 평가" 표시는 localStorage에서 읽으므로 즉시 반영
      setMyRating(schoolCode, rating);
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(SOCIAL_KEY, ctx.prev);
    },

    // onSettled에서 바로 invalidateQueries 하지 않는다 — /api/school-social 응답이
    // CDN에 s-maxage=60으로 캐시돼 있어서, 등록 직후 다시 불러오면 방금 쓴 값이 아직
    // 반영 안 된 오래된 캐시가 돌아와 위 낙관적 업데이트를 덮어써버린다(버튼을 눌러도
    // 바로 반영 안 되고 두 번 눌러야 보이던 버그의 원인). 낙관적 업데이트를 그대로 두고,
    // 실제 서버 평균은 staleTime(60초)이 지난 뒤 다음 자연스러운 refetch(재마운트,
    // 창 포커스 등)에서 알아서 수렴한다.
  });
}

/**
 * 상세 패널이 열릴 때 호출. 같은 세션에 이미 본 학교면 아무것도 안 한다.
 * fire-and-forget — 실패해도 콘솔 경고만.
 */
export function useRecordView() {
  const qc = useQueryClient();

  return useCallback(
    (schoolCode: string) => {
      if (!isSupabaseConfigured || hasViewedThisSession(schoolCode)) return;
      markViewedThisSession(schoolCode);

      qc.setQueryData<SocialMap>(SOCIAL_KEY, (cur) => {
        if (!cur) return cur;
        const e = cur[schoolCode] ?? EMPTY;
        return { ...cur, [schoolCode]: { ...e, views: e.views + 1 } };
      });

      getSupabase()
        ?.rpc('bump_school_view', { p_school_code: schoolCode })
        .then(({ error }) => {
          if (error) console.warn('조회수 기록 실패', error);
        });
    },
    [qc],
  );
}
