import { describe, it, expect } from 'vitest';
import { Projector } from '../src/render/projection';

describe('잠깐 사라진 차', () => {
  it('유휴로 화면을 비웠다가 돌아와도 순간이동하지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    // 잠시 화면에서 빠진다 (유휴). 그동안 sweep 이 돈다.
    p.sweep(3_000);
    p.sweep(60_000);
    const back = p.step('a', 0.34, 90_000);
    // 새 차였다면 0.34 에 그대로 꽂힌다. 이어받았다면 그보다 뒤에서 다가간다.
    expect(back).toBeLessThan(0.34);
  });

  it('아주 오래 사라진 차는 잊는다 — 상태가 무한히 쌓이면 안 된다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.sweep(1_000 + 20 * 60_000);
    expect(p.visual('a')).toBeUndefined();
  });

  // 의도 변경: "이번 모델에 없으면 즉시 폐기"는 유휴로 잠깐 빠진 차까지 지워
  // 복귀 시 순간이동을 만들었다. 이제 시간이 기준이다.
  it('오래 안 보인 차만 잊는다', () => {
    const p = new Projector();
    p.step('a', 0.1, 1_000);
    p.step('b', 0.2, 1_000);
    p.step('a', 0.15, 700_000);       // a 만 계속 보인다
    p.sweep(700_000);
    expect(p.visual('b')).toBeUndefined();
    expect(p.visual('a')).toBeDefined();
  });
});
