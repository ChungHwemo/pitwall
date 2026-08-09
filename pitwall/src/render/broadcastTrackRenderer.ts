import { CLASS_STYLE, TRACK_COLOR } from '../config/theme';
import type { HotCar, RenderCar, TrackModel } from '../track/trackModel';
import { trackWidth } from '../track/generateTrack';
import type { Point, Track } from '../track/generateTrack';
import { pitBoxes, pitLanePoints, positionAt } from '../track/layout';
import { createBroadcastOverflow } from './broadcastOverflow';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_MOTION_MS = 100;
const MAX_MOTION_MS = 1_000;
const MAX_CAR_NODES = 200;

type RenderArgs = readonly [model: TrackModel, now: number, selected?: string | null];

export interface TrackRendererContract {
  render(...args: RenderArgs): void;
  onSelect(handler: (carId: string) => void): void;
  visualProgressOf(carId: string): number | undefined;
  readonly nodeCount: number;
}

interface Motion {
  visual: number;
  start: number;
  target: number;
  anchor: number;
  anchorAt: number;
  duration: number;
}

interface CarNode {
  readonly group: SVGGElement;
  readonly glyph: SVGPathElement;
  readonly motion: Motion;
}

export interface BroadcastRendererOptions {
  readonly reducedMotion?: boolean;
}

function pathOf(points: readonly Point[]): string {
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} Z`;
}

function classGlyphPath(shape: 'circle' | 'triangle' | 'square'): string {
  switch (shape) {
    case 'triangle': return 'M 0 -8 L 7 6 L -7 6 Z';
    case 'circle': return 'M -7 0 A 7 7 0 1 0 7 0 A 7 7 0 1 0 -7 0 Z';
    case 'square': return 'M -6 -6 L 6 -6 L 6 6 L -6 6 Z';
  }
}

function forwardTarget(anchor: number, next: number): number {
  let target = Math.floor(anchor) + next;
  while (target < anchor) target += 1;
  return target;
}

function advance(motion: Motion, now: number): number {
  const elapsed = Math.max(0, now - motion.anchorAt);
  const ratio = Math.min(1, elapsed / motion.duration);
  motion.visual = motion.start + (motion.target - motion.start) * ratio;
  return motion.visual;
}

export class BroadcastTrackRenderer implements TrackRendererContract {
  private readonly cars = new Map<string, CarNode>();
  private readonly nodeIds = new WeakMap<SVGGElement, string>();
  private readonly carLayer: SVGGElement;
  private readonly reducedMotion: boolean;
  private readonly renderOverflow: (model: TrackModel) => void;
  private selectHandler: ((carId: string) => void) | null = null;
  private pitBoxCount = -1;
  private pitBoxCache: readonly Point[] = [];

  constructor(
    private readonly container: SVGSVGElement,
    private readonly track: Track,
    options: BroadcastRendererOptions = {},
  ) {
    this.reducedMotion = options.reducedMotion ?? BroadcastTrackRenderer.isReducedMotion();
    container.setAttribute('viewBox', `0 0 ${trackWidth(track.aspect)} 1000`);
    container.style.aspectRatio = String(track.aspect);
    container.dataset['renderer'] = 'broadcast';
    const centerline = document.createElementNS(SVG_NS, 'path');
    centerline.setAttribute('class', 'track-centerline broadcast-track');
    centerline.setAttribute('d', pathOf(track.points));
    centerline.setAttribute('fill', 'none');
    centerline.setAttribute('stroke', TRACK_COLOR.centerline);
    centerline.setAttribute('stroke-width', '14');
    container.appendChild(centerline);
    const pitLane = document.createElementNS(SVG_NS, 'path');
    pitLane.setAttribute('class', 'pit-lane broadcast-pit-lane');
    pitLane.setAttribute('d', pathOf(pitLanePoints(track, 40)));
    pitLane.setAttribute('fill', 'none');
    pitLane.setAttribute('stroke', TRACK_COLOR.pitLane);
    pitLane.setAttribute('stroke-width', '8');
    container.appendChild(pitLane);
    this.carLayer = document.createElementNS(SVG_NS, 'g');
    this.carLayer.setAttribute('class', 'cars broadcast-cars');
    container.appendChild(this.carLayer);
    this.renderOverflow = createBroadcastOverflow(container);
  }

  static isSupported(): boolean {
    if (typeof SVGSVGElement === 'undefined' || typeof document.createElementNS !== 'function') return false;
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function'
      || !CSS.supports('transform', 'translate(0px)')) return false;
    return document.createElementNS(SVG_NS, 'svg') instanceof SVGSVGElement;
  }

  static isReducedMotion(): boolean {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  onSelect(handler: (carId: string) => void): void {
    this.selectHandler = handler;
  }

  private node(carId: string, progress: number, now: number, reserved: ReadonlySet<string>): CarNode {
    const found = this.cars.get(carId);
    if (found) return found;
    let created: CarNode | undefined;
    if (this.cars.size >= MAX_CAR_NODES) {
      for (const [oldCarId, node] of this.cars) {
        if (reserved.has(oldCarId)) continue;
        this.cars.delete(oldCarId);
        created = node;
        break;
      }
      if (!created) throw new RangeError('broadcast car pool exhausted');
    } else {
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('class', 'car');
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      const activate = (): void => {
        const currentCarId = this.nodeIds.get(group);
        if (currentCarId) this.selectHandler?.(currentCarId);
      };
      group.addEventListener('click', activate);
      group.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate();
      });
      const glyph = document.createElementNS(SVG_NS, 'path');
      group.appendChild(glyph);
      this.carLayer.appendChild(group);
      created = {
        group,
        glyph,
        motion: { visual: progress, start: progress, target: progress, anchor: progress, anchorAt: now, duration: 1 },
      };
    }
    this.nodeIds.set(created.group, carId);
    Object.assign(created.motion, {
      visual: progress, start: progress, target: progress, anchor: progress, anchorAt: now, duration: 1,
    });
    this.cars.set(carId, created);
    return created;
  }

  render(model: TrackModel, now: number, selected: string | null = null): void {
    const entries: readonly {
      readonly car: RenderCar;
      readonly reason: HotCar['reason'] | null;
    }[] = [
      ...model.cold.map((car) => ({ car, reason: null })),
      ...model.hot.map((car) => ({ car, reason: car.reason })),
    ];
    const prioritized = [
      ...entries.filter(({ reason }) => reason === 'error' || reason === 'limit'),
      ...entries.filter(({ reason }) => reason !== 'error' && reason !== 'limit'),
    ];
    const shown = prioritized.slice(0, MAX_CAR_NODES);
    const selectedEntry = selected === null ? undefined : entries.find(({ car }) => car.carId === selected);
    if (selectedEntry && !shown.includes(selectedEntry) && shown.length > 0) shown[shown.length - 1] = selectedEntry;
    const visible = new Set(shown.map(({ car }) => car.carId));
    const overflow = {
      H: model.laneOverflow.H,
      P: model.laneOverflow.P,
      GT: model.laneOverflow.GT,
      hot: model.hotOverflow,
    };
    for (const entry of entries) {
      if (visible.has(entry.car.carId)) continue;
      if (entry.reason === null) overflow[entry.car.carClass] += 1;
      else overflow.hot += 1;
    }
    this.renderOverflow({
      cold: [], hot: [], hotOverflow: overflow.hot,
      laneOverflow: { H: overflow.H, P: overflow.P, GT: overflow.GT },
    });
    const stopped = shown.filter(({ reason }) => reason === 'error' || reason === 'limit');
    if (stopped.length !== this.pitBoxCount) {
      this.pitBoxCount = stopped.length;
      this.pitBoxCache = stopped.length > 0 ? pitBoxes(this.track, Math.max(2, stopped.length)) : [];
    }
    const boxes = this.pitBoxCache;
    let pitIndex = 0;
    for (const { car, reason } of shown) {
      const node = this.node(car.carId, car.progress, now, visible);
      const halted = reason === 'error' || reason === 'limit' || car.freshness === 'stale';
      const motion = node.motion;
      if (!halted && car.progress !== motion.anchor) {
        advance(motion, now);
        motion.start = motion.visual;
        motion.target = forwardTarget(motion.anchor, car.progress);
        motion.duration = Math.min(MAX_MOTION_MS, Math.max(MIN_MOTION_MS, now - motion.anchorAt));
        motion.anchor = motion.target;
        motion.anchorAt = now;
        if (this.reducedMotion) motion.visual = motion.target;
      } else if (!halted && !this.reducedMotion) {
        advance(motion, now);
      }
      const point = reason === 'error' || reason === 'limit'
        ? boxes[pitIndex++]
        : positionAt(this.track, motion.visual % 1, car.carClass, car.laneLine);
      if (!point) throw new RangeError('broadcast pit position missing');
      node.group.style.transform = `translate(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px)`;
      node.group.style.opacity = '1';
      node.group.dataset['reason'] = reason ?? '';
      node.group.dataset['freshness'] = car.freshness;
      node.group.dataset['selected'] = String(car.carId === selected);
      node.group.dataset['hot'] = String(reason !== null);
      node.glyph.setAttribute('fill', CLASS_STYLE[car.carClass].color);
      node.glyph.setAttribute('d', reason === 'error'
        ? 'M -6 -6 L 6 6 M 6 -6 L -6 6'
        : reason === 'limit' ? 'M -7 -5 L 7 -5 M -7 5 L 7 5'
          : classGlyphPath(CLASS_STYLE[car.carClass].shape));
      node.glyph.setAttribute('data-stop-shape', reason === 'error' ? 'error-mark' : reason === 'limit' ? 'limit-bars' : '');
    }
    for (const [carId, node] of this.cars) {
      if (!visible.has(carId)) node.group.style.opacity = '0';
    }
  }

  visualProgressOf(carId: string): number | undefined {
    return this.cars.get(carId)?.motion.visual;
  }

  get nodeCount(): number {
    return this.cars.size;
  }
}
