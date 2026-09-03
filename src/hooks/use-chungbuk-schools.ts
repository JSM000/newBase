import { useQuery } from '@tanstack/react-query';
import type { ChungbukSchoolsData } from '@/types/school-stats';

/**
 * public/data/chungbuk-schools-render.json 을 클라이언트에서 1회 fetch.
 * (원본 chungbuk-schools.json을 build-schools-dataset.mjs가 최적화한 프론트 전용 산출물)
 * 정적 파일이라 JS 번들과 분리되고 브라우저가 별도 캐싱한다 (계획 3-4).
 */
async function fetchChungbukSchools(): Promise<ChungbukSchoolsData> {
  const res = await fetch('/data/chungbuk-schools-render.json');
  if (!res.ok) {
    throw new Error(`학교 통계 데이터를 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

export function useChungbukSchools() {
  return useQuery({
    queryKey: ['chungbuk-schools'],
    queryFn: fetchChungbukSchools,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
