# Changelog

## [Unreleased] - 2026-03-08

### ✨ New Features

#### 📢 Push Notifications
- Native push notifications for announcements across all platforms
- **Desktop (Tauri):** System notifications via `@tauri-apps/plugin-notification`
- **Mobile (Capacitor):** Local notifications via `@capacitor/local-notifications`
- **Web:** Browser Notifications API fallback
- Notifications trigger in real-time when new announcements are published

#### 🔔 System Tray — Per-Miner Context Menu
- Right-click the tray icon to see individual miner stats:
  - 🟢/🔴 Online/offline status indicator
  - Hashrate (GH/s), temperature (°C), and power (W) per device
- **Quick restart** — restart any miner directly from the tray context menu
- Dynamic menu rebuilds automatically every 10 seconds with live data
- Tooltip shows aggregated stats (active count, total hashrate, total power)

#### 🛡️ Admin Panel (`/admin`)
- Secure login-protected announcement management dashboard
- Create, toggle, and delete announcements
- Announcement types: Info, Warning, Update, Event
- Optional external links on announcements
- Real-time sync — announcements appear instantly across all connected clients

#### 🔄 Minimize to Tray
- Option to minimize to system tray instead of closing the app
- Persistent preference saved across sessions
- Show/Quit actions from tray menu

### 🎨 Improvements
- Smoother page transitions with refined cubic-bezier easing
- Updated features table in README
- Cleaned up OG/Twitter meta tags

### 🔧 Backend
- Realtime subscription on announcements table for instant delivery
- RLS policies for public read access and authenticated write access
- Admin seed function for initial account setup

---

*Copy the section above for your GitHub release notes.*
