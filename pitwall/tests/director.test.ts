import { describe, it, expect } from 'vitest';
import { Director, scoreCar, DIRECTOR_TIMING } from '../src/director/director';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 1, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 1000, cached: 0, fuel_pct: 80, tyre_pct: 80, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 10,
    ...over,
  };
}

function state(cars: CarState[], now = T): RaceState {
  return {
    cars: new Map(cars.map((c) => [c.car_id, c])),
    phase: 'racing', elapsed_ms: 0, now,
  };
}

describe('scoreCar', () => {
  const ctx = { now: T, latencyP95: 5000, recentErrorIds: new Set<string>() };

  it('에러가 최고 가중치를 받는다', () => {
    const withError = scoreCar(car('a'), { ...ctx, recentErrorIds: new Set(['a']) });
    const plain = scoreCar(car('a'), ctx);
    expect(withError).toBeGreaterThan(plain);
  });

  it('연료 부족이 점수를 올린다', () => {
    expect(scoreCar(car('a', { fuel_pct: 10 }), ctx)).toBeGreaterThan(scoreCar(car('a'), ctx));
  });

  it('타이어 부족이 점수를 올린다', () => {
    expect(scoreCar(car('a', { tyre_pct: 5 }), ctx)).toBeGreaterThan(scoreCar(car('a'), ctx));
  });

  it('타이어 모드가 off면 타이어 신호가 점수에 끼어들지 않는다', () => {
    // PRD §9.1 v1.4: 소스가 없는 게이지로 "임계 도달"을 주장하지 않는다.
    const noTyre = car('a', { tyre_pct: undefined });
    expect(scoreCar(noTyre, ctx)).toBe(scoreCar(car('a', { tyre_pct: 80 }), ctx));
  });

  it('조용한 차량은 점수가 낮다', () => {
    const quiet = car('a', { last_event_ts: T - 3_600_000 });
    expect(scoreCar(quiet, ctx)).toBeLessThan(scoreCar(car('a'), ctx));
  });
});

describe('Director', () => {
  it('슬롯 수만큼 채운다', () => {
    const d = new Director(3);
    const picks = d.update(state([car('a'), car('b'), car('c'), car('d')]), T);
    expect(picks.length).toBe(3);
  });

  it('차량이 슬롯보다 적으면 있는 만큼만 낸다', () => {
    const d = new Director(3);
    expect(d.update(state([car('a')]), T).length).toBe(1);
  });

  it('점수 0대여도 폴백으로 슬롯을 채운다 (sparse 안전성)', () => {
    const d = new Director(3);
    const quiet = [
      car('a', { last_event_ts: T - 7_200_000 }),
      car('b', { last_event_ts: T - 7_200_000 }),
      car('c', { last_event_ts: T - 7_200_000 }),
    ];
    expect(d.update(state(quiet, T), T).length).toBe(3);
  });

  it('최소 노출 시간 안에는 슬롯이 교체되지 않는다', () => {
    const d = new Director(1);
    const first = d.update(state([car('a', { fuel_pct: 90 })]), T);
    const hot = car('b', { fuel_pct: 5 });
    const second = d.update(state([car('a', { fuel_pct: 90 }), hot], T + 1000), T + 1000);
    expect(second).toEqual(first);
  });

  it('최소 노출 시간이 지나면 더 높은 점수로 교체된다', () => {
    const d = new Director(1);
    d.update(state([car('a', { fuel_pct: 90 })]), T);
    const later = T + DIRECTOR_TIMING.minDwellMs + DIRECTOR_TIMING.slotSwapIntervalMs + 100;
    const picks = d.update(
      state([car('a', { fuel_pct: 90, last_event_ts: later }), car('b', { fuel_pct: 3, last_event_ts: later })], later),
      later,
    );
    expect(picks).toEqual(['b']);
  });

  it('핀 고정이 자동 선별보다 우선한다', () => {
    const d = new Director(1);
    d.pin('z');
    const picks = d.update(state([car('a', { fuel_pct: 1 }), car('z')]), T);
    expect(picks[0]).toBe('z');
  });

  it('핀 해제 후에는 자동 선별로 돌아간다', () => {
    const d = new Director(1);
    d.pin('z');
    d.update(state([car('a', { fuel_pct: 1 }), car('z')]), T);
    d.unpin('z');
    const later = T + DIRECTOR_TIMING.minDwellMs + DIRECTOR_TIMING.slotSwapIntervalMs + 100;
    const picks = d.update(
      state([car('a', { fuel_pct: 1, last_event_ts: later }), car('z', { last_event_ts: later })], later),
      later,
    );
    expect(picks).toEqual(['a']);
  });

  it('리타이어 차량은 선별하지 않는다', () => {
    const d = new Director(2);
    const picks = d.update(
      state([car('a', { activity: 'retired' }), car('b'), car('c')]),
      T,
    );
    expect(picks).not.toContain('a');
  });

  it('같은 차량을 슬롯 두 개에 동시에 넣지 않는다', () => {
    const d = new Director(3);
    const picks = d.update(state([car('a'), car('b'), car('c')]), T);
    expect(new Set(picks).size).toBe(picks.length);
  });
});
