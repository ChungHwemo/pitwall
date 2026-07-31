import type { PitwallSettings } from '../config/settings';
import { saveLocalSettings } from '../config/settings';
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
const PRESETS: PresetName[] = ['busy', 'sparse', 'chaos', 'real'];
const SPEEDS: PitwallSettings['speed'][] = [20, 30, 100];
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
  speed: '재생 속도. 20× = 72분에 하루, 30× = 48분에 하루, 100× = 14.4분에 하루.',
  highlight: '어떤 사건을 개별 추적할지. 끄면 그 사건이 나도 차를 세우지 않는다.',
  error: '호출이 실패한 차를 피트로 보낸다.',
  limit: '한도 창이 바닥난 차를 피트로 보낸다.',
  demoClock: '밤에도 레이스가 도는 것처럼 시각을 지어낸다. 화면에 DEMO가 붙는다. '
    + '기록·실시간에는 진짜 시계가 있으므로 나오지 않는다.',
} as const;

export class SettingsPanel {
  private settings: PitwallSettings;

  constructor(
    container: HTMLElement,
    initial: PitwallSettings,
    private onChange: (settings: PitwallSettings) => void,
    /** 시뮬레이터로 돌고 있는가. 기록 재생이면 프리셋 칸이 의미가 없다 */
    opts: { simulated: boolean } = { simulated: true },
  ) {
    this.settings = initial;

    const shell = document.createElement('div');
    shell.className = 'settings hud-item';
    shell.setAttribute('data-open', 'false');

    const toggle = document.createElement('button');
    toggle.className = 'settings-toggle';
    toggle.type = 'button';
    toggle.textContent = '설정';
    toggle.title = '배속·하이라이트 같은 조작판';
    toggle.addEventListener('click', () => {
      shell.setAttribute('data-open', shell.getAttribute('data-open') === 'true' ? 'false' : 'true');
    });

    const root = document.createElement('div');
    root.className = 'settings-body';

    // 프리셋은 시뮬레이터 전용이다. 기록을 재생 중일 때 띄워두면 아무 효과가
    // 없는 조작판이 되어, 눌러도 안 바뀌는 것을 고장으로 읽게 된다.
    if (opts.simulated) {
      root.appendChild(this.select('preset', '프리셋', HELP.preset, PRESETS, initial.preset, (v) => {
        this.settings = { ...this.settings, preset: v as PresetName };
      }));
    }

    root.appendChild(this.select('speed', '배속', HELP.speed, SPEEDS.map(String), String(initial.speed), (v) => {
      this.settings = { ...this.settings, speed: Number(v) as PitwallSettings['speed'] };
    }));

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

    // DEMO 시계도 시뮬레이터 전용이다. 기록 재생과 실시간에는 진짜 시계가 있어
    // 이 체크박스가 아무것도 바꾸지 않는다 — 눌러도 반응이 없으면 고장으로 읽힌다.
    if (!opts.simulated) {
      shell.append(toggle, root);
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
    demoText.textContent = 'DEMO 시계';
    demo.append(demoBox, demoText);
    root.appendChild(demo);

    shell.append(toggle, root);
    container.appendChild(shell);
  }

  private select(
    key: string, label: string, help: string, values: string[], current: string,
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
    for (const v of values) {
      const option = document.createElement('option');
      option.value = v;
      option.textContent = v;
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

  /** localStorage에만 쓴다. 네트워크로 보내지 않는다 (PRIV-6). */
  private commit(): void {
    saveLocalSettings(this.settings);
    this.onChange(this.settings);
  }
}
