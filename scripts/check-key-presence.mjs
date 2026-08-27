// apiType 18의 COL_2(강당) 필드가 실제 API 응답에서 "명시적으로 0"으로 오는 경우와
// "키 자체가 아예 없는" 경우를 구분해서 세어보는 진단용 스크립트.
// 우리 코드는 이 둘을 똑같이 최종값 0으로 처리하지만, API가 실제로 어느 쪽인지 확인하기 위함.
//
// 실행:
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/check-key-presence.mjs <필드키> <apiType> [schulKndCode 콤마구분] [depthNo]
//   예) apiType=24(표시과목별 교원 현황) 초등부 COL_9(미술) 확인:
//   SCHOOLINFO_API_KEY=xxx node scripts/check-key-presence.mjs COL_9 24 02 10

const API_BASE = "http://www.schoolinfo.go.kr/openApi.do";
const SIDO_CODE = "43";
const PBAN_YR = process.env.PBAN_YR ?? "2026";
const FIELD_KEY = process.argv[2] ?? "COL_2";
const API_TYPE = process.argv[3] ?? "18";
const DEPTH_NO = process.argv[5]; // 선택 — apiType=24처럼 depthNo가 필요한 엔드포인트용

const CHUNGBUK_SGG_CODES = [
  "43111", "43112", "43113", "43114", "43130", "43150",
  "43720", "43730", "43740", "43745", "43750", "43760", "43770", "43800",
];
const SCHUL_KND_CODES = (process.argv[4] ?? "02,03,04").split(",");

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

  let totalRows = 0;
  let keyPresent = 0;
  let keyPresentZero = 0;
  let keyPresentNonZero = 0;
  let keyAbsent = 0;
  const explicitZeroExamples = [];

  for (const schulKndCode of SCHUL_KND_CODES) {
    for (const sggCode of CHUNGBUK_SGG_CODES) {
      const url = new URL(API_BASE);
      url.searchParams.set("apiKey", apiKey);
      url.searchParams.set("apiType", API_TYPE);
      url.searchParams.set("sidoCode", SIDO_CODE);
      url.searchParams.set("sggCode", sggCode);
      url.searchParams.set("schulKndCode", schulKndCode);
      url.searchParams.set("pbanYr", PBAN_YR);
      if (DEPTH_NO) url.searchParams.set("depthNo", DEPTH_NO);

      const res = await fetch(url);
      const json = await res.json();
      if (json && typeof json === "object" && json.resultCode && json.resultCode !== "success") continue;

      const arrays = findRecordArrays(json).sort((a, b) => b.length - a.length);
      const records = arrays[0] ?? [];

      for (const r of records) {
        totalRows += 1;
        if (Object.prototype.hasOwnProperty.call(r, FIELD_KEY)) {
          keyPresent += 1;
          if (r[FIELD_KEY] === 0 || r[FIELD_KEY] === "0") {
            keyPresentZero += 1;
            if (explicitZeroExamples.length < 3) {
              explicitZeroExamples.push({ SCHUL_NM: r.SCHUL_NM, SCHUL_CODE: r.SCHUL_CODE, [FIELD_KEY]: r[FIELD_KEY] });
            }
          } else {
            keyPresentNonZero += 1;
          }
        } else {
          keyAbsent += 1;
        }
      }
    }
  }

  console.log(`apiType=${API_TYPE}, 필드=${FIELD_KEY}`);
  console.log(`총 행 수: ${totalRows}`);
  console.log(`키 있음: ${keyPresent} (그중 명시적 0: ${keyPresentZero}, 0이 아닌 값: ${keyPresentNonZero})`);
  console.log(`키 없음(생략): ${keyAbsent}`);
  if (explicitZeroExamples.length > 0) {
    console.log(`\n명시적으로 0이 온 예시:`, JSON.stringify(explicitZeroExamples, null, 2));
  } else {
    console.log(`\n명시적으로 0이 온 사례 없음 — 값이 0일 땐 키 자체가 항상 생략되는 것으로 보임.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
