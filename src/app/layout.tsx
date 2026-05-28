import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/provider/query-provider';

export const metadata: Metadata = {
  title: '관외전보 점수 계산기 | 유초등 교사',
  description: '청주교육지원청 유치원·초등교사 관외 전보 점수 자동 계산',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
