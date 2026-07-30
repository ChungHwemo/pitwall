import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SummaryRenderer } from '../src/render/summaryRenderer';
import { SettingsPanel } from '../src/render/settingsPanel';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../src/config/settings';
import { summarise } from '../src/state/summary';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, car_class: 'P', activity: 'running',
    distance: 1000, cached: 0, fuel_pct: 80, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 3, call_count: 10,
    ...over,
  };
}

function state(cars: CarState[], phase: RaceState['phase']): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), phase, elapsed_ms: 0, now: T };
}

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('SummaryRenderer', () => {
  it('레이스 중에는 숨어 있다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a')], 'racing'));
    expect(host.querySelector('.summary')!.getAttribute('data-open')).toBe('false');
  });

  it('체커기 이후에 나타난다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a')], 'chequered'));
    expect(host.querySelector('.summary')!.getAttribute('data-open')).toBe('true');
  });

  it('총 토큰과 완주 수를 보여준다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a', { distance: 12_345 }), car('b', { distance: 1 })], 'chequered'));
    expect(host.textContent).toContain('12,346');
    expect(host.textContent).toContain('2');
  });

  it('car_id를 화면에 쓰지 않는다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('secret-user-kim')], 'chequered'));
    expect(host.textContent).not.toContain('secret-user-kim');
  });

  it('반복 렌더에도 노드가 늘지 않는다', () => {
    const r = new SummaryRenderer(host);
    const s = state([car('a')], 'chequered');
    r.render(s);
    const n = host.querySelectorAll('*').length;
    for (let i = 0; i < 50; i++) r.render(s);
    expect(host.querySelectorAll('*').length).toBe(n);
  });

  it('빈 레이스에서도 예외 없이 그린다', () => {
    const r = new SummaryRenderer(host);
    expect(() => r.render(state([], 'chequered'))).not.toThrow();
  });

  it('요약 값은 summarise가 낸 것과 같다', () => {
    const s = state([car('a', { distance: 500 }), car('b', { distance: 700 })], 'chequered');
    const r = new SummaryRenderer(host);
    r.render(s);
    expect(host.textContent).toContain(summarise(s).totalTokens.toLocaleString('ko-KR'));
  });
});

describe('SettingsPanel', () => {
  it('프리셋·배속·하이라이트 컨트롤을 만든다', () => {
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    expect(host.querySelector('[data-setting="preset"]')).not.toBeNull();
    expect(host.querySelector('[data-setting="speed"]')).not.toBeNull();
    expect(host.querySelector('[data-setting="highlight-error"]')).not.toBeNull();
  });

  it('하한이 걸린 값은 노출하지 않는다', () => {
    // 슬라이더를 보여주고 되돌리는 건 안 보여주는 것보다 나쁘다 (PRD §7.0).
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    for (const key of [
      'minTeamSizeForIndividual', 'cameraMinExposureMs', 'cameraReselectCooldownMs',
      'cameraSlotSwapMinIntervalMs', 'radioRepeatSuppressMs', 'laneRenderCap',
    ]) {
      expect(host.querySelector(`[data-setting="${key}"]`), key).toBeNull();
    }
  });

  it('프리셋을 바꾸면 저장하고 알린다', () => {
    const seen: unknown[] = [];
    new SettingsPanel(host, DEFAULT_SETTINGS, (s) => seen.push(s.preset));
    const select = host.querySelector('[data-setting="preset"]') as HTMLSelectElement;
    select.value = 'chaos';
    select.dispatchEvent(new Event('change'));

    expect(seen).toEqual(['chaos']);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).preset).toBe('chaos');
  });

  it('하이라이트를 끄면 목록에서 빠진다', () => {
    let latest = DEFAULT_SETTINGS;
    new SettingsPanel(host, DEFAULT_SETTINGS, (s) => { latest = s; });
    const box = host.querySelector('[data-setting="highlight-error"]') as HTMLInputElement;
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(latest.highlightTypes).not.toContain('error');
  });

  it('설정을 서버로 보내지 않는다', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    const select = host.querySelector('[data-setting="preset"]') as HTMLSelectElement;
    select.value = 'sparse';
    select.dispatchEvent(new Event('change'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
