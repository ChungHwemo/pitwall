import { describe, it, expect, beforeEach } from 'vitest';
import {
  CAR_NAMES_STORAGE_KEY, loadCarNames, saveCarNames, carDisplayName,
} from '../src/config/carNames';

beforeEach(() => localStorage.clear());

describe('carNames 저장·로드', () => {
  it('저장한 이름을 그대로 다시 읽는다', () => {
    saveCarNames({ 'car-a': '결제팀 배치', 'car-b': '야간 크론' });
    expect(loadCarNames()).toEqual({ 'car-a': '결제팀 배치', 'car-b': '야간 크론' });
  });

  it('전용 키에만 쓴다', () => {
    saveCarNames({ 'car-a': '결제팀 배치' });
    expect(localStorage.getItem(CAR_NAMES_STORAGE_KEY)).not.toBeNull();
  });

  it('아무것도 없으면 빈 표다', () => {
    expect(loadCarNames()).toEqual({});
  });
});

describe('carNames 로드 정제 — localStorage는 사용자가 직접 손댈 수 있다', () => {
  it('문자열이 아닌 값은 버린다', () => {
    localStorage.setItem(CAR_NAMES_STORAGE_KEY,
      JSON.stringify({ 'car-a': 42, 'car-b': null, 'car-c': true, 'car-d': '유효' }));
    expect(loadCarNames()).toEqual({ 'car-d': '유효' });
  });

  it('앞뒤 공백을 다듬는다', () => {
    localStorage.setItem(CAR_NAMES_STORAGE_KEY, JSON.stringify({ 'car-a': '  배치  ' }));
    expect(loadCarNames()).toEqual({ 'car-a': '배치' });
  });

  it('공백뿐이거나 빈 이름은 버린다', () => {
    localStorage.setItem(CAR_NAMES_STORAGE_KEY, JSON.stringify({ 'car-a': '   ', 'car-b': '' }));
    expect(loadCarNames()).toEqual({});
  });

  it('깨진 JSON에도 던지지 않고 빈 표를 준다', () => {
    localStorage.setItem(CAR_NAMES_STORAGE_KEY, '{not json');
    expect(() => loadCarNames()).not.toThrow();
    expect(loadCarNames()).toEqual({});
  });

  it('배열이나 원시값이 들어와도 빈 표다', () => {
    localStorage.setItem(CAR_NAMES_STORAGE_KEY, JSON.stringify(['배치']));
    expect(loadCarNames()).toEqual({});
    localStorage.setItem(CAR_NAMES_STORAGE_KEY, JSON.stringify('배치'));
    expect(loadCarNames()).toEqual({});
  });
});

describe('carDisplayName', () => {
  it('이름이 있으면 이름이 이긴다', () => {
    expect(carDisplayName({ 'car-a': '결제팀 배치' }, 'car-a', 17, 'bare')).toBe('결제팀 배치');
    expect(carDisplayName({ 'car-a': '결제팀 배치' }, 'car-a', 17, 'padded')).toBe('결제팀 배치');
  });

  it('이름이 없으면 bare는 카넘버 그대로다', () => {
    expect(carDisplayName({}, 'car-a', 17, 'bare')).toBe('17');
  });

  it('이름이 없으면 padded는 #NNN이다', () => {
    expect(carDisplayName({}, 'car-a', 17, 'padded')).toBe('#017');
  });

  it('표에 없는 계정은 폴백으로 떨어진다', () => {
    expect(carDisplayName({ 'car-b': '배치' }, 'car-a', 5, 'bare')).toBe('5');
    expect(carDisplayName({ 'car-b': '배치' }, 'car-a', 5, 'padded')).toBe('#005');
  });

  it('공백뿐인 이름은 폴백으로 떨어진다', () => {
    expect(carDisplayName({ 'car-a': '   ' }, 'car-a', 8, 'bare')).toBe('8');
  });
});
