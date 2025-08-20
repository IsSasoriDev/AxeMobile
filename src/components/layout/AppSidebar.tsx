import { Home, Zap, Users, Pickaxe, Waves } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { toast } from "sonner";

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
  { title: "Home", url: "/", icon: Home },
  { title: "Flash Firmware", url: "/flash", icon: Zap },
  { title: "Pools", url: "/pools", icon: Waves },
];

const communityItems = [
  { title: "OSMU", url: "#", icon: Users, action: "copy-discord" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "hover:bg-sidebar-accent/50";

  const handleItemClick = (item: typeof communityItems[0]) => {
    if (item.action === "copy-discord") {
      navigator.clipboard.writeText("https://discord.com/invite/osmu");
      toast.success("Discord invite copied to clipboard!");
    }
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="sidebar-background">
        <div className="p-4">
          {!collapsed && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Pickaxe className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  AxeMobile
                </h1>
              </div>
              <p className="text-sm sidebar-foreground opacity-70">
                Unleash the Open Source power
              </p>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-6">
              <Pickaxe className="h-6 w-6 text-primary" />
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
          <SidebarGroupLabel className="sidebar-foreground">Community</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {communityItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild={false}>
                    <button 
                      onClick={() => handleItemClick(item)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}