import { describe, expect, it } from 'vitest';
import {
  BroadcastDirector,
  scoreBroadcastCandidate,
  type BroadcastCandidate,
} from '../src/director/broadcastDirector';

const T = 1_000_000;

function candidate(
  carId: string,
  over: Partial<BroadcastCandidate> = {},
): BroadcastCandidate {
  return {
    carId,
    lastEventTs: T,
    fresh: true,
    stoppedReason: null,
    recentEvent: null,
    workPerMin: 1_000,
    previousWorkPerMin: 1_000,
    ...over,
  };
}

describe('broadcast candidate score', () => {
  it.each([
    ['error', candidate('a', { stoppedReason: 'error' }), 400],
    ['limit', candidate('a', { stoppedReason: 'limit' }), 300],
    ['critical', candidate('a', { recentEvent: { ts: T, severity: 'critical' } }), 200],
    ['warn', candidate('a', { recentEvent: { ts: T, severity: 'warn' } }), 100],
    ['info', candidate('a', { recentEvent: { ts: T, severity: 'info' } }), 25],
    ['25% rate change', candidate('a', { workPerMin: 1_250 }), 50],
    ['fresh', candidate('a'), 1],
  ])('scores an observed %s fact exactly', (_label, observed, expected) => {
    expect(scoreBroadcastCandidate(observed, T)).toBe(expected);
  });

  it('does not score expired events, incomparable rate samples, or stale activity', () => {
    expect(scoreBroadcastCandidate(candidate('a', {
      fresh: false,
      recentEvent: { ts: T - 10_001, severity: 'critical' },
      previousWorkPerMin: null,
    }), T)).toBe(0);
  });
});

describe('automatic broadcast focus', () => {
  it('uses manual focus, deterministic recency/code-point ties, and a typed empty result', () => {
    const manual = new BroadcastDirector().select(
      [candidate('a'), candidate('b', { stoppedReason: 'error' })], T, 'a',
    );
    expect(manual).toEqual({ kind: 'selected', carId: 'a', score: 0, source: 'manual' });

    const recent = new BroadcastDirector().select([
      candidate('a', { lastEventTs: T - 1 }), candidate('b'),
    ], T);
    expect(recent).toEqual({ kind: 'selected', carId: 'b', score: 1, source: 'automatic' });

    const codePoint = new BroadcastDirector().select([candidate('가'), candidate('A')], T);
    expect(codePoint).toEqual({ kind: 'selected', carId: 'A', score: 1, source: 'automatic' });
    expect(new BroadcastDirector().select([], T)).toEqual({ kind: 'empty' });
  });

  it('ranks error above limit above critical above warn/info above rate-change above fresh', () => {
    const rank = (candidates: BroadcastCandidate[]): string | null => {
      const result = new BroadcastDirector().select(candidates, T);
      return result.kind === 'selected' ? result.carId : null;
    };
    expect(rank([
      candidate('error-car', { stoppedReason: 'error' }),
      candidate('limit-car', { stoppedReason: 'limit' }),
    ])).toBe('error-car');
    expect(rank([
      candidate('limit-car', { stoppedReason: 'limit' }),
      candidate('critical-car', { recentEvent: { ts: T, severity: 'critical' } }),
    ])).toBe('limit-car');
    expect(rank([
      candidate('critical-car', { recentEvent: { ts: T, severity: 'critical' } }),
      candidate('warn-car', { recentEvent: { ts: T, severity: 'warn' } }),
      candidate('info-car', { recentEvent: { ts: T, severity: 'info' } }),
    ])).toBe('critical-car');
    expect(rank([
      candidate('warn-car', { recentEvent: { ts: T, severity: 'warn' } }),
      candidate('rate-car', { workPerMin: 1_250 }),
    ])).toBe('warn-car');
    expect(rank([
      candidate('rate-car', { workPerMin: 1_250 }),
      candidate('fresh-car'),
    ])).toBe('rate-car');
  });

  it('excludes a stale candidate from selection unless it has a real error/limit stop', () => {
    const stale = candidate('stale', { fresh: false });
    expect(new BroadcastDirector().select([stale], T)).toEqual({ kind: 'empty' });

    const staleButStopped = candidate('stale-error', { fresh: false, stoppedReason: 'error' });
    expect(new BroadcastDirector().select([stale, staleButStopped], T))
      .toMatchObject({ carId: 'stale-error', score: 400 });
  });

  it('requires a comparable, positive prior sample before scoring a work-rate change', () => {
    const noBaseline = candidate('a', { workPerMin: 1_250, previousWorkPerMin: null, fresh: false });
    expect(scoreBroadcastCandidate(noBaseline, T)).toBe(0);
    const zeroBaseline = candidate('b', { workPerMin: 1_250, previousWorkPerMin: 0, fresh: false });
    expect(scoreBroadcastCandidate(zeroBaseline, T)).toBe(0);
  });

  it('holds for five seconds and distinguishes +99 from +100 preemption', () => {
    const plus99 = new BroadcastDirector();
    expect(plus99.select([candidate('current')], T))
      .toMatchObject({ carId: 'current', score: 1 });

    expect(plus99.select([
      candidate('current'),
      candidate('plus-99', { recentEvent: { ts: T + 1, severity: 'warn' } }),
    ], T + 1)).toMatchObject({ carId: 'current' });

    const plus100 = new BroadcastDirector();
    plus100.select([candidate('current', { recentEvent: { ts: T, severity: 'warn' } })], T);
    expect(plus100.select([
      candidate('current', { recentEvent: { ts: T, severity: 'warn' } }),
      candidate('preempt', { recentEvent: { ts: T + 1, severity: 'critical' } }),
    ], T + 1)).toMatchObject({ carId: 'preempt', score: 200 });

    expect(plus100.select([candidate('after-dwell')], T + 5_001))
      .toMatchObject({ carId: 'after-dwell' });
  });
});
