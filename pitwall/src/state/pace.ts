import type { CarEvent, RaceState } from '../types';
import { workOf } from './reducer';

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

/**
 * 누적 비용과 **최근 창** 속도.
 *
 * 총액은 누적이 맞고 속도는 최근이 맞다 — 오늘 얼마 나갔나와 지금 얼마로
 * 나가고 있나는 다른 질문이다. 창을 안 주면 레이스 전체를 창으로 쓴다.
 */
export function paceOf(
  state: RaceState,
  recent?: { events: CarEvent[]; now: number; windowMs: number; speed?: number },
): Pace {
  if (recent) {
    let costUsd = 0;
    for (const car of state.cars.values()) costUsd += car.cost_usd;
    return { costUsd, ...recentPace(recent.events, recent.now, recent.windowMs, recent.speed) };
  }
  return cumulativePace(state);
}

function cumulativePace(state: RaceState): Pace {
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

/**
 * **최근 창** 기준 속도.
 *
 * `paceOf`는 레이스 시작 이후의 평균이라 오래 쉰 계정도 숫자가 안 떨어진다.
 * 실측에서 계정 하나가 레이스의 67%를 5분 넘는 공백으로 보내는데, 그동안에도
 * 줄에는 "4.7k tok/분"이 붙어 있었다 — 같은 줄의 IDLE 배지와 정면으로 어긋난다.
 * 지금 얼마나 빠른지는 지금 창에서 재야 한다.
 */
export function recentPace(
  events: CarEvent[], now: number, windowMs: number, speed = 1,
): Omit<Pace, 'costUsd'> {
  const from = now - windowMs;
  let work = 0;
  let cost = 0;
  for (const e of events) {
    if (e.ts <= from || e.ts > now) continue;
    work += workOf(e);
    cost += e.cost_usd;
  }
  // 이벤트 ts는 내부 시계라 창도 내부 시계로 좁힌다. 그러나 **분모는 레이스
  // 시간**이다 — 600배속에서 내부 3초로 나누면 시간당 $2만이 찍힌다.
  const minutes = (windowMs * Math.max(1, speed)) / 60_000;
  if (minutes <= 0) return { costPerHour: 0, workPerMinute: 0 };
  return { costPerHour: cost / (minutes / 60), workPerMinute: work / minutes };
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * 돈이 먼저다.
 *
 * 속도가 0일 때 칸을 비우면 화면이 고장난 것처럼 보인다 — 값이 없는 것과
 * 값이 0인 것은 다르다. 아직 한 푼도 안 썼을 때만 금액만 쓴다.
 */
export function formatPace(p: Pace): string {
  const money = `$${p.costUsd.toFixed(2)}`;
  if (p.costUsd <= 0 && p.costPerHour <= 0 && p.workPerMinute <= 0) return money;
  if (p.costPerHour <= 0 && p.workPerMinute <= 0) return `${money} · 유휴`;
  return `${money} · $${p.costPerHour.toFixed(1)}/시간 · ${compact(p.workPerMinute)} tok/분`;
}
