#!/bin/bash
# PITWALL.app 빌드 — Xcode 프로젝트 없이 swiftc로 직접 만든다.
#
#   npm run build:app          # 시뮬레이터 화면
#   npm run build:app:real     # 실 사용 기록 화면
#
# 웹 빌드가 서버 없는 단일 HTML이라 래퍼는 그걸 번들에 넣고 WebView로 열 뿐이다.
set -euo pipefail

cd "$(dirname "$0")/.."
APP="dist/PITWALL.app"
HTML="dist/pitwall.html"

[ -f "$HTML" ] || { echo "먼저 웹을 빌드하십시오: npm run build:single"; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>PITWALL</string>
  <key>CFBundleDisplayName</key><string>PITWALL</string>
  <key>CFBundleIdentifier</key><string>dev.pitwall.app</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>PITWALL</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <!-- 로컬 파일만 연다. 네트워크 접근이 필요 없다. -->
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsArbitraryLoads</key><false/></dict>
</dict>
</plist>
PLIST

swiftc -O -target arm64-apple-macos13 \
  -framework AppKit -framework WebKit \
  -o "$APP/Contents/MacOS/PITWALL" \
  app/PitwallApp.swift

cp "$HTML" "$APP/Contents/Resources/pitwall.html"

# 아이콘이 없으면 만든다. 있으면 그대로 쓴다 (Chromium 렌더가 느리다).
[ -f dist/AppIcon.icns ] || bash app/makeIcon.sh
cp dist/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

# 서명 없이 배포하면 다른 기기에서 Gatekeeper가 막는다.
# 로컬 실행용 ad-hoc 서명만 붙인다 — 배포는 별도 판단이 필요하다.
codesign --force --sign - "$APP" 2>/dev/null || echo "codesign 생략 (로컬 실행에는 영향 없음)"

SIZE=$(du -sh "$APP" | cut -f1)
echo "$APP  $SIZE"
echo "실행: open $APP"
