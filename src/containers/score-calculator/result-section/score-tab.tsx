'use client';

import { useState } from 'react';
import { useScoreStore } from '@/store/use-score-store';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScoreRow } from '@/components/score-row';
import { PdfViewerSheet } from '@/components/pdf-viewer-sheet';
import { fmt } from '@/utils/formatter';
import { SchoolZoneType, PreferentialBonusType, SpecialRoleType, SportsRank } from '@/types/score';

const SPECIAL_ROLE_OPTIONS: { value: SpecialRoleType; label: string }[] = [
  { value: 'none', label: '해당 없음' },
  { value: 'itinerant_health_special', label: '순회교사(보건·특수) 순회·재택담당 지도 (월 0.01)' },
  { value: 'admin_itinerant_before2024', label: '교육행정기관 특수순회·전문상담순회 ~2024.2.29 (월 0.03)' },
  { value: 'admin_itinerant_after2024', label: '교육행정기관 특수순회·전문상담순회 2024.3.1~ (월 0.04)' },
  { value: 'admin_health_nutrition', label: '교육행정기관 보건·영양교사 2025.3.1~ (월 0.02)' },
  { value: 'meal_joint_mgmt', label: '학교급식 공동관리 실적 (월 0.02)' },
  { value: 'meal_joint_cook', label: '학교급식 공동조리 실적 (월 0.01)' },
  { value: 'meal_36plus', label: '36학급 이상 급식학교 (월 0.01)' },
  { value: 'meal_45plus', label: '45학급 이상 급식학교 (월 0.02)' },
  { value: 'meal_combined_under20', label: '초중통합학교 20학급 미만 급식 (월 0.01)' },
  { value: 'meal_combined_over20', label: '초중통합학교 20학급 이상 급식 (월 0.02)' },
  { value: 'health_25to37', label: '학교보건 25~37학급 이하교 (월 0.01)' },
  { value: 'health_38plus', label: '학교보건 38학급 이상·1,000명 이상교 (월 0.02)' },
  { value: 'health_combined_under20', label: '학교보건 초중통합학교 20학급 미만 (월 0.01)' },
  { value: 'health_combined_over20', label: '학교보건 초중통합학교 20학급 이상 (월 0.02)' },
  { value: 'unfavorable_region_librarian', label: '비선호지역(제천·영동·단양) 사서교사 (월 0.03)' },
];

const SPORTS_RANK_OPTIONS: { value: SportsRank; label: string }[] = [
  { value: 'gold', label: '1위(금) — 1.0점' },
  { value: 'silver', label: '2위(은) — 0.75점' },
  { value: 'bronze', label: '3위(동) — 0.5점' },
];

// 공문(인사계획.pdf) 페이지 번호 — "초등교육공무원 인사관리기준 적용 시 유의사항"(부록 i~vii) 기준
// 학위·담임교사·특수통합학급 담임은 이 공문에 월점수 기재가 없어 확인 전까지 1로 둠
const PDF_PAGES: Record<string, number> = {
  '경력점':           27, // 부록ⅰ) 2. 경력기간 산정
  '지역가산점':       28, // 부록ⅱ) 3-가. 지역가산점
  '우대가산점':       28, // 부록ⅱ) 3-나. 우대가산점
  '포상':             30, // 부록ⅳ) 4-가. 포상
  '연구실적':         30, // 부록ⅳ) 4-다. 연구실적
  '학위':             1,
  '직무연수':         30, // 부록ⅳ) 4-라. 직무연수실적
  '교과전담':         31, // 부록ⅴ) 4-마. 교과전담교사
  '담임교사':         1,
  '부장교사':         32, // 부록ⅵ) 4-타. 시지역 부장교사 근무실적
  '특수통합학급 담임': 1,
  '복식학급 담임':    31, // 부록ⅴ) 4-바. 복식학급 담당교사 지도실적
  '체육선수지도':     32, // 부록ⅵ) 4-자. 체육 선수 지도 실적
  '유치원 수업지원·방과후': 33, // 부록ⅶ) 4-파. 유치원 수업지원교사 및 방과후 정교사 근무실적
  '특수직군 실적점':  32, // 부록ⅵ~ⅶ) 4-사·아·차·카·하
};

export function ScoreTab() {
  const result = useScoreStore((state) => state.result);
  const inputs = useScoreStore((state) => state.inputs);
  const updateInput = useScoreStore((state) => state.updateInput);
  const recalculate = useScoreStore((state) => state.recalculate);
  const [pdfItem, setPdfItem] = useState<string | null>(null);
  const [newSportsYear, setNewSportsYear] = useState<number>(new Date().getFullYear());
  const [newSportsRank, setNewSportsRank] = useState<SportsRank>('gold');

  const openPdf = (label: string) => setPdfItem(label);
  const closePdf = () => setPdfItem(null);

  const addSportsAward = () => {
    updateInput('sportsAwards', [...inputs.sportsAwards, { year: newSportsYear, rank: newSportsRank }]);
  };
  const removeSportsAward = (idx: number) => {
    updateInput('sportsAwards', inputs.sportsAwards.filter((_, i) => i !== idx));
  };

  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* 가산점 입력 */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
        <h3 className="mb-3 font-semibold text-primary-700">가산점 직접 입력</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-zinc-600">지역가산점 구분</Label>
            <Select
              value={inputs.schoolZone}
              onValueChange={(v) =>
                updateInput('schoolZone', v as SchoolZoneType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">해당 없음 (0점)</SelectItem>
                <SelectItem value="cliff_ga">벽지 가급지 (월 0.095)</SelectItem>
                <SelectItem value="cliff_na">벽지 나급지 (월 0.080)</SelectItem>
                <SelectItem value="cliff_da">벽지 다급지 (월 0.065)</SelectItem>
                <SelectItem value="cliff_ra">벽지 라급지 (월 0.050)</SelectItem>
                <SelectItem value="remote">오지 (월 0.025)</SelectItem>
                <SelectItem value="special">북일초·서촌초 (월 0.50)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-zinc-600">우대가산점 구분</Label>
            <Select
              value={inputs.preferentialBonus}
              onValueChange={(v) =>
                updateInput('preferentialBonus', v as PreferentialBonusType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">해당 없음</SelectItem>
                <SelectItem value="veteran">국가유공자 봉양 (월 0.025)</SelectItem>
                <SelectItem value="elderly_parent">75세 이상 노부모 동거 (월 0.025)</SelectItem>
                <SelectItem value="disabled_family">장애 심한 가족 부양 (월 0.025)</SelectItem>
                <SelectItem value="three_children">18세 이하 3자녀 부양 (월 0.025)</SelectItem>
                <SelectItem value="second_child">둘째 자녀 출산 후 최초 전보 (월 0.025)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inputs.preferentialBonus !== 'none' && (
            <div className="space-y-1">
              <Label className="text-zinc-600">우대가산점 인정 개월 수</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={inputs.preferentialBonusMonths}
                onChange={(e) =>
                  updateInput(
                    'preferentialBonusMonths',
                    parseInt(e.target.value) || 0,
                  )
                }
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-zinc-600">부장교사 근무 지역</Label>
            <Select
              value={inputs.headTeacherSchoolZone}
              onValueChange={(v) =>
                updateInput(
                  'headTeacherSchoolZone',
                  v as 'urban' | 'rural_large' | 'rural_small',
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urban">동지역 (월 0.03)</SelectItem>
                <SelectItem value="rural_large">읍면지역 18학급 이상 (월 0.02)</SelectItem>
                <SelectItem value="rural_small">읍면지역 18학급 미만 (해당 없음)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={recalculate}
          className="mt-3 bg-primary hover:bg-primary-600"
          size="sm"
        >
          재계산
        </Button>
      </div>

      {/* 체육선수지도·특수직군 실적점 입력 */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
        <h3 className="mb-3 font-semibold text-primary-700">실적점 직접 입력</h3>

        <div className="space-y-2">
          <Label className="text-zinc-600">체육 선수 지도 실적 (1년 최상위 1개, 최대 5개)</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="number"
              className="w-24"
              value={newSportsYear}
              onChange={(e) => setNewSportsYear(parseInt(e.target.value) || 0)}
            />
            <Select value={newSportsRank} onValueChange={(v) => setNewSportsRank(v as SportsRank)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORTS_RANK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" onClick={addSportsAward}>
              추가
            </Button>
          </div>
          {inputs.sportsAwards.length > 0 && (
            <ul className="space-y-1 text-sm text-zinc-600">
              {inputs.sportsAwards.map((s, idx) => (
                <li key={idx} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5">
                  <span>{s.year}년 · {SPORTS_RANK_OPTIONS.find((o) => o.value === s.rank)?.label}</span>
                  <button
                    type="button"
                    className="text-xs text-zinc-400 hover:text-red-500"
                    onClick={() => removeSportsAward(idx)}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-zinc-600">
              특수직군 실적점 구분 (보건·영양·사서·전문상담교사 등 — 학급수 등 배치조건은 본인 확인 필요)
            </Label>
            <Select
              value={inputs.specialRoleType}
              onValueChange={(v) => updateInput('specialRoleType', v as SpecialRoleType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIAL_ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {inputs.specialRoleType !== 'none' && (
            <div className="space-y-1">
              <Label className="text-zinc-600">인정 개월 수</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={inputs.specialRoleMonths}
                onChange={(e) => updateInput('specialRoleMonths', parseInt(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        <Button onClick={recalculate} className="mt-3 bg-primary hover:bg-primary-600" size="sm">
          재계산
        </Button>
      </div>

      {/* 점수 테이블 */}
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead className="rounded-tl-lg font-semibold text-zinc-700">항목</TableHead>
            <TableHead className="text-right font-semibold text-zinc-700">점수</TableHead>
            <TableHead className="font-semibold text-zinc-500">세부내용</TableHead>
            <TableHead className="rounded-tr-lg w-20 whitespace-nowrap text-center font-semibold text-zinc-500">계산 근거</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <ScoreRow
            label="경력점"
            score={result.careerScore}
            color="zinc"
            detail={`현임교(${result.currentSchool || '미확인'}) ${result.careerMonths}개월`}
            onPdf={() => openPdf('경력점')}
          />
          <ScoreRow
            label="지역가산점"
            score={result.regionalBonusScore}
            color="green"
            detail={
              result.regionalBonusScore > 0
                ? `${inputs.schoolZone} × ${result.regionalBonusMonths}개월`
                : '해당 없음'
            }
            onPdf={() => openPdf('지역가산점')}
          />
          <ScoreRow
            label="우대가산점"
            score={result.preferentialBonusScore}
            color="green"
            detail={
              result.preferentialBonusScore > 0
                ? `월 0.025 × ${result.preferentialBonusMonths}개월`
                : '해당 없음'
            }
            onPdf={() => openPdf('우대가산점')}
          />
          <ScoreRow
            label="포상"
            score={result.awardScore}
            color="secondary"
            detail={
              result.awardDetails
                .filter((d) => d.used)
                .map((d) => `${d.year}년 ${d.award.grade}(${d.score})`)
                .join(', ') || '해당 없음'
            }
            onPdf={() => openPdf('포상')}
          />
          <ScoreRow
            label="연구실적"
            score={result.researchScore}
            color="secondary"
            detail={
              result.researchDetails
                .filter((d) => d.used)
                .map((d) => d.reason)
                .join(', ') || '해당 없음'
            }
            onPdf={() => openPdf('연구실적')}
          />
          <ScoreRow
            label="학위"
            score={result.degreeScore}
            color="secondary"
            detail={result.degreeType || '해당 없음'}
            onPdf={() => openPdf('학위')}
          />
          <ScoreRow
            label="직무연수"
            score={result.trainingScore}
            color="secondary"
            detail={`${result.trainingByYear.filter((y) => y.qualifies).length}개 학년도 × 0.5점`}
            onPdf={() => openPdf('직무연수')}
          />
          <ScoreRow
            label="교과전담"
            score={result.subjectClassScore}
            color="secondary"
            detail={
              result.subjectClassScore > 0
                ? `${result.subjectClassMonths}개월 × 0.03`
                : '해당 없음'
            }
            onPdf={() => openPdf('교과전담')}
          />
          <ScoreRow
            label="담임교사"
            score={result.homeroomScore}
            color="secondary"
            detail={
              result.homeroomScore > 0
                ? `${result.homeroomMonths}개월 × 0.02`
                : '해당 없음'
            }
            onPdf={() => openPdf('담임교사')}
          />
          <ScoreRow
            label="부장교사"
            score={result.headTeacherScore}
            color="secondary"
            detail={
              result.headTeacherScore > 0
                ? `${result.headTeacherMonths}개월 × ${inputs.headTeacherSchoolZone === 'urban' ? '0.03' : '0.02'}`
                : '해당 없음'
            }
            onPdf={() => openPdf('부장교사')}
          />
          {result.conflictResolution && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="bg-amber-50 px-3 py-1 text-xs text-amber-700"
              >
                ※ {result.conflictResolution}
              </TableCell>
            </TableRow>
          )}
          <ScoreRow
            label="특수통합학급 담임"
            score={result.specialEdScore}
            color="secondary"
            detail={
              result.specialEdScore > 0
                ? `${result.specialEdMonths}개월 × 0.01`
                : '해당 없음'
            }
            onPdf={() => openPdf('특수통합학급 담임')}
          />
          <ScoreRow
            label="복식학급 담임"
            score={result.multigradeScore}
            color="secondary"
            detail={
              result.multigradeScore > 0
                ? `${result.multigradeMonths}개월 × 0.03`
                : '해당 없음'
            }
            onPdf={() => openPdf('복식학급 담임')}
          />
          <ScoreRow
            label="체육선수지도"
            score={result.sportsScore}
            color="secondary"
            detail={
              result.sportsDetails
                .filter((d) => d.used)
                .map((d) => `${d.year}년 ${d.rank === 'gold' ? '금' : d.rank === 'silver' ? '은' : '동'}(${d.score})`)
                .join(', ') || '해당 없음'
            }
            onPdf={() => openPdf('체육선수지도')}
          />
          {inputs.teacherType === 'kindergarten' && (
            <ScoreRow
              label="유치원 수업지원·방과후"
              score={result.kindergartenSupportScore}
              color="secondary"
              detail={
                result.kindergartenSupportScore > 0
                  ? `${result.kindergartenSupportMonths}개월 × 0.01`
                  : '해당 없음'
              }
              onPdf={() => openPdf('유치원 수업지원·방과후')}
            />
          )}
          <ScoreRow
            label="특수직군 실적점"
            score={result.specialRoleScore}
            color="secondary"
            detail={
              result.specialRoleScore > 0
                ? `${result.specialRoleLabel} × ${inputs.specialRoleMonths}개월`
                : '해당 없음'
            }
            onPdf={() => openPdf('특수직군 실적점')}
          />
        </TableBody>
        <TableFooter>
          <TableRow className="bg-primary-50 font-bold text-primary-800">
            <TableCell className="rounded-bl-lg">총점</TableCell>
            <TableCell className="text-right text-xl text-primary">
              {fmt(result.grandTotal)}
            </TableCell>
            <TableCell className="text-xs font-normal text-zinc-500">
              경력({fmt(result.totalCareer)}) + 가산({fmt(result.totalBonus)}) +
              실적({fmt(result.totalPerformance)})
            </TableCell>
            <TableCell className="rounded-br-lg" />
          </TableRow>
        </TableFooter>
      </Table>

      {/* 직무연수 학년도별 상세 */}
      <div className="mt-2">
        <p className="mb-2 text-sm font-medium text-zinc-700">
          직무연수 학년도별 상세
        </p>
        <div className="grid grid-cols-5 gap-2">
          {result.trainingByYear.map((y) => (
            <div
              key={y.schoolYear}
              className={`rounded-lg border p-3 text-center text-sm ${
                y.qualifies
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-400'
              }`}
            >
              <p className="font-semibold">{y.schoolYear}학년도</p>
              <p className="mt-1 text-xs">
                {Math.floor(y.totalMinutes / 60)}시간
              </p>
              <p className="mt-1 font-bold">
                {y.qualifies ? '+0.5점' : '미충족'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <PdfViewerSheet
        open={pdfItem !== null}
        onClose={closePdf}
        title={pdfItem ?? ''}
        page={pdfItem ? PDF_PAGES[pdfItem] : undefined}
      />
    </div>
  );
}
