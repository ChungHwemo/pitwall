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

  it('새 샘플이 뒤에 와도 화면은 뒤로 돌지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    for (let t = 2_100; t < 8_000; t += 100) p.step('a', 0.30, t);   // 앞서 나가 있다
    const before = p.visual('a')!;
    const after = p.step('a', 0.25, 8_100);                          // 목표가 뒤로
    // 앵커가 뒤로 재보정돼도 화면은 역주행하지 않는다 — 제자리에 서서 데이터를 기다린다.
    expect(after).toBeGreaterThanOrEqual(before);
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

  // 회귀 고정 (REVIEW #2): 앵커가 잠깐 멈춘 사이 차가 고정점에 얼어붙어 "스팟에서
  // 스팟으로" 튄다. 전방투영(velocity*dt)과 정지 앵커로의 보간(LERP)이 앵커보다
  // velocity*dt/LERP 앞선 지점에서 정확히 상쇄돼 멈춘다. 위 테스트는 30프레임만 봐서
  // 이 정지(≈80프레임 뒤)를 놓친다 — 속도와 lead 여유가 있으면 계속 미끄러져야 한다.
  it('앵커가 유지돼도 속도가 있으면 lead 한계까지 계속 미끄러진다 — 고정점에서 얼지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.00, 1_000);
    p.step('a', 0.02, 2_000);          // 전방 속도 0.02/초 확보, lead 한계 0.03
    let atFrame40 = 0;
    let atFrame80 = 0;
    for (let f = 0, t = 2_016; f < 120; f++, t += 16) {
      const v = p.step('a', 0.02, t);
      if (f === 40) atFrame40 = v;
      if (f === 80) atFrame80 = v;
    }
    // 고정점에 갇히면 이 구간은 사실상 정지(≈0.0001). 전방투영이 살아 있으면 눈에 띄게 나아간다.
    expect(atFrame80 - atFrame40).toBeGreaterThan(0.005);
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

// 폐곡선에서 두 진행률의 최단 부호 거리 — 랩(1→0)을 앞으로 읽는다.
// projection.ts 내부 helper와 같은 규약. 역주행 판정에만 쓴다.
function frameShortest(from: number, to: number): number {
  let d = to - from;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

// 회귀 고정 (REVIEW H1 — 실측 확정 결함): 실 Chrome에서 한 차가 318프레임 중
// 171번 역주행했고 방향 코사인 -1.0, 좌표를 비트 단위로 되짚었다. positionAt 스윕은
// 240 경계 전부 무단절이었으므로 역주행 신호는 상류 visual 진행률에서 왔다.
// 근인: step()의 앵커 당기기 / lead 클램프가 전방 진행 뒤 더 낮은 visual을 되돌려준다.
describe('진행률은 역주행하지 않는다 (REVIEW H1)', () => {
  it('뒤로 튄 앵커가 다음 전진 샘플의 속도까지 뒤집지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);

    const samples = [0.25, 0.302, 0.252, 0.304, 0.254, 0.306];
    const values = samples.map((target, index) => p.step('a', target, 2_100 + index * 100));

    expect(values[3]).toBeGreaterThan(values[1]!);
    expect(values[5]).toBeGreaterThan(values[3]!);
  });

  it('큰 후퇴 보정 뒤에도 같은 위치의 화면 주행은 계속 전진한다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    p.step('a', 0.02, 2_100);
    const before = p.visual('a')!;
    const after = p.step('a', 0.02, 2_200);

    expect(after).toBeGreaterThan(before);
  });

  it('전방 진행이 성립한 뒤 앵커·리드 보정이 화면을 뒤로 돌리지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);                       // 전방 속도 확보 → 앞서 나간다
    for (let t = 2_100; t < 8_000; t += 100) p.step('a', 0.30, t);

    // 앵커가 뒤로 튄 뒤 다시 앞으로 기어간다 — 실측에서 visual 진동을 유발한 신호.
    let prev = p.visual('a')!;
    let reversals = 0;
    let target = 0.25;                              // 앞서 있던 위치보다 뒤
    for (let t = 8_000; t < 24_000; t += 100) {
      const v = p.step('a', target, t);
      if (frameShortest(prev, v) < -1e-9) reversals++;
      prev = v;
      target += 0.002;                              // 데이터는 앞으로만 간다
    }
    // 화면이 뒤로 도는 프레임이 하나라도 있으면 결함이다.
    expect(reversals).toBe(0);
  });

  it('전방 주행 중 lead 클램프가 걸려도 이전 프레임보다 낮은 진행률을 내지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.00, 1_000);
    p.step('a', 0.10, 2_000);                       // 큰 한 걸음 → lead 여유가 크다
    // 앵커가 앞서 나간 visual보다 뒤로 재보정되는 구간을 반복 노출.
    let prev = p.visual('a')!;
    let reversals = 0;
    const targets = [0.06, 0.07, 0.05, 0.08, 0.06, 0.09, 0.07, 0.10];
    let ti = 0;
    for (let t = 2_100; t < 6_000; t += 100) {
      const v = p.step('a', targets[ti++ % targets.length]!, t);
      if (frameShortest(prev, v) < -1e-9) reversals++;
      prev = v;
    }
    expect(reversals).toBe(0);
  });
});
