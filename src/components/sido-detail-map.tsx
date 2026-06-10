'use client';

import { useState } from 'react';
import { SIGUNGU_BY_SIDO } from '@/data/maps/korea-sigungu-paths';
import { cn } from '@/utils/cn';

interface SidoDetailMapProps {
  sidoCode: string;
  selected: string | null;
  onSelect: (sigunguName: string) => void;
}

export function SidoDetailMap({ sidoCode, selected, onSelect }: SidoDetailMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);
  const data = SIGUNGU_BY_SIDO[sidoCode];
  if (!data) return null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev);
  };

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={data.viewBox}
        className="h-full w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {data.regions.map((region) => (
          <g
            key={region.name}
            onClick={() => onSelect(region.name)}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.closest('svg')!.getBoundingClientRect();
              setTooltip({ name: region.name, x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="cursor-pointer"
          >
            <path
              d={region.path}
              className={cn(
                'stroke-white stroke-[1.5] transition-colors',
                selected === region.name ? 'fill-primary' : 'fill-zinc-200 hover:fill-primary-200',
              )}
            />
          </g>
        ))}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  );
}
