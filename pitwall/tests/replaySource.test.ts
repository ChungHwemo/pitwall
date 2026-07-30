import { describe, it, expect } from 'vitest';
import { ReplaySource } from '../src/source/ReplaySource';
import type { CarEvent } from '../src/types';

const T0 = 1_800_000_000_000;

function event(over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts: T0, car_id: 'car-a', car_number: 1, car_class: 'P',
    model: 'claude-sonnet-5', kind: 'call',
    tokens: { prompt: 100, completion: 20 }, cache_hit: false,
    cost_usd: 0.001, latency_ms: 0, status: 'ok', fuel_pct: 100,
    ...over,
  };
}

function collect(src: ReplaySource, ticks: number, step = 1000): CarEvent[] {
  const out: CarEvent[] = [];
  src.start((e) => out.push(e));
  for (let i = 1; i <= ticks; i++) src.tick(i * step);
  return out;
}

describe('ReplaySource', () => {
  it('start 전에는 아무것도 내지 않는다', () => {
    const src = new ReplaySource([event()], 1);
    const out: CarEvent[] = [];
    src.tick(1000);
    expect(out).toEqual([]);
  });

  it('기록된 순서대로 재생한다', () => {
    const src = new ReplaySource([
      event({ ts: T0, car_id: 'a' }),
      event({ ts: T0 + 1000, car_id: 'b' }),
      event({ ts: T0 + 2000, car_id: 'c' }),
    ], 600);
    // 20틱이면 한 바퀴를 넘겨 반복하므로 앞 3건만 본다.
    expect(collect(src, 20).map((e) => e.car_id).slice(0, 3)).toEqual(['a', 'b', 'c']);
  });

  it('원본 간격을 배속으로 나눠 재생한다', () => {
    const events = [event({ ts: T0 }), event({ ts: T0 + 60_000, car_id: 'later' })];
    const slow = new ReplaySource(events, 1);
    // 1배속에서 2초 만에 60초 뒤 이벤트가 나오면 안 된다.
    expect(collect(slow, 2).map((e) => e.car_id)).toEqual(['car-a']);

    const fast = new ReplaySource(events, 600);
    expect(collect(fast, 2).map((e) => e.car_id)).toContain('later');
  });

  it('다 재생하면 처음부터 돈다 — 상시 노출 화면이 멈추면 안 된다', () => {
    const src = new ReplaySource([event({ car_id: 'only' })], 600);
    const out = collect(src, 40);
    expect(out.length).toBeGreaterThan(1);
    expect(new Set(out.map((e) => e.car_id))).toEqual(new Set(['only']));
  });

  it('재생된 이벤트의 ts는 재생 시각이다 — 원본 과거 시각이 아니다', () => {
    const src = new ReplaySource([event({ ts: T0 })], 600);
    const [first] = collect(src, 5);
    expect(first!.ts).toBeGreaterThan(0);
    expect(first!.ts).toBeLessThan(T0);
  });

  it('stop 이후에는 내지 않는다', () => {
    const src = new ReplaySource([event(), event({ ts: T0 + 100 })], 600);
    const out: CarEvent[] = [];
    src.start((e) => out.push(e));
    src.tick(1000);
    src.tick(2000);
    const n = out.length;
    src.stop();
    src.tick(3000);
    expect(out.length).toBe(n);
  });

  it('빈 기록이어도 예외 없이 돈다', () => {
    const src = new ReplaySource([], 600);
    expect(() => collect(src, 10)).not.toThrow();
  });

  it('setSpeed가 배속을 바꾼다', () => {
    const src = new ReplaySource([event()], 1);
    src.setSpeed(600);
    expect(src.speed).toBe(600);
  });
});

describe('재생 시계', () => {
  it('재생 위치의 원본 시각을 알려준다 — 화면 시계와 이벤트가 같은 타임라인이어야 한다', () => {
    const origin = Date.parse('2026-07-30T07:00:00.000Z');
    const src = new ReplaySource([
      event({ ts: origin }),
      event({ ts: origin + 3_600_000 }),
    ], 60);
    src.start(() => {});

    src.tick(1_000);
    src.tick(1_000 + 600);          // 실시간 0.6초 × 60배 = 36초
    expect(src.replayClock().getTime()).toBe(origin + 36_000);
  });

  it('아직 안 돌았으면 첫 기록의 시각이다', () => {
    const origin = Date.parse('2026-07-30T07:00:00.000Z');
    const src = new ReplaySource([event({ ts: origin })], 1);
    expect(src.replayClock().getTime()).toBe(origin);
  });
});

describe('표시용 원본 시각', () => {
  it('내부 ts는 재생 시계로 바꾸되 원래 시각을 따로 남긴다', () => {
    const origin = Date.parse('2026-07-30T09:15:00.000Z');
    const src = new ReplaySource([event({ ts: origin })], 1);
    const out: CarEvent[] = [];
    src.start((e) => out.push(e));
    src.tick(5_000);
    src.tick(6_000);
    // 리듀서의 유휴 판정은 내부 시계를 써야 하므로 ts는 바뀐다.
    expect(out[0]!.ts).not.toBe(origin);
    // 화면에 찍는 시각은 원본이어야 한다 — 아니면 모든 줄이 같은 시각으로 보인다.
    expect(out[0]!.wall_ts).toBe(origin);
  });
});

describe('한 바퀴 끝', () => {
  it('되감을 때 알린다 — 알리지 않으면 상태가 영원히 누적된다', () => {
    const origin = 1_000;
    const src = new ReplaySource([event({ ts: origin }), event({ ts: origin + 1_000 })], 1);
    let wraps = 0;
    src.onWrap(() => { wraps += 1; });
    src.start(() => {});
    for (let i = 1; i <= 6; i++) src.tick(i * 1_000);
    expect(wraps).toBeGreaterThan(0);
  });
});
