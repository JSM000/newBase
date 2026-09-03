'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { KakaoMap, type KakaoMapHandle } from '@/components/kakao-map/kakao-map';
import { useChungbukSchools } from '@/hooks/use-chungbuk-schools';
import type { School } from '@/types/school-stats';
import {
  INDICATOR_BY_KEY,
  DEFAULT_INDICATOR_KEY,
} from '@/lib/school-indicators';
import {
  sortSigungu,
  type SchoolLevelFilter,
  type OwnershipFilter,
} from '@/lib/school-region';
import { SchoolFilterBar } from './school-filter-bar';
import { IndicatorLegend } from './indicator-legend';
import { SchoolDetailPanel } from './school-detail-panel';
import { SchoolRankingPanel, type RankSortDirection } from './school-ranking-panel';

/** 오른쪽 사이드바는 한 번에 하나만 — 상세/순위 목록이 같은 자리를 공유(계획 3-3). */
type PanelMode = 'none' | 'ranking' | 'detail';

export function StatisticsContainer() {
  const { data, isLoading, isError, error } = useChungbukSchools();
  const mapHandleRef = useRef<KakaoMapHandle>(null);

  const [level, setLevel] = useState<SchoolLevelFilter>('all');
  const [sigungu, setSigungu] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState<OwnershipFilter>('공립');
  const [indicatorKey, setIndicatorKey] = useState<string>(DEFAULT_INDICATOR_KEY);
  const [selected, setSelected] = useState<School | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  // 상세 패널을 닫았을 때 돌아갈 자리 — 순위 목록을 보다가 상세로 들어간 거면 'ranking'으로 복귀
  const [returnMode, setReturnMode] = useState<PanelMode>('none');
  const [sortDirection, setSortDirection] = useState<RankSortDirection>('desc');

  const indicator = INDICATOR_BY_KEY[indicatorKey] ?? INDICATOR_BY_KEY[DEFAULT_INDICATOR_KEY];

  const allSchools = useMemo(() => data?.schools ?? [], [data]);

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

  // 순위 목록 — filtered(현재 필터) 중 값이 있는 학교만 정렬. 동점이면 학교명 가나다순.
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

  function handleSelectSchool(school: School) {
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
        title="충북 학교 통계 지도"
        subtitle="학교를 선택해 전보 점수·근무 여건 참고 통계를 확인하세요"
        actions={
          <Link
            href="/"
            className="text-sm text-primary-100 underline hover:text-white"
          >
            홈으로
          </Link>
        }
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
            resultCount={filtered.length}
            onShowRanking={() => setPanelMode('ranking')}
          />

          <div className="relative min-h-0 flex-1 p-3">
            <KakaoMap
              ref={mapHandleRef}
              schools={filtered}
              indicator={indicator}
              selectedSchoolCode={panelMode === 'detail' ? (selected?.schulCode ?? null) : null}
              onSelectSchool={handleSelectSchool}
            />

            <div className="pointer-events-none absolute bottom-6 left-6 z-10">
              <IndicatorLegend indicator={indicator} noDataCount={noDataCount} />
            </div>

            <SchoolDetailPanel
              school={panelMode === 'detail' ? selected : null}
              onClose={() => setPanelMode(returnMode)}
            />

            <SchoolRankingPanel
              isOpen={panelMode === 'ranking'}
              ranked={ranked}
              noDataCount={noDataCount}
              indicator={indicator}
              sortDirection={sortDirection}
              onSortDirectionChange={setSortDirection}
              onSelectSchool={handleSelectFromRanking}
              onClose={() => setPanelMode('none')}
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
