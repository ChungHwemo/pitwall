import type { WorkdayConfig } from './clock';

/**
 * 데모용 가상 시계.
 *
 * PITWALL은 벽시계로 페이즈를 정한다. 09:00–18:00 밖에 열면 `pre_grid`나
 * `chequered`라서 트랙이 비어 있다 — 맞는 동작이지만, 밤에 데모를 여는 사람에게는
 * 고장난 화면으로 보인다.
 *
 * 이 함수는 실제 시각을 근무 창 안으로 접어 넣어 항상 레이스가 돌게 한다.
 * **시각을 지어내는 것이므로 화면에 `DEMO`를 띄운다** — 사용자가 이걸 실제
 * 진행 상황으로 오해하면 안 된다. v1은 데이터도 시뮬레이터라 시계만 진짜일
 * 이유가 없지만, 실데이터를 붙이는 v1.5에서는 꺼야 한다.
 *
 * 초·밀리초는 그대로 둔다. 분만 접으면 시계가 초 단위로 계속 흐른다.
 */
export function demoClock(real: Date, cfg: WorkdayConfig): Date {
  const span = cfg.raceEnd - cfg.raceStart;
  const realMinutes = real.getHours() * 60 + real.getMinutes();
  const folded = cfg.raceStart + (((realMinutes % span) + span) % span);

  const demo = new Date(real);
  demo.setHours(Math.floor(folded / 60), folded % 60);
  return demo;
}
