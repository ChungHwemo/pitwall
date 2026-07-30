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
  /** 어떤 에이전트가 돌렸는가 (general-purpose 등). 도구 메타데이터이지 개인정보가 아니다 */
  agent?: string;
  /** 어떤 스킬을 쓰고 있었는가 */
  skill?: string;
  /** 서브에이전트 호출인가 */
  sidechain?: boolean;
  tokens: {
    prompt: number;
    completion: number;
    /**
     * 캐시에서 다시 읽힌 입력 토큰. `prompt`에 포함돼 있다.
     * 실측(2026-07-30)상 전체 토큰의 96.5%가 이것이라, 작업량과 섞으면
     * "달린 거리"가 같은 컨텍스트를 다시 보낸 양이 된다.
     */
    cache_read?: number;
  };
  cache_hit: boolean;
  cost_usd: number;
  latency_ms: number;
  ttft_ms?: number;
  status: 'ok' | 'error';
  error_code?: string;
  fuel_pct: number;        // 0–100
  /** 0–100. 한도 윈도우 잔여. 소스가 없으면 부재 — 0으로 두지 않는다 (PRD §7.0) */
  tyre_pct?: number;
  /** 그 한도가 어떤 창인지 (5시간 = 300, 주간 = 10080). 창을 모르면 잔여도 못 읽는다 */
  limit_window_minutes?: number;
  /** 창이 풀리는 시각 */
  limit_resets_at?: number;
  /** 그 한도를 읽은 시각 */
  limit_observed_at?: number;
  /**
   * 화면에 찍는 원본 시각.
   *
   * 재생 소스는 `ts`를 내부 시계로 갈아끼운다 — 안 그러면 리듀서가 모든 차를
   * "오래 조용함"으로 본다. 그 대가로 원본 시각이 사라져 피드의 모든 줄이 같은
   * 시각으로 찍혔다. 표시용은 여기서 읽는다.
   */
  wall_ts?: number;
}

export type CarActivity = 'running' | 'pit' | 'retired';

export interface CarState {
  car_id: string;
  car_number: number;
  /** 지금 돌고 있는 모델. 클래스는 이 모델의 등급이라 둘은 같이 움직인다 */
  model: string;
  car_class: CarClass;
  activity: CarActivity;
  /** 달린 거리 = 실제 작업 토큰 누적 (캐시 재전송 제외) */
  distance: number;
  /** 캐시에서 다시 읽힌 토큰 누적. 거리와 섞지 않고 따로 보여준다 */
  cached: number;
  /** 비용 예산 잔여. 한도(tyre)와는 다른 축이다 — 돈이 남아도 한도에 걸릴 수 있다 */
  fuel_pct: number;
  /** 한도 윈도우 잔여. 소스가 없으면 부재 — UI는 게이지를 그리지 않는다 */
  tyre_pct?: number;
  /** 그 한도의 창 길이 (분). 5시간인지 주간인지 모르면 잔여를 읽을 수 없다 */
  limit_window_minutes?: number;
  /** 창이 풀리는 시각. 10분 뒤면 기다리고 4시간 뒤면 모델을 바꾼다 */
  limit_resets_at?: number;
  /** 그 한도를 읽은 시각. 로그에서 주운 값은 마지막 실행 때 값이다 */
  limit_observed_at?: number;
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
