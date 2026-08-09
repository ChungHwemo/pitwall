import { describe, expect, it } from 'vitest';
import { BroadcastTrackRenderer } from '../src/render/broadcastTrackRenderer';
import { generateTrack } from '../src/track/generateTrack';
import type { RenderCar, TrackModel } from '../src/track/trackModel';

const T = 1_000_000;
const track = generateTrack(2026);

function car(carId: string, progress: number, over: Partial<RenderCar> = {}): RenderCar {
  return {
    carId,
    carNumber: 7,
    heat: 0.5,
    idle: false,
    freshness: 'fresh',
    carClass: 'P',
    progress,
    laneLine: 0,
    ...over,
  };
}

function model(cold: readonly RenderCar[]): TrackModel {
  return { cold: [...cold], hot: [], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } };
}

function renderer(reducedMotion = false): BroadcastTrackRenderer {
  return new BroadcastTrackRenderer(
    document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    track,
    { reducedMotion },
  );
}

describe('broadcast observed-anchor motion', () => {
  it('is elapsed-time equivalent under irregular cadence, monotonic, bounded, and settles', () => {
    const sparse = renderer();
    const dense = renderer();
    for (const subject of [sparse, dense]) {
      subject.render(model([car('a', 0.1)]), T);
      subject.render(model([car('a', 0.3)]), T + 100);
    }

    const denseSamples: number[] = [];
    for (const elapsed of [20, 35, 61, 100]) {
      dense.render(model([car('a', 0.3)]), T + 100 + elapsed);
      const progress = dense.visualProgressOf('a');
      if (progress === undefined) throw new RangeError('visual progress missing');
      denseSamples.push(progress);
    }
    sparse.render(model([car('a', 0.3)]), T + 200);

    expect(denseSamples.every((value, index) => {
      if (index === 0) return true;
      const previous = denseSamples[index - 1];
      return previous === undefined || value >= previous;
    })).toBe(true);
    expect(denseSamples.every((value) => value >= 0.1 && value <= 0.3)).toBe(true);
    expect(sparse.visualProgressOf('a')).toBeCloseTo(dense.visualProgressOf('a') ?? -1, 8);
    expect(dense.visualProgressOf('a')).toBeCloseTo(0.3, 8);

    dense.render(model([car('a', 0.3)]), T + 2_000);
    expect(dense.visualProgressOf('a')).toBeCloseTo(0.3, 8);
  });

  it('holds stale/error/limit anchors and snaps in reduced motion', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const moving = new BroadcastTrackRenderer(svg, track);
    moving.render(model([car('stale', 0.1)]), T);
    moving.render(model([car('stale', 0.4, { freshness: 'stale', idle: true })]), T + 100);
    moving.render({
      cold: [],
      hot: [
        { ...car('error', 0.2), reason: 'error', score: 400 },
        { ...car('limit', 0.6), reason: 'limit', score: 300 },
      ],
      hotOverflow: 0,
      laneOverflow: { H: 0, P: 0, GT: 0 },
    }, T + 200);
    const stoppedTransforms = [...svg.querySelectorAll<SVGGElement>('g.car')]
      .filter((node) => node.style.opacity !== '0' && node.dataset['reason'] !== '')
      .map((node) => [node.dataset['reason'], node.style.transform]);
    moving.render(model([car('stale', 0.4, { freshness: 'stale', idle: true })]), T + 500);

    expect(moving.visualProgressOf('stale')).toBeCloseTo(0.1, 8);
    expect(stoppedTransforms.map(([reason]) => reason)).toEqual(['error', 'limit']);
    expect(new Set(stoppedTransforms.map(([, transform]) => transform)).size).toBe(2);

    const reduced = renderer(true);
    reduced.render(model([car('a', 0.1)]), T);
    reduced.render(model([car('a', 0.4)]), T + 100);
    expect(reduced.visualProgressOf('a')).toBeCloseTo(0.4, 8);
  });
});
