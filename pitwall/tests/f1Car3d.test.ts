import { describe, expect, it } from 'vitest';
import { buildF1Car } from '../src/render/f1Car3d';

describe('buildF1Car', () => {
  it('노즈·앞날개·뒷날개가 있는 F1 실루엣이다', () => {
    const car = buildF1Car('#ea4c4f');
    expect(car.getObjectByName('nose')).toBeTruthy();
    expect(car.getObjectByName('frontWing')).toBeTruthy();
    expect(car.getObjectByName('rearWing')).toBeTruthy();
    expect(car.getObjectByName('wheels')).toBeTruthy();
  });
});
