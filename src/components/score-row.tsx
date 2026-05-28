import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/utils/cn';

interface ScoreRowProps {
  label: string;
  score: number;
  color: 'zinc' | 'green' | 'secondary';
  detail: string;
}

const colorMap = {
  zinc:      'text-zinc-700',
  green:     'text-green-600',
  secondary: 'text-secondary',
} as const;

export function ScoreRow({ label, score, color, detail }: ScoreRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-zinc-700">{label}</TableCell>
      <TableCell
        className={cn('text-right font-mono font-semibold', colorMap[color])}
      >
        {score > 0 ? score.toFixed(3) : '0.000'}
      </TableCell>
      <TableCell className="text-xs text-zinc-400">{detail}</TableCell>
    </TableRow>
  );
}
