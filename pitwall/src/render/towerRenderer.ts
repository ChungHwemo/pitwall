import type { CarEvent, CarState, RaceState } from '../types';
import { CLASS_STYLE } from '../config/theme';
import { IDLE_THRESHOLD_MS } from '../state/reducer';
import { setText } from './setText';
import { sparkline } from './spark';
import { recentPace } from '../state/pace';

/**
 * 타이밍 타워 — 계정 한 대에 한 줄.
 *
 * 참고한 f1-telemetry의 라이브 화면에서 척추는 `TimingTower`이고 트랙맵은
 * 오른쪽 탭 하나다. PITWALL은 그 반대로 만들어져 있었다 — 트랙이 화면의 70%를
 * 먹고, 무슨 일이 벌어지는지는 카드 세 장에 흩어져 있었다. 곁눈질로 읽히는 것은
 * 지도가 아니라 **줄 세운 표**다.
 *
 * **순위를 매기지 않는다.** F1 타워의 첫 칸은 순위지만 여기서는 카넘버다.
 * 사람을 사용량으로 줄 세우는 화면은 만들지 않는다 (PRD PRIV-2). 정렬 키를
 * 카넘버로 고정해서, 많이 쓰든 적게 쓰든 자기 줄이 늘 같은 자리에 있다.
 *
 * 한 줄에 들어가는 것:
 *   [등급색 막대] 카넘버 · 모델 · 한도 게이지 + 창 + 리셋 · 소진속도 · 상태
 */

export interface TowerRow {
  root: HTMLElement;
  bar: HTMLElement;
  number: HTMLElement;
  model: HTMLElement;
  limitTrack: HTMLElement;
  limitText: HTMLElement;
  spark: HTMLElement;
  cost: HTMLElement;
  rate: HTMLElement;
  state: HTMLElement;
  carId: string;
}

/** 이 아래로 내려간 차는 피트행이다. 트랙 모델의 `limitWarnPct`와 같은 선. */
const LIMIT_BOX_PCT = 15;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function windowLabel(minutes: number | undefined): string {
  if (minutes === undefined) return '';
  if (minutes % 1440 === 0) return `${minutes / 1440}일`;
  return `${Math.round(minutes / 60)}시간`;
}

/** 남은 시간을 가장 큰 두 자리까지. 카드와 같은 규칙을 쓴다. */
function untilLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}

type RowState = 'error' | 'limit' | 'idle' | 'run';

/**
 * 무엇이 이 차를 세웠는가.
 *
 * 에러와 한도는 다른 사건이라 색도 배지도 다르다. 조용한 것은 또 다른 상태다 —
 * 멈춘 게 아니라 그냥 안 쓰고 있는 것이고, 둘을 같은 배지로 쓰면 화면이
 * 문제 없는 계정을 문제로 만든다.
 */
function stateOf(car: CarState, now: number, speed: number): RowState {
  // 에러에는 시효가 있다. `error_count`는 하루 누적이라 아침의 실패 한 번으로
  // 종일 피트에 갇혔다 — 지금 문제가 있는지는 마지막 실패가 언제였는지가 답한다.
  const failedRecently = car.last_error_ts !== undefined
    && now - car.last_error_ts < ERROR_FRESH_MS / Math.max(1, speed);
  if (failedRecently) return 'error';
  if (car.tyre_pct !== undefined && car.tyre_pct < LIMIT_BOX_PCT) return 'limit';
  // 유휴 기준도 레이스 시간이다. 실시간 90초로 재면 600배속에서는 레이스로
  // 15시간을 쉰 계정도 "방금까지 돌던 중"으로 보인다.
  if (now - car.last_event_ts > IDLE_THRESHOLD_MS / Math.max(1, speed)) return 'idle';
  return 'run';
}

const STATE_LABEL: Record<RowState, string> = {
  error: 'PIT · ERR',
  limit: 'PIT · LIM',
  idle: 'IDLE',
  run: 'RUN',
};

/** 에러가 이보다 오래되면 더는 그 차를 세워두지 않는다 (레이스 시간). */
const ERROR_FRESH_MS = 300_000;

/** 이보다 많으면 줄을 한 단으로 접는다. 2단 줄로는 화면에 다 안 들어간다. */
const DENSE_FROM = 10;

/**
 * 스파크라인이 되돌아보는 **레이스 시간**과 칸 수.
 *
 * 이벤트 ts는 내부 시계라 배속을 탄다. 실시간 30분으로 자르면 600배속에서는
 * 레이스 300시간이 한 칸에 뭉쳐 막대가 하나만 남는다. 창을 배속으로 나눈다.
 */
const SPARK_WINDOW_MS = 1_800_000;
const SPARK_BUCKETS = 18;

export class TowerRenderer {
  private root: HTMLElement;
  private rows: TowerRow[] = [];
  private overflow: HTMLElement;
  private total: HTMLElement;
  private selectHandler: ((carId: string) => void) | null = null;

  constructor(container: HTMLElement, maxRows: number) {
    const root = document.createElement('div');
    root.className = 'tower';
    this.root = root;

    // 줄을 미리 만들어 둔다. 계정이 오갈 때마다 DOM을 짓고 부수면 노드가 요동친다.
    for (let i = 0; i < maxRows; i++) {
      const row = document.createElement('div');
      row.className = 'tower-row';
      row.style.display = 'none';
      /*
       * 줄은 누를 수 있는 물건이다. div에 클릭만 달면 마우스 없이는 이 화면의
       * 유일한 조작(계정 고르기)에 아예 도달하지 못한다 — 트랙의 글리프도 클릭
       * 전용이라 대체 경로가 없었다. 역할과 탭 순서를 주고 Enter·Space를 받는다.
       * 안 쓰는 줄은 `display: none`이라 탭 순서에서 저절로 빠진다.
       */
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      const pick = (): void => {
        const id = this.rows[i]?.carId;
        if (id) this.selectHandler?.(id);
      };
      row.addEventListener('click', pick);
      row.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Space는 기본이 스크롤이다. 상시 노출 화면에서 화면이 튀면 그 자체가 고장이다.
        e.preventDefault();
        pick();
      });

      const bar = document.createElement('div');
      bar.className = 'tower-bar';
      const number = document.createElement('div');
      number.className = 'tower-number';
      const model = document.createElement('div');
      model.className = 'tower-model';

      const limit = document.createElement('div');
      limit.className = 'tower-limit';
      const limitTrack = document.createElement('div');
      limitTrack.className = 'tower-limit-track';
      const limitText = document.createElement('div');
      limitText.className = 'tower-limit-text';
      limit.append(limitTrack, limitText);

      // 쓴 돈과 지금 속도는 다른 질문이다. 총액은 "얼마 나갔나",
      // 시간당은 "지금 얼마로 나가고 있나".
      const money = document.createElement('div');
      money.className = 'tower-money';
      const cost = document.createElement('div');
      cost.className = 'tower-cost';
      const rate = document.createElement('div');
      rate.className = 'tower-rate';
      money.append(cost, rate);
      const state = document.createElement('div');
      state.className = 'tower-state';
      // 최근 소진을 모양으로. 숫자보다 먼저 읽힌다.
      const spark = document.createElement('div');
      spark.className = 'tower-spark';

      row.append(bar, number, model, spark, limit, money, state);
      root.appendChild(row);
      this.rows.push({
        root: row, bar, number, model, spark, limitTrack, limitText, cost, rate, state,
        carId: '',
      });
    }

    // 접힌 계정은 조용히 사라지면 안 된다. 몇 대이고 얼마인지 남긴다.
    this.overflow = document.createElement('div');
    this.overflow.className = 'tower-overflow';
    this.overflow.style.display = 'none';
    root.appendChild(this.overflow);

    // 조직 합계. 계정이 두어 대뿐이면 타워 아래가 통째로 비는데, 그 자리에
    // "오늘 전체가 어떻게 굴러갔나"를 두면 빈칸이 정보가 된다.
    this.total = document.createElement('div');
    this.total.className = 'tower-total';
    root.appendChild(this.total);

    container.appendChild(root);
  }

  onSelect(handler: (carId: string) => void): void {
    this.selectHandler = handler;
  }

  /**
   * @param now      내부 시계 (이벤트 ts와 같은 축). 유휴·스파크라인이 쓴다
   * @param realNow  실제 epoch. 한도 리셋 카운트다운이 쓴다
   */
  render(
    state: RaceState, now: number, realNow: number, selected: string | null,
    historyOf: (carId: string) => CarEvent[],
    priority: string[] = [],
    speed = 1,
  ): void {
    // 카넘버 오름차순 고정. 사용량으로 재정렬하면 그 순간 리더보드가 된다.
    const all = [...state.cars.values()].sort((a, b) => a.car_number - b.car_number);

    // 줄이 모자라면 **누구를 남길지**는 급한 순으로 고르되, 남은 것을 보여주는
    // 순서는 카넘버 그대로다. 급한 차를 맨 위로 올리면 그 순간 순위표가 된다.
    let cars = all;
    if (all.length > this.rows.length) {
      const urgent = new Set(priority.slice(0, this.rows.length));
      const kept = all.filter((c) => urgent.has(c.car_id));
      for (const c of all) {
        if (kept.length >= this.rows.length) break;
        if (!urgent.has(c.car_id)) kept.push(c);
      }
      cars = kept.sort((a, b) => a.car_number - b.car_number);
    }
    const foldedOut = all.filter((c) => !cars.includes(c));

    this.rows.forEach((row, i) => {
      const car = cars[i];
      if (!car) {
        if (row.root.style.display !== 'none') row.root.style.display = 'none';
        row.carId = '';
        return;
      }
      if (row.root.style.display !== '') row.root.style.display = '';
      row.carId = car.car_id;

      const style = CLASS_STYLE[car.car_class];
      if (row.bar.style.backgroundColor !== style.color) row.bar.style.backgroundColor = style.color;
      setText(row.number, String(car.car_number));
      setText(row.model, car.model);

      // 한도는 막대가 먼저 읽히고 숫자가 뒤를 받친다. 소스가 없으면 둘 다 없다.
      if (car.tyre_pct === undefined) {
        if (row.limitTrack.firstChild) row.limitTrack.replaceChildren();
        setText(row.limitText, '한도 미제공');
      } else {
        let fill = row.limitTrack.firstElementChild as HTMLElement | null;
        if (!fill) {
          fill = document.createElement('div');
          fill.className = 'tower-limit-fill';
          row.limitTrack.appendChild(fill);
        }
        const pct = `${Math.round(car.tyre_pct)}%`;
        if (fill.style.width !== pct) fill.style.width = pct;
        const left = car.limit_resets_at === undefined ? 0 : car.limit_resets_at - realNow;
        // "62% 5시간 · 2시간"은 두 기간이 나란히 놓여 어느 쪽이 창이고 어느 쪽이
        // 리셋인지 안 읽힌다. 각자 이름을 붙인다.
        const win = windowLabel(car.limit_window_minutes);
        setText(row.limitText, left > 0
          ? `${pct} · ${win}창 · 리셋 ${untilLabel(left)}`
          : `${pct} · ${win}창`);
      }

      // 속도가 이 화면의 "랩타임"이다. 누적만으로는 지금 빠른지 알 수 없다.
      setText(row.cost, `$${car.cost_usd.toFixed(2)}`);
      const history = historyOf(car.car_id);
      const window_ = SPARK_WINDOW_MS / Math.max(1, speed);
      setText(row.spark, sparkline(history, now, window_, SPARK_BUCKETS));

      // 속도는 **최근 창**이다. 레이스 평균을 쓰면 20분 쉰 계정에도 숫자가 남아
      // 같은 줄의 IDLE과 어긋난다. 단위는 HUD와 맞춘다.
      const pace = recentPace(history, now, window_, speed);
      setText(row.rate, pace.workPerMinute > 0 || pace.costPerHour > 0
        ? `$${pace.costPerHour.toFixed(1)}/시간 · ${compact(pace.workPerMinute)} tok/분`
        : '유휴');

      const what = stateOf(car, now, speed);
      if (row.root.getAttribute('data-state') !== what) row.root.setAttribute('data-state', what);
      setText(row.state, STATE_LABEL[what]);

      const picked = car.car_id === selected ? 'true' : 'false';
      if (row.root.getAttribute('data-selected') !== picked) {
        row.root.setAttribute('data-selected', picked);
        // 고른 상태는 색으로만 말하고 있었다. 눌린 버튼이라고 읽히게 한다.
        row.root.setAttribute('aria-pressed', picked);
      }
    });

    // 계정이 많으면 줄을 한 단으로 접는다. 그래야 잘리지 않고 다 들어간다.
    const dense = cars.length > DENSE_FROM ? 'true' : 'false';
    if (this.root.getAttribute('data-dense') !== dense) {
      this.root.setAttribute('data-dense', dense);
    }

    const hidden = foldedOut;
    if (hidden.length === 0) {
      if (this.overflow.style.display !== 'none') this.overflow.style.display = 'none';
    } else {
      if (this.overflow.style.display !== '') this.overflow.style.display = '';
      const sum = hidden.reduce((a, c) => a + c.cost_usd, 0);
      setText(this.overflow, `접힘 ${hidden.length}대 · 합계 $${sum.toFixed(2)}`);
    }

    let calls = 0; let work = 0; let cached = 0; let cost = 0; let saved = 0;
    for (const c of all) {
      calls += c.call_count; work += c.distance; cached += c.cached; cost += c.cost_usd;
      saved += c.saved_usd;
    }
    const share = work + cached;
    setText(this.total, [
      `계정 ${all.length}`,
      `${calls.toLocaleString('ko-KR')}콜`,
      // 캐시 비중은 이 화면의 핵심 사실이다 — 실측 98%였고, 섞어 쓰면 작업량이
      // 수십 배로 부풀어 보인다.
      // 비율은 크다는 사실만 말한다. 그게 좋은 일인지는 아낀 돈이 말한다.
      share > 0 ? `캐시 ${Math.round(cached / share * 100)}%` : '캐시 —',
      `$${cost.toFixed(2)}`,
      ...(saved > 0 ? [`$${saved.toFixed(2)} 아낌`] : []),
    ].join('  ·  '));
  }
}
