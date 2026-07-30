import type { CarClass } from '../types';

export const BACKGROUND = '#0e1116';

/**
 * 클래스는 색과 형태로 이중 인코딩한다.
 * 색상만으로 구분되는 정보를 만들지 않는다 — 색각 이상자에게 화면이 무의미해진다.
 * 실제 르망 팔레트를 복제하지 않는다. 2026년 규격 색상값은 확인되지 않았고,
 * 우리가 채택한 것은 팔레트가 아니라 원리다 (PRD §6.3).
 */
export const CLASS_STYLE: Record<CarClass, { color: string; shape: 'circle' | 'triangle' | 'square'; label: string }> = {
  H: { color: '#ff5c5c', shape: 'triangle', label: 'HYPERCAR' },
  P: { color: '#4dc3ff', shape: 'circle', label: 'PROTOTYPE' },
  GT: { color: '#ffd24d', shape: 'square', label: 'GT' },
};

export const SEVERITY_COLOR: Record<'info' | 'warn' | 'critical', string> = {
  info: '#9fb3c8',
  warn: '#ffd24d',
  critical: '#ff5c5c',
};

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const int = parseInt(m[1]!, 16);
  const r = channel((int >> 16) & 0xff);
  const g = channel((int >> 8) & 0xff);
  const b = channel(int & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
