import type { EventKind } from '../types';

export type BroadcastSeverity = 'critical' | 'warn' | 'info';
export type BroadcastStoppedReason = 'error' | 'limit';

export interface BroadcastCandidate {
  readonly carId: string;
  readonly lastEventTs: number;
  readonly fresh: boolean;
  readonly stoppedReason: BroadcastStoppedReason | null;
  readonly recentEvent: { readonly ts: number; readonly severity: BroadcastSeverity } | null;
  readonly workPerMin: number;
  readonly previousWorkPerMin: number | null;
}

export type BroadcastSelection =
  | { readonly kind: 'empty' }
  | {
    readonly kind: 'selected';
    readonly carId: string;
    readonly score: number;
    readonly source: 'manual' | 'automatic';
  };

const EVENT_WINDOW_MS = 10_000;
const DWELL_MS = 5_000;
const PREEMPT_SCORE = 100;

export function broadcastSeverityOf(kind: EventKind): BroadcastSeverity | null {
  switch (kind) {
    case 'retire': return 'critical';
    case 'error':
    case 'limit_warn': return 'warn';
    case 'pit_in':
    case 'pit_out': return 'info';
    case 'call': return null;
  }
}

export function scoreBroadcastCandidate(candidate: BroadcastCandidate, now: number): number {
  if (candidate.stoppedReason === 'error') return 400;
  if (candidate.stoppedReason === 'limit') return 300;
  if (candidate.recentEvent && now - candidate.recentEvent.ts <= EVENT_WINDOW_MS) {
    switch (candidate.recentEvent.severity) {
      case 'critical': return 200;
      case 'warn': return 100;
      case 'info': return 25;
    }
  }
  const previous = candidate.previousWorkPerMin;
  if (previous !== null && previous > 0
    && Math.abs(candidate.workPerMin - previous) / previous >= 0.25) return 50;
  return candidate.fresh ? 1 : 0;
}

function compare(
  left: { readonly candidate: BroadcastCandidate; readonly score: number },
  right: { readonly candidate: BroadcastCandidate; readonly score: number },
): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.candidate.workPerMin !== right.candidate.workPerMin) {
    return right.candidate.workPerMin - left.candidate.workPerMin;
  }
  if (left.candidate.lastEventTs !== right.candidate.lastEventTs) {
    return right.candidate.lastEventTs - left.candidate.lastEventTs;
  }
  return left.candidate.carId < right.candidate.carId ? -1
    : left.candidate.carId > right.candidate.carId ? 1 : 0;
}

export class BroadcastDirector {
  private current: { readonly carId: string; readonly score: number; readonly since: number } | null = null;

  select(
    candidates: readonly BroadcastCandidate[],
    now: number,
    manualCarId: string | null = null,
  ): BroadcastSelection {
    if (manualCarId !== null) {
      return { kind: 'selected', carId: manualCarId, score: 0, source: 'manual' };
    }
    const ranked = candidates
      .map((candidate) => ({ candidate, score: scoreBroadcastCandidate(candidate, now) }))
      .filter(({ score }) => score > 0)
      .sort(compare);
    const best = ranked[0];
    if (!best) {
      this.current = null;
      return { kind: 'empty' };
    }

    const current = this.current;
    if (current && now - current.since < DWELL_MS) {
      const currentEntry = ranked.find(({ candidate }) => candidate.carId === current.carId);
      const currentScore = currentEntry?.score ?? current.score;
      if (best.candidate.carId !== current.carId && best.score - currentScore < PREEMPT_SCORE) {
        return { kind: 'selected', carId: current.carId, score: currentScore, source: 'automatic' };
      }
    }

    if (!current || current.carId !== best.candidate.carId) {
      this.current = { carId: best.candidate.carId, score: best.score, since: now };
    } else {
      this.current = { ...current, score: best.score };
    }
    return { kind: 'selected', carId: best.candidate.carId, score: best.score, source: 'automatic' };
  }
}
