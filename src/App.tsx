import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { ReloadButton } from "@/components/layout/ReloadButton";
import { PageTransition } from "@/components/layout/PageTransition";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { UpdaterDialog } from "@/components/ui/updater-dialog";
import { CloseDialog } from "@/components/ui/close-dialog";
import { useCloseHandler } from "@/hooks/useCloseHandler";
import Home from "./pages/Home";
import Stats from "./pages/Stats";
import FlashFirmware from "./pages/FlashFirmware";
import Pools from "./pages/Pools";
import CoinPools from "./pages/CoinPools";
import Calculator from "./pages/Calculator";
import Cave from "./pages/Cave";
import Config from "./pages/Config";
import Achievements from "./pages/Achievements";
import AxePool from "./pages/AxePool";
import GitHub from "./pages/GitHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { showCloseDialog, setShowCloseDialog } = useCloseHandler();
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    // Simple timeout to show loading screen briefly
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 3000); // Show for 3 seconds max
    
    return () => clearTimeout(timer);
  }, []);

  const handleLoadingComplete = () => {
    setShowLoading(false);
  };

  if (showLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <UpdaterDialog />
      <CloseDialog open={showCloseDialog} onOpenChange={setShowCloseDialog} />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-14 flex items-center justify-between border-b px-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <ReloadButton />
                  <ThemeSelector />
                </div>
              </header>
              <main className="flex-1 overflow-hidden">
                <PageTransition>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/axepool" element={<AxePool />} />
                    <Route path="/config" element={<Config />} />
                    <Route path="/achievements" element={<Achievements />} />
                    <Route path="/flash" element={<FlashFirmware />} />
                    <Route path="/pools" element={<Pools />} />
                    <Route path="/pools/:coin" element={<CoinPools />} />
                    <Route path="/calculator" element={<Calculator />} />
                    <Route path="/cave" element={<Cave />} />
                    <Route path="/github" element={<GitHub />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </PageTransition>
              </main>
            </div>
          </div>
        </SidebarProvider>
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
