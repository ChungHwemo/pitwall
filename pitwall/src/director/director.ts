import type { CarState, RaceState } from '../types';
import { activityOf } from '../state/reducer';

export const DIRECTOR_WEIGHTS = {
  error: 100,
  limitThreshold: 80,
  latencyAnomaly: 40,
  resumeAfterSilence: 30,
  milestone: 20,
} as const;

export const DIRECTOR_TIMING = {
  /** 점수가 떨어져도 이 시간 동안은 유지한다 */
  minDwellMs: 8_000,
  /** 같은 차량을 다시 잡기까지의 최소 간격 */
  reselectCooldownMs: 60_000,
  /** 전체 슬롯이 한꺼번에 바뀌지 않게 하는 간격 */
  slotSwapIntervalMs: 3_000,
  /** 이 시간 이상 조용하다 재가동하면 신호로 본다 */
  silenceMs: 600_000,
} as const;

export interface ScoreContext {
  now: number;
  latencyP95: number;
  recentErrorIds: Set<string>;
}

export function scoreCar(car: CarState, ctx: ScoreContext): number {
  let score = 0;

  if (ctx.recentErrorIds.has(car.car_id)) score += DIRECTOR_WEIGHTS.error;

  // 타이어는 모드가 켜져 있을 때만 신호가 된다 (PRD §9.1).
  // 소스가 없는 게이지로 "임계 도달"을 주장하지 않는다.
  const tyreLow = car.tyre_pct !== undefined && car.tyre_pct < 15;
  if (car.fuel_pct < 20 || tyreLow) score += DIRECTOR_WEIGHTS.limitThreshold;

  const idle = ctx.now - car.last_event_ts;
  if (idle < 30_000 && idle >= 0) {
    // 최근 활동은 기본 관심도를 준다. 조용할수록 감쇠한다.
    score += DIRECTOR_WEIGHTS.milestone * (1 - idle / 30_000);
  } else {
    score -= Math.min(50, idle / 60_000);
  }

  return score;
}

interface SlotState {
  carId: string;
  since: number;
}

export class Director {
  private slots: SlotState[] = [];
  private pinned = new Set<string>();
  private lastPickedAt = new Map<string, number>();
  private lastSwapAt = 0;

  constructor(private readonly slotCount: number) {}

  pin(carId: string): void {
    this.pinned.add(carId);
  }

  unpin(carId: string): void {
    this.pinned.delete(carId);
  }

  update(state: RaceState, now: number): string[] {
    const eligible = [...state.cars.values()].filter(
      (c) => activityOf(c, now) !== 'retired',
    );

    const ctx: ScoreContext = {
      now,
      latencyP95: 0,
      recentErrorIds: new Set(
        eligible.filter((c) => c.error_count > 0 && now - c.last_event_ts < 30_000)
          .map((c) => c.car_id),
      ),
    };

    const ranked = eligible
      .map((c) => ({ carId: c.car_id, score: scoreCar(c, ctx), lastTs: c.last_event_ts }))
      .sort((a, b) => b.score - a.score || b.lastTs - a.lastTs);

    const pinnedPresent = [...this.pinned].filter((id) => state.cars.has(id));
    const next: SlotState[] = [];
    const taken = new Set<string>();

    // 1. 핀 고정이 무조건 먼저 자리를 차지한다.
    for (const carId of pinnedPresent) {
      if (next.length >= this.slotCount) break;
      const existing = this.slots.find((s) => s.carId === carId);
      next.push({ carId, since: existing?.since ?? now });
      taken.add(carId);
    }

    // 2. 최소 노출 시간을 못 채운 기존 슬롯을 유지한다.
    for (const slot of this.slots) {
      if (next.length >= this.slotCount) break;
      if (taken.has(slot.carId)) continue;
      if (!state.cars.has(slot.carId)) continue;
      if (now - slot.since < DIRECTOR_TIMING.minDwellMs) {
        next.push(slot);
        taken.add(slot.carId);
      }
    }

    // 3. 교체 간격을 못 채웠으면 나머지 기존 슬롯도 그대로 둔다.
    const canSwap = now - this.lastSwapAt >= DIRECTOR_TIMING.slotSwapIntervalMs;
    if (!canSwap) {
      for (const slot of this.slots) {
        if (next.length >= this.slotCount) break;
        if (taken.has(slot.carId)) continue;
        if (!state.cars.has(slot.carId)) continue;
        next.push(slot);
        taken.add(slot.carId);
      }
    }

    // 4. 남은 자리를 점수 순으로 채운다. 쿨다운 중인 차량은 건너뛴다.
    for (const candidate of ranked) {
      if (next.length >= this.slotCount) break;
      if (taken.has(candidate.carId)) continue;
      const lastPicked = this.lastPickedAt.get(candidate.carId);
      const onCooldown =
        lastPicked !== undefined &&
        now - lastPicked < DIRECTOR_TIMING.reselectCooldownMs &&
        !this.slots.some((s) => s.carId === candidate.carId);
      if (onCooldown) continue;
      next.push({ carId: candidate.carId, since: now });
      taken.add(candidate.carId);
    }

    // 5. 그래도 비면 쿨다운을 무시하고 채운다. 빈 카드는 화면을 죽인다.
    for (const candidate of ranked) {
      if (next.length >= this.slotCount) break;
      if (taken.has(candidate.carId)) continue;
      next.push({ carId: candidate.carId, since: now });
      taken.add(candidate.carId);
    }

    const changed =
      next.length !== this.slots.length ||
      next.some((s, i) => s.carId !== this.slots[i]?.carId);
    if (changed) this.lastSwapAt = now;

    for (const slot of next) this.lastPickedAt.set(slot.carId, now);
    this.slots = next;
    return next.map((s) => s.carId);
  }
}
