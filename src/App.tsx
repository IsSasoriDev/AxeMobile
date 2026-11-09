import { createContext, useContext, useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { Cpu, Gauge as GaugeIcon, LayoutDashboard, Network, Pickaxe, Settings2, Trophy, Waves } from "lucide-react";
import { api, type Overview } from "@/api";
import { usePoll } from "@/hooks";
import { ToastProvider } from "@/components/Toast";
import { CinematicIntro } from "@/components/CinematicIntro";
import { TypingText } from "@/components/TypingText";
import dtvLogo from "@/assets/dtv-electronics-logo.png";
import Dashboard from "@/pages/Dashboard";
import MinerPage from "@/pages/Miner";
import Swarm from "@/pages/Swarm";
import Pools from "@/pages/Pools";
import AxePool from "@/pages/AxePool";
import TuningPage from "@/pages/Tuning";
import System from "@/pages/System";
import Leaderboard from "@/pages/Leaderboard";

export type Theme = "default" | "dtv";

interface Ctx {
  overview: Overview | null;
  error: string;
  reload: () => Promise<void>;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

function readLocal(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("theme-dtv", t === "dtv");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dtv" ? "#050505" : "#070a10");
}

function Splash({ onDone }: { onDone: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setOut(true), 1100);
    const b = setTimeout(onDone, 1600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onDone]);
  return (
    <div className={`splash ${out ? "out" : ""}`}>
      <div>
        <div className="mark">
          <b>Axe</b>Mobile<i>.</i>
        </div>
        <div className="line">
          <i />
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/swarm", label: "Swarm", icon: Network },
  { to: "/pools", label: "Pools", icon: Waves },
  { to: "/axepool", label: "AxePool", icon: Pickaxe },
  { to: "/tuning", label: "Tuning", icon: GaugeIcon },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/system", label: "System", icon: Settings2 },
];

function Shell() {
  const { overview, theme } = useApp();
  const f = overview?.fleet;
  return (
    <div className="app">
      <nav className="sidebar">
        {theme === "dtv" ? (
          <div className="logo">
            <img src={dtvLogo} alt="DTV Electronics" />
            <span>AxeMobile</span>
          </div>
        ) : (
          <div className="logo">
            <span>
              <b>Axe</b>Mobile<i>.</i>
            </span>
          </div>
        )}
        <div className="tagline">
          <TypingText
            key={theme}
            texts={theme === "dtv" ? ["EST. BLOCK 723,420"] : ["Open Source Mining", "Hack the planet"]}
            typingSpeed={60}
            deletingSpeed={25}
            pauseDuration={2000}
          />
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav ${isActive ? "active" : ""}`}>
            <n.icon />
            <span>{n.label}</span>
            {n.to === "/swarm" && f && (
              <span className="count">
                {f.online}/{f.total}
              </span>
            )}
          </NavLink>
        ))}
        <div className="foot">
          <span>
            <Cpu size={12} style={{ verticalAlign: "-2px" }} /> Umbrel · v2.2.0
          </span>
          <span>AxeForge &amp; AxeOS miners</span>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/miner/:id" element={<MinerPage />} />
          <Route path="/swarm" element={<Swarm />} />
          <Route path="/pools" element={<Pools />} />
          <Route path="/pools/:id" element={<Pools />} />
          <Route path="/axepool" element={<AxePool />} />
          <Route path="/tuning" element={<TuningPage />} />
          <Route path="/tuning/:id" element={<TuningPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/system" element={<System />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [theme, setThemeState] = useState<Theme>(() => (readLocal("axemobile-theme", "default") === "dtv" ? "dtv" : "default"));
  const [intro, setIntro] = useState(() => readLocal("axemobile-intro", "1") !== "0");
  const { data, error, reload } = usePoll(() => api<Overview>("/overview"), 5000);

  useEffect(() => applyTheme(theme), [theme]);

  // The engine keeps the theme too, so it survives a browser change.
  useEffect(() => {
    api<{ settings: Record<string, string> }>("/settings")
      .then(({ settings }) => {
        if (settings.theme === "dtv" || settings.theme === "default") {
          if (settings.theme !== readLocal("axemobile-theme", "")) {
            setThemeState(settings.theme as Theme);
            writeLocal("axemobile-theme", settings.theme);
          }
        }
        writeLocal("axemobile-intro", settings.intro ?? "1");
      })
      .catch(() => {});
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    writeLocal("axemobile-theme", t);
    api("/settings", { method: "PUT", body: { theme: t } }).catch(() => {});
  };

  return (
    <AppCtx.Provider value={{ overview: data, error, reload, theme, setTheme }}>
      <ToastProvider>
        {intro && (theme === "dtv" ? <CinematicIntro onComplete={() => setIntro(false)} /> : <Splash onDone={() => setIntro(false)} />)}
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </AppCtx.Provider>
  );
}
