import { describe, it, expect, beforeEach } from 'vitest';
import { createProviderChip, paintProviderChip } from '../src/render/providerChip';

let chip: HTMLSpanElement;
beforeEach(() => {
  chip = createProviderChip();
});

describe('프로바이더 칩 known→unknown 정리 (live-reload-reliability)', () => {
  it('아는 모델에서 미지 모델로 바뀌면 텍스트·색·title·data를 지우고 숨긴다', () => {
    // Given: 아는 모델로 칠해 칩에 공급자 흔적이 실려 있다.
    paintProviderChip(chip, 'gpt-5.6-sol');
    expect(chip.getAttribute('data-provider')).toBe('openai');
    expect(chip.textContent).toBe('Op');
    expect(chip.title).toBe('openai');
    expect(chip.style.color).not.toBe('');

    // When: 카탈로그 밖 모델로 바뀐다.
    paintProviderChip(chip, 'mystery-model-x');

    // Then: 숨기기 전에 낡은 공급자 흔적을 남기지 않는다.
    expect(chip.style.display).toBe('none');
    expect(chip.getAttribute('data-provider')).toBeNull();
    expect(chip.textContent).toBe('');
    expect(chip.title).toBe('');
    expect(chip.style.color).toBe('');
  });

  it('미지 모델을 반복해 칠해도 숨김과 빈 상태를 유지한다 — 프레임 예산', () => {
    // Given/When: 처음부터 미지 모델을 연속으로 칠한다.
    paintProviderChip(chip, 'mystery-a');
    paintProviderChip(chip, 'mystery-b');

    // Then: 지어낸 공급자 없이 숨김·빈 상태로 남는다.
    expect(chip.style.display).toBe('none');
    expect(chip.getAttribute('data-provider')).toBeNull();
    expect(chip.textContent).toBe('');
  });
});
