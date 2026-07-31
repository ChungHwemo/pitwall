import { describe, it, expect } from 'vitest';
import { Projector, MAX_LEAD } from '../src/render/projection';

describe('Projector', () => {
  it('첫 샘플에서는 그 자리에 놓는다', () => {
    const p = new Projector();
    expect(p.step('a', 0.20, 1_000)).toBe(0.20);
  });

  it('샘플이 없는 동안에도 계속 나아간다 — 이게 없으면 호출 사이에 멈춰 선다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);          // 1초에 0.10 → 초당 0.10
    const a = p.step('a', 0.30, 2_100); // 같은 목표, 100ms 뒤
    const b = p.step('a', 0.30, 2_200);
    expect(a).toBeGreaterThan(0.30);
    expect(b).toBeGreaterThan(a);
  });

  it('데이터가 끊겨도 목표에서 너무 멀리 달아나지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    let last = 0;
    for (let t = 2_100; t < 60_000; t += 100) last = p.step('a', 0.30, t);
    expect(last - 0.30).toBeLessThanOrEqual(MAX_LEAD + 1e-9);
  });

  it('새 샘플이 오면 그쪽으로 당겨진다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    for (let t = 2_100; t < 8_000; t += 100) p.step('a', 0.30, t);   // 앞서 나가 있다
    const before = p.visual('a')!;
    const after = p.step('a', 0.25, 8_100);                          // 목표가 뒤로
    expect(after).toBeLessThan(before);
  });

  it('멈춘 차는 나아가지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    const held = p.hold('a', 2_100);
    expect(p.hold('a', 9_000)).toBe(held);
  });

  it('한 바퀴를 넘어가도 뒤로 돌지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.97, 1_000);
    p.step('a', 0.99, 2_000);
    const wrapped = p.step('a', 0.02, 3_000);   // 결승선을 넘었다
    expect(wrapped).toBeGreaterThanOrEqual(0);
    expect(wrapped).toBeLessThan(1);
  });

  it('차마다 따로 센다', () => {
    const p = new Projector();
    p.step('a', 0.10, 1_000); p.step('b', 0.80, 1_000);
    p.step('a', 0.20, 2_000);
    expect(p.visual('b')).toBe(0.80);
  });

  it('사라진 차는 잊는다 — 상태가 무한히 쌓이면 안 된다', () => {
    const p = new Projector();
    p.step('a', 0.1, 1_000); p.step('b', 0.2, 1_000);
    p.retain(new Set(['a']));
    expect(p.visual('b')).toBeUndefined();
    expect(p.visual('a')).toBe(0.1);
  });
});
