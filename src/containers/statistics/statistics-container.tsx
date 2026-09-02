'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { KakaoMap } from '@/components/kakao-map/kakao-map';
import { useChungbukSchools } from '@/hooks/use-chungbuk-schools';
import type { School } from '@/types/school-stats';
import {
  INDICATOR_BY_KEY,
  DEFAULT_INDICATOR_KEY,
} from '@/lib/school-indicators';
import {
  sigunguOf,
  sortSigungu,
  type SchoolLevelFilter,
} from '@/lib/school-region';
import { SchoolFilterBar } from './school-filter-bar';
import { IndicatorLegend } from './indicator-legend';
import { SchoolDetailPanel } from './school-detail-panel';

export function StatisticsContainer() {
  const { data, isLoading, isError, error } = useChungbukSchools();

  const [level, setLevel] = useState<SchoolLevelFilter>('all');
  const [sigungu, setSigungu] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [publicOnly, setPublicOnly] = useState(true);
  const [indicatorKey, setIndicatorKey] = useState<string>(DEFAULT_INDICATOR_KEY);
  const [selected, setSelected] = useState<School | null>(null);

  const indicator = INDICATOR_BY_KEY[indicatorKey] ?? INDICATOR_BY_KEY[DEFAULT_INDICATOR_KEY];

  const allSchools = useMemo(() => data?.schools ?? [], [data]);

  const sigunguOptions = useMemo(
    () =>
      sortSigungu([
        ...new Set(
          allSchools
            .map((s) => sigunguOf(s))
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
      if (sigungu !== 'all' && sigunguOf(s) !== sigungu) return false;
      if (publicOnly && s.fondScCode !== '공립') return false;
      if (q && !s.schulNm.includes(q)) return false;
      return true;
    });
  }, [allSchools, level, sigungu, publicOnly, search]);

  const noDataCount = useMemo(
    () => filtered.filter((s) => indicator.accessor(s) === null).length,
    [filtered, indicator],
  );

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
            publicOnly={publicOnly}
            onPublicOnlyChange={setPublicOnly}
            indicatorKey={indicatorKey}
            onIndicatorKeyChange={setIndicatorKey}
            resultCount={filtered.length}
          />

          <div className="relative min-h-0 flex-1 p-3">
            <KakaoMap
              schools={filtered}
              indicator={indicator}
              selectedSchoolCode={selected?.schulCode ?? null}
              onSelectSchool={setSelected}
            />

            <div className="pointer-events-none absolute bottom-6 left-6 z-10">
              <IndicatorLegend indicator={indicator} noDataCount={noDataCount} />
            </div>

            <SchoolDetailPanel school={selected} onClose={() => setSelected(null)} />
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
