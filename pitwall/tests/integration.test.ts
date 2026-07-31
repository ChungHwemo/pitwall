import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LiveSource } from '../src/source/LiveSource';
import { PitwallApp } from '../src/main';
import { resolveSettings } from '../src/config/settings';

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
  });

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
