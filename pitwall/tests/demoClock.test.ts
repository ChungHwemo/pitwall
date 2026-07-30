import { describe, it, expect } from 'vitest';
import { demoClock } from '../src/state/demoClock';
import { DEFAULT_WORKDAY, phaseAt } from '../src/state/clock';

const at = (h: number, m: number) => new Date(2026, 6, 29, h, m, 0, 0);
const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

describe('demoClock', () => {
  it('근무 시간 밖에 열어도 레이스 중인 시각을 준다', () => {
    for (const real of [at(2, 30), at(6, 0), at(21, 15), at(23, 59)]) {
      const phase = phaseAt(demoClock(real, DEFAULT_WORKDAY), DEFAULT_WORKDAY);
      expect(['racing', 'lunch_pit', 'final_call'], `${real.getHours()}시`).toContain(phase);
    }
  });

  it('근무 시간 안에서도 항상 레이스 창 안으로 들어온다', () => {
    for (const real of [at(9, 30), at(12, 30), at(17, 0)]) {
      const m = minutes(demoClock(real, DEFAULT_WORKDAY));
      expect(m).toBeGreaterThanOrEqual(DEFAULT_WORKDAY.raceStart);
      expect(m).toBeLessThan(DEFAULT_WORKDAY.raceEnd);
    }
  });

  it('시간이 흐르면 데모 시각도 앞으로 간다', () => {
    const a = demoClock(at(3, 0), DEFAULT_WORKDAY);
    const b = demoClock(at(3, 30), DEFAULT_WORKDAY);
    expect(b.getTime()).toBeGreaterThan(a.getTime());
  });

  it('한 바퀴를 돌면 다시 시작 쪽으로 온다 — 멈추지 않는다', () => {
    const span = DEFAULT_WORKDAY.raceEnd - DEFAULT_WORKDAY.raceStart;
    const first = minutes(demoClock(at(0, 0), DEFAULT_WORKDAY));
    const wrapped = minutes(demoClock(new Date(2026, 6, 29, 0, span), DEFAULT_WORKDAY));
    expect(wrapped).toBe(first);
  });

  it('초·밀리초를 보존한다 — 시계가 뚝뚝 끊기지 않는다', () => {
    const real = new Date(2026, 6, 29, 3, 0, 42, 123);
    const demo = demoClock(real, DEFAULT_WORKDAY);
    expect(demo.getSeconds()).toBe(42);
    expect(demo.getMilliseconds()).toBe(123);
  });
});
