import type { CarClass, CarState, RaceState } from '../types';
import { CAR_CLASSES } from '../types';
import { activityOf } from '../state/reducer';
import { LANE_RENDER_CAP, laneLineOf } from './layout';
import { spreadProgress } from './spacing';

/**
 * 트랙에 무엇을 그릴지 정하는 순수 함수.
 *
 * 렌더러는 이 모델을 그리기만 한다 — DOM도 시간도 여기서 모른다. 덕분에
 * jsdom 없이 테스트되고, 프레임마다 다시 계산할 필요가 없다(§ 아래 두 클록).
 *
 * **두 클록.** 상태는 이벤트 단위(초당 수십)로 바뀌는데 프레임은 초당 120번 돈다.
 * 모델은 상태가 바뀔 때만 만들고, 프레임은 hot 차량 보간값만 DOM에 쓴다.
 *
 * **겹침.** 진행률을 고정 개수 빈으로 잘라 같은 빈의 차량을 하나로 합친다.
 * 빈 간격이 글리프 지름보다 크므로 겹침이 구조적으로 생기지 않는다.
 */

/**
 * 한 바퀴에 해당하는 작업 토큰 (캐시 재전송 제외).
 *
 * 실측(2026-07-30, 가장 붐빈 하루 4,138건/8개 프로젝트):
 * 차량당 하루 작업 토큰 중앙값 209만 → **하루 10.4바퀴, 최대 27.9바퀴.**
 * 내구 레이스에 맞는 리듬이다.
 *
 * 한때 이 값을 500만으로 올린 적이 있는데, 그건 거리에 캐시 재전송이 섞여
 * 부풀려진 것을 보정하려던 것이었다. 거리에서 재전송을 빼고 나니 원래 값이 맞았다.
 *
 * 20만에서 5만으로 내렸다. 20만이면 실측 하루 42바퀴 = 한 바퀴 20분 = 0.66px/초로,
 * 실시간에서 움직임이 눈에 안 들어온다. 5만이면 하루 169바퀴 = 한 바퀴 5분이다.
 */
export const LAP_TOKENS = 50_000;

/** 개별 추적할 차량 수 상한. 비싼 처리(보간·펄스)를 받는 인원이다. */
export const HOT_CAP = 12;

export type HighlightType = 'error' | 'limit';

export interface RenderCar {
  carId: string;
  /** 0..1. 지금 얼마나 빨리 태우는가 — 위치와 별개다 */
  heat: number;
  /** 오래 조용한 차. 트랙에는 남되 흐리게 그린다 */
  idle: boolean;
  /** 트랙 라벨용. 계정 식별자가 아니라 해시에서 나온 번호다 (PRIV-3) */
  carNumber: number;
  carClass: CarClass;
  /** 겹침을 밀어낸 뒤의 진행률 */
  progress: number;
  /** 레인 안에서 타는 라인 (-1..1). 추월이 보이게 한다 */
  laneLine: number;
}

export interface HotCar {
  carId: string;
  carNumber: number;
  heat: number;
  idle: boolean;
  carClass: CarClass;
  progress: number;
  laneLine: number;
  reason: HighlightType | 'pinned';
  /** 클수록 급한 차 */
  score: number;
}

export interface TrackModel {
  /** 개별 강조 없이 달리는 차량들 */
  cold: RenderCar[];
  hot: HotCar[];
  /** hot 후보였지만 상한에 밀려 클러스터로 내려간 수. 조용히 버리지 않는다. */
  hotOverflow: number;
  /** 레인 렌더 상한 초과분 (PRD §6.4) */
  laneOverflow: Record<CarClass, number>;
}

export interface TrackModelOptions {
  highlightTypes: HighlightType[];
  /** 연료(비용 예산) 경고선. 강조 사유가 아니라 점수에만 쓴다. */
  fuelWarnPct: number;
  /** 한도 창 잔여 경고선 (%). 여기 아래로 내려간 차가 `limit`이다. */
  limitWarnPct: number;
  pinned: Set<string>;
}

/**
 * car_id에서 0..1 시작 위상을 만든다 (FNV-1a).
 *
 * 전원이 거리 0에서 출발해 비슷한 속도로 쌓으면 진행률이 영원히 같아져
 * 트랙 한쪽에 뭉친다 — "붐비는가"를 곁눈질로 읽는다는 G1이 무너진다.
 * RNG가 아니라 id 해시인 이유는 SIM-5다. 시드는 트랙 코스 생성 전용이고,
 * 차량 배치는 이벤트 데이터에서만 나와야 한다.
 */
export function progressOf(car: CarState): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < car.car_id.length; i++) {
    h ^= car.car_id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const phase = ((h >>> 0) % 10_000) / 10_000;
  return (phase + (car.distance % LAP_TOKENS) / LAP_TOKENS) % 1;
}

/**
 * 분당 작업 토큰 → 0..1 발열.
 *
 * **위치는 누적이라 속도를 못 말한다.** 벤치마크에서 확인한 대로(toki-monitor)
 * 선형 매핑은 사람이 실제로 머무는 구간을 0 근처에 눌러버린다 — 실측 계산에서
 * 500 tok/분이 0.14px/초, 40,000이 11px/초였다. 그래서 **위치는 그대로 두고**
 * 속도만 따로 말한다. 로지스틱의 가운데를 그 구간에 놓는다.
 *
 * 저쪽처럼 속도 자체를 비선형으로 만들지는 않는다 — 그러면 "한 바퀴 = 작업
 * 토큰 5만"이 깨진다. 저쪽 캐릭터는 제자리 달리기라 위치에 의미가 없다.
 */
const HEAT_MID = 1_500;
const HEAT_STEEP = 1.7;

export function heatOf(workPerMin: number): number {
  if (workPerMin <= 0) return 0;
  // 로그 축의 로지스틱. 토큰 속도는 자릿수로 움직인다.
  const x = Math.log10(workPerMin / HEAT_MID) * HEAT_STEEP;
  return 1 / (1 + Math.exp(-x * Math.LN10 / 1.6));
}

/**
 * hot 사유. 해당 없으면 null이며, 그런 차는 클러스터로 간다.
 *
 * **한도는 연료가 아니다.** 연료는 돈(비용 예산)이고 한도는 벤더가 거는 벽이다.
 * 돈이 남아도 한도에 막히고, 돈이 없어도 호출은 계속 나간다 — 둘을 한 축으로
 * 접으면 화면이 "왜 멈췄는지"를 말해주지 못한다.
 *
 * 한도 소스가 없는 차는 한도로 부르지 않는다. 없는 게이지로 임계 도달을
 * 주장하지 않는다 (PRD §9.1).
 */
function highlightOf(car: CarState, opts: TrackModelOptions): HotCar['reason'] | null {
  if (opts.highlightTypes.includes('limit')
    && car.tyre_pct !== undefined && car.tyre_pct < opts.limitWarnPct) return 'limit';
  if (opts.pinned.has(car.car_id)) return 'pinned';
  if (opts.highlightTypes.includes('error') && car.error_count > 0) return 'error';
  return null;
}

function scoreOf(car: CarState, reason: HotCar['reason']): number {
  if (reason === 'pinned') return Number.POSITIVE_INFINITY;
  // 한도가 적을수록 급하다. 에러는 기본 가중치를 준다.
  return (reason === 'error' ? 100 : 0) + (100 - (car.tyre_pct ?? 100));
}

export function buildTrackModel(
  state: RaceState,
  now: number,
  opts: TrackModelOptions,
): TrackModel {
  // 유휴라고 트랙에서 지우지 않는다. 실측에서 계정 하나가 레이스의 67%를 5분
  // 넘는 공백으로 보내는데, 그때마다 차가 사라지면 트랙이 대부분 비어 있게 된다.
  // 리타이어만 뺀다 — 그건 되돌아오지 않는 상태다.
  const running: CarState[] = [];
  for (const car of state.cars.values()) {
    if (activityOf(car, now) !== 'retired') running.push(car);
  }
  const isIdle = (car: CarState): boolean => activityOf(car, now) !== 'running';

  // 1. hot을 먼저 뽑는다. 사건이 난 차는 붐빈다고 잘려나가면 안 된다 —
  //    레인 상한은 밀도 조절 장치이지 사건을 버리는 장치가 아니다.
  const candidates: HotCar[] = [];
  for (const car of running) {
    const reason = highlightOf(car, opts);
    if (reason === null) continue;
    candidates.push({
      carId: car.car_id,
      carNumber: car.car_number,
      heat: heatOf(car.work_per_min),
      idle: isIdle(car),
      carClass: car.car_class,
      progress: progressOf(car),
      laneLine: laneLineOf(car.car_id),
      reason,
      score: scoreOf(car, reason),
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  const limits = candidates.filter((candidate) => candidate.reason === 'limit');
  const others = candidates.filter((candidate) => candidate.reason !== 'limit');
  const hot = [...limits, ...others.slice(0, Math.max(0, HOT_CAP - limits.length))];
  const hotOverflow = candidates.length - hot.length;
  const individual = new Set(hot.map((h) => h.carId));

  // 2. 개별로 안 그리는 차(cold + 상한에 밀린 hot 후보)에만 레인 상한을 적용한다.
  const demoted = running.filter((c) => !individual.has(c.car_id));
  const laneOverflow: Record<CarClass, number> = { H: 0, P: 0, GT: 0 };
  const byClass = new Map<CarClass, CarState[]>();
  for (const cls of CAR_CLASSES) byClass.set(cls, []);
  for (const car of demoted) byClass.get(car.car_class)!.push(car);

  const clustered: CarState[] = [];
  for (const cls of CAR_CLASSES) {
    const lane = byClass.get(cls)!;
    if (lane.length > LANE_RENDER_CAP) {
      // 오래 조용한 차부터 접는다 (PRD §6.4).
      lane.sort((a, b) => b.last_event_ts - a.last_event_ts);
      laneOverflow[cls] = lane.length - LANE_RENDER_CAP;
      clustered.push(...lane.slice(0, LANE_RENDER_CAP));
    } else {
      clustered.push(...lane);
    }
  }

  // 겹침은 클래스(=레인) 안에서만 생긴다. 레인별로 밀어낸다.
  const cold: RenderCar[] = [];
  for (const cls of CAR_CLASSES) {
    const lane = clustered.filter((c) => c.car_class === cls);
    const spread = spreadProgress(lane.map(progressOf));
    lane.forEach((car, i) => {
      cold.push({
        carId: car.car_id,
        carNumber: car.car_number,
        heat: heatOf(car.work_per_min),
        idle: isIdle(car),
        carClass: cls,
        progress: spread[i]!,
        laneLine: laneLineOf(car.car_id),
      });
    });
  }

  return { cold, hot, hotOverflow, laneOverflow };
}
