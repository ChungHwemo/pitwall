/**
 * 겹침 방지 — 진행률을 유지하면서 최소 간격만 확보한다.
 *
 * **빈 양자화를 대체한다.** 빈은 겹침을 없앴지만 위치가 이산값이라 차가
 * 빈 단위로 순간이동했다(점멸). 게다가 빈은 "움직이는 물체"가 아니라
 * 칸이라, 애니메이션할 대상 자체가 없었다.
 *
 * 여기서는 각 차량이 자기 진행률을 그대로 갖고, 이웃과 너무 가까울 때만
 * 앞으로 밀린다. 진행률이 조금 바뀌면 결과도 조금 바뀐다 — 부드럽게 움직인다.
 */

/** 글리프 지름(14) ÷ 트랙 둘레(약 2,000). 이보다 가까우면 겹쳐 보인다. */
export const MIN_SPACING = 0.009;

/**
 * 정렬 순서대로 훑으며 최소 간격을 확보한다. 입력 순서로 되돌려준다.
 *
 * 폐곡선이라 마지막과 첫 번째도 이웃이지만, 그 경계까지 맞추려면 전체를
 * 회전시켜야 한다 — 한 지점의 겹침을 없애려고 나머지 전부를 움직이는 건
 * 손해다. 경계는 그대로 둔다.
 */
export function spreadProgress(progress: number[]): number[] {
  if (progress.length === 0) return [];

  const order = progress
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p);

  const out = new Array<number>(progress.length);
  let previous = -Infinity;

  for (const { p, i } of order) {
    // 이웃보다 가까우면 최소 간격만큼 뒤로 민다.
    const placed = p < previous + MIN_SPACING ? previous + MIN_SPACING : p;
    previous = placed;
    // 한 바퀴를 넘어가면 감아 돌린다. 트랙은 폐곡선이다.
    out[i] = placed % 1;
  }

  return out;
}
