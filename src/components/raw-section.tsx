'use client';

import { useState } from 'react';

interface RawSectionProps {
  text?: string;
}

export function RawSection({ text }: RawSectionProps) {
  const [open, setOpen] = useState(false);

  if (!text) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-slate-400 underline"
      >
        {open ? '원본 텍스트 숨기기' : '원본 파싱 텍스트 보기 (확인용)'}
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-x-auto whitespace-pre-wrap rounded bg-slate-100 p-3 text-xs text-slate-600">
          {text}
        </pre>
      )}
    </div>
  );
}
