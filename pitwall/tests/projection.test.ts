import { describe, it, expect } from 'vitest';
import { Projector, MAX_LEAD, MAX_FRAME_STEP } from '../src/render/projection';

describe('Projector', () => {
  it('첫 샘플에서는 그 자리에 놓는다', () => {
    const p = new Projector();
    expect(p.step('a', 0.20, 1_000)).toBe(0.20);
  });

  it('샘플이 없는 동안에도 계속 나아간다 — 이게 없으면 호출 사이에 멈춰 선다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);          // 1초에 0.10 → 초당 0.10
    // 의도 축소: 프레임당 이동 상한이 생기면서 큰 걸음은 즉시 목표를 넘지 않는다.
    // 확인해야 하는 것은 "목표를 지났는가"가 아니라 "샘플 없이도 계속 가는가"다.
    const a = p.step('a', 0.30, 2_100); // 같은 목표, 100ms 뒤
    const b = p.step('a', 0.30, 2_200);
    expect(a).toBeGreaterThan(0.20);
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

describe('투영 한계는 샘플 간격을 따른다', () => {
  it('샘플이 크게 뛰는 소스에서도 그 한 걸음만큼은 앞서 갈 수 있다', () => {
    const p = new Projector();
    p.step('a', 0.00, 1_000);
    p.step('a', 0.10, 2_000);          // 한 샘플에 0.10 — 고정 3%보다 훨씬 크다
    let last = p.visual('a')!;
    let grew = 0;
    for (let t = 2_100; t < 3_000; t += 100) {
      const now = p.step('a', 0.10, t);
      if (now > last + 1e-9) grew++;
      last = now;
    }
    // 고정 3%로 막으면 두세 프레임 만에 멈춘다. 한 걸음치는 나아가야 한다.
    expect(grew).toBeGreaterThanOrEqual(7);
  });
});

describe('고정점에 갇히지 않는다', () => {
  it('샘플이 멈춰 있어도 프레임마다 계속 나아간다', () => {
    const p = new Projector();
    p.step('a', 0.00, 1_000);
    p.step('a', 0.05, 2_000);          // 초당 0.05
    const seen: number[] = [];
    for (let t = 2_016; t < 2_500; t += 16) seen.push(p.step('a', 0.05, t));
    // 밀고 당기기가 균형을 이뤄 서 버리면 뒤쪽 값들이 전부 같아진다.
    const tail = seen.slice(-10);
    const distinct = new Set(tail.map((v) => v.toFixed(6)));
    expect(distinct.size).toBe(tail.length);
  });
});

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
})

describe('한 프레임에 순간이동하지 않는다', () => {
  it('앵커가 크게 뛰어도 여러 프레임에 걸쳐 따라간다', () => {
    const p = new Projector();
    p.step('a', 0.00, 1_000);
    const steps: number[] = [];
    let prev = 0;
    // 랩의 10%를 한 번에 미는 샘플 — 랩 5만 토큰에서 호출 하나가 이 정도다.
    for (let t = 1_016; t < 1_400; t += 16) {
      const now = p.step('a', 0.10, t);
      steps.push(Math.abs(now - prev));
      prev = now;
    }
    expect(Math.max(...steps)).toBeLessThanOrEqual(MAX_FRAME_STEP + 1e-9);
    // 그래도 결국 따라잡아야 한다.
    expect(prev).toBeGreaterThan(0.05);
  });
});
