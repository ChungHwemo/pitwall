/**
 * 실기록 교차검증 — LogTail과 같은 1시간 창, LiveSource와 같은 파서로 오늘 로그를
 * 돌려 벤더별 파싱률·토큰 계약·비용·세션·모델 커버리지를 원본 행 단위로 대조한다.
 *
 *   npm run live:check와 달리 결과물이 아닌 파이프라인 자체를 검사한다.
 *   vite-node scripts/crosscheck.ts [창_시간]
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { toCarEvent } from '../src/source/claudeCodeImport';
import { accountCar, codexEvent, grokEvent, copilotEvents } from '../src/source/agentLogs';
import { specOf } from '../src/config/models';
import { workOf, cachedOf } from '../src/state/reducer';
import type { CarEvent } from '../src/types';

const freshWindowMs = (Number(process.argv[2]) || 1) * 3600_000;
const cutoff = Date.now() - freshWindowMs;

function walk(dir: string, out: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, out);
      else if (entry.name.endsWith('.jsonl') && statSync(path).mtimeMs >= cutoff) out.push(path);
    }
  } catch { /* 없는 디렉토리는 건너뛴다 */ }
  return out;
}

interface RawCheck {
  total?: number; // 로그에 찍힌 합계
  sum?: number;   // 파서가 해석한 구성요소 합계
  cachedOverInput: number; // cache_read > input 행 수 (캐시 제외 증거)
  withCreation: number;    // cache_creation > 0 행 수
  rows: number;
}

// 위 응용 — 간단히 각 벤더를 직접 훑는다.
const rawByVendor: Record<string, RawCheck> = {
  claude: { cachedOverInput: 0, withCreation: 0, rows: 0 },
  codex: { cachedOverInput: 0, withCreation: 0, rows: 0 },
  grok: { cachedOverInput: 0, withCreation: 0, rows: 0 },
  copilot: { cachedOverInput: 0, withCreation: 0, rows: 0 },
};

function noteClaude(row: unknown): void {
  const usage = ((row as Record<string, unknown>)?.message as Record<string, unknown> | undefined)
    ?.usage as Record<string, number> | undefined;
  if (!usage) return;
  const r = rawByVendor.claude!;
  r.rows++;
  if ((usage.cache_read_input_tokens ?? 0) > (usage.input_tokens ?? 0)) r.cachedOverInput++;
  if ((usage.cache_creation_input_tokens ?? 0) > 0) r.withCreation++;
}

function noteCodex(row: unknown): void {
  const payload = (row as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
  if (payload?.type !== 'token_count') return;
  const u = (payload.info as Record<string, unknown> | undefined)?.last_token_usage as
    Record<string, number> | undefined;
  if (!u) return;
  const r = rawByVendor.codex!;
  r.rows++;
  if ((u.cached_input_tokens ?? 0) > (u.input_tokens ?? 0)) r.cachedOverInput++;
  const sumNoCache = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.reasoning_output_tokens ?? 0);
  const sumWithCache = sumNoCache + (u.cached_input_tokens ?? 0);
  if (typeof u.total_tokens === 'number') {
    r.total = (r.total ?? 0) + u.total_tokens;
    r.sum = (r.sum ?? 0) + (Math.abs(sumWithCache - u.total_tokens) < Math.abs(sumNoCache - u.total_tokens) ? sumWithCache : sumNoCache);
  }
}

function noteGrok(row: unknown): void {
  const usage = ((row as Record<string, unknown>)?.params as Record<string, unknown> | undefined)
    ?.update as Record<string, unknown> | undefined;
  const u = usage?.usage as Record<string, number> | undefined;
  if (!u) return;
  const r = rawByVendor.grok!;
  r.rows++;
  if ((u.cachedReadTokens ?? 0) > (u.inputTokens ?? 0)) r.cachedOverInput++;
  if (typeof u.totalTokens === 'number') {
    r.total = (r.total ?? 0) + u.totalTokens;
    r.sum = (r.sum ?? 0) + (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
  }
}

function noteCopilot(): void {}

const home = homedir();
const claudeFiles = walk(join(home, '.claude', 'projects'));
const codexFiles = walk(join(home, '.codex'));
const grokFiles = walk(join(home, '.grok'));
const copilotFiles = walk(join(home, '.copilot'));

const claudeCar = accountCar('claude', 'crosscheck');
const codexCar = accountCar('codex', 'crosscheck');
const grokCar = accountCar('grok', 'grok');
const copilotCar = accountCar('copilot', 'copilot');

const all: { vendor: string; events: CarEvent[] }[] = [];

// Claude — LiveSource와 같게 계정 uuid 없이도 줄 자체를 그대로
const claudeEvents: CarEvent[] = [];
for (const file of claudeFiles) {
  let codexModel: string | undefined;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row: unknown;
    try { row = JSON.parse(line); } catch { continue; }
    noteClaude(row);
    const e = toCarEvent(row);
    if (e) claudeEvents.push(e);
  }
  void codexModel;
}
all.push({ vendor: 'claude', events: claudeEvents });

const codexEvents: CarEvent[] = [];
for (const file of codexFiles) {
  const rows = readFileSync(file, 'utf8').split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  // 모델 추적: 파일 안에서 처음 보이는 gpt- 모델 (import 스크립트와 같은 규칙)
  let model = rows.map((r) => {
    const p = (r as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
    const m = (p?.ctx as Record<string, unknown> | undefined)?.model ?? p?.model;
    return typeof m === 'string' && m.startsWith('gpt-') ? m : undefined;
  }).find(Boolean);
  for (const row of rows) {
    noteCodex(row);
    const p = (row as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
    const m = (p?.ctx as Record<string, unknown> | undefined)?.model ?? p?.model;
    if (typeof m === 'string' && m.startsWith('gpt-')) model = m;
    const e = codexEvent(row, { car: codexCar, model });
    if (e) codexEvents.push(e);
  }
}
all.push({ vendor: 'codex', events: codexEvents });

const grokEvents: CarEvent[] = [];
for (const file of grokFiles) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row: unknown;
    try { row = JSON.parse(line); } catch { continue; }
    noteGrok(row);
    const e = grokEvent(row, { car: grokCar });
    if (e) grokEvents.push(e);
  }
}
all.push({ vendor: 'grok', events: grokEvents });

const copilotEvents_ = copilotFiles.flatMap((file) => {
  const rows = readFileSync(file, 'utf8').split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  rows.forEach(noteCopilot);
  return rows.flatMap((r) => copilotEvents(r, { car: copilotCar }));
});
all.push({ vendor: 'copilot', events: copilotEvents_ });

// ── 교차검증 리포트 ──
const byVendor: Record<string, { files: number }> = {
  claude: { files: claudeFiles.length },
  codex: { files: codexFiles.length },
  grok: { files: grokFiles.length },
  copilot: { files: copilotFiles.length },
};

for (const { vendor, events } of all) {
  const r = rawByVendor[vendor]!;
  const sessions = new Set(events.map((e) => e.session_id).filter(Boolean) as string[]);
  const models = new Map<string, number>();
  let work0 = 0, work = 0, cached = 0, cost = 0, costTrue = 0, unpriced = 0;
  for (const e of events) {
    models.set(e.model, (models.get(e.model) ?? 0) + 1);
    const w = workOf(e);
    if (w === 0 && cachedOf(e) > 0) work0++;
    work += w;
    cached += cachedOf(e);
    cost += e.cost_usd;
    const spec = specOf(e.model);
    if (!spec) { unpriced++; continue; }
    // 진짜 비용: 신규 입력은 입력 단가, 캐시 읽기는 캐시 단가, 출력·추론은 출력 단가.
    // 모든 파서의 prompt는 캐시를 포함한다 — 벤더 분기 없이 한 공식으로 맞다.
    const c = cachedOf(e);
    const p = Math.max(0, e.tokens.prompt - c);
    const out = e.tokens.completion + (e.tokens.reasoning ?? 0);
    costTrue += (p * spec.inputPerMtok + c * spec.cachedInputPerMtok + out * spec.outputPerMtok) / 1_000_000;
  }
  const parsed = events.length;
  const files = byVendor[vendor]!.files;
  const totalLines = (() => {
    let n = 0;
    for (const f of vendor === 'claude' ? claudeFiles : vendor === 'codex' ? codexFiles : vendor === 'grok' ? grokFiles : copilotFiles) {
      let c = 0;
      try { c = readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).length; } catch {}
      n += c;
    }
    return n;
  })();
  console.log(`\n== ${vendor} ==`);
  console.log(`파일 ${files} · 줄 ${totalLines} · 이벤트 ${parsed}${parsed ? ` (파싱률 ${(parsed / totalLines * 100).toFixed(1)}%)` : ''}`);
  console.log(`세션 ${sessions.size} · 모델 ${[...models.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}×${n}`).join(' ')}`);
  console.log(`작업토큰 ${work.toLocaleString('ko-KR')} · 캐시 ${cached.toLocaleString('ko-KR')} · 캐시>입력으로 work=0 클램프 ${work0}건`);
  if (parsed) console.log(`비용 파서 $${cost.toFixed(3)} vs 구성요소 재계산 $${costTrue.toFixed(3)}${unpriced ? ` (단가 없음 ${unpriced}건)` : ''}`);
  if (r.rows) {
    console.log(`원본 행 ${r.rows} · cache_read > input ${r.cachedOverInput}건 · cache_creation > 0 ${r.withCreation}건`
      + (r.total !== undefined ? ` · total_sum 일치 ${r.total === r.sum ? 'O' : `X (${r.total} vs ${r.sum})`}` : ''));
  }
}