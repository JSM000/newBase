/**
 * Kakao Maps JavaScript SDK 로더.
 *
 * 계획 3-2: SDK는 지도 최초 렌더링 시 1회만 로드. 이후 마커/툴팁/패널은
 * 전부 정적 데이터로 렌더 — 추가 카카오 API 호출 없음.
 *
 * autoload=false + kakao.maps.load() 콜백 방식으로 로드하고,
 * clusterer 라이브러리(MarkerClusterer)를 함께 받는다.
 *
 * appkey(카카오 JavaScript 키)는 런타임 환경변수 NEXT_PUBLIC_KAKAOMAP_API_KEY 로 주입한다.
 *   예) NEXT_PUBLIC_KAKAOMAP_API_KEY=xxxx npm run dev
 */

export const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAOMAP_API_KEY;

let loadPromise: Promise<KakaoMapsNamespace> | null = null;

export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 로드할 수 있습니다.'));
  }
  if (!KAKAO_APP_KEY) {
    return Promise.reject(
      new Error(
        'NEXT_PUBLIC_KAKAOMAP_API_KEY 환경변수가 없습니다. 예) NEXT_PUBLIC_KAKAOMAP_API_KEY=발급키 npm run dev',
      ),
    );
  }
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao.maps);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    const existing = document.getElementById('kakao-maps-sdk') as HTMLScriptElement | null;

    const onReady = () => {
      if (!window.kakao?.maps) {
        reject(new Error('Kakao Maps SDK 로드 후에도 window.kakao.maps 가 없습니다.'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };

    if (existing) {
      existing.addEventListener('load', onReady);
      existing.addEventListener('error', () =>
        reject(new Error('Kakao Maps SDK 스크립트 로드 실패')),
      );
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.async = true;
    script.src =
      `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_APP_KEY)}` +
      `&autoload=false&libraries=clusterer`;
    script.addEventListener('load', onReady);
    script.addEventListener('error', () => {
      loadPromise = null;
      reject(new Error('Kakao Maps SDK 스크립트 로드 실패 (도메인 등록/키 확인 필요)'));
    });
    document.head.appendChild(script);
  });

  return loadPromise;
}
