import type { CarState } from '../types';
import type { RadioMessage } from './eventRadio';

/** 동일 유형 재발화 금지 간격 (PRD §10.3 하드 제약. 상향만 가능) */
export const ROUTINE_COOLDOWN_MS = 1_800_000;

/** 이 미만이면 표본이 부족해 판단하지 않는다 */
const MIN_SAMPLE = 10;

type RuleId = 'cache' | 'errors';

interface Rule {
  id: RuleId;
  matches(car: CarState): boolean;
  text(car: CarState): string;
}

const RULES: Rule[] = [
  {
    id: 'errors',
    matches: (car) => car.error_count >= 3,
    text: (car) => `반복 실패 ${car.error_count}회 — 접근을 바꿔볼 것`,
  },
  {
    id: 'cache',
    matches: (car) => car.call_count >= MIN_SAMPLE && car.cache_hits / car.call_count < 0.2,
    text: (car) =>
      `캐시 미스가 잦음 (${Math.round((car.cache_hits / car.call_count) * 100)}%) — 컨텍스트가 매번 바뀌고 있음`,
  },
];

let counter = 0;

export class RoutineRadio {
  private lastFired = new Map<string, number>();

  evaluate(car: CarState, now: number): RadioMessage | null {
    for (const rule of RULES) {
      if (!rule.matches(car)) continue;
      const key = `${car.car_id}:${rule.id}`;
      const last = this.lastFired.get(key);
      if (last !== undefined && now - last < ROUTINE_COOLDOWN_MS) continue;
      this.lastFired.set(key, now);
      return {
        id: `routine-${++counter}`,
        carNumber: car.car_number,
        text: rule.text(car),
        severity: 'info',
        ts: now,
      };
    }
    return null;
  }
}
