import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_CHROME_MODE,
  parseChromeMode,
  applyChromeMode,
  chromeModeFromKey,
  chromeModeFromSearch,
  chromeModeLabel,
  isChromeHotkeyBlocked,
} from '../src/config/chromeMode';
import { DEFAULT_SETTINGS, resolveSettings, SETTINGS_STORAGE_KEY } from '../src/config/settings';
import { SettingsPanel } from '../src/render/settingsPanel';
import { PitwallApp } from '../src/main';

describe('parseChromeMode', () => {
  it('1·2·3만 통과하고 나머지는 기본값 1이다', () => {
    expect(parseChromeMode(1)).toBe(1);
    expect(parseChromeMode(2)).toBe(2);
    expect(parseChromeMode(3)).toBe(3);
    expect(parseChromeMode(0)).toBe(DEFAULT_CHROME_MODE);
    expect(parseChromeMode(4)).toBe(DEFAULT_CHROME_MODE);
    expect(parseChromeMode('2')).toBe(DEFAULT_CHROME_MODE);
    expect(parseChromeMode(Number.NaN)).toBe(DEFAULT_CHROME_MODE);
  });
});

describe('applyChromeMode', () => {
  it('루트에 data-chrome-mode와 토스트 문구를 심는다', () => {
    const root = document.createElement('div');
    applyChromeMode(root, 2);
    expect(root.getAttribute('data-chrome-mode')).toBe('2');
    expect(root.querySelector('[data-chrome-toast]')!.textContent).toBe(chromeModeLabel(2));
  });

  it('모드마다 토스트가 다르다', () => {
    const root = document.createElement('div');
    applyChromeMode(root, 1);
    expect(root.querySelector('[data-chrome-toast]')!.textContent).toBe('TOKEN / 01');
    applyChromeMode(root, 2);
    expect(root.querySelector('[data-chrome-toast]')!.textContent).toBe('CLUSTER / 02');
    applyChromeMode(root, 3);
    expect(root.querySelector('[data-chrome-toast]')!.textContent).toBe('WORKSHOP / 03');
  });

  it('비네트는 모드 3에서만 켠다', () => {
    const root = document.createElement('div');
    applyChromeMode(root, 1);
    expect((root.querySelector('[data-chrome-vignette]') as HTMLElement).hidden).toBe(true);
    applyChromeMode(root, 2);
    expect((root.querySelector('[data-chrome-vignette]') as HTMLElement).hidden).toBe(true);
    applyChromeMode(root, 3);
    expect((root.querySelector('[data-chrome-vignette]') as HTMLElement).hidden).toBe(false);
  });
});

describe('chromeModeFromSearch', () => {
  it('chrome=1·2·3만 읽고 나머지는 무시한다', () => {
    expect(chromeModeFromSearch('?chrome=2')).toBe(2);
    expect(chromeModeFromSearch('chrome=3')).toBe(3);
    expect(chromeModeFromSearch('?seed=1')).toBeNull();
    expect(chromeModeFromSearch('?chrome=4')).toBeNull();
  });
});

describe('chromeModeFromKey', () => {
  it('숫자키 1·2·3만 모드로 읽는다', () => {
    expect(chromeModeFromKey('1')).toBe(1);
    expect(chromeModeFromKey('2')).toBe(2);
    expect(chromeModeFromKey('3')).toBe(3);
    expect(chromeModeFromKey('4')).toBeNull();
    expect(chromeModeFromKey('a')).toBeNull();
  });
});

describe('isChromeHotkeyBlocked', () => {
  it('입력창에 포커스가 있으면 핫키를 막는다', () => {
    const input = document.createElement('input');
    const select = document.createElement('select');
    const button = document.createElement('button');
    expect(isChromeHotkeyBlocked(input)).toBe(true);
    expect(isChromeHotkeyBlocked(select)).toBe(true);
    expect(isChromeHotkeyBlocked(button)).toBe(false);
  });
});

describe('설정 병합', () => {
  it('chromeMode 2를 유지하고 4는 1로 되돌린다', () => {
    expect(resolveSettings({}, { chromeMode: 2 }, {}).chromeMode).toBe(2);
    expect(resolveSettings({}, { chromeMode: 4 }, {}).chromeMode).toBe(1);
  });
});

describe('SettingsPanel 크롬 모드', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
    host = document.getElementById('host')!;
    localStorage.clear();
  });

  it('1·2·3 버튼을 만들고 누르면 chromeMode를 저장한다', () => {
    let latest = DEFAULT_SETTINGS;
    new SettingsPanel(host, DEFAULT_SETTINGS, (settings) => { latest = settings; });
    const two = host.querySelector('[data-setting="chromeMode"][data-chrome-choice="2"]') as HTMLButtonElement;
    expect(host.querySelectorAll('[data-setting="chromeMode"]')).toHaveLength(3);
    two.click();
    expect(latest.chromeMode).toBe(2);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).chromeMode).toBe(2);
  });

  it('같은 모드를 다시 눌러도 설정을 다시 알리지 않는다', () => {
    let calls = 0;
    new SettingsPanel(host, DEFAULT_SETTINGS, () => { calls += 1; });
    const one = host.querySelector('[data-setting="chromeMode"][data-chrome-choice="1"]') as HTMLButtonElement;
    one.click();
    one.click();
    expect(calls).toBe(0);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });
});

describe('PitwallApp 크롬 모드', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    localStorage.clear();
  });
  afterEach(() => {
    root.replaceChildren();
  });

  it('기본은 모드 1이고 섹션 키커가 있다', () => {
    new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    const shell = root.querySelector('.pitwall')!;
    expect(shell.getAttribute('data-chrome-mode')).toBe('1');
    expect(shell.querySelector('[data-chrome-kicker="tower"]')!.textContent).toBe('TOWER / 01');
    expect(shell.querySelector('[data-chrome-kicker="track"]')!.textContent).toBe('TRACK / 02');
    expect(shell.querySelector('[data-chrome-kicker="radio"]')!.textContent).toBe('RADIO / 03');
    expect(shell.querySelector('[data-chrome-kicker="broadcast"]')!.textContent).toBe('ONBOARD / 04');
  });

  it('설정 버튼 2·3을 누르면 각 모드가 출력된다', () => {
    new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    const shell = root.querySelector('.pitwall')!;
    const click = (n: 1 | 2 | 3): void => {
      (root.querySelector(`[data-setting="chromeMode"][data-chrome-choice="${n}"]`) as HTMLButtonElement).click();
    };
    click(2);
    expect(shell.getAttribute('data-chrome-mode')).toBe('2');
    expect(shell.querySelector('[data-chrome-toast]')!.textContent).toBe('CLUSTER / 02');
    expect((shell.querySelector('[data-chrome-vignette]') as HTMLElement).hidden).toBe(true);
    click(3);
    expect(shell.getAttribute('data-chrome-mode')).toBe('3');
    expect(shell.querySelector('[data-chrome-toast]')!.textContent).toBe('WORKSHOP / 03');
    expect((shell.querySelector('[data-chrome-vignette]') as HTMLElement).hidden).toBe(false);
    click(1);
    expect(shell.getAttribute('data-chrome-mode')).toBe('1');
    expect(shell.querySelector('[data-chrome-toast]')!.textContent).toBe('TOKEN / 01');
  });

  it('숫자키 1·2·3이 모드를 바꾼다', () => {
    new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    const shell = root.querySelector('.pitwall')!;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    expect(shell.getAttribute('data-chrome-mode')).toBe('2');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    expect(shell.getAttribute('data-chrome-mode')).toBe('3');
  });

  it('수정키·반복키·정지 후에는 숫자키가 모드를 바꾸지 않는다', () => {
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    const shell = root.querySelector('.pitwall')!;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', metaKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', repeat: true, bubbles: true }));
    expect(shell.getAttribute('data-chrome-mode')).toBe('1');
    app.stop();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    expect(shell.getAttribute('data-chrome-mode')).toBe('1');
  });

  it('?chrome= 미리보기는 다른 설정을 저장해도 기록에 남지 않는다', () => {
    new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20, chromePreview: 3 });
    const shell = root.querySelector('.pitwall')!;
    expect(shell.getAttribute('data-chrome-mode')).toBe('3');
    expect(shell.querySelector('[data-chrome-readout]')!.textContent).toBe('WORKSHOP / 03');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    const speed = root.querySelector('[data-setting="speed"]') as HTMLSelectElement;
    speed.value = '1';
    speed.dispatchEvent(new Event('change'));
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).chromeMode).toBe(1);
    expect(shell.getAttribute('data-chrome-mode')).toBe('3');
  });

  it('이름 입력 중에는 숫자키가 모드를 바꾸지 않는다', () => {
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.frame(1_000);
    const input = root.querySelector('input[data-account]') as HTMLInputElement | null;
    const shell = root.querySelector('.pitwall')!;
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      expect(shell.getAttribute('data-chrome-mode')).toBe('1');
    } else {
      const fake = document.createElement('input');
      root.appendChild(fake);
      fake.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      expect(shell.getAttribute('data-chrome-mode')).toBe('1');
    }
  });
});
