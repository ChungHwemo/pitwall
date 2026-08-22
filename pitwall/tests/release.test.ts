import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chooseEmbeddedSources,
  inspectPublicHtml,
  stagePagesSite,
  leakCanariesFrom,
} from '../scripts/release';

const DEMO_HTML = `<!doctype html><html><head></head><body>
<script type="module">
const datasets = [{"id":"demo-small","label":"데모 · 소규모","synthetic":true,"events":[]},{"id":"demo","label":"데모 · 중규모","synthetic":true,"events":[]},{"id":"demo-large","label":"데모 · 대규모","synthetic":true,"events":[]}];
</script>
</body></html>`;

describe('chooseEmbeddedSources', () => {
  it('기본 빌드는 데모 세 벌만 고른다 — 실기록을 심으면 공개 페이지가 실사용을 말한다', () => {
    expect(chooseEmbeddedSources(false).map((s) => s.id)).toEqual([
      'demo-small', 'demo', 'demo-large',
    ]);
  });

  it('PITWALL_REAL=1 일 때만 실기록 두 벌을 앞에 둔다', () => {
    expect(chooseEmbeddedSources(true).map((s) => s.id)).toEqual([
      'real', 'real-busy', 'demo-small', 'demo', 'demo-large',
    ]);
  });
});

describe('inspectPublicHtml', () => {
  it('데모 세 벌이 있고 자산이 인라인이면 빈 배열이다', () => {
    expect(inspectPublicHtml(DEMO_HTML)).toEqual([]);
  });

  it('실기록 데이터셋 라벨이 있으면 실패한다', () => {
    const html = DEMO_HTML.replace(
      '{"id":"demo-small"',
      '{"id":"real","label":"실기록","synthetic":false,"events":[]},{"id":"demo-small"',
    );
    const codes = inspectPublicHtml(html).map((f) => f.code);
    expect(codes).toContain('real-dataset');
  });

  it('시뮬레이터 프리셋 id real(실측)만으로는 실패하지 않는다', () => {
    const html = DEMO_HTML.replace(
      '</script>',
      'const presets=[{id:`real`,label:`실측`}];</script>',
    );
    expect(inspectPublicHtml(html)).toEqual([]);
  });

  it('minifier가 백틱 id:`demo-small` 도 데모로 인정한다', () => {
    const html = '<!doctype html><script>[{id:`demo-small`},{id:`demo`},{id:`demo-large`}]</script>';
    expect(inspectPublicHtml(html)).toEqual([]);
  });

  it('minifier가 백틱 id:`real-busy` 도 실기록으로 잡는다', () => {
    const html = '<!doctype html><script>[{id:`real-busy`},{id:`demo-small`},{id:`demo`},{id:`demo-large`}]</script>';
    expect(inspectPublicHtml(html).map((f) => f.code)).toContain('real-dataset');
  });

  it('인라인되지 않은 /assets/ 경로가 있으면 실패한다', () => {
    const html = DEMO_HTML.replace('</head>', '<script src="/assets/index.js"></script></head>');
    expect(inspectPublicHtml(html).map((f) => f.code)).toContain('uninlined-assets');
  });

  it('데모 세 벌 중 하나라도 없으면 실패한다', () => {
    const html = DEMO_HTML.replace(',{"id":"demo-large","label":"데모 · 대규모","synthetic":true,"events":[]}', '');
    expect(inspectPublicHtml(html).map((f) => f.code)).toContain('missing-demo');
  });

  it('실기록 canary 문자열이 있으면 실패한다 — 데이터셋 라벨을 지워도 이벤트가 남을 수 있다', () => {
    const html = DEMO_HTML.replace('events":[]', 'events":[{"car_id":"car-83621669"}]');
    const codes = inspectPublicHtml(html, { leakCanaries: ['car-83621669'] }).map((f) => f.code);
    expect(codes).toContain('real-canary');
  });

  it('도움말의 한글 실기록 문구만으로는 실패하지 않는다', () => {
    const html = DEMO_HTML.replace(
      '</script>',
      'const help = "실기록 — 이 기기의 로그로 하루를 재생한다.";</script>',
    );
    expect(inspectPublicHtml(html)).toEqual([]);
  });
});

describe('leakCanariesFrom', () => {
  it('실기록 줄에서 car_id와 session_id를 뽑는다', () => {
    const text = [
      '{"car_id":"car-83621669","session_id":"decd062f-b979-465e-abb5-a831c418b082"}',
      '{"car_id":"car-83621669","session_id":"decd062f-b979-465e-abb5-a831c418b082"}',
    ].join('\n');
    expect(leakCanariesFrom(text).sort()).toEqual([
      'car-83621669',
      'decd062f-b979-465e-abb5-a831c418b082',
    ]);
  });
});

describe('stagePagesSite', () => {
  let dir = '';
  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('index.html · pitwall.settings.json · .nojekyll 만 쓴다', () => {
    dir = mkdtempSync(join(tmpdir(), 'pitwall-pages-'));
    stagePagesSite({ html: DEMO_HTML, settingsJson: '{}', outDir: dir });
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe(DEMO_HTML);
    expect(readFileSync(join(dir, 'pitwall.settings.json'), 'utf8')).toBe('{}');
    expect(readFileSync(join(dir, '.nojekyll'), 'utf8')).toBe('');
  });

  it('검사에 걸리는 HTML은 쓰지 않는다', () => {
    dir = mkdtempSync(join(tmpdir(), 'pitwall-pages-'));
    expect(() => stagePagesSite({
      html: DEMO_HTML.replace('데모 · 소규모', '실기록'),
      settingsJson: '{}',
      outDir: dir,
    })).toThrow(/real-dataset/);
    expect(existsSync(join(dir, 'index.html'))).toBe(false);
  });
});
