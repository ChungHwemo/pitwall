/**
 * 런타임 실측 표본을 판정한다. Chrome CDP 러너와 테스트가 같은 함수를 밟는다.
 *
 * 8시간 힙 게이트는 8시간을 잰 표본에만 적용한다. 5분을 8시간으로 환산하지 않는다.
 */
export interface RuntimeSample {
  tMs: number;
  heapBytes: number | null;
  nodes: number;
  svgNodes: number;
  frames: number;
  longFrames: number;
}

export interface RuntimeReport {
  durationMs: number;
  headed: boolean;
  dataset: string;
  samples: RuntimeSample[];
  heapDeltaMb: number | null;
  fps: number | null;
  longFrameRate: number;
  nodeDelta: number;
  svgNodeDelta: number;
  heapPass: boolean | null;
  fpsPass: boolean | null;
  nodesStable: boolean;
}

export const HEAP_LIMIT_MB = 50;
export const FPS_MIN = 55;
export const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const NODE_SLACK = 8;

export function summarizeRuntime(opts: {
  durationMs: number;
  headed: boolean;
  dataset: string;
  samples: RuntimeSample[];
}): RuntimeReport {
  const samples = opts.samples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  let heapDeltaMb: number | null = null;
  if (first?.heapBytes !== null && first?.heapBytes !== undefined
    && last?.heapBytes !== null && last?.heapBytes !== undefined) {
    heapDeltaMb = (last.heapBytes - first.heapBytes) / (1024 * 1024);
  }
  let fps: number | null = null;
  if (first && last && last.tMs > first.tMs) {
    fps = ((last.frames - first.frames) * 1000) / (last.tMs - first.tMs);
  }
  const longFrameRate = last && last.frames > 0 ? last.longFrames / last.frames : 0;
  const nodeDelta = first && last ? last.nodes - first.nodes : 0;
  const svgNodeDelta = first && last ? last.svgNodes - first.svgNodes : 0;
  const elapsedMs = first && last ? last.tMs - first.tMs : 0;
  const eightHours = elapsedMs >= EIGHT_HOURS_MS;
  return {
    durationMs: opts.durationMs,
    headed: opts.headed,
    dataset: opts.dataset,
    samples,
    heapDeltaMb,
    fps,
    longFrameRate,
    nodeDelta,
    svgNodeDelta,
    heapPass: eightHours && heapDeltaMb !== null ? heapDeltaMb <= HEAP_LIMIT_MB : null,
    fpsPass: opts.headed && fps !== null ? fps >= FPS_MIN : null,
    nodesStable: Math.abs(nodeDelta) <= NODE_SLACK && Math.abs(svgNodeDelta) <= NODE_SLACK,
  };
}

/** 저장된 heapPass가 표본 경과로 다시 계산한 값과 같은가. 짧은 창에 true를 심으면 거짓. */
export function assertHeapPassMatchesElapsed(report: RuntimeReport): boolean {
  const fresh = summarizeRuntime({
    durationMs: report.durationMs,
    headed: report.headed,
    dataset: report.dataset,
    samples: report.samples,
  });
  return report.heapPass === fresh.heapPass;
}
