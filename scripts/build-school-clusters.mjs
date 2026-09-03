// public/data/chungbuk-schools-render.json(build-schools-dataset.mjs 산출물)을 읽어서, 지도의
// 행정구역 클러스터 뷰(시·군 / 구·읍·면·동)에서 "마커를 어디에 찍을지(밀집 위치)"만 미리 계산해
// 별도 파일로 저장한다.
// 개수·지표평균(색상)은 저장하지 않는다 — 필터(학교급/공립여부/검색어)에 따라 매번 달라지는 값이라
// 미리 구워봐야 이득이 없고, 어차피 클라이언트가 학교 목록을 그룹핑해야(검색어 처리 때문에) 그
// 그룹핑 결과에서 개수·평균을 공짜로 얻을 수 있음. 밀집 위치만 유일하게 (a) 필터와 무관하고
// (b) 그룹핑의 부산물이 아닌 별도 계산(반경 탐색)이 필요해서 캐싱할 가치가 있음.
// (계획: _refs/학교통계_지도_구현계획.md 3-2 "클러스터 집계 데이터")
//
// API 호출 전혀 없음(로컬 파일만 읽음) — 프론트 줌 레벨/반경 상수를 바꿔도 이 스크립트만 재실행하면 됨.
//
// 실행:
//   node scripts/build-school-clusters.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const INPUT_PATH = path.join(ROOT_DIR, "public/data/chungbuk-schools-render.json");
const OUTPUT_PATH = path.join(ROOT_DIR, "public/data/chungbuk-school-clusters.json");

// 티어별 "밀집 위치" 탐색 반경(km) — 클릭 시 넘어갈 다음 단계 스케일에 맞춤.
// kakao-map.tsx의 SIGUNGU_MIN_LEVEL/SUB_REGION_MIN_LEVEL과 연동되는 값이라, 저기 레벨을
// 바꾸면 여기 반경도 재검토할 것.
const SIGUNGU_RADIUS_KM = 5;
const SUB_REGION_RADIUS_KM = 2;

// 좌표 평균을 내면 소수점이 15자리 넘게 늘어나는데(부동소수점 연산 특성상), 지도 핀에 그 정밀도는
// 무의미함 — chungbuk-schools-render.json과 동일하게 6자리(약 11cm 정밀도)로 반올림
const POSITION_DECIMALS = 6;

function roundCoord(n) {
  const factor = 10 ** POSITION_DECIMALS;
  return Math.round(n * factor) / factor;
}

// ── 밀집 위치 탐색 ──

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * positions 중 "반경 radiusKm 안에 이웃이 제일 많은 지점"을 찾아, 그 이웃들의 평균 좌표를 반환.
 * 그룹 전체 평균이 학교 몰림에서 벗어난 빈 공간에 찍히는 문제를 피하기 위함
 * (_refs/학교통계_지도_구현계획.md 3-2 "밀집 위치" 참고).
 */
function computeBestCenter(positions, radiusKm) {
  if (positions.length === 0) return null;
  if (positions.length === 1) return positions[0];

  let bestNeighbors = [positions[0]];
  for (const anchor of positions) {
    const neighbors = positions.filter((p) => haversineKm(anchor, p) <= radiusKm);
    if (neighbors.length > bestNeighbors.length) bestNeighbors = neighbors;
  }

  const lat = bestNeighbors.reduce((sum, p) => sum + p.lat, 0) / bestNeighbors.length;
  const lng = bestNeighbors.reduce((sum, p) => sum + p.lng, 0) / bestNeighbors.length;
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

function buildCluster(name, schools, radiusKm, extra = {}) {
  const positions = schools.filter((s) => s.position).map((s) => s.position);
  const bestCenter = computeBestCenter(positions, radiusKm);
  return { name, ...extra, bestCenter };
}

async function main() {
  const raw = JSON.parse(await readFile(INPUT_PATH, "utf-8"));
  const schools = raw.schools;

  // sigunguName/subRegionName은 collect-school-stats.mjs의 DERIVED_FIELDS가 이미 계산해서
  // 학교 데이터에 필드로 저장해둔 값(render 파일에도 그대로 남아있음) — 여기서 다시 파싱하지
  // 않고 그대로 읽기만 한다 (src/lib/school-region.ts도 동일한 필드를 그대로 읽음 — 파싱
  // 로직이 collect-school-stats.mjs 한 곳에만 있음).

  // 시·군 그룹
  const bySigungu = new Map();
  for (const school of schools) {
    const name = school.sigunguName;
    if (!name) continue;
    if (!bySigungu.has(name)) bySigungu.set(name, []);
    bySigungu.get(name).push(school);
  }
  // bestCenter가 null인(=좌표 있는 학교가 하나도 없는, 전부 폐교 등) 그룹은 지도에 찍을 위치가
  // 없으므로 결과에서 제외 (실측: 보은군 내북면 — 유일한 소속 학교인 내북중학교가 폐교라 좌표 없음)
  const sigunguClusters = [...bySigungu.entries()]
    .map(([name, list]) => buildCluster(name, list, SIGUNGU_RADIUS_KM))
    .filter((c) => c.bestCenter !== null);

  // 구/읍/면/동 그룹 (시·군 이름도 같이 들고 있음)
  const bySubRegion = new Map();
  for (const school of schools) {
    const sigungu = school.sigunguName;
    const sub = school.subRegionName;
    if (!sigungu || !sub) continue;
    const key = `${sigungu}|${sub}`;
    if (!bySubRegion.has(key)) bySubRegion.set(key, []);
    bySubRegion.get(key).push(school);
  }
  const subRegionClusters = [...bySubRegion.entries()]
    .map(([key, list]) => {
      const [sigungu, name] = key.split("|");
      return buildCluster(name, list, SUB_REGION_RADIUS_KM, { sigungu });
    })
    .filter((c) => c.bestCenter !== null);

  const output = {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: raw.generatedAt,
    radiusKm: { sigungu: SIGUNGU_RADIUS_KM, subRegion: SUB_REGION_RADIUS_KM },
    sigunguClusters,
    subRegionClusters,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`시·군 클러스터 ${sigunguClusters.length}개, 구/읍/면/동 클러스터 ${subRegionClusters.length}개 저장 완료`);
  console.log(`-> ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
