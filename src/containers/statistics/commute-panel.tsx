'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDuration, formatDistance } from '@/utils/formatter';
import { schulKndLabel, type SchoolLevelFilter, type OwnershipFilter } from '@/lib/school-region';
import { MAX_SCHOOLS_PER_SEARCH } from '@/lib/route-ranking-constants';
import type { GeocodeCandidate, RouteRankingResponse } from '@/types/commute';
import type { SchulKndCode } from '@/types/school-stats';
import { FavoriteToggleButton } from './favorite-toggle-button';

interface CommutePanelProps {
  isOpen: boolean;
  /** 필터바에서 고른 학교급·시군·설립구분 — 길찾기 대상 범위(지도·순위와 동일 기준) */
  level: SchoolLevelFilter;
  sigungu: string;
  ownership: OwnershipFilter;
  /** true면 위 세 필터 대신 즐겨찾기한 학교 전체가 대상 (계획: 04_필터지도연동.md B) */
  favoritesOnly: boolean;
  favoriteCount: number;
  result: RouteRankingResponse | null;
  selectedCode: string | null;
  onSelectCode: (code: string | null) => void;
  onClose: () => void;
  /** 출발지 팝업(필터바)에서 이미 확정된 주소 — 결과 목록 위에 안내로만 보여준다 */
  pickedOrigin: GeocodeCandidate | null;
  sortDir: 'near' | 'far';
  onSortDirChange: (d: 'near' | 'far') => void;
  onLoadMore: () => void;
  /** "계산 실패"로 표시된 학교만 다시 시도 — onLoadMore(아직 안 건드린 다음 구간)와는 별개 동작 */
  onRetryFailed: () => void;
  isRanking: boolean;
  errorMsg: string | null;
}

/**
 * 오른쪽 사이드바 — 필터바에서 검색한 주소의 후보 목록 중 출발지를 고르면, 현재 필터
 * (시·군 + 학교급 + 설립구분)의 학교까지 자동차 소요시간을 순위로 보여준다. 학교를 누르면
 * statistics-container 가 그 학교의 경로를 지도에 그린다(경로는 순위 응답에 포함돼 있어
 * 추가 호출 없음). 주소 검색 자체(입력창·쿨다운)는 필터바 쪽에 있다 — 검색 로직은
 * use-commute-search.ts 훅에 모여있고 이 컴포넌트와 필터바가 나눠 쓴다.
 */
export function CommutePanel({
  isOpen,
  level,
  sigungu,
  ownership,
  favoritesOnly,
  favoriteCount,
  result,
  selectedCode,
  onSelectCode,
  onClose,
  pickedOrigin,
  sortDir,
  onSortDirChange,
  onLoadMore,
  onRetryFailed,
  isRanking,
  errorMsg,
}: CommutePanelProps) {
  const ready = favoritesOnly ? favoriteCount > 0 : level !== 'all' && sigungu !== 'all';

  // 계산 실패는 순위 목록에 안 섞는다 — 소요시간을 모르니 순위를 매길 수 없고, 직선거리만
  // 보고 "멀어서 뒤로 밀렸나보다"로 오해하기도 쉬워서 아예 분리해 위쪽 박스에 따로 보여준다.
  const failedResults = result?.results.filter((r) => r.failed) ?? [];
  const visibleResults = result?.results.filter((r) => !r.failed) ?? [];
  const ordered = sortDir === 'far' ? [...visibleResults].reverse() : visibleResults;

  // 실패 박스가 실패 학교 수만큼 끝없이 길어지면 목록(순위) 자체가 아래로 밀려버려서,
  // 기본은 3줄(2열×3행=6칸)만 보여준다. 숨겨진 게 있으면 마지막 칸을 "···"로 바꿔 더 있다는
  // 걸 표시하고, 펼치기/접기는 </> 화살표 하나로 간단히 토글한다.
  const [failedExpanded, setFailedExpanded] = useState(false);
  const FAILED_PREVIEW_COUNT = 6;
  const hasMoreFailed = failedResults.length > FAILED_PREVIEW_COUNT;
  const visibleFailed =
    hasMoreFailed && !failedExpanded ? failedResults.slice(0, FAILED_PREVIEW_COUNT - 1) : failedResults;
  const showEllipsis = hasMoreFailed && !failedExpanded;

  return (
    <aside
      className={cn(
        'absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl',
        isOpen ? '' : 'hidden',
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">출퇴근 시간</h2>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {!ready
              ? favoritesOnly
                ? '관심학교가 없습니다'
                : '필터에서 시·군과 학교급을 먼저 선택하세요'
              : `${pickedOrigin ? pickedOrigin.label : '출발지 미정'} → ${
                  favoritesOnly
                    ? `관심학교 ${favoriteCount}개`
                    : `${sigungu} · ${schulKndLabel(level as SchulKndCode)}${ownership === 'all' ? '' : ` · ${ownership}`}`
                }`}
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
      {errorMsg && (
        <p className="border-b border-zinc-100 px-4 py-2 text-xs text-red-600">{errorMsg}</p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 후보를 고른 직후 ~ 첫 결과가 오기 전 — 학교 수가 많으면 꽤 걸려서 스피너로 알려준다.
            "나머지도 계산"(이미 result가 있는 재계산)은 그 버튼 자체의 "계산 중…" 표시로 충분하니
            기존 목록을 가리지 않는다. */}
        {isRanking && !result && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm">소요시간을 계산하는 중입니다…</p>
          </div>
        )}

        {!isRanking && !result && (
          <p className="p-4 text-sm text-zinc-400">
            위 필터바에서 출발지·도착지를 고르고 &quot;출퇴근 시간 계산&quot;을 눌러주세요.
          </p>
        )}

        {result && result.results.length === 0 && (
          <p className="p-4 text-sm text-zinc-400">
            선택한 조건에 해당하는 학교가 없습니다.
          </p>
        )}

        {/* 150곳 상한/예산초과 안내 — 결과창 가장 위쪽. 계산 실패 박스와 같은 UI(경고 아이콘
            + 문구 왼쪽, 버튼 오른쪽, 호박색 테마)로 맞춘다. */}
        {result && (result.remainingCount > 0 || result.overBudget) && (
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3">
            {result.overBudget ? (
              <p className="text-xs leading-relaxed text-amber-700">
                &#9888;&#65039; 오늘 무료 경로 계산 한도를 모두 사용했어요, 나머지는 내일 다시
                시도해 주세요
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-amber-700">
                  &#9888;&#65039; 한 번에 최대 {MAX_SCHOOLS_PER_SEARCH}개 학교만 계산 가능
                  <br />
                  <span className="inline-block pl-5">
                    나머지 {result.remainingCount}개는 우측의 버튼을 눌러 추가 계산.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isRanking}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {isRanking ? '계산 중…' : `추가 계산`}
                </button>
              </>
            )}
          </div>
        )}

        {/* 계산 실패 박스 — 목록 맨 위. 설명·재시도 버튼을 박스 가장 위쪽에 두고, 그 아래
            실패한 학교 이름만 2열로 나열한다(소요시간을 모르니 순위에 못 넣고, 클릭해도 보여줄
            경로가 없어 버튼이 아니라 단순 목록). 재시도·추가 계산 둘 다 쿨다운을 안 본다 —
            실패는 사용자가 남발해서가 아니라 서버·카카오 쪽 일시적 문제고, 추가 계산도
            사용자가 명시적으로 이어서 계산하길 원하는 거라 기다리게 할 이유가 없다. */}
        {failedResults.length > 0 && (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-amber-200 pb-3">
              <p className="text-xs leading-relaxed text-amber-700">
                &#9888;&#65039; {failedResults.length}개 학교 오류 발생, 우측의 버튼을 눌러 재계산
              </p>
              <button
                type="button"
                onClick={onRetryFailed}
                disabled={isRanking}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {isRanking ? '계산 중…' : `재계산`}
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {visibleFailed.map((s) => (
                <li key={s.schulCode} className="truncate text-xs text-amber-800">
                  {s.schulNm}
                  <span className="ml-1 text-amber-600">{s.straightKm}km</span>
                </li>
              ))}
              {showEllipsis && (
                <li className="col-span-2 text-left text-base font-extrabold tracking-widest text-amber-700">
                  ···
                </li>
              )}
            </ul>
            {hasMoreFailed && (
              <button
                type="button"
                onClick={() => setFailedExpanded((v) => !v)}
                aria-label={failedExpanded ? '목록 접기' : '목록 더 보기'}
                className="flex h-3 w-full items-center justify-center leading-none text-amber-700 hover:text-amber-900"
              >
                {failedExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        )}

        {result && visibleResults.length > 0 && (
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
            <span className="text-xs text-zinc-500">{visibleResults.length}개 학교</span>
            <div className="flex gap-1 text-xs">
              {(['near', 'far'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSortDirChange(d)}
                  className={cn(
                    'rounded-md px-2 py-1 font-medium transition-colors',
                    sortDir === d
                      ? 'bg-primary text-white'
                      : 'text-zinc-500 hover:bg-zinc-100',
                  )}
                >
                  {d === 'near' ? '가까운 순' : '먼 순'}
                </button>
              ))}
            </div>
          </div>
        )}

        {ordered.map((s) => {
          const rank = visibleResults.indexOf(s) + 1;
          const selected = s.schulCode === selectedCode;
          const measured = s.durationSec !== null;
          return (
            <div
              key={s.schulCode}
              className={cn(
                'flex items-center border-b border-zinc-50',
                selected ? 'bg-primary-50' : '',
              )}
            >
              <button
                type="button"
                onClick={() => onSelectCode(s.schulCode)}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors',
                  selected ? '' : 'hover:bg-zinc-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    measured ? 'bg-primary text-white' : 'bg-zinc-200 text-zinc-500',
                  )}
                >
                  {rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-800">
                    {s.schulNm}
                  </span>
                  <span className="block truncate text-xs text-zinc-400">
                    {s.address ?? ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {measured ? (
                    <>
                      <span className="block text-sm font-semibold text-zinc-800">
                        {formatDuration(s.durationSec!)}
                      </span>
                      <span className="block text-xs text-zinc-400">
                        {s.distanceM !== null ? formatDistance(s.distanceM) : ''}
                      </span>
                    </>
                  ) : (
                    <span className="block text-xs text-zinc-400">
                      직선 {s.straightKm}km
                    </span>
                  )}
                </span>
              </button>
              <FavoriteToggleButton schulCode={s.schulCode} stopPropagation size="sm" className="mr-3" />
            </div>
          );
        })}
      </div>

      <footer className="flex items-center gap-1.5 border-t border-zinc-100 px-4 py-2 text-[11px] leading-tight text-zinc-400">
        <MapPin className="h-3 w-3 shrink-0" />
        선택한 출발지를 기준으로, 시간대·실시간 교통은 반영하지 않는 평상시 자동차
        기준입니다.
      </footer>
    </aside>
  );
}
