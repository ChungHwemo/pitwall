/**
 * 공개 배포 산출물 계약.
 *
 * GitHub Pages는 인터넷에 공개된다. 기본 빌드가 데모만 심는 불변식을
 * 빌드 설정과 검사가 같은 목록으로 밟지 않으면, 검사는 통과하고 화면은
 * 실기록을 말하는 조합이 산다 — pickWindow를 설정에서 뺀 것과 같은 이유.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export {
  EMBEDDED_SOURCES,
  chooseEmbeddedSources,
  type EmbeddedSource,
} from './embeddedSources';

export interface ReleaseFailure {
  code: string;
  detail: string;
}

function hasDatasetId(html: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Vite define 후 terser가 "id":"demo" · id:"demo" · id:`demo` 셋을 만든다.
  return new RegExp(`(?:["']id["']\\s*:|\\bid:)\\s*["'\`]${escaped}["'\`]`).test(html);
}

export function inspectPublicHtml(
  html: string,
  opts: { leakCanaries?: readonly string[] } = {},
): ReleaseFailure[] {
  const failures: ReleaseFailure[] = [];
  if (html.includes('/assets/')) {
    failures.push({ code: 'uninlined-assets', detail: '인라인되지 않은 /assets/ 경로가 남았다' });
  }
  // 프리셋 내부 id `real`(화면 라벨 `실측`)과 데이터셋 `실기록`을 구분한다.
  // 데이터셋만 막는다. real-busy id 는 프리셋에 없다.
  if (hasDatasetId(html, 'real-busy') || /(?:["']label["']\s*:|\blabel:)\s*["'`]실기록/.test(html)) {
    failures.push({ code: 'real-dataset', detail: '공개 산출물에 실기록 데이터셋이 있다' });
  }
  const missing = ['demo-small', 'demo', 'demo-large'].filter((id) => !hasDatasetId(html, id));
  if (missing.length > 0) {
    failures.push({ code: 'missing-demo', detail: `데모 데이터셋 없음: ${missing.join(', ')}` });
  }
  for (const canary of opts.leakCanaries ?? []) {
    if (canary !== '' && html.includes(canary)) {
      failures.push({ code: 'real-canary', detail: `실기록 식별자가 남아 있다: ${canary}` });
      break;
    }
  }
  return failures;
}

export function leakCanariesFrom(text: string): string[] {
  const ids = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row: unknown;
    try { row = JSON.parse(line); } catch { continue; }
    if (typeof row !== 'object' || row === null) continue;
    const rec = row as Record<string, unknown>;
    if (typeof rec.car_id === 'string') ids.add(rec.car_id);
    if (typeof rec.session_id === 'string') ids.add(rec.session_id);
  }
  return [...ids];
}

export function assertPublicRelease(html: string, leakCanaries: readonly string[] = []): void {
  const failures = inspectPublicHtml(html, { leakCanaries });
  if (failures.length === 0) return;
  throw new Error(failures.map((f) => `${f.code}: ${f.detail}`).join('\n'));
}

export function stagePagesSite(opts: {
  html: string;
  settingsJson: string;
  outDir: string;
  leakCanaries?: readonly string[];
}): void {
  assertPublicRelease(opts.html, opts.leakCanaries);
  mkdirSync(opts.outDir, { recursive: true });
  writeFileSync(join(opts.outDir, 'index.html'), opts.html);
  writeFileSync(join(opts.outDir, 'pitwall.settings.json'), opts.settingsJson);
  writeFileSync(join(opts.outDir, '.nojekyll'), '');
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function canariesFromFixtures(): string[] {
  const out: string[] = [];
  for (const file of ['fixtures/events.real.jsonl', 'fixtures/events.real-busy.jsonl']) {
    try {
      out.push(...leakCanariesFrom(readFileSync(join(root, file), 'utf8')));
    } catch {
      // 실기록 파일이 없는 체크아웃도 데모 배포는 할 수 있다.
    }
  }
  return out;
}

function main(argv: string[]): void {
  const [cmd, htmlPath, outDir] = argv;
  if (cmd !== 'check' && cmd !== 'stage') {
    throw new Error('usage: release.ts check <html> | stage <html> <outDir>');
  }
  if (htmlPath === undefined) throw new Error('html 경로가 없다');
  const html = readFileSync(resolve(htmlPath), 'utf8');
  const leaks = canariesFromFixtures();
  if (cmd === 'check') {
    assertPublicRelease(html, leaks);
    console.log('release:check ok');
    return;
  }
  if (outDir === undefined) throw new Error('stage 에 outDir 이 없다');
  const settings = readFileSync(join(root, 'public/pitwall.settings.json'), 'utf8');
  stagePagesSite({
    html,
    settingsJson: settings,
    outDir: resolve(outDir),
    leakCanaries: leaks,
  });
  console.log(`staged ${resolve(outDir)}`);
}

function cliArgs(): string[] | null {
  // vite-node 는 스크립트 경로를 argv에서 뺀다: [node, vite-node, check, html]
  // node 직접 실행은 스크립트 경로가 남는다: [node, scripts/release.js, check, html]
  const argv = process.argv.slice(2).map((a) => a.replace(/\\/g, '/'));
  if (argv[0] === 'check' || argv[0] === 'stage') return argv;
  const idx = argv.findIndex((a) => /(?:^|\/)scripts\/release\.(ts|js)$/.test(a));
  if (idx < 0) return null;
  return argv.slice(idx + 1);
}

const args = cliArgs();
if (args !== null) main(args);
