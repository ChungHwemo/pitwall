import type { CarClass, RaceState } from '../types';
import { CAR_CLASSES } from '../types';

/**
 * 하루 요약 (PRD S4). 체커기 이후 화면에 띄운다.
 *
 * **조직 단위다.** 개인 순위나 상위 목록을 만들지 않는다 — 그 순간 이 화면은
 * 앰비언트 디스플레이가 아니라 성과 대시보드가 된다 (PRIV-5).
 * car_id는 요약에 들어오지 않는다.
 */
export interface RaceSummary {
  totalTokens: number;
  totalCostUsd: number;
  finished: number;
  retired: number;
  byClass: Record<CarClass, number>;
  cacheHitRate: number;
  errors: number;
}

export function summarise(state: RaceState): RaceSummary {
  const byClass: Record<CarClass, number> = { H: 0, P: 0, GT: 0 };
  for (const cls of CAR_CLASSES) byClass[cls] = 0;

  let totalTokens = 0;
  let totalCostUsd = 0;
  let finished = 0;
  let retired = 0;
  let cacheHits = 0;
  let calls = 0;
  let errors = 0;

  for (const car of state.cars.values()) {
    totalTokens += car.distance;
    totalCostUsd += car.cost_usd;
    cacheHits += car.cache_hits;
    calls += car.call_count;
    errors += car.error_count;
    byClass[car.car_class]++;
    if (car.activity === 'retired') retired++;
    else finished++;
  }

  return {
    totalTokens,
    totalCostUsd,
    finished,
    retired,
    byClass,
    cacheHitRate: calls === 0 ? 0 : cacheHits / calls,
    errors,
  };
}
