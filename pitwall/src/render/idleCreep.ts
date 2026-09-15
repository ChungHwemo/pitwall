/**
 * 무통신 주행선 서행.
 *
 * 사용자 정정(2026-08-09): "데이터 없을시 멈춰있는게 아니고 천천히 이동" —
 * 정지는 error/limit 몫(피트 박스), 느린 이동은 무통신 차량 몫(주행선).
 * 없는 데이터를 지어내진 않되(§15), 진행률이 안 바뀌는 동안에도 화면이
 * 완전히 죽어 보이지 않게 하는 절충이다. `Projector.step()` 반환값 위에만
 * 얹고, `visualProgressOf()`가 읽는 내부 상태는 건드리지 않는다.
 */

/** 무통신(≥5분, `idle`) 주행선 차량의 결정론적 왕복 폭 (progress 단위). */
const IDLE_CREEP_PROGRESS = 0.0006;
const IDLE_CREEP_PERIOD_MS = 8_000;

/**
 * carId → 0..4초 결정적 idle sway 위상 (FNV-1a).
 *
 * 같은 차는 항상 같은 위상이라 재접속·재렌더에도 떨림이 튀지 않는다.
 */
export function idleSwayDelay(carId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < carId.length; i++) {
    h ^= carId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (((h >>> 0) % 1000) / 1000) * 4;
}

export function idleCreepOffset(carId: string, now: number): number {
  const phaseMs = idleSwayDelay(carId) * 1000;
  return Math.sin((now + phaseMs) / IDLE_CREEP_PERIOD_MS * Math.PI * 2) * IDLE_CREEP_PROGRESS;
}

export function racingLineDrawProgress(
  car: { carId: string; idle: boolean },
  projectorProgress: number,
  now: number,
): number {
  return car.idle ? projectorProgress + idleCreepOffset(car.carId, now) : projectorProgress;
}
