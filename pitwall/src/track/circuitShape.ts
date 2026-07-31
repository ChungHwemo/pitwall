import { resampleByArcLength, trackWidth } from './generateTrack';
import type { Point, Track } from './generateTrack';
import type { CircuitData } from './circuitData';

/**
 * 실제 서킷의 위경도를 코스 좌표로 옮기는 계산.
 *
 * 스크립트가 아니라 여기 두는 이유는 **검사할 수 있어야** 하기 때문이다.
 * 좌표 변환이 틀리면 화면은 조용히 이상한 모양을 그린다 — 이 저장소가 겪은
 * 레이아웃 버그가 전부 그런 식이었다.
 */

/** 코스 해상도. 예전 생성기가 화면에서 쓰던 값과 같다. */
export const RESOLUTION = 240;
/** 좌표 공간의 세로. `generateTrack`의 SPACE와 같아야 한다. */
const SPACE = 1000;
/** 코스가 좌표계 벽에 닿지 않게 두는 여백. `generateTrack`의 MARGIN과 같다. */
const MARGIN = 40;
/**
 * 가장 곧은 구간을 잴 때 보는 칸 수.
 *
 * 각도 문턱값으로 "직선"을 가르지 않는다 — OSM 궤적은 직선도 조금씩 떨리므로
 * 문턱을 세게 잡으면 아무 구간도 안 걸리고, 느슨하게 잡으면 완만한 코너가
 * 직선이 된다. 대신 **가장 덜 꺾이는 창**을 고른다. 답이 늘 있고 문턱이 없다.
 * 12칸은 한 바퀴의 5%로, 피트 레인이 차지하는 길이와 비슷하다.
 */
const PIT_WINDOW = 12;
/** 피트 진입에서 탈출까지의 칸 수. 피트 레인 8칸(진행률 0.064)을 덮는다. */
const PIT_SPAN = 18;

export interface CircuitSource {
  id: string;
  name: string;
  location: string;
  lengthM: number;
  /** GeoJSON 순서 그대로 — `[경도, 위도]` */
  coordinates: [number, number][];
}

/**
 * 위경도를 평면으로 편다.
 *
 * 경도 1도는 위도가 높을수록 짧다 — 그대로 x로 쓰면 실버스톤이 옆으로 눌린다.
 * 코스 한가운데 위도의 cos를 곱해 그 지점에서 거리비가 맞게 만든다. 서킷 하나는
 * 수 km라 이 근사의 오차는 형상에 안 보인다.
 */
export function project(coords: [number, number][]): Point[] {
  const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  // y는 뒤집는다. 화면 좌표계는 아래로 증가하므로 북쪽이 위로 오려면 부호가 반대다.
  return coords.map(([lon, lat]) => ({ x: lon * kx, y: -lat }));
}

/**
 * 부호 있는 넓이 (신발끈). 감는 방향의 부호를 읽는 데 쓴다.
 *
 * 생성기가 만드는 코스는 이 값이 **음수**다. 그 방향이라야 `positionAt`의 음수
 * 오프셋이 코스 안쪽을 가리키고, 피트 레인이 인필드에 그려진다 — 반대로 감으면
 * 피트가 바깥으로 나가 좌표계를 벗어난다.
 */
export function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * 좌표계에 앉힌다. 세로를 여백 안에 꽉 채우고 **가로에 같은 배율**을 쓴다.
 *
 * 축마다 다른 배율을 쓰면 스파가 스파가 아니게 된다 — 그러면 실제 트랙을 쓰는
 * 이유가 사라진다. 좌표계 폭은 그래서 코스가 정한다.
 */
export function fit(points: Point[]): { points: Point[]; aspect: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const aspect = w / h;

  const scale = (SPACE - MARGIN * 2) / h;
  // 세로 여백은 MARGIN, 가로 여백은 같은 비율로 늘어난 MARGIN × aspect다.
  const padX = (trackWidth(aspect) - w * scale) / 2;
  return {
    aspect,
    points: points.map((p) => ({
      x: (p.x - minX) * scale + padX,
      y: (p.y - minY) * scale + MARGIN,
    })),
  };
}

/** 점 하나를 지날 때 방향이 꺾이는 절대량 (라디안). */
export function turningAt(points: Point[], i: number): number {
  const n = points.length;
  const heading = (k: number): number => {
    const a = points[k % n]!;
    const b = points[(k + 1) % n]!;
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  let turn = heading(i) - heading((i - 1 + n) % n);
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return Math.abs(turn);
}

/**
 * 가장 덜 꺾이는 구간의 한가운데.
 *
 * 피트는 어느 서킷에서나 메인 스트레이트 옆에 있다. 출처 데이터에 피트 정보가
 * 없으므로 **모양에서 읽는다** — 없는 사실을 지어내는 것보다 낫다.
 */
export function flattestStretch(points: Point[], window = PIT_WINDOW): number {
  const n = points.length;
  const turn = Array.from({ length: n }, (_, i) => turningAt(points, i));

  let sum = 0;
  for (let k = 0; k < window; k++) sum += turn[k % n]!;
  let best = { start: 0, total: sum };
  // 폐곡선이라 창은 시작점을 넘어 이어진다. 나머지 연산으로 감아 돈다.
  for (let start = 1; start < n; start++) {
    sum += turn[(start + window - 1) % n]! - turn[start - 1]!;
    if (sum < best.total) best = { start, total: sum };
  }
  return (best.start + Math.floor(window / 2)) % n;
}

/** 서킷 하나를 코스 데이터로. 점이 너무 적으면 null. */
export function toCircuit(src: CircuitSource): CircuitData | null {
  if (src.coordinates.length < 8) return null;

  // 마지막 점이 첫 점과 같으면 폐곡선 표기다. 재표집이 알아서 닫으므로 뺀다.
  const first = src.coordinates[0]!;
  const last = src.coordinates[src.coordinates.length - 1]!;
  const open = first[0] === last[0] && first[1] === last[1]
    ? src.coordinates.slice(0, -1)
    : src.coordinates;

  const flat = project(open);
  // 출처에는 주행 방향이 없다. 생성기와 같은 감김(넓이 음수)으로 맞춘다 —
  // 반대로 감기면 피트 레인이 코스 바깥으로 나간다.
  if (signedArea(flat) > 0) flat.reverse();

  const placed = fit(flat);
  const points = resampleByArcLength(placed.points, RESOLUTION);
  const pitEntry = flattestStretch(points);

  return {
    id: src.id,
    name: src.name,
    location: src.location,
    lengthM: src.lengthM,
    aspect: Number(placed.aspect.toFixed(3)),
    pitEntry,
    pitExit: (pitEntry + PIT_SPAN) % RESOLUTION,
    points: points.map((p) => [Math.round(p.x), Math.round(p.y)] as [number, number]),
  };
}

/** 검사에 넣기 위한 형태. `circuits.ts`의 `toTrack`과 같은 변환이다. */
export function asTrack(c: CircuitData): Track {
  return {
    points: c.points.map(([x, y]) => ({ x, y })),
    pitEntry: c.pitEntry,
    pitExit: c.pitExit,
    sectors: [0, 1 / 3, 2 / 3],
    seed: 0,
    aspect: c.aspect,
  };
}
