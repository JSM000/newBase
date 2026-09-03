'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Search,
  X,
} from 'lucide-react';
import type { School } from '@/types/school-stats';
import { type Indicator, formatIndicatorValue } from '@/lib/school-indicators';
import { schulKndLabel } from '@/lib/school-region';

export type RankSortDirection = 'asc' | 'desc';

interface RankedSchool {
  school: School;
  value: number;
}

interface SchoolRankingPanelProps {
  isOpen: boolean;
  ranked: RankedSchool[];
  noDataCount: number;
  indicator: Indicator;
  sortDirection: RankSortDirection;
  onSortDirectionChange: (v: RankSortDirection) => void;
  onSelectSchool: (school: School) => void;
  onClose: () => void;
}

/**
 * 오른쪽 사이드바 — 현재 필터 + "표시 지표" 기준으로 학교를 정렬한 목록.
 * 학교 상세 패널과 같은 자리를 공유(계획 3-3 "학교 순위 목록" 참고, panelMode로 전환).
 */
export function SchoolRankingPanel({
  isOpen,
  ranked,
  noDataCount,
  indicator,
  sortDirection,
  onSortDirectionChange,
  onSelectSchool,
  onClose,
}: SchoolRankingPanelProps) {
  // 목록 안에서 "이 학교 몇 등이지?" 찾기용 — 위 필터바의 학교명 검색과는 다른 기능:
  // 그건 대상 자체를 걸러내지만, 이건 순위 목록은 그대로 두고 원하는 학교 위치로만 스크롤 이동.
  const [query, setQuery] = useState('');
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const match = ranked.find(({ school }) => school.schulNm.includes(q));
    if (!match) return;
    itemRefs.current
      .get(match.school.schulCode)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [query, ranked]);

  return (
    // 상세 패널을 봤다가 닫으면 스크롤하던 순위 위치 그대로 돌아오게 — isOpen이 꺼져도 언마운트하지
    // 않고 display:none만 준다(display:none이어도 scrollTop은 브라우저가 유지해줌).
    <aside
      className={`absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl ${
        isOpen ? '' : 'hidden'
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">학교 순위</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {indicator.label} 기준 · {ranked.length}개 학교
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="border-b border-zinc-100 px-4 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="목록에서 학교 찾기"
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-2.5">
        <button
          type="button"
          onClick={() => onSortDirectionChange('desc')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            sortDirection === 'desc'
              ? 'bg-primary text-white'
              : 'text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          높은 순
        </button>
        <button
          type="button"
          onClick={() => onSortDirectionChange('asc')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            sortDirection === 'asc'
              ? 'bg-primary text-white'
              : 'text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          <ArrowUpWideNarrow className="h-3.5 w-3.5" />
          낮은 순
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {ranked.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">
            현재 필터에서 값이 있는 학교가 없습니다.
          </p>
        ) : (
          <ol>
            {ranked.map(({ school, value }, i) => {
              const isMatch =
                query.trim() !== '' && school.schulNm.includes(query.trim());
              return (
                <li key={school.schulCode} className="border-b border-zinc-50">
                  <button
                    ref={(el) => {
                      if (el) itemRefs.current.set(school.schulCode, el);
                      else itemRefs.current.delete(school.schulCode);
                    }}
                    type="button"
                    onClick={() => onSelectSchool(school)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 ${
                      isMatch ? 'bg-amber-50' : ''
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right text-sm font-semibold text-zinc-400">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-800">
                        {school.schulNm}
                      </span>
                      <span className="block truncate text-xs text-zinc-400">
                        {schulKndLabel(school.schulKndCode)}
                        {school.sigunguName ? ` · ${school.sigunguName}` : ''}
                        {school.subRegionName ? ` ${school.subRegionName}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-zinc-700">
                      {formatIndicatorValue(indicator, value)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {noDataCount > 0 && (
          <p className="p-4 text-xs text-zinc-400">
            자료 없음 {noDataCount}개 학교는 순위에서 제외됨
          </p>
        )}
      </div>
    </aside>
  );
}
