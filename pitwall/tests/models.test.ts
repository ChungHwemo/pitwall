import { describe, it, expect } from 'vitest';
import { MODEL_CATALOG, modelsOfClass, classOfModel, costUsd, providerOfModel } from '../src/config/models';
import { CAR_CLASSES } from '../src/types';

describe('MODEL_CATALOG', () => {
  it('여섯 공급자를 모두 포함한다', () => {
    const providers = new Set(MODEL_CATALOG.map((m) => m.provider));
    expect([...providers].sort()).toEqual(
      ['anthropic', 'deepseek', 'google', 'moonshot', 'openai', 'xai'],
    );
  });

  it('모델 id가 중복되지 않는다', () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('세 클래스 모두 최소 2개 모델을 갖는다', () => {
    for (const cls of CAR_CLASSES) {
      expect(modelsOfClass(cls).length, `${cls} 모델 수`).toBeGreaterThanOrEqual(2);
    }
  });

  it('가격이 전부 양수이며 출력이 입력보다 비싸다', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.inputPerMtok, `${m.id} input`).toBeGreaterThan(0);
      expect(m.outputPerMtok, `${m.id} output`).toBeGreaterThan(0);
      expect(m.outputPerMtok, `${m.id} output > input`).toBeGreaterThan(m.inputPerMtok);
    }
  });

  it('캐시 읽기 가격은 입력 가격보다 싸다', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.cachedInputPerMtok, `${m.id} cached`).toBeLessThan(m.inputPerMtok);
      expect(m.cachedInputPerMtok, `${m.id} cached`).toBeGreaterThan(0);
    }
  });

  it('모든 항목이 출처를 밝힌다 — 지어낸 숫자를 섞지 않는다', () => {
    for (const m of MODEL_CATALOG) {
      expect(['verified', 'unverified'], `${m.id} source`).toContain(m.priceSource);
      expect(m.sourceUrl, `${m.id} sourceUrl`).toMatch(/^https:\/\//);
    }
  });

  it('미검증 가격은 검증 가격과 섞이지 않게 표시된다', () => {
    // 검증 못 한 항목이 있어도 되지만, 어느 것인지 코드에서 구분 가능해야 한다.
    const unverified = MODEL_CATALOG.filter((m) => m.priceSource === 'unverified');
    for (const m of unverified) expect(m.priceNote).toBeTruthy();
  });

  it('현재 카탈로그에 미검증 항목이 없다', () => {
    // 자리표시자를 추가하려면 이 테스트를 의도적으로 고쳐야 한다 —
    // 지어낸 숫자가 조용히 섞이는 경로를 막는다.
    expect(MODEL_CATALOG.filter((m) => m.priceSource === 'unverified')).toEqual([]);
  });

  it('클래스 배정이 가격 순서와 모순되지 않는다', () => {
    // H가 가장 비싸고 GT가 가장 싸다. 겹치면 클래스가 의미를 잃는다.
    const cheapest = (cls: 'H' | 'P' | 'GT') =>
      Math.min(...modelsOfClass(cls).map((m) => m.outputPerMtok));
    const priciest = (cls: 'H' | 'P' | 'GT') =>
      Math.max(...modelsOfClass(cls).map((m) => m.outputPerMtok));
    expect(cheapest('H')).toBeGreaterThan(priciest('P'));
    expect(cheapest('P')).toBeGreaterThan(priciest('GT'));
  });
});

describe('classOfModel', () => {
  it('카탈로그에 있는 모델의 클래스를 돌려준다', () => {
    expect(classOfModel('claude-opus-5')).toBe('H');
  });

  it('모르는 모델은 null이다 — 임의로 배정하지 않는다', () => {
    expect(classOfModel('nonexistent-model-9')).toBeNull();
  });
});

describe('providerOfModel (REVIEW #11)', () => {
  it('여섯 공급자를 모델 id로 각각 되돌려준다', () => {
    expect(providerOfModel('claude-opus-5')).toBe('anthropic');
    expect(providerOfModel('gpt-5.6-sol')).toBe('openai');
    expect(providerOfModel('gemini-3.5-flash')).toBe('google');
    expect(providerOfModel('grok-4.5')).toBe('xai');
    expect(providerOfModel('deepseek-v4-pro')).toBe('deepseek');
    expect(providerOfModel('kimi-k3')).toBe('moonshot');
  });

  it('날짜 별칭 id도 카탈로그 항목의 공급자로 맞춘다', () => {
    expect(providerOfModel('claude-haiku-4-5-20251001')).toBe('anthropic');
  });

  it('카탈로그 밖 모델은 null이다 — 공급자를 지어내지 않는다', () => {
    expect(providerOfModel('nonexistent-model-9')).toBeNull();
  });
});

describe('providerOfModel — Grok build 채널', () => {
  it('grok-4.5-build를 xai로 명시적으로 해소한다', () => {
    expect(providerOfModel('grok-4.5-build')).toBe('xai');
  });

  it('진짜 미지 모델과 리터럴 "unknown"은 여전히 null이다', () => {
    expect(providerOfModel('grok-9.9-nonexistent')).toBeNull();
    expect(providerOfModel('unknown')).toBeNull();
  });
});

describe('costUsd', () => {
  it('신규 입력·캐시·출력을 각 단가로 계산한다', () => {
    const m = MODEL_CATALOG.find((x) => x.id === 'claude-opus-5')!;
    // 1M 신규 입력 + 1M 캐시 + 1M 출력 = 입력·캐시·출력 단가 합
    expect(costUsd(m, 1_000_000, 1_000_000, 1_000_000))
      .toBeCloseTo(m.inputPerMtok + m.cachedInputPerMtok + m.outputPerMtok, 9);
  });

  it('캐시 읽기는 캐시 단가만으로 계산한다', () => {
    const m = MODEL_CATALOG.find((x) => x.id === 'claude-opus-5')!;
    expect(costUsd(m, 0, 1_000_000, 0)).toBeCloseTo(m.cachedInputPerMtok, 9);
  });

  it('토큰 0이면 비용 0이다', () => {
    expect(costUsd(MODEL_CATALOG[0]!, 0, 0, 0)).toBe(0);
  });

  it('캐시로 읽은 몫은 신규 입력보다 항상 싸다', () => {
    for (const m of MODEL_CATALOG) {
      // 같은 500k 입력도 400k 신규 + 100k 캐시가 전부 신규보다 싸다
      expect(costUsd(m, 400_000, 100_000, 1000)).toBeLessThan(costUsd(m, 500_000, 0, 1000));
    }
  });
});
