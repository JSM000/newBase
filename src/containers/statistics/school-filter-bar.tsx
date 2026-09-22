'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  SCHOOL_LEVEL_OPTIONS,
  OWNERSHIP_OPTIONS,
  schulKndLabel,
  type SchoolLevelFilter,
  type OwnershipFilter,
} from '@/lib/school-region';
import { INDICATORS, SOCIAL_INDICATOR_LIST } from '@/lib/school-indicators';
import type { GeocodeCandidate } from '@/types/commute';
import type { SchulKndCode } from '@/types/school-stats';

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
   * 바뀜). 사이드바를 실제로 여는 건 "학교 순위"/"검색" 버튼.
   */
  view: StatsView;
  onViewChange: (v: StatsView) => void;
  /** "학교 순위" 탭에서 노출되는 버튼 — 눌러야 사이드바가 열리고 순위 결과가 보인다 */
  onShowRanking: () => void;

  /**
   * ── "출퇴근 시간 계산기" 탭 — 지도 길찾기 서비스처럼 출발지(집주소)/도착지(시·군·학교급)를
   * 각각 팝업에서 고르고, 둘 다 갖춰지면 "출퇴근 시간 계산" 버튼으로 실행한다.
   */
  /** 출발지 확정 상태 — 없으면 "출발지 입력" 플레이스홀더, 있으면 이 라벨을 보여준다 */
  originLabel: string | null;
  addressValue: string;
  onAddressChange: (v: string) => void;
  /** 출발지 팝업의 "검색" 버튼 — 주소 → 후보 목록 조회만 한다(길찾기 실행은 onConfirmSearch) */
  onAddressSearch: () => void;
  addressSearching: boolean;
  addressCooling: boolean;
  addressCooldownSec: number;
  geocodeErrorMsg: string | null;
  /** 검색된 주소 후보 — 출발지 팝업에서 고르면 onPickCandidate 호출 후 팝업이 닫힌다 */
  candidates: GeocodeCandidate[] | null;
  onPickCandidate: (c: GeocodeCandidate) => void;
  /** 저장된 집 좌표가 있을 때만 전달 — 있으면 출발지 팝업에 "저장된 집 위치 사용" 버튼 노출 */
  onUseSavedHome?: () => void;
  /** 도착지(시·군·학교급) 확정 상태 — 없으면 "도착지 입력" 플레이스홀더 */
  destinationReady: boolean;
  /** 길찾기 실행 중(재계산 포함) — 버튼에 "계산 중…" 표시 + 비활성화 */
  isRanking: boolean;
  /** "출퇴근 시간 계산" 버튼 — 출발지·도착지 둘 다 갖춰졌는지는 필터 바가 먼저 확인하고 부른다 */
  onConfirmSearch: () => void;

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

/** "계산하기" 버튼(학교 순위/출퇴근 시간 계산기 공용) — 두 탭에서 모양·색이 같아야 해서 공유. */
const calcButtonClass =
  'ml-auto h-9 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50';

/**
 * 크롬 브라우저 탭처럼, 선택된 탭이 바로 아래 콘텐츠(흰 배경)와 하나로 이어져 보이도록.
 * 비활성 탭은 회색(bg-zinc-100)으로 떠 있고, 활성 탭은 흰 배경 + `-mb-px`로 아래쪽
 * 경계선(TabsList가 앉아 있는 줄의 border-b)을 그 폭만큼 덮어서 경계가 끊겨 보이게 한다.
 * 기본 rounded-sm(전체 모서리)을 rounded-none으로 먼저 지우고 rounded-t-lg만 새로 준다 —
 * 순서가 반대면(rounded-t-lg 먼저) tailwind-merge가 rounded-sm과 같은 그룹으로 안 묶어서
 * 남겨두는 rounded-sm이 나중에 이길 수 있음.
 */
const tabTriggerClass =
  'relative rounded-none rounded-t-lg border border-b-0 border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500 shadow-none transition-colors hover:bg-zinc-200/70 data-[state=active]:z-10 data-[state=active]:-mb-px data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-none data-[state=active]:hover:bg-white';

/** 캡션 + 컨트롤을 세로로 묶는 한 항목. 필터 바 전체가 이 단위로 일관되게 구성됨. */
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={captionClass}>{label}</span>
      {children}
    </div>
  );
}

/**
 * 설립구분/학교급/시·군 — 학교 순위 탭에선 "필터"로, 출퇴근 탭에선 "도착지 조건"으로
 * 같은 select 3개를 두 곳에서 재사용한다(학교 순위 탭 레이아웃은 안 바뀜).
 */
function SchoolScopeFields({
  ownership,
  onOwnershipChange,
  level,
  onLevelChange,
  sigungu,
  onSigunguChange,
  sigunguOptions,
}: {
  ownership: OwnershipFilter;
  onOwnershipChange: (v: OwnershipFilter) => void;
  level: SchoolLevelFilter;
  onLevelChange: (v: SchoolLevelFilter) => void;
  sigungu: string;
  onSigunguChange: (v: string) => void;
  sigunguOptions: string[];
}) {
  return (
    <>
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
    </>
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
  originLabel,
  addressValue,
  onAddressChange,
  onAddressSearch,
  addressSearching,
  addressCooling,
  addressCooldownSec,
  geocodeErrorMsg,
  candidates,
  onPickCandidate,
  onUseSavedHome,
  destinationReady,
  isRanking,
  onConfirmSearch,
  collapsed,
  onToggleCollapsed,
  showAllMarkers,
  onShowAllMarkersChange,
  showBoundaries,
  onShowBoundariesChange,
}: SchoolFilterBarProps) {
  const scoreIndicators = INDICATORS.filter((i) => i.category === 'score');
  const workIndicators = INDICATORS.filter((i) => i.category === 'work');
  const [originDialogOpen, setOriginDialogOpen] = useState(false);
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);

  const destinationSummary = destinationReady
    ? `${sigungu} · ${schulKndLabel(level as SchulKndCode)}${ownership === 'all' ? '' : ` · ${ownership}`}`
    : null;

  function handleConfirmSearch() {
    if (!originLabel) {
      window.alert('출발지를 먼저 선택해주세요.');
      return;
    }
    if (!destinationReady) {
      window.alert('도착지 조건(시·군, 학교급)을 먼저 선택해주세요.');
      return;
    }
    onConfirmSearch();
  }

  // 접힌 상태 — 지도 위에 얇은 알약 형태로만 떠 있고, 누르면 펼쳐진다.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 px-4 py-2 text-sm font-medium text-zinc-700 shadow-custom backdrop-blur hover:bg-white"
      >
        <ChevronDown className="h-4 w-4 text-zinc-400" />
        {view === 'ranking' ? '학교 순위' : '출퇴근 시간 계산기'}
        <span className="text-zinc-400">· {resultCount}개 학교</span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-custom">
      {/* ── 가장 위 줄: 학교 순위 / 출퇴근 시간 계산 전환 탭 — 같은 필터 바가 두 기능을 같이
          다뤄서 헷갈린다는 피드백에 따라, 지금 뭘 보고 있는지 먼저 명확히 고르게 한다 ── */}
      <div className="flex items-start justify-between border-b border-zinc-200 px-4 pt-3">
        <div className="flex items-end gap-3">
          <Tabs value={view} onValueChange={(v) => onViewChange(v as StatsView)}>
            <TabsList className="h-auto items-end gap-1 rounded-none border-0 bg-transparent p-0">
              <TabsTrigger value="ranking" className={tabTriggerClass}>
                학교 순위
              </TabsTrigger>
              <TabsTrigger value="commute" className={tabTriggerClass}>
                출퇴근 시간 계산기
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="pb-2 text-sm text-zinc-400">{resultCount}개 학교</span>
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

      {/* 두 탭 콘텐츠를 같은 grid 셀에 같이 두고 한쪽만 visibility로 감춘다 — 세로 길이가 더 긴
          "학교 순위" 탭 기준으로 grid 행 높이가 자동으로 고정돼서, 탭을 바꿔도(콘텐츠가 짧은
          "출퇴근 시간 계산기" 탭으로 가도) 필터 바 전체 높이가 흔들리지 않는다. */}
      <div className="grid">
        <div
          aria-hidden={view !== 'ranking'}
          className={`col-start-1 row-start-1 flex flex-col gap-3 self-start px-4 py-3 ${
            view === 'ranking' ? '' : 'invisible pointer-events-none'
          }`}
        >
          {/* ── 필터(어떤 학교를 볼지) — 설립구분/학교급/시군, 전부 이 대상을 좁히는 조건 ── */}
          <div className="flex flex-wrap items-end gap-3">
            <SchoolScopeFields
              ownership={ownership}
              onOwnershipChange={onOwnershipChange}
              level={level}
              onLevelChange={onLevelChange}
              sigungu={sigungu}
              onSigunguChange={onSigunguChange}
              sigunguOptions={sigunguOptions}
            />
          </div>

          {/* ── 표시·순위 기준 + "학교 순위" 버튼 — 위 필터 줄과 구분되도록 아래 줄로 ── */}
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="표시·순위 기준">
              <select
                value={indicatorKey}
                onChange={(e) => onIndicatorKeyChange(e.target.value)}
                className={selectClass}
              >
                <optgroup label="학교 지표">
                  {INDICATORS.map((i) => (
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

            <button type="button" onClick={onShowRanking} className={calcButtonClass}>
              확인하기
            </button>
          </div>
        </div>

        {/* ── 출퇴근 시간 계산기: 일반 지도 길찾기 서비스처럼 출발지/도착지를 각각 팝업에서
            고르고 정리된 텍스트만 이 줄에 보여준다("최대한 간결했으면 좋겠다"는 요청) ── */}
        <div
          aria-hidden={view !== 'commute'}
          className={`col-start-1 row-start-1 flex items-end gap-2 self-start px-4 py-3 ${
            view === 'commute' ? '' : 'invisible pointer-events-none'
          }`}
        >
          <div className="flex w-72 max-w-full flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className={captionClass}>집주소로 검색</span>
              <button
                type="button"
                onClick={() => setOriginDialogOpen(true)}
                className="flex h-9 w-full items-center rounded-lg border border-zinc-200 px-3 text-left text-sm hover:bg-zinc-50"
              >
                <span className={`truncate ${originLabel ? 'text-zinc-800' : 'text-zinc-400'}`}>
                  {originLabel ?? '출발지 입력'}
                </span>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className={captionClass}>학교 조건으로 검색</span>
              <button
                type="button"
                onClick={() => setDestinationDialogOpen(true)}
                className="flex h-9 w-full items-center rounded-lg border border-zinc-200 px-3 text-left text-sm hover:bg-zinc-50"
              >
                <span className={`truncate ${destinationSummary ? 'text-zinc-800' : 'text-zinc-400'}`}>
                  {destinationSummary ?? '도착지 입력'}
                </span>
              </button>
            </div>
          </div>

          {/* 도착지 입력 줄과 나란한 높이(items-end)로, 카드 오른쪽 벽면에 붙도록 ml-auto */}
          <button
            type="button"
            onClick={handleConfirmSearch}
            disabled={isRanking}
            className={calcButtonClass}
          >
            {isRanking ? '계산 중…' : '계산하기'}
          </button>

          {/* 출발지 팝업 — 주소 검색 + 후보 5개 중 선택(예전 사이드바에 있던 흐름 그대로) */}
          <Dialog open={originDialogOpen} onOpenChange={setOriginDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>출발지 검색</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!addressValue.trim()) {
                    window.alert('집주소를 입력해주세요.');
                    return;
                  }
                  onAddressSearch();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={addressValue}
                  onChange={(e) => onAddressChange(e.target.value)}
                  placeholder="도로명 주소 (지번·건물명도 가능)"
                  className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
                  autoComplete="street-address"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={addressCooling || addressSearching}
                  className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {addressSearching ? '검색 중' : addressCooling ? `${addressCooldownSec}초` : '검색'}
                </button>
              </form>

              {onUseSavedHome && (
                <button
                  type="button"
                  onClick={() => {
                    onUseSavedHome();
                    setOriginDialogOpen(false);
                  }}
                  className="self-start text-xs font-semibold text-primary hover:underline"
                >
                  저장된 집 위치 사용
                </button>
              )}

              {geocodeErrorMsg && <p className="text-xs text-red-600">{geocodeErrorMsg}</p>}

              {candidates &&
                (candidates.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    검색 결과가 없습니다. 다른 주소로 다시 검색해 주세요.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-100">
                    {candidates.map((c, i) => (
                      <button
                        key={`${c.lat},${c.lng},${i}`}
                        type="button"
                        onClick={() => {
                          onPickCandidate(c);
                          setOriginDialogOpen(false);
                        }}
                        className="flex w-full flex-col items-start gap-1 border-b border-zinc-50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-zinc-50"
                      >
                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {c.label}
                        </span>
                        {c.roadAddress && c.roadAddress !== c.label && (
                          <span className="block truncate text-xs text-zinc-400">
                            {c.roadAddress}
                          </span>
                        )}
                        {c.addressType === 'REGION' && (
                          <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            동·읍·면 단위 근사치 — 정확한 지번을 아신다면 다시 입력해 보세요
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
            </DialogContent>
          </Dialog>

          {/* 도착지 팝업 — 설립구분/학교급/시·군은 지도·순위와 공유하는 전역 필터라 팝업 안에서도
              바로 반영된다(임시로 담아뒀다 "확인" 누를 때만 적용하는 방식이 아님) */}
          <Dialog open={destinationDialogOpen} onOpenChange={setDestinationDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>도착지 조건</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap items-end gap-3">
                <SchoolScopeFields
                  ownership={ownership}
                  onOwnershipChange={onOwnershipChange}
                  level={level}
                  onLevelChange={onLevelChange}
                  sigungu={sigungu}
                  onSigunguChange={onSigunguChange}
                  sigunguOptions={sigunguOptions}
                />
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setDestinationDialogOpen(false)}
                  className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                >
                  확인
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 지도 컨트롤 — 학교 개별 마커 / 행정구역 경계. 예전엔 지도 위 왼쪽에 따로 떠 있었는데,
          필터 바 안으로 옮겨서 필터 바를 접으면 같이 접히도록 함. 위쪽 탭·필터 영역과 성격이
          달라서(지도 자체를 다루는 설정) 두꺼운 경계선 + 더 진한 회색 배경으로 구분을 확실히 함 */}
      <div className="flex flex-wrap items-center gap-2 border-t-2 border-zinc-300 bg-zinc-100 px-4 py-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700">
          <span className="whitespace-nowrap">학교 개별 마커</span>
          <Switch checked={showAllMarkers} onCheckedChange={onShowAllMarkersChange} />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700">
          <span className="whitespace-nowrap">행정구역 경계</span>
          <Switch checked={showBoundaries} onCheckedChange={onShowBoundariesChange} />
        </div>

        {/* 학교명 검색 — 다른 필터와 성격이 달라(자유 텍스트) 이 줄 가장 오른쪽에 배치 */}
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="학교명 검색"
          className="ml-auto h-9 w-28 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
