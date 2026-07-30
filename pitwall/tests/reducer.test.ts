import { describe, it, expect } from 'vitest';
import { emptyRaceState, applyEvent, activityOf, IDLE_THRESHOLD_MS } from '../src/state/reducer';
import type { CarEvent } from '../src/types';

const T0 = 1_800_000_000_000;

function makeEvent(over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts: T0,
    car_id: 'car-a',
    car_number: 17,
    car_class: 'P',
    model: 'claude-sonnet-5',
    kind: 'call',
    tokens: { prompt: 1000, completion: 200 },
    cache_hit: false,
    cost_usd: 0.01,
    latency_ms: 3200,
    status: 'ok',
    fuel_pct: 90,
    tyre_pct: 80,
    ...over,
  };
}

describe('applyEvent', () => {
  it('첫 이벤트가 차량을 생성한다', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent());
    const car = s.cars.get('car-a');
    expect(car?.car_number).toBe(17);
    expect(car?.car_class).toBe('P');
    expect(car?.call_count).toBe(1);
  });

  it('달린 거리는 prompt + completion 토큰 누적이다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ tokens: { prompt: 1000, completion: 200 } }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1000, tokens: { prompt: 500, completion: 100 } }));
    expect(s.cars.get('car-a')?.distance).toBe(1800);
  });

  it('비용을 누적한다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ cost_usd: 0.01 }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1000, cost_usd: 0.02 }));
    expect(s.cars.get('car-a')?.cost_usd).toBeCloseTo(0.03, 6);
  });

  it('연료·타이어는 누적이 아니라 최신값으로 대체된다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ fuel_pct: 90, tyre_pct: 80 }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1000, fuel_pct: 62, tyre_pct: 41 }));
    const car = s.cars.get('car-a');
    expect(car?.fuel_pct).toBe(62);
    expect(car?.tyre_pct).toBe(41);
  });

  it('타이어 모드가 off면 상태에도 타이어가 없다', () => {
    const { tyre_pct: _omit, ...noTyre } = makeEvent();
    const s = applyEvent(emptyRaceState(T0), noTyre as CarEvent);
    expect(s.cars.get('car-a')?.tyre_pct).toBeUndefined();
  });

  it('에러 이벤트가 에러 카운트를 올린다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ kind: 'error', status: 'error', error_code: 'rate_limit' }));
    expect(s.cars.get('car-a')?.error_count).toBe(1);
  });

  it('캐시 히트를 센다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ cache_hit: true }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1000, cache_hit: false }));
    const car = s.cars.get('car-a');
    expect(car?.cache_hits).toBe(1);
    expect(car?.call_count).toBe(2);
  });

  it('리타이어는 최종 상태이며 이후 이벤트로 되돌아가지 않는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ kind: 'retire' }));
    expect(s.cars.get('car-a')?.activity).toBe('retired');
    s = applyEvent(s, makeEvent({ ts: T0 + 1000, kind: 'call' }));
    expect(s.cars.get('car-a')?.activity).toBe('retired');
  });

  it('차량마다 독립적으로 상태를 유지한다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ car_id: 'car-a', tokens: { prompt: 100, completion: 0 } }));
    s = applyEvent(s, makeEvent({ car_id: 'car-b', car_number: 42, tokens: { prompt: 700, completion: 0 } }));
    expect(s.cars.get('car-a')?.distance).toBe(100);
    expect(s.cars.get('car-b')?.distance).toBe(700);
  });

  it('과거로 도는 이벤트는 last_event_ts를 되돌리지 않는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ ts: T0 + 5000 }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1000 }));
    expect(s.cars.get('car-a')?.last_event_ts).toBe(T0 + 5000);
  });

  it('입력 상태를 변형하지 않는다', () => {
    const before = applyEvent(emptyRaceState(T0), makeEvent());
    const snapshot = before.cars.get('car-a')?.distance;
    applyEvent(before, makeEvent({ ts: T0 + 1000 }));
    expect(before.cars.get('car-a')?.distance).toBe(snapshot);
  });
});

describe('activityOf', () => {
  it('최근 호출한 차량은 running', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent());
    const car = s.cars.get('car-a')!;
    expect(activityOf(car, T0 + 1000)).toBe('running');
  });

  it('유휴 임계를 넘으면 pit', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent());
    const car = s.cars.get('car-a')!;
    expect(activityOf(car, T0 + IDLE_THRESHOLD_MS + 1)).toBe('pit');
  });

  it('리타이어는 시간과 무관하게 retired', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent({ kind: 'retire' }));
    const car = s.cars.get('car-a')!;
    expect(activityOf(car, T0 + 10_000_000)).toBe('retired');
  });
});

describe('현재 모델', () => {
  it('마지막으로 쓴 모델을 들고 있는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ model: 'claude-fable-5' }));
    s = applyEvent(s, makeEvent({ model: 'gpt-5.6-sol', ts: T0 + 1_000 }));
    expect(s.cars.get('car-a')!.model).toBe('gpt-5.6-sol');
  });

  it('모델이 바뀌면 클래스도 따라간다 — 라벨과 색이 어긋나면 거짓말이다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ model: 'claude-fable-5', car_class: 'H' }));
    s = applyEvent(s, makeEvent({ model: 'claude-haiku-4-5', car_class: 'GT', ts: T0 + 1_000 }));
    const car = s.cars.get('car-a')!;
    expect([car.model, car.car_class]).toEqual(['claude-haiku-4-5', 'GT']);
  });
});

describe('모델별 집계', () => {
  it('모델마다 호출·작업·캐시·비용을 쌓는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({
      model: 'claude-opus-5', cost_usd: 2,
      tokens: { prompt: 1_000, completion: 100, cache_read: 800 },
    }));
    s = applyEvent(s, makeEvent({
      model: 'claude-opus-5', ts: T0 + 1_000, cost_usd: 3,
      tokens: { prompt: 500, completion: 50, cache_read: 400 },
    }));
    s = applyEvent(s, makeEvent({ model: 'gpt-5.5', ts: T0 + 2_000, cost_usd: 1 }));

    const opus = s.byModel.get('claude-opus-5')!;
    expect(opus).toEqual({ calls: 2, work: 450, cached: 1_200, cost: 5 });
    expect(s.byModel.get('gpt-5.5')!.calls).toBe(1);
  });

  it('빈 상태에는 모델이 없다', () => {
    expect(emptyRaceState(T0).byModel.size).toBe(0);
  });
});
