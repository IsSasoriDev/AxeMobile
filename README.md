# ⛏️ AxeMobile

**Unleash the Open Source power**

A modern, cross-platform application for managing Bitcoin mining hardware, built for the open-source community. AxeMobile provides an intuitive interface for flashing firmware to Bitaxe and NerdAxe devices, with support for web, mobile, and desktop platforms.

![AxeMobile](https://img.shields.io/badge/Platform-Web%20%7C%20Android%20%7C%20iOS%20%7C%20Windows%20%7C%20macOS%20%7C%20Linux-blue)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)
![Capacitor](https://img.shields.io/badge/Capacitor-6.0+-119EFF?logo=capacitor)
![Tauri](https://img.shields.io/badge/Tauri-2.0+-FFC131?logo=tauri)

## ✨ Features

- 🔧 **Firmware Flashing**: Easy firmware updates for Bitaxe and NerdAxe devices
- 📱 **Cross-Platform**: Web, Android, iOS, Windows, macOS, and Linux support
- 🎨 **Modern UI**: Beautiful, responsive design with dark/light themes
- ⚡ **Performance**: Fast and lightweight with optimized builds
- 🌐 **Progressive Web App**: Installable web app with offline capabilities

## 📋 Prerequisites

- **Node.js** 18.0+ and npm
- **Git** for version control

### Platform-Specific Requirements:

#### Mobile Development (iOS/Android):
- **Android**: Android Studio + Android SDK
- **iOS**: Xcode 14+ (macOS only)

#### Desktop Development:
- **Windows**: Visual Studio Build Tools or Visual Studio Community
- **macOS**: Xcode Command Line Tools
- **Linux**: Build essentials (gcc, pkg-config, etc.)

## 🛠️ Installation & Development

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/IsSasoriDev/AxeMobile
cd AxeMobile
npm install
```

### 2. Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production

```bash
npm run build
```

## 📦 Building for Different Platforms

### 🌐 Web Application

```bash
# Build for web deployment
npm run build

# Preview production build
npm run preview
```

### 📱 Mobile Apps (iOS/Android)

```bash
# Add mobile platforms
npx cap add ios
npx cap add android

# Build web assets
npm run build

# Sync with native platforms
npx cap sync

# Run on iOS (macOS only)
npx cap run ios

# Run on Android
npx cap run android
```

#### iOS Additional Steps:
1. Open `ios/App/App.xcworkspace` in Xcode
2. Configure signing & capabilities
3. Build and deploy

#### Android Additional Steps:
1. Open `android/` folder in Android Studio
2. Configure signing if needed
3. Build APK/AAB

### 🖥️ Desktop Apps

#### Tauri (Recommended - Smaller bundle size)

```bash
# For Windows build, you need Rust installed
# Install Rust from: https://rustup.rs/

# Build desktop app
npm run build
npx tauri build

# Or for development mode with hot reload
npx tauri dev
```

**Windows Requirements:**
- Install [Rust](https://rustup.rs/)
- Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)

Executables will be in `src-tauri/target/release/bundle/`

#### Electron (Alternative)

```bash
# Install Electron
npm install electron electron-builder --save-dev

# Add to package.json scripts:
# "electron": "electron .",
# "electron-build": "electron-builder"

# Build
npm run electron-build
```

## 🧪 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Type check
npm run type-check

# Sync Capacitor (after adding platforms)
npx cap sync

# Build desktop app with Tauri
npx tauri build
```

## 📁 Project Structure

```
axe-mobile/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── layout/       # Layout components (sidebar, navigation)
│   │   ├── miners/       # Miner-specific components
│   │   ├── ui/           # Shadcn/ui components
│   │   └── webview/      # WebView components
│   ├── pages/            # Route pages
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   └── assets/           # Static assets
├── public/               # Public assets
├── android/              # Android native code (after cap add)
├── ios/                  # iOS native code (after cap add)
├── src-tauri/            # Tauri desktop configuration
└── capacitor.config.ts   # Capacitor configuration
```
^ not updated for current structure

## 🎨 Themes

Themes are configured in `src/index.css` and `tailwind.config.ts`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🔗 Community

- **Discord**: [Join OSMU Community](https://discord.com/invite/osmu)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Open Source Miners United (OSMU)** for community support
- **Bitaxe & NerdAxe** teams for hardware innovation
- All contributors to the open-source community

---

<div align="center">
  <strong>⛏️ Built with ❤️ for the Bitcoin mining community</strong>
</div>
