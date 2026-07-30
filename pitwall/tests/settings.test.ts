import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  resolveSettings, clampSettings, loadLocalSettings, saveLocalSettings, loadOrgSettings,
  DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY,
} from '../src/config/settings';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('resolveSettings', () => {
  it('아무것도 없으면 내장 기본값이다', () => {
    expect(resolveSettings({}, {}, {})).toEqual(DEFAULT_SETTINGS);
  });

  it('조직 기본값이 내장 기본값을 덮는다', () => {
    expect(resolveSettings({ speed: 60 }, {}, {}).speed).toBe(60);
  });

  it('사용자 로컬이 조직 기본값을 덮는다', () => {
    expect(resolveSettings({ speed: 60 }, { speed: 600 }, {}).speed).toBe(600);
  });

  it('세션 설정이 가장 강하다', () => {
    expect(resolveSettings({ speed: 60 }, { speed: 600 }, { speed: 1 }).speed).toBe(1);
  });

  it('부분 설정은 나머지를 덮지 않는다', () => {
    expect(resolveSettings({}, { speed: 600 }, {}).workday).toEqual(DEFAULT_SETTINGS.workday);
  });
});

describe('clampSettings — 하한 강제', () => {
  it('최소 집계 인원은 10 아래로 못 내린다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, minTeamSizeForIndividual: 3 })
      .minTeamSizeForIndividual).toBe(10);
  });

  it('최소 집계 인원 상향은 허용한다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, minTeamSizeForIndividual: 25 })
      .minTeamSizeForIndividual).toBe(25);
  });

  it('카메라 안정화 3값을 전부 하한으로 되돌린다', () => {
    const c = clampSettings({
      ...DEFAULT_SETTINGS,
      cameraMinExposureMs: 0,
      cameraReselectCooldownMs: 0,
      cameraSlotSwapMinIntervalMs: 0,
    });
    expect(c.cameraMinExposureMs).toBe(8_000);
    expect(c.cameraReselectCooldownMs).toBe(60_000);
    expect(c.cameraSlotSwapMinIntervalMs).toBe(3_000);
  });

  it('라디오 재발화 억제는 30분 아래로 못 내린다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, radioRepeatSuppressMs: 1000 })
      .radioRepeatSuppressMs).toBe(1_800_000);
  });

  it('레인 렌더 상한은 40 위로 못 올린다 — 방향이 반대다', () => {
    expect(clampSettings({ ...DEFAULT_SETTINGS, laneRenderCap: 200 }).laneRenderCap).toBe(40);
    expect(clampSettings({ ...DEFAULT_SETTINGS, laneRenderCap: 10 }).laneRenderCap).toBe(10);
  });

  it('resolveSettings는 항상 clamp를 거친다', () => {
    expect(resolveSettings({}, { minTeamSizeForIndividual: 2 }, {}).minTeamSizeForIndividual).toBe(10);
  });

  it('레이스 시간은 설정 키가 아니다 — 파생값이다', () => {
    expect(DEFAULT_SETTINGS).not.toHaveProperty('raceDurationMs');
  });
});

describe('조직 기본값', () => {
  it('http가 아니면 조직 파일을 아예 요청하지 않는다', async () => {
    // 단일 파일을 file://로 열었을 때 콘솔 에러를 남기지 않기 위해서다.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('location', { protocol: 'file:' });
    expect(await loadOrgSettings()).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('로컬 저장', () => {
  it('저장한 값을 되읽는다', () => {
    saveLocalSettings({ speed: 60 });
    expect(loadLocalSettings().speed).toBe(60);
  });

  it('깨진 JSON이면 빈 객체다', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{{{');
    expect(loadLocalSettings()).toEqual({});
  });

  it('저장된 값이 없으면 빈 객체다', () => {
    expect(loadLocalSettings()).toEqual({});
  });

  it('설정을 서버로 보내지 않는다', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    saveLocalSettings({ speed: 60 });
    loadLocalSettings();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
