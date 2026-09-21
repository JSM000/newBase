'use client';

import { Fragment } from 'react';
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

/**
 * 전용/공동구역 개수 뱃지 — 학구 목록이 길면 패널을 너무 많이 차지해서, 개수만 보여주고
 * 마우스를 올리면(hover) 실제 학구명 목록을 팝오버로 띄운다. 새 의존성 없이 CSS group-hover로.
 */
function ZoneCountBadge({
  label,
  zones,
  swatchClassName,
  badgeClassName,
}: {
  label: string;
  zones: { zoneId: string; zoneName: string }[];
  swatchClassName: string;
  badgeClassName: string;
}) {
  if (zones.length === 0) return null;
  return (
    <span
      className={`group relative inline-flex w-fit cursor-default items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${badgeClassName}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-sm ${swatchClassName}`} />
      {label} {zones.length}개
      <div className="invisible absolute left-0 top-full z-20 mt-1 w-max max-w-[260px] flex-col gap-1 rounded-md border border-zinc-200 bg-white p-2 text-[11px] text-zinc-600 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:flex group-hover:opacity-100">
        {zones.map((zone) => (
          <span key={zone.zoneId}>{zone.zoneName}</span>
        ))}
      </div>
    </span>
  );
}

/**
 * 학교급별 공식 명칭 — 학구도 공공데이터 표준(안)의 HAKGUDO_GB 코드정의 기준.
 * 초등=통학구역/공동통학구역, 중=중학구/공동학구. 고등학교는 학교군만 있고 공동 개념이
 * 없어(zones.length===0이면 ZoneCountBadge가 알아서 안 그림) shared 라벨은 실제로 안 쓰인다.
 */
const ZONE_LABELS: Record<School['schulKndCode'], { dedicated: string; shared: string }> = {
  '02': { dedicated: '통학구역', shared: '공동통학구역' },
  '03': { dedicated: '중학구', shared: '공동학구' },
  '04': { dedicated: '학교군', shared: '공동학교군' },
};

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

  const labels = ZONE_LABELS[school.schulKndCode];

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">학구(통학구역)</h3>
      <div className="flex flex-wrap gap-1.5">
        <ZoneCountBadge
          label={labels.dedicated}
          zones={dedicated}
          swatchClassName="bg-blue-500"
          badgeClassName="border-blue-300 bg-blue-50 text-blue-700"
        />
        <ZoneCountBadge
          label={labels.shared}
          zones={shared}
          swatchClassName="border border-dashed border-amber-500"
          badgeClassName="border-dashed border-amber-300 bg-amber-50 text-amber-700"
        />
      </div>
    </section>
  );
}

/**
 * DETAIL_GROUPS 의 일반 텍스트 필드(render가 string만 반환)로는 표를 못 그려서,
 * 눈에 잘 띄어야 하는 항목들은 여기서 표로 따로 렌더한다.
 */
function MiniStatTable({ cols }: { cols: { label: string; content: React.ReactNode }[] }) {
  return (
    <table className="w-full table-fixed border-collapse overflow-hidden rounded-md border border-zinc-200 text-center">
      <thead>
        <tr className="bg-zinc-50">
          {cols.map((c) => (
            <th
              key={c.label}
              className="border border-zinc-200 px-1 py-1 text-[11px] font-medium text-zinc-500"
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {cols.map((c) => (
            <td key={c.label} className="border border-zinc-200 py-1 text-sm text-zinc-700">
              {c.content}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** "과목별 교원수"와 같은 알약 뱃지 — 교원수 표(MiniStatTable) 외의 나머지 표 대체 항목이 쓴다. */
function PillGroup({ cols }: { cols: { label: string; content: React.ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {cols.map((c) => (
        <span
          key={c.label}
          className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600"
        >
          {c.label} {c.content}
        </span>
      ))}
    </div>
  );
}

/**
 * 상세 필드 한 행 — 라벨(선택) + (사유 없으면) PillGroup 또는 MiniStatTable, 있으면 "—"+사유.
 * variant="table" 이면 교원수 계열처럼 표로, 기본(pills)이면 알약 뱃지로 그린다.
 */
function TableDetailRow({
  label,
  reason,
  cols,
  variant = 'pills',
}: {
  label?: string;
  reason: string | null;
  cols: { label: string; content: React.ReactNode }[];
  variant?: 'pills' | 'table';
}) {
  return (
    <div className="px-3 py-2 text-sm">
      {label && <dt className="text-xs text-zinc-400">{label}</dt>}
      {reason ? (
        <dd className="mt-0.5 text-zinc-700">—</dd>
      ) : (
        <dd className="mt-1.5">
          {variant === 'table' ? <MiniStatTable cols={cols} /> : <PillGroup cols={cols} />}
        </dd>
      )}
      {reason && (
        <dd className="mt-0.5 text-[11px] leading-snug text-amber-600">공시제외: {reason}</dd>
      )}
    </div>
  );
}

/** O/X 배지 — 배치/보유돼 있으면 초록 ○, 없으면 빨강 ✕, 값 자체를 모르면 회색 —. */
function okBadge(has: boolean | null): React.ReactNode {
  if (has === null) return <span className="text-zinc-300">—</span>;
  return <span className={has ? 'text-emerald-600' : 'text-red-500'}>{has ? '○' : '✕'}</span>;
}

/** 기간제 · 강사 · 휴직 인원수. */
function StaffStatusRow({ school }: { school: School }) {
  return (
    <TableDetailRow
      label="교원 공백"
      reason={school.teacherStatusExcludedReason}
      cols={[
        { label: '기간제', content: `${school.contractTeacherCount ?? 0}명` },
        { label: '강사', content: `${school.instructorCount ?? 0}명` },
        { label: '휴직', content: `${school.teacherOnLeaveCount ?? 0}명` },
      ]}
    />
  );
}

/** 보건 · 영양 · 사서교사 배치 여부. */
function StaffAvailabilityRow({ school }: { school: School }) {
  return (
    <TableDetailRow
      label="비교과교사 배치"
      reason={school.teacherStatusExcludedReason}
      cols={[
        { label: '보건', content: okBadge((school.healthTeacherCount ?? 0) > 0) },
        { label: '영양', content: okBadge((school.nutritionTeacherCount ?? 0) > 0) },
        { label: '사서', content: okBadge((school.librarianTeacherCount ?? 0) > 0) },
        { label: '상담', content: okBadge((school.counselorTeacherCount ?? 0) > 0) },
      ]}
    />
  );
}

/** 과목별 교원수 — "교과전담 규모 (추정)" 필드 안에 딸린 세부 내역. */
function SubjectTeacherBreakdown({ school }: { school: School }) {
  const bySubject = school.specialistSubjectTeacherBySubject;
  if (!bySubject) return null;
  const entries = Object.entries(bySubject).filter(([, cnt]) => cnt > 0);
  return (
    <div className="px-3 py-2 text-sm">
      <dt className="text-xs text-zinc-400">과목별 교원수</dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">
        {entries.length > 0 ? (
          entries.map(([subject, cnt]) => (
            <span
              key={subject}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600"
            >
              {subject} {cnt}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-zinc-400">자료 없음</span>
        )}
      </dd>
    </div>
  );
}

/** 전입 · 전출 학생수 표. */
function TransferStudentRow({ school }: { school: School }) {
  return (
    <TableDetailRow
      label="전입 · 전출 학생수"
      reason={school.transferStudentExcludedReason}
      cols={[
        { label: '전입', content: `${school.transferInStudentCount ?? 0}명` },
        { label: '전출', content: `${school.transferOutStudentCount ?? 0}명` },
      ]}
    />
  );
}

/** 행정 지원인력(일반직 · 공무직) 표. */
function AdminStaffRow({ school }: { school: School }) {
  return (
    <TableDetailRow
      label="행정 지원인력"
      reason={school.staffExcludedReason}
      cols={[
        { label: '일반직', content: `${school.generalStaffCount ?? 0}명` },
        { label: '공무직', content: `${school.eduSupportStaffCount ?? 0}명` },
      ]}
    />
  );
}

/** 상담 지원체계(내부상담 · 외부상담 · Wee클래스) 여부 표. */
function CounselingRow({ school }: { school: School }) {
  return (
    <TableDetailRow
      label="상담 지원체계"
      reason={school.counselingExcludedReason}
      cols={[
        { label: '내부상담', content: okBadge(school.hasInnerCounselor) },
        { label: '외부상담', content: okBadge(school.hasOuterCounselor) },
        { label: 'Wee클래스', content: okBadge(school.hasWeeClass) },
      ]}
    />
  );
}

/** 교원지원공간 · 체육관 · 강당 개수 표. */
function FacilitiesRow({ school }: { school: School }) {
  return (
    <TableDetailRow
      label="시설"
      reason={school.facilitiesExcludedReason}
      cols={[
        { label: '교원지원공간', content: `${school.teacherSupportSpaceCount ?? 0}개` },
        { label: '체육관', content: `${school.gymnasiumCount ?? 0}개` },
        { label: '강당', content: `${school.auditoriumCount ?? 0}개` },
      ]}
    />
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
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-2xl">
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
                  <Fragment key={field.label}>
                    <div className="px-3 py-2 text-sm">
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
                    {field.label === '전체 교원수' && (
                      <>
                        <StaffStatusRow school={school} />
                        <StaffAvailabilityRow school={school} />
                        <TransferStudentRow school={school} />
                        <AdminStaffRow school={school} />
                        <CounselingRow school={school} />
                      </>
                    )}
                    {field.label === '교과전담 규모 (추정)' && (
                      <SubjectTeacherBreakdown school={school} />
                    )}
                    {field.label === '시설안전 점검' && <FacilitiesRow school={school} />}
                  </Fragment>
                );
              })}
            </dl>
          </section>
        ))}

        <p className="border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-400">
          출처: 학교알리미 공시자료. 점수 참고 지표는 학교 속성으로 좌우되는 항목만 표시하며,
          실제 점수는 개인 이력·교육지원청 공식 서류로 확인해야 합니다.
        </p>
      </div>
    </aside>
  );
}
