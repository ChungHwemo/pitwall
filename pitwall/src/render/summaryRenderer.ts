import type { CarState, RaceState } from '../types';
import { summarise } from '../state/summary';
import { CLASS_STYLE, CONTRIBUTION_STEPS } from '../config/theme';
import { setText } from './setText';

const HOURS = 24;
const TOP_MODELS = 3;

interface ModelStripRow {
  root: HTMLElement;
  name: HTMLElement;
  stat: HTMLElement;
}

/**
 * tokscale의 GitHub식 기여도 그리드를 하루 한 축(시간대)으로 줄인 강도 매핑.
 * `idx = ≤0 → 0 · <0.25 → 1 · <0.5 → 2 · <0.75 → 3 · else 4` (원 레시피의 5단).
 */
function stepIndex(intensity: number): number {
  if (!(intensity > 0)) return 0;
  if (intensity < 0.25) return 1;
  if (intensity < 0.5) return 2;
  if (intensity < 0.75) return 3;
  return 4;
}

/**
 * 하루 요약 카드 (PRD S4). 체커기 이후에만 열린다.
 *
 * 조직 단위 숫자만 쓴다 — 개인 순위를 만들지 않는다 (PRIV-5).
 */
export class SummaryRenderer {
  private root: HTMLElement;
  private lede: HTMLElement;
  private rows: HTMLElement[] = [];
  private modelStrip: HTMLElement;
  private modelRows: ModelStripRow[] = [];
  private contribBody: HTMLElement;
  private cells = new Map<string, HTMLElement[]>();
  private rosterKey = '';

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'summary';
    this.root.setAttribute('data-open', 'false');

    const title = document.createElement('div');
    title.className = 'summary-title';
    title.textContent = 'CHEQUERED FLAG — 오늘의 결과';
    this.root.appendChild(title);

    this.lede = document.createElement('div');
    this.lede.className = 'summary-lede';
    this.root.appendChild(this.lede);

    const grid = document.createElement('div');
    grid.className = 'summary-grid';
    // 라벨 7개 + 값 7개. 노드 수를 고정하려고 생성 시점에 다 만든다.
    for (const label of ['작업 토큰', '캐시 재전송', '총 비용', '완주 / 리타이어', '클래스', '에러', '추론 토큰']) {
      const cell = document.createElement('div');
      cell.className = 'summary-cell';
      const k = document.createElement('div');
      k.className = 'summary-key';
      k.textContent = label;
      const v = document.createElement('div');
      v.className = 'summary-value';
      cell.append(k, v);
      grid.appendChild(cell);
      this.rows.push(v);
    }
    this.root.appendChild(grid);

    this.modelStrip = this.buildModels();
    this.contribBody = this.buildContrib();
    container.appendChild(this.root);
  }

  /**
   * 상위 모델 스트립 뼈대. tokscale Wrapped의 top models를 조직 축으로 줄인 것 —
   * 모델은 사람이 아니라 공유 자원이라 비용순 줄 세우기가 PRIV-2와 충돌하지 않는다
   * ('모델별 오늘' 패널이 같은 축을 이미 쓴다). 행 3개를 생성 시점에 고정하고
   * render()에서 값·표시만 갈아 노드 불변식을 지킨다.
   */
  private buildModels(): HTMLElement {
    const strip = document.createElement('div');
    strip.className = 'summary-models';
    strip.style.display = 'none';

    const head = document.createElement('div');
    head.className = 'summary-key';
    head.textContent = '상위 모델 — 비용순';
    strip.appendChild(head);

    for (let i = 0; i < TOP_MODELS; i++) {
      const row = document.createElement('div');
      row.className = 'summary-model-row';
      row.style.display = 'none';
      const name = document.createElement('div');
      name.className = 'summary-model-name';
      const stat = document.createElement('div');
      stat.className = 'summary-model-stat';
      row.append(name, stat);
      strip.appendChild(row);
      this.modelRows.push({ root: row, name, stat });
    }

    this.root.appendChild(strip);
    return strip;
  }

  /**
   * 기여도 그리드 뼈대. 시간대 헤더(0–23, 고정 24칸)는 생성 시점에 만든다.
   * 계정 행은 명단이 바뀔 때만 짓는다(`renderContrib`) — 로스터가 그대로면
   * 노드가 늘지 않아야 하는 카드 불변식을 지킨다.
   */
  private buildContrib(): HTMLElement {
    const contrib = document.createElement('div');
    contrib.className = 'summary-contrib';

    const ctitle = document.createElement('div');
    ctitle.className = 'summary-key';
    ctitle.textContent = '시간대별 토큰 강도 — 계정 × 시';
    contrib.appendChild(ctitle);

    const cgrid = document.createElement('div');
    cgrid.className = 'contrib-grid';

    const header = document.createElement('div');
    header.className = 'contrib-row contrib-hours';
    const corner = document.createElement('div');
    corner.className = 'contrib-acct contrib-corner';
    header.appendChild(corner);
    for (let h = 0; h < HOURS; h++) {
      const hc = document.createElement('div');
      hc.className = 'contrib-hour';
      hc.textContent = String(h);
      header.appendChild(hc);
    }
    cgrid.appendChild(header);

    const body = document.createElement('div');
    body.className = 'contrib-body';
    cgrid.appendChild(body);

    contrib.appendChild(cgrid);
    this.root.appendChild(contrib);
    return body;
  }

  render(state: RaceState): void {
    const open = state.phase === 'chequered';
    const flag = open ? 'true' : 'false';
    if (this.root.getAttribute('data-open') !== flag) this.root.setAttribute('data-open', flag);
    if (!open) return;

    const s = summarise(state);
    const classes = (['H', 'P', 'GT'] as const)
      .map((c) => `${CLASS_STYLE[c].label[0]}${s.byClass[c]}`).join(' · ');

    // Wrapped식 리드 한 줄. 하루를 곁눈질 한 번에 읽히게 조직 합계만 나열한다.
    setText(this.lede, `오늘 — ${s.totalTokens.toLocaleString('ko-KR')} tok · ${s.totalCalls.toLocaleString('ko-KR')}콜 · $${s.totalCostUsd.toFixed(2)} · 캐시 ${Math.round(s.cacheHitRate * 100)}%`);

    const share = s.totalTokens + s.totalCachedTokens;
    setText(this.rows[0]!, `${s.totalTokens.toLocaleString('ko-KR')} tok`);
    // 재전송이 전체의 몇 %인지 같이 쓴다 — 이 화면의 핵심 인사이트다.
    setText(this.rows[1]!, share === 0
      ? '0 tok'
      : `${s.totalCachedTokens.toLocaleString('ko-KR')} tok (${Math.round(s.totalCachedTokens / share * 100)}%)`);
    setText(this.rows[2]!, `$${s.totalCostUsd.toFixed(2)}`);
    setText(this.rows[3]!, `${s.finished} / ${s.retired}`);
    setText(this.rows[4]!, classes);
    setText(this.rows[5]!, String(s.errors));
    setText(this.rows[6]!, `${s.totalReasoningTokens.toLocaleString('ko-KR')} tok`);

    this.renderModels(state);
    this.renderContrib(state);
  }

  /**
   * 비용 내림차순 상위 3개 모델. 0개면 스트립 전체를 숨긴다 (연봉 미설정 칸 규칙).
   * 모델명·작업 토큰·비용만 — 계정·카넘버·car_id는 스트립에 절대 오르지 않는다.
   */
  private renderModels(state: RaceState): void {
    const top = [...state.byModel.entries()]
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, TOP_MODELS);

    const visible = top.length > 0 ? '' : 'none';
    if (this.modelStrip.style.display !== visible) this.modelStrip.style.display = visible;

    this.modelRows.forEach((row, i) => {
      const entry = top[i];
      if (!entry) {
        if (row.root.style.display !== 'none') row.root.style.display = 'none';
        return;
      }
      if (row.root.style.display !== '') row.root.style.display = '';
      const [model, tally] = entry;
      setText(row.name, model);
      setText(row.stat, `${tally.work.toLocaleString('ko-KR')} tok · $${tally.cost.toFixed(2)}`);
    });
  }

  /**
   * 계정 × 시간대 강도 그리드. 행은 계정(카넘버 오름차순 — 강도로 정렬하지
   * 않는다), 열은 시각 0–23. 강도는 그리드 전체 최대 셀 대비 비율이다.
   */
  private renderContrib(state: RaceState): void {
    const cars = [...state.cars.values()].sort((a, b) => a.car_number - b.car_number);
    const rosterKey = cars.map((c) => c.car_id).join(',');
    if (rosterKey !== this.rosterKey) {
      this.rebuildRows(cars);
      this.rosterKey = rosterKey;
    }

    let maxCell = 0;
    for (const c of cars) {
      const hourly = c.hourly;
      if (!hourly) continue;
      for (let h = 0; h < HOURS; h++) {
        const w = hourly[h] ?? 0;
        if (w > maxCell) maxCell = w;
      }
    }

    for (const c of cars) {
      const rowCells = this.cells.get(c.car_id);
      if (!rowCells) continue;
      const hourly = c.hourly;
      for (let h = 0; h < HOURS; h++) {
        const w = hourly?.[h] ?? 0;
        const ratio = maxCell > 0 ? w / maxCell : 0;
        const idx = stepIndex(Number.isFinite(ratio) ? ratio : 0);
        const cell = rowCells[h]!;
        if (cell.dataset.step !== String(idx)) {
          cell.dataset.step = String(idx);
          cell.style.background = CONTRIBUTION_STEPS[idx]!;
        }
      }
    }
  }

  private rebuildRows(cars: CarState[]): void {
    this.contribBody.textContent = '';
    this.cells.clear();
    for (const c of cars) {
      const row = document.createElement('div');
      row.className = 'contrib-row';
      const acct = document.createElement('div');
      acct.className = 'contrib-acct';
      setText(acct, String(c.car_number));
      row.appendChild(acct);
      const rowCells: HTMLElement[] = [];
      for (let h = 0; h < HOURS; h++) {
        const cell = document.createElement('div');
        cell.className = 'contrib-cell';
        row.appendChild(cell);
        rowCells.push(cell);
      }
      this.contribBody.appendChild(row);
      this.cells.set(c.car_id, rowCells);
    }
  }
}
