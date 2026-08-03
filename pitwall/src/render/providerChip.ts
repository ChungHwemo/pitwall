import { providerOfModel } from '../config/models';
import { PROVIDER_STYLE } from '../config/theme';
import { setText } from './setText';

/**
 * 모델 텍스트 옆에 붙는 공급자 칩(REVIEW #11). 트랙의 단가 축은 건드리지 않고,
 * "어느 공급자인가"만 카드 텍스트 레이어에 문자+색으로 얹는다.
 *
 * 노드 수 고정 규칙을 지킨다 — 칩은 한 번 만들고(`createProviderChip`) 프레임마다
 * `paintProviderChip`으로 다시 칠한다. 공급자가 바뀔 때만 속성을 쓴다(레이아웃 예산).
 */
export function createProviderChip(): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'provider-chip';
  chip.style.display = 'none';
  return chip;
}

/**
 * 모델 id로 공급자를 조회해 칩을 칠한다. 카탈로그 밖 모델은 공급자를 지어내지 않으므로
 * 칩을 숨긴다 — 화면에 없는 브랜드를 그리지 않는다.
 */
export function paintProviderChip(chip: HTMLSpanElement, modelId: string): void {
  const provider = providerOfModel(modelId);
  if (provider === null) {
    if (chip.getAttribute('data-provider') !== null) chip.removeAttribute('data-provider');
    if (chip.style.display !== 'none') chip.style.display = 'none';
    return;
  }
  if (chip.style.display !== '') chip.style.display = '';
  if (chip.getAttribute('data-provider') === provider) return;
  chip.setAttribute('data-provider', provider);
  const style = PROVIDER_STYLE[provider];
  chip.style.color = style.color;
  chip.title = provider;
  setText(chip, style.label);
}
