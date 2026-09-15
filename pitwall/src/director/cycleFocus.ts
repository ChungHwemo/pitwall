/** 중계 포커스를 모델/차량 목록에서 한 칸 옮긴다. 맵과 무관하다. */

export function cycleFocus(
  carIds: readonly string[],
  current: string | null,
  step: 1 | -1,
): string | null {
  if (carIds.length === 0) return null;
  if (current === null) return carIds[0] ?? null;
  const index = carIds.indexOf(current);
  if (index < 0) return carIds[0] ?? null;
  const next = (index + step + carIds.length) % carIds.length;
  return carIds[next] ?? null;
}
