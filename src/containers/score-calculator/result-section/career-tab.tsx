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
              <TableHead>기간</TableHead>
              <TableHead>임용구분</TableHead>
              <TableHead>학교</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed?.career.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap">
                  {c.startDate} ~ {c.endDate ?? '현재'}
                </TableCell>
                <TableCell>{c.appointmentType}</TableCell>
                <TableCell>{c.school}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RawSection text={parsed?.rawSections['경력']} />
    </div>
  );
}
