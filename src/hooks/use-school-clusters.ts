import { useQuery } from '@tanstack/react-query';
import type { ChungbukSchoolClustersData } from '@/types/school-clusters';

/**
 * public/data/chungbuk-school-clusters.json 을 클라이언트에서 1회 fetch.
 * 클러스터 뱃지 위치(bestCenter)는 필터와 무관해서 학교 데이터(useChungbukSchools)와
 * 별도로 캐싱한다 (계획 3-2).
 */
async function fetchSchoolClusters(): Promise<ChungbukSchoolClustersData> {
  const res = await fetch('/data/chungbuk-school-clusters.json');
  if (!res.ok) {
    throw new Error(`클러스터 위치 데이터를 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

export function useSchoolClusters() {
  return useQuery({
    queryKey: ['chungbuk-school-clusters'],
    queryFn: fetchSchoolClusters,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
