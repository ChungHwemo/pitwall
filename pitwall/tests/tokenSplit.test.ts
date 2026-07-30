import { describe, it, expect } from 'vitest';
import { emptyRaceState, applyEvent, workOf, cachedOf } from '../src/state/reducer';
import { toCarEvent } from '../src/source/claudeCodeImport';
import type { CarEvent } from '../src/types';

const T = 1_800_000_000_000;

function event(over: Partial<CarEvent> = {}): CarEvent {
  return {
    ts: T, car_id: 'a', car_number: 1, car_class: 'P', model: 'claude-sonnet-5',
    kind: 'call', tokens: { prompt: 100_000, completion: 500, cache_read: 99_000 },
    cache_hit: true, cost_usd: 0, latency_ms: 0, status: 'ok', fuel_pct: 100,
    ...over,
  };
}

describe('작업량과 캐시 재전송 분리', () => {
  it('작업량은 캐시 읽기를 뺀 입력 + 출력이다', () => {
    expect(workOf(event())).toBe(100_000 - 99_000 + 500);
  });

  it('캐시 재전송은 따로 센다', () => {
    expect(cachedOf(event())).toBe(99_000);
  });

  it('cache_read가 없으면 입력 전체가 작업량이다', () => {
    const e = event({ tokens: { prompt: 1_000, completion: 200 } });
    expect(workOf(e)).toBe(1_200);
    expect(cachedOf(e)).toBe(0);
  });

  it('cache_read가 prompt보다 커도 작업량이 음수가 되지 않는다', () => {
    expect(workOf(event({ tokens: { prompt: 10, completion: 0, cache_read: 999 } }))).toBe(0);
  });

  it('상태는 둘을 각각 누적한다', () => {
    let s = emptyRaceState(T);
    s = applyEvent(s, event());
    s = applyEvent(s, event({ ts: T + 1000 }));
    const car = s.cars.get('a')!;
    expect(car.distance).toBe((100_000 - 99_000 + 500) * 2);
    expect(car.cached).toBe(99_000 * 2);
  });

  it('실제 사용 기록에서 캐시 읽기를 그대로 옮긴다', () => {
    const e = toCarEvent({
      timestamp: '2026-07-24T10:00:00.000Z', sessionId: 's', cwd: '/p',
      message: { model: 'claude-sonnet-5', usage: {
        input_tokens: 3, cache_read_input_tokens: 133_212,
        cache_creation_input_tokens: 1_310, output_tokens: 257 } },
    })!;
    expect(e.tokens.cache_read).toBe(133_212);
    // 작업량 = 신규 입력 + 캐시 생성 + 출력. 캐시 읽기는 빠진다.
    expect(workOf(e)).toBe(3 + 1_310 + 257);
    expect(cachedOf(e)).toBe(133_212);
  });
});
