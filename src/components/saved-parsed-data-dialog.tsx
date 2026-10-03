'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, HardDrive, ShieldCheck } from 'lucide-react';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { getExpiresAt } from '@/lib/settings-retention';
import { formatDateTime } from '@/utils/formatter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ParsedFile } from '@/types/score';

interface SavedParsedDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 설정 페이지·업로드 모달에서 "이 기기에 저장된 인사기록카드 추출 데이터"를 그대로 보여주는 모달.
 * 무엇이 저장됐고(항목별 실제 값), 무엇은 저장하지 않았는지(원본 파일, 읽지 않은 구획),
 * 어디에 언제까지 남는지를 사용자가 직접 확인할 수 있게 한다 — 개인정보 처리 투명성.
 *
 * 표시하는 값은 localStorage의 savedParsedFile 그대로다(가공·요약 없이). 화면에만 그리고
 * 어디로도 보내지 않는다(개인정보 스캔 대상: scripts/check-no-network-in-score-calc.mjs).
 */

/** 파서(excel-parser.ts parseExcelBuffer)가 추출하지 않는 구획 — 저장 데이터에 없다. */
const NOT_EXTRACTED_SECTIONS = [
  '인적사항(성명·주민등록번호·주소·연락처 등)',
  '학력사항',
  '자격면허',
  '외국어 능력',
  '국외시찰 및 수학',
  '징계',
  '가산점',
  '비고',
  '승급 기록',
  '호봉획정근거',
  '자격취득',
  '임용 전 경력',
];

function period(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  return `${start || '?'} ~ ${end || '현재'}`;
}

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

const SUPPLEMENTARY_LABEL: Record<ParsedFile['supplementary'][number]['type'], string> = {
  subject_class: '교과전담',
  homeroom: '담임',
  special_ed: '특수통합학급',
  multigrade: '복식학급',
  other: '기타',
};

/** 접었다 펼 수 있는 항목 섹션 — 연수처럼 행이 많은 항목이 화면을 다 차지하지 않게 기본은 접힘. */
function DataSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={count === 0}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-transparent"
        aria-expanded={open}
      >
        <span className="font-medium text-zinc-700">{title}</span>
        <span className="flex items-center gap-1 text-xs text-zinc-400">
          {count}건
          {count > 0 && (
            <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
          )}
        </span>
      </button>
      {open && count > 0 && <div className="overflow-x-auto border-t border-zinc-200">{children}</div>}
    </section>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full min-w-max border-collapse text-xs">
      <thead>
        <tr className="bg-zinc-50">
          {headers.map((h) => (
            <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-zinc-500">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i} className="border-t border-zinc-100 align-top">
            {cells.map((c, j) => (
              <td key={j} className="px-2 py-1.5 text-zinc-700">
                {c === '' || c === null || c === undefined ? <span className="text-zinc-300">—</span> : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SavedDataTables({ data }: { data: ParsedFile }) {
  return (
    <div className="space-y-2">
      <DataSection title="경력" count={data.career.length}>
        <DataTable
          headers={['기간', '임용구분', '직위', '부서', '소속']}
          rows={data.career.map((c) => [
            period(c.startDate, c.endDate),
            c.appointmentType,
            c.rank,
            c.department,
            c.school,
          ])}
        />
      </DataSection>

      <DataSection title="포상" count={data.awards.length}>
        <DataTable
          headers={['일자', '훈격', '포상명', '수여기관']}
          rows={data.awards.map((a) => [a.date, a.grade, a.name, a.agency])}
        />
      </DataSection>

      <DataSection title="연구실적" count={data.research.length}>
        <DataTable
          headers={['연구 제목', '연구 기간', '구분', '등급', '입상일', '연구자 수']}
          rows={data.research.map((r) => [
            r.title,
            period(r.startDate, r.endDate),
            r.levelType === 'national' ? '전국' : '도',
            `${r.grade}등급`,
            r.awardDate,
            `${r.researcherCount}명`,
          ])}
        />
      </DataSection>

      <DataSection title="연수 이수" count={data.training.length}>
        <DataTable
          headers={['연수명', '기관', '구분', '기간', '이수 시간', '업무관련', '등록일', '과정번호']}
          rows={data.training.map((t) => [
            t.name,
            t.institution,
            t.type,
            period(t.startDate, t.endDate),
            minutesToHours(t.durationMinutes),
            t.workRelated ? 'Y' : 'N',
            t.registrationDate,
            t.id,
          ])}
        />
      </DataSection>

      <DataSection title="대학원 학위" count={data.degrees.length}>
        <DataTable
          headers={['학교', '전공', '학위', '취득일']}
          rows={data.degrees.map((d) => [d.school, d.major, d.degree, d.completionDate])}
        />
      </DataSection>

      <DataSection title="보충기재" count={data.supplementary.length}>
        <DataTable
          headers={['구분', '기간', '소속', '교무행정지원팀', '기재 내용']}
          rows={data.supplementary.map((s) => [
            SUPPLEMENTARY_LABEL[s.type],
            period(s.startDate, s.endDate),
            s.school,
            s.type === 'subject_class' ? (s.isAdminTeam ? 'Y' : 'N') : '',
            <span key="detail" className="block max-w-[28rem] whitespace-pre-wrap break-words">
              {s.detail}
            </span>,
          ])}
        />
      </DataSection>
    </div>
  );
}

export function SavedParsedDataDialog({ open, onOpenChange }: SavedParsedDataDialogProps) {
  const savedParsedFile = useUserSettingsStore((s) => s.savedParsedFile);
  // 자동 삭제는 설정 전체의 마지막 저장 시각(savedAt) 기준이다(use-user-settings-store checkExpiry).
  const settingsSavedAt = useUserSettingsStore((s) => s.savedAt);
  const clearParsedFile = useUserSettingsStore((s) => s.clearParsedFile);

  const data = savedParsedFile?.data ?? null;
  const expiresAt = settingsSavedAt ? getExpiresAt(settingsSavedAt) : null;
  // 실제로 이 기기에 쓰인 크기(대략) — JSON 문자열 길이 기준.
  const sizeKb = savedParsedFile
    ? Math.max(1, Math.round(JSON.stringify(savedParsedFile).length / 1024))
    : 0;

  function handleDelete() {
    if (!window.confirm('이 기기에 저장된 인사기록카드 데이터를 삭제할까요?')) return;
    clearParsedFile();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>저장된 인사기록카드 데이터</DialogTitle>
          <DialogDescription>
            인사기록카드에서 점수 계산에 쓰는 항목만 추출해 이 기기에 저장한 내용입니다.
          </DialogDescription>
        </DialogHeader>

        {!savedParsedFile || !data ? (
          <p className="py-8 text-center text-sm text-zinc-400">이 기기에 저장된 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {/* 저장 위치·기간 */}
            <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-xs text-zinc-400">저장 위치</p>
                  <p className="text-zinc-700">이 브라우저의 로컬 저장소 (약 {sizeKb}KB)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs text-zinc-400">서버 전송</p>
                  <p className="text-zinc-700">없음 — 파일과 추출 내용 모두 서버로 보내지 않음</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400">저장 시각</p>
                <p className="text-zinc-700">{formatDateTime(new Date(savedParsedFile.savedAt))}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">자동 삭제 예정</p>
                <p className="text-zinc-700">
                  {expiresAt ? `${formatDateTime(expiresAt)} 이후 첫 방문 시` : '—'}
                </p>
              </div>
            </div>

            {/* 저장된 내용 — 항목별 실제 값 */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                저장된 내용
              </h3>
              {data.schoolName && (
                <p className="mb-2 text-sm text-zinc-600">
                  <span className="text-xs text-zinc-400">현임교(경력에서 추출) </span>
                  {data.schoolName}
                </p>
              )}
              <SavedDataTables data={data} />
            </div>

            {/* 저장하지 않은 것 */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
              <h3 className="mb-1.5 font-semibold text-emerald-800">저장하지 않은 것</h3>
              <ul className="list-inside list-disc space-y-1 text-emerald-700">
                <li>업로드한 원본 엑셀 파일 — 읽은 뒤 바로 버립니다.</li>
                <li>
                  점수 계산에 쓰지 않는 구획 — 추출하지 않아 저장 데이터에 없습니다:{' '}
                  <span className="text-emerald-600">{NOT_EXTRACTED_SECTIONS.join(', ')}</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                이 데이터 삭제
              </button>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
