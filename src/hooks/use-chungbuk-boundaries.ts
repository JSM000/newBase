import { useQuery } from '@tanstack/react-query';

/**
 * public/data/chungbuk-sigungu-boundaries.json — 충북 11개 시·군 행정구역 경계.
 * 카카오맵 위에 Polygon 으로 시·군 경계선을 그리는 데 쓴다 (필터·지표와 무관한 정적 데이터).
 *
 * 원본: southkorea/southkorea-maps (kostat 2018), 청주시 4개 구는 '청주시' 하나로 병합 후
 * 좌표 단순화(tolerance ≈ 60m) + 소수점 5자리 반올림. 생성 스크립트는 커밋 메시지 참고.
 */
export interface BoundaryFeature {
  type: 'Feature';
  properties: { name: string };
  // GeoJSON 좌표: [lng, lat]. Polygon = 링 배열, MultiPolygon = 폴리곤 배열.
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
}

async function fetchBoundaries(): Promise<BoundaryCollection> {
  const res = await fetch('/data/chungbuk-sigungu-boundaries.json');
  if (!res.ok) {
    throw new Error(`행정구역 경계 데이터를 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

export function useChungbukBoundaries() {
  return useQuery({
    queryKey: ['chungbuk-sigungu-boundaries'],
    queryFn: fetchBoundaries,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
