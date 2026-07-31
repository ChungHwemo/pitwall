import { describe, it, expect } from 'vitest';
import { LiveSource } from '../src/source/LiveSource';
import type { CarEvent } from '../src/types';

const CLAUDE_LINE = JSON.stringify({
  timestamp: '2026-07-30T21:00:00.000Z',
  sessionId: 's1',
  message: { model: 'claude-opus-5', usage: { input_tokens: 1_000, output_tokens: 200, cache_read_input_tokens: 800 } },
  attributionSkill: 'superpowers:test-driven-development',
});
const CODEX_CTX = JSON.stringify({
  timestamp: '2026-07-30T21:00:01.000Z',
  type: 'turn_context', payload: { model: 'gpt-5.6-sol' },
});
const CODEX_USAGE = JSON.stringify({
  timestamp: '2026-07-30T21:00:02.000Z',
  payload: {
    type: 'token_count',
    info: { last_token_usage: { input_tokens: 500, output_tokens: 50, cached_input_tokens: 400 } },
    rate_limits: { primary: { used_percent: 97, window_minutes: 10080, resets_at: 1785913052 } },
  },
});

function collect(src: LiveSource): CarEvent[] {
  const out: CarEvent[] = [];
  src.start((e) => out.push(e));
  src.tick(1_000);
  return out;
}

describe('LiveSource', () => {
  it('클로드 로그 한 줄을 이벤트로 바꾼다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    src.ingest('claude', [CLAUDE_LINE]);
    const out = collect(src);
    expect(out).toHaveLength(1);
    expect(out[0]!.model).toBe('claude-opus-5');
    expect(out[0]!.skill).toBe('superpowers:test-driven-development');
  });

  it('계정 uuid는 해시로만 나간다 — 원문이 이벤트에 남으면 안 된다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    src.ingest('claude', [CLAUDE_LINE]);
    const [e] = collect(src);
    expect(JSON.stringify(e)).not.toContain('uuid-a');
    expect(e!.car_id).toMatch(/^car-[0-9a-f]{8}$/);
  });

  it('코덱스는 모델을 앞선 turn_context에서 이어받는다', () => {
    const src = new LiveSource({ codexAccountId: 'acc-1' });
    src.ingest('codex', [CODEX_CTX, CODEX_USAGE]);
    const out = collect(src);
    expect(out).toHaveLength(1);
    expect(out[0]!.model).toBe('gpt-5.6-sol');
    expect(out[0]!.tyre_pct).toBe(3);
  });

  it('모델 상태는 주입 사이에도 유지된다 — tail은 줄을 나눠서 준다', () => {
    const src = new LiveSource({ codexAccountId: 'acc-1' });
    src.ingest('codex', [CODEX_CTX]);
    collect(src);
    src.ingest('codex', [CODEX_USAGE]);
    expect(collect(src)[0]!.model).toBe('gpt-5.6-sol');
  });

  it('내부 시계로 방출하되 원본 시각을 남긴다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    src.ingest('claude', [CLAUDE_LINE]);
    const [e] = collect(src);
    expect(e!.ts).toBe(1_000);
    expect(e!.wall_ts).toBe(Date.parse('2026-07-30T21:00:00.000Z'));
  });

  it('깨진 줄과 관계없는 줄은 조용히 버린다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    src.ingest('claude', ['{not json', '', JSON.stringify({ type: 'summary' })]);
    expect(collect(src)).toEqual([]);
  });

  it('한 프레임에 쏟아붓지 않는다 — 밀린 줄은 다음 프레임으로 넘긴다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' }, 2);
    src.ingest('claude', [CLAUDE_LINE, CLAUDE_LINE, CLAUDE_LINE]);
    const out: CarEvent[] = [];
    src.start((e) => out.push(e));
    src.tick(1_000);
    expect(out).toHaveLength(2);
    src.tick(1_016);
    expect(out).toHaveLength(3);
  });
});

describe('LiveSource — 계정은 나중에 온다', () => {
  it('껍데기가 알려주기 전에 온 줄도 계정이 붙은 뒤 제대로 나온다', () => {
    const src = new LiveSource();
    src.configure({ claudeAccountUuid: 'uuid-b' });
    src.ingest('claude', [CLAUDE_LINE]);
    const [e] = collect(src);
    expect(e!.car_id).toMatch(/^car-[0-9a-f]{8}$/);
    expect(JSON.stringify(e)).not.toContain('uuid-b');
  });
});

describe('LiveSource — 한도', () => {
  const LIMITS = [{
    vendor: 'claude', fetchedAt: 1_000,
    windows: [{ utilization: 38, window_minutes: 300, resets_at: '2026-07-31T01:29:59+09:00' }],
  }];

  it('벤더 한도 스냅샷을 그 벤더 이벤트에 붙인다 — 로그에 없는 값이다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'u' });
    src.setLimits(LIMITS);
    src.ingest('claude', [CLAUDE_LINE]);
    const [e] = collect(src);
    expect(e!.tyre_pct).toBe(62);
    expect(e!.limit_window_minutes).toBe(300);
    expect(e!.limit_resets_at).toBe(Date.parse('2026-07-31T01:29:59+09:00'));
    expect(e!.limit_observed_at).toBe(1_000);
  });

  it('창이 여럿이면 짧은 쪽을 쓴다 — 먼저 막는 벽이다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'u' });
    src.setLimits([{
      vendor: 'claude', fetchedAt: 1_000,
      windows: [
        { utilization: 95, window_minutes: 10080, resets_at: null },
        { utilization: 38, window_minutes: 300, resets_at: null },
      ],
    }]);
    src.ingest('claude', [CLAUDE_LINE]);
    expect(collect(src)[0]!.limit_window_minutes).toBe(300);
  });

  it('코덱스 로그가 스스로 들고 온 한도는 덮어쓰지 않는다', () => {
    const src = new LiveSource({ codexAccountId: 'a' });
    src.setLimits([{ vendor: 'codex', fetchedAt: 1, windows: [{ utilization: 10, window_minutes: 300, resets_at: null }] }]);
    src.ingest('codex', [CODEX_CTX, CODEX_USAGE]);
    // 로그의 97% 사용 → 3% 잔여가 이긴다.
    expect(collect(src)[0]!.tyre_pct).toBe(3);
  });
});
