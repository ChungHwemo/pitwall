import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SummaryRenderer } from '../src/render/summaryRenderer';
import { SettingsPanel } from '../src/render/settingsPanel';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../src/config/settings';
import { CAR_NAMES_STORAGE_KEY } from '../src/config/carNames';
import { summarise } from '../src/state/summary';
import type { CarState, RaceState } from '../src/types';

const T = 1_000_000;

function car(id: string, over: Partial<CarState> = {}): CarState {
  return {
    car_id: id, car_number: 7, model: 'claude-sonnet-5', car_class: 'P', activity: 'running',
    distance: 1000, cached: 0, fuel_pct: 80, cost_usd: 1,
    last_event_ts: T, error_count: 0, cache_hits: 3, call_count: 10, work_per_min: 0, saved_usd: 0,
    ...over,
  };
}

function state(cars: CarState[], phase: RaceState['phase']): RaceState {
  return { cars: new Map(cars.map((c) => [c.car_id, c])), byModel: new Map(), phase, elapsed_ms: 0, now: T };
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

  it('추론 토큰 줄을 조직 합계로 보여준다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a', { reasoning: 1_200 }), car('b', { reasoning: 800 })], 'chequered'));
    const keys = [...host.querySelectorAll('.summary-key')].map((n) => n.textContent);
    expect(keys).toContain('추론 토큰');
    expect(keys.filter((k) => k !== '시간대별 토큰 강도 — 계정 × 시' && k !== '상위 모델 — 비용순')).toHaveLength(7);
    expect(host.textContent).toContain('2,000 tok');
  });
});

function withModels(
  cars: CarState[],
  byModel: Record<string, { calls: number; work: number; cached: number; cost: number }>,
  phase: RaceState['phase'] = 'chequered',
): RaceState {
  const s = state(cars, phase);
  return { ...s, byModel: new Map(Object.entries(byModel)) };
}

describe('SummaryRenderer — Wrapped식 한 장 요약 (리드 + 상위 모델)', () => {
  it('리드 한 줄이 조직 합계를 포맷한다 — tok·콜·$·캐시%', () => {
    const r = new SummaryRenderer(host);
    r.render(state([
      car('a', { distance: 40_000, cost_usd: 0.2, cache_hits: 6, call_count: 10 }),
      car('b', { distance: 1_097, cost_usd: 0.07, cache_hits: 0, call_count: 0 }),
    ], 'chequered'));
    const lede = host.querySelector('.summary-lede')!.textContent!;
    expect(lede).toContain('41,097 tok');
    expect(lede).toContain('10콜');
    expect(lede).toContain('$0.27');
    expect(lede).toContain('캐시 60%');
    expect(lede.startsWith('오늘 —')).toBe(true);
  });

  it('상위 모델을 비용 내림차순 상위 3개만 보여준다', () => {
    const r = new SummaryRenderer(host);
    r.render(withModels([car('a')], {
      'claude-opus-5': { calls: 5, work: 9_000, cached: 0, cost: 4.5 },
      'gpt-5.5': { calls: 8, work: 20_000, cached: 0, cost: 2.1 },
      'gemini-3.5-flash': { calls: 3, work: 3_000, cached: 0, cost: 0.9 },
      'kimi-k3': { calls: 2, work: 1_000, cached: 0, cost: 0.3 },
    }));
    const names = [...host.querySelectorAll('.summary-model-row')]
      .filter((n) => (n as HTMLElement).style.display !== 'none')
      .map((n) => n.querySelector('.summary-model-name')!.textContent);
    expect(names).toEqual(['claude-opus-5', 'gpt-5.5', 'gemini-3.5-flash']);
    expect(host.querySelector('.summary-models')!.textContent).not.toContain('kimi-k3');
  });

  it('상위 모델 스트립에 car_id·카넘버가 새지 않는다 (익명성)', () => {
    const r = new SummaryRenderer(host);
    r.render(withModels([car('secret-user-lee', { car_number: 314 })], {
      'claude-sonnet-5': { calls: 4, work: 5_000, cached: 0, cost: 1.2 },
    }));
    const strip = host.querySelector('.summary-models')!.textContent!;
    expect(strip).not.toContain('secret-user-lee');
    expect(strip).not.toContain('314');
    expect(strip).toContain('claude-sonnet-5');
  });

  it('byModel이 비면 상위 모델 스트립을 숨긴다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a')], 'chequered'));
    expect((host.querySelector('.summary-models') as HTMLElement).style.display).toBe('none');
  });

  it('상위 모델이 있어도 반복 렌더에 노드가 늘지 않는다', () => {
    const r = new SummaryRenderer(host);
    const s = withModels([car('a')], {
      'claude-opus-5': { calls: 5, work: 9_000, cached: 0, cost: 4.5 },
      'gpt-5.5': { calls: 8, work: 20_000, cached: 0, cost: 2.1 },
    });
    r.render(s);
    const n = host.querySelectorAll('*').length;
    for (let i = 0; i < 50; i++) r.render(s);
    expect(host.querySelectorAll('*').length).toBe(n);
  });

  it('체커기 아니면 카드가 닫혀 있다 — Wrapped 요소를 얹어도 그대로다', () => {
    const r = new SummaryRenderer(host);
    r.render(withModels([car('a')], { 'gpt-5.5': { calls: 1, work: 100, cached: 0, cost: 0.1 } }, 'racing'));
    expect(host.querySelector('.summary')!.getAttribute('data-open')).toBe('false');
  });
});


function hourly(byHour: Record<number, number>): number[] {
  const a = new Array(24).fill(0);
  for (const [h, v] of Object.entries(byHour)) a[Number(h)] = v;
  return a;
}

describe('SummaryRenderer — 기여도 그리드 (계정 × 시간대)', () => {
  it('체커기에서만 계정 행을 그린다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a', { hourly: hourly({ 9: 100 }) })], 'racing'));
    expect(host.querySelectorAll('.contrib-body .contrib-row')).toHaveLength(0);
    r.render(state([car('a', { hourly: hourly({ 9: 100 }) })], 'chequered'));
    expect(host.querySelectorAll('.contrib-body .contrib-row')).toHaveLength(1);
  });

  it('시간대 헤더는 0–23 스물넷이다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a')], 'chequered'));
    const hours = [...host.querySelectorAll('.contrib-hour')].map((n) => n.textContent);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe('0');
    expect(hours[23]).toBe('23');
  });

  it('행은 카넘버 오름차순이다 — 강도로 정렬하지 않는다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([
      car('big', { car_number: 5, hourly: hourly({ 9: 9999 }) }),
      car('small', { car_number: 2, hourly: hourly({ 9: 1 }) }),
    ], 'chequered'));
    const labels = [...host.querySelectorAll('.contrib-body .contrib-acct')].map((n) => n.textContent);
    expect(labels).toEqual(['2', '5']);
  });

  it('계정 라벨은 카넘버뿐이다 — car_id를 쓰지 않는다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('secret-user-park', { car_number: 42, hourly: hourly({ 9: 100 }) })], 'chequered'));
    const grid = host.querySelector('.summary-contrib')!;
    expect(grid.textContent).not.toContain('secret-user-park');
    expect([...grid.querySelectorAll('.contrib-body .contrib-acct')].map((n) => n.textContent)).toEqual(['42']);
  });

  it('강도가 5단 색 인덱스로 매핑된다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a', { hourly: hourly({ 0: 0, 1: 10, 2: 40, 3: 60, 4: 100 }) })], 'chequered'));
    const cells = [...host.querySelectorAll('.contrib-body .contrib-cell')] as HTMLElement[];
    expect(cells[0]!.dataset.step).toBe('0');
    expect(cells[1]!.dataset.step).toBe('1');
    expect(cells[2]!.dataset.step).toBe('2');
    expect(cells[3]!.dataset.step).toBe('3');
    expect(cells[4]!.dataset.step).toBe('4');
  });

  it('작업이 전무하면 모든 칸이 가장 어두운 단이다', () => {
    const r = new SummaryRenderer(host);
    r.render(state([car('a', { hourly: hourly({}) })], 'chequered'));
    const steps = new Set([...host.querySelectorAll('.contrib-body .contrib-cell')].map((n) => (n as HTMLElement).dataset.step));
    expect([...steps]).toEqual(['0']);
  });

  it('hourly가 없는 계정도 예외 없이 그린다', () => {
    const r = new SummaryRenderer(host);
    expect(() => r.render(state([car('a')], 'chequered'))).not.toThrow();
    expect(host.querySelectorAll('.contrib-body .contrib-cell')).toHaveLength(24);
  });

  it('빈 레이스에서도 계정 행이 없다', () => {
    const r = new SummaryRenderer(host);
    expect(() => r.render(state([], 'chequered'))).not.toThrow();
    expect(host.querySelectorAll('.contrib-body .contrib-row')).toHaveLength(0);
  });

  it('그리드가 있어도 반복 렌더에 노드가 늘지 않는다', () => {
    const r = new SummaryRenderer(host);
    const s = state([car('a', { hourly: hourly({ 9: 100 }) }), car('b', { car_number: 3, hourly: hourly({ 10: 50 }) })], 'chequered');
    r.render(s);
    const n = host.querySelectorAll('*').length;
    for (let i = 0; i < 50; i++) r.render(s);
    expect(host.querySelectorAll('*').length).toBe(n);
  });
});

describe('SettingsPanel', () => {
  it('프리셋·배속·하이라이트 컨트롤을 만든다', () => {
    new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    expect(host.querySelector('[data-setting="preset"]')).not.toBeNull();
    expect(host.querySelector('[data-setting="speed"]')).not.toBeNull();
    expect(host.querySelector('[data-setting="highlight-error"]')).not.toBeNull();
  });

  it('1× 실시간 배속을 선택하면 speed 1을 저장한다', () => {
    let latest = DEFAULT_SETTINGS;
    new SettingsPanel(host, DEFAULT_SETTINGS, (settings) => { latest = settings; });
    const select = host.querySelector('[data-setting="speed"]') as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual(['1×', '20×', '30×', '100×']);
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    expect(latest.speed).toBe(1);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).speed).toBe(1);
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

describe('SettingsPanel — 계정 이름 (PRIV-6)', () => {
  const accounts = [
    { car_id: 'car-a', car_number: 17 },
    { car_id: 'car-b', car_number: 2 },
  ];

  it('계정마다 이름 입력 줄을 짓는다', () => {
    const panel = new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    panel.setAccounts(accounts);
    expect(host.querySelector('[data-account="car-a"]')).not.toBeNull();
    expect(host.querySelector('[data-account="car-b"]')).not.toBeNull();
    // 카넘버 오름차순으로 짓는다 — 이름을 붙여도 정렬은 카넘버다.
    const tags = [...host.querySelectorAll('.settings-accounts .settings-label')].map((n) => n.textContent);
    expect(tags).toEqual(['#002', '#017']);
  });

  it('입력하면 pitwall.carNames에 저장하고 onNamesChange를 부른다', () => {
    const changed = vi.fn();
    const panel = new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: true, onNamesChange: changed });
    panel.setAccounts(accounts);
    const input = host.querySelector('[data-account="car-a"]') as HTMLInputElement;
    input.value = '결제팀 배치';
    input.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(CAR_NAMES_STORAGE_KEY)!)).toEqual({ 'car-a': '결제팀 배치' });
    expect(changed).toHaveBeenCalled();
  });

  it('입력을 비우면 이름을 지운다', () => {
    const panel = new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    panel.setAccounts(accounts);
    const input = host.querySelector('[data-account="car-a"]') as HTMLInputElement;
    input.value = '배치';
    input.dispatchEvent(new Event('input'));
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(CAR_NAMES_STORAGE_KEY)!)).toEqual({});
  });

  it('이름을 서버로 보내지 않는다', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const panel = new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    panel.setAccounts(accounts);
    const input = host.querySelector('[data-account="car-a"]') as HTMLInputElement;
    input.value = '배치';
    input.dispatchEvent(new Event('input'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('재생 모드에서도 계정 이름 칸이 뜬다 — 프리셋과 달리 시뮬 전용이 아니다', () => {
    const panel = new SettingsPanel(host, DEFAULT_SETTINGS, () => {}, { simulated: false });
    panel.setAccounts(accounts);
    expect(host.querySelector('[data-account="car-a"]')).not.toBeNull();
    // 재생 모드라 프리셋은 없어야 한다 — 계정 이름과 별개다.
    expect(host.querySelector('[data-setting="preset"]')).toBeNull();
  });

  it('계정 집합이 그대로면 줄을 다시 짓지 않는다', () => {
    const panel = new SettingsPanel(host, DEFAULT_SETTINGS, () => {});
    panel.setAccounts(accounts);
    const first = host.querySelector('[data-account="car-a"]');
    panel.setAccounts([...accounts]);
    expect(host.querySelector('[data-account="car-a"]')).toBe(first);
  });
});
