/** 관측 재생에서 예산 없는 연료를 버린다. 시뮬레이터·데모는 남긴다 (PRD v3.0 W0). */
export function stripObservedFuel<T extends { fuel_pct?: number }>(
  events: T[],
  synthetic: boolean,
): T[] {
  if (synthetic) return events;
  return events.map((e) => {
    if (e.fuel_pct === undefined) return e;
    const { fuel_pct: _drop, ...rest } = e;
    return rest as T;
  });
}
