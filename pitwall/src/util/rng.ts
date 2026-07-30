export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
}

/**
 * mulberry32 — 32비트 상태의 결정론적 PRNG.
 * 암호학적으로 안전하지 않다. 트랙 코스 생성 전용이며
 * 시뮬레이터 이벤트에는 쓰지 않는다 (PRD SIM-5).
 */
export function createRng(seed: number): Rng {
  // 시드 0에서도 상태가 죽지 않도록 홀수 오프셋을 더한다.
  let state = (seed >>> 0) + 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
  };
}
