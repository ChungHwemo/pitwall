import type { CarClass, CarEvent } from '../types';
import { CAR_CLASSES } from '../types';
import type { SimPreset } from '../config/presets';
import type { ModelSpec } from '../config/models';
import { modelsOfClass, costUsd } from '../config/models';
import type { EventSource } from './EventSource';

interface CarProfile {
  car_id: string;
  car_number: number;
  car_class: CarClass;
  model: ModelSpec;
  fuel_pct: number;
  tyre_pct?: number;   // tyreMode가 off면 undefined로 둔다
}

/** 로그정규 표본. median과 sigma로 파라미터화한다. */
function logNormal(medianMs: number, sigma: number): number {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return medianMs * Math.exp(sigma * z);
}

export class SimulatorSource implements EventSource {
  private profiles = new Map<string, CarProfile>();
  private onEvent: ((event: CarEvent) => void) | null = null;
  private lastTickMs: number | null = null;

  constructor(
    private preset: SimPreset,
    public speed: number,
  ) {
    this.buildFleet();
  }

  private buildFleet(): void {
    const { carCount, classMix, tyreMode } = this.preset;
    // 카넘버는 1..999에서 중복 없이 뽑는다.
    const pool = Array.from({ length: 999 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }

    const cumulative: Array<[CarClass, number]> = [];
    let acc = 0;
    for (const cls of CAR_CLASSES) {
      acc += classMix[cls];
      cumulative.push([cls, acc]);
    }

    for (let i = 0; i < carCount; i++) {
      const r = (i + 0.5) / carCount; // 클래스 배분은 결정론적으로 — 비율을 정확히 맞춘다
      const cls = cumulative.find(([, upper]) => r <= upper)?.[0] ?? 'P';
      const car_id = `car-${String(i).padStart(3, '0')}`;
      // 모델은 클래스 안에서 순환 배정한다 — 한 벤더로 쏠리면 더미 데이터가
      // 실제 조직(여러 공급자를 섞어 쓰는)과 다른 분포를 갖게 된다.
      const fleet = modelsOfClass(cls);
      const model = fleet[i % fleet.length]!;
      this.profiles.set(car_id, {
        car_id,
        car_number: pool[i]!,
        car_class: cls,
        model,
        fuel_pct: 100,
        // 소스가 없으면 필드를 만들지 않는다. 100으로 시작해 0으로 떨어뜨리면
        // "소진됨"이라는 없는 사실을 화면이 주장하게 된다 (PRD §7.0).
        tyre_pct: tyreMode === 'off' ? undefined : 100,
      });
    }
  }

  get carIds(): string[] {
    return [...this.profiles.keys()];
  }

  profileOf(carId: string): CarProfile {
    const p = this.profiles.get(carId);
    if (!p) throw new Error(`unknown car: ${carId}`);
    return p;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  start(onEvent: (event: CarEvent) => void): void {
    this.onEvent = onEvent;
  }

  stop(): void {
    this.onEvent = null;
  }

  tick(nowMs: number): void {
    const emit = this.onEvent;
    if (!emit) return;

    const prev = this.lastTickMs ?? nowMs;
    this.lastTickMs = nowMs;
    const simDeltaMs = Math.max(0, nowMs - prev) * this.speed;
    if (simDeltaMs === 0) return;

    const p = this.preset;
    // 차량 한 대가 이 구간에 호출할 확률 = 활동률 × (구간 / 평균 호출 간격)
    const perCarProbability = Math.min(
      1,
      p.activeRatio * (simDeltaMs / p.callIntervalMedianMs),
    );

    for (const profile of this.profiles.values()) {
      if (profile.fuel_pct <= 0) continue;
      if (Math.random() > perCarProbability) continue;
      emit(this.makeEvent(profile, nowMs));
    }
  }

  private makeEvent(profile: CarProfile, nowMs: number): CarEvent {
    const p = this.preset;
    const isError = Math.random() < p.errorRate;
    const cacheHit = Math.random() < p.cacheHitRate;

    profile.fuel_pct = Math.max(0, profile.fuel_pct - p.fuelBurnPerCall);
    if (profile.tyre_pct !== undefined) {
      profile.tyre_pct = Math.max(0, profile.tyre_pct - p.tyreBurnPerCall);
    }

    const latency = Math.max(1, Math.round(logNormal(p.latencyMedianMs, p.latencySigma)));
    const prompt = Math.max(1, Math.round(logNormal(2_400, 0.7)));
    const completion = isError ? 0 : Math.max(0, Math.round(logNormal(600, 0.8)));

    return {
      ts: nowMs,
      car_id: profile.car_id,
      car_number: profile.car_number,
      car_class: profile.car_class,
      model: profile.model.id,
      kind: isError ? 'error' : profile.fuel_pct <= 0 ? 'retire' : 'call',
      // 캐시 히트면 프롬프트 대부분이 재전송이다 — 실측 분포를 따른다.
      tokens: { prompt, completion, cache_read: cacheHit ? Math.round(prompt * 0.965) : 0 },
      cache_hit: cacheHit,
      cost_usd: costUsd(profile.model, prompt, completion, cacheHit),
      latency_ms: latency,
      ttft_ms: Math.max(1, Math.round(latency * 0.3)),
      status: isError ? 'error' : 'ok',
      error_code: isError ? 'rate_limit' : undefined,
      fuel_pct: profile.fuel_pct,
      tyre_pct: profile.tyre_pct,
    };
  }
}
