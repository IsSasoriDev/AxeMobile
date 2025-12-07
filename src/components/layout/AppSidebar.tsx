import { Home, Zap, Users, Pickaxe, Waves, Activity, RefreshCw, Calculator, MessageSquare, Mountain, Settings, Trophy, Heart } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { SuggestionButton } from "@/components/SuggestionButton";
import { TypingText } from "@/components/ui/typing-text";
import { UpdateChecker } from "@/components/ui/update-checker";
import { CreditsDialog } from "@/components/ui/credits-dialog";
import powerMiningLogo from "@/assets/powermining-logo.png";
import ixtechLogo from "@/assets/ixtech-logo.png";
import dtvLogo from "@/assets/dtv-electronics-logo.png";
import { useTheme } from "@/hooks/useTheme";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Miners", url: "/", icon: Home },
  { title: "Stats", url: "/stats", icon: Activity },
  { title: "Config", url: "/config", icon: Settings },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Flash Firmware", url: "/flash", icon: Zap },
  { title: "Pools", url: "/pools", icon: Waves },
  { title: "Calculator", url: "/calculator", icon: Calculator },
  { title: "Cave", url: "/cave", icon: Mountain },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { theme } = useTheme();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const isPowerMining = theme === "powermining";
  const isIxTech = theme === "ixtech";
  const isDTV = theme === "dtv";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "hover:bg-sidebar-accent/50";

  const handleCopyDiscord = () => {
    navigator.clipboard.writeText("https://discord.com/invite/osmu");
    toast.success("Discord invite copied to clipboard!");
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="sidebar-background">
        <div className="p-4">
          {!collapsed && (
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent rounded-lg blur-xl" />
              <div className="relative p-4 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-3 mb-3">
                  {!isPowerMining && !isIxTech && !isDTV && (
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Pickaxe className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                  )}
                  {isPowerMining ? (
                    <img 
                      src={powerMiningLogo} 
                      alt="PowerMining" 
                      className="h-12 w-auto"
                    />
                  ) : isIxTech ? (
                    <img 
                      src={ixtechLogo} 
                      alt="IxTech" 
                      className="h-12 w-auto"
                    />
                  ) : isDTV ? (
                    <img 
                      src={dtvLogo} 
                      alt="DTV Electronics" 
                      className="h-12 w-auto"
                    />
                  ) : (
                    <h1 className="text-2xl font-black bg-gradient-primary bg-clip-text text-transparent"
                        style={{ textShadow: '0 0 20px hsl(var(--primary) / 0.3)' }}>
                      AxeMobile
                    </h1>
                  )}
                </div>
                <p className="text-xs sidebar-foreground opacity-80 font-medium">
                  <TypingText 
                    texts={isPowerMining ? ["Professional Mining Solutions"] : isIxTech ? ["Innovation & Technology"] : isDTV ? ["EST. BLOCK 723,420"] : ["Unleash the Open Source power", "Hack the planet", "Mine Bitcoin freely"]}
                    typingSpeed={80}
                    deletingSpeed={30}
                    pauseDuration={2000}
                  />
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-6">
              {isPowerMining ? (
                <img 
                  src={powerMiningLogo} 
                  alt="PowerMining" 
                  className="h-8 w-auto"
                />
              ) : isIxTech ? (
                <img 
                  src={ixtechLogo} 
                  alt="IxTech" 
                  className="h-8 w-auto"
                />
              ) : isDTV ? (
                <img 
                  src={dtvLogo} 
                  alt="DTV Electronics" 
                  className="h-8 w-auto"
                />
              ) : (
                <div className="p-2 rounded-lg bg-primary/20">
                  <Pickaxe className="h-7 w-7 text-primary animate-pulse" />
                </div>
              )}
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="sidebar-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
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
          <SidebarGroupLabel className="sidebar-foreground">Updates</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild={false}>
                  <UpdateChecker 
                    trigger={
                      <button className="w-full flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        {!collapsed && <span>Check Updates</span>}
                      </button>
                    }
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="sidebar-foreground">Feedback</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild={false}>
                  <SuggestionButton 
                    trigger={
                      <button className="w-full flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {!collapsed && <span>Leave a Suggestion</span>}
                      </button>
                    }
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="sidebar-foreground">Community</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild={false}>
                  <div className="w-full flex items-center gap-2">
                    <button 
                      onClick={handleCopyDiscord}
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      {!collapsed && <span>OSMU</span>}
                    </button>
                    {!collapsed && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <CreditsDialog 
                          trigger={
                            <button className="flex items-center gap-2 hover:text-primary transition-colors">
                              <Heart className="h-4 w-4" />
                              <span>Credits</span>
                            </button>
                          }
                        />
                      </>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}