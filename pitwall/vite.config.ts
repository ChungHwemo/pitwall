import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { PER_SET, busiestWindow } from './scripts/pickWindow';

/**
 * 화면에서 고를 수 있는 데이터셋.
 *
 * 예전에는 빌드마다 한 벌만 심어서, 무엇을 보고 있는지 화면만 봐서는 알 수 없고
 * 바꾸려면 다시 빌드해야 했다. 여러 벌을 심고 고르게 한다.
 *
 * 데이터셋마다 상한을 둔다 — 전부 심으면 번들이 수십 MB가 된다. 상한과 잘라낼
 * 구간을 고르는 규칙은 `scripts/pickWindow`에 있다 (테스트가 같은 함수를 밟는다).
 * 잘랐다는 사실은 빌드 로그에 남긴다.
 */
const SOURCES = [
  { id: 'real', label: '실기록', file: 'fixtures/events.real.jsonl' },
  // 계정이 셋 겹친 실제 하루. 오늘은 둘뿐이라 레인이 갈리는 경로가 안 밟힌다.
  { id: 'real-busy', label: '실기록 · 붐빈 날', file: 'fixtures/events.real-busy.jsonl' },
  { id: 'demo-small', label: '데모 · 소규모', file: 'fixtures/events.demo-small.jsonl' },
  { id: 'demo', label: '데모 · 중규모', file: 'fixtures/events.demo.jsonl' },
  { id: 'demo-large', label: '데모 · 대규모', file: 'fixtures/events.demo-large.jsonl' },
];

/** 벤더 한도 스냅샷. 실시간 모드에서 Claude 게이지가 비지 않게 같이 심는다. */
const limitsPath = 'fixtures/limits.json';
const limits = existsSync(limitsPath) ? JSON.parse(readFileSync(limitsPath, 'utf8')) : undefined;

/*
 * 기본 빌드는 지어낸 데모만 심는다 — 화면이 무엇을 보는지 정직하게 밝히려면
 * 고를 수 있는 데모가 있어야 한다. 실기록 두 벌은 `PITWALL_REAL=1`일 때만 심는다.
 */
const wantReal = process.env.PITWALL_REAL === '1';
const chosen = wantReal ? SOURCES : SOURCES.filter((src) => src.id.startsWith('demo'));

const datasets = chosen.flatMap((src) => {
  if (!existsSync(src.file)) return [];
  const lines = readFileSync(src.file, 'utf8').trim().split('\n');
  const from = lines.length > PER_SET ? busiestWindow(lines, PER_SET) : null;
  const kept = from ? lines.slice(from.at, from.at + PER_SET) : lines;
  console.log(`[pitwall] ${src.label}: ${kept.length}/${lines.length}건`
    + (from ? ` · ${from.at}번째부터 (계정 ${from.cars}대가 겹친다)` : ''));
  return [{
    id: src.id,
    label: src.label,
    // 실기록 두 벌만 진짜다. 나머지는 화면이 `지어낸 데이터`라고 밝힌다.
    synthetic: !src.id.startsWith('real'),
    events: kept.map((l) => JSON.parse(l)),
  }];
});

export default defineConfig({
  build: {
    // 실기록까지 단일 오프라인 HTML에 심는 제품 계약의 8.5MB 상한이다.
    chunkSizeWarningLimit: 8_500,
  },
  define: {
    __PITWALL_DATASETS__: JSON.stringify(datasets),
    __PITWALL_LIMITS__: JSON.stringify(limits),
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
