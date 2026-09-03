'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { School } from '@/types/school-stats';
import type { ClusterPosition } from '@/types/school-clusters';
import {
  type Indicator,
  bucketColor,
  NO_DATA_COLOR,
} from '@/lib/school-indicators';
import { groupSchoolsBySigungu, groupSchoolsBySubRegion } from '@/lib/school-region';
import { loadKakaoMaps, KAKAO_APP_KEY } from '@/lib/kakao-loader';
import { useSchoolClusters } from '@/hooks/use-school-clusters';
import { getMarkerImage, createRegionClusterElement } from './marker-image';

interface KakaoMapProps {
  schools: School[];
  indicator: Indicator;
  selectedSchoolCode: string | null;
  onSelectSchool: (school: School) => void;
}

// 충청북도 대략 중심 (청주 ~ 충주 사이)
const CHUNGBUK_CENTER = { lat: 36.72, lng: 127.75 };
const INITIAL_LEVEL = 11;

// 3단계 행정구역 클러스터링 — 레벨(숫자가 클수록 축소)에 따라 시·군 → 구/읍/면/동 → 개별 학교 순으로 보여준다.
type ViewTier = 'sigungu' | 'subRegion' | 'individual';
const SIGUNGU_MIN_LEVEL = 9; // 이 이상: 11개 시·군 클러스터
const SUB_REGION_MIN_LEVEL = 6; // 이 이상(SIGUNGU 미만): 구/읍/면/동 클러스터, 미만: 개별 학교 마커

function tierOf(level: number): ViewTier {
  if (level >= SIGUNGU_MIN_LEVEL) return 'sigungu';
  if (level >= SUB_REGION_MIN_LEVEL) return 'subRegion';
  return 'individual';
}

function formatIndicatorValue(indicator: Indicator, s: School): string {
  const v = indicator.accessor(s);
  if (v === null) return '자료 없음';
  const shown = indicator.format ? indicator.format(v) : String(v);
  return `${shown}${indicator.unit ? ` ${indicator.unit}` : ''}`;
}

/** 그룹 내 학교들의 지표 평균값 (null 제외). 하나도 없으면 null. */
function averageIndicatorValue(indicator: Indicator, schools: School[]): number | null {
  const values = schools
    .map((s) => indicator.accessor(s))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function KakaoMap({
  schools,
  indicator,
  selectedSchoolCode,
  onSelectSchool,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const regionOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const tooltipRef = useRef<KakaoCustomOverlay | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    () => (KAKAO_APP_KEY ? 'loading' : 'error'),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    KAKAO_APP_KEY
      ? null
      : 'Kakao 지도 API 키가 설정되지 않았습니다. 개발 서버를 NEXT_PUBLIC_KAKAOMAP_API_KEY=발급키 npm run dev 로 실행하세요.',
  );
  const [level, setLevel] = useState(INITIAL_LEVEL);
  const viewTier = tierOf(level);

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

  // 콜백을 ref로 잡아 마커 재구성 effect의 의존성에서 제외
  const onSelectRef = useRef(onSelectSchool);
  useEffect(() => {
    onSelectRef.current = onSelectSchool;
  });

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
          yAnchor: 1.4,
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
      const color = avgValue === null ? NO_DATA_COLOR : bucketColor(indicator, avgValue);
      const el = createRegionClusterElement(name, groupSchools.length, color);

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
      const color = value === null ? NO_DATA_COLOR : bucketColor(indicator, value);
      const isSelected = school.schulCode === selectedSchoolCode;

      const marker = new maps.Marker({
        position: pos,
        image: getMarkerImage(maps, color, isSelected),
        title: school.schulNm,
        clickable: true,
      });
      marker.setMap(map);

      maps.event.addListener(marker, 'click', () => {
        onSelectRef.current(school);
      });
      maps.event.addListener(marker, 'mouseover', () => {
        if (!tooltip) return;
        tooltip.setPosition(pos);
        tooltip.setContent(
          `<div style="padding:6px 10px;background:#111827;color:#fff;border-radius:8px;font-size:12px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">
             <b>${school.schulNm}</b>
             <span style="opacity:.75;margin-left:6px">${indicator.label} ${formatIndicatorValue(indicator, school)}</span>
           </div>`,
        );
        tooltip.setMap(map);
      });
      maps.event.addListener(marker, 'mouseout', () => {
        tooltip?.setMap(null);
      });

      markers.push(marker);
    }

    markersRef.current = markers;
  }, [status, schools, indicator, selectedSchoolCode, viewTier, sigunguCenters, subRegionCenters]);

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
}
