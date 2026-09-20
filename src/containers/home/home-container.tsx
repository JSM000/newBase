'use client';

import Link from 'next/link';
import { Calculator, Map as MapIcon, CircleUserRound } from 'lucide-react';
import { AppHeader } from '@/components/app-header';

const MENUS = [
  {
    href: '/settings',
    icon: CircleUserRound,
    title: '내 정보 설정',
    desc: '지역가산·우대가산 등 자주 쓰는 개인 정보를 미리 저장해두고 다음에도 자동으로 불러옵니다.',
  },
  {
    href: '/calculator',
    icon: Calculator,
    title: '전보 점수 계산',
    desc: 'NEIS 인사기록카드로 관외전보 점수를 자동 계산하고 전보 대상 여부를 확인합니다.',
  },
  {
    href: '/statistics',
    icon: MapIcon,
    title: '충북 학교 통계 지도',
    desc: '지도에서 학교를 골라 전보 점수·근무 여건 통계를 보고, 집에서 학교까지 소요시간도 확인합니다.',
  },
] as const;

export function HomeContainer() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <AppHeader
        items={[{ label: 'NewBase' }]}
        subtitle="전보를 준비하는 교사를 위한 서비스"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">

        {/* auto-fit: 정해진 칸 수(sm:grid-cols-2 등) 대신, 카드 하나가 최소 280px을 확보하는 한도 내에서
            화면 폭에 맞춰 한 줄에 들어갈 수 있는 만큼 채우고, 넘치면 다음 줄로 넘어간다.
            카드 개수가 늘어도 이 값만 유지하면 계속 반응형으로 동작한다. */}
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {MENUS.map((menu) => {
            const Icon = menu.icon;
            return (
              <Link
                key={menu.href}
                href={menu.href}
                className="group flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-custom transition-transform hover:-translate-y-0.5"
              >
                <div className="flex h-56 w-56 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Icon className="h-36 w-36" />
                </div>
                {/* 평소엔 아이콘만 — 호버 시 grid-template-rows 를 0fr→1fr 로 늘려 부드럽게 펼침
                    (max-h 로 임의 픽셀 지정하면 설명이 길 때 잘릴 수 있어 1fr 트릭 사용) */}
                <div className="grid w-full grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
                  <div className="overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <h2 className="mt-3 text-lg font-bold text-zinc-800">{menu.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                      {menu.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
