/**
 * Claude Code 트랜스크립트 → `CarEvent` JSONL.
 *
 *   npm run import:real                      # 기본 예산 $20/일
 *   npm run import:real -- 50 400            # 예산 $50, 최근 400개 파일
 *
 * 실제 사용 기록을 시뮬레이터와 **같은 계약**으로 옮긴다. 여기서 나온 파일이
 * 화면에서 그대로 돌면 A5(가짜 데이터로 만든 로직이 실데이터에서 안 돈다)가 해소된다.
 *
 * 본문·경로·브랜치는 `toCarEvent`가 걸러낸다. 이 스크립트는 파일을 읽어 넘길 뿐이다.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { toCarEvent } from '../src/source/claudeCodeImport';
import { accountCar, codexEvent, grokEvent, copilotEvents } from '../src/source/agentLogs';
import { specOf } from '../src/config/models';
import { workdayFromActivity } from '../src/state/clock';
import { workOf } from '../src/state/reducer';
import type { CarEvent } from '../src/types';

/** 로그를 남기는 에이전트를 전부 훑는다. 벤더 하나당 계정 하나 = 차량 한 대. */
function readJsonl(file: string): unknown[] {
  const out: unknown[] = [];
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* 깨진 줄은 건너뛴다 */ }
    }
  } catch { /* 못 읽는 파일은 건너뛴다 */ }
  return out;
}

function newestFiles(dir: string, limit: number): string[] {
  try {
    return walk(dir)
      .map((f) => ({ f, m: statSync(f).mtimeMs }))
      .sort((a, b) => b.m - a.m)
      .slice(0, limit)
      .map(({ f }) => f);
  } catch {
    return [];
  }
}

/** Codex. 계정 id는 auth.json에 있고 토큰은 건드리지 않는다. */
function codexAccount(): string {
  try {
    const auth = JSON.parse(readFileSync(join(homedir(), '.codex', 'auth.json'), 'utf8'));
    return String(auth?.tokens?.account_id ?? 'codex');
  } catch {
    return 'codex';
  }
}

function collectCodex(limit: number): CarEvent[] {
  const car = accountCar('codex', codexAccount());
  const out: CarEvent[] = [];
  const modelOf = (row: unknown): string | undefined => {
    const p = (row as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
    const m = (p?.ctx as Record<string, unknown> | undefined)?.model ?? p?.model;
    return typeof m === 'string' && m.startsWith('gpt-') ? m : undefined;
  };

  for (const file of newestFiles(join(homedir(), '.codex'), limit)) {
    const rows = readJsonl(file);
    // 모델은 상태다. 파일이 `token_count`부터 시작하면 그 앞의 `turn_context`는
    // 다른 파일에 있다 — 파일 안에서 처음 보이는 모델로 시작한다. 그러지 않으면
    // 그 파일 전체가 unknown이 되고, 계정 하나가 클래스가 흔들려 두 레인에 걸친다.
    let model = rows.map(modelOf).find(Boolean);
    for (const row of rows) {
      const ctxModel = modelOf(row);
      if (ctxModel) model = ctxModel;
      const e = codexEvent(row, { car, model });
      if (e) out.push(e);
    }
  }
  return out;
}

/** Grok. 모델은 `model changed` 이벤트로 추적한다. 한도는 `applyLimit`이 붙인다. */
function collectGrok(limit: number): CarEvent[] {
  const car = accountCar('grok', 'grok');
  const out: CarEvent[] = [];
  for (const file of newestFiles(join(homedir(), '.grok'), limit)) {
    let model: string | undefined;
    for (const row of readJsonl(file)) {
      const r = row as Record<string, unknown>;
      const c = r.ctx as Record<string, unknown> | undefined;
      const m = c?.model ?? c?.current_model_id;
      if (typeof m === 'string' && m.startsWith('grok-')) model = m;
      const e = grokEvent(row, { car, model });
      if (e) out.push(e);
    }
  }
  return out;
}

/** Copilot. 세션 집계라 호출 단위가 아니다 — 차량 하나에 굵직한 이벤트 몇 개. */
function collectCopilot(limit: number): CarEvent[] {
  const car = accountCar('copilot', 'copilot');
  const out: CarEvent[] = [];
  for (const file of newestFiles(join(homedir(), '.copilot'), limit)) {
    for (const row of readJsonl(file)) out.push(...copilotEvents(row, { car }));
  }
  return out;
}

// 실측 차량당 비용 중앙값이 9일에 $92.84였다. 일 $20은 즉시 소진된다.
const dailyBudgetUsd = Number(process.argv[2] ?? 60);
const maxFiles = Number(process.argv[3] ?? 300);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.jsonl')) out.push(path);
  }
  return out;
}

/**
 * 계정 식별자. 트랜스크립트에는 없고 설정에만 있다.
 * uuid만 읽고 이메일은 건드리지 않는다 — 읽어서 버리는 것과 안 읽는 것은 다르다.
 */
function readAccount(): { accountUuid: string } | undefined {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'));
    const uuid = cfg?.oauthAccount?.accountUuid;
    return typeof uuid === 'string' ? { accountUuid: uuid } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 벤더에서 가져온 실제 한도. `npm run fetch:limits`가 만든다.
 * 없으면 한도 게이지를 그리지 않는다 — 없는 값을 0이나 100으로 두지 않는다.
 */
function readLimits(vendor: string): { utilization: number; window_minutes: number } | null {
  try {
    const all = JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/limits.json'), 'utf8'));
    const found = all.find((v: { vendor: string }) => v.vendor === vendor);
    // 여러 창이 오면 짧은 쪽(=먼저 걸리는 쪽)을 쓴다. 5시간이 7일보다 먼저 막는다.
    const windows = (found?.windows ?? []).slice().sort(
      (a: { window_minutes: number }, b: { window_minutes: number }) => a.window_minutes - b.window_minutes);
    return windows[0] ?? null;
  } catch {
    return null;
  }
}

const claudeLimit = readLimits('claude');
const account = readAccount();
const root = join(homedir(), '.claude', 'projects');
const files = walk(root)
  .map((f) => ({ f, mtime: statSync(f).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, maxFiles)
  .map(({ f }) => f);

const events: CarEvent[] = [];
for (const file of files) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { continue; }
    // 계정은 줄마다 없으므로 여기서 붙여 넣는다.
    const event = toCarEvent(
      typeof parsed === 'object' && parsed !== null ? { ...parsed, account } : parsed);
    if (event) {
      if (claudeLimit) {
        event.tyre_pct = Math.max(0, 100 - claudeLimit.utilization);
        event.limit_window_minutes = claudeLimit.window_minutes;
      }
      events.push(event);
    }
  }
}

// 다른 벤더 계정들을 같은 트랙에 올린다.
/**
 * 한도는 **지금** 축이다. 이벤트마다 로그에 박힌 과거 수치를 쓰면 재생 중인 하루의
 * 한도가 화면에 뜨는데, 사람이 보고 싶은 것은 "지금 이 계정이 막혔는가"다.
 * `npm run fetch:limits`가 벤더별 최신 판독을 모아 두었으니 그것으로 덮는다.
 */
function applyLimit(vendor: string, list: CarEvent[]): void {
  const limit = readLimits(vendor);
  if (!limit) return;
  for (const e of list) {
    e.tyre_pct = Math.max(0, 100 - limit.utilization);
    e.limit_window_minutes = limit.window_minutes;
  }
}

const codex = collectCodex(maxFiles);
const grok = collectGrok(maxFiles);
const copilot = collectCopilot(60);
applyLimit('codex', codex);
applyLimit('grok', grok);
events.push(...codex, ...grok, ...copilot);
console.log(`벤더별: claude ${events.length - codex.length - grok.length - copilot.length} · codex ${codex.length} · grok ${grok.length} · copilot ${copilot.length}`);

events.sort((a, b) => a.ts - b.ts);

// 레이스 한 판은 하루다. 여러 날을 이어 붙이면 연료가 첫 화면부터 0이 되고
// 트랙에는 그 순간 활동한 한두 프로젝트만 남는다 — 실측에서 관측한 그대로다.
// 하루를 골라 그 안에서만 재생한다. 기본은 오늘이다.
// 로컬 자정 기준으로 하루를 자른다. UTC로 자르면 한국 오전 9시가 전날에 붙는다.
const dayOf = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const perDay = new Map<string, CarEvent[]>();
for (const e of events) {
  const key = dayOf(e.ts);
  (perDay.get(key) ?? perDay.set(key, []).get(key)!).push(e);
}
/**
 * 계정이 여럿 활동한 하루를 고른다. 총량이 아니라 **균형**으로 고른다 —
 * 한 계정이 98%인 날을 뽑으면 트랙에 차는 둘인데 볼 것은 하나다.
 * 두 번째로 활발한 계정의 호출 수를 기준으로 삼는다.
 */
function balance(events: CarEvent[]): [number, number] {
  const byCar = new Map<string, number>();
  for (const e of events) byCar.set(e.car_id, (byCar.get(e.car_id) ?? 0) + 1);
  const counts = [...byCar.values()].sort((a, b) => b - a);
  return [byCar.size, counts[1] ?? 0];
}

/**
 * **오늘이 있으면 오늘이다.** 화면이 답해야 하는 질문은 "지금 무슨 일이 벌어지고
 * 있는가"인데, 지난 어느 날을 재생하면 방금 태운 토큰이 어디에도 안 나온다.
 * 오늘 기록이 없을 때만(아직 아무도 안 돌렸을 때) 가장 균형 잡힌 과거 하루로
 * 물러난다. 특정 날짜를 보고 싶으면 세 번째 인자로 준다.
 */
const requestedDay = process.argv[4];
const today = dayOf(Date.now());
const ranked = [...perDay.entries()].sort((a, b) => {
  const [carsA, secondA] = balance(a[1]);
  const [carsB, secondB] = balance(b[1]);
  return carsB - carsA || secondB - secondA || b[1].length - a[1].length;
});
const chosen = (requestedDay && perDay.has(requestedDay)
  ? [requestedDay, perDay.get(requestedDay)!] as const
  : perDay.has(today) ? [today, perDay.get(today)!] as const : ranked[0]!);
if (requestedDay && !perDay.has(requestedDay)) {
  console.log(`${requestedDay}에는 기록이 없다. 대신 ${chosen[0]}을 쓴다.`);
}
const [busiestDay, dayEvents] = chosen;

/**
 * 레이스 창을 실제 활동에서 뽑고, 그 밖으로 삐져나간 기록은 잘라낸다.
 *
 * 창은 재생 원점이기도 하다. 창 앞에 기록이 남아 있으면 재생이 PRE GRID에서
 * 시작해 한참을 빈 화면으로 돈다. 버린 양은 반드시 찍는다 — 조용히 줄이지 않는다.
 */
const window_ = workdayFromActivity(dayEvents.map((e) => ({ ts: e.ts, work: workOf(e) })));
const inWindow = dayEvents.filter((e) => {
  const d = new Date(e.ts);
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= window_.raceStart && m < window_.raceEnd;
});
if (inWindow.length < dayEvents.length) {
  const cut = dayEvents.length - inWindow.length;
  const cutWork = dayEvents.reduce((a, e) => a + workOf(e), 0) - inWindow.reduce((a, e) => a + workOf(e), 0);
  const total = dayEvents.reduce((a, e) => a + workOf(e), 0);
  console.log(`창(${window_.raceStart / 60}시~${window_.raceEnd / 60}시) 밖 ${cut}건 제외 · 작업 ${(cutWork / total * 100).toFixed(1)}%`);
}
dayEvents.length = 0;
dayEvents.push(...inWindow);

// 연료는 그날의 차량별 누적 비용을 일간 예산으로 나눈 잔여다.
const spent = new Map<string, number>();
for (const e of dayEvents) {
  const total = (spent.get(e.car_id) ?? 0) + e.cost_usd;
  spent.set(e.car_id, total);
  e.fuel_pct = Math.max(0, 100 - (total / dailyBudgetUsd) * 100);
}

const out = resolve(import.meta.dirname, '../fixtures/events.real.jsonl');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, dayEvents.map((e) => JSON.stringify(e)).join('\n') + '\n');

const byModel = new Map<string, number>();
const byCar = new Map<string, number>();
let cost = 0;
let tokens = 0;
for (const e of dayEvents) {
  byModel.set(e.model, (byModel.get(e.model) ?? 0) + 1);
  byCar.set(e.car_id, (byCar.get(e.car_id) ?? 0) + 1);
  cost += e.cost_usd;
  tokens += e.tokens.prompt + e.tokens.completion;
}

console.log(`${busiestDay}${busiestDay === today ? " (오늘)" : " (오늘 기록이 없어 대체)"} ${dayEvents.length}건 → ${out}`);
console.log(`전체 ${events.length}건 중 ${perDay.size}일치에서 골랐다`);
console.log(`파일 ${files.length}개 · 차량(계정) ${byCar.size}대 · 토큰 ${tokens.toLocaleString('ko-KR')} · 비용 $${cost.toFixed(2)}`);
console.log('모델:', [...byModel.entries()].sort((a, b) => b[1] - a[1])
  .map(([m, n]) => `${m}×${n}`).join(' '));
// 카탈로그에 실제로 없는 것만 센다. 접두어로 판단하면 다른 벤더가 전부 미상으로 잡힌다.
const unknown = [...byModel.keys()].filter((m) => !specOf(m));
if (unknown.length) console.log('카탈로그 밖 모델(비용 0 처리):', unknown.join(', '));
