# Maintainer: edu <you@example.com>
pkgname=axemobile
pkgver=3.0.0
pkgrel=1
pkgdesc="AxeMobile - cross-platform Tauri app for managing Bitcoin miners"
arch=('x86_64')
url="https://github.com/IsSasoriDev/AxeMobile"
license=('MIT')
depends=('webkit2gtk' 'libayatana-appindicator' 'gtk3')
makedepends=('git' 'nodejs' 'npm' 'rust' 'cargo' 'pkgconf')
source=("git+$url.git#tag=v3")
sha256sums=('SKIP')

prepare() {
  cd "$srcdir/AxeMobile"
  npm ci
}

build() {
  cd "$srcdir/AxeMobile"
  npm run build
  npx tauri build
}

package() {
  cd "$srcdir/AxeMobile/src-tauri/target/release/bundle"

  # Adjust this to what the build actually outputs!
  if [[ -f ../AxeMobile ]]; then
    install -Dm755 ../AxeMobile "$pkgdir/usr/bin/axemobile"
  fi

  if [[ -f ../AxeMobile.desktop ]]; then
    install -Dm644 ../AxeMobile.desktop "$pkgdir/usr/share/applications/axemobile.desktop"
  fi

  if [[ -f ../../icons/128x128.png ]]; then
    install -Dm644 ../../icons/128x128.png "$pkgdir/usr/share/icons/hicolor/128x128/apps/axemobile.png"
  fi
}
