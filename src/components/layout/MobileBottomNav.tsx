import { NavLink, useLocation } from "react-router-dom";
import { Home, Activity, Layers, Sliders, Mountain, Zap, Waves, BookMarked, Trophy, Settings, MoreHorizontal, BookOpen } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const primaryTabs = [
  { title: "Miners", url: "/", icon: Home },
  { title: "Stats", url: "/stats", icon: Activity },
  { title: "Atlas", url: "/atlaspool", icon: Waves },
  { title: "Blocks", url: "/blocks", icon: Layers },
  { title: "More", url: "#more", icon: MoreHorizontal },
];

const moreTabs = [
  { title: "Config", url: "/config", icon: Sliders },
  { title: "Achievements", url: "/achievements", icon: Trophy },
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl safe-area-bottom">
        <div className="flex items-stretch justify-around h-14">
          {primaryTabs.map((tab) => {
            if (tab.url === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
                    isMoreActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-[9px] font-mono font-bold">{tab.title}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={tab.title}
                to={tab.url}
                end={tab.url === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[9px] font-mono font-bold">{tab.title}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm font-mono">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2">
            {moreTabs.map((tab) => (
              <NavLink
                key={tab.title}
                to={tab.url}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                    isActive
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border/30 text-muted-foreground hover:bg-secondary/40"
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
