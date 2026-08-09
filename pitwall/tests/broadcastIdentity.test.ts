import { describe, expect, it } from 'vitest';
import { BroadcastTrackRenderer } from '../src/render/broadcastTrackRenderer';
import { generateTrack } from '../src/track/generateTrack';
import type { HotCar, RenderCar, TrackModel } from '../src/track/trackModel';

const T = 1_000_000;
const track = generateTrack(2026);

function cold(carId: string, progress: number): RenderCar {
  return { carId, carNumber: 7, heat: 0.4, idle: false, freshness: 'fresh', carClass: 'P', progress, laneLine: 0 };
}

function hot(carId: string, progress: number): HotCar {
  return { ...cold(carId, progress), reason: 'pinned', score: 1 };
}

function model(coldCars: readonly RenderCar[], hotCars: readonly HotCar[] = []): TrackModel {
  return { cold: [...coldCars], hot: [...hotCars], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } };
}

function nodes(svg: SVGSVGElement): readonly SVGGElement[] {
  return [...svg.querySelectorAll<SVGGElement>('g.car')];
}

describe('broadcast visual identity', () => {
  it('keeps both car DOM identities through reorder and hot/cold changes without transform teleport', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const subject = new BroadcastTrackRenderer(svg, track);
    subject.render(model([cold('a', 0.1), cold('b', 0.5)]), T);
    const [a, b] = nodes(svg);
    if (!a || !b) throw new RangeError('both car nodes must exist');
    const before = new Map([['a', a.style.transform], ['b', b.style.transform]]);

    subject.render(model([cold('b', 0.55)], [hot('a', 0.15)]), T + 100);
    expect(nodes(svg)).toContain(a);
    expect(nodes(svg)).toContain(b);
    expect(a.style.transform).toBe(before.get('a'));
    expect(b.style.transform).toBe(before.get('b'));

    subject.render(model([cold('a', 0.15)], [hot('b', 0.55)]), T + 150);
    expect(nodes(svg)).toContain(a);
    expect(nodes(svg)).toContain(b);
    expect(svg.querySelectorAll('g.car').length).toBe(2);
  });

  it('bounds the stable identity pool under identifier churn', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const subject = new BroadcastTrackRenderer(svg, track);
    for (let index = 0; index < 260; index += 1) {
      subject.render(model([cold(`car-${index}`, index / 300)]), T + index);
    }

    expect(subject.nodeCount).toBe(200);
    expect(svg.querySelectorAll('g.car')).toHaveLength(200);
    expect(subject.visualProgressOf('car-259')).toBeDefined();
    expect(subject.visualProgressOf('car-0')).toBeUndefined();
    expect(svg.outerHTML).not.toContain('car-259');
  });

  it('caps a single crowded frame and reports every omitted hot car as overflow', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const subject = new BroadcastTrackRenderer(svg, track);
    const hotCars = Array.from({ length: 260 }, (_, index) => hot(`private-account-${index}`, index / 260));

    subject.render(model([], hotCars), T);

    expect(subject.nodeCount).toBe(200);
    expect(svg.querySelectorAll('g.car')).toHaveLength(200);
    expect(svg.querySelector('[data-overflow="hot"]')?.textContent).toBe('HOT +60');
    expect(svg.outerHTML).not.toContain('private-account-');
  });

  it('keeps stopped cars visible before aggregating lower-priority cars', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const subject = new BroadcastTrackRenderer(svg, track);
    const coldCars = Array.from({ length: 210 }, (_, index) => cold(`cold-${index}`, index / 210));
    const stopped = { ...hot('stopped-private', 0.5), reason: 'error' as const };

    subject.render(model(coldCars, [stopped]), T);

    expect(svg.querySelectorAll('g.car')).toHaveLength(200);
    expect(svg.querySelector('[data-reason="error"]')).not.toBeNull();
    expect(svg.querySelector('[data-overflow="P"]')?.textContent).toBe('P +11');
  });

  it('keeps class identity in distinct non-color glyph shapes', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const subject = new BroadcastTrackRenderer(svg, track);
    subject.render(model([
      { ...cold('hypercar', 0.1), carClass: 'H' },
      { ...cold('prototype', 0.3), carClass: 'P' },
      { ...cold('gt', 0.5), carClass: 'GT' },
    ]), T);

    const paths = nodes(svg).map((carNode) => carNode.querySelector('path')?.getAttribute('d'));
    expect(new Set(paths).size).toBe(3);
  });

  it('renders explicit overflow counts without allocating on later frames', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const subject = new BroadcastTrackRenderer(svg, track);
    const crowded: TrackModel = {
      cold: [], hot: [], hotOverflow: 3, laneOverflow: { H: 2, P: 0, GT: 4 },
    };
    subject.render(crowded, T);
    const peak = svg.querySelectorAll('*').length;
    subject.render(crowded, T + 16);

    expect([...svg.querySelectorAll<SVGTextElement>('.broadcast-overflow')]
      .filter((node) => node.style.opacity !== '0').map((node) => node.textContent))
      .toEqual(['H +2', 'GT +4', 'HOT +3']);
    expect(svg.querySelectorAll('*')).toHaveLength(peak);
  });
});
