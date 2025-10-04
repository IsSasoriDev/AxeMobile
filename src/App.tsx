import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { PageTransition } from "@/components/layout/PageTransition";
import { LoadingScreen } from "@/components/ui/loading-screen";
import Home from "./pages/Home";
import Stats from "./pages/Stats";
import FlashFirmware from "./pages/FlashFirmware";
import Pools from "./pages/Pools";
import CoinPools from "./pages/CoinPools";
import Calculator from "./pages/Calculator";
import GitHub from "./pages/GitHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    // Check if loading screen has been shown before
    const hasShownLoading = localStorage.getItem('axemobile-loading-shown');
    if (hasShownLoading) {
      setShowLoading(false);
    }
  }, []);

  const handleLoadingComplete = () => {
    localStorage.setItem('axemobile-loading-shown', 'true');
    setShowLoading(false);
  };

  if (showLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <div className="min-h-screen flex w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col">
                <header className="h-14 flex items-center justify-between border-b px-4">
                  <SidebarTrigger />
                  <ThemeSelector />
                </header>
                <main className="flex-1 overflow-hidden">
                  <PageTransition>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/stats" element={<Stats />} />
                      <Route path="/flash" element={<FlashFirmware />} />
                      <Route path="/pools" element={<Pools />} />
                      <Route path="/pools/:coin" element={<CoinPools />} />
                      <Route path="/calculator" element={<Calculator />} />
                      <Route path="/github" element={<GitHub />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </PageTransition>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
