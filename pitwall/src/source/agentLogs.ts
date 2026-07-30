import type { CarClass, CarEvent } from '../types';
import { specOf, classOfModel, costUsd } from '../config/models';

/**
 * 코딩 에이전트 로그 → `CarEvent`.
 *
 * Claude Code 외에 Codex·Grok·Copilot도 로컬에 사용 기록을 남긴다. 형식은 제각각이지만
 * 담긴 사실은 같다 — 언제, 어떤 모델로, 토큰을 얼마나 썼는가.
 *
 * **차량 = 계정.** 벤더가 다르면 계정도 다르므로 트랙 위 다른 차다. 그래야
 * "어떤 계정이 어떤 에이전트로 무엇을 돌리는가"를 나란히 볼 수 있다.
 *
 * 원본 계정 식별자와 토큰은 여기서 끝난다. 밖으로 나가는 것은 해시뿐이다 (PRIV-3).
 */

export interface CarIdentity {
  car_id: string;
  car_number: number;
}

export interface LogContext {
  car: CarIdentity;
  model?: string;
  sessionId?: string;
}

const SALT = 'pitwall-local';

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 벤더 + 계정 → 차량. 원본 식별자는 해시로만 남는다. */
export function accountCar(vendor: string, accountId: string): CarIdentity {
  const digest = hash(`${SALT}:${vendor}:${accountId}`);
  return {
    car_id: `car-${digest.toString(16).padStart(8, '0').slice(0, 8)}`,
    car_number: (digest % 999) + 1,
  };
}

interface Tokens {
  prompt: number;
  completion: number;
  cacheRead: number;
}

function build(
  ctx: LogContext, ts: number, tokens: Tokens,
  extra: Partial<CarEvent> = {},
): CarEvent {
  const model = ctx.model ?? 'unknown';
  const spec = specOf(model);
  const cacheHit = tokens.cacheRead > 0;

  return {
    ts,
    car_id: ctx.car.car_id,
    car_number: ctx.car.car_number,
    // 모르는 모델은 클래스를 추측하지 않는다. 주력 클래스로 둔다.
    car_class: (classOfModel(model) ?? 'P') as CarClass,
    model,
    kind: 'call',
    session_id: ctx.sessionId,
    tokens: { prompt: tokens.prompt, completion: tokens.completion, cache_read: tokens.cacheRead },
    cache_hit: cacheHit,
    // 단가를 모르면 0이다. 지어내지 않는다.
    cost_usd: spec ? costUsd(spec, tokens.prompt, tokens.completion, cacheHit) : 0,
    latency_ms: 0,
    status: 'ok',
    fuel_pct: 100,
    ...extra,
  };
}

/**
 * Codex — `event_msg` / `token_count`.
 *
 * `last_token_usage`가 이번 호출분이다. `total_token_usage`는 누적이라 쓰면 이중 계산된다.
 * `rate_limits.primary.used_percent`는 **실제 한도 소진율**이라 연료가 추정이 아니다.
 */
export function codexEvent(raw: unknown, ctx: LogContext): CarEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const payload = row.payload as Record<string, unknown> | undefined;
  if (payload?.type !== 'token_count') return null;

  const info = payload.info as Record<string, unknown> | undefined;
  const u = info?.last_token_usage as Record<string, number> | undefined;
  if (!u) return null;

  const ts = Date.parse(String(row.timestamp ?? ''));
  if (!Number.isFinite(ts)) return null;

  const limits = payload.rate_limits as Record<string, unknown> | undefined;
  const primary = limits?.primary as Record<string, number> | undefined;
  const used = typeof primary?.used_percent === 'number' ? primary.used_percent : null;

  return build(ctx, ts, {
    prompt: u.input_tokens ?? 0,
    // 추론 토큰도 출력으로 과금된다.
    completion: (u.output_tokens ?? 0) + (u.reasoning_output_tokens ?? 0),
    cacheRead: u.cached_input_tokens ?? 0,
  }, { fuel_pct: used === null ? 100 : Math.max(0, 100 - used) });
}

/** Grok — `shell.turn.inference_done`. 호출 하나당 한 줄이고 지연·TTFT까지 있다. */
export function grokEvent(raw: unknown, ctx: LogContext): CarEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (row.msg !== 'shell.turn.inference_done') return null;

  const c = row.ctx as Record<string, number> | undefined;
  if (!c) return null;

  const ts = Date.parse(String(row.ts ?? ''));
  if (!Number.isFinite(ts)) return null;

  return build(
    { ...ctx, sessionId: typeof row.sid === 'string' ? row.sid : ctx.sessionId },
    ts,
    {
      prompt: c.prompt_tokens ?? 0,
      completion: (c.completion_tokens ?? 0) + (c.reasoning_tokens ?? 0),
      cacheRead: c.cached_prompt_tokens ?? 0,
    },
    { latency_ms: c.model_elapsed_ms ?? 0, ttft_ms: c.ttft_ms },
  );
}

/**
 * Copilot — `session.shutdown`의 `modelMetrics`.
 *
 * **세션 집계라 호출 단위가 아니다.** 모델마다 이벤트 하나를 내되, 이 한계를
 * 잊지 않도록 여기 적어둔다 — Copilot 차량의 호출 수는 실제 호출 수가 아니다.
 */
export function copilotEvents(raw: unknown, ctx: LogContext): CarEvent[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const row = raw as Record<string, unknown>;
  if (row.type !== 'session.shutdown') return [];

  const data = row.data as Record<string, unknown> | undefined;
  const metrics = data?.modelMetrics as Record<string, { usage?: Record<string, number> }> | undefined;
  if (!metrics) return [];

  const ts = typeof data?.sessionStartTime === 'number' ? data.sessionStartTime : NaN;
  if (!Number.isFinite(ts)) return [];

  return Object.entries(metrics).flatMap(([model, entry]) => {
    const u = entry?.usage;
    if (!u) return [];
    return [build({ ...ctx, model }, ts, {
      prompt: u.inputTokens ?? 0,
      completion: (u.outputTokens ?? 0) + (u.reasoningTokens ?? 0),
      cacheRead: u.cacheReadTokens ?? 0,
    })];
  });
}
