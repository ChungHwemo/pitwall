/**
 * 더미 이벤트 덤프 — v1.5 어댑터가 맞춰야 할 데이터 계약의 실물 예시.
 *
 *   npm run dump:events            # busy 프리셋 200건 → fixtures/events.busy.jsonl
 *   npm run dump:events -- chaos 500
 *
 * 여기서 나온 파일은 시뮬레이터가 아니라 **계약**을 보여준다. 실 LiteLLM 어댑터는
 * 같은 형태를 방출해야 하며, 다르면 프론트엔드가 아니라 어댑터가 틀린 것이다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SimulatorSource } from '../src/source/SimulatorSource';
import { PRESETS, type PresetName } from '../src/config/presets';
import type { CarEvent } from '../src/types';

const preset = (process.argv[2] ?? 'busy') as PresetName;
const target = Number(process.argv[3] ?? 200);

if (!(preset in PRESETS)) {
  console.error(`unknown preset: ${preset} (busy | sparse | chaos)`);
  process.exit(1);
}

// 벽시계 대신 고정 시각에서 출발한다 — 덤프가 실행 시각에 따라 달라지면
// 리뷰에서 diff가 의미를 잃는다.
const START = Date.UTC(2026, 6, 30, 0, 0, 0);
const STEP_MS = 1_000;

const sim = new SimulatorSource(PRESETS[preset], 600);
const out: CarEvent[] = [];
sim.start((e) => out.push(e));

for (let i = 1; out.length < target && i <= 20_000; i++) {
  sim.tick(START + i * STEP_MS);
}

const path = resolve(import.meta.dirname, `../fixtures/events.${preset}.jsonl`);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, out.slice(0, target).map((e) => JSON.stringify(e)).join('\n') + '\n');

const models = new Map<string, number>();
for (const e of out.slice(0, target)) models.set(e.model, (models.get(e.model) ?? 0) + 1);

console.log(`${out.slice(0, target).length} events → ${path}`);
console.log('models:', [...models.entries()].sort((a, b) => b[1] - a[1])
  .map(([m, n]) => `${m}×${n}`).join(' '));
