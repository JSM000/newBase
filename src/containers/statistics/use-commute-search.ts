'use client';

import { useEffect, useState } from 'react';
import { useGeocodeCandidates } from '@/hooks/use-geocode-candidates';
import { useRouteRanking } from '@/hooks/use-route-ranking';
import { cooldownRemainingMs, markSearched } from '@/lib/commute-rate-limit';
import type { GeocodeCandidate, RouteRankingResponse } from '@/types/commute';
import type { SchoolLevelFilter, OwnershipFilter } from '@/lib/school-region';
import type { SchulKndCode } from '@/types/school-stats';

interface UseCommuteSearchArgs {
  /** 필터에서 시·군·학교급을 고른 상태인지 — 검색/재계산 가능 여부 */
  ready: boolean;
  level: SchoolLevelFilter;
  sigungu: string;
  ownership: OwnershipFilter;
  onResult: (r: RouteRankingResponse | null) => void;
  onSelectCode: (code: string | null) => void;
}

/**
 * "집에서 학교까지" 길찾기 검색 로직 — 주소 입력은 필터바로, 후보 선택·결과 목록은
 * 사이드바(CommutePanel)로 나뉘면서 두 컴포넌트가 같은 상태를 공유해야 해서 훅으로 뽑았다.
 *
 * 검색은 2단계: ① 주소 → 후보 목록 조회(/api/geocode), ② 사용자가 후보 하나를 직접 골라
 * 확정 → 그 좌표로 길찾기 실행(/api/route-ranking). 카카오 응답 1위를 자동 채택하지 않는
 * 이유는, 동/읍/면 단위 같은 부정확한 매칭이 1위로 올 수 있어서다(address_type 참고).
 * 30초 재검색 제한은 ①(후보 조회) 시점에 기록 — 후보를 고르는 동작 자체는 쿨다운과 무관하게
 * 항상 가능해야 한다.
 */
export function useCommuteSearch({
  ready,
  level,
  sigungu,
  ownership,
  onResult,
  onSelectCode,
}: UseCommuteSearchArgs) {
  const geocode = useGeocodeCandidates();
  const ranking = useRouteRanking();
  const [address, setAddress] = useState('');
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [pickedOrigin, setPickedOrigin] = useState<GeocodeCandidate | null>(null);
  const [sortDir, setSortDir] = useState<'near' | 'far'>('near');
  const [cooldownMs, setCooldownMs] = useState(0);

  // 쿨다운 카운트다운. 1초마다 localStorage 를 다시 읽어 남은 시간을 반영한다.
  useEffect(() => {
    const id = setInterval(() => setCooldownMs(cooldownRemainingMs()), 1000);
    return () => clearInterval(id);
  }, [geocode.isPending, ranking.isPending]);

  const cooling = cooldownMs > 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);

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

  /** ① 주소 검색 — 후보 목록만 받아온다. 30초 쿨다운은 여기서 기록. */
  function searchAddress(rawAddress: string) {
    if (!ready || !rawAddress.trim() || cooling || geocode.isPending || ranking.isPending) return;
    onResult(null);
    onSelectCode(null);
    setPickedOrigin(null);
    setCandidates(null);
    geocode.mutate(
      { address: rawAddress.trim() },
      {
        onSuccess: (res) => {
          markSearched();
          setCooldownMs(cooldownRemainingMs());
          setCandidates(res.candidates);
        },
      },
    );
  }

  /** 설정 페이지에 저장해둔 집 좌표를 바로 출발지로 — 주소 검색 없이 한 번의 클릭. */
  function useSavedOrigin(coords: { lat: number; lng: number }) {
    if (!ready || ranking.isPending) return;
    const origin: GeocodeCandidate = {
      label: '저장된 집 위치',
      roadAddress: null,
      addressType: 'SAVED',
      source: 'address',
      lat: coords.lat,
      lng: coords.lng,
    };
    setCandidates(null);
    setPickedOrigin(origin);
    runRanking(origin, 0);
  }

  /** 후보 목록에서 출발지를 확정 — 쿨다운과 무관하게 항상 가능(직전 검색의 연장 동작). */
  function pickCandidate(c: GeocodeCandidate) {
    if (ranking.isPending) return;
    setPickedOrigin(c);
    setCandidates(null);
    runRanking(c, 0);
  }

  function loadMore(result: RouteRankingResponse | null) {
    if (!pickedOrigin || !result || cooling || ranking.isPending) return;
    runRanking(pickedOrigin, result.measuredCount);
  }

  const geocodeErrorMsg =
    geocode.isError
      ? geocode.error instanceof Error
        ? geocode.error.message
        : '주소 검색 중 오류가 발생했습니다.'
      : null;

  const rankingErrorMsg =
    ranking.isError
      ? ranking.error instanceof Error
        ? ranking.error.message
        : '경로 계산 중 오류가 발생했습니다.'
      : null;

  return {
    address,
    setAddress,
    candidates,
    pickedOrigin,
    sortDir,
    setSortDir,
    cooling,
    cooldownSec,
    isSearching: geocode.isPending,
    isRanking: ranking.isPending,
    geocodeErrorMsg,
    rankingErrorMsg,
    searchAddress,
    useSavedOrigin,
    pickCandidate,
    loadMore,
  };
}
