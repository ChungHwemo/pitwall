import type { Point, Track } from './generateTrack';
import type { CarClass, CarState } from '../types';
import { CAR_CLASSES } from '../types';
import { activityOf } from '../state/reducer';

/**
 * 클래스별 레인 중심 (중심선 기준 오프셋).
 * 트랙 폭 102 안에서 세 레인이 겹치지 않게 벌린다.
 */
export const LANE_OFFSETS: Record<CarClass, number> = {
  H: 30,
  P: 0,
  GT: -30,
};

/**
 * 레인 안에서 차량이 좌우로 흔들릴 수 있는 폭.
 *
 * 이게 없으면 앞뒤로만 스쳐 지나가 추월이 보이지 않는다.
 * 차량마다 고정된 값이라 같은 차는 늘 같은 라인을 탄다 — 실제 드라이버처럼.
 */
export const LANE_JITTER = 11;

/** 한 레인에 그릴 수 있는 최대 차량 수 (PRD §6.4) */
export const LANE_RENDER_CAP = 40;

export interface LaneAssignment {
  visible: Map<CarClass, CarState[]>;
  /** 상한을 넘어 클러스터 배지로 접힌 차량 수. 조용히 버리지 않는다. */
  clustered: Record<CarClass, number>;
}

function normalize(progress: number): number {
  const p = progress % 1;
  return p < 0 ? p + 1 : p;
}

/** car_id에서 -1..1 사이의 고정 라인. 레인 안에서 어느 쪽을 타는지 정한다. */
export function laneLineOf(carId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < carId.length; i++) {
    h ^= carId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 2001) / 1000 - 1;
}

export function positionAt(
  track: Track, progress: number, carClass: CarClass, laneLine = 0,
): Point {
  const n = track.points.length;
  const t = normalize(progress) * n;
  const i = Math.floor(t) % n;
  const j = (i + 1) % n;
  const frac = t - Math.floor(t);

  const a = track.points[i]!;
  const b = track.points[j]!;
  const x = a.x + (b.x - a.x) * frac;
  const y = a.y + (b.y - a.y) * frac;

  // 진행 방향의 법선으로 레인 오프셋을 민다.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const offset = LANE_OFFSETS[carClass] + laneLine * LANE_JITTER;

  return { x: x + (-dy / len) * offset, y: y + (dx / len) * offset };
}

export function assignLanes(cars: Map<string, CarState>, now: number): LaneAssignment {
  const visible = new Map<CarClass, CarState[]>();
  const clustered: Record<CarClass, number> = { H: 0, P: 0, GT: 0 };
  for (const cls of CAR_CLASSES) visible.set(cls, []);

  for (const car of cars.values()) {
    if (activityOf(car, now) !== 'running') continue;
    visible.get(car.car_class)!.push(car);
  }

  for (const cls of CAR_CLASSES) {
    const lane = visible.get(cls)!;
    if (lane.length > LANE_RENDER_CAP) {
      // 최근 활동 순으로 남긴다 — 오래 조용한 차를 먼저 접는다.
      lane.sort((a, b) => b.last_event_ts - a.last_event_ts);
      clustered[cls] = lane.length - LANE_RENDER_CAP;
      visible.set(cls, lane.slice(0, LANE_RENDER_CAP));
    }
  }

  return { visible, clustered };
}
