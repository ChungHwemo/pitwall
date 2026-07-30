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
  for (const file of newestFiles(join(homedir(), '.codex'), limit)) {
    let model: string | undefined;
    for (const row of readJsonl(file)) {
      const p = (row as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
      // 모델은 상태다 — 바뀐 시점 이벤트로 추적한다.
      const ctxModel = (p?.ctx as Record<string, unknown> | undefined)?.model
        ?? (p as Record<string, unknown> | undefined)?.model;
      if (typeof ctxModel === 'string' && ctxModel.startsWith('gpt-')) model = ctxModel;
      const e = codexEvent(row, { car, model });
      if (e) out.push(e);
    }
  }
  return out;
}

/** Grok. 모델은 `model changed` 이벤트로 추적한다. */
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
    if (event) events.push(event);
  }
}

// 다른 벤더 계정들을 같은 트랙에 올린다.
const codex = collectCodex(maxFiles);
const grok = collectGrok(maxFiles);
const copilot = collectCopilot(60);
events.push(...codex, ...grok, ...copilot);
console.log(`벤더별: claude ${events.length - codex.length - grok.length - copilot.length} · codex ${codex.length} · grok ${grok.length} · copilot ${copilot.length}`);

events.sort((a, b) => a.ts - b.ts);

// 레이스 한 판은 하루다. 여러 날을 이어 붙이면 연료가 첫 화면부터 0이 되고
// 트랙에는 그 순간 활동한 한두 프로젝트만 남는다 — 실측에서 관측한 그대로다.
// 가장 붐빈 하루를 골라 그 안에서만 재생한다.
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);
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

const [busiestDay, dayEvents] = [...perDay.entries()]
  .sort((a, b) => {
    const [carsA, secondA] = balance(a[1]);
    const [carsB, secondB] = balance(b[1]);
    return carsB - carsA || secondB - secondA || b[1].length - a[1].length;
  })[0]!;

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

console.log(`${busiestDay} (가장 붐빈 하루) ${dayEvents.length}건 → ${out}`);
console.log(`전체 ${events.length}건 중 ${perDay.size}일치에서 골랐다`);
console.log(`파일 ${files.length}개 · 차량(계정) ${byCar.size}대 · 토큰 ${tokens.toLocaleString('ko-KR')} · 비용 $${cost.toFixed(2)}`);
console.log('모델:', [...byModel.entries()].sort((a, b) => b[1] - a[1])
  .map(([m, n]) => `${m}×${n}`).join(' '));
// 카탈로그에 실제로 없는 것만 센다. 접두어로 판단하면 다른 벤더가 전부 미상으로 잡힌다.
const unknown = [...byModel.keys()].filter((m) => !specOf(m));
if (unknown.length) console.log('카탈로그 밖 모델(비용 0 처리):', unknown.join(', '));
