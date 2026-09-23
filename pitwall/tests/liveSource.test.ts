import { describe, it, expect } from 'vitest';
import { LiveSource } from '../src/source/LiveSource';
import { providerOfModel } from '../src/config/models';
import type { CarEvent } from '../src/types';

const CLAUDE_LINE = JSON.stringify({
  timestamp: '2026-07-30T21:00:00.000Z',
  sessionId: 's1',
  message: { id: 'msg-1', model: 'claude-opus-5', usage: { input_tokens: 1_000, output_tokens: 200, cache_read_input_tokens: 800 } },
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

// 실측 형태: 최상위 model_id + shell.turn.inference_done, ctx엔 모델 필드 없음.
const GROK_BUILD_LINE = JSON.stringify({
  timestamp: 1786085851,
  method: '_x.ai/session/update',
  params: {
    sessionId: 'grok-sess-1',
    update: {
      sessionUpdate: 'turn_completed',
      usage: {
        inputTokens: 1_200, outputTokens: 88,
        cachedReadTokens: 400, reasoningTokens: 20,
        modelCalls: 1, apiDurationMs: 2_200,
        modelUsage: { 'grok-4.5-build': {} },
      },
    },
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

  it('같은 Claude 응답이 트랜스크립트에 반복돼도 사용량은 한 번만 센다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    src.ingest('claude', [CLAUDE_LINE, CLAUDE_LINE]);
    expect(collect(src)).toHaveLength(1);
  });

  it('같은 id가 부분 사용량으로 시작해 완전 사용량으로 끝나면 최종 행이 이긴다', () => {
    // 실측 계약: Claude Code는 같은 message.id를 스트림 누적으로 여러 번 쓴다 (output 1→577).
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    const partial = JSON.stringify({
      timestamp: '2026-07-30T21:00:00.000Z',
      sessionId: 's1',
      message: { id: 'msg-1', model: 'claude-opus-5', usage: { input_tokens: 1_000, output_tokens: 1, cache_read_input_tokens: 800 } },
      attributionSkill: 'superpowers:test-driven-development',
    });
    src.ingest('claude', [partial, CLAUDE_LINE]);
    const out = collect(src);
    expect(out).toHaveLength(1);
    expect(out[0]!.tokens.completion).toBe(200);
    expect(out[0]!.tokens.prompt).toBe(1_800);
  });

  it('사용량 없는 같은 id 줄은 뒤의 유효한 Claude 응답을 막지 않는다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    const metadata = JSON.stringify({ message: { id: 'msg-1', model: 'claude-opus-5' } });
    src.ingest('claude', [metadata, CLAUDE_LINE]);
    expect(collect(src)).toHaveLength(1);
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

  it('같은 id가 다음 tick에 커져도 증가분만큼만 더한다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' });
    const partial = JSON.stringify({
      timestamp: '2026-07-30T21:00:00.000Z',
      sessionId: 's1',
      message: { id: 'msg-1', model: 'claude-opus-5', usage: { input_tokens: 200, output_tokens: 1, cache_read_input_tokens: 800 } },
    });
    src.ingest('claude', [partial]);
    const first = collect(src);
    src.ingest('claude', [CLAUDE_LINE]);
    const second = collect(src);
    const completion = [...first, ...second].reduce((sum, e) => sum + e.tokens.completion, 0);
    const cache = [...first, ...second].reduce((sum, e) => sum + (e.tokens.cache_read ?? 0), 0);
    expect(completion).toBe(200);
    expect(cache).toBe(800);
  });

  it('한 프레임에 쏟아붓지 않는다 — 밀린 줄은 다음 프레임으로 넘긴다', () => {
    const src = new LiveSource({ claudeAccountUuid: 'uuid-a' }, 2);
    const claude = (id: string) => CLAUDE_LINE.replace('msg-1', id);
    src.ingest('claude', [claude('msg-1'), claude('msg-2'), claude('msg-3')]);
    const out: CarEvent[] = [];
    src.start((e) => out.push(e));
    src.tick(1_000);
    expect(out).toHaveLength(2);
    src.tick(1_016);
    expect(out).toHaveLength(3);
  });

  it('65개 이벤트는 한 tick 뒤 실제 pending 1을 노출한다', () => {
    const src = new LiveSource({ codexAccountId: 'acc-1' });
    src.ingest('codex', [CODEX_CTX, ...Array(65).fill(CODEX_USAGE)]);
    src.start(() => undefined);
    src.tick(1_000);
    expect(src.pending).toBe(1);
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

describe('LiveSource — Grok 최상위 model_id', () => {
  it('ctx에 모델이 없어도 최상위 model_id로 이벤트 모델을 채우고 공급자가 xai로 해소된다', () => {
    const src = new LiveSource();
    src.ingest('grok', [GROK_BUILD_LINE]);
    const out = collect(src);
    expect(out).toHaveLength(1);
    expect(out[0]!.model).toBe('grok-4.5-build');
    expect(providerOfModel(out[0]!.model)).toBe('xai');
  });

  it('unified inference_done 은 앞선 청크의 modelId 를 이어받아 루프마다 이벤트를 낸다', () => {
    const meta = JSON.stringify({
      method: 'session/update',
      params: { _meta: { modelId: 'grok-4.6' }, update: { sessionUpdate: 'agent_thought_chunk' } },
    });
    const loop = JSON.stringify({
      ts: '2026-08-22T11:30:20.952Z',
      msg: 'shell.turn.inference_done',
      sid: 'sess-now',
      ctx: { prompt_tokens: 100, cached_prompt_tokens: 80, completion_tokens: 10, reasoning_tokens: 4 },
    });
    const src = new LiveSource();
    src.ingest('grok', [meta, loop]);
    const out = collect(src);
    expect(out).toHaveLength(1);
    expect(out[0]!.model).toBe('grok-4.6');
    expect(out[0]!.tokens.prompt).toBe(100);
    expect(providerOfModel(out[0]!.model)).toBe('xai');
  });

  it('같은 세션의 턴 종료는 이미 센 루프를 다시 더하지 않는다', () => {
    const loop = JSON.stringify({
      ts: '2026-08-22T11:30:20.952Z',
      msg: 'shell.turn.inference_done',
      sid: 'sess-now',
      ctx: { prompt_tokens: 100, cached_prompt_tokens: 80, completion_tokens: 10, reasoning_tokens: 0 },
    });
    const turn = JSON.stringify({
      timestamp: 1786085851,
      method: '_x.ai/session/update',
      params: {
        sessionId: 'sess-now',
        update: {
          sessionUpdate: 'turn_completed',
          usage: {
            inputTokens: 100, outputTokens: 10, cachedReadTokens: 80, reasoningTokens: 0,
            modelUsage: { 'grok-4.6': {} },
          },
        },
      },
    });
    const src = new LiveSource();
    src.ingest('grok', [loop]);
    const first = collect(src);
    src.ingest('grok', [turn, turn]);
    const second = collect(src);
    const prompt = [...first, ...second].reduce((sum, e) => sum + e.tokens.prompt, 0);
    const cache = [...first, ...second].reduce((sum, e) => sum + (e.tokens.cache_read ?? 0), 0);
    expect(prompt).toBe(100);
    expect(cache).toBe(80);
  });

  it('청구 줄을 읽은 뒤에만 Grok 한도를 붙이고, 없으면 게이지를 짓지 않는다', () => {
    const credit = JSON.stringify({
      ts: '2026-07-24T08:03:43.432Z',
      msg: 'billing: fetched credits config',
      ctx: {
        config: {
          creditUsagePercent: 52,
          currentPeriod: {
            start: '2026-07-17T14:13:14.612417+00:00',
            end: '2026-07-24T14:13:14.612417+00:00',
          },
        },
      },
    });
    const loop = JSON.stringify({
      ts: '2026-08-22T11:30:20.952Z',
      msg: 'shell.turn.inference_done',
      sid: 'sess-now',
      ctx: { prompt_tokens: 100, cached_prompt_tokens: 80, completion_tokens: 10, reasoning_tokens: 0 },
    });
    const bare = new LiveSource();
    bare.ingest('grok', [loop]);
    expect(collect(bare)[0]!.tyre_pct).toBeUndefined();
    const src = new LiveSource();
    src.ingest('grok', [credit, loop]);
    const [event] = collect(src);
    expect(event!.tyre_pct).toBe(48);
    expect(event!.limit_window_minutes).toBe(10_080);
    expect(event!.limit_observed_at).toBe(Date.parse('2026-07-24T08:03:43.432Z'));
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
