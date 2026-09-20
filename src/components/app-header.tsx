'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface BreadcrumbItem {
  label: string;
  /** 실제 라우트가 있으면 href(Link) — /calculator 처럼 URL이 바뀌는 단계 */
  href?: string;
  /** URL 없이 클라 상태만 바뀌는 단계(예: 계산기 업로드↔결과, zustand step) — onClick으로 전환 */
  onClick?: () => void;
}

interface AppHeaderProps {
  /** 노션 스타일 경로 — 마지막 항목이 현재 위치(클릭 불가). href/onClick 둘 다 없으면 현재 위치로 취급 */
  items: BreadcrumbItem[];
  /** 경로 이동이 아닌 별도 동작(예: 데이터 초기화)만 오른쪽에 남김 */
  actions?: ReactNode;
  /** 경로 아래에 작게 표시할 한 줄 설명 — 홈(items 1개, 브랜드 단독 노출)에서만 쓰는 용도 */
  subtitle?: string;
}

// 클릭 가능한 항목의 hover — 색만 바뀌면 눈에 잘 안 띄어서, 배경 필(pill) + 밑줄까지 같이 준다.
const CRUMB_CLASS =
  'shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 -mx-1.5 text-primary-100 underline decoration-transparent underline-offset-2 transition-colors hover:bg-white/15 hover:text-white hover:decoration-white';

/**
 * 전 페이지 공용 헤더 — 경로형(breadcrumb) 내비게이션.
 * 각 단계를 눌러 그 단계로 바로 이동할 수 있다. URL 단계는 href, 같은 URL 안에서
 * 상태만 바뀌는 단계(계산기 업로드/결과 등)는 onClick으로 넘긴다.
 */
export function AppHeader({ items, actions, subtitle }: AppHeaderProps) {
  // 경로가 "NewBase" 하나뿐 = 루트(홈)에 있다는 뜻 — 이때만 브랜드 글자를 크게 키운다.
  // 여러 단계가 늘어선 다른 페이지에서 첫 항목만 키우면 정렬이 깨져서 그 경우엔 그대로 둔다.
  const soloRoot = items.length === 1;

  return (
    <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between gap-3 bg-primary px-4 py-3 text-white shadow sm:px-6">
      <div className="min-w-0">
        <nav
          aria-label="경로"
          className={cn(
            'flex min-w-0 items-center gap-2 overflow-x-auto',
            soloRoot ? 'text-3xl' : 'text-xl',
          )}
        >
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            const clickable = !isLast && (item.href || item.onClick);
            return (
              <Fragment key={`${item.label}-${i}`}>
                {i > 0 && <ChevronRight className="h-5 w-5 shrink-0 text-primary-200" />}
                {isLast || !clickable ? (
                  <span
                    className={cn(
                      'shrink-0 whitespace-nowrap',
                      isLast ? 'font-semibold text-white' : 'text-primary-100',
                    )}
                  >
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Link href={item.href} onClick={item.onClick} className={CRUMB_CLASS}>
                    {item.label}
                  </Link>
                ) : (
                  <button type="button" onClick={item.onClick} className={CRUMB_CLASS}>
                    {item.label}
                  </button>
                )}
              </Fragment>
            );
          })}
        </nav>
        {subtitle && <p className="mt-0.5 truncate text-sm text-primary-100">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}
