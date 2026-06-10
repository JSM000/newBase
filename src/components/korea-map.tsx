'use client';

import { useState } from 'react';
import { SIDO_LIST, KOREA_VIEW_BOX } from '@/data/maps/korea-sido-paths';
import { cn } from '@/utils/cn';

interface KoreaMapProps {
  selected: string | null;
  onSelect: (sidoCode: string, sidoName: string) => void;
}

export function KoreaMap({ selected, onSelect }: KoreaMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev);
  };

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={KOREA_VIEW_BOX}
        className="h-full w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {SIDO_LIST.map((sido) => (
          <g
            key={sido.code}
            onClick={() => onSelect(sido.code, sido.name)}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.closest('svg')!.getBoundingClientRect();
              setTooltip({ name: sido.name, x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="cursor-pointer"
          >
            <path
              d={sido.path}
              className={cn(
                'stroke-white stroke-[1.5] transition-colors',
                selected === sido.code ? 'fill-primary' : 'fill-zinc-200 hover:fill-primary-200',
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
