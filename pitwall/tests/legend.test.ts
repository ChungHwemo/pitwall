import { describe, it, expect, beforeEach } from 'vitest';
import { Legend } from '../src/render/legend';

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>';
  host = document.getElementById('host')!;
});

describe('Legend', () => {
  it('상태 배지가 무엇을 뜻하는지 적는다', () => {
    new Legend(host);
    const text = host.textContent ?? '';
    for (const key of ['RUN', 'IDLE', 'PIT · LIM', 'PIT · ERR']) {
      expect(text).toContain(key);
    }
  });

  it('한 바퀴와 한도가 무엇인지 적는다 — 화면 안에서만 통하는 말이다', () => {
    new Legend(host);
    const text = host.textContent ?? '';
    expect(text).toContain('한 바퀴');
    expect(text).toContain('한도');
  });

  it('접었다 펼 수 있다 — 상시 노출 화면에서 늘 떠 있으면 방해다', () => {
    new Legend(host);
    const root = host.querySelector('.legend')!;
    expect(root.getAttribute('data-open')).toBe('false');
    (host.querySelector('.legend-toggle') as HTMLElement).click();
    expect(root.getAttribute('data-open')).toBe('true');
  });
});
