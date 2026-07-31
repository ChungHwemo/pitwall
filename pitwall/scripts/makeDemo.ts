/**
 * 실측 분포로 만든 조직 규모 더미 데이터.
 *
 *   npm run make:demo              # 계정 14, 하루치
 *   npm run make:demo -- 30        # 계정 30
 *
 * 실제 로그에는 계정이 둘뿐이라 화면의 절반이 검증되지 않는다 — 레인이 갈리는지,
 * 밀집 모드가 도는지, 접힘 줄이 뜨는지, 무전이 실제로 말이 되는지. 여기서는
 * **관측된 분포**로 계정을 늘려 그 경로를 실제로 밟게 한다.
 *
 * 지어낸 데이터다. 화면에 `DEMO`가 뜨는 이유이고, 실기록과 섞어 쓰지 않는다.
 *
 * 근거 (2026-07-30 실측 2,097건):
 *   작업 토큰   중앙 1,950 · p10 701 · p90 7,284
 *   캐시 재전송 중앙 245k · 전체 토큰의 99.4%
 *   호출 간격   중앙 5.2초 · p90 19초 · p99 371초
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRng } from '../src/util/rng';
import { MODEL_CATALOG, costUsd, specOf } from '../src/config/models';
import type { ModelSpec } from '../src/config/models';
import type { CarEvent, CarClass } from '../src/types';

const accountCount = Number(process.argv[2] ?? 14);
const seed = Number(process.argv[3] ?? 20260731);
/** 파일 이름 꼬리표. 여러 규모를 나란히 두고 화면에서 골라 쓴다. */
const label = process.argv[4] ?? 'demo';
const rng = createRng(seed);

/**
 * 계정의 성향. 실제 조직도 고르지 않다 — 하루 종일 붙어 있는 사람, 가끔 쓰는
 * 사람, 켜두고 안 쓰는 사람이 섞여 있어야 화면이 무엇을 말하는지 알 수 있다.
 */
interface Habit {
  name: string;
  /** 호출 간격 중앙값 (초) */
  gap: number;
  /** 하루 중 활동 구간 비율 */
  active: number;
  /** 호출당 작업 토큰 배수 */
  size: number;
  /** 에러 확률 */
  errorRate: number;
}

const HABITS: Habit[] = [
  { name: 'heavy', gap: 4, active: 0.75, size: 1.6, errorRate: 0.004 },
  { name: 'steady', gap: 9, active: 0.55, size: 1.0, errorRate: 0.002 },
  { name: 'bursty', gap: 3, active: 0.25, size: 1.3, errorRate: 0.008 },
  { name: 'light', gap: 40, active: 0.30, size: 0.7, errorRate: 0.001 },
  { name: 'idle', gap: 240, active: 0.10, size: 0.5, errorRate: 0 },
];

/** 카탈로그에서 단가가 확인된 모델만 쓴다. 지어낸 단가로 비용을 만들지 않는다. */
const USABLE: ModelSpec[] = MODEL_CATALOG.filter((m) => m.priceSource === 'verified');

const ERROR_CODES = ['429', '500', 'overloaded_error', 'timeout'];

/** 로그정규에 가까운 꼬리. 중앙값 주변에 몰리고 가끔 크게 튄다. */
function heavyTail(median: number, spread: number): number {
  const u = Math.max(1e-6, rng.range(0, 1));
  return Math.round(median * Math.exp(spread * (Math.log(u / (1 - u)) / 4)));
}

const DAY = new Date();
DAY.setHours(0, 0, 0, 0);
const START_HOUR = 8;
const END_HOUR = 22;

interface Account {
  carId: string;
  carNumber: number;
  habit: Habit;
  /** 이 계정이 주로 쓰는 모델 (가끔 갈아탄다) */
  models: ModelSpec[];
  tyre: number;
  window: number;
  resets: number;
}

const numbers = new Set<number>();
const accounts: Account[] = Array.from({ length: accountCount }, (_, i) => {
  let n = rng.int(1, 999);
  while (numbers.has(n)) n = rng.int(1, 999);
  numbers.add(n);

  const habit = HABITS[i % HABITS.length]!;
  // 계정마다 주력 모델 하나에 곁들이 하나. 하루에 갈아타는 일이 실제로 있다.
  const primary = USABLE[rng.int(0, USABLE.length - 1)]!;
  const second = USABLE[rng.int(0, USABLE.length - 1)]!;
  // 한도는 계정마다 다르다. 몇몇은 이미 벽에 붙어 있어야 피트가 검증된다.
  const tyre = i % 5 === 0 ? rng.range(1, 12) : rng.range(25, 95);
  const window = rng.int(0, 1) === 0 ? 300 : 10_080;
  return {
    carId: `demo-${String(i).padStart(3, '0')}`,
    carNumber: n,
    habit,
    models: [primary, second],
    tyre,
    window,
    resets: DAY.getTime() + (window === 300 ? 5 : 96) * 3_600_000,
  };
});

const events: CarEvent[] = [];

for (const account of accounts) {
  // 활동 구간을 하루 안에서 잘라 준다. 모두가 같은 시간에 일하지 않는다.
  const span = (END_HOUR - START_HOUR) * 3_600_000;
  const activeMs = span * account.habit.active;
  const from = DAY.getTime() + START_HOUR * 3_600_000 + rng.range(0, span - activeMs);

  let at = from;
  let model = account.models[0]!;
  let tyre = account.tyre;

  while (at < from + activeMs) {
    // 간격은 꼬리가 길다 — p99가 중앙값의 70배다.
    at += Math.max(400, heavyTail(account.habit.gap * 1000, 2.2));

    if (rng.range(0, 1) < 0.02) model = account.models[rng.int(0, 1)]!;

    const work = Math.max(200, heavyTail(1_950, 1.9) * account.habit.size);
    // 캐시 재전송이 전체의 99%다. 이게 없으면 화면의 비율 표시가 거짓이 된다.
    const cacheRead = Math.round(work * rng.range(60, 260));
    const completion = Math.round(work * rng.range(0.05, 0.35));
    const prompt = work - completion + cacheRead;

    const failed = rng.range(0, 1) < account.habit.errorRate;
    // 한도는 조금씩 줄어든다. 0에 닿으면 그 계정은 피트에 선다.
    tyre = Math.max(0, tyre - rng.range(0.002, 0.02));

    const spec = specOf(model.id)!;
    events.push({
      ts: Math.round(at),
      car_id: account.carId,
      car_number: account.carNumber,
      car_class: model.carClass as CarClass,
      model: model.id,
      kind: failed ? 'error' : 'call',
      session_id: `demo-${account.carNumber}`,
      tokens: { prompt, completion, cache_read: cacheRead },
      cache_hit: true,
      cost_usd: costUsd(spec, prompt, completion, true),
      latency_ms: heavyTail(3_200, 1.4),
      status: failed ? 'error' : 'ok',
      error_code: failed ? ERROR_CODES[rng.int(0, ERROR_CODES.length - 1)] : undefined,
      fuel_pct: 100,
      tyre_pct: tyre,
      limit_window_minutes: account.window,
      limit_resets_at: account.resets,
      limit_observed_at: Math.round(at),
      // 실측 비율이다 — 2026-07-31 로컬 로그 9,739건 중 스킬 귀속이 붙은 것이
      // 1,003건(작업 토큰 기준 6.7%). 0.25는 실측의 4배라 더미가 화면에
      // "스킬을 대부분 안다"고 말하게 만들었다.
      skill: rng.range(0, 1) < 0.067 ? 'superpowers:test-driven-development' : undefined,
    });
  }
}

events.sort((a, b) => a.ts - b.ts);

const out = resolve(import.meta.dirname, `../fixtures/events.${label}.jsonl`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

const byCar = new Map<number, { calls: number; work: number; cost: number; err: number }>();
let cache = 0;
for (const e of events) {
  const row = byCar.get(e.car_number) ?? { calls: 0, work: 0, cost: 0, err: 0 };
  row.calls += 1;
  row.work += (e.tokens.prompt - (e.tokens.cache_read ?? 0)) + e.tokens.completion;
  row.cost += e.cost_usd;
  if (e.status === 'error') row.err += 1;
  byCar.set(e.car_number, row);
  cache += e.tokens.cache_read ?? 0;
}
const work = [...byCar.values()].reduce((a, r) => a + r.work, 0);
const cost = [...byCar.values()].reduce((a, r) => a + r.cost, 0);
const errors = [...byCar.values()].reduce((a, r) => a + r.err, 0);

console.log(`계정 ${byCar.size} · 이벤트 ${events.length.toLocaleString('ko-KR')} · 에러 ${errors}`);
console.log(`작업 ${work.toLocaleString('ko-KR')} · 캐시 ${cache.toLocaleString('ko-KR')}`
  + ` (${Math.round(cache / (cache + work) * 100)}%) · $${cost.toFixed(2)}`);
console.log(`모델 ${new Set(events.map((e) => e.model)).size}종 · 한도 15% 미만 계정 `
  + `${accounts.filter((a) => a.tyre < 15).length}개`);
console.log(`→ ${out}`);
