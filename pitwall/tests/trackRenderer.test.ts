import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { TrackRenderer, GLYPH_DIAMETER, F1_CAR_PATH } from '../src/render/trackRenderer';
import { pitBoxes, positionAt } from '../src/track/layout';
import { CIRCUITS } from '../src/track/circuitData';
import { toTrack } from '../src/track/circuits';
import { generateTrack } from '../src/track/generateTrack';
import { buildTrackModel, HOT_CAP } from '../src/track/trackModel';
import type { HighlightType, TrackModelOptions } from '../src/track/trackModel';
import { LANE_RENDER_CAP } from '../src/track/layout';
import { MIN_SPACING } from '../src/track/spacing';
import type { CarState, RaceState } from '../src/types';
import { TRACK_COLOR, CLASS_STYLE, contrastRatio, BACKGROUND, EVENT_POLARITY_COLOR } from '../src/config/theme';
import { CAR_CLASSES } from '../src/types';

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
    car_id: id, car_number: 7, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 1000, cached: 0, fuel_pct: 80, tyre_pct: 70, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1, work_per_min: 0, saved_usd: 0,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase: 'racing', elapsed_ms: 0, now: T };
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

function distanceToPolyline(point: { x: number; y: number }, line: readonly { x: number; y: number }[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    nearest = Math.min(nearest, Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)));
  }
  return nearest;
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

  // 하드 룰: 트랙 위 텍스트 라벨 금지. 밀도와 무관하게 차량 글리프에는 글자를 붙이지 않는다.
  it('차량 글리프에는 글자를 붙이지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const cars = Array.from({ length: 30 }, (_, i) => car(`car-${i}`));
    r.render(model(cars), T);
    expect(svg.querySelectorAll('g.cars text').length).toBe(0);
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

  // 의도 변경: 유휴 차량도 그린다. 흐리게 그려 구분할 뿐이다.
  it('유휴 차량도 그리되 흐리게 표시한다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('q', { last_event_ts: T - 600_000 })]), T);
    const g = svg.querySelector('g.cold, g.car') as SVGGElement;
    expect(g.getAttribute('data-idle')).toBe('true');
    expect(g.getAttribute('data-freshness')).toBe('stale');
  });

  it('재사용한 그룹마다 freshness를 쓰고 fresh stopped 사유를 보존한다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([
      car('cold-fresh', { last_event_ts: T }),
      car('hot-stopped', { error_count: 1, last_event_ts: T }),
    ]), T);
    expect((svg.querySelector('g.cold') as SVGGElement).getAttribute('data-freshness')).toBe('fresh');
    const hot = svg.querySelector('g.car') as SVGGElement;
    expect(hot.getAttribute('data-freshness')).toBe('fresh');
    expect(hot.getAttribute('data-reason')).toBe('error');
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

describe('사건 차량 피트', () => {
  it('핀 고정 차량은 멈추지 않는다 — 사건이 아니라 사용자 선택이다', () => {
    const r = new TrackRenderer(svg, track);
    const opts = { pinned: new Set(['watch']) };
    r.render(model([car('watch', { distance: 0 })], opts), T);
    const at0 = (svg.querySelector('g.car') as SVGGElement).style.transform;

    const moved = [car('watch', { distance: 80_000 })];
    for (let f = 1; f < 200; f++) r.render(model(moved, opts), T + f * 16);
    expect((svg.querySelector('g.car') as SVGGElement).style.transform).not.toBe(at0);
  });

  it('에러와 한도는 caution 색을 공유하고 모양으로 구분된다', () => {
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

    // 모양은 여전히 다르다 — 이중 인코딩은 형태가 맡는다 (§6.3).
    expect(limMark).not.toBe(errMark);
    // 색은 이제 이벤트 극성의 caution을 공유한다 (§4.3.1) — 따뜻한 노랑은 델타·갭 전용.
    expect(limColor).toBe(errColor);
    expect(errColor).toBe(EVENT_POLARITY_COLOR.caution);
    expect(limColor).toBe(EVENT_POLARITY_COLOR.caution);
  });

  it('에러 난 차량에 경고 표시를 띄운다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const mark = svg.querySelector('g.car .alert') as SVGElement;
    expect(mark).not.toBeNull();
    expect(mark.style.opacity).toBe('1');
  });

  it('경고 표시는 텍스트가 아니라 도형이다', () => {
    // 경고는 도형이다 (PRD §6.3). 느낌표를 글자로 그리지 않는다 —
    // 카넘버는 트랙 밖(카메라 카드)에서만 뜨므로 트랙 SVG 안에는 글자가 없다.
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1, car_number: 7 })]), T);
    const text = [...svg.querySelectorAll('g.cars text')].map((n) => n.textContent);
    expect(text).toEqual([]);
  });

  it('핀 고정에는 경고 표시를 띄우지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('watch')], { pinned: new Set(['watch']) }), T);
    expect((svg.querySelector('g.car .alert') as SVGElement).style.opacity).toBe('0');
  });
});

describe('유휴 sway (REVIEW #10)', () => {
  const idle = (id: string, over: Partial<CarState> = {}) =>
    car(id, { last_event_ts: T - 600_000, ...over });

  it('불변식: sway는 유휴 차의 진행률을 바꾸지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    const m = model([idle('slow', { distance: 12_345 })]);
    for (let f = 0; f < 400; f++) r.render(m, T + f * 16);
    const settled = r.visualProgressOf('slow');
    for (let f = 400; f < 500; f++) r.render(m, T + f * 16);
    expect(r.visualProgressOf('slow')).toBe(settled);
  });

  it('유휴 차 그룹에 sway 위상(--pw-idle-delay)이 설정되고 애니메이션 대상 svg가 있다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([idle('a')]), T);
    const g = svg.querySelector('g.cold') as SVGGElement;
    expect(g.getAttribute('data-idle')).toBe('true');
    expect(g.style.getPropertyValue('--pw-idle-delay')).not.toBe('');
    expect(g.querySelector('.class-car-icon')).not.toBeNull();
  });

  it('비유휴 차에는 sway 위상을 쓰지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('busy', { last_event_ts: T })]), T);
    const g = svg.querySelector('g.cold') as SVGGElement;
    expect(g.getAttribute('data-idle')).toBe('false');
    expect(g.style.getPropertyValue('--pw-idle-delay')).toBe('');
  });

  it('sway 위상은 carId에서 결정적이다 — 같은 차는 항상 같은 위상', () => {
    const r1 = new TrackRenderer(svg, track);
    r1.render(model([idle('same')]), T);
    const d1 = (svg.querySelector('g.cold') as SVGGElement).style.getPropertyValue('--pw-idle-delay');

    document.body.innerHTML = '';
    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg2);
    const r2 = new TrackRenderer(svg2, track);
    r2.render(model([idle('same')]), T);
    const d2 = (svg2.querySelector('g.cold') as SVGGElement).style.getPropertyValue('--pw-idle-delay');

    expect(d1).not.toBe('');
    expect(d1).toBe(d2);
  });

  it('정지 사유 차(에러)는 data-reason을 보유해 CSS sway에서 제외된다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([idle('boom', { error_count: 1 })]), T);
    const g = svg.querySelector('g.car') as SVGGElement;
    expect(g.getAttribute('data-reason')).toBe('error');
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

describe('피트', () => {
  /*
   * 지어낸 코스가 아니라 **가장 나빴던 실제 서킷**으로 잰다. 진행률 고정 간격
   * 시절 이웃 간격이 1.9까지 내려갔던 코스다 (지름 10). 통과하는 코스로 재면
   * 검사가 아무것도 안 막는다.
   */
  const worst = toTrack(CIRCUITS.find((c) => c.id === 'mc-1929')!, 1);

  it('멈춘 차는 주행선이 아니라 피트에 선다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('stopped', { tyre_pct: 2, distance: 0 })]), T);
    const at = visiblePositions()[0];
    const box = pitBoxes(track, 1)[0]!;
    expect(at).toBeDefined();
    expect(Math.hypot((at?.x ?? 0) - box.x, (at?.y ?? 0) - box.y)).toBeLessThan(GLYPH_DIAMETER);
  });

  it('여러 대가 멈추면 각자 다른 박스에 선다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([
      car('a', { tyre_pct: 2 }),
      car('b', { error_count: 1 }),
    ]), T);
    const spots = [...svg.querySelectorAll('g.car')].map((g) => (g as SVGGElement).style.transform);
    expect(new Set(spots).size).toBe(2);
  });

  /*
   * 재생으로는 이 상태를 못 만든다. 더미 3벌을 헤드리스로 끝까지 돌려도 동시에
   * 선 차가 최대 4대였다 — 그런데 관측된 고장은 9대에서 났다. 그래서 상태를
   * 직접 세워 **렌더러를 통과시켜** 잰다. `pitBoxes` 단위 검사와 다른 점은
   * 자리를 세는 쪽(`renderHot`)까지 같이 걸린다는 것이다.
   *
   * 12대는 `HOT_CAP`이다 — 피트에 설 수 있는 최대.
   */
  it('한도로 12대가 한꺼번에 서도 글리프가 겹치지 않는다', () => {
    const r = new TrackRenderer(svg, worst);
    const stopped = Array.from({ length: HOT_CAP }, (_, i) =>
      car(`c${i}`, { car_number: 100 + i, tyre_pct: 2, distance: i * 1000 }));
    r.render(model(stopped), T);

    const spots = visiblePositions();
    expect(spots).toHaveLength(HOT_CAP);
    for (let i = 1; i < spots.length; i++) {
      const gap = Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.y - spots[i - 1]!.y);
      expect(gap, `slot ${i}`).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
    }
  });

  /** 에러와 한도가 섞여도 같은 줄에 순서대로 선다 — 사유가 자리를 바꾸지 않는다. */
  it('에러와 한도가 섞여도 겹치지 않는다', () => {
    const r = new TrackRenderer(svg, worst);
    const stopped = Array.from({ length: HOT_CAP }, (_, i) =>
      car(`c${i}`, i % 2 === 0 ? { tyre_pct: 2 } : { error_count: 1 }));
    r.render(model(stopped), T);

    const spots = visiblePositions();
    expect(spots).toHaveLength(HOT_CAP);
    for (let i = 1; i < spots.length; i++) {
      const gap = Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.y - spots[i - 1]!.y);
      expect(gap, `slot ${i}`).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
    }
  });

  /** 선 밖에 뜬 차는 정지가 아니라 코스 이탈로 읽힌다. 그려진 레인이 전부를 덮어야 한다. */
  it('12대 전부가 그려진 피트 레인 위에 있다', () => {
    const r = new TrackRenderer(svg, worst);
    r.render(model(Array.from({ length: HOT_CAP }, (_, i) =>
      car(`c${i}`, { tyre_pct: 2 }))), T);

    const d = svg.querySelector('path.pit-lane')!.getAttribute('d')!;
    const lane = [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)]
      .map((m) => ({ x: +m[1]!, y: +m[2]! }));
    for (const spot of visiblePositions()) {
      const near = distanceToPolyline(spot, lane);
      expect(near, `(${spot.x}, ${spot.y})`).toBeLessThan(1);
    }
  });

  /*
   * REVIEW #14 잔여: 한도 차량은 `HOT_CAP`을 넘어도 hot에서 전부 보존된다
   * (`trackModel.ts`의 limit-먼저-보존). 렌더러가 그 전부를 서로 다른 피트
   * 자리에 세우고, 그려진 레인도 그 자리까지 늘려야 한다 — 안 그러면 12대를
   * 넘는 순간부터 겹치거나 레인 밖에 뜬 것처럼 보인다.
   */
  it('HOT_CAP을 넘는 한도 차량도 전부 서로 다른 피트 자리에 선다', () => {
    const r = new TrackRenderer(svg, worst);
    const count = HOT_CAP + 12;
    const stopped = Array.from({ length: count }, (_, i) =>
      car(`limit${i}`, { car_number: 200 + i, tyre_pct: 2, distance: i * 1000 }));
    const m = model(stopped);
    // 전제: 모델이 한도 차량을 하나도 안 버렸다.
    expect(m.hot).toHaveLength(count);

    r.render(m, T);

    const spots = visiblePositions();
    expect(spots).toHaveLength(count);

    // 서로 다른 자리 — 어떤 두 대도 글리프 지름보다 가깝지 않다.
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const dist = Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y);
        expect(dist, `slot ${i}·${j}`).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
      }
    }

    // 늘어난 피트 레인이 늘어난 자리 전부를 덮는다.
    const d = svg.querySelector('path.pit-lane')!.getAttribute('d')!;
    const lane = [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)]
      .map((m2) => ({ x: +m2[1]!, y: +m2[2]! }));
    for (const spot of spots) {
      const near = distanceToPolyline(spot, lane);
      expect(near, `(${spot.x}, ${spot.y})`).toBeLessThan(1);
    }

    // 트랙(주행선) 위에는 하나도 안 남는다.
    for (const car of stopped) {
      const onTrack = positionAt(worst, model([car]).hot[0]!.progress, 'P', 0);
      const near = spots.some((s) => Math.hypot(s.x - onTrack.x, s.y - onTrack.y) < 1);
      expect(near, car.car_id).toBe(false);
    }
  });
});

describe('피트 표지', () => {
  // 하드 룰: 트랙 위 텍스트 라벨 금지. 'PIT' 글자를 체커드 플래그 도형으로 바꾼다.
  it('피트 표지는 글자가 아니라 도형이다', () => {
    new TrackRenderer(svg, track);
    expect(svg.querySelectorAll('text.pit-label').length).toBe(0);
    const shapes = svg.querySelectorAll('path.pit-label, rect.pit-label');
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('피트 표지를 피트레인 끝에 둔다', () => {
    new TrackRenderer(svg, track);
    // 도형이 피트레인 마지막 점(tail) 아래 34px 부근에 있는지만 본다.
    const d = svg.querySelector('path.pit-lane')!.getAttribute('d')!;
    const pts = [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: +m[1]!, y: +m[2]! }));
    const tail = pts[pts.length - 1]!;
    const coords = [...svg.querySelectorAll('path.pit-label, rect.pit-label')]
      .flatMap((el) => {
        const raw = el.getAttribute('d') ?? '';
        return [...raw.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => ({ x: +m[1]!, y: +m[2]! }));
      });
    expect(coords.length).toBeGreaterThan(0);
    const near = coords.some((c) =>
      Math.abs(c.x - tail.x) < 12 && Math.abs(c.y - (tail.y + 34)) < 12);
    expect(near).toBe(true);
  });
});

describe('트랙 라벨', () => {
  it('트랙 SVG 안에는 차량 텍스트가 없다 — 식별은 카메라 카드(#NNN)에서만 한다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a', { car_number: 12 }), car('b', { car_number: 883 })]), T);
    expect(svg.querySelectorAll('g.cars text').length).toBe(0);
  });

  it('붐벼도 트랙에 차량 텍스트가 없다 — 밀도와 무관하게 글자를 쓰지 않는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model(Array.from({ length: 30 }, (_, i) => car(`car-${i}`))), T);
    expect(svg.querySelectorAll('g.cars text').length).toBe(0);
  });
});

describe('트랙 상자', () => {
  it('종횡비를 코스에서 가져온다 — CSS가 정하면 레터박스가 생긴다', () => {
    new TrackRenderer(svg, track);
    // jsdom은 `1` 을 `1 / 1` 로 정규화한다. 값이 코스에서 왔는지만 본다.
    expect(svg.style.aspectRatio.replace(/\s*\/\s*1$/, '')).toBe(String(track.aspect));
  });
});

describe('샘플 사이 움직임', () => {
  it('이벤트가 없는 프레임에도 위치가 바뀐다 — 안 그러면 정지 화면이다', () => {
    const r = new TrackRenderer(svg, track);
    const xy = () => {
      const g = svg.querySelector('g.car, g.cold') as SVGGElement;
      return g.style.transform;
    };

    // 두 번의 샘플로 속도를 잡는다.
    r.render(model([car('a', { distance: 0 })]), 1_000);
    r.render(model([car('a', { distance: 10_000 })]), 2_000);

    // 이후 같은 상태로 프레임만 흐른다.
    const frames: string[] = [];
    for (let t = 2_016; t < 2_200; t += 16) {
      r.render(model([car('a', { distance: 10_000 })]), t);
      frames.push(xy());
    }
    expect(new Set(frames).size).toBeGreaterThan(frames.length - 2);
  });
});

describe('유휴(무통신) 주행선 이동 — 2026-08-09 사용자 정정', () => {
  it('오래 무통신인 차량도 주행선에서 결정론적으로 계속 움직인다 — 완전히 멈추지 않는다', () => {
    const stale = car('idle-a', { distance: 12_345, last_event_ts: T - 400_000 });
    const built = model([stale]);
    // 사건(error/limit/pinned)이 아니므로 여전히 cold(주행선)에 남는다 — 피트로 가지 않는다.
    expect(built.cold.map((c) => c.carId)).toEqual(['idle-a']);
    expect(built.cold[0]!.idle).toBe(true);

    const settleFrames = 400;
    const settledAt = T + settleFrames * 16;
    const times = [settledAt, settledAt + 2_000, settledAt + 4_000, settledAt + 6_000];
    const sequence = (container: SVGSVGElement): string[] => {
      const renderer = new TrackRenderer(container, track);
      // 실제 진행(progress)이 settle된 뒤의 유휴 왕복만 본다 — 초기 보간과 섞지 않는다.
      for (let f = 0; f < settleFrames; f++) renderer.render(model([stale]), T + f * 16);
      return times.map((now) => {
        renderer.render(model([stale]), now);
        return (container.querySelector('g.cold') as SVGGElement).style.transform;
      });
    };

    const first = sequence(svg);
    const mirror = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(mirror);

    // 움직인다 — 예전에는 target(progress)이 안 바뀌면 영원히 얼어붙었다.
    expect(new Set(first).size).toBeGreaterThan(1);
    // 결정론적이다 — 같은 입력을 두 번째 렌더러에 먹여도 같은 좌표열이 나온다.
    expect(sequence(mirror)).toEqual(first);

    // 느리다 — 프레임 사이 이동이 글리프 지름보다 훨씬 작다.
    const points = first.map((t) => {
      const parsed = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(t)!;
      return { x: +parsed[1]!, y: +parsed[2]! };
    });
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(GLYPH_DIAMETER);
    }
  });
});

describe('트랙 색 토큰 (P0-2)', () => {
  it('중심선 stroke가 TRACK_COLOR.centerline이다', () => {
    new TrackRenderer(svg, track);
    const path = svg.querySelector('path.track-centerline')!;
    expect(path.getAttribute('stroke')).toBe(TRACK_COLOR.centerline);
  });

  it('피트레인 stroke가 TRACK_COLOR.pitLane이다', () => {
    new TrackRenderer(svg, track);
    const path = svg.querySelector('path.pit-lane')!;
    expect(path.getAttribute('stroke')).toBe(TRACK_COLOR.pitLane);
  });

  it('centerline 대비가 배경 대비 2.5:1 이상이다', () => {
    expect(contrastRatio(TRACK_COLOR.centerline, BACKGROUND)).toBeGreaterThanOrEqual(2.5);
  });

  it('렌더러 소스에 기존 하드코딩 색이 남지 않는다', () => {
    // 정적 검사 grep과 같은 검사를 코드 레벨에서도 확인한다.
    const src = readFileSync('src/render/trackRenderer.ts', 'utf-8');
    expect(src).not.toMatch(/#2a323d/i);
    expect(src).not.toMatch(/#1c222b/i);
  });
});

describe('스타트/피니시 체커 스트립 (P0-2)', () => {
  it('start-finish-marker가 하나 있다', () => {
    new TrackRenderer(svg, track);
    expect(svg.querySelectorAll('.start-finish-marker').length).toBe(1);
  });

  it('밝은 체커 칸이 4개다', () => {
    new TrackRenderer(svg, track);
    const marker = svg.querySelector('.start-finish-marker')!;
    expect(marker.querySelectorAll('[data-cell="light"]').length).toBe(4);
  });

  it('스트립 중심이 track.points[0] 부근이다', () => {
    new TrackRenderer(svg, track);
    const marker = svg.querySelector('.start-finish-marker')!;
    const base = marker.querySelector('[data-cell="base"]')!;
    const d = base.getAttribute('d')!;
    const coords = [...d.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => ({ x: +m[1]!, y: +m[2]! }));
    const cx = coords.reduce((s, p) => s + p.x, 0) / coords.length;
    const cy = coords.reduce((s, p) => s + p.y, 0) / coords.length;
    const p0 = track.points[0]!;
    expect(Math.hypot(cx - p0.x, cy - p0.y)).toBeLessThan(1);
  });

  it('start-finish-marker는 SVG transform 속성을 쓰지 않는다', () => {
    new TrackRenderer(svg, track);
    const marker = svg.querySelector('.start-finish-marker')!;
    for (const el of marker.querySelectorAll('*')) {
      expect(el.getAttribute('transform')).toBeNull();
    }
  });

  it('스타트 표시에는 텍스트가 없다', () => {
    new TrackRenderer(svg, track);
    expect(svg.querySelectorAll('.start-finish-marker text').length).toBe(0);
  });

  it('클릭 핸들러나 차량 풀에 포함되지 않는다', () => {
    new TrackRenderer(svg, track);
    const marker = svg.querySelector('.start-finish-marker')!;
    expect(marker.closest('g.cars')).toBeNull();
  });
});

describe('섹터 경계 틱 (P0-2)', () => {
  it('sector-marker가 두 개다', () => {
    new TrackRenderer(svg, track);
    expect(svg.querySelectorAll('.sector-marker').length).toBe(2);
  });

  it('색상이 TRACK_COLOR.sector이고 선 끝이 round다', () => {
    new TrackRenderer(svg, track);
    for (const marker of svg.querySelectorAll('.sector-marker')) {
      expect(marker.getAttribute('stroke')).toBe(TRACK_COLOR.sector);
      expect(marker.getAttribute('stroke-linecap')).toBe('round');
      expect(marker.getAttribute('stroke-width')).toBe('2');
    }
  });

  it('1/3과 2/3 진행률 위치에 대응한다', () => {
    new TrackRenderer(svg, track);
    const expected = [1 / 3, 2 / 3].map((p) => positionAt(track, p, 'P', 0));
    const markers = [...svg.querySelectorAll('.sector-marker')];
    for (const exp of expected) {
      const near = markers.some((m) => {
        const d = m.getAttribute('d')!;
        const coords = [...d.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map((mm) => ({ x: +mm[1]!, y: +mm[2]! }));
        const cx = coords.reduce((s, p) => s + p.x, 0) / coords.length;
        const cy = coords.reduce((s, p) => s + p.y, 0) / coords.length;
        return Math.hypot(cx - exp.x, cy - exp.y) < 1;
      });
      expect(near).toBe(true);
    }
  });

  it('클릭 핸들러나 차량 풀에 포함되지 않으며 텍스트가 없다', () => {
    new TrackRenderer(svg, track);
    for (const marker of svg.querySelectorAll('.sector-marker')) {
      expect(marker.closest('g.cars')).toBeNull();
    }
    expect(svg.querySelectorAll('.sector-marker text').length).toBe(0);
  });
});

describe('F1 차량 아이콘 (P0-1)', () => {
  it('hot 차량에 크롭된 차량 bbox viewBox 아이콘이 있다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const icon = svg.querySelector('g.car svg.class-car-icon')!;
    // 원본 512×512가 아니라 차량 실루엣 bbox에 맞춰 잘린 viewBox다.
    expect(icon.getAttribute('viewBox')).not.toBe('0 0 512 512');
    expect(icon.getAttribute('viewBox')).toContain('194.9');
  });

  it('cold 차량에도 같은 크롭 아이콘이 있다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a')]), T);
    const icon = svg.querySelector('g.cold svg.class-car-icon')!;
    expect(icon.getAttribute('viewBox')).not.toBe('0 0 512 512');
    expect(icon.getAttribute('viewBox')).toContain('194.9');
  });

  it('F1 경로의 고유 구간이 DOM에 있다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a')]), T);
    expect(F1_CAR_PATH).toContain('M355.975 292.25');
    const path = svg.querySelector('g.cold svg.class-car-icon path')!;
    expect(path.getAttribute('d')).toContain('M355.975 292.25');
  });

  it('Skoll 저작자 표시 주석이 소스에 존재한다', () => {
    const src = readFileSync('src/render/trackRenderer.ts', 'utf-8');
    expect(src).toContain('Icon by Skoll, from game-icons.net, CC BY 3.0');
  });

  it('H/P/GT 차량마다 class-badge가 하나씩 있고 형태가 일치한다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([
      car('h', { car_class: 'H' }),
      car('p', { car_class: 'P' }),
      car('g', { car_class: 'GT' }),
    ]), T);
    const groups = [...svg.querySelectorAll('g.cold')];
    expect(groups.length).toBe(3);
    for (const g of groups) {
      expect(g.querySelectorAll('.class-badge').length).toBe(1);
    }
  });

  it('배지는 aria-hidden이고 차량 본체·배지 모두 클래스 색상을 쓴다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('p', { car_class: 'P' })]), T);
    const g = svg.querySelector('g.cold')!;
    const badge = g.querySelector('.class-badge')!;
    expect(badge.getAttribute('aria-hidden')).toBe('true');
    expect(badge.getAttribute('stroke')).toBe(CLASS_STYLE.P.color);
    const carIconPath = g.querySelector('svg.class-car-icon path')!;
    expect(carIconPath.getAttribute('fill')).toBe(CLASS_STYLE.P.color);
  });

  it('모든 클래스의 배지 shape이 CLASS_STYLE과 일치한다', () => {
    // 병렬 렌더는 순서 보장이 약하므로 클래스마다 새 SVG에서 하나씩 검증한다.
    for (const cls of CAR_CLASSES) {
      document.body.innerHTML = '';
      const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      document.body.appendChild(svg2);
      const r2 = new TrackRenderer(svg2, track);
      r2.render(model([car(`solo-${cls}`, { car_class: cls })]), T);
      const badge = svg2.querySelector('.class-badge')!;
      const d = badge.getAttribute('d')!;
      if (CLASS_STYLE[cls].shape === 'triangle') expect(d).toMatch(/Z$/);
      if (CLASS_STYLE[cls].shape === 'circle') expect(d).toContain('A ');
      if (CLASS_STYLE[cls].shape === 'square') expect(d.match(/L /g)?.length).toBe(3);
    }
  });

  it('트랙 SVG 안에 차량 번호 텍스트가 없다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a', { car_number: 42 }), car('boom', { car_number: 7, error_count: 1 })]), T);
    expect(svg.querySelectorAll('g.cars text').length).toBe(0);
  });

  it('hot 차량은 fuelRing과 alert을 여전히 갖는다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('boom', { error_count: 1 })]), T);
    const g = svg.querySelector('g.car')!;
    expect(g.querySelector('circle')).not.toBeNull();
    expect(g.querySelector('.alert')).not.toBeNull();
  });

  it('차량 렌더 경로에 <image>, <img>, <use>가 없다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a'), car('boom', { error_count: 1 })]), T);
    expect(svg.querySelectorAll('g.cars image, g.cars img, g.cars use').length).toBe(0);
  });
});

describe('아이콘 확대와 투명 클릭 타깃 (Task C)', () => {
  it('차량 아이콘 상자가 예전 18×12보다 크고 종횡비 1.5를 지킨다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('a')]), T);
    const icon = svg.querySelector('g.cold svg.class-car-icon')!;
    const w = Number(icon.getAttribute('width'));
    const h = Number(icon.getAttribute('height'));
    expect(w).toBeGreaterThan(18);
    expect(h).toBeGreaterThan(12);
    expect(w / h).toBeCloseTo(1.5);
  });

  it('hot·cold 모두 투명 클릭 타깃을 가진다', () => {
    const r = new TrackRenderer(svg, track);
    r.render(model([car('cold'), car('boom', { error_count: 1 })]), T);
    for (const sel of ['g.cold', 'g.car']) {
      const hit = svg.querySelector(`${sel} .car-hit`) as SVGCircleElement | null;
      expect(hit, sel).not.toBeNull();
      expect(hit!.getAttribute('fill')).toBe('transparent');
      expect(hit!.getAttribute('pointer-events')).toBe('all');
      expect(Number(hit!.getAttribute('r'))).toBeGreaterThan(0);
    }
  });

  it('장식 없는 cold 차량도 투명 클릭 타깃으로 선택된다', () => {
    const r = new TrackRenderer(svg, track);
    const picked: string[] = [];
    r.onSelect((id) => picked.push(id));
    r.render(model([car('a')]), T);
    const hit = svg.querySelector('g.cold .car-hit') as unknown as HTMLElement;
    expect(hit).not.toBeNull();
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual(['a']);
  });
});
