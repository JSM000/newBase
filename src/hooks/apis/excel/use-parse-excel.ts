import { useMutation } from '@tanstack/react-query';
import { parseExcelApi } from '@/apis/excel/excel';
import { useScoreStore } from '@/store/use-score-store';
import { calculateScore } from '@/lib/score-calculator';

export const useParseExcel = () => {
  const { setParsed, setResult, setStep } = useScoreStore();

  return useMutation({
    mutationFn: parseExcelApi,
    onSuccess: (data) => {
      const inputs = useScoreStore.getState().inputs;
      const calc = calculateScore(data.parsed, inputs);
      setParsed(data.parsed);
      setResult(calc);
      setStep('result');
    },
  });
};
