import './style.css';
import { PitwallApp } from './main';
import { loadOrgSettings, loadLocalSettings, resolveSettings } from './config/settings';
import { latestSession } from './session/sessionStore';

// 브라우저 배선만 여기 둔다. requestAnimationFrame도 여기에만 있다 —
// main.ts를 import 하는 것만으로 앱이 뜨면 테스트가 그 부작용에 걸린다.
const mount = document.getElementById('app');
if (mount) {
  void (async () => {
    const settings = resolveSettings(await loadOrgSettings(), loadLocalSettings(), {});

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
