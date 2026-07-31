import { describe, it, expect } from 'vitest';
import { eventRadio, phaseRadio } from '../src/radio/eventRadio';
import { stateRadio } from '../src/radio/eventRadio';
import { RoutineRadio, ROUTINE_COOLDOWN_MS } from '../src/radio/routineRadio';
import type { CarEvent, CarState } from '../src/types';

const T = 1_000_000;

function event(over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts: T, car_id: 'car-a', car_number: 17, car_class: 'P',
    model: 'claude-sonnet-5', kind: 'call',
    tokens: { prompt: 1000, completion: 200 }, cache_hit: false,
    cost_usd: 0.01, latency_ms: 3000, status: 'ok',
    fuel_pct: 80, tyre_pct: 70, ...over,
  };
}

function car(over: Partial<CarState> = {}): CarState {
  return {
    car_id: 'car-a', car_number: 17, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 50_000, cached: 0, fuel_pct: 80, tyre_pct: 70, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 97, call_count: 100, work_per_min: 0, saved_usd: 0,
    ...over,
  };
}

describe('eventRadio', () => {
  it('평범한 호출에는 침묵한다', () => {
    expect(eventRadio(event())).toBeNull();
  });

  it('에러에 발화한다', () => {
    const msg = eventRadio(event({ kind: 'error', status: 'error', error_code: 'rate_limit' }));
    expect(msg?.severity).toBe('warn');
    expect(msg?.carNumber).toBe(17);
    expect(msg?.text).toContain('rate_limit');
  });

  it('리타이어는 critical이다', () => {
    expect(eventRadio(event({ kind: 'retire' }))?.severity).toBe('critical');
  });

  it('피트인에 BOX BOX를 발화한다', () => {
    expect(eventRadio(event({ kind: 'pit_in' }))?.text).toContain('BOX BOX');
  });

  it('한도 경고에 발화한다', () => {
    expect(eventRadio(event({ kind: 'limit_warn', fuel_pct: 12 }))?.severity).toBe('warn');
  });

  it('메시지에 다른 차량과의 비교 표현이 없다', () => {
    const msgs = [
      eventRadio(event({ kind: 'error', status: 'error', error_code: 'x' })),
      eventRadio(event({ kind: 'retire' })),
      eventRadio(event({ kind: 'pit_in' })),
    ];
    for (const m of msgs) {
      expect(m!.text).not.toMatch(/다른|보다|평균 대비|순위|등/);
    }
  });

  it('메시지 id가 서로 겹치지 않는다', () => {
    const ids = [
      eventRadio(event({ kind: 'error' }))!.id,
      eventRadio(event({ kind: 'retire' }))!.id,
      phaseRadio('racing', 'formation', T)!.id,
    ];
    expect(new Set(ids).size).toBe(3);
  });
});

describe('phaseRadio', () => {
  it('racing 진입에 스타트를 알린다', () => {
    expect(phaseRadio('racing', 'formation', T)?.text).toContain('GREEN');
  });

  it('final_call 진입에 퇴근 5분 전을 알린다', () => {
    expect(phaseRadio('final_call', 'racing', T)?.text).toContain('5분');
  });

  it('chequered 진입에 체커기를 알린다', () => {
    expect(phaseRadio('chequered', 'final_call', T)?.text).toContain('CHEQUERED');
  });

  it('페이즈가 안 바뀌면 침묵한다', () => {
    expect(phaseRadio('racing', 'racing', T)).toBeNull();
  });
});

describe('RoutineRadio', () => {
  it('정상 차량에는 침묵한다', () => {
    const r = new RoutineRadio();
    expect(r.evaluate(car(), T)).toBeNull();
  });

  it('캐시 재사용률이 평소보다 낮으면 발화한다', () => {
    // 실측 정상값이 97.5%다. 임계값 80%는 거기서 나왔다 —
    // 원래 규칙(20% 미만)은 실데이터에서 영원히 침묵했다.
    const r = new RoutineRadio();
    const msg = r.evaluate(car({ cache_hits: 50, call_count: 100 }), T);
    expect(msg?.text).toContain('캐시');
  });

  it('실측 정상값(97%)에는 침묵한다', () => {
    const r = new RoutineRadio();
    expect(r.evaluate(car({ cache_hits: 97, call_count: 100 }), T)).toBeNull();
  });

  it('에러가 반복되면 발화한다', () => {
    const r = new RoutineRadio();
    expect(r.evaluate(car({ error_count: 5 }), T)?.text).toContain('실패');
  });

  it('쿨다운 안에는 같은 유형을 재발화하지 않는다', () => {
    const r = new RoutineRadio();
    const c = car({ cache_hits: 50, call_count: 100 });
    expect(r.evaluate(c, T)).not.toBeNull();
    expect(r.evaluate(c, T + 60_000)).toBeNull();
  });

  it('쿨다운이 지나면 재발화한다', () => {
    const r = new RoutineRadio();
    const c = car({ cache_hits: 50, call_count: 100 });
    r.evaluate(c, T);
    expect(r.evaluate(c, T + ROUTINE_COOLDOWN_MS + 1)).not.toBeNull();
  });

  it('호출 표본이 적으면 캐시 판단을 하지 않는다', () => {
    const r = new RoutineRadio();
    expect(r.evaluate(car({ cache_hits: 0, call_count: 3 }), T)).toBeNull();
  });

  it('차량마다 쿨다운이 독립적이다', () => {
    const r = new RoutineRadio();
    const a = car({ car_id: 'a', car_number: 1, cache_hits: 50, call_count: 100 });
    const b = car({ car_id: 'b', car_number: 2, cache_hits: 50, call_count: 100 });
    expect(r.evaluate(a, T)).not.toBeNull();
    expect(r.evaluate(b, T)).not.toBeNull();
  });

  it('쿨다운은 30분이다 — 그 아래로 내려가지 않는다', () => {
    // PRD §10.3 하드 제약. 이 상수를 낮추면 라디오가 스팸이 된다.
    expect(ROUTINE_COOLDOWN_MS).toBeGreaterThanOrEqual(1_800_000);
  });
});

describe('stateRadio', () => {
  const carAt = (over: Partial<CarState>): CarState => ({
    car_id: 'car-a', car_number: 883, model: 'gpt-5.5', car_class: 'H',
    activity: 'running', distance: 0, cached: 0, fuel_pct: 100, cost_usd: 0,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1, work_per_min: 0, saved_usd: 0, ...over,
  });

  it('계정이 모델을 갈아타면 알린다 — 실데이터에서 실제로 일어나는 사건이다', () => {
    const msg = stateRadio(carAt({}), carAt({ model: 'gpt-5.6-luna' }));
    expect(msg?.text).toBe('모델 교체 — gpt-5.5 → gpt-5.6-luna');
    expect(msg?.carNumber).toBe(883);
  });

  it('한도에 걸려 피트로 들어가면 알린다', () => {
    const msg = stateRadio(carAt({ tyre_pct: 40 }), carAt({ tyre_pct: 2 }));
    expect(msg).toMatchObject({ severity: 'warn', text: 'BOX BOX — 한도 2% 남음' });
  });

  it('한도가 풀려 복귀하면 알린다', () => {
    const msg = stateRadio(carAt({ tyre_pct: 2 }), carAt({ tyre_pct: 80 }));
    expect(msg?.text).toBe('한도 회복 — 코스 복귀');
  });

  it('아무것도 안 바뀌면 침묵한다 — 같은 줄을 반복하지 않는다', () => {
    expect(stateRadio(carAt({}), carAt({ call_count: 2 }))).toBeNull();
  });

  it('처음 등장한 차는 사건이 아니다', () => {
    expect(stateRadio(undefined, carAt({}))).toBeNull();
  });

  it('스킬에 들어가면 알린다 — 무슨 스킬을 쓰는 중인지가 이 줄의 목적이다', () => {
    const msg = stateRadio(carAt({}), carAt({ skill: 'insane-search:insane-search' }));
    expect(msg?.text).toBe('스킬 — insane-search:insane-search');
    expect(msg?.severity).toBe('info');
  });

  it('같은 스킬이 이어지면 침묵한다', () => {
    const on = { skill: 'insane-search:insane-search' };
    expect(stateRadio(carAt(on), carAt({ ...on, call_count: 2 }))).toBeNull();
  });

  /*
   * 귀속이 붙는 호출은 실측 6.7%뿐이라 "다음 호출에 스킬이 없다"는 스킬이
   * 끝났다는 뜻이 아니다. 리듀서가 값을 이어받으므로 여기까지 오지도 않지만,
   * 와도 없는 사실을 무전으로 만들지 않는다.
   */
  it('스킬이 사라져도 종료를 알리지 않는다 — 없는 사실이다', () => {
    expect(stateRadio(carAt({ skill: 'doctor' }), carAt({ skill: undefined }))).toBeNull();
  });

  it('한도가 급하면 스킬보다 한도가 먼저다', () => {
    const msg = stateRadio(carAt({ tyre_pct: 40 }), carAt({ tyre_pct: 2, skill: 'doctor' }));
    expect(msg?.text).toContain('BOX BOX');
  });
});
