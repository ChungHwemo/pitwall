import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODEL_CATALOG, costUsd } from '../src/config/models';
import { isCarClass } from '../src/types';
import type { CarEvent } from '../src/types';

/**
 * 커밋된 더미 데이터가 CarEvent 계약을 계속 지키는지 검사한다.
 * 계약이 바뀌면 fixture를 다시 뽑아야 하고, 이 테스트가 그걸 알려준다.
 */
const PRESETS = ['busy', 'sparse', 'chaos'] as const;

function load(name: string): CarEvent[] {
  const path = resolve(import.meta.dirname, `../fixtures/events.${name}.jsonl`);
  return readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as CarEvent);
}

describe.each(PRESETS)('fixtures/events.%s.jsonl', (name) => {
  const events = load(name);

  it('비어 있지 않다', () => {
    expect(events.length).toBeGreaterThan(0);
  });

  it('모든 이벤트가 카탈로그의 모델을 쓴다', () => {
    const ids = new Set(MODEL_CATALOG.map((m) => m.id));
    for (const e of events) expect(ids, e.model).toContain(e.model);
  });

  it('클래스가 유효하고 모델의 클래스와 일치한다', () => {
    for (const e of events) {
      expect(isCarClass(e.car_class)).toBe(true);
      expect(MODEL_CATALOG.find((m) => m.id === e.model)!.carClass).toBe(e.car_class);
    }
  });

  it('비용이 그 모델의 단가와 맞는다', () => {
    for (const e of events) {
      const spec = MODEL_CATALOG.find((m) => m.id === e.model)!;
      expect(e.cost_usd).toBeCloseTo(
        costUsd(spec, e.tokens.prompt, e.tokens.completion, e.cache_hit), 10);
    }
  });

  it('프롬프트·응답 본문이 들어 있지 않다', () => {
    // PRD PRIV-4. 더미 데이터에서도 본문 필드를 만들지 않는다 —
    // fixture가 실 어댑터의 참조 형태가 되기 때문이다.
    for (const e of events) {
      expect(e).not.toHaveProperty('messages');
      expect(e).not.toHaveProperty('response');
      expect(e).not.toHaveProperty('proxy_server_request');
      expect(e).not.toHaveProperty('requester_ip_address');
    }
  });

  it('car_id가 원본 식별자처럼 보이지 않는다', () => {
    // PRIV-3: 사람 이름·이메일·사번이 새면 익명성이 깨진다.
    for (const e of events) {
      expect(e.car_id).toMatch(/^car-\d{3}$/);
    }
  });

  it('카넘버가 1..999 범위다', () => {
    for (const e of events) {
      expect(e.car_number).toBeGreaterThanOrEqual(1);
      expect(e.car_number).toBeLessThanOrEqual(999);
    }
  });

  it('시각이 단조 증가한다', () => {
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.ts).toBeGreaterThanOrEqual(events[i - 1]!.ts);
    }
  });
});

describe('프리셋 간 차이가 실제로 드러난다', () => {
  it('chaos의 에러율이 sparse보다 높다', () => {
    const rate = (n: string) => {
      const e = load(n);
      return e.filter((x) => x.status === 'error').length / e.length;
    };
    expect(rate('chaos')).toBeGreaterThan(rate('sparse'));
  });

  it('세 프리셋 모두 여러 공급자를 섞는다', () => {
    for (const name of PRESETS) {
      const providers = new Set(load(name).map(
        (e) => MODEL_CATALOG.find((m) => m.id === e.model)!.provider));
      expect(providers.size, `${name} 공급자 수`).toBeGreaterThanOrEqual(4);
    }
  });
});
