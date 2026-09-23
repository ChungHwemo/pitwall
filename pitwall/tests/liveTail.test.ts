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

  it('사용량 키가 아닌 문장과 JSON이 아닌 줄은 버린다', () => {
    const slim = slimLogLine(JSON.stringify({
      usage: { input_tokens: 4 },
      prompt: 'SECRET',
      command: 'rm -rf',
      cwd: '/Users/secret',
    }));
    expect(slim).not.toContain('SECRET');
    expect(slim).not.toContain('rm -rf');
    expect(slim).not.toContain('/Users/secret');
    expect(slim).toContain('input_tokens');
    expect(slimLogLine('not json but short')).toBeNull();
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

  it('개행 없는 완전한 JSON은 한 번만 넘기고 개행이 와도 다시 세지 않는다', () => {
    const home = join(tmpdir(), `pw-live-partial-${process.pid}-${Date.now()}`);
    const dir = join(home, '.copilot', 'sessions');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'session.jsonl');
    const now = Date.now();
    const done = (n: number): string => JSON.stringify({
      type: 'session.shutdown',
      data: { sessionStartTime: now, modelMetrics: { 'gpt-5.4': { usage: { inputTokens: n, outputTokens: 1 } } } },
    });
    writeFileSync(file, `${done(1)}\n`);
    const tail = new LiveTail({ home, backfillMs: 15 * 60_000, now: () => now });
    tail.poll();
    writeFileSync(file, `${done(1)}\n${done(2)}`, { flag: 'w' });
    const partial = tail.poll().find((b) => b.vendor === 'copilot');
    expect(partial?.lines.join(' ')).toContain('"inputTokens":2');
    expect(tail.poll().find((b) => b.vendor === 'copilot')).toBeUndefined();
    writeFileSync(file, `${done(1)}\n${done(2)}\n${done(3)}\n`);
    const rest = tail.poll().find((b) => b.vendor === 'copilot');
    const lines = rest?.lines ?? [];
    expect(lines.filter((line) => line.includes('"inputTokens":2'))).toHaveLength(0);
    expect(lines.filter((line) => line.includes('"inputTokens":3'))).toHaveLength(1);
  });
});
