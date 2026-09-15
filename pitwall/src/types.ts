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
  /**
   * 어떤 스킬을 쓰고 있었는가. 스킬 id는 도구 메타데이터이지 개인정보가 아니다.
   *
   * **에이전트 필드는 없다.** 파서가 읽던 `attributionAgent`는 실제 로그 37,814행에
   * 존재하지 않는 키였고(항상 `undefined`), 실재하는 대응물 `agentName`은 값이
   * `외장하드 파일 분류 및 백업 분석` 같은 자연어 작업 제목이다 — 화면에 올리면
   * PRIV(이름·작업 내용 미노출)를 정면으로 어긴다. 고쳐서 살리는 것이 오답이라
   * 지웠다. `sidechain`도 같이 지웠다 — `isSidechain`은 27,889행 중 `true`가 0건이다.
   * 되살릴 일이 생기면 여기 한 줄과 `claudeCodeImport`의 한 줄이면 된다.
   */
  skill?: string;
  tokens: {
    prompt: number;
    completion: number;
    /**
     * 캐시에서 다시 읽힌 입력 토큰. `prompt`에 포함돼 있다.
     * 실측(2026-07-30)상 전체 토큰의 96.5%가 이것이라, 작업량과 섞으면
     * "달린 거리"가 같은 컨텍스트를 다시 보낸 양이 된다.
     */
    cache_read?: number;
    /**
     * 추론 토큰. 출력처럼 과금되지만 사용자에게 전달된 응답이 아니라 모델 내부
     * 추론이다 — 출력 쪽(과금)에 속하되 `completion`(실제로 돌려받은 출력)과는
     * 다른 몫이라 따로 담는다. 섞으면 "무엇을 돌려받았나"가 추론량에 묻힌다.
     * 거리(작업 토큰)에는 여전히 포함된다 — 출력 과금분이라 일한 양이 맞다.
     * 소스가 주지 않으면 부재다 (0으로 두지 않는다).
     *
     * `cache_write`는 일부러 없다 — codex·grok·copilot 로그가 캐시 쓰기 토큰을
     * 주지 않는다. 없는 값을 지어내지 않는다.
     */
    reasoning?: number;
  };
  cache_hit: boolean;
  cost_usd: number;
  latency_ms: number;
  ttft_ms?: number;
  status: 'ok' | 'error';
  error_code?: string;
  fuel_pct?: number;       // 시뮬레이터 일 예산만. LIVE·실 임포터는 부재 (PRD v2.0 QG1)
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
  /**
   * 추론 토큰 누적. 거리(distance)에 이미 포함돼 있지만(출력 과금분), 요약에서
   * 별도 값으로 보여주려고 따로도 쌓는다. 소스가 안 주면 부재 — 0으로 다룬다.
   */
  reasoning?: number;
  /**
   * 시간대별 작업 토큰 누적. 길이 24, 인덱스 = 벽시계 hour-of-day(0–23),
   * 값 = 그 시간에 쌓인 작업 토큰. 하루 요약 카드의 기여도 그리드가 읽는다.
   *
   * 벽시계 시각은 `wall_ts ?? ts`로 잰다 — 재생 소스가 `ts`를 내부 시계로
   * 갈아끼우므로(§`wall_ts` 주석) 원본 시각을 안 쓰면 모든 이벤트가 재생
   * 시각의 한 칸으로 몰린다. 소스가 안 주면 부재다 — 옛 테스트 팩토리가
   * 깨지지 않도록 `reasoning`과 같은 선택 필드로 둔다.
   */
  hourly?: number[];
  /** 비용 예산 잔여. 한도(tyre)와는 다른 축이다 — 돈이 남아도 한도에 걸릴 수 있다. 실 소스가 없으면 부재 */
  fuel_pct?: number;
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
  /** 원본 벽시계. 실시간 드레인이 ts를 내부 시계로 바꿔도 속도 분모는 이걸 쓴다. */
  last_wall_ts?: number;
  error_count: number;
  /**
   * 캐시가 아낀 돈 누적. 재전송이 전체 토큰의 99%인데 화면에서는 비율 한 칸이라
   * 아무 말도 못 하고 있었다 — 비율은 크다는 사실만 말한다.
   */
  saved_usd: number;
  /**
   * 분당 작업 토큰 (평활). 화면에서 "지금 빠른가"를 그림으로 말하는 재료다.
   *
   * 위치는 누적이라 속도를 못 말한다 — 500 tok/분과 40,000 tok/분이 화면에서
   * 0.14px/초와 11px/초로, 사람이 실제로 머무는 아래쪽이 전부 0에 눌린다.
   */
  work_per_min: number;
  /**
   * 마지막 에러 시각.
   *
   * `error_count`는 하루 누적이라 "지금 문제가 있는가"에 답하지 못한다 —
   * 아침에 한 번 실패한 계정이 종일 피트에 갇혀 있었다.
   */
  last_error_ts?: number;
  cache_hits: number;
  call_count: number;
  /**
   * 마지막으로 관측된 스킬. **지금 그 스킬을 쓰는 중이라고 주장하지 않는다** —
   * 귀속이 붙는 호출이 실측 6.7%뿐이라 "붙지 않음"은 "스킬을 안 씀"이 아니다.
   * 무전이 스킬이 바뀌는 순간만 말하는 재료이고, 값을 이어받는 이유는 귀속이
   * 띄엄띄엄 붙을 때 같은 줄을 반복하지 않기 위해서다.
   */
  skill?: string;
}

export type RacePhase =
  | 'pre_grid'      // 근무 시작 5분 전 이전
  | 'formation'     // 근무 시작 5분 전 ~ 시작
  | 'racing'
  | 'lunch_pit'
  | 'final_call'    // 근무 종료 5분 전 ~ 종료
  | 'chequered';    // 근무 종료 이후

/** 모델 하나가 오늘 무엇을 했는가. 차량이 아니라 모델 기준 집계다. */
export interface ModelTally {
  calls: number;
  work: number;
  cached: number;
  cost: number;
}

export interface RaceState {
  cars: Map<string, CarState>;
  /**
   * 모델별 누적.
   *
   * 이 화면의 원래 질문이 "어떤 모델을 어떤 에이전트가 어떻게 돌리는가"였는데
   * 상태에는 계정별 합계밖에 없었다. 계정 하나가 하루에 모델을 세 번 갈아타면
   * 그 사실이 어디에도 안 남는다.
   */
  byModel: Map<string, ModelTally>;
  phase: RacePhase;
  elapsed_ms: number;
  now: number;
}
