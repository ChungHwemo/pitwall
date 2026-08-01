import { describe, it, expect } from 'vitest';
import { hourlyProfile, hourlyCurve } from '../src/render/hourlyProfile';
import { applyEvent, emptyRaceState, workOf } from '../src/state/reducer';
import { SPARK_CHARS } from '../src/render/spark';
import type { CarEvent, CarState } from '../src/types';

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 1, model: 'm', car_class: 'P', activity: 'running',
    distance: 0, cached: 0, fuel_pct: 100, cost_usd: 0, last_event_ts: 0,
    error_count: 0, cache_hits: 0, call_count: 0, work_per_min: 0, saved_usd: 0,
    ...over,
  };
}

/** 그 시각 hour에 workOf가 쌓인다. wall_ts로 벽시계 hour를 못박는다. */
function ev(hour: number, prompt: number, cache = 0): CarEvent {
  const wall = new Date(2026, 6, 29, hour, 0, 0).getTime();
  return {
    ts: wall, wall_ts: wall, car_id: 'a', car_number: 1, car_class: 'P', model: 'm',
    kind: 'call', tokens: { prompt, completion: 0, cache_read: cache },
    cache_hit: false, cost_usd: 0, latency_ms: 0, status: 'ok', fuel_pct: 100,
  };
}

describe('hourlyProfile', () => {
  it('길이 24를 돌려준다', () => {
    expect(hourlyProfile([])).toHaveLength(24);
  });

  it('계정별 hourly를 칸별로 더한다', () => {
    const a = new Array(24).fill(0); a[9] = 100; a[10] = 50;
    const b = new Array(24).fill(0); b[9] = 30; b[14] = 70;
    const out = hourlyProfile([car('a', { hourly: a }), car('b', { hourly: b })]);
    expect(out[9]).toBe(130);
    expect(out[10]).toBe(50);
    expect(out[14]).toBe(70);
    expect(out.reduce((s, v) => s + v, 0)).toBe(250);
  });

  it('계정이 없으면 전부 0이다', () => {
    expect(hourlyProfile([])).toEqual(new Array(24).fill(0));
  });

  it('hourly가 없는 계정은 0으로 취급한다', () => {
    expect(hourlyProfile([car('a')])).toEqual(new Array(24).fill(0));
  });

  it('캐시 재전송은 프로파일에 넣지 않는다 — hourly가 workOf 기준이므로', () => {
    // prompt 1000 중 900이 캐시 재전송. 작업 토큰은 completion 포함 나머지뿐이다.
    const e = ev(10, 1000, 900);
    const s = applyEvent(emptyRaceState(0), e);
    const out = hourlyProfile(s.cars.values());
    expect(out[10]).toBe(workOf(e));
    expect(out[10]).toBe(100);
    expect(out.reduce((a, v) => a + v, 0)).toBe(100);
  });
});

describe('hourlyCurve', () => {
  it('전부 0이면 빈 문자열이다 — 곡선을 안 그린다는 신호', () => {
    expect(hourlyCurve(new Array(24).fill(0))).toBe('');
  });

  it('값이 있으면 24글자를 돌려준다', () => {
    const p = new Array(24).fill(0); p[9] = 100;
    expect(hourlyCurve(p)).toHaveLength(24);
  });

  it('가장 큰 칸은 최고 글리프다', () => {
    const p = new Array(24).fill(0); p[9] = 100; p[10] = 10;
    const out = hourlyCurve(p);
    expect(out[9]).toBe(SPARK_CHARS[SPARK_CHARS.length - 1]);
  });

  it('0인 칸은 공백이다 — 없는 시간대를 막대로 그리지 않는다', () => {
    const p = new Array(24).fill(0); p[9] = 100;
    expect(hourlyCurve(p)[0]).toBe(' ');
  });
});
