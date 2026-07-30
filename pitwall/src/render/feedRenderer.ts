import type { CarClass, CarEvent } from '../types';
import { CLASS_STYLE } from '../config/theme';
import { workOf, cachedOf } from '../state/reducer';
import { setText } from './setText';

/**
 * 선택한 계정의 실시간 구동 내역.
 *
 * 트랙의 차 한 대는 계정 하나다. 그 계정이 **어떤 에이전트로 무엇을 돌리는지**가
 * 이 화면이 답해야 하는 질문이라, 차를 고르면 여기에 호출 하나하나가 뜬다.
 *
 * 카넘버만 쓴다. 계정 uuid도 이메일도 화면에 오지 않는다 (PRIV-1·PRIV-3).
 */
export interface FeedTarget {
  carNumber: number;
  /** 색을 정한다 — 등급은 모델의 등급이다 */
  carClass: CarClass;
  /** 헤더에 쓰는 현재 모델. 등급 이름은 사람이 알고 싶은 게 아니다 */
  model: string;
}

interface Row {
  root: HTMLElement;
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
    clockOf(e.ts), e.model, e.status, e.error_code ?? '',
    e.agent ?? '', e.skill ?? '', workOf(e), cachedOf(e),
  ].join('|');
}

export class FeedRenderer {
  private root: HTMLElement;
  private title: HTMLElement;
  private klass: HTMLElement;
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
    head.append(this.title, this.klass);

    this.empty = document.createElement('div');
    this.empty.className = 'feed-empty';

    this.root.append(head, this.empty);

    // 노드 수를 고정하려고 행을 미리 만든다.
    for (let i = 0; i < maxRows; i++) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      row.style.display = 'none';

      const time = document.createElement('span');
      time.className = 'feed-time';
      const model = document.createElement('span');
      model.className = 'feed-model';
      const who = document.createElement('span');
      who.className = 'feed-who';
      const size = document.createElement('span');
      size.className = 'feed-size';

      row.append(time, model, who, size);
      this.root.appendChild(row);
      this.rows.push({ root: row, time, model, who, size });
    }

    container.appendChild(this.root);
  }

  render(target: FeedTarget | null, events: CarEvent[]): void {
    if (!target) {
      setText(this.title, '—');
      setText(this.klass, '');
      setText(this.empty, '트랙에서 차를 선택하면 그 계정의 구동 내역이 여기 뜹니다');
      for (const row of this.rows) row.root.style.display = 'none';
      return;
    }

    setText(this.title, `#${String(target.carNumber).padStart(3, '0')}`);
    const style = CLASS_STYLE[target.carClass];
    setText(this.klass, target.model);
    this.klass.style.color = style.color;
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

      setText(row.time, clockOf(e.ts));
      setText(row.model, shortModel(e.model));
      // 무엇이 돌렸는지 — 에이전트·스킬이 이 화면의 목적이다.
      setText(row.who, e.status === 'error'
        ? (e.error_code ?? 'error')
        : [e.agent, e.skill].filter(Boolean).join(' · ') || '—');
      const size = `${compact(workOf(e))} · ${compact(cachedOf(e))}`;
      setText(row.size, entry.count > 1 ? `${size} ×${entry.count}` : size);
    });
  }
}
