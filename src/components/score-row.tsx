import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/utils/cn';

interface ScoreRowProps {
  label: string;
  score: number;
  color: 'zinc' | 'green' | 'secondary';
  detail: string;
  onPdf?: () => void;
}

const colorMap = {
  zinc:      'text-zinc-700',
  green:     'text-green-600',
  secondary: 'text-secondary',
} as const;

export function ScoreRow({ label, score, color, detail, onPdf }: ScoreRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-zinc-700">{label}</TableCell>
      <TableCell
        className={cn('text-right font-mono font-semibold', colorMap[color])}
      >
        {score > 0 ? score.toFixed(3) : '0.000'}
      </TableCell>
      <TableCell className="text-xs text-zinc-400">{detail}</TableCell>
      <TableCell className="w-20 text-center">
        {onPdf && (
          <button
            onClick={onPdf}
            title="근거 공문 보기"
            className="inline-flex items-center justify-center rounded-md border border-primary-200 bg-primary-50 p-1.5 text-primary transition-colors hover:bg-primary-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}
