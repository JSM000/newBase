// 점수 계산기(인사기록카드 파싱·점수 산출) 코드에 네트워크/외부 전송 로직이
// 섞여 들어오지 않았는지 정적으로 확인한다.
//
// 배경: CLAUDE.md "개인정보 보호 원칙" — 업로드한 파일과 그 내용은 서버로 절대
// 전송하지 않는다. 이 스크립트는 그 불변조건이 코드리뷰에서 빠져도 자동으로
// 잡히게 하는 안전망이다. 실행: node scripts/check-no-network-in-score-calc.mjs
// (npm run check:privacy). .github/workflows/privacy-check.yml 에서 PR마다 실행.
//
// 새 파일/기능을 이 목록에 추가할수록 안전망이 넓어진다 — 인사기록카드 데이터가
// 지나가는 경로가 늘면 SCANNED_PATHS 에도 추가할 것.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCANNED_PATHS = [
  "src/lib/excel-parser.ts",
  "src/lib/score-calculator.ts",
  "src/lib/transfer-eligibility.ts",
  "src/store/use-score-store.ts",
  "src/hooks/apis/excel/use-parse-excel.ts",
  "src/types/score.ts",
  "src/containers/score-calculator",
  "src/app/calculator",
];

// [패턴, 사람이 읽을 설명]. 정규식은 대소문자 무시.
const FORBIDDEN = [
  [/\bfetch\s*\(/, "fetch() 호출"],
  [/\baxios\b/, "axios 사용"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest 사용"],
  [/\bnew\s+WebSocket\b/, "WebSocket 연결"],
  [/\bnew\s+EventSource\b/, "EventSource(SSE) 연결"],
  [/\bsendBeacon\b/, "navigator.sendBeacon 사용"],
  [/@supabase/, "Supabase import"],
  [/\bgetSupabase\b/, "getSupabase() 호출"],
  [/from\s+['"]next\/server['"]/, "next/server import (서버 전용 코드)"],
  [/\/api\/parse-excel/, "삭제된 서버 파싱 라우트 참조"],
];

function walk(relPath, out) {
  const abs = path.join(ROOT, relPath);
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) {
    console.warn(`⚠️  경로 없음(스캔 목록 정리 필요): ${relPath}`);
    return;
  }
  if (st.isDirectory()) {
    for (const entry of readdirSync(abs)) walk(path.join(relPath, entry), out);
    return;
  }
  if (!/\.(ts|tsx)$/.test(abs)) return;
  out.push(relPath);
}

const files = [];
for (const p of SCANNED_PATHS) walk(p, files);

let violations = [];
for (const rel of files) {
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const [pattern, label] of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push({ file: rel, line: i + 1, label, code: line.trim() });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`\n❌ 점수 계산기 코드에서 금지 패턴 ${violations.length}건 발견:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.label}]\n    ${v.code}`);
  }
  console.error(
    "\n인사기록카드는 서버로 전송하지 않는 게 이 프로젝트의 불변조건입니다 (CLAUDE.md 참고).",
  );
  console.error(
    "정말 필요한 변경이면 이 스크립트(scripts/check-no-network-in-score-calc.mjs)의",
  );
  console.error("FORBIDDEN 목록을 함께 검토해서 의도적으로 조정하세요.\n");
  process.exit(1);
}

console.log(`✅ 점수 계산기 관련 파일 ${files.length}개 스캔 — 네트워크/외부전송 패턴 없음.`);
