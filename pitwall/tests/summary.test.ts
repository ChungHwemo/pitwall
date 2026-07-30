import { describe, it, expect } from 'vitest';
import { summarise } from '../src/state/summary';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, car_class: 'P', activity: 'running',
    distance: 1000, cached: 0, fuel_pct: 80, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 10,
    ...over,
  };
}

function state(cars: CarState[], phase: RaceState['phase'] = 'chequered'): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), phase, elapsed_ms: 0, now: T };
}

describe('summarise', () => {
  it('총 주행거리는 전 차량 토큰 합이다', () => {
    const s = summarise(state([car('a', { distance: 1200 }), car('b', { distance: 800 })]));
    expect(s.totalTokens).toBe(2000);
  });

  it('총 비용을 합산한다', () => {
    const s = summarise(state([car('a', { cost_usd: 1.5 }), car('b', { cost_usd: 2.25 })]));
    expect(s.totalCostUsd).toBeCloseTo(3.75, 9);
  });

  it('완주와 리타이어를 나눠 센다', () => {
    const s = summarise(state([
      car('a'), car('b'),
      car('dnf', { activity: 'retired' }),
    ]));
    expect(s.finished).toBe(2);
    expect(s.retired).toBe(1);
  });

  it('클래스별 대수를 센다', () => {
    const s = summarise(state([
      car('a', { car_class: 'H' }), car('b', { car_class: 'H' }), car('c', { car_class: 'GT' }),
    ]));
    expect(s.byClass).toEqual({ H: 2, P: 0, GT: 1 });
  });

  it('캐시 히트율을 낸다', () => {
    const s = summarise(state([car('a', { cache_hits: 3, call_count: 10 })]));
    expect(s.cacheHitRate).toBeCloseTo(0.3, 9);
  });

  it('호출이 하나도 없으면 캐시 히트율은 0이다 — 0으로 나누지 않는다', () => {
    const s = summarise(state([car('a', { cache_hits: 0, call_count: 0 })]));
    expect(s.cacheHitRate).toBe(0);
  });

  it('에러 수를 합산한다', () => {
    const s = summarise(state([car('a', { error_count: 2 }), car('b', { error_count: 3 })]));
    expect(s.errors).toBe(5);
  });

  it('빈 레이스도 예외 없이 요약한다', () => {
    const s = summarise(state([]));
    expect(s).toMatchObject({ totalTokens: 0, finished: 0, retired: 0, cacheHitRate: 0 });
  });

  it('개인을 식별할 수 있는 값을 담지 않는다', () => {
    // PRD PRIV-1/PRIV-5. 요약은 조직 단위다 — 개인 순위를 만들지 않는다.
    const s = summarise(state([car('secret-user-kim', { distance: 99_999 })]));
    expect(JSON.stringify(s)).not.toContain('secret-user-kim');
    expect(s).not.toHaveProperty('cars');
    expect(s).not.toHaveProperty('top');
  });
});
