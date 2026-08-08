import { describe, it, expect } from 'vitest';
import { Projector } from '../src/render/projection';

function frameShortest(from: number, to: number): number {
  let d = to - from;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

describe('랩 경계', () => {
  it('한 바퀴를 넘어가도 뒤로 돌지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.97, 1_000);
    p.step('a', 0.99, 2_000);
    const wrapped = p.step('a', 0.02, 3_000);   // 결승선을 넘었다
    expect(wrapped).toBeGreaterThanOrEqual(0);
    expect(wrapped).toBeLessThan(1);
  });

  it('누적 진행이 두 번째 랩 경계를 넘어도 계속 앞으로 간다', () => {
    // Given: 한 번 랩을 돈 뒤 두 번째 결승선 직전까지 진행한다.
    const p = new Projector();
    p.step('a', 0.90, 1_000);
    p.step('a', 0.99, 2_000);
    p.step('a', 0.10, 3_000);
    p.step('a', 0.90, 4_000);
    const before = p.step('a', 0.99, 5_000);

    // When: 두 번째 랩 경계를 넘는 전진 샘플을 받는다.
    const after = p.step('a', 0.10, 6_000);

    // Then: 누적 앵커의 랩 수와 관계없이 화면도 전진한다.
    expect(frameShortest(before, after)).toBeGreaterThan(0);
  });
});
