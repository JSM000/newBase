// src/lib/pii-detect.ts 검출 규칙 테스트. 실행: node scripts/check-pii-detect.mjs (npm run check:pii)
// Node 22.6+ 의 TypeScript 타입 제거 기능으로 .ts 를 그대로 import 한다(pii-detect.ts는 import가 없음).
//
// 'block' 등급 케이스는 서버 SQL(_contains_blocked_pii)과도 같아야 한다 —
// supabase/checks/pii_cases.sql 에 같은 케이스가 있다. 케이스를 추가하면 두 곳에 같이 추가할 것.

import { detectPii, hasBlockingPii } from '../src/lib/pii-detect.ts';

/** [입력, 기대 종류 목록(순서 무관, 없으면 [])] */
const CASES = [
  // 차단
  ['연락은 010-1234-5678로', ['mobile']],
  ['01012345678', ['mobile']],
  ['010 1234 5678', ['mobile']],
  ['043-123-4567', ['phone']],
  ['02-123-4567', ['phone']],
  ['900101-1234567', ['rrn']],
  ['900101-1******', ['rrn']],
  ['9001011234567', ['rrn']],
  ['메일 abc@school.go.kr 로', ['email']],
  ['국민은행 123456-01-123456', ['account']],
  ['계좌 110-123-456789', ['account']],
  // 경고
  ['김철수 선생님 좋아요', ['personName']],
  ['박민 부장님이 친절', ['personName']],
  ['청주대로 123', ['address']],
  ['101동 1203호', ['address']],
  ['교감 선생님이 깐깐함', ['roleMention']],
  ['행정실장님 친절', ['roleMention']],
  // 잡으면 안 되는 것
  ['2026년 3월 24학급 학생 612명', []],
  ['주 20시간, 1시간 10분', []],
  ['출근길 30분 걸려요', []],
  ['단재교-초-직무-2007-682', []],
  ['충북교육연수원-초-직무-2023-01012345', []],
  ['S110000924', []],
  ['익명고양이', []],
  ['정말 좋은 학교', []],
  ['부장교사 수가 많음', []],
  ['교과전담 3명, 담임 20학급', []],
];

let failed = 0;
for (const [input, expected] of CASES) {
  const got = detectPii(input).map((m) => m.kind).sort();
  const want = [...expected].sort();
  const ok = got.length === want.length && got.every((k, i) => k === want[i]);
  if (!ok) {
    failed++;
    console.error(`❌ ${JSON.stringify(input)}\n   기대 ${JSON.stringify(want)} / 실제 ${JSON.stringify(got)}`);
  }
}

// 차단 여부 요약도 한 번 확인
if (!hasBlockingPii(detectPii('010-1234-5678'))) {
  failed++;
  console.error('❌ hasBlockingPii(휴대전화) 가 false');
}
if (hasBlockingPii(detectPii('김철수 선생님'))) {
  failed++;
  console.error('❌ hasBlockingPii(이름) 가 true — 이름은 경고 등급이어야 함');
}

if (failed > 0) {
  console.error(`\n개인정보 검출 테스트 ${failed}건 실패`);
  process.exit(1);
}
console.log(`✅ 개인정보 검출 테스트 ${CASES.length + 2}건 통과`);
