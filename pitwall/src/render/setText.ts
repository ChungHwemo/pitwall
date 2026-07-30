/**
 * 값이 바뀔 때만 textContent를 쓴다.
 *
 * 같은 문자열을 다시 써도 브라우저는 레이아웃을 무효화한다. 8시간 상시 노출에서
 * 프레임마다 HUD·카메라·라디오 텍스트를 재기록하면 프레임당 layout 1회가 고정으로 붙는다
 * (2026-07-30 실측: chaos 30초에 layout 3,601회 = 프레임당 1회).
 *
 * Global Constraints가 SVG transform 속성을 금지하는 것과 같은 이유다 —
 * 레이아웃 무효화를 만들지 않는 것이 이 렌더러들의 유일한 성능 규칙이다.
 */
export function setText(el: { textContent: string | null }, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}
