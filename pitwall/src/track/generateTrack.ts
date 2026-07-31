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

/** 진폭 범위. 넓힐수록 굽이가 깊어지고 둘레가 는다. */
const AMP_LOW = 0.16;
const AMP_HIGH = 0.38;
const MIN_POINTS = 180;

/**
 * 극좌표에서 반지름을 여러 사인파로 흔들어 닫힌 곡선을 만든다.
 * 반지름을 항상 양수 범위로 제한하므로 자기교차가 생기지 않는다 —
 * 유효성 검사에서 교차를 따로 볼 필요가 없다.
 */
/**
 * 기본 코스 모양.
 *
 * 3로브·진폭 0.06~0.2·기본반경 0.68은 둘레 2,808짜리 둥근 덩어리였다. 한 바퀴가
 * 짧으면 같은 랩 토큰에서도 움직임이 덜 읽힌다. 트랙 폭을 절반으로 줄이면서
 * 자기간섭 허용치도 절반이 되어 코스를 더 굽힐 수 있게 됐다 —
 * 시드 80개 중 77개가 검사를 통과하고 평균 둘레가 3,901(+39%)이다.
 */
export const DEFAULT_SHAPE: TrackOptions = { resolution: 320, lobes: 5 };

export function generateTrack(seed: number, opts: TrackOptions = DEFAULT_SHAPE): Track {
  const rng = createRng(seed);
  const aspect = opts.aspect ?? 1;
  const cx = trackWidth(aspect) / 2;
  const cy = SPACE / 2;
  const maxRadius = SPACE / 2 - MARGIN;

  // 0.68이면 코스가 좌표계의 3분의 2만 쓰고 위아래가 빈다. 0.82까지 올리면
  // 큰 로브가 maxRadius에 물려 평평해지는데, 그건 직선 구간이라 손해가 아니다.
  // 기본 반경을 낮춰 굽이가 뻗을 자리를 만든다. 0.82면 곧바로 바깥벽에 물린다.
  const baseRadius = maxRadius * 0.58;
  const waves = Array.from({ length: opts.lobes }, () => ({
    freq: rng.int(2, 6),
    amp: rng.range(AMP_LOW, AMP_HIGH),
    phase: rng.range(0, Math.PI * 2),
  }));

  const points: Point[] = [];
  for (let i = 0; i < opts.resolution; i++) {
    // 각도를 음수 방향으로 진행시켜 화면 좌표계(y 아래로 증가)에서 시계 방향이 되게 한다.
    const theta = -(i / opts.resolution) * Math.PI * 2;
    let factor = 1;
    for (const w of waves) factor += w.amp * Math.sin(w.freq * theta + w.phase);
    const r = Math.min(maxRadius, Math.max(maxRadius * 0.22, baseRadius * factor));
    // 세로 반지름은 그대로 두고 가로만 늘린다. 코스 폭(스트로크)은 안 변한다.
    points.push({ x: cx + r * aspect * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }

  // 극좌표로 뽑으면 각도 간격은 고르지만 **호 길이는 안 고르다** — 반경이 작은
  // 코너에서 같은 진행률 차이가 훨씬 짧은 거리에 대응한다. 그러면 좁은 코너마다
  // 차가 뭉치고, 넓은 곡선에서는 같은 속도가 더 빨라 보인다. 등간격으로 다시 뽑는다.
  const even = resampleByArcLength(points, opts.resolution);
  points.length = 0;
  points.push(...even);

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

/** 렌더러의 스트로크 폭과 같은 값. 코스가 자기와 이만큼은 떨어져 있어야 한다. */
export const TRACK_STROKE = 51;

/** 호로 이만큼 이상 떨어진 점끼리만 본다. 헤어핀의 진입·탈출은 원래 가깝다. */
const CLEARANCE_ARC = 26;

function selfClearance(points: Point[]): number {
  const n = points.length;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const arc = Math.min(j - i, n - (j - i));
      if (arc < CLEARANCE_ARC) continue;
      const d = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y);
      if (d < min) min = d;
    }
  }
  return min;
}

/**
 * 폐곡선을 호 길이 등간격으로 다시 뽑는다.
 *
 * 진행률 0.5는 "코스의 절반을 달렸다"여야 한다. 인덱스 기준이면 그 말이
 * 코너에서 깨진다.
 */
function resampleByArcLength(points: Point[], count: number): Point[] {
  const n = points.length;
  const cum: number[] = [0];
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    cum.push(cum[i]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cum[n]!;

  const out: Point[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const want = (k / count) * total;
    while (seg < n - 1 && cum[seg + 1]! < want) seg++;
    const span = cum[seg + 1]! - cum[seg]!;
    const t = span === 0 ? 0 : (want - cum[seg]!) / span;
    const a = points[seg]!;
    const b = points[(seg + 1) % n]!;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
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

  // 리본이 자기 자신에 붙으면 어느 쪽이 주행선인지 알 수 없다. 호로 충분히
  // 떨어진 두 점은 트랙 폭보다 멀어야 한다 — 헤어핀 자체는 걸리지 않게 창을 둔다.
  if (selfClearance(track.points) < TRACK_STROKE) problems.push('course touches itself');

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
