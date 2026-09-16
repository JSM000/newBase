// 학구도(통학구역) 원본 SHP/CSV → 웹 지도용 GeoJSON/JSON 전처리
//
// 입력: _refs/학구도/ 아래 한국교육시설안전원 공공데이터(2026-03-20 기준)
//   - 초등학교통학구역 / 중학교학교군 / 고등학교학교군 / 고등학교비평준화지역 / 교육행정구역  (SHP, EPSG:5186)
//   - 초중등학교위치_20260320.csv (UTF-8 BOM)  · 학교학구도연계정보_20260320.csv (CP949)
//
// 처리:
//   1. 충북만 필터 (SD_CD === '43', 교육행정구역은 시도교육청명으로)
//   2. EPSG:5186(중부원점 TM) → WGS84 역투영  (proj4 없이 TM 역변환식 직접 구현)
//   3. 링(part) 분류: 외곽/홀(hole) → Polygon | MultiPolygon
//   4. Douglas–Peucker 단순화 + 좌표 5자리 반올림
//   5. 학교→학구 매핑, 학교 좌표 추출
//~
// 출력: public/data/
//   - chungbuk-school-zones-elementary.geojson   초등 통학구역/공동통학구역
//   - chungbuk-school-zones-middle.geojson        중학구/공동학구
//   - chungbuk-school-zones-high.geojson          고교 학교군(평준화) + 비평준화지역
//   - chungbuk-edu-districts.geojson              교육지원청 관할 경계 (배경용)
//   - chungbuk-school-zone-links.json             { 학교ID: { name, level, dedicated:[학구ID], shared:[학구ID] } }
//   - chungbuk-school-zone-points.json            학교 마커 [{ schoolId, name, level, foundType, isBranch, lat, lng, ... }]
//
// 실행: node scripts/build-school-zones.mjs   (의존성 없음)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "_refs/학구도");
const OUT = path.join(ROOT, "public/data");

const CHUNGBUK_SD = "43";
const SIMPLIFY_TOLERANCE = 0.0002; // degree ≈ 20m
const COORD_DECIMALS = 5; // ≈ 1m

// ────────────────────────────────────────────────────────────── EPSG:5186 역투영
// Korea 2000 / Central Belt 2010 : TM, GRS80, lon0=127, lat0=38, k0=1, FE=200000, FN=600000
function makeTmInverse() {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const k0 = 1.0;
  const lon0 = (127 * Math.PI) / 180;
  const lat0 = (38 * Math.PI) / 180;
  const FE = 200000.0;
  const FN = 600000.0;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const A0 = 1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256;
  const M0 =
    a *
    (A0 * lat0 -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat0) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat0) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat0));
  const ep2 = e2 / (1 - e2);

  return function inverse(x, y) {
    const M = M0 + (y - FN) / k0;
    const mu = M / (a * A0);
    const phi1 =
      mu +
      ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
      ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
      ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
      ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
    const sinP = Math.sin(phi1);
    const cosP = Math.cos(phi1);
    const tanP = Math.tan(phi1);
    const C1 = ep2 * cosP ** 2;
    const T1 = tanP ** 2;
    const N1 = a / Math.sqrt(1 - e2 * sinP ** 2);
    const R1 = (a * (1 - e2)) / (1 - e2 * sinP ** 2) ** 1.5;
    const D = (x - FE) / (N1 * k0);
    const lat =
      phi1 -
      ((N1 * tanP) / R1) *
        ((D ** 2) / 2 -
          ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4) / 24 +
          ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6) / 720);
    const lon =
      lon0 +
      (D -
        ((1 + 2 * T1 + C1) * D ** 3) / 6 +
        ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5) / 120) /
        cosP;
    return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
  };
}
const tmInverse = makeTmInverse();

// ────────────────────────────────────────────────────────────── DBF
function readDbf(buf) {
  const recCount = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields = [];
  let p = 32;
  while (buf[p] !== 0x0d) {
    fields.push({
      name: buf.toString("latin1", p, p + 11).split("\0")[0],
      length: buf[p + 16],
    });
    p += 32;
  }
  const dec = new TextDecoder("euc-kr");
  const rows = [];
  for (let i = 0; i < recCount; i++) {
    let o = headerLen + i * recLen;
    if (buf[o] === 0x2a) {
      // 삭제 표시된 레코드
      rows.push(null);
      continue;
    }
    o += 1;
    const row = {};
    for (const fld of fields) {
      row[fld.name] = dec.decode(buf.subarray(o, o + fld.length)).trim();
      o += fld.length;
    }
    rows.push(row);
  }
  return rows;
}

// ────────────────────────────────────────────────────────────── SHP (Polygon만)
function readShpPolygons(shpBuf, shxBuf) {
  const recCount = (shxBuf.length - 100) / 8;
  const out = [];
  for (let i = 0; i < recCount; i++) {
    const off = shxBuf.readInt32BE(100 + i * 8) * 2;
    const contentLen = shxBuf.readInt32BE(100 + i * 8 + 4) * 2;
    const c = shpBuf.subarray(off + 8, off + 8 + contentLen);
    const shapeType = c.readInt32LE(0);
    if (shapeType === 0) {
      out.push(null); // Null shape
      continue;
    }
    if (shapeType !== 5) {
      throw new Error(`예상치 못한 shape type ${shapeType} (record ${i + 1})`);
    }
    const numParts = c.readInt32LE(36);
    const numPoints = c.readInt32LE(40);
    const partStarts = [];
    for (let k = 0; k < numParts; k++) partStarts.push(c.readInt32LE(44 + k * 4));
    const pointsOff = 44 + numParts * 4;
    const rings = [];
    for (let k = 0; k < numParts; k++) {
      const start = partStarts[k];
      const end = k + 1 < numParts ? partStarts[k + 1] : numPoints;
      const ring = [];
      for (let j = start; j < end; j++) {
        const x = c.readDoubleLE(pointsOff + j * 16);
        const y = c.readDoubleLE(pointsOff + j * 16 + 8);
        ring.push(tmInverse(x, y));
      }
      rings.push(ring);
    }
    out.push(rings);
  }
  return out;
}

// ────────────────────────────────────────────────────────────── 지오메트리 유틸
function signedArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

function pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Douglas–Peucker
function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxDist = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const t = ((px - ax) * dx + (py - ay) * dy) / len2;
      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const d = Math.hypot(px - cx, py - cy);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const result = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) result.push(pts[i]);
  result.push([...result[0]]); // 다시 닫기
  return result.length >= 4 ? result : ring;
}

const roundCoord = (n) => Math.round(n * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;

function ringsToGeometry(rings, tol) {
  const simplified = rings
    .map((r) => simplifyRing(r, tol))
    .filter((r) => r.length >= 4)
    .map((r) => r.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)]));
  if (simplified.length === 0) return null;

  // 외곽(음의 부호면적)과 홀 분리 후 홀을 감싸는 외곽에 배정
  const outers = [];
  const holes = [];
  for (const r of simplified) (signedArea(r) < 0 ? outers : holes).push(r);
  if (outers.length === 0) {
    // 부호 규칙이 반대인 경우 대비 — 가장 큰 링을 외곽으로
    simplified.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
    outers.push(simplified[0]);
    holes.push(...simplified.slice(1));
  }
  const polys = outers.map((o) => [o]);
  for (const h of holes) {
    const hp = h[0];
    let target = polys.find((p) => pointInRing(hp, p[0]));
    if (!target) target = polys[0];
    target.push(h);
  }
  // GeoJSON RFC 7946: 외곽 링은 CCW(양의 부호면적), 홀은 CW 로 정규화
  for (const rings of polys) {
    rings.forEach((r, idx) => {
      const ccw = signedArea(r) > 0;
      if ((idx === 0) !== ccw) r.reverse();
    });
  }
  if (polys.length === 1) return { type: "Polygon", coordinates: polys[0] };
  return { type: "MultiPolygon", coordinates: polys.map((p) => [...p]) };
}

// ────────────────────────────────────────────────────────────── CSV
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function readCsvFile(name, encoding) {
  const buf = readFileSync(path.join(SRC, name));
  let text = new TextDecoder(encoding).decode(buf);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return parseCsv(text);
}

// ────────────────────────────────────────────────────────────── 학구 SHP 처리
const LEVEL_BY_DATASET = {
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교",
};

function loadZoneShp(folder, file) {
  const base = path.join(SRC, folder, file);
  const dbf = readDbf(readFileSync(base + ".dbf"));
  const geoms = readShpPolygons(readFileSync(base + ".shp"), readFileSync(base + ".shx"));
  return dbf.map((row, i) => ({ row, rings: geoms[i] }));
}

function buildZoneFeatures(records, { zoneType, level }) {
  const features = [];
  let dropped = 0;
  for (const { row, rings } of records) {
    if (!row || !rings) continue;
    if (row.SD_CD !== CHUNGBUK_SD) continue;
    const geometry = ringsToGeometry(rings, SIMPLIFY_TOLERANCE);
    if (!geometry) {
      dropped++;
      continue;
    }
    const name = row.HAKGUDO_NM;
    features.push({
      type: "Feature",
      properties: {
        zoneId: row.HAKGUDO_ID,
        zoneName: name,
        zoneType,
        level,
        kind: row.HAKGUDO_GB === "1" ? "shared" : "dedicated", // 공동 / 전용
        oneWay: name.includes("일방"), // 공동(일방) = 한쪽 방향만
        sggCode: row.SGG_CD || null,
        eduCode: row.EDU_CD,
        eduName: row.EDU_NM,
        updatedAt: row.UPD_DT || null,
      },
      geometry,
    });
  }
  return { features, dropped };
}

function writeGeoJson(fileName, features) {
  const fc = { type: "FeatureCollection", features };
  const json = JSON.stringify(fc);
  writeFileSync(path.join(OUT, fileName), json);
  return json.length;
}

// ────────────────────────────────────────────────────────────── main
mkdirSync(OUT, { recursive: true });
const fmtKB = (n) => `${(n / 1024).toFixed(0)} KB`;
const summary = [];

// 1) 초등 통학구역
{
  const rec = loadZoneShp("한국교육시설안전원_초등학교통학구역_파일데이터 (1)", "초등학교통학구역");
  const { features, dropped } = buildZoneFeatures(rec, { zoneType: "elementary", level: "초등학교" });
  const size = writeGeoJson("chungbuk-school-zones-elementary.geojson", features);
  summary.push(`초등 통학구역   : ${features.length}개 (드롭 ${dropped})  ${fmtKB(size)}`);
}

// 2) 중학구 / 공동학구
{
  const rec = loadZoneShp("한국교육시설안전원_중학교학교군_파일데이터", "중학교학교군");
  const { features, dropped } = buildZoneFeatures(rec, { zoneType: "middle", level: "중학교" });
  const size = writeGeoJson("chungbuk-school-zones-middle.geojson", features);
  summary.push(`중학구/공동학구 : ${features.length}개 (드롭 ${dropped})  ${fmtKB(size)}`);
}

// 3) 고교 학교군(평준화) + 비평준화지역
{
  const gun = loadZoneShp("한국교육시설안전원_고등학교학교군_파일데이터", "고등학교학교군");
  const non = loadZoneShp("한국교육시설안전원_고등학교비평준화지역_파일데이터", "고등학교비평준화지역");
  const a = buildZoneFeatures(gun, { zoneType: "high_zone", level: "고등학교" });
  const b = buildZoneFeatures(non, { zoneType: "high_nonpyeongjunhwa", level: "고등학교" });
  const features = [...a.features, ...b.features];
  const size = writeGeoJson("chungbuk-school-zones-high.geojson", features);
  summary.push(
    `고교 학교군/비평준화 : ${features.length}개 (평준화 ${a.features.length} + 비평준화 ${b.features.length}, 드롭 ${a.dropped + b.dropped})  ${fmtKB(size)}`,
  );
}

// 4) 교육지원청 관할 경계 (배경용)
{
  const base = path.join(SRC, "한국교육시설안전원_교육행정구역_파일데이터", "교육행정구역");
  const dbf = readDbf(readFileSync(base + ".dbf"));
  const geoms = readShpPolygons(readFileSync(base + ".shp"), readFileSync(base + ".shx"));
  const features = [];
  dbf.forEach((row, i) => {
    if (!row || !geoms[i]) return;
    if (!row.EDU_UP_NM.includes("충청북도")) return;
    const geometry = ringsToGeometry(geoms[i], SIMPLIFY_TOLERANCE * 3); // 배경이라 더 거칠게
    if (!geometry) return;
    features.push({
      type: "Feature",
      properties: {
        officeId: row.OFFICE_ID,
        officeName: row.OFFICE_NM,
        eduCode: row.EDU_CD,
        eduName: row.EDU_NM,
      },
      geometry,
    });
  });
  const size = writeGeoJson("chungbuk-edu-districts.geojson", features);
  summary.push(`교육지원청 경계 : ${features.length}개  ${fmtKB(size)}`);
}

// 5) 학교 → 학구 매핑 + 6) 학교 마커
{
  const link = readCsvFile("한국교육시설안전원_학교학구도연계정보_20260320.csv", "euc-kr");
  const loc = readCsvFile("한국교육시설안전원_초중등학교위치_20260320.csv", "utf-8");

  // 학구 종별(전용/공동)·이름 조회용: 모든 학구 SHP에서 ID→{kind,name} 수집.
  // 이름까지 links.json 에 같이 넣어두면 프론트에서 학구 폴리곤(GeoJSON, 학교급별 lazy load)을
  // 안 받아도 상세 패널에 "OO초통학구역" 같은 실제 학구명을 바로 보여줄 수 있다.
  const zoneInfo = new Map();
  for (const [folder, file] of [
    ["한국교육시설안전원_초등학교통학구역_파일데이터 (1)", "초등학교통학구역"],
    ["한국교육시설안전원_중학교학교군_파일데이터", "중학교학교군"],
    ["한국교육시설안전원_고등학교학교군_파일데이터", "고등학교학교군"],
    ["한국교육시설안전원_고등학교비평준화지역_파일데이터", "고등학교비평준화지역"],
  ]) {
    const base = path.join(SRC, folder, file + ".dbf");
    for (const row of readDbf(readFileSync(base))) {
      if (row) {
        zoneInfo.set(row.HAKGUDO_ID, {
          kind: row.HAKGUDO_GB === "1" ? "shared" : "dedicated",
          name: row.HAKGUDO_NM,
        });
      }
    }
  }

  const CB_OFFICE = "충청북도교육청";
  const links = {};
  for (const r of link) {
    if (r.시도교육청명 !== CB_OFFICE) continue;
    const id = r.학교ID;
    if (!links[id]) links[id] = { name: r.학교명, level: r.학교급구분, dedicated: [], shared: [] };
    const info = zoneInfo.get(r.학구ID);
    const entry = { zoneId: r.학구ID, zoneName: info?.name ?? r.학구ID };
    (info?.kind === "shared" ? links[id].shared : links[id].dedicated).push(entry);
  }
  writeFileSync(path.join(OUT, "chungbuk-school-zone-links.json"), JSON.stringify(links));

  const points = [];
  for (const r of loc) {
    if (r.시도교육청명 !== CB_OFFICE) continue;
    points.push({
      schoolId: r.학교ID,
      name: r.학교명,
      level: r.학교급구분,
      foundType: r.설립형태,
      isBranch: r.본교분교구분 === "분교",
      eduName: r.교육지원청명,
      address: r.소재지지번주소 || r.소재지도로명주소,
      lat: Number(r.위도),
      lng: Number(r.경도),
      hasZone: Boolean(links[r.학교ID]),
    });
  }
  writeFileSync(path.join(OUT, "chungbuk-school-zone-points.json"), JSON.stringify(points));

  const byLevel = (arr, lv) => arr.filter((x) => x.level === lv).length;
  summary.push(
    `학교→학구 매핑  : ${Object.keys(links).length}개교 (초 ${byLevel(Object.values(links), "초등학교")} / 중 ${byLevel(Object.values(links), "중학교")} / 고 ${byLevel(Object.values(links), "고등학교")})`,
  );
  summary.push(
    `학교 마커       : ${points.length}개 (초 ${byLevel(points, "초등학교")} / 중 ${byLevel(points, "중학교")} / 고 ${byLevel(points, "고등학교")}), 학구없음 ${points.filter((p) => !p.hasZone).length}`,
  );
}

console.log("\n✅ 전처리 완료 → public/data/\n");
console.log(summary.join("\n"));
