'use client';

import { Fragment } from 'react';
import type { School } from '@/types/school-stats';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DETAIL_GROUPS } from '@/lib/school-indicators';
import { schulKndLabel } from '@/lib/school-region';
import type { SocialMap } from '@/hooks/use-school-social';
import { FavoriteToggleButton } from './favorite-toggle-button';

/**
 * 학교 비교 모달 — 저장된 관심학교끼리 통계를 표로 나란히 비교한다 (계획: 2차,
 * _refs/즐겨찾기_구현계획/03_목록보기.md "학교 비교 탭"). 별도 계획 문서
 * (`_refs/학교비교_구현계획/`)를 새로 쓰는 대신, 즐겨찾기 계획 문서에 이미 쌓인 설계
 * 메모를 그대로 따른다 — 필터와 무관하게 저장된 관심학교 전체가 대상, 열 = 학교,
 * 행 = 비교 항목. 항목은 상세 패널과 같은 DETAIL_GROUPS를 재사용해 로직 중복이 없다.
 *
 * 개수 제한을 두지 않는다(01_저장방식.md 메모대로 "제한이 필요해지면 스토어가 아니라
 * 여기서") — 대신 표를 가로 스크롤 가능하게 해서 많아져도 깨지지 않게만 한다.
 * 각 열 헤더에 하트 토글을 둬서 비교하다가 바로 관심학교에서 뺄 수 있다 — 이게
 * 05_보존정책.md에서 2차로 미뤄뒀던 "목록에서 개별 삭제"에 해당.
 */
interface SchoolCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schools: School[];
  social?: SocialMap;
}

function CompareRow({
  label,
  schools,
  render,
}: {
  label: string;
  schools: School[];
  render: (s: School) => string;
}) {
  return (
    <tr>
      <td className="sticky left-0 whitespace-nowrap bg-white py-2 pr-4 text-xs text-zinc-500">
        {label}
      </td>
      {schools.map((s) => (
        <td key={s.schulCode} className="border-l border-zinc-50 px-4 py-2 text-zinc-700">
          {render(s)}
        </td>
      ))}
    </tr>
  );
}

function GroupHeaderRow({ title, schools }: { title: string; schools: School[] }) {
  return (
    <tr>
      <td className="sticky left-0 whitespace-nowrap bg-white pb-1 pr-4 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </td>
      {schools.map((s) => (
        <td key={s.schulCode} className="border-l border-zinc-50 pb-1 pt-4" />
      ))}
    </tr>
  );
}

export function SchoolCompareModal({ open, onOpenChange, schools, social }: SchoolCompareModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>학교 비교</DialogTitle>
        </DialogHeader>

        {schools.length < 2 ? (
          <p className="p-8 text-center text-sm text-zinc-400">
            {schools.length === 0
              ? '아직 관심학교가 없어요. 학교 상세 정보에서 하트 아이콘으로 먼저 추가해보세요.'
              : `비교하려면 관심학교가 2개 이상 필요해요. 지금은 "${schools[0].schulNm}" 1개뿐이에요.`}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-10 bg-white" />
                  {schools.map((s) => (
                    <th
                      key={s.schulCode}
                      className="sticky top-0 z-10 min-w-[11rem] border-b border-l border-zinc-200 bg-white px-4 pb-2 text-left align-bottom"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-zinc-800">{s.schulNm}</span>
                        <FavoriteToggleButton schulCode={s.schulCode} size="sm" />
                      </div>
                      <span className="block text-xs text-zinc-400">
                        {schulKndLabel(s.schulKndCode)}
                        {s.fondScCode ? ` · ${s.fondScCode}` : ''}
                      </span>
                      <span className="block truncate text-xs text-zinc-400">
                        {s.sigunguName ?? ''}
                        {s.subRegionName ? ` ${s.subRegionName}` : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <GroupHeaderRow title="커뮤니티" schools={schools} />
                <CompareRow
                  label="별점 (이동 추천도)"
                  schools={schools}
                  render={(s) => {
                    const e = social?.[s.schulCode];
                    return e && e.count > 0 ? `★ ${e.avg?.toFixed(1)} · ${e.count}명` : '—';
                  }}
                />
                <CompareRow
                  label="조회수"
                  schools={schools}
                  render={(s) => `${(social?.[s.schulCode]?.views ?? 0).toLocaleString()}회`}
                />
                <CompareRow
                  label="관심학교 등록 수"
                  schools={schools}
                  render={(s) => `♥ ${social?.[s.schulCode]?.favoriteCount ?? 0}`}
                />
                <CompareRow
                  label="댓글 수"
                  schools={schools}
                  render={(s) => `${social?.[s.schulCode]?.commentCount ?? 0}개`}
                />

                {DETAIL_GROUPS.map((group) => (
                  <Fragment key={group.title}>
                    <GroupHeaderRow title={group.title} schools={schools} />
                    {group.fields.map((field) => (
                      <CompareRow
                        key={field.label}
                        label={field.label}
                        schools={schools}
                        render={(s) => field.render(s)}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
