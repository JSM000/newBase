/**
 * Kakao Maps JavaScript SDK 최소 타입 선언.
 * 공식 @types 패키지를 설치하지 않고, 이 프로젝트에서 실제로 쓰는 API만 느슨하게 정의한다.
 * SDK 문서: https://apis.map.kakao.com/web/documentation/
 */

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  isEmpty(): boolean;
}

interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  getLevel(): number;
  setBounds(bounds: KakaoLatLngBounds): void;
  relayout(): void;
  panTo(latlng: KakaoLatLng): void;
}

interface KakaoMarker {
  setMap(map: KakaoMap | null): void;
  setImage(image: unknown): void;
  getPosition(): KakaoLatLng;
}

interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
  setContent(content: string | HTMLElement): void;
}

interface KakaoMarkerClusterer {
  addMarkers(markers: KakaoMarker[]): void;
  removeMarkers(markers: KakaoMarker[]): void;
  clear(): void;
  redraw(): void;
}

interface KakaoMapsEvent {
  addListener(target: unknown, type: string, handler: (...args: unknown[]) => void): void;
  removeListener(target: unknown, type: string, handler: (...args: unknown[]) => void): void;
}

interface KakaoMapsNamespace {
  load(callback: () => void): void;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Marker: new (options: {
    position: KakaoLatLng;
    image?: unknown;
    title?: string;
    clickable?: boolean;
  }) => KakaoMarker;
  MarkerImage: new (
    src: string,
    size: unknown,
    options?: { offset?: unknown },
  ) => unknown;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: string | HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoCustomOverlay;
  MarkerClusterer: new (options: {
    map: KakaoMap;
    averageCenter?: boolean;
    minLevel?: number;
    gridSize?: number;
    disableClickZoom?: boolean;
    styles?: Record<string, string>[];
  }) => KakaoMarkerClusterer;
  event: KakaoMapsEvent;
}

interface Window {
  kakao?: {
    maps: KakaoMapsNamespace;
  };
}
