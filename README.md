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
| 🏊 **AxePool** | Built-in solo mining pool with stratum server |
| 🎨 **7 Themes** | AMOLED, Bitcoin, Bitaxe, DTV, and more |
| 📱 **Cross-Platform** | Web, Desktop, iOS & Android |
| ⚡ **Lightweight** | Fast Tauri builds under 10MB |
| 📢 **Push Notifications** | Native alerts for announcements on Desktop, Mobile & Web |
| 🔔 **System Tray** | Minimize to tray with live miner stats & per-device context menu |
| 🛡️ **Admin Panel** | Secure announcement management with authentication |

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

## 📱 Build Android App (Full Guide)

This guide walks you through building a signed APK that you can install on any Android device or publish to the Play Store.

### Prerequisites

1. **Android Studio** - [Download here](https://developer.android.com/studio)
2. **JDK 17+** - Usually bundled with Android Studio
3. **Node.js 18+** - [Download here](https://nodejs.org)

### Step 1: Setup Android Studio

<details>
<summary><b>First-time Android Studio Setup</b></summary>

1. Install Android Studio
2. Open Android Studio → **More Actions** → **SDK Manager**
3. Under **SDK Platforms**, install:
   - Android 14.0 (API 34) or latest
4. Under **SDK Tools**, install:
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android SDK Platform-Tools
5. Note your SDK location (usually `~/Android/Sdk` on Linux/Mac, `%LOCALAPPDATA%\Android\Sdk` on Windows)

</details>

### Step 2: Add Android Platform

```bash
# Clone the repo (skip if already done)
git clone https://github.com/IsSasoriDev/AxeMobile
cd AxeMobile

# Install dependencies
npm install

# Add Android platform
npx cap add android
```

### Step 3: Build the App

```bash
# Build the web assets
npm run build

# Sync to Android project
npx cap sync android
```

### Step 4: Open in Android Studio

```bash
# Open the Android project in Android Studio
npx cap open android
```

Or manually open: `android/` folder in Android Studio

### Step 5: Build Debug APK

<details>
<summary><b>Option A: Using Android Studio (Recommended)</b></summary>

1. In Android Studio, go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for the build to complete
3. Click **locate** in the notification to find the APK
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

</details>

<details>
<summary><b>Option B: Using Command Line</b></summary>

```bash
cd android

# Linux/macOS
./gradlew assembleDebug

# Windows
gradlew.bat assembleDebug
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

</details>

### Step 6: Build Signed Release APK

For Play Store or distribution, you need a signed APK:

<details>
<summary><b>Create a Signing Key (One-time)</b></summary>

```bash
keytool -genkey -v -keystore axemobile-release.keystore -alias axemobile -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- Keystore password (remember this!)
- Your name, organization, etc.
- Key password (can be same as keystore)

⚠️ **IMPORTANT**: Keep your keystore file and passwords safe! You need them for all future updates.

</details>

<details>
<summary><b>Configure Signing in Gradle</b></summary>

1. Create `android/keystore.properties`:

```properties
storePassword=your_keystore_password
keyPassword=your_key_password
keyAlias=axemobile
storeFile=../axemobile-release.keystore
```

2. Update `android/app/build.gradle`:

```gradle
// Add at the top, after the plugins block
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... existing config ...
    
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

</details>

<details>
<summary><b>Build Release APK</b></summary>

```bash
cd android

# Linux/macOS
./gradlew assembleRelease

# Windows
gradlew.bat assembleRelease
```

📦 Output: `android/app/build/outputs/apk/release/app-release.apk`

</details>

<details>
<summary><b>Build Release Bundle (for Play Store)</b></summary>

```bash
cd android

# Linux/macOS
./gradlew bundleRelease

# Windows
gradlew.bat bundleRelease
```

📦 Output: `android/app/build/outputs/bundle/release/app-release.aab`

</details>

### Step 7: Install on Device

**Via ADB (USB Debugging):**
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

**Via File Transfer:**
1. Copy the APK to your phone
2. Open the APK file on your phone
3. Allow installation from unknown sources when prompted

### Troubleshooting

<details>
<summary><b>Common Issues</b></summary>

**"SDK location not found"**
- Create `android/local.properties`:
  ```
  sdk.dir=/path/to/your/Android/Sdk
  ```

**"JAVA_HOME not set"**
- Set JAVA_HOME to your JDK installation
- On macOS: `export JAVA_HOME=$(/usr/libexec/java_home)`

**"Gradle build failed"**
- Try: `cd android && ./gradlew clean`
- Delete `android/.gradle` folder and rebuild

**"App crashes on launch"**
- Check `adb logcat` for errors
- Ensure Capacitor plugins are synced: `npx cap sync android`

</details>

---

## 📱 Build iOS App

<details>
<summary><b>iOS Build (macOS only)</b></summary>

### Prerequisites
- macOS with Xcode 15+
- Apple Developer account (for device testing/distribution)

### Steps

```bash
# Add iOS platform
npx cap add ios

# Build and sync
npm run build && npx cap sync ios

# Open in Xcode
npx cap open ios
```

### Build for Device
1. In Xcode, select your team in **Signing & Capabilities**
2. Connect your iPhone
3. Select your device as the build target
4. Click **Run** (▶️)

### Build for App Store
1. **Product** → **Archive**
2. **Distribute App** → **App Store Connect**
3. Follow the upload wizard

</details>

---

## 🏊 AxePool - Solo Mining Pool

AxePool is a built-in solo mining pool that connects directly to your Bitcoin node. Point your Bitaxe miners directly at your Umbrel!

### Features
- Stratum server on port 3333
- Real-time hashrate & share tracking
- Block found notifications
- Direct connection to your Bitcoin node

### Setup (Umbrel)

1. Install AxeMobile from the Umbrel App Store
2. Go to **AxePool** tab and configure your Bitcoin node RPC credentials
3. Point your miners to: `stratum+tcp://umbrel.local:3333`
4. Use your Bitcoin address as the username

### Manual Docker Setup

```bash
cd axemobile-main
docker-compose up -d
```

Configure environment variables:
- `APP_BITCOIN_NODE_IP` - Your Bitcoin node IP (default: 10.21.21.9)
- `APP_BITCOIN_RPC_PASS` - RPC password
- `APP_POOL_ADDRESS` - Your Bitcoin payout address

---

## 🏠 Run on Umbrel

### Community App Store Structure

This repository is structured as an Umbrel Community App Store. The folder structure follows Umbrel's naming convention:

```
AxeMobile/
├── umbrel-app-store.yml       # Store config (id: axemobile)
├── axemobile-main/            # App folder (must start with store id)
│   ├── umbrel-app.yml         # App manifest
│   ├── docker-compose.yml     # Docker services
│   ├── Dockerfile             # Web app image
│   ├── nginx.conf             # Nginx config
│   ├── icon.png               # App icon (72x72+)
│   ├── 1.jpg, 2.jpg...        # Gallery images
│   └── axepool-stratum/       # Stratum server
```

**Important:** The app folder name must be `{store-id}-{app-name}` format.

<details>
<summary><b>Option 1: Community App Store (Recommended)</b></summary>

1. Open your Umbrel dashboard
2. Go to **App Store** → click the **⋮** menu → **Community App Stores**
3. Add this URL: `https://github.com/IsSasoriDev/AxeMobile`
4. AxeMobile will appear in your App Store
5. Click Install!

</details>

<details>
<summary><b>Option 2: Docker Compose (Standalone)</b></summary>

```bash
# Clone the repository
git clone https://github.com/IsSasoriDev/AxeMobile
cd AxeMobile

# Build and run with Docker
docker-compose -f axemobile-main/docker-compose.yml up -d
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
