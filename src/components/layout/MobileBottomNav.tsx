import { NavLink, useLocation } from "react-router-dom";
import { Home, Activity, Layers, Sliders, Mountain, Zap, Waves, BookMarked, Trophy, Settings, MoreHorizontal, BookOpen } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const primaryTabs = [
  { title: "Home", url: "/", icon: Home },
  { title: "Stats", url: "/stats", icon: Activity },
  { title: "Atlas", url: "/atlaspool", icon: Waves },
  { title: "Blocks", url: "/blocks", icon: Layers },
  { title: "More", url: "#more", icon: MoreHorizontal },
];

const moreTabs = [
  { title: "Config", url: "/config", icon: Sliders },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Flash", url: "/flash", icon: Zap },
  { title: "Pools", url: "/pools", icon: Waves },
  { title: "Resources", url: "/resources", icon: BookMarked },
  { title: "Cave", url: "/cave", icon: Mountain },
  { title: "Blog", url: "/blog", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const isMoreActive = moreTabs.some(t => location.pathname === t.url || location.pathname.startsWith(t.url + "/"));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/85 backdrop-blur-2xl shadow-[0_-8px_32px_-12px_hsl(var(--background))] safe-area-bottom">
        <div className="flex items-stretch justify-around h-14">
          {primaryTabs.map((tab) => {
            if (tab.url === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors duration-200 ${
                    isMoreActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center h-7 px-4 rounded-full transition-all duration-300 ${
                      isMoreActive ? "bg-primary/15 shadow-[0_0_14px_-4px_hsl(var(--primary)/0.5)]" : ""
                    }`}
                  >
                    <tab.icon className="h-5 w-5" />
                  </span>
                  <span className="text-[9px] font-mono font-bold tracking-wide">{tab.title}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={tab.title}
                to={tab.url}
                end={tab.url === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex items-center justify-center h-7 px-4 rounded-full transition-all duration-300 ${
                        isActive ? "bg-primary/15 shadow-[0_0_14px_-4px_hsl(var(--primary)/0.5)] scale-105" : "scale-100"
                      }`}
                    >
                      <tab.icon className="h-5 w-5" />
                    </span>
                    <span className="text-[9px] font-mono font-bold tracking-wide">{tab.title}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 bg-card/95 backdrop-blur-2xl border-border/40">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2">
            {moreTabs.map((tab) => (
              <NavLink
                key={tab.title}
                to={tab.url}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 active:scale-[0.97] ${
                    isActive
                      ? "bg-gradient-to-b from-primary/15 to-primary/5 border-primary/30 text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]"
                      : "border-border/30 bg-secondary/20 text-muted-foreground hover:bg-secondary/50 hover:border-border/60 hover:text-foreground"
                  }`
                }
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-mono font-bold">{tab.title}</span>
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
