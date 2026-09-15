import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveTail, slimLogLine } from '../scripts/liveTail';

function inference(ts: string, prompt: number): string {
  return JSON.stringify({
    msg: 'shell.turn.inference_done',
    ts,
    sid: 's1',
    ctx: { prompt_tokens: prompt, completion_tokens: 20, reasoning_tokens: 0, cached_prompt_tokens: 0 },
  });
}

describe('LiveTail', () => {
  it('본문 필드를 버린다', () => {
    const slim = slimLogLine(JSON.stringify({ msg: 'x', content: 'SECRET', prompt_tokens: 3 }));
    expect(slim).not.toContain('SECRET');
    expect(slim).toContain('prompt_tokens');
  });

  it('최근 15분 inference_done 만 백필한다', () => {
    const home = join(tmpdir(), `pw-live-${process.pid}-${Date.now()}`);
    const dir = join(home, '.grok', 'sessions', 's');
    mkdirSync(dir, { recursive: true });
    const now = Date.now();
    writeFileSync(join(dir, 'unified.jsonl'), [
      inference(new Date(now - 3 * 3_600_000).toISOString(), 111),
      inference(new Date(now - 60_000).toISOString(), 222),
      '',
    ].join('\n'));
    const tail = new LiveTail({ home, backfillMs: 15 * 60_000, now: () => now });
    const batch = tail.poll();
    const grok = batch.find((b) => b.vendor === 'grok');
    expect(grok?.lines.join(' ')).toContain('222');
    expect(grok?.lines.join(' ')).not.toContain('111');
  });
});
