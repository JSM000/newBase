'use client';

import { useScoreStore } from '@/store/use-score-store';
import { UploadSection } from './upload-section';
import { ResultSection } from './result-section/result-section';

export function ScoreCalculatorContainer() {
  const step = useScoreStore((state) => state.step);

  if (step === 'upload') {
    return <UploadSection />;
  }

  return <ResultSection />;
}
