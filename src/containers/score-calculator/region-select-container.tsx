'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { SidoDetailMap } from '@/components/sido-detail-map';
import { AppHeader } from '@/components/app-header';

const SIDO_CODE = '33';
const SIDO_NAME = '충청북도';

const TRANSFER_TYPES = [
  { id: 'intra', label: '관내 이동', sub: '같은 교육지원청 관내' },
  { id: 'inter', label: '관외 이동', sub: '다른 시·군 교육지원청' },
] as const;

export function RegionSelectContainer() {
  const [sigungu, setSigungu] = useState<string | null>(null);
  const [transferType, setTransferType] = useState<string | null>(null);
  const router = useRouter();

  const isSupported = sigungu === '청주시' && transferType === 'inter';
  const isUnsupported = transferType !== null && !isSupported;

  const handleModalClose = () => {
    setSigungu(null);
    setTransferType(null);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <AppHeader
        title="전보 점수 계산"
        subtitle="현재 근무지를 선택하세요"
        actions={
          <button
            onClick={() => router.push('/')}
            className="text-sm text-primary-100 underline hover:text-white"
          >
            홈으로
          </button>
        }
      />

      {/* 지도 영역 */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-3 shadow-custom">

          <div className="mb-2 flex shrink-0 items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {SIDO_NAME}
            </p>
          </div>

          <div className="min-h-0 flex-1">
            <SidoDetailMap
              sidoCode={SIDO_CODE}
              selected={sigungu}
              onSelect={(name) => { setSigungu(name); setTransferType(null); }}
            />
          </div>

        </div>
      </div>

      {/* 이동 유형 모달 */}
      {sigungu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={handleModalClose}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">선택된 근무지</p>
              <p className="mt-1 text-lg font-bold text-zinc-800">{SIDO_NAME} · {sigungu}</p>
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">이동 유형</p>
            <div className="grid grid-cols-2 gap-3">
              {TRANSFER_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTransferType(t.id)}
                  className={cn(
                    'rounded-xl border-2 p-4 text-left transition-all',
                    transferType === t.id
                      ? 'border-primary bg-primary-50'
                      : 'border-zinc-100 hover:border-primary-200 hover:bg-zinc-50',
                  )}
                >
                  <p className={cn('font-semibold', transferType === t.id ? 'text-primary' : 'text-zinc-700')}>
                    {t.label}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">{t.sub}</p>
                </button>
              ))}
            </div>

            <div className="mt-4">
              {isUnsupported && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-700">
                  해당 전보 유형은 아직 개발 중입니다.
                </div>
              )}
              {isSupported && (
                <button
                  onClick={() => router.push('/calculator/score')}
                  className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  점수 계산 시작
                </button>
              )}
            </div>

            <button onClick={handleModalClose} className="mt-3 w-full py-2 text-sm text-zinc-400 hover:text-zinc-600">
              다시 선택
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
