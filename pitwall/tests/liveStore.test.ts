import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serializeLiveState, saveLiveSnapshot, loadLiveSnapshot, clearLiveSnapshot,
  rebaseLiveSnapshot, LIVE_STORAGE_KEY, LIVE_SNAPSHOT_TTL_MS, type LiveSnapshot,
} from '../src/session/liveStore';
import { emptyRaceState } from '../src/state/reducer';
import type { CarState, ModelTally, RaceState } from '../src/types';
import type { ActivitySample } from '../src/state/clock';

function car(over: Partial<CarState> = {}): CarState {
  return {
    car_id: 'car-1', car_number: 42, model: 'gpt-5.6-sol', car_class: 'P',
    activity: 'running', distance: 12_000, cached: 500_000, reasoning: 300,
    hourly: new Array(24).fill(0).map((_, i) => (i === 14 ? 12_000 : 0)),
    fuel_pct: 80, tyre_pct: 60, limit_window_minutes: 10_080,
    limit_resets_at: 1_785_913_052_000, limit_observed_at: 1_785_900_000_000,
    cost_usd: 1.23, last_event_ts: 1_000, error_count: 1,
    saved_usd: 0.9, work_per_min: 400, last_error_ts: 900,
    cache_hits: 3, call_count: 7, skill: 'superpowers:tdd', ...over,
  };
}

function stateWith(cars: [string, CarState][], byModel: [string, ModelTally][], now: number): RaceState {
  return { ...emptyRaceState(now), cars: new Map(cars), byModel: new Map(byModel) };
}

const TALLY: ModelTally = { calls: 7, work: 12_000, cached: 500_000, cost: 1.23 };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('실시간 스냅샷 직렬화', () => {
  it('cars·byModel를 왕복해도 누적이 유지된다 — Map↔Record 직렬화', () => {
    const state = stateWith([['car-1', car()]], [['gpt-5.6-sol', TALLY]], 2_000);
    const samples: ActivitySample[] = [{ ts: 1_785_900_000_000, work: 5_000 }];
    saveLiveSnapshot(serializeLiveState(state, samples, Date.now()));

    const loaded = loadLiveSnapshot()!;
    expect(loaded).not.toBeNull();
    expect(loaded.state.cars['car-1']!.distance).toBe(12_000);
    expect(loaded.state.cars['car-1']!.call_count).toBe(7);
    expect(loaded.state.cars['car-1']!.cost_usd).toBe(1.23);
    expect(loaded.state.byModel['gpt-5.6-sol']).toEqual(TALLY);
    expect(loaded.samples).toEqual(samples);
  });

  it('v·savedAt·now 메타를 담는다', () => {
    const snap = serializeLiveState(stateWith([], [], 4_200), [], 123_456);
    expect(snap.v).toBe(1);
    expect(snap.savedAt).toBe(123_456);
    expect(snap.now).toBe(4_200);
  });
});

describe('실시간 스냅샷 검증', () => {
  it('저장이 없으면 null이다', () => {
    expect(loadLiveSnapshot()).toBeNull();
  });

  it('깨진 JSON은 null이다', () => {
    localStorage.setItem(LIVE_STORAGE_KEY, 'not json at all');
    expect(loadLiveSnapshot()).toBeNull();
  });

  it('버전이 다르면 null이다 — 형식이 바뀌면 옛 저장을 믿지 않는다', () => {
    const snap = serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], Date.now());
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify({ ...snap, v: 2 }));
    expect(loadLiveSnapshot()).toBeNull();
  });

  it('형태가 불량이면 null이다', () => {
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify({ v: 1, savedAt: 1, now: 1, state: null, samples: [] }));
    expect(loadLiveSnapshot()).toBeNull();
  });

  it('12시간을 넘기면 null이다 — 어제 레이스를 오늘 것으로 주장하지 않는다', () => {
    const savedAt = 1_000_000_000_000;
    saveLiveSnapshot(serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], savedAt));
    expect(loadLiveSnapshot(savedAt + LIVE_SNAPSHOT_TTL_MS + 1)).toBeNull();
    expect(loadLiveSnapshot(savedAt + LIVE_SNAPSHOT_TTL_MS - 1)).not.toBeNull();
  });

  it('clearLiveSnapshot가 저장을 지운다', () => {
    saveLiveSnapshot(serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], Date.now()));
    clearLiveSnapshot();
    expect(loadLiveSnapshot()).toBeNull();
  });
});

describe('실시간 스냅샷 재기준화', () => {
  const snap = (): LiveSnapshot =>
    serializeLiveState(stateWith([['car-1', car()]], [['gpt-5.6-sol', TALLY]], 2_000),
      [{ ts: 1_785_900_000_000, work: 5_000 }], Date.now());

  it('페이지 상대 시각은 delta만큼 시프트한다', () => {
    const { state } = rebaseLiveSnapshot(snap(), 10_000); // delta = 10000 - 2000 = 8000
    const c = state.cars.get('car-1')!;
    expect(state.now).toBe(10_000);
    expect(c.last_event_ts).toBe(1_000 + 8_000);
    expect(c.last_error_ts).toBe(900 + 8_000);
  });

  it('벽시계 값은 시프트하지 않는다 — limit·hourly·samples는 그대로', () => {
    const original = snap();
    const { state, samples } = rebaseLiveSnapshot(original, 10_000);
    const c = state.cars.get('car-1')!;
    expect(c.limit_resets_at).toBe(1_785_913_052_000);
    expect(c.limit_observed_at).toBe(1_785_900_000_000);
    expect(c.hourly).toEqual(original.state.cars['car-1']!.hourly);
    expect(samples).toEqual(original.samples);
  });

  it('last_error_ts가 없으면 시프트하지 않고 부재로 둔다', () => {
    const s = serializeLiveState(
      stateWith([['car-1', car({ last_error_ts: undefined })]], [], 2_000), [], Date.now());
    const { state } = rebaseLiveSnapshot(s, 10_000);
    expect(state.cars.get('car-1')!.last_error_ts).toBeUndefined();
  });

  it('Record를 Map으로 되돌린다 — 누적은 그대로', () => {
    const { state } = rebaseLiveSnapshot(snap(), 10_000);
    expect(state.cars).toBeInstanceOf(Map);
    expect(state.byModel).toBeInstanceOf(Map);
    expect(state.cars.get('car-1')!.distance).toBe(12_000);
    expect(state.byModel.get('gpt-5.6-sol')).toEqual(TALLY);
  });
});

describe('실시간 스냅샷 읽기 실패 격리', () => {
  it('localStorage.getItem이 던져도 loadLiveSnapshot은 던지지 않고 null이다 — boot가 죽지 않는다', () => {
    // Given: 브라우저 저장소가 읽기 자체를 거부한다 (Safari 프라이빗/정책 차단).
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('storage disabled', 'SecurityError');
    });
    // When/Then: 읽기 예외가 boot 경계를 넘지 않고 null로 접힌다.
    expect(() => loadLiveSnapshot()).not.toThrow();
    expect(loadLiveSnapshot()).toBeNull();
  });
});

describe('실시간 스냅샷 미래·형태 거부', () => {
  it('savedAt이 미래면 null이다 — 시계 왜곡/변조 스냅샷으로 상태를 오염시키지 않는다', () => {
    // Given: 로드 시점보다 앞선 savedAt (앞선 시계에서 온 저장 또는 변조).
    const now = 1_000_000_000_000;
    saveLiveSnapshot(serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], now + 60_000));
    // When/Then: 미래 날짜는 만료와 같은 무게로 거부한다.
    expect(loadLiveSnapshot(now)).toBeNull();
  });

  it('객체가 아닌 JSON은 null이다 — 배열/원시값을 스냅샷으로 믿지 않는다', () => {
    // Given: 유효한 JSON이지만 스냅샷 객체가 아니다.
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(42));
    // When/Then: 형태 검증이 restore 전에 걸러낸다.
    expect(loadLiveSnapshot()).toBeNull();
  });

  it('키는 다 있어도 now가 숫자가 아니면 null이다 — 형태만 흉내낸 저장을 거른다', () => {
    // Given: 최상위 키는 다 있으나 시프트 기준값 now가 문자열이다.
    const snap = serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], Date.now());
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify({ ...snap, now: 'soon' }));
    // When/Then: 잘못된 타입은 rebase가 손대기 전에 null로 떨어진다.
    expect(loadLiveSnapshot()).toBeNull();
  });
});
