'use client';

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
import { fmt } from '@/utils/formatter';
import { SchoolZoneType, PreferentialBonusType } from '@/types/score';

export function ScoreTab() {
  const result = useScoreStore((state) => state.result);
  const inputs = useScoreStore((state) => state.inputs);
  const updateInput = useScoreStore((state) => state.updateInput);
  const recalculate = useScoreStore((state) => state.recalculate);

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

      {/* 점수 테이블 */}
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead className="rounded-tl-lg font-semibold text-zinc-700">항목</TableHead>
            <TableHead className="text-right font-semibold text-zinc-700">점수</TableHead>
            <TableHead className="rounded-tr-lg font-semibold text-zinc-500">세부내용</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <ScoreRow
            label="경력점"
            score={result.careerScore}
            color="zinc"
            detail={`현임교(${result.currentSchool || '미확인'}) ${result.careerMonths}개월`}
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
          />
          <ScoreRow
            label="학위"
            score={result.degreeScore}
            color="secondary"
            detail={result.degreeType || '해당 없음'}
          />
          <ScoreRow
            label="직무연수"
            score={result.trainingScore}
            color="secondary"
            detail={`${result.trainingByYear.filter((y) => y.qualifies).length}개 학년도 × 0.5점`}
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
          />
          {result.conflictResolution && (
            <TableRow>
              <TableCell
                colSpan={3}
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
          />
        </TableBody>
        <TableFooter>
          <TableRow className="bg-primary-50 font-bold text-primary-800">
            <TableCell className="rounded-bl-lg">총점</TableCell>
            <TableCell className="text-right text-xl text-primary">
              {fmt(result.grandTotal)}
            </TableCell>
            <TableCell className="rounded-br-lg text-xs font-normal text-zinc-500">
              경력({fmt(result.totalCareer)}) + 가산({fmt(result.totalBonus)}) +
              실적({fmt(result.totalPerformance)})
            </TableCell>
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
    </div>
  );
}
