export type ChromeMode = 1 | 2 | 3;

export const DEFAULT_CHROME_MODE: ChromeMode = 1;

export const CHROME_MODE_LABEL: Record<ChromeMode, string> = {
  1: 'TOKEN / 01',
  2: 'CLUSTER / 02',
  3: 'WORKSHOP / 03',
};

export function parseChromeMode(value: unknown): ChromeMode {
  return value === 1 || value === 2 || value === 3 ? value : DEFAULT_CHROME_MODE;
}

export function chromeModeLabel(mode: ChromeMode): string {
  return CHROME_MODE_LABEL[mode];
}

export function chromeModeFromKey(key: string): ChromeMode | null {
  if (key === '1' || key === '2' || key === '3') return Number(key) as ChromeMode;
  return null;
}

/** `?chrome=2` 처럼 시드 고정과 같은 핀. 못 읽으면 설정을 건드리지 않는다. */
export function chromeModeFromSearch(search: string): ChromeMode | null {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('chrome');
  if (raw === '1' || raw === '2' || raw === '3') return Number(raw) as ChromeMode;
  return null;
}

export function isChromeHotkeyBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  return target.isContentEditable === true;
}

function ensure(root: HTMLElement, attr: string, className: string): HTMLElement {
  let el = root.querySelector(`[${attr}]`) as HTMLElement | null;
  if (el === null) {
    el = document.createElement('div');
    el.setAttribute(attr, '');
    el.className = className;
    root.appendChild(el);
  }
  return el;
}

export function applyChromeMode(root: HTMLElement, mode: ChromeMode): void {
  root.setAttribute('data-chrome-mode', String(mode));
  const label = chromeModeLabel(mode);
  const toast = ensure(root, 'data-chrome-toast', 'chrome-toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = label;
  const readout = root.querySelector('[data-chrome-readout]');
  if (readout) readout.textContent = label;
  const vignette = ensure(root, 'data-chrome-vignette', 'workshop-vignette');
  vignette.setAttribute('aria-hidden', 'true');
  vignette.hidden = mode !== 3;
}
