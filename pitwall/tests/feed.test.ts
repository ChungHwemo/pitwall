import { describe, it, expect, beforeEach } from 'vitest';
import { FeedRenderer } from '../src/render/feedRenderer';
import type { CarEvent } from '../src/types';

const T = 1_800_000_000_000;

function event(over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts: T, car_id: 'car-a', car_number: 17, car_class: 'P',
    model: 'claude-sonnet-5', kind: 'call',
    tokens: { prompt: 120_000, completion: 300, cache_read: 118_000 },
    cache_hit: true, cost_usd: 0.01, latency_ms: 0, status: 'ok', fuel_pct: 90,
    agent: 'general-purpose', skill: 'superpowers:test-driven-development',
    ...over,
  };
}

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});

describe('FeedRenderer', () => {
  it('아무것도 선택하지 않으면 안내를 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render(null, []);
    expect(host.textContent).toContain('선택');
  });

  it('선택한 계정의 카넘버를 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 42, carClass: 'H' }, [event()]);
    expect(host.textContent).toContain('042');
  });

  it('최근 내역을 새것부터 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 1, carClass: 'P' }, [
      event({ ts: T, model: 'claude-haiku-4-5' }),
      event({ ts: T + 1000, model: 'claude-opus-5' }),
    ]);
    const rows = [...host.querySelectorAll('.feed-row')].filter((n) => (n as HTMLElement).style.display !== 'none');
    expect(rows[0]!.textContent).toContain('opus');
  });

  it('어떤 에이전트·스킬이 돌았는지 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 1, carClass: 'P' }, [event()]);
    expect(host.textContent).toContain('general-purpose');
    expect(host.textContent).toContain('test-driven-development');
  });

  it('작업량과 캐시 재전송을 나눠 쓴다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 1, carClass: 'P' }, [event()]);
    expect(host.textContent).toContain('2.3k');    // (120,000 − 118,000) + 300
    expect(host.textContent).toContain('118.0k');
  });

  it('에러는 사유를 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 1, carClass: 'P' },
      [event({ status: 'error', kind: 'error', error_code: 'rate_limit' })]);
    expect(host.textContent).toContain('rate_limit');
    expect(host.querySelector('.feed-row')!.getAttribute('data-status')).toBe('error');
  });

  it('행 수 상한을 넘지 않는다', () => {
    const r = new FeedRenderer(host, 3);
    r.render({ carNumber: 1, carClass: 'P' },
      // 초를 벌린다 — 같은 초에 몰리면 한 줄로 접혀서 상한이 아니라 접힘을 재게 된다.
      Array.from({ length: 20 }, (_, i) => event({ ts: T + i * 1_000 })));
    const rows = [...host.querySelectorAll('.feed-row')].filter((n) => (n as HTMLElement).style.display !== 'none');
    expect(rows.length).toBe(3);
  });

  it('반복 렌더에도 노드가 늘지 않는다', () => {
    const r = new FeedRenderer(host, 6);
    const evs = [event()];
    r.render({ carNumber: 1, carClass: 'P' }, evs);
    const n = host.querySelectorAll('*').length;
    for (let i = 0; i < 50; i++) r.render({ carNumber: 1, carClass: 'P' }, evs);
    expect(host.querySelectorAll('*').length).toBe(n);
  });

  it('car_id를 화면에 쓰지 않는다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 1, carClass: 'P' }, [event({ car_id: 'secret-account-uuid' })]);
    expect(host.textContent).not.toContain('secret-account-uuid');
  });

  it('내역이 없으면 빈 상태를 알린다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carNumber: 5, carClass: 'GT' }, []);
    expect(host.textContent).toContain('005');
    expect(() => r.render({ carNumber: 5, carClass: 'GT' }, [])).not.toThrow();
  });
});

describe('같은 순간에 몰린 호출', () => {
  it('구분이 안 되는 연속 호출은 한 줄로 접고 횟수를 붙인다', () => {
    const same = (i: number): CarEvent => ({
      ...event(), ts: 1_000, model: 'claude-fable-5', agent: 'superpowers',
      tokens: { prompt: 5_000, completion: 100, cache_read: 4_000 }, session_id: `s${i}`,
    });
    const r = new FeedRenderer(host, 8);
    r.render({ carNumber: 7, carClass: 'H' }, [same(0), same(1), same(2)]);

    const rows = [...host.querySelectorAll('.feed-row')].filter((e) => (e as HTMLElement).style.display !== 'none');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('×3');
  });

  it('내용이 다르면 접지 않는다', () => {
    const r = new FeedRenderer(host, 8);
    r.render({ carNumber: 7, carClass: 'H' }, [
      event({ ts: 1_000, model: 'claude-fable-5' }),
      event({ ts: 1_000, model: 'gpt-5.6-sol' }),
    ]);
    const rows = [...host.querySelectorAll('.feed-row')].filter((e) => (e as HTMLElement).style.display !== 'none');
    expect(rows).toHaveLength(2);
  });
});
