import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConsent, saveConsent, mountConsent, allowLiveIngest, CONSENT_KEY,
  signalNativeConsent, notifyNativeIfConsented,
} from '../src/config/consent';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="host"></div>';
});

describe('consent', () => {
  it('기본은 미동의다', () => {
    expect(loadConsent()).toBe(false);
  });

  it('saveConsent 후에만 동의다', () => {
    saveConsent();
    expect(localStorage.getItem(CONSENT_KEY)).toBe('1');
    expect(loadConsent()).toBe(true);
  });

  it('네이티브이고 미동의하면 고지 오버레이를 붙인다', () => {
    const host = document.getElementById('host')!;
    const el = mountConsent(host, { native: true }, () => undefined);
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('~/.claude');
    expect(el!.textContent).toContain('본문');
  });

  it('동의하면 오버레이를 붙이지 않는다', () => {
    saveConsent();
    const host = document.getElementById('host')!;
    expect(mountConsent(host, { native: true }, () => undefined)).toBeNull();
  });

  it('브라우저 데모는 오버레이가 없다', () => {
    const host = document.getElementById('host')!;
    expect(mountConsent(host, { native: false }, () => undefined)).toBeNull();
  });

  it('네이티브 미동의는 ingest를 막는다', () => {
    expect(allowLiveIngest(true)).toBe(false);
    saveConsent();
    expect(allowLiveIngest(true)).toBe(true);
  });

  it('브라우저 데모 ingest는 동의와 무관하다', () => {
    expect(allowLiveIngest(false)).toBe(true);
  });

  it('허용을 누르면 동의하고 콜백이 불린다', () => {
    const host = document.getElementById('host')!;
    let called = 0;
    const el = mountConsent(host, { native: true }, () => { called += 1; });
    el!.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(loadConsent()).toBe(true);
    expect(called).toBe(1);
  });
});

describe('네이티브 동의 신호', () => {
  afterEach(() => {
    delete (window as unknown as { webkit?: unknown }).webkit;
  });

  function stubHandler(): string[] {
    const posted: string[] = [];
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: {
        messageHandlers: {
          pitwallConsent: { postMessage: (v: string) => { posted.push(v); } },
        },
      },
    });
    return posted;
  }

  it('핸들러가 있으면 동의를 알린다', () => {
    const posted = stubHandler();
    signalNativeConsent();
    expect(posted).toEqual(['1']);
  });

  it('핸들러가 없으면 예외를 던지지 않는다', () => {
    expect(() => signalNativeConsent()).not.toThrow();
  });

  it('이미 동의한 네이티브는 부트에서 테일을 연다', () => {
    saveConsent();
    const posted = stubHandler();
    notifyNativeIfConsented(true);
    expect(posted).toEqual(['1']);
  });

  it('미동의 네이티브는 부트에서 테일을 열지 않는다', () => {
    const posted = stubHandler();
    notifyNativeIfConsented(true);
    expect(posted).toEqual([]);
  });

  it('브라우저 데모는 네이티브에 알리지 않는다', () => {
    saveConsent();
    const posted = stubHandler();
    notifyNativeIfConsented(false);
    expect(posted).toEqual([]);
  });
});
