'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface PdfViewerSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  page?: number;
}

export function PdfViewerSheet({ open, onClose, title, page }: PdfViewerSheetProps) {
  const src = `/docs/인사계획.pdf${page ? `#page=${page}` : ''}`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle className="text-sm font-semibold text-zinc-700">
            근거 공문 — {title}
          </SheetTitle>
          <p className="text-xs text-zinc-400">
            2026. 3. 1.자 초등교육공무원 인사 계획(청주)
            {page ? ` · p.${page}` : ''}
          </p>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <iframe
            key={src}
            src={src}
            className="h-full w-full border-0"
            title="인사계획 공문"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
