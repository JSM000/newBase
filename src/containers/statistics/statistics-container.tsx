'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { KakaoMap, type KakaoMapHandle } from '@/components/kakao-map/kakao-map';
import { useChungbukSchools } from '@/hooks/use-chungbuk-schools';
import { useSchoolZoneLinks, useSchoolZonePoints, useSchoolZones } from '@/hooks/use-school-zones';
import { buildSchoolZonePointIndex, matchSchoolZonePoint } from '@/lib/school-zone-match';
import {
  useSchoolSocial,
  useRateSchool,
  useRecordView,
} from '@/hooks/use-school-social';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getMyRatings } from '@/lib/school-social-client';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { useFavoriteSchoolsStore } from '@/store/use-favorite-schools-store';
import { isExpired } from '@/lib/settings-retention';
import type { School } from '@/types/school-stats';
import type { ZoneMatchStatus } from './school-detail-panel';
import {
  INDICATOR_BY_KEY,
  DEFAULT_INDICATOR_KEY,
  SOCIAL_INDICATOR_DEFS,
  RATING_INDICATOR_KEY,
  FAVORITE_INDICATOR_KEY,
  COMMENT_INDICATOR_KEY,
  type Indicator,
} from '@/lib/school-indicators';
import {
  sortSigungu,
  normalizeSigungu,
  type SchoolLevelFilter,
  type OwnershipFilter,
} from '@/lib/school-region';
import { compareByCommute } from '@/lib/route-origin';
import { saveCachedCommuteResult, type CommuteDestination } from '@/lib/commute-result-cache';
import type { RouteRankingResponse } from '@/types/commute';
import { SchoolFilterBar, type StatsView } from './school-filter-bar';
import { IndicatorLegend } from './indicator-legend';
import { SchoolDetailPanel } from './school-detail-panel';
import {
  SchoolRankingPanel,
  type RankSortDirection,
} from './school-ranking-panel';
import { CommutePanel } from './commute-panel';
import { SchoolCompareModal } from './school-compare-modal';
import { useCommuteSearch } from './use-commute-search';

/** 오른쪽 사이드바는 한 번에 하나만 — 상세/순위/길찾기가 같은 자리를 공유(계획 3-3). */
type PanelMode = 'none' | 'ranking' | 'detail' | 'commute';

/**
 * 저장된 로컬 설정을 동기적으로 읽어온다 (계획: _refs/개인정보_로컬설정_구현계획/08_자동화.md).
 * SSR에서는 `persist`가 없어 `?.`로 건너뛰고 store 기본값을 반환 — myRatings와 같은 lazy
 * 초기화 패턴이라 useState 초기값 계산 함수 안에서만 호출한다(useEffect 안에서 부르지 않음).
 */
function readFreshSettings() {
  useUserSettingsStore.persist?.rehydrate();
  const settings = useUserSettingsStore.getState();
  if (settings.savedAt && isExpired(settings.savedAt)) return null;
  return settings;
}

/**
 * 통계지도가 기본으로 보여줄 시·군 — 관외전보를 고려 중이면 "떠날 지역"이 아니라 "가고 싶은
 * 지역"의 학교를 보는 게 맞아서 desiredSigungu를 우선한다 (계획 08-2 확장).
 */
function resolveTargetSigungu(
  settings: ReturnType<typeof readFreshSettings>,
): string | null {
  if (!settings) return null;
  const raw =
    settings.transferPreference === 'external' && settings.desiredSigungu
      ? settings.desiredSigungu
      : settings.currentSigungu;
  // normalizeSigungu: 병합 전에 저장된 "괴산군"/"증평군" 값이 남아있어도 병합 단위로 맞춰준다.
  return normalizeSigungu(raw);
}

/** 유치원·미선택('all')은 통계지도 대상 학교급이 아니거나 특정 짓지 않은 상태라 'all'로 둔다. */
function resolveTargetLevel(
  settings: ReturnType<typeof readFreshSettings>,
): SchoolLevelFilter {
  switch (settings?.schoolLevel) {
    case 'elementary': return '02';
    case 'middle': return '03';
    case 'high': return '04';
    default: return 'all';
  }
}

export function StatisticsContainer() {
  const { data, isLoading, isError, error } = useChungbukSchools();
  const { data: social } = useSchoolSocial();
  const rateSchool = useRateSchool();
  const recordView = useRecordView();
  const mapHandleRef = useRef<KakaoMapHandle>(null);

  // 저장된 로컬 설정(시·군·학교급·집 좌표)이 있으면 선택 과정을 생략하고 곧바로 그 조건의
  // 결과를 보여준다 (계획 08-2). lazy 초기화: SSR에선 기본값, 클라이언트 첫 렌더에서
  // localStorage를 읽는다 — myRatings와 동일한 패턴.
  const [level, setLevel] = useState<SchoolLevelFilter>(
    () => resolveTargetLevel(readFreshSettings()),
  );
  const [sigungu, setSigungu] = useState<string>(
    () => resolveTargetSigungu(readFreshSettings()) ?? 'all',
  );
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState<OwnershipFilter>('공립');
  // 즐겨찾기만 보기 — 지도/학교 순위 대상 필터(2차, 계획: _refs/즐겨찾기_구현계획/04_필터지도연동.md A).
  // 길찾기 대상 필터("즐겨찾기만" 옵션, 04-B)는 별도 상태(commuteFavoritesOnly)로 시작했는데,
  // "길찾기에서 관심학교만 검색하면 지도에도 관심학교만 보이면 좋겠다"는 요청으로 한쪽 방향으로만
  // 묶었다 — commuteFavoritesOnly를 켜면 favoritesOnly도 같이 켜진다(아래 onCommuteFavoritesOnlyChange).
  // 반대 방향(지도 쪽 토글을 켠다고 길찾기 쪽까지 켜짐)은 아님 — 지도 쪽은 길찾기와 별개로
  // 혼자서도 켤 수 있음(둘 다 "켜면 지역/학교급 무관하게 관심학교 전체 대상"으로 동작은 동일).
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [commuteFavoritesOnly, setCommuteFavoritesOnly] = useState(false);
  const favoriteCodes = useFavoriteSchoolsStore((s) => s.favoriteCodes);
  const [indicatorKey, setIndicatorKey] = useState<string>(DEFAULT_INDICATOR_KEY);
  const [selected, setSelected] = useState<School | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  // 필터바 탭 선택 — 이것만으로는 사이드바가 안 열린다. "학교 순위"/"검색" 버튼을 눌러야
  // panelMode가 바뀌어 사이드바가 열린다(탭 전환 자체로 사이드바가 튀어나오면 혼란스럽다는 피드백).
  const [statsView, setStatsView] = useState<StatsView>('ranking');
  // 탭+필터 바 접힘 상태 — 사이드바와 마찬가지로 지도 위에 오버레이로 뜨고, 접으면 지도가
  // 화면을 최대한 차지한다. 페이지에 처음 들어왔을 땐 필터를 바로 볼 수 있게 펼친 채로 시작.
  const [filterBarOpen, setFilterBarOpen] = useState(true);
  // 학교 비교 모달 — panelMode(사이드바)와 별개의 큰 모달이라 독립 상태로 둔다
  // (계획: _refs/즐겨찾기_구현계획/03_목록보기.md "학교 비교 탭").
  const [compareOpen, setCompareOpen] = useState(false);

  // 지도 컨트롤(학교 개별 마커/행정구역 경계) — 필터 바 안에서 같이 접혔다 펼쳐지도록
  // KakaoMap 내부 state가 아니라 여기서 들고 필터 바·지도 양쪽에 내려준다.
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(true);

  // 탭이 바뀌는 "순간"에 개별 마커 기본값을 맞춰준다 — 출퇴근 탭은 학교별 소요시간/직선거리를
  // 바로 봐야 하니 개별 마커가 기본(on), 순위 탭은 지역 클러스터 뱃지가 기본(off)이다.
  // useEffect 대신 렌더 중 비교(React 문서가 권장하는 "prop 변화에 따라 state 조정" 패턴,
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes)를
  // 쓴 이유: 탭이 "바뀌는 그 순간"에만 한 번 맞춰주고, 같은 탭에 머무는 동안 사용자가 직접
  // 바꾼 값은 되돌리지 않아야 한다. ref가 아니라 state로 이전 값을 들고 비교한다 —
  // 이 프로젝트 lint(react-hooks/refs)가 렌더 중 ref.current 접근 자체를 막는다.
  const [prevStatsView, setPrevStatsView] = useState(statsView);
  if (prevStatsView !== statsView) {
    setPrevStatsView(statsView);
    setShowAllMarkers(statsView === 'commute');
    // 지금 탭에 연결된 사이드바가 열린 채로 다른 탭으로 바꾸면 닫는다. 안 그러면 panelMode가
    // 떠난 탭 걸로 남아있어서, 지도에서 학교를 눌렀을 때 사용자 눈엔 이미 떠난 탭의 동작
    // (상세정보 대신 길찾기 경로 선택이 된다거나)으로 처리되는 혼란이 있었다.
    if (statsView !== 'commute' && panelMode === 'commute') {
      setPanelMode('none');
    }
    if (statsView !== 'ranking' && panelMode === 'ranking') {
      setPanelMode('none');
    }
  }
  // 상세 패널을 닫았을 때 돌아갈 자리 — 순위 목록을 보다가 상세로 들어간 거면 'ranking'으로 복귀
  const [returnMode, setReturnMode] = useState<PanelMode>('none');
  const [sortDirection, setSortDirection] = useState<RankSortDirection>('desc');

  // ── 길찾기 패널 상태 ── (패널이 useRouteRanking mutation을 직접 들고, 결과·선택만 여기로 올림)
  // 경로 폴리라인은 순위 응답에 포함돼 있어 별도 조회가 없다.
  const [commuteResult, setCommuteResult] = useState<RouteRankingResponse | null>(
    null,
  );
  const [commuteSelected, setCommuteSelected] = useState<string | null>(null);
  // 방금 받은 응답이 어떤 도착지 조건으로 검색한 것인지 — 아래 캐시 저장 effect에 넘긴다.
  const lastCommuteDestinationRef = useRef<CommuteDestination | null>(null);

  /**
   * confirmSearch/loadMore 응답을 반영 — "새 검색인지"는 출발지·도착지가 이전과 같은지로
   * 판단하지 않고(그러면 같은 조건으로 재검색/캐시 히트했을 때 "이어붙이기"로 오판해 자동 선택이
   * 안 먹힘 — 길찾기 탭을 떠났다 돌아와 "계산하기"를 다시 눌러도 경로가 안 뜨던 버그가 이거였다),
   * 어떤 동작이 응답을 만들었는지(append)로 직접 판단한다. confirmSearch는 조건이 이전과 완전히
   * 같아도(캐시 히트 포함) 항상 "새로 계산함" 취급 — 결과 교체 + 가장 가까운 학교 자동 선택.
   * loadMore만 "이어붙이기" — 기존 결과에 병합하고 지금 선택은 그대로 둔다.
   */
  function mergeCommuteResult(
    res: RouteRankingResponse | null,
    info?: { destination: CommuteDestination; append: boolean },
  ) {
    if (!res) {
      setCommuteSelected(null);
      setCommuteResult(null);
      return;
    }

    if (info) lastCommuteDestinationRef.current = info.destination;

    if (!info?.append) {
      // 새 검색 — 결과 중 가장 가까운(정렬상 첫 번째) 학교를 자동 선택해서 경로를 바로
      // 보여준다. 학교를 직접 눌러야 경로가 보인다는 걸 모르고 목록만 훑고 지나칠 수 있어서,
      // 예시로 하나는 먼저 띄워준다.
      setCommuteSelected(res.results[0]?.schulCode ?? null);
      setCommuteResult(res);
      return;
    }

    setCommuteResult((p) => {
      if (!p) return res;
      const merged = res.results.map((r) => {
        if (r.durationSec !== null) return r; // 이번에 성공
        const old = p.results.find((o) => o.schulCode === r.schulCode);
        if (old && old.durationSec !== null) return old; // 이전에 이미 성공 — 유지
        // 이번 호출이 손 안 댄 자리(일반 진행이면 재시도 대상 밖, 재시도 호출이면 다른 코드)인데
        // 예전에 "계산 실패" 기록이 남아있었으면 그 기록을 지우지 않는다 — 안 그러면 재시도
        // 버튼을 눌러 일부만 다시 시도했을 때 나머지 실패 기록이 사라져 보인다.
        if (old && old.failed && !r.failed) return old;
        return r; // 이번에 새로 실패했거나, 원래부터 미시도(대기)
      });
      merged.sort(compareByCommute);
      // measuredCount/remainingCount는 res(이번 응답)의 값을 그대로 쓴다 — "진행 위치" 기준이라
      // (재시도 호출은 위치를 안 건드리므로 그대로, 일반 진행 호출은 res가 이미 새 위치를 반영).
      return { ...res, results: merged };
    });
  }

  // commuteResult가 갱신될 때마다(새 검색이든 "나머지도 계산" 병합이든) 로컬에 캐시해서,
  // 다음에 같은 출발지·도착지로 검색하면 API 없이 바로 꺼내 쓸 수 있게 한다. setCommuteResult의
  // 업데이터 함수 안에서 바로 저장하지 않는 이유는 그 함수가 순수해야 하기 때문 — 커밋된
  // 최신 상태를 확정적으로 넘겨받는 effect에서 저장한다.
  useEffect(() => {
    if (commuteResult && lastCommuteDestinationRef.current) {
      saveCachedCommuteResult(commuteResult.origin, lastCommuteDestinationRef.current, commuteResult);
    }
  }, [commuteResult]);

  // 이 브라우저가 남긴 별점 (localStorage) — 위젯의 "내 평가" 표시용.
  // lazy 초기화: SSR에선 {}, 클라이언트 첫 렌더에서 localStorage를 읽는다
  // (별점 표시는 학교 선택 후에만 렌더되므로 hydration 불일치 없음).
  const [myRatings, setMyRatings] =
    useState<Record<string, number>>(getMyRatings);

  // 저장된 집 좌표 — 길찾기를 안 켜도 지도에 집모양 마커로 항상 표시한다.
  const homeCoords = useUserSettingsStore((s) => s.homeCoords);

  // 집주소 검색 — 입력은 필터바, 후보 선택·결과는 CommutePanel(사이드바)이 나눠 쓴다.
  // 즐겨찾기만 모드면 시·군/학교급 대신 즐겨찾기 목록이 있는지로 준비 여부를 판단한다.
  const commuteSearchReady = commuteFavoritesOnly
    ? favoriteCodes.length > 0
    : level !== 'all' && sigungu !== 'all';
  const commuteSearch = useCommuteSearch({
    ready: commuteSearchReady,
    level,
    sigungu,
    ownership,
    favoritesOnly: commuteFavoritesOnly,
    favoriteCodes,
    homeCoords,
    onResult: mergeCommuteResult,
    onSelectCode: setCommuteSelected,
  });

  // 상세 패널이 열리면 조회수 +1 (같은 세션에 이미 본 학교면 hook 내부에서 무시)
  useEffect(() => {
    if (panelMode === 'detail' && selected) {
      recordView(selected.schulCode);
    }
  }, [panelMode, selected, recordView]);

  // 표시·순위 기준. 별점/조회수는 School이 아니라 소셜 맵에서 값을 읽으므로,
  // accessor를 현재 social 데이터에 바인딩해 Indicator를 완성한다(지도 색칠·순위·범례 공용).
  const indicator = useMemo<Indicator>(() => {
    const def = SOCIAL_INDICATOR_DEFS[indicatorKey];
    if (def) {
      const accessor =
        def.key === RATING_INDICATOR_KEY
          ? (s: School) => {
              const e = social?.[s.schulCode];
              return e && e.count > 0 ? e.avg : null;
            }
          : def.key === FAVORITE_INDICATOR_KEY
            ? (s: School) => social?.[s.schulCode]?.favoriteCount ?? 0
            : def.key === COMMENT_INDICATOR_KEY
              ? (s: School) => social?.[s.schulCode]?.commentCount ?? 0
              : (s: School) => social?.[s.schulCode]?.views ?? 0;
      return { ...def, accessor };
    }
    return INDICATOR_BY_KEY[indicatorKey] ?? INDICATOR_BY_KEY[DEFAULT_INDICATOR_KEY];
  }, [indicatorKey, social]);

  const allSchools = useMemo(() => data?.schools ?? [], [data]);

  // 길찾기 도착지 조건에 해당하는 학교 수 — route-ranking.ts(computeRanking)의 대상 선정
  // 로직을 클라이언트에서 그대로 따라 해서, 검색 버튼을 누르기 "전에" 몇 곳이 대상인지 미리
  // 보여준다(한 번에 최대 MAX_SCHOOLS_PER_SEARCH곳까지만 계산되니, 그걸 넘는지 미리 알림).
  const commuteTargetCount = useMemo(() => {
    if (commuteFavoritesOnly) return favoriteCodes.length;
    if (level === 'all' || sigungu === 'all') return 0;
    return allSchools.filter(
      (s) =>
        s.position &&
        normalizeSigungu(s.sigunguName) === sigungu &&
        s.schulKndCode === level &&
        (ownership === 'all' || s.fondScCode === ownership),
    ).length;
  }, [allSchools, commuteFavoritesOnly, favoriteCodes, level, sigungu, ownership]);

  // 학교 비교 모달용 — 관심학교 코드를 School 객체로 매핑(추가한 순서 유지).
  const favoriteSchools = useMemo(() => {
    const bySchulCode = new Map(allSchools.map((s) => [s.schulCode, s]));
    return favoriteCodes
      .map((code) => bySchulCode.get(code))
      .filter((s): s is School => s !== undefined);
  }, [allSchools, favoriteCodes]);

  // 지도에 넘길 길찾기 오버레이 — 매 렌더 새 객체가 되지 않도록 메모이즈
  // (안 그러면 KakaoMap 의 오버레이 effect 가 매번 재실행됨). 경로는 선택된 학교의 결과에서 꺼냄.
  const routeOverlay = useMemo(() => {
    if (panelMode !== 'commute' || !commuteResult) return null;
    const hit = commuteSelected
      ? commuteResult.results.find((r) => r.schulCode === commuteSelected)
      : null;
    return {
      origin: commuteResult.origin,
      path: hit?.path ?? null,
      // 실측(도로 경로)이 아직 없는 학교(직선거리만 있는 학교)를 선택했을 때, 집↔학교
      // 직선이라도 지도에 보여주기 위한 좌표 — path가 있으면 이건 굳이 안 쓴다.
      selectedPosition: hit?.position ?? null,
      schoolPoints: commuteResult.results.map((r) => r.position),
    };
  }, [panelMode, commuteResult, commuteSelected]);

  // "출퇴근 시간 계산기" 탭이 선택돼 있기만 하면 채워짐(사이드바를 아직 안 열었어도,
  // 검색 전이라 빈 Map이어도) — KakaoMap이 이 값의 존재 여부로 "출퇴근 모드"를 판단해서,
  // 호버 툴팁엔 표시·순위 기준 대신 실측/직선 결과를, 마커·클러스터엔 지표 색/크기 대신
  // 고정된 primary 색 + 확대 크기를 쓴다(kakao-map.tsx의 isCommuteMode/COMMUTE_MARKER_*
  // 참고 — "자료 없음"과 헷갈리지 않도록 구분). panelMode가 아니라 statsView 기준인 이유:
  // 탭만 눌러도(사이드바를 열지 않아도) 바로 적용돼야 한다.
  const commuteStats = useMemo(() => {
    if (statsView !== 'commute') return null;
    const map = new Map<string, { durationSec: number | null; straightKm: number }>();
    for (const r of commuteResult?.results ?? []) {
      map.set(r.schulCode, { durationSec: r.durationSec, straightKm: r.straightKm });
    }
    return map;
  }, [statsView, commuteResult]);

  const sigunguOptions = useMemo(
    () =>
      sortSigungu([
        ...new Set(
          allSchools
            .map((s) => normalizeSigungu(s.sigunguName))
            .filter((v): v is string => v !== null),
        ),
      ]),
    [allSchools],
  );

  // favoritesOnly가 꺼져있으면 항상 null(참조 그대로) — favoriteCodes가 바뀔 때마다(어디서든
  // 즐겨찾기를 누를 때마다) filtered가 새 배열이 되는 걸 막는다. filtered가 바뀌면 KakaoMap의
  // schools prop도 바뀌어 "보이는 학교에 맞춰 화면 이동" effect가 다시 돌아 지도가 전체
  // 학교 범위로 축소돼버렸었다(즐겨찾기 누를 때마다 지도가 줄어드는 버그의 원인).
  const favoriteSetForFilter = useMemo(
    () => (favoritesOnly ? new Set(favoriteCodes) : null),
    [favoritesOnly, favoriteCodes],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return allSchools.filter((s) => {
      if (!s.position) return false;
      if (favoriteSetForFilter) {
        // 관심학교만 보기 — 시·군/학교급/설립구분과 교집합이 아니라 "대체": 저장된
        // 관심학교 전체를 대상으로 삼는다(길찾기의 "관심학교만 계산하기"와 같은 원칙).
        // 교집합으로 두면 "충주시 선택 + 관심학교 토글"처럼 지금 지역에 관심학교가
        // 하나도 없을 때 아무것도 안 보여서 혼란스럽다는 피드백으로 바꿨다.
        if (!favoriteSetForFilter.has(s.schulCode)) return false;
      } else {
        if (level !== 'all' && s.schulKndCode !== level) return false;
        if (sigungu !== 'all' && normalizeSigungu(s.sigunguName) !== sigungu) return false;
        if (ownership !== 'all' && s.fondScCode !== ownership) return false;
      }
      if (q && !s.schulNm.includes(q)) return false;
      return true;
    });
  }, [allSchools, level, sigungu, ownership, search, favoriteSetForFilter]);

  const noDataCount = useMemo(
    () => filtered.filter((s) => indicator.accessor(s) === null).length,
    [filtered, indicator],
  );

  // 순위 목록 — filtered(현재 필터) 중 값이 있는 학교만 "표시·순위 기준"으로 정렬.
  // 동점이면 학교명 가나다순. (별점/조회수 기준도 indicator.accessor에 이미 반영됨)
  const ranked = useMemo(() => {
    const withValue = filtered
      .map((s) => ({ school: s, value: indicator.accessor(s) }))
      .filter((x): x is { school: School; value: number } => x.value !== null);
    withValue.sort((a, b) => {
      if (a.value !== b.value) {
        return sortDirection === 'desc' ? b.value - a.value : a.value - b.value;
      }
      return a.school.schulNm.localeCompare(b.school.schulNm, 'ko');
    });
    return withValue;
  }, [filtered, indicator, sortDirection]);

  function handleRate(school: School, rating: number) {
    setMyRatings((m) => ({ ...m, [school.schulCode]: rating }));
    rateSchool.mutate({ schoolCode: school.schulCode, rating });
  }

  // ── 학구도: 선택된(상세 패널 열린) 학교의 학구를 지도에 색칠 (계획: _refs/학구도_지도_구현계획.md) ──
  // 학구도 원본은 학교알리미(schulCode)와 다른 학교ID 체계라 이름+학교급(+좌표)으로 매칭한다.
  const zonePointsQuery = useSchoolZonePoints();
  const zoneLinksQuery = useSchoolZoneLinks();
  const zonePointIndex = useMemo(
    () => buildSchoolZonePointIndex(zonePointsQuery.data ?? []),
    [zonePointsQuery.data],
  );
  const focusedSchool = panelMode === 'detail' ? selected : null;
  const matchedZonePoint = useMemo(
    () =>
      focusedSchool
        ? matchSchoolZonePoint(focusedSchool, zonePointsQuery.data ?? [], zonePointIndex)
        : null,
    [focusedSchool, zonePointsQuery.data, zonePointIndex],
  );
  const zoneLink = matchedZonePoint ? (zoneLinksQuery.data?.[matchedZonePoint.schoolId] ?? null) : null;
  // 매칭된 학교급의 학구 폴리곤 파일만 그때그때 불러온다(lazy) — 초/중/고 전체를 한 번에 안 받음.
  const zoneCollectionQuery = useSchoolZones(matchedZonePoint?.level ?? null);

  const zoneStatus: ZoneMatchStatus = !focusedSchool
    ? 'idle'
    : zonePointsQuery.isLoading || zoneLinksQuery.isLoading
      ? 'loading'
      : matchedZonePoint
        ? 'matched'
        : 'unmatched';

  function handleSelectSchool(school: School) {
    // 길찾기 패널이 열려 있고 그 결과에 있는 학교면 — 상세로 넘어가지 않고 경로만 선택
    if (
      panelMode === 'commute' &&
      commuteResult?.results.some((r) => r.schulCode === school.schulCode)
    ) {
      setCommuteSelected(school.schulCode);
      return;
    }
    setSelected(school);
    // 순위 목록을 보던 중이면 그걸 기억해뒀다가, 상세 패널을 닫을 때 그 화면(스크롤 위치 포함)으로 복귀
    setReturnMode(panelMode === 'ranking' ? 'ranking' : 'none');
    setPanelMode('detail');
  }

  /** 순위 목록에서 학교를 고르면, 상세 패널로 전환 + 지도도 그 학교로 이동(클러스터에 묶여 있어도). */
  function handleSelectFromRanking(school: School) {
    handleSelectSchool(school);
    mapHandleRef.current?.focusSchool(school);
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <AppHeader
        items={[{ label: 'NewBase', href: '/' }, { label: '통계지도' }]}
      />

      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm">학교 통계 데이터를 불러오는 중…</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
            {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}
          </div>
        </div>
      )}

      {data && (
        <div className="relative min-h-0 flex-1 p-3">
            <KakaoMap
              ref={mapHandleRef}
              schools={filtered}
              indicator={indicator}
              selectedSchoolCode={
                panelMode === 'detail'
                  ? (selected?.schulCode ?? null)
                  : panelMode === 'commute'
                    ? commuteSelected
                    : null
              }
              onSelectSchool={handleSelectSchool}
              routeOverlay={routeOverlay}
              homePosition={homeCoords}
              zoneFeatures={zoneCollectionQuery.data?.features ?? []}
              zoneLink={zoneLink}
              commuteStats={commuteStats}
              showAllMarkers={showAllMarkers}
              showBoundaries={showBoundaries}
            />

            {/* 탭+필터 바 — 사이드바(오른쪽)와 같은 방식으로 지도 위에 오버레이. 접으면 지도가
                화면을 최대한 차지하고, 펼치면 이 카드가 위쪽에서 덮어씌운다. */}
            <div className="pointer-events-none absolute inset-x-3 top-3 z-20">
              {/* w-full max-w-[22rem]: 탭마다 카드 폭이 다르게 보이던 걸 고정폭으로 통일(이
                  값은 사용자가 직접 조정함). 이 div의 부모(absolute inset-x-3)는 left·right가
                  둘 다 지정돼 있어 너비가 이미 확정된 값이라, w-full이 순환 참조 없이 "그
                  확정폭을 꽉 채움"으로 정상 계산된다. 창이 이보다 좁아지면 그만큼 같이
                  줄어든다. */}
              <div className="pointer-events-auto w-full max-w-[22rem]">
                <SchoolFilterBar
                  level={level}
                  onLevelChange={setLevel}
                  sigungu={sigungu}
                  onSigunguChange={setSigungu}
                  sigunguOptions={sigunguOptions}
                  search={search}
                  onSearchChange={setSearch}
                  ownership={ownership}
                  onOwnershipChange={setOwnership}
                  indicatorKey={indicatorKey}
                  onIndicatorKeyChange={setIndicatorKey}
                  socialEnabled={isSupabaseConfigured}
                  resultCount={filtered.length}
                  view={statsView}
                  onViewChange={setStatsView}
                  onShowRanking={() => setPanelMode('ranking')}
                  onShowCompare={() => setCompareOpen(true)}
                  originLabel={commuteSearch.pickedOrigin?.label ?? null}
                  addressValue={commuteSearch.address}
                  onAddressChange={commuteSearch.setAddress}
                  onAddressSearch={() => commuteSearch.searchAddress(commuteSearch.address)}
                  addressSearching={commuteSearch.isSearching}
                  addressCooling={commuteSearch.cooling}
                  addressCooldownSec={commuteSearch.cooldownSec}
                  rankingCooling={commuteSearch.rankingCooling}
                  rankingCooldownSec={commuteSearch.rankingCooldownSec}
                  commuteTargetCount={commuteTargetCount}
                  geocodeErrorMsg={commuteSearch.geocodeErrorMsg}
                  candidates={commuteSearch.candidates}
                  onPickCandidate={commuteSearch.pickCandidate}
                  onUseSavedHome={
                    homeCoords ? () => commuteSearch.useSavedOrigin(homeCoords) : undefined
                  }
                  destinationReady={commuteSearchReady}
                  isRanking={commuteSearch.isRanking}
                  onConfirmSearch={() => {
                    setPanelMode('commute');
                    commuteSearch.confirmSearch();
                  }}
                  collapsed={!filterBarOpen}
                  onToggleCollapsed={() => setFilterBarOpen((v) => !v)}
                  showAllMarkers={showAllMarkers}
                  onShowAllMarkersChange={setShowAllMarkers}
                  showBoundaries={showBoundaries}
                  onShowBoundariesChange={setShowBoundaries}
                  favoritesOnly={favoritesOnly}
                  onFavoritesOnlyChange={setFavoritesOnly}
                  commuteFavoritesOnly={commuteFavoritesOnly}
                  onCommuteFavoritesOnlyChange={(v) => {
                    setCommuteFavoritesOnly(v);
                    // 길찾기에서 "관심학교만 계산하기"를 켜면 지도의 "관심학교" 토글도
                    // 같이 켜서, 길찾기 대상과 지도에 보이는 마커가 일치하도록 맞춘다.
                    if (v) setFavoritesOnly(true);
                  }}
                  favoriteCount={favoriteCodes.length}
                />
              </div>
            </div>

            {statsView !== 'commute' && (
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 sm:bottom-6 sm:left-6">
                <IndicatorLegend indicator={indicator} noDataCount={noDataCount} />
              </div>
            )}

            <SchoolDetailPanel
              school={panelMode === 'detail' ? selected : null}
              onClose={() => setPanelMode(returnMode)}
              zoneStatus={zoneStatus}
              zoneLink={zoneLink}
              socialEnabled={isSupabaseConfigured}
              social={selected ? social?.[selected.schulCode] : undefined}
              myRating={selected ? myRatings[selected.schulCode] ?? null : null}
              onRate={(rating) => selected && handleRate(selected, rating)}
            />

            <SchoolRankingPanel
              isOpen={panelMode === 'ranking'}
              ranked={ranked}
              noDataCount={filtered.length - ranked.length}
              indicator={indicator}
              social={social}
              sortDirection={sortDirection}
              onSortDirectionChange={setSortDirection}
              onSelectSchool={handleSelectFromRanking}
              onClose={() => setPanelMode('none')}
            />

            <CommutePanel
              isOpen={panelMode === 'commute'}
              level={level}
              sigungu={sigungu}
              ownership={ownership}
              favoritesOnly={commuteFavoritesOnly}
              favoriteCount={favoriteCodes.length}
              result={commuteResult}
              selectedCode={commuteSelected}
              onSelectCode={setCommuteSelected}
              onClose={() => setPanelMode('none')}
              pickedOrigin={commuteSearch.pickedOrigin}
              sortDir={commuteSearch.sortDir}
              onSortDirChange={commuteSearch.setSortDir}
              onLoadMore={() => commuteSearch.loadMore(commuteResult)}
              onRetryFailed={() => commuteSearch.retryFailed(commuteResult)}
              isRanking={commuteSearch.isRanking}
              errorMsg={commuteSearch.rankingErrorMsg}
            />

            <SchoolCompareModal
              open={compareOpen}
              onOpenChange={setCompareOpen}
              schools={favoriteSchools}
              social={social}
            />
        </div>
      )}

      <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-1.5 text-center text-[11px] leading-tight text-zinc-400">
        본 저작물은 &apos;한국교육학술정보원&apos;에서 작성하여 공공누리 제1유형으로 개방한 &apos;학교알리미 공시정보&apos;를 이용하였으며,
        해당 저작물은{' '}
        <a
          href="https://www.schoolinfo.go.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-600"
        >
          학교알리미(schoolinfo.go.kr)
        </a>
        에서 무료로 다운받으실 수 있습니다.
      </footer>
    </div>
  );
}
