'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { KoreaMap } from '@/components/korea-map';
import { SidoDetailMap } from '@/components/sido-detail-map';

const TRANSFER_TYPES = [
  { id: 'intra', label: '관내 이동', sub: '같은 교육지원청 관내' },
  { id: 'inter', label: '관외 이동', sub: '다른 시·군 교육지원청' },
] as const;

type Step = 'sido' | 'sigungu';

export function HomeContainer() {
  const [step, setStep] = useState<Step>('sido');
  const [sidoCode, setSidoCode] = useState<string | null>(null);
  const [sidoName, setSidoName] = useState<string | null>(null);
  const [sigungu, setSigungu] = useState<string | null>(null);
  const [transferType, setTransferType] = useState<string | null>(null);
  const router = useRouter();

  const isSupported = sidoCode === '33' && sigungu === '청주시' && transferType === 'inter';
  const isUnsupported = transferType !== null && !isSupported;

  const handleSidoSelect = (code: string, name: string) => {
    setSidoCode(code);
    setSidoName(name);
    setSigungu(null);
    setTransferType(null);
    setStep('sigungu');
  };

  const handleBack = () => {
    setStep('sido');
    setSidoCode(null);
    setSidoName(null);
    setSigungu(null);
    setTransferType(null);
  };

  const handleModalClose = () => {
    setSigungu(null);
    setTransferType(null);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      {/* 헤더 */}
      <div className="shrink-0 px-6 py-4 text-center">
        <h1 className="text-xl font-bold text-zinc-800">전보 점수 계산</h1>
        <p className="mt-0.5 text-sm text-zinc-500">현재 근무지를 선택하세요</p>
      </div>

      {/* 지도 영역 — 나머지 공간 전부 */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-3 shadow-custom">

          {/* 지도 헤더 */}
          <div className="mb-2 flex shrink-0 items-center gap-2">
            {step === 'sigungu' && (
              <button onClick={handleBack} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {step === 'sido' ? '시·도 선택' : sidoName ?? ''}
            </p>
          </div>

          {/* 지도 — 남은 높이 전부 채움 */}
          <div className="min-h-0 flex-1">
            {step === 'sido' ? (
              <KoreaMap selected={sidoCode} onSelect={handleSidoSelect} />
            ) : (
              <SidoDetailMap
                sidoCode={sidoCode!}
                selected={sigungu}
                onSelect={(name) => { setSigungu(name); setTransferType(null); }}
              />
            )}
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
              <p className="mt-1 text-lg font-bold text-zinc-800">{sidoName} · {sigungu}</p>
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
                  onClick={() => router.push('/calculator')}
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
