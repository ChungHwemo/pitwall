import type { CarClass, CarEvent, EventKind } from '../types';
import { CLASS_STYLE, EVENT_POLARITY_COLOR } from '../config/theme';
import { carDisplayName } from '../config/carNames';
import { workOf, cachedOf } from '../state/reducer';
import { setText } from './setText';
import { createProviderChip, paintProviderChip } from './providerChip';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 선택한 계정의 실시간 구동 내역.
 *
 * 트랙의 차 한 대는 계정 하나다. 그 계정이 **어떤 에이전트로 무엇을 돌리는지**가
 * 이 화면이 답해야 하는 질문이라, 차를 고르면 여기에 호출 하나하나가 뜬다.
 *
 * 카넘버만 쓴다. 계정 uuid도 이메일도 화면에 오지 않는다 (PRIV-1·PRIV-3).
 * 사용자가 이 기기에서 붙인 이름(`carDisplayName`)은 뜰 수 있지만, 그건
 * 로컬 라벨이지 계정의 uuid가 아니다 — 정체는 여전히 화면 밖에 있다.
 */
export interface FeedTarget {
  /** 이름 표를 이 계정으로 조회한다. car_id는 화면에 찍지 않는다 */
  carId: string;
  carNumber: number;
  /** 색을 정한다 — 등급은 모델의 등급이다 */
  carClass: CarClass;
  /** 헤더에 쓰는 현재 모델. 등급 이름은 사람이 알고 싶은 게 아니다 */
  model: string;
}

interface Row {
  root: HTMLElement;
  icon: SVGSVGElement;
  time: HTMLElement;
  model: HTMLElement;
  who: HTMLElement;
  size: HTMLElement;
}

function compact(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

/** `claude-sonnet-5` → `sonnet-5`. 벤더 접두어는 줄마다 반복할 가치가 없다. */
function shortModel(id: string): string {
  return id.replace(/^(claude|gpt|gemini|grok|deepseek|kimi)-/, '');
}

function clockOf(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface Entry {
  event: CarEvent;
  count: number;
}

/**
 * 한 화면에서 똑같이 보이는 연속 호출을 한 줄로 접는다.
 *
 * 실데이터의 호출 간격 중앙값은 3초라 초 단위 시계로는 같은 시각에 여러 건이
 * 찍힌다. 시각·모델·주체·크기가 모두 같으면 세 줄을 보여줘도 정보가 늘지 않고
 * 피드만 가려진다 — 대신 몇 번인지 센다.
 */
function collapse(sorted: CarEvent[]): Entry[] {
  const out: Entry[] = [];
  for (const event of sorted) {
    const last = out[out.length - 1];
    if (last && rowKey(last.event) === rowKey(event)) {
      last.count += 1;
      continue;
    }
    out.push({ event, count: 1 });
  }
  return out;
}

function rowKey(e: CarEvent): string {
  return [
    clockOf(e.wall_ts ?? e.ts), e.model, e.status, e.error_code ?? '',
    e.skill ?? '', workOf(e), cachedOf(e),
  ].join('|');
}

/** 피드 행의 이벤트 극성. `CarEvent`에 없는 필드는 지어내지 않는다 (§4.3.2). */
type Polarity = 'positive' | 'caution' | 'neutral';

function polarityOf(e: CarEvent): Polarity {
  if (e.status === 'error' || e.kind === 'error' || e.kind === 'limit_warn' || e.kind === 'retire') {
    return 'caution';
  }
  return 'neutral';
}

type IconShape = { tag: 'path'; d: string } | { tag: 'circle'; cx: number; cy: number; r: number };
type IconKey = 'general' | 'pit' | 'abnormal';

/**
 * 피드 행 첫 열의 generic 자동차 아이콘 (P1-1). 세 원본 SVG(`assets/f1/lucide/car.svg`,
 * `assets/f1/tabler/car.svg`, `assets/f1/tabler/car-suv.svg`)에서 뗀 경로 문자열만
 * 인라인한다 — 외부 이미지 태그나 href 참조는 쓰지 않는다.
 */
const FEED_ICON: Record<IconKey, { viewBox: string; shapes: IconShape[] }> = {
  general: {
    viewBox: '0 0 24 24',
    shapes: [
      { tag: 'path', d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2' },
      { tag: 'circle', cx: 7, cy: 17, r: 2 },
      { tag: 'path', d: 'M9 17h6' },
      { tag: 'circle', cx: 17, cy: 17, r: 2 },
    ],
  },
  pit: {
    viewBox: '0 0 24 24',
    shapes: [
      { tag: 'path', d: 'M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
      { tag: 'path', d: 'M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
      { tag: 'path', d: 'M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5' },
    ],
  },
  abnormal: {
    viewBox: '0 0 24 24',
    shapes: [
      { tag: 'path', d: 'M5 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0' },
      { tag: 'path', d: 'M16 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0' },
      { tag: 'path', d: 'M5 9l2 -4h7.438a2 2 0 0 1 1.94 1.515l.622 2.485h3a2 2 0 0 1 2 2v3' },
      { tag: 'path', d: 'M10 9v-4' },
      { tag: 'path', d: 'M2 7v4' },
      { tag: 'path', d: 'M22.001 14.001a4.992 4.992 0 0 0 -4.001 -2.001a4.992 4.992 0 0 0 -4 2h-3a4.998 4.998 0 0 0 -8.003 .003' },
      { tag: 'path', d: 'M5 12v-3h13' },
    ],
  },
};

function iconKeyOf(kind: EventKind): IconKey {
  if (kind === 'pit_in' || kind === 'pit_out') return 'pit';
  if (kind === 'retire' || kind === 'error' || kind === 'limit_warn') return 'abnormal';
  return 'general';
}

function createFeedIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'feed-icon');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', EVENT_POLARITY_COLOR.neutral);
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

/** 아이콘 종류가 바뀔 때만 자식을 새로 그린다 — 매 프레임 다시 쓰지 않는다. */
function paintFeedIcon(svg: SVGSVGElement, key: IconKey): void {
  if (svg.getAttribute('data-icon') === key) return;
  svg.setAttribute('data-icon', key);
  const def = FEED_ICON[key];
  svg.setAttribute('viewBox', def.viewBox);
  svg.replaceChildren();
  for (const shape of def.shapes) {
    if (shape.tag === 'path') {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', shape.d);
      svg.appendChild(el);
    } else {
      const el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', String(shape.cx));
      el.setAttribute('cy', String(shape.cy));
      el.setAttribute('r', String(shape.r));
      svg.appendChild(el);
    }
  }
}

export class FeedRenderer {
  private root: HTMLElement;
  private title: HTMLElement;
  private klass: HTMLElement;
  private klassChip: HTMLSpanElement;
  private empty: HTMLElement;
  private rows: Row[] = [];

  constructor(container: HTMLElement, maxRows: number) {
    this.root = document.createElement('div');
    this.root.className = 'feed';

    const head = document.createElement('div');
    head.className = 'feed-head';
    this.title = document.createElement('div');
    this.title.className = 'feed-number';
    this.klass = document.createElement('div');
    this.klass.className = 'feed-class';
    this.klassChip = createProviderChip();
    head.append(this.title, this.klass, this.klassChip);

    this.empty = document.createElement('div');
    this.empty.className = 'feed-empty';

    this.root.append(head, this.empty);

    // 노드 수를 고정하려고 행을 미리 만든다.
    for (let i = 0; i < maxRows; i++) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      row.style.display = 'none';

      const icon = createFeedIcon();
      const time = document.createElement('span');
      time.className = 'feed-time';
      const model = document.createElement('span');
      model.className = 'feed-model';
      const who = document.createElement('span');
      who.className = 'feed-who';
      const size = document.createElement('span');
      size.className = 'feed-size';

      row.append(icon, time, model, who, size);
      this.root.appendChild(row);
      this.rows.push({ root: row, icon, time, model, who, size });
    }

    container.appendChild(this.root);
  }

  render(target: FeedTarget | null, events: CarEvent[], names: Record<string, string> = {}): void {
    if (!target) {
      /*
       * 고른 차가 없을 때 제목을 비운다.
       *
       * `—`를 1.6rem으로 찍고 있었는데, 선택이 없으면 `.cams`가 2.1rem으로 접혀서
       * 그 한 글자가 높이를 다 먹고 **안내문이 잘려 안 보였다**. 화면에는 지도 옆에
       * 뜻 모를 대시 하나만 떠 있었다 — 안내하려고 남긴 자리가 안내를 가렸다.
       */
      setText(this.title, '');
      setText(this.klass, '');
      this.klassChip.style.display = 'none';
      setText(this.empty, '트랙에서 차를 선택하면 그 계정의 구동 내역이 여기 뜹니다');
      for (const row of this.rows) row.root.style.display = 'none';
      return;
    }

    setText(this.title, carDisplayName(names, target.carId, target.carNumber, 'padded'));
    const style = CLASS_STYLE[target.carClass];
    setText(this.klass, target.model);
    this.klass.style.color = style.color;
    paintProviderChip(this.klassChip, target.model);
    setText(this.empty, events.length === 0 ? '아직 기록된 호출이 없습니다' : '');

    // 새것부터. 초 단위로 몰린 호출은 화면에서 구분이 안 되므로 접는다.
    const recent = collapse([...events].sort((a, b) => b.ts - a.ts)).slice(0, this.rows.length);

    this.rows.forEach((row, i) => {
      const entry = recent[i];
      if (!entry) {
        if (row.root.style.display !== 'none') row.root.style.display = 'none';
        return;
      }
      if (row.root.style.display !== '') row.root.style.display = '';

      const e = entry.event;
      const status = e.status === 'error' ? 'error' : 'ok';
      if (row.root.getAttribute('data-status') !== status) row.root.setAttribute('data-status', status);
      const polarity = polarityOf(e);
      if (row.root.getAttribute('data-polarity') !== polarity) row.root.setAttribute('data-polarity', polarity);
      paintFeedIcon(row.icon, iconKeyOf(e.kind));

      setText(row.time, clockOf(e.wall_ts ?? e.ts));
      setText(row.model, shortModel(e.model));
      // 무엇을 쓰고 있었는지. 귀속이 붙는 호출은 실측 6.7%뿐이라 나머지는 `—`다 —
      // 빈칸을 지어내지 않는다.
      setText(row.who, e.status === 'error'
        ? (e.error_code ?? 'error')
        : e.skill || '—');
      const size = `${compact(workOf(e))} · ${compact(cachedOf(e))}`;
      setText(row.size, entry.count > 1 ? `${size} ×${entry.count}` : size);
    });
  }
}
