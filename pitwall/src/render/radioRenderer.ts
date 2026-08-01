import type { RadioMessage } from '../radio/eventRadio';
import { RingBuffer } from '../state/ringBuffer';
import { EVENT_POLARITY_COLOR } from '../config/theme';
import { setText } from './setText';

/** 8시간 실행에도 메모리가 고정되도록 링버퍼를 쓴다 (PRD §11.3) */
const BUFFER_CAPACITY = 2000;

type Polarity = 'positive' | 'caution' | 'neutral';

/**
 * 무전 메시지의 이벤트 극성. `RadioMessage`에는 `kind` 필드가 없으므로
 * 있는 필드(`severity`, `text`)만으로 판정한다 — 없는 사실을 지어내지 않는다.
 *
 * - `warn`/`critical`은 전부 `caution`이다 (문제·한도·은퇴).
 * - `info` 중 "회복"을 알리는 메시지만 `positive`다 — 현재 코드에서 유일하게
 *   존재하는 회복 문구는 `stateRadio`의 "한도 회복 — 코스 복귀"다.
 * - 나머지 `info`(포메이션·피트 안내·스킬·모델 교체 등)는 `neutral`이다.
 */
export function polarityOf(msg: RadioMessage): Polarity {
  if (msg.severity === 'warn' || msg.severity === 'critical') return 'caution';
  if (msg.text.includes('회복')) return 'positive';
  return 'neutral';
}

export class RadioRenderer {
  private buffer = new RingBuffer<RadioMessage>(BUFFER_CAPACITY);
  private lines: HTMLElement[] = [];

  constructor(container: HTMLElement, private maxVisible: number) {
    for (let i = 0; i < maxVisible; i++) {
      const line = document.createElement('div');
      line.className = 'radio-line';
      line.setAttribute('data-severity', 'info');
      line.setAttribute('data-polarity', 'neutral');
      line.style.display = 'none';
      container.appendChild(line);
      this.lines.push(line);
    }
  }

  push(msg: RadioMessage): void {
    this.buffer.push(msg);
  }

  render(names: Record<string, string> = {}): void {
    const recent = this.buffer.toArray().slice(-this.maxVisible).reverse();
    this.lines.forEach((line, i) => {
      const msg = recent[i];
      if (!msg) {
        line.style.display = 'none';
        return;
      }
      line.style.display = '';
      if (line.getAttribute('data-severity') !== msg.severity) {
        line.setAttribute('data-severity', msg.severity);
      }
      const polarity = polarityOf(msg);
      if (line.getAttribute('data-polarity') !== polarity) {
        line.setAttribute('data-polarity', polarity);
      }
      const color = EVENT_POLARITY_COLOR[polarity];
      if (line.style.color !== color) line.style.color = color;
      // critical은 caution과 색이 같다 — 굵기로 한 단계 더 강하게 표시한다 (§4.3.1).
      const weight = msg.severity === 'critical' ? '700' : '400';
      if (line.style.fontWeight !== weight) line.style.fontWeight = weight;
      const named = msg.carId ? names[msg.carId]?.trim() : undefined;
      const who = named
        ? named
        : msg.carNumber === 0 ? 'RACE CONTROL' : `#${String(msg.carNumber).padStart(3, '0')}`;
      setText(line, `${who} — ${msg.text}`);
    });
  }

  get bufferSize(): number {
    return this.buffer.size;
  }
}
