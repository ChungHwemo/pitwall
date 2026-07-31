import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SettingsPanel } from '../src/render/settingsPanel';
import {
  resolveSettings, clampSettings, loadLocalSettings, saveLocalSettings, loadOrgSettings,
  DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY,
} from '../src/config/settings';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('resolveSettings', () => {
  it('아무것도 없으면 내장 기본값이다', () => {
    expect(resolveSettings({}, {}, {})).toEqual(DEFAULT_SETTINGS);
  });

  it('조직 기본값이 내장 기본값을 덮는다', () => {
    expect(resolveSettings({ speed: 30 }, {}, {}).speed).toBe(30);
  });

  it('사용자 로컬이 조직 기본값을 덮는다', () => {
    expect(resolveSettings({ speed: 30 }, { speed: 100 }, {}).speed).toBe(100);
  });

  it('세션 설정이 가장 강하다', () => {
    expect(resolveSettings({ speed: 30 }, { speed: 100 }, { speed: 20 }).speed).toBe(20);
  });

  it('부분 설정은 나머지를 덮지 않는다', () => {
    expect(resolveSettings({}, { speed: 100 }, {}).workday).toEqual(DEFAULT_SETTINGS.workday);
  });
});

describe('clampSettings — 하한 강제', () => {
  it('최소 집계 인원은 10 아래로 못 내린다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, minTeamSizeForIndividual: 3 })
      .minTeamSizeForIndividual).toBe(10);
  });

  it('최소 집계 인원 상향은 허용한다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, minTeamSizeForIndividual: 25 })
      .minTeamSizeForIndividual).toBe(25);
  });

  it('카메라 안정화 3값을 전부 하한으로 되돌린다', () => {
    const c = clampSettings({
      ...DEFAULT_SETTINGS,
      cameraMinExposureMs: 0,
      cameraReselectCooldownMs: 0,
      cameraSlotSwapMinIntervalMs: 0,
    });
    expect(c.cameraMinExposureMs).toBe(8_000);
    expect(c.cameraReselectCooldownMs).toBe(60_000);
    expect(c.cameraSlotSwapMinIntervalMs).toBe(3_000);
  });

  it('라디오 재발화 억제는 30분 아래로 못 내린다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, radioRepeatSuppressMs: 1000 })
      .radioRepeatSuppressMs).toBe(1_800_000);
  });

  it('레인 렌더 상한은 40 위로 못 올린다 — 방향이 반대다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, laneRenderCap: 200 }).laneRenderCap).toBe(40);
    expect(clampSettings({ ...DEFAULT_SETTINGS, laneRenderCap: 10 }).laneRenderCap).toBe(10);
  });

  it('resolveSettings는 항상 clamp를 거친다', () => {
    expect(resolveSettings({}, { minTeamSizeForIndividual: 2 }, {}).minTeamSizeForIndividual).toBe(10);
  });

  it('레이스 시간은 설정 키가 아니다 — 파생값이다', () => {
    expect(DEFAULT_SETTINGS).not.toHaveProperty('raceDurationMs');
  });
});

describe('조직 기본값', () => {
  it('http가 아니면 조직 파일을 아예 요청하지 않는다', async () => {
    // 단일 파일을 file://로 열었을 때 콘솔 에러를 남기지 않기 위해서다.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('location', { protocol: 'file:' });
    expect(await loadOrgSettings()).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('로컬 저장', () => {
   it('저장한 값을 되읽는다', () => {
     saveLocalSettings({ speed: 30 });
     expect(loadLocalSettings().speed).toBe(30);
   });

  it('깨진 JSON이면 빈 객체다', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{{{');
    expect(loadLocalSettings()).toEqual({});
  });

  it('저장된 값이 없으면 빈 객체다', () => {
    expect(loadLocalSettings()).toEqual({});
  });

   it('설정을 서버로 보내지 않는다', () => {
     const fetchSpy = vi.fn();
     vi.stubGlobal('fetch', fetchSpy);
     saveLocalSettings({ speed: 30 });
     loadLocalSettings();
     expect(fetchSpy).not.toHaveBeenCalled();
   });
});

describe('프리셋 노출', () => {
  it('기록을 재생 중이면 프리셋 칸을 감춘다 — 아무 효과가 없는 조작판이다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: false });
    expect(host.textContent).not.toContain('프리셋');
  });

  it('시뮬레이터일 때는 보여준다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    expect(host.textContent).toContain('프리셋');
  });
});

describe('설명과 노출', () => {
  it('기록을 재생 중이면 DEMO 시계를 감춘다 — 실제 시계를 쓰므로 효과가 없다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: false });
    expect(host.textContent).not.toContain('DEMO');
  });

  it('시뮬레이터면 DEMO 시계를 보여준다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    expect(host.textContent).toContain('DEMO');
  });

  /*
   * 접혀 있어야 한다. 펼쳐 두면 상단 바가 넘칠 때 `overflow: hidden`이 컨트롤
   * 한가운데를 잘라, 켜졌는지 알 수 없는 체크박스가 남는다.
   */
  it('기본은 접힘이고 버튼으로 연다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    const shell = host.querySelector('.settings')!;
    expect(shell.getAttribute('data-open')).toBe('false');
    (host.querySelector('.settings-toggle') as HTMLElement).click();
    expect(shell.getAttribute('data-open')).toBe('true');
    (host.querySelector('.settings-toggle') as HTMLElement).click();
    expect(shell.getAttribute('data-open')).toBe('false');
  });

  it('기록 재생 중에도 접힌 채로 나온다 — 항목만 줄어든다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: false });
    expect(host.querySelector('.settings')!.getAttribute('data-open')).toBe('false');
    expect(host.querySelector('.settings-toggle')).not.toBeNull();
    expect(host.querySelector('.settings-body')).not.toBeNull();
  });

  it('모든 조작에 설명이 붙는다 — 이름만으로는 뭘 하는지 모른다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    const controls = [...host.querySelectorAll('.settings-field, .settings-check, .settings-group')];
    expect(controls.length).toBeGreaterThan(3);
    for (const c of controls) {
      expect(c.getAttribute('title'), c.textContent ?? '').toBeTruthy();
    }
  });
});
