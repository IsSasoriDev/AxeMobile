import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { ReloadButton } from "@/components/layout/ReloadButton";
import { PageTransition } from "@/components/layout/PageTransition";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { UpdaterDialog } from "@/components/ui/updater-dialog";
import { ReleasePopup } from "@/components/ui/release-popup";
import { CloseDialog } from "@/components/ui/close-dialog";
import { PlatformSelector } from "@/components/ui/platform-selector";
import { AnnouncementBanner } from "@/components/ui/announcement-banner";
import { useCloseHandler } from "@/hooks/useCloseHandler";
import { usePlatform } from "@/hooks/usePlatform";
import Home from "./pages/Home";
import Stats from "./pages/Stats";
import FlashFirmware from "./pages/FlashFirmware";
import Pools from "./pages/Pools";
import CoinPools from "./pages/CoinPools";
import Resources from "./pages/Resources";
import Cave from "./pages/Cave";
import Config from "./pages/Config";
import Settings from "./pages/Settings";
import Achievements from "./pages/Achievements";
import Blocks from "./pages/Blocks";
import GitHub from "./pages/GitHub";
import Admin from "./pages/Admin";
import AtlasPool from "./pages/AtlasPool";
import NotFound from "./pages/NotFound";

const Blog = lazy(() => import("./pages/Blog"));

const queryClient = new QueryClient();

const AdminButton = () => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/admin")}
      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
      title="Admin"
    >
      <Shield className="h-4 w-4" />
    </button>
  );
};

const DesktopLayout = () => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-12 flex items-center justify-between border-b border-border/50 px-4 bg-card/30 backdrop-blur-sm">
          <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
          <div className="flex items-center gap-2">
            <AdminButton />
            <ReloadButton />
            <ThemeSelector />
          </div>
        </header>
        <AnnouncementBanner />
        <main className="flex-1 overflow-hidden">
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
              
              <Route path="/blog" element={<Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}><Blog /></Suspense>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </main>
      </div>
    </div>
  </SidebarProvider>
);

const AppContent = () => {
  const { showCloseDialog, setShowCloseDialog } = useCloseHandler();
  const { isFirstTime, setPlatform, isMobile: isMobilePlatform } = usePlatform();
  const [showLoading, setShowLoading] = useState(true);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);

  const handleLoadingComplete = () => {
    setShowLoading(false);
    if (isFirstTime) {
      setShowPlatformSelector(true);
    }
  };

  const handlePlatformSelect = (platform: "pc" | "mobile") => {
    setPlatform(platform);
    setShowPlatformSelector(false);
  };

  if (showLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  if (showPlatformSelector) {
    return <PlatformSelector onSelect={handlePlatformSelect} />;
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <UpdaterDialog />
      <ReleasePopup />
      <CloseDialog open={showCloseDialog} onOpenChange={setShowCloseDialog} />
      <BrowserRouter>
        {isMobilePlatform ? <MobileLayout /> : <DesktopLayout />}
      </BrowserRouter>
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
