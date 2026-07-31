import type { Dataset } from '../config/datasets';
import { setText } from './setText';

/**
 * 무엇을 보고 있는지 말하는 칸.
 *
 * 실기록과 지어낸 데이터를 헷갈리는 것이 이 화면에서 가장 나쁜 오해다 — 숫자가
 * 전부 그럴듯해서 틀린 걸 알 방법이 없다. 그래서 **고르는 곳과 밝히는 곳을
 * 같은 자리에 둔다.** 고를 게 하나뿐이면 목록 없이 이름만 남긴다.
 */
export class DatasetPicker {
  constructor(
    container: HTMLElement,
    sets: Dataset[],
    current: string,
    onPick: (id: string) => void,
  ) {
    const root = document.createElement('div');
    root.className = 'dataset hud-item';

    const active = sets.find((s) => s.id === current) ?? sets[0];
    root.setAttribute('data-synthetic', active?.synthetic ? 'true' : 'false');

    if (sets.length <= 1) {
      const name = document.createElement('span');
      name.className = 'dataset-name';
      setText(name, active?.label ?? '데이터 없음');
      root.appendChild(name);
    } else {
      const select = document.createElement('select');
      select.className = 'dataset-select';
      for (const set of sets) {
        const option = document.createElement('option');
        option.value = set.id;
        option.textContent = set.label;
        select.appendChild(option);
      }
      select.value = active?.id ?? sets[0]!.id;
      select.addEventListener('change', () => onPick(select.value));
      root.appendChild(select);
    }

    if (active?.synthetic) {
      // 지어낸 데이터라는 사실을 화면이 숨기지 않는다.
      const warn = document.createElement('span');
      warn.className = 'dataset-warn';
      setText(warn, '지어낸 데이터');
      root.appendChild(warn);
    }

    container.appendChild(root);
  }
}
