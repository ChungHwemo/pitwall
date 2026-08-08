/**
 * 범례.
 *
 * 이 화면의 말은 대부분 화면 안에서만 통한다 — 한 바퀴가 몇 토큰인지, `PIT · LIM`이
 * 에러와 무엇이 다른지, 색이 등급인지 상태인지. 툴팁은 마우스를 올려야 보이고
 * 상시 노출 화면에서는 마우스가 없는 시간이 대부분이다.
 *
 * 기본은 접힘이다. 늘 떠 있으면 그 자체가 화면을 가린다.
 */
const ROWS: [string, string, string?][] = [
  ['FRESH', '30초까지 최근 수신', 'fresh'],
  ['QUIET', '30초 초과, 5분까지 조용함', 'quiet'],
  ['STALE', '5분 넘게 새 데이터가 없음', 'stale'],
  ['CONNECTED', '실시간 소스가 최근 데이터를 처리함', 'connected'],
  ['SYNCING', '실시간 소스가 실제 대기열을 처리 중', 'syncing'],
  ['RUN', '최근에 호출이 있었다'],
  ['IDLE', '5분 넘게 조용하다. 트랙에는 흐리게 남는다'],
  ['PIT · LIM', '한도 창이 바닥나 더 못 간다'],
  ['PIT · ERR', '방금 호출이 실패했다'],
  ['한 바퀴', '작업 토큰 5만. 캐시 재전송은 거리에 안 든다'],
  ['한도', '벤더가 거는 벽 (5시간·7일). 연료가 아니라 별개 축이다'],
  ['막대 색', '모델 등급 — 빨강 상위 · 파랑 주력 · 노랑 경량'],
  ['밝기', '지금 태우는 속도. 위치는 누적이라 속도를 못 말한다'],
];

export class Legend {
  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'legend';
    root.setAttribute('data-open', 'false');

    const toggle = document.createElement('button');
    toggle.className = 'legend-toggle';
    toggle.type = 'button';
    toggle.textContent = '범례';
    toggle.title = '화면의 표시가 무엇을 뜻하는지';
    toggle.addEventListener('click', () => {
      const open = root.getAttribute('data-open') === 'true';
      root.setAttribute('data-open', open ? 'false' : 'true');
    });

    const body = document.createElement('dl');
    body.className = 'legend-body';
    for (const [term, meaning, sample] of ROWS) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      if (sample) dt.setAttribute('data-sample', sample);
      const dd = document.createElement('dd');
      dd.textContent = meaning;
      body.append(dt, dd);
    }

    root.append(toggle, body);
    container.appendChild(root);
  }
}
