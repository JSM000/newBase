'use client';

import { useScoreStore } from '@/store/use-score-store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RawSection } from '@/components/raw-section';
import { cn } from '@/utils/cn';

export function ResearchTab() {
  const parsed = useScoreStore((state) => state.parsed);
  const result = useScoreStore((state) => state.result);

  return (
    <div>
      {parsed?.research.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          파싱된 연구실적 데이터가 없습니다.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>연구주제</TableHead>
              <TableHead>등급</TableHead>
              <TableHead>수상일</TableHead>
              <TableHead>연구자수</TableHead>
              <TableHead className="text-right">점수</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result?.researchDetails.map((d, i) => (
              <TableRow key={i} className={cn(!d.used && 'opacity-50')}>
                <TableCell className="text-xs">
                  {d.research.title || '(제목 미파싱)'}
                </TableCell>
                <TableCell>
                  {d.research.levelType === 'national' ? '전국' : '도규모'}{' '}
                  {d.research.grade}등급
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {d.research.awardDate}
                </TableCell>
                <TableCell>{d.research.researcherCount}인</TableCell>
                <TableCell className="text-right font-mono">
                  {d.used ? (
                    <span className="font-semibold text-green-700">
                      {d.finalScore}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RawSection text={parsed?.rawSections['연구실적']} />
    </div>
  );
}
