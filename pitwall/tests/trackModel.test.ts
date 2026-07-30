import { describe, it, expect } from 'vitest';
import {
  buildTrackModel, progressOf, BINS_PER_LAP, HOT_CAP, LAP_TOKENS,
} from '../src/track/trackModel';
import type { CarClass, CarState, RaceState } from '../src/types';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, car_class: 'P', activity: 'running',
    distance: 0, cached: 0, fuel_pct: 80, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), phase: 'racing', elapsed_ms: 0, now: T };
}

import type { HighlightType, TrackModelOptions } from '../src/track/trackModel';

const OPTS: TrackModelOptions = {
  highlightTypes: ['error', 'limit'] as HighlightType[],
  fuelWarnPct: 20,
  pinned: new Set<string>(),
};
const opts = (over: Partial<TrackModelOptions> = {}): TrackModelOptions => ({ ...OPTS, ...over });

function binOf(c: CarState): number {
  return Math.floor(progressOf(c) * BINS_PER_LAP);
}

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

describe('클러스터', () => {
  it('같은 빈의 차량을 하나로 합친다', () => {
    // 40대를 100빈에 흩으면 반드시 몇몇은 같은 빈에 떨어진다.
    const cars = Array.from({ length: 40 }, (_, i) => car(`car-${i}`));
    const m = buildTrackModel(state(cars), T, opts());
    const distinctBins = new Set(cars.map(binOf)).size;

    expect(distinctBins).toBeLessThan(cars.length);        // 실제로 겹침이 있어야 의미 있는 검사다
    expect(m.clusters.length).toBe(distinctBins);          // 빈 하나에 클러스터 하나
    expect(m.clusters.reduce((n, c) => n + c.count, 0)).toBe(cars.length);
  });

  it('클래스가 다르면 같은 빈이어도 따로 센다', () => {
    const cars = [
      car('a', { car_class: 'H', distance: 0 }),
      car('b', { car_class: 'GT', distance: 0 }),
    ];
    const m = buildTrackModel(state(cars), T, opts());
    const classes = new Set(m.clusters.map((c) => c.carClass));
    expect(classes.size).toBe(2);
  });

  it('클러스터는 빈 중앙에 고정된다 — 안에서 거리가 조금 달라져도 안 움직인다', () => {
    const one = buildTrackModel(state([car('a', { distance: 0 })]), T, opts());
    const step = LAP_TOKENS / BINS_PER_LAP;
    const nudged = buildTrackModel(state([car('a', { distance: step * 0.4 })]), T, opts());
    expect(nudged.clusters[0]!.progress).toBe(one.clusters[0]!.progress);
  });

  it('빈 중앙 progress는 (bin + 0.5) / BINS다', () => {
    const m = buildTrackModel(state([car('a')]), T, opts());
    const c = m.clusters[0]!;
    expect(c.progress).toBeCloseTo((c.bin + 0.5) / BINS_PER_LAP, 12);
  });

  it('유휴·리타이어 차량은 트랙에 올리지 않는다', () => {
    const cars = [
      car('idle', { last_event_ts: T - 500_000 }),
      car('dead', { activity: 'retired' }),
    ];
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.clusters).toEqual([]);
    expect(m.hot).toEqual([]);
  });
});

describe('hot 분류', () => {
  it('에러가 난 차량을 개별로 뽑는다', () => {
    const cars = [car('a'), car('boom', { error_count: 1 })];
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.hot.map((h) => h.carId)).toEqual(['boom']);
  });

  it('연료가 임계 아래면 hot이다', () => {
    const m = buildTrackModel(state([car('low', { fuel_pct: 5 })]), T, opts());
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
    const clustered = m.clusters.reduce((n, c) => n + c.count, 0);
    expect(clustered + m.hot.length).toBe(2);
    expect(clustered).toBe(1);
  });

  it('hot 상한을 넘으면 클러스터로 강등하고 넘친 수를 노출한다', () => {
    const cars = Array.from({ length: HOT_CAP + 5 }, (_, i) =>
      car(`e${i}`, { error_count: 1, distance: i * 9_000 }));
    const m = buildTrackModel(state(cars), T, opts());
    expect(m.hot.length).toBe(HOT_CAP);
    expect(m.hotOverflow).toBe(5);
    expect(m.clusters.reduce((n, c) => n + c.count, 0)).toBe(5);
  });

  it('강등은 점수 낮은 쪽부터다 — 연료가 더 급한 차가 남는다', () => {
    const cars = [
      ...Array.from({ length: HOT_CAP }, (_, i) => car(`e${i}`, { error_count: 1 })),
      car('critical', { fuel_pct: 1, error_count: 1 }),
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
      m.clusters.reduce((n, c) => n + c.count, 0) + m.hot.length;

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
