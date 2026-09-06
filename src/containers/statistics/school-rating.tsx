'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface SchoolRatingProps {
  /** 평균 별점 (참여자 0명이면 null) */
  avg: number | null;
  /** 참여자 수 */
  count: number;
  /** 이 브라우저가 남긴 별점 (없으면 null) */
  myRating: number | null;
  onRate: (rating: number) => void;
  disabled?: boolean;
}

/**
 * 상세 패널의 "이동 추천도" 별점 위젯 (계획 _refs/학교_별점_조회수_구현계획.md 4).
 * 별 클릭 즉시 반영(낙관적). 참여자 수를 항상 병기하고 최소 표본 제한은 없다.
 */
export function SchoolRating({
  avg,
  count,
  myRating,
  onRate,
  disabled,
}: SchoolRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? myRating ?? 0;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500">이동 추천도</span>
        <span className="text-xs text-zinc-400">
          {count > 0 ? (
            <>
              <span className="font-semibold text-amber-500">
                ★ {avg?.toFixed(1)}
              </span>{' '}
              · {count}명
            </>
          ) : (
            '아직 평가 없음'
          )}
        </span>
      </div>

      <div
        className="mt-1.5 flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onRate(n)}
            className="p-0.5 disabled:cursor-not-allowed"
            aria-label={`${n}점`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                n <= active
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-zinc-300'
              }`}
            />
          </button>
        ))}
        {myRating != null && (
          <span className="ml-2 text-[11px] text-zinc-400">
            내 평가 {myRating}점
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
        전보로 이동할 학교로서의 추천도 — 재미로 보는 참고용입니다.
      </p>
    </div>
  );
}
