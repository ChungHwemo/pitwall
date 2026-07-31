import type { CarActivity, CarEvent, CarState, RaceState } from '../types';

/**
 * 마지막 호출 이후 이 시간이 지나면 피트인으로 간주한다.
 * 이 신호는 '사용자 대기 / 자리 비움 / 로컬 툴 장기 실행'을 구분하지 못한다.
 * UI는 "대기 중"이라 단정하지 않고 중립적으로 IN PIT만 표시한다 (PRD §7.2).
 *
 * 90초였는데 실측에서 너무 짧았다 — 2026-07-30 기록의 호출 간격은 중앙값 6초,
 * p90 20초인데 p99가 407초다. 90초로 자르면 정상 작업 중인 계정이 간격의 2.5%마다
 * 유휴로 뒤집혀, 초당 4.7k 토큰을 태우는 줄에 IDLE이 붙는 자기모순이 화면에 났다.
 * 5분이면 같은 데이터에서 1.2%로 떨어진다.
 */
export const IDLE_THRESHOLD_MS = 300_000;

/**
 * 실제 작업 토큰 = 입력에서 캐시 재전송을 뺀 값 + 출력.
 *
 * 실측(2026-07-30, 10,734건): 캐시 읽기가 전체 토큰의 96.5%다. 이걸 거리에 넣으면
 * 화면이 "같은 컨텍스트를 다시 보낸 양"을 주행거리로 보여주게 된다.
 */
export function workOf(event: CarEvent): number {
  const cached = event.tokens.cache_read ?? 0;
  return Math.max(0, event.tokens.prompt - cached) + event.tokens.completion;
}

/** 캐시에서 다시 읽힌 토큰. 거리와 분리해 따로 표시한다. */
export function cachedOf(event: CarEvent): number {
  return event.tokens.cache_read ?? 0;
}

export function emptyRaceState(now: number): RaceState {
  return { cars: new Map(), byModel: new Map(), phase: 'pre_grid', elapsed_ms: 0, now };
}

function initialCar(event: CarEvent): CarState {
  return {
    car_id: event.car_id,
    car_number: event.car_number,
    model: event.model,
    car_class: event.car_class,
    activity: 'running',
    distance: 0,
    cached: 0,
    fuel_pct: 100,
    tyre_pct: event.tyre_pct === undefined ? undefined : 100,
    limit_window_minutes: event.limit_window_minutes,
    limit_resets_at: event.limit_resets_at,
    limit_observed_at: event.limit_observed_at,
    cost_usd: 0,
    last_event_ts: 0,
    error_count: 0,
    cache_hits: 0,
    call_count: 0,
  };
}

export function applyEvent(state: RaceState, event: CarEvent): RaceState {
  const prev = state.cars.get(event.car_id) ?? initialCar(event);

  // 리타이어는 최종 상태다. 이후 이벤트가 와도 되돌리지 않는다.
  const retired = prev.activity === 'retired' || event.kind === 'retire';

  const next: CarState = {
    ...prev,
    // 계정이 모델을 갈아타면 등급도 같이 간다. 라벨이 모델을 말하는데 색이
    // 옛 등급이면 화면이 서로 다른 소리를 한다.
    model: event.model,
    car_class: event.car_class,
    distance: prev.distance + workOf(event),
    cached: prev.cached + cachedOf(event),
    cost_usd: prev.cost_usd + event.cost_usd,
    fuel_pct: event.fuel_pct,
    tyre_pct: event.tyre_pct,
    limit_window_minutes: event.limit_window_minutes ?? prev.limit_window_minutes,
    limit_resets_at: event.limit_resets_at ?? prev.limit_resets_at,
    limit_observed_at: event.limit_observed_at ?? prev.limit_observed_at,
    last_event_ts: Math.max(prev.last_event_ts, event.ts),
    error_count: prev.error_count + (event.status === 'error' ? 1 : 0),
    last_error_ts: event.status === 'error' ? event.ts : prev.last_error_ts,
    cache_hits: prev.cache_hits + (event.cache_hit ? 1 : 0),
    call_count: prev.call_count + 1,
    activity: retired ? 'retired' : event.kind === 'pit_in' ? 'pit' : 'running',
  };

  const cars = new Map(state.cars);
  cars.set(event.car_id, next);

  // 모델별 누적. 계정이 모델을 갈아타도 그 모델이 한 일은 남는다.
  const byModel = new Map(state.byModel);
  const prevTally = byModel.get(event.model);
  byModel.set(event.model, {
    calls: (prevTally?.calls ?? 0) + 1,
    work: (prevTally?.work ?? 0) + workOf(event),
    cached: (prevTally?.cached ?? 0) + cachedOf(event),
    cost: (prevTally?.cost ?? 0) + event.cost_usd,
  });

  return { ...state, cars, byModel, now: Math.max(state.now, event.ts) };
}

export function activityOf(car: CarState, now: number): CarActivity {
  if (car.activity === 'retired') return 'retired';
  if (now - car.last_event_ts > IDLE_THRESHOLD_MS) return 'pit';
  return 'running';
}
