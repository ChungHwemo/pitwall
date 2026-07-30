import { describe, it, expect, beforeEach } from 'vitest';
import { TrackRenderer, GLYPH_DIAMETER } from '../src/render/trackRenderer';
import { generateTrack } from '../src/track/generateTrack';
import { buildTrackModel, BINS_PER_LAP, HOT_CAP } from '../src/track/trackModel';
import type { HighlightType, TrackModelOptions } from '../src/track/trackModel';
import { LANE_RENDER_CAP } from '../src/track/layout';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;
const track = generateTrack(2026);

const OPTS: TrackModelOptions = {
  highlightTypes: ['error', 'limit'] as HighlightType[],
  fuelWarnPct: 20,
  pinned: new Set<string>(),
};

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, car_class: 'P', activity: 'running',
    distance: 1000, fuel_pct: 80, tyre_pct: 70, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), phase: 'racing', elapsed_ms: 0, now: T };
}

const model = (cars: CarState[], over: Partial<TrackModelOptions> = {}) =>
  buildTrackModel(state(cars), T, { ...OPTS, ...over });

let svg: SVGSVGElement;
beforeEach(() => {
  document.body.innerHTML = '';
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
});

/** 화면에 실제로 보이는 노드의 좌표 */
function visiblePositions(): { x: number; y: number }[] {
  return [...svg.querySelectorAll('g.car, g.cluster')]
    .filter((n) => (n as SVGGElement).style.opacity !== '0')
    .map((n) => {
      const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec((n as SVGGElement).style.transform)!;
      return { x: +m[1]!, y: +m[2]! };
    });
}

describe('TrackRenderer', () => {
  it('트랙 경로를 한 번만 그린다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a')]), T);
    r.render(model([car('a')]), T + 100);
    expect(svg.querySelectorAll('path.track-centerline').length).toBe(1);
  });

  it('사건 없는 차량은 클러스터로 그린다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a'), car('b'), car('c')]), T);
    expect(svg.querySelectorAll('g.cluster').length).toBeGreaterThan(0);
    expect([...svg.querySelectorAll('g.car')]
      .filter((n) => (n as SVGGElement).style.opacity !== '0').length).toBe(0);
  });

  it('사건 차량만 개별 글리프로 그린다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a'), car('boom', { error_count: 1 })]), T);
    const hot = [...svg.querySelectorAll('g.car')]
      .filter((n) => (n as SVGGElement).style.opacity !== '0');
    expect(hot.length).toBe(1);
  });

  it('겹치지 않는다 — 어떤 두 노드도 글리프 지름보다 가깝지 않다', () => {
    const r = new TrackRenderer(svg, track);
    // 한 클래스에 상한만큼 몰아넣는다. 최악의 밀도다.
    const cars = Array.from({ length: LANE_RENDER_CAP }, (_, i) => car(`car-${i}`));
    r.render(model(cars), T);

    const pts = visiblePositions();
    expect(pts.length).toBeGreaterThan(1);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y);
        expect(d, `노드 ${i}·${j} 간격 ${d.toFixed(1)}`).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
      }
    }
  });

  it('hot을 거쳐 간 차량이 많아도 노드가 쌓이지 않는다', () => {
    // hot 노드를 car_id로 키를 잡으면 한 번이라도 사건이 난 차가 전부 남는다.
    // 클러스터에서 고친 것과 같은 결함이다 — 슬롯은 hot 상한만큼만 있으면 된다.
    const r = new TrackRenderer(svg, track);
    for (let round = 0; round < 60; round++) {
      const cars = Array.from({ length: 5 }, (_, i) =>
        car(`round${round}-car${i}`, { error_count: 1 }));
      r.render(model(cars), T + round * 1000);
    }
    expect(r.nodeCount).toBeLessThanOrEqual(HOT_CAP + LANE_RENDER_CAP * 3);
  });

  it('최악 밀도에서도 SVG 노드 예산 800을 넘지 않는다', () => {
    // PRD §11.2. 클래스마다 레인 상한을 꽉 채우고 hot도 상한까지 띄운다.
    const r = new TrackRenderer(svg, track);
    const cars = [
      ...Array.from({ length: LANE_RENDER_CAP }, (_, i) => car(`h${i}`, { car_class: 'H' })),
      ...Array.from({ length: LANE_RENDER_CAP }, (_, i) => car(`p${i}`, { car_class: 'P' })),
      ...Array.from({ length: LANE_RENDER_CAP }, (_, i) => car(`g${i}`, { car_class: 'GT' })),
      ...Array.from({ length: HOT_CAP }, (_, i) => car(`e${i}`, { error_count: 1 })),
    ];
    // 여러 바퀴 돌려 풀이 최고치까지 자라게 한다.
    for (let lap = 0; lap <= 60; lap++) {
      r.render(model(cars.map((c) => ({ ...c, distance: lap * 7_919 }))), T + lap * 1000);
    }
    expect(svg.querySelectorAll('*').length).toBeLessThanOrEqual(800);
  });

  it('클러스터 수를 텍스트로 쓰지 않는다 — 트랙 위 라벨 금지', () => {
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: 30 }, (_, i) => car(`car-${i}`));
    r.render(model(cars), T);
    expect(svg.querySelectorAll('text').length).toBe(0);
  });

  it('여럿을 겹친 실루엣으로 표현한다 — 1 / 2 / 3+', () => {
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: 40 }, (_, i) => car(`car-${i}`));
    r.render(model(cars), T);

    // 클러스터마다 실루엣 겹 수가 count에 따라 1·2·3으로 정해진다.
    const layerCounts = [...svg.querySelectorAll('g.cluster')]
      .filter((n) => (n as SVGGElement).style.opacity !== '0')
      .map((n) => [...n.querySelectorAll('path')]
        .filter((p) => (p as SVGPathElement).style.opacity !== '0').length);

    expect(layerCounts.length).toBeGreaterThan(0);
    for (const n of layerCounts) expect([1, 2, 3]).toContain(n);
  });

  it('노드를 재사용한다 — 반복 렌더에도 노드 수가 늘지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const m = model([car('a'), car('b')]);
    r.render(m, T);
    const after1 = svg.querySelectorAll('*').length;
    for (let i = 0; i < 300; i++) r.render(m, T + i * 16);
    expect(svg.querySelectorAll('*').length).toBe(after1);
  });

  it('차량이 트랙을 돌아도 노드가 누적되지 않는다', () => {
    // 클러스터를 빈마다 만들면 차가 이동할수록 노드가 쌓인다.
    // 노드는 동시에 보이는 클러스터 수만큼만 있으면 된다 — 풀에서 재사용한다.
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: 30 }, (_, i) => car(`car-${i}`));
    const lap = (n: number) =>
      r.render(model(cars.map((c) => car(c.car_id, { distance: n * 9_137 }))), T + n * 1000);

    for (let n = 0; n <= 20; n++) lap(n);
    const warm = svg.querySelectorAll('*').length;

    // 풀은 동시 클러스터 최고치까지만 자라고 거기서 멈춘다.
    for (let n = 21; n <= 200; n++) lap(n);
    expect(svg.querySelectorAll('*').length).toBe(warm);

    // 그리고 그 최고치는 차량 수에 묶인다 — 빈 수(300)가 아니라.
    expect(r.nodeCount).toBeLessThanOrEqual(cars.length);
  });

  it('차량이 줄어도 노드를 삭제하지 않고 숨긴다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a'), car('b'), car('c')]), T);
    const peak = svg.querySelectorAll('*').length;
    r.render(model([car('a')]), T + 1000);
    expect(svg.querySelectorAll('*').length).toBe(peak);
  });

  it('위치를 CSS transform으로 갱신한다 — SVG transform 속성 금지', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const node = svg.querySelector('g.car') as SVGGElement;
    expect(node.style.transform).toMatch(/^translate\(/);
    expect(node.getAttribute('transform')).toBeNull();
    expect(node.getAttribute('x')).toBeNull();
  });

  it('유휴 차량은 트랙에 그리지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a', { last_event_ts: T - 500_000 })]), T);
    expect(visiblePositions()).toEqual([]);
  });

  it('빈 상태에서도 예외 없이 렌더한다', () => {
    const r = new TrackRenderer(svg, track);
    expect(() => r.render(model([]), T)).not.toThrow();
  });
});

describe('프레임당 DOM 갱신', () => {
  /** 모든 노드의 transform 문자열 스냅샷 */
  function snapshot(): string[] {
    return [...svg.querySelectorAll('g.car, g.cluster')]
      .map((n) => (n as SVGGElement).style.transform);
  }

  it('상태가 그대로면 클러스터는 프레임이 지나도 움직이지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const m = model(Array.from({ length: 60 }, (_, i) => car(`cold-${i}`)));
    r.render(m, T);
    const before = snapshot();

    for (let f = 1; f <= 20; f++) r.render(m, T + f * 16);
    expect(snapshot()).toEqual(before);
  });

  it('hot이 0대면 프레임이 지나도 화면이 전혀 바뀌지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const m = model(Array.from({ length: 40 }, (_, i) => car(`c${i}`)));
    expect(m.hot).toEqual([]);

    r.render(m, T);
    const before = svg.innerHTML;
    for (let f = 1; f <= 20; f++) r.render(m, T + f * 16);
    expect(svg.innerHTML).toBe(before);
  });

  it('hot 차량만 프레임마다 움직인다', () => {
    const r = new TrackRenderer(svg, track);
    const cars = [
      ...Array.from({ length: 30 }, (_, i) => car(`cold-${i}`)),
      car('hot-0', { error_count: 1, distance: 0 }),
    ];
    r.render(model(cars), T);

    const clustersBefore = [...svg.querySelectorAll('g.cluster')]
      .map((n) => (n as SVGGElement).style.transform);

    // 목표를 옮겨 hot이 보간으로 따라가게 한다.
    const moved = cars.map((c) =>
      c.car_id === 'hot-0' ? car('hot-0', { error_count: 1, distance: 60_000 }) : c);
    const m2 = model(moved);
    const hotBefore = (svg.querySelector('g.car') as SVGGElement).style.transform;
    for (let f = 1; f <= 20; f++) r.render(m2, T + f * 16);

    expect((svg.querySelector('g.car') as SVGGElement).style.transform).not.toBe(hotBefore);
    expect([...svg.querySelectorAll('g.cluster')].map((n) => (n as SVGGElement).style.transform))
      .toEqual(clustersBefore);
  });
});

describe('hot 차량 보간', () => {
  it('앵커에서 목표를 향해 점진적으로 움직인다', () => {
    const r = new TrackRenderer(svg, track);
    const near = car('boom', { error_count: 1, distance: 0 });
    r.render(model([near]), T);
    const start = visiblePositions()[0]!;

    const far = car('boom', { error_count: 1, distance: 40_000 });
    const m2 = model([far]);
    r.render(m2, T + 16);
    const mid = visiblePositions()[0]!;

    for (let f = 2; f < 400; f++) r.render(m2, T + f * 16);
    const end = visiblePositions()[0]!;

    const moved = (a: typeof start, b: typeof start) => Math.hypot(a.x - b.x, a.y - b.y);
    // 한 프레임 만에 순간이동하지 않는다.
    expect(moved(start, mid)).toBeLessThan(moved(start, end));
    expect(moved(start, end)).toBeGreaterThan(0);
  });

  it('목표를 앞지르지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const m = model([car('boom', { error_count: 1, distance: 20_000 })]);
    r.render(m, T);
    for (let f = 1; f < 2000; f++) r.render(m, T + f * 16);

    const target = m.hot[0]!.progress;
    expect(r.visualProgressOf('boom')).toBeLessThanOrEqual(target + 1e-6);
  });

  it('상한을 넘어 hot에서 밀린 차량 수를 노출한다', () => {
    const cars = Array.from({ length: HOT_CAP + 4 }, (_, i) =>
      car(`e${i}`, { error_count: 1, distance: i * 9_000 }));
    const r = new TrackRenderer(svg, track);
    const m = model(cars);
    r.render(m, T);
    expect(m.hotOverflow).toBe(4);
  });
});

describe('빈 간격', () => {
  it('빈 간격이 글리프 지름보다 크다 — 겹침이 구조적으로 불가능하다', () => {
    // 이 불변식이 깨지면 BINS_PER_LAP을 줄여야 한다.
    let perimeter = 0;
    for (let i = 0; i < track.points.length; i++) {
      const a = track.points[i]!;
      const b = track.points[(i + 1) % track.points.length]!;
      perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }
    expect(perimeter / BINS_PER_LAP).toBeGreaterThan(GLYPH_DIAMETER);
  });
});
