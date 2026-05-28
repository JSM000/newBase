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

const SUPPLEMENTARY_TYPE_LABEL: Record<string, string> = {
  subject_class: '교과전담',
  homeroom: '담임교사',
  special_ed: '특수통합학급',
  multigrade: '복식학급',
  other: '기타',
};

export function SupplementaryTab() {
  const parsed = useScoreStore((state) => state.parsed);

  return (
    <div>
      {parsed?.supplementary.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          파싱된 보충기재가 없습니다.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>내용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed?.supplementary.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap">
                  {SUPPLEMENTARY_TYPE_LABEL[s.type] ?? s.type}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {s.startDate} ~ {s.endDate}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {s.detail}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RawSection text={parsed?.rawSections['보충기재']} />
    </div>
  );
}
