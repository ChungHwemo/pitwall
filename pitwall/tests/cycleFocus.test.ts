import { describe, expect, it } from 'vitest';
import { cycleFocus } from '../src/director/cycleFocus';

describe('cycleFocus', () => {
  it('포커스가 없으면 다음 키가 목록의 첫 차를 고른다', () => {
    expect(cycleFocus(['a', 'b', 'c'], null, 1)).toBe('a');
  });

  it('] 는 다음, [ 는 이전으로 돈다', () => {
    expect(cycleFocus(['a', 'b', 'c'], 'a', 1)).toBe('b');
    expect(cycleFocus(['a', 'b', 'c'], 'b', 1)).toBe('c');
    expect(cycleFocus(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycleFocus(['a', 'b', 'c'], 'a', -1)).toBe('c');
  });

  it('빈 목록이면 null 이다', () => {
    expect(cycleFocus([], 'a', 1)).toBeNull();
  });

  it('목록에 없는 현재 포커스는 첫 차로 붙는다', () => {
    expect(cycleFocus(['b', 'a'], 'gone', 1)).toBe('b');
  });
});
