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

export interface LimitReading {
  /** 이 값을 읽은 시각. 로그에서 주운 값은 마지막 실행 시점의 값이다 */
  ts: number;
  tyre_pct: number;
  limit_window_minutes: number;
  /** 창이 풀리는 시각. 잔여 %만으로는 기다릴지 갈아탈지 못 정한다 */
  resetsAt?: number;
}

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
  reasoning: number;
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
    tokens: {
      prompt: tokens.prompt,
      completion: tokens.completion,
      cache_read: tokens.cacheRead,
      reasoning: tokens.reasoning,
    },
    cache_hit: cacheHit,
    // 단가를 모르면 0이다. 지어내지 않는다. 추론도 출력처럼 과금되므로 비용에 넣는다.
    // prompt는 캐시를 포함하므로 신규 입력만 입력 단가로, 캐시 재전송은 캐시 단가로 친다.
    cost_usd: spec
      ? costUsd(spec, tokens.prompt - tokens.cacheRead, tokens.cacheRead, tokens.completion + tokens.reasoning)
      : 0,
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
 *
 * `rate_limits.primary`는 **실제 한도 소진율**이다. 이건 연료(비용 예산)가 아니라
 * 타이어(한도 윈도우)다 — 돈이 남았는데 한도에 걸리는 일이 실제로 일어나므로
 * 두 축을 섞으면 어느 쪽이 바닥났는지 화면이 말해주지 못한다.
 * 관측된 창은 10,080분(주간)이다. 5시간 창은 이 로그에 없다.
 */
export function codexRateLimit(raw: unknown): LimitReading | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const payload = row.payload as Record<string, unknown> | undefined;
  const primary = (payload?.rate_limits as Record<string, unknown> | undefined)?.primary as
    Record<string, number> | undefined;
  if (typeof primary?.used_percent !== 'number') return null;

  const ts = Date.parse(String(row.timestamp ?? ''));
  if (!Number.isFinite(ts)) return null;

  return {
    ts,
    tyre_pct: Math.max(0, 100 - primary.used_percent),
    limit_window_minutes: primary.window_minutes ?? 0,
    // Codex는 epoch 초로 준다.
    resetsAt: typeof primary.resets_at === 'number' ? primary.resets_at * 1000 : undefined,
  };
}

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

  const limit = codexRateLimit(raw);

  return build(ctx, ts, {
    prompt: u.input_tokens ?? 0,
    // 추론 토큰은 출력과 나눠 담는다 — 둘 다 출력으로 과금되지만 하나는 전달된
    // 응답이고 하나는 내부 추론이라 섞으면 무엇을 돌려받았는지 흐려진다.
    completion: Math.max(0, (u.output_tokens ?? 0) - (u.reasoning_output_tokens ?? 0)),
    reasoning: u.reasoning_output_tokens ?? 0,
    cacheRead: u.cached_input_tokens ?? 0,
  }, limit === null ? {} : {
    tyre_pct: limit.tyre_pct,
    limit_window_minutes: limit.limit_window_minutes || undefined,
  });
}

/**
 * Grok — `_x.ai/session/update` (`params.update.usage`).
 *
 * 공식 grok CLI의 실시간 로그(`~/.grok/sessions/` 아래 `updates.jsonl`)이다. 턴이
 * 끝날 때 한 줄씩 쓰이고, `modelCalls`만큼의 모델 호출이 **한 줄에 합쳐져** 있다
 * — 토큰·비용은 정확하지만 이벤트 하나가 곧 호출 하나는 아니다 (CallEvent 셈에서
 * Grok 호출 수는 과소 집계된다. Copilot과 같은 한계).
 *
 * `inputTokens`는 캐시 읽기를 포함하고 `outputTokens`는 추론을 포함한다. 화면 계약은
 * 캐시·추론을 별도 축으로 보여주므로 둘을 각각 원래 합계에서 빼서 나눠 담는다.
 */
export function grokEvent(raw: unknown, ctx: LogContext): CarEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  // 루프마다 unified.jsonl 에 찍힌다. 턴 종료(_x.ai turn_completed)만 보면
  // 지금 도는 세션이 화면에 안 나온다.
  if (row.msg === 'shell.turn.inference_done') {
    const loop = row.ctx;
    if (typeof loop !== 'object' || loop === null) return null;
    const c = loop as Record<string, unknown>;
    const prompt = c.prompt_tokens;
    const completion = c.completion_tokens;
    if (typeof prompt !== 'number' || typeof completion !== 'number') return null;
    const reasoning = typeof c.reasoning_tokens === 'number' ? c.reasoning_tokens : 0;
    const cacheRead = typeof c.cached_prompt_tokens === 'number' ? c.cached_prompt_tokens : 0;
    const ts = Date.parse(String(row.ts ?? ''));
    if (!Number.isFinite(ts)) return null;
    return build(
      { ...ctx, sessionId: typeof row.sid === 'string' ? row.sid : ctx.sessionId },
      ts,
      {
        prompt,
        completion: Math.max(0, completion - reasoning),
        reasoning,
        cacheRead,
      },
      { latency_ms: typeof c.model_elapsed_ms === 'number' ? c.model_elapsed_ms : 0 },
    );
  }

  if (row.method !== '_x.ai/session/update' && row.method !== 'session/update') return null;

  const params = row.params as Record<string, unknown> | undefined;
  const usage = (params?.update as Record<string, unknown> | undefined)?.usage as
    Record<string, number> | undefined;
  if (!usage) return null;

  const ts = Number(row.timestamp) * 1000;
  if (!Number.isFinite(ts)) return null;

  // 이 턴에 실제 쓴 모델이 usage.modelUsage에 있다. ctx.model보다 정확하다.
  const modelUsage = usage.modelUsage as Record<string, unknown> | undefined;
  const usedModel = modelUsage ? Object.keys(modelUsage)[0] : undefined;

  return build(
    {
      ...ctx,
      model: typeof usedModel === 'string' ? usedModel : ctx.model,
      sessionId: typeof params?.sessionId === 'string' ? params.sessionId : ctx.sessionId,
    },
    ts,
    {
      prompt: usage.inputTokens ?? 0,
      completion: Math.max(0, (usage.outputTokens ?? 0) - (usage.reasoningTokens ?? 0)),
      reasoning: usage.reasoningTokens ?? 0,
      cacheRead: usage.cachedReadTokens ?? 0,
    },
    { latency_ms: usage.apiDurationMs ?? 0 },
  );
}

/**
 * Grok — `billing: fetched credits config`.
 *
 * 호출 로그가 아니라 별도의 청구 조회 줄이다. Codex처럼 호출마다 딸려오지 않아
 * 가끔 한 번씩만 찍힌다 — 그래서 이벤트가 아니라 **시각이 붙은 판독값**을 돌려주고,
 * 호출에 붙이는 일은 호출자가 한다.
 *
 * 창 길이는 `type` 문자열이 아니라 기간 자체에서 잰다. 레이블은 바뀔 수 있지만
 * start→end는 실제 값이다.
 */
export function grokCredits(raw: unknown): LimitReading | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (row.msg !== 'billing: fetched credits config') return null;

  const config = (row.ctx as Record<string, unknown> | undefined)?.config as
    Record<string, unknown> | undefined;
  const used = config?.creditUsagePercent;
  const period = config?.currentPeriod as Record<string, string> | undefined;
  if (typeof used !== 'number' || !period) return null;

  const ts = Date.parse(String(row.ts ?? ''));
  const start = Date.parse(period.start ?? '');
  const end = Date.parse(period.end ?? '');
  if (!Number.isFinite(ts) || !Number.isFinite(start) || !Number.isFinite(end)) return null;

  return {
    ts,
    tyre_pct: Math.max(0, 100 - used),
    limit_window_minutes: Math.round((end - start) / 60_000),
    // 청구 기간이 끝날 때 크레딧이 돌아온다.
    resetsAt: end,
  };
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
      completion: u.outputTokens ?? 0,
      reasoning: u.reasoningTokens ?? 0,
      cacheRead: u.cacheReadTokens ?? 0,
    })];
  });
}
