/**
 * public/data/chungbuk-school-zone(s)-*.{geojson,json} 스키마.
 * 생성 스크립트: scripts/build-school-zones.mjs
 * 계획 문서: _refs/학구도_지도_구현계획.md
 *
 * 학구도 원본의 학교ID(B로 시작, 한국교육시설안전원)는 학교통계의 schulCode(S로 시작, 학교알리미)와
 * 다른 체계라 직접 조인이 안 된다 — 학교명+학교급+좌표로 매칭한다 (school-zone-match.ts).
 */

/** 학구도 학교급 표기 (학교통계의 schulKndCode 02/03/04 와는 다른 문자열 그대로 사용) */
export type ZoneLevel = '초등학교' | '중학교' | '고등학교';

/** 전용(자기 통학구역/학구) vs 공동(여러 학교가 공유) */
export type ZoneKind = 'dedicated' | 'shared';

export type ZoneType = 'elementary' | 'middle' | 'high_zone' | 'high_nonpyeongjunhwa';

export interface SchoolZoneProperties {
  zoneId: string;
  zoneName: string;
  zoneType: ZoneType;
  level: ZoneLevel;
  kind: ZoneKind;
  /** "공동(일방)통학구역" 등 — 한쪽 방향 배정만 허용 (zoneName 문자열 파생) */
  oneWay: boolean;
  sggCode: string | null;
  eduCode: string;
  eduName: string;
  updatedAt: string | null;
}

export interface SchoolZoneFeature {
  type: 'Feature';
  properties: SchoolZoneProperties;
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface SchoolZoneCollection {
  type: 'FeatureCollection';
  features: SchoolZoneFeature[];
}

export interface SchoolZoneLinkEntry {
  zoneId: string;
  zoneName: string;
}

/** chungbuk-school-zone-links.json — 키는 학구도 학교ID(B...) */
export interface SchoolZoneLink {
  name: string;
  level: ZoneLevel;
  dedicated: SchoolZoneLinkEntry[];
  shared: SchoolZoneLinkEntry[];
}
export type SchoolZoneLinks = Record<string, SchoolZoneLink>;

/** chungbuk-school-zone-points.json — 학구도 쪽 학교 마커(위치·매칭용) */
export interface SchoolZonePoint {
  schoolId: string;
  name: string;
  level: ZoneLevel;
  foundType: string | null;
  isBranch: boolean;
  eduName: string;
  address: string | null;
  lat: number;
  lng: number;
  hasZone: boolean;
}
