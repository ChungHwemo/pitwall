import type { CarState } from '../types';
import { SPARK_CHARS } from './spark';

/**
 * 하루 모양 — 시간대별 작업 토큰을 한 줄 글자 곡선으로.
 *
 * 타워의 스파크라인이 "최근 30분"을 말한다면 이건 "오늘 하루가 어떤 모양이었나"를
 * 말한다. 포메이션 랩부터 체커기까지의 근무일 타임라인 곁에 붙어, 언제 붐볐고
 * 언제 조용했는지를 곁눈질에 얹는다.
 *
 * **조직 합계만 그린다.** 계정별 곡선을 늘어놓으면 그 순간 순위표가 되고
 * (PRD PRIV-2), 줄마다 노드가 계정 수만큼 곱해진다. 그래서 24칸 한 줄이다.
 */

/** hour-of-day 칸 수. `CarState.hourly`와 같은 길이여야 한다. */
const HOURS = 24;

/**
 * 각 계정의 `hourly`(24칸, 벽시계 hour, `workOf` 기준 = 캐시 재전송 제외)를
 * 칸별로 더해 조직 합계를 만든다. `hourly`가 없는 계정(옛 소스)은 건너뛴다 —
 * 0으로 취급하는 것과 결과가 같다.
 */
export function hourlyProfile(cars: Iterable<CarState>): number[] {
  const bins = new Array<number>(HOURS).fill(0);
  for (const car of cars) {
    const hourly = car.hourly;
    if (!hourly) continue;
    for (let h = 0; h < HOURS; h++) bins[h]! += hourly[h] ?? 0;
  }
  return bins;
}

/**
 * 24칸 프로파일을 글자 곡선으로. 스파크라인과 같은 여덟 단계 글리프를 쓴다 —
 * 줄마다 SVG를 붙이면 노드가 곱해지고, 여기 필요한 해상도는 여덟 단계면 충분하다.
 *
 * 전부 0이면 **빈 문자열**을 돌려준다. 곡선 자체를 안 그린다는 신호다 — 0을
 * 공백 24칸으로 그리면 없는 하루를 빈 상자로 주장한다 (연봉 미설정 칸과 같은 규칙).
 * 일부 시간대만 0이면 그 칸은 공백 글리프다 (sparkline과 같은 규약).
 */
export function hourlyCurve(profile: number[]): string {
  const peak = Math.max(...profile);
  if (peak <= 0) return '';

  return profile
    .map((v) => {
      if (v <= 0) return ' ';
      const step = Math.ceil((v / peak) * SPARK_CHARS.length) - 1;
      return SPARK_CHARS[Math.max(0, Math.min(SPARK_CHARS.length - 1, step))]!;
    })
    .join('');
}
