/**
 * dist를 HTML 한 장으로 인라인한다.
 *
 * PITWALL은 서버가 없고 자산이 JS 하나 + CSS 하나뿐이라, 통째로 인라인하면
 * 파일 하나를 열기만 해도 돌아간다 — 정적 호스팅·아티팩트·file:// 어디서나.
 * 최종 목표인 macOS 위젯/앱 래핑에서도 로컬 자산 하나가 가장 다루기 쉽다.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
const assets = readdirSync(resolve(dist, 'assets'));
const js = assets.find((f) => f.endsWith('.js'));
const css = assets.find((f) => f.endsWith('.css'));
if (!js || !css) throw new Error(`빌드 산출물을 찾지 못했다: ${assets.join(', ')}`);

// 자산을 가리키는 태그를 통째로 걷어내고 인라인으로 갈아끼운다.
// 속성 순서·crossorigin·modulepreload가 붙어도 흔들리지 않게 태그 단위로 지운다.
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
  .replace(/<script\b[^>]*\bsrc="[^"]*\/assets\/[^"]*"[^>]*>\s*<\/script>/g, '')
  .replace(/<link\b[^>]*\bhref="[^"]*\/assets\/[^"]*"[^>]*>/g, '')
  // 치환값을 함수로 넘긴다. 문자열로 넘기면 번들 안의 `$&`(minifier가 만든 `$&&`)를
  // 정규식 치환 패턴으로 해석해 매치 문자열이 코드에 박힌다.
  .replace('</head>', () => `<style>\n${readFileSync(resolve(dist, 'assets', css), 'utf8')}\n</style>\n</head>`)
  .replace('</body>', () => `<script type="module">\n${readFileSync(resolve(dist, 'assets', js), 'utf8')}\n</script>\n</body>`);

if (html.includes('/assets/')) throw new Error('인라인되지 않은 자산 참조가 남았다');

const out = resolve(dist, 'pitwall.html');
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(1)} kB`);
