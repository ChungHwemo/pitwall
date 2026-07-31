import { describe, it, expect } from 'vitest';
import {
  positionAt, assignLanes, LANE_OFFSETS, LANE_RENDER_CAP,
  pitBoxAt, TRACK_HALF_WIDTH, GLYPH_DIAMETER,
} from '../src/track/layout';
import { generateTrack } from '../src/track/generateTrack';
import type { CarState, CarClass } from '../src/types';

const track = generateTrack(2026);

function car(id: string, cls: CarClass, lastTs: number, distance = 0): CarState {
  return {
    car_id: id, car_number: 1, model: 'claude-sonnet-5', car_class: cls, activity: 'running',
    distance, cached: 0, fuel_pct: 100, tyre_pct: 100, cost_usd: 0,
    last_event_ts: lastTs, error_count: 0, cache_hits: 0, call_count: 1, work_per_min: 0,
  };
}

describe('positionAt', () => {
  it('진행률 0과 1은 같은 지점이다 (폐곡선)', () => {
    const a = positionAt(track, 0, 'P');
    const b = positionAt(track, 1, 'P');
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it('진행률이 범위를 벗어나면 순환한다', () => {
    const a = positionAt(track, 0.25, 'P');
    const b = positionAt(track, 1.25, 'P');
    const c = positionAt(track, -0.75, 'P');
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.x).toBeCloseTo(c.x, 6);
  });

  it('클래스가 다르면 같은 진행률에서도 좌표가 다르다', () => {
    const h = positionAt(track, 0.4, 'H');
    const gt = positionAt(track, 0.4, 'GT');
    const dist = Math.hypot(h.x - gt.x, h.y - gt.y);
    expect(dist).toBeGreaterThan(1);
  });

  it('중간 진행률에서 보간된 좌표를 낸다', () => {
    const p = positionAt(track, 0.5001, 'P');
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it('세 클래스 모두 오프셋이 정의되어 있다', () => {
    expect(Object.keys(LANE_OFFSETS).sort()).toEqual(['GT', 'H', 'P']);
  });
});

describe('assignLanes', () => {
  const NOW = 1_000_000;

  it('활동 중인 차량만 트랙에 올린다', () => {
    const cars = new Map<string, CarState>([
      ['a', car('a', 'P', NOW)],
      ['b', car('b', 'P', NOW - 500_000)], // 유휴 → 피트
    ]);
    const r = assignLanes(cars, NOW);
    expect(r.visible.get('P')?.map((c) => c.car_id)).toEqual(['a']);
  });

  it('리타이어 차량은 트랙에 올리지 않는다', () => {
    const retired = { ...car('r', 'H', NOW), activity: 'retired' as const };
    const r = assignLanes(new Map([['r', retired]]), NOW);
    expect(r.visible.get('H') ?? []).toEqual([]);
  });

  it('레인 상한을 넘으면 잘라내고 넘친 수를 보고한다', () => {
    const cars = new Map<string, CarState>();
    for (let i = 0; i < LANE_RENDER_CAP + 7; i++) {
      cars.set(`c${i}`, car(`c${i}`, 'GT', NOW, i));
    }
    const r = assignLanes(cars, NOW);
    expect(r.visible.get('GT')?.length).toBe(LANE_RENDER_CAP);
    expect(r.clustered.GT).toBe(7);
  });

  it('상한 이하면 클러스터가 0이다', () => {
    const cars = new Map([['a', car('a', 'P', NOW)]]);
    expect(assignLanes(cars, NOW).clustered.P).toBe(0);
  });

  it('클래스별로 독립적으로 상한을 적용한다', () => {
    const cars = new Map<string, CarState>();
    for (let i = 0; i < LANE_RENDER_CAP + 3; i++) cars.set(`h${i}`, car(`h${i}`, 'H', NOW, i));
    for (let i = 0; i < 5; i++) cars.set(`p${i}`, car(`p${i}`, 'P', NOW, i));
    const r = assignLanes(cars, NOW);
    expect(r.clustered.H).toBe(3);
    expect(r.clustered.P).toBe(0);
    expect(r.visible.get('P')?.length).toBe(5);
  });

  it('빈 입력에서도 세 레인 키를 모두 낸다', () => {
    const r = assignLanes(new Map(), NOW);
    expect([...r.visible.keys()].sort()).toEqual(['GT', 'H', 'P']);
    expect(r.clustered).toEqual({ H: 0, P: 0, GT: 0 });
  });
});

describe('피트', () => {
  const track = generateTrack(7, { resolution: 240, lobes: 3, aspect: 1.5 });

  it('피트 박스는 트랙 바깥에 놓인다 — 정지한 차가 주행선을 막지 않는다', () => {
    const onTrack = positionAt(track, track.pitEntry / track.points.length, 'P', 0);
    const inPit = pitBoxAt(track, 0, 1);
    const centre = track.points[track.pitEntry]!;
    const dOn = Math.hypot(onTrack.x - centre.x, onTrack.y - centre.y);
    const dPit = Math.hypot(inPit.x - centre.x, inPit.y - centre.y);
    expect(dPit).toBeGreaterThan(dOn + TRACK_HALF_WIDTH);
  });

  it('여러 대가 서면 서로 다른 박스를 쓴다', () => {
    const a = pitBoxAt(track, 0, 3);
    const b = pitBoxAt(track, 1, 3);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(GLYPH_DIAMETER);
  });

  it('박스는 피트 구간 안에 머문다', () => {
    for (let i = 0; i < 8; i++) {
      const p = pitBoxAt(track, i, 8);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});
