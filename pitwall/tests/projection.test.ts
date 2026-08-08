import { describe, it, expect } from 'vitest';
import { Projector } from '../src/render/projection';

describe('Projector', () => {
  it('첫 샘플에서는 그 자리에 놓는다', () => {
    const p = new Projector();
    expect(p.step('a', 0.20, 1_000)).toBe(0.20);
  });

  it('차마다 따로 센다', () => {
    const p = new Projector();
    p.step('a', 0.10, 1_000); p.step('b', 0.80, 1_000);
    p.step('a', 0.20, 2_000);
    expect(p.visual('b')).toBe(0.80);
  });
});
