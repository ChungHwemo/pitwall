import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTrack } from '../src/track/generateTrack';
import { carPose } from '../src/render/circuit3d';
import { racingLineDrawProgress } from '../src/render/idleCreep';

const track = generateTrack(2026);
const T = 1_000_000;

describe('무사용·무통신 주행선 서행 — 2026-08-09 계약', () => {
  it('유휴 차는 진행률이 멈춰도 주행선에서 결정론적으로 천천히 움직인다', () => {
    const car = { carId: 'idle-a', idle: true as const };
    const visual = 0.25;
    const times = [T, T + 2_000, T + 4_000, T + 6_000];
    const draws = times.map((now) => racingLineDrawProgress(car, visual, now));

    expect(new Set(draws.map((p) => p.toFixed(8))).size).toBeGreaterThan(1);
    expect(times.map((now) => racingLineDrawProgress(car, visual, now))).toEqual(draws);
    for (const draw of draws) {
      expect(Math.abs(draw - visual)).toBeLessThan(0.001);
    }
  });

  it('사용 중인 차는 투영 진행률을 그대로 쓴다 — 서행을 얹지 않는다', () => {
    const car = { carId: 'run-a', idle: false as const };
    expect(racingLineDrawProgress(car, 0.4, T)).toBe(0.4);
    expect(racingLineDrawProgress(car, 0.4, T + 4_000)).toBe(0.4);
  });

  it('온보드 3D 포즈도 같은 서행을 따라 월드 좌표가 바뀐다', () => {
    const car = { carId: 'idle-a', idle: true as const };
    const a = carPose(track, racingLineDrawProgress(car, 0.25, T), 'P', 0);
    const b = carPose(track, racingLineDrawProgress(car, 0.25, T + 2_000), 'P', 0);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0);
  });

  it('3D 온보드 렌더러가 서행 계약을 쓴다 — SVG만 움직이고 3D가 얼면 안 된다', () => {
    const src = readFileSync('src/render/circuit3DRenderer.ts', 'utf8');
    expect(src).toContain('racingLineDrawProgress');
  });
});
