import { describe, it, expect, beforeEach } from 'vitest';
import { FeedRenderer } from '../src/render/feedRenderer';
import type { CarEvent } from '../src/types';
import { EVENT_POLARITY_COLOR } from '../src/config/theme';

const T = 1_800_000_000_000;

function event(over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts: T, car_id: 'car-a', car_number: 17, car_class: 'P',
    model: 'claude-sonnet-5', kind: 'call',
    tokens: { prompt: 120_000, completion: 300, cache_read: 118_000 },
    cache_hit: true, cost_usd: 0.01, latency_ms: 0, status: 'ok', fuel_pct: 90,
    skill: 'superpowers:test-driven-development',
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
    r.render({ carId: 'car-a', carNumber: 42, carClass: 'H', model: 'claude-sonnet-5' }, [event()]);
    expect(host.textContent).toContain('042');
  });

  it('최근 내역을 새것부터 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [
      event({ ts: T, model: 'claude-haiku-4-5' }),
      event({ ts: T + 1000, model: 'claude-opus-5' }),
    ]);
    const rows = [...host.querySelectorAll('.feed-row')].filter((n) => (n as HTMLElement).style.display !== 'none');
    expect(rows[0]!.textContent).toContain('opus');
  });

  it('어떤 스킬을 쓰고 있었는지 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event()]);
    expect(host.textContent).toContain('test-driven-development');
  });

  it('귀속이 없는 호출은 —로 둔다 — 실측 93%가 여기다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ skill: undefined })]);
    expect(host.textContent).toContain('—');
  });

  it('작업량과 캐시 재전송을 나눠 쓴다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event()]);
    expect(host.textContent).toContain('2.3k');    // (120,000 − 118,000) + 300
    expect(host.textContent).toContain('118.0k');
  });

  it('에러는 사유를 보여준다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ status: 'error', kind: 'error', error_code: 'rate_limit' })]);
    expect(host.textContent).toContain('rate_limit');
    expect(host.querySelector('.feed-row')!.getAttribute('data-status')).toBe('error');
  });

  it('행 수 상한을 넘지 않는다', () => {
    const r = new FeedRenderer(host, 3);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      // 초를 벌린다 — 같은 초에 몰리면 한 줄로 접혀서 상한이 아니라 접힘을 재게 된다.
      Array.from({ length: 20 }, (_, i) => event({ ts: T + i * 1_000 })));
    const rows = [...host.querySelectorAll('.feed-row')].filter((n) => (n as HTMLElement).style.display !== 'none');
    expect(rows.length).toBe(3);
  });

  it('반복 렌더에도 노드가 늘지 않는다', () => {
    const r = new FeedRenderer(host, 6);
    const evs = [event()];
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, evs);
    const n = host.querySelectorAll('*').length;
    for (let i = 0; i < 50; i++) r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, evs);
    expect(host.querySelectorAll('*').length).toBe(n);
  });

  it('car_id를 화면에 쓰지 않는다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event({ car_id: 'secret-account-uuid' })]);
    expect(host.textContent).not.toContain('secret-account-uuid');
  });

  it('내역이 없으면 빈 상태를 알린다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 5, carClass: 'GT', model: 'claude-sonnet-5' }, []);
    expect(host.textContent).toContain('005');
    expect(() => r.render({ carId: 'car-a', carNumber: 5, carClass: 'GT', model: 'claude-sonnet-5' }, [])).not.toThrow();
  });

  it('이름을 붙이면 헤더에 카넘버 대신 이름을 쓴다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 42, carClass: 'H', model: 'claude-sonnet-5' },
      [event()], { 'car-a': '결제팀 배치' });
    expect(host.querySelector('.feed-number')!.textContent).toBe('결제팀 배치');
    expect(host.querySelector('.feed-number')!.textContent).not.toContain('042');
  });
});

describe('같은 순간에 몰린 호출', () => {
  it('구분이 안 되는 연속 호출은 한 줄로 접고 횟수를 붙인다', () => {
    const same = (i: number): CarEvent => ({
      ...event(), ts: 1_000, model: 'claude-fable-5',
      tokens: { prompt: 5_000, completion: 100, cache_read: 4_000 }, session_id: `s${i}`,
    });
    const r = new FeedRenderer(host, 8);
    r.render({ carId: 'car-a', carNumber: 7, carClass: 'H', model: 'claude-sonnet-5' }, [same(0), same(1), same(2)]);

    const rows = [...host.querySelectorAll('.feed-row')].filter((e) => (e as HTMLElement).style.display !== 'none');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('×3');
  });

  it('내용이 다르면 접지 않는다', () => {
    const r = new FeedRenderer(host, 8);
    r.render({ carId: 'car-a', carNumber: 7, carClass: 'H', model: 'claude-sonnet-5' }, [
      event({ ts: 1_000, model: 'claude-fable-5' }),
      event({ ts: 1_000, model: 'gpt-5.6-sol' }),
    ]);
    const rows = [...host.querySelectorAll('.feed-row')].filter((e) => (e as HTMLElement).style.display !== 'none');
    expect(rows).toHaveLength(2);
  });
});

describe('피드 헤더', () => {
  it('등급 이름 대신 돌고 있는 모델을 쓴다', () => {
    const r = new FeedRenderer(host, 4);
    r.render({ carId: 'car-a', carNumber: 883, carClass: 'H', model: 'gpt-5.6-sol' }, [event()]);
    const head = host.querySelector('.feed-class')!;
    expect(head.textContent).toBe('gpt-5.6-sol');
  });
});

describe('이벤트 극성 (P0-3)', () => {
  it('일반 call 행은 neutral이다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event({ kind: 'call', status: 'ok' })]);
    expect(host.querySelector('.feed-row')!.getAttribute('data-polarity')).toBe('neutral');
  });

  it('status=error 행은 caution이다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ kind: 'error', status: 'error', error_code: 'x' })]);
    expect(host.querySelector('.feed-row')!.getAttribute('data-polarity')).toBe('caution');
  });

  it('kind=limit_warn 행은 caution이다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ kind: 'limit_warn', status: 'ok' })]);
    expect(host.querySelector('.feed-row')!.getAttribute('data-polarity')).toBe('caution');
  });

  it('kind=retire 행은 caution이다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ kind: 'retire', status: 'ok' })]);
    expect(host.querySelector('.feed-row')!.getAttribute('data-polarity')).toBe('caution');
  });

  it('kind=pit_in/pit_out은 neutral이다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [
      event({ kind: 'pit_in', status: 'ok' }),
      event({ kind: 'pit_out', status: 'ok', ts: T + 1 }),
    ]);
    for (const row of host.querySelectorAll('.feed-row')) {
      if ((row as HTMLElement).style.display === 'none') continue;
      expect(row.getAttribute('data-polarity')).toBe('neutral');
    }
  });
});

describe('피드 행 generic 아이콘 (P1-1)', () => {
  it('call 행에는 lucide car 경로가 선택된다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event({ kind: 'call' })]);
    const icon = host.querySelector('.feed-icon')!;
    expect(icon.querySelector('circle')).not.toBeNull();
  });

  it('pit_in/pit_out 행에는 tabler car 경로가 선택된다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event({ kind: 'pit_in' })]);
    const icon = host.querySelector('.feed-icon')!;
    expect(icon.querySelectorAll('path').length).toBe(3);
    expect(icon.querySelector('circle')).toBeNull();
  });

  it('retire/error/limit_warn 행에는 tabler car-suv 경로가 선택된다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event({ kind: 'retire' })]);
    const icon = host.querySelector('.feed-icon')!;
    expect(icon.querySelectorAll('path').length).toBe(7);
  });

  it('generic 아이콘은 g.car, g.cold, class-badge 아래에 생기지 않는다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' }, [event()]);
    expect(host.querySelectorAll('g.car .feed-icon, g.cold .feed-icon, .class-badge .feed-icon').length).toBe(0);
  });

  it('아이콘 색은 EVENT_POLARITY_COLOR가 아니라 고정 청회색이다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ kind: 'error', status: 'error' })]);
    const icon = host.querySelector('.feed-icon')!;
    expect(icon.getAttribute('stroke')).toBe(EVENT_POLARITY_COLOR.neutral);
  });

  it('아이콘에 car_id나 이메일 같은 개인정보가 들어가지 않는다', () => {
    const r = new FeedRenderer(host, 6);
    r.render({ carId: 'car-a', carNumber: 1, carClass: 'P', model: 'claude-sonnet-5' },
      [event({ car_id: 'secret-account-uuid' })]);
    const icon = host.querySelector('.feed-icon')!;
    expect(icon.outerHTML).not.toContain('secret-account-uuid');
  });
});
