/**
 * 화면을 눈으로 확인하는 유일한 경로.
 *
 * jsdom은 레이아웃을 계산하지 않는다. 그래서 테스트 579개를 전부 통과한 채로
 * 이런 것들이 살아 있었다 — 계정이 10대를 넘으면 세 자리 카넘버의 마지막 자리가
 * 잘려 `233`이 `23`으로 읽혔고, 조작판의 `한도` 체크박스가 반쯤 잘려 켜졌는지
 * 알 수 없었다. 둘 다 `expect`로는 잡히지 않고 픽셀로만 보인다.
 *
 * 새 의존성을 넣지 않는다. 이미 설치된 Chrome을 헤드리스로 부른다 —
 * Playwright는 브라우저 한 벌을 더 받아오고, 이 스크립트가 하는 일은
 * "열고 찍기"가 전부다.
 *
 * 주의: 헤드리스 창 높이는 `--window-size`보다 작다 (1440×900 → 뷰포트 1440×813).
 * root 글자 크기가 `min(100vw/90, 100vh/56.25)`이므로 세로가 이긴다. 실제 앱 창과
 * 정확히 같은 배율은 아니지만 **비율은 rem으로 고정**이라 잘림 여부는 같이 나온다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = process.env.PITWALL_CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** 두 극단만 찍는다. 계정 1개(빈 화면)와 접히는 규모(dense) 사이에 새 고장은 없었다. */
const SHOTS = [
  { dataset: 'real', name: 'real' },
  { dataset: 'demo-large', name: 'dense' },
];

const WIDTH = Number(process.env.PITWALL_SHOT_W ?? 1440);
const HEIGHT = Number(process.env.PITWALL_SHOT_H ?? 900);
/** 재생이 충분히 굴러가야 계정이 여럿 뜬다. 4초면 배속 60에서 레이스 수십 분이다. */
const BUDGET_MS = Number(process.env.PITWALL_SHOT_MS ?? 12_000);

const root = resolve(import.meta.dirname, '..');
const bundle = resolve(root, 'dist/pitwall.html');
if (!existsSync(bundle)) {
  throw new Error(`${bundle}이 없다. 먼저 \`npm run build:real\`을 돌린다.`);
}
if (!existsSync(CHROME)) {
  throw new Error(`Chrome을 찾지 못했다: ${CHROME}. \`PITWALL_CHROME\`으로 경로를 준다.`);
}

const outDir = resolve(root, '../docs/screenshots');
mkdirSync(outDir, { recursive: true });
// 파일명에 날짜를 박아 두면 언제 찍은 화면인지 파일만 봐도 안다.
const day = new Date().toISOString().slice(0, 10);

const html = readFileSync(bundle, 'utf8');
const work = resolve(tmpdir(), `pitwall-shot-${process.pid}`);
mkdirSync(work, { recursive: true });

try {
  for (const shot of SHOTS) {
    /*
     * 데이터셋은 `localStorage`로만 고를 수 있다 (`browser.ts`). 번들을 고치지 않고
     * 사본 앞에 한 줄을 끼워 넣는다 — 찍는 것이 실제 배포 산출물이어야 한다.
     */
    const pick = `<body><script>localStorage.setItem("pitwall.dataset","${shot.dataset}")</script>`;
    const page = resolve(work, `${shot.name}.html`);
    const patched = html.replace('<body>', pick);
    if (patched === html) throw new Error('번들에서 <body>를 찾지 못했다 — 삽입 지점이 바뀌었다');
    writeFileSync(page, patched);

    const out = resolve(outDir, `${day}-${shot.name}.png`);
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${out}`,
      `--virtual-time-budget=${BUDGET_MS}`,
      `file://${page}`,
    ], { stdio: 'ignore' });

    if (!existsSync(out)) throw new Error(`${shot.name}: 스크린샷이 안 나왔다`);
    console.log(`${out}  ${WIDTH}×${HEIGHT}  ${shot.dataset}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('\n눈으로 확인할 것: 세 자리 카넘버가 안 잘리는가 · 조작판이 위젯 중간에서 안 잘리는가');
