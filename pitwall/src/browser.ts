import './style.css';
import { PitwallApp } from './main';
import { loadOrgSettings, loadLocalSettings, resolveSettings } from './config/settings';
import { latestSession } from './session/sessionStore';

// 브라우저 배선만 여기 둔다. requestAnimationFrame도 여기에만 있다 —
// main.ts를 import 하는 것만으로 앱이 뜨면 테스트가 그 부작용에 걸린다.
const mount = document.getElementById('app');
if (mount) {
  void (async () => {
    const local = loadLocalSettings();
    const settings = resolveSettings(await loadOrgSettings(), local, {});

    // 첫 실행이고 데모 시계면 배속을 올려 띄운다. 실제 조직 속도(1×)로 열면
    // 처음 1분간 트랙이 비어 보여서 고장난 것처럼 읽힌다.
    // 사용자가 설정을 한 번이라도 건드리면 그 값이 이긴다.
    const firstRun = Object.keys(local).length === 0;
    if (firstRun && settings.demoClock) settings.speed = 60;

    // 이어하기: 직전 세션의 시드를 복원하면 같은 코스가 다시 깔린다.
    // 이벤트는 복원되지 않는다 — 시드는 트랙 전용이다 (PRD SIM-5).
    const resumed = latestSession();
    const seed = resumed?.seed ?? Math.floor(Math.random() * 1_000_000);

    const app = new PitwallApp(mount, {
      seed,
      preset: settings.preset,
      speed: settings.speed,
      settings,
    });
    app.start();

    const loop = (t: number): void => {
      app.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  })();
}
