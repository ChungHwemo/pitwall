/**
 * 커밋된 fixture의 cost_usd를 3-way 공식으로 다시 채운다.
 *
 * costUsd가 캐시 히트 boolean → 신규 입력/캐시/출력 분리로 바뀌면서, 예전 공식으로
 * 생성된 fixture 저장값이 새 공식과 어긋난다. 행 전체를 다시 뽑으면(RNG) 계약
 * 예시의 다른 부분이 전부 바뀌므로, 비용 한 필드만 새 공식 값으로 고친다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { costUsd, specOf } from '../src/config/models';
import type { CarEvent } from '../src/types';

const files = globSync(resolve(import.meta.dirname, '../fixtures/events.*.jsonl'));
let rows = 0;

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n').filter((l) => l.trim());
  const out = lines.map((l) => {
    const e = JSON.parse(l) as CarEvent;
    const spec = specOf(e.model);
    if (!spec) return l; // 단가를 모르는 행은 건드리지 않는다
    const cached = e.tokens.cache_read ?? 0;
    e.car_class = spec.carClass;
    e.cost_usd = costUsd(spec, e.tokens.prompt - cached, cached,
      e.tokens.completion + (e.tokens.reasoning ?? 0));
    rows++;
    return JSON.stringify(e);
  });
  writeFileSync(f, out.join('\n') + '\n');
}

console.log(`${rows} rows repriced across ${files.length} files`);
