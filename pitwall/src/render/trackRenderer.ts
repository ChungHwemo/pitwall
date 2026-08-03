import { trackWidth, TRACK_STROKE } from '../track/generateTrack';
import type { Point, Track } from '../track/generateTrack';
import { positionAt, pitBoxes, pitLanePoints, PIT_LANE_STROKE } from '../track/layout';
import { Projector } from './projection';
import { CLASS_STYLE, TRACK_COLOR, BACKGROUND, EVENT_POLARITY_COLOR } from '../config/theme';
import type { CarClass } from '../types';
import type { HotCar, RenderCar, TrackModel } from '../track/trackModel';
import { HOT_CAP } from '../track/trackModel';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 글리프 반지름. 선보다 점이 커야 미니맵처럼 읽힌다. */
const GLYPH_SIZE = 6;
/**
 * 코스 선의 굵기. **한 곳에서만 정한다** — 예전에는 51이 이 파일과 `layout.ts`와
 * `generateTrack.ts`에 각각 박혀 있었고, 하나만 고치면 나머지가 조용히 어긋났다.
 */
export const TRACK_WIDTH = TRACK_STROKE;
export const GLYPH_DIAMETER = GLYPH_SIZE * 2;

/**
 * F1 차량 실루엣 본체 경로. `assets/f1/game-icons/f1-car.svg`(Skoll, Game Icons,
 * CC BY 3.0)의 흰색 본체 `d` 값만 뗀 것이다 — 원본의 검은 배경 사각형 경로는
 * 쓰지 않는다. 클래스 색으로 칠할 수 없고 배경과 겹쳐 차량 실루엣을 흐리기 때문이다.
 * 원본 viewBox는 `0 0 512 512`지만 렌더 시 본체 bbox로 잘라 쓴다 (`CAR_ICON_VIEWBOX`).
 */
export const F1_CAR_PATH =
  'M355.975 292.25a24.82 24.82 0 1 0 24.82-24.81 24.84 24.84 0 0 0-24.82 24.81zm-253-24.81a24.81 24.81 0 1 1-24.82 24.81 24.84 24.84 0 0 1 24.81-24.81zm-76.67-71.52h67.25l-13.61 49.28 92-50.28h57.36l1.26 34.68 32 14.76 11.74-14.44h15.62l3.16 16c137.56-13 192.61 29.17 192.61 29.17s-7.52 5-25.93 8.39c-3.88 3.31-3.66 14.44-3.66 14.44h24.2v16h-52v-27.48c-1.84.07-4.45.41-7.06.47a40.81 40.81 0 1 0-77.25 23h-204.24a40.81 40.81 0 1 0-77.61-17.67c0 1.24.06 2.46.17 3.67h-36z';

/**
 * CC BY 3.0 저작자 표시. game-icons.net 라이선스는 인라인 SVG 코드 바로 앞에
 * HTML 주석으로 저작자를 남기도록 요구한다. 실제 DOM `Comment` 노드로 심어야
 * 번들된 HTML에서도 지워지지 않는다 — 소스 주석은 빌드 시 사라진다.
 */
const SKOLL_CREDIT = ' Icon by Skoll, from game-icons.net, CC BY 3.0 ';

/** F1 아이콘이 그룹 원점 기준 차지하는 자리 (user unit). */
const CAR_ICON = { x: -12, y: -8, width: 24, height: 16 };
/**
 * 중첩 SVG viewBox. 본체 `d`의 실측 bbox(`x=26.3, y=194.9, w=459.4, h=122.2`)에
 * 맞춰 자른다 — 512×512 그대로면 실루엣이 한가운데 점처럼 뜬다. 본체는 fill 전용
 * (획 없음)이라 여백 없이 딱 맞춰도 잘리지 않는다.
 */
const CAR_ICON_VIEWBOX = '26.3 194.9 459.4 122.2';
/** 투명 클릭 타깃 반지름. cold 차량이 장식 없이도 선택되도록 차량 영역을 덮는다. */
const CAR_HIT_RADIUS = 10;
/** 클래스 배지 반지름/반폭과 차량 아래 중앙 위치. */
const BADGE_RADIUS = 3;
const BADGE_Y = 10.5;

/**
 * 멈춤 사유별 표시. 글자가 아니라 획으로 그린다 (§6.3: 트랙 위 텍스트 금지).
 *
 * 에러와 한도는 둘 다 "더 못 간다"지만 원인이 다르다 —
 * 에러는 호출이 실패한 것이고, 한도는 예산이 떨어진 것이다. 모양으로 구분한다.
 * 색은 둘 다 이벤트 극성의 `caution`을 공유한다 (§4.3.1) — 따뜻한 노랑은
 * 델타·갭 숫자 전용이라 여기 남을 수 없다.
 */
const STOP_MARK: Record<string, { d: string; color: string }> = {
  // 느낌표 — 획 + 점
  error: {
    d: `M 0 ${-GLYPH_SIZE - 20} L 0 ${-GLYPH_SIZE - 9} M 0 ${-GLYPH_SIZE - 5} L 0 ${-GLYPH_SIZE - 4}`,
    color: EVENT_POLARITY_COLOR.caution,
  },
  // 빈 게이지 — 가로 두 줄. 연료가 바닥났다는 뜻이다
  limit: {
    d: `M -7 ${-GLYPH_SIZE - 16} L 7 ${-GLYPH_SIZE - 16} M -7 ${-GLYPH_SIZE - 8} L 7 ${-GLYPH_SIZE - 8}`,
    color: EVENT_POLARITY_COLOR.caution,
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
  /** F1 차량 실루엣 본체 — hot/cold 공통. */
  carIcon: SVGPathElement;
  /** 클래스 배지 — 삼각형/원/사각형. */
  badge: SVGPathElement;
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
  carIcon: SVGPathElement;
  badge: SVGPathElement;
  /** 이 슬롯이 현재 맡은 차량. 바뀌면 모양·색을 다시 칠한다. */
  carId: string;
  carClass: CarClass | null;
}

/**
 * 글리프 경로. 오프셋은 path 데이터에 굽는다 —
 * SVG `transform` 속성을 쓰면 검수 게이트의 grep이 정적/동적을 구분하지 못한다.
 *
 * 차량 본체가 F1 실루엣으로 바뀐 뒤에도 삭제하지 않는다 — 클래스 배지가
 * 여전히 이 함수로 삼각형/원/사각형을 그린다.
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

/**
 * 차량 본체(F1 실루엣) + 클래스 배지를 그룹에 붙인다. hot·cold가 구조를 공유한다.
 * 배지가 먼저, F1 아이콘이 다음이다 — 배지가 차량 실루엣을 가리지 않는 순서.
 */
function appendCarBody(group: SVGGElement): { badge: SVGPathElement; carIcon: SVGPathElement } {
  const hit = document.createElementNS(SVG_NS, 'circle');
  hit.setAttribute('class', 'car-hit');
  hit.setAttribute('r', String(CAR_HIT_RADIUS));
  hit.setAttribute('fill', 'transparent');
  hit.setAttribute('pointer-events', 'all');
  hit.setAttribute('aria-hidden', 'true');
  group.appendChild(hit);

  const badge = document.createElementNS(SVG_NS, 'path');
  badge.setAttribute('class', 'class-badge');
  badge.setAttribute('aria-hidden', 'true');
  badge.setAttribute('fill', BACKGROUND);
  badge.setAttribute('stroke-width', '1.25');
  group.appendChild(badge);

  group.appendChild(document.createComment(SKOLL_CREDIT));

  const iconSvg = document.createElementNS(SVG_NS, 'svg');
  iconSvg.setAttribute('class', 'class-car-icon');
  iconSvg.setAttribute('viewBox', CAR_ICON_VIEWBOX);
  iconSvg.setAttribute('x', String(CAR_ICON.x));
  iconSvg.setAttribute('y', String(CAR_ICON.y));
  iconSvg.setAttribute('width', String(CAR_ICON.width));
  iconSvg.setAttribute('height', String(CAR_ICON.height));

  const carIcon = document.createElementNS(SVG_NS, 'path');
  carIcon.setAttribute('d', F1_CAR_PATH);
  iconSvg.appendChild(carIcon);
  group.appendChild(iconSvg);

  return { badge, carIcon };
}

/** carClass가 바뀔 때만 배지·아이콘의 모양과 색을 다시 칠한다. */
function paintCarClass(badge: SVGPathElement, carIcon: SVGPathElement, carClass: CarClass): void {
  const style = CLASS_STYLE[carClass];
  badge.setAttribute('d', glyphPath(style.shape, BADGE_RADIUS, 0, BADGE_Y));
  badge.setAttribute('stroke', style.color);
  carIcon.setAttribute('fill', style.color);
}

/**
 * carId → 0..4초 결정적 idle sway 위상 (FNV-1a).
 *
 * 같은 차는 항상 같은 위상이라 재접속·재렌더에도 떨림이 튀지 않는다.
 * RNG가 아니라 id 해시인 이유는 `trackModel.progressOf`와 같다 — 배치는
 * 데이터에서만 나와야 한다. sway는 진행이 아니라 제자리 시각 효과일 뿐이라
 * 시각적 다양성 용도로만 쓴다.
 */
function idleSwayDelay(carId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < carId.length; i++) {
    h ^= carId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (((h >>> 0) % 1000) / 1000) * 4;
}

/**
 * 속도와 유휴를 DOM에 얹는다. **위치는 건드리지 않는다** — 위치는 누적이고
 * 속도는 별개의 사실이다. 어떻게 보일지는 CSS가 정한다.
 *
 * 값은 소수 둘째 자리로 자른다. 프레임마다 미세하게 다른 문자열을 쓰면
 * 재계산이 공짜가 아니다.
 *
 * `--pw-idle-delay`는 유휴 sway(엔진 공회전 떨림, REVIEW #10)의 차량별 위상이다.
 * data-idle이 'false'→'true'로 **바뀔 때만** 쓴다 — 프레임 쓰기 예산을 지키는
 * 기존 가드 안에 끼워 넣는다. **진행은 토큰의 순수 함수(1:1 불변식)이고 sway는
 * 제자리 시각 효과일 뿐 진행이 아니다** — 위상 var는 위치를 1밀리도 옮기지 않는다.
 * 음수 delay라 애니메이션이 시작 즉시 중간 위상에서 도는데, 이래야 유휴 차들이
 * 한 박자로 동기화돼 떨리지 않는다.
 */
function applyHeat(el: SVGGElement, heat: number, idle: boolean, carId: string): void {
  const rounded = heat.toFixed(2);
  if (el.style.getPropertyValue('--pw-heat') !== rounded) {
    el.style.setProperty('--pw-heat', rounded);
  }
  const flag = idle ? 'true' : 'false';
  if (el.getAttribute('data-idle') !== flag) {
    el.setAttribute('data-idle', flag);
    if (idle) el.style.setProperty('--pw-idle-delay', `-${idleSwayDelay(carId).toFixed(2)}s`);
  }
}

function translate(el: SVGGElement, p: Point): void {
  el.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`;
}

/** 단위 벡터. 길이 0이면 항등 벡터를 돌려준다 — 0으로 나누는 사고를 막는다. */
function unit(dx: number, dy: number): Point {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** 진행 방향을 90도 회전한 횡단 벡터. */
function perpendicular(v: Point): Point {
  return { x: -v.y, y: v.x };
}

/**
 * 사각형 한 칸의 경로를 두 기저 벡터(along, trans)로 직접 굽는다.
 * SVG `transform`을 쓰면 정적 검사 grep이 회전을 못 본다. 기저가 표준 x/y
 * 단위 벡터면 축 정렬 사각형과 같은 결과를 낸다 — 피트 표지가 그 경우다.
 */
function vecRect(corner: Point, along: Point, trans: Point, alongLen: number, transLen: number): string {
  const p1 = corner;
  const p2 = { x: corner.x + trans.x * transLen, y: corner.y + trans.y * transLen };
  const p3 = { x: p2.x + along.x * alongLen, y: p2.y + along.y * alongLen };
  const p4 = { x: corner.x + along.x * alongLen, y: corner.y + along.y * alongLen };
  return [p1, p2, p3, p4]
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ') + ' Z';
}

/** 표준 x/y 축 — 기존 축 정렬 사각형(피트 표지)이 쓰는 기저. */
const AXIS_X: Point = { x: 1, y: 0 };
const AXIS_Y: Point = { x: 0, y: 1 };

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
  /** 샘플 사이를 이어 달리게 하는 투영기. 보간만으로는 호출 사이에 멈춰 선다. */
  private projector = new Projector();
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
    // 상자 비율도 코스가 정한다. CSS가 정하면 preserveAspectRatio가 남는 폭을
    // 위아래로 갈라 죽은 띠를 만든다 — 실측 4K에서 647px가 그렇게 죽어 있었다.
    this.container.style.aspectRatio = String(track.aspect);
    this.drawCenterline();
    this.drawStartFinish();
    this.drawSectorMarkers();
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
    path.setAttribute('stroke', TRACK_COLOR.centerline);
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
    // 피트에 설 수 있는 최대만큼 그린다. 8칸 고정이던 시절에는 9번째 차부터
    // 선 밖에 떠 있었고, 그러면 정지가 아니라 코스 이탈로 읽힌다.
    const pts = pitLanePoints(this.track, HOT_CAP);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'pit-lane');
    path.setAttribute('d', pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', TRACK_COLOR.pitLane);
    path.setAttribute('stroke-width', String(PIT_LANE_STROKE));
    path.setAttribute('stroke-linecap', 'round');
    this.container.appendChild(path);

    // 표지는 레인 끝에 둔다. 입구에 두면 첫 박스에 선 차가 그대로 덮는다.
    // 'PIT' 글자 대신 체커드 플래그 도형 — 트랙 위 텍스트 라벨 금지 (§6.3 하드 룰).
    const tail = pts[pts.length - 1]!;
    this.drawPitFlag(tail.x, tail.y + 34);
  }

  /**
   * 체커기(체커드 플래그) 표지. 글자가 아니라 획으로 그린다 (§6.3: 트랙 위 텍스트 금지).
   * 중심을 (cx, cy)에 두고, 좌표는 path에 굽는다 — glyphPath와 같은 이유로 transform을 쓰지 않는다.
   * `vecRect`를 표준 x/y 기저로 호출하므로 좌표·크기는 예전과 완전히 같다.
   */
  private drawPitFlag(cx: number, cy: number): void {
    const q = 4.5;
    const cols = 3;
    const rows = 2;
    const gx = cx - (cols * q) / 2 + 1;
    const gy = cy - (rows * q) / 2;

    // 깃대 + 천 바탕. 어두운 채움이라 밝은 칸이 대비로 뜬다.
    const base = document.createElementNS(SVG_NS, 'path');
    base.setAttribute('class', 'pit-label');
    base.setAttribute('d',
      vecRect({ x: gx - 3, y: gy - 3 }, AXIS_Y, AXIS_X, cols * q + 6, 1.6) + ' ' +
      vecRect({ x: gx, y: gy }, AXIS_Y, AXIS_X, rows * q, cols * q));
    base.setAttribute('fill', TRACK_COLOR.markerDark);
    this.container.appendChild(base);

    // 밝은 칸만 그린다 — (행+열)이 짝수인 칸. 나머지는 바탕이 비쳐 체커 무늬가 된다.
    let checker = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          checker += vecRect({ x: gx + c * q, y: gy + r * q }, AXIS_Y, AXIS_X, q, q) + ' ';
        }
      }
    }
    const light = document.createElementNS(SVG_NS, 'path');
    light.setAttribute('class', 'pit-label');
    light.setAttribute('d', checker.trim());
    light.setAttribute('fill', TRACK_COLOR.markerLight);
    this.container.appendChild(light);
  }

  /**
   * 스타트/피니시 체커 스트립. 진행률 0(`track.points[0]`) 위에 그린다.
   * 진행 방향·횡단 방향 두 기저 벡터로 좌표를 직접 계산한다 — 코스가 그 지점에서
   * 어느 쪽을 향하든 스트립이 중심선에 수직으로 걸린다.
   */
  private drawStartFinish(): void {
    const n = this.track.points.length;
    const p0 = this.track.points[0]!;
    const prev = this.track.points[n - 1]!;
    const next = this.track.points[1]!;
    const along = unit(next.x - prev.x, next.y - prev.y);
    const trans = perpendicular(along);

    const alongHalf = 6;   // 진행 방향 전체 12의 절반
    const transHalf = 8;   // 횡단 방향 전체 16의 절반
    const cellAlong = 6;   // 칸 하나의 진행 방향 길이 (2행)
    const cellTrans = 4;   // 칸 하나의 횡단 방향 길이 (4열)

    const marker = document.createElementNS(SVG_NS, 'g');
    marker.setAttribute('class', 'start-finish-marker');

    const originCorner = (): Point => ({
      x: p0.x - along.x * alongHalf - trans.x * transHalf,
      y: p0.y - along.y * alongHalf - trans.y * transHalf,
    });

    const base = document.createElementNS(SVG_NS, 'path');
    base.setAttribute('data-cell', 'base');
    base.setAttribute('d', vecRect(originCorner(), along, trans, alongHalf * 2, transHalf * 2));
    base.setAttribute('fill', TRACK_COLOR.markerDark);
    marker.appendChild(base);

    const rows = 2;
    const cols = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 !== 0) continue;
        const corner = {
          x: originCorner().x + along.x * (r * cellAlong) + trans.x * (c * cellTrans),
          y: originCorner().y + along.y * (r * cellAlong) + trans.y * (c * cellTrans),
        };
        const cell = document.createElementNS(SVG_NS, 'path');
        cell.setAttribute('data-cell', 'light');
        cell.setAttribute('d', vecRect(corner, along, trans, cellAlong, cellTrans));
        cell.setAttribute('fill', TRACK_COLOR.markerLight);
        marker.appendChild(cell);
      }
    }

    this.container.appendChild(marker);
  }

  /**
   * 섹터 경계 틱. `Track.sectors`의 0이 아닌 두 경계(1/3, 2/3)에 짧은 수직 틱을
   * 그린다 — 0 경계는 스타트/피니시 스트립이 이미 표시하므로 건너뛴다.
   * `sectors`가 계약([0, 1/3, 2/3])과 다르면 아무것도 그리지 않는다.
   */
  private drawSectorMarkers(): void {
    const [s0, s1, s2] = this.track.sectors;
    if (s0 !== 0 || !(s1 > 0 && s1 < s2 && s2 < 1)) return;

    const n = this.track.points.length;
    for (const progress of [s1, s2]) {
      const point = positionAt(this.track, progress, 'P', 0);
      const idx = Math.floor(((progress % 1) + 1) % 1 * n) % n;
      const prev = this.track.points[(idx - 1 + n) % n]!;
      const next = this.track.points[(idx + 1) % n]!;
      const along = unit(next.x - prev.x, next.y - prev.y);
      const trans = perpendicular(along);

      const tick = document.createElementNS(SVG_NS, 'path');
      tick.setAttribute('class', 'sector-marker');
      tick.setAttribute('d',
        `M ${(point.x - trans.x * 6).toFixed(2)} ${(point.y - trans.y * 6).toFixed(2)} ` +
        `L ${(point.x + trans.x * 6).toFixed(2)} ${(point.y + trans.y * 6).toFixed(2)}`);
      tick.setAttribute('stroke', TRACK_COLOR.sector);
      tick.setAttribute('stroke-width', '2');
      tick.setAttribute('stroke-linecap', 'round');
      tick.setAttribute('fill', 'none');
      this.container.appendChild(tick);
    }
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

    const { badge, carIcon } = appendCarBody(group);

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

    group.append(fuelRing, alert);
    this.carLayer.appendChild(group);

    const node: HotNode = { group, carIcon, badge, fuelRing, alert, carId: '', carClass: null, reason: '' };
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
    const { badge, carIcon } = appendCarBody(group);
    this.carLayer.appendChild(group);

    const node: ColdNode = { group, carIcon, badge, carId: '', carClass: null };
    this.coldPool[index] = node;
    return node;
  }

  /** 트랙에서 차를 고르면 부른다. 카드에 그 계정의 내역을 띄우는 데 쓴다. */
  onSelect(handler: (carId: string) => void): void {
    this.selectHandler = handler;
  }

  render(model: TrackModel, now: number, selected: string | null = null): void {
    this.selected = selected;
    this.renderCold(model.cold, now);
    this.renderHot(model.hot, now);
    // 오래 보이지 않은 차만 버린다. 유휴로 잠깐 빠진 차는 자리를 지켜야
    // 돌아올 때 이어 달린다.
    this.projector.sweep(now);
  }

  private markSelection(group: SVGGElement, carId: string): void {
    const flag = carId === this.selected ? 'true' : 'false';
    if (group.getAttribute('data-selected') !== flag) group.setAttribute('data-selected', flag);
  }

  private renderCold(cars: RenderCar[], now: number): void {
    cars.forEach((car, i) => {
      const node = this.coldSlot(i);

      if (node.carId !== car.carId) {
        if (node.carClass !== car.carClass) {
          paintCarClass(node.badge, node.carIcon, car.carClass);
          node.carClass = car.carClass;
        }
        node.carId = car.carId;
      }

      applyHeat(node.group, car.heat, car.idle, car.carId);
      const next = this.projector.step(car.carId, car.progress, now);
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

  private renderHot(hot: HotCar[], now: number): void {
    /*
     * 세울 자리를 먼저 만든다. 간격이 진행률이 아니라 **앞 박스와의 실제 거리**로
     * 정해지므로, 자리 하나를 따로 계산할 수 없고 몇 대가 서는지 알아야 한다.
     */
    const boxes = pitBoxes(this.track, hot.filter((c) => STOPPED.has(c.reason)).length);
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
          paintCarClass(node.badge, node.carIcon, car.carClass);
          node.fuelRing.setAttribute('stroke', CLASS_STYLE[car.carClass].color);
          node.carClass = car.carClass;
        }
        node.carId = car.carId;
      }

      // 에러(호출 실패)와 한도(벤더가 건 벽)는 둘 다 더 갈 수 없는 상태다.
      // 주행선 위에 세우면 달리는 차의 길을 막고, 멈춘 차가 여전히 경기 중인
      // 것처럼 보인다 — 실제 경기와 같이 피트로 들여보낸다.
      // 핀은 사용자가 고른 것이지 사건이 아니므로 계속 달린다.
      applyHeat(node.group, car.heat, car.idle, car.carId);
      if (STOPPED.has(car.reason)) {
        // 피트에 선 차는 굴러가지 않는다. 자리만 기억해 둔다.
        this.projector.hold(car.carId, now);
        // 자리가 모자라면 마지막 칸에 겹쳐 세운다 — 트랙 위에 두는 것보다 낫다.
        translate(node.group, boxes[pitSlot] ?? boxes[boxes.length - 1]!);
        pitSlot += 1;
      } else {
        const next = this.projector.step(car.carId, car.progress, now);
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

  /** 테스트용 — 투영이 목표를 지나치게 앞지르지 않는지 확인한다. */
  visualProgressOf(carId: string): number | undefined {
    return this.projector.visual(carId);
  }

  get nodeCount(): number {
    return this.hotPool.length + this.coldPool.length;
  }
}
