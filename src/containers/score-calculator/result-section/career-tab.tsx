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

export function CareerTab() {
  const parsed = useScoreStore((state) => state.parsed);

  return (
    <div className="overflow-x-auto">
      {parsed?.career.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          파싱된 경력 데이터가 없습니다. PDF를 직접 확인하세요.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-center text-xs">#</TableHead>
              <TableHead>기간</TableHead>
              <TableHead className="whitespace-nowrap">임용구분</TableHead>
              <TableHead className="whitespace-nowrap">학교</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed?.career.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-center text-xs text-slate-400">{i + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.startDate} ~ {c.endDate ?? '현재'}
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.appointmentType}</TableCell>
                <TableCell className="whitespace-nowrap">{c.school}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
