/**
 * public/data/chungbuk-school-clusters.json 스키마.
 * 생성 스크립트: scripts/build-school-clusters.mjs
 * 계획 문서: _refs/학교통계_지도_구현계획.md 3-2 "클러스터 집계 데이터"
 */

export interface ClusterPosition {
  lat: number;
  lng: number;
}

export interface SigunguCluster {
  name: string;
  bestCenter: ClusterPosition;
}

export interface SubRegionCluster {
  sigungu: string;
  name: string;
  bestCenter: ClusterPosition;
}

export interface ChungbukSchoolClustersData {
  generatedAt: string;
  sourceGeneratedAt: string;
  radiusKm: { sigungu: number; subRegion: number };
  sigunguClusters: SigunguCluster[];
  subRegionClusters: SubRegionCluster[];
}
