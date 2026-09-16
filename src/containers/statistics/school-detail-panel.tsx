'use client';

import { Eye, X } from 'lucide-react';
import type { School } from '@/types/school-stats';
import type { SchoolZoneLink } from '@/types/school-zones';
import { DETAIL_GROUPS } from '@/lib/school-indicators';
import { schulKndLabel } from '@/lib/school-region';
import type { SocialEntry } from '@/hooks/use-school-social';
import { SchoolRating } from './school-rating';

/** 'idle' = 상세 패널이 안 열림, 'unmatched' = 학구도 쪽 이름 매칭 실패(섹션 자체를 숨김) */
export type ZoneMatchStatus = 'idle' | 'loading' | 'matched' | 'unmatched';

interface SchoolDetailPanelProps {
  school: School | null;
  onClose: () => void;
  zoneStatus: ZoneMatchStatus;
  zoneLink: SchoolZoneLink | null;
  /** 별점·조회수 기능 활성 여부 (Supabase env 설정 시) */
  socialEnabled?: boolean;
  /** 이 학교의 별점 집계 + 조회수 */
  social?: SocialEntry;
  /** 이 브라우저가 남긴 별점 */
  myRating?: number | null;
  onRate?: (rating: number) => void;
}

function formatFounded(ymd: string | null): string | null {
  if (!ymd || ymd.length !== 8) return null;
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)} 설립`;
}

function isNewSchool(ymd: string | null): boolean {
  if (!ymd || ymd.length !== 8) return false;
  const year = Number(ymd.slice(0, 4));
  return Number.isFinite(year) && new Date().getFullYear() - year <= 5;
}

/** 학구(통학구역) 안내 섹션 — 지도 위 색칠(전용=진한 색/실선, 공동=옅은 색/점선)과 스타일을 맞춘다. */
function ZoneSection({
  school,
  zoneStatus,
  zoneLink,
}: {
  school: School;
  zoneStatus: ZoneMatchStatus;
  zoneLink: SchoolZoneLink | null;
}) {
  if (zoneStatus === 'unmatched' || zoneStatus === 'idle') return null;

  if (zoneStatus === 'loading') {
    return <p className="text-xs text-zinc-400">학구 정보 불러오는 중…</p>;
  }

  const dedicated = zoneLink?.dedicated ?? [];
  const shared = zoneLink?.shared ?? [];

  if (dedicated.length === 0 && shared.length === 0) {
    return (
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">학구(통학구역)</h3>
        <p className="text-xs text-zinc-400">
          {school.schulKndCode === '04'
            ? '비평준화 지역 — 별도로 지정된 학구가 없습니다.'
            : '등록된 학구 정보가 없습니다.'}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">학구(통학구역)</h3>
      <div className="flex flex-col gap-1.5">
        {dedicated.map((zone) => (
          <span
            key={zone.zoneId}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700"
          >
            <span className="h-2 w-2 shrink-0 rounded-sm bg-blue-500" />
            {zone.zoneName}
          </span>
        ))}
        {shared.length > 0 && (
          <p className="text-[11px] text-zinc-400">
            아래 공동구역은 다른 학교와 함께 배정되는 지역입니다 (지도에 점선으로 표시).
          </p>
        )}
        {shared.map((zone) => (
          <span
            key={zone.zoneId}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700"
          >
            <span className="h-2 w-2 shrink-0 rounded-sm border border-dashed border-amber-500" />
            {zone.zoneName}
          </span>
        ))}
      </div>
    </section>
  );
}

export function SchoolDetailPanel({
  school,
  onClose,
  zoneStatus,
  zoneLink,
  socialEnabled = false,
  social,
  myRating = null,
  onRate,
}: SchoolDetailPanelProps) {
  if (!school) return null;

  const founded = formatFounded(school.foundedYmd);
  const views = social?.views ?? 0;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-800">{school.schulNm}</h2>
            {isNewSchool(school.foundedYmd) && (
              <span className="rounded bg-secondary-100 px-1.5 py-0.5 text-[11px] font-semibold text-secondary-700">
                신설
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {schulKndLabel(school.schulKndCode)}
            {school.fondScCode ? ` · ${school.fondScCode}` : ''}
            {school.adrcdNm ? ` · ${school.adrcdNm.replace('충청북도 ', '')}` : ''}
          </p>
          {school.eduSupportOfficeNm && (
            <p className="text-xs text-zinc-400">
              {school.eduSupportOfficeNm.replace('충청북도', '')}
            </p>
          )}
          {socialEnabled && (
            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
              <Eye className="h-3.5 w-3.5" />조회 {views.toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {(school.address || founded) && (
          <p className="text-xs leading-relaxed text-zinc-500">
            {school.roadAddress || school.address}
            {founded ? ` · ${founded}` : ''}
          </p>
        )}

        <ZoneSection school={school} zoneStatus={zoneStatus} zoneLink={zoneLink} />
        {socialEnabled && onRate && (
          <SchoolRating
            avg={social?.avg ?? null}
            count={social?.count ?? 0}
            myRating={myRating}
            onRate={onRate}
          />
        )}

        {DETAIL_GROUPS.map((group) => (
          <section key={group.title}>
            <h3
              className={
                'mb-2 text-xs font-semibold uppercase tracking-wide ' +
                (group.category === 'score' ? 'text-primary' : 'text-secondary')
              }
            >
              {group.title}
            </h3>
            <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-100">
              {group.fields.map((field) => {
                const value = field.render(school);
                const reason = field.excludedReasonField
                  ? (school[field.excludedReasonField] as string | null)
                  : null;
                const showReason = value === '—' && reason;
                return (
                  <div key={field.label} className="px-3 py-2 text-sm">
                    <dt className="flex items-center gap-1 text-xs text-zinc-400">
                      {field.label}
                      {field.estimated && (
                        <span className="text-[10px] font-semibold text-amber-500">추정</span>
                      )}
                    </dt>
                    <dd className="mt-0.5 text-zinc-700">{value}</dd>
                    {showReason && (
                      <dd className="mt-0.5 text-[11px] leading-snug text-amber-600">
                        공시제외: {reason}
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </section>
        ))}

        {school.specialistSubjectTeacherBySubject && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              과목별 교원수
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(school.specialistSubjectTeacherBySubject)
                .filter(([, cnt]) => cnt > 0)
                .map(([subject, cnt]) => (
                  <span
                    key={subject}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600"
                  >
                    {subject} {cnt}
                  </span>
                ))}
              {Object.values(school.specialistSubjectTeacherBySubject).every((c) => c === 0) && (
                <span className="text-[11px] text-zinc-400">자료 없음</span>
              )}
            </div>
          </section>
        )}

        <p className="border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-400">
          출처: 학교알리미 공시자료. 점수 참고 지표는 학교 속성으로 좌우되는 항목만 표시하며,
          실제 점수는 개인 이력·교육지원청 공식 서류로 확인해야 합니다.
        </p>
      </div>
    </aside>
  );
}
