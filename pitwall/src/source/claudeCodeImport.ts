import type { CarEvent } from '../types';
import { specOf, classOfModel, costUsd } from '../config/models';

/**
 * Claude Code 트랜스크립트 한 줄 → `CarEvent`.
 *
 * 시뮬레이터가 아니라 **실제 사용 기록**을 같은 계약으로 옮긴다. A5("가짜 데이터로 만든
 * 로직은 실데이터에서 안 굴러간다")를 실제로 검증하는 경로다.
 *
 * **본문을 가져오지 않는다.** 트랜스크립트에는 프롬프트·응답 전문(`message.content`),
 * 작업 경로(`cwd`), git 브랜치가 함께 들어 있다. LiteLLM의 `messages`/`response`
 * 컬럼과 같은 상황이며, 대응도 같다 — 아래 화이트리스트 밖은 읽지 않는다 (PRIV-4·PRIV-8).
 *
 * **차량 = 프로젝트.** 1인 기기라 사람으로 나눌 수 없다. 작업 디렉터리를 차량으로 삼되
 * 경로 원문은 버리고 해시만 남긴다 (PRIV-3).
 */

/** 이 줄에서 읽는 필드. 여기 없는 것은 존재해도 만지지 않는다. */
const ALLOWED = ['timestamp', 'sessionId', 'cwd', 'message.model', 'message.usage'] as const;
export const ALLOWED_FIELDS: readonly string[] = ALLOWED;

/** 배포마다 다른 값을 써야 경로 → 차량 매핑이 고정되지 않는다. */
export const CAR_SALT = 'pitwall-local';

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function toCarEvent(raw: unknown, salt: string = CAR_SALT): CarEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const message = row.message as Record<string, unknown> | undefined;
  const usage = message?.usage as Usage | undefined;
  if (!usage) return null;

  const ts = Date.parse(String(row.timestamp ?? ''));
  if (!Number.isFinite(ts)) return null;

  const model = typeof message?.model === 'string' ? message.model : 'unknown';
  const prompt = (usage.input_tokens ?? 0)
    + (usage.cache_read_input_tokens ?? 0)
    + (usage.cache_creation_input_tokens ?? 0);
  const completion = usage.output_tokens ?? 0;
  const cacheHit = (usage.cache_read_input_tokens ?? 0) > 0;

  // 경로 원문은 여기서 끝난다. 해시만 밖으로 나간다.
  const digest = hash(`${salt}:${String(row.cwd ?? 'unknown')}`);
  const carId = `car-${digest.toString(16).padStart(8, '0').slice(0, 8)}`;

  const spec = specOf(model);

  return {
    ts,
    car_id: carId,
    car_number: (digest % 999) + 1,
    // 모르는 모델은 클래스를 추측하지 않는다. 가장 흔한 주력 클래스로 둔다.
    car_class: classOfModel(model) ?? 'P',
    model,
    kind: 'call',
    session_id: typeof row.sessionId === 'string' ? row.sessionId : undefined,
    tokens: { prompt, completion },
    cache_hit: cacheHit,
    // 단가를 모르면 0이다. 지어내지 않는다.
    cost_usd: spec ? costUsd(spec, prompt, completion, cacheHit) : 0,
    latency_ms: 0,
    status: 'ok',
    fuel_pct: 100,
    // 타이어는 소스가 없다 (PRD §7.0).
  };
}
