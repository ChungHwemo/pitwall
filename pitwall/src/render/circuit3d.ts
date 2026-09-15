import { LANE_JITTER, LANE_OFFSETS, positionAt } from '../track/layout';
import type { Point, Track } from '../track/generateTrack';
import type { CarClass } from '../types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CircuitBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
  span: number;
}

export interface CarPose3D extends Vec3 {
  yaw: number;
}

export function boundsOf(points: readonly Point[]): CircuitBounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX, maxX, minY, maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    span: Math.max(maxX - minX, maxY - minY, 1),
  };
}

export function toWorld(p: Point, b: CircuitBounds): Vec3 {
  return { x: p.x - b.cx, y: 0, z: p.y - b.cy };
}

export function ribbonHalfWidth(): number {
  return LANE_OFFSETS.H + LANE_JITTER + 8;
}

function normalAt(prev: Vec3, cur: Vec3, next: Vec3): { x: number; z: number } {
  const tx = next.x - prev.x;
  const tz = next.z - prev.z;
  const len = Math.hypot(tx, tz) || 1;
  return { x: -tz / len, z: tx / len };
}

function push(out: Float32Array, o: number, p: Vec3): number {
  out[o] = p.x;
  out[o + 1] = p.y;
  out[o + 2] = p.z;
  return o + 3;
}

function offset(p: Vec3, n: { x: number; z: number }, w: number): Vec3 {
  return { x: p.x + n.x * w, y: p.y, z: p.z + n.z * w };
}

export function openRibbonPositions(
  points: readonly Point[],
  b: CircuitBounds,
  hw: number,
): Float32Array {
  const n = points.length;
  if (n < 2) return new Float32Array(0);
  const out = new Float32Array((n - 1) * 18);
  let o = 0;
  for (let i = 0; i < n - 1; i++) {
    const prev = toWorld(points[Math.max(0, i - 1)]!, b);
    const a = toWorld(points[i]!, b);
    const c = toWorld(points[i + 1]!, b);
    const next = toWorld(points[Math.min(n - 1, i + 2)]!, b);
    const na = normalAt(prev, a, c);
    const nc = normalAt(a, c, next);
    const aL = offset(a, na, hw);
    const aR = offset(a, na, -hw);
    const cL = offset(c, nc, hw);
    const cR = offset(c, nc, -hw);
    o = push(out, o, aL);
    o = push(out, o, aR);
    o = push(out, o, cL);
    o = push(out, o, aR);
    o = push(out, o, cR);
    o = push(out, o, cL);
  }
  return out;
}

/** 기존 서킷 점마다 세그먼트 하나. 점을 보태지 않는다. */
export function ribbonPositions(track: Track): Float32Array {
  const b = boundsOf(track.points);
  const hw = ribbonHalfWidth();
  const n = track.points.length;
  const out = new Float32Array(n * 18);
  let o = 0;
  for (let i = 0; i < n; i++) {
    const prev = toWorld(track.points[(i - 1 + n) % n]!, b);
    const a = toWorld(track.points[i]!, b);
    const c = toWorld(track.points[(i + 1) % n]!, b);
    const next = toWorld(track.points[(i + 2) % n]!, b);
    const na = normalAt(prev, a, c);
    const nc = normalAt(a, c, next);
    const aL = offset(a, na, hw);
    const aR = offset(a, na, -hw);
    const cL = offset(c, nc, hw);
    const cR = offset(c, nc, -hw);
    o = push(out, o, aL);
    o = push(out, o, aR);
    o = push(out, o, cL);
    o = push(out, o, aR);
    o = push(out, o, cR);
    o = push(out, o, cL);
  }
  return out;
}

export function carPose(
  track: Track, progress: number, carClass: CarClass, laneLine: number,
): CarPose3D {
  const b = boundsOf(track.points);
  const p = positionAt(track, progress, carClass, laneLine);
  const w = toWorld(p, b);
  const n = track.points.length;
  const t = ((progress % 1) + 1) % 1 * n;
  const i = Math.floor(t) % n;
  const a = toWorld(track.points[i]!, b);
  const c = toWorld(track.points[(i + 1) % n]!, b);
  return { ...w, yaw: Math.atan2(c.x - a.x, c.z - a.z) };
}

/** 중계 카메라가 따라갈 차. 고른 차가 없으면 트랙에 있는 차로 — 오버뷰로 맵을 대체하지 않는다. */
export function chaseSubject(
  model: { hot: readonly { carId: string }[]; cold: readonly { carId: string }[] },
  selected: string | null,
): string | null {
  if (selected
    && (model.hot.some((car) => car.carId === selected)
      || model.cold.some((car) => car.carId === selected))) {
    return selected;
  }
  return model.hot[0]?.carId ?? model.cold[0]?.carId ?? null;
}

export function chaseCamera(pose: CarPose3D, span: number): { position: Vec3; lookAt: Vec3 } {
  const dist = Math.max(32, span * 0.055);
  const height = Math.max(12, span * 0.022);
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  return {
    position: {
      x: pose.x - fx * dist,
      y: pose.y + height,
      z: pose.z - fz * dist,
    },
    lookAt: {
      x: pose.x + fx * dist * 0.35,
      y: pose.y + 6,
      z: pose.z + fz * dist * 0.35,
    },
  };
}

export function overviewCamera(span: number): { position: Vec3; lookAt: Vec3 } {
  return {
    position: { x: span * 0.7, y: span * 0.72, z: span * 0.7 },
    lookAt: { x: 0, y: 0, z: 0 },
  };
}
