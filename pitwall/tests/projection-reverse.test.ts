import { describe, it, expect } from 'vitest';
import { Projector } from '../src/render/projection';

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
  it('새 샘플이 뒤에 와도 화면은 뒤로 돌지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    let before = p.step('a', 0.30, 2_000);
    for (let t = 2_100; t < 8_000; t += 100) before = p.step('a', 0.30, t);   // 앞서 나가 있다
    const after = p.step('a', 0.25, 8_100);                          // 목표가 뒤로
    // 앵커가 뒤로 재보정돼도 화면은 역주행하지 않는다 — 제자리에 서서 데이터를 기다린다.
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('알려진 전진 목표가 반 바퀴보다 멀어도 앞으로 따라간다', () => {
    // Given: 화면보다 0.6랩 앞선 목표가 전진 샘플로 들어온다.
    const p = new Projector();
    const before = p.step('a', 0.00, 1_000);

    // When: 투영기가 그 목표를 향해 한 프레임 진행한다.
    const after = p.step('a', 0.60, 2_000);

    // Then: 원형 최단거리의 후진 방향으로 오독하지 않고 전진한다.
    expect(frameShortest(before, after)).toBeGreaterThan(0);
  });

  it('뒤로 튄 앵커가 다음 전진 샘플의 속도까지 뒤집지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);

    p.step('a', 0.25, 2_100);
    const second = p.step('a', 0.302, 2_200);
    p.step('a', 0.252, 2_300);
    const fourth = p.step('a', 0.304, 2_400);
    p.step('a', 0.254, 2_500);
    const sixth = p.step('a', 0.306, 2_600);

    expect(fourth).toBeGreaterThan(second);
    expect(sixth).toBeGreaterThan(fourth);
  });

  it('큰 후퇴 보정 뒤에도 같은 위치의 화면 주행은 계속 전진한다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    p.step('a', 0.30, 2_000);
    const before = p.step('a', 0.02, 2_100);
    const after = p.step('a', 0.02, 2_200);

    expect(after).toBeGreaterThan(before);
  });

  it('전방 진행이 성립한 뒤 앵커·리드 보정이 화면을 뒤로 돌리지 않는다', () => {
    const p = new Projector();
    p.step('a', 0.20, 1_000);
    let prev = p.step('a', 0.30, 2_000);            // 전방 속도 확보 → 앞서 나간다
    for (let t = 2_100; t < 8_000; t += 100) prev = p.step('a', 0.30, t);

    // 앵커가 뒤로 튄 뒤 다시 앞으로 기어간다 — 실측에서 visual 진동을 유발한 신호.
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
    let prev = p.step('a', 0.10, 2_000);            // 큰 한 걸음 → lead 여유가 크다
    // 앵커가 앞서 나간 visual보다 뒤로 재보정되는 구간을 반복 노출.
    let reversals = 0;
    const targets = [0.06, 0.07, 0.05, 0.08, 0.06, 0.09, 0.07, 0.10];
    let now = 2_100;
    while (now < 6_000) {
      for (const target of targets) {
        if (now >= 6_000) break;
        const v = p.step('a', target, now);
        if (frameShortest(prev, v) < -1e-9) reversals++;
        prev = v;
        now += 100;
      }
    }
    expect(reversals).toBe(0);
  });
});
