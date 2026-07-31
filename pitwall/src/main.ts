import type { RaceState } from './types';
import { PRESETS, type PresetName } from './config/presets';
import { SimulatorSource } from './source/SimulatorSource';
import type { EventSource } from './source/EventSource';
import { emptyRaceState, applyEvent, workOf } from './state/reducer';
import { DEFAULT_WORKDAY, phaseAt, elapsedMs, raceDurationMs, formatWallClock, liveWorkday } from './state/clock';
import type { ActivitySample } from './state/clock';
import { paceOf, formatPace } from './state/pace';
import { demoClock } from './state/demoClock';
import { pickCircuit } from './track/circuits';
import { buildTrackModel, type TrackModel } from './track/trackModel';
import { Director } from './director/director';
import { eventRadio, stateRadio, phaseRadio, type RadioMessage } from './radio/eventRadio';
import { RoutineRadio } from './radio/routineRadio';
import { TrackRenderer } from './render/trackRenderer';
import { TowerRenderer } from './render/towerRenderer';
import { ModelPanel } from './render/modelPanel';
import { RadioRenderer } from './render/radioRenderer';
import { loadSalaryConfig, earnedSoFar, formatElapsed } from './render/hudRenderer';
import { setText } from './render/setText';
import { SummaryRenderer } from './render/summaryRenderer';
import { FeedRenderer } from './render/feedRenderer';
import type { CarEvent } from './types';
import { SettingsPanel } from './render/settingsPanel';
import { Legend } from './render/legend';
import { saveSession } from './session/sessionStore';
import { RingBuffer } from './state/ringBuffer';
import { DEFAULT_SETTINGS, type PitwallSettings } from './config/settings';

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
  private modelPanel: ModelPanel;
  private radioRenderer: RadioRenderer;
  private hudTime: HTMLElement;
  private hudSalary: HTMLElement;
  private hudPhase: HTMLElement;
  private hudPace: HTMLElement;
  private detail: HTMLElement;
  /** 데이터셋 선택기가 붙는 자리. 무엇을 보는지 화면이 늘 말해야 한다. */
  private hudSlot: HTMLElement;
  private live = false;
  /** 실시간 창을 다시 뽑는 재료. 이벤트가 올 때마다 늘어난다. */
  private liveSamples: ActivitySample[] = [];
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
    hud.append(this.hudTime, this.hudPace, this.hudPhase, this.hudSalary, datasetSlot);
    this.hudSlot = datasetSlot;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'track');

    // 타워가 먼저다. 트랙은 "어디쯤"을 말하고 타워가 "무엇이 일어나는가"를 말한다.
    const tower = document.createElement('div');
    tower.className = 'tower-slot';
    const models = document.createElement('div');
    models.className = 'models-slot';

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
    new SettingsPanel(hud, this.settings, (next) => this.applySettings(next),
      { simulated: opts.source === undefined });
    // 화면의 말이 대부분 이 안에서만 통한다. 접힌 채로 곁에 둔다.
    new Legend(hud);

    this.towerRenderer = new TowerRenderer(tower, TOWER_ROWS);
    this.modelPanel = new ModelPanel(models, MODEL_ROWS);
    // 모델 판은 타워 **아래**다. 타워 렌더러가 자기 노드를 붙인 뒤에 이어 붙여야
    // 순서가 맞는다 — 먼저 붙이면 모델 판이 위로 올라간다.
    tower.appendChild(models);
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

  /** 소스에 콜백을 건다. `start`와 `useSource`가 같은 배선을 쓴다. */
  private wireSource(): void {
    // 되감기면 누적을 비운다. 안 그러면 오늘 비용이 한 바퀴마다 한 벌씩 늘어난다.
    this.source.onWrap?.(() => {
      this.raceState = { ...emptyRaceState(this.raceState.now), phase: this.raceState.phase };
      this.recent.clear();
      this.modelCars = null;
      this.selected = null;
    });

    this.source.start((event) => {
      const before = this.raceState.cars.get(event.car_id);
      this.raceState = applyEvent(this.raceState, event);
      const log = this.recent.get(event.car_id)
        ?? this.recent.set(event.car_id, new RingBuffer<CarEvent>(FEED_HISTORY)).get(event.car_id)!;
      log.push(event);
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
    this.modelCars = null;
    this.selected = null;
    this.source = source;
    this.settings = { ...this.settings, ...over };
    // 재생인지 지금인지는 화면이 말해야 한다. DEMO 배지의 반대편이다.
    this.live = true;
    this.liveSamples = [];
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
    this.modelPanel.render(this.raceState);

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
    // 조직 속도도 최근 창이다. 타워 줄과 같은 기준이어야 둘이 안 어긋난다.
    const window_ = PACE_WINDOW_MS / Math.max(1, this.settings.speed);
    const allRecent: CarEvent[] = [];
    for (const buf of this.recent.values()) allRecent.push(...buf.toArray());
    setText(this.hudPace,
      formatPace(paceOf(this.raceState,
        { events: allRecent, now, windowMs: window_, speed: this.settings.speed })));
    setText(this.hudPhase,
      // 기록을 재생 중이면 시계는 지어낸 값이 아니라 재생 위치다 — DEMO를 붙이면
      // 그게 거짓말이 된다.
      `${phase.toUpperCase().replace('_', ' ')}`
      + (this.live ? ' · LIVE' : '')
      + (!this.live && !replayed && this.settings.demoClock ? ' · DEMO' : ''));

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
