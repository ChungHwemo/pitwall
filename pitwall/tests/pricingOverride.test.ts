import { describe, it, expect } from 'vitest';
import {
  parsePricingOverride, loadPricingOverride,
  type PricingOverrideEntry,
} from '../src/config/pricingOverride';
import { resolveModelSpec, specOf } from '../src/config/models';

/** `{ models: {...} }` 한 겹을 씌운다 — 설정 섹션 모양. */
function file(models: Record<string, unknown>): { models: Record<string, unknown> } {
  return { models };
}

describe('parsePricingOverride — 검증 (tokscale custom-pricing 규칙)', () => {
  it('per-million 항목을 그대로 읽는다', () => {
    const map = parsePricingOverride(file({
      'claude-opus-5': {
        input_cost_per_million_tokens: 2,
        output_cost_per_million_tokens: 8,
        cache_read_input_token_cost_per_million_tokens: 0.3,
      },
    }));
    expect(map.get('claude-opus-5')).toEqual<PricingOverrideEntry>({
      inputPerMtok: 2, outputPerMtok: 8, cachedInputPerMtok: 0.3,
    });
  });

  it('음수 값은 항목을 스킵한다', () => {
    const map = parsePricingOverride(file({
      bad: { input_cost_per_million_tokens: 2, output_cost_per_million_tokens: -8 },
      good: { input_cost_per_million_tokens: 1, output_cost_per_million_tokens: 4 },
    }));
    expect(map.has('bad')).toBe(false);
    expect(map.get('good')?.inputPerMtok).toBe(1);
  });

  it('NaN·Infinity 값은 항목을 스킵한다', () => {
    const map = parsePricingOverride(file({
      nan: { input_cost_per_million_tokens: Number.NaN, output_cost_per_million_tokens: 8 },
      inf: { input_cost_per_million_tokens: 2, output_cost_per_million_tokens: Number.POSITIVE_INFINITY },
    }));
    expect(map.size).toBe(0);
  });

  it('수가 아닌 값은 항목을 스킵한다', () => {
    const map = parsePricingOverride(file({
      bad: { input_cost_per_million_tokens: 'not-a-number', output_cost_per_million_tokens: 8 },
    }));
    expect(map.size).toBe(0);
  });

  it('입력·출력 둘 다 없으면 스킵 (캐시만 있는 항목)', () => {
    const map = parsePricingOverride(file({
      'cache-only': { cache_read_input_token_cost_per_million_tokens: 0.3 },
    }));
    expect(map.has('cache-only')).toBe(false);
  });

  it('입력·출력이 둘 다 0이면 스킵', () => {
    const map = parsePricingOverride(file({
      zero: { input_cost_per_million_tokens: 0, output_cost_per_million_tokens: 0 },
    }));
    expect(map.has('zero')).toBe(false);
  });

  it('입력이 0이라도 출력이 양수면 남긴다', () => {
    const map = parsePricingOverride(file({
      'free-input': { input_cost_per_million_tokens: 0, output_cost_per_million_tokens: 8 },
    }));
    expect(map.get('free-input')).toEqual<PricingOverrideEntry>({ inputPerMtok: 0, outputPerMtok: 8 });
  });

  it('입력만 있어도 남긴다', () => {
    const map = parsePricingOverride(file({
      'input-only': { input_cost_per_million_tokens: 2 },
    }));
    expect(map.get('input-only')).toEqual<PricingOverrideEntry>({ inputPerMtok: 2 });
  });

  it('per_token 키가 있으면 그 항목을 스킵한다 (per-million 전용)', () => {
    const map = parsePricingOverride(file({
      ambiguous: {
        input_cost_per_million_tokens: 2,
        input_cost_per_token: 0.000002,
        output_cost_per_million_tokens: 8,
      },
      good: { input_cost_per_million_tokens: 1, output_cost_per_million_tokens: 4 },
    }));
    expect(map.has('ambiguous')).toBe(false);
    expect(map.get('good')?.inputPerMtok).toBe(1);
  });

  it('per_token만 있는 항목도 스킵한다 (지원 안 함)', () => {
    const map = parsePricingOverride(file({
      copied: { input_cost_per_token: 0.000002, output_cost_per_token: 0.000008 },
    }));
    expect(map.size).toBe(0);
  });

  it('소문자화 후 겹치는 키는 마지막이 이긴다 (대소문자 무시)', () => {
    const map = parsePricingOverride(file({
      'Model-A': { input_cost_per_million_tokens: 1, output_cost_per_million_tokens: 4 },
      'model-a': { input_cost_per_million_tokens: 2, output_cost_per_million_tokens: 8 },
    }));
    expect(map.get('model-a')?.inputPerMtok).toBe(2);
  });

  it('모르는 필드는 무시하고 항목은 적용한다', () => {
    const map = parsePricingOverride(file({
      annotated: {
        input_cost_per_million_tokens: 2,
        output_cost_per_million_tokens: 8,
        source: 'https://example.com/pricing',
        notes: '기록용, 무시된다',
      },
    }));
    expect(map.get('annotated')).toEqual<PricingOverrideEntry>({ inputPerMtok: 2, outputPerMtok: 8 });
  });

  it('잘못된 항목은 개별 스킵하고 멀쩡한 항목은 남긴다', () => {
    const map = parsePricingOverride(file({
      bad: { input_cost_per_million_tokens: 'x', output_cost_per_million_tokens: 8 },
      good: { input_cost_per_million_tokens: 2, output_cost_per_million_tokens: 8 },
    }));
    expect(map.has('bad')).toBe(false);
    expect(map.get('good')?.inputPerMtok).toBe(2);
  });

  it('깨진 JSON 문자열은 빈 맵 (예외 없음)', () => {
    expect(parsePricingOverride('{"models": {').size).toBe(0);
  });

  it('올바른 JSON 문자열은 파싱한다', () => {
    const map = parsePricingOverride(JSON.stringify(file({
      'gpt-5.5': { input_cost_per_million_tokens: 3, output_cost_per_million_tokens: 9 },
    })));
    expect(map.get('gpt-5.5')?.outputPerMtok).toBe(9);
  });

  it('10,000개를 넘으면 빈 맵', () => {
    const models: Record<string, unknown> = {};
    for (let i = 0; i < 10_001; i++) {
      models[`m-${i}`] = { input_cost_per_million_tokens: 1, output_cost_per_million_tokens: 4 };
    }
    expect(parsePricingOverride(file(models)).size).toBe(0);
  });

  it('16 MiB를 넘는 입력 문자열은 빈 맵', () => {
    const huge = 'x'.repeat(16 * 1024 * 1024 + 1);
    expect(parsePricingOverride(huge).size).toBe(0);
  });

  it('models 섹션이 없으면 빈 맵', () => {
    expect(parsePricingOverride({ nope: {} }).size).toBe(0);
    expect(parsePricingOverride(undefined).size).toBe(0);
    expect(parsePricingOverride(null).size).toBe(0);
    expect(parsePricingOverride(42).size).toBe(0);
    expect(parsePricingOverride([]).size).toBe(0);
  });
});

describe('loadPricingOverride — 우선순위 (조직 > 로컬)', () => {
  const orgEntry = file({ 'claude-opus-5': { input_cost_per_million_tokens: 9, output_cost_per_million_tokens: 40 } });
  const localEntry = file({ 'claude-opus-5': { input_cost_per_million_tokens: 1, output_cost_per_million_tokens: 4 } });

  it('조직 보정이 로컬 보정을 이긴다', () => {
    const res = loadPricingOverride({ pricingOverride: orgEntry }, { pricingOverride: localEntry }, 1_000);
    expect(res.source).toBe('org');
    expect(res.entries.get('claude-opus-5')?.inputPerMtok).toBe(9);
    expect(res.readAt).toBe(1_000);
  });

  it('조직에 없으면 로컬을 쓴다', () => {
    const res = loadPricingOverride({}, { pricingOverride: localEntry }, 2_000);
    expect(res.source).toBe('local');
    expect(res.entries.get('claude-opus-5')?.inputPerMtok).toBe(1);
    expect(res.readAt).toBe(2_000);
  });

  it('둘 다 없으면 내장(빈 맵)이고 readAt은 null', () => {
    const res = loadPricingOverride({}, {}, 3_000);
    expect(res.source).toBe('builtin');
    expect(res.entries.size).toBe(0);
    expect(res.readAt).toBeNull();
  });
});

describe('resolveModelSpec — 치환 계층', () => {
  it('보정이 없으면 카탈로그 항목을 같은 참조로 돌려준다', () => {
    expect(resolveModelSpec('claude-opus-5')).toBe(specOf('claude-opus-5'));
    expect(resolveModelSpec('claude-opus-5', new Map())).toBe(specOf('claude-opus-5'));
  });

  it('맵에 이 id가 없으면 카탈로그 항목을 같은 참조로 돌려준다', () => {
    const map = new Map<string, PricingOverrideEntry>([['gpt-5.5', { inputPerMtok: 1 }]]);
    expect(resolveModelSpec('claude-opus-5', map)).toBe(specOf('claude-opus-5'));
  });

  it('준 필드만 치환하고 나머지는 카탈로그 값을 남긴다', () => {
    const base = specOf('claude-opus-5')!;
    const map = new Map<string, PricingOverrideEntry>([['claude-opus-5', { inputPerMtok: 99 }]]);
    const resolved = resolveModelSpec('claude-opus-5', map)!;
    expect(resolved.inputPerMtok).toBe(99);
    expect(resolved.outputPerMtok).toBe(base.outputPerMtok);
    expect(resolved.cachedInputPerMtok).toBe(base.cachedInputPerMtok);
    expect(resolved.carClass).toBe(base.carClass);
  });

  it('보정된 스펙은 unverified로 낮추고 로컬 보정임을 밝힌다', () => {
    const map = new Map<string, PricingOverrideEntry>([['claude-opus-5', { outputPerMtok: 12 }]]);
    const resolved = resolveModelSpec('claude-opus-5', map)!;
    expect(resolved.priceSource).toBe('unverified');
    expect(resolved.priceNote).toBe('로컬 단가 보정');
  });

  it('모르는 모델은 undefined', () => {
    const map = new Map<string, PricingOverrideEntry>([['x', { inputPerMtok: 1 }]]);
    expect(resolveModelSpec('nonexistent-model-9', map)).toBeUndefined();
  });

  it('parse가 낮춘 소문자 키로 조회한다 (대소문자 무시)', () => {
    const map = parsePricingOverride(file({
      'Claude-Opus-5': { input_cost_per_million_tokens: 7, output_cost_per_million_tokens: 30 },
    }));
    expect(resolveModelSpec('claude-opus-5', map)?.inputPerMtok).toBe(7);
  });
});
