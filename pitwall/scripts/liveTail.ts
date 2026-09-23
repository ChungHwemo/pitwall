import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LiveAccounts, LiveVendor } from '../src/source/LiveSource';

export const LIVE_VENDORS: { vendor: LiveVendor; dir: string }[] = [
  { vendor: 'claude', dir: '.claude/projects' },
  { vendor: 'codex', dir: '.codex' },
  { vendor: 'grok', dir: '.grok' },
  { vendor: 'copilot', dir: '.copilot' },
];

export const LIVE_BACKFILL_MS = 15 * 60_000;

interface TailerOptions {
  home?: string;
  backfillMs?: number;
  now?: () => number;
}

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

export function slimLogLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let row: unknown;
  try { row = JSON.parse(trimmed); } catch { return null; }
  return JSON.stringify(keepUsage(row));
}

/**
 * 파서가 읽는 키만 남긴다. 이름 거절 목록은 다른 키의 작업 문장을 통과시킨다.
 * Swift `LogTail.stripBulky` 와 같은 목록이다.
 */
const USAGE_KEYS = new Set([
  'timestamp', 'ts', 'sessionId', 'sid', 'message', 'id', 'model', 'usage',
  'input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens',
  'attributionSkill', 'isApiErrorMessage', 'error', 'apiErrorStatus',
  'type', 'payload', 'ctx', 'info', 'last_token_usage', 'cached_input_tokens',
  'reasoning_output_tokens', 'rate_limits', 'primary', 'used_percent', 'window_minutes', 'resets_at',
  'msg', 'prompt_tokens', 'completion_tokens', 'reasoning_tokens', 'cached_prompt_tokens',
  'model_elapsed_ms', 'current_model_id', 'method', 'params', 'update', 'sessionUpdate',
  'inputTokens', 'outputTokens', 'cachedReadTokens', 'reasoningTokens', 'modelUsage',
  'modelCalls', 'apiDurationMs', '_meta', 'modelId', 'model_id',
  'data', 'modelMetrics', 'sessionStartTime', 'cacheReadTokens',
]);

function keepUsage(value: unknown, parent?: string): unknown {
  if (Array.isArray(value)) return value.map((child) => keepUsage(child, parent));
  if (typeof value === 'string') return value.length > 200 ? '' : value;
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    // 모델 이름은 사용량 키가 아니다. 그 값(usage)만 필요하다.
    if (!USAGE_KEYS.has(key) && parent !== 'modelMetrics' && parent !== 'modelUsage') continue;
    out[key] = keepUsage(child, key);
  }
  return out;
}

export function readLiveAccounts(home = homedir()): LiveAccounts {
  const accounts: LiveAccounts = {};
  try {
    const cfg = JSON.parse(readFileSync(join(home, '.claude.json'), 'utf8'));
    if (typeof cfg?.oauthAccount?.accountUuid === 'string') {
      accounts.claudeAccountUuid = cfg.oauthAccount.accountUuid;
    }
  } catch { /* 없으면 없다 */ }
  try {
    const auth = JSON.parse(readFileSync(join(home, '.codex', 'auth.json'), 'utf8'));
    if (typeof auth?.tokens?.account_id === 'string') {
      accounts.codexAccountId = auth.tokens.account_id;
    }
  } catch { /* 없으면 없다 */ }
  return accounts;
}

export class LiveTail {
  private offsets = new Map<string, number>();
  /** 개행 전에 이미 넘긴 JSON. 개행이 붙어도 같은 줄을 다시 세지 않는다. */
  private partialSent = new Map<string, string>();
  private readonly home: string;
  private readonly backfillMs: number;
  private readonly now: () => number;

  constructor(opts: TailerOptions = {}) {
    this.home = opts.home ?? homedir();
    this.backfillMs = opts.backfillMs ?? LIVE_BACKFILL_MS;
    this.now = opts.now ?? Date.now;
  }

  poll(): { vendor: LiveVendor; lines: string[] }[] {
    const cutoff = this.now() - Math.max(this.backfillMs, 3_600_000);
    const out: { vendor: LiveVendor; lines: string[] }[] = [];
    for (const { vendor, dir } of LIVE_VENDORS) {
      const lines: string[] = [];
      for (const file of this.freshFiles(join(this.home, dir), cutoff)) {
        lines.push(...this.read(file));
      }
      if (lines.length) out.push({ vendor, lines });
    }
    return out;
  }

  private freshFiles(dir: string, cutoff: number): string[] {
    return walk(dir).filter((file) => {
      try { return statSync(file).mtimeMs >= cutoff; } catch { return false; }
    });
  }

  private read(file: string): string[] {
    let buf: Buffer;
    try { buf = readFileSync(file); } catch { return []; }
    const size = buf.length;
    const seen = this.offsets.get(file);
    if (seen === undefined) {
      this.offsets.set(file, size);
      return this.backfill(buf.toString('utf8'));
    }
    const start = size < seen ? 0 : seen;
    if (start === size) return [];
    const slice = buf.subarray(start);
    const lastNl = slice.lastIndexOf(0x0a);
    const complete = lastNl < 0 ? Buffer.alloc(0) : slice.subarray(0, lastNl + 1);
    const tail = (lastNl < 0 ? slice : slice.subarray(lastNl + 1)).toString('utf8');
    if (complete.length) this.offsets.set(file, start + complete.length);
    const lines: string[] = [];
    if (complete.length) {
      for (const raw of complete.toString('utf8').split('\n')) {
        const slim = slimLogLine(raw);
        if (!slim) continue;
        if (slim === this.partialSent.get(file)) {
          this.partialSent.delete(file);
          continue;
        }
        lines.push(slim);
      }
    }
    const pending = tail.trim();
    const pendingSlim = pending ? slimLogLine(pending) : null;
    if (pendingSlim) {
      if (this.partialSent.get(file) !== pendingSlim) {
        this.partialSent.set(file, pendingSlim);
        lines.push(pendingSlim);
      }
    } else {
      this.partialSent.delete(file);
    }
    return lines;
  }

  private backfill(text: string): string[] {
    const since = this.now() - this.backfillMs;
    const out: string[] = [];
    for (const line of text.split('\n')) {
      const slim = slimLogLine(line);
      if (!slim) continue;
      const ts = lineTime(slim);
      if (ts !== null && ts < since) continue;
      if (ts === null) continue;
      out.push(slim);
    }
    return out.slice(-2_000);
  }
}

function lineTime(line: string): number | null {
  try {
    const row = JSON.parse(line) as Record<string, unknown>;
    if (typeof row.ts === 'string') {
      const t = Date.parse(row.ts);
      return Number.isFinite(t) ? t : null;
    }
    if (typeof row.timestamp === 'number') {
      return row.timestamp < 1e12 ? row.timestamp * 1000 : row.timestamp;
    }
    if (typeof row.timestamp === 'string') {
      const t = Date.parse(row.timestamp);
      return Number.isFinite(t) ? t : null;
    }
  } catch { /* 시각 없는 줄은 백필에서 버린다 */ }
  return null;
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
