import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('차량 freshness와 LIVE 상태를 글자로 설명한다', () => {
    new Legend(host);
    const text = host.textContent ?? '';
    for (const key of ['FRESH', 'QUIET', 'STALE', 'CONNECTED', 'SYNCING']) {
      expect(text).toContain(key);
    }
  });

  it('접었다 펼 수 있다 — 상시 노출 화면에서 늘 떠 있으면 방해다', () => {
    new Legend(host);
    const root = host.querySelector('.legend')!;
    expect(root.getAttribute('data-open')).toBe('false');
    (host.querySelector('.legend-toggle') as HTMLElement).click();
    expect(root.getAttribute('data-open')).toBe('true');
  });
});

// Task 5 — settings와 상호 배타. onOpen은 열릴 때만 불려 main.ts가 상대 패널을 닫는다.
describe('범례는 열릴 때만 onOpen을 부른다 (Task 5)', () => {
  it('토글로 열 때 한 번, 닫을 때는 부르지 않는다', () => {
    const onOpen = vi.fn();
    new Legend(host, onOpen);
    const toggle = host.querySelector('.legend-toggle') as HTMLElement;

    toggle.click();
    expect(onOpen).toHaveBeenCalledTimes(1);

    toggle.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('onOpen이 없어도 토글은 그대로 동작한다', () => {
    new Legend(host);
    const root = host.querySelector('.legend')!;
    (host.querySelector('.legend-toggle') as HTMLElement).click();
    expect(root.getAttribute('data-open')).toBe('true');
  });

  it('범례 본문에는 설정 입력이 섞이지 않는다', () => {
    new Legend(host);
    const body = host.querySelector('.legend-body')!;
    expect(body.querySelector('input, select')).toBeNull();
  });
});
