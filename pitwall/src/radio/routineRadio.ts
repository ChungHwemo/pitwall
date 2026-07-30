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
    /**
     * 캐시 임계값은 실측에서 나왔다 (2026-07-30, 26,438건: 히트율 97.5%).
     * 원래 규칙은 20% 미만에 발화했는데, 그 아래로 떨어지는 일이 없어
     * **영원히 침묵하는 규칙**이었다. 정상이 97.5%이므로 80% 미만이 이상 신호다.
     */
    id: 'cache',
    matches: (car) => car.call_count >= MIN_SAMPLE && car.cache_hits / car.call_count < 0.8,
    text: (car) =>
      `캐시 재사용률 ${Math.round((car.cache_hits / car.call_count) * 100)}% — 평소보다 낮음. 컨텍스트가 자주 바뀌고 있음`,
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
