import type { RaceState } from '../types';
import { summarise } from '../state/summary';
import { CLASS_STYLE } from '../config/theme';
import { setText } from './setText';

/**
 * 하루 요약 카드 (PRD S4). 체커기 이후에만 열린다.
 *
 * 조직 단위 숫자만 쓴다 — 개인 순위를 만들지 않는다 (PRIV-5).
 */
export class SummaryRenderer {
  private root: HTMLElement;
  private rows: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'summary';
    this.root.setAttribute('data-open', 'false');

    const title = document.createElement('div');
    title.className = 'summary-title';
    title.textContent = 'CHEQUERED FLAG — 오늘의 결과';
    this.root.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'summary-grid';
    // 라벨 6개 + 값 6개. 노드 수를 고정하려고 생성 시점에 다 만든다.
    for (const label of ['작업 토큰', '캐시 재전송', '총 비용', '완주 / 리타이어', '클래스', '에러']) {
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
    container.appendChild(this.root);
  }

  render(state: RaceState): void {
    const open = state.phase === 'chequered';
    const flag = open ? 'true' : 'false';
    if (this.root.getAttribute('data-open') !== flag) this.root.setAttribute('data-open', flag);
    if (!open) return;

    const s = summarise(state);
    const classes = (['H', 'P', 'GT'] as const)
      .map((c) => `${CLASS_STYLE[c].label[0]}${s.byClass[c]}`).join(' · ');

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
  }
}
