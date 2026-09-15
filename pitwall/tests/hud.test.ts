import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadSalaryConfig, saveSalaryConfig, earnedSoFar, formatElapsed, SALARY_STORAGE_KEY,
} from '../src/render/hudRenderer';
import { DEFAULT_WORKDAY } from '../src/state/clock';
import { PitwallApp } from '../src/main';

function at(hour: number, minute: number): Date {
  return new Date(2026, 6, 29, hour, minute, 0, 0);
}

const CFG = { annualSalary: 60_000_000, workdaysPerYear: 240 };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('salary config storage', () => {
  it('저장한 설정을 다시 읽는다', () => {
    saveSalaryConfig(CFG);
    expect(loadSalaryConfig()).toEqual(CFG);
  });

  it('저장된 값이 없으면 null이다', () => {
    expect(loadSalaryConfig()).toBeNull();
  });

  it('깨진 JSON은 null로 처리하고 예외를 던지지 않는다', () => {
    localStorage.setItem(SALARY_STORAGE_KEY, '{ not json');
    expect(loadSalaryConfig()).toBeNull();
  });

  it('필드가 빠진 값은 null로 처리한다', () => {
    localStorage.setItem(SALARY_STORAGE_KEY, JSON.stringify({ annualSalary: 100 }));
    expect(loadSalaryConfig()).toBeNull();
  });

  it('저장 시 네트워크를 쓰지 않는다', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    saveSalaryConfig(CFG);
    loadSalaryConfig();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('earnedSoFar', () => {
  it('스타트 전에는 0이다', () => {
    expect(earnedSoFar(CFG, DEFAULT_WORKDAY, at(8, 30))).toBe(0);
  });

  it('퇴근 시각에는 하루치 급여 전액이다', () => {
    const perDay = CFG.annualSalary / CFG.workdaysPerYear;
    expect(earnedSoFar(CFG, DEFAULT_WORKDAY, at(18, 0))).toBeCloseTo(perDay, 2);
  });

  it('정확히 절반 지점에서 하루치의 절반이다 — 8시간의 절반은 14:00이다', () => {
    // 09:00~12:00(3h) + 13:00~14:00(1h) = 4h. 점심은 급여에도 경과에도 넣지 않는다.
    const perDay = CFG.annualSalary / CFG.workdaysPerYear;
    expect(earnedSoFar(CFG, DEFAULT_WORKDAY, at(14, 0))).toBeCloseTo(perDay / 2, 2);
  });

  it('점심 중에는 급여가 늘지 않는다', () => {
    const a = earnedSoFar(CFG, DEFAULT_WORKDAY, at(12, 10));
    const b = earnedSoFar(CFG, DEFAULT_WORKDAY, at(12, 50));
    expect(b).toBeCloseTo(a, 6);
  });

  it('퇴근 후에도 하루치를 넘지 않는다', () => {
    const perDay = CFG.annualSalary / CFG.workdaysPerYear;
    expect(earnedSoFar(CFG, DEFAULT_WORKDAY, at(23, 0))).toBeCloseTo(perDay, 2);
  });

  it('시간에 따라 단조 증가한다', () => {
    const a = earnedSoFar(CFG, DEFAULT_WORKDAY, at(10, 0));
    const b = earnedSoFar(CFG, DEFAULT_WORKDAY, at(11, 0));
    expect(b).toBeGreaterThan(a);
  });
});

describe('formatElapsed', () => {
  it('0은 00:00:00', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  it('시분초를 0으로 채운다', () => {
    expect(formatElapsed(3_723_000)).toBe('01:02:03');
  });

  it('8시간을 표기한다', () => {
    expect(formatElapsed(8 * 3_600_000)).toBe('08:00:00');
  });

  it('음수는 00:00:00으로 잘라낸다', () => {
    expect(formatElapsed(-5000)).toBe('00:00:00');
  });
});

describe('HUD 시간대별 곡선', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    localStorage.clear();
  });

  function runFrames(app: PitwallApp, count: number, stepMs = 100): void {
    for (let i = 1; i <= count; i++) app.frame(i * stepMs);
  }

  it('곡선 컨테이너가 상단 바에 존재한다', () => {
    new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    expect(root.querySelector('.hud-hourly')).not.toBeNull();
  });

  it('작업이 없으면 곡선을 숨긴다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    const app = new PitwallApp(root, { seed: 7, preset: 'sparse', speed: 20 });
    app.start();
    runFrames(app, 50);
    const el = root.querySelector('.hud-hourly') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('작업이 쌓이면 나타나고, 이후 프레임에서 노드 수가 불변이다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0001);
    const app = new PitwallApp(root, { seed: 11, preset: 'chaos', speed: 100 });
    app.start();
    runFrames(app, 100);
    const el = root.querySelector('.hud-hourly') as HTMLElement;
    expect(el.style.display).toBe('');
    expect(el.textContent!.length).toBe(24);
    const nodes = root.querySelectorAll('*').length;
    runFrames(app, 200, 100);
    expect(root.querySelectorAll('*').length).toBe(nodes);
  }, 15_000);
});

describe('HUD 구독 배지', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    localStorage.clear();
  });

  it('Free는 WALL 배지를 숨긴다', () => {
    new PitwallApp(root, { seed: 1, preset: 'sparse', speed: 1 });
    const el = root.querySelector('.wall-status') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('유효 라이선스는 WALL · ACTIVE', () => {
    const app = new PitwallApp(root, {
      seed: 1, preset: 'sparse', speed: 1,
      license: {
        orgId: 'org-1', wallId: 'wall-1',
        validUntil: Date.now() + 86_400_000,
        maxCars: 40, minTeamSize: 10,
      },
    });
    app.start();
    app.frame(1_000);
    const el = root.querySelector('.wall-status') as HTMLElement;
    expect(el.style.display).toBe('');
    expect(el.textContent).toBe('WALL · ACTIVE');
  });

  it('만료 라이선스는 WALL · EXPIRED', () => {
    const app = new PitwallApp(root, {
      seed: 1, preset: 'sparse', speed: 1,
      license: {
        orgId: 'org-1', wallId: 'wall-1',
        validUntil: Date.now() - 1,
        maxCars: 40, minTeamSize: 10,
      },
    });
    app.start();
    app.frame(1_000);
    expect(root.querySelector('.wall-status')!.textContent).toBe('WALL · EXPIRED');
  });

  it('만료면 트랙에도 차를 그리지 않는다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0001);
    const app = new PitwallApp(root, {
      seed: 2026, preset: 'busy', speed: 100,
      license: {
        orgId: 'org-1', wallId: 'wall-1',
        validUntil: Date.now() - 1,
        maxCars: 40, minTeamSize: 10,
      },
    });
    app.start();
    for (let i = 1; i <= 30; i++) app.frame(i * 100);
    expect(app.state.cars.size).toBeGreaterThan(0);
    const visible = [...root.querySelectorAll('g.car, g.cold')]
      .filter((n) => (n as HTMLElement).style.opacity !== '0');
    expect(visible).toHaveLength(0);
    expect(root.querySelector('.tower-aggregate')!.textContent)
      .toBe('구독 만료 — 조직 차량을 표시하지 않음');
  });
});
