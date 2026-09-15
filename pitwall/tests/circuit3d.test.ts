import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTrack } from '../src/track/generateTrack';
import { positionAt } from '../src/track/layout';
import { pitLanePoints } from '../src/track/layout';
import {
  boundsOf, carPose, chaseCamera, chaseSubject, overviewCamera, openRibbonPositions, ribbonPositions, toWorld,
} from '../src/render/circuit3d';

const track = generateTrack(2026);

describe('circuit3d', () => {
  it('월드 좌표는 기존 서킷 점을 옮기기만 한다', () => {
    const b = boundsOf(track.points);
    const p = track.points[0]!;
    const w = toWorld(p, b);
    expect(w.y).toBe(0);
    expect(w.x).toBeCloseTo(p.x - b.cx);
    expect(w.z).toBeCloseTo(p.y - b.cy);
  });

  it('리본 꼭짓점 수는 기존 점마다 세그먼트 하나다 — 점을 보태거나 빼지 않는다', () => {
    const pos = ribbonPositions(track);
    expect(pos.length).toBe(track.points.length * 18);
  });

  it('차 위치는 기존 positionAt 과 같은 점이다', () => {
    const pose = carPose(track, 0.25, 'P', 0);
    const p = positionAt(track, 0.25, 'P', 0);
    const b = boundsOf(track.points);
    const w = toWorld(p, b);
    expect(pose.x).toBeCloseTo(w.x);
    expect(pose.z).toBeCloseTo(w.z);
    expect(pose.y).toBe(0);
  });

  it('피트 레인은 기존 점의 열린 리본이다 — 폐곡선이 아니다', () => {
    const pit = pitLanePoints(track, 8);
    const pos = openRibbonPositions(pit, boundsOf(track.points), 8);
    expect(pos.length).toBe((pit.length - 1) * 18);
  });

  it('중계 카메라는 차 뒤를 보고, 오버뷰는 서킷 전체를 담는다', () => {
    const b = boundsOf(track.points);
    const pose = carPose(track, 0, 'P', 0);
    const chase = chaseCamera(pose, b.span);
    const over = overviewCamera(b.span);
    expect(chase.position.y).toBeGreaterThan(pose.y);
    expect(over.position.y).toBeGreaterThan(chase.position.y);
    expect(over.lookAt).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('첫 중계 프레임은 오버뷰가 아니라 차 뒤다 — 공중 맵으로 시작하면 차는 점이 된다', () => {
    const b = boundsOf(track.points);
    const pose = carPose(track, 0.2, 'P', 0);
    const chase = chaseCamera(pose, b.span);
    const over = overviewCamera(b.span);
    const dist = Math.hypot(
      chase.position.x - pose.x, chase.position.y - pose.y, chase.position.z - pose.z,
    );
    const overDist = Math.hypot(
      over.position.x - pose.x, over.position.y - pose.y, over.position.z - pose.z,
    );
    const carLen = 9.2 * 1.6;
    const chaseDeg = (2 * Math.atan((carLen / 2) / dist) * 180) / Math.PI;
    const overDeg = (2 * Math.atan((carLen / 2) / overDist) * 180) / Math.PI;
    expect(chaseDeg).toBeGreaterThan(8);
    expect(overDeg).toBeLessThan(2);
    expect(chase.position.y).toBeLessThan(over.position.y * 0.2);
  });

  it('3D 온보드 카메라는 오버뷰에서 시작하지 않는다 — 시작하면 맵만 보인다', () => {
    const src = readFileSync('src/render/circuit3DRenderer.ts', 'utf8');
    expect(src).not.toMatch(/camPos\.set\(over/);
    expect(src).not.toMatch(/overviewCamera\(this\.bounds\.span\)/);
  });

  it('중계는 고른 차가 없어도 트랙 위 차를 따라간다 — 오버뷰로 맵을 대체하지 않는다', () => {
    const model = {
      hot: [{ carId: 'lead' }],
      cold: [{ carId: 'pack' }],
    };
    expect(chaseSubject(model, 'lead')).toBe('lead');
    expect(chaseSubject(model, null)).toBe('lead');
    expect(chaseSubject({ hot: [], cold: [{ carId: 'pack' }] }, null)).toBe('pack');
    expect(chaseSubject({ hot: [], cold: [] }, null)).toBeNull();
  });
});
