'use client';

import { useEffect, useState } from 'react';
import {
  type Indicator,
  BUCKET_COLORS,
  NO_DATA_COLOR,
  bucketLabels,
} from '@/lib/school-indicators';
import { BUCKET_SCALE } from '@/components/kakao-map/marker-image';

interface IndicatorLegendProps {
  indicator: Indicator;
  /** 현재 지도에 보이는 학교 중 자료 없음(null) 개수 */
  noDataCount: number;
}

/** 범례 마커 미리보기 점 지름(px) — 지도 핀 배율(BUCKET_SCALE)과 같은 비율. */
const DOT_BASE_PX = 15;
/** 미리보기·색 띠·라벨 한 줄 높이(px). 가장 큰 점(약 24px)이 들어가야 함. */
const ROW_PX = 28;

export function IndicatorLegend({ indicator, noDataCount }: IndicatorLegendProps) {
  const labels = bucketLabels(indicator);

  // 모바일에선 범례가 지도를 다 가려서, 좁은 화면은 접힌 상태로 시작하고 탭하면 펼친다.
  // SSR·클라이언트 첫 렌더는 항상 접힘(hydration 일치) → 효과에서 데스크톱이면 펼침.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(min-width: 640px)').matches) setOpen(true);
  }, []);

  return (
    <div className="pointer-events-auto w-56 max-w-[calc(100vw-1.5rem)] rounded-xl bg-white/95 shadow-custom backdrop-blur sm:w-60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex-1 text-xs font-semibold text-zinc-700">
          {indicator.label}
          {indicator.unit ? ` (${indicator.unit})` : ''}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? '' : 'rotate-180'}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 12l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {indicator.estimated && (
            <p className="text-[11px] font-medium text-amber-600">※ 추정치</p>
          )}

          {/* 지도 마커 미리보기(색 + 크기) · 색 띠 · 라벨.
              색만으론 5단계 구분이 약해 크기도 함께 커진다. 색 띠는 인접 단계 비교용. */}
          <div className="mt-2 flex gap-2">
            <div className="flex w-7 shrink-0 flex-col">
              {BUCKET_COLORS.map((color, i) => {
                const d = DOT_BASE_PX * BUCKET_SCALE[i];
                return (
                  <span
                    key={i}
                    className="flex items-center justify-center"
                    style={{ height: ROW_PX }}
                  >
                    <span
                      className="shrink-0 rounded-full border-2 border-white shadow-sm"
                      style={{ width: d, height: d, backgroundColor: color }}
                    />
                  </span>
                );
              })}
            </div>
            <div className="flex w-3 shrink-0 flex-col overflow-hidden rounded-md ring-1 ring-black/5">
              {BUCKET_COLORS.map((color, i) => (
                <span key={i} style={{ height: ROW_PX, backgroundColor: color }} />
              ))}
            </div>
            <ul className="flex flex-1 flex-col text-[11px] text-zinc-600">
              {labels.map((label) => (
                <li
                  key={label}
                  className="flex items-center leading-none"
                  style={{ height: ROW_PX }}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: NO_DATA_COLOR }}
            />
            자료 없음{noDataCount > 0 ? ` (${noDataCount})` : ''}
          </div>

          <p className="mt-2 border-t border-zinc-100 pt-2 text-[10px] leading-snug text-zinc-400">
            {indicator.description}
          </p>
        </div>
      )}
    </div>
  );
}
