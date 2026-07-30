import { describe, it, expect } from 'vitest';
import { phaseAt, elapsedMs, raceDurationMs, DEFAULT_WORKDAY } from '../src/state/clock';

/** 로컬 시간대 기준 그날의 시:분으로 Date를 만든다. */
function at(hour: number, minute: number): Date {
  return new Date(2026, 6, 29, hour, minute, 0, 0);
}

describe('phaseAt', () => {
  it('08:00은 pre_grid', () => {
    expect(phaseAt(at(8, 0), DEFAULT_WORKDAY)).toBe('pre_grid');
  });

  it('08:56은 formation', () => {
    expect(phaseAt(at(8, 56), DEFAULT_WORKDAY)).toBe('formation');
  });

  it('09:00 정각은 racing', () => {
    expect(phaseAt(at(9, 0), DEFAULT_WORKDAY)).toBe('racing');
  });

  it('12:30은 lunch_pit', () => {
    expect(phaseAt(at(12, 30), DEFAULT_WORKDAY)).toBe('lunch_pit');
  });

  it('13:00은 다시 racing', () => {
    expect(phaseAt(at(13, 0), DEFAULT_WORKDAY)).toBe('racing');
  });

  it('17:56은 final_call', () => {
    expect(phaseAt(at(17, 56), DEFAULT_WORKDAY)).toBe('final_call');
  });

  it('18:00은 chequered', () => {
    expect(phaseAt(at(18, 0), DEFAULT_WORKDAY)).toBe('chequered');
  });

  it('심야 03:00은 pre_grid', () => {
    expect(phaseAt(at(3, 0), DEFAULT_WORKDAY)).toBe('pre_grid');
  });
});

describe('raceDurationMs', () => {
  // PRD §7.0: 레이스 시간 = 근무 종료 − 근무 시작 − Σ(휴식). 설정이 아니라 파생값이다.
  it('기본 근무일은 8시간이다 — 9시간이 아니다', () => {
    expect(raceDurationMs(DEFAULT_WORKDAY)).toBe(8 * 3_600_000);
  });

  it('휴식이 없으면 근무 창 전체가 레이스 시간이다', () => {
    const noLunch = { ...DEFAULT_WORKDAY, lunchStart: 720, lunchEnd: 720 };
    expect(raceDurationMs(noLunch)).toBe(9 * 3_600_000);
  });
});

describe('elapsedMs', () => {
  it('스타트 전에는 0', () => {
    expect(elapsedMs(at(8, 30), DEFAULT_WORKDAY)).toBe(0);
  });

  it('11:00은 2시간', () => {
    expect(elapsedMs(at(11, 0), DEFAULT_WORKDAY)).toBe(2 * 3_600_000);
  });

  it('점심 중에는 시계가 멈춘다 — 12:30도 3시간', () => {
    expect(elapsedMs(at(12, 30), DEFAULT_WORKDAY)).toBe(3 * 3_600_000);
  });

  it('점심 이후에는 점심 길이를 뺀 값이다 — 14:00은 4시간', () => {
    expect(elapsedMs(at(14, 0), DEFAULT_WORKDAY)).toBe(4 * 3_600_000);
  });

  it('체커기 이후에는 레이스 길이에서 멈춘다 — 8시간', () => {
    expect(elapsedMs(at(23, 0), DEFAULT_WORKDAY)).toBe(8 * 3_600_000);
  });
});
