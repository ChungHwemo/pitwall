import type { WorkdayConfig } from '../state/clock';
import { DEFAULT_WORKDAY } from '../state/clock';
import type { PresetName } from './presets';
import type { HighlightType } from '../track/trackModel';

export interface PitwallSettings {
  workday: WorkdayConfig;
  preset: PresetName;
  speed: 1 | 20 | 30 | 100;
  tyreMode: 'off' | 'rolling_budget' | 'proxy_budget';
  /** 개별 추적할 이벤트 유형. 비워도 클러스터·밀도는 그대로 보인다. */
  highlightTypes: HighlightType[];
  /**
   * 벽시계를 근무 창 안으로 접어 항상 레이스가 돌게 한다.
   * v1은 데이터가 시뮬레이터라 기본 켜둔다. 실데이터를 붙이면 꺼야 한다.
   */
  demoClock: boolean;
  fuelWarnLeadMinutes: number;
  fuelWarnThresholdPct: number;
  /** 한도 창 잔여가 이 아래면 강조한다. 연료와 다른 축이다. */
  limitWarnThresholdPct: number;
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
  speed: 30,
  tyreMode: 'off',
  highlightTypes: ['error', 'limit'],
  demoClock: true,
  fuelWarnLeadMinutes: 60,
  fuelWarnThresholdPct: 20,
  limitWarnThresholdPct: 15,
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
/** 조직 설정 파일을 기다리는 한계. 같은 오리진의 작은 파일이라 이보다 오래 걸리면 없는 것이다. */
export const ORG_SETTINGS_TIMEOUT_MS = 2_000;

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

/**
 * 기본값과 **모양이 다른 값**은 기본값으로 되돌린다.
 *
 * 설정은 localStorage와 같은 오리진의 JSON 파일에서 온다. 둘 다 사용자가 고칠 수
 * 있고, 예전 버전이 남긴 값도 그대로 들어온다. `speed`가 문자열이거나 NaN이면
 * `Math.max(1, speed)`가 NaN이 되고, 그 값이 스파크라인 창·소진 속도·유휴 판정의
 * **분모**라서 화면 전체가 조용히 빈칸이 된다 — 어디가 고장인지도 안 보인다.
 *
 * 스키마를 따로 두지 않는다. 기본값 객체가 이미 형(型)의 정의다.
 */
/**
 * 한 칸만 본다. 통과했을 때만 쓴다.
 *
 * 단언은 세 검사를 지난 **뒤에만** 나온다 — 런타임에서 모양을 확인한 값을
 * 컴파일러에 알려주는 것뿐이고, 검사를 건너뛰는 우회가 아니다.
 */
function keep<K extends keyof PitwallSettings>(
  out: PitwallSettings, key: K, value: unknown,
): void {
  const fallback = DEFAULT_SETTINGS[key];
  if (typeof value !== typeof fallback) return;
  if (typeof value === 'number' && !Number.isFinite(value)) return;
  // 배열 자리에 객체가 오면 typeof로는 안 걸린다.
  if (Array.isArray(fallback) !== Array.isArray(value)) return;
  out[key] = value as PitwallSettings[K];
}

function sane(merged: Partial<Record<keyof PitwallSettings, unknown>>): PitwallSettings {
  const out: PitwallSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PitwallSettings)[]) {
    keep(out, key, merged[key]);
  }
  return out;
}

/**
 * 밖에서 들어오는 설정의 정직한 타입.
 *
 * `Partial<PitwallSettings>`라고 쓰면 **거짓말이다** — localStorage와 JSON 파일은
 * 아무 모양이나 담을 수 있고, 예전 버전이 남긴 값도 그대로 온다. 타입으로
 * 아는 척하는 대신 모른다고 쓰고, `sane`이 런타임에서 확인한다.
 */
export type SettingsInput = Partial<Record<keyof PitwallSettings, unknown>> & {
  /**
   * 모델별 로컬 단가 보정 섹션 (`{ models: {...} }`, tokscale custom-pricing 모양).
   *
   * `PitwallSettings` 키가 **아니다** — UI 설정이 아니라 데이터 계층 보정이다.
   * `sane()`는 `DEFAULT_SETTINGS`의 키만 돌므로 이 섹션을 그냥 무시한다. 그래서
   * `pricingOverride`는 `resolveSettings`가 만드는 `PitwallSettings`로 새지 않고,
   * `loadPricingOverride`(pricingOverride.ts)가 org/local 원본에서 따로 읽는다.
   */
  pricingOverride?: unknown;
};

export function resolveSettings(
  org: SettingsInput,
  local: SettingsInput,
  session: SettingsInput,
): PitwallSettings {
  return clampSettings(sane({ ...org, ...local, ...session }));
}

export function loadLocalSettings(): SettingsInput {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
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
export async function loadOrgSettings(): Promise<SettingsInput> {
  // file:// 로 열면(단일 파일 배포·앱 래핑) fetch가 스킴을 거부하며 콘솔 에러를 남긴다.
  // 조직 파일은 없어도 되는 물건이라, 아예 시도하지 않는다.
  if (!globalThis.location?.protocol.startsWith('http')) return {};
  try {
    /*
     * 타임아웃이 없으면 이 한 줄이 화면 전체를 붙잡는다.
     *
     * `browser.ts`가 이 결과를 기다린 **뒤에** 앱을 만든다. 서버가 느리거나
     * 응답을 안 주면 앱이 아예 생성되지 않고 화면이 무한히 빈 채로 남는다 —
     * 상시 노출 화면에서 그건 죽은 벽이다. 없어도 되는 파일 하나가 전체를
     * 막게 두지 않는다. 못 받으면 내장 기본값으로 간다.
     */
    const res = await fetch(ORG_SETTINGS_URL, { signal: AbortSignal.timeout(ORG_SETTINGS_TIMEOUT_MS) });
    if (!res.ok) return {};
    const parsed: unknown = await res.json();
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as SettingsInput)
      : {};
  } catch {
    return {};
  }
}
