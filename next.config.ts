import type { NextConfig } from "next";

// 인사기록카드를 다루는 페이지(점수 계산기, 설정 페이지 — 둘 다 엑셀을 직접
// 업로드·파싱한다)는 "파일이 브라우저 밖으로 안 나간다"가 설계 불변조건(CLAUDE.md 참고).
// CSP로 그걸 브라우저 차원에서 강제한다 — 코드에 실수로(또는 의존성 취약점으로)
// fetch/전송 로직이 들어가도 connect-src 'self' 때문에 실제 전송은 막힌다. 지도·소셜
// 기능(카카오맵/Supabase)이 쓰는 외부 도메인은 이 라우트들에 필요 없으므로 전부 뺐다 —
// 설정 페이지의 주소 검색(`/api/geocode`)은 같은 출처(self) 호출이라 이 CSP로도 허용된다.
// 다른 라우트(/statistics 등)는 카카오맵 SDK 등 외부 도메인이 필요해 CSP를 안 건다.
//
// 루트 레이아웃(src/app/layout.tsx)이 모든 라우트에서 Pretendard 폰트를 jsdelivr에서
// 받아오므로 style-src/font-src는 이 페이지들에서도 열어둬야 한다.
// script-src에 'unsafe-inline'이 필요한 이유: Next.js가 nonce 없이 RSC 하이드레이션
// 데이터를 인라인 <script>로 심는다(middleware 기반 nonce는 아직 도입 안 함).
const NO_NETWORK_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' https://cdn.jsdelivr.net data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  async headers() {
    return [
      {
        source: '/calculator/:path*',
        headers: [{ key: 'Content-Security-Policy', value: NO_NETWORK_CSP }],
      },
      {
        source: '/settings/:path*',
        headers: [{ key: 'Content-Security-Policy', value: NO_NETWORK_CSP }],
      },
    ];
  },
};

export default nextConfig;
