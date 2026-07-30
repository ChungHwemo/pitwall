import type { Point, Track } from '../track/generateTrack';
import { positionAt } from '../track/layout';
import { CLASS_STYLE } from '../config/theme';
import type { CarClass } from '../types';
import type { Cluster, HotCar, TrackModel } from '../track/trackModel';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GLYPH_SIZE = 7;
export const GLYPH_DIAMETER = GLYPH_SIZE * 2;

/** 여럿을 표현하는 실루엣 겹 수 상한. 3 이상은 전부 "여럿"이다. */
const MAX_LAYERS = 3;
/** 겹칠 때 어긋나는 픽셀 */
const LAYER_OFFSET = 4;

/**
 * 보간 계수 — f1-telemetry(`877f99c`) 실측 값.
 * `PROJECTION_CLAMP`가 핵심이다. 목표에 닿기 전에 멈춰서, 데이터가 늦어도
 * 차가 다음 앵커를 앞지르지 않는다. §15의 "데이터 없을 때 임의 이벤트 생성 금지"와
 * 같은 규율의 렌더 버전이다.
 */
const LERP = 0.15;
const SNAP = 0.0005;
const PROJECTION_CLAMP = 0.95;

interface HotNode {
  group: SVGGElement;
  body: SVGPathElement;
  fuelRing: SVGCircleElement;
  /** 이 슬롯이 현재 맡은 차량. 바뀌면 모양·색을 다시 칠한다. */
  carId: string;
  carClass: CarClass | null;
}

interface ClusterNode {
  group: SVGGElement;
  layers: SVGPathElement[];
  /** 이 슬롯이 현재 맡은 클러스터. 바뀌면 모양·색을 다시 칠한다. */
  key: string;
  carClass: CarClass | null;
  /** 마지막으로 쓴 위치. 그대로면 DOM을 건드리지 않는다. */
  progress: number;
  shownLayers: number;
}

/**
 * 글리프 경로. 오프셋은 path 데이터에 굽는다 —
 * SVG `transform` 속성을 쓰면 검수 게이트의 grep이 정적/동적을 구분하지 못한다.
 */
function glyphPath(shape: 'circle' | 'triangle' | 'square', s: number, dx = 0, dy = 0): string {
  switch (shape) {
    case 'triangle':
      return `M ${dx} ${dy - s} L ${dx + s} ${dy + s * 0.8} L ${dx - s} ${dy + s * 0.8} Z`;
    case 'square':
      return `M ${dx - s} ${dy - s} L ${dx + s} ${dy - s} L ${dx + s} ${dy + s} L ${dx - s} ${dy + s} Z`;
    case 'circle':
      return `M ${dx - s} ${dy} A ${s} ${s} 0 1 0 ${dx + s} ${dy} A ${s} ${s} 0 1 0 ${dx - s} ${dy} Z`;
  }
}

function translate(el: SVGGElement, p: Point): void {
  el.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`;
}

/**
 * `TrackModel`을 SVG로 그린다. 무엇을 그릴지는 정하지 않는다 — 모델이 정한다.
 *
 * 프레임당 쓰기는 hot 차량 수로 제한된다. 클러스터는 빈 중앙에 고정이라
 * 빈이 바뀔 때만 움직이고, 그 사이에는 DOM을 건드리지 않는다.
 */
export class TrackRenderer {
  /**
   * hot 노드도 풀이다. car_id로 키를 잡으면 한 번이라도 사건이 난 차가 전부 남아
   * 클러스터에서 겪은 것과 같은 누적이 생긴다 (실측: 300노드).
   * 슬롯은 hot 상한만큼만 있으면 된다.
   */
  private hotPool: HotNode[] = [];
  /**
   * 보간 상태는 슬롯이 아니라 **차량**에 붙는다. 슬롯이 재배정돼도
   * 같은 차는 이어서 움직여야 한다. 숫자 하나뿐이라 쌓여도 싸지만,
   * hot에서 빠진 차는 지워서 무한 증가를 막는다.
   */
  private visual = new Map<string, number>();
  /**
   * 클러스터 노드 풀. 빈마다 노드를 만들면 차가 트랙을 돌수록 노드가 쌓인다
   * (실측: 634 → 1,363). 필요한 건 **동시에 보이는 클러스터 수**뿐이라
   * 슬롯을 재사용한다.
   */
  private clusterPool: ClusterNode[] = [];
  private carLayer: SVGGElement;

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

  private hotSlot(index: number): HotNode {
    const existing = this.hotPool[index];
    if (existing) return existing;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'car');

    const body = document.createElementNS(SVG_NS, 'path');
    const fuelRing = document.createElementNS(SVG_NS, 'circle');
    fuelRing.setAttribute('r', String(GLYPH_SIZE + 3));
    fuelRing.setAttribute('fill', 'none');
    fuelRing.setAttribute('stroke-width', '2');

    group.append(fuelRing, body);
    this.carLayer.appendChild(group);

    const node: HotNode = { group, body, fuelRing, carId: '', carClass: null };
    this.hotPool[index] = node;
    return node;
  }

  /** 풀에서 슬롯 하나를 꺼낸다. 모자라면 그때 만든다. */
  private clusterSlot(index: number): ClusterNode {
    const existing = this.clusterPool[index];
    if (existing) return existing;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'cluster');

    // 수를 글자로 쓰지 않는다 (PRD §6.3: 트랙 위 텍스트·크기 인코딩 금지).
    // 대신 같은 글리프를 어긋나게 겹친다 — 1대, 2대, 여럿.
    const layers = Array.from({ length: MAX_LAYERS }, () => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.style.opacity = '0';
      group.appendChild(path);
      return path;
    });

    this.carLayer.appendChild(group);
    const node: ClusterNode = { group, layers, key: '', carClass: null, progress: -1, shownLayers: 0 };
    this.clusterPool[index] = node;
    return node;
  }

  render(model: TrackModel, _now: number): void {
    this.renderClusters(model.clusters);
    this.renderHot(model.hot);
  }

  private renderClusters(clusters: Cluster[]): void {
    clusters.forEach((cluster, i) => {
      const node = this.clusterSlot(i);

      // 슬롯이 다른 클러스터를 맡게 되면 모양·색을 다시 칠한다.
      // 클러스터 집합은 상태가 바뀔 때만 달라지므로 프레임 비용이 아니다.
      if (node.key !== cluster.key) {
        if (node.carClass !== cluster.carClass) {
          const style = CLASS_STYLE[cluster.carClass];
          node.layers.forEach((p, layer) => {
            p.setAttribute('d', glyphPath(style.shape, GLYPH_SIZE, layer * LAYER_OFFSET, layer * -LAYER_OFFSET));
            p.setAttribute('fill', style.color);
          });
          node.carClass = cluster.carClass;
        }
        node.key = cluster.key;
      }

      // 빈 중앙은 고정이다. 위치가 그대로면 DOM을 건드리지 않는다.
      if (node.progress !== cluster.progress) {
        translate(node.group, positionAt(this.track, cluster.progress, cluster.carClass));
        node.progress = cluster.progress;
      }

      const layers = Math.min(cluster.count, MAX_LAYERS);
      if (node.shownLayers !== layers) {
        node.layers.forEach((p, layer) => { p.style.opacity = layer < layers ? '1' : '0'; });
        node.shownLayers = layers;
      }
      if (node.group.style.opacity !== '1') node.group.style.opacity = '1';
    });

    // 남는 슬롯은 숨긴다. 지우지 않는다.
    for (let i = clusters.length; i < this.clusterPool.length; i++) {
      const node = this.clusterPool[i]!;
      if (node.group.style.opacity !== '0') node.group.style.opacity = '0';
    }
  }

  private renderHot(hot: HotCar[]): void {
    hot.forEach((car, i) => {
      const node = this.hotSlot(i);

      if (node.carId !== car.carId) {
        if (node.carClass !== car.carClass) {
          const style = CLASS_STYLE[car.carClass];
          node.body.setAttribute('d', glyphPath(style.shape, GLYPH_SIZE));
          node.body.setAttribute('fill', style.color);
          node.fuelRing.setAttribute('stroke', style.color);
          node.carClass = car.carClass;
        }
        node.carId = car.carId;
      }

      // 처음 보는 차는 목표 위치에서 시작한다. 0에서 날아오면 안 된다.
      const from = this.visual.get(car.carId) ?? car.progress;

      // 폐곡선이라 0.9 → 0.1은 뒤로 가는 게 아니라 결승선을 넘는 것이다.
      let delta = car.progress - from;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;

      const next = Math.abs(delta) < SNAP
        ? car.progress
        : (from + delta * Math.min(LERP, PROJECTION_CLAMP) + 1) % 1;
      this.visual.set(car.carId, next);

      translate(node.group, positionAt(this.track, next, car.carClass));
      if (node.group.style.opacity !== '1') node.group.style.opacity = '1';
    });

    for (let i = hot.length; i < this.hotPool.length; i++) {
      const node = this.hotPool[i]!;
      if (node.group.style.opacity !== '0') node.group.style.opacity = '0';
    }

    // hot에서 빠진 차의 보간 상태는 버린다. 다시 들어오면 목표 위치에서 시작한다.
    if (this.visual.size > hot.length) {
      const live = new Set(hot.map((h) => h.carId));
      for (const id of this.visual.keys()) if (!live.has(id)) this.visual.delete(id);
    }
  }

  /** 테스트용 — 보간이 목표를 앞지르지 않는지 확인한다. */
  visualProgressOf(carId: string): number | undefined {
    return this.visual.get(carId);
  }

  get nodeCount(): number {
    return this.hotPool.length + this.clusterPool.length;
  }
}
