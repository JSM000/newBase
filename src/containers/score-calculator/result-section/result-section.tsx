'use client';

import { useEffect } from 'react';
import { useScoreStore, TabType } from '@/store/use-score-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fmt } from '@/utils/formatter';
import {
  calculateTransferEligibility,
  TransferType,
} from '@/lib/transfer-eligibility';
import { cn } from '@/utils/cn';
import { AppHeader } from '@/components/app-header';
import { EligibilityTab } from './eligibility-tab';
import { ScoreTab } from './score-tab';
import { CareerTab } from './career-tab';
import { AwardsTab } from './awards-tab';
import { ResearchTab } from './research-tab';
import { TrainingTab } from './training-tab';
import { SupplementaryTab } from './supplementary-tab';

const TRANSFER_BADGE: Record<TransferType, { label: string; className: string }> = {
  school_expiry:   { label: '학교만기',    className: 'bg-amber-500 text-white' },
  regional_expiry: { label: '지역만기',    className: 'bg-orange-500 text-white' },
  voluntary:       { label: '일반희망',    className: 'bg-green-600 text-white' },
  too_early:       { label: '신청불가',    className: 'bg-zinc-400 text-white' },
  ineligible:      { label: '전보불가',    className: 'bg-red-600 text-white' },
};

export function ResultSection() {
  const parsed = useScoreStore((state) => state.parsed);
  const result = useScoreStore((state) => state.result);
  const activeTab = useScoreStore((state) => state.activeTab);
  const setActiveTab = useScoreStore((state) => state.setActiveTab);
  const reset = useScoreStore((state) => state.reset);
  const eligibilityInputs = useScoreStore((state) => state.eligibilityInputs);

  const eligibility = result
    ? calculateTransferEligibility(result, eligibilityInputs)
    : null;

  // 결과 화면을 벗어나면(뒤로가기·탭 닫기 등) 업로드했던 인사기록카드 내용·계산 결과를
  // 브라우저 메모리에서 지운다 — breadcrumb 클릭(아래)이 못 잡는 경로까지 여기서 방어.
  // popstate/pagehide 는 실제 브라우저 이벤트라 React StrictMode 의 effect 이중 실행과
  // 무관 — 마운트 시 등록→해제→재등록만 되고, 진짜 뒤로가기/이탈 때만 콜백이 돈다.
  useEffect(() => {
    window.addEventListener('popstate', reset);
    window.addEventListener('pagehide', reset);
    return () => {
      window.removeEventListener('popstate', reset);
      window.removeEventListener('pagehide', reset);
    };
  }, [reset]);

  const tabs: { value: TabType; label: string }[] = [
    { value: 'eligibility',   label: '전보 판단' },
    { value: 'score',         label: '점수 상세' },
    { value: 'career',        label: `경력 (${parsed?.career.length ?? 0})` },
    { value: 'awards',        label: (() => { const used = result?.awardDetails.filter(d => d.used).length ?? 0; const total = parsed?.awards.length ?? 0; return total > 0 ? `포상 (${used}/${total})` : '포상 (0)'; })() },
    { value: 'research',      label: (() => { const used = result?.researchDetails.filter(d => d.used).length ?? 0; const total = parsed?.research.length ?? 0; return total > 0 ? `연구실적 (${used}/${total})` : '연구실적 (0)'; })() },
    { value: 'training',      label: (() => { const qualified = result?.trainingByYear.filter(y => y.qualifies).length ?? 0; const total = result?.trainingByYear.length ?? 5; return `연수이수 (${qualified}/${total})`; })() },
    { value: 'supplementary', label: `보충기재 (${parsed?.supplementary.length ?? 0})` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        items={[
          // 결과 화면에서 앞 단계로 되돌아가는 거라 "정보 지우고 다시 업로드"와 동일하게
          // 전부 reset() — 업로드했던 데이터를 남겨둔 채 이동하지 않는다.
          { label: 'NewBase', href: '/', onClick: reset },
          { label: '지역 선택', href: '/calculator', onClick: reset },
          { label: '업로드', onClick: reset },
          { label: '계산결과' },
        ]}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
        {parsed?.parseErrors && parsed.parseErrors.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              <p className="mb-1 font-semibold">파싱 경고</p>
              {parsed.parseErrors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="rounded-xl bg-white p-6 shadow-custom">
            <div className="flex flex-wrap items-start gap-6">
              {/* 점수 요약 */}
              <div className="flex flex-wrap items-baseline gap-6">
                <div className="text-center">
                  <p className="text-sm text-zinc-500">총점</p>
                  <p className="text-5xl font-bold text-primary">
                    {fmt(result.grandTotal)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">점</p>
                </div>
                <div className="flex flex-wrap gap-6 text-center">
                  <div>
                    <p className="text-xs text-zinc-400">경력점</p>
                    <p className="text-2xl font-semibold text-zinc-700">
                      {fmt(result.totalCareer)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">가산점</p>
                    <p className="text-2xl font-semibold text-green-600">
                      {fmt(result.totalBonus)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">실적점</p>
                    <p className="text-2xl font-semibold text-secondary">
                      {fmt(result.totalPerformance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 전보 유형 배지 */}
              {eligibility && (
                <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                  {eligibility.types.map((type) => (
                    <span
                      key={type}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-bold',
                        TRANSFER_BADGE[type].className,
                      )}
                    >
                      {TRANSFER_BADGE[type].label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabType)}
          className="overflow-hidden rounded-xl bg-white shadow-custom"
        >
          <TabsList className="flex h-auto flex-wrap rounded-none border-b bg-transparent p-0">
            {tabs.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="whitespace-nowrap rounded-none bg-transparent px-4 py-3 text-sm font-medium text-zinc-500 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="p-4">
            <TabsContent value="eligibility"><EligibilityTab /></TabsContent>
            <TabsContent value="score"><ScoreTab /></TabsContent>
            <TabsContent value="career"><CareerTab /></TabsContent>
            <TabsContent value="awards"><AwardsTab /></TabsContent>
            <TabsContent value="research"><ResearchTab /></TabsContent>
            <TabsContent value="training"><TrainingTab /></TabsContent>
            <TabsContent value="supplementary"><SupplementaryTab /></TabsContent>
          </div>
        </Tabs>

        <p className="pb-4 text-center text-xs text-zinc-400">
          근거: 충청북도청주교육지원청 초등교육공무원 인사관리기준 (2025.7.16.
          개정, 2026.3.1. 시행) · 이 도구는 참고용이며 공식 서류로 반드시
          확인하세요.
        </p>
      </main>
    </div>
  );
}
