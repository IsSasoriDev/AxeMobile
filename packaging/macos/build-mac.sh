#!/usr/bin/env bash
# Builds AxeMobile.app (universal: Apple silicon + Intel) with the WidgetKit
# widget inside, and wraps it in a DMG.
# Output: dist-mac/AxeMobile-<version>-macOS.dmg
#
# Signing: ad-hoc by default. Set MACOS_SIGN_ID to a "Developer ID
# Application: ..." identity to sign for real (needed for Gatekeeper and for
# widgets on other people's Macs).
set -euo pipefail
cd "$(dirname "$0")/../.."

VERSION=$(grep -m1 '^version = ' Cargo.toml | cut -d'"' -f2)
SIGN_ID="${MACOS_SIGN_ID:--}"
OUT=dist-mac
APP="$OUT/AxeMobile.app"

rustup target add aarch64-apple-darwin x86_64-apple-darwin
cargo build --release -p axe-desktop --target aarch64-apple-darwin
cargo build --release -p axe-desktop --target x86_64-apple-darwin

rm -rf "$OUT"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/PlugIns"
lipo -create -output "$APP/Contents/MacOS/AxeMobile" \
  target/aarch64-apple-darwin/release/AxeMobile \
  target/x86_64-apple-darwin/release/AxeMobile
sed "s/__VERSION__/$VERSION/g" packaging/macos/Info.plist > "$APP/Contents/Info.plist"

# icon
ICONSET="$(mktemp -d)/AxeMobile.iconset"
mkdir -p "$ICONSET"
SRC=crates/axe-desktop/assets/icon.png
for s in 16 32 128 256 512; do
  sips -z $s $s "$SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z $d $d "$SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AxeMobile.icns"

# widget
(
  cd packaging/macos/widget
  xcodegen generate
  xcodebuild -project AxeMobileWidget.xcodeproj -target AxeMobileWidget -configuration Release \
    SYMROOT="$PWD/build" CODE_SIGNING_ALLOWED=NO build
)
cp -R packaging/macos/widget/build/Release/AxeMobileWidget.appex "$APP/Contents/PlugIns/"

# sign inside-out: the widget with its sandbox entitlements, then the app
codesign --force --sign "$SIGN_ID" --timestamp=none \
  --entitlements packaging/macos/widget/AxeMobileWidget.entitlements \
  "$APP/Contents/PlugIns/AxeMobileWidget.appex"
codesign --force --sign "$SIGN_ID" --timestamp=none "$APP"
codesign --verify --deep --verbose=2 "$APP"

# DMG with a drag-to-Applications link
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "AxeMobile" -srcfolder "$STAGE" -ov -format UDZO "$OUT/AxeMobile-$VERSION-macOS.dmg"
ls -lh "$OUT"
