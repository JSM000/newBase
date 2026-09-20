'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { parseExcelFile } from '@/lib/excel-parser';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { formatDateTime } from '@/utils/formatter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ParsedFile } from '@/types/score';

interface ExcelDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 계산기에서 열 때만 넘긴다 — 있으면 "계산기 모드"(파싱 성공 시 저장하지 않고 곧바로
   * 이 콜백으로 넘겨 계산까지 이어가고 모달을 닫음, 기존 "이 기기에 저장" 버튼을 통해서만
   * 나중에 저장할지 opt-in 결정). 없으면 "설정 모드"(파싱 성공 시 바로 로컬에 저장하고,
   * 저장된 데이터 상태·삭제 UI도 같이 보여줌).
   */
  onParsed?: (parsed: ParsedFile) => void;
}

/**
 * NEIS 인사기록카드 엑셀 파일을 다루는 모든 코드가 모이는 단일 지점.
 * 계산기(upload-section.tsx)와 설정 페이지(settings-container.tsx) 양쪽에서 이 모달 하나를
 * 열어 쓴다 — 파일 검증·드래그앤드롭·파싱(parseExcelFile)·저장(saveParsedFile)·삭제가
 * 전부 여기 안에 있고, 바깥에는 "무엇을 할지"(계산 or 그냥 저장)만 남는다.
 * (계획: _refs/개인정보_로컬설정_구현계획/05_엑셀파일.md)
 */
export function ExcelDataDialog({ open, onOpenChange, onParsed }: ExcelDataDialogProps) {
  const savedParsedFile = useUserSettingsStore((s) => s.savedParsedFile);
  const saveParsedFile = useUserSettingsStore((s) => s.saveParsedFile);
  const clearParsedFile = useUserSettingsStore((s) => s.clearParsedFile);

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseExcel = useMutation({
    mutationFn: parseExcelFile,
    onSuccess: (parsed) => {
      if (onParsed) {
        onParsed(parsed);
        onOpenChange(false);
      } else {
        saveParsedFile(parsed);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      setFileError(null);
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setFileError('Excel 파일(.xlsx)만 업로드 가능합니다.');
        return;
      }
      parseExcel.mutate(file);
    },
    [parseExcel],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const errorMessage =
    fileError ?? (parseExcel.error instanceof Error ? parseExcel.error.message : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>인사기록카드 데이터</DialogTitle>
        </DialogHeader>

        {!onParsed && savedParsedFile && (
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
            <span className="text-zinc-600">
              {formatDateTime(new Date(savedParsedFile.savedAt))} 저장됨
            </span>
            <button
              type="button"
              className="text-xs font-semibold text-red-500 hover:underline"
              onClick={clearParsedFile}
            >
              삭제
            </button>
          </div>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging
              ? 'border-primary bg-primary-50'
              : 'border-zinc-200 hover:border-primary-300 hover:bg-primary-50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {parseExcel.isPending ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-zinc-500">파싱 중...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="font-medium text-zinc-700">
                엑셀 파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-zinc-400">
                {savedParsedFile && !onParsed ? '새 파일로 교체' : '인사기록카드(.xlsx)'}
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={parseExcel.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="mb-1 font-semibold text-amber-800">안내 사항</p>
          <ul className="list-inside list-disc space-y-1 text-amber-700">
            <li>업로드한 파일은 서버로 전송되지 않고 이 브라우저 안에서만 분석됩니다.</li>
            {onParsed ? (
              <li>여기서는 계산에만 쓰이고 저장되지 않습니다 — 이 기기에 저장은 계산 결과 화면에서 따로 선택할 수 있습니다.</li>
            ) : (
              <li>파싱되는 즉시 이 기기에 저장되어, 다음 방문 시 자동으로 불러옵니다.</li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
