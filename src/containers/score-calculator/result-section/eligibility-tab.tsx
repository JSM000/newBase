'use client';

import { useScoreStore } from '@/store/use-score-store';
import {
  calculateTransferEligibility,
  formatMonths,
  TransferType,
} from '@/lib/transfer-eligibility';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';

// ── 배지 설정 ──────────────────────────────────────────────────
const BADGE_CONFIG: Record<
  TransferType,
  { label: string; className: string }
> = {
  school_expiry:   { label: '학교만기',    className: 'bg-amber-500 text-white' },
  regional_expiry: { label: '지역만기',    className: 'bg-orange-500 text-white' },
  voluntary:       { label: '일반희망 가능', className: 'bg-green-600 text-white' },
  too_early:       { label: '신청 불가',   className: 'bg-zinc-400 text-white' },
  ineligible:      { label: '전보 불가',   className: 'bg-red-600 text-white' },
};

// ── 판단 기준 행 ───────────────────────────────────────────────
function CriterionRow({
  label,
  current,
  threshold,
  thresholdLabel,
  met,
}: {
  label: string;
  current: string;
  threshold: string;
  thresholdLabel: string;
  met: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm border-b border-zinc-100 last:border-0">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          met ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-400',
        )}
      >
        {met ? '✓' : '–'}
      </span>
      <span className="w-32 font-medium text-zinc-700">{label}</span>
      <span className={cn('font-mono font-semibold', met ? 'text-primary' : 'text-zinc-500')}>
        {current}
      </span>
      <span className="text-zinc-400">/</span>
      <span className="text-zinc-400">기준 {threshold} {thresholdLabel}</span>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export function EligibilityTab() {
  const result = useScoreStore((state) => state.result);
  const eligibilityInputs = useScoreStore((state) => state.eligibilityInputs);
  const updateEligibilityInput = useScoreStore(
    (state) => state.updateEligibilityInput,
  );

  if (!result) return null;

  const eligibility = calculateTransferEligibility(result, eligibilityInputs);

  return (
    <div className="space-y-5">

      {/* ── 판단 결과 배지 ── */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          전보 대상 여부 판단 결과
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {eligibility.types.map((type) => (
            <span
              key={type}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-bold',
                BADGE_CONFIG[type].className,
              )}
            >
              {BADGE_CONFIG[type].label}
            </span>
          ))}
          <span className="text-sm text-zinc-600">{eligibility.summary}</span>
        </div>

        {/* 전보불가 사유 표시 */}
        {eligibility.isIneligible && (
          <ul className="mt-2 space-y-0.5 text-sm text-red-600">
            {eligibility.ineligibleReasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 세부 판단 기준 ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-zinc-700">판단 기준 세부 내역</p>
        <div>
          {/* 학교만기 */}
          <p className="mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide">학교만기</p>
          <CriterionRow
            label="현임교 인정기간"
            current={formatMonths(eligibility.currentSchoolAdjustedMonths)}
            threshold="60개월"
            thresholdLabel="이상"
            met={eligibility.isSchoolExpiry}
          />
          <div className="mt-4 mb-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">지역만기</p>
          </div>
          <CriterionRow
            label="동지역 누적"
            current={formatMonths(eligibility.dongMonths)}
            threshold="96개월"
            thresholdLabel="초과"
            met={eligibility.isDongExpiry}
          />
          <CriterionRow
            label="읍면지역 누적"
            current={formatMonths(eligibility.eupMyeonMonths)}
            threshold="120개월"
            thresholdLabel="초과"
            met={eligibility.isEupMyeonExpiry}
          />
          <CriterionRow
            label="청주시 통산"
            current={formatMonths(eligibility.totalCheongjuMonths)}
            threshold="156개월"
            thresholdLabel="초과"
            met={eligibility.isTotalExpiry}
          />
          {!eligibility.isIneligible && !eligibility.isSchoolExpiry && !eligibility.isRegionalExpiry && (
            <>
              <div className="mt-4 mb-1">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">일반희망</p>
              </div>
              <CriterionRow
                label="현임교 최소기간"
                current={formatMonths(eligibility.currentSchoolAdjustedMonths)}
                threshold="24개월"
                thresholdLabel="이상"
                met={eligibility.isVoluntaryEligible}
              />
            </>
          )}
        </div>
      </div>

      {/* ── 입력 섹션 ── */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
        <p className="mb-4 font-semibold text-primary-700">근무기간 정보 입력</p>

        {/* 현임교 정보 (자동) */}
        <div className="mb-4 rounded-lg bg-white px-4 py-3 text-sm">
          <p className="font-medium text-zinc-700 mb-1">현임교 (자동 파싱)</p>
          <p className="text-zinc-500">
            {result.currentSchool || '미확인'} ·{' '}
            부임일 {result.currentSchoolStart || '미확인'} ·{' '}
            총 {formatMonths(eligibility.currentSchoolTotalMonths)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 현임교 공제 개월수 */}
          <div className="space-y-1">
            <Label className="text-zinc-700">
              현임교 공제 개월수
              <span className="ml-1 text-xs font-normal text-zinc-400">
                (일반파견·일반휴직·육아휴직 1년 이상)
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={eligibilityInputs.currentSchoolExcludedMonths}
                onChange={(e) =>
                  updateEligibilityInput(
                    'currentSchoolExcludedMonths',
                    parseInt(e.target.value) || 0,
                  )
                }
                className="bg-white"
              />
              <span className="shrink-0 text-sm text-zinc-500">개월</span>
            </div>
            <p className="text-xs text-zinc-400">
              인정기간: {formatMonths(eligibility.currentSchoolAdjustedMonths)}
            </p>
          </div>

          {/* 동지역 누적 */}
          <div className="space-y-1">
            <Label className="text-zinc-700">
              동지역 누적 근무
              <span className="ml-1 text-xs font-normal text-zinc-400">
                (8년 초과 시 지역만기)
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={eligibilityInputs.dongMonths}
                onChange={(e) =>
                  updateEligibilityInput(
                    'dongMonths',
                    parseInt(e.target.value) || 0,
                  )
                }
                className="bg-white"
              />
              <span className="shrink-0 text-sm text-zinc-500">개월</span>
            </div>
          </div>

          {/* 읍면지역 누적 */}
          <div className="space-y-1">
            <Label className="text-zinc-700">
              읍면지역 누적 근무
              <span className="ml-1 text-xs font-normal text-zinc-400">
                (10년 초과 시 지역만기)
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={eligibilityInputs.eupMyeonMonths}
                onChange={(e) =>
                  updateEligibilityInput(
                    'eupMyeonMonths',
                    parseInt(e.target.value) || 0,
                  )
                }
                className="bg-white"
              />
              <span className="shrink-0 text-sm text-zinc-500">개월</span>
            </div>
            <p className="text-xs text-zinc-400">
              통산: {formatMonths(eligibility.totalCheongjuMonths)} / 156개월
            </p>
          </div>
        </div>

        {/* 전보불가 사유 체크박스 */}
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-zinc-700">전보 불가 사유</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={eligibilityInputs.isLeavePlanned}
              onChange={(e) =>
                updateEligibilityInput('isLeavePlanned', e.target.checked)
              }
              className="h-4 w-4 accent-primary"
            />
            2026.3.1.자 휴직·파견 예정
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={eligibilityInputs.isRetirementSoon}
              onChange={(e) =>
                updateEligibilityInput('isRetirementSoon', e.target.checked)
              }
              className="h-4 w-4 accent-primary"
            />
            정년 잔여 1년 미만
          </label>
        </div>
      </div>

      {/* ── 희망지 작성 안내 ── */}
      {!eligibility.isIneligible && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
          <p className="mb-2 font-semibold text-zinc-700">희망지 작성 안내</p>
          <ul className="space-y-1 text-zinc-500">
            {eligibility.types.includes('school_expiry') && (
              <li>• <span className="font-medium text-amber-600">학교만기</span>: 희망지 3개 작성</li>
            )}
            {eligibility.types.includes('regional_expiry') && (
              <li>• <span className="font-medium text-orange-600">지역만기</span>: 희망지 2개 작성</li>
            )}
            {eligibility.types.includes('voluntary') && (
              <li>• <span className="font-medium text-green-600">일반희망</span>: 희망지 1개 작성 (배치 불발 시 1년간 현임교 유지)</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
