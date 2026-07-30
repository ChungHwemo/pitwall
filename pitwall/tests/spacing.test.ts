import { describe, it, expect } from 'vitest';
import { spreadProgress, MIN_SPACING } from '../src/track/spacing';

describe('spreadProgress', () => {
  it('충분히 떨어져 있으면 그대로 둔다', () => {
    expect(spreadProgress([0, 0.3, 0.6])).toEqual([0, 0.3, 0.6]);
  });

  it('겹치는 것을 최소 간격까지 밀어낸다', () => {
    const out = spreadProgress([0.5, 0.5, 0.5]);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]! - out[i - 1]!).toBeGreaterThanOrEqual(MIN_SPACING - 1e-9);
    }
  });

  it('입력 순서를 보존한다 — 정렬해서 돌려주지 않는다', () => {
    const out = spreadProgress([0.9, 0.1, 0.5]);
    expect(out.length).toBe(3);
    // 뒤로 갈수록 커지는 게 아니라, 각 입력에 대응하는 값이 나온다.
    expect(out[1]!).toBeLessThan(out[2]!);
    expect(out[2]!).toBeLessThan(out[0]!);
  });

  it('밀어내도 원래 위치에서 멀리 벗어나지 않는다', () => {
    const input = Array.from({ length: 20 }, () => 0.5);
    const out = spreadProgress(input);
    for (const p of out) expect(Math.abs(p - 0.5)).toBeLessThan(0.5);
  });

  it('한 바퀴를 채울 만큼 많아도 무한 루프에 빠지지 않는다', () => {
    const many = Array.from({ length: 200 }, (_, i) => (i % 3) * 0.001);
    const out = spreadProgress(many);
    expect(out.length).toBe(200);
    for (const p of out) expect(Number.isFinite(p)).toBe(true);
  });

  it('전부 0..1 안에 머문다', () => {
    for (const p of spreadProgress([0.99, 0.995, 0.999])) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('빈 입력은 빈 출력이다', () => {
    expect(spreadProgress([])).toEqual([]);
  });

  it('작은 이동에는 결과도 작게 움직인다 — 점멸하지 않는다', () => {
    // 빈 양자화의 문제가 이것이었다. 진행률이 조금 바뀌면 결과도 조금 바뀌어야 한다.
    const a = spreadProgress([0.20, 0.50, 0.80]);
    const b = spreadProgress([0.20, 0.51, 0.80]);
    expect(Math.abs(b[1]! - a[1]!)).toBeCloseTo(0.01, 6);
  });
});
