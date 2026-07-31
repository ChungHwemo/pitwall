import type { CarClass } from '../types';

export const BACKGROUND = '#0e1116';

/**
 * 트랙 렌더러 전용 색 토큰. 예전에는 중심선(`#2a323d`)과 피트레인(`#1c222b`)이
 * `trackRenderer.ts`에 직접 박혀 있었고 배경 대비가 각각 1.46:1·1.18:1에 불과했다 —
 * 주행선이 배경과 거의 분리되지 않았다. 여기서 값을 한 곳에 모으고 대비를 올린다.
 *
 * - `centerline`: 배경 대비 최소 2.5:1. 흰색처럼 튀지 않는 청록 회색.
 * - `pitLane`: 약 2.0:1로 중심선보다 낮게 유지한다 — 피트는 찾을 수 있어야 하지만
 *   주행선과 같은 우선순위로 보이면 안 된다.
 * - `markerDark`/`markerLight`: 기존 `drawPitFlag()` 체커 모티브의 값과 같다.
 * - `sector`: 중심선보다 밝지만 차량 클래스·이벤트 색상과 섞이지 않는 청회색.
 */
export const TRACK_COLOR = {
  centerline: '#3f5963',
  pitLane: '#334b55',
  markerDark: '#11161d',
  markerLight: '#e8edf3',
  sector: '#6f8792',
} as const;

/**
 * 이벤트 극성 전용 색. 피드·무전·HUD가 같은 규칙을 공유한다 —
 * 긍정은 녹색, 확인이 급한 사건은 빨강, 의미 없는 상태 전달은 청회색.
 */
export const EVENT_POLARITY_COLOR = {
  positive: '#4ade80',
  caution: '#ff5c5c',
  neutral: '#9fb3c8',
} as const;

/**
 * 따뜻한 노랑의 유일한 용도 — 숫자 델타와 갭. GT 클래스, 심각도 warn, 장식에는
 * 쓰지 않는다 (§4.3.3). 이 색을 다른 곳에 다시 쓰고 싶어지면 그건 이 규칙이
 * 아니라 요구사항이 바뀐 것이다.
 */
export const ACCENT_DELTA = '#F2C744';

/**
 * 클래스는 색과 형태로 이중 인코딩한다.
 * 색상만으로 구분되는 정보를 만들지 않는다 — 색각 이상자에게 화면이 무의미해진다.
 * 실제 르망 팔레트를 복제하지 않는다. 2026년 규격 색상값은 확인되지 않았고,
 * 우리가 채택한 것은 팔레트가 아니라 원리다 (PRD §6.3).
 *
 * GT는 원래 노랑(`#ffd24d`)이었으나 `ACCENT_DELTA`와 같은 계열이라 숫자 델타의
 * 단일 액센트 규칙과 충돌했다. 사각형 배지가 이미 형태를 보존하므로 색만
 * 보라 계열로 옮긴다 — 이중 인코딩은 그대로 유지된다.
 */
export const CLASS_STYLE: Record<CarClass, { color: string; shape: 'circle' | 'triangle' | 'square'; label: string }> = {
  H: { color: '#ff5c5c', shape: 'triangle', label: 'HYPERCAR' },
  P: { color: '#4dc3ff', shape: 'circle', label: 'PROTOTYPE' },
  GT: { color: '#c084fc', shape: 'square', label: 'GT' },
};

/**
 * 무전 심각도. `warn`은 더 이상 `ACCENT_DELTA` 계열(`#ffd24d`)을 쓰지 않는다 —
 * 오류·한도는 이벤트 극성의 `caution`을 그대로 쓴다. `critical`도 같은 빨강
 * 계열이며, 두 단계는 색이 아니라 굵기·아이콘으로 구분한다 (§4.3.1).
 */
export const SEVERITY_COLOR: Record<'info' | 'warn' | 'critical', string> = {
  info: EVENT_POLARITY_COLOR.neutral,
  warn: EVENT_POLARITY_COLOR.caution,
  critical: EVENT_POLARITY_COLOR.caution,
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
