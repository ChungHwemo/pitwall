import { describe, it, expect, beforeEach } from 'vitest';
import { TrackRenderer } from '../src/render/trackRenderer';
import { generateTrack } from '../src/track/generateTrack';
import { LANE_RENDER_CAP } from '../src/track/layout';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;
const track = generateTrack(2026);

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

let svg: SVGSVGElement;
beforeEach(() => {
  document.body.innerHTML = '';
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
});

describe('TrackRenderer', () => {
  it('트랙 경로를 한 번만 그린다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a')]), T);
    r.render(state([car('a')]), T + 100);
    expect(svg.querySelectorAll('path.track-centerline').length).toBe(1);
  });

  it('활동 중인 차량마다 글리프를 만든다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a'), car('b'), car('c')]), T);
    const visible = [...svg.querySelectorAll('g.car')].filter(
      (n) => (n as SVGGElement).style.opacity !== '0',
    );
    expect(visible.length).toBe(3);
  });

  it('노드를 재사용한다 — 반복 렌더에도 노드 수가 늘지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const s = state([car('a'), car('b')]);
    r.render(s, T);
    const after1 = r.nodeCount;
    for (let i = 0; i < 300; i++) r.render(s, T + i * 16);
    expect(r.nodeCount).toBe(after1);
  });

  it('차량이 줄어도 노드를 삭제하지 않고 숨긴다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a'), car('b'), car('c')]), T);
    const peak = r.nodeCount;
    r.render(state([car('a')]), T + 1000);
    expect(r.nodeCount).toBe(peak);
    const visible = [...svg.querySelectorAll('g.car')].filter(
      (n) => (n as SVGGElement).style.opacity !== '0',
    );
    expect(visible.length).toBe(1);
  });

  it('위치를 CSS transform으로 갱신한다 — SVG transform 속성 금지', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a')]), T);
    const node = svg.querySelector('g.car') as SVGGElement;
    // CSS transform만 쓴다. 속성을 쓰면 레이아웃이 무효화되어 2–5배 느려진다.
    expect(node.style.transform).toMatch(/^translate\(/);
    expect(node.getAttribute('transform')).toBeNull();
    expect(node.getAttribute('x')).toBeNull();
    expect(node.getAttribute('y')).toBeNull();
  });

  it('가시성을 CSS opacity로 갱신한다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a')]), T);
    const node = svg.querySelector('g.car') as SVGGElement;
    expect(node.style.opacity).not.toBe('');
  });

  it('레인 상한 초과분을 클러스터 수로 보고한다', () => {
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: LANE_RENDER_CAP + 5 }, (_, i) =>
      car(`c${i}`, { car_class: 'GT', distance: i * 100 }),
    );
    r.render(state(cars), T);
    expect(r.clusteredCounts.GT).toBe(5);
  });

  it('트랙 위에 텍스트 라벨을 그리지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a'), car('b')]), T);
    expect(svg.querySelectorAll('g.car text').length).toBe(0);
  });

  it('유휴 차량은 트랙에 그리지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(state([car('a', { last_event_ts: T - 500_000 })]), T);
    const visible = [...svg.querySelectorAll('g.car')].filter(
      (n) => (n as SVGGElement).style.opacity !== '0',
    );
    expect(visible.length).toBe(0);
  });

  it('출발선에서 차량이 트랙 전체에 흩어진다', () => {
    // 모든 차가 0에서 출발해 비슷한 속도로 토큰을 쌓으면 진행률이 같아져
    // 트랙 한쪽에만 뭉친다. 실측 스크린샷에서 관측된 결함 —
    // 트랙이 붐비는지 곁눈질로 읽는다는 G1이 무너진다.
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: 24 }, (_, i) => car(`c${i}`, { distance: 0 }));
    r.render(state(cars), T);

    const xs = [...svg.querySelectorAll('g.car')]
      .filter((n) => (n as SVGGElement).style.opacity !== '0')
      .map((n) => {
        const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec((n as SVGGElement).style.transform)!;
        return { x: +m[1]!, y: +m[2]! };
      });

    // 트랙은 0..1000 공간의 폐곡선이다. 네 사분면에 모두 차가 있어야 한다.
    const cx = 500, cy = 500;
    const quadrants = new Set(xs.map((p) => `${p.x < cx ? 'L' : 'R'}${p.y < cy ? 'T' : 'B'}`));
    expect(quadrants.size, `사분면 분포: ${[...quadrants]}`).toBe(4);
  });

  it('같은 차량은 같은 위치에 재현된다 — 위치가 흔들리지 않는다', () => {
    const r1 = new TrackRenderer(svg, track);
    r1.render(state([car('a')]), T);
    const first = (svg.querySelector('g.car') as SVGGElement).style.transform;

    document.body.innerHTML = '';
    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg2);
    const r2 = new TrackRenderer(svg2, track);
    r2.render(state([car('a')]), T);
    expect((svg2.querySelector('g.car') as SVGGElement).style.transform).toBe(first);
  });

  it('빈 상태에서도 예외 없이 렌더한다', () => {
    const r = new TrackRenderer(svg, track);
    expect(() => r.render(state([]), T)).not.toThrow();
  });
});
