import type { CarClass, CarState, RaceState } from '../types';
import { CAR_CLASSES } from '../types';
import { activityOf } from '../state/reducer';
import { LANE_RENDER_CAP } from './layout';

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

/** 한 바퀴에 해당하는 누적 토큰 */
export const LAP_TOKENS = 200_000;

/**
 * 레인당 빈 수. 트랙 둘레를 이 수로 나눈 간격이 글리프 지름(14)보다 커야 한다.
 * 늘리면 위치가 정밀해지는 대신 겹침이 돌아온다 — `trackRenderer.test.ts`가 지킨다.
 */
export const BINS_PER_LAP = 100;

/** 개별 추적할 차량 수 상한. 비싼 처리(보간·펄스)를 받는 인원이다. */
export const HOT_CAP = 12;

export type HighlightType = 'error' | 'limit';

export interface Cluster {
  key: string;
  carClass: CarClass;
  bin: number;
  /** 빈 중앙. 안에서 차가 조금 움직여도 클러스터는 떨지 않는다. */
  progress: number;
  count: number;
}

export interface HotCar {
  carId: string;
  carClass: CarClass;
  progress: number;
  reason: HighlightType | 'pinned';
  /** 클수록 급한 차 */
  score: number;
}

export interface TrackModel {
  clusters: Cluster[];
  hot: HotCar[];
  /** hot 후보였지만 상한에 밀려 클러스터로 내려간 수. 조용히 버리지 않는다. */
  hotOverflow: number;
  /** 레인 렌더 상한 초과분 (PRD §6.4) */
  laneOverflow: Record<CarClass, number>;
}

export interface TrackModelOptions {
  highlightTypes: HighlightType[];
  fuelWarnPct: number;
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

/** hot 사유. 해당 없으면 null이며, 그런 차는 클러스터로 간다. */
function highlightOf(car: CarState, opts: TrackModelOptions): HotCar['reason'] | null {
  // 핀은 사용자가 직접 고른 차다. 필터보다 우선한다.
  if (opts.pinned.has(car.car_id)) return 'pinned';
  if (opts.highlightTypes.includes('error') && car.error_count > 0) return 'error';
  if (opts.highlightTypes.includes('limit') && car.fuel_pct < opts.fuelWarnPct) return 'limit';
  return null;
}

function scoreOf(car: CarState, reason: HotCar['reason']): number {
  if (reason === 'pinned') return Number.POSITIVE_INFINITY;
  // 연료가 적을수록 급하다. 에러는 기본 가중치를 준다.
  return (reason === 'error' ? 100 : 0) + (100 - car.fuel_pct);
}

export function buildTrackModel(
  state: RaceState,
  now: number,
  opts: TrackModelOptions,
): TrackModel {
  const running: CarState[] = [];
  for (const car of state.cars.values()) {
    if (activityOf(car, now) === 'running') running.push(car);
  }

  // 1. hot을 먼저 뽑는다. 사건이 난 차는 붐빈다고 잘려나가면 안 된다 —
  //    레인 상한은 밀도 조절 장치이지 사건을 버리는 장치가 아니다.
  const candidates: HotCar[] = [];
  const cold: CarState[] = [];
  for (const car of running) {
    const reason = highlightOf(car, opts);
    if (reason === null) {
      cold.push(car);
      continue;
    }
    candidates.push({
      carId: car.car_id,
      carClass: car.car_class,
      progress: progressOf(car),
      reason,
      score: scoreOf(car, reason),
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  const hot = candidates.slice(0, HOT_CAP);
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

  const clusters = new Map<string, Cluster>();
  for (const car of clustered) {
    const bin = Math.floor(progressOf(car) * BINS_PER_LAP) % BINS_PER_LAP;
    const key = `${car.car_class}:${bin}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.count++;
    } else {
      clusters.set(key, {
        key,
        carClass: car.car_class,
        bin,
        progress: (bin + 0.5) / BINS_PER_LAP,
        count: 1,
      });
    }
  }

  return { clusters: [...clusters.values()], hot, hotOverflow, laneOverflow };
}
