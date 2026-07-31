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
 * 근거 (2026-07-31 재측정, **로컬 로그 전량 89,655건 / 54일 / 4벤더**).
 * 예전 근거는 하루치 2,097건이었고, 표본이 작아 꼬리와 시간대를 못 봤다.
 *
 *   작업 토큰   중앙 2,107 · p10 582 · p90 11,658 · p99 74,489
 *   캐시 재전송  중앙 104,713 · p10 23,968 · p90 383,636 · 합계가 전체의 96.0%
 *                (작업량의 배수가 아니다 — 컨텍스트 크기라 작업량과 독립이다)
 *   출력/작업   중앙 0.166
 *   호출 간격   중앙 2.3초 · p90 17초 · p99 172초
 *   계정당 하루 호출  중앙 548 · p90 2,495 · 최대 6,269
 *   스킬 귀속   9.1% · **33종**  (예전 더미는 한 종류만 반복했다)
 *   시간대      24시간 전부 — 0~5시가 9.9%다. 8~22시로 자르면 그게 사라진다
 *   에러        **0건**
 *
 * 에러만 지어낸다. 실기록에 에러가 한 건도 없어 피트·무전의 에러 경로가
 * 데모 없이는 검증되지 않는다 (`PITWALL.md` §11). 나머지는 위 실측을 따른다.
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

/*
 * `gap`·`size`는 계정 하나가 아니라 **이벤트 전체**가 실측에 맞도록 잡는다.
 * heavy·bursty가 훨씬 많은 호출을 내므로, 습관별 값을 그대로 평균 내면 안 된다 —
 * `size` 평균이 1.02인데도 생성된 작업 토큰 중앙값이 실측의 1.35배로 나왔다.
 */
const HABITS: Habit[] = [
  { name: 'heavy', gap: 2.0, active: 0.75, size: 1.25, errorRate: 0.004 },
  { name: 'steady', gap: 3.4, active: 0.55, size: 1.0, errorRate: 0.002 },
  { name: 'bursty', gap: 1.7, active: 0.25, size: 1.05, errorRate: 0.008 },
  { name: 'light', gap: 18, active: 0.30, size: 0.8, errorRate: 0.001 },
  { name: 'idle', gap: 95, active: 0.10, size: 0.6, errorRate: 0 },
];

/** 카탈로그에서 단가가 확인된 모델만 쓴다. 지어낸 단가로 비용을 만들지 않는다. */
const USABLE: ModelSpec[] = MODEL_CATALOG.filter((m) => m.priceSource === 'verified');

/**
 * 실제로 쓰인 모델과 그 비중 (89,655건). 카탈로그 21종에서 균등히 뽑으면
 * 아무도 안 쓰는 모델이 화면의 모델 판을 채운다 — 실사용은 8종에 몰려 있다.
 */
const MODEL_MIX: [string, number][] = [
  ['claude-sonnet-5', 30342], ['claude-fable-5', 14756], ['gpt-5.6-sol', 13200],
  ['gpt-5.5', 10462], ['claude-opus-5', 8330], ['gpt-5.6-luna', 5012],
  ['claude-opus-4-8', 3630], ['claude-haiku-4-5', 1954],
];

/**
 * 실제로 쓰인 스킬과 그 비중. 예전에는 한 종류를 반복해서, 무전이 같은 줄만
 * 말하고 피드의 스킬 칸이 늘 같은 문자열이었다 — 33종이 도는 화면과 다르게 보인다.
 */
const SKILL_MIX: [string, number][] = [['superpowers:brainstorming', 1335],
  ['deep-research', 938], ['insane-search:insane-search', 783], ['imap-project-context', 774],
  ['superpowers:systematic-debugging', 541], ['cainz-project-context', 511],
  ['superpowers:subagent-driven-development', 501],
  ['superpowers:test-driven-development', 382], ['superpowers:writing-plans', 380],
  ['code-review', 251], ['lint-test-build', 239], ['doctor', 217], ['cainz-api-http', 181],
  ['superpowers:using-git-worktrees', 148], ['run', 136], ['superpowers:executing-plans', 134],
  ['superpowers:dispatching-parallel-agents', 107], ['claude-in-chrome', 97], ['commit', 96],
  ['artifact-design', 75], ['superpowers:finishing-a-development-branch', 66],
  ['git-history', 66], ['diagnosing-bugs', 51], ['caveman:caveman-commit', 43], ['init', 42],
  ['resolving-merge-conflicts', 34], ['build', 26], ['update-config', 8],
  ['security-review', 8], ['loop', 6], ['statusline', 5], ['insights', 3], ['dataviz', 3],
];
/** 건수 기준 귀속 비율. 나머지 90.9%는 어느 스킬에도 안 붙는다 — 그게 사실이다. */
const SKILL_RATE = 0.091;

const ERROR_CODES = ['429', '500', 'overloaded_error', 'timeout'];

/**
 * 시간대별 비중 (%). **24시간 전부 돈다.** 8~22시로 자르던 시절에는 실측의
 * 0~5시(9.9%)가 통째로 사라져, 화면의 근무창 추정이 데모에서 한 번도 안 밟혔다.
 */
const HOUR_WEIGHTS = [
  2.1, 1.7, 1.3, 1.6, 1.6, 1.6, 0.2, 1.0, 2.4, 7.4, 8.8, 4.6,
  3.4, 4.7, 5.2, 8.5, 6.0, 5.9, 8.0, 4.1, 5.0, 4.3, 4.7, 5.8,
];

function weighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rng.range(0, total);
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1]![0];
}

/**
 * 로그정규에 가까운 꼬리. 중앙값 주변에 몰리고 가끔 크게 튄다.
 *
 * `spread`는 실측 분위수에서 역산한다 — `p90 / 중앙 = exp(spread × 0.549)`.
 * 작업 토큰은 11,658 / 2,107 = 5.53이라 3.1이고, 그 값이 p99도 76k로 맞춘다
 * (실측 74,489). 예전 값 1.9는 p90을 5,963으로 눌러 큰 호출이 아예 없었다.
 */
function heavyTail(median: number, spread: number): number {
  const u = Math.max(1e-6, rng.range(0, 1));
  return Math.round(median * Math.exp(spread * (Math.log(u / (1 - u)) / 4)));
}

const DAY = new Date();
DAY.setHours(0, 0, 0, 0);

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
  const pick = (): ModelSpec => {
    const id = weighted(MODEL_MIX);
    return USABLE.find((m) => m.id === id) ?? USABLE[rng.int(0, USABLE.length - 1)]!;
  };
  const primary = pick();
  const second = pick();
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

const HOUR_PAIRS = HOUR_WEIGHTS.map((w, h) => [h, w] as [number, number]);

for (const account of accounts) {
  /*
   * 하루를 **블록 몇 개**로 나눈다. 한 계정 = 연속 구간 하나로 두면 시작 시각을
   * 실측 분포에서 뽑아도 새벽이 거의 안 나온다 — 계정 40개에서 0~5시가 0.5%였고
   * 실측은 9.9%다. 사람은 하루에 한 번 붙었다 떨어지지 않는다: 오전에 한 번,
   * 저녁에 한 번, 새벽에 한 번이다. 블록마다 따로 뽑으면 그 모양이 나온다.
   */
  const blocks = rng.int(2, 3);
  let model = account.models[0]!;
  let tyre = account.tyre;

  for (let b = 0; b < blocks; b++) {
    const startHour = weighted(HOUR_PAIRS);
    const activeMs = 24 * 3_600_000 * (account.habit.active / blocks) * rng.range(0.4, 1);
    const from = DAY.getTime() + (startHour + rng.range(0, 1)) * 3_600_000;
    const until = Math.min(from + activeMs, DAY.getTime() + 24 * 3_600_000 - 1);
    let at = from;

    while (at < until) {
      // 간격은 꼬리가 길다 — 실측 중앙 2.3초에 p99가 172초다 (74.8배 → spread 3.75).
      at += Math.max(300, heavyTail(account.habit.gap * 1000, 3.75));

      if (rng.range(0, 1) < 0.02) model = account.models[rng.int(0, 1)]!;

      const work = Math.max(200, heavyTail(2_107, 3.1) * account.habit.size);
      /*
       * 캐시 재전송은 **작업량의 배수가 아니라 컨텍스트 크기**다. 배수로 뽑으면
       * 꼬리 둘이 곱해져 합계가 폭발한다 — 실제로 그렇게 만들었더니 계정 4개
       * 하루가 $79,513에 캐시 800억 토큰이 나왔다 (실측은 54일 $9,072).
       *
       * 실측 절대값으로 직접 뽑는다: 중앙 104,713 · p10 23,968 · p90 383,636.
       * 작업량과 독립이라, 큰 호출이라고 캐시가 같이 커지지 않는다.
       */
      const cacheRead = heavyTail(104_713, 2.3);
      const completion = Math.round(work * Math.min(0.6, heavyTail(166, 1.2) / 1000));
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
        skill: rng.range(0, 1) < SKILL_RATE ? weighted(SKILL_MIX) : undefined,
      });
    }
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
