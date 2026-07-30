/**
 * 고정 크기 순환 버퍼. 용량 초과 시 가장 오래된 항목을 조용히 버리되
 * 버린 개수를 `dropped`로 노출한다 — 조용한 truncation은 거짓말이 된다.
 */
export class RingBuffer<T> {
  private items: (T | undefined)[];
  private writeIndex = 0;
  private count = 0;
  private droppedCount = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error('capacity must be positive');
    this.items = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    if (this.count === this.capacity) this.droppedCount++;
    this.items[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  toArray(): T[] {
    const out: T[] = [];
    const start = this.count === this.capacity ? this.writeIndex : 0;
    for (let i = 0; i < this.count; i++) {
      const item = this.items[(start + i) % this.capacity];
      if (item !== undefined) out.push(item);
    }
    return out;
  }

  get size(): number {
    return this.count;
  }

  get dropped(): number {
    return this.droppedCount;
  }
}
