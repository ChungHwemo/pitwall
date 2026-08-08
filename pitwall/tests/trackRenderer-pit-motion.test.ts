import { beforeEach, describe, expect, it } from 'vitest';
import { TrackRenderer, GLYPH_DIAMETER } from '../src/render/trackRenderer';
import { generateTrack } from '../src/track/generateTrack';
import { pitBoxes } from '../src/track/layout';
import { buildTrackModel, HOT_CAP } from '../src/track/trackModel';
import type { TrackModelOptions } from '../src/track/trackModel';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;
const track = generateTrack(2026);
const options: TrackModelOptions = {
  highlightTypes: ['error', 'limit'],
  fuelWarnPct: 20,
  limitWarnPct: 15,
  pinned: new Set(),
};

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 1_000, cached: 0, fuel_pct: 80, tyre_pct: 70, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1, work_per_min: 0, saved_usd: 0,
    ...over,
  };
}

function model(cars: readonly CarState[]) {
  const state: RaceState = {
    cars: new Map(cars.map((entry) => [entry.car_id, entry])),
    byModel: new Map(), phase: 'racing', elapsed_ms: 0, now: T,
  };
  return buildTrackModel(state, T, options);
}

function transforms(container: SVGSVGElement): string[] {
  return [...container.querySelectorAll<SVGGElement>('g.car')]
    .filter((node) => node.style.opacity !== '0')
    .map((node) => node.style.transform);
}

function positionOf(transform: string): { x: number; y: number } {
  const values = transform.match(/-?[\d.]+/g)?.map(Number);
  if (!values || values.length !== 2) throw new TypeError(`unexpected transform: ${transform}`);
  return { x: values[0] ?? Number.NaN, y: values[1] ?? Number.NaN };
}

function positions(container: SVGSVGElement): Array<{ x: number; y: number }> {
  return transforms(container).map(positionOf);
}

let svg: SVGSVGElement;
beforeEach(() => {
  document.body.innerHTML = '';
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
});

describe('사건 차량 피트 이동', () => {
  it('한도·에러 차량은 피트 안에서 느리고 결정론적으로 이동한다', () => {
    const cars = [
      car('boom', { error_count: 1, distance: 0 }),
      car('low', { tyre_pct: 5, distance: 80_000 }),
    ];
    const times = [T, T + 1_000, T + 2_000];
    const sequence = (container: SVGSVGElement): string[][] => {
      const renderer = new TrackRenderer(container, track);
      return times.map((now) => {
        renderer.render(model(cars), now);
        return transforms(container);
      });
    };

    const first = sequence(svg);
    const mirror = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(mirror);

    expect(new Set(first.map((frame) => frame.join('|'))).size).toBeGreaterThan(1);
    expect(sequence(mirror)).toEqual(first);
    const anchors = pitBoxes(track, cars.length);
    first.forEach((frame) => frame.map(positionOf).forEach((position, index) => {
      const anchor = anchors[index];
      if (!anchor) throw new RangeError('pit anchor missing');
      expect(Math.hypot(position.x - anchor.x, position.y - anchor.y))
        .toBeLessThan(GLYPH_DIAMETER);
    }));
    expect([...svg.querySelectorAll('g.car')].map((node) => node.getAttribute('data-reason')))
      .toEqual(['limit', 'error']);
  });

  it('여러 stopped 차량의 피트 간격을 유지한다', () => {
    const cars = Array.from({ length: HOT_CAP }, (_, i) =>
      car(`stopped-${i}`, i % 2 === 0 ? { tyre_pct: 2 } : { error_count: 1 }));
    const renderer = new TrackRenderer(svg, track);
    const seen = new Set<string>();

    for (const now of [T, T + 1_000, T + 2_000]) {
      renderer.render(model(cars), now);
      const frame = positions(svg);
      frame.forEach((position) => seen.add(`${position.x},${position.y}`));
      for (let i = 0; i < frame.length; i++) {
        for (let j = i + 1; j < frame.length; j++) {
          const a = frame[i];
          const b = frame[j];
          if (!a || !b) throw new RangeError('pit position missing');
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(GLYPH_DIAMETER);
        }
      }
    }

    expect(seen.size).toBeGreaterThan(cars.length);
  });
});
