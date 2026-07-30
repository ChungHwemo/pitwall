#!/bin/bash
# icon.svg → AppIcon.icns
#
# 헤드리스 Chromium으로 SVG를 각 크기 PNG로 굽고 iconutil로 묶는다.
# rsvg·ImageMagick 같은 추가 도구를 요구하지 않으려는 선택이다 —
# Chromium은 이미 검수 스크립트가 쓰고 있다.
set -euo pipefail
cd "$(dirname "$0")/.."

SVG="app/icon.svg"
SET="dist/AppIcon.iconset"
RENDER="${PITWALL_CHROMIUM_DIR:-/Users/solution/.claude/plugins/cache/gptaku-plugins/insane-search/0.12.1/skills/insane-search/engine/templates}"

[ -f "$SVG" ] || { echo "$SVG 없음"; exit 1; }
rm -rf "$SET"; mkdir -p "$SET"

cat > /tmp/pitwall-icon.mjs <<'JS'
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [svgPath, outDir] = process.argv.slice(2);
const svg = readFileSync(svgPath, 'utf8');
const sizes = [16, 32, 64, 128, 256, 512, 1024];
const b = await chromium.launch();
const p = await (await b.newContext({ deviceScaleFactor: 1 })).newPage();
await p.setContent(`<body style="margin:0">${svg}</body>`);
for (const s of sizes) {
  await p.setViewportSize({ width: s, height: s });
  await p.evaluate((n) => {
    const el = document.querySelector('svg');
    el.setAttribute('width', String(n));
    el.setAttribute('height', String(n));
  }, s);
  await p.screenshot({ path: `${outDir}/${s}.png`, omitBackground: true,
                       clip: { x: 0, y: 0, width: s, height: s } });
}
await b.close();
JS

ROOT="$PWD"
# playwright는 렌더 템플릿 디렉터리에만 설치돼 있다. 스크립트를 그쪽에 두고 실행한다.
cp /tmp/pitwall-icon.mjs "$RENDER/pitwall-icon.mjs"
(cd "$RENDER" && node pitwall-icon.mjs "$ROOT/$SVG" "$ROOT/$SET")
rm -f "$RENDER/pitwall-icon.mjs"

# iconutil이 요구하는 이름 규칙으로 정리한다
cd "$SET"
mv 16.png   icon_16x16.png
cp icon_16x16.png icon_16x16@2x.png 2>/dev/null || true
mv 32.png   icon_32x32.png
mv 64.png   icon_32x32@2x.png
mv 128.png  icon_128x128.png
mv 256.png  icon_128x128@2x.png
cp icon_128x128@2x.png icon_256x256.png
mv 512.png  icon_256x256@2x.png
cp icon_256x256@2x.png icon_512x512.png
mv 1024.png icon_512x512@2x.png
cd - >/dev/null

iconutil -c icns "$SET" -o dist/AppIcon.icns
echo "dist/AppIcon.icns  $(du -h dist/AppIcon.icns | cut -f1)"
