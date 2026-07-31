/**
 * 데이터셋마다 두는 상한과, 상한을 넘을 때 **어느 구간을 심을지** 고르는 규칙.
 *
 * 전부 심으면 번들이 수십 MB가 된다. 잘라야 하는데, 어디를 자르느냐가 화면을
 * 바꾼다 — 그래서 vite.config에서 이 파일로 꺼내 테스트가 같은 함수를 밟게 한다.
 * 빌드가 심는 것과 테스트가 검사하는 것이 어긋나면, 검사는 통과하는데 화면은
 * 거짓을 말하는 조합이 조용히 산다.
 */
export const PER_SET = Number(process.env.PITWALL_MAX_EVENTS ?? 5000);

/**
 * 상한을 넘는 기록에서 **어느 구간을 심을지** 고른다.
 *
 * 마지막 `PER_SET`건을 잘라 쓰고 있었다. 활동이 8~22시에 뭉쳐 있던 시절에는
 * 그래도 여러 계정이 들어왔는데, 더미를 실측대로 24시간에 흩뜨리자 마지막
 * 5,000건이 하루의 좁은 끝자락이 되어 계정 40개짜리 데이터셋이 화면에
 * **동시에 5대까지만** 올렸다 — 밀집 모드를 밟으라고 만든 데이터셋이 그걸 못 밟았다.
 *
 * 계정이 가장 많이 겹치는 **연속** 구간을 고른다. 연속이어야 호출 간격이 보존된다 —
 * 띄엄띄엄 솎으면 tok/분이 솎은 배수만큼 낮아져 화면이 거짓을 말한다.
 */
export function busiestWindow(rows: string[], size: number): { at: number; cars: number } {
  const ids = rows.map((l) => {
    const m = /"car_id":"([^"]+)"/.exec(l);
    return m ? m[1]! : '';
  });
  const seen = new Map<string, number>();
  const bump = (id: string, by: number) => {
    const next = (seen.get(id) ?? 0) + by;
    if (next <= 0) seen.delete(id); else seen.set(id, next);
  };
  for (let i = 0; i < size && i < ids.length; i++) bump(ids[i]!, 1);
  let best = { at: 0, cars: seen.size };
  for (let at = 1; at + size <= ids.length; at++) {
    bump(ids[at - 1]!, -1);
    bump(ids[at + size - 1]!, 1);
    if (seen.size > best.cars) best = { at, cars: seen.size };
  }
  return best;
}
