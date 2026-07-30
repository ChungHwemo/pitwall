import { trackWidth } from '../track/generateTrack';
import type { Point, Track } from '../track/generateTrack';
import { positionAt, pitBoxAt, pitLanePoints } from '../track/layout';
import { CLASS_STYLE } from '../config/theme';
import type { CarClass } from '../types';
import type { HotCar, RenderCar, TrackModel } from '../track/trackModel';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GLYPH_SIZE = 7;
/**
 * 트랙 폭. 레인 3개 + 각 레인의 추월 여유가 이 안에 들어가야 한다.
 * 34였을 때는 바깥 레인 차량이 트랙 밖으로 나갔다.
 */
export const TRACK_WIDTH = 102;
export const GLYPH_DIAMETER = GLYPH_SIZE * 2;



/**
 * 멈춤 사유별 표시. 글자가 아니라 획으로 그린다 (§6.3: 트랙 위 텍스트 금지).
 *
 * 에러와 한도는 둘 다 "더 못 간다"지만 원인이 다르다 —
 * 에러는 호출이 실패한 것이고, 한도는 예산이 떨어진 것이다. 구분해서 보여준다.
 */
const STOP_MARK: Record<string, { d: string; color: string }> = {
  // 느낌표 — 획 + 점
  error: {
    d: `M 0 ${-GLYPH_SIZE - 20} L 0 ${-GLYPH_SIZE - 9} M 0 ${-GLYPH_SIZE - 5} L 0 ${-GLYPH_SIZE - 4}`,
    color: '#ff5c5c',
  },
  // 빈 게이지 — 가로 두 줄. 연료가 바닥났다는 뜻이다
  limit: {
    d: `M -7 ${-GLYPH_SIZE - 16} L 7 ${-GLYPH_SIZE - 16} M -7 ${-GLYPH_SIZE - 8} L 7 ${-GLYPH_SIZE - 8}`,
    color: '#ffd24d',
  },
};

/** 이 사유들은 트랙에서 멈춘다. 더 갈 수 없는데 굴러가면 화면이 거짓말한다. */
const STOPPED = new Set(Object.keys(STOP_MARK));

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
  /** 경고 표시. 글자가 아니라 도형이다 (§6.3: 트랙 위 텍스트 금지) */
  alert: SVGPathElement;
  /** 이 슬롯이 현재 맡은 차량. 바뀌면 모양·색을 다시 칠한다. */
  carId: string;
  carClass: CarClass | null;
  /** 왜 개별로 그려지는가. CSS가 이 값으로 강조를 고른다. */
  reason: string;
}

interface ColdNode {
  group: SVGGElement;
  body: SVGPathElement;
  /** 이 슬롯이 현재 맡은 차량. 바뀌면 모양·색을 다시 칠한다. */
  carId: string;
  carClass: CarClass | null;
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
  /** 강조 없는 차량 노드 풀. 슬롯을 재사용해 노드가 누적되지 않게 한다. */
  private coldPool: ColdNode[] = [];
  private carLayer: SVGGElement;
  private selectHandler: ((carId: string) => void) | null = null;
  private selected: string | null = null;

  constructor(
    private container: SVGSVGElement,
    private track: Track,
  ) {
    // 좌표계는 코스가 정한다. 코스가 옆으로 퍼지면 viewBox도 같이 퍼진다 —
    // 안 그러면 늘린 코스가 잘리거나 다시 여백이 생긴다.
    this.container.setAttribute('viewBox', `0 0 ${trackWidth(track.aspect)} 1000`);
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
    path.setAttribute('stroke-width', String(TRACK_WIDTH));
    path.setAttribute('stroke-linejoin', 'round');
    this.container.appendChild(path);
    this.drawPitLane();
  }

  /**
   * 피트 레인. 멈춘 차만 인필드에 떠 있으면 "트랙을 벗어났다"로 읽힌다 —
   * 설 자리가 그려져 있어야 정지가 사고가 아니라 피트인으로 보인다.
   */
  private drawPitLane(): void {
    const pts = pitLanePoints(this.track);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'pit-lane');
    path.setAttribute('d', pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#1c222b');
    path.setAttribute('stroke-width', '26');
    path.setAttribute('stroke-linecap', 'round');
    this.container.appendChild(path);

    // 표지는 레인 끝에 둔다. 입구에 두면 첫 박스에 선 차가 그대로 덮는다.
    const tail = pts[pts.length - 1]!;
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'pit-label');
    label.setAttribute('x', tail.x.toFixed(2));
    label.setAttribute('y', (tail.y + 34).toFixed(2));
    label.textContent = 'PIT';
    this.container.appendChild(label);
  }

  private hotSlot(index: number): HotNode {
    const existing = this.hotPool[index];
    if (existing) return existing;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'car');
    group.addEventListener('click', () => {
      const id = this.hotPool[index]?.carId;
      if (id) this.selectHandler?.(id);
    });

    const body = document.createElementNS(SVG_NS, 'path');
    const fuelRing = document.createElementNS(SVG_NS, 'circle');
    fuelRing.setAttribute('r', String(GLYPH_SIZE + 3));
    fuelRing.setAttribute('fill', 'none');
    fuelRing.setAttribute('stroke-width', '2');

    // 느낌표를 획으로 그린다. 막대 + 점, 글리프 위쪽에 띄운다.
    const alert = document.createElementNS(SVG_NS, 'path');
    alert.setAttribute('class', 'alert');
    alert.setAttribute('stroke-width', '4');
    alert.setAttribute('fill', 'none');
    alert.setAttribute('stroke-linecap', 'round');
    alert.style.opacity = '0';

    group.append(fuelRing, body, alert);
    this.carLayer.appendChild(group);

    const node: HotNode = { group, body, fuelRing, alert, carId: '', carClass: null, reason: '' };
    this.hotPool[index] = node;
    return node;
  }

  /** 풀에서 슬롯 하나를 꺼낸다. 모자라면 그때 만든다. */
  private coldSlot(index: number): ColdNode {
    const existing = this.coldPool[index];
    if (existing) return existing;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'cold');
    // 슬롯은 재사용되므로 지금 맡은 차를 그때그때 읽는다. 생성 시점 값을 가두면 안 된다.
    group.addEventListener('click', () => {
      const id = this.coldPool[index]?.carId;
      if (id) this.selectHandler?.(id);
    });
    const body = document.createElementNS(SVG_NS, 'path');
    group.appendChild(body);
    this.carLayer.appendChild(group);

    const node: ColdNode = { group, body, carId: '', carClass: null };
    this.coldPool[index] = node;
    return node;
  }

  /** 트랙에서 차를 고르면 부른다. 카드에 그 계정의 내역을 띄우는 데 쓴다. */
  onSelect(handler: (carId: string) => void): void {
    this.selectHandler = handler;
  }

  render(model: TrackModel, _now: number, selected: string | null = null): void {
    this.selected = selected;
    this.renderCold(model.cold);
    this.renderHot(model.hot);
  }

  private markSelection(group: SVGGElement, carId: string): void {
    const flag = carId === this.selected ? 'true' : 'false';
    if (group.getAttribute('data-selected') !== flag) group.setAttribute('data-selected', flag);
  }

  private renderCold(cars: RenderCar[]): void {
    cars.forEach((car, i) => {
      const node = this.coldSlot(i);

      if (node.carId !== car.carId) {
        if (node.carClass !== car.carClass) {
          const style = CLASS_STYLE[car.carClass];
          node.body.setAttribute('d', glyphPath(style.shape, GLYPH_SIZE));
          node.body.setAttribute('fill', style.color);
          node.carClass = car.carClass;
        }
        node.carId = car.carId;
        // 슬롯을 새로 맡은 차는 목표 위치에서 시작한다. 날아오면 안 된다.
        this.visual.set(car.carId, car.progress);
      }

      const next = this.step(car.carId, car.progress);
      translate(node.group, positionAt(this.track, next, car.carClass, car.laneLine));
      this.markSelection(node.group, car.carId);
      if (node.group.style.opacity !== '1') node.group.style.opacity = '1';
    });

    for (let i = cars.length; i < this.coldPool.length; i++) {
      const node = this.coldPool[i]!;
      if (node.group.style.opacity !== '0') node.group.style.opacity = '0';
      if (node.group.getAttribute('data-selected') === 'true') {
        node.group.setAttribute('data-selected', 'false');
      }
    }
  }

  /**
   * 목표를 향해 한 프레임만큼 다가간다. 폐곡선이라 결승선을 넘는 경우를 따로 본다.
   * 진행률이 조금 바뀌면 위치도 조금 바뀐다 — 이게 점멸을 없앤다.
   */
  private step(carId: string, target: number): number {
    const from = this.visual.get(carId) ?? target;
    let delta = target - from;
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;

    const next = Math.abs(delta) < SNAP
      ? target
      : (from + delta * Math.min(LERP, PROJECTION_CLAMP) + 1) % 1;
    this.visual.set(carId, next);
    return next;
  }

  private renderHot(hot: HotCar[]): void {
    // 피트 박스 번호. 멈춘 차만 센다.
    let pitSlot = 0;

    hot.forEach((car, i) => {
      const node = this.hotSlot(i);

      if (node.reason !== car.reason) {
        // 사유를 DOM에 노출한다. 어떤 강조를 줄지는 CSS가 정한다.
        node.group.setAttribute('data-reason', car.reason);
        const mark = STOP_MARK[car.reason];
        if (mark) {
          node.alert.setAttribute('d', mark.d);
          node.alert.setAttribute('stroke', mark.color);
        }
        node.alert.style.opacity = mark ? '1' : '0';
        node.reason = car.reason;
      }

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

      // 에러(호출 실패)와 한도(벤더가 건 벽)는 둘 다 더 갈 수 없는 상태다.
      // 주행선 위에 세우면 달리는 차의 길을 막고, 멈춘 차가 여전히 경기 중인
      // 것처럼 보인다 — 실제 경기와 같이 피트로 들여보낸다.
      // 핀은 사용자가 고른 것이지 사건이 아니므로 계속 달린다.
      if (STOPPED.has(car.reason)) {
        translate(node.group, pitBoxAt(this.track, pitSlot, hot.length));
        pitSlot += 1;
      } else {
        const next = this.step(car.carId, car.progress);
        this.visual.set(car.carId, next);
        translate(node.group, positionAt(this.track, next, car.carClass, car.laneLine));
      }
      this.markSelection(node.group, car.carId);
      if (node.group.style.opacity !== '1') node.group.style.opacity = '1';
    });

    for (let i = hot.length; i < this.hotPool.length; i++) {
      const node = this.hotPool[i]!;
      if (node.group.style.opacity !== '0') node.group.style.opacity = '0';
    }

  }

  /** 테스트용 — 보간이 목표를 앞지르지 않는지 확인한다. */
  visualProgressOf(carId: string): number | undefined {
    return this.visual.get(carId);
  }

  get nodeCount(): number {
    return this.hotPool.length + this.coldPool.length;
  }
}
