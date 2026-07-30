/**
 * 실제 한도 잔여를 벤더에서 가져온다.
 *
 *   npm run fetch:limits
 *
 * 로컬 로그에는 Claude의 5시간·7일 한도가 없다. Anthropic이 서버에서 계산한 값을
 * OAuth 사용량 엔드포인트가 돌려준다 — Claude Code 자신이 부르는 것과 같은 API다.
 * (`gxjansen/claude-code-meter`가 쓰는 방법. 로컬 집계가 아니라 서버 계산값이라
 *  다른 기기·다른 클라이언트의 사용량까지 반영된다.)
 *
 * **토큰은 이 프로세스 밖으로 나가지 않는다.** 키체인에서 읽어 헤더에만 쓰고,
 * 출력·파일 어디에도 남기지 않는다. 저장하는 것은 사용률과 리셋 시각뿐이다.
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { codexRateLimit, grokCredits } from '../src/source/agentLogs';
import type { LimitReading } from '../src/source/agentLogs';

interface Window {
  utilization: number;
  resets_at: string | null;
  window_minutes: number;
}

export interface VendorLimits {
  vendor: string;
  fetchedAt: number;
  windows: Window[];
}

function keychainToken(): string | null {
  try {
    const raw = execFileSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const token = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function claudeLimits(): Promise<VendorLimits | null> {
  const token = keychainToken();
  if (!token) {
    console.error('키체인에 Claude Code 자격증명이 없다. `claude auth login` 후 다시 시도.');
    return null;
  }

  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      // 토큰은 여기서만 쓰인다. 로그에 남기지 않는다.
      authorization: `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
  });
  if (!res.ok) {
    console.error(`한도 조회 실패: HTTP ${res.status}`);
    return null;
  }

  const body = await res.json() as Record<string, { utilization?: number; resets_at?: string }>;
  const windows: Window[] = [];
  const add = (key: string, minutes: number) => {
    const w = body[key];
    if (typeof w?.utilization === 'number') {
      windows.push({ utilization: w.utilization, resets_at: w.resets_at ?? null, window_minutes: minutes });
    }
  };
  add('five_hour', 300);
  add('seven_day', 7 * 24 * 60);

  return windows.length ? { vendor: 'claude', fetchedAt: Date.now(), windows } : null;
}

/**
 * Codex·Grok은 조회 API를 열어두지 않았지만 **자기 로그에 한도를 적어 둔다.**
 * 마지막으로 그 에이전트를 돌린 순간의 값이므로, 그 시각을 함께 남긴다 —
 * 6일 전 판독을 "지금"이라고 화면에 띄우면 그건 거짓말이다.
 */
function newestReading(dir: string, parse: (row: unknown) => LimitReading | null): LimitReading | null {
  let best: LimitReading | null = null;
  const walk = (d: string): void => {
    let entries: Dirent[];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!entry.name.endsWith('.jsonl')) continue;
      let text: string;
      try { text = readFileSync(path, 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let row: unknown;
        try { row = JSON.parse(line); } catch { continue; }
        const reading = parse(row);
        if (reading && (best === null || reading.ts > best.ts)) best = reading;
      }
    }
  };
  walk(dir);
  return best;
}

function fromLog(vendor: string, dir: string, parse: (row: unknown) => LimitReading | null): VendorLimits | null {
  const reading = newestReading(join(homedir(), dir), parse);
  if (!reading) return null;
  return {
    vendor,
    fetchedAt: reading.ts,
    windows: [{
      utilization: 100 - reading.tyre_pct,
      resets_at: reading.resetsAt === undefined ? null : new Date(reading.resetsAt).toISOString(),
      window_minutes: reading.limit_window_minutes,
    }],
  };
}

const all = [
  await claudeLimits(),
  fromLog('codex', '.codex', codexRateLimit),
  fromLog('grok', '.grok', grokCredits),
].filter((v): v is VendorLimits => v !== null);

if (all.length) {
  const out = resolve(import.meta.dirname, '../fixtures/limits.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(all, null, 2) + '\n');
  const now = Date.now();
  for (const v of all) {
    const ageHours = (now - v.fetchedAt) / 3_600_000;
    // 로그에서 주운 값은 마지막 실행 시점의 값이다. 오래됐으면 오래됐다고 말한다.
    const age = ageHours < 1 ? '방금' : ageHours < 48 ? `${ageHours.toFixed(0)}시간 전` : `${(ageHours / 24).toFixed(0)}일 전`;
    for (const w of v.windows) {
      const label = w.window_minutes % 1440 === 0 ? `${w.window_minutes / 1440}일` : `${w.window_minutes / 60}시간`;
      console.log(`${v.vendor.padEnd(7)} ${label.padEnd(5)} 한도: ${w.utilization.toFixed(0)}% 사용 · ${(100 - w.utilization).toFixed(0)}% 남음 · 판독 ${age}`);
    }
  }
  console.log(`→ ${out}`);
}
