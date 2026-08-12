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
 * **차량 = 계정.** 화면이 답해야 하는 질문이 "어떤 계정이 어떤 에이전트로 무엇을 돌리는가"라서
 * 트랙 위 한 대는 계정 하나다. 계정 uuid는 솔트 해시로만 남기고 이메일은 아예 읽지 않는다 (PRIV-3).
 */

/** 이 줄에서 읽는 필드. 여기 없는 것은 존재해도 만지지 않는다. */
const ALLOWED = [
  'timestamp', 'sessionId', 'message.model', 'message.usage',
  'account.accountUuid', 'attributionAgent', 'attributionSkill', 'isSidechain',
  'isApiErrorMessage', 'error', 'apiErrorStatus',
] as const;
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
  // Claude Code가 API를 부르지 않고 자체 생성한 줄이다. 호출로 세면 차가
  // 존재하지 않은 일을 한 것이 된다.
  if (model === '<synthetic>') return null;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const prompt = (usage.input_tokens ?? 0) + cacheRead + (usage.cache_creation_input_tokens ?? 0);
  const completion = usage.output_tokens ?? 0;
  const cacheHit = cacheRead > 0;

  // 계정 uuid는 여기서 끝난다. 해시만 밖으로 나간다. 이메일은 읽지도 않는다.
  const account = row.account as Record<string, unknown> | undefined;
  const accountId = typeof account?.accountUuid === 'string' ? account.accountUuid : 'unknown';
  const digest = hash(`${salt}:${accountId}`);
  const carId = `car-${digest.toString(16).padStart(8, '0').slice(0, 8)}`;

  const spec = specOf(model);

  // 실제 API 에러를 그대로 옮긴다. 시뮬레이터의 확률 에러와 달리 관측된 사실이다.
  const failed = row.isApiErrorMessage === true;
  const errorCode = failed
    ? (typeof row.error === 'string' ? row.error : String(row.apiErrorStatus ?? 'unknown'))
    : undefined;

  return {
    ts,
    car_id: carId,
    car_number: (digest % 999) + 1,
    // 모르는 모델은 클래스를 추측하지 않는다. 가장 흔한 주력 클래스로 둔다.
    car_class: classOfModel(model) ?? 'P',
    model,
    kind: failed ? 'error' : 'call',
    session_id: typeof row.sessionId === 'string' ? row.sessionId : undefined,
    // 실측 37,814행에서 귀속 필드는 `attributionSkill`(999행)뿐이다. 예전에 읽던
    // `attributionAgent`는 존재하지 않는 키였다 — 상세는 `types.ts`의 `skill` 주석.
    skill: typeof row.attributionSkill === 'string' ? row.attributionSkill : undefined,
    tokens: { prompt, completion, cache_read: usage.cache_read_input_tokens ?? 0 },
    cache_hit: cacheHit,
    // 단가를 모르면 0이다. 지어내지 않는다. 캐시 읽기는 캐시 단가로만 청구한다.
    cost_usd: spec ? costUsd(spec, prompt - cacheRead, cacheRead, completion) : 0,
    latency_ms: 0,
    status: failed ? 'error' : 'ok',
    error_code: errorCode,
    fuel_pct: 100,
    // 타이어는 소스가 없다 (PRD §7.0).
  };
}
