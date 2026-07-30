import type { RacePhase } from '../types';

export interface WorkdayConfig {
  /** 분 단위 자정 기준 오프셋 */
  formationStart: number;  // 08:55 → 535
  raceStart: number;       // 09:00 → 540
  lunchStart: number;      // 12:00 → 720
  lunchEnd: number;        // 13:00 → 780
  finalCall: number;       // 17:55 → 1075
  raceEnd: number;         // 18:00 → 1080
}

export const DEFAULT_WORKDAY: WorkdayConfig = {
  formationStart: 8 * 60 + 55,
  raceStart: 9 * 60,
  lunchStart: 12 * 60,
  lunchEnd: 13 * 60,
  finalCall: 17 * 60 + 55,
  raceEnd: 18 * 60,
};

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function phaseAt(now: Date, cfg: WorkdayConfig): RacePhase {
  const m = minutesOfDay(now);
  if (m < cfg.formationStart) return 'pre_grid';
  if (m < cfg.raceStart) return 'formation';
  if (m >= cfg.raceEnd) return 'chequered';
  if (m >= cfg.finalCall) return 'final_call';
  if (m >= cfg.lunchStart && m < cfg.lunchEnd) return 'lunch_pit';
  return 'racing';
}

/**
 * 레이스 시간은 설정이 아니라 파생값이다 (PRD §7.0).
 * 근무 종료 − 근무 시작 − 휴식. 기본 18:00 − 09:00 − 1h = 8시간.
 */
export function raceDurationMs(cfg: WorkdayConfig): number {
  const lunch = Math.max(0, cfg.lunchEnd - cfg.lunchStart);
  return (cfg.raceEnd - cfg.raceStart - lunch) * 60_000;
}

/** 점심은 경과 시간에 누산하지 않는다 — 점심에 시계가 멈춰야 "8시간 레이스"가 참이 된다. */
export function elapsedMs(now: Date, cfg: WorkdayConfig): number {
  const m = minutesOfDay(now);
  if (m < cfg.raceStart) return 0;

  let minutes = Math.min(m, cfg.raceEnd) - cfg.raceStart;
  if (m >= cfg.lunchEnd) {
    minutes -= cfg.lunchEnd - cfg.lunchStart;
  } else if (m > cfg.lunchStart) {
    minutes -= m - cfg.lunchStart;   // 점심 중에는 진입 시점에 고정
  }

  return Math.max(0, Math.min(minutes * 60_000, raceDurationMs(cfg)));
}
