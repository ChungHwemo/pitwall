import type { RaceState } from '../types';

/**
 * 지금 얼마나 빨리 태우고 있는가.
 *
 * 감사에서 확인한 결손이다 — 화면에 누적값만 있고 속도가 없었다. 같은 로그를 읽는
 * 도구들(ccusage statusline, blocks --live, Claude-Code-Usage-Monitor)은 전부
 * 소진 속도를 첫 줄에 둔다. "지금 빠른가"가 곁눈질로 읽어야 할 질문이기 때문이다.
 *
 * 분모는 레이스 경과 시간이다. 벽시계가 아니라 — 아직 안 시작한 레이스에서
 * 시간당 비용을 말하면 0으로 나누게 된다.
 */
export interface Pace {
  /** 지금까지 쓴 돈 */
  costUsd: number;
  /** 시간당 소진 */
  costPerHour: number;
  /** 분당 작업 토큰. 캐시 재전송은 빠져 있다 */
  workPerMinute: number;
}

export function paceOf(state: RaceState): Pace {
  let costUsd = 0;
  let work = 0;
  for (const car of state.cars.values()) {
    costUsd += car.cost_usd;
    work += car.distance;
  }

  const hours = state.elapsed_ms / 3_600_000;
  if (hours <= 0) return { costUsd, costPerHour: 0, workPerMinute: 0 };

  return {
    costUsd,
    costPerHour: costUsd / hours,
    workPerMinute: work / (hours * 60),
  };
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** 돈이 먼저다. 속도는 레이스가 돌기 시작한 뒤에만 말이 된다. */
export function formatPace(p: Pace): string {
  const money = `$${p.costUsd.toFixed(2)}`;
  if (p.costPerHour <= 0 && p.workPerMinute <= 0) return money;
  return `${money} · $${p.costPerHour.toFixed(1)}/시간 · ${compact(p.workPerMinute)} tok/분`;
}
