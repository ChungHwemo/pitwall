import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LiveAccounts, LiveVendor } from '../src/source/LiveSource';

export const LIVE_VENDORS: { vendor: LiveVendor; dir: string }[] = [
  { vendor: 'claude', dir: '.claude/projects' },
  { vendor: 'codex', dir: '.codex' },
  { vendor: 'grok', dir: '.grok' },
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
  try { row = JSON.parse(trimmed); } catch {
    return trimmed.length < 8_192 ? trimmed : null;
  }
  return JSON.stringify(stripBulky(row));
}

function stripBulky(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBulky);
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'content' || key === 'rawOutput' || key === 'thinking' || key === 'text') continue;
    out[key] = stripBulky(child);
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
    if (lastNl < 0) return [];
    const complete = slice.subarray(0, lastNl + 1);
    this.offsets.set(file, start + complete.length);
    return complete.toString('utf8').split('\n').map(slimLogLine).filter((l): l is string => l !== null);
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
