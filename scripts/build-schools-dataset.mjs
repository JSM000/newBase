// public/data/chungbuk-schools.json(학교알리미 원본, collect-school-stats.mjs 산출물)을 읽어서
// 프론트가 실제로 fetch하는 "렌더링용" 데이터셋으로 최적화해 별도 파일로 저장한다.
//
// 계층 구조 (_refs/학교통계_지도_구현계획.md 참고):
//   collect-school-stats.mjs  → chungbuk-schools.json        (원본 그대로 보전, 사람이 읽고 디버깅하는 용도)
//   build-schools-dataset.mjs → chungbuk-schools-render.json (이 스크립트, 프론트 전용 최적화 산출물) ← 지금 여기
//   build-school-clusters.mjs → chungbuk-school-clusters.json (render 파일을 입력으로 클러스터 위치 계산)
//
// 지금은 학교알리미 원본만 최적화하지만, 나중에 연구학교 등 다른 출처의 데이터를 병합하게 되면
// 이 스크립트에 "다른 원본 읽기 → schulCode/이름 기준 매칭 → merge" 단계를 추가하면 된다
// (수집 스크립트 자체는 출처별로 분리 유지 — collect-school-stats.mjs는 학교알리미 전용으로 그대로 둠).
//
// 최적화 내용:
//   - source 메타(datasets/derivedFields 등 필드 매핑 문서화용 정보) 통째로 제거 — 프론트 어디서도 안 읽음
//   - 프론트에서 전혀 참조하지 않는 학교별 필드 제거 (아래 DROP_FIELDS)
//   - schulKndCode(02/03/04)와 완전히 1:1 중복인 schulKndNm도 제거 — 필요하면 프론트에서
//     SCHOOL_LEVEL_OPTIONS(src/lib/school-region.ts)로 유도해서 씀
//   - 좌표(lat/lng) 소수점 6자리로 반올림(약 11cm 정밀도, 지도 핀엔 과분) — 원본은 학교마다
//     소수 10자리라 사실상 랜덤 숫자열이라 gzip이 못 줄여줌(문자열 반복과 달리), 실제로 효과 있음
//   - pretty-print로 저장 (gzip 압축 시 공백 차이는 ~15%라 minify 이득이 크지 않고,
//     이 파일도 원본처럼 사람이 열어보고 확인할 일이 많아서 원본과 동일하게 가독성 우선)
//
// API 호출 없음(로컬 파일만 읽음).
//
// 실행:
//   node scripts/build-schools-dataset.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const INPUT_PATH = path.join(ROOT_DIR, "public/data/chungbuk-schools.json");
const OUTPUT_PATH = path.join(ROOT_DIR, "public/data/chungbuk-schools-render.json");

// 프론트(src/) 어디서도 읽지 않는 걸 grep으로 확인한 필드들 — src/types/school-stats.ts의
// School 타입에서도 동시에 제거해뒀음. 새로 필드를 추가할 땐 이 목록도 같이 검토할 것.
const DROP_FIELDS = [
  "detailAddress",
  "zipCode",
  "tel",
  "homepage",
  "isSuspended",
  "isBranchSchool",
  "isClosed",
  "lctnScCode",
  "sidoOfficeNm",
  "schulKndNm", // schulKndCode와 1:1 중복 (위 주석 참고)
];

const POSITION_DECIMALS = 6;

function roundCoord(n) {
  const factor = 10 ** POSITION_DECIMALS;
  return Math.round(n * factor) / factor;
}

function optimizeSchool(school) {
  const out = { ...school };
  for (const field of DROP_FIELDS) delete out[field];
  if (out.position) {
    out.position = { lat: roundCoord(out.position.lat), lng: roundCoord(out.position.lng) };
  }
  return out;
}

async function main() {
  const raw = JSON.parse(await readFile(INPUT_PATH, "utf-8"));

  const output = {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: raw.generatedAt,
    count: raw.schools.length,
    schools: raw.schools.map(optimizeSchool),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`${output.count}개 학교 최적화 완료 -> ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
