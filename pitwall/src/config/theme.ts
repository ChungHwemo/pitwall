import type { CarClass } from '../types';
import type { ProviderId } from './models';

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
 * 하루 요약 카드의 기여도 그리드(계정 × 시간대) 셀 강도 램프. 어두운 쪽에서
 * 밝은 쪽으로 5단, 전부 트랙·중립 계열의 청회색이라 클래스 색·경고색과 섞이지
 * 않는다 — 이건 클래스가 아니라 조직 단위 강도다. 0번(가장 어두움)이 빈/무작업
 * 칸이다. 따뜻한 노랑(`ACCENT_DELTA`)은 숫자 델타 전용이라 여기 쓰지 않는다.
 */
export const CONTRIBUTION_STEPS: readonly string[] = [
  '#1c222b',
  '#334b55',
  '#3f5963',
  '#6f8792',
  '#9fb3c8',
] as const;

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
 * 공급자 칩(REVIEW #11). 트랙 글리프의 단가 축(H/P/GT 도형+색)은 그대로 두고,
 * 어느 공급자의 모델인지는 feed/tower **카드의 모델 텍스트 옆** 작은 칩으로만 얹는다.
 *
 * **문자+색 이중 인코딩** — 색상 단독 인코딩 금지 룰(하드 룰) 때문에 칩은 색뿐 아니라
 * 공급자 약어 `label`을 함께 보여준다. 색은 보조 신호이고 판독은 문자가 진다.
 *
 * 색 선택 근거:
 *  - 배경(`#0e1116`) 대비는 전부 6:1을 넘긴다 (하한 2.5:1을 여유 있게 통과) — 아래
 *    `PROVIDER_STYLE contrast` 테스트가 강제한다.
 *  - 클래스·이벤트 예약색과 **색상(hue)을 비켜간다**: 빨강(H·caution `#ff5c5c`),
 *    청록(P·spark `#4dc3ff`), 보라(GT `#c084fc`), 따뜻한 노랑(`ACCENT_DELTA` 델타 전용)은
 *    피한다. 여섯 칩은 주황·청록초록·하늘·중립회색·남보라·자홍으로 색환에 흩어 두어
 *    인접한 두 공급자가 헷갈리게 비슷해지지 않게 했다. 문자 약어가 이미 판독을 지므로
 *    색은 한눈에 "다른 공급자"임만 거들면 된다.
 *  - xAI는 브랜드가 무채색이라 중립 밝은 회색(`#c9d1d9`)을 준다 — 색환의 어느 hue와도
 *    충돌하지 않는 유일한 안전한 자리다.
 */
export const PROVIDER_STYLE: Record<ProviderId, { label: string; color: string }> = {
  anthropic: { label: 'An', color: '#e0955e' },
  openai: { label: 'Op', color: '#2fbf9f' },
  google: { label: 'Gg', color: '#5fa8f0' },
  xai: { label: 'Xa', color: '#c9d1d9' },
  deepseek: { label: 'Ds', color: '#8b90f5' },
  moonshot: { label: 'Mo', color: '#e06abf' },
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
