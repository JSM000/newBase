// apiType=18(지원시설현황) 원본 API 응답에서 바로 COL_1(체육관)/COL_2(강당) 키 존재 여부를 확인해서
// "둘다 있음/체육관만/강당만/둘다 없음" 4가지로 분류하는 스크립트.
// 병합된 public/data/chungbuk-schools.json을 거치지 않고, API 호출 결과 원본에서 직접 판단한다.
//
// 실행:
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/check-facility-combo.mjs

const API_BASE = "http://www.schoolinfo.go.kr/openApi.do";
const SIDO_CODE = "43";
const PBAN_YR = process.env.PBAN_YR ?? "2026";
const API_TYPE = "18";

const CHUNGBUK_SGG_CODES = [
  "43111", "43112", "43113", "43114", "43130", "43150",
  "43720", "43730", "43740", "43745", "43750", "43760", "43770", "43800",
];
const SCHUL_KND_CODES = ["02", "03", "04"];

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
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) throw new Error("SCHOOLINFO_API_KEY 환경변수가 필요합니다.");

  const groups = { both: [], gymOnly: [], audOnly: [], neither: [] };
  let totalRows = 0;

  for (const schulKndCode of SCHUL_KND_CODES) {
    for (const sggCode of CHUNGBUK_SGG_CODES) {
      const url = new URL(API_BASE);
      url.searchParams.set("apiKey", apiKey);
      url.searchParams.set("apiType", API_TYPE);
      url.searchParams.set("sidoCode", SIDO_CODE);
      url.searchParams.set("sggCode", sggCode);
      url.searchParams.set("schulKndCode", schulKndCode);
      url.searchParams.set("pbanYr", PBAN_YR);

      const res = await fetch(url);
      const json = await res.json();
      if (json && typeof json === "object" && json.resultCode && json.resultCode !== "success") continue;

      const arrays = findRecordArrays(json).sort((a, b) => b.length - a.length);
      const records = arrays[0] ?? [];

      for (const r of records) {
        totalRows += 1;
        const hasGym = Object.prototype.hasOwnProperty.call(r, "COL_1");
        const hasAud = Object.prototype.hasOwnProperty.call(r, "COL_2");
        const entry = { name: r.SCHUL_NM, code: r.SCHUL_CODE };
        if (hasGym && hasAud) groups.both.push(entry);
        else if (hasGym && !hasAud) groups.gymOnly.push(entry);
        else if (!hasGym && hasAud) groups.audOnly.push(entry);
        else groups.neither.push(entry);
      }
    }
  }

  console.log(`총 행 수: ${totalRows}`);
  console.log(`체육관+강당 둘다 있음: ${groups.both.length}`);
  console.log(`체육관만 있음: ${groups.gymOnly.length}`);
  console.log(`강당만 있음: ${groups.audOnly.length}`);
  console.log(`둘다 없음: ${groups.neither.length}`);
  console.log(
    `합계 체크: ${groups.both.length + groups.gymOnly.length + groups.audOnly.length + groups.neither.length} (총 행 수와 같아야 함)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
