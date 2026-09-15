export interface WallLicense {
  orgId: string;
  wallId: string;
  validUntil: number;
  maxCars: number;
  minTeamSize: number;
}

export type LicenseState = 'active' | 'expired' | 'invalid';

export function licenseState(lic: WallLicense | null, now: number): LicenseState {
  if (lic === null) return 'invalid';
  if (lic.orgId === '' || lic.wallId === '') return 'invalid';
  if (lic.maxCars < 10 || lic.minTeamSize < 10) return 'invalid';
  if (now >= lic.validUntil) return 'expired';
  return 'active';
}

/** 시계는 licenseState가 본다. 여기선 인원 하한만. 미달이면 개인 줄 없음. */
export function displayMode(carCount: number, lic: WallLicense): 'individual' | 'aggregate' {
  if (lic.minTeamSize < 10) return 'aggregate';
  return carCount >= lic.minTeamSize ? 'individual' : 'aggregate';
}

export type TowerMode = 'individual' | 'aggregate' | 'hidden';

export function towerMode(lic: WallLicense | null, now: number, carCount: number): TowerMode {
  if (lic === null) return 'individual';
  const state = licenseState(lic, now);
  if (state !== 'active') return 'hidden';
  return displayMode(carCount, lic);
}

export function wallHudCopy(lic: WallLicense | null, now: number): string | null {
  if (lic === null) return null;
  const state = licenseState(lic, now);
  if (state === 'active') return 'WALL · ACTIVE';
  if (state === 'expired') return 'WALL · EXPIRED';
  return null;
}

/** 조직 설정 JSON의 모양만 본다. 만료·하한은 licenseState가 본다. */
export function parseWallLicense(raw: unknown): WallLicense | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.orgId !== 'string' || typeof o.wallId !== 'string') return null;
  if (typeof o.validUntil !== 'number' || !Number.isFinite(o.validUntil)) return null;
  if (typeof o.maxCars !== 'number' || !Number.isFinite(o.maxCars)) return null;
  if (typeof o.minTeamSize !== 'number' || !Number.isFinite(o.minTeamSize)) return null;
  return {
    orgId: o.orgId,
    wallId: o.wallId,
    validUntil: o.validUntil,
    maxCars: o.maxCars,
    minTeamSize: o.minTeamSize,
  };
}

/** 조직 설정 파일만. localStorage 설정으로 라이선스를 만들지 않는다. */
export function licenseFromOrg(org: unknown): WallLicense | null {
  if (typeof org !== 'object' || org === null) return null;
  return parseWallLicense((org as { license?: unknown }).license);
}
