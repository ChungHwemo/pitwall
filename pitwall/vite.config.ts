import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * 화면에서 고를 수 있는 데이터셋.
 *
 * 예전에는 빌드마다 한 벌만 심어서, 무엇을 보고 있는지 화면만 봐서는 알 수 없고
 * 바꾸려면 다시 빌드해야 했다. 여러 벌을 심고 고르게 한다.
 *
 * 데이터셋마다 상한을 둔다 — 전부 심으면 번들이 수십 MB가 된다. 잘랐다는 사실은
 * 빌드 로그에 남긴다.
 */
const PER_SET = Number(process.env.PITWALL_MAX_EVENTS ?? 5000);

const SOURCES = [
  { id: 'real', label: '실기록', file: 'fixtures/events.real.jsonl' },
  { id: 'demo-small', label: '데모 · 소규모', file: 'fixtures/events.demo-small.jsonl' },
  { id: 'demo', label: '데모 · 중규모', file: 'fixtures/events.demo.jsonl' },
  { id: 'demo-large', label: '데모 · 대규모', file: 'fixtures/events.demo-large.jsonl' },
];

/** 벤더 한도 스냅샷. 실시간 모드에서 Claude 게이지가 비지 않게 같이 심는다. */
const limitsPath = 'fixtures/limits.json';
const limits = existsSync(limitsPath) ? JSON.parse(readFileSync(limitsPath, 'utf8')) : undefined;

const datasets = process.env.PITWALL_REAL === '1'
  ? SOURCES.flatMap((src) => {
    if (!existsSync(src.file)) return [];
    const lines = readFileSync(src.file, 'utf8').trim().split('\n');
    const kept = lines.slice(-PER_SET);
    console.log(`[pitwall] ${src.label}: ${kept.length}/${lines.length}건`);
    return [{
      id: src.id,
      label: src.label,
      synthetic: src.id !== 'real',
      events: kept.map((l) => JSON.parse(l)),
    }];
  })
  : undefined;

export default defineConfig({
  define: {
    __PITWALL_DATASETS__: JSON.stringify(datasets),
    __PITWALL_LIMITS__: JSON.stringify(limits),
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
