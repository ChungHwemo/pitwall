import { describe, it, expect } from 'vitest';
import {
  buildTrackModel, progressOf, HOT_CAP, LAP_TOKENS,
} from '../src/track/trackModel';
import type { CarClass, CarState, RaceState } from '../src/types';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 0, cached: 0, fuel_pct: 80, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase: 'racing', elapsed_ms: 0, now: T };
}

import type { HighlightType, TrackModelOptions } from '../src/track/trackModel';

const OPTS: TrackModelOptions = {
  highlightTypes: ['error', 'limit'] as HighlightType[],
  fuelWarnPct: 20,
  limitWarnPct: 15,
  pinned: new Set<string>(),
};
const opts = (over: Partial<TrackModelOptions> = {}): TrackModelOptions => ({ ...OPTS, ...over });



describe('progressOf', () => {
  it('차량마다 다른 시작 위상을 준다', () => {
    const a = progressOf(car('car-000'));
    const b = progressOf(car('car-001'));
    expect(a).not.toBe(b);
  });

  it('같은 car_id는 항상 같은 위상이다', () => {
    expect(progressOf(car('car-042'))).toBe(progressOf(car('car-042')));
  });

  it('한 바퀴를 돌면 제자리로 온다', () => {
    expect(progressOf(car('x', { distance: LAP_TOKENS })))
      .toBeCloseTo(progressOf(car('x', { distance: 0 })), 9);
  });

  it('항상 0 이상 1 미만이다', () => {
    for (let i = 0; i < 500; i++) {
      const p = progressOf(car(`car-${i}`, { distance: i * 3571 }));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe('cold 차량', () => {
  it('모든 차량이 개별로 나온다 — 합치지 않는다', () => {
    const cars = Array.from({ length: 40 }, (_, i) => car(`car-${i}`));
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.cold.length).toBe(40);
    expect(new Set(m.cold.map((c) => c.carId)).size).toBe(40);
  });

  it('같은 레인 안에서 최소 간격이 확보된다', () => {
    const cars = Array.from({ length: 30 }, (_, i) => car(`car-${i}`, { distance: 0 }));
    const m = buildTrackModel(state(cars), T, opts());
    const sorted = m.cold.map((c) => c.progress).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThan(0.004);
    }
  });

  it('진행률이 조금 바뀌면 위치도 조금 바뀐다 — 점멸하지 않는다', () => {
    const a = buildTrackModel(state([car('a', { distance: 0 })]), T, opts());
    const b = buildTrackModel(state([car('a', { distance: LAP_TOKENS * 0.01 })]), T, opts());
    const moved = Math.abs(b.cold[0]!.progress - a.cold[0]!.progress);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(0.02);
  });

  it('차량마다 레인 안에서 타는 라인이 다르다 — 추월이 보인다', () => {
    const cars = Array.from({ length: 10 }, (_, i) => car(`car-${i}`));
    const lines = buildTrackModel(state(cars), T, opts()).cold.map((c) => c.laneLine);
    expect(new Set(lines).size).toBeGreaterThan(1);
    for (const l of lines) {
      expect(l).toBeGreaterThanOrEqual(-1);
      expect(l).toBeLessThanOrEqual(1);
    }
  });

  it('유휴·리타이어 차량은 트랙에 올리지 않는다', () => {
    const cars = [
      car('idle', { last_event_ts: T - 500_000 }),
      car('dead', { activity: 'retired' }),
    ];
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.cold).toEqual([]);
    expect(m.hot).toEqual([]);
  });
});

describe('hot 분류', () => {
  it('에러가 난 차량을 개별로 뽑는다', () => {
    const cars = [car('a'), car('boom', { error_count: 1 })];
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.hot.map((h) => h.carId)).toEqual(['boom']);
  });

  // 의도 변경: 연료(비용 예산)는 hot 사유가 아니다. 한도는 벤더가 거는 벽이고
  // 연료는 돈이라 서로 다른 축이다 — 연료로 한도를 판정하던 옛 동작을 버렸다.
  it('한도 잔여가 임계 아래면 hot이다', () => {
    const m = buildTrackModel(state([car('low', { tyre_pct: 5 })]), T, opts());
    expect(m.hot.map((h) => h.carId)).toEqual(['low']);
  });

  it('핀 고정은 필터와 무관하게 항상 hot이다', () => {
    const m = buildTrackModel(
      state([car('pinned')]), T,
      opts({ highlightTypes: [], pinned: new Set(['pinned']) }),
    );
    expect(m.hot.map((h) => h.carId)).toEqual(['pinned']);
  });

  it('hot 차량은 클러스터에 중복으로 세지 않는다', () => {
    const cars = [car('a'), car('boom', { error_count: 1 })];
    const m = buildTrackModel(state(cars), T, opts());
    const clustered = m.cold.length;
    expect(clustered + m.hot.length).toBe(2);
    expect(clustered).toBe(1);
  });

  it('hot 상한을 넘으면 클러스터로 강등하고 넘친 수를 노출한다', () => {
    const cars = Array.from({ length: HOT_CAP + 5 }, (_, i) =>
      car(`e${i}`, { error_count: 1, distance: i * 9_000 }));
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.hot.length).toBe(HOT_CAP);
    expect(m.hotOverflow).toBe(5);
    expect(m.cold.length).toBe(5);
  });

  it('강등은 점수 낮은 쪽부터다 — 한도가 더 급한 차가 남는다', () => {
    const cars = [
      ...Array.from({ length: HOT_CAP }, (_, i) => car(`e${i}`, { error_count: 1 })),
      car('critical', { tyre_pct: 1, error_count: 1 }),
    ];
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.hot.map((h) => h.carId)).toContain('critical');
  });
});

describe('필터', () => {
  it('유형을 끄면 그 유형은 hot에서 빠진다', () => {
    const cars = [car('boom', { error_count: 1 })];
    const m = buildTrackModel(state(cars), T, opts({ highlightTypes: ['limit'] }));
    expect(m.hot).toEqual([]);
  });

  it('필터를 켜도 화면의 차량 총수는 그대로다 — 트랙이 비면 안 된다', () => {
    const cars = [
      car('a'), car('b'),
      car('boom', { error_count: 1 }),
      car('low', { fuel_pct: 3 }),
    ];
    const shown = (m: ReturnType<typeof buildTrackModel>) =>
      m.cold.length + m.hot.length;

    expect(shown(buildTrackModel(state(cars), T, opts({ highlightTypes: ['error', 'limit'] })))).toBe(4);
    expect(shown(buildTrackModel(state(cars), T, opts({ highlightTypes: [] })))).toBe(4);
  });
});

describe('레인 상한', () => {
  it('사건 난 차량은 붐빈다고 잘려나가지 않는다', () => {
    // 레인 상한은 밀도 조절 장치지 사건을 버리는 장치가 아니다.
    // hot 선별이 상한보다 먼저 와야 한다.
    const crowd = Array.from({ length: 80 }, (_, i) => car(`c${i}`));
    const m = buildTrackModel(state([...crowd, car('boom', { error_count: 1 })]), T, opts());
    expect(m.hot.map((h) => h.carId)).toContain('boom');
  });

  it('클래스별 렌더 상한 초과분을 보고한다', () => {
    const cars = Array.from({ length: 45 }, (_, i) =>
      car(`c${i}`, { car_class: 'GT' as CarClass, distance: i * 4_000 }));
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.laneOverflow.GT).toBe(5);
  });
});

describe('한도 하이라이트는 한도 축에서만 나온다', () => {

  it('한도 잔여가 임계 아래면 limit으로 잡는다', () => {
    const race = state([car('car-limit', { tyre_pct: 4, fuel_pct: 100 })]);
    const model = buildTrackModel(race, T, { ...OPTS, limitWarnPct: 15 });
    expect(model.hot.map((h) => [h.carId, h.reason])).toEqual([['car-limit', 'limit']]);
  });

  it('연료가 바닥나도 한도로 부르지 않는다 — 돈과 한도는 다른 축이다', () => {
    const race = state([car('car-broke', { fuel_pct: 0, tyre_pct: 90 })]);
    const model = buildTrackModel(race, T, { ...OPTS, limitWarnPct: 15 });
    expect(model.hot).toEqual([]);
  });

  it('한도 소스가 없는 차는 한도에 걸렸다고 주장하지 않는다', () => {
    const race = state([car('car-blind', { tyre_pct: undefined, fuel_pct: 0 })]);
    const model = buildTrackModel(race, T, { ...OPTS, limitWarnPct: 15 });
    expect(model.hot).toEqual([]);
  });
});
