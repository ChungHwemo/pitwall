import { describe, it, expect, beforeEach } from 'vitest';
import {
  listSessions, saveSession, latestSession, clearSessions,
  MAX_SESSIONS, SESSION_STORAGE_KEY,
} from '../src/session/sessionStore';
import type { SessionSnapshot } from '../src/session/sessionStore';

function snap(id: string, startedAt: number): SessionSnapshot {
  return { id, seed: 2026, preset: 'busy', speed: 1, startedAt };
}

beforeEach(() => localStorage.clear());

describe('sessionStore', () => {
  it('빈 저장소는 빈 배열이다', () => {
    expect(listSessions()).toEqual([]);
  });

  it('저장한 세션을 읽는다', () => {
    saveSession(snap('s1', 1000));
    expect(listSessions()).toHaveLength(1);
    expect(listSessions()[0]!.id).toBe('s1');
  });

  it('최신 세션이 첫 번째다', () => {
    saveSession(snap('s1', 1000));
    saveSession(snap('s2', 2000));
    expect(listSessions()[0]!.id).toBe('s2');
    expect(latestSession()?.id).toBe('s2');
  });

  it(`최대 ${MAX_SESSIONS}개만 유지한다`, () => {
    for (let i = 0; i < MAX_SESSIONS + 4; i++) saveSession(snap(`s${i}`, i * 1000));
    const list = listSessions();
    expect(list).toHaveLength(MAX_SESSIONS);
    expect(list[0]!.id).toBe(`s${MAX_SESSIONS + 3}`);
  });

  it('같은 id를 다시 저장하면 갱신하고 중복을 만들지 않는다', () => {
    saveSession(snap('s1', 1000));
    saveSession({ ...snap('s1', 5000), speed: 600 });
    const list = listSessions();
    expect(list).toHaveLength(1);
    expect(list[0]!.speed).toBe(600);
  });

  it('시드와 프리셋을 그대로 복원한다', () => {
    saveSession({ id: 'x', seed: 987, preset: 'chaos', speed: 60, startedAt: 1 });
    const s = latestSession()!;
    expect(s.seed).toBe(987);
    expect(s.preset).toBe('chaos');
    expect(s.speed).toBe(60);
  });

  it('빈 저장소의 latestSession은 null이다', () => {
    expect(latestSession()).toBeNull();
  });

  it('깨진 JSON은 빈 배열로 처리한다', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, 'not json at all');
    expect(listSessions()).toEqual([]);
  });

  it('배열이 아닌 값은 빈 배열로 처리한다', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(listSessions()).toEqual([]);
  });

  it('clearSessions가 전부 지운다', () => {
    saveSession(snap('s1', 1000));
    clearSessions();
    expect(listSessions()).toEqual([]);
  });
});
