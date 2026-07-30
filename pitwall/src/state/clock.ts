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

/**
 * 관측된 활동으로 근무창을 만든다.
 *
 * 09:00–18:00은 가정이었고, 실측에서 그 가정은 하루 작업의 61.4%를 창 밖에 버렸다.
 * 18시 한 시간이 하루의 33%였고 20시에도 1.9M 토큰이 돌았다. 사람이 언제 일하는지는
 * 설정이 아니라 로그가 안다.
 *
 * 점심도 빼지 않는다. 가정한 한 시간만큼 시계를 멈추면 실제로는 그때 일한 사람의
 * 진행이 사라진다 — 진짜 공백은 이벤트가 없는 구간으로 데이터에 이미 들어 있다.
 */
export interface ActivitySample {
  ts: number;
  /** 그 호출의 작업 토큰. 창은 호출 수가 아니라 일한 양으로 정한다 */
  work: number;
}

/** 가장자리에서 이만큼도 기여 못 한 시간대는 창 밖으로 뺀다 */
const EDGE_SHARE = 0.01;

export function workdayFromActivity(samples: ActivitySample[]): WorkdayConfig {
  if (samples.length === 0) return DEFAULT_WORKDAY;

  // 시간대별 작업량. 자정에 찍힌 22건(하루의 0.5%) 때문에 창이 7시간 늘어나면
  // 나머지 99.5%가 눈금 한 칸으로 눌린다.
  const byHour = new Array<number>(24).fill(0);
  let total = 0;
  for (const s of samples) {
    const hour = new Date(s.ts).getHours();
    const work = Math.max(0, s.work);
    byHour[hour]! += work;
    total += work;
  }
  // 전부 0이면(작업 토큰이 없는 소스) 호출이 있었던 사실만으로 판단한다.
  if (total === 0) {
    for (const s of samples) byHour[new Date(s.ts).getHours()]! += 1;
    total = samples.length;
  }

  const floor = total * EDGE_SHARE;
  let first = byHour.findIndex((w) => w > floor);
  let last = byHour.length - 1 - [...byHour].reverse().findIndex((w) => w > floor);
  // 하루 전체가 문턱 아래로 흩어져 있으면(고르게 24시간) 있는 그대로 쓴다.
  if (first < 0) {
    first = byHour.findIndex((w) => w > 0);
    last = byHour.length - 1 - [...byHour].reverse().findIndex((w) => w > 0);
  }

  const raceStart = first * 60;
  const raceEnd = Math.min(24 * 60, Math.max(raceStart + 60, (last + 1) * 60));

  return {
    formationStart: Math.max(0, raceStart - 5),
    raceStart,
    // 길이 0인 점심 = 시계를 멈추지 않는다. 진짜 공백은 이벤트가 없는 구간으로
    // 데이터에 이미 들어 있고, 가정한 한 시간을 빼면 그때 일한 사람이 사라진다.
    lunchStart: raceStart,
    lunchEnd: raceStart,
    finalCall: Math.max(raceStart, raceEnd - 5),
    raceEnd,
  };
}
/**
 * 벽시계 표시. 날짜가 빠지면 어느 날 기록인지 화면만 보고 알 수 없다 —
 * 감사 F7이다. 재생 중이면 재생 위치의 시각이지 지금 시각이 아니다.
 */
export function formatWallClock(at: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(at.getMonth() + 1)}/${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}
