import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SettingsPanel } from '../src/render/settingsPanel';
import {
  resolveSettings, clampSettings, loadLocalSettings, saveLocalSettings, loadOrgSettings,
  DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, ORG_SETTINGS_URL,
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

  it('pricingOverride 섹션은 PitwallSettings로 새지 않는다 — sane이 무시한다', () => {
    const out = resolveSettings(
      { pricingOverride: { models: { 'claude-opus-5': { input_cost_per_million_tokens: 9 } } } },
      { speed: 100 },
      {},
    );
    expect(out).not.toHaveProperty('pricingOverride');
    expect(out.speed).toBe(100);
    expect(out).toEqual({ ...DEFAULT_SETTINGS, speed: 100 });
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
  it('기록을 재생 중이면 데모 모드를 감춘다 — 실제 시계를 쓰므로 효과가 없다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: false });
    expect(host.textContent).not.toContain('데모 모드');
  });

  it('시뮬레이터면 데모 모드를 보여준다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    expect(host.textContent).toContain('데모 모드');
    const demo = host.querySelector('[data-setting="demoClock"]')!.parentElement!;
    expect(demo.getAttribute('title')).toContain('밤에도 레이스가 도는 것처럼 시각을 지어낸다');
    expect(demo.getAttribute('title')).toContain('실제 벽시계');
    expect(demo.getAttribute('title')).toContain('HUD의 DEMO 배지');
  });

  it('프리셋은 한국어 제목을 보여주고 값은 id를 유지한다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    const options = [...host.querySelectorAll<HTMLSelectElement>('[data-setting="preset"] option')];
    expect(options.map((option) => [option.value, option.textContent])).toEqual([
      ['busy', '붐비는 날'],
      ['sparse', '한산한 날'],
      ['chaos', '대혼란'],
      ['real', '실측'],
    ]);
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

  it('버튼이 본문과 열린 상태를 ARIA로 연결하고 외부 닫힘도 따라간다', async () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    const shell = host.querySelector<HTMLElement>('.settings');
    const toggle = host.querySelector<HTMLButtonElement>('.settings-toggle');
    const body = host.querySelector<HTMLElement>('.settings-body');
    if (!shell || !toggle || !body) throw new Error('설정 토글 구조를 찾지 못했다');

    expect(body.id).toBe('settings-body');
    expect(toggle.getAttribute('aria-controls')).toBe(body.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    shell.setAttribute('data-open', 'true');
    await Promise.resolve();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    shell.setAttribute('data-open', 'false');
    await Promise.resolve();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape는 설정을 닫고 토글로 포커스를 돌린다', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    const shell = host.querySelector<HTMLElement>('.settings');
    const toggle = host.querySelector<HTMLButtonElement>('.settings-toggle');
    if (!shell || !toggle) throw new Error('설정 토글 구조를 찾지 못했다');

    toggle.focus();
    toggle.click();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(shell.getAttribute('data-open')).toBe('false');
    expect(document.activeElement).toBe(toggle);
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

/*
 * Task 5 — 범례와 설정은 서로 배타적으로 열린다. `onOpen`은 열릴 때만 불러
 * main.ts가 상대 패널의 `data-open`을 닫는 신호로 쓴다. 패널 매니저를 새로
 * 만들지 않고 기존 콜백 패턴(onChange, onNamesChange)에 하나를 더한다.
 */
describe('설정 패널은 열릴 때만 onOpen을 부른다 (Task 5)', () => {
  it('토글로 열 때 한 번, 닫을 때는 부르지 않는다', () => {
    const host = document.createElement('div');
    const onOpen = vi.fn();
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true, onOpen });
    const toggle = host.querySelector('.settings-toggle') as HTMLElement;

    toggle.click();
    expect(onOpen).toHaveBeenCalledTimes(1);

    toggle.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('onOpen이 없어도 토글은 그대로 동작한다', () => {
    const host = document.createElement('div');
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true });
    const shell = host.querySelector('.settings')!;
    const toggle = host.querySelector('.settings-toggle') as HTMLElement;
    toggle.click();
    expect(shell.getAttribute('data-open')).toBe('true');
  });
});

/*
 * 프로덕션 빌드(`npm run build && npm run preview`)를 열 때마다
 * `GET /pitwall.settings.json 404`가 콘솔에 남았다 — 조직 파일은 원래 없어도 되는
 * 물건이지만(loadOrgSettings), Vite가 그 이름의 정적 자산을 한 번도 심은 적이
 * 없어 매번 없는 것을 물으러 갔다. `public/`은 Vite가 그대로 dist 루트에
 * 복사하는 기존 빌드 경로라, 중립적인 빈 객체 파일을 거기 둬서 요청이 항상
 * 성공하게 만든다 — org/local 병합 결과는 그대로 기본값이라 폴백 의미는 안 바뀐다.
 */
describe('조직 설정 파일이 빌드 산출물 루트에 실제로 존재한다 (프로덕션 404 회귀)', () => {
  const path = resolve(import.meta.dirname, '../public', ORG_SETTINGS_URL.replace(/^\.\//, ''));

  it('public/ 아래 ORG_SETTINGS_URL과 같은 이름의 정적 파일이 있다 — Vite가 dist 루트로 그대로 복사한다', () => {
    expect(existsSync(path)).toBe(true);
  });

  it('그 파일은 유효한 JSON 객체이고, 병합해도 기본값을 바꾸지 않는다 — 폴백 의미 보존', () => {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
    expect(resolveSettings(parsed as Record<string, unknown>, {}, {})).toEqual(DEFAULT_SETTINGS);
  });
});
