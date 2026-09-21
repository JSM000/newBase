'use client';

import type { FormEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  SCHOOL_LEVEL_OPTIONS,
  OWNERSHIP_OPTIONS,
  type SchoolLevelFilter,
  type OwnershipFilter,
} from '@/lib/school-region';
import { INDICATORS, SOCIAL_INDICATOR_LIST } from '@/lib/school-indicators';

export type StatsView = 'ranking' | 'commute';

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
  /** 별점·조회수 기능 활성 여부 (Supabase env 설정 시) — 표시·순위 기준에 커뮤니티 항목 추가 */
  socialEnabled?: boolean;
  resultCount: number;
  /**
   * 탭 선택 상태 — 탭을 누르는 것만으로는 사이드바가 열리지 않는다(어떤 필터를 보여줄지만
   * 바뀜). 사이드바를 실제로 여는 건 "순위 보기"/"검색" 버튼.
   */
  view: StatsView;
  onViewChange: (v: StatsView) => void;
  /** "순위 보기" 탭에서 노출되는 버튼 — 눌러야 사이드바가 열리고 순위 결과가 보인다 */
  onShowRanking: () => void;

  /** ── "출퇴근 시간 계산기" 탭에서만 보이는 주소 검색 — 후보 목록·결과는 사이드바에서 확인 ── */
  addressValue: string;
  onAddressChange: (v: string) => void;
  onAddressSubmit: (e: FormEvent) => void;
  addressReady: boolean;
  addressSearching: boolean;
  addressCooling: boolean;
  addressCooldownSec: number;
  /** 저장된 집 좌표가 있을 때만 전달 — 있으면 "저장된 집 위치로 검색" 버튼 노출 */
  onUseSavedHome?: () => void;

  /**
   * 필터 바 전체를 접었다 폈다 — 지도 위쪽에 오버레이로 떠 있어서(사이드바와 같은 방식),
   * 접으면 지도가 화면을 최대한 넓게 차지한다.
   */
  collapsed: boolean;
  onToggleCollapsed: () => void;

  /** ── 지도 컨트롤(학교 개별 마커/행정구역 경계) — 필터 바 안에서 같이 접혔다 펼쳐진다 ── */
  showAllMarkers: boolean;
  onShowAllMarkersChange: (v: boolean) => void;
  showBoundaries: boolean;
  onShowBoundariesChange: (v: boolean) => void;
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
  socialEnabled = false,
  resultCount,
  view,
  onViewChange,
  onShowRanking,
  addressValue,
  onAddressChange,
  onAddressSubmit,
  addressReady,
  addressSearching,
  addressCooling,
  addressCooldownSec,
  onUseSavedHome,
  collapsed,
  onToggleCollapsed,
  showAllMarkers,
  onShowAllMarkersChange,
  showBoundaries,
  onShowBoundariesChange,
}: SchoolFilterBarProps) {
  const scoreIndicators = INDICATORS.filter((i) => i.category === 'score');
  const workIndicators = INDICATORS.filter((i) => i.category === 'work');

  // 접힌 상태 — 지도 위에 얇은 알약 형태로만 떠 있고, 누르면 펼쳐진다.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 px-4 py-2 text-sm font-medium text-zinc-700 shadow-custom backdrop-blur hover:bg-white"
      >
        <ChevronDown className="h-4 w-4 text-zinc-400" />
        {view === 'ranking' ? '순위 보기' : '출퇴근 시간 계산기'}
        <span className="text-zinc-400">· {resultCount}개 학교</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-custom">
      {/* ── 가장 위 줄: 순위 보기 / 출퇴근 시간 계산 전환 탭 — 같은 필터 바가 두 기능을 같이
          다뤄서 헷갈린다는 피드백에 따라, 지금 뭘 보고 있는지 먼저 명확히 고르게 한다 ── */}
      <div className="flex items-start justify-between px-4 pt-3">
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => onViewChange(v as StatsView)}>
            <TabsList>
              <TabsTrigger value="ranking">순위 보기</TabsTrigger>
              <TabsTrigger value="commute">출퇴근 시간 계산기</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-zinc-400">{resultCount}개 학교</span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="필터 바 접기"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
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

        {/* 표시·순위 기준 + "순위 보기" 버튼 — "순위 보기" 탭에서만 보여준다
            ("출퇴근 시간 계산기" 탭에선 소요시간 순으로만 정렬되어 쓸모가 없음) */}
        {view === 'ranking' && (
          <>
            <div className="mb-1 h-9 w-px bg-zinc-200" />
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
                {socialEnabled && (
                  <optgroup label="커뮤니티">
                    {SOCIAL_INDICATOR_LIST.map((i) => (
                      <option key={i.key} value={i.key}>
                        {i.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FilterField>

            <button
              type="button"
              onClick={onShowRanking}
              className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              순위 보기
            </button>
          </>
        )}

        {/* 집주소 검색 — "출퇴근 시간 계산기" 탭에서만 보인다. 검색 후보 목록·결과는
            사이드바(CommutePanel)에서 확인한다 — 여기선 입력·검색 실행만 담당 */}
        {view === 'commute' && (
          <>
            <div className="mb-1 h-9 w-px bg-zinc-200" />
            <div className="flex flex-col gap-1">
              <span className={captionClass}>집주소</span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!addressReady) {
                    window.alert('시·군과 학교급을 먼저 선택해주세요.');
                    return;
                  }
                  if (!addressValue.trim()) {
                    window.alert('집주소를 입력해주세요.');
                    return;
                  }
                  onAddressSubmit(e);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={addressValue}
                  onChange={(e) => onAddressChange(e.target.value)}
                  placeholder="도로명 주소 (지번·건물명도 가능)"
                  className="h-9 w-56 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
                  autoComplete="street-address"
                />
                <button
                  type="submit"
                  disabled={addressCooling || addressSearching}
                  className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {addressSearching ? '검색 중' : addressCooling ? `${addressCooldownSec}초` : '검색'}
                </button>
                {onUseSavedHome && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!addressReady) {
                        window.alert('시·군과 학교급을 먼저 선택해주세요.');
                        return;
                      }
                      onUseSavedHome();
                    }}
                    disabled={addressSearching}
                    className="h-9 shrink-0 rounded-lg border border-primary px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-40"
                  >
                    저장된 집 위치
                  </button>
                )}
              </form>
            </div>
          </>
        )}
      </div>

      {/* 지도 컨트롤 — 학교 개별 마커 / 행정구역 경계. 예전엔 지도 위 왼쪽에 따로 떠 있었는데,
          필터 바 안으로 옮겨서 필터 바를 접으면 같이 접히도록 함 */}
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
          <span className="w-[4.75rem] whitespace-nowrap">학교 개별 마커</span>
          <Switch checked={showAllMarkers} onCheckedChange={onShowAllMarkersChange} />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
          <span className="w-[4.75rem] whitespace-nowrap">행정구역 경계</span>
          <Switch checked={showBoundaries} onCheckedChange={onShowBoundariesChange} />
        </div>

        {/* 학교명 검색 — 다른 필터와 성격이 달라(자유 텍스트) 이 줄 가장 오른쪽에 배치 */}
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="학교명 검색"
          className="ml-auto h-9 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
