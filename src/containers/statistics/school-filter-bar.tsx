'use client';

import { cn } from '@/utils/cn';
import { SCHOOL_LEVEL_OPTIONS, type SchoolLevelFilter } from '@/lib/school-region';
import { INDICATORS } from '@/lib/school-indicators';

interface SchoolFilterBarProps {
  level: SchoolLevelFilter;
  onLevelChange: (v: SchoolLevelFilter) => void;
  sigungu: string;
  onSigunguChange: (v: string) => void;
  sigunguOptions: string[];
  search: string;
  onSearchChange: (v: string) => void;
  publicOnly: boolean;
  onPublicOnlyChange: (v: boolean) => void;
  indicatorKey: string;
  onIndicatorKeyChange: (v: string) => void;
  resultCount: number;
}

const selectClass =
  'h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-700 focus:border-primary focus:outline-none';

export function SchoolFilterBar({
  level,
  onLevelChange,
  sigungu,
  onSigunguChange,
  sigunguOptions,
  search,
  onSearchChange,
  publicOnly,
  onPublicOnlyChange,
  indicatorKey,
  onIndicatorKeyChange,
  resultCount,
}: SchoolFilterBarProps) {
  const scoreIndicators = INDICATORS.filter((i) => i.category === 'score');
  const workIndicators = INDICATORS.filter((i) => i.category === 'work');

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-white px-4 py-3">
      {/* 학교급 chip */}
      <div className="flex rounded-lg border border-zinc-200 p-0.5">
        {SCHOOL_LEVEL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onLevelChange(opt.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm transition-colors',
              level === opt.value
                ? 'bg-primary text-white'
                : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 시·군 */}
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

      {/* 학교명 검색 */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="학교명 검색"
        className="h-9 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
      />

      {/* 공립만 */}
      <label className="flex items-center gap-1.5 text-sm text-zinc-600">
        <input
          type="checkbox"
          checked={publicOnly}
          onChange={(e) => onPublicOnlyChange(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        공립만
      </label>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      {/* 표시 지표 */}
      <label className="text-sm font-medium text-zinc-600">표시 지표</label>
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

      <span className="ml-auto text-sm text-zinc-400">{resultCount}개 학교</span>
    </div>
  );
}
