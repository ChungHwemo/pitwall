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
import type { CarEvent } from '../src/types';

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
    const event = toCarEvent(parsed);
    if (event) events.push(event);
  }
}

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
const [busiestDay, dayEvents] = [...perDay.entries()]
  .sort((a, b) => new Set(b[1].map((e) => e.car_id)).size - new Set(a[1].map((e) => e.car_id)).size
    || b[1].length - a[1].length)[0]!;

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
console.log(`파일 ${files.length}개 · 차량(프로젝트) ${byCar.size}대 · 토큰 ${tokens.toLocaleString('ko-KR')} · 비용 $${cost.toFixed(2)}`);
console.log('모델:', [...byModel.entries()].sort((a, b) => b[1] - a[1])
  .map(([m, n]) => `${m}×${n}`).join(' '));
const unknown = [...byModel.keys()].filter((m) => !m.startsWith('claude-'));
if (unknown.length) console.log('카탈로그 밖 모델(비용 0 처리):', unknown.join(', '));
