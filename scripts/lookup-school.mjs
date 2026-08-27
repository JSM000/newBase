// 특정 SCHUL_CODE 하나를 여러 apiType으로 조회해서 raw 레코드 전체를 그대로 출력하는 진단용 스크립트.
// 어떤 학교급/시군구에 속하는지 모를 때, 전체 조합을 순회하며 찾는다.
//
// 실행:
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/lookup-school.mjs S110002249

const API_BASE = "http://www.schoolinfo.go.kr/openApi.do";
const SIDO_CODE = "43";

const CHUNGBUK_SGG_CODES = [
  { code: "43111", name: "청주시 상당구" },
  { code: "43112", name: "청주시 서원구" },
  { code: "43113", name: "청주시 흥덕구" },
  { code: "43114", name: "청주시 청원구" },
  { code: "43130", name: "충주시" },
  { code: "43150", name: "제천시" },
  { code: "43720", name: "보은군" },
  { code: "43730", name: "옥천군" },
  { code: "43740", name: "영동군" },
  { code: "43745", name: "증평군" },
  { code: "43750", name: "진천군" },
  { code: "43760", name: "괴산군" },
  { code: "43770", name: "음성군" },
  { code: "43800", name: "단양군" },
];

const SCHUL_KND_CODES = [
  { code: "02", name: "초등학교" },
  { code: "03", name: "중학교" },
  { code: "04", name: "고등학교" },
];

const TARGETS = [
  { apiType: "0", name: "학교기본정보", requiresPbanYr: false },
  { apiType: "62", name: "학교 현황", requiresPbanYr: true },
  { apiType: "22", name: "직위별 교원 현황", requiresPbanYr: true },
];

const PBAN_YR = process.env.PBAN_YR ? Number(process.env.PBAN_YR) : 2026;

function findRecordArrays(node, path_ = "$", found = []) {
  if (Array.isArray(node)) {
    const isRecordArray =
      node.length > 0 &&
      node.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));
    if (isRecordArray) found.push(node);
    node.forEach((item) => findRecordArrays(item, path_, found));
  } else if (node !== null && typeof node === "object") {
    for (const value of Object.values(node)) findRecordArrays(value, path_, found);
  }
  return found;
}

async function callApi(apiKey, { apiType, schulKnd, sgg, pbanYr }) {
  const url = new URL(API_BASE);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("apiType", apiType);
  url.searchParams.set("sidoCode", SIDO_CODE);
  url.searchParams.set("sggCode", sgg.code);
  url.searchParams.set("schulKndCode", schulKnd.code);
  if (pbanYr != null) url.searchParams.set("pbanYr", String(pbanYr));
  const res = await fetch(url);
  return res.json();
}

async function main() {
  const targetCode = process.argv[2];
  if (!targetCode) {
    throw new Error("사용법: node scripts/lookup-school.mjs <SCHUL_CODE>");
  }
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) {
    throw new Error("SCHOOLINFO_API_KEY 환경변수가 필요합니다.");
  }

  for (const target of TARGETS) {
    console.log(`\n=== ${target.name}(apiType=${target.apiType}) 에서 ${targetCode} 검색 ===`);
    let found = false;
    for (const schulKnd of SCHUL_KND_CODES) {
      for (const sgg of CHUNGBUK_SGG_CODES) {
        const json = await callApi(apiKey, {
          apiType: target.apiType,
          schulKnd,
          sgg,
          pbanYr: target.requiresPbanYr ? PBAN_YR : null,
        });
        if (json && typeof json === "object" && json.resultCode && json.resultCode !== "success") continue;

        const arrays = findRecordArrays(json);
        for (const arr of arrays) {
          const hit = arr.find((r) => r && r.SCHUL_CODE === targetCode);
          if (hit) {
            console.log(`[찾음] ${schulKnd.name}/${sgg.name}`);
            console.log(JSON.stringify(hit, null, 2));
            found = true;
          }
        }
      }
    }
    if (!found) {
      console.log(`[없음] ${target.name}에는 ${targetCode}가 어느 학교급×시군구 조합에도 없음`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
