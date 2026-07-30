import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * PITWALL_REAL=1 이면 실 사용 기록을 번들에 심는다 (`npm run build:real`).
 * 그러면 화면이 시뮬레이터가 아니라 실제 호출 기록으로 돈다.
 */
const realPath = 'fixtures/events.real.jsonl';
const real = process.env.PITWALL_REAL === '1' && existsSync(realPath)
  // 전체를 심으면 번들이 수 MB가 된다. 최근 것만 자른다 —
  // 잘랐다는 사실은 콘솔이 아니라 빌드 로그에 남긴다.
  ? readFileSync(realPath, 'utf8').trim().split('\n').slice(-3000).map((l) => JSON.parse(l))
  : undefined;

if (real) console.log(`[pitwall] 실 기록 ${real.length}건을 번들에 심는다`);

/** 벤더 한도 스냅샷. 실시간 모드에서 Claude 게이지가 비지 않게 같이 심는다. */
const limitsPath = 'fixtures/limits.json';
const limits = existsSync(limitsPath)
  ? JSON.parse(readFileSync(limitsPath, 'utf8'))
  : undefined;

export default defineConfig({
  define: {
    __PITWALL_REAL_EVENTS__: JSON.stringify(real),
    __PITWALL_LIMITS__: JSON.stringify(limits),
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
