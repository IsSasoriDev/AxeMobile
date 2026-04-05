import { useState, useRef, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { MobileBottomNav } from "./MobileBottomNav";
import { PageTransition } from "./PageTransition";
import { ThemeSelector } from "./ThemeSelector";
import { ReloadButton } from "./ReloadButton";
import { Pickaxe, Shield } from "lucide-react";
import { AnnouncementBanner } from "@/components/ui/announcement-banner";
import { useTheme } from "@/hooks/useTheme";
import powerMiningLogo from "@/assets/powermining-logo.png";
import ixtechLogo from "@/assets/ixtech-logo.png";
import dtvLogo from "@/assets/dtv-electronics-logo.png";
import atlasLogo from "@/assets/atlas-logo.png";

import Home from "@/pages/Home";
import Stats from "@/pages/Stats";
import Blocks from "@/pages/Blocks";
import Config from "@/pages/Config";
import Settings from "@/pages/Settings";
import Achievements from "@/pages/Achievements";
import FlashFirmware from "@/pages/FlashFirmware";
import Pools from "@/pages/Pools";
import CoinPools from "@/pages/CoinPools";
import Resources from "@/pages/Resources";
import Cave from "@/pages/Cave";
import GitHub from "@/pages/GitHub";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import AtlasPool from "@/pages/AtlasPool";
import Blog from "@/pages/Blog";

function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const threshold = 80;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) { setPullDistance(0); return; }
    const delta = Math.max(0, e.touches[0].clientY - startY.current);
    setPullDistance(Math.min(delta * 0.4, 120));
  }, [pulling]);

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(50);
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } else {
      setPullDistance(0);
    }
    setPulling(false);
  }, [pullDistance, refreshing]);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-30 transition-all duration-200 pointer-events-none"
        style={{ height: `${pullDistance}px`, opacity: pullDistance > 10 ? 1 : 0 }}
      >
        <div className={`w-6 h-6 rounded-full border-2 border-primary border-t-transparent ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pullDistance * 3}deg)` }}
        />
        {pullDistance >= threshold && !refreshing && (
          <span className="text-[9px] font-mono text-primary ml-2">Release to refresh</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        style={{ transform: `translateY(${pullDistance}px)`, transition: pulling ? 'none' : 'transform 0.3s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export function MobileLayout() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const renderLogo = () => {
    if (theme === "powermining") return <img src={powerMiningLogo} alt="PowerMining" className="h-5 w-auto" />;
    if (theme === "ixtech") return <img src={ixtechLogo} alt="IxTech" className="h-5 w-auto" />;
    if (theme === "dtv") return <img src={dtvLogo} alt="DTV" className="h-5 w-auto" />;
    if (theme === "atlas") return (
      <div className="flex items-center gap-1.5">
        <img src={atlasLogo} alt="AtlasPool" className="h-5 w-auto" />
        <span className="atlas-neon-text text-xs font-bold font-mono">AtlasPool</span>
      </div>
    );
    return (
      <div className="flex items-center gap-1.5">
        <Pickaxe className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold font-mono text-primary">AxeMobile</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-11 flex items-center justify-between border-b border-border/50 px-3 bg-card/30 backdrop-blur-sm sticky top-0 z-40">
        {renderLogo()}
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate("/admin")} className="p-1 rounded text-muted-foreground hover:text-primary transition-all" title="Admin">
            <Shield className="h-3.5 w-3.5" />
          </button>
          <ReloadButton />
          <ThemeSelector />
        </div>
      </header>

      <AnnouncementBanner />
      <PullToRefresh>
        <main className="pb-16">
          <PageTransition>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/blocks" element={<Blocks />} />
              <Route path="/config" element={<Config />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/flash" element={<FlashFirmware />} />
              <Route path="/pools" element={<Pools />} />
              <Route path="/pools/:coin" element={<CoinPools />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/cave" element={<Cave />} />
              <Route path="/github" element={<GitHub />} />
              <Route path="/atlaspool" element={<AtlasPool />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/blog" element={<Blog />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </main>
      </PullToRefresh>

      <MobileBottomNav />
    </div>
  );
}
