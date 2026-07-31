/**
 * 실제 F1 서킷 형상을 코스 좌표로 심는다.
 *
 *   npm run import:circuits
 *
 * 출처는 `bacinger/f1-circuits`(MIT)의 GeoJSON이고, 원 데이터는 OpenStreetMap
 * 기여자들이 그린 것이다 (ODbL 1.0). 받은 파일은 `fixtures/f1-circuits.geojson`에
 * 남겨 두고 다음 실행부터는 그걸 읽는다 — 네트워크가 없어도 다시 심을 수 있다.
 *
 * 계산은 전부 `src/track/circuitShape.ts`에 있다. 여기 있는 것은 입출력과
 * **무엇이 왜 빠졌는지 밝히는 일**뿐이다.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateShape } from '../src/track/generateTrack';
import { toCircuit, asTrack, type CircuitSource } from '../src/track/circuitShape';
import type { CircuitData } from '../src/track/circuitData';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE_URL = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson';
const CACHE = resolve(ROOT, 'fixtures/f1-circuits.geojson');
const OUT = resolve(ROOT, 'src/track/circuitData.ts');

interface Feature {
  properties: { id?: string; Name?: string; Location?: string; length?: number };
  geometry: { type: string; coordinates: unknown };
}

async function features(): Promise<Feature[]> {
  if (!existsSync(CACHE)) {
    console.log(`받는 중: ${SOURCE_URL}`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`가져오지 못했다: HTTP ${res.status}`);
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, await res.text());
  }
  const doc = JSON.parse(readFileSync(CACHE, 'utf8')) as { features?: Feature[] };
  return doc.features ?? [];
}

/** LineString이면 그대로, MultiLineString이면 가장 긴 조각. 나머지는 버린다. */
function ring(geometry: Feature['geometry']): [number, number][] | null {
  if (geometry.type === 'LineString') return geometry.coordinates as [number, number][];
  if (geometry.type === 'MultiLineString') {
    const parts = geometry.coordinates as [number, number][][];
    return parts.reduce<[number, number][] | null>(
      (best, part) => (best === null || part.length > best.length ? part : best), null);
  }
  return null;
}

function render(circuits: CircuitData[]): string {
  const rows = circuits.map((c) => [
    '  {',
    `    id: ${JSON.stringify(c.id)},`,
    `    name: ${JSON.stringify(c.name)},`,
    `    location: ${JSON.stringify(c.location)},`,
    `    lengthM: ${c.lengthM},`,
    `    aspect: ${c.aspect},`,
    `    pitEntry: ${c.pitEntry},`,
    `    pitExit: ${c.pitExit},`,
    `    points: [${c.points.map(([x, y]) => `[${x},${y}]`).join(',')}],`,
    '  },',
  ].join('\n')).join('\n');

  // 머리말(주석 + 인터페이스)은 손으로 쓴 것이라 그대로 둔다. 배열만 갈아 끼운다.
  const head = readFileSync(OUT, 'utf8').split('export const CIRCUITS')[0];
  return `${head}export const CIRCUITS: CircuitData[] = [\n${rows}\n];\n`;
}

const all = await features();
const kept: CircuitData[] = [];
const dropped: string[] = [];

for (const feature of all) {
  const name = feature.properties.Name ?? '?';
  const coords = ring(feature.geometry);
  if (!coords) {
    dropped.push(`${name} — 선 형상이 아니다 (${feature.geometry.type})`);
    continue;
  }

  const source: CircuitSource = {
    id: feature.properties.id ?? 'unknown',
    name,
    location: feature.properties.Location ?? '',
    lengthM: feature.properties.length ?? 0,
    coordinates: coords,
  };

  const circuit = toCircuit(source);
  if (!circuit) {
    dropped.push(`${name} — 점이 너무 적다 (${coords.length}개)`);
    continue;
  }

  /*
   * 형상 규칙만 본다 — 자기간섭은 거부 사유가 아니다.
   *
   * 코스를 선 한 줄로 그리므로 스즈카의 교차도, 시가지 코스의 좁은 병렬 구간도
   * 그대로 읽힌다. 여기서 걸리는 것은 좌표계를 벗어났거나 점이 모자라는 것처럼
   * **변환이 잘못된** 경우다. 그래도 빠지는 게 있으면 무엇이 왜인지 남긴다.
   */
  const problems = validateShape(asTrack(circuit));
  if (problems.length > 0) {
    dropped.push(`${name} — ${problems.join(', ')}`);
    continue;
  }

  kept.push(circuit);
}

writeFileSync(OUT, render(kept));

console.log(`심음 ${kept.length}개 / 원본 ${all.length}개`);
for (const c of kept) {
  console.log(`  ${c.name} (${c.location}) · ${c.lengthM}m · 비율 ${c.aspect}`);
}
if (dropped.length > 0) {
  console.log(`\n뺀 것 ${dropped.length}개:`);
  for (const d of dropped) console.log(`  ${d}`);
}
if (kept.length === 0) {
  console.error('\n하나도 남지 않았다. 화면은 지어낸 코스로 돈다.');
  process.exitCode = 1;
}
