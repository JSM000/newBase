// 충북 11개 시·군 행정구역 경계(GeoJSON)를 내려받아, 카카오맵 Polygon 으로 그릴 수 있게
// 가공한 뒤 public/data/chungbuk-sigungu-boundaries.json 으로 저장한다.
//
// 가공 내용:
//   1. 전국 시군구에서 충북(code prefix '33')만 추출
//   2. 청주시 4개 구(상당/서원/흥덕/청원)는 union 으로 '청주시' 하나로 병합
//      → 지도 클러스터링이 청주시를 단일 단위로 다루므로 내부 구 경계는 지운다
//   3. 좌표 단순화(tolerance ≈ 60m) + 소수점 5자리(약 1m) 반올림으로 용량 축소
//
// 원본: https://github.com/southkorea/southkorea-maps (kostat 2018, 공공데이터)
//
// 실행 (한 번만, 데이터 갱신이 필요할 때):
//   npm i -D @turf/turf   # 아직 없으면
//   node scripts/build-boundaries.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "public/data/chungbuk-sigungu-boundaries.json");

const SOURCE_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json";

// 청주 통합시 시절 부여된 표시 순서 (statistics 지도의 CHUNGBUK_SIGUNGU_ORDER 와 동일)
const ORDER = [
  "청주시", "충주시", "제천시", "괴산군", "단양군",
  "보은군", "영동군", "옥천군", "음성군", "증평군", "진천군",
];

const SIMPLIFY_TOLERANCE = 0.0006; // degree ≈ 60~70m
const COORD_DECIMALS = 5;

const roundCoord = (n) => Math.round(n * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;
const roundRing = (ring) => ring.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)]);

async function loadSource() {
  // 로컬 캐시가 있으면 재사용 (원본이 18MB라 반복 실행 시 유리)
  const cachePath = path.join(process.env.TMPDIR ?? "/tmp", "skorea-municipalities-2018.json");
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`원본 다운로드 실패 (${res.status})`);
    const text = await res.text();
    await writeFile(cachePath, text);
    return JSON.parse(text);
  }
}

const src = await loadSource();

// 1. 충북만
const chungbuk = src.features.filter((f) => String(f.properties.code).startsWith("33"));

// 2. 이름별로 묶고 청주 4개 구는 '청주시'로
const normName = (name) => (name.startsWith("청주시") ? "청주시" : name);
const byName = new Map();
for (const f of chungbuk) {
  const name = normName(f.properties.name);
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(f);
}

const features = [];
for (const [name, group] of byName) {
  let merged = group[0];
  for (let i = 1; i < group.length; i += 1) {
    merged = turf.union(turf.featureCollection([merged, group[i]]));
  }

  // 3. 단순화 + 좌표 반올림
  const simplified = turf.simplify(merged, {
    tolerance: SIMPLIFY_TOLERANCE,
    highQuality: true,
    mutate: true,
  });
  const g = simplified.geometry;
  if (g.type === "Polygon") {
    g.coordinates = g.coordinates.map(roundRing);
  } else {
    g.coordinates = g.coordinates.map((poly) => poly.map(roundRing));
  }

  features.push({ type: "Feature", properties: { name }, geometry: g });
}

features.sort(
  (a, b) => ORDER.indexOf(a.properties.name) - ORDER.indexOf(b.properties.name),
);

await writeFile(OUTPUT_PATH, JSON.stringify({ type: "FeatureCollection", features }));

const kb = (JSON.stringify({ type: "FeatureCollection", features }).length / 1024).toFixed(1);
console.log(`✓ ${OUTPUT_PATH} (${kb} KB, ${features.length}개 시·군)`);
