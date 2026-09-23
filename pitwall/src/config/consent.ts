export const CONSENT_KEY = 'pitwall.consent.v1';

export function loadConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveConsent(): void {
  localStorage.setItem(CONSENT_KEY, '1');
}

/** 네이티브는 동의한 뒤에만 줄을 받는다. 브라우저 데모는 테일이 없다. */
export function allowLiveIngest(native: boolean): boolean {
  if (!native) return true;
  return loadConsent();
}

interface NativeConsentBridge {
  webkit?: { messageHandlers?: { pitwallConsent?: { postMessage: (value: string) => void } } };
}

/** Swift가 이 메시지를 받기 전에는 테일을 열지 않는다. */
export function signalNativeConsent(): void {
  const w = window as unknown as NativeConsentBridge;
  w.webkit?.messageHandlers?.pitwallConsent?.postMessage('1');
}

/** 이미 동의한 재실행. 오버레이가 안 뜨므로 따로 알린다. */
export function notifyNativeIfConsented(native: boolean): void {
  if (native && loadConsent()) signalNativeConsent();
}

export function mountConsent(
  host: HTMLElement,
  opts: { native: boolean },
  onAllow: () => void,
): HTMLElement | null {
  if (!opts.native || loadConsent()) return null;
  const root = document.createElement('div');
  root.className = 'consent';
  root.setAttribute('role', 'dialog');
  const kicker = document.createElement('p');
  kicker.className = 'chrome-kicker';
  kicker.textContent = 'WORKSHOP / LIVE';
  const p = document.createElement('p');
  p.textContent = '이 앱은 ~/.claude · ~/.codex · ~/.grok · ~/.copilot 로그에서 사용량 숫자만 읽습니다. 프롬프트·응답 본문은 버립니다. 네트워크로 보내지 않습니다.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '읽기 허용';
  btn.addEventListener('click', () => {
    saveConsent();
    root.remove();
    onAllow();
  });
  root.append(kicker, p, btn);
  host.append(root);
  return root;
}
