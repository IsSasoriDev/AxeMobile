import { Home, Zap, Users, Pickaxe, Waves, Activity, RefreshCw, BookMarked, MessageSquare, Mountain, Settings, Trophy, Heart, Layers, Sliders, BookOpen, Bitcoin } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { SuggestionButton } from "@/components/SuggestionButton";
import { TypingText } from "@/components/ui/typing-text";
import { UpdateChecker } from "@/components/ui/update-checker";
import { CreditsDialog } from "@/components/ui/credits-dialog";
import powerMiningLogo from "@/assets/powermining-logo.png";
import ixtechLogo from "@/assets/ixtech-logo.png";
import dtvLogo from "@/assets/dtv-electronics-logo.png";
import atlasLogo from "@/assets/atlas-logo.png";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const baseItems = [
  { title: "Miners", url: "/", icon: Home },
  { title: "Stats", url: "/stats", icon: Activity },
  { title: "AtlasPool", url: "/atlaspool", icon: Waves },
  { title: "Blocks", url: "/blocks", icon: Layers },
  { title: "Config", url: "/config", icon: Sliders },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Flash", url: "/flash", icon: Zap },
  { title: "Pools", url: "/pools", icon: Waves },
  { title: "Resources", url: "/resources", icon: BookMarked },
  { title: "Cave", url: "/cave", icon: Mountain },
  { title: "Blog", url: "/blog", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { theme } = useTheme();
  const location = useLocation();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const isPowerMining = theme === "powermining";
  const isIxTech = theme === "ixtech";
  const isDTV = theme === "dtv";
  const isAtlas = theme === "atlas";

  const items = baseItems;

  const handleCopyDiscord = () => {
    navigator.clipboard.writeText("https://discord.com/invite/osmu");
    toast.success("Discord invite copied!");
  };

  const renderLogo = () => {
    if (isPowerMining) return <img src={powerMiningLogo} alt="PowerMining" className="h-8 w-auto" />;
    if (isIxTech) return <img src={ixtechLogo} alt="IxTech" className="h-8 w-auto" />;
    if (isDTV) return <img src={dtvLogo} alt="DTV Electronics" className="h-8 w-auto" />;
    if (isAtlas) return (
      <div className="flex items-center gap-2">
        <img src={atlasLogo} alt="AtlasPool" className="h-7 w-auto" />
        <span className="atlas-neon-text text-sm font-bold font-mono">AtlasPool</span>
      </div>
    );
    return null;
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-52"} collapsible="icon">
      <SidebarContent className="sidebar-background border-r border-border/30">
        <div className="p-3">
          {!collapsed && (
            <div className="mb-4">
              <div className="flex items-center gap-2.5 mb-1">
                {renderLogo() || (
                  <>
                    <div className="p-1.5 rounded-md bg-primary/12">
                      <Pickaxe className="h-4 w-4 text-primary" />
                    </div>
                    <h1 className="text-base font-bold font-mono text-primary tracking-tight">AxeMobile</h1>
                  </>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground font-mono ml-0.5">
                <TypingText
                  texts={
                    isPowerMining ? ["Professional Mining"] :
                    isIxTech ? ["Innovation & Technology"] :
                    isDTV ? ["EST. BLOCK 723,420"] :
                    isAtlas ? ["Reliable. Performant. Global."] :
                    ["Open Source Mining", "Hack the planet"]
                  }
                  typingSpeed={60} deletingSpeed={25} pauseDuration={2000}
                />
              </p>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-4">
              {isPowerMining ? <img src={powerMiningLogo} alt="" className="h-6 w-auto" /> :
               isIxTech ? <img src={ixtechLogo} alt="" className="h-6 w-auto" /> :
               isDTV ? <img src={dtvLogo} alt="" className="h-6 w-auto" /> :
               isAtlas ? <img src={atlasLogo} alt="" className="h-6 w-auto" /> :
               <div className="p-1.5 rounded-md bg-primary/12"><Pickaxe className="h-4 w-4 text-primary" /></div>}
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/50 text-[9px] uppercase tracking-[0.15em] font-bold px-3">
            Nav
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 ${
                          isActive
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        }`
                      }
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="flex-1" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/50 text-[9px] uppercase tracking-[0.15em] font-bold px-3">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 ${
                        isActive
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      }`
                    }
                  >
                    <Settings className="h-3.5 w-3.5" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild={false}>
                  <UpdateChecker trigger={
                    <button className="sidebar-system-btn w-full flex items-center gap-2.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {!collapsed && <span>Updates</span>}
                    </button>
                  } />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild={false}>
                  <SuggestionButton trigger={
                    <button className="sidebar-system-btn w-full flex items-center gap-2.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {!collapsed && <span>Feedback</span>}
                    </button>
                  } />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild={false}>
                  <div className="w-full flex items-center gap-2.5 text-xs font-mono">
                    <button onClick={handleCopyDiscord} className="sidebar-system-btn flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
                      <Users className="h-3.5 w-3.5" />
                      {!collapsed && <span>OSMU</span>}
                    </button>
                    {!collapsed && (
                      <>
                        <span className="text-muted-foreground/20">|</span>
                        <CreditsDialog trigger={
                          <button className="sidebar-system-btn flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <Heart className="h-3 w-3" /><span>Credits</span>
                          </button>
                        } />
                      </>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Support line */}
        {!collapsed && (
          <div className="px-3 pb-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText("bc1qn79tnnxtpu5u48tm7f7fd3geeqm0nft5hp44vz");
                toast.success("BTC address copied!");
              }}
              className="sidebar-system-btn group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono text-muted-foreground/50 hover:text-primary hover:bg-primary/8 transition-all duration-300 cursor-pointer"
              title="Click to copy BTC address"
            >
              <Bitcoin className="h-3 w-3 group-hover:drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)] transition-all duration-300" />
              <span className="group-hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)] transition-all duration-300 truncate">
                Support the project
              </span>
            </button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
