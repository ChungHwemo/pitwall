import { describe, it, expect } from 'vitest';
import { cacheSavingOf } from '../src/state/savings';
import { specOf } from '../src/config/models';
import type { CarEvent } from '../src/types';

const ev = (over: Partial<CarEvent> = {}): CarEvent => ({
  ts: 1_000, car_id: 'a', car_number: 1, car_class: 'H', model: 'claude-opus-5',
  kind: 'call', tokens: { prompt: 100_000, completion: 1_000, cache_read: 99_000 },
  cache_hit: true, cost_usd: 0, latency_ms: 0, status: 'ok', fuel_pct: 100, ...over,
});

describe('cacheSavingOf', () => {
  it('캐시로 읽은 토큰을 정가로 냈다면 얼마였을지와의 차액이다', () => {
    // 단가는 카탈로그에서 읽는다 — 여기에 숫자를 박으면 카탈로그가 바뀔 때 거짓이 된다.
    const spec = specOf('claude-opus-5')!;
    const gap = spec.inputPerMtok - spec.cachedInputPerMtok;
    expect(cacheSavingOf(ev())).toBeCloseTo(99_000 * gap / 1_000_000, 9);
  });

  it('캐시를 안 썼으면 0이다', () => {
    expect(cacheSavingOf(ev({ tokens: { prompt: 1_000, completion: 10 }, cache_hit: false }))).toBe(0);
  });

  it('단가를 모르는 모델은 0이다 — 지어내지 않는다', () => {
    expect(cacheSavingOf(ev({ model: 'unknown-model' }))).toBe(0);
  });

  it('음수가 되지 않는다', () => {
    expect(cacheSavingOf(ev({ tokens: { prompt: 10, completion: 0, cache_read: 0 } }))).toBe(0);
  });
});
