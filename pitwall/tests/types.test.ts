import { describe, it, expect } from 'vitest';
import { CAR_CLASSES, isCarClass } from '../src/types';

describe('CarClass', () => {
  it('정확히 3개 클래스만 존재한다', () => {
    expect(CAR_CLASSES).toEqual(['H', 'P', 'GT']);
  });

  it('알 수 없는 클래스를 거부한다', () => {
    expect(isCarClass('H')).toBe(true);
    expect(isCarClass('GT')).toBe(true);
    expect(isCarClass('LMP1')).toBe(false);
    expect(isCarClass('')).toBe(false);
  });
});
