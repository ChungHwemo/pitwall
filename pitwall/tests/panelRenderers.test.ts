import { describe, it, expect, beforeEach } from 'vitest';
import { RadioRenderer } from '../src/render/radioRenderer';
import type { CarState, RaceState } from '../src/types';
import type { RadioMessage } from '../src/radio/eventRadio';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 17, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 12_345, cached: 0, fuel_pct: 42, tyre_pct: 33, cost_usd: 3.5,
    last_event_ts: T, error_count: 0, cache_hits: 5, call_count: 20, work_per_min: 0,
    ...over,
  };
}

function state(cars: CarState[]): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase: 'racing', elapsed_ms: 0, now: T };
}

function msg(id: string, over: Partial<RadioMessage> = {}): RadioMessage {
  return { id, carNumber: 17, text: 'test', severity: 'info', ts: T, ...over };
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
});



