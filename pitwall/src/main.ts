import type { RaceState } from './types';
import { PRESETS, type PresetName } from './config/presets';
import { SimulatorSource } from './source/SimulatorSource';
import { emptyRaceState, applyEvent } from './state/reducer';
import { DEFAULT_WORKDAY, phaseAt, elapsedMs, raceDurationMs } from './state/clock';
import { generateTrack, validateTrack } from './track/generateTrack';
import { buildTrackModel, type TrackModel } from './track/trackModel';
import { Director } from './director/director';
import { eventRadio, phaseRadio, type RadioMessage } from './radio/eventRadio';
import { RoutineRadio } from './radio/routineRadio';
import { TrackRenderer } from './render/trackRenderer';
import { CameraRenderer } from './render/cameraRenderer';
import { RadioRenderer } from './render/radioRenderer';
import { loadSalaryConfig, earnedSoFar, formatElapsed } from './render/hudRenderer';
import { setText } from './render/setText';
import { saveSession } from './session/sessionStore';
import { DEFAULT_SETTINGS, type PitwallSettings } from './config/settings';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIO_LINES = 3;
const ROUTINE_INTERVAL_MS = 3_600_000;

export interface AppOptions {
  seed: number;
  preset: PresetName;
  speed: number;
  /** 생략하면 내장 기본값. 하한은 resolveSettings가 이미 강제한 뒤 들어온다. */
  settings?: PitwallSettings;
}

export class PitwallApp {
  private source: SimulatorSource;
  private director: Director;
  readonly settings: PitwallSettings;
  private routine = new RoutineRadio();
  private trackRenderer: TrackRenderer;
  private cameraRenderer: CameraRenderer;
  private radioRenderer: RadioRenderer;
  private hudTime: HTMLElement;
  private hudSalary: HTMLElement;
  private hudPhase: HTMLElement;

  private raceState: RaceState = emptyRaceState(0);
  /** 마지막으로 모델을 만든 cars 참조. 리듀서가 이벤트마다 새 Map을 만들므로
   *  참조 비교 한 번이 곧 "상태가 바뀌었나"다 — 별도 배칭 타이머가 필요 없다. */
  private modelCars: RaceState['cars'] | null = null;
  private trackModel: TrackModel = { clusters: [], hot: [], hotOverflow: 0, laneOverflow: { H: 0, P: 0, GT: 0 } };
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
    let track = generateTrack(seed);
    for (let attempts = 0; validateTrack(track).length > 0 && attempts < 50; attempts++) {
      seed += 1;
      track = generateTrack(seed);
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

    this.trackRenderer = new TrackRenderer(svg, track);
    this.cameraRenderer = new CameraRenderer(cams, this.settings.cameraSlots);
    this.radioRenderer = new RadioRenderer(radio, RADIO_LINES);
    this.source = new SimulatorSource(PRESETS[opts.preset], opts.speed);

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
    const wall = new Date();
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
        pinned: this.pinned,
      });
    }
    this.trackRenderer.render(this.trackModel, now);
    this.cameraRenderer.render(this.raceState, this.director.update(this.raceState, now));
    this.radioRenderer.render();

    // 분모는 근무 창이 아니라 레이스 시간이다 — 점심을 뺀 값 (PRD §7.0).
    const total = formatElapsed(raceDurationMs(this.settings.workday));
    setText(this.hudTime, `⏱ ${formatElapsed(this.raceState.elapsed_ms)} / ${total}`);
    setText(this.hudPhase, phase.toUpperCase().replace('_', ' '));

    const salary = loadSalaryConfig();
    setText(this.hudSalary, salary
      ? `💰 ${Math.round(earnedSoFar(salary, this.settings.workday, wall)).toLocaleString('ko-KR')}원`
      : '💰 연봉 미설정');
  }

  get state(): RaceState {
    return this.raceState;
  }
}
