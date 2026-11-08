#!/usr/bin/env bash
# Builds AxeMobile for Linux: a .deb and a portable .tar.gz.
# Output: dist-linux/
set -euo pipefail
cd "$(dirname "$0")/../.."

VERSION=$(grep -m1 '^version = ' Cargo.toml | cut -d'"' -f2)
OUT=dist-linux
cargo build --release -p axe-desktop
rm -rf "$OUT" && mkdir -p "$OUT"

command -v cargo-deb >/dev/null || cargo install cargo-deb --locked
cargo deb -p axe-desktop --no-build --output "$OUT/"

STAGE="$(mktemp -d)/axemobile-$VERSION"
mkdir -p "$STAGE"
cp target/release/AxeMobile "$STAGE/axemobile"
cp packaging/linux/axemobile.desktop crates/axe-desktop/assets/icon.png "$STAGE/"
cat > "$STAGE/README.txt" <<EOF
AxeMobile $VERSION for Linux

Run ./axemobile. To add it to your app menu, copy axemobile to ~/.local/bin,
icon.png to ~/.local/share/icons/axemobile.png and axemobile.desktop to
~/.local/share/applications/.
EOF
tar -C "$(dirname "$STAGE")" -czf "$OUT/axemobile-$VERSION-linux-x86_64.tar.gz" "axemobile-$VERSION"
ls -lh "$OUT"
