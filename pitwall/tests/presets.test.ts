import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/config/presets';

describe('PRESETS', () => {
  it('네 프리셋을 모두 제공한다', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(['busy', 'chaos', 'real', 'sparse']);
  });

  it('real 프리셋만 실측이고 나머지는 추정이다', () => {
    // real은 2026-07-30 Claude Code 트랜스크립트 26,396건에서 나온 값이다.
    // 추정치와 뒤섞이지 않게 캐시 히트율로 구분이 가능해야 한다.
    expect(PRESETS.real.cacheHitRate).toBeCloseTo(0.975, 3);
    expect(PRESETS.real.callIntervalMedianMs).toBe(3_100);
    for (const name of ['busy', 'sparse', 'chaos'] as const) {
      expect(PRESETS[name].cacheHitRate, name).toBeLessThan(0.5);
    }
  });

  it('모든 프리셋의 클래스 비율 합이 1이다', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      const sum = p.classMix.H + p.classMix.P + p.classMix.GT;
      expect(sum, `${name} classMix`).toBeCloseTo(1, 6);
    }
  });

  it('모든 확률값이 0..1 범위다', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      expect(p.activeRatio, `${name} activeRatio`).toBeGreaterThan(0);
      expect(p.activeRatio, `${name} activeRatio`).toBeLessThanOrEqual(1);
      expect(p.errorRate, `${name} errorRate`).toBeGreaterThanOrEqual(0);
      expect(p.errorRate, `${name} errorRate`).toBeLessThanOrEqual(1);
      expect(p.cacheHitRate, `${name} cacheHitRate`).toBeGreaterThanOrEqual(0);
      expect(p.cacheHitRate, `${name} cacheHitRate`).toBeLessThanOrEqual(1);
    }
  });

  it('sparse는 busy보다 활동률이 낮다', () => {
    expect(PRESETS.sparse.activeRatio).toBeLessThan(PRESETS.busy.activeRatio);
  });

  it('chaos는 busy보다 에러율이 높다', () => {
    expect(PRESETS.chaos.errorRate).toBeGreaterThan(PRESETS.busy.errorRate);
  });

  it('모든 프리셋의 차량 수가 200 이하다', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      expect(p.carCount, `${name} carCount`).toBeLessThanOrEqual(200);
      expect(p.carCount, `${name} carCount`).toBeGreaterThan(0);
    }
  });

  it('모든 프리셋이 유효한 타이어 모드를 갖는다', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      expect(['off', 'rolling_budget', 'proxy_budget'], `${name} tyreMode`).toContain(p.tyreMode);
    }
  });

  it('off 경로와 on 경로를 둘 다 검수할 수 있다', () => {
    const modes = Object.values(PRESETS).map((p) => p.tyreMode);
    expect(modes).toContain('off');
    expect(modes.some((m) => m !== 'off')).toBe(true);
  });
});
