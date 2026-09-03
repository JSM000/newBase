'use client';

import {
  SCHOOL_LEVEL_OPTIONS,
  OWNERSHIP_OPTIONS,
  type SchoolLevelFilter,
  type OwnershipFilter,
} from '@/lib/school-region';
import { INDICATORS } from '@/lib/school-indicators';

interface SchoolFilterBarProps {
  level: SchoolLevelFilter;
  onLevelChange: (v: SchoolLevelFilter) => void;
  sigungu: string;
  onSigunguChange: (v: string) => void;
  sigunguOptions: string[];
  search: string;
  onSearchChange: (v: string) => void;
  ownership: OwnershipFilter;
  onOwnershipChange: (v: OwnershipFilter) => void;
  indicatorKey: string;
  onIndicatorKeyChange: (v: string) => void;
  resultCount: number;
  onShowRanking: () => void;
}

const selectClass =
  'h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-700 focus:border-primary focus:outline-none';

/** 모든 필터 항목에 동일하게 붙이는 캡션 — 항목마다 라벨이 있었다 없었다 하던 걸 통일. */
const captionClass = 'text-[11px] font-medium uppercase tracking-wide text-zinc-400';

/** 캡션 + 컨트롤을 세로로 묶는 한 항목. 필터 바 전체가 이 단위로 일관되게 구성됨. */
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={captionClass}>{label}</span>
      {children}
    </div>
  );
}

export function SchoolFilterBar({
  level,
  onLevelChange,
  sigungu,
  onSigunguChange,
  sigunguOptions,
  search,
  onSearchChange,
  ownership,
  onOwnershipChange,
  indicatorKey,
  onIndicatorKeyChange,
  resultCount,
  onShowRanking,
}: SchoolFilterBarProps) {
  const scoreIndicators = INDICATORS.filter((i) => i.category === 'score');
  const workIndicators = INDICATORS.filter((i) => i.category === 'work');

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-zinc-100 bg-white px-4 py-3">
      {/* ── 그룹 1: 필터(어떤 학교를 볼지) — 설립구분/학교급/시군, 전부 이 대상을 좁히는 조건.
          전부 같은 드롭다운(select)으로 통일 ── */}
      <FilterField label="설립구분">
        <select
          value={ownership}
          onChange={(e) => onOwnershipChange(e.target.value as OwnershipFilter)}
          className={selectClass}
        >
          {OWNERSHIP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="학교급">
        <select
          value={level}
          onChange={(e) => onLevelChange(e.target.value as SchoolLevelFilter)}
          className={selectClass}
        >
          {SCHOOL_LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="시·군">
        <select
          value={sigungu}
          onChange={(e) => onSigunguChange(e.target.value)}
          className={selectClass}
        >
          <option value="all">전체 시·군</option>
          {sigunguOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FilterField>

      <div className="mb-1 h-9 w-px bg-zinc-200" />

      {/* ── 그룹 2: 표시·순위 기준 — 지도 색칠 + 순위 정렬에 공통으로 쓰이는 지표 하나 ── */}
      <FilterField label="표시·순위 기준">
        <select
          value={indicatorKey}
          onChange={(e) => onIndicatorKeyChange(e.target.value)}
          className={selectClass}
        >
          <optgroup label="전보 점수 참고">
            {scoreIndicators.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
                {i.estimated ? ' (추정)' : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="근무 여건 참고">
            {workIndicators.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
                {i.estimated ? ' (추정)' : ''}
              </option>
            ))}
          </optgroup>
        </select>
      </FilterField>

      <div className="mb-1 h-9 w-px bg-zinc-200" />

      {/* ── 그룹 3: 액션 — 필터/기준을 적용해서 실행하는 동작 ── */}
      <button
        type="button"
        onClick={onShowRanking}
        className="h-9 rounded-lg border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
      >
        순위 보기
      </button>

      {/* 학교명 검색 — 다른 필터와 성격이 달라(자유 텍스트) 가장 오른쪽에 별도 배치 */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="학교명 검색"
        className="ml-auto h-9 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
      />

      <span className="self-center text-sm text-zinc-400">{resultCount}개 학교</span>
    </div>
  );
}
