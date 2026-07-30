import { describe, it, expect } from 'vitest';
import { sparkline, SPARK_CHARS } from '../src/render/spark';
import type { CarEvent } from '../src/types';

const T = 1_000_000;
const ev = (ts: number, work: number): CarEvent => ({
  ts, car_id: 'a', car_number: 1, car_class: 'P', model: 'm', kind: 'call',
  tokens: { prompt: work, completion: 0, cache_read: 0 },
  cache_hit: false, cost_usd: 0, latency_ms: 0, status: 'ok', fuel_pct: 100,
});

describe('sparkline', () => {
  it('창을 칸으로 나눠 작업량을 막대 높이로 바꾼다', () => {
    // 창 8분, 8칸 → 1분에 한 칸. 마지막 칸이 가장 크다.
    const out = sparkline([ev(T - 7 * 60_000, 10), ev(T - 60_000, 100)], T, 8 * 60_000, 8);
    expect(out).toHaveLength(8);
    expect(out[7]).toBe(SPARK_CHARS[SPARK_CHARS.length - 1]);
    // 7분 전은 두 번째 칸이다 (창 시작이 8분 전이므로).
    expect(out[1]).toBe(SPARK_CHARS[0]);
  });

  it('아무 일도 없던 칸은 공백이다 — 0을 막대로 그리면 없는 일을 주장한다', () => {
    const out = sparkline([ev(T - 60_000, 100)], T, 8 * 60_000, 8);
    expect(out.slice(0, 7)).toBe('       ');
  });

  it('기록이 없으면 전부 공백이다', () => {
    expect(sparkline([], T, 8 * 60_000, 8)).toBe('        ');
  });

  it('창 밖의 기록은 세지 않는다', () => {
    expect(sparkline([ev(T - 60 * 60_000, 999)], T, 8 * 60_000, 8)).toBe('        ');
  });

  it('캐시 재전송은 높이에 넣지 않는다 — 거리와 같은 기준이다', () => {
    const cached: CarEvent = {
      ...ev(T - 60_000, 100), tokens: { prompt: 100, completion: 0, cache_read: 100 },
    };
    expect(sparkline([cached], T, 8 * 60_000, 8)).toBe('        ');
  });
});
