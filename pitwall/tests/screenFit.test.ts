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

/*
 * 375px 실측(scrollWidth 138 vs clientWidth 77)에서 한도 창·소진 속도가 잘렸다.
 * 원인은 4번째 칸(money)이 5.5rem 고정폭이라 state·limit과 나눠 쓰던 1fr 칸이
 * 더 좁아진 것 — `ruleBody`는 최상위(들여쓰기 없는) 줄만 찾으므로, `@media` 안의
 * 2스페이스 들여쓴 규칙을 읽는 전용 헬퍼가 필요하다.
 */
function mediaBlock(query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`@media ${escaped} \\{\\n([\\s\\S]*?)\\n\\}\\n`).exec(css);
  if (!m) throw new Error(`미디어 쿼리를 찾지 못했다: ${query}`);
  return m[1]!;
}

function ruleBodyIn(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(block);
  if (!m) throw new Error(`규칙을 찾지 못했다: ${selector}`);
  return m[1]!;
}

describe('375px 모바일 타워 줄에서 필수 사실이 잘리지 않는다 (블로커 A 회귀)', () => {
  const mobile = mediaBlock('(max-width: 480px)');
  const rowSelector = '.tower-row, .tower[data-dense="true"] .tower-row';
  const mobileRow = ruleBodyIn(mobile, rowSelector);

  it('money 전용 고정폭 칸이 없다 — bar·num·유연칸(1fr) 세 칸뿐이다', () => {
    const cols = tracks(decl(mobileRow, 'grid-template-columns'));
    expect(cols).toHaveLength(3);
    expect(cols[2]).toContain('1fr');
  });

  it('state·limit·money가 유연칸 안에서 서로 다른 줄에 놓인다 — 한 줄을 나눠 쓰지 않는다', () => {
    const areas = decl(mobileRow, 'grid-template-areas');
    const moneyRow = /"bar num money"/.exec(areas);
    expect(moneyRow, areas).not.toBeNull();
    // money가 state·limit과 같은 줄 문자열에 함께 있으면 다시 좁아진다.
    expect(areas).not.toMatch(/"bar num (state|limit) money"/);
  });

  it('행 높이가 고정이 아니다 — 세 줄 내용이 고정 높이에 눌려 잘리지 않는다', () => {
    expect(decl(mobileRow, 'height')).toBe('auto');
  });

  it('.tower-model·.tower-spark 숨김 규칙이 후순위 프로바이더 칩 규칙(694번째 줄 부근, 특이도 동률)을 이긴다', () => {
    // `.tower-model`만으로는 파일 뒤쪽 `.tower-model{display:flex}`(특이도 동률, 소스 순서 뒤)에 진다.
    // 자손 결합자로 특이도를 하나 올린 선택자를 써야 실제로 숨는다 — 실측(computed display:flex) 확인.
    const hideRuleSelectorPattern = /^\s*\.tower-row \.tower-model,\s*\.tower-row \.tower-spark\s*\{([^}]*)\}/m;
    const m = hideRuleSelectorPattern.exec(mobile);
    expect(m, mobile).not.toBeNull();
    expect(decl(m![1]!, 'display')).toBe('none');
  });

  it('.tower-money가 넘쳐도 잘리지 않는다 — overflow:visible로 조용한 clipping을 막는다', () => {
    const moneyBody = ruleBodyIn(mobile, '.tower-money');
    expect(decl(moneyBody, 'overflow')).toBe('visible');
  });
});

describe('.live-status는 필수 사실이라 축소·말줄임 대상이 아니다 (G001)', () => {
  it('flex-shrink가 0이다 — 다른 hud-item과 같은 비축소 계약을 공유한다', () => {
    expect(decl(ruleBody('.live-status'), 'flex-shrink')).toBe('0');
  });
});

describe('밀집 타워의 카넘버 칸이 세 자리 수를 실제로 담는다 (Task 4)', () => {
  // .tower-row 주석의 실측 근거와 같다: 등폭 폰트 자간 0.6em × 세 자리.
  const MONO_DIGIT_ADVANCE_EM = 0.6;

  it('밀집 카넘버 칸 폭이 세 자리 수 최소 폭(폰트 크기 × 0.6em × 3) 이상이다', () => {
    const denseBody = ruleBody('.tower[data-dense="true"] .tower-row');
    const numberCol = tracks(decl(denseBody, 'grid-template-columns'))[1]!;
    const fontSizeRem = rem(decl(ruleBody('.tower-number'), 'font-size'));
    const need = 3 * MONO_DIGIT_ADVANCE_EM * fontSizeRem;
    expect(rem(numberCol)).toBeGreaterThanOrEqual(need);
  });

  it('.tower-number는 넘치면 잘림 대신 말줄임을 보인다 — 조용한 truncation 금지', () => {
    const body = ruleBody('.tower-number');
    expect(decl(body, 'white-space')).toBe('nowrap');
    expect(decl(body, 'text-overflow')).toBe('ellipsis');
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

describe('설정·범례 패널은 화면에 고정되고 뷰포트를 넘지 않는다 (Task 5)', () => {
  // 두 셀렉터가 한 규칙을 공유한다 — CSS 원문 그대로 붙여 써야 ruleBody가 찾는다.
  const sharedBody = ruleBody('.legend-body, .settings-body');

  it('둘 다 화면에 고정되고 오른쪽 여백이 rem 단위다 — px면 확대 시 어긋난다', () => {
    expect(decl(sharedBody, 'position')).toBe('fixed');
    expect(decl(sharedBody, 'right')).toMatch(/rem$/);
  });

  it('둘 다 max-width로 뷰포트 폭 안에 묶인다 — 좁은 화면에서 잘리지 않는다', () => {
    expect(decl(sharedBody, 'max-width')).toContain('100vw');
  });

  /*
   * Task 6 회귀: box-sizing이 content-box(기본값)면 max-width가 패딩·테두리를
   * 뺀 content만 잡아, 실제 border-box 폭이 max-width를 넘어선다. 375px 실측에서
   * `.legend-body`가 x=-18.765로 새어 `.settings-toggle`을 덮었다 — 클릭이 막힌
   * 원인이었다. border-box라면 `left = 100vw - right - min(width, maxWidthSub)`이고,
   * `maxWidthSub`(calc의 뺄셈 항)가 `right`보다 크거나 같은 한 뷰포트 폭과 무관하게
   * left는 항상 0 이상이다 — 실제 픽셀을 몰라도 대수적으로 증명된다.
   */
  it('border-box라서 max-width가 패딩·테두리까지 포함해 왼쪽 끝이 음수가 될 수 없다 (Task 6)', () => {
    expect(decl(sharedBody, 'box-sizing')).toBe('border-box');

    const rightRem = rem(decl(sharedBody, 'right'));
    const maxWidth = decl(sharedBody, 'max-width');
    const subtrahendMatch = /100vw\s*-\s*([\d.]+)rem/.exec(maxWidth);
    if (!subtrahendMatch) throw new Error(`max-width 형태를 못 읽었다: ${maxWidth}`);
    const maxWidthSubtrahendRem = Number(subtrahendMatch[1]);

    // right <= subtrahend  ⇔  left = subtrahend - right >= 0, 어떤 뷰포트 폭에서도.
    expect(rightRem).toBeLessThanOrEqual(maxWidthSubtrahendRem);
  });

  it('901px 이상에서는 방송 포커스 카드 아래에서 연다', () => {
    const desktop = mediaBlock('(min-width: 901px)');
    const desktopBody = ruleBodyIn(desktop, '.legend-body, .settings-body');
    expect(rem(decl(desktopBody, 'top'))).toBeGreaterThan(rem(decl(sharedBody, 'top')));
  });
});

describe('설정·범례 토글은 텍스트와 장식 아이콘을 함께 보인다', () => {
  it('기존 로컬 레이더·공구 자산만 CSS 마스크로 쓴다', () => {
    expect(decl(ruleBody('.legend-toggle::before'), 'mask')).toContain('../assets/broadcast/radar.svg');
    expect(decl(ruleBody('.settings-toggle::before'), 'mask')).toContain('../assets/f1/tabler/tool.svg');
    expect(decl(ruleBody('.legend-toggle::before'), '-webkit-mask')).toContain('../assets/broadcast/radar.svg');
    expect(decl(ruleBody('.settings-toggle::before'), '-webkit-mask')).toContain('../assets/f1/tabler/tool.svg');
    expect(decl(ruleBody('.legend-body dt[data-sample="class-gt"]::before'), 'background')).toBe('var(--pw-class-gt)');
  });
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
