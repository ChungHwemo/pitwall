import type { Dataset } from '../config/datasets';
import { setText } from './setText';

/**
 * 무엇을 보고 있는지 말하는 칸.
 *
 * 실기록과 지어낸 데이터를 헷갈리는 것이 이 화면에서 가장 나쁜 오해다 — 숫자가
 * 전부 그럴듯해서 틀린 걸 알 방법이 없다. 그래서 **고르는 곳과 밝히는 곳을
 * 같은 자리에 둔다.** 고를 게 하나뿐이면 목록 없이 이름만 남긴다.
 */
/** 이 칸이 무엇인지. 이름만 봐서는 무엇을 고르는 건지 알 수 없다. */
const HELP = [
  '화면이 무엇을 보여줄지 고른다.',
  '실시간 — 지금 이 기기에서 나가는 호출. 네이티브 앱에서만 들어온다.',
  '실기록 — 이 기기의 로그로 하루를 재생한다.',
  '데모 — 지어낸 조직. 계정 수만 다르고 분포는 실측을 따랐다.',
].join('\n');

export class DatasetPicker {
  constructor(
    container: HTMLElement,
    sets: Dataset[],
    current: string,
    onPick: (id: string) => void,
  ) {
    const root = document.createElement('div');
    root.className = 'dataset hud-item';
    root.title = HELP;

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
