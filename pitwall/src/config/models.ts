import type { CarClass } from '../types';

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
export interface ModelSpec {
  id: string;
  provider: 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek' | 'moonshot';
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
const MOONSHOT = 'https://platform.moonshot.ai/docs/pricing/chat';

export const MODEL_CATALOG: ModelSpec[] = [
  // ── H: 프런티어 ────────────────────────────────────────────────
  { id: 'claude-fable-5', provider: 'anthropic', carClass: 'H',
    inputPerMtok: 10, cachedInputPerMtok: 1, outputPerMtok: 50,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
  { id: 'gpt-5.6-sol', provider: 'openai', carClass: 'H',
    inputPerMtok: 5, cachedInputPerMtok: 0.5, outputPerMtok: 30,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'claude-opus-5', provider: 'anthropic', carClass: 'H',
    inputPerMtok: 5, cachedInputPerMtok: 0.5, outputPerMtok: 25,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
  { id: 'gpt-5.6-terra', provider: 'openai', carClass: 'H',
    inputPerMtok: 2.5, cachedInputPerMtok: 0.25, outputPerMtok: 15,
    priceSource: 'verified', sourceUrl: OPENAI },
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
  { id: 'kimi-k3', provider: 'moonshot', carClass: 'P',
    inputPerMtok: 1.6, cachedInputPerMtok: 0.16, outputPerMtok: 8,
    priceSource: 'unverified', sourceUrl: MOONSHOT,
    priceNote: 'Moonshot 가격표가 클라이언트 렌더라 값을 읽지 못했다. 이 숫자는 자리표시자이며 실측으로 교체해야 한다' },
  { id: 'grok-4.5', provider: 'xai', carClass: 'P',
    inputPerMtok: 2, cachedInputPerMtok: 0.3, outputPerMtok: 6,
    priceSource: 'verified', sourceUrl: XAI,
    priceNote: 'JSON 카탈로그 정수값(20000/3000/60000)을 페이지 표기 $2.00·$6.00으로 보정 (÷10,000)' },
  { id: 'gpt-5.6-luna', provider: 'openai', carClass: 'P',
    inputPerMtok: 1, cachedInputPerMtok: 0.1, outputPerMtok: 6,
    priceSource: 'verified', sourceUrl: OPENAI },
  { id: 'claude-haiku-4-5', provider: 'anthropic', carClass: 'P',
    inputPerMtok: 1, cachedInputPerMtok: 0.1, outputPerMtok: 5,
    priceSource: 'verified', sourceUrl: ANTHROPIC },
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
  { id: 'kimi-k2.6', provider: 'moonshot', carClass: 'GT',
    inputPerMtok: 0.3, cachedInputPerMtok: 0.03, outputPerMtok: 1.2,
    priceSource: 'unverified', sourceUrl: MOONSHOT,
    priceNote: 'Moonshot 가격표가 클라이언트 렌더라 값을 읽지 못했다. 이 숫자는 자리표시자이며 실측으로 교체해야 한다' },
  { id: 'deepseek-v4-pro', provider: 'deepseek', carClass: 'GT',
    inputPerMtok: 0.435, cachedInputPerMtok: 0.003625, outputPerMtok: 0.87,
    priceSource: 'verified', sourceUrl: DEEPSEEK,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.003625' },
  { id: 'deepseek-v4-flash', provider: 'deepseek', carClass: 'GT',
    inputPerMtok: 0.14, cachedInputPerMtok: 0.0028, outputPerMtok: 0.28,
    priceSource: 'verified', sourceUrl: DEEPSEEK,
    priceNote: '입력은 캐시 미스 단가. 캐시 히트는 $0.0028' },
];

export function modelsOfClass(carClass: CarClass): ModelSpec[] {
  return MODEL_CATALOG.filter((m) => m.carClass === carClass);
}

/** 카탈로그에 없는 모델은 클래스를 추측하지 않는다 — 모르면 null이다. */
export function classOfModel(id: string): CarClass | null {
  return MODEL_CATALOG.find((m) => m.id === id)?.carClass ?? null;
}

export function costUsd(
  model: ModelSpec,
  promptTokens: number,
  completionTokens: number,
  cacheHit: boolean,
): number {
  const inputRate = cacheHit ? model.cachedInputPerMtok : model.inputPerMtok;
  return (promptTokens * inputRate + completionTokens * model.outputPerMtok) / 1_000_000;
}
