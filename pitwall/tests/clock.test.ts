import { describe, it, expect } from 'vitest';
import { phaseAt, elapsedMs, raceDurationMs, DEFAULT_WORKDAY, workdayFromActivity, liveWorkday, formatWallClock } from '../src/state/clock';

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

describe('workdayFromActivity', () => {
  const at = (h: number, m = 0) => new Date(2026, 6, 30, h, m).getTime();

  it('실제 첫 호출과 마지막 호출로 창을 잡는다', () => {
    const cfg = workdayFromActivity([at(7, 12), at(13, 5), at(20, 55)].map((ts) => ({ ts, work: 1 })));
    expect(cfg.raceStart).toBe(7 * 60);
    expect(cfg.raceEnd).toBe(21 * 60);
  });

  it('일이 거의 없던 가장자리 시간대는 창에서 뺀다', () => {
    // 자정에 22건(하루 작업의 0.5%)이 찍혔다고 창을 7시간 늘리면
    // 나머지 99.5%가 눈금 한 칸으로 눌린다.
    const cfg = workdayFromActivity([
      { ts: at(0, 16), work: 5_000 },
      { ts: at(9), work: 500_000 },
      { ts: at(18), work: 500_000 },
    ]);
    expect(cfg.raceStart).toBe(9 * 60);
    expect(cfg.raceEnd).toBe(19 * 60);
  });

  it('가정한 점심으로 시계를 멈추지 않는다 — 실제 공백은 데이터에 이미 있다', () => {
    const cfg = workdayFromActivity([at(9), at(18)].map((ts) => ({ ts, work: 1 })));
    expect(cfg.lunchEnd - cfg.lunchStart).toBe(0);
    // 창은 시간대 단위다. 18:00에 호출이 있으면 18시가 통째로 창 안에 있어야
    // 그 호출이 체커기에 잘리지 않는다 — 09시부터 19시까지 10시간.
    expect(raceDurationMs(cfg)).toBe(10 * 60 * 60_000);
  });

  it('활동이 없으면 기본 근무일로 물러난다', () => {
    expect(workdayFromActivity([])).toEqual(DEFAULT_WORKDAY);
  });

  it('포메이션과 파이널콜은 창 안쪽에 붙인다', () => {
    const cfg = workdayFromActivity([at(10), at(16)].map((ts) => ({ ts, work: 1 })));
    expect(cfg.formationStart).toBeLessThan(cfg.raceStart);
    expect(cfg.finalCall).toBeLessThan(cfg.raceEnd);
    expect(phaseAt(new Date(2026, 6, 30, 12), cfg)).toBe('racing');
  });
});

describe('formatWallClock', () => {
  it('날짜와 시각을 같이 쓴다 — 어느 날 몇 시인지 화면만 봐서 알아야 한다', () => {
    expect(formatWallClock(new Date(2026, 6, 30, 18, 5))).toBe('07/30 18:05');
  });
});

describe('실시간 창', () => {
  const at = (h: number, m = 0) => new Date(2026, 6, 30, h, m).getTime();

  it('지금이 창 끝을 넘으면 창을 지금까지 늘린다 — 실시간 화면은 끝나지 않는다', () => {
    const cfg = liveWorkday(
      [{ ts: at(9), work: 100 }, { ts: at(10), work: 100 }], at(23, 40));
    expect(cfg.raceStart).toBe(9 * 60);
    expect(cfg.raceEnd).toBeGreaterThan(23 * 60 + 40);
    expect(phaseAt(new Date(2026, 6, 30, 23, 40), cfg)).toBe('racing');
  });

  it('아직 창 안이면 활동에서 뽑은 창 그대로다', () => {
    const samples = [{ ts: at(9), work: 100 }, { ts: at(17), work: 100 }];
    expect(liveWorkday(samples, at(12))).toEqual(workdayFromActivity(samples));
  });

  it('기록이 아직 없으면 지금 시각 한 시간짜리 창으로 시작한다', () => {
    const cfg = liveWorkday([], at(14, 20));
    expect(cfg.raceStart).toBe(14 * 60);
    expect(phaseAt(new Date(2026, 6, 30, 14, 20), cfg)).toBe('racing');
  });
});
