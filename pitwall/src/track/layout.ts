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

/**
 * 피트 박스 사이 최소 거리 — **화면 거리**이지 진행률이 아니다.
 *
 * 예전에는 진행률 0.008 고정이었다. 진행률은 **중심선** 기준인데 피트 박스는
 * `PIT_LANE_OFFSET`만큼 안쪽으로 밀어서 그린다. 안쪽으로 민 곡선은 중심선보다
 * 짧으므로, 코너에서는 같은 진행률 간격이 화면에서 압축된다 — 코스가 얼마나
 * 꺾이느냐에 따라 압축률이 달라진다.
 *
 * 실측(40개 서킷, 정지 9대): 8개 서킷에서 이웃 간격이 글리프 지름 10 아래로
 * 내려갔다. 최악은 `mc-1929` 1.9 · `us-1956` 2.2 · `hu-1986` 2.3. 간격이
 * `22,24,20,22,24,13,6,3`처럼 **뒤로 갈수록 무너지는데**, 피트 진입점이
 * 가장 덜 꺾이는 구간의 *한가운데*(`flattestStretch`)라 박스가 그 구간을 벗어나
 * 코너로 들어가기 때문이다. 화면에서는 정지 차량 9대가 한 덩어리가 되어
 * 한도(노랑)와 에러(빨강)를 구분할 수도, 셀 수도 없었다.
 *
 * **기준은 글리프가 아니라 정지 표식이다.** 표식(느낌표·빈 게이지)은 글리프 위에
 * 그려져 중심에서 위로 25(`GLYPH_SIZE + 20`)까지 뻗고 글리프는 아래로 5 내려간다.
 * 레인이 세로로 서면 한 대의 표식이 앞 차의 몸통을 덮으므로 필요한 것은 지름 10이
 * 아니라 **30**이다. 실제로 1.4배(14)로 잡았을 때 글리프는 떨어졌는데 노란 게이지가
 * 여전히 위 차에 얹혔다 — 표식이 겹치면 한도와 에러를 나눈 의미가 사라진다.
 *
 * 피트 왕복은 박스에서 최대 6씩 움직인다. 이웃 둘이 서로 가까워지는 최악의 경우
 * 12가 줄어드므로, 표식 안전 거리 30에 왕복 여유 12를 더한 42를 anchor 간격으로 쓴다.
 */
const PIT_CREEP_DISTANCE = GLYPH_DIAMETER * 0.6;
const PIT_BOX_SPACING = GLYPH_DIAMETER * 3 + PIT_CREEP_DISTANCE * 2;
const PIT_CREEP_PERIOD_MS = 8_000;

/**
 * 한 바퀴로 자리가 모자랄 때, 다음 링을 얼마나 더 안쪽으로 미는가.
 *
 * 한도 차량은 `HOT_CAP`을 넘어도 hot에서 전부 보존된다(REVIEW #14) — 그래서
 * 정지 대수가 한 바퀴 용량(서킷마다 54~135대, `layout.test.ts` 실측)을 넘을 수
 * 있다. 링 간격을 `PIT_BOX_SPACING`과 같게 둬 자리 사이 최소 간격 규율을
 * 그대로 지킨다.
 */
const PIT_ROW_GAP = PIT_BOX_SPACING;

/**
 * 정지한 차가 서는 자리.
 *
 * 에러든 한도든 더 갈 수 없는 차를 주행선 위에 세워두면 두 가지가 동시에
 * 거짓이 된다 — 달리는 차의 길을 막고, 멈춘 차가 여전히 경기 중인 것처럼 보인다.
 * 실제 경기와 같이 피트로 들여보낸다.
 *
 * 박스는 피트 진입점부터 순서대로 늘어선다. 진행률을 일정하게 더하는 대신
 * **피트 레인을 실제로 걸어가며** 직전 박스에서 `PIT_BOX_SPACING`만큼 떨어진
 * 지점에 세운다. 그래서 코너에서는 자연히 더 멀리 간다.
 *
 * 한 바퀴로 `slots`를 못 채우면 더 안쪽 링으로 넘어간다 — 마지막 칸에 겹쳐
 * 세우지 않는다. 링마다 오프셋을 `PIT_ROW_GAP`만큼 더 밀어 이전 링과 겹치지
 * 않는다.
 */
export function pitBoxes(track: Track, slots: number): Point[] {
  const out: Point[] = [];
  if (slots <= 0) return out;

  const n = track.points.length;
  const step = 1 / n;                       // 폴리라인 한 마디

  for (let ring = 0; out.length < slots; ring++) {
    const lateral = PIT_LANE_OFFSET - ring * PIT_ROW_GAP;
    let progress = track.pitEntry / n;
    for (let k = 0; k < n && out.length < slots; k++) {
      const here = pitPointAt(track, progress, lateral);
      // ponytail: stopped fleets are small; use spatial buckets if hundreds become normal.
      if (out.every((other) => Math.hypot(here.x - other.x, here.y - other.y) >= PIT_BOX_SPACING)) {
        out.push(here);
      }
      progress += step;
    }
  }
  return out;
}

/** 정지 상태는 유지하되 피트 박스 안에서만 천천히 왕복한다. */
export function pitCreep(boxes: readonly Point[], slot: number, now: number): Point {
  const anchor = boxes[slot];
  const next = boxes[slot + 1] ?? boxes[slot - 1];
  if (!anchor || !next) throw new RangeError('pit creep requires two boxes');
  const dx = next.x - anchor.x;
  const dy = next.y - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  const distance = (Math.sin(now / PIT_CREEP_PERIOD_MS * Math.PI * 2) + 1)
    * PIT_CREEP_DISTANCE / 2;
  return {
    x: anchor.x + dx / length * distance,
    y: anchor.y + dy / length * distance,
  };
}

function pitPointAt(track: Track, progress: number, lateral = PIT_LANE_OFFSET): Point {
  return positionAt(track, progress, 'P', 0, lateral);
}

/**
 * 피트 레인 폴리라인.
 *
 * 세우는 곳과 그리는 곳이 **같은 함수**를 쓴다. 예전에는 레인을 8칸으로 고정해
 * 그려서 9번째 차부터는 선 밖에 떠 있었다 — 차만 안쪽에 떠 있으면 트랙을
 * 벗어난 것으로 읽힌다. 진입 직전 한 마디를 앞에 붙여 선이 코스에서 갈라져
 * 나오는 것처럼 보이게 한다.
 */
export function pitLanePoints(track: Track, boxes = 8): Point[] {
  const spots = pitBoxes(track, Math.max(2, boxes));
  const lead = pitPointAt(track, track.pitEntry / track.points.length - 1 / track.points.length);
  return [lead, ...spots];
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
