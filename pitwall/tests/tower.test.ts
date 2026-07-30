import { describe, it, expect, beforeEach } from 'vitest';
import { TowerRenderer } from '../src/render/towerRenderer';
import type { CarEvent, CarState, RaceState } from '../src/types';

const T = Date.parse('2026-07-30T21:00:00+09:00');

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 12, model: 'claude-opus-5', car_class: 'H',
    activity: 'running', distance: 0, cached: 0, fuel_pct: 100, cost_usd: 0,
    last_event_ts: T, error_count: 0, cache_hits: 0, call_count: 1, ...over,
  };
}
const state = (cars: CarState[]): RaceState =>
  ({ cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase: 'racing', elapsed_ms: 3_600_000, now: T });

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});

describe('TowerRenderer', () => {
  it('계정마다 한 줄을 쓴다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([car('a', { car_number: 12 }), car('b', { car_number: 883 })]), T, T, null, () => []);
    const rows = [...host.querySelectorAll('.tower-row')]
      .filter((n) => (n as HTMLElement).style.display !== 'none');
    expect(rows).toHaveLength(2);
  });

  it('순위를 매기지 않는다 — 줄 순서는 카넘버로 고정이다 (PRIV-2)', () => {
    const r = new TowerRenderer(host, 8);
    // 사용량이 큰 쪽을 뒤에 넣어도 순서가 바뀌면 안 된다.
    r.render(state([car('b', { car_number: 883, cost_usd: 999 }), car('a', { car_number: 12 })]), T, T, null, () => []);
    const numbers = [...host.querySelectorAll('.tower-number')].map((n) => n.textContent);
    expect(numbers.slice(0, 2)).toEqual(['12', '883']);
  });

  it('한 줄에 모델·한도·소진속도가 같이 있다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([car('a', {
      model: 'gpt-5.6-luna', tyre_pct: 3, limit_window_minutes: 10080,
      cost_usd: 24.59, distance: 600_000,
    })]), T, T, null, () => []);
    const row = host.querySelector('.tower-row')!.textContent ?? '';
    expect(row).toContain('gpt-5.6-luna');
    expect(row).toContain('3%');
    expect(row).toContain('7일');
    expect(row).toContain('$24.59');
    expect(row).toContain('10.0k/분');
  });

  it('한도 게이지를 막대 폭으로 그린다 — 숫자보다 먼저 읽힌다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([car('a', { tyre_pct: 25, limit_window_minutes: 300 })]), T, T, null, () => []);
    expect((host.querySelector('.tower-limit-fill') as HTMLElement).style.width).toBe('25%');
  });

  it('한도 소스가 없으면 게이지를 그리지 않는다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([car('a', { tyre_pct: undefined })]), T, T, null, () => []);
    expect(host.querySelector('.tower-limit-fill')).toBeNull();
  });

  it('멈춘 차는 PIT으로 표시하고 사유를 구분한다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([
      car('a', { car_number: 1, tyre_pct: 2 }),
      car('b', { car_number: 2, error_count: 3 }),
    ]), T, T, null, () => []);
    const rows = [...host.querySelectorAll('.tower-row')];
    expect(rows[0]!.getAttribute('data-state')).toBe('limit');
    expect(rows[1]!.getAttribute('data-state')).toBe('error');
  });

  it('선택한 줄을 표시한다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([car('a'), car('b', { car_number: 883 })]), T, T, 'b', () => []);
    const picked = [...host.querySelectorAll('.tower-row')]
      .filter((n) => n.getAttribute('data-selected') === 'true');
    expect(picked).toHaveLength(1);
  });

  it('반복 렌더에도 줄 수가 늘지 않는다', () => {
    const r = new TowerRenderer(host, 8);
    for (let i = 0; i < 40; i++) r.render(state([car('a'), car('b', { car_number: 883 })]), T, T, null, () => []);
    expect(host.querySelectorAll('.tower-row').length).toBe(8);
  });
});

describe('타워 — 상태와 접힘', () => {
  const hist = (): CarEvent[] => [];

  it('오래 조용한 계정은 IDLE이다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([car('a', { last_event_ts: T - 600_000 })]), T, T, null, hist);
    expect(host.querySelector('.tower-row')!.getAttribute('data-state')).toBe('idle');
  });

  it('줄 수를 넘으면 접힌 계정 수와 합계를 밝힌다 — 조용히 버리지 않는다', () => {
    const r = new TowerRenderer(host, 2);
    r.render(state([
      car('a', { car_number: 1, cost_usd: 1 }),
      car('b', { car_number: 2, cost_usd: 2 }),
      car('c', { car_number: 3, cost_usd: 4 }),
      car('d', { car_number: 4, cost_usd: 8 }),
    ]), T, T, null, hist);
    expect(host.querySelector('.tower-overflow')!.textContent).toBe('접힘 2대 · 합계 $12.00');
  });

  it('다 들어가면 접힘 줄은 안 보인다', () => {
    const r = new TowerRenderer(host, 4);
    r.render(state([car('a')]), T, T, null, hist);
    expect((host.querySelector('.tower-overflow') as HTMLElement).style.display).toBe('none');
  });

  it('최근 소진을 막대로 그린다', () => {
    const r = new TowerRenderer(host, 4);
    const events: CarEvent[] = [{
      ts: T - 60_000, car_id: 'a', car_number: 12, car_class: 'H', model: 'm', kind: 'call',
      tokens: { prompt: 50_000, completion: 100, cache_read: 0 },
      cache_hit: false, cost_usd: 1, latency_ms: 0, status: 'ok', fuel_pct: 100,
    }];
    r.render(state([car('a')]), T, T, null, () => events);
    expect(host.querySelector('.tower-spark')!.textContent).toContain('█');
  });
});

describe('타워 — 줄이 모자랄 때 누구를 남기나', () => {
  it('급한 계정이 줄을 차지하고, 보이는 순서는 여전히 카넘버다', () => {
    const r = new TowerRenderer(host, 2);
    r.render(state([
      car('a', { car_number: 1 }),
      car('b', { car_number: 2 }),
      car('c', { car_number: 3, tyre_pct: 2 }),
    ]), T, T, null, () => [], ['c']);
    const numbers = [...host.querySelectorAll('.tower-row')]
      .filter((n) => (n as HTMLElement).style.display !== 'none')
      .map((n) => n.querySelector('.tower-number')!.textContent);
    // 3번이 살아남되 자리는 카넘버 순이다 — 급하다고 맨 위로 올리면 순위표가 된다.
    expect(numbers).toEqual(['1', '3']);
  });
});

describe('타워 발치 — 조직 합계', () => {
  it('계정 수·호출 수·캐시 비중을 늘 보여준다', () => {
    const r = new TowerRenderer(host, 8);
    r.render(state([
      car('a', { call_count: 1650, distance: 8_000_000, cached: 692_000_000, cost_usd: 400.54 }),
      car('b', { car_number: 883, call_count: 447, distance: 3_200_000, cached: 44_000_000, cost_usd: 24.59 }),
    ]), T, T, null, () => []);
    const foot = host.querySelector('.tower-total')!.textContent ?? '';
    expect(foot).toContain('계정 2');
    expect(foot).toContain('2,097콜');
    expect(foot).toContain('캐시 99%');   // 736M / (736M + 11.2M)
    expect(foot).toContain('$425.13');
  });
});
