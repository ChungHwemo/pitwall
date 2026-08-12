import { describe, it, expect, vi, afterEach } from 'vitest';
import { SimulatorSource } from '../src/source/SimulatorSource';
import { PRESETS } from '../src/config/presets';
import { MODEL_CATALOG, classOfModel, costUsd } from '../src/config/models';
import type { CarEvent } from '../src/types';

afterEach(() => vi.restoreAllMocks());

/** Math.random을 고정값으로 스텁한다. */
function stubRandom(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue(value);
}

function collect(sim: SimulatorSource, ticks: number, startMs = 0, stepMs = 1000): CarEvent[] {
  const out: CarEvent[] = [];
  sim.start((e) => out.push(e));
  for (let i = 1; i <= ticks; i++) sim.tick(startMs + i * stepMs);
  return out;
}

describe('SimulatorSource', () => {
  it('프리셋의 차량 수만큼 고유 car_id를 만든다', () => {
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 12 }, 1);
    expect(sim.carIds.length).toBe(12);
    expect(new Set(sim.carIds).size).toBe(12);
  });

  it('카넘버는 1..999 범위이며 중복되지 않는다', () => {
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 50 }, 1);
    const numbers = sim.carIds.map((id) => sim.profileOf(id).car_number);
    expect(new Set(numbers).size).toBe(50);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(999);
    }
  });

  it('start 전 tick은 무시되고 start 후에만 이벤트가 나온다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.chaos, carCount: 5 }, 1);
    const out: CarEvent[] = [];
    sim.tick(1000);          // 콜백이 없는 상태 — 삼켜야 한다
    expect(out).toEqual([]);
    sim.start((e) => out.push(e));
    sim.tick(2000);          // 첫 tick은 시간 기준선만 잡는다
    sim.tick(3000);
    expect(out.length).toBeGreaterThan(0);
  });

  it('start 후 첫 tick은 시간 기준선만 잡고 아무것도 내지 않는다', () => {
    // 경과 시간을 모르는 상태에서 발화 확률을 계산할 수 없다.
    // 이전 tick이 없으면 delta가 0이고, 0인 구간에는 이벤트가 없다.
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.chaos, carCount: 5 }, 1);
    const out: CarEvent[] = [];
    sim.start((e) => out.push(e));
    sim.tick(1000);
    expect(out).toEqual([]);
  });

  it('stop 이후에는 이벤트를 내지 않는다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource(PRESETS.chaos, 1);
    const out: CarEvent[] = [];
    sim.start((e) => out.push(e));
    sim.tick(1000);
    const afterStart = out.length;
    sim.stop();
    sim.tick(2000);
    expect(out.length).toBe(afterStart);
  });

  it('발화 확률이 0에 수렴하면 이벤트가 없다 (sparse 안전성)', () => {
    stubRandom(0.9999);
    const sim = new SimulatorSource(PRESETS.sparse, 1);
    expect(collect(sim, 20)).toEqual([]);
  });

  it('발화 확률이 1에 수렴하면 이벤트가 쏟아진다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 10 }, 1);
    expect(collect(sim, 5).length).toBeGreaterThan(0);
  });

  it('방출된 이벤트가 CarEvent 계약을 지킨다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 5 }, 1);
    const events = collect(sim, 3);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(['H', 'P', 'GT']).toContain(e.car_class);
      expect(e.tokens.prompt).toBeGreaterThan(0);
      expect(e.tokens.completion).toBeGreaterThanOrEqual(0);
      expect(e.fuel_pct).toBeGreaterThanOrEqual(0);
      expect(e.fuel_pct).toBeLessThanOrEqual(100);
      // 타이어 모드가 off면 필드 자체가 없다 (PRD §7.0). 있으면 범위를 지킨다.
      if (e.tyre_pct !== undefined) {
        expect(e.tyre_pct).toBeGreaterThanOrEqual(0);
        expect(e.tyre_pct).toBeLessThanOrEqual(100);
      }
      expect(e.latency_ms).toBeGreaterThan(0);
      expect(typeof e.cache_hit).toBe('boolean');
      expect(e).not.toHaveProperty('messages');
      expect(e).not.toHaveProperty('response');
    }
  });

  it('tyreMode가 off면 tyre_pct 필드를 방출하지 않는다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 5, tyreMode: 'off' }, 1);
    for (const e of collect(sim, 3)) {
      // 데이터 소스가 없는 것과 잔량 0은 다르다. 0을 넣으면 게이지가 "소진"으로 보인다.
      expect(e.tyre_pct).toBeUndefined();
    }
  });

  it('tyreMode가 off가 아니면 tyre_pct를 범위 안에서 방출한다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 5, tyreMode: 'rolling_budget' }, 1);
    const events = collect(sim, 3);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.tyre_pct).toBeGreaterThanOrEqual(0);
      expect(e.tyre_pct).toBeLessThanOrEqual(100);
    }
  });

  it('타이어는 tyreBurnPerCall로 닳는다 — 연료 소모율을 재사용하지 않는다', () => {
    stubRandom(0.0001);
    const preset = {
      ...PRESETS.busy, carCount: 1, tyreMode: 'rolling_budget' as const,
      fuelBurnPerCall: 0.1, tyreBurnPerCall: 5,
    };
    // 2틱: 첫 틱은 기준선, 둘째 틱이 첫 이벤트를 낸다.
    const first = collect(new SimulatorSource(preset, 1), 2)[0]!;
    expect(first.tyre_pct).toBeCloseTo(95, 6);
    expect(first.fuel_pct).toBeCloseTo(99.9, 6);
  });

  it('연료는 소진 방향으로만 움직이고 음수가 되지 않는다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.chaos, carCount: 3 }, 1);
    const events = collect(sim, 200);
    const byCar = new Map<string, number[]>();
    for (const e of events) {
      if (!byCar.has(e.car_id)) byCar.set(e.car_id, []);
      byCar.get(e.car_id)!.push(e.fuel_pct);
    }
    for (const series of byCar.values()) {
      for (let i = 1; i < series.length; i++) {
        expect(series[i]!).toBeLessThanOrEqual(series[i - 1]!);
      }
      expect(Math.min(...series)).toBeGreaterThanOrEqual(0);
    }
  });

  it('배속을 바꾸면 같은 실시간에 더 많은 이벤트가 나온다', () => {
    stubRandom(0.0001);
    const slow = new SimulatorSource({ ...PRESETS.busy, carCount: 8 }, 1);
    const fast = new SimulatorSource({ ...PRESETS.busy, carCount: 8 }, 60);
    const slowCount = collect(slow, 10).length;
    const fastCount = collect(fast, 10).length;
    expect(fastCount).toBeGreaterThanOrEqual(slowCount);
  });

  it('모델이 카탈로그에서 나오고 클래스와 일치한다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 30 }, 1);
    for (const e of collect(sim, 3)) {
      expect(classOfModel(e.model), `${e.model}이 카탈로그에 없다`).toBe(e.car_class);
    }
  });

  it('세 공급자 이상이 실제로 등장한다 — 한 벤더로 쏠리지 않는다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 60 }, 1);
    const models = new Set(collect(sim, 3).map((e) => e.model));
    const providers = new Set(
      [...models].map((id) => MODEL_CATALOG.find((m) => m.id === id)!.provider),
    );
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });

  it('비용이 그 모델의 실제 단가로 계산된다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 5 }, 1);
    for (const e of collect(sim, 2)) {
      const spec = MODEL_CATALOG.find((m) => m.id === e.model)!;
      // 추론도 출력처럼 과금된다 — completion에 도로 합쳐 단가를 잰다.
      const output = e.tokens.completion + (e.tokens.reasoning ?? 0);
      const cached = e.tokens.cache_read ?? 0;
      const expected = costUsd(spec, e.tokens.prompt - cached, cached, output);
      expect(e.cost_usd).toBeCloseTo(expected, 12);
    }
  });

  it('추론 토큰을 출력과 나눠 담고 음수가 아니다', () => {
    stubRandom(0.0001);
    const sim = new SimulatorSource({ ...PRESETS.busy, carCount: 5 }, 1);
    const events = collect(sim, 3);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.tokens.reasoning ?? 0).toBeGreaterThanOrEqual(0);
      expect(e.tokens.completion).toBeGreaterThanOrEqual(0);
    }
  });

  it('setSpeed가 배속을 바꾼다', () => {
     const sim = new SimulatorSource(PRESETS.busy, 1);
     sim.setSpeed(100);
     expect(sim.speed).toBe(100);
  });
});
