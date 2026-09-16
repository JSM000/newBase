'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDuration, formatDistance } from '@/utils/formatter';
import { schulKndLabel, type SchoolLevelFilter, type OwnershipFilter } from '@/lib/school-region';
import { useGeocodeCandidates } from '@/hooks/use-geocode-candidates';
import { useRouteRanking } from '@/hooks/use-route-ranking';
import { cooldownRemainingMs, markSearched } from '@/lib/commute-rate-limit';
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
  onResult: (r: RouteRankingResponse | null) => void;
  onSelectCode: (code: string | null) => void;
  onClose: () => void;
}

/**
 * 오른쪽 사이드바 — 집주소를 입력하면 현재 필터(시·군 + 학교급 + 설립구분)의 학교까지 자동차
 * 소요시간을 순위로 보여준다. 학교를 누르면 statistics-container 가 그 학교의 경로를 지도에
 * 그린다(경로는 순위 응답에 포함돼 있어 추가 호출 없음).
 *
 * 검색은 2단계: ① 주소 → 후보 목록 조회(/api/geocode), ② 사용자가 후보 하나를 직접 골라 확정 →
 * 그 좌표로 길찾기 실행(/api/route-ranking). 카카오 응답 1위를 자동 채택하지 않는 이유는, 동/읍/면
 * 단위 같은 부정확한 매칭이 1위로 올 수 있어서다(address_type 참고). 30초 재검색 제한은 ①(후보
 * 조회) 시점에 기록 — 후보를 고르는 동작 자체는 쿨다운과 무관하게 항상 가능해야 한다.
 */
export function CommutePanel({
  isOpen,
  level,
  sigungu,
  ownership,
  result,
  selectedCode,
  onResult,
  onSelectCode,
  onClose,
}: CommutePanelProps) {
  const geocode = useGeocodeCandidates();
  const ranking = useRouteRanking();
  const [address, setAddress] = useState('');
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [pickedOrigin, setPickedOrigin] = useState<GeocodeCandidate | null>(null);
  const [sortDir, setSortDir] = useState<'near' | 'far'>('near');
  const [cooldownMs, setCooldownMs] = useState(0);

  // 쿨다운 카운트다운. 1초마다 localStorage 를 다시 읽어 남은 시간을 반영한다.
  // (마운트·검색 완료 시 재시작 — 검색 직후 즉시 반영은 아래 onSuccess 에서 처리.)
  useEffect(() => {
    const id = setInterval(() => {
      setCooldownMs(cooldownRemainingMs());
    }, 1000);
    return () => clearInterval(id);
  }, [geocode.isPending, ranking.isPending]);

  const ready = level !== 'all' && sigungu !== 'all';
  const cooling = cooldownMs > 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);

  /** ① 주소 검색 — 후보 목록만 받아온다. 30초 쿨다운은 여기서 기록. */
  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !address.trim() || cooling || geocode.isPending || ranking.isPending) return;
    onResult(null);
    onSelectCode(null);
    setPickedOrigin(null);
    setCandidates(null);
    geocode.mutate(
      { address: address.trim() },
      {
        onSuccess: (res) => {
          markSearched();
          setCooldownMs(cooldownRemainingMs());
          setCandidates(res.candidates);
        },
      },
    );
  }

  /** ② 실측(길찾기) 실행 — offset=0 이면 새 검색, 그 이상이면 "나머지도 계산" 이어받기. */
  function runRanking(origin: GeocodeCandidate, offset: number) {
    ranking.mutate(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        schulKndCode: level as SchulKndCode,
        sigungu,
        ownership,
        offset,
      },
      { onSuccess: (res) => onResult(res) },
    );
  }

  /** 후보 목록에서 출발지를 확정 — 쿨다운과 무관하게 항상 가능(직전 검색의 연장 동작). */
  function pickCandidate(c: GeocodeCandidate) {
    if (ranking.isPending) return;
    setPickedOrigin(c);
    setCandidates(null);
    runRanking(c, 0);
  }

  function loadMore() {
    if (!pickedOrigin || !result || cooling || ranking.isPending) return;
    runRanking(pickedOrigin, result.measuredCount);
  }

  const errorMsg = geocode.isError
    ? geocode.error instanceof Error
      ? geocode.error.message
      : '주소 검색 중 오류가 발생했습니다.'
    : ranking.isError
      ? ranking.error instanceof Error
        ? ranking.error.message
        : '경로 계산 중 오류가 발생했습니다.'
      : null;

  const ordered =
    result && sortDir === 'far'
      ? [...result.results].reverse()
      : (result?.results ?? []);

  return (
    <aside
      className={cn(
        'absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl',
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

      <form onSubmit={handleSearchSubmit} className="border-b border-zinc-100 p-4">
        <label
          className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400"
          htmlFor="commute-address"
        >
          집주소
        </label>
        <div className="flex gap-2">
          <input
            id="commute-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="도로명 주소 (지번·건물명도 가능)"
            className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
            autoComplete="street-address"
          />
          <button
            type="submit"
            disabled={!ready || !address.trim() || cooling || geocode.isPending || ranking.isPending}
            className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {geocode.isPending ? '검색 중' : cooling ? `${cooldownSec}초` : '검색'}
          </button>
        </div>
        {pickedOrigin && !candidates && (
          <p className="mt-2 truncate text-xs text-zinc-400">
            출발지: <span className="text-zinc-600">{pickedOrigin.label}</span>
          </p>
        )}
        {cooling && (
          <p className="mt-2 text-xs text-zinc-400">
            방금 검색했어요. {cooldownSec}초 후 다시 검색할 수 있습니다.
          </p>
        )}
        {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}
      </form>

      {candidates && (
        <div className="border-b border-zinc-100">
          {candidates.length === 0 ? (
            <p className="p-4 text-sm text-zinc-400">
              검색 결과가 없습니다. 다른 주소로 다시 검색해 주세요.
            </p>
          ) : (
            <>
              <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                출발지를 선택하세요
              </p>
              {candidates.map((c, i) => (
                <button
                  key={`${c.lat},${c.lng},${i}`}
                  type="button"
                  onClick={() => pickCandidate(c)}
                  disabled={ranking.isPending}
                  className="flex w-full flex-col items-start gap-1 border-b border-zinc-50 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <span className="block truncate text-sm font-medium text-zinc-800">
                    {c.label}
                  </span>
                  {c.roadAddress && c.roadAddress !== c.label && (
                    <span className="block truncate text-xs text-zinc-400">{c.roadAddress}</span>
                  )}
                  {c.addressType === 'REGION' && (
                    <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      동·읍·면 단위 근사치 — 정확한 지번을 아신다면 다시 입력해 보세요
                    </span>
                  )}
                  {c.source === 'keyword' && (
                    <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      장소명 검색 결과
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {result && result.results.length > 0 && (
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
          <span className="text-xs text-zinc-500">{result.results.length}곳</span>
          <div className="flex gap-1 text-xs">
            {(['near', 'far'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSortDir(d)}
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
        {!result && !candidates && (
          <p className="p-4 text-sm text-zinc-400">
            {ready
              ? '집주소를 입력하고 검색을 눌러 주세요.'
              : '필터바에서 시·군과 학교급을 고른 뒤 집주소를 입력하세요.'}
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
                onClick={loadMore}
                disabled={cooling || ranking.isPending}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {ranking.isPending
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
