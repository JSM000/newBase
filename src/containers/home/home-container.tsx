'use client';

import Link from 'next/link';
import { Calculator, Map as MapIcon, ArrowRight } from 'lucide-react';

const MENUS = [
  {
    href: '/calculator',
    icon: Calculator,
    title: '전보 점수 계산',
    desc: 'NEIS 인사기록카드로 관외전보 점수를 자동 계산하고 전보 대상 여부를 확인합니다.',
    tag: '청주 → 관외',
  },
  {
    href: '/statistics',
    icon: MapIcon,
    title: '충북 학교 통계 지도',
    desc: '지도에서 학교를 골라 전보 점수 관련 지표와 근무 여건 참고 통계를 확인합니다.',
    tag: '유·초·중·고',
  },
] as const;

export function HomeContainer() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="bg-primary px-6 py-8 text-white shadow">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-100">
          교사 전보 지원
        </p>
        <h1 className="mt-1 text-2xl font-bold">전보 점수 계산 · 학교 통계</h1>
        <p className="mt-2 max-w-lg text-sm text-primary-100">
          전보를 준비하는 교사를 위한 점수 계산기와 학교별 참고 통계를 제공합니다.
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {MENUS.map((menu) => {
            const Icon = menu.icon;
            return (
              <Link
                key={menu.href}
                href={menu.href}
                className="group flex flex-col rounded-2xl bg-white p-6 shadow-custom transition-transform hover:-translate-y-0.5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {menu.tag}
                </span>
                <h2 className="text-lg font-bold text-zinc-800">{menu.title}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-zinc-500">
                  {menu.desc}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  바로가기
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-zinc-400">
          현재 점수 계산은 청주교육지원청 → 관외 전보(유치원·초등)만 지원합니다.
          <br />
          모든 수치는 참고용이며, 최종 점수·대상 여부는 교육지원청 공식 서류로 확인하세요.
        </p>
      </main>
    </div>
  );
}
