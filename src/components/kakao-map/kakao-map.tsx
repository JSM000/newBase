'use client';

import { useEffect, useRef, useState } from 'react';
import type { School } from '@/types/school-stats';
import {
  type Indicator,
  bucketColor,
  NO_DATA_COLOR,
} from '@/lib/school-indicators';
import { loadKakaoMaps, KAKAO_APP_KEY } from '@/lib/kakao-loader';
import { getMarkerImage } from './marker-image';

interface KakaoMapProps {
  schools: School[];
  indicator: Indicator;
  selectedSchoolCode: string | null;
  onSelectSchool: (school: School) => void;
}

// 충청북도 대략 중심 (청주 ~ 충주 사이)
const CHUNGBUK_CENTER = { lat: 36.72, lng: 127.75 };
const INITIAL_LEVEL = 11;

function formatIndicatorValue(indicator: Indicator, s: School): string {
  const v = indicator.accessor(s);
  if (v === null) return '자료 없음';
  const shown = indicator.format ? indicator.format(v) : String(v);
  return `${shown}${indicator.unit ? ` ${indicator.unit}` : ''}`;
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
  const clustererRef = useRef<KakaoMarkerClusterer | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const tooltipRef = useRef<KakaoCustomOverlay | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    () => (KAKAO_APP_KEY ? 'loading' : 'error'),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    KAKAO_APP_KEY
      ? null
      : 'Kakao 지도 API 키가 설정되지 않았습니다. 개발 서버를 NEXT_PUBLIC_KAKAOMAP_API_KEY=발급키 npm run dev 로 실행하세요.',
  );

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
        clustererRef.current = new maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 8,
          gridSize: 70,
          disableClickZoom: false,
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

  // ── 마커 렌더 (schools / indicator / selected 변경 시 재구성) ──
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    if (status !== 'ready' || !maps || !map || !clusterer) return;

    // 기존 마커 제거
    clusterer.clear();
    markersRef.current = [];

    const tooltip = tooltipRef.current;
    const bounds = new maps.LatLngBounds();
    const markers: KakaoMarker[] = [];

    for (const school of schools) {
      if (!school.position) continue;
      const pos = new maps.LatLng(school.position.lat, school.position.lng);
      bounds.extend(pos);

      const value = indicator.accessor(school);
      const color = value === null ? NO_DATA_COLOR : bucketColor(indicator, value);
      const isSelected = school.schulCode === selectedSchoolCode;

      const marker = new maps.Marker({
        position: pos,
        image: getMarkerImage(maps, color, isSelected),
        title: school.schulNm,
        clickable: true,
      });

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
    clusterer.addMarkers(markers);
  }, [status, schools, indicator, selectedSchoolCode]);

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
