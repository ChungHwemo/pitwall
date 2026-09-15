import { describe, it, expect } from 'vitest';
import { stripObservedFuel } from '../src/config/observedFuel';

describe('stripObservedFuel', () => {
  it('실기록은 fuel_pct를 버린다', () => {
    const out = stripObservedFuel(
      [{ fuel_pct: 100, cost_usd: 1 }, { fuel_pct: 40, cost_usd: 2 }],
      false,
    );
    expect(out[0]!.fuel_pct).toBeUndefined();
    expect(out[1]!.fuel_pct).toBeUndefined();
    expect(out[0]!.cost_usd).toBe(1);
  });

  it('지어낸 데이터는 연료를 남긴다', () => {
    const src = [{ fuel_pct: 80 }];
    expect(stripObservedFuel(src, true)[0]!.fuel_pct).toBe(80);
  });

  it('원본 배열을 돌연변이하지 않는다', () => {
    const src = [{ fuel_pct: 100 }];
    stripObservedFuel(src, false);
    expect(src[0]!.fuel_pct).toBe(100);
  });
});
