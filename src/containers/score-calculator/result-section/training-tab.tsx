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

export function TrainingTab() {
  const parsed = useScoreStore((state) => state.parsed);

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-xs text-slate-500">
        직무연수 + 직무연관성 Y 항목만 점수에 반영됩니다. 파싱 정확도가 낮을 수
        있으니 원본 PDF와 대조하세요.
      </p>
      {parsed?.training.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          파싱된 연수 데이터가 없습니다.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>기간</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>직무연관</TableHead>
              <TableHead className="text-right">시간</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed?.training.map((t, i) => (
              <TableRow
                key={i}
                className={cn(
                  !(t.type === '직무연수' && t.workRelated) && 'opacity-40',
                )}
              >
                <TableCell className="whitespace-nowrap text-xs">
                  {t.startDate} ~ {t.endDate}
                </TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>{t.workRelated ? 'Y' : 'N'}</TableCell>
                <TableCell className="text-right font-mono">
                  {Math.floor(t.durationMinutes / 60)}시간
                  {t.durationMinutes % 60 > 0
                    ? `${t.durationMinutes % 60}분`
                    : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
