import type { RaceState } from './types';
import { PRESETS, type PresetName } from './config/presets';
import { SimulatorSource } from './source/SimulatorSource';
import type { EventSource } from './source/EventSource';
import { emptyRaceState, applyEvent } from './state/reducer';
import { DEFAULT_WORKDAY, phaseAt, elapsedMs, raceDurationMs, formatWallClock } from './state/clock';
import { paceOf, formatPace } from './state/pace';
import { demoClock } from './state/demoClock';
import { generateTrack, validateTrack } from './track/generateTrack';

/**
 * 트랙 영역의 가로:세로. 두 번째 모니터는 가로로 길고, 정사각 코스를 그리면
 * 오른쪽이 통째로 빈다 — 실측 1600×1000 화면에서 약 400px이 죽었다.
 */
const TRACK_ASPECT = 1.5;
import { buildTrackModel, type TrackModel } from './track/trackModel';
import { Director } from './director/director';
import { eventRadio, stateRadio, phaseRadio, type RadioMessage } from './radio/eventRadio';
import { RoutineRadio } from './radio/routineRadio';
import { TrackRenderer } from './render/trackRenderer';
import { TowerRenderer } from './render/towerRenderer';
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
/** 타워 줄 수. 계정이 더 많으면 남는 줄은 접힌 것으로 표시해야 한다 (미구현). */
const TOWER_ROWS = 14;
const FEED_ROWS = 12;
/** 계정별로 보관하는 최근 호출 수 */
/** 계정별로 들고 있는 최근 호출 수. 피드가 쓰고 스파크라인도 여기서 읽는다. */
const FEED_HISTORY = 400;
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
  private towerRenderer: TowerRenderer;
  private radioRenderer: RadioRenderer;
  private hudTime: HTMLElement;
  private hudSalary: HTMLElement;
  private hudPhase: HTMLElement;
  private hudPace: HTMLElement;
  private detail: HTMLElement;
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
    // 돈과 속도가 첫 줄이다 — 감사 F2·F3. 비교 대상들이 전부 여기서 시작한다.
    this.hudPace = document.createElement('div');
    this.hudPace.className = 'hud-item hud-pace';
    hud.append(this.hudTime, this.hudPace, this.hudPhase, this.hudSalary);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'track');

    // 타워가 먼저다. 트랙은 "어디쯤"을 말하고 타워가 "무엇이 일어나는가"를 말한다.
    const tower = document.createElement('div');
    tower.className = 'tower-slot';

    const cams = document.createElement('div');
    cams.className = 'cams';

    // 오른쪽 한 칸: 위는 선택한 계정 내역, 아래는 줄어든 트랙.
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.append(cams, svg);
    this.detail = detail;

    const radio = document.createElement('div');
    radio.className = 'radio';

    shell.append(hud, tower, detail, radio);
    root.appendChild(shell);

    this.summaryRenderer = new SummaryRenderer(shell);
    this.feedRenderer = new FeedRenderer(cams, FEED_ROWS);
    new SettingsPanel(hud, this.settings, (next) => this.applySettings(next));

    this.towerRenderer = new TowerRenderer(tower, TOWER_ROWS);
    this.trackRenderer = new TrackRenderer(svg, track);
    this.radioRenderer = new RadioRenderer(radio, RADIO_LINES);
    this.source = opts.source ?? new SimulatorSource(PRESETS[opts.preset], opts.speed);

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

  start(): void {
    this.running = true;
    this.source.start((event) => {
      const before = this.raceState.cars.get(event.car_id);
      this.raceState = applyEvent(this.raceState, event);
      const log = this.recent.get(event.car_id)
        ?? this.recent.set(event.car_id, new RingBuffer<CarEvent>(FEED_HISTORY)).get(event.car_id)!;
      log.push(event);
      // 호출 하나로 나오는 무전과, 상태가 바뀌어야 나오는 무전은 다른 사건이다.
      // 실데이터는 전부 `call`이라 앞의 것만으로는 화면이 영원히 조용하다.
      const msg = eventRadio(event)
        ?? stateRadio(before, this.raceState.cars.get(event.car_id)!);
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
    // 기록을 재생 중이면 시계는 재생 위치다. 데모 시계는 벽시계 분을 창 안으로
    // 접기만 해서 배속을 타지 않는다 — 그대로 두면 HUD가 오후를 가리키는데
    // 화면의 비용은 아침 값이 된다. 시뮬레이터에서만 쓴다.
    const replayed = this.source?.replayClock?.();
    const wall = replayed
      ?? (this.settings.demoClock ? demoClock(real, this.settings.workday) : real);
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
    this.towerRenderer.render(
      this.raceState, now, real.getTime(), this.selected,
      (carId) => this.recent.get(carId)?.toArray() ?? [],
      // 줄이 모자랄 때 누구를 남길지는 디렉터가 고른다 — 에러·한도가 급한 쪽.
      this.director.update(this.raceState, now),
      this.settings.speed);

    // 선택이 있으면 카메라 대신 그 계정의 내역을 보여준다.
    const picked = this.selected ? this.raceState.cars.get(this.selected) : undefined;
    const open = picked ? 'true' : 'false';
    if (this.detail.getAttribute('data-selected') !== open) {
      this.detail.setAttribute('data-selected', open);
    }
    this.feedRenderer.render(
      picked ? { carNumber: picked.car_number, carClass: picked.car_class, model: picked.model } : null,
      picked ? (this.recent.get(picked.car_id)?.toArray() ?? []) : []);
    this.summaryRenderer.render(this.raceState);
    this.radioRenderer.render();

    // 분모는 근무 창이 아니라 레이스 시간이다 — 점심을 뺀 값 (PRD §7.0).
    const total = formatElapsed(raceDurationMs(this.settings.workday));
    // 경과만으로는 어느 날 몇 시인지 알 수 없다. 벽시계를 같이 쓴다.
    setText(this.hudTime,
      `${formatWallClock(wall)}  ⏱ ${formatElapsed(this.raceState.elapsed_ms)} / ${total}`);
    setText(this.hudPace, formatPace(paceOf(this.raceState)));
    setText(this.hudPhase,
      // 기록을 재생 중이면 시계는 지어낸 값이 아니라 재생 위치다 — DEMO를 붙이면
      // 그게 거짓말이 된다.
      `${phase.toUpperCase().replace('_', ' ')}${!replayed && this.settings.demoClock ? ' · DEMO' : ''}`);

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
