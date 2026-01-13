<div align="center">

# ⛏️ AxeMobile

### **Unleash the Open Source Mining Power**

*A modern, cross-platform application for managing Bitcoin mining hardware*

[![Stars](https://img.shields.io/github/stars/IsSasoriDev/AxeMobile?style=for-the-badge&logo=github&color=f97316)](https://github.com/IsSasoriDev/AxeMobile/stargazers)
[![Forks](https://img.shields.io/github/forks/IsSasoriDev/AxeMobile?style=for-the-badge&logo=github&color=3b82f6)](https://github.com/IsSasoriDev/AxeMobile/network/members)
[![Issues](https://img.shields.io/github/issues/IsSasoriDev/AxeMobile?style=for-the-badge&logo=github&color=ef4444)](https://github.com/IsSasoriDev/AxeMobile/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?style=flat-square&logo=tauri)](https://tauri.app)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com)

<br />

[**💬 Discord**](https://discord.com/invite/osmu) · [**🐛 Report Bug**](https://github.com/IsSasoriDev/AxeMobile/issues)

<br />

<img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows" />
<img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS" />
<img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux" />
<img src="https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
<img src="https://img.shields.io/badge/iOS-000000?style=for-the-badge&logo=ios&logoColor=white" alt="iOS" />
<img src="https://img.shields.io/badge/Umbrel-5351FB?style=for-the-badge&logo=umbrel&logoColor=white" alt="Umbrel" />

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔧 **Firmware Flashing** | Easy OTA updates for Bitaxe & NerdAxe devices |
| 📊 **Real-time Stats** | Monitor hashrate, temperature, and power |
| 🎨 **7 Themes** | AMOLED, Bitcoin, Bitaxe, DTV, and more |
| 📱 **Cross-Platform** | Web, Desktop, iOS & Android |
| ⚡ **Lightweight** | Fast Tauri builds under 10MB |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org) 
- [Git](https://git-scm.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/IsSasoriDev/AxeMobile
cd AxeMobile

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🖥️ Build Desktop App (Tauri)

<details>
<summary><b>Step 1: Install Rust</b></summary>

#### Windows
1. Download [rustup-init.exe](https://rustup.rs)
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"

#### macOS
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
xcode-select --install
```

#### Linux (Debian/Ubuntu)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

</details>

<details>
<summary><b>Step 2: Build</b></summary>

```bash
# Build web assets
npm run build

# Build desktop executable
npx tauri build
```

📦 Output: `src-tauri/target/release/bundle/`

</details>

<details>
<summary><b>Development Mode</b></summary>

```bash
npx tauri dev
```

Hot reload enabled for rapid development.

</details>

---

## 📱 Build Mobile Apps

<details>
<summary><b>iOS (macOS only)</b></summary>

```bash
npx cap add ios
npm run build && npx cap sync
npx cap run ios
```

</details>

<details>
<summary><b>Android</b></summary>

```bash
npx cap add android
npm run build && npx cap sync
npx cap run android
```

</details>

---

## 🏠 Run on Umbrel

<details>
<summary><b>Option 1: Community App Store (Recommended)</b></summary>

1. Open your Umbrel dashboard
2. Go to **App Store** → **Community App Stores**
3. Add the AxeMobile app store URL (when available)
4. Install AxeMobile from the store

</details>

<details>
<summary><b>Option 2: Manual Installation</b></summary>

```bash
# SSH into your Umbrel
ssh umbrel@umbrel.local

# Navigate to community apps
cd ~/umbrel/app-data

# Clone AxeMobile
git clone https://github.com/IsSasoriDev/AxeMobile axemobile

# Copy Umbrel files
cp -r axemobile/umbrel/* ~/umbrel/app-data/axemobile/

# Restart Umbrel
sudo ~/umbrel/scripts/stop && sudo ~/umbrel/scripts/start
```

</details>

<details>
<summary><b>Option 3: Docker Compose</b></summary>

```bash
# Clone the repository
git clone https://github.com/IsSasoriDev/AxeMobile
cd AxeMobile

# Build and run with Docker
docker-compose -f umbrel/docker-compose.yml up -d
```

Access at **http://umbrel.local:3847**

</details>

---

## 🎨 Available Themes

| Theme | Style |
|-------|-------|
| ☀️ Light | Clean minimal white |
| 🌑 AMOLED | Pure black for OLED |
| 🔥 Bitaxe | Red cyberpunk grid |
| ₿ Bitcoin | Orange & dark gray |
| 🔵 PowerMining | Blue industrial |
| 🌌 DTV | Space nebula & comets |
| 🏭 IxTech | Light industrial |

---

## 📊 Project Stats

<div align="center">

![Repo Size](https://img.shields.io/github/repo-size/IsSasoriDev/AxeMobile?style=for-the-badge&color=8b5cf6)
![Last Commit](https://img.shields.io/github/last-commit/IsSasoriDev/AxeMobile?style=for-the-badge&color=06b6d4)
![Contributors](https://img.shields.io/github/contributors/IsSasoriDev/AxeMobile?style=for-the-badge&color=ec4899)

</div>

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

### 🙏 Acknowledgments

**[Open Source Miners United](https://discord.com/invite/osmu)** • **Bitaxe Team** • **NerdAxe Team** • **DTV Electronics**

<br />

**⛏️ Made with ❤️ for the Bitcoin mining community**

<br />

[FOSS | GTFO]

</div>
