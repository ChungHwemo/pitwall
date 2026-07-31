import { describe, it, expect } from 'vitest';
import {
  project, signedArea, fit, flattestStretch, turningAt, toCircuit, asTrack, RESOLUTION,
} from '../src/track/circuitShape';
import type { CircuitSource } from '../src/track/circuitShape';
import {
  generateTrack, validateShape, trackWidth, resampleByArcLength,
} from '../src/track/generateTrack';
import type { Point } from '../src/track/generateTrack';
import { pickCircuit } from '../src/track/circuits';
import { CIRCUITS } from '../src/track/circuitData';

/** 직선 두 개 + 반원 두 개. 어디가 직선인지 답을 아는 도형이다. */
function stadium(straight: number, radius: number, dense = 1200): Point[] {
  const raw: Point[] = [];
  const half = straight / 2;
  const steps = Math.floor(dense / 4);
  for (let i = 0; i < steps; i++) raw.push({ x: -half + (straight * i) / steps, y: -radius });
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / steps;
    raw.push({ x: half + radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  for (let i = 0; i < steps; i++) raw.push({ x: half - (straight * i) / steps, y: radius });
  for (let i = 0; i < steps; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / steps;
    raw.push({ x: -half + radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return resampleByArcLength(raw, RESOLUTION);
}

describe('project', () => {
  it('경도를 위도로 눌러 준다 — 안 그러면 북쪽 서킷이 옆으로 늘어난다', () => {
    // 위도 60°에서 경도 1도는 적도의 절반이다.
    const p = project([[0, 60], [1, 60]]);
    expect(p[1]!.x - p[0]!.x).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 6);
  });

  it('북쪽이 위로 오게 y를 뒤집는다', () => {
    const p = project([[0, 10], [0, 20]]);
    expect(p[1]!.y).toBeLessThan(p[0]!.y);
  });
});

describe('signedArea', () => {
  it('생성기가 만드는 코스는 음수다 — 실제 서킷도 여기 맞춰야 한다', () => {
    expect(signedArea(generateTrack(2026).points)).toBeLessThan(0);
  });

  it('뒤집으면 부호가 바뀐다', () => {
    const pts = generateTrack(7).points;
    expect(signedArea([...pts].reverse())).toBeGreaterThan(0);
  });
});

describe('fit', () => {
  const source = stadium(400, 100);
  const placed = fit(source);

  it('모양을 안 바꾼다 — 가로세로에 같은 배율을 쓴다', () => {
    const ratio = (ps: Point[]): number => {
      const xs = ps.map((p) => p.x); const ys = ps.map((p) => p.y);
      return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    };
    expect(ratio(placed.points)).toBeCloseTo(ratio(source), 6);
    expect(placed.aspect).toBeCloseTo(ratio(source), 6);
  });

  it('좌표계 안에 여백을 두고 앉는다', () => {
    const width = trackWidth(placed.aspect);
    for (const p of placed.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1000);
    }
    // 세로는 여백만 남기고 꽉 채운다 — 남기면 그만큼 화면이 빈다.
    const ys = placed.points.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(40, 6);
    expect(Math.max(...ys)).toBeCloseTo(960, 6);
  });
});

describe('flattestStretch', () => {
  const WINDOW = 12;

  /** 창 하나가 꺾이는 총량. 테스트가 답을 따로 계산해서 대조한다. */
  function windowTurn(points: Point[], start: number): number {
    let sum = 0;
    for (let k = 0; k < WINDOW; k++) sum += turningAt(points, (start + k) % points.length);
    return sum;
  }

  it('직선 위의 점을 고른다 — 피트는 메인 스트레이트 옆이다', () => {
    const straight = 400;
    const radius = 100;
    const pts = stadium(straight, radius);
    const p = pts[flattestStretch(pts, WINDOW)]!;
    // 직선 구간은 |y| = radius 이고 |x| < straight/2 다.
    expect(Math.abs(Math.abs(p.y) - radius)).toBeLessThan(radius * 0.05);
    expect(Math.abs(p.x)).toBeLessThan(straight / 2);
  });

  it('정말로 가장 덜 꺾이는 창이다 — 전부 세어서 대조한다', () => {
    const pts = stadium(400, 100);
    const picked = flattestStretch(pts, WINDOW);
    // 고른 인덱스는 창의 한가운데다. 창의 시작으로 되돌린다.
    const start = (picked - Math.floor(WINDOW / 2) + pts.length) % pts.length;
    const mine = windowTurn(pts, start);
    for (let s = 0; s < pts.length; s++) {
      expect(mine).toBeLessThanOrEqual(windowTurn(pts, s) + 1e-9);
    }
  });

  it('직선이 하나도 없어도 답을 낸다 — 문턱값이 없으므로 빈손이 없다', () => {
    const circle: Point[] = Array.from({ length: RESOLUTION }, (_, i) => {
      const a = (i / RESOLUTION) * Math.PI * 2;
      return { x: Math.cos(a) * 100, y: Math.sin(a) * 100 };
    });
    const i = flattestStretch(circle, WINDOW);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(RESOLUTION);
  });
});

describe('toCircuit', () => {
  /** 위경도 위에 그린 스타디움. 실제 서킷 하나가 들어오는 것과 같은 모양이다. */
  function source(): CircuitSource {
    const pts = stadium(0.02, 0.005, 400);
    return {
      id: 'test-1',
      name: 'Test Oval',
      location: 'Nowhere',
      lengthM: 5000,
      coordinates: pts.map((p) => [p.x, 51.9 + p.y] as [number, number]),
    };
  }

  it('검사를 통과하는 코스를 낸다', () => {
    const c = toCircuit(source())!;
    expect(c).not.toBeNull();
    expect(validateShape(asTrack(c))).toEqual([]);
  });

  it('해상도를 맞추고 좌표를 정수로 줄인다', () => {
    const c = toCircuit(source())!;
    expect(c.points.length).toBe(RESOLUTION);
    for (const [x, y] of c.points) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });

  it('감김을 생성기와 맞춘다 — 반대면 피트가 코스 밖으로 나간다', () => {
    const forward = toCircuit(source())!;
    const back = toCircuit({ ...source(), coordinates: [...source().coordinates].reverse() })!;
    expect(signedArea(asTrack(forward).points)).toBeLessThan(0);
    expect(signedArea(asTrack(back).points)).toBeLessThan(0);
  });

  it('점이 너무 적으면 만들지 않는다', () => {
    expect(toCircuit({ ...source(), coordinates: [[0, 0], [1, 1]] })).toBeNull();
  });
});

describe('pickCircuit', () => {
  it('심은 서킷이 없어도 유효한 코스를 낸다 — 화면이 죽지 않는다', () => {
    const t = pickCircuit(2026);
    expect(validateShape(t)).toEqual([]);
    expect(t.seed).toBe(2026);
  });

  it('같은 시드는 같은 코스다', () => {
    expect(pickCircuit(11).points).toEqual(pickCircuit(11).points);
  });

  it('읽을 수 없는 시드에도 코스를 낸다 — `?seed=abc`로 화면이 죽으면 안 된다', () => {
    // Number('abc')=NaN, Number('1e999')=Infinity. 둘 다 나머지 연산이 NaN이 되어
    // 배열에서 undefined를 집고, 렌더 시작 전에 TypeError로 화면이 통째로 빈다.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const t = pickCircuit(bad);
      expect(t.points.length).toBeGreaterThan(0);
      expect(validateShape(t)).toEqual([]);
      expect(Number.isFinite(t.seed)).toBe(true);
    }
  });

  it('음수·소수 시드도 배열 범위 안으로 떨어진다', () => {
    for (const seed of [-1, -999_999, 3.7, 1e15]) {
      expect(validateShape(pickCircuit(seed))).toEqual([]);
    }
  });

  it('심은 서킷은 전부 형상 검사를 통과한다 — 자기간섭은 사유가 아니다', () => {
    // 아직 안 심었으면 배열이 비어 있고, 위 폴백 검사가 그 경우를 본다.
    for (let i = 0; i < CIRCUITS.length; i++) {
      const track = pickCircuit(i);
      expect(validateShape(track)).toEqual([]);
      expect(track.points.length).toBe(RESOLUTION);
    }
  });
});
