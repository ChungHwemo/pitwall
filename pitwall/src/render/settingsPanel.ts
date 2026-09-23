import type { PitwallSettings } from '../config/settings';
import { saveLocalSettings } from '../config/settings';
import { chromeModeLabel, type ChromeMode } from '../config/chromeMode';
import { loadCarNames, saveCarNames, CAR_NAME_MAX_LENGTH } from '../config/carNames';
import type { PricingOverride } from '../config/pricingOverride';
import type { PresetName } from '../config/presets';
import type { HighlightType } from '../track/trackModel';

/**
 * 최소 설정 패널.
 *
 * **하한이 걸린 값은 노출하지 않는다.** 슬라이더를 보여주고 런타임이 되돌리는 것은
 * 안 보여주는 것보다 나쁘다 — 사용자는 자기가 바꾼 값이 먹었다고 믿게 된다 (PRD §7.0).
 * 여기 있는 항목은 전부 자유롭게 조정 가능한 것들이다.
 *
 * **접힌다.** 예전에는 조작판이 상단 바에 펼쳐져 있었고, 넘치면 `overflow: hidden`이
 * 잘랐다. 자르는 단위가 항목이 아니라 픽셀이라 실측 1440×900에서 `한도` 체크박스가
 * 파란 조각만 남고 라벨이 사라졌다 — 켜졌는지 꺼졌는지 알 수 없는 컨트롤은
 * 없는 것보다 나쁘다. 범례가 쓰는 방식을 그대로 쓴다: 버튼 하나로 접고, 열면
 * 화면에 고정한 판으로 띄운다. 상시 노출 화면에서 조작판이 늘 떠 있을 이유도 없다.
 */
const PRESETS: { id: PresetName; label: string }[] = [
  { id: 'busy', label: '붐비는 날' },
  { id: 'sparse', label: '한산한 날' },
  { id: 'chaos', label: '대혼란' },
  { id: 'real', label: '실측' },
];
const SPEEDS: { value: PitwallSettings['speed']; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 20, label: '20×' },
  { value: 30, label: '30×' },
  { value: 100, label: '100×' },
];
const HIGHLIGHTS: HighlightType[] = ['error', 'limit'];
const HIGHLIGHT_LABEL: Record<HighlightType, string> = { error: '에러', limit: '한도' };

/**
 * 조작마다 무엇을 하는지 적는다.
 *
 * 이름만으로는 무엇이 바뀌는지 알 수 없다 — "프리셋"도 "하이라이트"도 이 화면
 * 안에서만 통하는 말이다. 효과가 없는 조작을 감추는 것과 같은 이유다: 눌러도
 * 모르겠는 버튼은 고장으로 읽힌다.
 */
const HELP = {
  preset: '시뮬레이터가 만들어낼 이벤트의 밀도. 기록을 재생 중일 때는 나오지 않는다.',
  speed: '재생 속도. 1× = 실제 시간, 20× = 72분에 하루, 30× = 48분에 하루, 100× = 14.4분에 하루.',
  highlight: '어떤 사건을 개별 추적할지. 끄면 그 사건이 나도 차를 세우지 않는다.',
  error: '호출이 실패한 차를 피트로 보낸다.',
  limit: '한도 창이 바닥난 차를 피트로 보낸다.',
  demoClock: '밤에도 레이스가 도는 것처럼 시각을 지어낸다. 끄면 실제 벽시계가 흐른다. '
    + 'HUD의 DEMO 배지는 DATA가 지어낸 것이라는 뜻이며, 이 설정과는 별개다.',
  chromeMode: '화면 크롬. 1 토큰 스킨, 2 클러스터 크롬, 3 워크숍 오버레이. 숫자키 1·2·3도 같다.',
} as const;

const CHROME_CHOICES: { mode: ChromeMode; label: string }[] = [
  { mode: 1, label: '1' },
  { mode: 2, label: '2' },
  { mode: 3, label: '3' },
];

export class SettingsPanel {
  private settings: PitwallSettings;
  private names: Record<string, string> = loadCarNames();
  private onNamesChange: () => void;
  private accountsRows: HTMLElement;
  private chromeRoot: HTMLElement | null = null;
  private onReselect: () => void;
  /** 마지막으로 그린 계정 집합의 지문. 바뀔 때만 줄을 다시 짓는다 */
  private accountsKey = '';

  constructor(
    container: HTMLElement,
    initial: PitwallSettings,
    private onChange: (settings: PitwallSettings) => void,
    /** 시뮬레이터로 돌고 있는가. 기록 재생이면 프리셋 칸이 의미가 없다 */
    opts: {
      simulated: boolean;
      onNamesChange?: () => void;
      /** 적용된 로컬 단가 보정. 있으면 적용 출처·판독 나이를 한 줄로 밝힌다. */
      pricingOverride?: PricingOverride;
      /** 열릴 때만 불린다. main.ts가 이걸로 범례 패널을 닫아 겹침을 막는다. */
      onOpen?: () => void;
      /** 이미 저장된 모드를 다시 눌렀을 때. 저장·재렌더는 하지 않는다. */
      onReselect?: () => void;
    } = { simulated: true },
  ) {
    this.settings = initial;
    this.onNamesChange = opts.onNamesChange ?? ((): void => {});
    this.onReselect = opts.onReselect ?? ((): void => {});

    const shell = document.createElement('div');
    shell.className = 'settings hud-item';
    shell.setAttribute('data-open', 'false');

    const toggle = document.createElement('button');
    toggle.className = 'settings-toggle';
    toggle.type = 'button';
    toggle.textContent = '설정';
    toggle.title = '배속·하이라이트 같은 조작판';
    toggle.setAttribute('aria-controls', 'settings-body');
    toggle.setAttribute('aria-expanded', 'false');
    const setOpen = (open: boolean): void => {
      shell.setAttribute('data-open', String(open));
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => {
      const open = shell.getAttribute('data-open') === 'true';
      setOpen(!open);
      if (!open) opts.onOpen?.();
    });

    const root = document.createElement('div');
    root.className = 'settings-body';
    root.id = 'settings-body';
    new MutationObserver(() => {
      toggle.setAttribute('aria-expanded', String(shell.getAttribute('data-open') === 'true'));
    }).observe(shell, { attributes: true, attributeFilter: ['data-open'] });
    shell.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && shell.getAttribute('data-open') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // 프리셋은 시뮬레이터 전용이다. 기록을 재생 중일 때 띄워두면 아무 효과가
    // 없는 조작판이 되어, 눌러도 안 바뀌는 것을 고장으로 읽게 된다.
    if (opts.simulated) {
      root.appendChild(this.select(
        'preset', '프리셋', HELP.preset, PRESETS.map(({ id, label }) => ({ value: id, label })),
        initial.preset, (v) => {
          this.settings = { ...this.settings, preset: v as PresetName };
        },
      ));
    }

    root.appendChild(this.select(
      'speed', '배속', HELP.speed, SPEEDS.map(({ value, label }) => ({ value: String(value), label })),
      String(initial.speed), (v) => {
        this.settings = { ...this.settings, speed: Number(v) as PitwallSettings['speed'] };
      },
    ));

    const chromeSwitch = this.chromeModeGroup(initial.chromeMode);

    const group = document.createElement('div');
    group.className = 'settings-group';
    group.title = HELP.highlight;
    const groupLabel = document.createElement('span');
    groupLabel.className = 'settings-label';
    groupLabel.textContent = '하이라이트';
    group.appendChild(groupLabel);

    for (const type of HIGHLIGHTS) {
      const label = document.createElement('label');
      label.className = 'settings-check';
      label.title = HELP[type];

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('data-setting', `highlight-${type}`);
      box.checked = initial.highlightTypes.includes(type);
      box.addEventListener('change', () => {
        const on = new Set(this.settings.highlightTypes);
        if (box.checked) on.add(type); else on.delete(type);
        this.settings = { ...this.settings, highlightTypes: [...on] };
        this.commit();
      });

      const text = document.createElement('span');
      text.textContent = HIGHLIGHT_LABEL[type];
      label.append(box, text);
      group.appendChild(label);
    }
    root.appendChild(group);

    // 계정 이름 칸은 시뮬레이터·재생 양쪽에서 다 쓴다 — 프리셋·데모시계와 달리
    // 재생 모드에서도 화면에 계정이 뜨므로, DEMO 시계 조기 반환보다 앞에 짓는다.
    const accounts = document.createElement('div');
    accounts.className = 'settings-group';
    accounts.title = '화면에 보이는 계정에 이름을 붙인다. 비우면 카넘버로 표시된다. '
      + '이 기기에만 저장된다 (PRIV-6).';
    const accountsLabel = document.createElement('span');
    accountsLabel.className = 'settings-label';
    accountsLabel.textContent = '계정 이름';
    this.accountsRows = document.createElement('div');
    this.accountsRows.className = 'settings-accounts';
    accounts.append(accountsLabel, this.accountsRows);
    root.appendChild(accounts);

    // 로컬 단가 보정이 적용됐으면 어디서 왔는지·언제 읽었는지 한 줄로 밝힌다.
    // 검증된 카탈로그 숫자와 조용히 섞지 않는다 — 출처 정직성 (P3, 새 HUD 줄은 안 만든다).
    const provenance = this.pricingProvenance(opts.pricingOverride);
    if (provenance) root.appendChild(provenance);

    // DEMO 시계도 시뮬레이터 전용이다. 기록 재생과 실시간에는 진짜 시계가 있어
    // 이 체크박스가 아무것도 바꾸지 않는다 — 눌러도 반응이 없으면 고장으로 읽힌다.
    if (!opts.simulated) {
      shell.append(chromeSwitch, toggle, root);
      container.appendChild(shell);
      return;
    }

    const demo = document.createElement('label');
    demo.className = 'settings-check';
    demo.title = HELP.demoClock;
    const demoBox = document.createElement('input');
    demoBox.type = 'checkbox';
    demoBox.setAttribute('data-setting', 'demoClock');
    demoBox.checked = initial.demoClock;
    demoBox.addEventListener('change', () => {
      this.settings = { ...this.settings, demoClock: demoBox.checked };
      this.commit();
    });
    const demoText = document.createElement('span');
    demoText.textContent = '데모 모드';
    demo.append(demoBox, demoText);
    root.appendChild(demo);

    shell.append(chromeSwitch, toggle, root);
    container.appendChild(shell);
  }

  /**
   * 화면에 뜬 계정마다 이름 입력 줄을 짓는다. 렌더 루프가 매 프레임 부르므로
   * 계정 집합이 실제로 바뀔 때만 DOM을 다시 짓는다 — 지문을 비교해 거른다.
   */
  setAccounts(cars: { car_id: string; car_number: number }[]): void {
    const sorted = [...cars].sort((a, b) => a.car_number - b.car_number);
    const key = sorted.map((c) => c.car_id).join('|');
    if (key === this.accountsKey) return;
    this.accountsKey = key;

    this.accountsRows.replaceChildren();
    for (const { car_id, car_number } of sorted) {
      const row = document.createElement('label');
      row.className = 'settings-field';

      const tag = document.createElement('span');
      tag.className = 'settings-label';
      tag.textContent = `#${String(car_number).padStart(3, '0')}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = CAR_NAME_MAX_LENGTH;
      input.placeholder = '카넘버 표시';
      input.setAttribute('data-account', car_id);
      input.value = this.names[car_id] ?? '';
      input.addEventListener('input', () => {
        const value = input.value.trim();
        if (value === '') delete this.names[car_id];
        else this.names[car_id] = value;
        saveCarNames(this.names);
        this.onNamesChange();
      });

      row.append(tag, input);
      this.accountsRows.appendChild(row);
    }
  }

  /**
   * 적용된 단가 보정을 `단가 보정: 로컬 · HH:mm`으로 밝힌다. 보정이 없으면(내장
   * 카탈로그) null이라 아무것도 그리지 않는다. HH:mm은 보정을 읽은 시각이다.
   */
  private pricingProvenance(override: PricingOverride | undefined): HTMLElement | null {
    if (!override || override.entries.size === 0 || override.readAt === null) return null;

    const label = override.source === 'org' ? '조직' : '로컬';
    const at = new Date(override.readAt);
    const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

    const line = document.createElement('div');
    line.className = 'settings-provenance';
    line.setAttribute('data-pricing-override', override.source);
    line.title = `모델 ${override.entries.size}종의 단가를 로컬 보정으로 덮었다. `
      + '검증된 카탈로그 값이 아니라 이 기기/조직 설정의 로컬 값이다.';
    line.textContent = `단가 보정: ${label} · ${hhmm}`;
    return line;
  }

  private select(
    key: string, label: string, help: string,
    values: { value: string; label: string }[], current: string,
    apply: (value: string) => void,
  ): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'settings-field';
    wrap.title = help;

    const text = document.createElement('span');
    text.className = 'settings-label';
    text.textContent = label;

    const select = document.createElement('select');
    select.setAttribute('data-setting', key);
    for (const { value, label: optionLabel } of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = optionLabel;
      select.appendChild(option);
    }
    select.value = current;
    select.addEventListener('change', () => {
      apply(select.value);
      this.commit();
    });

    wrap.append(text, select);
    return wrap;
  }

  setChromeMode(mode: ChromeMode): void {
    if (this.settings.chromeMode === mode) {
      this.syncDisplayed(mode);
      this.onReselect();
      return;
    }
    this.settings = { ...this.settings, chromeMode: mode };
    this.syncDisplayed(mode);
    this.commit();
  }

  /** 버튼과 읽기 전용 표식만 맞춘다. 저장하지 않는다. */
  syncDisplayed(mode: ChromeMode): void {
    if (this.chromeRoot === null) return;
    const readout = this.chromeRoot.querySelector('[data-chrome-readout]');
    if (readout) readout.textContent = chromeModeLabel(mode);
    for (const btn of this.chromeRoot.querySelectorAll<HTMLButtonElement>('[data-setting="chromeMode"]')) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-chrome-choice') === String(mode)));
    }
  }

  private chromeModeGroup(current: ChromeMode): HTMLElement {
    const group = document.createElement('div');
    group.className = 'settings-group chrome-mode';
    group.title = HELP.chromeMode;
    const label = document.createElement('span');
    label.className = 'settings-label';
    label.textContent = '크롬';
    const readout = document.createElement('span');
    readout.className = 'chrome-readout';
    readout.setAttribute('data-chrome-readout', '');
    readout.textContent = chromeModeLabel(current);
    group.append(label, readout);
    this.chromeRoot = group;
    for (const { mode, label: text } of CHROME_CHOICES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chrome-mode-btn';
      btn.setAttribute('data-setting', 'chromeMode');
      btn.setAttribute('data-chrome-choice', String(mode));
      btn.setAttribute('aria-pressed', String(current === mode));
      btn.setAttribute('aria-label', `크롬 모드 ${mode}`);
      btn.textContent = text;
      btn.addEventListener('click', () => this.setChromeMode(mode));
      group.appendChild(btn);
    }
    return group;
  }

  /** localStorage에만 쓴다. 네트워크로 보내지 않는다 (PRIV-6). */
  private commit(): void {
    saveLocalSettings(this.settings);
    this.onChange(this.settings);
  }
}
