import { describe, it, expect, beforeEach } from 'vitest';
import { loadCarSalt, CAR_SALT_KEY } from '../src/config/carSalt';
import { accountCar } from '../src/source/agentLogs';

beforeEach(() => localStorage.clear());

describe('loadCarSalt', () => {
  it('없으면 만들고 같은 키로 다시 읽는다', () => {
    const a = loadCarSalt();
    const b = loadCarSalt();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toBe(a);
    expect(localStorage.getItem(CAR_SALT_KEY)).toBe(a);
  });
});

describe('accountCar salt', () => {
  it('같은 계정 다른 솔트는 다른 차다', () => {
    const a = accountCar('claude', 'uuid-1', 'salt-aaaa');
    const b = accountCar('claude', 'uuid-1', 'salt-bbbb');
    expect(a.car_id).not.toBe(b.car_id);
  });

  it('같은 솔트면 같은 차다', () => {
    expect(accountCar('claude', 'uuid-1', 'salt-aaaa')).toEqual(
      accountCar('claude', 'uuid-1', 'salt-aaaa'),
    );
  });
});
