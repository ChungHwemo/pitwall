import { describe, it, expect } from 'vitest';
import { paceOf, formatPace, recentPace } from '../src/state/pace';
import type { CarEvent, CarState, RaceState } from '../src/types';

const T = 1_800_000_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 1, model: 'claude-opus-5', car_class: 'H', activity: 'running',
    distance: 0, cached: 0, fuel_pct: 100, cost_usd: 0,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 0, work_per_min: 0,
    ...over,
  };
}

function state(cars: CarState[], elapsed: number): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase: 'racing', elapsed_ms: elapsed, now: T };
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

  it('아직 한 푼도 안 썼으면 금액만 쓴다', () => {
    expect(formatPace({ costUsd: 0, costPerHour: 0, workPerMinute: 0 })).toBe('$0.00');
  });

  it('쓰긴 썼는데 지금 조용하면 유휴라고 말한다 — 빈칸은 고장으로 읽힌다', () => {
    expect(formatPace({ costUsd: 116.83, costPerHour: 0, workPerMinute: 0 }))
      .toBe('$116.83 · 유휴');
  });
});

describe('recentPace', () => {
  const ev = (ts: number, work: number, cost: number): CarEvent => ({
    ts, car_id: 'a', car_number: 1, car_class: 'P', model: 'm', kind: 'call',
    tokens: { prompt: work, completion: 0, cache_read: 0 },
    cache_hit: false, cost_usd: cost, latency_ms: 0, status: 'ok', fuel_pct: 100,
  });

  it('창 안의 호출만으로 속도를 낸다', () => {
    // 창 6분에 60,000 작업 토큰, $3 → 분당 10,000 · 시간당 $30
    const p = recentPace([ev(T - 60_000, 60_000, 3)], T, 6 * 60_000);
    expect(p.workPerMinute).toBe(10_000);
    expect(p.costPerHour).toBe(30);
  });

  it('창 밖은 안 센다 — 20분 쉰 계정은 0이 되어야 IDLE과 말이 맞는다', () => {
    const p = recentPace([ev(T - 20 * 60_000, 999_999, 99)], T, 6 * 60_000);
    expect(p).toEqual({ costPerHour: 0, workPerMinute: 0 });
  });

  it('기록이 없으면 0이다', () => {
    expect(recentPace([], T, 6 * 60_000)).toEqual({ costPerHour: 0, workPerMinute: 0 });
  });
});

describe('recentPace — 배속', () => {
  const ev = (ts: number, work: number, cost: number): CarEvent => ({
    ts, car_id: 'a', car_number: 1, car_class: 'P', model: 'm', kind: 'call',
    tokens: { prompt: work, completion: 0, cache_read: 0 },
    cache_hit: false, cost_usd: cost, latency_ms: 0, status: 'ok', fuel_pct: 100,
  });

  it('분모는 레이스 시간이다 — 내부 시계로 나누면 배속만큼 부풀어 오른다', () => {
    // 600배속: 레이스 30분이 내부 시계로 3초다. 그 안에 $3, 60,000 토큰.
    const internal = 1_800_000 / 600;
    const p = recentPace([ev(T - 1_000, 60_000, 3)], T, internal, 600);
    // 레이스 30분 기준 → 분당 2,000 토큰 · 시간당 $6
    expect(p.workPerMinute).toBe(2_000);
    expect(p.costPerHour).toBe(6);
  });
});
