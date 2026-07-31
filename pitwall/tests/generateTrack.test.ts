import { describe, it, expect } from 'vitest';
import { generateTrack, validateTrack, trackWidth, DEFAULT_SHAPE } from '../src/track/generateTrack';

describe('generateTrack', () => {
  it('같은 시드는 같은 트랙을 만든다', () => {
    const a = generateTrack(2026);
    const b = generateTrack(2026);
    expect(a.points).toEqual(b.points);
    expect(a.pitEntry).toBe(b.pitEntry);
  });

  it('다른 시드는 다른 트랙을 만든다', () => {
    const a = generateTrack(1);
    const b = generateTrack(2);
    expect(a.points).not.toEqual(b.points);
  });

  it('시드를 트랙에 기록한다', () => {
    expect(generateTrack(777).seed).toBe(777);
  });

  it('충분한 해상도의 폐곡선을 만든다', () => {
    const t = generateTrack(5);
    expect(t.points.length).toBeGreaterThanOrEqual(180);
  });

  it('모든 점이 0..1000 좌표 공간 안에 있다', () => {
    const t = generateTrack(31);
    for (const p of t.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1000);
    }
  });

  it('피트 진입과 탈출이 서로 다른 위치다', () => {
    const t = generateTrack(88);
    expect(t.pitEntry).not.toBe(t.pitExit);
  });

  it('섹터 3개가 오름차순이며 범위 안에 있다', () => {
    const t = generateTrack(13);
    const [s1, s2, s3] = t.sectors;
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s3).toBeLessThan(1);
  });
});

describe('validateTrack', () => {
  it('생성된 트랙 100개가 모두 유효성 검사를 통과한다', () => {
    const failures: Array<{ seed: number; problems: string[] }> = [];
    for (let seed = 0; seed < 100; seed++) {
      const problems = validateTrack(generateTrack(seed));
      if (problems.length > 0) failures.push({ seed, problems });
    }
    expect(failures).toEqual([]);
  });

  it('점이 너무 적은 트랙을 거부한다', () => {
    const bad = { ...generateTrack(1), points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(validateTrack(bad)).toContain('too few points');
  });

  it('좌표 공간을 벗어난 트랙을 거부한다', () => {
    const t = generateTrack(1);
    const bad = { ...t, points: [...t.points.slice(0, -1), { x: 5000, y: 0 }] };
    expect(validateTrack(bad)).toContain('point out of bounds');
  });

  it('피트 진입/탈출이 같으면 거부한다', () => {
    const t = generateTrack(1);
    const bad = { ...t, pitEntry: 10, pitExit: 10 };
    expect(validateTrack(bad)).toContain('pit entry equals exit');
  });
});

describe('가로 비율', () => {
  it('넓은 화면에서는 가로로 늘어나 빈 공간을 남기지 않는다', () => {
    const wide = generateTrack(7, { resolution: 240, lobes: 3, aspect: 1.6 });
    const xs = wide.points.map((p) => p.x);
    const ys = wide.points.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    // 코스는 폭을 다 쓴다 — 정사각 안에 갇힌 원이 아니다.
    expect(w / h).toBeGreaterThan(1.4);
    expect(Math.max(...xs)).toBeLessThanOrEqual(trackWidth(1.6));
  });

  it('비율을 안 주면 예전과 같은 정사각 코스다', () => {
    expect(generateTrack(7)).toEqual(generateTrack(7, { ...DEFAULT_SHAPE, aspect: 1 }));
  });

  it('늘어난 코스도 검사를 통과한다', () => {
    expect(validateTrack(generateTrack(7, { resolution: 240, lobes: 3, aspect: 1.6 }))).toEqual([]);
  });
});

describe('코스 길이와 자기간섭', () => {
  const perim = (t: ReturnType<typeof generateTrack>) => t.points.reduce(
    (s, _, i) => s + Math.hypot(
      t.points[(i + 1) % t.points.length]!.x - t.points[i]!.x,
      t.points[(i + 1) % t.points.length]!.y - t.points[i]!.y), 0);

  it('예전보다 긴 코스를 만든다 — 한 바퀴가 짧으면 움직임이 안 읽힌다', () => {
    // 화면이 쓰는 가로 비율에서 잰다 — 정사각 코스는 원래 더 짧다.
    expect(perim(generateTrack(7, { ...DEFAULT_SHAPE, aspect: 1.5 }))).toBeGreaterThan(3200);
  });

  it('코스가 자기 자신과 겹치지 않는다 — 리본이 붙으면 어느 쪽이 주행선인지 모른다', () => {
    // 호로 충분히 떨어진 두 점은 트랙 폭보다 멀어야 한다.
    for (const seed of [7, 11, 2026]) {
      const t = generateTrack(seed, { ...DEFAULT_SHAPE, aspect: 1.5 });
      expect(validateTrack(t)).toEqual([]);
    }
  });

  it('겹치는 코스는 검사에서 걸러진다', () => {
    // 억지로 두 지점을 붙여 놓으면 잡아내야 한다.
    const t = generateTrack(7);
    const half = Math.floor(t.points.length / 2);
    t.points[half] = { ...t.points[0]! };
    expect(validateTrack(t)).toContain('course touches itself');
  });
})

describe('호 길이 균일', () => {
  it('점 간격이 고르다 — 안 그러면 좁은 코너에서 차가 뭉치고 속도가 들쭉날쭉하다', () => {
    const t = generateTrack(2026, { ...DEFAULT_SHAPE, aspect: 1.5 });
    const seg: number[] = [];
    for (let i = 0; i < t.points.length; i++) {
      const a = t.points[i]!;
      const b = t.points[(i + 1) % t.points.length]!;
      seg.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    const avg = seg.reduce((s, v) => s + v, 0) / seg.length;
    // 가장 짧은 구간이 평균의 절반 밑으로 내려가면 그 자리에서 진행률이 압축된다.
    expect(Math.min(...seg)).toBeGreaterThan(avg * 0.6);
    expect(Math.max(...seg)).toBeLessThan(avg * 1.6);
  });
});
