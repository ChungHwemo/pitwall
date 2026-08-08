import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LiveSource } from '../src/source/LiveSource';
import { ReplaySource } from '../src/source/ReplaySource';
import { PitwallApp } from '../src/main';
import { resolveSettings } from '../src/config/settings';
import { loadLiveSnapshot, LIVE_STORAGE_KEY } from '../src/session/liveStore';

const CODEX_CTX = JSON.stringify({
  timestamp: '2026-07-30T21:00:01.000Z',
  type: 'turn_context', payload: { model: 'gpt-5.6-sol' },
});
const CODEX_USAGE = JSON.stringify({
  timestamp: '2026-07-30T21:00:02.000Z',
  payload: {
    type: 'token_count',
    info: { last_token_usage: { input_tokens: 5_000, output_tokens: 800, cached_input_tokens: 4_000 } },
    rate_limits: { primary: { used_percent: 40, window_minutes: 10_080, resets_at: 1_785_913_052 } },
  },
});

function liveWithOneEvent(root: HTMLElement): PitwallApp {
  const live = new LiveSource();
  const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
  app.start();
  app.useSource(live, { speed: 1, demoClock: false });
  live.ingest('codex', [CODEX_CTX, CODEX_USAGE]);
  runFrames(app, 3);
  return app;
}

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

function runFrames(app: PitwallApp, count: number, stepMs = 100): void {
  for (let i = 1; i <= count; i++) app.frame(i * stepMs);
}

describe('PitwallApp', () => {
  // 의도 변경: 카메라 카드가 사라졌다. 척추는 타워이고, 카드가 하던 말(계정별
  // 모델·한도·비용)은 타워 줄이 그대로 한다.
   it('타워·트랙·라디오를 모두 그린다', () => {
     new PitwallApp(root, { seed: 2026, preset: 'busy', speed: 20 });
    expect(root.querySelector('.tower')).not.toBeNull();
    expect(root.querySelector('svg.track')).not.toBeNull();
    expect(root.querySelector('.radio')).not.toBeNull();
  });

  it('모듈을 import 하는 것만으로 앱이 생기지 않는다', () => {
    // 배선은 browser.ts에만 둔다. main.ts import에 부작용이 있으면
    // 테스트와 재사용이 전부 이 부작용에 걸린다.
    expect(root.children.length).toBe(0);
  });

   it('busy 프리셋에서 차량이 상태에 등록된다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 2026, preset: 'busy', speed: 100 });
    app.start();
    runFrames(app, 30);
    expect(app.state.cars.size).toBeGreaterThan(0);
  });

   it('sparse 프리셋에서 화면이 죽지 않는다 — 줄이 비어도 DOM은 유지된다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.9999);
     const app = new PitwallApp(root, { seed: 7, preset: 'sparse', speed: 20 });
    app.start();
    runFrames(app, 50);
    expect(root.querySelectorAll('.tower-row').length).toBeGreaterThan(0);
    expect(root.querySelector('svg.track path.track-centerline')).not.toBeNull();
  });

   it('chaos 프리셋에서 라디오가 발화한다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 3, preset: 'chaos', speed: 100 });
    app.start();
    runFrames(app, 40);
    const visible = [...root.querySelectorAll('.radio-line')].filter(
      (n) => (n as HTMLElement).style.display !== 'none',
    );
    expect(visible.length).toBeGreaterThan(0);
  });

   it('장시간 구동에도 DOM 노드가 무한 증가하지 않는다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 11, preset: 'chaos', speed: 100 });
    app.start();
    runFrames(app, 100);
    const after100 = root.querySelectorAll('*').length;
    runFrames(app, 900, 100);
    expect(root.querySelectorAll('*').length).toBe(after100);
  }, 10_000);

   it('stop 이후 프레임은 상태를 바꾸지 않는다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 5, preset: 'busy', speed: 100 });
    app.start();
    runFrames(app, 20);
    const before = app.state.cars.size;
    app.stop();
    runFrames(app, 20, 200);
    expect(app.state.cars.size).toBe(before);
  });

   it('세션 스냅샷을 저장한다', () => {
     const app = new PitwallApp(root, { seed: 999, preset: 'busy', speed: 30 });
    app.start();
    const raw = localStorage.getItem('pitwall.sessions');
    expect(raw).not.toBeNull();
    expect(raw).toContain('999');
  });

   it('상단 바 분모가 레이스 시간이다 — 근무 창 길이가 아니다', () => {
     // 09:00-18:00은 9시간이지만 점심을 빼면 8시간이다 (PRD §7.0).
     const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.frame(100);
    expect(root.querySelector('.hud')!.textContent).toContain('/ 08:00:00');
  });

  // 의도 축소: busy 프리셋은 붐비는 쪽이라 라벨이 꺼져야 맞다. 몇 대뿐일 때
  // 라벨을 켜는 것은 별도 규칙이며 trackRenderer 테스트가 지킨다.
   it('붐비는 화면에서는 차량 글리프에 텍스트 라벨이 없다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 2, preset: 'busy', speed: 100 });
    app.start();
    runFrames(app, 20);
    const shown = [...root.querySelectorAll('svg.track g.car text')]
      .filter((n) => n.textContent !== '');
    expect(shown).toEqual([]);
  });

  // 의도 변경: `cameraSlots`는 이제 화면의 카드 수가 아니라 **타워 줄이 모자랄 때
  // 급한 계정을 몇 대까지 남길지**를 정한다. 카드는 사라졌고 디렉터는 남았다.
   it('설정으로 디렉터가 남기는 계정 수를 바꾼다', () => {
     const app = new PitwallApp(root, {
       seed: 1, preset: 'busy', speed: 20,
       settings: resolveSettings({}, { cameraSlots: 5 }, {}),
     });
    expect(app).toBeDefined();
    expect(root.querySelectorAll('.tower-row').length).toBeGreaterThan(0);
  });

   it('설정이 하한을 뚫으려 하면 런타임이 되돌린다', () => {
     // 조직 파일에 k=2를 써도 개인 차량 모드 하한은 10이다 (PRD §12.1).
     const app = new PitwallApp(root, {
       seed: 1, preset: 'busy', speed: 20,
       settings: resolveSettings({ minTeamSizeForIndividual: 2 }, {}, {}),
     });
    expect(app.settings.minTeamSizeForIndividual).toBe(10);
  });

   it('정렬된 사람 목록(타이밍 타워)을 그리지 않는다', () => {
     vi.spyOn(Math, 'random').mockReturnValue(0.0001);
     const app = new PitwallApp(root, { seed: 4, preset: 'busy', speed: 100 });
    app.start();
    runFrames(app, 20);
    expect(root.querySelector('.timing-tower')).toBeNull();
    expect(root.querySelector('ol')).toBeNull();
  });
});

describe('실시간 표시', () => {
   it('실시간 소스로 갈아타면 화면이 LIVE라고 말한다 — 재생과 구분되어야 한다', () => {
     const app = new PitwallApp(root, { seed: 3, preset: 'sparse', speed: 20 });
    app.start();
    expect(root.querySelector('.hud')!.textContent).not.toContain('LIVE');

     app.useSource(new LiveSource(), { speed: 20, demoClock: false });
    runFrames(app, 3);
    expect(root.querySelector('.hud')!.textContent).toContain('LIVE');
  });
});

describe('배지는 데이터의 출처를 말한다 — demoClock과 무관하다', () => {
  const hud = (): string => root.querySelector('.hud')!.textContent ?? '';

  it('시뮬레이터는 DEMO다 — 데모 시계를 꺼도 지어낸 데이터라는 사실은 남는다', () => {
    const app = new PitwallApp(root, {
      seed: 1, preset: 'busy', speed: 20,
      settings: resolveSettings({}, { demoClock: false }, {}),
    });
    app.start();
    app.frame(100);
    expect(hud()).toContain('DEMO');
    expect(hud()).not.toContain('LIVE');
  });

  it('지어낸 데이터셋 재생도 DEMO다 — 재생이라도 출처가 가짜면 밝힌다', () => {
    const app = new PitwallApp(root, {
      seed: 1, preset: 'busy', speed: 20,
      source: new ReplaySource([], 1), demo: true,
      settings: resolveSettings({}, { demoClock: false }, {}),
    });
    app.start();
    app.frame(100);
    expect(hud()).toContain('DEMO');
    expect(hud()).not.toContain('LIVE');
  });

  it('실기록 재생은 배지가 없다 — 실시간도 아니고 지어낸 것도 아니다', () => {
    const app = new PitwallApp(root, {
      seed: 1, preset: 'busy', speed: 20,
      source: new ReplaySource([], 1), demo: false,
    });
    app.start();
    app.frame(100);
    expect(hud()).not.toContain('LIVE');
    expect(hud()).not.toContain('DEMO');
  });

  it('실시간으로 갈아타면 DEMO가 사라지고 LIVE만 남는다', () => {
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.frame(100);
    expect(hud()).toContain('DEMO');

    app.useSource(new LiveSource(), { speed: 1, demoClock: false });
    runFrames(app, 3);
    expect(hud()).toContain('LIVE');
    expect(hud()).not.toContain('DEMO');
  });

  it('LIVE burst는 실제 backlog를 syncing으로 보인 뒤 connected로 돌아온다', () => {
    const live = new LiveSource({ codexAccountId: 'qa-account' });
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.useSource(live, { speed: 1, demoClock: false });
    live.ingest('codex', [CODEX_CTX, ...Array(65).fill(CODEX_USAGE)]);

    app.frame(1_000);
    const status = root.querySelector('.live-status')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('data-live-state')).toBe('syncing');
    expect(status.textContent).toContain('+1');
    expect(root.querySelectorAll('[data-freshness="fresh"]')).toHaveLength(1);

    app.frame(1_016);
    expect(status.getAttribute('data-live-state')).toBe('connected');
  });

  it('LIVE without an event waits, then reports stale data without claiming disconnect', () => {
    const live = new LiveSource({ codexAccountId: 'qa-account' });
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.useSource(live, { speed: 1, demoClock: false });
    app.frame(100);
    const status = root.querySelector('.live-status')!;
    expect(status.getAttribute('data-live-state')).toBe('connected');
    expect(status.textContent).toContain('WAITING');

    live.ingest('codex', [CODEX_CTX, CODEX_USAGE]);
    app.frame(1_000);
    app.frame(301_001);
    expect(status.getAttribute('data-live-state')).toBe('stale');
    expect(status.textContent).toContain('STALE DATA');
    expect(status.textContent).not.toContain('DISCONNECT');
  });
});

describe('실시간 리로드 복원', () => {
  function freshRoot(): HTMLElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  }

  it('실시간이 아니면 captureLiveSnapshot은 null이다 — 저장할 것이 없다', () => {
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.frame(100);
    expect(app.captureLiveSnapshot()).toBeNull();
  });

  it('capture한 누적을 새 앱에 restore하면 토큰·비용·호출 수가 유지된다', () => {
    const app = liveWithOneEvent(root);
    const before = [...app.state.cars.values()][0]!;
    const snap = app.captureLiveSnapshot();
    expect(snap).not.toBeNull();

    const app2 = new PitwallApp(freshRoot(), { seed: 2, preset: 'busy', speed: 20 });
    app2.start();
    app2.useSource(new LiveSource(), { speed: 1, demoClock: false });
    app2.restoreLiveState(snap!);

    const after = app2.state.cars.get(before.car_id)!;
    expect(after).not.toBeUndefined();
    expect(after.distance).toBe(before.distance);
    expect(after.cost_usd).toBe(before.cost_usd);
    expect(after.call_count).toBe(before.call_count);
    expect(app2.state.byModel.get(before.model)).toEqual(app.state.byModel.get(before.model));
  });

  it('restore는 페이지 상대 시각을 새 시계로 시프트한다 — 유휴 간격이 보존된다', () => {
    const app = liveWithOneEvent(root);
    const before = [...app.state.cars.values()][0]!;
    const snap = app.captureLiveSnapshot()!;

    const app2 = new PitwallApp(freshRoot(), { seed: 2, preset: 'busy', speed: 20 });
    app2.start();
    app2.useSource(new LiveSource(), { speed: 1, demoClock: false });
    app2.restoreLiveState(snap);

    const after = app2.state.cars.get(before.car_id)!;
    // 벽시계가 아니라 페이지 상대 시각이라 새 페이지의 원점으로 옮겨졌다.
    const gapBefore = snap.now - before.last_event_ts;
    const gapAfter = app2.state.now - after.last_event_ts;
    expect(gapAfter).toBeCloseTo(gapBefore, 5);
    // 벽시계 한도값은 그대로다.
    expect(after.limit_resets_at).toBe(before.limit_resets_at);
    expect(after.hourly).toEqual(before.hourly);
  });

  it('frame()이 5초 주기로 실시간 스냅샷을 저장한다 — 리로드가 이걸 읽는다', () => {
    const live = new LiveSource();
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.useSource(live, { speed: 1, demoClock: false });
    live.ingest('codex', [CODEX_CTX, CODEX_USAGE]);
    // 5초를 넘겨야 첫 저장이 떨어진다.
    for (let t = 1_000; t <= 6_000; t += 1_000) app.frame(t);
    expect(localStorage.getItem(LIVE_STORAGE_KEY)).not.toBeNull();
    expect(loadLiveSnapshot()).not.toBeNull();
  });

  it('저장→로드→복원 전체 경로에서 누적이 살아남는다', () => {
    const live = new LiveSource();
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.useSource(live, { speed: 1, demoClock: false });
    live.ingest('codex', [CODEX_CTX, CODEX_USAGE]);
    for (let t = 1_000; t <= 6_000; t += 1_000) app.frame(t);
    const before = [...app.state.cars.values()][0]!;

    const restored = loadLiveSnapshot();
    expect(restored).not.toBeNull();
    const app2 = new PitwallApp(freshRoot(), { seed: 2, preset: 'busy', speed: 20 });
    app2.start();
    app2.useSource(new LiveSource(), { speed: 1, demoClock: false });
    app2.restoreLiveState(restored!);

    expect(app2.state.cars.get(before.car_id)!.distance).toBe(before.distance);
  });

  it('쓰기 실패는 frame()을 넘지 못하고, 다음 주기 저장은 성공한다', () => {
    // Given: 첫 실시간 쓰기만 할당량 초과로 던지고, 이후 쓰기는 통과한다.
    const realSetItem = Storage.prototype.setItem;
    let liveWrites = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage, k: string, v: string,
    ) {
      if (k === LIVE_STORAGE_KEY) {
        liveWrites += 1;
        if (liveWrites === 1) throw new DOMException('quota', 'QuotaExceededError');
      }
      realSetItem.call(this, k, v);
    });

    const live = new LiveSource();
    const app = new PitwallApp(root, { seed: 1, preset: 'busy', speed: 20 });
    app.start();
    app.useSource(live, { speed: 1, demoClock: false });
    live.ingest('codex', [CODEX_CTX, CODEX_USAGE]);

    // When: 첫 저장 주기(5초)를 넘긴다 — 쓰기가 던져도 frame()은 죽지 않는다.
    expect(() => {
      for (let t = 1_000; t <= 6_000; t += 1_000) app.frame(t);
    }).not.toThrow();
    // Then: 첫 쓰기가 실패했으므로 저장은 아직 비어 있다 (즉시 재시도를 약속하지 않는다).
    expect(localStorage.getItem(LIVE_STORAGE_KEY)).toBeNull();

    // When: 다음 저장 주기가 돌아온다.
    for (let t = 7_000; t <= 11_000; t += 1_000) app.frame(t);
    // Then: 나중 쓰기는 성공해 스냅샷이 남는다 — 실패가 저장을 영구히 막지 않는다.
    expect(liveWrites).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem(LIVE_STORAGE_KEY)).not.toBeNull();
    expect(loadLiveSnapshot()).not.toBeNull();
  });
});
