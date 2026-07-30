import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/state/ringBuffer';

describe('RingBuffer', () => {
  it('용량 이하에서는 삽입 순서를 보존한다', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
    expect(buf.size).toBe(3);
    expect(buf.dropped).toBe(0);
  });

  it('용량 초과 시 가장 오래된 것을 버린다', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.toArray()).toEqual([2, 3, 4]);
    expect(buf.size).toBe(3);
    expect(buf.dropped).toBe(1);
  });

  it('용량의 여러 배를 넣어도 크기가 고정된다', () => {
    const buf = new RingBuffer<number>(10);
    for (let i = 0; i < 10_000; i++) buf.push(i);
    expect(buf.size).toBe(10);
    expect(buf.toArray()).toEqual([9990, 9991, 9992, 9993, 9994, 9995, 9996, 9997, 9998, 9999]);
    expect(buf.dropped).toBe(9990);
  });

  it('용량 0 이하를 거부한다', () => {
    expect(() => new RingBuffer<number>(0)).toThrow('capacity must be positive');
  });
});
