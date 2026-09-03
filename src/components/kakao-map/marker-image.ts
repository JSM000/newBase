/**
 * 구간 색상별 마커 이미지(SVG data URI) 생성 + 캐시.
 * kakao.maps.MarkerImage 인스턴스는 색상 x 선택여부 조합으로 재사용한다.
 */

const cache = new Map<string, unknown>();

/**
 * 원형 대신 지도 위에서 확실히 튀는 "핀" 모양(Material "place" 아이콘과 동일한 실루엣).
 * 24x24 기준 좌표계를 PIN_SCALE배 키우고 PIN_PAD_* 만큼 여백을 둬서
 * feDropShadow가 캔버스 밖으로 잘리지 않게 한다.
 */
const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';
const PIN_SCALE = 1.4;
const PIN_PAD_X = 7;
const PIN_PAD_Y = 6;
const PIN_W = 42;
const PIN_H = 48;
const PIN_HEAD_LOCAL = { x: 12, y: 9, r: 7 };
// 핀 끝(뾰족한 아래쪽)이 실제 학교 좌표를 가리키는 지점 — 마커 앵커로 사용.
const PIN_TIP_LOCAL = { x: 12, y: 22 };

/**
 * 구간 인덱스(0~4)별 핀 배율. 색만으로는 5단계 구분이 어려워 크기를 두 번째 채널로 쓴다.
 * 낮음 = 작게, 높음 = 크게. 최소~최대 약 2.8배 차이. 범례(indicator-legend.tsx)도 이 값을 공유.
 * 자료 없음은 가장 작게(NO_DATA_SCALE).
 */
export const BUCKET_SCALE = [0.58, 0.78, 1.02, 1.3, 1.62] as const;
const NO_DATA_SCALE = 0.58;

function scaleFor(bucket: number | null): number {
  return bucket === null ? NO_DATA_SCALE : (BUCKET_SCALE[bucket] ?? NO_DATA_SCALE);
}

function toScreen(local: { x: number; y: number }) {
  return { x: PIN_PAD_X + local.x * PIN_SCALE, y: PIN_PAD_Y + local.y * PIN_SCALE };
}

function svgPin(color: string, selected: boolean, k: number): string {
  const stroke = selected ? '#0f172a' : '#1f2937';
  const strokeW = selected ? 2.2 : 1.6; // <g>에 scale이 걸려 있어 실제 렌더 두께는 이 값 * PIN_SCALE
  const head = toScreen(PIN_HEAD_LOCAL);

  // viewBox 좌표계(0~PIN_W)는 그대로 두고 렌더 픽셀 크기만 k배 — 핀 전체가 비례 축소/확대된다.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_W * k}" height="${PIN_H * k}" viewBox="0 0 ${PIN_W} ${PIN_H}">
    <defs>
      <filter id="pin-shadow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    ${selected ? `<circle cx="${head.x}" cy="${head.y}" r="${PIN_HEAD_LOCAL.r * PIN_SCALE + 5}" fill="${color}" fill-opacity="0.25"/>` : ''}
    <g transform="translate(${PIN_PAD_X},${PIN_PAD_Y}) scale(${PIN_SCALE})" filter="url(#pin-shadow)">
      <path d="${PIN_PATH}" fill="${color}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <circle cx="${PIN_HEAD_LOCAL.x}" cy="${PIN_HEAD_LOCAL.y}" r="3" fill="#ffffff"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getMarkerImage(
  maps: KakaoMapsNamespace,
  color: string,
  selected: boolean,
  bucket: number | null,
): unknown {
  const key = `${color}|${selected ? 's' : 'n'}|${bucket ?? 'x'}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const k = scaleFor(bucket);
  const tip = toScreen(PIN_TIP_LOCAL);
  const image = new maps.MarkerImage(
    svgPin(color, selected, k),
    new maps.Size(PIN_W * k, PIN_H * k),
    { offset: new maps.Point(tip.x * k, tip.y * k) },
  );
  cache.set(key, image);
  return image;
}

/**
 * 클러스터 뱃지 배율. 개별 핀과 같은 5단계지만 안에 숫자가 들어가므로 변화폭을 75%로 완만하게.
 * 뱃지 색이 나타내는 구간(그룹 평균값)의 인덱스를 그대로 받는다.
 */
export function clusterScaleFor(bucket: number | null): number {
  const s = bucket === null ? NO_DATA_SCALE : (BUCKET_SCALE[bucket] ?? NO_DATA_SCALE);
  return 1 + (s - 1) * 0.75;
}

/**
 * 행정구역(시·군) 단위 클러스터 마커용 DOM 엘리먼트.
 * CustomOverlay에 HTMLElement로 넘겨서 클릭 리스너를 직접 붙일 수 있게 한다.
 * bucket = 그룹 평균값의 구간 인덱스(0~4) 또는 null — 색과 함께 크기에도 반영.
 */
export function createRegionClusterElement(
  name: string,
  count: number,
  color: string,
  bucket: number | null,
): HTMLDivElement {
  const scale = clusterScaleFor(bucket);
  const dim = Math.max(34, Math.round(46 * scale)); // 숫자가 들어가므로 최소 지름 보장
  const font = Math.max(12, Math.round(15 * scale));

  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    user-select: none;
  `;
  el.innerHTML = `
    <div style="
      width: ${dim}px;
      height: ${dim}px;
      border-radius: 9999px;
      background: ${color};
      border: 3px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${font}px;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 1px 2px rgba(0,0,0,.35);
    ">${count}</div>
    <div style="
      margin-top: 2px;
      padding: 1px 6px;
      background: rgba(17,24,39,.85);
      color: #fff;
      font-size: 11px;
      border-radius: 6px;
      white-space: nowrap;
    ">${name}</div>
  `;
  return el;
}
