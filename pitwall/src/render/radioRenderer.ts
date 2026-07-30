import type { RadioMessage } from '../radio/eventRadio';
import { RingBuffer } from '../state/ringBuffer';
import { SEVERITY_COLOR } from '../config/theme';
import { setText } from './setText';

/** 8시간 실행에도 메모리가 고정되도록 링버퍼를 쓴다 (PRD §11.3) */
const BUFFER_CAPACITY = 2000;

export class RadioRenderer {
  private buffer = new RingBuffer<RadioMessage>(BUFFER_CAPACITY);
  private lines: HTMLElement[] = [];

  constructor(container: HTMLElement, private maxVisible: number) {
    for (let i = 0; i < maxVisible; i++) {
      const line = document.createElement('div');
      line.className = 'radio-line';
      line.setAttribute('data-severity', 'info');
      line.style.display = 'none';
      container.appendChild(line);
      this.lines.push(line);
    }
  }

  push(msg: RadioMessage): void {
    this.buffer.push(msg);
  }

  render(): void {
    const recent = this.buffer.toArray().slice(-this.maxVisible).reverse();
    this.lines.forEach((line, i) => {
      const msg = recent[i];
      if (!msg) {
        line.style.display = 'none';
        return;
      }
      line.style.display = '';
      line.setAttribute('data-severity', msg.severity);
      line.style.color = SEVERITY_COLOR[msg.severity];
      const who = msg.carNumber === 0 ? 'RACE CONTROL' : `#${String(msg.carNumber).padStart(3, '0')}`;
      setText(line, `${who} — ${msg.text}`);
    });
  }

  get bufferSize(): number {
    return this.buffer.size;
  }
}
