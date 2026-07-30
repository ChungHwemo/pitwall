import { describe, it, expect, beforeEach } from 'vitest';
import { ModelPanel } from '../src/render/modelPanel';
import type { ModelTally, RaceState } from '../src/types';

const T = 1_000_000;
const state = (byModel: [string, ModelTally][]): RaceState =>
  ({ cars: new Map(), byModel: new Map(byModel), phase: 'racing', elapsed_ms: 0, now: T });

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});

describe('ModelPanel', () => {
  it('모델마다 호출·작업·비용을 쓴다', () => {
    const p = new ModelPanel(host, 6);
    p.render(state([['claude-opus-5', { calls: 1650, work: 8_400_000, cached: 692_000_000, cost: 400.54 }]]));
    const row = host.querySelector('.model-row')!.textContent ?? '';
    expect(row).toContain('claude-opus-5');
    expect(row).toContain('1,650');
    expect(row).toContain('8.4M');
    expect(row).toContain('$400.54');
  });

  it('비싼 모델부터 쓴다 — 모델은 사람이 아니라 순서를 매겨도 된다', () => {
    const p = new ModelPanel(host, 6);
    p.render(state([
      ['gpt-5.5', { calls: 277, work: 1_000, cached: 0, cost: 20 }],
      ['claude-opus-5', { calls: 10, work: 100, cached: 0, cost: 400 }],
    ]));
    const names = [...host.querySelectorAll('.model-name')].map((n) => n.textContent);
    expect(names.slice(0, 2)).toEqual(['claude-opus-5', 'gpt-5.5']);
  });

  it('비중 막대를 비용 몫으로 그린다', () => {
    const p = new ModelPanel(host, 6);
    p.render(state([
      ['a', { calls: 1, work: 1, cached: 0, cost: 75 }],
      ['b', { calls: 1, work: 1, cached: 0, cost: 25 }],
    ]));
    const fills = [...host.querySelectorAll('.model-fill')].map((n) => (n as HTMLElement).style.width);
    expect(fills.slice(0, 2)).toEqual(['100%', '33.33%']);
  });

  it('줄 수를 넘으면 나머지를 접고 밝힌다', () => {
    const p = new ModelPanel(host, 1);
    p.render(state([
      ['a', { calls: 1, work: 1, cached: 0, cost: 10 }],
      ['b', { calls: 2, work: 1, cached: 0, cost: 5 }],
      ['c', { calls: 3, work: 1, cached: 0, cost: 1 }],
    ]));
    expect(host.querySelector('.model-rest')!.textContent).toBe('그 외 2종 · $6.00');
  });

  it('반복 렌더에도 줄이 늘지 않는다', () => {
    const p = new ModelPanel(host, 4);
    for (let i = 0; i < 30; i++) p.render(state([['a', { calls: 1, work: 1, cached: 0, cost: 1 }]]));
    expect(host.querySelectorAll('.model-row').length).toBe(4);
  });
});
