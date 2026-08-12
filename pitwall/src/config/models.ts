import type { CarClass } from '../types';
import type { PricingOverrideEntry } from './pricingOverride';

/**
 * 모델 카탈로그 — 시뮬레이터 더미 데이터의 모델·단가 출처.
 *
 * 가격은 2026-07-30에 각 공급자 공식 문서에서 직접 읽었다. 단위는 USD / 1M 토큰.
 * 지어낸 숫자를 섞지 않기 위해 항목마다 `priceSource`와 `sourceUrl`을 강제한다 —
 * 확인하지 못한 값은 `unverified`로 표시하고 `priceNote`에 사유를 남긴다.
 *
 * 클래스(H/P/GT)는 **출력 단가 밴드**로 나눈다 (PRD Q4의 두 후보 중 '단가' 채택).
 * 능력 티어가 아니라 단가를 쓰는 이유는 화면이 표현하는 것이 비용이기 때문이다 —
 * 연료(예산)와 같은 축이어야 글리프가 일관된 의미를 갖는다.
 *
 *   H  (Hypercar)  출력 ≥ $12 / Mtok
 *   P  (Prototype) 출력 $2.5 ~ $10
 *   GT             출력 ≤ $1.5
 */
/** 카탈로그가 아는 공급자. 화면 칩은 이 목록 밖 브랜드를 지어내지 않는다. */
export type ProviderId = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek' | 'moonshot';

export interface ModelSpec {
  id: string;
  provider: ProviderId;
  carClass: CarClass;
  inputPerMtok: number;
  cachedInputPerMtok: number;
  outputPerMtok: number;
  priceSource: 'verified' | 'unverified';
  sourceUrl: string;
  priceNote?: string;
}

const ANTHROPIC = 'https://platform.claude.com/docs/en/about-claude/pricing';
const OPENAI = 'https://platform.openai.com/docs/pricing';
const GOOGLE = 'https://ai.google.dev/gemini-api/docs/pricing';
const XAI = 'https://docs.x.ai/docs/models';
const DEEPSEEK = 'https://api-docs.deepseek.com/quick_start/pricing';
const MOONSHOT_K3 = 'https://platform.moonshot.ai/docs/pricing/chat-k3';
const MOONSHOT_K27 = 'https://platform.moonshot.ai/docs/pricing/chat-k27-code';
const MOONSHOT_K26 = 'https://platform.moonshot.ai/docs/pricing/chat-k26';

export const MODEL_CATALOG: ModelSpec[] = [
  // ── H: 프런티어 ────────────────────────────────────────────────
  { id: 'claude-fable-5', provider: 'anthropic', carClass: 'H',
    inputPerMtok: 10, cachedInputPerMtok: 1, outputPerMtok: 50,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
  { id: 'gpt-5.6-sol', provider: 'openai', carClass: 'H',
    inputPerMtok: 5, cachedInputPerMtok: 0.5, outputPerMtok: 30,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'gpt-5.5', provider: 'openai', carClass: 'H',
    inputPerMtok: 5, cachedInputPerMtok: 0.5, outputPerMtok: 30,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'claude-opus-5', provider: 'anthropic', carClass: 'H',
    inputPerMtok: 5, cachedInputPerMtok: 0.5, outputPerMtok: 25,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
  { id: 'claude-opus-4-8', provider: 'anthropic', carClass: 'H',
    inputPerMtok: 5, cachedInputPerMtok: 0.5, outputPerMtok: 25,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
  { id: 'gpt-5.6-terra', provider: 'openai', carClass: 'H',
    inputPerMtok: 2.5, cachedInputPerMtok: 0.25, outputPerMtok: 15,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'kimi-k3', provider: 'moonshot', carClass: 'H',
    inputPerMtok: 3, cachedInputPerMtok: 0.3, outputPerMtok: 15,
    priceSource: 'verified', sourceUrl: MOONSHOT_K3,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.30' },
  { id: 'gemini-3.1-pro-preview', provider: 'google', carClass: 'H',
    inputPerMtok: 2, cachedInputPerMtok: 0.2, outputPerMtok: 12,
    priceSource: 'verified', sourceUrl: GOOGLE,
    priceNote: '프롬프트 200K 이하 기준. 초과 시 입력 $4 / 출력 $18' },

  // ── P: 주력 ────────────────────────────────────────────────────
  { id: 'claude-sonnet-5', provider: 'anthropic', carClass: 'P',
    inputPerMtok: 2, cachedInputPerMtok: 0.2, outputPerMtok: 10,
    priceSource: 'verified', sourceUrl: ANTHROPIC,
    priceNote: '프롬프트 200K 이하 기준. 초과 시 입력 $3 / 출력 $15' },
  { id: 'gemini-3.5-flash', provider: 'google', carClass: 'P',
    inputPerMtok: 1.5, cachedInputPerMtok: 0.15, outputPerMtok: 9,
    priceSource: 'verified', sourceUrl: GOOGLE },
  { id: 'grok-4.5', provider: 'xai', carClass: 'P',
    inputPerMtok: 2, cachedInputPerMtok: 0.3, outputPerMtok: 6,
    priceSource: 'verified', sourceUrl: XAI,
    priceNote: 'JSON 카탈로그 정수값(20000/3000/60000)을 페이지 표기 $2.00·$6.00으로 보정 (÷10,000)' },
  { id: 'grok-4.5-build', provider: 'xai', carClass: 'P',
    inputPerMtok: 2, cachedInputPerMtok: 0.3, outputPerMtok: 6,
    priceSource: 'verified', sourceUrl: XAI,
    priceNote: 'grok-4.5 build 채널 — 단가·클래스는 grok-4.5 공개값과 동일' },
  { id: 'gpt-5.6-luna', provider: 'openai', carClass: 'P',
    inputPerMtok: 1, cachedInputPerMtok: 0.1, outputPerMtok: 6,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'claude-haiku-4-5', provider: 'anthropic', carClass: 'P',
    inputPerMtok: 1, cachedInputPerMtok: 0.1, outputPerMtok: 5,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
  { id: 'kimi-k2.7-code', provider: 'moonshot', carClass: 'P',
    inputPerMtok: 0.95, cachedInputPerMtok: 0.19, outputPerMtok: 4,
    priceSource: 'verified', sourceUrl: MOONSHOT_K27,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.19' },
  { id: 'kimi-k2.6', provider: 'moonshot', carClass: 'P',
    inputPerMtok: 0.95, cachedInputPerMtok: 0.16, outputPerMtok: 4,
    priceSource: 'verified', sourceUrl: MOONSHOT_K26,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.16' },
  { id: 'gpt-5.4-mini', provider: 'openai', carClass: 'P',
    inputPerMtok: 0.75, cachedInputPerMtok: 0.075, outputPerMtok: 4.5,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'grok-4.3', provider: 'xai', carClass: 'P',
    inputPerMtok: 1.25, cachedInputPerMtok: 0.2, outputPerMtok: 2.5,
    priceSource: 'verified', sourceUrl: XAI,
    priceNote: 'JSON 카탈로그 정수값(12500/2000/25000) ÷10,000' },

  // ── GT: 경량·대량 ──────────────────────────────────────────────
  { id: 'gemini-3.1-flash-lite', provider: 'google', carClass: 'GT',
    inputPerMtok: 0.25, cachedInputPerMtok: 0.025, outputPerMtok: 1.5,
    priceSource: 'verified', sourceUrl: GOOGLE,
    priceNote: '텍스트/이미지/동영상 기준. 오디오 입력은 $0.50' },
  { id: 'gpt-5.4-nano', provider: 'openai', carClass: 'GT',
    inputPerMtok: 0.2, cachedInputPerMtok: 0.02, outputPerMtok: 1.25,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'deepseek-v4-pro', provider: 'deepseek', carClass: 'GT',
    inputPerMtok: 0.435, cachedInputPerMtok: 0.003625, outputPerMtok: 0.87,
    priceSource: 'verified', sourceUrl: DEEPSEEK,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.003625' },
  { id: 'deepseek-v4-flash', provider: 'deepseek', carClass: 'GT',
    inputPerMtok: 0.14, cachedInputPerMtok: 0.0028, outputPerMtok: 0.28,
    priceSource: 'verified', sourceUrl: DEEPSEEK,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.0028' },
];

/**
 * 날짜가 붙은 모델 id를 카탈로그 항목으로 맞춘다 (`claude-haiku-4-5-20251001`).
 * 실제 API 응답은 날짜 별칭을 쓰는데, 그걸 "모르는 모델"로 떨구면 비용이 0이 된다.
 */
export function specOf(id: string): ModelSpec | undefined {
  const exact = MODEL_CATALOG.find((m) => m.id === id);
  if (exact) return exact;
  return MODEL_CATALOG.find((m) => id.startsWith(`${m.id}-`) && /-\d{8}$/.test(id));
}

/**
 * 카탈로그 항목에 로컬 단가 보정을 얹는다.
 *
 * 보정은 카탈로그를 건드리지 않는 **순수 치환 계층**이다 (tokscale의 검증 카탈로그
 * 분리와 같다). 보정이 없거나 이 id에 걸린 보정이 없으면 카탈로그 항목을 **그대로**
 * (같은 참조로) 돌려준다 — 기존 호출·테스트가 바이트 그대로 유지된다.
 *
 * 보정이 걸리면 준 필드만 바꾸고 나머지는 카탈로그 값을 남긴다. 결과는 사용자가 준
 * 로컬 값이므로 `priceSource='unverified'`로 낮추고 `priceNote`에 로컬 보정임을 남긴다 —
 * 검증된 카탈로그 숫자와 조용히 섞이지 않게(출처 정직성).
 */
export function resolveModelSpec(
  id: string,
  overrides?: ReadonlyMap<string, PricingOverrideEntry>,
): ModelSpec | undefined {
  const base = specOf(id);
  if (!base || overrides === undefined || overrides.size === 0) return base;

  const override = overrides.get(base.id.toLowerCase());
  if (!override) return base;

  return {
    ...base,
    inputPerMtok: override.inputPerMtok ?? base.inputPerMtok,
    outputPerMtok: override.outputPerMtok ?? base.outputPerMtok,
    cachedInputPerMtok: override.cachedInputPerMtok ?? base.cachedInputPerMtok,
    priceSource: 'unverified',
    priceNote: '로컬 단가 보정',
  };
}

export function modelsOfClass(carClass: CarClass): ModelSpec[] {
  return MODEL_CATALOG.filter((m) => m.carClass === carClass);
}

/** 카탈로그에 없는 모델은 클래스를 추측하지 않는다 — 모르면 null이다. */
export function classOfModel(id: string): CarClass | null {
  return specOf(id)?.carClass ?? null;
}

/** 카탈로그 밖 모델은 공급자를 지어내지 않는다 — 모르면 null이고 칩도 그리지 않는다. */
export function providerOfModel(id: string): ProviderId | null {
  return specOf(id)?.provider ?? null;
}

export function costUsd(
  model: ModelSpec,
  newInputTokens: number,
  cacheReadTokens: number,
  completionTokens: number,
): number {
  // 3-way 분리: 신규 입력은 입력 단가, 캐시 재전송은 캐시 단가, 출력은 출력 단가.
  // 히트 여부로 prompt 전체를 한쪽 단가로 청구하면 실측 계약과 어긋난다 — 모든
  // 파서의 prompt는 캐시를 포함하므로 cacheReadTokens를 떼서 따로 곱한다
  // (Codex 실측 1시간: 구식 계산이 진짜 비용의 약 1/8이었다).
  const guard = (n: number) => Math.max(0, n);
  return (
    guard(newInputTokens) * model.inputPerMtok
    + guard(cacheReadTokens) * model.cachedInputPerMtok
    + guard(completionTokens) * model.outputPerMtok
  ) / 1_000_000;
}
