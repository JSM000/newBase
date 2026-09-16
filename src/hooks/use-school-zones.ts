import { useQuery } from '@tanstack/react-query';
import type {
  SchoolZoneCollection,
  SchoolZoneLinks,
  SchoolZonePoint,
  ZoneLevel,
} from '@/types/school-zones';

/**
 * public/data/chungbuk-school-zones-{elementary,middle,high}.geojson,
 * chungbuk-school-zone-links.json, chungbuk-school-zone-points.json 을 fetch.
 * 생성: scripts/build-school-zones.mjs · 계획: _refs/학구도_지도_구현계획.md
 *
 * 학구 폴리곤은 학교급별 파일이 따로 있고(초등 ~940KB) 학교를 클릭하기 전엔 필요 없으므로,
 * useSchoolZones(level) 는 level 이 정해졌을 때만(enabled) 그 학교급 파일 하나만 불러온다(lazy).
 * links/points 는 가벼워서(각 수십~백여 KB) 통계 지도 진입 시 바로 불러온다.
 */

const ZONE_FILE_BY_LEVEL: Record<ZoneLevel, string> = {
  초등학교: '/data/chungbuk-school-zones-elementary.geojson',
  중학교: '/data/chungbuk-school-zones-middle.geojson',
  고등학교: '/data/chungbuk-school-zones-high.geojson',
};

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}를 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

/** 학교급 하나의 학구 폴리곤. level 이 null 이면 요청하지 않는다. */
export function useSchoolZones(level: ZoneLevel | null) {
  return useQuery({
    queryKey: ['school-zones', level],
    queryFn: () => fetchJson<SchoolZoneCollection>(ZONE_FILE_BY_LEVEL[level as ZoneLevel], '학구 경계 데이터'),
    enabled: level !== null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** 학교ID(B...) → 전용/공동 학구ID 목록 */
export function useSchoolZoneLinks() {
  return useQuery({
    queryKey: ['school-zone-links'],
    queryFn: () => fetchJson<SchoolZoneLinks>('/data/chungbuk-school-zone-links.json', '학교-학구 연계 데이터'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** 학구도 쪽 학교 좌표 — 학교통계(schulCode)와 이름+좌표로 매칭하는 데 쓴다. */
export function useSchoolZonePoints() {
  return useQuery({
    queryKey: ['school-zone-points'],
    queryFn: () => fetchJson<SchoolZonePoint[]>('/data/chungbuk-school-zone-points.json', '학구도 학교 위치 데이터'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
