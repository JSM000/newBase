'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { ExcelDataDialog } from '@/components/excel-data-dialog';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useUserSettingsStore } from '@/store/use-user-settings-store';
import { useGeocodeCandidates } from '@/hooks/use-geocode-candidates';
import { cooldownRemainingMs, markSearched } from '@/lib/commute-rate-limit';
import { getExpiresAt, RETENTION_DAYS } from '@/lib/settings-retention';
import { formatDateTime } from '@/utils/formatter';
import { CHUNGBUK_SIGUNGU_ORDER, normalizeSigungu } from '@/lib/school-region';
import type { GeocodeCandidate } from '@/types/commute';
import type { TransferPreference, SchoolLevel } from '@/types/user-settings';

// "선택하세요"는 저장되는 값이 아니라 선택 해제(null)로 되돌리는 리셋 항목이다 — 아래
// onValueChange에서 'all'을 null로 변환한다. Select 목록엔 있어야 사용자가 클릭으로
// 되돌릴 수 있어서 필요하다(Radix Select엔 선택 해제 UI가 따로 없음).
const TRANSFER_OPTIONS: { value: TransferPreference | 'all'; label: string }[] = [
  { value: 'all', label: '선택하세요' },
  { value: 'external', label: '관외전보 고려 중' },
  { value: 'internal', label: '관내전보 고려 중' },
];

export function SettingsContainer() {
  const {
    currentSigungu,
    transferPreference,
    desiredSigungu,
    homeCoords,
    schoolLevel,
    savedParsedFile,
    savedAt,
    setCurrentSigungu,
    setTransferPreference,
    setDesiredSigungu,
    setHomeCoords,
    setSchoolLevel,
    reset,
  } = useUserSettingsStore();

  const geocode = useGeocodeCandidates();
  const [address, setAddress] = useState('');
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setCooldownMs(cooldownRemainingMs()), 1000);
    return () => clearInterval(id);
  }, []);

  const cooling = cooldownMs > 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address.trim() || cooling || geocode.isPending) return;
    setCandidates(null);
    geocode.mutate(
      { address: address.trim() },
      {
        onSuccess: (res) => {
          markSearched();
          setCooldownMs(cooldownRemainingMs());
          setCandidates(res.candidates);
        },
      },
    );
  }

  function pickCandidate(c: GeocodeCandidate) {
    setHomeCoords({ lat: c.lat, lng: c.lng });
    setCandidates(null);
    setAddress('');
  }

  const expiresAt = savedAt ? getExpiresAt(savedAt) : null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <AppHeader items={[{ label: 'NewBase', href: '/' }, { label: '내 정보 설정' }]} />

      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-6 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="mb-1 font-semibold text-amber-800">개인정보 관리 안내 ( 필독 )</p>
          <ul className="list-inside list-disc space-y-1 text-amber-700">
            <li>입력한 정보는 서버로 전송되지 않고, 이 기기의 브라우저에만 저장됩니다.</li>
            <li>거주지는 정확한 주소가 아니라 좌표로만 저장되며, 상세 주소는 저장하지 않습니다.</li>
            <li>
              {expiresAt
                ? `저장된 정보는 ${formatDateTime(expiresAt)} 이후 이 사이트에 재방문하면 자동으로 삭제됩니다.`
                : `저장된 정보는 저장 시점에서 ${RETENTION_DAYS}일 이후 이 사이트에 재방문하면 자동으로 삭제됩니다.`}
            </li>
            <li>
              확실하게 지우고 싶다면 사이트를 벗어나기 전에 아래 &quot;전체 삭제&quot;를 눌러주세요.
            </li>
            <li>공용 PC·공용 기기에서는 정보 저장에 주의를 기울려 주세요.</li>
          </ul>
        </div>

        <Button
          className="w-full bg-primary hover:bg-primary-600"
          disabled={!savedAt}
          onClick={() => setConfirmOpen(true)}
        >
          저장된 정보 삭제
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>전체 삭제하시겠어요?</DialogTitle>
              <DialogDescription>
                근무 지역, 전보 의향·희망 지역, 거주지 좌표, 저장된 인사기록카드 데이터가
                모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">취소</Button>
              </DialogClose>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  reset();
                  setConfirmOpen(false);
                }}
              >
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-custom">
          <div className="space-y-1">
            <Label className="text-zinc-600">학교급</Label>
            <Select
              key={schoolLevel === null ? 'unset' : 'set'}
              value={schoolLevel ?? undefined}
              onValueChange={(v) => setSchoolLevel(v === 'all' ? null : (v as SchoolLevel))}
            >
              <SelectTrigger>
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-muted-foreground">선택하세요</SelectItem>
                <SelectItem value="kindergarten">유치원</SelectItem>
                <SelectItem value="elementary">초등학교</SelectItem>
                <SelectItem value="middle">중학교</SelectItem>
                <SelectItem value="high">고등학교</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-400">
              유치원·초등학교는 점수 계산기에도, 이 값은 통계지도 필터 기본값에도
              쓰입니다. (점수 계산은 현재 유초등만 구현돼 있어 중·고등학교는 통계지도에만
              반영됩니다 — 중고등 점수 계산은 추후 구현 예정)
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-zinc-600">현재 근무 중인 시·군·구</Label>
            <Select
              key={currentSigungu === null ? 'unset' : 'set'}
              value={normalizeSigungu(currentSigungu) ?? undefined}
              onValueChange={(v) => setCurrentSigungu(v === 'all' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-muted-foreground">선택하세요</SelectItem>
                {CHUNGBUK_SIGUNGU_ORDER.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-zinc-600">관외/관내 전보 고려 여부</Label>
            <Select
              key={transferPreference === null ? 'unset' : 'set'}
              value={transferPreference ?? undefined}
              onValueChange={(v) => setTransferPreference(v === 'all' ? null : (v as TransferPreference))}
            >
              <SelectTrigger>
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {TRANSFER_OPTIONS.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={o.value}
                    className={o.value === 'all' ? 'text-muted-foreground' : undefined}
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {transferPreference === 'external' && (
            <div className="space-y-1">
              <Label className="text-zinc-600">이동을 희망하는 시·군</Label>
              <Select
                key={desiredSigungu === null ? 'unset' : 'set'}
                value={normalizeSigungu(desiredSigungu) ?? undefined}
                onValueChange={(v) => setDesiredSigungu(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {CHUNGBUK_SIGUNGU_ORDER.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-400">
                통계지도에서 집→학교 소요시간을 검색할 때 이 지역의 학교를 기본 대상으로 찾습니다.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-zinc-600">현재 거주지</Label>
            {homeCoords ? (
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">집 위치가 저장되어 있습니다</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => setHomeCoords(null)}
                >
                  다시 검색
                </button>
              </div>
            ) : (
              <form onSubmit={handleSearchSubmit} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="도로명 주소 (동/호수는 입력하지 마세요)"
                    autoComplete="street-address"
                  />
                  <Button
                    type="submit"
                    disabled={!address.trim() || cooling || geocode.isPending}
                    className="shrink-0 bg-primary hover:bg-primary-600"
                  >
                    {geocode.isPending ? '검색 중' : cooling ? `${cooldownSec}초` : '검색'}
                  </Button>
                </div>
                <p className="text-xs text-zinc-400">
                  아파트 동·호수, 상세 호실까지는 저장하지 않아도 충분히 정확한 소요시간을
                  계산할 수 있어요. 검색 결과 중 하나를 고르면 좌표만 저장됩니다.
                </p>
                {geocode.isError && (
                  <p className="text-xs text-red-600">
                    {geocode.error instanceof Error ? geocode.error.message : '주소 검색 중 오류가 발생했습니다.'}
                  </p>
                )}
                {candidates && (
                  <div className="rounded-lg border border-zinc-200">
                    {candidates.length === 0 ? (
                      <p className="p-3 text-sm text-zinc-400">검색 결과가 없습니다.</p>
                    ) : (
                      candidates.map((c, i) => (
                        <button
                          key={`${c.lat},${c.lng},${i}`}
                          type="button"
                          onClick={() => pickCandidate(c)}
                          className="flex w-full flex-col items-start gap-1 border-b border-zinc-50 px-3 py-2 text-left text-sm hover:bg-zinc-50 last:border-b-0"
                        >
                          <span className="truncate font-medium text-zinc-800">{c.label}</span>
                          {c.roadAddress && c.roadAddress !== c.label && (
                            <span className="block truncate text-xs text-zinc-400">{c.roadAddress}</span>
                          )}
                          {c.addressType === 'REGION' && (
                            <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              동·읍·면 단위 근사치 — 정확한 지번을 아신다면 다시 입력해 보세요
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-zinc-600">인사기록카드 데이터</Label>
            {savedParsedFile && (
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">
                  {formatDateTime(new Date(savedParsedFile.savedAt))} 저장됨
                </span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setExcelDialogOpen(true)}
            >
              업로드 · 관리
            </Button>
          </div>
        </div>
      </main>

      <ExcelDataDialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen} />
    </div>
  );
}
