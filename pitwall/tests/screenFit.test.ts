import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PitwallApp } from '../src/main';
import { DatasetPicker } from '../src/render/datasetPicker';
import type { Dataset } from '../src/config/datasets';
import { contrastRatio, BACKGROUND } from '../src/config/theme';
import { resolveSettings, DEFAULT_SETTINGS } from '../src/config/settings';

/**
 * 화면 밖으로 밀려나는 것들.
 *
 * 이 저장소가 겪은 레이아웃 버그는 전부 산수였다 — 8시간이 9시간이었고, 4K에서
 * 2056px가 비었고, 타워 줄이 자기 칸보다 넓어 금액이 잘렸다. 브라우저 없이도
 * 셀 수 있는 것은 세어서 막는다. jsdom은 폭을 계산하지 않으므로 CSS 선언을
 * 직접 읽는다.
 */
/*
 * 경로는 `import.meta.dirname`으로 잡는다 — `fixtures.test.ts`와 같은 방법이다.
 * `new URL(..., import.meta.url)`은 vitest에서 `http://` 스킴이라 `readFileSync`가
 * "The URL must be of scheme file"로 거부한다. 모듈 URL은 파일 경로가 아니다.
 *
 * 주석을 먼저 걷어낸다. 선언 사이에 주석이 끼면 `;` 다음이 곧 다음 선언이 아니다.
 */
const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

/** 셀렉터로 시작하는 규칙 블록의 선언부. 중첩이 없는 파일이라 이걸로 충분하다. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!m) throw new Error(`규칙을 찾지 못했다: ${selector}`);
  return m[1]!;
}

function decl(body: string, prop: string): string {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:([^;]*)`).exec(body);
  if (!m) throw new Error(`선언을 찾지 못했다: ${prop}`);
  return m[1]!.trim();
}

/** 최상위 공백으로만 자른다 — `minmax(0, 1fr)` 안의 공백은 칸 구분이 아니다. */
function tracks(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function rem(value: string): number {
  const m = /^([\d.]+)rem$/.exec(value);
  return m ? Number(m[1]) : 0;
}

/** 줄 하나가 실제로 요구하는 폭. 유연한 칸(minmax(0, 1fr))은 0으로 친다. */
function rowMinRem(gridValue: string, gapRem: number, padRightRem: number): number {
  const cols = tracks(gridValue);
  const fixed = cols.reduce((sum, c) => sum + rem(c), 0);
  return fixed + gapRem * (cols.length - 1) + padRightRem;
}

const TOWER_MIN = rem(decl(ruleBody(':root'), '--tower-min'));
const rowBody = ruleBody('.tower-row');
const GAP = rem(decl(rowBody, 'column-gap'));
const PAD_RIGHT = rem(tracks(decl(rowBody, 'padding'))[1] ?? '0rem');

describe('타워 줄은 자기 칸 안에 들어간다', () => {
  it('--tower-min이 선언되어 있다', () => {
    expect(TOWER_MIN).toBeGreaterThan(0);
  });

  it('왼쪽 칸의 하한이 --tower-min이다 — 숫자를 두 군데 적으면 한쪽만 바뀐다', () => {
    const first = tracks(decl(ruleBody('.pitwall'), 'grid-template-columns'))[0];
    expect(first).toContain('var(--tower-min)');
  });

  it('2단 줄이 하한 안에 들어간다', () => {
    // 고정 칸 31.4 + 갭 3 + 패딩 0.65 = 35.05rem. 넘으면 오른쪽 끝(금액)이 잘린다.
    const need = rowMinRem(decl(rowBody, 'grid-template-columns'), GAP, PAD_RIGHT);
    expect(need).toBeLessThanOrEqual(TOWER_MIN);
  });

  it('접힌 1단 줄도 하한 안에 들어간다', () => {
    const dense = ruleBody('.tower[data-dense="true"] .tower-row');
    const need = rowMinRem(decl(dense, 'grid-template-columns'), GAP, PAD_RIGHT);
    expect(need).toBeLessThanOrEqual(TOWER_MIN);
  });
});

const SETS: Dataset[] = [
  { id: 'real', label: '실기록', synthetic: false, events: [] },
  { id: 'demo', label: '데모', synthetic: true, events: [] },
];

describe('상단 바가 넘칠 때 무엇이 먼저 사라지는가', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    localStorage.clear();
  });

   it('데이터셋 칸이 설정보다 앞에 온다', () => {
     // 상단 바는 nowrap + overflow hidden이다. `.settings`만 줄어들 수 있으므로
     // 그 뒤에 붙은 것이 화면 밖으로 먼저 밀린다 — 지어낸 데이터라는 사실이
     // 조작판보다 먼저 사라지면 안 된다.
     const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.mountDatasetPicker((host) => { new DatasetPicker(host, SETS, 'demo', () => {}); });

    const hud = root.querySelector('.hud')!;
    const order = [...hud.querySelectorAll('.dataset, .settings')]
      .map((n) => (n.classList.contains('dataset') ? 'dataset' : 'settings'));
    expect(order).toEqual(['dataset', 'settings']);
  });

   it('지어낸 데이터 배지가 상단 바 안에 실제로 붙는다', () => {
     const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.mountDatasetPicker((host) => { new DatasetPicker(host, SETS, 'demo', () => {}); });
    expect(root.querySelector('.hud .dataset-warn')?.textContent).toBe('지어낸 데이터');
  });
});

describe('마우스 없이 계정을 고를 수 있다', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    localStorage.clear();
  });

  /**
   * 트랙 글리프도 클릭 전용이라, 타워 줄이 막히면 이 화면의 유일한 조작에
   * 키보드로 도달할 방법이 없다.
   */
   it('타워 줄이 버튼 역할과 탭 순서를 갖는다', () => {
     new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    const rows = [...root.querySelectorAll('.tower-row')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.getAttribute('role')).toBe('button');
      expect((row as HTMLElement).tabIndex).toBe(0);
    }
  });

  afterEach(() => vi.restoreAllMocks());

  it('Enter와 Space가 클릭과 같은 일을 한다', () => {
    // 시뮬레이터가 이벤트를 확실히 뱉게 한다 — integration.test.ts와 같은 방법.
    vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 100 });
    app.start();
    for (let i = 1; i <= 40; i++) app.frame(i * 100);

    const row = root.querySelector('.tower-row[data-state]') as HTMLElement | null;
    expect(row, '차량이 하나도 안 올라왔다').not.toBeNull();

    row!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    app.frame(4200);
    expect(row!.getAttribute('data-selected')).toBe('true');
    expect(row!.getAttribute('aria-pressed')).toBe('true');

    row!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    app.frame(4300);
    expect(row!.getAttribute('data-selected')).toBe('false');
  });

   it('Space는 기본 동작(스크롤)을 막는다 — 상시 화면이 튀면 그게 고장이다', () => {
     new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    const row = root.querySelector('.tower-row')!;
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    row.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('정보를 나르는 색은 배경에서 보인다', () => {
  /** CSS에서 색을 읽는다 — 값을 테스트에 옮겨 적으면 한쪽만 바뀐다. */
  function colorOf(selector: string): string {
    const value = decl(ruleBody(selector), 'color');
    const m = /#[0-9a-fA-F]{6}/.exec(value);
    if (!m) throw new Error(`색을 못 읽었다: ${selector} → ${value}`);
    return m[0];
  }

  /*
   * `theme.test.ts`의 대비 검사는 `theme.ts` 상수만 본다. 화면 색의 대부분은
   * CSS에 있고 그쪽은 아무도 안 봤다 — 유휴 스파크라인이 1.91:1로 사실상
   * 사라진 채 통과해 온 이유다.
   */
  const CASES: [string, string, number][] = [
    // 비텍스트 그래픽·보조 텍스트 하한 3:1
    ['.tower-row[data-state="idle"] .tower-spark', '유휴 스파크라인', 3],
    // 본문급으로 읽어야 하는 것 4.5:1
    ['.tower-limit-text', '한도 잔여·리셋', 4.5],
    ['.feed-empty', '빈 피드 안내', 4.5],
  ];

  for (const [selector, label, min] of CASES) {
    it(`${label}이 ${min}:1 이상이다`, () => {
      expect(contrastRatio(colorOf(selector), BACKGROUND)).toBeGreaterThanOrEqual(min);
    });
  }
});

describe('망가진 저장 설정이 화면을 죽이지 않는다', () => {
  /*
   * `speed`는 스파크라인 창·소진 속도·유휴 판정의 분모다. 문자열이나 NaN이
   * 들어오면 화면 전체가 조용히 빈칸이 되고 어디가 고장인지도 안 보인다.
   */
  it('형이 다른 값은 기본값으로 되돌린다', () => {
    const broken = { speed: 'fast', cameraSlots: Number.NaN, highlightTypes: {}, motion: 'yes' };
    const out = resolveSettings({}, broken, {});
    expect(out.speed).toBe(DEFAULT_SETTINGS.speed);
    expect(Number.isFinite(out.cameraSlots)).toBe(true);
    expect(Array.isArray(out.highlightTypes)).toBe(true);
    expect(typeof out.motion).toBe('boolean');
  });

   it('멀쩡한 값은 그대로 통과한다', () => {
     expect(resolveSettings({}, { speed: 100, demoClock: false }, {}).speed).toBe(100);
    expect(resolveSettings({}, { demoClock: false }, {}).demoClock).toBe(false);
  });
});
