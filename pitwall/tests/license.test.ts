import { describe, it, expect } from 'vitest';
import { licenseState, displayMode, towerMode, wallHudCopy, parseWallLicense, licenseFromOrg, type WallLicense } from '../src/config/license';

const T = 1_000_000;
function lic(over: Partial<WallLicense> = {}): WallLicense {
  return {
    orgId: 'org-1', wallId: 'wall-1', validUntil: T + 1_000,
    maxCars: 40, minTeamSize: 10, ...over,
  };
}

describe('licenseState', () => {
  it('없으면 invalid', () => {
    expect(licenseState(null, T)).toBe('invalid');
  });
  it('orgId 공백이면 invalid', () => {
    expect(licenseState(lic({ orgId: '' }), T)).toBe('invalid');
  });
  it('maxCars < 10이면 invalid', () => {
    expect(licenseState(lic({ maxCars: 9 }), T)).toBe('invalid');
  });
  it('minTeamSize < 10이면 invalid — 완화 불가', () => {
    expect(licenseState(lic({ minTeamSize: 3 }), T)).toBe('invalid');
  });
  it('만료면 expired', () => {
    expect(licenseState(lic({ validUntil: T }), T)).toBe('expired');
  });
  it('유효하면 active', () => {
    expect(licenseState(lic(), T)).toBe('active');
  });
});

describe('displayMode', () => {
  it('active이고 10대 이상이면 individual', () => {
    expect(displayMode(10, lic())).toBe('individual');
  });
  it('active이고 9대면 aggregate — 개인 줄 없음', () => {
    expect(displayMode(9, lic())).toBe('aggregate');
  });
});

describe('towerMode', () => {
  it('라이선스 없으면 Free — 개인 줄 허용', () => {
    expect(towerMode(null, T, 2)).toBe('individual');
  });
  it('만료·invalid면 차량을 숨긴다', () => {
    expect(towerMode(lic({ validUntil: T }), T, 12)).toBe('hidden');
    expect(towerMode(lic({ orgId: '' }), T, 12)).toBe('hidden');
  });
  it('active이고 9대면 aggregate', () => {
    expect(towerMode(lic(), T, 9)).toBe('aggregate');
  });
  it('active이고 10대면 individual', () => {
    expect(towerMode(lic(), T, 10)).toBe('individual');
  });
});

describe('wallHudCopy', () => {
  it('Free는 배지가 없다', () => {
    expect(wallHudCopy(null, T)).toBeNull();
  });
  it('active면 WALL · ACTIVE', () => {
    expect(wallHudCopy(lic(), T)).toBe('WALL · ACTIVE');
  });
  it('만료면 WALL · EXPIRED', () => {
    expect(wallHudCopy(lic({ validUntil: T }), T)).toBe('WALL · EXPIRED');
  });
});

describe('parseWallLicense', () => {
  it('객체가 아니면 null', () => {
    expect(parseWallLicense(null)).toBeNull();
    expect(parseWallLicense('org-1')).toBeNull();
  });
  it('필드가 빠지면 null', () => {
    expect(parseWallLicense({ orgId: 'org-1' })).toBeNull();
  });
  it('숫자 칸이 문자열이면 null — 조용히 변환하지 않는다', () => {
    expect(parseWallLicense({
      orgId: 'org-1', wallId: 'wall-1',
      validUntil: '1700000000000', maxCars: 40, minTeamSize: 10,
    })).toBeNull();
  });
  it('모양이 맞으면 그대로 돌려준다 — 시계는 licenseState가 본다', () => {
    expect(parseWallLicense(lic())).toEqual(lic());
  });
});

describe('licenseFromOrg', () => {
  it('조직 설정의 license 칸만 읽는다 — 로컬 자가 발급 경로가 아니다', () => {
    expect(licenseFromOrg({ license: lic(), speed: 30 })).toEqual(lic());
  });
  it('칸이 없으면 null — Free', () => {
    expect(licenseFromOrg({})).toBeNull();
  });
});
