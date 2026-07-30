import type { Track } from '../track/generateTrack';
import { assignLanes, positionAt } from '../track/layout';
import { CLASS_STYLE } from '../config/theme';
import type { CarClass, CarState, RaceState } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GLYPH_SIZE = 7;

/** 차량 하나가 차지하는 DOM 노드는 본체 + 연료 링 = 2개로 제한한다 (PRD §11.2) */
interface CarNode {
  group: SVGGElement;
  body: SVGPathElement;
  fuelRing: SVGCircleElement;
}

function glyphPath(shape: 'circle' | 'triangle' | 'square', s: number): string {
  switch (shape) {
    case 'triangle':
      return `M 0 ${-s} L ${s} ${s * 0.8} L ${-s} ${s * 0.8} Z`;
    case 'square':
      return `M ${-s} ${-s} L ${s} ${-s} L ${s} ${s} L ${-s} ${s} Z`;
    case 'circle':
      return `M ${-s} 0 A ${s} ${s} 0 1 0 ${s} 0 A ${s} ${s} 0 1 0 ${-s} 0 Z`;
  }
}

export class TrackRenderer {
  private nodes = new Map<string, CarNode>();
  private carLayer: SVGGElement;
  private clustered: Record<CarClass, number> = { H: 0, P: 0, GT: 0 };

  constructor(
    private container: SVGSVGElement,
    private track: Track,
  ) {
    this.container.setAttribute('viewBox', '0 0 1000 1000');
    this.drawCenterline();
    this.carLayer = document.createElementNS(SVG_NS, 'g');
    this.carLayer.setAttribute('class', 'cars');
    this.container.appendChild(this.carLayer);
  }

  private drawCenterline(): void {
    const d = this.track.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ') + ' Z';
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'track-centerline');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2a323d');
    path.setAttribute('stroke-width', '34');
    path.setAttribute('stroke-linejoin', 'round');
    this.container.appendChild(path);
  }

  private nodeFor(car: CarState): CarNode {
    const existing = this.nodes.get(car.car_id);
    if (existing) return existing;

    const style = CLASS_STYLE[car.car_class];
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'car');

    const body = document.createElementNS(SVG_NS, 'path');
    body.setAttribute('d', glyphPath(style.shape, GLYPH_SIZE));
    body.setAttribute('fill', style.color);

    const fuelRing = document.createElementNS(SVG_NS, 'circle');
    fuelRing.setAttribute('r', String(GLYPH_SIZE + 3));
    fuelRing.setAttribute('fill', 'none');
    fuelRing.setAttribute('stroke', style.color);
    fuelRing.setAttribute('stroke-width', '2');

    group.appendChild(fuelRing);
    group.appendChild(body);
    this.carLayer.appendChild(group);

    const node: CarNode = { group, body, fuelRing };
    this.nodes.set(car.car_id, node);
    return node;
  }

  render(state: RaceState, now: number): void {
    const { visible, clustered } = assignLanes(state.cars, now);
    this.clustered = clustered;

    const shown = new Set<string>();

    for (const [cls, cars] of visible) {
      const total = Math.max(1, cars.length);
      cars.forEach((car, index) => {
        const node = this.nodeFor(car);
        // 진행률: 누적 거리를 랩 길이로 나눈 나머지. 같은 레인 안에서 겹치지 않게 분산한다.
        const progress = ((car.distance % 200_000) / 200_000 + index / total / 8) % 1;
        const pos = positionAt(this.track, progress, cls);

        // CSS transform만 쓴다. setAttribute('transform', …)은 re-layout을 유발해
        // 측정상 2–5배 느려진다 (Global Constraints의 벤치마크 참조).
        node.group.style.transform = `translate(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px)`;
        node.group.style.opacity = '1';
        node.fuelRing.style.opacity = (car.fuel_pct / 100).toFixed(3);
        shown.add(car.car_id);
      });
    }

    // 사라진 차량은 노드를 지우지 않고 숨긴다 — 재생성 비용과 GC 부담을 피한다.
    for (const [carId, node] of this.nodes) {
      if (!shown.has(carId)) node.group.style.opacity = '0';
    }
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get clusteredCounts(): Record<CarClass, number> {
    return this.clustered;
  }
}
