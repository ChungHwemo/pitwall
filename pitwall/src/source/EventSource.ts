import type { CarEvent } from '../types';

/**
 * 데이터 경계. v1은 SimulatorSource, v1.5는 WebSocketSource가 구현한다.
 * 이 인터페이스 뒤에서 소스를 교체하는 것이 실데이터 전환의 전부여야 한다.
 */
export interface EventSource {
  start(onEvent: (event: CarEvent) => void): void;
  stop(): void;
  /** 시각은 항상 주입받는다. 소스는 Date.now()를 부르지 않는다. */
  tick(nowMs: number): void;
}
