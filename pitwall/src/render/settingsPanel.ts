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
 */
const PRESETS: PresetName[] = ['busy', 'sparse', 'chaos'];
const SPEEDS: PitwallSettings['speed'][] = [1, 60, 600];
const HIGHLIGHTS: HighlightType[] = ['error', 'limit'];
const HIGHLIGHT_LABEL: Record<HighlightType, string> = { error: '에러', limit: '한도' };

export class SettingsPanel {
  private settings: PitwallSettings;

  constructor(
    container: HTMLElement,
    initial: PitwallSettings,
    private onChange: (settings: PitwallSettings) => void,
  ) {
    this.settings = initial;

    const root = document.createElement('div');
    root.className = 'settings';

    root.appendChild(this.select('preset', '프리셋', PRESETS, initial.preset, (v) => {
      this.settings = { ...this.settings, preset: v as PresetName };
    }));

    root.appendChild(this.select('speed', '배속', SPEEDS.map(String), String(initial.speed), (v) => {
      this.settings = { ...this.settings, speed: Number(v) as PitwallSettings['speed'] };
    }));

    const group = document.createElement('div');
    group.className = 'settings-group';
    const groupLabel = document.createElement('span');
    groupLabel.className = 'settings-label';
    groupLabel.textContent = '하이라이트';
    group.appendChild(groupLabel);

    for (const type of HIGHLIGHTS) {
      const label = document.createElement('label');
      label.className = 'settings-check';

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

    container.appendChild(root);
  }

  private select(
    key: string, label: string, values: string[], current: string,
    apply: (value: string) => void,
  ): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'settings-field';

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
