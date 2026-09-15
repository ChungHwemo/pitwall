import { describe, it, expect } from 'vitest';
import { summarizeRuntime, assertHeapPassMatchesElapsed, EIGHT_HOURS_MS } from '../scripts/runtimeReport';

function sample(over: Partial<{ tMs: number; heapBytes: number | null; nodes: number; svgNodes: number; frames: number; longFrames: number }>) {
  return {
    tMs: 0, heapBytes: 20_000_000, nodes: 400, svgNodes: 200, frames: 0, longFrames: 0,
    ...over,
  };
}

describe('summarizeRuntime', () => {
  it('8시간 미만 힙은 합격/불합격을 매기지 않는다 — 5분을 8시간으로 환산하지 않는다', () => {
    const report = summarizeRuntime({
      durationMs: 300_000,
      headed: true,
      dataset: 'demo-large',
      samples: [sample({ tMs: 0 }), sample({ tMs: 300_000, heapBytes: 21_000_000, frames: 18_000 })],
    });
    expect(report.heapPass).toBeNull();
    expect(report.heapDeltaMb).toBeCloseTo(1 / (1024 * 1024) * 1_000_000, 5);
  });

  it('요청만 8시간이면 힙 합격을 매기지 않는다 — 표본이 8시간을 지나야 한다', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const report = summarizeRuntime({
      durationMs: EIGHT_HOURS_MS,
      headed: false,
      dataset: 'demo-large',
      samples: [
        sample({ tMs: 0, heapBytes: 10_000_000 }),
        sample({ tMs: twoHours, heapBytes: 12_000_000, frames: 1 }),
      ],
    });
    expect(report.heapPass).toBeNull();
  });

  it('8시간 표본의 힙 증가가 50MB 이하면 합격이다', () => {
    const report = summarizeRuntime({
      durationMs: EIGHT_HOURS_MS,
      headed: false,
      dataset: 'demo-large',
      samples: [
        sample({ tMs: 0, heapBytes: 10_000_000 }),
        sample({ tMs: EIGHT_HOURS_MS, heapBytes: 10_000_000 + 40 * 1024 * 1024, frames: 1 }),
      ],
    });
    expect(report.heapPass).toBe(true);
  });

  it('8시간 표본의 힙 증가가 50MB를 넘으면 불합격이다', () => {
    const report = summarizeRuntime({
      durationMs: EIGHT_HOURS_MS,
      headed: false,
      dataset: 'demo-large',
      samples: [
        sample({ tMs: 0, heapBytes: 10_000_000 }),
        sample({ tMs: EIGHT_HOURS_MS, heapBytes: 10_000_000 + 51 * 1024 * 1024, frames: 1 }),
      ],
    });
    expect(report.heapPass).toBe(false);
  });

  it('헤드풀에서만 fps 합격을 매긴다 — headless 120fps는 상한이 아니다', () => {
    const samples = [sample({ tMs: 0 }), sample({ tMs: 1_000, frames: 60 })];
    expect(summarizeRuntime({ durationMs: 1_000, headed: false, dataset: 'x', samples }).fpsPass).toBeNull();
    expect(summarizeRuntime({ durationMs: 1_000, headed: true, dataset: 'x', samples }).fpsPass).toBe(true);
    expect(summarizeRuntime({
      durationMs: 1_000, headed: true, dataset: 'x',
      samples: [sample({ tMs: 0 }), sample({ tMs: 1_000, frames: 30 })],
    }).fpsPass).toBe(false);
  });

  it('저장된 heapPass가 경과와 다르면 정직하지 않다', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const lying = summarizeRuntime({
      durationMs: EIGHT_HOURS_MS,
      headed: false,
      dataset: 'demo-large',
      samples: [
        sample({ tMs: 0, heapBytes: 10_000_000 }),
        sample({ tMs: twoHours, heapBytes: 11_000_000, frames: 1 }),
      ],
    });
    expect(lying.heapPass).toBeNull();
    const forged = { ...lying, heapPass: true as const };
    expect(assertHeapPassMatchesElapsed(forged)).toBe(false);
    expect(assertHeapPassMatchesElapsed(lying)).toBe(true);
  });

  it('노드 수가 거의 안 변하면 안정이다', () => {
    const report = summarizeRuntime({
      durationMs: 1_000,
      headed: true,
      dataset: 'x',
      samples: [sample({ nodes: 400, svgNodes: 200 }), sample({ tMs: 1_000, nodes: 402, svgNodes: 200, frames: 60 })],
    });
    expect(report.nodesStable).toBe(true);
  });
});
