import { CIRCUITS, type CircuitData } from './circuitData';
import { asTrack } from './circuitShape';
import { generateTrack, validateTrack, type Track } from './generateTrack';

/**
 * 실제 서킷을 코스로 쓴다.
 *
 * 지어낸 코스는 매 실행 새 모양이 나오는 대신 **아무 모양도 아니었다** — 곁눈질로
 * 봤을 때 "어제와 다른 화면"이라는 것 말고는 읽히는 게 없다. 실제 서킷은 형상
 * 자체가 기억에 걸린다. 스파와 몬차는 한눈에 다르고, 그 차이가 공짜다.
 *
 * 좌표는 `npm run import:circuits`가 심는다. 안 심었으면 예전 생성기로 돈다 —
 * 데이터가 없다고 화면이 죽으면 안 된다.
 */

/** 생성기 폴백의 코스 모양. 예전 main.ts가 쓰던 값 그대로다. */
const FALLBACK_SHAPE = { resolution: 240, lobes: 3, aspect: 1.5 };

/** 폴백에서 유효한 코스가 나올 때까지 시드를 미는 횟수. */
const FALLBACK_ATTEMPTS = 50;

export function toTrack(circuit: CircuitData, seed: number): Track {
  return { ...asTrack(circuit), seed };
}

/**
 * 시드로 서킷 하나를 고른다.
 *
 * 무작위 생성이 아니라 **고르기**다. `?seed=`로 같은 서킷을 다시 부를 수 있고,
 * 시드가 없으면 실행마다 다른 서킷이 나온다 — 예전과 같은 감각이다.
 */
export function pickCircuit(seed: number): Track {
  // NaN·Infinity가 들어오면 나머지 연산이 다시 NaN이라 배열에서 `undefined`를 집는다.
  // 호출자(browser.ts)가 이미 거르지만, 여기서도 막는다 — 화면이 죽는 방식이 너무 나쁘다.
  const safe = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  if (CIRCUITS.length === 0) return syntheticTrack(safe);
  const index = Math.abs(safe) % CIRCUITS.length;
  return toTrack(CIRCUITS[index]!, safe);
}

/** 심은 서킷이 없을 때. 예전 생성기의 재시도 루프를 그대로 옮겨 왔다. */
function syntheticTrack(seed: number): Track {
  let s = seed;
  let track = generateTrack(s, FALLBACK_SHAPE);
  for (let i = 0; validateTrack(track).length > 0 && i < FALLBACK_ATTEMPTS; i++) {
    s += 1;
    track = generateTrack(s, FALLBACK_SHAPE);
  }
  return track;
}
