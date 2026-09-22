'use client';

import { MapPin, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDuration, formatDistance } from '@/utils/formatter';
import { schulKndLabel, type SchoolLevelFilter, type OwnershipFilter } from '@/lib/school-region';
import type { GeocodeCandidate, RouteRankingResponse } from '@/types/commute';
import type { SchulKndCode } from '@/types/school-stats';

interface CommutePanelProps {
  isOpen: boolean;
  /** 필터바에서 고른 학교급·시군·설립구분 — 길찾기 대상 범위(지도·순위와 동일 기준) */
  level: SchoolLevelFilter;
  sigungu: string;
  ownership: OwnershipFilter;
  result: RouteRankingResponse | null;
  selectedCode: string | null;
  onSelectCode: (code: string | null) => void;
  onClose: () => void;
  /** 출발지 팝업(필터바)에서 이미 확정된 주소 — 결과 목록 위에 안내로만 보여준다 */
  pickedOrigin: GeocodeCandidate | null;
  sortDir: 'near' | 'far';
  onSortDirChange: (d: 'near' | 'far') => void;
  onLoadMore: () => void;
  cooling: boolean;
  cooldownSec: number;
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
  result,
  selectedCode,
  onSelectCode,
  onClose,
  pickedOrigin,
  sortDir,
  onSortDirChange,
  onLoadMore,
  cooling,
  cooldownSec,
  isRanking,
  errorMsg,
}: CommutePanelProps) {
  const ready = level !== 'all' && sigungu !== 'all';

  const ordered =
    result && sortDir === 'far'
      ? [...result.results].reverse()
      : (result?.results ?? []);

  return (
    <aside
      className={cn(
        'absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl',
        isOpen ? '' : 'hidden',
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">집에서 학교까지</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {ready
              ? `${sigungu} · ${schulKndLabel(level as SchulKndCode)}${ownership === 'all' ? '' : ` · ${ownership}`} 자동차 소요시간`
              : '필터에서 시·군과 학교급을 먼저 선택하세요'}
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

      {pickedOrigin && (
        <p className="truncate border-b border-zinc-100 px-4 py-2 text-xs text-zinc-400">
          출발지: <span className="text-zinc-600">{pickedOrigin.label}</span>
        </p>
      )}
      {errorMsg && (
        <p className="border-b border-zinc-100 px-4 py-2 text-xs text-red-600">{errorMsg}</p>
      )}

      {result && result.results.length > 0 && (
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
          <span className="text-xs text-zinc-500">{result.results.length}곳</span>
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

        {ordered.map((s) => {
          const rank = (result?.results.indexOf(s) ?? 0) + 1;
          const selected = s.schulCode === selectedCode;
          const measured = s.durationSec !== null;
          return (
            <button
              key={s.schulCode}
              type="button"
              onClick={() => onSelectCode(s.schulCode)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-zinc-50 px-4 py-2.5 text-left transition-colors',
                selected ? 'bg-primary-50' : 'hover:bg-zinc-50',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  measured
                    ? 'bg-primary text-white'
                    : 'bg-zinc-200 text-zinc-500',
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
          );
        })}

        {result && (result.remainingCount > 0 || result.overBudget) && (
          <div className="px-4 py-3 text-center">
            {result.overBudget ? (
              <p className="text-xs leading-relaxed text-amber-700">
                오늘 무료 경로 계산 한도를 모두 사용했어요. 계산된 학교는 순위에
                표시되며, 나머지는 내일 다시 시도해 주세요.
              </p>
            ) : (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={cooling || isRanking}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {isRanking
                  ? '계산 중…'
                  : cooling
                    ? `${cooldownSec}초 후 나머지 계산 가능`
                    : `나머지 ${result.remainingCount}곳도 계산`}
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-1.5 border-t border-zinc-100 px-4 py-2 text-[11px] leading-tight text-zinc-400">
        <MapPin className="h-3 w-3 shrink-0" />
        선택한 출발지를 기준으로, 시간대·실시간 교통은 반영하지 않는 평상시 자동차
        기준입니다.
      </footer>
    </aside>
  );
}
