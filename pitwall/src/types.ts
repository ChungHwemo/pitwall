export const CAR_CLASSES = ['H', 'P', 'GT'] as const;
export type CarClass = (typeof CAR_CLASSES)[number];

export function isCarClass(value: string): value is CarClass {
  return (CAR_CLASSES as readonly string[]).includes(value);
}

export type EventKind =
  | 'call'
  | 'error'
  | 'pit_in'
  | 'pit_out'
  | 'retire'
  | 'limit_warn';

/**
 * 시뮬레이터와 실 LiteLLM 어댑터가 공통으로 방출하는 단일 계약.
 * 프롬프트·응답 본문 필드는 의도적으로 존재하지 않는다 (PRD PRIV-4).
 */
export interface CarEvent {
  ts: number;              // epoch ms
  car_id: string;
  car_number: number;      // 1–999
  car_class: CarClass;
  model: string;
  kind: EventKind;
  session_id?: string;
  tokens: { prompt: number; completion: number };
  cache_hit: boolean;
  cost_usd: number;
  latency_ms: number;
  ttft_ms?: number;
  status: 'ok' | 'error';
  error_code?: string;
  fuel_pct: number;        // 0–100
  tyre_pct?: number;       // 0–100. 타이어 모드가 off면 부재 (PRD §7.0)
}

export type CarActivity = 'running' | 'pit' | 'retired';

export interface CarState {
  car_id: string;
  car_number: number;
  car_class: CarClass;
  activity: CarActivity;
  distance: number;        // 누적 토큰 = 달린 거리
  fuel_pct: number;
  tyre_pct?: number;       // 타이어 모드가 off면 부재. UI는 게이지 자체를 그리지 않는다
  cost_usd: number;
  last_event_ts: number;
  error_count: number;
  cache_hits: number;
  call_count: number;
}

export type RacePhase =
  | 'pre_grid'      // 근무 시작 5분 전 이전
  | 'formation'     // 근무 시작 5분 전 ~ 시작
  | 'racing'
  | 'lunch_pit'
  | 'final_call'    // 근무 종료 5분 전 ~ 종료
  | 'chequered';    // 근무 종료 이후

export interface RaceState {
  cars: Map<string, CarState>;
  phase: RacePhase;
  elapsed_ms: number;
  now: number;
}
