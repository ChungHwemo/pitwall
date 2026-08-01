import type { SettingsInput } from './settings';

/**
 * 모델별 로컬 단가 보정.
 *
 * `MODEL_CATALOG`은 2026-07-30에 공식 문서에서 직접 읽은 **검증된** 기준값이다.
 * 상류 가격이 바뀌었는데 카탈로그를 아직 못 고쳤을 때, 조직 설정 파일
 * (`pitwall.settings.json`)이나 localStorage에 로컬 보정을 두어 그 값을 덮는다.
 *
 * tokscale의 `custom-pricing.json`(§Pricing Lookup, §Custom Pricing Overrides)을 근거로
 * 검증 규칙을 **그대로** 따른다 — 잘못된 값은 실패시키지 않고 **건너뛴다**. 오타 하나가
 * 조용히 회계를 바꾸지 않게, 그러나 같은 파일의 멀쩡한 항목은 계속 적용되게.
 *
 * PITWALL 카탈로그는 **백만 토큰당(per-million)** 단가만 쓴다. tokscale이 받는
 * per-token 필드(`input_cost_per_token` 등)는 여기서 **지원하지 않는다** — per_token 키가
 * 하나라도 있으면 그 항목은 tokscale의 per_million+per_token 충돌과 동일하게 스킵한다.
 * LiteLLM/OpenRouter 런타임 fetch도 추가하지 않는다 (outbound-0). 같은 오리진의
 * `pitwall.settings.json`과 localStorage만 읽는다.
 */
export interface PricingOverrideEntry {
  /** USD / 1M 입력 토큰 */
  inputPerMtok?: number;
  /** USD / 1M 출력 토큰 */
  outputPerMtok?: number;
  /** USD / 1M 캐시 읽기 토큰 */
  cachedInputPerMtok?: number;
}

/** 보정이 어디서 왔는지. 화면이 적용 출처를 밝혀야 한다 (검증값과 섞지 않는다). */
export type PricingOverrideSource = 'org' | 'local' | 'builtin';

/** 해석된 보정과 그 출처·판독 시각. 설정 패널이 provenance 한 줄을 그린다. */
export interface PricingOverride {
  readonly entries: ReadonlyMap<string, PricingOverrideEntry>;
  readonly source: PricingOverrideSource;
  /** 보정을 읽은 시각(epoch ms). 보정이 없으면 null. */
  readonly readAt: number | null;
}

/** tokscale과 같은 상한. 파일 16 MiB, 모델 항목 10,000개. */
const MAX_OVERRIDE_BYTES = 16 * 1024 * 1024;
const MAX_OVERRIDE_MODEL_CAPACITY = 10_000;

const EMPTY: ReadonlyMap<string, PricingOverrideEntry> = new Map();

/** per-million 필드만 인정한다. */
const INPUT_KEY = 'input_cost_per_million_tokens';
const OUTPUT_KEY = 'output_cost_per_million_tokens';
const CACHE_KEY = 'cache_read_input_token_cost_per_million_tokens';

/**
 * per-token 키들. 하나라도 있으면 항목을 스킵한다 — PITWALL은 per-million만 쓰므로
 * per_token은 지원하지 않고, tokscale의 per_million+per_token 충돌 스킵과 같게 다룬다.
 */
const PER_TOKEN_KEYS = [
  'input_cost_per_token',
  'output_cost_per_token',
  'cache_read_input_token_cost',
];

/** UTF-8 바이트 길이. 16 MiB 상한을 정확히 재기 위해서다. */
function byteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

/** 유한한 음이 아닌 수만 통과. NaN·Infinity·음수·수 아님은 실패다. */
function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * 한 항목을 보정 항목으로 옮긴다. 규칙 하나라도 어기면 `null`(스킵)이다.
 *
 *   - per_token 키가 있으면 스킵 (per-million 전용, 충돌 스킵과 동일)
 *   - 있는 값이 음수/NaN/Inf/수 아님이면 스킵 (오타가 회계를 바꾸지 못하게)
 *   - 입력·출력 둘 다 없으면 스킵 (캐시만 있는 항목은 못 쓴다)
 *   - 입력·출력 둘 다 양수가 아니면 스킵 (둘 다 0 포함)
 */
function toEntry(value: unknown): PricingOverrideEntry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  // per_token 키가 하나라도 있으면 그 항목은 모호하다 — 스킵한다.
  for (const key of PER_TOKEN_KEYS) {
    if (raw[key] !== undefined) return null;
  }

  const entry: PricingOverrideEntry = {};

  if (raw[INPUT_KEY] !== undefined) {
    if (!finiteNonNegative(raw[INPUT_KEY])) return null;
    entry.inputPerMtok = raw[INPUT_KEY];
  }
  if (raw[OUTPUT_KEY] !== undefined) {
    if (!finiteNonNegative(raw[OUTPUT_KEY])) return null;
    entry.outputPerMtok = raw[OUTPUT_KEY];
  }
  if (raw[CACHE_KEY] !== undefined) {
    if (!finiteNonNegative(raw[CACHE_KEY])) return null;
    entry.cachedInputPerMtok = raw[CACHE_KEY];
  }

  const inputPositive = entry.inputPerMtok !== undefined && entry.inputPerMtok > 0;
  const outputPositive = entry.outputPerMtok !== undefined && entry.outputPerMtok > 0;
  // 입력·출력 중 적어도 하나는 양수여야 한다 (tokscale과 동일). 캐시만으로는 못 쓴다.
  if (!inputPositive && !outputPositive) return null;

  return entry;
}

/**
 * 보정 원본을 검증된 항목 맵으로 옮긴다.
 *
 * `raw`는 세 모양 중 하나다:
 *   - 문자열: 파일에서 그대로 읽은 JSON. 16 MiB를 넘거나 파싱에 실패하면 **빈 맵**.
 *   - `{ models: {...} }` 객체: 이미 파싱된 설정 섹션.
 *   - 그 밖: 빈 맵.
 *
 * 어떤 예외도 던지지 않는다 — 없어도 되는 물건이라 화면을 멈추게 두지 않는다.
 * 키는 소문자로 낮춘다(대소문자 무시). 소문자화 후 같은 키가 겹치면 마지막이 이긴다.
 * 잘못된 항목은 개별로 스킵하고, 같은 파일의 멀쩡한 항목은 그대로 적용한다.
 */
export function parsePricingOverride(raw: unknown): ReadonlyMap<string, PricingOverrideEntry> {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    // length(코드 유닛)는 항상 바이트 이하라 큰 문자열을 인코딩 없이 먼저 거른다.
    if (raw.length > MAX_OVERRIDE_BYTES || byteLength(raw) > MAX_OVERRIDE_BYTES) return EMPTY;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return EMPTY;
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY;
  const models = (parsed as Record<string, unknown>).models;
  if (typeof models !== 'object' || models === null || Array.isArray(models)) return EMPTY;

  const keys = Object.keys(models as Record<string, unknown>);
  // 10,000개를 넘으면 통째로 빈 맵이다 — 사고로 거대해진 파일을 회계에 들이지 않는다.
  if (keys.length > MAX_OVERRIDE_MODEL_CAPACITY) return EMPTY;

  const out = new Map<string, PricingOverrideEntry>();
  for (const key of keys) {
    const entry = toEntry((models as Record<string, unknown>)[key]);
    if (entry === null) continue;
    // 소문자 키로 저장. 마지막이 이긴다 (Map.set이 덮는다).
    out.set(key.toLowerCase(), entry);
  }
  return out;
}

/**
 * 조직 설정과 로컬 설정에서 단가 보정을 해석한다.
 *
 * **조직 파일이 localStorage를 이긴다.** 설정(preset·speed 등)의 우선순위와는
 * 반대다 — 단가 보정은 개인 취향이 아니라 조직 수준의 데이터 보정이므로, 조직이
 * 검증해 배포한 값이 개인 로컬 파일보다 앞선다. 조직에 보정이 있으면 조직 것을,
 * 없으면 로컬 것을, 둘 다 없으면 내장 카탈로그(빈 맵)를 쓴다.
 *
 * `readAt`은 이 함수를 부른 시각이다 — 같은 오리진 자산을 방금 읽었다는 판독 나이로,
 * 화면이 `단가 보정: 로컬 · HH:mm`처럼 적용 출처와 나이를 밝히는 데 쓴다.
 */
export function loadPricingOverride(
  org: SettingsInput,
  local: SettingsInput,
  now: number = Date.now(),
): PricingOverride {
  const orgEntries = parsePricingOverride(org.pricingOverride);
  if (orgEntries.size > 0) return { entries: orgEntries, source: 'org', readAt: now };

  const localEntries = parsePricingOverride(local.pricingOverride);
  if (localEntries.size > 0) return { entries: localEntries, source: 'local', readAt: now };

  return { entries: EMPTY, source: 'builtin', readAt: null };
}
