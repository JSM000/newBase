import { useMutation } from '@tanstack/react-query';
import { parseExcelFile } from '@/lib/excel-parser';
import { useScoreStore } from '@/store/use-score-store';
import { calculateScore } from '@/lib/score-calculator';

// 파일을 서버로 보내지 않고 브라우저에서 직접 파싱한다(인사기록카드 개인정보 보호).
// useMutation은 네트워크 전용이 아니라 비동기 함수 전반의 로딩/에러 상태 관리에 써도 된다.
export const useParseExcel = () => {
  const { setParsed, setResult, setStep } = useScoreStore();

  return useMutation({
    mutationFn: parseExcelFile,
    onSuccess: (parsed) => {
      const inputs = useScoreStore.getState().inputs;
      const calc = calculateScore(parsed, inputs);
      setParsed(parsed);
      setResult(calc);
      setStep('result');
    },
  });
};
