import type { CarEvent } from '../types';
import type { EventSource } from './EventSource';

/**
 * 기록된 `CarEvent`를 원본 간격대로 재생한다.
 *
 * 시뮬레이터와 같은 인터페이스 뒤에 있으므로 화면은 무엇이 물려 있는지 모른다 —
 * 실제 사용 기록으로 이 화면이 그대로 돌면 A5("가짜 데이터로 만든 로직은
 * 실데이터에서 안 굴러간다")가 해소된다.
 *
 * 기록이 끝나면 처음으로 돌아간다. 상시 노출 화면이 멈추면 안 된다.
 */
export class ReplaySource implements EventSource {
  private onEvent: ((event: CarEvent) => void) | null = null;
  private cursor = 0;
  private lastTickMs: number | null = null;
  /** 재생 위치 — 원본 타임라인 상의 경과 시간 */
  private elapsed = 0;

  constructor(
    private readonly events: CarEvent[],
    public speed: number,
  ) {}

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
    if (!emit || this.events.length === 0) return;

    const prev = this.lastTickMs ?? nowMs;
    this.lastTickMs = nowMs;
    this.elapsed += Math.max(0, nowMs - prev) * this.speed;

    const origin = this.events[0]!.ts;
    // 한 프레임에 몰아서 내보내되, 밀린 기록을 무한정 쏟지 않도록 상한을 둔다.
    for (let n = 0; n < 500; n++) {
      const next = this.events[this.cursor];
      if (!next) {
        // 한 바퀴 끝. 처음부터 다시 돈다.
        this.cursor = 0;
        this.elapsed = 0;
        return;
      }
      if (next.ts - origin > this.elapsed) return;
      this.cursor++;
      // 재생 시각으로 바꿔 내보낸다. 원본의 과거 시각을 그대로 쓰면
      // 리듀서의 유휴 판정이 전부 "오래 조용함"이 된다.
      emit({ ...next, ts: nowMs });
    }
  }
}
