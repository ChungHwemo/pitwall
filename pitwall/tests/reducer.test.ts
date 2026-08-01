import { describe, it, expect } from 'vitest';
import { emptyRaceState, applyEvent, activityOf, IDLE_THRESHOLD_MS, workOf, reasoningOf } from '../src/state/reducer';
import { cacheSavingOf } from '../src/state/savings';
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

describe('추론 토큰', () => {
  it('workOf는 추론을 거리에 포함한다 — 출력 과금분이라 일한 양이다', () => {
    const e = makeEvent({ tokens: { prompt: 1000, completion: 200, reasoning: 50 } });
    expect(workOf(e)).toBe(1000 + 200 + 50);
  });

  it('추론이 없으면 거리는 분리 전과 같다', () => {
    const merged = makeEvent({ tokens: { prompt: 1000, completion: 200 } });
    expect(workOf(merged)).toBe(1200);
  });

  it('reasoningOf는 추론 토큰을 낸다 — 없으면 0이다', () => {
    expect(reasoningOf(makeEvent({ tokens: { prompt: 100, completion: 10, reasoning: 7 } }))).toBe(7);
    expect(reasoningOf(makeEvent({ tokens: { prompt: 100, completion: 10 } }))).toBe(0);
  });

  it('상태에 추론을 따로 쌓는다 — 거리와 별개 값이다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ tokens: { prompt: 1000, completion: 200, reasoning: 50 } }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1000, tokens: { prompt: 500, completion: 100, reasoning: 30 } }));
    const car = s.cars.get('car-a')!;
    expect(car.reasoning).toBe(80);
    expect(car.distance).toBe(1880);
  });
});

describe('시간대별 토큰 (hourly)', () => {
  function at(hour: number): number {
    return new Date(2026, 0, 1, hour, 30, 0).getTime();
  }

  it('초기 상태는 길이 24의 0 배열이다', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent({ wall_ts: at(9) }));
    const hourly = s.cars.get('car-a')!.hourly!;
    expect(hourly).toHaveLength(24);
    expect(hourly.reduce((a, b) => a + b, 0)).toBe(1200);
  });

  it('wall_ts의 hour-of-day 칸에 작업 토큰을 쌓는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ wall_ts: at(9), tokens: { prompt: 1000, completion: 200 } }));
    s = applyEvent(s, makeEvent({ wall_ts: at(9), tokens: { prompt: 500, completion: 100 } }));
    const hourly = s.cars.get('car-a')!.hourly!;
    expect(hourly[9]).toBe(1800);
  });

  it('wall_ts가 없으면 ts의 hour로 떨어진다', () => {
    const ts = at(14);
    const { wall_ts: _omit, ...noWall } = makeEvent({ ts });
    const s = applyEvent(emptyRaceState(T0), noWall as typeof noWall & { ts: number });
    expect(s.cars.get('car-a')!.hourly![14]).toBe(1200);
  });

  it('다른 시간대는 서로 섞이지 않는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ wall_ts: at(9), tokens: { prompt: 1000, completion: 0 } }));
    s = applyEvent(s, makeEvent({ wall_ts: at(13), tokens: { prompt: 700, completion: 0 } }));
    const hourly = s.cars.get('car-a')!.hourly!;
    expect(hourly[9]).toBe(1000);
    expect(hourly[13]).toBe(700);
    expect(hourly[10]).toBe(0);
  });

  it('직전 상태의 배열을 변형하지 않는다', () => {
    const before = applyEvent(emptyRaceState(T0), makeEvent({ wall_ts: at(9) }));
    const snapshot = before.cars.get('car-a')!.hourly!.slice();
    applyEvent(before, makeEvent({ wall_ts: at(9) }));
    expect(before.cars.get('car-a')!.hourly).toEqual(snapshot);
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

describe('마지막 에러 시각', () => {
  it('에러가 나면 그 시각을 기억한다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ status: 'error', ts: T0 + 5_000 }));
    expect(s.cars.get('car-a')!.last_error_ts).toBe(T0 + 5_000);
  });

  it('성공한 호출은 그 시각을 지우지 않는다 — 방금 난 문제는 계속 최근이다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ status: 'error', ts: T0 + 5_000 }));
    s = applyEvent(s, makeEvent({ ts: T0 + 6_000 }));
    expect(s.cars.get('car-a')!.last_error_ts).toBe(T0 + 5_000);
  });

  it('에러가 없으면 없다', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent());
    expect(s.cars.get('car-a')!.last_error_ts).toBeUndefined();
  });
});

describe('작업 속도', () => {
  it('호출이 잦고 크면 속도가 오른다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ ts: T0, tokens: { prompt: 10_000, completion: 0 } }));
    s = applyEvent(s, makeEvent({ ts: T0 + 60_000, tokens: { prompt: 10_000, completion: 0 } }));
    // 1분에 1만 토큰 → 분당 1만 근처
    expect(s.cars.get('car-a')!.work_per_min).toBeGreaterThan(5_000);
    expect(s.cars.get('car-a')!.work_per_min).toBeLessThan(20_000);
  });

  it('간격이 벌어지면 속도가 떨어진다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ ts: T0, tokens: { prompt: 10_000, completion: 0 } }));
    s = applyEvent(s, makeEvent({ ts: T0 + 60_000, tokens: { prompt: 10_000, completion: 0 } }));
    const fast = s.cars.get('car-a')!.work_per_min;
    s = applyEvent(s, makeEvent({ ts: T0 + 3_660_000, tokens: { prompt: 10_000, completion: 0 } }));
    expect(s.cars.get('car-a')!.work_per_min).toBeLessThan(fast);
  });

  it('첫 호출에는 속도가 없다 — 간격을 모른다', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent());
    expect(s.cars.get('car-a')!.work_per_min).toBe(0);
  });
});

describe('캐시 절약', () => {
  it('차량마다 아낀 돈을 쌓는다', () => {
    let s = emptyRaceState(T0);
    const big = { prompt: 100_000, completion: 100, cache_read: 99_000 };
    s = applyEvent(s, makeEvent({ model: 'claude-opus-5', tokens: big, cache_hit: true }));
    s = applyEvent(s, makeEvent({ model: 'claude-opus-5', tokens: big, cache_hit: true, ts: T0 + 1_000 }));
    const car = s.cars.get('car-a')!;
    expect(car.saved_usd).toBeGreaterThan(0);
    expect(car.saved_usd).toBeCloseTo(cacheSavingOf(makeEvent({
      model: 'claude-opus-5', tokens: big, cache_hit: true,
    })) * 2, 9);
  });

  /*
   * 귀속이 붙는 호출은 실측 6.7%뿐이다. 안 붙은 호출이 스킬을 지우면 무전이
   * 같은 스킬을 몇 분마다 새로 알린다 — 상태는 이어받고, 바뀔 때만 말한다.
   */
  it('귀속 없는 호출은 스킬을 지우지 않는다', () => {
    let s = emptyRaceState(T0);
    s = applyEvent(s, makeEvent({ skill: 'doctor' }));
    s = applyEvent(s, makeEvent({ ts: T0 + 1_000 }));
    expect(s.cars.get('car-a')!.skill).toBe('doctor');

    s = applyEvent(s, makeEvent({ ts: T0 + 2_000, skill: 'commit' }));
    expect(s.cars.get('car-a')!.skill).toBe('commit');
  });
});
