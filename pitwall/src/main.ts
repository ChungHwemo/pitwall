import type { RaceState } from './types';
import { PRESETS, type PresetName } from './config/presets';
import { SimulatorSource } from './source/SimulatorSource';
import type { EventSource } from './source/EventSource';
import { emptyRaceState, applyEvent } from './state/reducer';
import { DEFAULT_WORKDAY, phaseAt, elapsedMs, raceDurationMs } from './state/clock';
import { demoClock } from './state/demoClock';
import { generateTrack, validateTrack } from './track/generateTrack';

/**
 * 트랙 영역의 가로:세로. 두 번째 모니터는 가로로 길고, 정사각 코스를 그리면
 * 오른쪽이 통째로 빈다 — 실측 1600×1000 화면에서 약 400px이 죽었다.
 */
const TRACK_ASPECT = 1.5;
import { buildTrackModel, type TrackModel } from './track/trackModel';
import { Director } from './director/director';
import { eventRadio, phaseRadio, type RadioMessage } from './radio/eventRadio';
import { RoutineRadio } from './radio/routineRadio';
import { TrackRenderer } from './render/trackRenderer';
import { CameraRenderer } from './render/cameraRenderer';
import { RadioRenderer } from './render/radioRenderer';
import { loadSalaryConfig, earnedSoFar, formatElapsed } from './render/hudRenderer';
import { setText } from './render/setText';
import { SummaryRenderer } from './render/summaryRenderer';
import { FeedRenderer } from './render/feedRenderer';
import type { CarEvent } from './types';
import { SettingsPanel } from './render/settingsPanel';
import { saveSession } from './session/sessionStore';
import { RingBuffer } from './state/ringBuffer';
import { DEFAULT_SETTINGS, type PitwallSettings } from './config/settings';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIO_LINES = 3;
const FEED_ROWS = 12;
/** 계정별로 보관하는 최근 호출 수 */
const FEED_HISTORY = 60;
const ROUTINE_INTERVAL_MS = 3_600_000;

export interface AppOptions {
  seed: number;
  preset: PresetName;
  speed: number;
  /** 생략하면 내장 기본값. 하한은 resolveSettings가 이미 강제한 뒤 들어온다. */
  settings?: PitwallSettings;
  /** 생략하면 시뮬레이터. 실 기록 재생은 ReplaySource를 넣는다. */
  source?: EventSource & { setSpeed(speed: number): void };
}

export class PitwallApp {
  private source: EventSource & { setSpeed(speed: number): void };
  private director: Director;
  settings: PitwallSettings;
  private routine = new RoutineRadio();
  private trackRenderer: TrackRenderer;
  private cameraRenderer: CameraRenderer;
  private radioRenderer: RadioRenderer;
  private hudTime: HTMLElement;
  private hudSalary: HTMLElement;
  private hudPhase: HTMLElement;
  private summaryRenderer: SummaryRenderer;
  private feedRenderer: FeedRenderer;
  /** 선택한 계정. 트랙에서 차를 누르면 바뀐다. */
  private selected: string | null = null;
  /**
   * 계정별 최근 호출. 카드가 "무엇이 돌고 있는지"를 보여주려면 이벤트가 필요한데
   * 리듀서는 집계만 들고 있다. 계정마다 링버퍼 하나면 충분하다.
   */
  private recent = new Map<string, RingBuffer<CarEvent>>();

  private raceState: RaceState = emptyRaceState(0);
  /** 마지막으로 모델을 만든 cars 참조. 리듀서가 이벤트마다 새 Map을 만들므로
   *  참조 비교 한 번이 곧 "상태가 바뀌었나"다 — 별도 배칭 타이머가 필요 없다. */
  private modelCars: RaceState['cars'] | null = null;
  private trackModel: TrackModel = { cold: [], hot: [], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } };
  private pinned = new Set<string>();
  private running = false;
  private lastPhase = phaseAt(new Date(), DEFAULT_WORKDAY);
  private lastRoutineAt = 0;

  constructor(root: HTMLElement, private opts: AppOptions) {
    // 하한 강제는 resolveSettings에서 끝난다. 여기서는 결과를 쓰기만 한다.
    this.settings = opts.settings ?? DEFAULT_SETTINGS;
    this.director = new Director(this.settings.cameraSlots);

    // 트랙은 유효성 검사를 통과할 때까지 시드를 밀어가며 재생성한다 (PRD §15).
    let seed = opts.seed;
    const shape = { resolution: 240, lobes: 3, aspect: TRACK_ASPECT };
    let track = generateTrack(seed, shape);
    for (let attempts = 0; validateTrack(track).length > 0 && attempts < 50; attempts++) {
      seed += 1;
      track = generateTrack(seed, shape);
    }

    const shell = document.createElement('div');
    shell.className = 'pitwall';

    const hud = document.createElement('div');
    hud.className = 'hud';
    this.hudTime = document.createElement('div');
    this.hudTime.className = 'hud-item';
    this.hudPhase = document.createElement('div');
    this.hudPhase.className = 'hud-item';
    this.hudSalary = document.createElement('div');
    this.hudSalary.className = 'hud-item';
    hud.append(this.hudTime, this.hudPhase, this.hudSalary);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'track');

    const cams = document.createElement('div');
    cams.className = 'cams';

    const radio = document.createElement('div');
    radio.className = 'radio';

    shell.append(hud, svg, cams, radio);
    root.appendChild(shell);

    this.summaryRenderer = new SummaryRenderer(shell);
    this.feedRenderer = new FeedRenderer(cams, FEED_ROWS);
    new SettingsPanel(hud, this.settings, (next) => this.applySettings(next));

    this.trackRenderer = new TrackRenderer(svg, track);
    this.cameraRenderer = new CameraRenderer(cams, this.settings.cameraSlots);
    this.radioRenderer = new RadioRenderer(radio, RADIO_LINES);
    this.source = opts.source ?? new SimulatorSource(PRESETS[opts.preset], opts.speed);

    // 트랙에서 차를 고르면 그 계정의 내역을 띄운다. 같은 차를 다시 누르면 해제한다.
    this.trackRenderer.onSelect((carId) => {
      this.selected = this.selected === carId ? null : carId;
      this.modelCars = null;
    });

    this.cameraRenderer.onPinToggle((carId) => {
      this.director.pin(carId);
      this.pinned.add(carId);
      this.modelCars = null;   // 핀이 바뀌면 모델을 다시 만든다
    });

    // 탭 복귀 시 보간을 건너뛰고 현재 상태로 스냅한다 (PRD A9).
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.render(this.raceState.now);
    });

    this.opts = { ...opts, seed };
  }

  start(): void {
    this.running = true;
    this.source.start((event) => {
      this.raceState = applyEvent(this.raceState, event);
      const log = this.recent.get(event.car_id)
        ?? this.recent.set(event.car_id, new RingBuffer<CarEvent>(FEED_HISTORY)).get(event.car_id)!;
      log.push(event);
      const msg = eventRadio(event);
      if (msg) this.radioRenderer.push(msg);
    });
    saveSession({
      id: `s-${this.opts.seed}-${this.opts.preset}`,
      seed: this.opts.seed,
      preset: this.opts.preset,
      speed: this.opts.speed,
      startedAt: this.raceState.now,
    });
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
    const wall = this.settings.demoClock ? demoClock(real, this.settings.workday) : real;
    const phase = phaseAt(wall, this.settings.workday);
    const transition: RadioMessage | null = phaseRadio(phase, this.lastPhase, now);
    if (transition) this.radioRenderer.push(transition);
    this.lastPhase = phase;
    this.raceState = { ...this.raceState, phase, elapsed_ms: elapsedMs(wall, this.settings.workday) };

    // 모델은 상태가 바뀔 때만 만든다. 프레임은 hot 보간만 한다.
    if (this.modelCars !== this.raceState.cars) {
      this.modelCars = this.raceState.cars;
      this.trackModel = buildTrackModel(this.raceState, now, {
        highlightTypes: this.settings.highlightTypes,
        fuelWarnPct: this.settings.fuelWarnThresholdPct,
        limitWarnPct: this.settings.limitWarnThresholdPct,
        pinned: this.pinned,
      });
    }
    this.trackRenderer.render(this.trackModel, now, this.selected);

    // 선택이 있으면 카메라 대신 그 계정의 내역을 보여준다.
    const picked = this.selected ? this.raceState.cars.get(this.selected) : undefined;
    this.feedRenderer.render(
      picked ? { carNumber: picked.car_number, carClass: picked.car_class } : null,
      picked ? (this.recent.get(picked.car_id)?.toArray() ?? []) : []);
    this.summaryRenderer.render(this.raceState);
    // 선택 중에는 자동 선별 카드를 감춘다 — 한 화면에 둘 다 띄우면 읽을 게 두 배가 된다.
    this.cameraRenderer.render(
      this.raceState, this.selected ? [] : this.director.update(this.raceState, now));
    this.radioRenderer.render();

    // 분모는 근무 창이 아니라 레이스 시간이다 — 점심을 뺀 값 (PRD §7.0).
    const total = formatElapsed(raceDurationMs(this.settings.workday));
    setText(this.hudTime, `⏱ ${formatElapsed(this.raceState.elapsed_ms)} / ${total}`);
    setText(this.hudPhase,
      `${phase.toUpperCase().replace('_', ' ')}${this.settings.demoClock ? ' · DEMO' : ''}`);

    const salary = loadSalaryConfig();
    setText(this.hudSalary, salary
      ? `💰 ${Math.round(earnedSoFar(salary, this.settings.workday, wall)).toLocaleString('ko-KR')}원`
      : '💰 연봉 미설정');
  }

  /**
   * 설정 변경을 반영한다. 프리셋·배속은 다음 이벤트부터 적용되고
   * 이미 발생한 이벤트의 의미를 소급 변경하지 않는다 (PRD §7.0).
   */
  private applySettings(next: PitwallSettings): void {
    this.settings = next;
    this.source.setSpeed(next.speed);
    this.modelCars = null;   // 하이라이트 필터가 바뀌었을 수 있다
  }

  get state(): RaceState {
    return this.raceState;
  }
}
