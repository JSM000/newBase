'use client';

import React from 'react';
import { useScoreStore } from '@/store/use-score-store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/utils/cn';
function fmtMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function getSchoolYear(endDate: string): number {
  const parts = endDate.split('-');
  const year = parseInt(parts[0] ?? '0', 10);
  const month = parseInt(parts[1] ?? '0', 10);
  return month >= 3 ? year : year - 1;
}

export function TrainingTab() {
  const parsed = useScoreStore((state) => state.parsed);
  const result = useScoreStore((state) => state.result);

  const training = parsed?.training ?? [];

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-xs text-slate-500">
        직무연수 + 직무연관성 Y 항목만 점수에 반영됩니다. 파싱 정확도가 낮을 수
        있으니 원본 PDF와 대조하세요.
      </p>

      {/* 학년도별 요약 카드 */}
      {result && result.trainingByYear.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-zinc-700">
            직무연수 학년도별 상세
          </p>
          <div className="grid grid-cols-5 gap-2">
            {result.trainingByYear.map((y) => (
              <div
                key={y.schoolYear}
                className={cn(
                  'rounded-lg border p-3 text-center text-sm',
                  y.qualifies
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-400',
                )}
              >
                <p className="font-semibold">{y.schoolYear}학년도</p>
                <p className="mt-1 text-xs">
                  {Math.floor(y.totalMinutes / 60)}시간
                </p>
                <p className="mt-1 font-bold">
                  {y.qualifies ? '+0.5점' : '미충족'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {training.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          파싱된 연수 데이터가 없습니다.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-center text-xs">#</TableHead>
              <TableHead className="min-w-[200px]">연수과정명</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>직무연관</TableHead>
              <TableHead className="text-right">시간</TableHead>
              <TableHead className="text-right">연도 누계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const rows: React.ReactNode[] = [];
              let prevSy: number | null = null;
              training.forEach((t, i) => {
                const isQualifying = t.type === '직무연수' && t.workRelated;
                const sy = getSchoolYear(t.endDate);
                if (sy !== prevSy) {
                  rows.push(
                    <TableRow key={`year-${sy}-${i}`} className="pointer-events-none">
                      <TableCell colSpan={7} className="bg-slate-100 py-1 text-center text-xs font-semibold text-slate-500">
                        {sy}학년도
                      </TableCell>
                    </TableRow>
                  );
                  prevSy = sy;
                }
                rows.push(
                  <TableRow key={i} className={cn(!isQualifying && 'opacity-40')}>
                    <TableCell className="text-center text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="line-clamp-2 text-xs leading-snug" title={t.name}>
                        {t.name}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {t.startDate} ~ {t.endDate}
                    </TableCell>
                    <TableCell className="text-xs">{t.type}</TableCell>
                    <TableCell>{t.workRelated ? 'Y' : 'N'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {fmtMinutes(t.durationMinutes)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-500">
                      {t.yearCumulative !== undefined ? fmtMinutes(t.yearCumulative) : '-'}
                    </TableCell>
                  </TableRow>
                );
              });
              return rows;
            })()}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
