import { createRng } from '../util/rng';

export interface Point {
  x: number;
  y: number;
}

export interface Track {
  /** 닫힌 폐곡선 중심선. 시계 방향으로 정렬된다. */
  points: Point[];
  /** points 배열의 인덱스 */
  pitEntry: number;
  pitExit: number;
  /** 랩 진행률 0..1 기준 섹터 경계 */
  sectors: [number, number, number];
  seed: number;
  /** 좌표계 가로 비율. 렌더러가 viewBox를 맞춘다. */
  aspect: number;
}

export interface TrackOptions {
  resolution: number;
  lobes: number;
  /**
   * 코스의 가로:세로 비. 1이면 정사각.
   *
   * 화면은 가로로 길고 코스는 원에 가까워서, 정사각 좌표계에 그리면 오른쪽이
   * 통째로 비었다. 좌표계 자체를 늘려 실제 서킷처럼 옆으로 퍼지게 한다.
   */
  aspect?: number;
}

/** 주어진 비율에서 좌표계 가로 폭. viewBox와 경계 검사가 같이 쓴다. */
export function trackWidth(aspect = 1): number {
  return SPACE * aspect;
}

const SPACE = 1000;
const MARGIN = 40;
const MIN_POINTS = 180;

/**
 * 극좌표에서 반지름을 여러 사인파로 흔들어 닫힌 곡선을 만든다.
 * 반지름을 항상 양수 범위로 제한하므로 자기교차가 생기지 않는다 —
 * 유효성 검사에서 교차를 따로 볼 필요가 없다.
 */
export function generateTrack(seed: number, opts: TrackOptions = { resolution: 240, lobes: 3 }): Track {
  const rng = createRng(seed);
  const aspect = opts.aspect ?? 1;
  const cx = trackWidth(aspect) / 2;
  const cy = SPACE / 2;
  const maxRadius = SPACE / 2 - MARGIN;

  // 0.68이면 코스가 좌표계의 3분의 2만 쓰고 위아래가 빈다. 0.82까지 올리면
  // 큰 로브가 maxRadius에 물려 평평해지는데, 그건 직선 구간이라 손해가 아니다.
  const baseRadius = maxRadius * 0.82;
  const waves = Array.from({ length: opts.lobes }, () => ({
    freq: rng.int(2, 5),
    amp: rng.range(0.06, 0.2),
    phase: rng.range(0, Math.PI * 2),
  }));

  const points: Point[] = [];
  for (let i = 0; i < opts.resolution; i++) {
    // 각도를 음수 방향으로 진행시켜 화면 좌표계(y 아래로 증가)에서 시계 방향이 되게 한다.
    const theta = -(i / opts.resolution) * Math.PI * 2;
    let factor = 1;
    for (const w of waves) factor += w.amp * Math.sin(w.freq * theta + w.phase);
    const r = Math.min(maxRadius, Math.max(maxRadius * 0.3, baseRadius * factor));
    // 세로 반지름은 그대로 두고 가로만 늘린다. 코스 폭(스트로크)은 안 변한다.
    points.push({ x: cx + r * aspect * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }

  const pitEntry = rng.int(0, opts.resolution - 1);
  const pitExit = (pitEntry + rng.int(12, 30)) % opts.resolution;

  return {
    points,
    pitEntry,
    pitExit,
    sectors: [0, 1 / 3, 2 / 3],
    seed,
    aspect,
  };
}

export function validateTrack(track: Track): string[] {
  const problems: string[] = [];

  if (track.points.length < MIN_POINTS) problems.push('too few points');

  const width = trackWidth(track.aspect ?? 1);
  const outOfBounds = track.points.some(
    (p) => p.x < 0 || p.x > width || p.y < 0 || p.y > SPACE,
  );
  if (outOfBounds) problems.push('point out of bounds');

  if (track.pitEntry === track.pitExit) problems.push('pit entry equals exit');

  if (track.pitEntry < 0 || track.pitEntry >= track.points.length) {
    problems.push('pit entry index out of range');
  }
  if (track.pitExit < 0 || track.pitExit >= track.points.length) {
    problems.push('pit exit index out of range');
  }

  const [s1, s2, s3] = track.sectors;
  if (!(s1 < s2 && s2 < s3 && s1 >= 0 && s3 < 1)) {
    problems.push('sectors not monotonic in range');
  }

  return problems;
}
