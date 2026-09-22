'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { School } from '@/types/school-stats';
import type { ClusterPosition } from '@/types/school-clusters';
import type { SchoolZoneFeature, SchoolZoneLink } from '@/types/school-zones';
import {
  type Indicator,
  bucketColor,
  bucketIndex,
  formatIndicatorValue,
  NO_DATA_COLOR,
} from '@/lib/school-indicators';
import { groupSchoolsBySigungu, groupSchoolsBySubRegion } from '@/lib/school-region';
import { loadKakaoMaps, KAKAO_APP_KEY } from '@/lib/kakao-loader';
import { useSchoolClusters } from '@/hooks/use-school-clusters';
import { useChungbukBoundaries } from '@/hooks/use-chungbuk-boundaries';
import { formatDuration } from '@/utils/formatter';
import { getMarkerImage, createRegionClusterElement, COMMUTE_MARKER_SCALE } from './marker-image';

interface KakaoMapProps {
  schools: School[];
  indicator: Indicator;
  selectedSchoolCode: string | null;
  onSelectSchool: (school: School) => void;
  /**
   * 길찾기 패널이 켜졌을 때 — 집(출발지) 마커 + 선택 학교까지의 경로 폴리라인.
   * `path`가 있으면 실제 도로 경로를, 없고 `selectedPosition`만 있으면(아직 실측 안 돼
   * 직선거리만 있는 학교를 선택한 경우) 집↔학교 직선을 그린다. 둘 다 없으면 집 +
   * `schoolPoints` 전체에 맞춰 화면을 이동한다.
   */
  routeOverlay?: {
    origin: { lat: number; lng: number };
    path: [number, number][] | null;
    selectedPosition?: { lat: number; lng: number } | null;
    schoolPoints?: { lat: number; lng: number }[];
  } | null;
  /** 설정 페이지에 저장해둔 집 좌표 — 길찾기를 안 켜도 항상 집모양 마커로 표시 */
  homePosition?: { lat: number; lng: number } | null;
  /** 상세 패널이 연 학교급의 학구 폴리곤 전체(lazy load, 계획: _refs/학구도_지도_구현계획.md) */
  zoneFeatures: SchoolZoneFeature[];
  /** 그 중 지금 선택된 학교에 연결된 학구ID 목록 (전용/공동) — null 이면 아무것도 안 그림 */
  zoneLink: SchoolZoneLink | null;
  /**
   * 출퇴근 시간 계산기 탭일 때만 전달 — 마우스 호버 툴팁에 표시·순위 기준 대신 이 값을
   * 보여준다(school-code 별 실측/직선 결과). `null`이면 기존처럼 indicator 값을 보여준다.
   */
  commuteStats?: Map<string, { durationSec: number | null; straightKm: number }> | null;
  /** 켜면 줌 레벨과 무관하게 클러스터 없이 모든 학교 개별 마커를 표시. 토글 UI는 필터 바로 이동, 값만 받는다 */
  showAllMarkers: boolean;
  /** 시·군 행정구역 경계선 표시 여부. 토글 UI는 필터 바로 이동, 값만 받는다 */
  showBoundaries: boolean;
}

/** 부모(순위 목록 등)가 지도를 조작할 수 있는 명령형 API. */
export interface KakaoMapHandle {
  /** 해당 학교가 화면에 보이도록 중심 이동 + 필요하면 개별 마커가 보이는 줌 레벨까지 확대. */
  focusSchool: (school: School) => void;
}

// 충청북도 대략 중심 (청주 ~ 충주 사이)
const CHUNGBUK_CENTER = { lat: 36.72, lng: 127.75 };
const INITIAL_LEVEL = 11;

// 3단계 행정구역 클러스터링 — 레벨(숫자가 클수록 축소)에 따라 시·군 → 구/읍/면/동 → 개별 학교 순으로 보여준다.
type ViewTier = 'sigungu' | 'subRegion' | 'individual';
const SIGUNGU_MIN_LEVEL = 9; // 이 이상: 11개 시·군 클러스터
const SUB_REGION_MIN_LEVEL = 6; // 이 이상(SIGUNGU 미만): 구/읍/면/동 클러스터, 미만: 개별 학교 마커
const FOCUS_LEVEL = 3; // 순위 목록 등에서 특정 학교로 이동할 때 가까이 확대하는 레벨

// 행정구역 채움 투명도 — 지도 라벨·마커가 비쳐 보이도록 낮게.
const BOUNDARY_FILL_OPACITY = 0.14;

// 출퇴근 시간 계산기 탭 전용 마커·클러스터 색 — 표시·순위 기준 색상과 겹치지 않게 primary 고정.
const COMMUTE_MARKER_COLOR = '#e77474';

/**
 * 집을 나타내는 마커 엘리먼트 — 저장된 집 위치(항상 표시)와 길찾기 출발지(경로 표시 중)
 * 둘 다 같은 모양을 쓴다. 전엔 출발지 쪽만 "집" 글자 뱃지라 "안 이쁘다"는 피드백으로,
 * 저장된 집 위치 쪽 🏠 이모지 스타일로 통일.
 */
function createHomeMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = '🏠';
  el.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#f59e0b;font-size:16px;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)';
  return el;
}

function tierOf(level: number): ViewTier {
  if (level >= SIGUNGU_MIN_LEVEL) return 'sigungu';
  if (level >= SUB_REGION_MIN_LEVEL) return 'subRegion';
  return 'individual';
}

/** 그룹 내 학교들의 지표 평균값 (null 제외). 하나도 없으면 null. */
function averageIndicatorValue(indicator: Indicator, schools: School[]): number | null {
  const values = schools
    .map((s) => indicator.accessor(s))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap({
  schools,
  indicator,
  selectedSchoolCode,
  onSelectSchool,
  routeOverlay = null,
  homePosition = null,
  zoneFeatures,
  zoneLink,
  commuteStats = null,
  showAllMarkers,
  showBoundaries,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const regionOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const routeOriginRef = useRef<KakaoCustomOverlay | null>(null);
  const homeMarkerRef = useRef<KakaoCustomOverlay | null>(null);
  const routeLineRef = useRef<KakaoPolyline | null>(null);
  const boundaryPolygonsRef = useRef<{ name: string; polygons: KakaoPolygon[] }[]>([]);
  const zonePolygonsRef = useRef<KakaoPolygon[]>([]);
  const tooltipRef = useRef<KakaoCustomOverlay | null>(null);
  const tooltipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    () => (KAKAO_APP_KEY ? 'loading' : 'error'),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    KAKAO_APP_KEY
      ? null
      : 'Kakao 지도 API 키가 설정되지 않았습니다. 개발 서버를 NEXT_PUBLIC_KAKAOMAP_API_KEY=발급키 npm run dev 로 실행하세요.',
  );
  const [level, setLevel] = useState(INITIAL_LEVEL);
  const viewTier: ViewTier = showAllMarkers ? 'individual' : tierOf(level);
  // commuteStats가 주어지면(빈 Map이어도) 출퇴근 탭 — 마커/클러스터 색·크기, 툴팁에서 쓴다.
  const isCommuteMode = commuteStats !== null;

  // 행정구역(시·군) 경계선 — 필터·지표와 무관한 정적 데이터
  const { data: boundaryData } = useChungbukBoundaries();

  // 클러스터 뱃지 위치("밀집 위치", 필터 무관 사전 계산값) — 이름으로 바로 찾도록 Map으로 변환
  const { data: clusterData } = useSchoolClusters();
  const sigunguCenters = useMemo(() => {
    const map = new Map<string, ClusterPosition>();
    for (const c of clusterData?.sigunguClusters ?? []) map.set(c.name, c.bestCenter);
    return map;
  }, [clusterData]);
  const subRegionCenters = useMemo(() => {
    const map = new Map<string, ClusterPosition>();
    for (const c of clusterData?.subRegionClusters ?? []) map.set(`${c.sigungu}|${c.name}`, c.bestCenter);
    return map;
  }, [clusterData]);

  // 시·군별 채움색 = 그 시·군 클러스터 뱃지 색(평균 지표 → 구간색). 경계 채움에 재사용.
  // 데이터 있는 학교가 하나도 없는 시·군은 넣지 않음(경계선만 남긴다).
  const sigunguFillColors = useMemo(() => {
    const m = new Map<string, string>();
    for (const group of groupSchoolsBySigungu(schools)) {
      const avg = averageIndicatorValue(indicator, group.schools);
      if (avg === null) continue;
      m.set(group.name, bucketColor(indicator, avg));
    }
    return m;
  }, [schools, indicator]);

  // 콜백을 ref로 잡아 마커 재구성 effect의 의존성에서 제외
  const onSelectRef = useRef(onSelectSchool);
  useEffect(() => {
    onSelectRef.current = onSelectSchool;
  });

  // 순위 목록 등 외부에서 특정 학교로 지도를 이동시킬 수 있는 명령형 API.
  useImperativeHandle(ref, () => ({
    focusSchool(school: School) {
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (!maps || !map || !school.position) return;
      map.setCenter(new maps.LatLng(school.position.lat, school.position.lng));
      // 현재 줌 상태와 무관하게 항상 FOCUS_LEVEL까지 가까이 확대 — 그냥 패닝만 하면
      // "이동은 했는데 잘 안 보인다"는 느낌이 들어서, 순위에서 고른 학교는 항상 바짝 당겨줌.
      map.setLevel(FOCUS_LEVEL);
    },
  }), []);

  // ── SDK 로드 + 지도 생성 (1회) ──
  useEffect(() => {
    if (!KAKAO_APP_KEY) return;
    let cancelled = false;

    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(CHUNGBUK_CENTER.lat, CHUNGBUK_CENTER.lng),
          level: INITIAL_LEVEL,
        });
        mapRef.current = map;
        // 행정구역(시·군) 기반 클러스터링을 직접 구현하므로 Kakao MarkerClusterer는 쓰지 않음.
        // 줌 레벨이 바뀔 때마다 region/개별 마커 렌더 effect가 다시 돌게 레벨을 state로 추적.
        maps.event.addListener(map, 'zoom_changed', () => {
          setLevel(map.getLevel());
        });
        tooltipRef.current = new maps.CustomOverlay({
          position: new maps.LatLng(CHUNGBUK_CENTER.lat, CHUNGBUK_CENTER.lng),
          content: '',
          // 마커 아래쪽에 표시(핀은 앵커 지점에서 위로 뻗으므로 아래는 빈 공간) — 위로 올릴 때 깜박임 방지
          yAnchor: -0.35,
          xAnchor: 0.5,
          zIndex: 999,
        });
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : '지도 로드 실패');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── 행정구역(시·군) 경계선 렌더 (지도 준비 + 데이터 도착 시 1회) ──
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map || !boundaryData || !showBoundaries) return;

    // GeoJSON 링([lng, lat][]) → 카카오 LatLng 배열
    const toPath = (ring: number[][]) =>
      ring.map(([lng, lat]) => new maps.LatLng(lat, lng));

    // 시·군 1개 = 폴리곤 1개 이상(MultiPolygon 은 하위 폴리곤마다). 이름을 유지해
    // 채움색을 아래 effect 에서 시·군 단위로 갱신한다.
    // path 를 링 배열([외곽, 구멍...])로 넘기면 도넛 모양도 처리된다.
    const groups = boundaryData.features.map((f) => {
      const polys: number[][][][] =
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const polygons = polys.map(
        (rings) =>
          new maps.Polygon({
            path: rings.map(toPath),
            strokeWeight: 2,
            strokeColor: '#27272a', // zinc-800
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
            fillColor: '#000000',
            fillOpacity: 0, // 채움은 아래 동기화 effect 가 담당
            zIndex: 1, // 마커·클러스터 뱃지 아래
          }),
      );
      for (const polygon of polygons) polygon.setMap(map);
      return { name: f.properties.name, polygons };
    });
    boundaryPolygonsRef.current = groups;

    return () => {
      for (const group of groups) for (const polygon of group.polygons) polygon.setMap(null);
      boundaryPolygonsRef.current = [];
    };
  }, [status, boundaryData, showBoundaries]);

  // ── 경계 채움색을 시·군 클러스터 색과 동기화 (지표·필터·줌 변경 시) ──
  // effect 는 선언 순서대로 실행되므로 위 렌더 effect 다음에 돌아 최초 채움도 처리된다.
  // 시·군 클러스터 tier 에서만 채움. 확대해서 구·읍·면·동/개별 마커로 넘어가면
  // 채움을 지우고 경계선만 남긴다.
  useEffect(() => {
    const showFill = viewTier === 'sigungu';
    for (const group of boundaryPolygonsRef.current) {
      const fill = showFill ? sigunguFillColors.get(group.name) : undefined;
      for (const polygon of group.polygons) {
        polygon.setOptions({
          fillColor: fill ?? '#000000',
          fillOpacity: fill ? BOUNDARY_FILL_OPACITY : 0,
        });
      }
    }
  }, [sigunguFillColors, showBoundaries, status, boundaryData, viewTier]);

  // ── 선택된 학교의 학구 폴리곤 렌더 (학교 클릭 → 학구 색칠, 계획: _refs/학구도_지도_구현계획.md) ──
  // 전용 구역 = 진한 파랑 실선, 공동구역 = 옅은 주황 점선(다른 학교와 공유되는 지역임을 구분).
  // 공동구역이 전용 구역과 지리적으로 겹치므로 zIndex를 위에 둬서 점선 테두리가 보이게 한다.
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map) return;

    for (const polygon of zonePolygonsRef.current) polygon.setMap(null);
    zonePolygonsRef.current = [];
    if (!zoneLink) return;

    const featureById = new Map(zoneFeatures.map((f) => [f.properties.zoneId, f]));
    const toPath = (ring: number[][]) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng));

    function drawZone(
      zoneId: string,
      style: { fillColor: string; fillOpacity: number; strokeColor: string; strokeStyle: string; zIndex: number },
    ) {
      const feature = featureById.get(zoneId);
      if (!feature) return; // 아직 해당 학교급 GeoJSON 로딩 중이면 이번 렌더는 건너뜀(다음 갱신에서 그림)
      const polys =
        feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const rings of polys) {
        const polygon = new maps!.Polygon({
          path: rings.map(toPath),
          strokeWeight: 2,
          strokeColor: style.strokeColor,
          strokeOpacity: 0.9,
          strokeStyle: style.strokeStyle,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
          zIndex: style.zIndex,
        });
        polygon.setMap(map);
        zonePolygonsRef.current.push(polygon);
      }
    }

    for (const zone of zoneLink.dedicated) {
      drawZone(zone.zoneId, {
        fillColor: '#2563eb', // blue-600
        fillOpacity: 0.28,
        strokeColor: '#1d4ed8',
        strokeStyle: 'solid',
        zIndex: 2,
      });
    }
    for (const zone of zoneLink.shared) {
      drawZone(zone.zoneId, {
        fillColor: '#f59e0b', // amber-500
        fillOpacity: 0.14,
        strokeColor: '#b45309',
        strokeStyle: 'shortdash',
        zIndex: 3,
      });
    }

    return () => {
      for (const polygon of zonePolygonsRef.current) polygon.setMap(null);
      zonePolygonsRef.current = [];
    };
  }, [status, zoneFeatures, zoneLink]);

  // ── 마커/클러스터 렌더 (schools / indicator / selected / 시야 전환 시 재구성) ──
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map) return;

    // 이전에 그려둔 것 전부 제거 (개별 마커 / 시군구 클러스터 둘 다 — 모드 전환 시 잔상 방지)
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = [];
    for (const overlay of regionOverlaysRef.current) overlay.setMap(null);
    regionOverlaysRef.current = [];

    const tooltip = tooltipRef.current;
    // isCommuteMode는 컴포넌트 최상단에서 계산됨 — 표시·순위 기준 색/크기 대신 고정된
    // primary 색 + 확대된 크기로 통일해서, "자료 없음"(회색·최소크기)과 구분되게 한다.

    // 뱃지 표시 위치 = 클릭 시 이동 위치, 하나로 통일(계획 3-2). chungbuk-school-clusters.json의
    // bestCenter(밀집 위치, 필터 무관 사전 계산값)를 쓰고, 아직 못 불러왔거나 매칭이 안 되는
    // 경우에만 그룹 단순 평균(group.center)으로 대체한다.
    function moveToPosition(
      mapsNs: KakaoMapsNamespace,
      targetMap: KakaoMap,
      position: ClusterPosition,
      targetLevel: number,
    ) {
      targetMap.setCenter(new mapsNs.LatLng(position.lat, position.lng));
      targetMap.setLevel(targetLevel);
    }

    /** 클러스터 뱃지 하나 생성 + 클릭 시 position으로 이동하는 리스너까지 등록. */
    function addGroupOverlay(
      mapsNs: KakaoMapsNamespace,
      targetMap: KakaoMap,
      name: string,
      groupSchools: School[],
      position: ClusterPosition,
      targetLevel: number,
    ): KakaoCustomOverlay {
      const avgValue = averageIndicatorValue(indicator, groupSchools);
      const bucket = avgValue === null ? null : bucketIndex(indicator, avgValue);
      const color = isCommuteMode
        ? COMMUTE_MARKER_COLOR
        : avgValue === null ? NO_DATA_COLOR : bucketColor(indicator, avgValue);
      const el = createRegionClusterElement(
        name,
        groupSchools.length,
        color,
        bucket,
        isCommuteMode ? COMMUTE_MARKER_SCALE : undefined,
      );

      el.addEventListener('click', () => {
        moveToPosition(mapsNs, targetMap, position, targetLevel);
      });

      const overlay = new mapsNs.CustomOverlay({
        position: new mapsNs.LatLng(position.lat, position.lng),
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 10,
      });
      overlay.setMap(targetMap);
      return overlay;
    }

    if (viewTier === 'sigungu' || viewTier === 'subRegion') {
      // ── 시·군 또는 구/읍/면/동 단위 클러스터 (렌더링 방식은 동일, 그룹 계산만 다름) ──
      const nextMaxLevel = viewTier === 'sigungu' ? SIGUNGU_MIN_LEVEL - 1 : SUB_REGION_MIN_LEVEL - 1;
      const overlays: KakaoCustomOverlay[] = [];

      if (viewTier === 'sigungu') {
        for (const group of groupSchoolsBySigungu(schools)) {
          const position = sigunguCenters.get(group.name) ?? group.center;
          overlays.push(addGroupOverlay(maps, map, group.name, group.schools, position, nextMaxLevel));
        }
      } else {
        for (const group of groupSchoolsBySubRegion(schools)) {
          const position = subRegionCenters.get(`${group.sigungu}|${group.name}`) ?? group.center;
          overlays.push(addGroupOverlay(maps, map, group.name, group.schools, position, nextMaxLevel));
        }
      }

      regionOverlaysRef.current = overlays;
      return;
    }

    // ── 개별 학교 마커 ──
    const markers: KakaoMarker[] = [];

    for (const school of schools) {
      if (!school.position) continue;
      const pos = new maps.LatLng(school.position.lat, school.position.lng);

      const value = indicator.accessor(school);
      const bucket = value === null ? null : bucketIndex(indicator, value);
      const color = isCommuteMode
        ? COMMUTE_MARKER_COLOR
        : value === null ? NO_DATA_COLOR : bucketColor(indicator, value);
      const isSelected = school.schulCode === selectedSchoolCode;

      const marker = new maps.Marker({
        position: pos,
        image: getMarkerImage(maps, color, isSelected, bucket, isCommuteMode ? COMMUTE_MARKER_SCALE : undefined),
        title: school.schulNm,
        clickable: true,
      });
      marker.setMap(map);

      maps.event.addListener(marker, 'click', () => {
        onSelectRef.current(school);
      });
      maps.event.addListener(marker, 'mouseover', () => {
        if (!tooltip) return;
        if (tooltipHideTimerRef.current) {
          clearTimeout(tooltipHideTimerRef.current);
          tooltipHideTimerRef.current = null;
        }
        tooltip.setPosition(pos);
        // 출퇴근 탭(commuteStats 전달됨)에선 표시·순위 기준 대신 실측/직선 결과를 보여준다.
        const commuteStat = commuteStats?.get(school.schulCode);
        const detailLine = commuteStats
          ? commuteStat
            ? commuteStat.durationSec !== null
              ? `자동차 ${formatDuration(commuteStat.durationSec)}`
              : `직선 ${commuteStat.straightKm}km`
            : ''
          : `${indicator.label} ${formatIndicatorValue(indicator, indicator.accessor(school))}`;
        // pointer-events:none — 툴팁이 마커와 겹쳐도 마우스를 가로채지 않아야 한다.
        tooltip.setContent(
          `<div style="pointer-events:none;padding:6px 10px;background:#111827;color:#fff;border-radius:8px;font-size:12px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">
             <b>${school.schulNm}</b>
             ${detailLine ? `<span style="opacity:.75;margin-left:6px">${detailLine}</span>` : ''}
           </div>`,
        );
        tooltip.setMap(map);
      });
      maps.event.addListener(marker, 'mouseout', () => {
        // 살짝 늦게 숨겨서 마커 경계에서 mouseout/mouseover가 튈 때 깜박이지 않게 한다.
        if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
        tooltipHideTimerRef.current = setTimeout(() => {
          tooltip?.setMap(null);
          tooltipHideTimerRef.current = null;
        }, 100);
      });

      markers.push(marker);
    }

    markersRef.current = markers;
  }, [status, schools, indicator, selectedSchoolCode, viewTier, sigunguCenters, subRegionCenters, commuteStats, isCommuteMode]);

  // ── 길찾기: 집(출발) 마커 + 선택 학교까지 경로 폴리라인 ──
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map) return;

    routeOriginRef.current?.setMap(null);
    routeOriginRef.current = null;
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;

    if (!routeOverlay) return;

    const originPos = new maps.LatLng(routeOverlay.origin.lat, routeOverlay.origin.lng);
    const originOverlay = new maps.CustomOverlay({
      position: originPos,
      content: createHomeMarkerElement(),
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 30,
    });
    originOverlay.setMap(map);
    routeOriginRef.current = originOverlay;

    const bounds = new maps.LatLngBounds();
    bounds.extend(originPos);

    if (routeOverlay.path && routeOverlay.path.length >= 2) {
      const latlngs = routeOverlay.path.map(
        ([lng, lat]) => new maps.LatLng(lat, lng),
      );
      const line = new maps.Polyline({
        path: latlngs,
        strokeWeight: 7,
        strokeColor: '#4285f4', // 구글맵 스타일 경로 파란색 — 진한 남색(#1d4ed8)이 촌스럽다는 피드백으로 더 산뜻한 톤으로 교체
        strokeOpacity: 0.95,
        strokeStyle: 'solid',
        zIndex: 25,
      });
      line.setMap(map);
      routeLineRef.current = line;
      for (const ll of latlngs) bounds.extend(ll);
    } else if (routeOverlay.selectedPosition) {
      // 아직 실측 안 된(직선거리만 있는) 학교를 선택한 경우 — 실제 도로 경로 대신
      // 집↔학교 직선을 점선으로 표시해 "이건 실제 경로가 아니다"를 구분한다.
      const targetPos = new maps.LatLng(
        routeOverlay.selectedPosition.lat,
        routeOverlay.selectedPosition.lng,
      );
      const line = new maps.Polyline({
        path: [originPos, targetPos],
        strokeWeight: 3,
        strokeColor: '#9ca3af', // zinc-400
        strokeOpacity: 0.9,
        strokeStyle: 'shortdash',
        zIndex: 25,
      });
      line.setMap(map);
      routeLineRef.current = line;
      bounds.extend(targetPos);
    } else {
      // 경로 미선택 — 집 + 대상 학교 전체가 보이게
      for (const p of routeOverlay.schoolPoints ?? []) {
        bounds.extend(new maps.LatLng(p.lat, p.lng));
      }
    }

    if (!bounds.isEmpty()) map.setBounds(bounds);
  }, [status, routeOverlay]);

  // ── 저장된 집 위치 마커 — 길찾기를 켜지 않아도 항상 표시 (routeOverlay와 별개) ──
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map) return;

    homeMarkerRef.current?.setMap(null);
    homeMarkerRef.current = null;
    if (!homePosition) return;

    const overlay = new maps.CustomOverlay({
      position: new maps.LatLng(homePosition.lat, homePosition.lng),
      content: createHomeMarkerElement(),
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 20,
    });
    overlay.setMap(map);
    homeMarkerRef.current = overlay;

    return () => {
      overlay.setMap(null);
    };
  }, [status, homePosition]);

  // ── 필터 변경 시 보이는 학교에 맞춰 화면 이동 (선택만 바뀔 땐 유지) ──
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !maps || !map) return;
    const bounds = new maps.LatLngBounds();
    let count = 0;
    for (const school of schools) {
      if (!school.position) continue;
      bounds.extend(new maps.LatLng(school.position.lat, school.position.lng));
      count += 1;
    }
    if (count > 0 && !bounds.isEmpty()) map.setBounds(bounds);
  }, [status, schools]);

  // ── 컨테이너 크기 변동 대응 ──
  useEffect(() => {
    if (status !== 'ready' || !containerRef.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.relayout());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [status]);

  // ── 언마운트 시 툴팁 숨김 타이머 정리 ──
  useEffect(() => {
    return () => {
      if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-zinc-100">
      <div ref={containerRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/80">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm">지도를 불러오는 중…</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="mb-1 font-semibold text-amber-800">지도를 표시할 수 없습니다</p>
            <p className="text-sm text-amber-700">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
});

KakaoMap.displayName = 'KakaoMap';
