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
import { isExpired } from '@/lib/settings-retention';
import type { School } from '@/types/school-stats';
import type { ZoneMatchStatus } from './school-detail-panel';
import {
  INDICATOR_BY_KEY,
  DEFAULT_INDICATOR_KEY,
  SOCIAL_INDICATOR_DEFS,
  RATING_INDICATOR_KEY,
  type Indicator,
} from '@/lib/school-indicators';
import {
  sortSigungu,
  type SchoolLevelFilter,
  type OwnershipFilter,
} from '@/lib/school-region';
import { compareByCommute } from '@/lib/route-origin';
import type { RouteRankingResponse } from '@/types/commute';
import { SchoolFilterBar } from './school-filter-bar';
import { IndicatorLegend } from './indicator-legend';
import { SchoolDetailPanel } from './school-detail-panel';
import {
  SchoolRankingPanel,
  type RankSortDirection,
} from './school-ranking-panel';
import { CommutePanel } from './commute-panel';

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
  if (settings.transferPreference === 'external' && settings.desiredSigungu) {
    return settings.desiredSigungu;
  }
  return settings.currentSigungu;
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
  const [indicatorKey, setIndicatorKey] = useState<string>(DEFAULT_INDICATOR_KEY);
  const [selected, setSelected] = useState<School | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  // 상세 패널을 닫았을 때 돌아갈 자리 — 순위 목록을 보다가 상세로 들어간 거면 'ranking'으로 복귀
  const [returnMode, setReturnMode] = useState<PanelMode>('none');
  const [sortDirection, setSortDirection] = useState<RankSortDirection>('desc');

  // ── 길찾기 패널 상태 ── (패널이 useRouteRanking mutation을 직접 들고, 결과·선택만 여기로 올림)
  // 경로 폴리라인은 순위 응답에 포함돼 있어 별도 조회가 없다.
  const [commuteResult, setCommuteResult] = useState<RouteRankingResponse | null>(
    null,
  );
  const [commuteSelected, setCommuteSelected] = useState<string | null>(null);

  // "나머지도 계산" 응답을 이전 결과에 병합 (출발지가 같을 때만).
  function mergeCommuteResult(res: RouteRankingResponse | null) {
    setCommuteSelected(null);
    setCommuteResult((prev) => {
      if (
        !res ||
        !prev ||
        prev.origin.lat !== res.origin.lat ||
        prev.origin.lng !== res.origin.lng
      ) {
        return res;
      }
      const merged = res.results.map((r) => {
        if (r.durationSec !== null) return r;
        const old = prev.results.find((p) => p.schulCode === r.schulCode);
        return old && old.durationSec !== null ? old : r;
      });
      merged.sort(compareByCommute);
      return {
        ...res,
        results: merged,
        measuredCount: merged.filter((r) => r.durationSec !== null).length,
        remainingCount: merged.filter((r) => r.durationSec === null).length,
      };
    });
  }

  // 이 브라우저가 남긴 별점 (localStorage) — 위젯의 "내 평가" 표시용.
  // lazy 초기화: SSR에선 {}, 클라이언트 첫 렌더에서 localStorage를 읽는다
  // (별점 표시는 학교 선택 후에만 렌더되므로 hydration 불일치 없음).
  const [myRatings, setMyRatings] =
    useState<Record<string, number>>(getMyRatings);

  // 저장된 집 좌표 — 길찾기를 안 켜도 지도에 집모양 마커로 항상 표시한다.
  const homeCoords = useUserSettingsStore((s) => s.homeCoords);

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
          : (s: School) => social?.[s.schulCode]?.views ?? 0;
      return { ...def, accessor };
    }
    return INDICATOR_BY_KEY[indicatorKey] ?? INDICATOR_BY_KEY[DEFAULT_INDICATOR_KEY];
  }, [indicatorKey, social]);

  const allSchools = useMemo(() => data?.schools ?? [], [data]);

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
      schoolPoints: commuteResult.results.map((r) => r.position),
    };
  }, [panelMode, commuteResult, commuteSelected]);

  const sigunguOptions = useMemo(
    () =>
      sortSigungu([
        ...new Set(
          allSchools
            .map((s) => s.sigunguName)
            .filter((v): v is string => v !== null),
        ),
      ]),
    [allSchools],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return allSchools.filter((s) => {
      if (!s.position) return false;
      if (level !== 'all' && s.schulKndCode !== level) return false;
      if (sigungu !== 'all' && s.sigunguName !== sigungu) return false;
      if (ownership !== 'all' && s.fondScCode !== ownership) return false;
      if (q && !s.schulNm.includes(q)) return false;
      return true;
    });
  }, [allSchools, level, sigungu, ownership, search]);

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
        <>
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
            onShowRanking={() => setPanelMode('ranking')}
            onShowCommute={() => setPanelMode('commute')}
          />

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
            />

            <div className="pointer-events-none absolute bottom-3 left-3 z-10 sm:bottom-6 sm:left-6">
              <IndicatorLegend indicator={indicator} noDataCount={noDataCount} />
            </div>

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
              result={commuteResult}
              selectedCode={commuteSelected}
              onResult={mergeCommuteResult}
              onSelectCode={setCommuteSelected}
              onClose={() => setPanelMode('none')}
              savedHomeCoords={homeCoords}
            />
          </div>
        </>
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
