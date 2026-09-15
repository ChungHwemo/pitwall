import type { RaceState } from './types';
import { PRESETS, type PresetName } from './config/presets';
import { SimulatorSource } from './source/SimulatorSource';
import type { EventSource } from './source/EventSource';
import {
  emptyRaceState, applyEvent, workOf, freshnessOf, FRESH_THRESHOLD_MS, IDLE_THRESHOLD_MS,
} from './state/reducer';
import { DEFAULT_WORKDAY, phaseAt, elapsedMs, raceDurationMs, formatWallClock, liveWorkday } from './state/clock';
import type { ActivitySample } from './state/clock';
import { paceOf, formatPace } from './state/pace';
import { demoClock } from './state/demoClock';
import { pickCircuit } from './track/circuits';
import { buildTrackModel, type TrackModel } from './track/trackModel';
import { Director } from './director/director';
import {
  BroadcastDirector, broadcastSeverityOf,
  type BroadcastCandidate, type BroadcastSelection, type BroadcastSeverity,
} from './director/broadcastDirector';
import { cycleFocus } from './director/cycleFocus';
import { eventRadio, stateRadio, phaseRadio, type RadioMessage } from './radio/eventRadio';
import { RoutineRadio } from './radio/routineRadio';
import { TrackRenderer } from './render/trackRenderer';
import { Circuit3DRenderer } from './render/circuit3DRenderer';
import {
  bootBroadcastTrackRenderer,
  type BroadcastRendererSession,
} from './render/broadcastRendererSession';
import { TowerRenderer } from './render/towerRenderer';
import { ModelPanel } from './render/modelPanel';
import { RadioRenderer } from './render/radioRenderer';
import { loadSalaryConfig, earnedSoFar, formatElapsed } from './render/hudRenderer';
import { setText } from './render/setText';
import { SummaryRenderer } from './render/summaryRenderer';
import { hourlyProfile, hourlyCurve } from './render/hourlyProfile';
import { FeedRenderer } from './render/feedRenderer';
import type { CarEvent } from './types';
import { SettingsPanel } from './render/settingsPanel';
import { loadCarNames } from './config/carNames';
import { Legend } from './render/legend';
import { saveSession } from './session/sessionStore';
import { serializeLiveState, saveLiveSnapshot, rebaseLiveSnapshot, type LiveSnapshot } from './session/liveStore';
import { RingBuffer } from './state/ringBuffer';
import { DEFAULT_SETTINGS, type PitwallSettings } from './config/settings';
import type { PricingOverride } from './config/pricingOverride';
import { towerMode, wallHudCopy, type WallLicense } from './config/license';
import {
  applyChromeMode, chromeModeFromKey, isChromeHotkeyBlocked,
} from './config/chromeMode';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIO_LINES = 3;
/** 타워 줄 수. 계정이 더 많으면 남는 줄은 접힌 것으로 표시해야 한다 (미구현). */
const TOWER_ROWS = 16;
/** 모델 판 줄 수. 넘치면 "그 외 N종"으로 접는다. */
const MODEL_ROWS = 6;
/** 속도를 재는 레이스 창. 타워 스파크라인과 같은 길이다. */
const PACE_WINDOW_MS = 1_800_000;
/** 실시간 창을 뽑을 때 들고 있는 표본 수. 하루치면 충분하다. */
const LIVE_WINDOW_SAMPLES = 20_000;
const FEED_ROWS = 12;
/** 계정별로 보관하는 최근 호출 수 */
/** 계정별로 들고 있는 최근 호출 수. 피드가 쓰고 스파크라인도 여기서 읽는다. */
const FEED_HISTORY = 400;
const ROUTINE_INTERVAL_MS = 3_600_000;
/**
 * 실시간 스냅샷 자동 저장 주기. 프레임(60fps)마다 저장하면 localStorage 할당량을
 * 태우고 직렬화가 프레임을 굶긴다 — 5초면 리로드 데이터 손실을 막기에 충분하다.
 */
const LIVE_SAVE_INTERVAL_MS = 5_000;

function chromeKicker(kind: 'tower' | 'track' | 'radio' | 'broadcast', text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'chrome-kicker';
  el.setAttribute('data-chrome-kicker', kind);
  el.textContent = text;
  return el;
}

function hudCluster(name: string, label: string, ...kids: HTMLElement[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `hud-cluster hud-cluster-${name}`;
  const kicker = document.createElement('div');
  kicker.className = 'chrome-kicker';
  kicker.textContent = label;
  wrap.append(kicker, ...kids);
  return wrap;
}

export interface AppOptions {
  seed: number;
  preset: PresetName;
  speed: number;
  /** 생략하면 내장 기본값. 하한은 resolveSettings가 이미 강제한 뒤 들어온다. */
  settings?: PitwallSettings;
  /** 생략하면 시뮬레이터. 실 기록 재생은 ReplaySource를 넣는다. */
  source?: EventSource & { setSpeed(speed: number): void };
  /**
   * 지어낸 데이터인가 — DEMO 배지를 켠다. 생략하면 소스가 없을 때(시뮬레이터)
   * true. 실기록 재생은 source를 넣고 demo:false, 지어낸 재생은 demo:true.
   */
  demo?: boolean;
  /**
   * 로컬 단가 보정. 생략하면 보정 없음(내장 카탈로그). 시뮬레이터 cost 계산과
   * 설정 패널의 적용 출처 표시가 이걸 쓴다.
   */
  pricingOverride?: PricingOverride;
  /** Wall SKU 라이선스. 없으면 Free — k-익명성·만료 숨김을 적용하지 않는다. */
  license?: WallLicense;
  /** 처음부터 LIVE. 시뮬레이터를 끼우지 않는다. */
  live?: boolean;
}

export class PitwallApp {
  private source: EventSource & { setSpeed(speed: number): void };
  private director: Director;
  private broadcastDirector = new BroadcastDirector();
  settings: PitwallSettings;
  private routine = new RoutineRadio();
  private trackRenderer: BroadcastRendererSession;
  private broadcast3d: Circuit3DRenderer | null = null;
  private towerRenderer: TowerRenderer;
  private modelPanel: ModelPanel;
  private radioRenderer: RadioRenderer;
  private hudTime: HTMLElement;
  private hudSalary: HTMLElement;
  private hudPhase: HTMLElement;
  private hudPace: HTMLElement;
  private liveStatus: HTMLElement;
  private wallStatus: HTMLElement;
  /** 시간대별(0–23시) 작업 토큰 곡선. 근무일 타임라인 곁에 붙는 하루 모양. */
  private hudHourly: HTMLElement;
  private detail: HTMLElement;
  private broadcastFocus: HTMLElement;
  private broadcastFocusCarId: string | null = null;
  /** 데이터셋 선택기가 붙는 자리. 무엇을 보는지 화면이 늘 말해야 한다. */
  private hudSlot: HTMLElement;
  private live = false;
  /** 지어낸 데이터인가. LIVE의 반대편이 아니라 출처의 사실이다 — demoClock과 무관. */
  private demo: boolean;
  /** 실시간 창을 다시 뽑는 재료. 이벤트가 올 때마다 늘어난다. */
  private liveSamples: ActivitySample[] = [];
  private summaryRenderer: SummaryRenderer;
  private feedRenderer: FeedRenderer;
  private settingsPanel: SettingsPanel;
  private shell: HTMLElement;
  /** 계정 표시 이름. 이 기기에만 산다 (PRIV-6). 렌더가 렌더러들에 넘긴다 */
  private carNames: Record<string, string> = loadCarNames();
  /** 선택한 계정. 트랙에서 차를 누르면 바뀐다. */
  private selected: string | null = null;
  /**
   * 계정별 최근 호출. 카드가 "무엇이 돌고 있는지"를 보여주려면 이벤트가 필요한데
   * 리듀서는 집계만 들고 있다. 계정마다 링버퍼 하나면 충분하다.
   */
  private recent = new Map<string, RingBuffer<CarEvent>>();
  private lastBroadcastEvent = new Map<string, { readonly ts: number; readonly severity: BroadcastSeverity }>();
  private previousWorkRates = new Map<string, number>();
  private broadcastCandidates: readonly BroadcastCandidate[] = [];

  private raceState: RaceState = emptyRaceState(0);
  /** 마지막으로 모델을 만든 cars 참조. 리듀서가 이벤트마다 새 Map을 만들므로
   *  참조 비교 한 번이 곧 "상태가 바뀌었나"다 — 별도 배칭 타이머가 필요 없다. */
  private modelCars: RaceState['cars'] | null = null;
  private trackModel: TrackModel = { cold: [], hot: [], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } };
  private pinned = new Set<string>();
  private running = false;
  private lastPhase = phaseAt(new Date(), DEFAULT_WORKDAY);
  private lastRoutineAt = 0;
  private lastLiveSaveAt = 0;
  private lastLiveEventAt: number | null = null;
  private nextFreshnessAt = Number.POSITIVE_INFINITY;

  constructor(root: HTMLElement, private opts: AppOptions) {
    // 하한 강제는 resolveSettings에서 끝난다. 여기서는 결과를 쓰기만 한다.
    this.settings = opts.settings ?? DEFAULT_SETTINGS;
    this.live = opts.live ?? false;
    this.demo = opts.live ? false : (opts.demo ?? (opts.source === undefined));
    this.director = new Director(this.settings.cameraSlots);

    /*
     * 코스는 실제 서킷에서 고른다.
     *
     * 지어낸 코스는 매 실행 다른 모양이 나오는 대신 아무 모양도 아니었다 —
     * 곁눈질로 읽히는 건 "어제와 다르다"뿐이다. 실제 서킷은 형상 자체가 기억에
     * 걸리고, 좌표계 비율도 코스가 정한다(예전에는 1.5로 못박아 두고 생성기가
     * 거기 맞춰 늘어났다). 심은 서킷이 없으면 예전 생성기로 돈다.
     */
    const seed = opts.seed;
    const track = pickCircuit(seed);

    const shell = document.createElement('div');
    shell.className = 'pitwall';
    this.shell = shell;

    const hud = document.createElement('div');
    hud.className = 'hud';
    this.hudTime = document.createElement('div');
    this.hudTime.className = 'hud-item';
    this.hudPhase = document.createElement('div');
    this.hudPhase.className = 'hud-item';
    this.hudSalary = document.createElement('div');
    this.hudSalary.className = 'hud-item';
    // 돈과 속도가 첫 줄이다 — 감사 F2·F3. 비교 대상들이 전부 여기서 시작한다.
    this.hudPace = document.createElement('div');
    this.hudPace.className = 'hud-item hud-pace';
    this.liveStatus = document.createElement('div');
    this.liveStatus.className = 'hud-item live-status';
    this.liveStatus.setAttribute('role', 'status');
    this.liveStatus.setAttribute('aria-live', 'polite');
    this.liveStatus.style.display = 'none';
    this.wallStatus = document.createElement('div');
    this.wallStatus.className = 'hud-item wall-status';
    this.wallStatus.style.display = 'none';
    /*
     * 데이터셋 칸은 설정보다 **앞**이다.
     *
     * 상단 바는 줄바꿈을 막고 넘치면 자른다. 자를 때 `.settings`만 줄어들 수 있고
     * 나머지는 안 줄어드니, 설정이 0폭이 된 다음에는 **맨 뒤부터** 화면 밖으로
     * 밀린다. 데이터셋 칸을 마지막에 붙이면 `지어낸 데이터` 배지가 첫 희생자가
     * 된다 — 숨기면 안 되는 사실이 조작판보다 먼저 사라지는 순서였다.
     */
    const datasetSlot = document.createElement('div');
    datasetSlot.className = 'dataset-slot';
    this.hudHourly = document.createElement('div');
    this.hudHourly.className = 'hud-item hud-hourly';
    this.hudHourly.title = '시간대별 작업 토큰 0–23시';
    hud.append(
      hudCluster('clock', 'TIME', this.hudTime, this.hudPhase),
      hudCluster('pace', 'PACE', this.hudPace),
      this.liveStatus, this.wallStatus,
      hudCluster('pay', 'PAY', this.hudSalary),
      this.hudHourly, datasetSlot,
    );
    this.hudSlot = datasetSlot;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'track');

    // 타워가 먼저다. 트랙은 "어디쯤"을 말하고 타워가 "무엇이 일어나는가"를 말한다.
    const tower = document.createElement('div');
    tower.className = 'tower-slot';
    tower.appendChild(chromeKicker('tower', 'TOWER / 01'));
    const models = document.createElement('div');
    models.className = 'models-slot';

    const cams = document.createElement('div');
    cams.className = 'cams';
    this.broadcastFocus = document.createElement('section');
    this.broadcastFocus.className = 'broadcast-focus';
    this.broadcastFocus.setAttribute('aria-live', 'polite');
    this.broadcastFocus.textContent = '방송 포커스 없음 — 새 이벤트 대기';

    // 맵은 기존 SVG 칸. 3D 온보드는 MX 중계처럼 별도 칸에서 차를 쫓는다.
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.append(chromeKicker('track', 'TRACK / 02'), this.broadcastFocus, cams, svg);
    this.detail = detail;

    const broadcast = document.createElement('div');
    broadcast.className = 'broadcast';
    broadcast.appendChild(chromeKicker('broadcast', 'ONBOARD / 04'));

    const radio = document.createElement('div');
    radio.className = 'radio';
    radio.appendChild(chromeKicker('radio', 'RADIO / 03'));

    shell.append(hud, tower, detail, broadcast, radio);
    applyChromeMode(shell, this.settings.chromeMode);
    window.addEventListener('keydown', this.onChromeKey);
    root.appendChild(shell);

    this.summaryRenderer = new SummaryRenderer(shell);
    this.feedRenderer = new FeedRenderer(cams, FEED_ROWS);
    // 설정과 범례는 같은 자리에 고정된 별개 판이다. 하나를 열면 다른 하나를
    // 닫아 겹치는 것을 막는다 — 새 패널 매니저 대신 onOpen 콜백 하나로 짠다.
    let legendShell: HTMLElement | undefined;
    this.settingsPanel = new SettingsPanel(hud, this.settings, (next) => this.applySettings(next),
      {
        simulated: opts.source === undefined,
        onNamesChange: (): void => { this.carNames = loadCarNames(); this.render(this.raceState.now); },
        pricingOverride: opts.pricingOverride,
        onOpen: () => legendShell?.setAttribute('data-open', 'false'),
      });
    const settingsShell = hud.querySelector('.settings') as HTMLElement;
    new Legend(hud, () => settingsShell.setAttribute('data-open', 'false'));
    legendShell = hud.querySelector('.legend') as HTMLElement;

    this.towerRenderer = new TowerRenderer(tower, TOWER_ROWS);
    this.modelPanel = new ModelPanel(models, MODEL_ROWS);
    // 모델 판은 타워 **아래**다. 타워 렌더러가 자기 노드를 붙인 뒤에 이어 붙여야
    // 순서가 맞는다 — 먼저 붙이면 모델 판이 위로 올라간다.
    tower.appendChild(models);
    this.trackRenderer = bootBroadcastTrackRenderer(svg, track, {
      supported: () => false,
      createLegacy: () => new TrackRenderer(svg, track),
    });
    this.broadcast3d = Circuit3DRenderer.isSupported()
      ? new Circuit3DRenderer(broadcast, track)
      : null;
    this.detail.dataset['renderer'] = 'legacy';
    this.radioRenderer = new RadioRenderer(radio, RADIO_LINES);
    this.source = opts.source ?? new SimulatorSource(PRESETS[opts.preset], opts.speed, opts.pricingOverride?.entries);

    // 트랙에서 차를 고르면 그 계정의 내역을 띄운다. 같은 차를 다시 누르면 해제한다.
    this.trackRenderer.onSelect((carId) => {
      this.selected = this.selected === carId ? null : carId;
      this.modelCars = null;
    });

    this.towerRenderer.onSelect((carId) => {
      this.selected = this.selected === carId ? null : carId;
      this.pinned.clear();
      if (this.selected) this.pinned.add(this.selected);
      this.modelCars = null;   // 핀이 바뀌면 모델을 다시 만든다
    });
    // 카메라 카드가 사라지면서 핀 토글의 진입점도 사라졌다. 핀 자체는 트랙
    // 모델이 계속 쓰므로 남긴다 — 타워에서 고른 차를 그대로 핀으로 쓴다.

    // 탭 복귀 시 보간을 건너뛰고 현재 상태로 스냅한다 (PRD A9).
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.render(this.raceState.now);
    });

    this.opts = { ...opts, seed };
  }

  /** 소스에 콜백을 건다. `start`와 `useSource`가 같은 배선을 쓴다. */
  private wireSource(): void {
    // 되감기면 누적을 비운다. 안 그러면 오늘 비용이 한 바퀴마다 한 벌씩 늘어난다.
    this.source.onWrap?.(() => {
      this.raceState = { ...emptyRaceState(this.raceState.now), phase: this.raceState.phase };
      this.recent.clear();
      this.lastBroadcastEvent.clear();
      this.previousWorkRates.clear();
      this.broadcastCandidates = [];
      this.modelCars = null;
      this.selected = null;
    });

    this.source.start((event) => {
      if (this.live) this.lastLiveEventAt = event.ts;
      const before = this.raceState.cars.get(event.car_id);
      this.raceState = applyEvent(this.raceState, event);
      const log = this.recent.get(event.car_id)
        ?? this.recent.set(event.car_id, new RingBuffer<CarEvent>(FEED_HISTORY)).get(event.car_id)!;
      log.push(event);
      const broadcastSeverity = broadcastSeverityOf(event.kind);
      if (broadcastSeverity) {
        this.lastBroadcastEvent.set(event.car_id, { ts: event.ts, severity: broadcastSeverity });
      }
      // 실시간에서는 창이 활동을 따라 자란다. 창 밖으로 나가면 화면이 멈춘다.
      if (this.live) {
        this.liveSamples.push({ ts: event.wall_ts ?? event.ts, work: workOf(event) });
        if (this.liveSamples.length > LIVE_WINDOW_SAMPLES) this.liveSamples.shift();
      }
      // 호출 하나로 나오는 무전과, 상태가 바뀌어야 나오는 무전은 다른 사건이다.
      // 실데이터는 전부 `call`이라 앞의 것만으로는 화면이 영원히 조용하다.
      const msg = eventRadio(event)
        ?? stateRadio(before, this.raceState.cars.get(event.car_id)!);
      if (msg) this.radioRenderer.push(msg);
    });
  }

  /** 데이터셋 선택기를 상단 바에 붙인다. 배선은 browser.ts가 한다. */
  mountDatasetPicker(mount: (host: HTMLElement) => void): void {
    mount(this.hudSlot);
  }

  start(): void {
    this.running = true;
    this.wireSource();
    saveSession({
      id: `s-${this.opts.seed}-${this.opts.preset}`,
      seed: this.opts.seed,
      preset: this.opts.preset,
      speed: this.opts.speed,
      startedAt: this.raceState.now,
    });
  }

  /**
   * 소스를 갈아 끼운다.
   *
   * 네이티브 껍데기는 페이지가 뜬 뒤에 자기 존재를 알린다 — 그 전까지는 기록
   * 재생이 돌고 있으므로, 실시간으로 넘어갈 때 쌓인 재생분을 비워야 한다.
   * 안 그러면 어제 하루와 지금이 한 화면에서 합산된다.
   */
  useSource(source: EventSource & { setSpeed(speed: number): void },
            over: Partial<PitwallSettings> = {}): void {
    this.source.stop();
    this.raceState = emptyRaceState(this.raceState.now);
    this.recent.clear();
    this.lastBroadcastEvent.clear();
    this.previousWorkRates.clear();
    this.broadcastCandidates = [];
    this.modelCars = null;
    this.selected = null;
    this.source = source;
    this.settings = { ...this.settings, ...over };
    // 실시간 소스로 갈아탄다 — 지금이 지금이다. LIVE를 켜고 DEMO를 끈다.
    this.live = true;
    this.demo = false;
    this.liveSamples = [];
    this.lastLiveEventAt = null;
    if (this.running) this.wireSource();
  }

  stop(): void {
    this.running = false;
    this.source.stop();
  }

  frame(nowMs: number): void {
    if (!this.running) return;
    this.source.tick(nowMs);
    this.raceState = { ...this.raceState, now: Math.max(this.raceState.now, nowMs) };
    this.emitRoutineRadio(this.raceState.now);
    this.render(this.raceState.now);
    this.maybeSaveLive();
  }

  /**
   * 실시간이면 5초마다 누적 상태를 저장한다. 저장 실패(할당량 초과 등)는 조용히
   * 무시한다 — 스냅샷 하나를 못 남긴다고 프레임 루프를 죽이면 안 된다.
   */
  private maybeSaveLive(): void {
    if (!this.live) return;
    if (this.raceState.now - this.lastLiveSaveAt < LIVE_SAVE_INTERVAL_MS) return;
    this.lastLiveSaveAt = this.raceState.now;
    const snap = this.captureLiveSnapshot();
    if (!snap) return;
    try {
      saveLiveSnapshot(snap);
    } catch {
      // 저장소가 거부하면 다음 주기에 다시 시도한다.
    }
  }

  /** 지금 누적 상태를 스냅샷으로 굳힌다. 실시간이 아니면 저장할 것이 없다. */
  captureLiveSnapshot(): LiveSnapshot | null {
    if (!this.live) return null;
    return serializeLiveState(this.raceState, this.liveSamples);
  }

  /**
   * 스냅샷을 새 페이지 시계에 맞춰 되살린다. **반드시 `useSource` 이후**에 부른다 —
   * `useSource`가 `raceState`를 비우므로 순서가 뒤집히면 복원분이 지워진다.
   *
   * 집계(`raceState`)와 실시간 창(`liveSamples`)만 되살린다. 피드 링버퍼(`recent`)는
   * 비운 채 둔다 — 카드가 "지금 무엇이 도는가"를 보여주는데 옛 호출을 새것처럼
   * 되살리면 거짓이 된다. 새 이벤트부터 채운다.
   */
  restoreLiveState(snap: LiveSnapshot): void {
    const { state, samples } = rebaseLiveSnapshot(snap, performance.now());
    this.raceState = state;
    this.liveSamples = samples;
    this.modelCars = null;
    this.lastLiveSaveAt = state.now;
    const lastEventAt = Math.max(...[...state.cars.values()].map((car) => car.last_event_ts));
    this.lastLiveEventAt = Number.isFinite(lastEventAt) ? lastEventAt : null;
  }

  private emitRoutineRadio(now: number): void {
    if (now - this.lastRoutineAt < ROUTINE_INTERVAL_MS) return;
    this.lastRoutineAt = now;
    for (const car of this.raceState.cars.values()) {
      const msg = this.routine.evaluate(car, now);
      if (msg) this.radioRenderer.push(msg);
    }
  }

  private render(now: number): void {
    // 데모 모드면 벽시계를 근무 창 안으로 접는다. 시각을 지어내므로 HUD에 표시한다.
    const real = new Date();
    // 기록을 재생 중이면 시계는 재생 위치다. 데모 시계는 벽시계 분을 창 안으로
    // 접기만 해서 배속을 타지 않는다 — 그대로 두면 HUD가 오후를 가리키는데
    // 화면의 비용은 아침 값이 된다. 시뮬레이터에서만 쓴다.
    if (this.live) {
      this.settings = { ...this.settings, workday: liveWorkday(this.liveSamples, real.getTime()) };
    }
    const replayed = this.source?.replayClock?.();
    const wall = replayed
      ?? (this.settings.demoClock ? demoClock(real, this.settings.workday) : real);
    const phase = phaseAt(wall, this.settings.workday);
    const transition: RadioMessage | null = phaseRadio(phase, this.lastPhase, now);
    if (transition) this.radioRenderer.push(transition);
    this.lastPhase = phase;
    this.raceState = { ...this.raceState, phase, elapsed_ms: elapsedMs(wall, this.settings.workday) };

    if (this.modelCars !== this.raceState.cars || now >= this.nextFreshnessAt) {
      this.modelCars = this.raceState.cars;
      this.trackModel = buildTrackModel(this.raceState, now, {
        highlightTypes: this.settings.highlightTypes,
        fuelWarnPct: this.settings.fuelWarnThresholdPct,
        limitWarnPct: this.settings.limitWarnThresholdPct,
        pinned: this.pinned,
      });
      this.broadcastCandidates = this.buildBroadcastCandidates(now);
      this.nextFreshnessAt = Number.POSITIVE_INFINITY;
      for (const car of this.raceState.cars.values()) {
        const quietAt = car.last_event_ts + FRESH_THRESHOLD_MS + 1;
        const staleAt = car.last_event_ts + IDLE_THRESHOLD_MS + 1;
        const next = now < quietAt ? quietAt : now < staleAt ? staleAt : Number.POSITIVE_INFINITY;
        this.nextFreshnessAt = Math.min(this.nextFreshnessAt, next);
      }
    }
    const broadcastSelection = this.broadcastDirector.select(
      this.broadcastCandidates, now, this.selected,
    );
    const wallNow = real.getTime();
    const wallMode = towerMode(this.opts.license ?? null, wallNow, this.raceState.cars.size);
    const hideOrgCars = wallMode === 'hidden';
    const focusId = hideOrgCars ? null
      : (broadcastSelection.kind === 'selected' ? broadcastSelection.carId : null);
    const model = hideOrgCars
      ? { cold: [], hot: [], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } }
      : this.trackModel;
    this.trackRenderer.render(model, now, focusId);
    this.broadcast3d?.render(model, now, focusId);
    this.detail.dataset['renderer'] = 'legacy';
    this.renderBroadcastFocus(hideOrgCars ? { kind: 'empty' } : broadcastSelection, now);
    this.settingsPanel.setAccounts([...this.raceState.cars.values()]);
    this.towerRenderer.render(
      this.raceState, now, wallNow, this.selected,
      (carId) => this.recent.get(carId)?.toArray() ?? [],
      // 줄이 모자랄 때 누구를 남길지는 디렉터가 고른다 — 에러·한도가 급한 쪽.
      this.director.update(this.raceState, now),
      this.settings.speed, this.carNames,
      {
        mode: wallMode,
        maxCars: this.opts.license?.maxCars,
      });
    this.modelPanel.render(hideOrgCars
      ? { ...this.raceState, cars: new Map() }
      : this.raceState);

    // 선택이 있으면 카메라 대신 그 계정의 내역을 보여준다.
    const picked = hideOrgCars ? undefined : (this.selected ? this.raceState.cars.get(this.selected) : undefined);
    const open = picked ? 'true' : 'false';
    if (this.detail.getAttribute('data-selected') !== open) {
      this.detail.setAttribute('data-selected', open);
    }
    this.feedRenderer.render(
      picked ? { carId: picked.car_id, carNumber: picked.car_number, carClass: picked.car_class, model: picked.model } : null,
      picked ? (this.recent.get(picked.car_id)?.toArray() ?? []) : [], this.carNames);
    this.summaryRenderer.render(this.raceState);
    this.radioRenderer.render(this.carNames);

    // 분모는 근무 창이 아니라 레이스 시간이다 — 점심을 뺀 값 (PRD §7.0).
    const total = formatElapsed(raceDurationMs(this.settings.workday));
    // 경과만으로는 어느 날 몇 시인지 알 수 없다. 벽시계를 같이 쓴다.
    setText(this.hudTime,
      `${formatWallClock(wall)}  ⏱ ${formatElapsed(this.raceState.elapsed_ms)} / ${total}`);
    // 조직 속도도 최근 창이다. 타워 줄과 같은 기준이어야 둘이 안 어긋난다.
    const window_ = PACE_WINDOW_MS / Math.max(1, this.settings.speed);
    const allRecent: CarEvent[] = [];
    for (const buf of this.recent.values()) allRecent.push(...buf.toArray());
    setText(this.hudPace,
      formatPace(paceOf(this.raceState,
        { events: allRecent, now, windowMs: window_, speed: this.settings.speed })));
    setText(this.hudPhase,
      `${phase.toUpperCase().replace('_', ' ')}`
      + (this.demo ? ' · DEMO' : ''));
    this.renderLiveStatus(now);
    const wallCopy = wallHudCopy(this.opts.license ?? null, real.getTime());
    const wantedWall = wallCopy === null ? 'none' : '';
    if (this.wallStatus.style.display !== wantedWall) this.wallStatus.style.display = wantedWall;
    if (wallCopy !== null) setText(this.wallStatus, wallCopy);

    /*
     * 연봉이 없으면 칸 자체를 안 그린다.
     *
     * `💰 연봉 미설정`이 상단 바의 프라임 자리를 영구 점유하고 있었다. 값이 없는
     * 기능이 자리를 차지하면 그만큼 오른쪽이 밀리고, 실측 1440×900에서 조작판의
     * `한도` 체크박스가 그 밀림으로 반쯤 잘렸다. 설정하는 곳은 설정 판이다.
     */
    const salary = loadSalaryConfig();
    const wanted = salary ? '' : 'none';
    if (this.hudSalary.style.display !== wanted) this.hudSalary.style.display = wanted;
    if (salary) {
      setText(this.hudSalary,
        `💰 ${Math.round(earnedSoFar(salary, this.settings.workday, wall)).toLocaleString('ko-KR')}원`);
    }

    // 하루가 전부 0이면 곡선을 안 그린다 — 연봉 미설정 칸과 같은 규칙.
    const curve = hourlyCurve(hourlyProfile(this.raceState.cars.values()));
    const wantedHourly = curve ? '' : 'none';
    if (this.hudHourly.style.display !== wantedHourly) this.hudHourly.style.display = wantedHourly;
    if (curve) setText(this.hudHourly, curve);
  }

  private buildBroadcastCandidates(now: number): readonly BroadcastCandidate[] {
    const candidates: BroadcastCandidate[] = [];
    for (const car of this.raceState.cars.values()) {
      if (car.activity === 'retired') continue;
      const recentEvent = this.lastBroadcastEvent.get(car.car_id) ?? null;
      const previousWorkPerMin = this.previousWorkRates.get(car.car_id) ?? null;
      const stoppedReason = car.last_error_ts !== undefined && now - car.last_error_ts <= 10_000
        ? 'error'
        : car.tyre_pct !== undefined && car.tyre_pct < this.settings.limitWarnThresholdPct
          ? 'limit' : null;
      candidates.push({
        carId: car.car_id,
        lastEventTs: car.last_event_ts,
        fresh: freshnessOf(car, now) === 'fresh',
        stoppedReason,
        recentEvent,
        workPerMin: car.work_per_min,
        previousWorkPerMin,
      });
      this.previousWorkRates.set(car.car_id, car.work_per_min);
    }
    return candidates;
  }

  private renderBroadcastFocus(selection: BroadcastSelection, now: number): void {
    const nextCarId = selection.kind === 'selected' ? selection.carId : null;
    if (nextCarId !== this.broadcastFocusCarId
      && typeof this.broadcastFocus.animate === 'function'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.broadcastFocus.animate(
        [
          { opacity: 0.55, transform: 'translateY(-4px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
    }
    this.broadcastFocusCarId = nextCarId;
    if (selection.kind === 'empty') {
      setText(this.broadcastFocus, this.raceState.cars.size === 0
        ? '방송 포커스 없음 — 새 이벤트 대기 · 관측 차량 없음 — 최근 호출이 없어 트랙이 비어 있음. 고장이 아님'
        : '방송 포커스 없음 — 새 이벤트 대기');
      return;
    }
    const car = this.raceState.cars.get(selection.carId);
    if (!car) {
      setText(this.broadcastFocus, '방송 포커스 없음 — 새 이벤트 대기');
      return;
    }
    const candidate = this.broadcastCandidates.find((entry) => entry.carId === car.car_id);
    const reason = candidate?.stoppedReason?.toUpperCase() ?? car.activity.toUpperCase();
    const freshness = freshnessOf(car, now).toUpperCase();
    const age = Math.max(0, now - car.last_event_ts);
    this.broadcastFocus.dataset['source'] = selection.source;
    setText(this.broadcastFocus,
      `FOCUS ${String(car.car_number).padStart(2, '0')} · ${reason} · `
      + `${Math.round(car.work_per_min).toLocaleString('ko-KR')} tok/min · `
      + `EVENT ${formatElapsed(age)} · ${freshness}`);
  }

  private renderLiveStatus(now: number): void {
    this.liveStatus.style.display = this.live ? '' : 'none';
    if (!this.live) return;
    const pending = this.source.pending ?? 0;
    const age = this.lastLiveEventAt === null ? null : now - this.lastLiveEventAt;
    const state = pending > 0 ? 'syncing' : age !== null && age > IDLE_THRESHOLD_MS ? 'stale' : 'connected';
    this.liveStatus.setAttribute('data-live-state', state);
    setText(this.liveStatus, state === 'syncing'
      ? `LIVE · SYNCING +${pending}`
      : state === 'stale'
        ? `LIVE · STALE DATA ${formatElapsed(age ?? 0)}`
        : `LIVE · ${age === null ? 'WAITING' : 'CONNECTED'}`);
  }

  /**
   * 설정 변경을 반영한다. 프리셋·배속은 다음 이벤트부터 적용되고
   * 이미 발생한 이벤트의 의미를 소급 변경하지 않는다 (PRD §7.0).
   */
  private applySettings(next: PitwallSettings): void {
    this.settings = next;
    this.source.setSpeed(next.speed);
    this.modelCars = null;   // 하이라이트 필터가 바뀌었을 수 있다
    applyChromeMode(this.shell, next.chromeMode);
  }

  private cycleBroadcast(step: 1 | -1): void {
    const ids = [...this.raceState.cars.values()]
      .filter((car) => car.activity !== 'retired')
      .sort((a, b) => a.car_number - b.car_number || (a.car_id < b.car_id ? -1 : 1))
      .map((car) => car.car_id);
    const next = cycleFocus(ids, this.selected ?? this.broadcastFocusCarId, step);
    this.selected = next;
    this.pinned.clear();
    if (next) this.pinned.add(next);
    this.modelCars = null;
  }

  private onChromeKey = (event: KeyboardEvent): void => {
    if (!this.shell.isConnected) return;
    if (isChromeHotkeyBlocked(event.target)) return;
    if (event.key === '[' || event.key === ',') {
      event.preventDefault();
      this.cycleBroadcast(-1);
      this.render(this.raceState.now);
      return;
    }
    if (event.key === ']' || event.key === '.') {
      event.preventDefault();
      this.cycleBroadcast(1);
      this.render(this.raceState.now);
      return;
    }
    if (event.key === 'Escape') {
      this.selected = null;
      this.pinned.clear();
      this.modelCars = null;
      this.render(this.raceState.now);
      return;
    }
    const mode = chromeModeFromKey(event.key);
    if (mode === null) return;
    this.settingsPanel.setChromeMode(mode);
  };

  get state(): RaceState {
    return this.raceState;
  }
}
