#!/bin/bash
# icon.svg → AppIcon.icns
#
# 시스템 Chrome으로 SVG를 PNG로 굽고 iconutil로 묶는다.
# 예전에 insane-search Playwright 템플릿 경로를 빌려 썼는데 그 경로는 이
# 저장소의 빌드 계약이 아니다.
set -euo pipefail
cd "$(dirname "$0")/.."

SVG="app/icon.svg"
SET="dist/AppIcon.iconset"
CHROME="${PITWALL_CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

[ -f "$SVG" ] || { echo "$SVG 없음"; exit 1; }
[ -x "$CHROME" ] || { echo "Chrome 없음: $CHROME"; exit 1; }
rm -rf "$SET"; mkdir -p "$SET" dist

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

{
  printf '%s' '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style><body>'
  cat "$SVG"
  printf '%s' '</body>'
} > "$WORK/icon.html"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1024,1024 --default-background-color=00000000 \
  --screenshot="$WORK/1024.png" "file://$WORK/icon.html"
[ -f "$WORK/1024.png" ] || { echo "아이콘 스크린샷 실패"; exit 1; }

sips -z 1024 1024 "$WORK/1024.png" --out "$SET/icon_512x512@2x.png" >/dev/null
sips -z 512 512 "$WORK/1024.png" --out "$SET/icon_512x512.png" >/dev/null
cp "$SET/icon_512x512.png" "$SET/icon_256x256@2x.png"
sips -z 256 256 "$WORK/1024.png" --out "$SET/icon_256x256.png" >/dev/null
cp "$SET/icon_256x256.png" "$SET/icon_128x128@2x.png"
sips -z 128 128 "$WORK/1024.png" --out "$SET/icon_128x128.png" >/dev/null
sips -z 64 64 "$WORK/1024.png" --out "$SET/icon_32x32@2x.png" >/dev/null
sips -z 32 32 "$WORK/1024.png" --out "$SET/icon_32x32.png" >/dev/null
cp "$SET/icon_32x32.png" "$SET/icon_16x16@2x.png"
sips -z 16 16 "$WORK/1024.png" --out "$SET/icon_16x16.png" >/dev/null

iconutil -c icns "$SET" -o dist/AppIcon.icns
echo "dist/AppIcon.icns  $(du -h dist/AppIcon.icns | cut -f1)"
