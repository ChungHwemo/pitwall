import { describe, expect, it } from 'vitest';
import { bootSourceKind } from '../src/config/bootSource';

describe('bootSourceKind', () => {
  it('실시간 선택은 시뮬레이터를 쓰지 않는다', () => {
    expect(bootSourceKind({ wantsLive: true, recordedCount: 0 })).toBe('live');
  });

  it('기록이 있으면 재생이다', () => {
    expect(bootSourceKind({ wantsLive: false, recordedCount: 10 })).toBe('replay');
  });

  it('브라우저 기본은 시뮬레이터다', () => {
    expect(bootSourceKind({ wantsLive: false, recordedCount: 0 })).toBe('sim');
  });
});
