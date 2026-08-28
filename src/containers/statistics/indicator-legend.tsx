'use client';

import {
  type Indicator,
  BUCKET_COLORS,
  NO_DATA_COLOR,
  bucketLabels,
} from '@/lib/school-indicators';

interface IndicatorLegendProps {
  indicator: Indicator;
  /** 현재 지도에 보이는 학교 중 자료 없음(null) 개수 */
  noDataCount: number;
}

export function IndicatorLegend({ indicator, noDataCount }: IndicatorLegendProps) {
  const labels = bucketLabels(indicator);

  return (
    <div className="pointer-events-auto w-56 rounded-xl bg-white/95 p-3 shadow-custom backdrop-blur">
      <p className="text-xs font-semibold text-zinc-700">
        {indicator.label}
        {indicator.unit ? ` (${indicator.unit})` : ''}
      </p>
      {indicator.estimated && (
        <p className="mt-0.5 text-[11px] font-medium text-amber-600">※ 추정치</p>
      )}

      <ul className="mt-2 space-y-1">
        {labels.map((label, i) => (
          <li key={label} className="flex items-center gap-2 text-[11px] text-zinc-600">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: BUCKET_COLORS[i] }}
            />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: NO_DATA_COLOR }}
          />
          자료 없음{noDataCount > 0 ? ` (${noDataCount})` : ''}
        </li>
      </ul>

      <p className="mt-2 border-t border-zinc-100 pt-2 text-[10px] leading-snug text-zinc-400">
        {indicator.description}
      </p>
    </div>
  );
}
