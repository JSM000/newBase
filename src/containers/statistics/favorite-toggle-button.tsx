'use client';

import { Heart } from 'lucide-react';
import { useFavoriteSchoolsStore } from '@/store/use-favorite-schools-store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSyncFavorite } from '@/hooks/use-school-social';

/**
 * 즐겨찾기 on/off 토글 버튼 — 상세 패널 헤더·순위 목록 행·길찾기 결과 행 3곳에서 재사용
 * (계획: _refs/즐겨찾기_구현계획/02_토글UI.md). 별점(1~5점, school-rating.tsx)은 별 모양을
 * 그대로 쓰므로, 즐겨찾기는 하트 모양 + red-600(primary #e77474보다 진하고 순수한 빨강)으로 구분한다.
 *
 * 로컬 저장(use-favorite-schools-store, 항상 동작)과 별개로, Supabase가 설정돼 있으면
 * 이 학교의 즐겨찾기 수를 서버 집계(school_favorite_stats)에도 동기화한다 — "즐겨찾기된
 * 횟수"를 별점·조회수처럼 참고 지표로 쓰기 위함(school-indicators.ts의 FAVORITE_INDICATOR_KEY).
 */
interface FavoriteToggleButtonProps {
  schulCode: string;
  /** 목록 행처럼 버튼 전체가 다른 클릭 영역(상세 이동 등)에 감싸여 있을 때, 그 클릭과 분리하려면 true */
  stopPropagation?: boolean;
  size?: 'sm' | 'md';
  /** 배치 위치별 여백 등 — 버튼 자체 className에 추가로 붙는다 */
  className?: string;
}

const SIZE_CLASS = { sm: 'h-4 w-4', md: 'h-5 w-5' };

export function FavoriteToggleButton({
  schulCode,
  stopPropagation = false,
  size = 'md',
  className = '',
}: FavoriteToggleButtonProps) {
  // favoriteCodes(실제 변경되는 state)를 구독해야 리렌더된다 — 스토어의 isFavorite()
  // 메서드 자체를 select하면 참조가 안 바뀌어서(항상 같은 함수) 반응하지 않는다.
  const isFavorite = useFavoriteSchoolsStore((s) => s.favoriteCodes.includes(schulCode));
  const toggleFavorite = useFavoriteSchoolsStore((s) => s.toggleFavorite);
  const syncFavorite = useSyncFavorite();

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        const next = !isFavorite;
        toggleFavorite(schulCode);
        if (isSupabaseConfigured) {
          syncFavorite.mutate({ schoolCode: schulCode, favorited: next });
        }
      }}
      aria-label={isFavorite ? '관심학교 해제' : '관심학교 등록'}
      aria-pressed={isFavorite}
      className={`shrink-0 rounded-md p-1 text-zinc-300 transition-colors hover:text-red-600 ${className}`}
    >
      <Heart className={`${SIZE_CLASS[size]} ${isFavorite ? 'fill-red-600 text-red-600' : ''}`} />
    </button>
  );
}
