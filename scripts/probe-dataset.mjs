// 특정 apiType의 raw 응답에서, 같은 SCHUL_CODE로 여러 행이 나오는 케이스가 있는지 확인하는 진단용 스크립트.
// 학교당 여러 행이 나오는 데이터셋(예: 44 시설안전점검현황, 24 표시과목별 교원 현황 중고)의
// 실제 필드 값·행 구성을 눈으로 확인하기 위한 용도.
//
// 실행:
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/probe-dataset.mjs 44 02 43111 2026
//   (특정 학교만 보고 싶으면 5번째 인자로 SCHUL_CODE 또는 학교명 일부를 준다)
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/probe-dataset.mjs 18 02 43111 2026 용아초등학교
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/probe-dataset.mjs 18 02 43111 2026 S110000924

const API_BASE = "http://www.schoolinfo.go.kr/openApi.do";
const SIDO_CODE = "43";

function findRecordArrays(node, found = []) {
  if (Array.isArray(node)) {
    const isRecordArray =
      node.length > 0 &&
      node.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));
    if (isRecordArray) found.push(node);
    node.forEach((item) => findRecordArrays(item, found));
  } else if (node !== null && typeof node === "object") {
    for (const value of Object.values(node)) findRecordArrays(value, found);
  }
  return found;
}

async function main() {
  const [apiType, schulKndCode, sggCode, pbanYr, target] = process.argv.slice(2);
  if (!apiType || !schulKndCode || !sggCode) {
    throw new Error(
      "사용법: node scripts/probe-dataset.mjs <apiType> <schulKndCode> <sggCode> [pbanYr] [SCHUL_CODE 또는 학교명 일부]"
    );
  }
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) throw new Error("SCHOOLINFO_API_KEY 환경변수가 필요합니다.");

  const url = new URL(API_BASE);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("apiType", apiType);
  url.searchParams.set("sidoCode", SIDO_CODE);
  url.searchParams.set("sggCode", sggCode);
  url.searchParams.set("schulKndCode", schulKndCode);
  if (pbanYr) url.searchParams.set("pbanYr", pbanYr);

  const res = await fetch(url);
  const json = await res.json();

  if (json && typeof json === "object" && json.resultCode && json.resultCode !== "success") {
    console.log("API 오류:", json.resultMsg ?? json.resultCode);
    return;
  }

  const arrays = findRecordArrays(json).sort((a, b) => b.length - a.length);
  const records = arrays[0] ?? [];
  console.log(`총 ${records.length}행 수신`);

  const bySchul = new Map();
  for (const r of records) {
    const code = r.SCHUL_CODE;
    if (!bySchul.has(code)) bySchul.set(code, []);
    bySchul.get(code).push(r);
  }

  const counts = [...bySchul.entries()].map(([code, rows]) => [code, rows.length]);
  counts.sort((a, b) => b[1] - a[1]);
  console.log(`학교 수: ${bySchul.size}, 학교당 최대 행 수: ${counts[0]?.[1]}`);
  console.log("행 수 분포(상위 5):", counts.slice(0, 5));

  if (target) {
    // SCHUL_CODE 정확히 일치하거나, 학교명에 target이 포함된 학교를 찾는다.
    const matches = [...bySchul.entries()].filter(
      ([code, rows]) => code === target || rows.some((r) => (r.SCHUL_NM ?? "").includes(target))
    );
    if (matches.length === 0) {
      console.log(`\n[없음] "${target}"과 일치하는 학교가 이 학교급×시군구 조합엔 없습니다.`);
      return;
    }
    for (const [code, rows] of matches) {
      console.log(`\n=== "${target}" 검색 결과: ${code} (${rows[0]?.SCHUL_NM}) — ${rows.length}행 ===`);
      console.log(JSON.stringify(rows, null, 2));
    }
    return;
  }

  const [multiCode] = counts[0] ?? [];
  if (multiCode) {
    console.log(`\n=== ${multiCode} 의 모든 행 ===`);
    console.log(JSON.stringify(bySchul.get(multiCode), null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
