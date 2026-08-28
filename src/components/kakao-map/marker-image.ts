/**
 * 구간 색상별 마커 이미지(SVG data URI) 생성 + 캐시.
 * kakao.maps.MarkerImage 인스턴스는 색상 x 선택여부 조합으로 재사용한다.
 */

const cache = new Map<string, unknown>();

function svgPin(color: string, selected: boolean): string {
  const stroke = selected ? '#111827' : '#ffffff';
  const strokeW = selected ? 3 : 2;
  const r = 9;
  const w = 30;
  const h = 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${selected ? `<circle cx="15" cy="15" r="13" fill="${color}" fill-opacity="0.25"/>` : ''}
    <circle cx="15" cy="15" r="${r}" fill="${color}" stroke="${stroke}" stroke-width="${strokeW}"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getMarkerImage(
  maps: KakaoMapsNamespace,
  color: string,
  selected: boolean,
): unknown {
  const key = `${color}|${selected ? 's' : 'n'}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 30;
  const image = new maps.MarkerImage(
    svgPin(color, selected),
    new maps.Size(size, size),
    { offset: new maps.Point(size / 2, size / 2) },
  );
  cache.set(key, image);
  return image;
}
