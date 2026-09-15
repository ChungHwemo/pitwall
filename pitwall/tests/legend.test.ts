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
    expect(text).toContain('중계');
    expect(text).toContain('[');
  });

  it('차량 freshness와 LIVE 상태를 글자로 설명한다', () => {
    new Legend(host);
    const text = host.textContent ?? '';
    for (const key of ['FRESH', 'QUIET', 'STALE', 'CONNECTED', 'SYNCING', 'WAITING']) {
      expect(text).toContain(key);
    }
  });

  it('모델 등급을 H·P·GT의 색과 도형으로 직접 밝힌다', () => {
    new Legend(host);
    const entries = [...host.querySelectorAll('.legend-body dt')]
      .map((entry) => [entry.textContent, entry.getAttribute('data-sample')]);
    expect(entries).toContainEqual(['H', 'class-h']);
    expect(entries).toContainEqual(['P', 'class-p']);
    expect(entries).toContainEqual(['GT', 'class-gt']);
  });

  it('접었다 펼 수 있다 — 상시 노출 화면에서 늘 떠 있으면 방해다', () => {
    new Legend(host);
    const root = host.querySelector('.legend')!;
    expect(root.getAttribute('data-open')).toBe('false');
    (host.querySelector('.legend-toggle') as HTMLElement).click();
    expect(root.getAttribute('data-open')).toBe('true');
  });

  it('버튼이 본문과 열린 상태를 ARIA로 연결하고 외부 닫힘도 따라간다', async () => {
    new Legend(host);
    const root = host.querySelector<HTMLElement>('.legend');
    const toggle = host.querySelector<HTMLButtonElement>('.legend-toggle');
    const body = host.querySelector<HTMLElement>('.legend-body');
    if (!root || !toggle || !body) throw new Error('범례 토글 구조를 찾지 못했다');

    expect(body.id).toBe('legend-body');
    expect(toggle.getAttribute('aria-controls')).toBe(body.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    root.setAttribute('data-open', 'true');
    await Promise.resolve();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    root.setAttribute('data-open', 'false');
    await Promise.resolve();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape는 범례를 닫고 토글로 포커스를 돌린다', () => {
    new Legend(host);
    const root = host.querySelector<HTMLElement>('.legend');
    const toggle = host.querySelector<HTMLButtonElement>('.legend-toggle');
    if (!root || !toggle) throw new Error('범례 토글 구조를 찾지 못했다');

    toggle.focus();
    toggle.click();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(root.getAttribute('data-open')).toBe('false');
    expect(document.activeElement).toBe(toggle);
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
