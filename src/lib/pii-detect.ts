/**
 * 개인정보 검출 규칙 — 댓글 작성 화면과 인사기록카드 업로드(잘못된 파일 차단)가 같이 쓴다.
 * 계획: _refs/개인정보_검출_구현계획/01_검출규칙.md
 *
 * - 브라우저 안에서만 돈다. 검출 결과(무엇이 있었는지)도 어디로 보내지 않는다.
 * - 결과에는 값을 담지 않는다 — 종류·위치·강도만. 화면 문구는 종류만 말한다.
 * - 'block' 등급 정규식은 서버(supabase/migrations/0006_comment_pii_and_reports.sql의
 *   _contains_blocked_pii)와 같은 패턴이다. 한쪽을 바꾸면 반드시 다른 쪽도 같이 바꾸고
 *   scripts/check-pii-detect.mjs · supabase/checks/pii_cases.sql 로 확인할 것.
 * - 이 파일은 다른 모듈을 import 하지 않는다(테스트 스크립트가 Node로 직접 실행).
 */

export type PiiKind =
  | 'rrn'
  | 'mobile'
  | 'phone'
  | 'email'
  | 'account'
  | 'address'
  | 'personName'
  | 'roleMention';

export type PiiSeverity = 'block' | 'warn';

export interface PiiMatch {
  kind: PiiKind;
  severity: PiiSeverity;
  /** 원문에서의 위치 — 화면에서 가리기에만 쓰고 저장·전송하지 않는다 */
  start: number;
  end: number;
}

export const PII_LABEL: Record<PiiKind, string> = {
  rrn: '주민등록번호',
  mobile: '휴대전화 번호',
  phone: '전화번호',
  email: '이메일 주소',
  account: '계좌번호',
  address: '상세 주소',
  personName: '사람 이름',
  roleMention: '특정인을 가리키는 직위',
};

const BANKS =
  '국민|신한|우리|하나|농협|기업|SC제일|제일|씨티|카카오뱅크|카카오|토스뱅크|토스|케이뱅크|새마을금고|새마을|우체국|수협|신협|부산|대구|경남|광주|전북|제주|산업|계좌';

interface Rule {
  kind: PiiKind;
  severity: PiiSeverity;
  re: RegExp;
}

// ── 차단(block) — 서버 SQL과 같은 패턴 ──
const BLOCK_RULES: Rule[] = [
  {
    // 생년월일 6자리(월·일 범위 확인) + 뒷자리 7자리, 또는 하이픈 뒤 첫 자리만 남기고 가린 형태
    kind: 'rrn',
    severity: 'block',
    re: /(?<![0-9-])[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])(?:\s*-\s*[1-8](?:[0-9]{6}|[*●xX]{6})|[1-8][0-9]{6})(?![0-9])/g,
  },
  {
    // 앞에 영문·숫자·하이픈이 붙어 있으면 제외 — 연수 과정번호(…-2023-0101…) 오검출 방지
    kind: 'mobile',
    severity: 'block',
    re: /(?<![0-9A-Za-z-])01[016789][-. ]?[0-9]{3,4}[-. ]?[0-9]{4}(?![0-9])/g,
  },
  {
    // 지역번호 + 구분자 필수(숫자만 붙은 형태는 학생 수 등과 헷갈려서 제외)
    kind: 'phone',
    severity: 'block',
    re: /(?<![0-9A-Za-z-])0(?:2|[3-6][1-5])[-. )] ?[0-9]{3,4}[-. ][0-9]{4}(?![0-9])/g,
  },
  {
    kind: 'email',
    severity: 'block',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    // 은행명·"계좌" 바로 뒤의 숫자열(하이픈 포함 10~20자)
    kind: 'account',
    severity: 'block',
    re: new RegExp(`(?:${BANKS})(?:은행|번호)?\\s*[:：]?\\s*[0-9][0-9-]{8,18}[0-9]`, 'g'),
  },
];

// ── 경고(warn) — 화면에서만. 오검출이 있어 등록은 허용(확인 후) ──
const SURNAMES =
  '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부';
const TITLES = '선생님|선생|쌤|샘|교장|교감|부장|주무관|행정실장|실장|교사|강사';
/** 성씨로 시작하지만 이름이 아닌 흔한 말 — "정말 부장님" 같은 오검출 방지 */
const NOT_NAMES = new Set([
  '정말', '진짜', '우리', '모든', '여러', '이번', '전체', '전에', '이전', '이후', '지금', '주변',
  '조금', '이분', '그분', '저분', '여기', '이곳', '최고', '최근', '신규', '신임', '전임', '현재',
  '고생', '구성', '기존', '부서', '장기', '단기', '정규', '임시', '전담', '담임', '교과', '학년',
  // 직무·직군 명칭 — "부장교사", "보건교사", "기간제교사" 등
  '부장', '교장', '교감', '실장', '수석', '보건', '영양', '사서', '상담', '전문', '특수', '기간',
  '기간제', '원어민', '순회', '정교', '수업', '방과', '돌봄', '늘봄', '유치', '초등', '중등',
]);

const WARN_RULES: Rule[] = [
  {
    // 도로명(…로/길) + 건물번호. 뒤에 시간·거리·수량 단위가 붙으면 제외("출근길 30분")
    kind: 'address',
    severity: 'warn',
    re: /[가-힣]{1,10}(?:대로|로|길)\s?[0-9]{1,4}(?:-[0-9]{1,4})?(?:번길\s?[0-9]{1,4})?(?![0-9가-힣]|\s*(?:분|시간|km|m|년|월|일|개|명|학급|%))/g,
  },
  {
    kind: 'address',
    severity: 'warn',
    re: /[0-9]{1,4}동\s?[0-9]{1,4}호/g,
  },
  {
    // 성씨 + 이름 1~2자 + 직함 — 이름 부분은 아래 NOT_NAMES로 한 번 더 거른다
    kind: 'personName',
    severity: 'warn',
    re: new RegExp(`(?<![가-힣])([${SURNAMES}][가-힣]{1,2})\\s?(?:${TITLES})`, 'g'),
  },
  {
    // 댓글이 학교별이라 직위만으로도 사람이 특정된다. "부장"은 지표 이름(부장교사 수)으로 자주
    // 쓰여서 "님/선생님"이 붙을 때만.
    kind: 'roleMention',
    severity: 'warn',
    re: /(?:교장|교감|행정실장)(?:\s?선생님|님)?|(?:부장|실장|주무관)\s?(?:선생님|님)/g,
  },
];

function collect(text: string, rules: Rule[]): PiiMatch[] {
  const out: PiiMatch[] = [];
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      if (m.index === undefined) continue;
      if (rule.kind === 'personName' && m[1] && NOT_NAMES.has(m[1])) continue;
      out.push({ kind: rule.kind, severity: rule.severity, start: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

/** 텍스트에서 개인정보로 보이는 구간을 찾는다. 겹치면 차단 등급 → 긴 것 우선으로 하나만 남긴다. */
export function detectPii(text: string): PiiMatch[] {
  if (!text) return [];
  const all = [...collect(text, BLOCK_RULES), ...collect(text, WARN_RULES)];
  all.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'block' ? -1 : 1) ||
      b.end - b.start - (a.end - a.start),
  );
  const kept: PiiMatch[] = [];
  for (const m of all) {
    if (kept.some((k) => m.start < k.end && k.start < m.end)) continue;
    kept.push(m);
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function hasBlockingPii(matches: PiiMatch[]): boolean {
  return matches.some((m) => m.severity === 'block');
}

/** 종류별 개수만 — 값 없이 안내 문구·판정에 쓴다. */
export function summarizePii(matches: PiiMatch[]): Partial<Record<PiiKind, number>> {
  const out: Partial<Record<PiiKind, number>> = {};
  for (const m of matches) out[m.kind] = (out[m.kind] ?? 0) + 1;
  return out;
}

/** 해당 구간을 '●●●'로 바꾼다. severity를 주면 그 등급만 가린다. */
export function maskPii(text: string, matches: PiiMatch[], severity?: PiiSeverity): string {
  const targets = matches
    .filter((m) => !severity || m.severity === severity)
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const m of targets) out = `${out.slice(0, m.start)}●●●${out.slice(m.end)}`;
  return out;
}

/**
 * 닉네임이 실명처럼 보이는지 — 흔한 성씨 + 한글 1~2자 "만"으로 된 경우. 별명 오검출이 많아
 * 차단·경고가 아니라 "별명을 권장해요" 안내에만 쓴다.
 */
export function looksLikeRealName(nickname: string): boolean {
  const v = nickname.trim();
  return new RegExp(`^[${SURNAMES}][가-힣]{1,2}$`).test(v) && !NOT_NAMES.has(v);
}

/** "전화번호, 이메일 주소" 같은 종류 목록 문구 */
export function describePiiKinds(matches: PiiMatch[], severity?: PiiSeverity): string {
  const kinds = [...new Set(matches.filter((m) => !severity || m.severity === severity).map((m) => m.kind))];
  return kinds.map((k) => PII_LABEL[k]).join(', ');
}
