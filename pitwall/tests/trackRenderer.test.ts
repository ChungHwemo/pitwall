import { describe, it, expect, beforeEach } from 'vitest';
import { TrackRenderer, GLYPH_DIAMETER } from '../src/render/trackRenderer';
import { generateTrack } from '../src/track/generateTrack';
import { buildTrackModel, HOT_CAP } from '../src/track/trackModel';
import type { HighlightType, TrackModelOptions } from '../src/track/trackModel';
import { LANE_RENDER_CAP } from '../src/track/layout';
import { MIN_SPACING } from '../src/track/spacing';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;
const track = generateTrack(2026);

const OPTS: TrackModelOptions = {
  highlightTypes: ['error', 'limit'] as HighlightType[],
  fuelWarnPct: 20,
  limitWarnPct: 15,
  pinned: new Set<string>(),
};

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, car_class: 'P', activity: 'running',
    distance: 1000, cached: 0, fuel_pct: 80, tyre_pct: 70, cost_usd: 1,
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
  return [...svg.querySelectorAll('g.car, g.cold')]
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

  it('사건 없는 차량은 강조 없이 그린다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a'), car('b'), car('c')]), T);
    expect(svg.querySelectorAll('g.cold').length).toBe(3);
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

  it('트랙 위에 텍스트를 쓰지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: 30 }, (_, i) => car(`car-${i}`));
    r.render(model(cars), T);
    expect(svg.querySelectorAll('text').length).toBe(0);
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
    return [...svg.querySelectorAll('g.car, g.cold')]
      .map((n) => (n as SVGGElement).style.transform);
  }

  it('상태가 그대로면 프레임이 지나도 제자리에 수렴한다', () => {
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
      car('hot-0', { distance: 0 }),
    ];
    const pinned = { pinned: new Set(['hot-0']) };   // 사건 차량은 멈추므로 핀으로 본다
    r.render(model(cars, pinned), T);

    const clustersBefore = [...svg.querySelectorAll('g.cold')]
      .map((n) => (n as SVGGElement).style.transform);

    // 목표를 옮겨 hot이 보간으로 따라가게 한다.
    const moved = cars.map((c) =>
      c.car_id === 'hot-0' ? car('hot-0', { distance: 60_000 }) : c);
    const m2 = model(moved, pinned);
    const hotBefore = (svg.querySelector('g.car') as SVGGElement).style.transform;
    for (let f = 1; f <= 20; f++) r.render(m2, T + f * 16);

    expect((svg.querySelector('g.car') as SVGGElement).style.transform).not.toBe(hotBefore);
    expect([...svg.querySelectorAll('g.cold')].map((n) => (n as SVGGElement).style.transform))
      .toEqual(clustersBefore);
  });
});

describe('hot 차량 보간', () => {
  it('앵커에서 목표를 향해 점진적으로 움직인다', () => {
    const r = new TrackRenderer(svg, track);
    // 에러·한도 차량은 멈추므로 핀 고정 차량으로 본다.
    const watch = { pinned: new Set(['boom']) };
    const near = car('boom', { distance: 0 });
    r.render(model([near], watch), T);
    const start = visiblePositions()[0]!;

    const far = car('boom', { distance: 40_000 });
    const m2 = model([far], watch);
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
    const m = model([car('boom', { distance: 20_000 })], { pinned: new Set(['boom']) });
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

describe('최소 간격', () => {
  it('최소 간격이 글리프 지름보다 크다', () => {
    let perimeter = 0;
    for (let i = 0; i < track.points.length; i++) {
      const a = track.points[i]!;
      const b = track.points[(i + 1) % track.points.length]!;
      perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }
    expect(perimeter * MIN_SPACING).toBeGreaterThan(GLYPH_DIAMETER);
  });
});

describe('모션', () => {
  it('강조 없는 차량도 미끄러진다 — 순간이동하지 않는다', () => {
    // 빈 양자화 시절에는 위치가 이산값이라 한 프레임에 글리프 1.4개 거리를
    // 건너뛰었다(점멸). 지금은 매 프레임 목표를 향해 조금씩 다가간다.
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a', { distance: 0 })]), T);
    const at0 = (svg.querySelector('g.cold') as SVGGElement).style.transform;

    const far = model([car('a', { distance: 60_000 })]);
    r.render(far, T + 16);
    const afterOne = (svg.querySelector('g.cold') as SVGGElement).style.transform;
    for (let f = 2; f < 300; f++) r.render(far, T + f * 16);
    const settled = (svg.querySelector('g.cold') as SVGGElement).style.transform;

    // 한 프레임 만에 목표에 닿지 않는다.
    expect(afterOne).not.toBe(at0);
    expect(afterOne).not.toBe(settled);
  });

  it('사건 차량은 시선을 끄는 표시를 받는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const hot = svg.querySelector('g.car') as SVGGElement;
    expect(hot.getAttribute('data-reason')).toBe('error');
  });

  it('사유가 바뀌면 표시도 바뀐다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a', { tyre_pct: 5 })]), T);
    expect((svg.querySelector('g.car') as SVGGElement).getAttribute('data-reason')).toBe('limit');
  });

  it('hot은 프레임마다 위치를 직접 쓰므로 전환 애니메이션을 걸지 않는다', () => {
    // 보간과 CSS 전환을 겹치면 두 번 미끄러져 뒤처진다.
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const hot = svg.querySelector('g.car') as SVGGElement;
    expect(hot.style.transitionProperty).not.toContain('transform');
  });
});

describe('사건 차량 정지', () => {
  it('에러 난 차량은 트랙에서 멈춘다', () => {
    // 에러는 호출이 실패한 것이다 — 진전이 없었으므로 움직이면 거짓말이다.
    const r = new TrackRenderer(svg, track);
    const boom = car('boom', { error_count: 1, distance: 0 });
    r.render(model([boom]), T);
    const at0 = (svg.querySelector('g.car') as SVGGElement).style.transform;

    // 목표가 멀어져도 따라가지 않는다.
    const moved = car('boom', { error_count: 1, distance: 80_000 });
    for (let f = 1; f < 200; f++) r.render(model([moved]), T + f * 16);
    expect((svg.querySelector('g.car') as SVGGElement).style.transform).toBe(at0);
  });

  it('한도에 걸린 차량도 멈춘다', () => {
    // 한도에 막히면 호출이 안 나간다. 굴러가면 화면이 거짓말한다.
    // (의도 변경: 판정 근거를 fuel_pct에서 tyre_pct로 옮겼다 — 연료는 돈, 한도는 벽.)
    const r = new TrackRenderer(svg, track);
    r.render(model([car('low', { tyre_pct: 5, distance: 0 })]), T);
    const at0 = (svg.querySelector('g.car') as SVGGElement).style.transform;

    const moved = car('low', { tyre_pct: 5, distance: 80_000 });
    for (let f = 1; f < 200; f++) r.render(model([moved]), T + f * 16);
    expect((svg.querySelector('g.car') as SVGGElement).style.transform).toBe(at0);
  });

  it('핀 고정 차량은 멈추지 않는다 — 사건이 아니라 사용자 선택이다', () => {
    const r = new TrackRenderer(svg, track);
    const opts = { pinned: new Set(['watch']) };
    r.render(model([car('watch', { distance: 0 })], opts), T);
    const at0 = (svg.querySelector('g.car') as SVGGElement).style.transform;

    const moved = [car('watch', { distance: 80_000 })];
    for (let f = 1; f < 200; f++) r.render(model(moved, opts), T + f * 16);
    expect((svg.querySelector('g.car') as SVGGElement).style.transform).not.toBe(at0);
  });

  it('에러와 한도의 표시가 서로 다르다', () => {
    const r1 = new TrackRenderer(svg, track);
    r1.render(model([car('boom', { error_count: 1 })]), T);
    const errMark = (svg.querySelector('g.car .alert') as SVGElement).getAttribute('d');
    const errColor = (svg.querySelector('g.car .alert') as SVGElement).getAttribute('stroke');

    document.body.innerHTML = '';
    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg2);
    const r2 = new TrackRenderer(svg2, track);
    r2.render(model([car('low', { tyre_pct: 5 })]), T);
    const limMark = (svg2.querySelector('g.car .alert') as SVGElement).getAttribute('d');
    const limColor = (svg2.querySelector('g.car .alert') as SVGElement).getAttribute('stroke');

    expect(limMark).not.toBe(errMark);
    expect(limColor).not.toBe(errColor);
  });

  it('에러 난 차량에 경고 표시를 띄운다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const mark = svg.querySelector('g.car .alert') as SVGElement;
    expect(mark).not.toBeNull();
    expect(mark.style.opacity).toBe('1');
  });

  it('경고 표시는 텍스트가 아니라 도형이다', () => {
    // 트랙 위 텍스트 금지 (PRD §6.3). 느낌표도 글자로 그리지 않는다.
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    expect(svg.querySelectorAll('text').length).toBe(0);
  });

  it('핀 고정에는 경고 표시를 띄우지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('watch')], { pinned: new Set(['watch']) }), T);
    expect((svg.querySelector('g.car .alert') as SVGElement).style.opacity).toBe('0');
  });
});

describe('트랙에서 차 선택', () => {
  it('글리프를 클릭하면 그 차량을 알린다', () => {
    const r = new TrackRenderer(svg, track);
    const picked: string[] = [];
    r.onSelect((id) => picked.push(id));
    r.render(model([car('a')]), T);
    (svg.querySelector('g.cold') as unknown as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual(['a']);
  });

  it('사건 차량도 클릭할 수 있다', () => {
    const r = new TrackRenderer(svg, track);
    const picked: string[] = [];
    r.onSelect((id) => picked.push(id));
    r.render(model([car('boom', { error_count: 1 })]), T);
    (svg.querySelector('g.car') as unknown as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual(['boom']);
  });

  it('슬롯이 다른 차량을 맡으면 알림도 그 차량으로 바뀐다', () => {
    const r = new TrackRenderer(svg, track);
    const picked: string[] = [];
    r.onSelect((id) => picked.push(id));
    r.render(model([car('first')]), T);
    r.render(model([car('second')]), T + 1000);
    (svg.querySelector('g.cold') as unknown as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual(['second']);
  });

  it('선택된 차량을 트랙에서 표시한다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a'), car('b')]), T, 'a');
    const marked = [...svg.querySelectorAll('[data-selected="true"]')];
    expect(marked.length).toBe(1);
  });

  it('선택을 풀면 표시도 사라진다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a')]), T, 'a');
    r.render(model([car('a')]), T + 100, null);
    expect(svg.querySelectorAll('[data-selected="true"]').length).toBe(0);
  });
});
