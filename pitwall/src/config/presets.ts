import type { CarClass } from '../types';

/**
 * 시뮬레이터 파라미터의 단일 출처.
 * 여기 있는 수치는 전부 [Low] 신뢰도 추정이다 (PRD §8.2).
 * 실 LiteLLM 로그 1일치를 확보하는 즉시 교체한다.
 */
export interface SimPreset {
  carCount: number;
  /** 임의 순간에 호출 중인 차량 비율 */
  activeRatio: number;
  /** 호출 간격 로그정규 분포의 중앙값(ms) */
  callIntervalMedianMs: number;
  callIntervalSigma: number;
  errorRate: number;
  cacheHitRate: number;
  /** 지연시간 로그정규 분포의 중앙값(ms) */
  latencyMedianMs: number;
  latencySigma: number;
  /** 클래스 배분 비율. 합이 1이어야 한다 */
  classMix: Record<CarClass, number>;
  /** 호출당 소모하는 연료 비율(%) */
  fuelBurnPerCall: number;
  /**
   * 타이어 게이지 모드 (PRD §7.0). 기본 'off'.
   * off면 CarEvent.tyre_pct 자체를 방출하지 않는다 — 0을 넣지 않는다.
   * 데이터 소스가 없는 것과 잔량이 0인 것은 다르다.
   */
  tyreMode: 'off' | 'rolling_budget' | 'proxy_budget';
  /** 호출당 소모하는 타이어 비율(%). tyreMode가 off면 무시 */
  tyreBurnPerCall: number;
}

export type PresetName = 'busy' | 'sparse' | 'chaos' | 'real';

export const PRESETS: Record<PresetName, SimPreset> = {
  busy: {
    carCount: 120,
    activeRatio: 0.15,
    callIntervalMedianMs: 45_000,
    callIntervalSigma: 0.8,
    errorRate: 0.015,
    cacheHitRate: 0.4,
    latencyMedianMs: 3_200,
    latencySigma: 0.6,
    classMix: { H: 0.2, P: 0.5, GT: 0.3 },
    fuelBurnPerCall: 0.35,
    tyreMode: 'off',
    tyreBurnPerCall: 0.6,
  },
  sparse: {
    carCount: 60,
    activeRatio: 0.03,
    callIntervalMedianMs: 240_000,
    callIntervalSigma: 1.0,
    errorRate: 0.01,
    cacheHitRate: 0.45,
    latencyMedianMs: 2_800,
    latencySigma: 0.6,
    classMix: { H: 0.1, P: 0.4, GT: 0.5 },
    fuelBurnPerCall: 0.2,
    tyreMode: 'off',
    tyreBurnPerCall: 0.3,
  },
  /**
   * 실측 프리셋 — 2026-07-30, Claude Code 트랜스크립트 26,396건 / 9.3일 / 24개 프로젝트.
   * 다른 프리셋의 [Low] 추정과 달리 이 값들은 관측치다 (PRD Q2 해소).
   * 추정치가 실제와 얼마나 달랐는지는 CHECKLIST에 표로 남겼다.
   */
  real: {
    carCount: 24,
    activeRatio: 0.6,
    callIntervalMedianMs: 3_100,
    callIntervalSigma: 1.4,
    errorRate: 0.01,
    cacheHitRate: 0.975,
    latencyMedianMs: 3_200,
    latencySigma: 0.8,
    classMix: { H: 0.42, P: 0.5, GT: 0.08 },
    fuelBurnPerCall: 0.05,
    tyreMode: 'off',
    tyreBurnPerCall: 0,
  },
  chaos: {
    carCount: 200,
    activeRatio: 0.35,
    callIntervalMedianMs: 20_000,
    callIntervalSigma: 0.9,
    errorRate: 0.18,
    cacheHitRate: 0.15,
    latencyMedianMs: 9_000,
    latencySigma: 1.1,
    classMix: { H: 0.4, P: 0.4, GT: 0.2 },
    fuelBurnPerCall: 0.9,
    // chaos만 타이어를 켠다 — off 경로와 on 경로를 둘 다 검수하기 위해서다.
    tyreMode: 'rolling_budget',
    tyreBurnPerCall: 1.5,
  },
};
