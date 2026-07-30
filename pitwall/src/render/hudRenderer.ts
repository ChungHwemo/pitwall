import type { WorkdayConfig } from '../state/clock';
import { elapsedMs, raceDurationMs } from '../state/clock';

export interface SalaryConfig {
  annualSalary: number;
  workdaysPerYear: number;
}

export const SALARY_STORAGE_KEY = 'pitwall.salary';

/**
 * 연봉 정보는 localStorage에만 저장한다. 서버로 보내지 않는다 (PRD PRIV-6).
 * 이 파일에 네트워크 호출을 추가하면 안 된다.
 */
export function saveSalaryConfig(cfg: SalaryConfig): void {
  localStorage.setItem(SALARY_STORAGE_KEY, JSON.stringify(cfg));
}

export function loadSalaryConfig(): SalaryConfig | null {
  const raw = localStorage.getItem(SALARY_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof (parsed as SalaryConfig).annualSalary === 'number' &&
      typeof (parsed as SalaryConfig).workdaysPerYear === 'number'
    ) {
      return parsed as SalaryConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function earnedSoFar(cfg: SalaryConfig, workday: WorkdayConfig, now: Date): number {
  // 분모는 근무 창 길이가 아니라 레이스 시간(휴식 제외)이다. 분자와 같은 척도여야 한다.
  const totalMs = raceDurationMs(workday);
  if (totalMs <= 0) return 0;
  const perDay = cfg.annualSalary / cfg.workdaysPerYear;
  return perDay * (elapsedMs(now, workday) / totalMs);
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
