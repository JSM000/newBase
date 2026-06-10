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
import { cn } from '@/utils/cn';

export function AwardsTab() {
  const parsed = useScoreStore((state) => state.parsed);
  const result = useScoreStore((state) => state.result);

  return (
    <div className="overflow-x-auto">
      {parsed?.awards.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          파싱된 포상 데이터가 없습니다. PDF를 직접 확인하세요.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>포상일</TableHead>
              <TableHead>포상훈격</TableHead>
              <TableHead>포상명</TableHead>
              <TableHead>시행기관</TableHead>
              <TableHead className="text-right">점수</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result?.awardDetails.map((d, i) => (
              <TableRow key={i} className={cn(!d.used && 'opacity-50')}>
                <TableCell className="whitespace-nowrap">{d.award.date}</TableCell>
                <TableCell>{d.award.grade}</TableCell>
                <TableCell className="text-xs text-slate-600">{d.award.name}</TableCell>
                <TableCell className="text-xs text-slate-600">{d.award.agency}</TableCell>
                <TableCell className="text-right font-mono">
                  {d.used ? (
                    <span className="font-semibold text-green-700">{d.score}</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
