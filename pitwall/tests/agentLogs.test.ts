import { describe, it, expect } from 'vitest';
import { codexEvent, codexRateLimit, grokEvent, grokCredits, copilotEvents, accountCar } from '../src/source/agentLogs';
import { workOf, cachedOf } from '../src/state/reducer';

describe('accountCar', () => {
  it('벤더가 다르면 다른 차량이다', () => {
    expect(accountCar('codex', 'acct-1').car_id).not.toBe(accountCar('grok', 'acct-1').car_id);
  });

  it('같은 벤더·계정이면 같은 차량이다', () => {
    expect(accountCar('codex', 'a').car_id).toBe(accountCar('codex', 'a').car_id);
  });

  it('원본 계정 식별자를 담지 않는다', () => {
    const car = accountCar('codex', 'super-secret-account-id');
    expect(JSON.stringify(car)).not.toContain('super-secret-account-id');
  });

  it('카넘버가 1..999다', () => {
    for (const v of ['codex', 'grok', 'copilot', 'claude']) {
      const n = accountCar(v, 'x').car_number;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(999);
    }
  });
});

const CAR = accountCar('codex', 'acct');

describe('codexEvent', () => {
  const row = {
    timestamp: '2026-07-30T09:02:18.426Z',
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: 25153, cached_input_tokens: 6912,
          cache_write_input_tokens: 0, output_tokens: 520, reasoning_output_tokens: 201,
        },
      },
      rate_limits: { primary: { used_percent: 72, window_minutes: 10080 } },
    },
  };

  it('token_count를 CarEvent로 옮긴다', () => {
    const e = codexEvent(row, { car: CAR, model: 'gpt-5.6-luna', sessionId: 's1' })!;
    expect(e.model).toBe('gpt-5.6-luna');
    expect(e.ts).toBe(Date.parse('2026-07-30T09:02:18.426Z'));
  });

  it('추론 토큰을 출력에 합산한다 — 과금 대상이다', () => {
    const e = codexEvent(row, { car: CAR, model: 'gpt-5.6-luna' })!;
    expect(e.tokens.completion).toBe(520 + 201);
  });

  it('캐시 읽기를 분리해 담는다', () => {
    const e = codexEvent(row, { car: CAR, model: 'gpt-5.6-luna' })!;
    expect(e.tokens.cache_read).toBe(6912);
    expect(workOf(e)).toBe(25153 - 6912 + 721);
    expect(cachedOf(e)).toBe(6912);
  });

  it('실제 한도 소진율은 타이어다 — 연료(비용 예산)와 다른 축이다', () => {
    // 연료 = 돈, 타이어 = 한도 윈도우. 둘을 섞으면 어느 쪽이 바닥났는지 못 읽는다.
    const e = codexEvent(row, { car: CAR, model: 'gpt-5.6-luna' })!;
    expect(e.tyre_pct).toBe(28);
    expect(e.fuel_pct).toBe(100);
  });

  it('한도 정보가 없으면 타이어를 그리지 않는다 — 0으로 두지 않는다', () => {
    const noLimit = { ...row, payload: { ...row.payload, rate_limits: undefined } };
    expect(codexEvent(noLimit, { car: CAR, model: 'gpt-5.6-luna' })!.tyre_pct).toBeUndefined();
  });

  it('한도 윈도우 길이를 함께 담는다 — 5시간인지 일주일인지 구분해야 한다', () => {
    expect(codexEvent(row, { car: CAR, model: 'gpt-5.6-luna' })!.limit_window_minutes).toBe(10080);
  });

  it('token_count가 아닌 줄은 건너뛴다', () => {
    expect(codexEvent({ type: 'event_msg', payload: { type: 'other' } }, { car: CAR })).toBeNull();
  });
});

describe('grokEvent', () => {
  const row = {
    ts: '2026-07-10T14:40:56.321Z',
    msg: 'shell.turn.inference_done',
    sid: 'sess-9',
    ctx: {
      prompt_tokens: 48229, cached_prompt_tokens: 26368,
      completion_tokens: 541, reasoning_tokens: 427,
      ttft_ms: 4842, model_elapsed_ms: 22393,
    },
  };

  it('추론 완료를 CarEvent로 옮긴다', () => {
    const e = grokEvent(row, { car: CAR, model: 'grok-4.5' })!;
    expect(e.model).toBe('grok-4.5');
    expect(e.tokens.prompt).toBe(48229);
    expect(e.tokens.cache_read).toBe(26368);
    expect(e.tokens.completion).toBe(541 + 427);
  });

  it('지연과 TTFT를 담는다', () => {
    const e = grokEvent(row, { car: CAR, model: 'grok-4.5' })!;
    expect(e.latency_ms).toBe(22393);
    expect(e.ttft_ms).toBe(4842);
  });

  it('다른 이벤트는 건너뛴다', () => {
    expect(grokEvent({ msg: 'turn.phase_transition', ts: row.ts }, { car: CAR })).toBeNull();
  });
});

describe('copilotEvents', () => {
  const row = {
    type: 'session.shutdown',
    data: {
      sessionStartTime: 1778169277217,
      modelMetrics: {
        'gpt-5.4': { usage: { inputTokens: 16936, outputTokens: 95, cacheReadTokens: 1536, reasoningTokens: 85 } },
        'claude-haiku-4.5': { usage: { inputTokens: 500, outputTokens: 20, cacheReadTokens: 0 } },
      },
    },
  };

  it('모델마다 이벤트 하나씩 낸다 — 세션 집계라 호출 단위가 아니다', () => {
    const events = copilotEvents(row, { car: CAR });
    expect(events.map((e) => e.model).sort()).toEqual(['claude-haiku-4.5', 'gpt-5.4']);
  });

  it('추론 토큰을 출력에 합산한다', () => {
    const e = copilotEvents(row, { car: CAR }).find((x) => x.model === 'gpt-5.4')!;
    expect(e.tokens.completion).toBe(95 + 85);
    expect(e.tokens.cache_read).toBe(1536);
  });

  it('세션 시작 시각을 쓴다', () => {
    expect(copilotEvents(row, { car: CAR })[0]!.ts).toBe(1778169277217);
  });

  it('다른 이벤트는 빈 배열이다', () => {
    expect(copilotEvents({ type: 'session.start' }, { car: CAR })).toEqual([]);
  });
});

describe('grokCredits', () => {
  const line = {
    ts: '2026-07-24T08:03:43.432Z',
    msg: 'billing: fetched credits config',
    ctx: {
      config: {
        creditUsagePercent: 52,
        currentPeriod: {
          type: 'USAGE_PERIOD_TYPE_WEEKLY',
          start: '2026-07-17T14:13:14.612417+00:00',
          end: '2026-07-24T14:13:14.612417+00:00',
        },
      },
    },
  };

  it('reads the remaining share of the credit window', () => {
    expect(grokCredits(line)).toEqual({
      ts: Date.parse('2026-07-24T08:03:43.432Z'),
      tyre_pct: 48,
      limit_window_minutes: 10080,
      resetsAt: Date.parse('2026-07-24T14:13:14.612417+00:00'),
    });
  });

  it('derives the window from the period, not from its label', () => {
    const monthly = {
      ...line,
      ctx: { config: { ...line.ctx.config, currentPeriod: {
        type: 'USAGE_PERIOD_TYPE_MONTHLY',
        start: '2026-07-01T00:00:00+00:00',
        end: '2026-07-31T00:00:00+00:00',
      } } },
    };
    expect(grokCredits(monthly)?.limit_window_minutes).toBe(30 * 24 * 60);
  });

  it('ignores every other log line', () => {
    expect(grokCredits({ msg: 'shell.turn.inference_done', ctx: {} })).toBeNull();
  });
});

describe('codexRateLimit', () => {
  const line = {
    timestamp: '2026-07-30T09:22:46.109Z',
    payload: {
      type: 'token_count',
      rate_limits: { primary: { used_percent: 97, window_minutes: 10080, resets_at: 1785913052 } },
    },
  };

  it('가장 최근 판독을 시각과 함께 돌려준다', () => {
    expect(codexRateLimit(line)).toEqual({
      ts: Date.parse('2026-07-30T09:22:46.109Z'),
      tyre_pct: 3,
      limit_window_minutes: 10080,
      resetsAt: 1785913052 * 1000,
    });
  });

  it('한도가 없는 줄은 무시한다', () => {
    expect(codexRateLimit({ timestamp: line.timestamp, payload: { type: 'token_count' } })).toBeNull();
  });
});

describe('한도 판독의 리셋 시각', () => {
  it('Codex는 epoch 초로 리셋을 준다', () => {
    const r = codexRateLimit({
      timestamp: '2026-07-30T09:22:46.109Z',
      payload: { type: 'token_count', rate_limits: {
        primary: { used_percent: 97, window_minutes: 10080, resets_at: 1785913052 } } },
    });
    expect(r?.resetsAt).toBe(1785913052 * 1000);
  });

  it('Grok은 청구 기간 끝이 리셋이다', () => {
    const r = grokCredits({
      ts: '2026-07-24T08:03:43.432Z',
      msg: 'billing: fetched credits config',
      ctx: { config: { creditUsagePercent: 52, currentPeriod: {
        type: 'USAGE_PERIOD_TYPE_WEEKLY',
        start: '2026-07-17T14:13:14.612417+00:00',
        end: '2026-07-24T14:13:14.612417+00:00' } } },
    });
    expect(r?.resetsAt).toBe(Date.parse('2026-07-24T14:13:14.612417+00:00'));
  });
});
