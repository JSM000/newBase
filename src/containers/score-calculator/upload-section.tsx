'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParseExcel } from '@/hooks/apis/excel/use-parse-excel';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function UploadSection() {
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate: parseExcel, isPending, error } = useParseExcel();

  const handleFile = (file: File) => {
    setFileError(null);
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setFileError('Excel 파일(.xlsx)만 업로드 가능합니다.');
      return;
    }
    parseExcel(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const errorMessage =
    fileError ?? (error instanceof Error ? error.message : null);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between bg-primary px-6 py-4 text-white shadow">
        <div>
          <h1 className="text-xl font-bold">관외전보 점수 계산기</h1>
          <p className="mt-0.5 text-sm text-primary-100">
            청주교육지원청 유치원·초등교사 | 기준일: 2026.2.28. | NEIS 인사기록카드 엑셀 파일
          </p>
        </div>
        <Link href="/" className="text-sm text-primary-100 underline hover:text-white">
          지역 변경
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="rounded-xl bg-white p-8 shadow-custom">
            <h2 className="mb-2 text-xl font-semibold text-zinc-800">
              NEIS 인사기록카드 업로드
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              NEIS에서 엑셀(.xlsx)로 저장한 인사기록카드를 업로드하면
              <br />
              관외이동 점수를 자동으로 계산합니다.
            </p>

            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div
              className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragging
                  ? 'border-primary bg-primary-50'
                  : 'border-zinc-200 hover:border-primary-300 hover:bg-primary-50'
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {isPending ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-zinc-500">파싱 중...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <svg
                    className="h-14 w-14 text-zinc-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-zinc-700">
                      엑셀 파일을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      인사기록카드(.xlsx)
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="mb-1 font-semibold text-amber-800">안내 사항</p>
              <ul className="list-inside list-disc space-y-1 text-amber-700">
                <li>자동 파싱 결과는 반드시 직접 확인이 필요합니다.</li>
                <li>가산점(지역·우대)은 직접 입력해야 합니다.</li>
                <li>최종 점수는 교육지원청 공식 서류로 확인하세요.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
