import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };
const deps = Object.keys(pkg.dependencies ?? {}).sort();
const docs = [
  readFileSync('../README.md', 'utf8'),
  readFileSync('../PITWALL.md', 'utf8'),
  readFileSync('CHECKLIST.md', 'utf8'),
];

describe('출하 문서의 런타임 의존성', () => {
  it('package.json에 있는 의존성을 0개라고 쓰지 않고 이름을 밝힌다', () => {
    for (const doc of docs) {
      expect(doc).not.toMatch(/런타임 의존성 0/);
      expect(doc).not.toMatch(/zero runtime dependencies/i);
      for (const name of deps) expect(doc).toContain(name);
    }
  });
});
