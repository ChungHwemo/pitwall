import './style.css';
import { PitwallApp } from './main';
import { loadOrgSettings, loadLocalSettings, resolveSettings } from './config/settings';
import { latestSession } from './session/sessionStore';
import { workdayFromActivity } from './state/clock';
import { workOf } from './state/reducer';
import { ReplaySource } from './source/ReplaySource';
import { LiveSource } from './source/LiveSource';
import type { LiveAccounts, LiveVendor, VendorLimitSnapshot } from './source/LiveSource';
import { DATASET_KEY, LIVE_ID, type Dataset } from './config/datasets';
import { DatasetPicker } from './render/datasetPicker';

/**
 * 빌드 시 실 기록을 심을 자리 (`build:real`).
 * 비어 있으면 시뮬레이터로 간다 — 기본 빌드는 그대로다.
 */
/** 빌드에 심은 데이터셋들. 화면에서 고른다. */
declare const __PITWALL_DATASETS__: Dataset[] | undefined;
/** 빌드 시점의 벤더 한도 스냅샷 (`npm run fetch:limits`). */
declare const __PITWALL_LIMITS__: VendorLimitSnapshot[] | undefined;

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

    /*
     * 코스는 열 때마다 새로 깔린다.
     *
     * 직전 세션의 시드를 복원하고 있었다 — 이어하기로 넣은 것인데, 실제로는
     * 며칠을 켜도 같은 코스만 나왔다. 이어붙일 이벤트도 없으므로 복원할 이유가
     * 없다. `?seed=` 로 고정할 수 있게만 남긴다 (버그 재현용).
     */
    const pinned = new URLSearchParams(location.search).get('seed');
    const seed = pinned !== null && pinned !== ''
      ? Number(pinned)
      : Math.floor(Math.random() * 1_000_000);

    const embedded = typeof __PITWALL_DATASETS__ === 'undefined' ? [] : (__PITWALL_DATASETS__ ?? []);
    /*
     * 실시간도 고르는 항목의 하나다.
     *
     * 예전에는 껍데기가 뜨면 무조건 실시간으로 갈아탔다. 그래서 데이터셋을 골라도
     * 새로고침 직후 껍데기가 다시 덮어써서 **아무것도 안 바뀌는 것처럼** 보였다 —
     * 고른 것이 화면에 안 나오는 게 가장 나쁜 종류의 고장이다.
     */
    const datasets: Dataset[] = [
      { id: LIVE_ID, label: '실시간', synthetic: false, events: [] },
      ...embedded,
    ];
    const wanted = localStorage.getItem(DATASET_KEY);
    // 저장된 선택이 없으면 실시간(껍데기가 있을 때만 뜬다), 아니면 첫 기록.
    const chosen = datasets.find((d) => d.id === wanted) ?? datasets[1] ?? datasets[0];
    const wantsLive = chosen?.id === LIVE_ID;
    const recorded = wantsLive ? [] : (chosen?.events ?? []);

    // 근무창은 기록이 정한다. 09:00-18:00을 고집하면 실측 기준 하루 작업의
    // 61.4%가 창 밖으로 밀려나 화면에 아예 오지 않는다.
    const observed = recorded.length
      ? { ...settings, workday: workdayFromActivity(recorded.map((e) => ({ ts: e.ts, work: workOf(e) }))) }
      : settings;

    /**
     * 네이티브 껍데기가 있으면 실시간이다.
     *
     * 껍데기는 `window.pitwallLive(accounts)`로 자기 존재를 알리고, 그 뒤
     * `window.pitwallIngest(vendor, lines)`로 새 줄을 밀어 넣는다. 브라우저에서
     * 그냥 열면 둘 다 안 불리므로 예전대로 기록 재생이 돈다.
     *
     * 껍데기는 페이지가 뜬 직후에 알리므로, 소스를 미리 만들어 두고 알림이
     * 오면 갈아 끼운다 — 기다렸다가 만들면 첫 줄을 놓친다.
     */
    const live = new LiveSource();
    let liveOn = false;
    const win = window as unknown as {
      pitwallLive?: (accounts: LiveAccounts) => void;
      pitwallIngest?: (vendor: LiveVendor, lines: string[]) => void;
    };

    const app = new PitwallApp(mount, {
      seed,
      preset: observed.preset,
      speed: observed.speed,
      settings: observed,
      source: recorded.length ? new ReplaySource(recorded, settings.speed) : undefined,
    });

    // 무엇을 보고 있는지 상단 바가 말한다. 고르면 그 데이터로 다시 연다 —
    // 누적 상태를 이어 붙이면 두 데이터가 한 화면에서 합산된다.
    app.mountDatasetPicker((host) => {
      new DatasetPicker(host, datasets, chosen?.id ?? '', (id) => {
        localStorage.setItem(DATASET_KEY, id);
        location.reload();
      });
    });

    win.pitwallLive = (accounts) => {
      if (liveOn) return;
      // 사용자가 기록을 골랐으면 껍데기가 덮지 않는다.
      if (!wantsLive) return;
      liveOn = true;
      live.configure(accounts);
      // Claude 한도는 로그에 없다 — 빌드에 심은 스냅샷을 쓴다. 나이는 화면이 밝힌다.
      if (typeof __PITWALL_LIMITS__ !== 'undefined' && __PITWALL_LIMITS__) {
        live.setLimits(__PITWALL_LIMITS__);
      }
      // 실시간에는 배속도 데모 시계도 없다. 지금이 지금이다.
      app.useSource(live, { speed: 1, demoClock: false });
    };
    win.pitwallIngest = (vendor, lines) => { live.ingest(vendor, lines); };

    app.start();

    const loop = (t: number): void => {
      app.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  })();
}
