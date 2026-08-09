import type { TrackModel } from '../track/trackModel';
import type { Track } from '../track/generateTrack';
import { TrackRenderer } from './trackRenderer';
import { BroadcastTrackRenderer, type TrackRendererContract } from './broadcastTrackRenderer';

type Schedule = (task: () => void) => void;

export interface BroadcastBootDependencies {
  readonly supported?: () => boolean;
  readonly reducedMotion?: boolean;
  readonly createBroadcast?: () => TrackRendererContract;
  readonly createLegacy?: () => TrackRendererContract;
  readonly schedule?: Schedule;
}

export interface BroadcastRendererSession extends TrackRendererContract {
  readonly mode: 'broadcast' | 'legacy';
  readonly fallbackReason: 'RENDER FALLBACK' | null;
}

export function bootBroadcastTrackRenderer(
  svg: SVGSVGElement,
  track: Track,
  dependencies: BroadcastBootDependencies = {},
): BroadcastRendererSession {
  const legacy = dependencies.createLegacy ?? (() => new TrackRenderer(svg, track));
  const schedule = dependencies.schedule ?? ((task) => requestAnimationFrame(task));
  let current: TrackRendererContract;
  let mode: 'broadcast' | 'legacy' = 'broadcast';
  let fallbackReason: 'RENDER FALLBACK' | null = null;
  let rendered = false;
  let pending = false;
  let selectHandler: ((carId: string) => void) | null = null;
  const fallback = (): void => {
    if (mode === 'legacy') return;
    svg.replaceChildren();
    current = legacy();
    if (selectHandler) current.onSelect(selectHandler);
    mode = 'legacy';
    fallbackReason = 'RENDER FALLBACK';
    svg.dataset['renderStatus'] = fallbackReason;
  };
  try {
    const supported = (dependencies.supported ?? BroadcastTrackRenderer.isSupported)();
    current = supported
      ? (dependencies.createBroadcast ?? (() => new BroadcastTrackRenderer(
        svg, track, { reducedMotion: dependencies.reducedMotion },
      )))()
      : legacy();
    if (!supported) mode = 'legacy';
  } catch {
    svg.replaceChildren();
    current = legacy();
    mode = 'legacy';
    fallbackReason = 'RENDER FALLBACK';
    svg.dataset['renderStatus'] = fallbackReason;
  }

  return {
    render(model: TrackModel, now: number, selected: string | null = null): void {
      if (pending) return;
      try {
        current.render(model, now, selected);
        rendered = true;
      } catch {
        if (!rendered) {
          fallback();
          current.render(model, now, selected);
          return;
        }
        pending = true;
        schedule(() => {
          fallback();
          pending = false;
          current.render(model, now, selected);
        });
      }
    },
    onSelect(handler): void { selectHandler = handler; current.onSelect(handler); },
    visualProgressOf(carId): number | undefined { return current.visualProgressOf(carId); },
    get nodeCount(): number { return current.nodeCount; },
    get mode(): 'broadcast' | 'legacy' { return mode; },
    get fallbackReason(): 'RENDER FALLBACK' | null { return fallbackReason; },
  };
}
