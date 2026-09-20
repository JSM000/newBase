'use client';

import { useState } from 'react';
import { ExcelDataDialog } from '@/components/excel-data-dialog';
import { AppHeader } from '@/components/app-header';
import { useScoreStore } from '@/store/use-score-store';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { calculateScore } from '@/lib/score-calculator';
import type { ParsedFile } from '@/types/score';

export function UploadSection() {
  const [dialogOpen, setDialogOpen] = useState(true);
  const { setParsed, setResult, setStep, setLoadedFromSaved, updateInput } = useScoreStore();

  // 엑셀 파일 자체를 다루는 코드(파싱·드래그앤드롭·검증)는 전부 ExcelDataDialog 안에 있다
  // — 여기선 "파싱된 데이터로 무엇을 할지"(점수 계산 후 결과 화면으로 이동)만 담당한다.
  function handleParsed(parsed: ParsedFile) {
    const schoolLevel = useUserSettingsStore.getState().schoolLevel;
    // 점수 계산기는 현재 유초등만 구현돼 있어(중고등은 추후 구현 예정), 저장된 학교급이
    // 중·고등학교면 이 필드는 시딩하지 않는다.
    if (schoolLevel === 'elementary' || schoolLevel === 'kindergarten') {
      updateInput('teacherType', schoolLevel);
    }
    const inputs = useScoreStore.getState().inputs;
    const calc = calculateScore(parsed, inputs);
    setParsed(parsed);
    setResult(calc);
    setLoadedFromSaved(false);
    setStep('result');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        items={[
          { label: 'NewBase', href: '/' },
          { label: '지역 선택', href: '/calculator' },
          { label: '업로드' },
        ]}
      />

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg text-center">
          <h2 className="mb-2 text-xl font-semibold text-zinc-800">
            NEIS 인사기록카드 업로드
          </h2>
          <p className="mb-1 text-sm text-zinc-500">
            NEIS에서 엑셀(.xlsx)로 저장한 인사기록카드를 업로드하면
            <br />
            관외이동 점수를 자동으로 계산합니다.
          </p>
          <p className="mb-6 text-xs text-zinc-400">
            청주교육지원청 유치원·초등교사 | 기준일: 2026.2.28.
          </p>
          {!dialogOpen && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
            >
              엑셀 파일 업로드
            </button>
          )}
        </div>
      </main>

      <ExcelDataDialog open={dialogOpen} onOpenChange={setDialogOpen} onParsed={handleParsed} />
    </div>
  );
}
