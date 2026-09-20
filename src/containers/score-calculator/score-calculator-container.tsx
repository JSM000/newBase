'use client';

import { useEffect } from 'react';
import { useScoreStore } from '@/store/use-score-store';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { calculateScore } from '@/lib/score-calculator';
import { isExpired } from '@/lib/settings-retention';
import { UploadSection } from './upload-section';
import { ResultSection } from './result-section/result-section';

export function ScoreCalculatorContainer() {
  const step = useScoreStore((state) => state.step);
  const parsed = useScoreStore((state) => state.parsed);

  // 이번 방문에서 아직 아무것도 업로드/계산하지 않았고, 저장된(만료 안 된) 인사기록카드
  // 데이터가 있으면 업로드 화면을 건너뛰고 바로 결과로 진입한다 (계획 08).
  useEffect(() => {
    if (parsed) return;
    useUserSettingsStore.persist.rehydrate();
    const settings = useUserSettingsStore.getState();
    const saved = settings.savedParsedFile;
    if (!saved || (settings.savedAt && isExpired(settings.savedAt))) return;

    const scoreStore = useScoreStore.getState();
    // 점수 계산기는 현재 유초등만 구현돼 있어(중고등은 추후 구현 예정), 저장된 학교급이
    // 중·고등학교면 이 필드는 시딩하지 않는다.
    if (settings.schoolLevel === 'elementary' || settings.schoolLevel === 'kindergarten') {
      scoreStore.updateInput('teacherType', settings.schoolLevel);
    }
    const calc = calculateScore(saved.data, useScoreStore.getState().inputs);
    scoreStore.setParsed(saved.data);
    scoreStore.setResult(calc);
    scoreStore.setLoadedFromSaved(true);
    scoreStore.setStep('result');
  }, [parsed]);

  if (step === 'upload') {
    return <UploadSection />;
  }

  return <ResultSection />;
}
