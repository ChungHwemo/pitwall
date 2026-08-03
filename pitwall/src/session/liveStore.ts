import type { CarState, ModelTally, RacePhase, RaceState } from '../types';
import type { ActivitySample } from '../state/clock';

/**
 * 실시간 운영 중 리로드 데이터 손실을 막는 스냅샷 저장소 (REVIEW #12).
 *
 * 이벤트 replay는 방법이 아니다 — 네이티브 `LogTail.swift`가 파일 오프셋을
 * 유지해 WebView 리로드 후 옛 줄을 재전송하지 않으므로 웹 쪽에서 재현이 불가능하다.
 * 대신 누적 상태(RaceState 집계 + 실시간 창 표본)를 `localStorage`에 주기 저장하고,
 * boot 때 LIVE 전환 경로에서 되살린다. `sessionStore`(코스 시드)와는 별도 저장소다.
 *
 * **핵심 함정 — 내부 시계 재기준화.** `LiveSource.tick()`이 이벤트 `ts`를 rAF
 * (페이지 상대, `performance.now` 기반) 시계로 갈아끼운다. 그래서 `raceState.now`,
 * `CarState.last_event_ts`, `CarState.last_error_ts`는 **페이지 상대** 시각이다 —
 * 리로드하면 새 페이지의 rAF 원점이 0으로 리셋되므로 저장값을 그대로 쓰면 모든 차가
 * "먼 미래에 마지막 활동"으로 읽혀 영원히 유휴가 된다. 복원 시 이 세 값을
 * `performance.now() - snap.now`만큼 시프트해 새 페이지 시계에 맞춘다.
 *
 * **시프트하면 안 되는 값(벽시계).** `limit_resets_at`·`limit_observed_at`은 벤더가
 * 준 epoch, `hourly` 버킷 인덱스는 벽시계 hour-of-day, `samples[].ts`는 main.ts가
 * `wall_ts ?? ts`로 이미 wall epoch을 담는다 — 전부 그대로 둔다.
 */

/** 별도 저장소 키. `pitwall.*` 컨벤션, `sessionStore`의 `pitwall.sessions`와 분리. */
export const LIVE_STORAGE_KEY = 'pitwall.live';

/**
 * 스냅샷 유효 기간. 이보다 오래된 저장은 조용히 폐기한다 — 어제 레이스의 누적을
 * 오늘 것으로 주장하지 않기 위해서다. 8시간 근무 + 여유로 12시간.
 */
export const LIVE_SNAPSHOT_TTL_MS = 12 * 3600 * 1000;

/**
 * 저장 형식. Map은 JSON이 안 되므로 `cars`·`byModel`을 Record로 직렬화한다.
 * `phase`·`elapsed_ms`는 render()가 매 프레임 벽시계로 덮어쓰므로 정확성은
 * 프레임이 정정하지만, 형식을 온전히 유지하려고 같이 담는다.
 */
export interface LiveSnapshot {
  /** 형식 버전. 불일치는 조용히 폐기 (sessionStore `isSnapshot` 관례). */
  v: 1;
  /** 저장 시점 벽시계 (`Date.now()`). 만료 판정에만 쓴다. */
  savedAt: number;
  /** 저장 시점 `raceState.now` (페이지 상대 rAF 시계). 시프트 기준값. */
  now: number;
  state: {
    cars: Record<string, CarState>;
    byModel: Record<string, ModelTally>;
    phase: RacePhase;
    elapsed_ms: number;
  };
  /** 실시간 창 표본. `ts`는 wall epoch이라 시프트하지 않는다. */
  samples: ActivitySample[];
}

/**
 * 살아 있는 상태를 스냅샷으로 굳힌다. Map → Record 직렬화만 하고 시계는 손대지
 * 않는다 — 재기준화는 복원 시점의 몫이다.
 */
export function serializeLiveState(
  state: RaceState,
  samples: ActivitySample[],
  savedAt: number = Date.now(),
): LiveSnapshot {
  return {
    v: 1,
    savedAt,
    now: state.now,
    state: {
      cars: Object.fromEntries(state.cars),
      byModel: Object.fromEntries(state.byModel),
      phase: state.phase,
      elapsed_ms: state.elapsed_ms,
    },
    samples: samples.slice(),
  };
}

/**
 * 형태 검증. `sessionStore.isSnapshot` 관례를 그대로 따른다 — 최상위 형태만 보고,
 * 깨진 JSON·버전 불일치·형태 불량은 전부 null로 조용히 떨어뜨린다. 개별 CarState
 * 필드까지 깊이 검증하지 않는 것도 sessionStore와 같은 선택이다.
 */
function isLiveSnapshot(value: unknown): value is LiveSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as LiveSnapshot;
  if (v.v !== 1) return false;
  if (typeof v.savedAt !== 'number' || typeof v.now !== 'number') return false;
  if (typeof v.state !== 'object' || v.state === null) return false;
  const s = v.state as LiveSnapshot['state'];
  return (
    typeof s.cars === 'object' && s.cars !== null &&
    typeof s.byModel === 'object' && s.byModel !== null &&
    typeof s.phase === 'string' &&
    typeof s.elapsed_ms === 'number' &&
    Array.isArray(v.samples)
  );
}

/** 스냅샷을 저장소에 쓴다. 실패(할당량 초과 등)는 호출자가 다룬다. */
export function saveLiveSnapshot(snapshot: LiveSnapshot): void {
  localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(snapshot));
}

/**
 * 저장된 스냅샷을 읽는다. 없음·깨짐·버전 불일치·만료는 모두 null.
 * 만료 판정은 벽시계(`savedAt`)로 한다 — 페이지 상대 `now`는 리로드마다 리셋된다.
 */
export function loadLiveSnapshot(now: number = Date.now()): LiveSnapshot | null {
  const raw = localStorage.getItem(LIVE_STORAGE_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isLiveSnapshot(parsed)) return null;
  if (now - parsed.savedAt > LIVE_SNAPSHOT_TTL_MS) return null;
  return parsed;
}

/** 스냅샷을 지운다. */
export function clearLiveSnapshot(): void {
  localStorage.removeItem(LIVE_STORAGE_KEY);
}

/**
 * 스냅샷을 새 페이지 시계에 맞춰 되살린다.
 *
 * `delta = nowMs - snap.now`만큼 페이지 상대 시각을 밀어 준다. 대상은 딱 세 곳 —
 * `raceState.now`, `CarState.last_event_ts`, `CarState.last_error_ts`. 벽시계값
 * (`limit_resets_at`·`limit_observed_at`·`hourly`·`samples.ts`)은 그대로 둔다.
 * Record → Map 역직렬화도 여기서 한다.
 *
 * @param nowMs 복원 시점의 페이지 시계 (`performance.now()`, rAF와 같은 원점).
 */
export function rebaseLiveSnapshot(
  snap: LiveSnapshot,
  nowMs: number,
): { state: RaceState; samples: ActivitySample[] } {
  const delta = nowMs - snap.now;
  const cars = new Map<string, CarState>();
  for (const [id, car] of Object.entries(snap.state.cars)) {
    cars.set(id, {
      ...car,
      last_event_ts: car.last_event_ts + delta,
      last_error_ts:
        car.last_error_ts === undefined ? undefined : car.last_error_ts + delta,
    });
  }
  const state: RaceState = {
    cars,
    byModel: new Map<string, ModelTally>(Object.entries(snap.state.byModel)),
    phase: snap.state.phase,
    elapsed_ms: snap.state.elapsed_ms,
    now: nowMs,
  };
  return { state, samples: snap.samples.slice() };
}
