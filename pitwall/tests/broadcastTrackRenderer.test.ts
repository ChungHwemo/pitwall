import { describe, expect, it, vi } from 'vitest';
import {
  BroadcastTrackRenderer,
  type TrackRendererContract,
} from '../src/render/broadcastTrackRenderer';
import { bootBroadcastTrackRenderer } from '../src/render/broadcastRendererSession';
import { generateTrack } from '../src/track/generateTrack';
import type { TrackModel } from '../src/track/trackModel';
import { PitwallApp } from '../src/main';
import type { EventSource } from '../src/source/EventSource';
import type { LiveSnapshot } from '../src/session/liveStore';

const T = 1_000_000;
const track = generateTrack(2026);
const empty: TrackModel = { cold: [], hot: [], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } };

function svg(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

function inertRenderer(render: () => void = () => undefined): TrackRendererContract {
  return { render, onSelect: () => undefined, visualProgressOf: () => undefined, nodeCount: 0 };
}

describe('broadcast renderer boot and fallback contract', () => {
  it('checks SVG/createElementNS/CSS transform support without requesting WebGL', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const createElementNS = vi.spyOn(document, 'createElementNS');

    expect(BroadcastTrackRenderer.isSupported()).toBe(
      typeof SVGSVGElement !== 'undefined'
      && typeof document.createElementNS === 'function'
      && (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || CSS.supports('transform', 'translate(0px)')),
    );
    expect(createElementNS).toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
  });

  it.each(['unsupported', 'construction', 'construction-non-error', 'first-render'])('switches %s failure to legacy immediately', (failure) => {
    const legacy = vi.fn(() => inertRenderer());
    const broadcast = vi.fn(() => {
      if (failure === 'construction') throw new TypeError('construction failed');
      if (failure === 'construction-non-error') throw Object.freeze({ failure });
      return inertRenderer(() => {
        if (failure === 'first-render') throw new TypeError('first render failed');
      });
    });
    const session = bootBroadcastTrackRenderer(svg(), track, {
      supported: () => failure !== 'unsupported',
      createBroadcast: broadcast,
      createLegacy: legacy,
      schedule: (task) => task(),
    });

    session.render(empty, T);
    expect(legacy).toHaveBeenCalledOnce();
    expect(session.mode).toBe('legacy');
  });

  it('switches one post-success fatal render on the next tick exactly once and records the literal reason', () => {
    const ticks: Array<() => void> = [];
    const legacyRender = vi.fn();
    const legacy = vi.fn(() => inertRenderer(legacyRender));
    let renders = 0;
    const session = bootBroadcastTrackRenderer(svg(), track, {
      supported: () => true,
      createBroadcast: () => inertRenderer(() => {
        renders += 1;
        if (renders > 1) throw new TypeError('fatal');
      }),
      createLegacy: legacy,
      schedule: (task) => { ticks.push(task); },
    });

    session.render(empty, T);
    session.render(empty, T + 1);
    session.render(empty, T + 2);
    expect(legacy).not.toHaveBeenCalled();
    expect(ticks).toHaveLength(1);
    ticks[0]?.();
    expect(legacy).toHaveBeenCalledOnce();
    expect(legacyRender).toHaveBeenCalledOnce();
    session.render(empty, T + 3);
    expect(legacy).toHaveBeenCalledOnce();
    expect(legacyRender).toHaveBeenCalledTimes(2);
    expect(session.mode).toBe('legacy');
    expect(session.fallbackReason).toBe('RENDER FALLBACK');
  });

  it('keeps reduced motion in broadcast mode and requests zero WebGL contexts', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const legacy = vi.fn(() => inertRenderer());
    const session = bootBroadcastTrackRenderer(svg(), track, {
      supported: () => true,
      reducedMotion: true,
      createLegacy: legacy,
      schedule: (task) => task(),
    });

    session.render(empty, T);
    expect(session.mode).toBe('broadcast');
    expect(legacy).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
  });
});

describe('broadcast stale live fact', () => {
  it('reports restored old observations as stale rather than waiting', () => {
    const root = document.createElement('main');
    const source: EventSource & { setSpeed(speed: number): void } = {
      start: () => undefined,
      tick: () => undefined,
      stop: () => undefined,
      setSpeed: () => undefined,
    };
    const app = new PitwallApp(root, { seed: 7, preset: 'busy', speed: 1 });
    app.useSource(source);
    const snapshot: LiveSnapshot = {
      v: 1,
      savedAt: Date.now(),
      now: 600_001,
      state: {
        cars: {
          stale: {
            car_id: 'stale', car_number: 321, model: 'gpt-5.6-sol', car_class: 'P',
            activity: 'running', distance: 1_000, cached: 0, fuel_pct: 80, tyre_pct: 70,
            cost_usd: 1, last_event_ts: 0, error_count: 0, cache_hits: 0, call_count: 1,
            work_per_min: 500, saved_usd: 0,
          },
        },
        byModel: {}, phase: 'racing', elapsed_ms: 0,
      },
      samples: [],
    };
    app.restoreLiveState(snapshot);
    app.start();
    app.frame(1_000);

    expect(root.querySelector('.live-status')?.textContent).toContain('STALE DATA');
  });
});

describe('broadcast focus privacy', () => {
  it('does not expose the source car identifier in focus DOM attributes', () => {
    const root = document.createElement('main');
    const source: EventSource & { setSpeed(speed: number): void } = {
      start: () => undefined,
      tick: () => undefined,
      stop: () => undefined,
      setSpeed: () => undefined,
    };
    const app = new PitwallApp(root, { seed: 7, preset: 'busy', speed: 1 });
    app.useSource(source);
    app.restoreLiveState({
      v: 1, savedAt: Date.now(), now: T,
      state: {
        cars: {
          sensitive: {
            car_id: 'raw-account-secret@example.com', car_number: 321, model: 'gpt-5.6-sol', car_class: 'P',
            activity: 'running', distance: 1_000, cached: 0, fuel_pct: 80, tyre_pct: 70,
            cost_usd: 1, last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1,
            work_per_min: 500, saved_usd: 0,
          },
        },
        byModel: {}, phase: 'racing', elapsed_ms: 0,
      },
      samples: [],
    });
    app.start();
    app.frame(T);

    const focus = root.querySelector<HTMLElement>('.broadcast-focus');
    const track = root.querySelector<SVGSVGElement>('svg.track');
    expect(focus?.dataset['carId']).toBeUndefined();
    expect(focus?.outerHTML).not.toContain('raw-account-secret@example.com');
    expect(track?.outerHTML).not.toContain('raw-account-secret@example.com');
  });
});

describe('main track: single circuit line, no broadcast duplicate', () => {
  it('renders exactly one main track line and forces the legacy renderer', () => {
    const root = document.createElement('main');
    const app = new PitwallApp(root, { seed: 7, preset: 'busy', speed: 1 });
    app.start();
    app.frame(1_000);

    const svgEl = root.querySelector('svg.track');
    const centerlines = svgEl?.querySelectorAll('path.track-centerline') ?? [];
    expect(centerlines).toHaveLength(1);
    expect(svgEl?.querySelector('.broadcast-track, .broadcast-pit-lane')).toBeNull();
    expect(root.querySelector<HTMLElement>('.detail')?.dataset['renderer']).toBe('legacy');
  });

  it('keeps the pit lane a short spur, not a second loop around the circuit', () => {
    const root = document.createElement('main');
    const app = new PitwallApp(root, { seed: 7, preset: 'busy', speed: 1 });
    app.start();
    app.frame(1_000);

    const centerline = root.querySelector('svg.track path.track-centerline');
    const pitLane = root.querySelector('svg.track path.pit-lane');
    const centerlinePoints = (centerline?.getAttribute('d') ?? '').split(' L ').length;
    const pitLanePoints = (pitLane?.getAttribute('d') ?? '').split(' L ').length;
    // The pit lane is a short spur off the circuit, not a parallel full lap —
    // it must stay a small fraction of the main track's point count.
    expect(pitLanePoints).toBeLessThan(centerlinePoints * 0.3);
  });
});
