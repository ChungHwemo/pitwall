import { describe, it, expect, beforeEach } from 'vitest';
import { CameraRenderer } from '../src/render/cameraRenderer';
import { RadioRenderer } from '../src/render/radioRenderer';
import type { CarState, RaceState } from '../src/types';
import type { RadioMessage } from '../src/radio/eventRadio';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 17, car_class: 'P', activity: 'running',
    distance: 12_345, fuel_pct: 42, tyre_pct: 33, cost_usd: 3.5,
    last_event_ts: T, error_count: 0, cache_hits: 5, call_count: 20,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), phase: 'racing', elapsed_ms: 0, now: T };
}

function msg(id: string, over: Partial<RadioMessage> = {}): RadioMessage {
  return { id, carNumber: 17, text: 'test', severity: 'info', ts: T, ...over };
}

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});

describe('CameraRenderer', () => {
  it('슬롯 수만큼 카드를 만든다', () => {
    new CameraRenderer(host, 3);
    expect(host.querySelectorAll('.cam-card').length).toBe(3);
  });

  it('선별된 차량의 카넘버를 표시한다', () => {
    const r = new CameraRenderer(host, 2);
    r.render(state([car('a', { car_number: 42 })]), ['a']);
    expect(host.textContent).toContain('42');
  });

  it('이름을 표시하지 않는다 — car_id 원문 노출 금지', () => {
    const r = new CameraRenderer(host, 1);
    r.render(state([car('secret-user-kim')]), ['secret-user-kim']);
    expect(host.textContent).not.toContain('secret-user-kim');
  });

  it('빈 슬롯도 카드를 유지하되 비활성 표시한다', () => {
    const r = new CameraRenderer(host, 3);
    r.render(state([car('a')]), ['a']);
    const cards = host.querySelectorAll('.cam-card');
    expect(cards.length).toBe(3);
    expect(cards[1]!.getAttribute('data-empty')).toBe('true');
    expect(cards[0]!.getAttribute('data-empty')).toBe('false');
  });

  it('반복 렌더에도 카드 수가 늘지 않는다', () => {
    const r = new CameraRenderer(host, 3);
    for (let i = 0; i < 100; i++) r.render(state([car('a')]), ['a']);
    expect(host.querySelectorAll('.cam-card').length).toBe(3);
  });

  it('카드 클릭이 핀 토글 핸들러를 부른다', () => {
    const r = new CameraRenderer(host, 1);
    const seen: string[] = [];
    r.onPinToggle((id) => seen.push(id));
    r.render(state([car('a')]), ['a']);
    (host.querySelector('.cam-card') as HTMLElement).click();
    expect(seen).toEqual(['a']);
  });

  it('빈 카드 클릭은 핸들러를 부르지 않는다', () => {
    const r = new CameraRenderer(host, 1);
    const seen: string[] = [];
    r.onPinToggle((id) => seen.push(id));
    r.render(state([]), []);
    (host.querySelector('.cam-card') as HTMLElement).click();
    expect(seen).toEqual([]);
  });

  it('타이어 데이터가 없으면 게이지 자체를 그리지 않는다', () => {
    // PRD §7.0: 소스 부재를 0%나 NaN%로 표시하면 없는 사실을 주장하게 된다.
    const r = new CameraRenderer(host, 1);
    r.render(state([car('a', { tyre_pct: undefined })]), ['a']);
    expect(host.textContent).not.toContain('TYRE');
    expect(host.textContent).not.toContain('NaN');
    expect(host.textContent).toContain('FUEL');
  });

  it('타이어 데이터가 있으면 게이지를 그린다', () => {
    const r = new CameraRenderer(host, 1);
    r.render(state([car('a', { tyre_pct: 33 })]), ['a']);
    expect(host.textContent).toContain('TYRE 33%');
  });
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
});
