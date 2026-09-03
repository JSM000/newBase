'use client';

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

  return (
    <div className="pointer-events-auto w-60 rounded-xl bg-white/95 p-3 shadow-custom backdrop-blur">
      <p className="text-xs font-semibold text-zinc-700">
        {indicator.label}
        {indicator.unit ? ` (${indicator.unit})` : ''}
      </p>
      {indicator.estimated && (
        <p className="mt-0.5 text-[11px] font-medium text-amber-600">※ 추정치</p>
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
  );
}
