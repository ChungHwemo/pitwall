import { TRACK_STROKE } from './generateTrack';
import type { Point, Track } from './generateTrack';
import type { CarClass, CarState } from '../types';
import { CAR_CLASSES } from '../types';
import { activityOf } from '../state/reducer';

/**
 * 클래스별 레인 중심 (중심선 기준 오프셋).
 *
 * **선 안에 들어갈 필요가 없다.** 예전에는 폭 51짜리 리본 안에 세 레인이 들어가야
 * 해서 ±14가 상한이었다. 이제 코스는 선 한 줄이고 차는 그 위에 얹힌 점이다 —
 * 미니맵에서 점이 선 양옆에 걸치는 것과 같다. 오프셋은 겹침을 막는 값이지
 * 포장 도로의 폭이 아니다.
 */
export const LANE_OFFSETS: Record<CarClass, number> = {
  H: 11,
  P: 0,
  GT: -11,
};

/**
 * 레인 안에서 차량이 좌우로 흔들릴 수 있는 폭.
 *
 * 이게 없으면 앞뒤로만 스쳐 지나가 추월이 보이지 않는다.
 * 차량마다 고정된 값이라 같은 차는 늘 같은 라인을 탄다 — 실제 드라이버처럼.
 */
/**
 * 레인 안 좌우 흔들림.
 *
 * 진행률만으로는 같은 지점에 몰린 차를 못 벌린다. 레인 간격 11에서 지터 5면
 * 이웃 레인과 최소 1은 벌어지고, 글리프 반지름 5를 얹어도 서로 물리지 않는다.
 */
export const LANE_JITTER = 5;

/** 코스 선의 절반. 피트가 선 밖에 있는지 판정하는 기준이다. */
export const TRACK_HALF_WIDTH = TRACK_STROKE / 2;

/** 글리프 지름. 피트 박스 간격의 하한이다. */
export const GLYPH_DIAMETER = 10;

/**
 * 피트 레인은 주행선을 벗어난 자리다. 실제 서킷처럼 **안쪽**으로 뺀다 —
 * 바깥으로 빼면 좌표계를 벗어나 화면 밖에 서는 코너가 생긴다. 인필드는 비어 있다.
 *
 * 선이 얇아졌다고 피트를 선 옆에 붙이면 달리는 점들과 섞인다. 기준은 선의 폭이
 * 아니라 **차가 실제로 차지하는 범위**다 — 레인 11 + 지터 5 + 글리프 반지름 5.
 */
export const PIT_LANE_OFFSET = -(LANE_OFFSETS.H + LANE_JITTER + GLYPH_DIAMETER / 2 + 14);

/** 피트 레인 선의 굵기. 주행선보다 얇아야 어느 쪽이 코스인지 안 헷갈린다. */
export const PIT_LANE_STROKE = TRACK_STROKE * 0.8;

/** 피트 박스 사이 간격 (진행률). 글리프가 겹치지 않을 만큼. */
const PIT_BOX_GAP = 0.008;

/**
 * 정지한 차가 서는 자리.
 *
 * 에러든 한도든 더 갈 수 없는 차를 주행선 위에 세워두면 두 가지가 동시에
 * 거짓이 된다 — 달리는 차의 길을 막고, 멈춘 차가 여전히 경기 중인 것처럼 보인다.
 * 실제 경기와 같이 피트로 들여보낸다.
 *
 * 박스는 피트 진입점부터 순서대로 늘어선다. 자리 번호는 호출자가 정한다.
 */
export function pitBoxAt(track: Track, slot: number, _slots: number): Point {
  return positionAt(track, pitProgressAt(track, slot), 'P', 0, PIT_LANE_OFFSET);
}

/** 피트 레인이 차지하는 진행률 구간. 레인을 그릴 때와 세울 때가 같은 식을 쓴다. */
export function pitProgressAt(track: Track, slot: number): number {
  return track.pitEntry / track.points.length + slot * PIT_BOX_GAP;
}

/** 피트 레인 폴리라인. 차만 안쪽에 떠 있으면 트랙을 벗어난 것으로 읽힌다. */
export function pitLanePoints(track: Track, boxes = 8): Point[] {
  const out: Point[] = [];
  for (let i = -1; i <= boxes; i++) {
    out.push(positionAt(track, pitProgressAt(track, i), 'P', 0, PIT_LANE_OFFSET));
  }
  return out;
}

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
  lateral?: number,
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
  // 피트처럼 레인 밖에 세울 때는 오프셋을 직접 준다.
  const offset = lateral ?? (LANE_OFFSETS[carClass] + laneLine * LANE_JITTER);

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
