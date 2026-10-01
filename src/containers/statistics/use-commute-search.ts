'use client';

import { useEffect, useRef, useState } from 'react';
import { useGeocodeCandidates } from '@/hooks/use-geocode-candidates';
import { useRouteRanking } from '@/hooks/use-route-ranking';
import {
  cooldownRemainingMs,
  markSearched,
  rankingCooldownRemainingMs,
  markRankingSearched,
} from '@/lib/commute-rate-limit';
import { loadCachedCommuteResult, type CommuteDestination } from '@/lib/commute-result-cache';
import type { GeocodeCandidate, RouteRankingResponse } from '@/types/commute';
import type { SchoolLevelFilter, OwnershipFilter } from '@/lib/school-region';
import type { SchulKndCode } from '@/types/school-stats';

interface UseCommuteSearchArgs {
  /** 도착지(시·군·학교급 또는 즐겨찾기)를 고른 상태인지 — confirmSearch(길찾기 실행) 가능 여부 */
  ready: boolean;
  level: SchoolLevelFilter;
  sigungu: string;
  ownership: OwnershipFilter;
  /** true면 level/sigungu/ownership 대신 favoriteCodes를 대상으로 검색 (계획: 04_필터지도연동.md B) */
  favoritesOnly: boolean;
  favoriteCodes: string[];
  /** 저장된 집 좌표 — 있으면 출발지를 직접 고르지 않아도 처음부터 자동으로 채워둔다. */
  homeCoords: { lat: number; lng: number } | null;
  /**
   * append=false(confirmSearch) → 항상 결과 교체 + 가장 가까운 학교 자동 선택.
   * append=true(loadMore) → 기존 결과에 이어붙이고 지금 선택은 그대로 둔다.
   * "같은 조건으로 재검색이면 이어붙이기"로 판단하지 않는 이유: confirmSearch는 사용자가
   * 명시적으로 "계산하기"를 누른 거라, 이전과 조건이 완전히 같아도(캐시 히트 포함) 매번 새로
   * 계산한 것처럼 동작해야 한다 — 안 그러면 탭을 옮겼다 돌아와 다시 누를 때 자동 선택이
   * 안 먹혀서 경로가 안 뜨는 문제가 있었다.
   */
  onResult: (r: RouteRankingResponse | null, info?: { destination: CommuteDestination; append: boolean }) => void;
  onSelectCode: (code: string | null) => void;
}

/**
 * "집에서 학교까지" 길찾기 검색 로직 — 출발지(집주소) 팝업과 도착지(시·군/학교급) 팝업,
 * 결과 목록(사이드바)이 같은 상태를 공유해야 해서 훅으로 뽑았다.
 *
 * 지도 길찾기 서비스처럼 출발지·도착지를 독립적으로(순서 무관) 먼저 정해두고, 마지막에
 * "출퇴근 시간 계산" 버튼 한 번으로 실행하는 3단계 흐름:
 * ① `searchAddress` — 주소 → 후보 목록 조회(/api/geocode). 도착지가 아직 안 정해졌어도
 *   항상 가능. 카카오 응답 1위를 자동 채택하지 않는 이유는, 동/읍/면 단위 같은 부정확한
 *   매칭이 1위로 올 수 있어서다(address_type 참고).
 * ② `pickCandidate`/`useSavedOrigin` — 후보 하나(또는 저장된 집 위치)를 출발지로 확정만
 *   해둔다(길찾기는 아직 안 돎).
 * ③ `confirmSearch` — 출발지·도착지가 둘 다 갖춰진 뒤 실제 길찾기 실행(/api/route-ranking).
 * 30초 재검색 제한은 ①(후보 조회) 시점에 기록 — 후보를 고르는 동작 자체는 쿨다운과 무관하게
 * 항상 가능해야 한다.
 */
export function useCommuteSearch({
  ready,
  level,
  sigungu,
  ownership,
  favoritesOnly,
  favoriteCodes,
  homeCoords,
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
  const [rankingCooldownMs, setRankingCooldownMs] = useState(0);

  // 쿨다운 카운트다운. 1초마다 localStorage 를 다시 읽어 남은 시간을 반영한다.
  // 주소 검색·길찾기(계산하기/나머지도 계산)는 독립된 쿨다운이라 따로 갱신한다.
  useEffect(() => {
    const id = setInterval(() => {
      setCooldownMs(cooldownRemainingMs());
      setRankingCooldownMs(rankingCooldownRemainingMs());
    }, 1000);
    return () => clearInterval(id);
  }, [geocode.isPending, ranking.isPending]);

  // 저장된 집 좌표가 있으면 출발지 팝업을 열어 직접 고르지 않아도 바로 길찾기를 쓸 수 있게,
  // 처음 한 번만 자동으로 출발지로 채워둔다. ref로 "최초 1회"만 동작하게 막아서, 이후
  // 사용자가 다른 주소를 검색하려고 출발지를 지워도(pickedOrigin이 다시 null이 돼도) 덮어쓰지 않는다.
  const autoFilledHomeRef = useRef(false);
  useEffect(() => {
    if (autoFilledHomeRef.current || !homeCoords) return;
    autoFilledHomeRef.current = true;
    setPickedOrigin(
      (prev) =>
        prev ?? {
          label: '저장된 집 위치',
          roadAddress: null,
          addressType: 'SAVED',
          source: 'address',
          lat: homeCoords.lat,
          lng: homeCoords.lng,
        },
    );
  }, [homeCoords]);

  const cooling = cooldownMs > 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);
  const rankingCooling = rankingCooldownMs > 0;
  const rankingCooldownSec = Math.ceil(rankingCooldownMs / 1000);

  /** 현재 도착지 조건(즐겨찾기 또는 시·군/학교급/설립구분) 식별자 — 요청 바디 구성·결과 캐싱에 공용으로 쓴다. */
  function currentDestination(): CommuteDestination {
    return favoritesOnly
      ? { kind: 'favorites', favoriteCodes }
      : { kind: 'filter', schulKndCode: level as SchulKndCode, sigungu, ownership };
  }

  /**
   * 실측(길찾기) 실행 — append=false면 confirmSearch(새 검색), true면 "나머지도 계산"/재시도
   * 이어받기. retryCodes를 주면 offset 배치 대신 그 학교들만("계산 실패" 재시도) 다시 돈다.
   * 쿨다운은 "요청을 보낼 때"가 아니라 "응답이 돌아온 뒤"(onSuccess)에 기록한다 — 한 번에
   * 150곳까지 처리하느라 계산 자체가 수십 초 걸릴 수 있는데, 보낼 때 기록하면 계산이 끝났을
   * 땐 이미 그 시간만큼 쿨다운이 줄어있어 "1분"이 실제로는 더 짧게 느껴지는 문제가 있었다.
   * skipCooldown=true(계산 실패 재시도 전용)면 쿨다운을 아예 기록하지 않는다 — 실패는 사용자가
   * 남발해서가 아니라 서버·카카오 쪽 일시적 문제라, 기다리게 할 이유가 없다.
   */
  function runRanking(
    origin: GeocodeCandidate,
    offset: number,
    append: boolean,
    retryCodes?: string[],
    skipCooldown?: boolean,
  ) {
    const destination = currentDestination();
    ranking.mutate(
      destination.kind === 'favorites'
        ? {
            origin: { lat: origin.lat, lng: origin.lng },
            favoriteCodes: destination.favoriteCodes,
            offset,
            retryCodes,
          }
        : {
            origin: { lat: origin.lat, lng: origin.lng },
            schulKndCode: destination.schulKndCode,
            sigungu: destination.sigungu,
            ownership: destination.ownership,
            offset,
            retryCodes,
          },
      {
        onSuccess: (res) => {
          if (!skipCooldown) {
            markRankingSearched();
            setRankingCooldownMs(rankingCooldownRemainingMs());
          }
          onResult(res, { destination, append });
        },
      },
    );
  }

  /**
   * ① 주소 검색 — 후보 목록만 받아온다. 30초 쿨다운은 여기서 기록.
   * 출발지(주소)와 도착지(시·군/학교급)는 이제 팝업 두 개로 독립적으로 고르므로, 도착지가
   * 아직 안 정해졌어도(`ready`가 false여도) 주소 검색은 항상 가능하다.
   */
  function searchAddress(rawAddress: string) {
    if (!rawAddress.trim() || cooling || geocode.isPending || ranking.isPending) return;
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

  /** 설정 페이지에 저장해둔 집 좌표를 바로 출발지로 확정 — 검색 없이 한 번의 클릭. */
  function useSavedOrigin(coords: { lat: number; lng: number }) {
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
  }

  /** 후보 목록에서 출발지를 확정만 한다 — 길찾기는 "출퇴근 시간 계산" 버튼(confirmSearch)에서. */
  function pickCandidate(c: GeocodeCandidate) {
    setPickedOrigin(c);
    setCandidates(null);
  }

  /**
   * ② 출발지 + 도착지 조건이 둘 다 갖춰진 뒤, "출퇴근 시간 계산" 버튼을 눌렀을 때 실행.
   * 같은 출발지·도착지 조건으로 이미 검색한 적 있으면(로컬 캐시) API 없이 그 결과를 바로 쓰고,
   * 이땐 쿨다운도 적용하지 않는다(실제 API 호출이 없어 비용이 안 드니 막을 이유가 없다).
   * 캐시가 없어 진짜 길찾기를 돌릴 때만 쿨다운(rankingCooling)을 확인한다.
   */
  function confirmSearch() {
    if (!pickedOrigin || !ready || ranking.isPending) return;

    const destination = currentDestination();
    const cached = loadCachedCommuteResult(
      { lat: pickedOrigin.lat, lng: pickedOrigin.lng },
      destination,
    );
    if (cached) {
      onSelectCode(null);
      onResult(cached, { destination, append: false });
      return;
    }

    if (rankingCooling) return;
    onSelectCode(null);
    onResult(null);
    runRanking(pickedOrigin, 0, false);
  }

  /**
   * "나머지도 계산" — 캐시에 없는 나머지 구간이라 항상 실제 API 호출. 쿨다운을 확인하지
   * 않는다 — 사용자가 명시적으로 이어서 계산하길 원하는 거라 기다리게 할 이유가 없다.
   */
  function loadMore(result: RouteRankingResponse | null) {
    if (!pickedOrigin || !result || ranking.isPending) return;
    runRanking(pickedOrigin, result.measuredCount, true, undefined, true);
  }

  /**
   * "계산 실패" 학교만 다시 시도 — offset(진행 위치)은 안 건드리고 실패한 코드만 보낸다.
   * "나머지도 계산"(아직 시도 안 한 다음 구간)과는 별개 동작이라 섞이지 않는다. 쿨다운
   * (rankingCooling)을 확인하지 않는다 — 실패는 사용자 책임이 아니라 서버·카카오 쪽
   * 일시적 문제라 바로 재시도할 수 있어야 한다. 요청이 이미 진행 중일 때만 막는다.
   */
  function retryFailed(result: RouteRankingResponse | null) {
    if (!pickedOrigin || !result || ranking.isPending) return;
    const failedCodes = result.results.filter((r) => r.failed).map((r) => r.schulCode);
    if (failedCodes.length === 0) return;
    runRanking(pickedOrigin, result.measuredCount, true, failedCodes, true);
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
    rankingCooling,
    rankingCooldownSec,
    isSearching: geocode.isPending,
    isRanking: ranking.isPending,
    geocodeErrorMsg,
    rankingErrorMsg,
    searchAddress,
    useSavedOrigin,
    pickCandidate,
    confirmSearch,
    loadMore,
    retryFailed,
  };
}
