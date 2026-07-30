/**
 * 실시간 경로를 **실제 계정 로그**로 검증한다.
 *
 *   npm run live:check          # 최근 10분
 *   npm run live:check -- 120   # 최근 120분
 *
 * 네이티브 껍데기가 하는 일(파일 따라가기 → 새 줄을 넘김)을 여기서 흉내 내고,
 * 화면이 쓰는 것과 **같은 `LiveSource`**에 통과시킨다. 여기서 이벤트가 안 나오면
 * 앱에서도 안 나온다.
 *
 * 계정 uuid와 토큰은 화면에도 출력에도 나오지 않는다. 나가는 것은 해시뿐이다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { LiveSource, type LiveVendor } from '../src/source/LiveSource';
import { workOf, cachedOf } from '../src/state/reducer';
import type { CarEvent } from '../src/types';

const minutes = Number(process.argv[2] ?? 10);
const since = Date.now() - minutes * 60_000;

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.jsonl')) out.push(path);
  }
  return out;
}

/** 껍데기와 같은 규칙 — 최근에 쓰인 파일만 따라간다. */
function touchedSince(dir: string, at: number): string[] {
  return walk(join(homedir(), dir)).filter((f) => {
    try { return statSync(f).mtimeMs >= at; } catch { return false; }
  });
}

function claudeAccount(): string | undefined {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'));
    const uuid = cfg?.oauthAccount?.accountUuid;
    return typeof uuid === 'string' ? uuid : undefined;
  } catch {
    return undefined;
  }
}

function codexAccount(): string | undefined {
  try {
    const auth = JSON.parse(readFileSync(join(homedir(), '.codex', 'auth.json'), 'utf8'));
    const id = auth?.tokens?.account_id;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

const source = new LiveSource({
  claudeAccountUuid: claudeAccount(),
  codexAccountId: codexAccount(),
}, 100_000);

const seen: CarEvent[] = [];
source.start((e) => seen.push(e));

const VENDORS: { vendor: LiveVendor; dir: string }[] = [
  { vendor: 'claude', dir: '.claude/projects' },
  { vendor: 'codex', dir: '.codex' },
  { vendor: 'grok', dir: '.grok' },
];

for (const { vendor, dir } of VENDORS) {
  const files = touchedSince(dir, since);
  let lines = 0;
  for (const file of files) {
    let text: string;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    const fresh = text.split('\n').filter((l) => l.trim());
    lines += fresh.length;
    source.ingest(vendor, fresh);
  }
  console.log(`${vendor.padEnd(7)} 파일 ${String(files.length).padStart(4)}개 · 줄 ${lines.toLocaleString('ko-KR')}`);
}

source.tick(Date.now());

// 창 밖(파일은 최근이지만 줄은 오래된 것)을 걸러 실제 최근 활동만 센다.
const recent = seen.filter((e) => (e.wall_ts ?? 0) >= since);
if (recent.length === 0) {
  console.log(`\n최근 ${minutes}분 안에 호출이 없다. 에이전트를 한 번 돌리고 다시 실행하십시오.`);
  process.exit(0);
}

const byCar = new Map<number, { calls: number; work: number; cached: number; cost: number; models: Set<string> }>();
for (const e of recent) {
  const row = byCar.get(e.car_number)
    ?? { calls: 0, work: 0, cached: 0, cost: 0, models: new Set<string>() };
  row.calls += 1;
  row.work += workOf(e);
  row.cached += cachedOf(e);
  row.cost += e.cost_usd;
  row.models.add(e.model);
  byCar.set(e.car_number, row);
}

console.log(`\n최근 ${minutes}분 · 이벤트 ${recent.length}건`);
for (const [number, row] of [...byCar].sort((a, b) => b[1].cost - a[1].cost)) {
  console.log(`  #${String(number).padStart(3, '0')}  ${row.calls}콜 · work ${row.work.toLocaleString('ko-KR')}`
    + ` · cache ${row.cached.toLocaleString('ko-KR')} · $${row.cost.toFixed(2)}`
    + `  [${[...row.models].join(', ')}]`);
}

const newest = recent.reduce((a, e) => Math.max(a, e.wall_ts ?? 0), 0);
console.log(`\n가장 최근 호출 ${Math.round((Date.now() - newest) / 1000)}초 전`);

// 원문 식별자가 새어 나가지 않았는지 여기서 한 번 더 확인한다.
const uuid = claudeAccount();
const leaked = uuid !== undefined && JSON.stringify(recent).includes(uuid);
console.log(leaked ? '⛔ 계정 uuid가 이벤트에 남았다' : '계정 식별자 유출 없음 (해시만 통과)');
if (leaked) process.exit(1);
