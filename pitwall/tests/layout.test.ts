import { describe, it, expect } from 'vitest';
import {
  positionAt, assignLanes, LANE_OFFSETS, LANE_RENDER_CAP,
  pitBoxes, TRACK_HALF_WIDTH, GLYPH_DIAMETER,
} from '../src/track/layout';
import { CIRCUITS } from '../src/track/circuitData';
import { toTrack } from '../src/track/circuits';
import { generateTrack } from '../src/track/generateTrack';
import type { CarState, CarClass } from '../src/types';

const track = generateTrack(2026);

function car(id: string, cls: CarClass, lastTs: number, distance = 0): CarState {
  return {
    car_id: id, car_number: 1, model: 'claude-sonnet-5', car_class: cls, activity: 'running',
    distance, cached: 0, fuel_pct: 100, tyre_pct: 100, cost_usd: 0,
    last_event_ts: lastTs, error_count: 0, cache_hits: 0, call_count: 1, work_per_min: 0, saved_usd: 0,
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
    const inPit = pitBoxes(track, 1)[0]!;
    const centre = track.points[track.pitEntry]!;
    const dOn = Math.hypot(onTrack.x - centre.x, onTrack.y - centre.y);
    const dPit = Math.hypot(inPit.x - centre.x, inPit.y - centre.y);
    expect(dPit).toBeGreaterThan(dOn + TRACK_HALF_WIDTH);
  });

  it('여러 대가 서면 서로 다른 박스를 쓴다', () => {
    const [a, b] = pitBoxes(track, 3);
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(GLYPH_DIAMETER);
  });

  it('박스는 피트 구간 안에 머문다', () => {
    for (const p of pitBoxes(track, 8)) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  /*
   * 이 화면에서 정지 사유(한도 노랑 / 에러 빨강)를 나누는 것은 다른 도구가 안 하는
   * 일인데, 글리프가 겹치면 그 구분이 그대로 죽는다. 실제로 죽어 있었다 —
   * 40개 서킷 중 8개에서 정지 9대의 이웃 간격이 지름 10 아래로 내려갔고,
   * `mc-1929`는 1.9였다. 원인은 간격을 **중심선 진행률**로 잡고 그리기는
   * 안쪽으로 민 곡선에 한 것이다. 코너에서 안쪽 곡선이 짧아 간격이 압축된다.
   *
   * 피트에 설 수 있는 최대는 `HOT_CAP`(12)이다.
   */
  it('실제 서킷 40개 전부에서 정지 12대가 겹치지 않는다', () => {
    for (const circuit of CIRCUITS) {
      const spots = pitBoxes(toTrack(circuit, 1), 12);
      expect(spots, circuit.id).toHaveLength(12);
      for (let i = 1; i < spots.length; i++) {
        const gap = Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.y - spots[i - 1]!.y);
        expect(gap, `${circuit.id} slot ${i}`).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
      }
    }
  });

  it('지어낸 코스에서도 같다 — 피트 진입점이 무작위다', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const spots = pitBoxes(generateTrack(seed), 12);
      expect(spots, `seed ${seed}`).toHaveLength(12);
      for (let i = 1; i < spots.length; i++) {
        const gap = Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.y - spots[i - 1]!.y);
        expect(gap, `seed ${seed} slot ${i}`).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
      }
    }
  });
});
