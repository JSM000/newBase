// 학교알리미 OpenAPI 배치 수집 스크립트 (다중 엔드포인트 → 학교코드 기준 병합)
//
// 실행:
//   SCHOOLINFO_API_KEY=발급받은키 node scripts/collect-school-stats.mjs
//
// 환경변수 (전부 앞에 붙여서 지정, 예: DEBUG_RAW=1 SCHOOLINFO_API_KEY=xxx node ...):
//   SCHOOLINFO_API_KEY (필수)        — 학교알리미 OpenAPI 인증키
//   PBAN_YR=2025       (선택)        — pbanYr 자동탐지를 건너뛰고 이 연도로 고정. 기본은 자동탐지(최신 연도부터 후보 탐색)
//   DEBUG_RAW=1        (선택, 기본 꺼짐) — raw API 응답을 scripts/.debug/*.json 으로 저장
//   DEBUG_REASONS=1    (선택, 기본 꺼짐) — 실행 마지막에 "공시제외 사유 전수조사"(사유별 건수·예시) 로그 출력
//
// 참고:
//   - API 스펙: 요청 URL http://www.schoolinfo.go.kr/openApi.do (REST, JSON), apiType만 시트별로 다름
//     (시트명 괄호 번호와 대응: 학교기본정보=0, 학교 현황=62, 직위별 교원 현황=22 ...)
//   - 엔드포인트마다 필수 파라미터/지원 schulKndCode가 다름 — 문서 표기와 실제가 다른 경우도 있었음:
//     · 학교기본정보(0): apiKey, apiType, schulKndCode, sggCode 필수 (sggCode는 문서엔 "선택"이었지만 실제 필수), pbanYr 없음
//     · 그 외 전부(62,22,24,08,10,94,68,61,34,44,17,18,55): 위에 더해 pbanYr(공시연도, NUMBER 필수, 최근 3년만 제공)도 필수
//     · 24(표시과목별 교원 현황): depthNo(10:교과별/20:과목별)도 필수. 초등부(학교당 1행, 과목별 고정컬럼)와
//       중/고(학교당 여러 행 — 과목마다 한 행씩, depthNo=20 과목별로 조회)는 구조가 완전히 달라서
//       DATASETS에 apiType="24" 항목이 두 개(초등/중고) 있음 (DATASETS 내 주석 참고)
//     · 55(장학금 수혜 현황): schulKndCode에 초등학교(02) 미지원 — 중/고만 수집
//     새 엔드포인트를 추가할 때마다 해당 API 문서의 "요청인자" 표를 다시 확인할 것 (DATASETS 참고)
//   - sidoCode=43(충청북도), sggCode 14개는 _refs/시도시군구코드.xlsx 기준
//   - schulKndCode 목록(02:초등 03:중등 04:고등 05:특수 06:그외 07:각종)에 유치원 코드가 없음 — 미해결 사항으로 남김
//   - pbanYr 유효값은 자동탐지한다: 후보 연도를 최신부터 하나씩 찔러보고 처음 성공하는 값을 그 엔드포인트에 고정 사용
//   - 모든 시트에 공통으로 있는 제외여부(PBAN_EXCP_YN)="Y"인 행은 병합하지 않고 건너뜀 — 이건 "값이
//     0/없음"이 아니라 "학교가 이 항목 자체를 입력 안 해서 공시제외"된 것이라 null로 남겨야 함
//     (실측: 용암초등학교 지원시설현황(18) — "본교는 해당항목에 대해서 교육통계 입력자료가 없으므로 제외함")
//     이 체크 덕분에 값이 0이면 키가 생략되는 필드(교사현황17/지원시설현황18)에서 "공시제외"와
//     "진짜 0"을 구분할 수 있음 — 공시제외는 스킵→null, 진짜 0은 키 생략→toNumberOrNull(undefined)??0
//   - 환경위생관리 현황(42, 2-2-C "실내 환경 쾌적도")은 학교알리미 OpenAPI 포털에 목록이 없어 이 스크립트로
//     수집 불가 — _refs/학교통계_지도_구현계획.md 4번 미해결 사항 참고
//   - 일부 엔드포인트는 학교당 여러 행을 반환한다 — 기본 병합은 "overwrite"(마지막 값 유지):
//     · 94(학교폭력예방교육실적): 학기별로 여러 행 → mergeStrategy: "sum"(숫자 필드 누적 합산)
//     · 44(시설안전점검현황): 대장 6종(학교시설/물탱크/소방/전기/가스/승강기)별로 여러 행 →
//       dataset.combine()으로 이상없음여부/이상개수/최신점검일 3개로 종합 (probe-dataset.mjs로 실측 확인)

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const API_BASE = "http://www.schoolinfo.go.kr/openApi.do";
const SIDO_CODE = "43"; // 충청북도 (_refs/시도시군구코드.xlsx)

// sggCode는 API 문서상 "선택"이라 표기되어 있었지만 실제로는 필수 파라미터였음
// (응답: "시군구 코드(sggCode)는 필수 정보입니다.") — 충북 14개 시군구를 전부 순회해야 함.
// 출처: _refs/시도시군구코드.xlsx (시도명=충청북도)
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

// pbanYr 자동탐지 후보 (최신부터). PBAN_YR 환경변수가 있으면 이 목록을 건너뛰고 그 값만 시도.
const PBAN_YR_CANDIDATES = process.env.PBAN_YR
  ? [Number(process.env.PBAN_YR)]
  : [2026, 2025, 2024, 2023];

// public/ 밑에 둬서 클라이언트가 fetch('/data/chungbuk-schools.json')로 받아가게 함.
// src/data/에 두고 import하면 웹팩이 JS 번들에 포함시켜 지도 페이지를 안 보는 사용자에게도
// 번들 용량이 묻어가므로 지양 (_refs/학교통계_지도_구현계획.md 3-4 참고)
const OUTPUT_PATH = path.join(ROOT_DIR, "public/data/chungbuk-schools.json");
const DEBUG_DIR = path.join(ROOT_DIR, "scripts/.debug");
const DEBUG_RAW = process.env.DEBUG_RAW === "1";
const DEBUG_REASONS = process.env.DEBUG_REASONS === "1";

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  // 일부 필드(예: 학교현황(62)의 COL_SUM)가 "9(0)"처럼 괄호 주석이 붙은 문자열로 오거나
  // (예: 휴학생 수 등 부가정보로 추정), 08의 PER_STUDAY_DAY처럼 "  23.1"같이 앞에 공백이 붙어서
  // 오는 경우가 있어 trim 후 맨 앞 숫자만 뽑아 쓴다.
  const match = String(value).trim().match(/^-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function getApiKey() {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SCHOOLINFO_API_KEY 환경변수가 필요합니다. 예) SCHOOLINFO_API_KEY=xxx node scripts/collect-school-stats.mjs"
    );
  }
  return apiKey;
}

/**
 * 응답 JSON 안에서 "레코드로 보이는 객체 배열"을 전부 찾아 가장 큰 배열을 반환한다.
 * 정확한 래핑 키(list/resultList/items 등)를 검증하기 전까지 쓰는 방어적 탐색.
 */
function findRecordArrays(node, path_ = "$", found = []) {
  if (Array.isArray(node)) {
    const isRecordArray =
      node.length > 0 &&
      node.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));
    if (isRecordArray) {
      found.push({ path: path_, length: node.length });
    }
    node.forEach((item, i) => findRecordArrays(item, `${path_}[${i}]`, found));
  } else if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      findRecordArrays(value, `${path_}.${key}`, found);
    }
  }
  return found;
}

function findTotalCountHint(json) {
  const hits = [];
  const walk = (node, path_) => {
    if (node !== null && typeof node === "object" && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (/total|count/i.test(key) && (typeof value === "number" || typeof value === "string")) {
          hits.push({ path: `${path_}.${key}`, value });
        }
        walk(value, `${path_}.${key}`);
      }
    }
  };
  walk(json, "$");
  return hits;
}

function resolvePath(root, pathStr) {
  const tokens = pathStr
    .replace(/^\$/, "")
    .split(/\.|\[|\]/)
    .filter((t) => t !== "");
  let node = root;
  for (const token of tokens) {
    if (node == null) return undefined;
    node = node[token];
  }
  return node;
}

async function callApi({ apiType, schulKnd, sgg, pbanYr, extraParams }) {
  const apiKey = getApiKey();
  const url = new URL(API_BASE);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("apiType", apiType);
  url.searchParams.set("sidoCode", SIDO_CODE);
  url.searchParams.set("sggCode", sgg.code);
  url.searchParams.set("schulKndCode", schulKnd.code);
  if (pbanYr != null) {
    url.searchParams.set("pbanYr", String(pbanYr));
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (apiType=${apiType})`);
  }
  return res.json();
}

async function detectPbanYr(apiType, datasetName, probeSchulKnd, extraParams) {
  const probeSgg = CHUNGBUK_SGG_CODES[0];

  for (const yr of PBAN_YR_CANDIDATES) {
    const json = await callApi({ apiType, schulKnd: probeSchulKnd, sgg: probeSgg, pbanYr: yr, extraParams });
    const isFail = json && typeof json === "object" && json.resultCode && json.resultCode !== "success";
    const arrays = findRecordArrays(json);
    if (!isFail && arrays.length > 0) {
      console.log(`[pbanYr] ${datasetName}(apiType=${apiType}): ${yr}년 사용`);
      return yr;
    }
    console.log(
      `[pbanYr] ${datasetName}(apiType=${apiType}): ${yr}년 실패(${json?.resultMsg ?? "데이터 없음"}), 다음 후보 시도`
    );
  }
  throw new Error(
    `${datasetName}(apiType=${apiType})에서 사용 가능한 pbanYr을 찾지 못했습니다. PBAN_YR 환경변수로 직접 지정하세요.`
  );
}

async function fetchDatasetRecords(dataset, schulKnd, sgg, pbanYr) {
  const json = await callApi({ apiType: dataset.apiType, schulKnd, sgg, pbanYr, extraParams: dataset.extraParams });
  const label = `${dataset.name}(${dataset.apiType})/${schulKnd.name}/${sgg.name}`;

  if (DEBUG_RAW) {
    await mkdir(DEBUG_DIR, { recursive: true });
    const debugPath = path.join(DEBUG_DIR, `${dataset.apiType}-${schulKnd.code}-${sgg.code}.json`);
    await writeFile(debugPath, JSON.stringify(json, null, 2), "utf-8");
  }

  if (json && typeof json === "object" && json.resultCode && json.resultCode !== "success") {
    console.warn(`[warn] ${label}: API 오류 응답 - ${json.resultMsg ?? json.resultCode}`);
    return [];
  }

  const arrays = findRecordArrays(json).sort((a, b) => b.length - a.length);
  if (arrays.length === 0) {
    // 해당 시군구에 그 학교급이 없을 수도 있으므로(예: 특정 군에 고등학교 없음) 정상 상황
    return [];
  }

  const best = arrays[0];
  const totalHints = findTotalCountHint(json);
  for (const hint of totalHints) {
    const totalNum = Number(hint.value);
    if (Number.isFinite(totalNum) && totalNum > best.length) {
      console.warn(
        `[warn] ${label}: 응답 내 ${hint.path}=${hint.value} 가 레코드 수(${best.length})보다 큽니다. ` +
          `페이지네이션 파라미터가 필요할 수 있으니 API 문서를 확인하세요.`
      );
    }
  }

  return resolvePath(json, best.path) ?? [];
}

/**
 * 수집할 데이터셋 목록. 새 엔드포인트를 추가할 때는 여기에 항목만 추가하면 된다.
 * normalize()는 학교 객체에 병합될 "부분 필드"만 반환 — 시트마다 뜻이 분명한 고유 키를 써서
 * 다른 시트의 필드와 겹치지 않게 한다 (_refs/학교통계_지도_구현계획.md 3-1 참고).
 */
const DATASETS = [
  {
    apiType: "0",
    name: "학교기본정보",
    requiresPbanYr: false,
    // 이 데이터셋에 학교가 안 잡히면(드묾) 아래 필드들을 null로 채워 스키마를 통일한다.
    fields: [
      "schulNm",
      "schulKndCode",
      "schulKndNm",
      "fondScCode",
      "sidoOfficeNm",
      "eduSupportOfficeNm",
      "adrcdNm",
      "lctnScCode",
      "address",
      "detailAddress",
      "roadAddress",
      "zipCode",
      "foundedYmd",
      "position",
      "tel",
      "homepage",
      "isBranchSchool",
      "isClosed",
      "isSuspended",
    ],
    // 결과 JSON의 source.datasets[]에 그대로 실려서, "이 필드가 원래 API에서 뭐였는지"를
    // 스크립트 코드를 안 열어봐도 데이터 파일만 보고 알 수 있게 한다. 여러 필드를 합친 경우엔 배열.
    fieldSource: {
      schulNm: "SCHUL_NM", // 학교명
      schulKndCode: "SCHUL_KND_SC_CODE", // 학교급코드
      schulKndNm: "(schulKndCode 파라미터로 결정, API 필드 아님)",
      fondScCode: "FOND_SC_CODE", // 설립구분
      sidoOfficeNm: "ATPT_OFCDC_ORG_NM", // 시도교육청
      eduSupportOfficeNm: "JU_ORG_NM", // 교육지원청
      adrcdNm: "ADRCD_NM", // 지역
      lctnScCode: "LCTN_SC_CODE", // 소재지구분코드
      address: "ADRES_BRKDN", // 주소내역
      detailAddress: "DTLAD_BRKDN", // 상세주소내역
      roadAddress: "SCHUL_RDNMA", // 학교도로명 주소
      zipCode: "ZIP_CODE", // 우편번호
      foundedYmd: "FOND_YMD", // 설립일
      position: ["LTTUD", "LGTUD"], // 위도, 경도
      tel: "USER_TELNO", // 전화번호
      homepage: "HMPG_ADRES", // 홈페이지 주소
      isBranchSchool: "BNHH_YN", // 분교여부
      isClosed: "ABSCH_YN", // 폐교여부
      isSuspended: "CLOSE_YN", // 휴교여부
    },
    normalize(record, schulKnd) {
      const lat = Number(record.LTTUD);
      const lng = Number(record.LGTUD);
      const hasValidPosition = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

      return {
        schulNm: record.SCHUL_NM ?? null,
        schulKndCode: record.SCHUL_KND_SC_CODE ?? schulKnd.code,
        schulKndNm: schulKnd.name,
        fondScCode: record.FOND_SC_CODE ?? null,
        sidoOfficeNm: record.ATPT_OFCDC_ORG_NM ?? null,
        eduSupportOfficeNm: record.JU_ORG_NM ?? null,
        adrcdNm: record.ADRCD_NM ?? null,
        lctnScCode: record.LCTN_SC_CODE ?? null,
        address: record.ADRES_BRKDN ?? null,
        detailAddress: record.DTLAD_BRKDN ?? null,
        roadAddress: record.SCHUL_RDNMA ?? null,
        zipCode: record.ZIP_CODE ?? null,
        // 2-2-D 신설교 여부(초기 업무 부담) 판단용 (YYYYMMDD 문자열)
        foundedYmd: record.FOND_YMD ?? null,
        // 카카오맵 kakao.maps.LatLng(lat, lng) 생성자에 그대로 넣을 수 있도록 숫자로 보관.
        // 좌표가 없거나 0인 경우 null (마커 렌더링 시 이 학교는 건너뛰어야 함).
        position: hasValidPosition ? { lat, lng } : null,
        tel: record.USER_TELNO ?? null,
        homepage: record.HMPG_ADRES ?? null,
        isBranchSchool: record.BNHH_YN === "Y",
        isClosed: record.ABSCH_YN === "Y",
        isSuspended: record.CLOSE_YN === "Y",
      };
    },
  },
  {
    apiType: "62",
    name: "학교 현황",
    requiresPbanYr: true,
    excludedReasonField: "schoolStatusExcludedReason",
    // 폐교·분교장은 이 데이터셋에 안 잡힘 (정상) — 아래 필드는 null로 채워짐
    fields: [
      "homeroomClassCount",
      "studentCountTotal",
      "avgStudentsPerClass",
      "specialClassCount",
      "specialClassStudentCount",
      "schoolStatusExcludedReason",
    ],
    fieldSource: {
      homeroomClassCount: "COL_SUM", // 학급수계
      studentCountTotal: "COL_FGR_SUM", // 학생수계
      avgStudentsPerClass: "AVG_FGR_SUM", // 학급당학생수
      specialClassCount: "SP_SUM", // 특수학급 학급수계
      specialClassStudentCount: "SP_FGR_SUM", // 특수학급 학생수계
      schoolStatusExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // Tier1: 담임교사 자리 수(homeroomClassCount), 특수통합학급(specialClassCount/specialClassStudentCount), 학교규모
    // Tier2: 복식학급 추정(homeroomClassCount와 학년수 비교는 프론트에서)
    // 2-2: 과밀학급여부(avgStudentsPerClass), 통합교육업무부담(specialClass*)
    normalize(record) {
      return {
        homeroomClassCount: toNumberOrNull(record.COL_SUM),
        studentCountTotal: toNumberOrNull(record.COL_FGR_SUM),
        avgStudentsPerClass: toNumberOrNull(record.AVG_FGR_SUM),
        specialClassCount: toNumberOrNull(record.SP_SUM),
        specialClassStudentCount: toNumberOrNull(record.SP_FGR_SUM),
      };
    },
  },
  {
    apiType: "22",
    name: "직위별 교원 현황",
    requiresPbanYr: true,
    excludedReasonField: "teacherStatusExcludedReason",
    // 폐교·분교장은 이 데이터셋에 안 잡힘 (정상) — 아래 필드는 null로 채워짐
    fields: [
      "deputyPrincipalTeacherCount",
      "teacherCountTotal",
      "contractTeacherCount",
      "instructorCount",
      "teacherOnLeaveCount",
      "healthTeacherCount",
      "nutritionTeacherCount",
      "librarianTeacherCount",
      "teacherStatusExcludedReason",
    ],
    fieldSource: {
      deputyPrincipalTeacherCount: "COL_3", // 보직교사(계)
      teacherCountTotal: "COL_S", // 총계(계)
      contractTeacherCount: "COL_11", // 기간제교사(계)
      instructorCount: "COL_13", // 강사(계)
      teacherOnLeaveCount: "COL_R_SUM", // 휴직교원수
      healthTeacherCount: "COL_9", // 보건교사(계)
      nutritionTeacherCount: "COL_10", // 영양교사(계)
      librarianTeacherCount: "COL_7", // 사서교사(계)
      teacherStatusExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // Tier1: 부장교사 자리 수(deputyPrincipalTeacherCount), 학교규모(teacherCountTotal)
    // 2-2: 정교사 안정성(contractTeacherCount/instructorCount/teacherOnLeaveCount),
    //      보건·영양·사서 전문인력 배치(healthTeacherCount/nutritionTeacherCount/librarianTeacherCount)
    normalize(record) {
      return {
        deputyPrincipalTeacherCount: toNumberOrNull(record.COL_3),
        teacherCountTotal: toNumberOrNull(record.COL_S),
        contractTeacherCount: toNumberOrNull(record.COL_11),
        instructorCount: toNumberOrNull(record.COL_13),
        teacherOnLeaveCount: toNumberOrNull(record.COL_R_SUM),
        healthTeacherCount: toNumberOrNull(record.COL_9),
        nutritionTeacherCount: toNumberOrNull(record.COL_10),
        librarianTeacherCount: toNumberOrNull(record.COL_7),
      };
    },
  },
  {
    apiType: "24",
    name: "표시과목별 교원 현황(초등)",
    requiresPbanYr: true,
    // 초등부는 학교당 1행, 과목별 교원수(계)가 고정된 COL_1~14 컬럼으로 온다 (중/고와 구조가 완전히 다름 — 아래
    // "표시과목별 교원 현황(중고)" 항목 참고). depthNo(교과별=10/과목별=20)는 필수 파라미터지만 초등부
    // 컬럼은 depthNo와 무관하게 고정이라 10 고정.
    schulKndCodes: [{ code: "02", name: "초등학교" }],
    extraParams: { depthNo: "10" },
    excludedReasonField: "subjectTeacherExcludedReason",
    fields: ["specialistSubjectTeacherEstimate", "specialistSubjectTeacherBySubject", "subjectTeacherExcludedReason"],
    fieldSource: {
      specialistSubjectTeacherEstimate: ["COL_6", "COL_7", "COL_8", "COL_9", "COL_10"], // 실과(계)/체육(계)/음악(계)/미술(계)/외국어(영어)(계) 합
      // 국어/도덕/사회/수학/과학/실과/체육/음악/미술/외국어(영어)/컴퓨터/재량활동/통합교과/기타 각 교원수(계)
      specialistSubjectTeacherBySubject: [
        "COL_1",
        "COL_2",
        "COL_3",
        "COL_4",
        "COL_5",
        "COL_6",
        "COL_7",
        "COL_8",
        "COL_9",
        "COL_10",
        "COL_11",
        "COL_12",
        "COL_13",
        "COL_14",
      ],
      subjectTeacherExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // Tier2: 교과전담(월0.03) 규모 추정 — 명시 필드가 없어 실과/체육/음악/미술/영어 표시과목 교원수를
    // 더한 값을 "전담 규모 추정치"로 사용 (실제 전담 배정과 다를 수 있음, UI에 "추정치"로 표기 필요)
    // specialistSubjectTeacherBySubject는 상세 패널 참고용 breakdown — position처럼 지표 선택
    // 드롭다운 후보가 아니라서 객체로 묶어도 됨(_refs/학교통계_지도_구현계획.md 3-1 참고).
    // check-key-presence.mjs로 검증함(COL_9/미술 기준, 264행 전부 키 있음, 그중 256행이 명시적 0) —
    // 17/18과 달리 이 엔드포인트는 값이 0이어도 키가 생략되지 않고 항상 옴. 그래서 ?? 0 안 써도 안전함.
    normalize(record) {
      const subjectFields = ["COL_6", "COL_7", "COL_8", "COL_9", "COL_10"]; // 실과/체육/음악/미술/영어
      const sum = subjectFields.reduce((acc, key) => acc + (toNumberOrNull(record[key]) ?? 0), 0);
      return {
        specialistSubjectTeacherEstimate: sum,
        specialistSubjectTeacherBySubject: {
          국어: toNumberOrNull(record.COL_1),
          도덕: toNumberOrNull(record.COL_2),
          사회: toNumberOrNull(record.COL_3),
          수학: toNumberOrNull(record.COL_4),
          과학: toNumberOrNull(record.COL_5),
          실과: toNumberOrNull(record.COL_6),
          체육: toNumberOrNull(record.COL_7),
          음악: toNumberOrNull(record.COL_8),
          미술: toNumberOrNull(record.COL_9),
          "외국어(영어)": toNumberOrNull(record.COL_10),
          컴퓨터: toNumberOrNull(record.COL_11),
          재량활동: toNumberOrNull(record.COL_12),
          통합교과: toNumberOrNull(record.COL_13),
          기타: toNumberOrNull(record.COL_14),
        },
      };
    },
  },
  {
    apiType: "24",
    name: "표시과목별 교원 현황(중고)",
    requiresPbanYr: true,
    // 중/고는 초등부와 달리 학교당 여러 행(과목별 목록)을 반환하는 구조 — FMTCD/SBJT_CODE 등으로
    // 과목이 나뉘고, 과목명(SBJT_NM)·교원수(SUM_CNT)가 행마다 하나씩 옴. depthNo=20(과목별)로 조회해서
    // combine()으로 학교당 여러 행을 { 과목명: 교원수 } 객체 하나로 누적.
    schulKndCodes: [
      { code: "03", name: "중학교" },
      { code: "04", name: "고등학교" },
    ],
    extraParams: { depthNo: "20" },
    excludedReasonField: "subjectTeacherSecondaryExcludedReason",
    fields: ["specialistSubjectTeacherBySubject", "subjectTeacherSecondaryExcludedReason"],
    fieldSource: {
      specialistSubjectTeacherBySubject: ["SBJT_NM", "SUM_CNT"], // 과목명, 교원수(계) — 과목명은 학교마다 동적으로 다름
      subjectTeacherSecondaryExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    normalize(record) {
      const subject = record.SBJT_NM ?? record.ORGA_NM ?? "기타";
      return { specialistSubjectTeacherBySubject: { [subject]: toNumberOrNull(record.SUM_CNT) ?? 0 } };
    },
    // 학교당 여러 행(과목마다 하나)을 하나의 객체로 누적. 같은 과목명이 중복되면(드묾) 더함.
    combine(existing, incoming) {
      const merged = { ...(existing.specialistSubjectTeacherBySubject ?? {}) };
      for (const [subject, count] of Object.entries(incoming.specialistSubjectTeacherBySubject)) {
        merged[subject] = (merged[subject] ?? 0) + count;
      }
      return { specialistSubjectTeacherBySubject: merged };
    },
  },
  {
    apiType: "08",
    name: "수업일수 및 수업시수 현황",
    requiresPbanYr: true,
    excludedReasonField: "teachingHoursExcludedReason",
    fields: ["avgWeeklyTeachingHoursPerTeacher", "teachingHoursExcludedReason"],
    fieldSource: {
      avgWeeklyTeachingHoursPerTeacher: "PER_STUDAY_DAY", // 주당평균수업시수(교사 1인당)
      teachingHoursExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-A: 교사 1인당 주당 수업시수
    normalize(record) {
      return { avgWeeklyTeachingHoursPerTeacher: toNumberOrNull(record.PER_STUDAY_DAY) };
    },
  },
  {
    apiType: "10",
    name: "전·출입 및 학업중단 학생 수",
    requiresPbanYr: true,
    excludedReasonField: "transferStudentExcludedReason",
    fields: ["transferInStudentCount", "transferOutStudentCount", "transferStudentExcludedReason"],
    fieldSource: {
      transferInStudentCount: "MVIN_SUM", // 전입학생수(계)
      transferOutStudentCount: "MVT_SUM", // 전출학생수(계)
      transferStudentExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-A: 전입출 잦은 정도
    normalize(record) {
      return {
        transferInStudentCount: toNumberOrNull(record.MVIN_SUM),
        transferOutStudentCount: toNumberOrNull(record.MVT_SUM),
      };
    },
  },
  {
    apiType: "94",
    name: "대상별 학교폭력 예방교육 실적",
    requiresPbanYr: true,
    // "구분"(학기 등)별로 학교당 여러 행이 나올 수 있어 숫자 필드는 합산한다.
    mergeStrategy: "sum",
    excludedReasonField: "bullyingPreventionExcludedReason",
    fields: ["bullyingPreventionInstructorCount", "bullyingPreventionExcludedReason"],
    fieldSource: {
      bullyingPreventionInstructorCount: [
        "SMAGE_MDAT_NMPR_FGR1", // 지도교사수-동아리·학생자치활동
        "SMAGE_CNSL_NMPR_FGR1", // 지도교사수-또래활동
        "ATMY_LEGAL_NMPR_FGR1", // 지도교사수-교육주간 활동
        "ETC_NMPR_FGR1", // 지도교사수-기타 학교폭력 예방활동
      ],
      bullyingPreventionExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-A: 생활지도 업무량 — 예방활동 지도교사 연인원(동아리·또래활동·교육주간·기타 합)
    normalize(record) {
      const fieldKeys = [
        "SMAGE_MDAT_NMPR_FGR1",
        "SMAGE_CNSL_NMPR_FGR1",
        "ATMY_LEGAL_NMPR_FGR1",
        "ETC_NMPR_FGR1",
      ];
      const sum = fieldKeys.reduce((acc, key) => acc + (toNumberOrNull(record[key]) ?? 0), 0);
      return { bullyingPreventionInstructorCount: sum };
    },
  },
  {
    apiType: "68",
    name: "직원 현황",
    requiresPbanYr: true,
    excludedReasonField: "staffExcludedReason",
    fields: ["generalStaffCount", "eduSupportStaffCount", "staffExcludedReason"],
    fieldSource: {
      generalStaffCount: "SUM_1", // 일반직계
      eduSupportStaffCount: "SUM_3", // 교육공무직계(2019년이후)
      staffExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-B: 행정업무 분담 가능성
    normalize(record) {
      return {
        generalStaffCount: toNumberOrNull(record.SUM_1),
        eduSupportStaffCount: toNumberOrNull(record.SUM_3),
      };
    },
  },
  {
    apiType: "61",
    name: "학생·학부모 상담계획 및 실시 현황",
    requiresPbanYr: true,
    excludedReasonField: "counselingExcludedReason",
    fields: ["hasInnerCounselor", "hasOuterCounselor", "hasWeeClass", "counselingExcludedReason"],
    fieldSource: {
      hasInnerCounselor: "INNER_CNSL_SPLST_OPER_YN", // 상담실적(내부상담전문가실시여부)
      hasOuterCounselor: "EXTRL_CNSL_SPLST_OPER_YN", // 상담실적(외부상담전문가실시여부)
      hasWeeClass: "WEE_CINSTL_YN", // 교내 WEE클래스 설치여부
      counselingExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-B: 상담 지원체계
    normalize(record) {
      return {
        hasInnerCounselor: record.INNER_CNSL_SPLST_OPER_YN === "Y",
        hasOuterCounselor: record.EXTRL_CNSL_SPLST_OPER_YN === "Y",
        hasWeeClass: record.WEE_CINSTL_YN === "Y",
      };
    },
  },
  {
    apiType: "34",
    name: "급식 실시 현황",
    requiresPbanYr: true,
    excludedReasonField: "mealExcludedReason",
    fields: ["mealPlaceCafeteria", "mealPlaceClassroom", "mealExcludedReason"],
    fieldSource: {
      mealPlaceCafeteria: "COL_4", // 배식장소 - 배식장소(식당)
      mealPlaceClassroom: "COL_5", // 배식장소 - 배식장소(교실)
      mealExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-B: 급식 배식 부담 (식당 배식 vs 교실 배식)
    normalize(record) {
      return {
        mealPlaceCafeteria: record.COL_4 === "Y",
        mealPlaceClassroom: record.COL_5 === "Y",
      };
    },
  },
  {
    apiType: "44",
    name: "시설안전 점검 현황",
    requiresPbanYr: true,
    // 학교당 대장(CK_BBOOK_NM) 6종 — 학교시설/물탱크(저수조)위생/소방/전기/가스/승강기 — 이 각각 한 행씩 나온다.
    // probe-dataset.mjs로 실측 확인함(CK_RSLT_CODE: "O" = 양호로 보임). 6행을 종합해서
    // "전체 이상없음 여부/이상 대장 수/이상 대장 이름 목록/가장 최근 점검일" 4개 필드로 집계.
    excludedReasonField: "facilitySafetyExcludedReason",
    fields: [
      "facilitySafetyAllOk",
      "facilitySafetyIssueCount",
      "facilitySafetyIssueLedgerNames",
      "facilitySafetyLatestCheckDate",
      "facilitySafetyExcludedReason",
    ],
    fieldSource: {
      facilitySafetyAllOk: "CK_RSLT_CODE", // 관리유무
      facilitySafetyIssueCount: "CK_RSLT_CODE", // 관리유무
      facilitySafetyIssueLedgerNames: ["CK_RSLT_CODE", "CK_BBOOK_NM"], // 관리유무, 대장명
      facilitySafetyLatestCheckDate: "CK_YMD", // 최종점검일자
      facilitySafetyExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-C: 건물 안전 관리상태
    normalize(record) {
      const isOk = record.CK_RSLT_CODE === "O";
      return {
        facilitySafetyAllOk: isOk,
        facilitySafetyIssueCount: isOk ? 0 : 1,
        // 이상 있는 대장명만 모아서 "/"로 이어붙임 (예: "소방 안전점검표/가스 점검표"). 정상이면 빈 문자열.
        facilitySafetyIssueLedgerNames: isOk ? "" : (record.CK_BBOOK_NM ?? ""),
        facilitySafetyLatestCheckDate: record.CK_YMD ?? null,
      };
    },
    // 여러 대장 행을 하나로 합치는 규칙: 하나라도 이상이면 allOk=false, 이상 개수·이상 대장명은 누적,
    // 점검일은 가장 최근 날짜(YYYYMMDD 문자열이라 사전식 비교로 최댓값 = 최신)를 남긴다.
    combine(existing, incoming) {
      const names = [existing.facilitySafetyIssueLedgerNames, incoming.facilitySafetyIssueLedgerNames].filter(
        Boolean
      );
      return {
        facilitySafetyAllOk: (existing.facilitySafetyAllOk ?? true) && incoming.facilitySafetyAllOk,
        facilitySafetyIssueCount: (existing.facilitySafetyIssueCount ?? 0) + incoming.facilitySafetyIssueCount,
        facilitySafetyIssueLedgerNames: names.join("/"),
        facilitySafetyLatestCheckDate:
          !existing.facilitySafetyLatestCheckDate ||
          (incoming.facilitySafetyLatestCheckDate ?? "") > existing.facilitySafetyLatestCheckDate
            ? incoming.facilitySafetyLatestCheckDate
            : existing.facilitySafetyLatestCheckDate,
      };
    },
  },
  {
    apiType: "17",
    name: "교사(校舍) 현황",
    requiresPbanYr: true,
    excludedReasonField: "teacherSupportSpaceExcludedReason",
    fields: ["teacherSupportSpaceCount", "teacherSupportSpaceExcludedReason"],
    fieldSource: {
      teacherSupportSpaceCount: "COL_7", // 교원지원공간
      teacherSupportSpaceExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-C: 교사 지원공간
    // probe-dataset.mjs로 확인: 값이 0인 시설 항목은 키 자체가 응답에서 빠짐(예: 이 학교 응답엔
    // COL_10/COL_13/COL_14가 아예 없음) — 행이 존재하는데 키가 없으면 "모름"이 아니라 "0개"이므로 기본값 0.
    normalize(record) {
      return { teacherSupportSpaceCount: toNumberOrNull(record.COL_7) ?? 0 };
    },
  },
  {
    apiType: "18",
    name: "학생교육활동에 필요한 지원시설 현황",
    requiresPbanYr: true,
    excludedReasonField: "facilitiesExcludedReason",
    fields: ["gymnasiumCount", "auditoriumCount", "facilitiesExcludedReason"],
    fieldSource: {
      gymnasiumCount: "COL_1", // 체육관
      auditoriumCount: "COL_2", // 강당
      facilitiesExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-C: 체육관·강당 규모
    // 학교알리미 정의(사용자 확인, schoolinfo.go.kr 항목 설명):
    //   체육관 = 전용(정규)체육관 또는 체육활동 목적의 다목적 강당(강당 겸용 체육관)
    //   강당 = 체육활동은 하지 않고 집회 목적으로만 쓰는 공간. 단, 원래 "강당"으로 지어졌으면
    //          현재 다른 용도로 쓰이고 있어도 강당으로 집계됨
    //   → 체육관은 있는데 강당은 없는 학교(272개, 다수)가 많은 이유: 체육관이 집회까지 겸하는
    //     경우가 많아서 별도 강당으로 잡히지 않는 것으로 보임
    // 17과 동일하게 값이 0이면 키 자체가 생략되는 것으로 보여 기본값 0 처리.
    normalize(record) {
      return {
        gymnasiumCount: toNumberOrNull(record.COL_1) ?? 0,
        auditoriumCount: toNumberOrNull(record.COL_2) ?? 0,
      };
    },
  },
  {
    apiType: "55",
    name: "장학금 수혜 현황",
    requiresPbanYr: true,
    // 이 엔드포인트는 초등학교(02)를 지원하지 않음 (schulKndCode: 03/04/05만 필수값으로 명시됨)
    schulKndCodes: [
      { code: "03", name: "중학교" },
      { code: "04", name: "고등학교" },
    ],
    excludedReasonField: "scholarshipExcludedReason",
    fields: ["scholarshipRecipientCount", "tuitionSupportRecipientCount", "scholarshipExcludedReason"],
    fieldSource: {
      scholarshipRecipientCount: "SCHO_NMPR_FGR", // 장학금인원
      tuitionSupportRecipientCount: "SCE_RDCTN_NMPR_FGR", // 학비지원인원
      scholarshipExcludedReason: "PBAN_EXCP_RSN", // 제외사유
    },
    // 2-2-E: 저소득층 비율 추정
    normalize(record) {
      return {
        scholarshipRecipientCount: toNumberOrNull(record.SCHO_NMPR_FGR),
        tuitionSupportRecipientCount: toNumberOrNull(record.SCE_RDCTN_NMPR_FGR),
      };
    },
  },
];

function mergeIntoSchool(map, schulCode, partial, dataset) {
  if (!schulCode) return;
  const existing = map.get(schulCode) ?? { schulCode };
  if (dataset?.combine) {
    // 학교당 여러 행이 나오는 데이터셋이 자기만의 규칙으로 기존 값과 새 값을 합치는 경우
    // (예: 44 시설안전점검현황 — 대장 6종을 이상없음여부/이상개수/최신점검일로 종합)
    map.set(schulCode, { ...existing, ...dataset.combine(existing, partial) });
  } else if (dataset?.mergeStrategy === "sum") {
    // 한 학교에 여러 행이 잡히는 데이터셋(예: 학기별로 나뉜 실적)용 — 숫자 필드는 누적 합산.
    const merged = { ...existing };
    for (const [key, value] of Object.entries(partial)) {
      if (typeof value === "number") {
        merged[key] = (typeof existing[key] === "number" ? existing[key] : 0) + value;
      } else {
        merged[key] = value;
      }
    }
    map.set(schulCode, merged);
  } else {
    map.set(schulCode, { ...existing, ...partial });
  }
}

async function main() {
  getApiKey(); // 조기 검증

  const schoolsByCode = new Map();
  // 공시제외 사유 전수조사용 — 사유 문구별로 몇 번 나왔는지, 어느 데이터셋/학교에서 나왔는지 수집
  const excludedReasons = new Map();

  for (const dataset of DATASETS) {
    const schulKndCodes = dataset.schulKndCodes ?? SCHUL_KND_CODES;
    const pbanYr = dataset.requiresPbanYr
      ? await detectPbanYr(dataset.apiType, dataset.name, schulKndCodes[0], dataset.extraParams)
      : null;

    console.log(
      `\n[fetch] ${dataset.name}(apiType=${dataset.apiType}) - ${schulKndCodes.map((s) => s.name).join("/")} x 14개 시군구 순회`
    );
    let recordCount = 0;
    let excludedCount = 0;
    for (const schulKnd of schulKndCodes) {
      for (const sgg of CHUNGBUK_SGG_CODES) {
        const records = await fetchDatasetRecords(dataset, schulKnd, sgg, pbanYr);
        for (const record of records) {
          const schulCode = record.SCHUL_CODE ?? null;
          if (!schulCode) continue;
          // 공시제외(PBAN_EXCP_YN=Y) 행은 "값이 0/없음"이 아니라 "학교가 이 항목을 아예 입력 안 함"이므로
          // 병합하지 않고 건너뛴다 — 그러면 이 학교는 이 데이터셋에 없는 것과 똑같이 자동으로 null 처리된다.
          // (실측 사례: 용암초등학교 지원시설현황(18) — PBAN_EXCP_RSN: "본교는 해당항목에 대해서
          //  교육통계 입력자료가 없으므로 제외함.")
          if (record.PBAN_EXCP_YN === "Y") {
            excludedCount += 1;
            const reason = record.PBAN_EXCP_RSN ?? "(사유 없음)";
            if (!excludedReasons.has(reason)) {
              excludedReasons.set(reason, { count: 0, examples: [] });
            }
            const entry = excludedReasons.get(reason);
            entry.count += 1;
            if (entry.examples.length < 3) {
              entry.examples.push(`${dataset.name}/${record.SCHUL_NM ?? schulCode}`);
            }
            // 서비스에서 "왜 이 데이터가 없는지" 보여줄 수 있도록 사유를 학교 객체에 직접 저장.
            // combine/sum 등 데이터셋별 병합 전략과 무관한 별도 필드라 mergeIntoSchool을 거치지 않고 바로 설정.
            // 44/94처럼 학교당 여러 행이 나오는 데이터셋은 행마다 사유가 다를 수 있어 덮어쓰지 않고
            // 서로 다른 사유를 전부 "/"로 이어붙여 보관 (facilitySafetyIssueLedgerNames와 같은 방식).
            if (dataset.excludedReasonField) {
              const school = schoolsByCode.get(schulCode) ?? { schulCode };
              const field = dataset.excludedReasonField;
              const existingReasons = school[field] ? school[field].split(" / ") : [];
              if (!existingReasons.includes(reason)) existingReasons.push(reason);
              school[field] = existingReasons.join(" / ");
              schoolsByCode.set(schulCode, school);
            }
            continue;
          }
          mergeIntoSchool(schoolsByCode, schulCode, dataset.normalize(record, schulKnd), dataset);
          recordCount += 1;
        }
      }
    }
    console.log(`[done] ${dataset.name}: ${recordCount}건 병합`);
    if (excludedCount > 0) {
      console.log(`[skip] ${dataset.name}: 공시제외(PBAN_EXCP_YN=Y) ${excludedCount}건 건너뜀 (null로 남음)`);
    }
  }

  // 특정 데이터셋에서 못 찾은 학교는 그 데이터셋 필드가 아예 없는(undefined) 상태이므로,
  // 스키마를 통일하기 위해 명시적으로 null을 채운다.
  for (const school of schoolsByCode.values()) {
    for (const dataset of DATASETS) {
      for (const field of dataset.fields) {
        if (!(field in school)) school[field] = null;
      }
    }
  }

  // 학교기본정보(0)에 없어서 이름/학교급/좌표가 전부 null인 레코드는 지도에 표시할 수 없으므로 제외
  const orphans = [...schoolsByCode.values()].filter((s) => !s.schulNm);
  for (const orphan of orphans) {
    console.warn(`[warn] 학교기본정보 없는 레코드 제외: ${orphan.schulCode}`);
    schoolsByCode.delete(orphan.schulCode);
  }

  const schools = [...schoolsByCode.values()].sort((a, b) => {
    if (a.schulKndCode !== b.schulKndCode) return (a.schulKndCode ?? "").localeCompare(b.schulKndCode ?? "");
    return (a.schulNm ?? "").localeCompare(b.schulNm ?? "", "ko");
  });

  const missingPositionCount = schools.filter((s) => !s.position).length;

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      api: "schoolinfo.go.kr openApi.do",
      // fields/excludedReasonField/fieldSource를 같이 내려서, 스크립트 코드를 안 열어봐도
      // 데이터 파일만 보고 "이 필드가 null인 이유는 어느 필드를 봐야 하는지"(excludedReasonField)와
      // "이 필드가 원래 API에서 뭐였는지"(fieldSource)를 알 수 있게 함
      datasets: DATASETS.map((d) => ({
        apiType: d.apiType,
        name: d.name,
        fields: d.fields,
        excludedReasonField: d.excludedReasonField ?? null,
        fieldSource: d.fieldSource ?? null,
      })),
      sidoCode: SIDO_CODE,
      sidoName: "충청북도",
      sggCodes: CHUNGBUK_SGG_CODES.map((s) => s.code),
      schulKndCodes: SCHUL_KND_CODES.map((s) => s.code),
    },
    count: schools.length,
    schools,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n총 ${schools.length}개 학교 저장 완료 -> ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
  for (const schulKnd of SCHUL_KND_CODES) {
    const n = schools.filter((s) => s.schulKndCode === schulKnd.code).length;
    console.log(`  ${schulKnd.name}(${schulKnd.code}): ${n}개`);
  }
  if (missingPositionCount > 0) {
    console.warn(`[warn] 좌표(LTTUD/LGTUD) 누락 학교 ${missingPositionCount}개 — position: null 로 저장됨`);
  }

  // 공시제외 사유 전수조사는 평소엔 안 찍고, 필요할 때만(DEBUG_REASONS=1) 자세히 본다.
  // 사유 자체는 이미 각 학교의 xxxExcludedReason 필드에 저장돼 있어 평소엔 이 로그가 없어도 됨.
  if (DEBUG_REASONS && excludedReasons.size > 0) {
    console.log(`\n공시제외(PBAN_EXCP_YN=Y) 사유 전수조사 — 서로 다른 사유 ${excludedReasons.size}종:`);
    const sorted = [...excludedReasons.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [reason, { count, examples }] of sorted) {
      console.log(`  [${count}건] "${reason}"`);
      console.log(`    예: ${examples.join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
