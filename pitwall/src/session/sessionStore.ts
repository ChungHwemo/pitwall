import type { PresetName } from '../config/presets';

export interface SessionSnapshot {
  id: string;
  /** 트랙 코스를 재현하기 위한 시드. 이벤트는 재현되지 않는다 (PRD SIM-5). */
  seed: number;
  preset: PresetName;
  speed: number;
  startedAt: number;
}

export const MAX_SESSIONS = 5;
export const SESSION_STORAGE_KEY = 'pitwall.sessions';

function isSnapshot(value: unknown): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as SessionSnapshot;
  return (
    typeof v.id === 'string' &&
    typeof v.seed === 'number' &&
    typeof v.preset === 'string' &&
    typeof v.speed === 'number' &&
    typeof v.startedAt === 'number'
  );
}

export function listSessions(): SessionSnapshot[] {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnapshot);
  } catch {
    return [];
  }
}

export function saveSession(snapshot: SessionSnapshot): void {
  const existing = listSessions().filter((s) => s.id !== snapshot.id);
  const next = [snapshot, ...existing].slice(0, MAX_SESSIONS);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
}

export function latestSession(): SessionSnapshot | null {
  return listSessions()[0] ?? null;
}

export function clearSessions(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
