import { describe, it, expect, beforeEach } from 'vitest';
import { RadioRenderer } from '../src/render/radioRenderer';
import type { CarState, RaceState } from '../src/types';
import type { RadioMessage } from '../src/radio/eventRadio';
import { EVENT_POLARITY_COLOR, ACCENT_DELTA } from '../src/config/theme';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 17, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 12_345, cached: 0, fuel_pct: 42, tyre_pct: 33, cost_usd: 3.5,
    last_event_ts: T, error_count: 0, cache_hits: 5, call_count: 20, work_per_min: 0, saved_usd: 0,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase: 'racing', elapsed_ms: 0, now: T };
}

function msg(id: string, over: Partial<RadioMessage> = {}): RadioMessage {
  return { id, carNumber: 17, carId: 'car-a', text: 'test', severity: 'info', ts: T, ...over };
}

/** jsdom은 인라인 `style.color`를 `rgb(r, g, b)`로 정규화한다 — hex와 비교하려면 같은 형식으로 맞춘다. */
function toRgb(hex: string): string {
  const int = parseInt(hex.slice(1), 16);
  return `rgb(${(int >> 16) & 0xff}, ${(int >> 8) & 0xff}, ${int & 0xff})`;
}

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});


describe('RadioRenderer', () => {
  it('메시지를 표시한다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { text: 'BOX BOX' }));
    r.render();
    expect(host.textContent).toContain('BOX BOX');
  });

  it('최신 메시지가 먼저 보인다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { text: 'first' }));
    r.push(msg('m2', { text: 'second' }));
    r.render();
    const lines = [...host.querySelectorAll('.radio-line')];
    expect(lines[0]!.textContent).toContain('second');
  });

  it('maxVisible 개수만 렌더한다', () => {
    const r = new RadioRenderer(host, 3);
    for (let i = 0; i < 10; i++) r.push(msg(`m${i}`));
    r.render();
    expect(host.querySelectorAll('.radio-line').length).toBe(3);
  });

  it('버퍼가 무한히 자라지 않는다', () => {
    const r = new RadioRenderer(host, 3);
    for (let i = 0; i < 100_000; i++) r.push(msg(`m${i}`));
    expect(r.bufferSize).toBeLessThanOrEqual(2000);
  });

  it('심각도를 data 속성으로 노출한다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { severity: 'critical' }));
    r.render();
    expect(host.querySelector('.radio-line')!.getAttribute('data-severity')).toBe('critical');
  });

  it('메시지가 없어도 예외 없이 렌더한다', () => {
    const r = new RadioRenderer(host, 5);
    expect(() => r.render()).not.toThrow();
  });

  it('이름이 있으면 카넘버 대신 이름을 쓴다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { carId: 'car-a', carNumber: 17, text: 'BOX BOX' }));
    r.render({ 'car-a': '결제팀 배치' });
    const line = host.querySelector('.radio-line')!;
    expect(line.textContent).toContain('결제팀 배치');
    expect(line.textContent).not.toContain('#017');
  });

  it('RACE CONTROL(carId 빈 문자열)은 이름 표와 무관하게 그대로다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { carId: '', carNumber: 0, text: 'GREEN GREEN GREEN' }));
    r.render({ 'car-a': '결제팀 배치' });
    expect(host.querySelector('.radio-line')!.textContent).toContain('RACE CONTROL');
  });
});


describe('RadioRenderer — 이름 정제', () => {
  it('오염된 로컬카탄 이름은 카넘버로 폴백한다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { carId: 'car-a', carNumber: 17, text: 'BOX BOX' }));
    r.render({ 'car-a': '로컬카탄' });
    const line = host.querySelector('.radio-line')!;
    expect(line.textContent).toContain('#017');
    expect(line.textContent).not.toContain('로컬카탄');
  });
});

describe('RadioRenderer — 이벤트 극성 (P0-3)', () => {
  it('warn/critical 심각도는 data-polarity="caution"이고 색이 EVENT_POLARITY_COLOR.caution이다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { severity: 'warn', text: '문제 발생 — rate_limit' }));
    r.render();
    const line = host.querySelector('.radio-line')!;
    expect(line.getAttribute('data-polarity')).toBe('caution');
    expect((line as HTMLElement).style.color).toBe(toRgb(EVENT_POLARITY_COLOR.caution));
  });

  it('한도 회복 메시지는 positive다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { severity: 'info', text: '한도 회복 — 코스 복귀' }));
    r.render();
    const line = host.querySelector('.radio-line')!;
    expect(line.getAttribute('data-polarity')).toBe('positive');
    expect((line as HTMLElement).style.color).toBe(toRgb(EVENT_POLARITY_COLOR.positive));
  });

  it('그 외 info 메시지는 neutral이다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { severity: 'info', text: '스킬 — doctor' }));
    r.render();
    const line = host.querySelector('.radio-line')!;
    expect(line.getAttribute('data-polarity')).toBe('neutral');
    expect((line as HTMLElement).style.color).toBe(toRgb(EVENT_POLARITY_COLOR.neutral));
  });

  it('critical은 warn과 색이 같되 굵기로 더 강하게 표시된다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { severity: 'critical', text: 'RETIRED — 한도 소진' }));
    r.render();
    const line = host.querySelector('.radio-line')! as HTMLElement;
    expect(line.style.color).toBe(toRgb(EVENT_POLARITY_COLOR.caution));
    expect(line.style.fontWeight).toBe('700');
  });

  it('ACCENT_DELTA를 쓰지 않는다 — 델타·갭 전용 색이다', () => {
    const r = new RadioRenderer(host, 5);
    r.push(msg('m1', { severity: 'warn' }));
    r.push(msg('m2', { severity: 'critical' }));
    r.push(msg('m3', { severity: 'info' }));
    r.render();
    for (const line of host.querySelectorAll('.radio-line')) {
      expect((line as HTMLElement).style.color).not.toBe(toRgb(ACCENT_DELTA));
    }
  });
});



