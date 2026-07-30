import type { RaceState } from '../types';
import { setText } from './setText';

/**
 * 모델별 오늘 내역.
 *
 * 이 화면의 원래 질문은 "어떤 모델을 어떤 에이전트가 어떻게 돌리는가"였다.
 * 타워는 **계정**을 말하고 이 판은 **모델**을 말한다 — 계정 하나가 하루에 모델을
 * 세 번 갈아타면 타워 줄에는 마지막 것만 남는다.
 *
 * 계정이 두어 대뿐일 때 타워 아래가 통째로 비는데, 그 자리에 놓는다.
 *
 * **모델은 사람이 아니므로 비싼 순으로 줄 세운다.** PRIV-2가 막는 것은 사람을
 * 사용량으로 늘어놓는 화면이다.
 */

interface Row {
  root: HTMLElement;
  name: HTMLElement;
  fill: HTMLElement;
  stat: HTMLElement;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export class ModelPanel {
  private rows: Row[] = [];
  private rest: HTMLElement;

  constructor(container: HTMLElement, maxRows: number) {
    const root = document.createElement('div');
    root.className = 'models';

    const head = document.createElement('div');
    head.className = 'models-head';
    head.textContent = '모델별 오늘';
    root.appendChild(head);

    for (let i = 0; i < maxRows; i++) {
      const row = document.createElement('div');
      row.className = 'model-row';
      row.style.display = 'none';

      const name = document.createElement('div');
      name.className = 'model-name';
      const track = document.createElement('div');
      track.className = 'model-track';
      const fill = document.createElement('div');
      fill.className = 'model-fill';
      track.appendChild(fill);
      const stat = document.createElement('div');
      stat.className = 'model-stat';

      row.append(name, track, stat);
      root.appendChild(row);
      this.rows.push({ root: row, name, fill, stat });
    }

    // 접힌 모델도 밝힌다. 조용히 줄이지 않는다.
    this.rest = document.createElement('div');
    this.rest.className = 'model-rest';
    this.rest.style.display = 'none';
    root.appendChild(this.rest);

    container.appendChild(root);
  }

  render(state: RaceState): void {
    const all = [...state.byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
    // 막대는 1위 대비 몫이다. 절대값 축은 모델마다 자릿수가 달라 읽히지 않는다.
    const top = all[0]?.[1].cost ?? 0;

    this.rows.forEach((row, i) => {
      const entry = all[i];
      if (!entry) {
        if (row.root.style.display !== 'none') row.root.style.display = 'none';
        return;
      }
      if (row.root.style.display !== '') row.root.style.display = '';

      const [model, tally] = entry;
      setText(row.name, model);
      const width = top > 0 ? `${Number((tally.cost / top * 100).toFixed(2))}%` : '0%';
      if (row.fill.style.width !== width) row.fill.style.width = width;
      setText(row.stat,
        `${tally.calls.toLocaleString('ko-KR')}콜 · ${compact(tally.work)} · $${tally.cost.toFixed(2)}`);
    });

    const hidden = all.slice(this.rows.length);
    if (hidden.length === 0) {
      if (this.rest.style.display !== 'none') this.rest.style.display = 'none';
    } else {
      if (this.rest.style.display !== '') this.rest.style.display = '';
      const sum = hidden.reduce((a, [, t]) => a + t.cost, 0);
      setText(this.rest, `그 외 ${hidden.length}종 · $${sum.toFixed(2)}`);
    }
  }
}
