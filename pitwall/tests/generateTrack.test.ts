import { describe, it, expect } from 'vitest';
import { generateTrack, validateTrack } from '../src/track/generateTrack';

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
