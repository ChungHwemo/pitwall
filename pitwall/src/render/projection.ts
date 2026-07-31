/**
 * 샘플 사이를 이어 달리게 한다.
 *
 * 위치는 이벤트가 올 때만 갱신된다. 보간만 있으면 목표에 닿는 순간 멈추므로,
 * 화면은 **튀고 → 미끄러지고 → 선다**를 반복한다. 실측: 119프레임 중 24프레임만
 * 움직이고 나머지 95프레임은 정지. 레이싱 화면이 그렇게 보이면 안 된다.
 *
 * 실제 중계 화면이 부드러운 이유는 차에 **속도**가 있기 때문이다. 텔레메트리가
 * 늦어도 차는 직전 속도로 계속 간다. 여기서도 최근 두 샘플로 속도를 추정해
 * 프레임마다 밀고, 새 샘플이 오면 그쪽으로 당긴다 (앵커 + 전방투영 + 보간).
 *
 * `MAX_LEAD`가 안전장치다. 데이터가 끊기면 추정 속도로 영원히 달아나 한 바퀴를
 * 지어내게 되므로, 앵커에서 이만큼 이상은 앞서지 않는다.
 */

/** 새 샘플이 온 자리로 당기는 비율. 클수록 뻣뻣하고 작을수록 늘어진다. */
const LERP = 0.12;

/** 앵커보다 앞설 수 있는 최대치 (진행률). 트랙 둘레의 3%. */
export const MAX_LEAD = 0.03;

/** 속도 추정의 지수 평활 계수. 한 샘플이 튀어도 화면이 덜컥이지 않게 한다. */
const VELOCITY_SMOOTHING = 0.35;

/** 이보다 오래 샘플이 없으면 속도를 죽인다 (ms, 내부 시계). */
const STALE_MS = 30_000;

interface Track {
  /** 화면에 실제로 그려지는 진행률 */
  visual: number;
  /** 마지막으로 받은 목표 */
  anchor: number;
  anchorAt: number;
  /** 진행률/ms */
  velocity: number;
  lastAt: number;
}

/** 폐곡선에서 두 진행률의 최단 부호 거리. */
function shortest(from: number, to: number): number {
  let d = to - from;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

function wrap(p: number): number {
  const x = p % 1;
  return x < 0 ? x + 1 : x;
}

export class Projector {
  private cars = new Map<string, Track>();

  /**
   * 이번 프레임에 그릴 진행률.
   *
   * @param target 데이터가 말하는 위치 (앵커)
   * @param now    내부 시계
   */
  step(carId: string, target: number, now: number): number {
    const car = this.cars.get(carId);
    if (!car) {
      // 처음 보는 차는 목표 위치에서 시작한다. 날아오면 안 된다.
      this.cars.set(carId, {
        visual: wrap(target), anchor: target, anchorAt: now, velocity: 0, lastAt: now,
      });
      return wrap(target);
    }

    const dt = Math.max(0, now - car.lastAt);
    car.lastAt = now;

    // 앵커가 움직였으면 그 사이의 속도를 다시 잰다.
    if (target !== car.anchor) {
      const span = now - car.anchorAt;
      if (span > 0) {
        const measured = shortest(car.anchor, target) / span;
        car.velocity = car.velocity === 0
          ? measured
          : car.velocity + (measured - car.velocity) * VELOCITY_SMOOTHING;
      }
      car.anchor = target;
      car.anchorAt = now;
    } else if (now - car.anchorAt > STALE_MS) {
      // 오래 조용하면 굴러가던 관성을 끈다. 없는 일을 그리지 않는다.
      car.velocity = 0;
    }

    // 1. 속도로 민다 — 샘플이 없어도 여기서 계속 간다.
    let next = car.visual + car.velocity * dt;
    // 2. 앵커 쪽으로 당긴다.
    next += shortest(next, target) * LERP;

    // 3. 앵커보다 너무 앞서면 세운다.
    const lead = shortest(target, next);
    if (lead > MAX_LEAD) next = target + MAX_LEAD;

    car.visual = wrap(next);
    return car.visual;
  }

  /** 멈춘 차. 진행은 없지만 자리는 기억한다. */
  hold(carId: string, now: number): number {
    const car = this.cars.get(carId);
    if (!car) return 0;
    car.velocity = 0;
    car.lastAt = now;
    return car.visual;
  }

  visual(carId: string): number | undefined {
    return this.cars.get(carId)?.visual;
  }

  /** 화면에 없는 차의 상태를 버린다. 안 버리면 계정 수만큼 무한히 쌓인다. */
  retain(alive: Set<string>): void {
    for (const id of [...this.cars.keys()]) {
      if (!alive.has(id)) this.cars.delete(id);
    }
  }
}
