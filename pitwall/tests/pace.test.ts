import { describe, it, expect } from 'vitest';
import { paceOf, formatPace } from '../src/state/pace';
import type { CarState, RaceState } from '../src/types';

const T = 1_800_000_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 1, model: 'claude-opus-5', car_class: 'H', activity: 'running',
    distance: 0, cached: 0, fuel_pct: 100, cost_usd: 0,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 0,
    ...over,
  };
}

function state(cars: CarState[], elapsed: number): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), phase: 'racing', elapsed_ms: elapsed, now: T };
}

describe('paceOf', () => {
  const twoHours = 2 * 3_600_000;

  it('쓴 돈과 시간당 소진을 낸다', () => {
    const s = state([car('a', { cost_usd: 30 }), car('b', { cost_usd: 6 })], twoHours);
    const p = paceOf(s);
    expect(p.costUsd).toBe(36);
    expect(p.costPerHour).toBe(18);
  });

  it('작업 토큰의 분당 속도를 낸다', () => {
    const s = state([car('a', { distance: 1_200_000 })], twoHours);
    expect(paceOf(s).workPerMinute).toBe(10_000);
  });

  it('레이스가 아직 시작 전이면 속도를 0으로 둔다 — 0으로 나누지 않는다', () => {
    const p = paceOf(state([car('a', { cost_usd: 5, distance: 100 })], 0));
    expect([p.costPerHour, p.workPerMinute]).toEqual([0, 0]);
    expect(p.costUsd).toBe(5);
  });
});

describe('formatPace', () => {
  it('돈과 속도를 한 줄로 읽히게 쓴다', () => {
    expect(formatPace({ costUsd: 401.63, costPerHour: 18.02, workPerMinute: 6462 }))
      .toBe('$401.63 · $18.0/시간 · 6.5k tok/분');
  });

  it('아직 안 돌았으면 속도 자리를 비운다', () => {
    expect(formatPace({ costUsd: 0, costPerHour: 0, workPerMinute: 0 })).toBe('$0.00');
  });
});
