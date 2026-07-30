import type { WorkdayConfig } from '../state/clock';
import { DEFAULT_WORKDAY } from '../state/clock';
import type { PresetName } from './presets';

export interface PitwallSettings {
  workday: WorkdayConfig;
  preset: PresetName;
  speed: 1 | 60 | 600;
  tyreMode: 'off' | 'rolling_budget' | 'proxy_budget';
  fuelWarnLeadMinutes: number;
  fuelWarnThresholdPct: number;
  minTeamSizeForIndividual: number;
  cameraSlots: number;
  cameraMinExposureMs: number;
  cameraReselectCooldownMs: number;
  cameraSlotSwapMinIntervalMs: number;
  radioRepeatSuppressMs: number;
  laneRenderCap: number;
  motion: boolean;
  sound: boolean;
}

// 레이스 시간은 여기 없다. workday에서 파생한다 (PRD §7.0).
export const DEFAULT_SETTINGS: PitwallSettings = {
  workday: DEFAULT_WORKDAY,
  preset: 'busy',
  speed: 1,
  tyreMode: 'off',
  fuelWarnLeadMinutes: 60,
  fuelWarnThresholdPct: 20,
  minTeamSizeForIndividual: 10,
  cameraSlots: 3,
  cameraMinExposureMs: 8_000,
  cameraReselectCooldownMs: 60_000,
  cameraSlotSwapMinIntervalMs: 3_000,
  radioRepeatSuppressMs: 1_800_000,
  laneRenderCap: 40,
  motion: true,
  sound: false,
};

export const SETTINGS_STORAGE_KEY = 'pitwall.settings';
export const ORG_SETTINGS_URL = './pitwall.settings.json';

/**
 * 완화하면 제품이 죽는 값들. 방향을 한쪽으로만 연다 (PRD §7.0 조정 불가 항목).
 * 설정 파일에 무엇을 써도 여기서 되돌린다.
 */
export function clampSettings(s: PitwallSettings): PitwallSettings {
  return {
    ...s,
    minTeamSizeForIndividual: Math.max(10, s.minTeamSizeForIndividual),
    cameraMinExposureMs: Math.max(8_000, s.cameraMinExposureMs),
    cameraReselectCooldownMs: Math.max(60_000, s.cameraReselectCooldownMs),
    cameraSlotSwapMinIntervalMs: Math.max(3_000, s.cameraSlotSwapMinIntervalMs),
    radioRepeatSuppressMs: Math.max(1_800_000, s.radioRepeatSuppressMs),
    laneRenderCap: Math.min(40, s.laneRenderCap),   // 성능 예산이라 방향이 반대다
  };
}

export function resolveSettings(
  org: Partial<PitwallSettings>,
  local: Partial<PitwallSettings>,
  session: Partial<PitwallSettings>,
): PitwallSettings {
  return clampSettings({ ...DEFAULT_SETTINGS, ...org, ...local, ...session });
}

export function loadLocalSettings(): Partial<PitwallSettings> {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<PitwallSettings>)
      : {};
  } catch {
    return {};
  }
}

export function saveLocalSettings(s: Partial<PitwallSettings>): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
}

/**
 * 조직 기본값 파일은 없어도 된다. 없으면 내장 기본값으로 간다.
 * 같은 오리진의 배포 자산을 읽을 뿐 아무것도 보내지 않는다 — PRIV-6이 금지하는 것은 전송이다.
 */
export async function loadOrgSettings(): Promise<Partial<PitwallSettings>> {
  try {
    const res = await fetch(ORG_SETTINGS_URL);
    if (!res.ok) return {};
    const parsed: unknown = await res.json();
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<PitwallSettings>)
      : {};
  } catch {
    return {};
  }
}
