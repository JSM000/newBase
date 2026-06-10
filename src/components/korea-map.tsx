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
  const [pending, setPending] = useState<{ code: string; name: string } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev);
  };

  const handleTouchEnd = (e: React.TouchEvent, code: string, name: string) => {
    e.preventDefault();
    if (pending?.code === code) {
      onSelect(code, name);
      setPending(null);
    } else {
      setPending({ code, name });
    }
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
            onTouchEnd={(e) => handleTouchEnd(e, sido.code, sido.name)}
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
                selected === sido.code
                  ? 'fill-primary'
                  : pending?.code === sido.code
                    ? 'fill-primary-300'
                    : 'fill-zinc-200 hover:fill-primary-200',
              )}
            />
          </g>
        ))}
      </svg>

      {/* 마우스 툴팁 */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          {tooltip.name}
        </div>
      )}

      {/* 출처 */}
      <p className="absolute bottom-1 right-2 text-[10px] text-zinc-300 pointer-events-none select-none">
        © 통계청 SGIS
      </p>

      {/* 터치 확인 바 */}
      {pending && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <span className="font-medium text-zinc-800">{pending.name}</span>
          <button
            onClick={() => { onSelect(pending.code, pending.name); setPending(null); }}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white"
          >
            선택
          </button>
        </div>
      )}
    </div>
  );
}
